// ==========================================
// 1. Supabase Configuration & Safe Initialization
// ==========================================
const supabaseUrl = 'https://hkabhikizdlbavfkualt.supabase.co'; // <-- Apni actual URL
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImhrYWJoaWtpemRsYmF2Zmt1YWx0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzY0ODgyMjUsImV4cCI6MjA5MjA2NDIyNX0.iMlS6-M1aylW8K915LPYDHOg7qUxwu5GelH_CPHLP2U';    // <-- Apni actual Anon Key

// 🛠️ FIX: Variable ka naam 'supabase' se badal kar 'supabaseClient' kar diya hai
let supabaseClient = null;

try {
    if (window.supabase) {
        // window.supabase library hai, us se createClient call kiya
        supabaseClient = window.supabase.createClient(supabaseUrl, supabaseKey);
    } else {
        console.error("CRITICAL: Supabase CDN library load nahi hui!");
        alert("System Error: Supabase library nahi mili. Internet check karein ya HTML check karein.");
    }
} catch (initError) {
    console.error("Supabase initialization crash:", initError);
}

// Poore DOM ke load hone ka intezar karein
document.addEventListener('DOMContentLoaded', () => {
    console.log("Project Faster Settings DOM fully loaded.");

    const toastContainer = document.getElementById('toastContainer');
    
    // Fail-safe Toast system
    function showToast(message, type = 'success') {
        if (!toastContainer) {
            alert(`${type.toUpperCase()}: ${message}`);
            return;
        }
        const toast = document.createElement('div');
        toast.className = `toast ${type}`;
        toast.innerText = message;
        toastContainer.appendChild(toast);
        
        setTimeout(() => toast.classList.add('show'), 10);
        setTimeout(() => {
            toast.classList.remove('show');
            setTimeout(() => toast.remove(), 300);
        }, 5000);
    }

    // Keys check
    if (supabaseUrl === 'YOUR_SUPABASE_PROJECT_URL' || supabaseKey === 'YOUR_SUPABASE_ANON_KEY') {
        showToast("Configuration Error: settings-logic.js me Supabase keys daalna zaroori hain!", "error");
    }

    // ==========================================
    // 2. Upload Logo Button Logic
    // ==========================================
    const uploadLogoBtn = document.getElementById('uploadLogoBtn');
    const logoUploadInput = document.getElementById('logoUpload');
    const logoPreview = document.getElementById('logoPreview');
    const logoUrlHidden = document.getElementById('logoUrlHidden');

    if (uploadLogoBtn && logoUploadInput) {
        uploadLogoBtn.addEventListener('click', (e) => {
            e.preventDefault();
            logoUploadInput.click();
        });

        logoUploadInput.addEventListener('change', async (event) => {
            const file = event.target.files[0];
            if (!file) return;

            if (!supabaseClient) {
                showToast("Storage Error: Supabase connected nahi hai.", "error");
                return;
            }

            uploadLogoBtn.textContent = "Uploading...";
            uploadLogoBtn.disabled = true;

            try {
                const fileExt = file.name.split('.').pop();
                const fileName = `logo_${Date.now()}.${fileExt}`;

                // 🛠️ FIX: supabase ki jagah supabaseClient use kiya
                const { data, error } = await supabaseClient.storage
                    .from('branding')
                    .upload(fileName, file, { upsert: true });

                if (error) throw new Error(error.message);

                const { data: publicUrlData } = supabaseClient.storage
                    .from('branding')
                    .getPublicUrl(fileName);
                
                if (logoPreview) logoPreview.src = publicUrlData.publicUrl;
                if (logoUrlHidden) logoUrlHidden.value = publicUrlData.publicUrl;
                
                showToast("Logo storage me save ho gaya! Ab 'Save App Settings' dabayein.", "success");
            } catch (error) {
                showToast(`Upload Failed: ${error.message}`, "error");
            } finally {
                uploadLogoBtn.textContent = "Upload Logo";
                uploadLogoBtn.disabled = false;
            }
        });
    }

    // ==========================================
    // 3. Save App Settings Button Logic
    // ==========================================
    const appSettingsForm = document.getElementById('appSettingsForm');
    const saveAppBtn = document.getElementById('saveAppBtn');
    const riderCommissionInput = document.getElementById('riderCommission');
    const deliveryTimerInput = document.getElementById('deliveryTimer');

    if (appSettingsForm && saveAppBtn) {
        appSettingsForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            
            if (!supabaseClient) {
                showToast("Database Error: Supabase client missing.", "error");
                return;
            }

            saveAppBtn.textContent = "Saving...";
            saveAppBtn.disabled = true;

            const settingsData = {
                id: 1, 
                rider_commission: parseFloat(riderCommissionInput?.value) || 0,
                delivery_timer: parseInt(deliveryTimerInput?.value) || 0,
                logo_url: logoUrlHidden?.value || ''
            };

            try {
                // 🛠️ FIX: supabase ki jagah supabaseClient use kiya
                const { error } = await supabaseClient
                    .from('app_settings')
                    .upsert(settingsData);

                if (error) throw new Error(error.message);
                showToast("App settings successfully save ho gayin!", "success");
            } catch (error) {
                showToast(`App Settings Error: ${error.message}`, "error");
            } finally {
                saveAppBtn.textContent = "Save App Settings";
                saveAppBtn.disabled = false;
            }
        });
    }

    // ==========================================
    // 4. Add/Save Delivery Area Button Logic
    // ==========================================
    const deliveryAreaForm = document.getElementById('deliveryAreaForm');
    const areasTableBody = document.getElementById('areasTableBody');

    if (deliveryAreaForm) {
        const areaSaveBtn = deliveryAreaForm.querySelector('button[type="submit"]');

        deliveryAreaForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            
            if (!supabaseClient) {
                showToast("Database Error: Supabase client missing.", "error");
                return;
            }

            if (areaSaveBtn) {
                areaSaveBtn.textContent = "Saving...";
                areaSaveBtn.disabled = true;
            }
            
            const areaData = {
                city: document.getElementById('city')?.value || '',
                area_name: document.getElementById('areaName')?.value || '',
                customer_delivery_fee: parseFloat(document.getElementById('deliveryFee')?.value) || 0,
                is_active: document.getElementById('isActive')?.value === 'true',
                open_hour: document.getElementById('openHour')?.value || '',
                close_hour: document.getElementById('closeHour')?.value || ''
            };

            try {
                // 🛠️ FIX: supabase ki jagah supabaseClient use kiya
                const { error } = await supabaseClient
                    .from('delivery_areas')
                    .insert([areaData]);

                if (error) throw new Error(error.message);
                
                showToast("Delivery area database me save ho gaya!", "success");
                deliveryAreaForm.reset();
                loadDeliveryAreas(); 
            } catch (error) {
                showToast(`Delivery Area Error: ${error.message}`, "error");
            } finally {
                if (areaSaveBtn) {
                    areaSaveBtn.textContent = "Add / Save Area";
                    areaSaveBtn.disabled = false;
                }
            }
        });
    }

    // ==========================================
    // 5. Data Load Functions
    // ==========================================
    async function loadAppSettings() {
        if (!supabaseClient) return;
        try {
            // 🛠️ FIX: supabase ki jagah supabaseClient use kiya
            const { data, error } = await supabaseClient
                .from('app_settings')
                .select('*')
                .eq('id', 1)
                .single();

            if (error && error.code !== 'PGRST116') return;

            if (data) {
                if (data.logo_url && logoPreview) {
                    logoPreview.src = data.logo_url;
                    if (logoUrlHidden) logoUrlHidden.value = data.logo_url;
                }
                if (data.rider_commission && riderCommissionInput) riderCommissionInput.value = data.rider_commission;
                if (data.delivery_timer && deliveryTimerInput) deliveryTimerInput.value = data.delivery_timer;
            }
        } catch (err) {
            console.error("Data loading failed:", err);
        }
    }

    async function loadDeliveryAreas() {
        if (!supabaseClient || !areasTableBody) return;
        try {
            // 🛠️ FIX: supabase ki jagah supabaseClient use kiya
            const { data, error } = await supabaseClient
                .from('delivery_areas')
                .select('*')
                .order('city', { ascending: true });

            if (error) throw error;

            areasTableBody.innerHTML = ''; 
            data.forEach(area => {
                const statusClass = area.is_active ? 'status-active' : 'status-inactive';
                const statusText = area.is_active ? 'Active' : 'Inactive';
                
                const tr = document.createElement('tr');
                tr.innerHTML = `
                    <td>${area.city || '-'}</td>
                    <td>${area.area_name || '-'}</td>
                    <td>Rs. ${area.custmer_delivery_fee || 0}</td>
                    <td>${area.open_hour || '-'} - ${area.close_hour || '-'}</td>
                    <td><span class="status-badge ${statusClass}">${statusText}</span></td>
                `;
                areasTableBody.appendChild(tr);
            });
        } catch (err) {
            console.error("Areas loading failed:", err);
        }
    }

    // Page load hote hi data fetch karein
    loadAppSettings();
    loadDeliveryAreas();
});
