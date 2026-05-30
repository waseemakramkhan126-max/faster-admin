// ==========================================
// 1. SUPABASE INITIALIZATION
// ==========================================
const supabaseUrl = 'https://hkabhikizdlbavfkualt.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImhrYWJoaWtpemRsYmF2Zmt1YWx0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzY0ODgyMjUsImV4cCI6MjA5MjA2NDIyNX0.iMlS6-M1aylW8K915LPYDHOg7qUxwu5GelH_CPHLP2U';

// Check if Supabase loaded properly from CDN
if (typeof window.supabase === 'undefined') {
    alert("CRITICAL ERROR: Supabase load nahi hua. Apna internet connection check karein.");
}
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
// 2. FETCH DATA ON LOAD (Independent Calls)
// ==========================================
document.addEventListener("DOMContentLoaded", () => {
    // Dono functions alag alag call kiye hain taake ek fail ho toh dusra na ruke
    fetchSettings();
    fetchAdminAreas();
});

// General Settings Fetcher (CRASH PROOF)
async function fetchSettings() {
    try {
        console.log("Fetching General Settings...");
        // .single() ki jagah .limit(1) lagaya hai taake empty table par crash na ho
        const { data: appData, error: appError } = await supabase.from('app_settings').select('*').limit(1);
        
        if (appError) {
            console.error("App Settings Error:", appError);
        } else if (appData && appData.length > 0) {
            if (commissionInput) commissionInput.value = appData[0].rider_commission || "";
            if (timerInput) timerInput.value = appData[0].delivery_timer || "";
            if (appData[0].logo_url && logoPreview) {
                currentLogoUrl = appData[0].logo_url;
                logoPreview.src = currentLogoUrl;
            }
        }

        // Area Fee Fetcher
        const { data: areaData, error: areaError } = await supabase.from('delivery_areas').select('customer_delivery_fee').limit(1);
        
        if (areaError) {
            console.error("Area Fee Error:", areaError);
        } else if (areaData && areaData.length > 0 && feeInput) {
            feeInput.value = areaData[0].customer_delivery_fee || "";
        }
        
        console.log("General Settings Loaded.");
    } catch (error) {
        console.error("Fatal Error in fetchSettings:", error);
    }
}

// ==========================================
// 3. 🌍 AREA MANAGEMENT (ON/OFF & TIMINGS)
// ==========================================
async function fetchAdminAreas() {
    const listContainer = document.getElementById('adminAreasList');
    if (!listContainer) return;

    try {
        console.log("Fetching Delivery Areas...");
        const { data, error } = await supabase
            .from('delivery_areas')
            .select('id, city, area_name, is_active, open_hour, close_hour')
            .order('city', { ascending: true });

        if (error) {
            console.error("Supabase Area Fetch Error:", error);
            listContainer.innerHTML = `<div class="text-red-500 text-sm font-bold text-center py-6">Database se areas nahi aaye. Console check karein.</div>`;
            return;
        }

        if (data && data.length > 0) {
            listContainer.innerHTML = ''; // Loading text hata dein
            
            data.forEach(area => {
                const areaCard = document.createElement('div');
                areaCard.className = "bg-gray-50 border border-gray-200 p-4 rounded-xl flex flex-col md:flex-row md:items-center justify-between gap-4 transition-all hover:border-gray-300 shadow-sm";
                
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
                                <input type="number" id="open_${area.id}" value="${safeOpenHour}" min="0" max="23" class="w-14 p-1 text-xs border border-gray-300 rounded text-center bg-white focus:border-blue-500 outline-none">
                                <span class="text-xs ml-1 text-gray-500">AM</span>
                            </div>

                            <div class="flex items-center">
                                <span class="text-xs font-semibold mr-1 text-gray-600">Close:</span>
                                <input type="number" id="close_${area.id}" value="${safeCloseHour}" min="0" max="23" class="w-14 p-1 text-xs border border-gray-300 rounded text-center bg-white focus:border-blue-500 outline-none">
                                <span class="text-xs ml-1 text-gray-500">AM</span>
                            </div>
                        </div>
                    </div>
                    <button onclick="updateAreaSettings(${area.id})" id="btn_save_${area.id}" class="bg-[#0f172a] text-white text-xs font-medium px-5 py-2.5 rounded-lg hover:bg-[#1e293b] transition-all shadow-sm whitespace-nowrap min-w-[110px]">
                        Save Area
                    </button>
                `;
                listContainer.appendChild(areaCard);

                // Live status text toggler
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
            console.log("Areas Successfully Loaded.");
        } else {
            listContainer.innerHTML = `<div class="text-center text-gray-400 py-6 font-semibold text-sm">Delivery areas table khali hai. Supabase mein areas add karein.</div>`;
        }
    } catch (err) {
        console.error("Fatal Error in fetchAdminAreas:", err);
        listContainer.innerHTML = `<div class="text-red-500 text-sm font-bold text-center py-6">Code Crash ho gaya hai. F12 daba kar Console dekhein.</div>`;
    }
}

// ==========================================
// 4. SAVE LOGICS
// ==========================================

// General Settings Save
if (saveBtn) {
    saveBtn.addEventListener('click', async () => {
        const originalText = saveBtn.innerHTML;
        saveBtn.innerHTML = `<i class="fas fa-spinner fa-spin"></i> Saving...`;
        saveBtn.disabled = true;

        try {
            // Updated to handle cases where row might not exist
            const { error: appError } = await supabase.from('app_settings').upsert({
                id: 1, // Ensure ID is 1
                rider_commission: commissionInput ? commissionInput.value : 0,
                delivery_timer: timerInput ? timerInput.value : 0,
                logo_url: currentLogoUrl
            });

            if (appError) throw appError;

            if (feeInput && feeInput.value) {
                const { error: areaError } = await supabase.from('delivery_areas').update({ customer_delivery_fee: feeInput.value }).eq('id', 1); 
                if (areaError) console.warn("Fee update failed (might not have ID 1):", areaError);
            }

            saveBtn.innerHTML = `<i class="fas fa-check"></i> Saved`;
            saveBtn.classList.replace('bg-[#0f172a]', 'bg-green-600');
            
            setTimeout(() => {
                saveBtn.innerHTML = originalText;
                saveBtn.classList.replace('bg-green-600', 'bg-[#0f172a]');
                saveBtn.disabled = false;
            }, 2000);

        } catch (error) {
            console.error("Save error:", error);
            alert("Error saving global settings. Console check karein.");
            saveBtn.innerHTML = originalText;
            saveBtn.disabled = false;
        }
    });
}

// Single Area Save
async function updateAreaSettings(areaId) {
    const btn = document.getElementById(`btn_save_${areaId}`);
    const isActive = document.getElementById(`status_${areaId}`).checked;
    let openHour = parseInt(document.getElementById(`open_${areaId}`).value);
    let closeHour = parseInt(document.getElementById(`close_${areaId}`).value);

    if (isNaN(openHour)) openHour = 8;
    if (isNaN(closeHour)) closeHour = 1;

    const originalText = btn.innerHTML;
    btn.innerHTML = `<i class="fas fa-circle-notch fa-spin"></i> Saving...`;
    btn.disabled = true;

    try {
        const { error } = await supabase
            .from('delivery_areas')
            .update({ is_active: isActive, open_hour: openHour, close_hour: closeHour })
            .eq('id', areaId);

        if (error) throw error;

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
        alert("Area update nahi ho saka. Console check karein.");
        btn.innerHTML = originalText;
        btn.disabled = false;
    }
}
