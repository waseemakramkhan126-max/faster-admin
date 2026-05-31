// Supabase Configuration
// Yahan apne Supabase project ke actual URL aur ANON KEY replace karein
const supabaseUrl = 'https://hkabhikizdlbavfkualt.supabase.co/rest/v1/';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImhrYWJoaWtpemRsYmF2Zmt1YWx0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzY0ODgyMjUsImV4cCI6MjA5MjA2NDIyNX0.iMlS6-M1aylW8K915LPYDHOg7qUxwu5GelH_CPHLP2U';
const supabase = window.supabase.createClient(supabaseUrl, supabaseKey);

// DOM Elements - App Settings
const logoPreview = document.getElementById('logoPreview');
const logoUploadInput = document.getElementById('logoUpload');
const uploadLogoBtn = document.getElementById('uploadLogoBtn');
const logoUrlHidden = document.getElementById('logoUrlHidden');
const riderCommissionInput = document.getElementById('riderCommission');
const deliveryTimerInput = document.getElementById('deliveryTimer');
const appSettingsForm = document.getElementById('appSettingsForm');
const saveAppBtn = document.getElementById('saveAppBtn');

// DOM Elements - Delivery Areas
const deliveryAreaForm = document.getElementById('deliveryAreaForm');
const areasTableBody = document.getElementById('areasTableBody');

document.addEventListener('DOMContentLoaded', () => {
    loadAppSettings();
    loadDeliveryAreas();
});

// ==========================================
// 1. App Settings & Logo Upload Logic
// ==========================================

// File input trigger
uploadLogoBtn.addEventListener('click', () => {
    logoUploadInput.click();
});

// Logo Upload to Supabase Storage ('branding' bucket)
logoUploadInput.addEventListener('change', async (event) => {
    const file = event.target.files[0];
    if (!file) return;

    uploadLogoBtn.textContent = "Uploading...";
    uploadLogoBtn.disabled = true;

    try {
        const fileExt = file.name.split('.').pop();
        const fileName = `logo_${Date.now()}.${fileExt}`;

        // 1. Upload to bucket
        const { data, error } = await supabase.storage
            .from('branding')
            .upload(fileName, file, { upsert: true });

        if (error) throw error;

        // 2. Get Public URL
        const { data: publicUrlData } = supabase.storage
            .from('branding')
            .getPublicUrl(fileName);
        
        const publicUrl = publicUrlData.publicUrl;
        
        // 3. Update UI
        logoPreview.src = publicUrl;
        logoUrlHidden.value = publicUrl;
        alert("Logo uploaded successfully! Please click 'Save App Settings' to apply.");
        
    } catch (error) {
        console.error("Upload error:", error);
        alert("Error uploading logo: " + error.message);
    } finally {
        uploadLogoBtn.textContent = "Upload Logo";
        uploadLogoBtn.disabled = false;
    }
});

// Load existing App Settings from 'app_settings' table
async function loadAppSettings() {
    try {
        // Assume row id 1 contains the active settings
        const { data, error } = await supabase
            .from('app_settings')
            .select('*')
            .eq('id', 1)
            .single();

        if (error && error.code !== 'PGRST116') throw error; // ignore no rows error initially

        if (data) {
            if (data.logo_url) {
                logoPreview.src = data.logo_url;
                logoUrlHidden.value = data.logo_url;
            }
            if (data.rider_commission) riderCommissionInput.value = data.rider_commission;
            if (data.delivery_timer) deliveryTimerInput.value = data.delivery_timer;
        }
    } catch (error) {
        console.error("Error loading settings:", error);
    }
}

// Save App Settings to Supabase
appSettingsForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    saveAppBtn.textContent = "Saving...";

    const settingsData = {
        id: 1, // Fixed ID for global settings
        rider_commission: parseFloat(riderCommissionInput.value),
        delivery_timer: parseInt(deliveryTimerInput.value),
        logo_url: logoUrlHidden.value
    };

    try {
        const { error } = await supabase
            .from('app_settings')
            .upsert(settingsData);

        if (error) throw error;
        alert("App settings saved successfully!");
    } catch (error) {
        console.error("Error saving settings:", error);
        alert("Error saving settings.");
    } finally {
        saveAppBtn.textContent = "Save App Settings";
    }
});

// ==========================================
// 2. Delivery Areas Logic
// ==========================================

// Load Delivery Areas
async function loadDeliveryAreas() {
    try {
        const { data, error } = await supabase
            .from('delivery_areas')
            .select('*')
            .order('city', { ascending: true });

        if (error) throw error;

        areasTableBody.innerHTML = ''; // Clear table
        
        data.forEach(area => {
            const statusClass = area.is_active ? 'status-active' : 'status-inactive';
            const statusText = area.is_active ? 'Active' : 'Inactive';
            
            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td>${area.city}</td>
                <td>${area.area_name}</td>
                <td>Rs. ${area.custmer_delivery_fee}</td>
                <td>${area.open_hour} - ${area.close_hour}</td>
                <td><span class="status-badge ${statusClass}">${statusText}</span></td>
            `;
            areasTableBody.appendChild(tr);
        });
    } catch (error) {
        console.error("Error loading delivery areas:", error);
    }
}

// Save New Delivery Area
deliveryAreaForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    
    const areaData = {
        city: document.getElementById('city').value,
        area_name: document.getElementById('areaName').value,
        custmer_delivery_fee: parseFloat(document.getElementById('deliveryFee').value),
        is_active: document.getElementById('isActive').value === 'true',
        open_hour: document.getElementById('openHour').value,
        close_hour: document.getElementById('closeHour').value
    };

    try {
        const { error } = await supabase
            .from('delivery_areas')
            .insert([areaData]);

        if (error) throw error;
        
        alert("Delivery area added!");
        deliveryAreaForm.reset();
        loadDeliveryAreas(); // Refresh table
        
    } catch (error) {
        console.error("Error adding area:", error);
        alert("Error adding delivery area: " + error.message);
    }
});
