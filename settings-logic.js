// ==========================================
// 1. SUPABASE INITIALIZATION
// ==========================================
// TODO: Replace with your actual project URL and Anon Key
const supabaseUrl = "https://hkabhikizdlbavfkualt.supabase.co";
const supabaseKey = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImhrYWJoaWtpemRsYmF2Zmt1YWx0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzY0ODgyMjUsImV4cCI6MjA5MjA2NDIyNX0.iMlS6-M1aylW8K915LPYDHOg7qUxwu5GelH_CPHLP2U";
const supabase = window.supabase.createClient(supabaseUrl, supabaseKey);

// DOM Elements
const feeInput = document.getElementById('feeInput');
const commissionInput = document.getElementById('commissionInput');
const timerInput = document.getElementById('timerInput');
const logoPreview = document.getElementById('logoPreview');
const logoFileInput = document.getElementById('logoFileInput');
const uploadLogoBtn = document.getElementById('uploadLogoBtn');
const uploadStatus = document.getElementById('uploadStatus');
const saveBtn = document.getElementById('saveBtn');

let currentLogoUrl = "";

// ==========================================
// 2. FETCH DATA ON LOAD
// ==========================================
document.addEventListener("DOMContentLoaded", async () => {
    await fetchSettings();
});

async function fetchSettings() {
    try {
        // Fetch App Settings (Timer, Commission, Logo)
        const { data: appSettings, error: appError } = await supabase
            .from('app_settings')
            .select('*')
            .single(); // Assuming single row for global settings

        if (appError && appError.code !== 'PGRST116') throw appError;

        if (appSettings) {
            commissionInput.value = appSettings.rider_commission || "";
            timerInput.value = appSettings.delivery_timer || "";
            if (appSettings.logo_url) {
                currentLogoUrl = appSettings.logo_url;
                logoPreview.src = currentLogoUrl;
            }
        }

        // Fetch Delivery Area Fee (No default 150 hardcoded)
        const { data: areaData, error: areaError } = await supabase
            .from('delivery_areas')
            .select('customer_delivery_fee')
            .limit(1)
            .single(); 

        if (areaError && areaError.code !== 'PGRST116') throw areaError;

        if (areaData) {
            feeInput.value = areaData.customer_delivery_fee || "";
        }

    } catch (error) {
        console.error("Error fetching data:", error);
        alert("Failed to load settings. Check console.");
    }
}

// ==========================================
// 3. HANDLE LOGO UPLOAD (BUCKET)
// ==========================================
logoFileInput.addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (file) {
        // Show preview instantly
        logoPreview.src = URL.createObjectURL(file);
        uploadLogoBtn.classList.remove('hidden'); // Show upload button
    }
});

uploadLogoBtn.addEventListener('click', async () => {
    const file = logoFileInput.files[0];
    if (!file) return;

    uploadStatus.textContent = "Uploading...";
    uploadStatus.classList.replace('text-gray-500', 'text-blue-500');
    uploadLogoBtn.disabled = true;

    try {
        const fileExt = file.name.split('.').pop();
        const fileName = `logo_${Date.now()}.${fileExt}`;

        // Upload to 'branding' bucket
        const { data, error } = await supabase.storage
            .from('branding')
            .upload(fileName, file, { cacheControl: '3600', upsert: false });

        if (error) throw error;

        // Get Public URL
        const { data: publicUrlData } = supabase.storage
            .from('branding')
            .getPublicUrl(fileName);

        currentLogoUrl = publicUrlData.publicUrl;
        
        uploadStatus.textContent = "Uploaded successfully! Remember to Save Changes.";
        uploadStatus.classList.replace('text-blue-500', 'text-green-600');
        uploadLogoBtn.classList.add('hidden');

    } catch (error) {
        console.error("Upload error:", error);
        uploadStatus.textContent = "Upload failed.";
        uploadStatus.classList.replace('text-blue-500', 'text-red-500');
    } finally {
        uploadLogoBtn.disabled = false;
    }
});

// ==========================================
// 4. SAVE ALL DATA TO SUPABASE
// ==========================================
saveBtn.addEventListener('click', async () => {
    const originalText = saveBtn.innerHTML;
    saveBtn.innerHTML = `<i class="fas fa-spinner fa-spin"></i> Saving...`;
    saveBtn.disabled = true;

    try {
        // Update app_settings table (Removed popup msg)
        const { error: appError } = await supabase
            .from('app_settings')
            .update({
                rider_commission: commissionInput.value,
                delivery_timer: timerInput.value,
                logo_url: currentLogoUrl
            })
            .eq('id', 1); // Replace 'id', 1 with your actual primary key setup

        if (appError) throw appError;

        // Update delivery_areas table
        const { error: areaError } = await supabase
            .from('delivery_areas')
            .update({
                customer_delivery_fee: feeInput.value
            })
            .eq('id', 1); // Replace 'id', 1 with your actual target area logic

        if (areaError) throw areaError;

        // Success state
        saveBtn.innerHTML = `<i class="fas fa-check"></i> Saved`;
        saveBtn.classList.replace('bg-[#0f172a]', 'bg-green-600');
        
        setTimeout(() => {
            saveBtn.innerHTML = originalText;
            saveBtn.classList.replace('bg-green-600', 'bg-[#0f172a]');
            saveBtn.disabled = false;
        }, 2000);

    } catch (error) {
        console.error("Save error:", error);
        alert("Error saving settings. Check console.");
        saveBtn.innerHTML = originalText;
        saveBtn.disabled = false;
    }
});
