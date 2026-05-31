// Supabase Configuration
// LAZMI: Yahan apni actual keys dalein, warna button kam nahi karenge
const supabaseUrl = 'https://hkabhikizdlbavfkualt.supabase.co';
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
const toastContainer = document.getElementById('toastContainer');

// ==========================================
// Toast Notification System
// ==========================================
function showToast(message, type = 'success') {
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    toast.innerText = message;
    
    toastContainer.appendChild(toast);
    
    // Animation trigger karne ke liye thora delay
    setTimeout(() => {
        toast.classList.add('show');
    }, 10);

    // 5 second baad toast ko remove karein
    setTimeout(() => {
        toast.classList.remove('show');
        setTimeout(() => toast.remove(), 300);
    }, 5000);
}

// Initial Check: Ensure Supabase is configured
if (supabaseUrl === 'YOUR_SUPABASE_PROJECT_URL') {
    setTimeout(() => showToast("Error: Supabase URL aur Key JS file me replace nahi ki gayin!", "error"), 1000);
}

document.addEventListener('DOMContentLoaded', () => {
    loadAppSettings();
    loadDeliveryAreas();
});

// ==========================================
// 1. App Settings & Logo Upload Logic
// ==========================================
uploadLogoBtn.addEventListener('click', () => {
    logoUploadInput.click();
});

logoUploadInput.addEventListener('change', async (event) => {
    const file = event.target.files[0];
    if (!file) return;

    uploadLogoBtn.textContent = "Uploading...";
    uploadLogoBtn.disabled = true;

    try {
        const fileExt = file.name.split('.').pop();
        const fileName = `logo_${Date.now()}.${fileExt}`;

        const { data, error } = await supabase.storage
            .from('branding')
            .upload(fileName, file, { upsert: true });

        if (error) {
            // Screen par error show karega
            throw new Error(`Storage Error: ${error.message}`); 
        }

        const { data: publicUrlData } = supabase.storage
            .from('branding')
            .getPublicUrl(fileName);
        
        logoPreview.src = publicUrlData.publicUrl;
        logoUrlHidden.value = publicUrlData.publicUrl;
        
        showToast("Logo successfully upload ho gaya hai. Ab 'Save App Settings' dabayein.", "success");
        
    } catch (error) {
        showToast(error.message, "error");
    } finally {
        uploadLogoBtn.textContent = "Upload Logo";
        uploadLogoBtn.disabled = false;
    }
});

async function loadAppSettings() {
    try {
        const { data, error } = await supabase
            .from('app_settings')
            .select('*')
            .eq('id', 1)
            .single();

        if (error && error.code !== 'PGRST116') {
            showToast(`Load Settings Error: ${error.message}`, "error");
            return;
        }

        if (data) {
            if (data.logo_url) {
                logoPreview.src = data.logo_url;
                logoUrlHidden.value = data.logo_url;
            }
            if (data.rider_commission) riderCommissionInput.value = data.rider_commission;
            if (data.delivery_timer) deliveryTimerInput.value = data.delivery_timer;
        }
    } catch (error) {
        showToast(`System Error: ${error.message}`, "error");
    }
}

appSettingsForm.addEventListener('submit', async (e) => {
    e.preventDefault(); // Page refresh hone se rokta hai
    saveAppBtn.textContent = "Saving...";
    saveAppBtn.disabled = true;

    const settingsData = {
        id: 1, 
        rider_commission: parseFloat(riderCommissionInput.value) || 0,
        delivery_timer: parseInt(deliveryTimerInput.value) || 0,
        logo_url: logoUrlHidden.value || ''
    };

    try {
        const { error } = await supabase
            .from('app_settings')
            .upsert(settingsData);

        if (error) {
            throw new Error(`DB Error (${error.code}): ${error.message}`);
        }
        
        showToast("App settings successfully save ho gayin!", "success");
    } catch (error) {
        showToast(error.message, "error");
    } finally {
        saveAppBtn.textContent = "Save App Settings";
        saveAppBtn.disabled = false;
    }
});

// ==========================================
// 2. Delivery Areas Logic
// ==========================================
async function loadDeliveryAreas() {
    try {
        const { data, error } = await supabase
            .from('delivery_areas')
            .select('*')
            .order('city', { ascending: true });

        if (error) {
            showToast(`Load Areas Error: ${error.message}`, "error");
            return;
        }

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
    } catch (error) {
        showToast(`System Error: ${error.message}`, "error");
    }
}

const areaSaveBtn = deliveryAreaForm.querySelector('button[type="submit"]');

deliveryAreaForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    areaSaveBtn.textContent = "Saving...";
    areaSaveBtn.disabled = true;
    
    const areaData = {
        city: document.getElementById('city').value,
        area_name: document.getElementById('areaName').value,
        custmer_delivery_fee: parseFloat(document.getElementById('deliveryFee').value) || 0,
        is_active: document.getElementById('isActive').value === 'true',
        open_hour: document.getElementById('openHour').value,
        close_hour: document.getElementById('closeHour').value
    };

    try {
        const { error } = await supabase
            .from('delivery_areas')
            .insert([areaData]);

        if (error) {
            throw new Error(`DB Error (${error.code}): ${error.message}`);
        }
        
        showToast("Delivery area successfully add ho gaya!", "success");
        deliveryAreaForm.reset();
        loadDeliveryAreas(); 
        
    } catch (error) {
        showToast(error.message, "error");
    } finally {
        areaSaveBtn.textContent = "Add / Save Area";
        areaSaveBtn.disabled = false;
    }
});
