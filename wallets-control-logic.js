// ==========================================
// 1. MOBILE MENU UI LOGIC
// ==========================================
const sidebar = document.getElementById('sidebar');
const overlay = document.getElementById('mobileOverlay');
const openBtn = document.getElementById('openMobileMenu');
const closeBtn = document.getElementById('closeSidebarBtn');

function toggleSidebar() {
    if (sidebar && overlay) {
        sidebar.classList.toggle('open');
        overlay.classList.toggle('show');
    }
}

if (openBtn) openBtn.addEventListener('click', toggleSidebar);
if (closeBtn) closeBtn.addEventListener('click', toggleSidebar);
if (overlay) overlay.addEventListener('click', toggleSidebar);


// ==========================================
// 2. LIVE CLOCK FUNCTION
// ==========================================
function updateTime() {
    const now = new Date();
    let hours = now.getHours();
    let minutes = now.getMinutes();
    let seconds = now.getSeconds();
    let ampm = hours >= 12 ? 'PM' : 'AM';
    hours = hours % 12;
    hours = hours ? hours : 12; 
    minutes = minutes < 10 ? '0' + minutes : minutes;
    seconds = seconds < 10 ? '0' + seconds : seconds;
    
    const liveTimeEl = document.getElementById('liveTime');
    if (liveTimeEl) {
        liveTimeEl.innerText = hours + ':' + minutes + ':' + seconds + ' ' + ampm;
    }
}


// ==========================================
// 3. SUPABASE CONFIGURATION & REALTIME LOGIC
// ==========================================
const SB_URL = "https://hkabhikizdlbavfkualt.supabase.co";
const SB_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImhrYWJoaWtpemRsYmF2Zmt1YWx0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzY0ODgyMjUsImV4cCI6MjA5MjA2NDIyNX0.iMlS6-M1aylW8K915LPYDHOg7qUxwu5GelH_CPHLP2U";

// Client Initialization
const _supabase = supabase.createClient(SB_URL, SB_KEY);

// Fetch Pending Topups Count
async function fetchPendingTopupsCount() {
    try {
        const { count, error } = await _supabase
            .from('topup_requests')
            .select('*', { count: 'exact', head: true })
            .eq('status', 'pending');
        
        if (error) throw error;
        
        const badge = document.getElementById('topupBadge');
        if (badge) {
            if (count > 0) {
                badge.innerText = count > 99 ? '99+' : count; 
                badge.classList.remove('hidden'); 
            } else {
                badge.classList.add('hidden'); 
            }
        }
    } catch (err) {
        console.error("Error fetching topup count:", err);
    }
}

// Fetch Pending Withdraw Count
async function updateWithdrawBadgeCount() {
    try {
        const { count, error } = await _supabase
            .from('withdraw_requests')
            .select('*', { count: 'exact', head: true })
            .eq('status', 'pending');

        const badge = document.getElementById('withdrawBadge');
        if (badge) {
            if (!error && count > 0) {
                badge.innerText = count;
                badge.classList.remove('hidden');
            } else {
                badge.classList.add('hidden');
            }
        }
    } catch (err) {
        console.error("Withdraw badge error: ", err);
    }
}

// Realtime Listeners Configuration
function setupDashboardRealtime() {
    _supabase.channel('dashboard-live-badge')
        .on('postgres_changes', { event: '*', schema: 'public', table: 'withdraw_requests' }, () => {
            updateWithdrawBadgeCount(); 
        }).subscribe();
}

function setupTopupListener() {
    _supabase.channel('dashboard-topup-badge')
        .on('postgres_changes', { event: '*', schema: 'public', table: 'topup_requests' }, () => {
            fetchPendingTopupsCount(); 
        })
        .subscribe();
}


// ==========================================
// 4. SYSTEM INITIALIZATION ON PAGE LOAD
// ==========================================
window.addEventListener('load', () => {
    if (typeof fetchPendingTopupsCount === 'function') fetchPendingTopupsCount();
    setupTopupListener();
    updateWithdrawBadgeCount();
    setupDashboardRealtime();
});

// Intervals Execution
setInterval(updateTime, 1000);
updateTime();
