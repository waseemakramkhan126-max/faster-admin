// ==========================================
// 1. SUPABASE INITIALIZATION
// ==========================================
const supabaseUrl = 'https://hkabhikizdlbavfkualt.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImhrYWJoaWtpemRsYmF2Zmt1YWx0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzY0ODgyMjUsImV4cCI6MjA5MjA2NDIyNX0.iMlS6-M1aylW8K915LPYDHOg7qUxwu5GelH_CPHLP2U';
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
    await fetchAdminAreas(); // Load areas list on page start
});

// General Settings Fetcher
async function fetchSettings() {
    try {
        const { data: appData, error: appError } = await supabase.from('app_settings').select('*').eq('id', 1).single();
        if (appError && appError.code !== 'PGRST116') throw appError;

        if (appData) {
            if (commissionInput) commissionInput.value = appData.rider_commission || "";
            if (timerInput) timerInput.value = appData.delivery_timer || "";
            if (appData.logo_url && logoPreview) {
                currentLogoUrl = appData.logo_url;
                logoPreview.src = currentLogoUrl;
            }
        }

        const { data: areaData, error: areaError } = await supabase.from('delivery_areas').select('customer_delivery_fee').eq('id', 1).single();
        if (!areaError && areaData && feeInput) {
            feeInput.value = areaData.customer_delivery_fee || "";
        }
    } catch (error) {
        console.error("Error fetching general settings:", error);
    }
}

// ==========================================
// 3. GLOBAL SETTINGS SAVE LOGIC
// ==========================================
if (saveBtn) {
    saveBtn.addEventListener('click', async () => {
        const originalText = saveBtn.innerHTML;
        saveBtn.innerHTML = `<i class="fas fa-spinner fa-spin"></i> Saving...`;
        saveBtn.disabled = true;

        try {
            // Update app_settings table
            const { error: appError } = await supabase
                .from('app_settings')
                .update({
                    rider_commission: commissionInput ? commissionInput.value : 0,
                    delivery_timer: timerInput ? timerInput.value : 0,
                    logo_url: currentLogoUrl
                })
                .eq('id', 1); 

            if (appError) throw appError;

            // Update Global Fee in delivery_areas
            if (feeInput && feeInput.value) {
                const { error: areaError } = await supabase
                    .from('delivery_areas')
                    .update({ customer_delivery_fee: feeInput.value })
                    .eq('id', 1); 

                if (areaError) throw areaError;
            }

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
            alert("Error saving global settings. Check console.");
            saveBtn.innerHTML = originalText;
            saveBtn.disabled = false;
        }
    });
}

// ==========================================
// 4. 🌍 AREA MANAGEMENT (ON/OFF & TIMINGS)
// ==========================================
async function fetchAdminAreas() {
    const listContainer = document.getElementById('adminAreasList');
    if (!listContainer) return;

    try {
        const { data, error } = await supabase
            .from('delivery_areas')
            .select('id, city, area_name, is_active, open_hour, close_hour')
            .order('city', { ascending: true });

        if (error) throw error;

        if (data && data.length > 0) {
            listContainer.innerHTML = '';
            
            data.forEach(area => {
                const areaCard = document.createElement('div');
                areaCard.className = "bg-gray-50 border border-gray-200 p-4 rounded-xl flex flex-col md:flex-row md:items-center justify-between gap-4 transition-all hover:border-gray-300 shadow-sm";
                
                // Safe default checks
                const safeOpenHour = area.open_hour !== null ? area.open_hour : 8;
                const safeCloseHour = area.close_hour !== null ? area.close_hour : 1;

                areaCard.innerHTML = `
                    <div class="flex-1">
                        <h3 class="font-bold text-gray-800 text-md">${area.area_name} <span class="text-xs text-gray-500 font-normal">(${area.city})</span></h3>
                        
                        <div class="flex flex-wrap items-center gap-4 mt-3">
                            <label class="flex items-center cursor-pointer">
                                <span class="text-xs font-semibold mr-2 text-gray-600">Service:</span>
                                <input type="checkbox" id="status_${area.id}" class="w-4 h-4 text-orange-600 rounded focus:ring-orange-500 border-gray-300" ${area.is_active ? 'checked' : ''}>
                                <span class="text-xs ml-1 ${area.is_active ? 'text-green-600' : 'text-red-500'} font-bold" id="status_text_${area.id}">${area.is_active ? 'ON' : 'OFF'}</span>
                            </label>
                            
                            <div class="flex items-center">
                                <span class="text-xs font-semibold mr-1 text-gray-600">Open:</span>
                                <input type="number" id="open_${area.id}" value="${safeOpenHour}" min="0" max="23" class="w-14 p-1 text-xs border border-gray-300 rounded text-center bg-white focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none transition-all">
                                <span class="text-xs ml-1 text-gray-500">AM</span>
                            </div>

                            <div class="flex items-center">
                                <span class="text-xs font-semibold mr-1 text-gray-600">Close:</span>
                                <input type="number" id="close_${area.id}" value="${safeCloseHour}" min="0" max="23" class="w-14 p-1 text-xs border border-gray-300 rounded text-center bg-white focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none transition-all">
                                <span class="text-xs ml-1 text-gray-500">AM</span>
                            </div>
                        </div>
                    </div>
                    
                    <button onclick="updateAreaSettings(${area.id})" id="btn_save_${area.id}" class="bg-[#0f172a] text-white text-xs font-medium px-5 py-2.5 rounded-lg hover:bg-[#1e293b] transition-all shadow-sm whitespace-nowrap min-w-[110px]">
                        Save Area
                    </button>
                `;
                listContainer.appendChild(areaCard);

                // Live status text change logic
                const statusInput = document.getElementById(`status_${area.id}`);
                if(statusInput) {
                    statusInput.addEventListener('change', function(e) {
                        const txt = document.getElementById(`status_text_${area.id}`);
                        if(e.target.checked) {
                            txt.innerText = 'ON';
                            txt.className = 'text-xs ml-1 text-green-600 font-bold';
                        } else {
                            txt.innerText = 'OFF';
                            txt.className = 'text-xs ml-1 text-red-500 font-bold';
                        }
                    });
                }
            });
        } else {
            listContainer.innerHTML = `<div class="text-center text-gray-400 py-6 font-semibold text-sm">No delivery areas found in database.</div>`;
        }
    } catch (err) {
        console.error("Admin Fetch Error:", err);
        listContainer.innerHTML = `<div class="text-red-500 text-sm font-bold text-center py-6">Error loading areas. Check internet connection.</div>`;
    }
}

// Update single area
async function updateAreaSettings(areaId) {
    const btn = document.getElementById(`btn_save_${areaId}`);
    
    const isActive = document.getElementById(`status_${areaId}`).checked;
    let openHour = parseInt(document.getElementById(`open_${areaId}`).value);
    let closeHour = parseInt(document.getElementById(`close_${areaId}`).value);

    // Validation (Prevent empty or NaN inputs)
    if (isNaN(openHour)) openHour = 8;
    if (isNaN(closeHour)) closeHour = 1;

    const originalText = btn.innerHTML;
    btn.innerHTML = `<i class="fas fa-circle-notch fa-spin"></i> Saving...`;
    btn.disabled = true;

    try {
        const { error } = await supabase
            .from('delivery_areas')
            .update({ 
                is_active: isActive, 
                open_hour: openHour, 
                close_hour: closeHour 
            })
            .eq('id', areaId);

        if (error) throw error;

        // Success state
        btn.innerHTML = `<i class="fas fa-check"></i> Saved`;
        btn.classList.replace('bg-[#0f172a]', 'bg-green-600');
        btn.classList.replace('hover:bg-[#1e293b]', 'hover:bg-green-700');
        
        setTimeout(() => {
            btn.innerHTML = originalText;
            btn.classList.replace('bg-green-600', 'bg-[#0f172a]');
            btn.classList.replace('hover:bg-green-700', 'hover:bg-[#1e293b]');
            btn.disabled = false;
        }, 2000);

    } catch (err) {
        console.error("Area Update Error:", err);
        alert("System Error: Area settings update nahi ho sakin. Dobara try karein.");
        btn.innerHTML = originalText;
        btn.disabled = false;
    }
}
