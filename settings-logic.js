// ==========================================
// 1. Supabase Configuration & Safe Initialization
// ==========================================
const supabaseUrl = 'https://hkabhikizdlbavfkualt.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImhrYWJoaWtpemRsYmF2Zmt1YWx0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzY0ODgyMjUsImV4cCI6MjA5MjA2NDIyNX0.iMlS6-M1aylW8K915LPYDHOg7qUxwu5GelH_CPHLP2U';

let supabaseClient = null;

try {
    if (window.supabase) {
        supabaseClient = window.supabase.createClient(supabaseUrl, supabaseKey);
    } else {
        console.error("Supabase CDN library load nahi hui!");
        alert("System Error: Supabase library missing.");
    }
} catch (initError) {
    console.error("Supabase initialization crash:", initError);
}

// ==========================================
// DOM Loaded (Jab HTML poori tarah load ho jaye)
// ==========================================
document.addEventListener('DOMContentLoaded', () => {

    console.log("Project Faster Settings Loaded");

    // ==========================================
    // GLOBAL STATE (Data edit karte waqt ID save rakhne ke liye)
    // ==========================================
    let editingAreaId = null;

    // ==========================================
    // HTML ELEMENTS SELECTION
    // ==========================================
    const toastContainer = document.getElementById('toastContainer');
    const uploadLogoBtn = document.getElementById('uploadLogoBtn');
    const logoUploadInput = document.getElementById('logoUpload');
    const logoPreview = document.getElementById('logoPreview');
    const logoUrlHidden = document.getElementById('logoUrlHidden');
    const appSettingsForm = document.getElementById('appSettingsForm');
    const saveAppBtn = document.getElementById('saveAppBtn');
    const riderCommissionInput = document.getElementById('riderCommission');
    const deliveryTimerInput = document.getElementById('deliveryTimer');
    const deliveryAreaForm = document.getElementById('deliveryAreaForm');
    const areasTableBody = document.getElementById('areasTableBody');
    const areaSaveBtn = deliveryAreaForm?.querySelector('button[type="submit"]');

    // ==========================================
    // TOAST FUNCTION (Popup alerts dikhane ke liye)
    // ==========================================
    function showToast(message, type = 'success') {
        if (!toastContainer) {
            alert(message);
            return;
        }

        const toast = document.createElement('div');
        toast.className = `toast ${type}`;
        toast.innerText = message;

        toastContainer.appendChild(toast);

        setTimeout(() => { toast.classList.add('show'); }, 10);

        setTimeout(() => {
            toast.classList.remove('show');
            setTimeout(() => { toast.remove(); }, 300);
        }, 4000);
    }

    // ==========================================
    // LOGO UPLOAD (Storage me upload + Database me URL save)
    // ==========================================
    if (uploadLogoBtn && logoUploadInput) {
        uploadLogoBtn.addEventListener('click', (e) => {
            e.preventDefault();
            logoUploadInput.click();
        });

        logoUploadInput.addEventListener('change', async (event) => {
            const file = event.target.files[0];
            if (!file) return;

            if (!supabaseClient) {
                showToast("Supabase connect nahi hai.", "error");
                return;
            }

            uploadLogoBtn.textContent = "Uploading...";
            uploadLogoBtn.disabled = true;

            try {
                const fileExt = file.name.split('.').pop();
                const fileName = `logo_${Date.now()}.${fileExt}`;

                // 1. Storage bucket 'branding' me logo save karna
                const { error: storageError } = await supabaseClient.storage
                    .from('branding')
                    .upload(fileName, file, { upsert: true });

                if (storageError) throw new Error(storageError.message);

                // 2. Uploaded logo ka Public URL hasil karna
                const { data: publicUrlData } = supabaseClient.storage
                    .from('branding')
                    .getPublicUrl(fileName);

                // Screen par logo preview show karna
                logoPreview.src = publicUrlData.publicUrl;
                logoUrlHidden.value = publicUrlData.publicUrl;

                // 3. URL ko usi waqt database ki 'app_settings' table me save karna
                const { error: dbError } = await supabaseClient
                    .from('app_settings')
                    .upsert({ id: 1, logo_url: publicUrlData.publicUrl });

                if (dbError) throw new Error("Storage me save hua par DB me nahi: " + dbError.message);

                showToast("Logo upload aur DB me save ho gaya! 🎉", "success");

            } catch (error) {
                showToast(error.message, "error");
            } finally {
                uploadLogoBtn.textContent = "Upload Logo";
                uploadLogoBtn.disabled = false;
            }
        });
    }

    // ==========================================
    // SAVE APP SETTINGS (Commission aur Timer save karne ke liye)
    // ==========================================
    if (appSettingsForm) {
        appSettingsForm.addEventListener('submit', async (e) => {
            e.preventDefault();

            if (!supabaseClient) {
                showToast("Supabase missing.", "error");
                return;
            }

            saveAppBtn.textContent = "Saving...";
            saveAppBtn.disabled = true;

            const settingsData = {
                id: 1,
                rider_commission: parseFloat(riderCommissionInput.value) || 0,
                delivery_timer: parseInt(deliveryTimerInput.value) || 0,
                logo_url: logoUrlHidden.value || ''
            };

            try {
                const { error } = await supabaseClient
                    .from('app_settings')
                    .upsert(settingsData);

                if (error) throw new Error(error.message);

                showToast("Settings save ho gayin!", "success");

            } catch (error) {
                showToast(error.message, "error");
            } finally {
                saveAppBtn.textContent = "Save App Settings";
                saveAppBtn.disabled = false;
            }
        });
    }

    // ==========================================
    // ADD / UPDATE DELIVERY AREA (Naya Area insert ya purana update karna)
    // ==========================================
    if (deliveryAreaForm) {
        deliveryAreaForm.addEventListener('submit', async (e) => {
            e.preventDefault();

            if (!supabaseClient) {
                showToast("Supabase missing.", "error");
                return;
            }

            areaSaveBtn.textContent = editingAreaId ? "Updating..." : "Saving...";
            areaSaveBtn.disabled = true;

            const areaData = {
                city: document.getElementById('city').value,
                area_name: document.getElementById('areaName').value,
                customer_delivery_fee: parseFloat(document.getElementById('deliveryFee').value) || 0,
                is_active: document.getElementById('isActive').value === 'true',
                open_hour: document.getElementById('openHour').value,
                close_hour: document.getElementById('closeHour').value
            };

            try {
                let query;
                if (editingAreaId) {
                    // Agar Edit Mode on hai to UPDATE query chalegi
                    query = supabaseClient
                        .from('delivery_areas')
                        .update(areaData)
                        .eq('id', editingAreaId);
                } else {
                    // Agar naya area hai to INSERT query chalegi
                    query = supabaseClient
                        .from('delivery_areas')
                        .insert([areaData]);
                }

                const { error } = await query;
                if (error) throw new Error(error.message);

                showToast(editingAreaId ? "Area update ho gaya!" : "Area add ho gaya!", "success");

                deliveryAreaForm.reset();
                editingAreaId = null;
                areaSaveBtn.textContent = "Add / Save Area";

                // Table ko dobara refresh karna taaki naya data dikhe
                loadDeliveryAreas();

            } catch (error) {
                showToast(error.message, "error");
            } finally {
                areaSaveBtn.disabled = false;
            }
        });
    }

    // ==========================================
    // LOAD APP SETTINGS (Page khulte hi DB se logo aur configurations lana)
    // ==========================================
    async function loadAppSettings() {
        if (!supabaseClient) return;

        try {
            const { data, error } = await supabaseClient
                .from('app_settings')
                .select('*')
                .eq('id', 1)
                .single();

            if (error && error.code !== 'PGRST116') return;

            if (data) {
                if (data.logo_url) {
                    logoPreview.src = data.logo_url;
                    logoUrlHidden.value = data.logo_url;
                }
                riderCommissionInput.value = data.rider_commission || '';
                deliveryTimerInput.value = data.delivery_timer || '';
            }
        } catch (err) {
            console.error(err);
        }
    }

    // ==========================================
    // LOAD DELIVERY AREAS (Table me saare areas display karna)
    // ==========================================
    async function loadDeliveryAreas() {
        if (!supabaseClient || !areasTableBody) return;

        try {
            const { data, error } = await supabaseClient
                .from('delivery_areas')
                .select('*')
                .order('city', { ascending: true });

            if (error) throw error;

            areasTableBody.innerHTML = '';

            if (!data || data.length === 0) {
                areasTableBody.innerHTML = `
                    <tr><td colspan="6">No delivery areas found.</td></tr>
                `;
                return;
            }

            data.forEach((area) => {
                const statusClass = area.is_active ? 'status-active' : 'status-inactive';
                const statusText = area.is_active ? 'Active' : 'Inactive';

                const tr = document.createElement('tr');
                tr.innerHTML = `
                    <td>${area.city || '-'}</td>
                    <td>${area.area_name || '-'}</td>
                    <td>Rs. ${area.customer_delivery_fee || 0}</td>
                    <td>${area.open_hour || '-'} - ${area.close_hour || '-'}</td>
                    <td><span class="status-badge ${statusClass}">${statusText}</span></td>
                    <td>
                        <button class="edit-btn"
                            data-id="${area.id}"
                            data-city="${area.city}"
                            data-area="${area.area_name}"
                            data-fee="${area.customer_delivery_fee}"
                            data-active="${area.is_active}"
                            data-open="${area.open_hour}"
                            data-close="${area.close_hour}"
                        >Edit</button>
                    </td>
                `;
                areasTableBody.appendChild(tr);
            });
        } catch (err) {
            console.error(err);
        }
    }

    // ==========================================
    // EDIT BUTTON CLICK (Table se data utha kar wapis form me daalna)
    // ==========================================
    document.addEventListener('click', (e) => {
        if (e.target.classList.contains('edit-btn')) {
            editingAreaId = e.target.dataset.id;

            document.getElementById('city').value = e.target.dataset.city;
            document.getElementById('areaName').value = e.target.dataset.area;
            document.getElementById('deliveryFee').value = e.target.dataset.fee;
            document.getElementById('isActive').value = e.target.dataset.active;
            document.getElementById('openHour').value = e.target.dataset.open;
            document.getElementById('closeHour').value = e.target.dataset.close;

            areaSaveBtn.textContent = "Update Area";

            // Screen ko aaram se upar scroll karna taaki user edit kar sake
            window.scrollTo({ top: 0, behavior: 'smooth' });
        }
    });

    // ==========================================
    // INITIAL LOAD (Page khulne par functions automatically chalenge)
    // ==========================================
    loadAppSettings();
    loadDeliveryAreas();
});
