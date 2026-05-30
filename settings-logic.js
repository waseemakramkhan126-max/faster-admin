const supabaseUrl = 'https://hkabhikizdlbavfkualt.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImhrYWJoaWtpemRsYmF2Zmt1YWx0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzY0ODgyMjUsImV4cCI6MjA5MjA2NDIyNX0.iMlS6-M1aylW8K915LPYDHOg7qUxwu5GelH_CPHLP2U';
const supabase = window.supabase.createClient(supabaseUrl, supabaseKey);

document.addEventListener("DOMContentLoaded", async () => {
    fetchSettings();
    fetchAdminAreas(); // Yeh areas load karega
});

async function fetchSettings() {
    // General settings load logic
    const { data } = await supabase.from('app_settings').select('*').limit(1);
    if (data && data[0]) {
        document.getElementById('commissionInput').value = data[0].rider_commission || "";
        document.getElementById('timerInput').value = data[0].delivery_timer || "";
    }
}

async function fetchAdminAreas() {
    const listContainer = document.getElementById('adminAreasList');
    const { data, error } = await supabase.from('delivery_areas').select('*');
    
    if (error) {
        listContainer.innerHTML = "Error: " + error.message;
        return;
    }

    if (!data || data.length === 0) {
        listContainer.innerHTML = "Koi data nahi mila database mein.";
        return;
    }

    listContainer.innerHTML = "";
    data.forEach(area => {
        listContainer.innerHTML += `
            <div class="border p-4 rounded-lg flex justify-between">
                <span>${area.area_name}</span>
                <input type="checkbox" ${area.is_active ? 'checked' : ''} onchange="updateStatus(${area.id}, this.checked)">
            </div>
        `;
    });
}

async function updateStatus(id, active) {
    await supabase.from('delivery_areas').update({ is_active: active }).eq('id', id);
    alert("Updated!");
}
