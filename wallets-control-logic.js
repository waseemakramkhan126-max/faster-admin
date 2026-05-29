const SB_URL = "https://hkabhikizdlbavfkualt.supabase.co";
const SB_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImhrYWJoaWtpemRsYmF2Zmt1YWx0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzY0ODgyMjUsImV4cCI6MjA5MjA2NDIyNX0.iMlS6-M1aylW8K915LPYDHOg7qUxwu5GelH_CPHLP2U";
const _supabase = supabase.createClient(SB_URL, SB_KEY);

let walletsData = [];
let customersMap = {};
let ordersMap = {}; 
let ridersMap = {};
let allCompletedOrders = [];

// NEW SYSTEM GLOBALS FOR FIXED SETTINGS CALCULATION
let systemDeliveryFee = 0; 
let systemRiderCommission = 0; 

function showToast(msg, type='success') {
    const toast = document.getElementById('toast');
    const icon = document.getElementById('toastIcon');
    document.getElementById('toastMsg').innerText = msg;
    toast.className = `fixed top-6 left-1/2 -translate-x-1/2 px-6 py-3 rounded-2xl shadow-xl transition-all duration-500 z-[99999] flex items-center gap-3 font-bold text-xs uppercase tracking-widest toast-enter ${type === 'error' ? 'bg-red-600 text-white' : 'bg-slate-900 text-white'}`;
    icon.className = type !== 'error' ? "fas fa-check-circle text-emerald-400" : "fas fa-exclamation-triangle text-white";
    setTimeout(() => toast.classList.replace('toast-enter', 'toast-leave'), 3000);
}

function switchTab(tabId) {
    ['receivables', 'payables', 'revenue'].forEach(t => {
        document.getElementById(`tab-${t}`).classList.replace('tab-active', 'tab-inactive');
        document.getElementById(`content-${t}`).classList.add('hidden');
    });
    document.getElementById(`tab-${tabId}`).classList.replace('tab-inactive', 'tab-active');
    document.getElementById(`content-${tabId}`).classList.remove('hidden');
}

async function fetchSystemData() {
    try {
        // 1. Sirf Rider Commission uthaein app_settings se
        const { data: settings } = await _supabase.from('app_settings').select('rider_commission').eq('id', 1).single();
        if(settings) {
            systemRiderCommission = parseFloat(settings.rider_commission || 0);
        }
        
        // Revenue Labels update (Ab yahan sirf Rider Commission show hoga)
        document.getElementById('riderCutLabel').innerText = `Fixed Rider Cut: Rs. ${systemRiderCommission}`;

        // ... baqi code (Fetch Customers, Riders, Orders, Wallets) waisa hi rahega
        const { data: custs } = await _supabase.from('customers').select('name, phone, address');
        if(custs) custs.forEach(c => customersMap[c.phone] = c);

        const { data: rds } = await _supabase.from('riders').select('rider_id, name, phone');
        if(rds) rds.forEach(r => ridersMap[r.phone] = r);

        const { data: ords } = await _supabase.from('orders').select('*').eq('status', 'completed').order('created_at', { ascending: false });
        if(ords) {
            allCompletedOrders = ords;
            ords.forEach(o => { if(!ordersMap[o.customer_phone]) ordersMap[o.customer_phone] = o; });
        }

        const { data: wals } = await _supabase.from('wallets').select('*');
        walletsData = wals || [];

        processAndRenderData();
    } catch(e) { console.error("Data Fetch Error:", e); }
}

function processAndRenderData() {
  // Positive = Debt (Customer Owes), Negative = Advance (We Owe)
 const debtWallets = walletsData.filter(w => parseFloat(w.current_balance) > 0);
 const advanceWallets = walletsData.filter(w => parseFloat(w.current_balance) < 0);

 // --- NAVA LOGIC: Total Amount Calculate Karne Ke Liye ---
 const totalDebt = debtWallets.reduce((sum, w) => sum + parseFloat(w.current_balance || 0), 0);
 const totalAdvance = advanceWallets.reduce((sum, w) => sum + Math.abs(parseFloat(w.current_balance || 0)), 0);

 // Badges par amount set karna (.toLocaleString() se commas lag jayenge jaise Rs. 10,000)
 document.getElementById('badge-receivables').innerText = `Rs. ${totalDebt.toLocaleString()}`;
 document.getElementById('badge-payables').innerText = `Rs. ${totalAdvance.toLocaleString()}`;

 renderWalletList('receivablesList', debtWallets, 'debt');
 renderWalletList('payablesList', advanceWallets, 'advance');
 renderRevenueSplit();
}

function renderWalletList(containerId, dataList, type) {
    const container = document.getElementById(containerId);
    if(dataList.length === 0) {
        container.innerHTML = `<div class="text-center py-16 bg-white border border-slate-200 rounded-3xl"><i class="fas fa-check-double text-emerald-300 text-4xl mb-3"></i><p class="text-[10px] font-black text-slate-400 uppercase tracking-widest">No Records Found in this ledger.</p></div>`;
        return;
    }

    container.innerHTML = dataList.map(w => {
        const customer = customersMap[w.customer_phone] || { name: 'Unknown Client', address: 'N/A' };
        const latestOrder = ordersMap[w.customer_phone];
        
        const badgeColor = type === 'debt' ? 'bg-red-50 text-red-600 border-red-200' : 'bg-emerald-50 text-emerald-600 border-emerald-200';
        const badgeText = type === 'debt' ? 'Customer Owes Us' : 'We Owe Customer (Advance)';
        const amountColor = type === 'debt' ? 'text-red-600' : 'text-emerald-600';
        const pureAmount = Math.abs(parseFloat(w.current_balance));

        let orderBreakdownHtml = `<div class="mt-4 p-4 rounded-xl bg-slate-50 border border-slate-100 text-center text-xs font-bold text-slate-400 uppercase">No recent completed order context found.</div>`;

        if(latestOrder) {
            const rider = ridersMap[latestOrder.rider_phone] || { name: 'Unknown', rider_id: 'N/A', phone: latestOrder.rider_phone || 'N/A' };
            
            orderBreakdownHtml = `
                <div class="mt-4 p-4 rounded-xl bg-slate-50 border border-slate-200">
                    <h4 class="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-3 pb-2 border-b border-slate-200"><i class="fas fa-history mr-1"></i> Latest Transaction Context (Order #${latestOrder.id.toString().slice(-5)})</h4>
                    
                    <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div class="space-y-1.5">
                            <p class="text-[9px] text-slate-500 font-bold uppercase tracking-wider">Served By Courier</p>
                            <p class="text-xs font-black text-slate-800 uppercase">${rider.name} <span class="text-blue-500">(${rider.rider_id})</span></p>
                            <p class="text-[10px] font-bold text-slate-500"><i class="fas fa-phone mr-1"></i> ${rider.phone}</p>
                        </div>
                        
                        <div class="bg-white p-3 rounded-lg border border-slate-200 shadow-sm space-y-2">
                            <div class="flex justify-between text-[10px] font-bold"><span class="text-slate-500">Item Price:</span> <span class="text-slate-800">Rs. ${latestOrder.item_price || 0}</span></div>
                            <div class="flex justify-between text-[10px] font-bold"><span class="text-slate-500">Order DC (Dynamic):</span> <span class="text-slate-800">Rs. ${latestOrder.dc_amount || 0}</span></div>
                            <div class="flex justify-between text-[10px] font-bold"><span class="text-slate-500">Dues Before Order:</span> <span class="text-slate-800">Rs. ${latestOrder.previous_due || 0}</span></div>
                            <div class="flex justify-between text-[10px] font-black pt-2 border-t border-dashed border-slate-200"><span class="text-slate-800 uppercase">Total Bill Gen:</span> <span class="text-slate-900">Rs. ${latestOrder.bill_amount || 0}</span></div>
                            <div class="flex justify-between text-[10px] font-black bg-blue-50 text-blue-600 px-2 py-1 rounded"><span class="uppercase">Cash Paid to Rider:</span> <span>Rs. ${latestOrder.final_amount || 0}</span></div>
                        </div>
                    </div>
                </div>
            `;
        }

        return `
            <div class="premium-card p-5 rounded-[2rem]">
                <div class="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                    <div class="flex-1">
                        <div class="flex items-center gap-3 mb-1">
                            <h3 class="text-sm font-black text-slate-800 uppercase">${customer.name}</h3>
                            <span class="px-2.5 py-0.5 rounded-md text-[9px] font-black tracking-widest uppercase border ${badgeColor}">${badgeText}</span>
                        </div>
                        <p class="text-[10px] text-slate-500 font-bold tracking-widest"><i class="fas fa-phone mr-1"></i> ${w.customer_phone}</p>
                        <p class="text-[10px] text-slate-500 font-medium mt-1 w-full md:w-3/4"><i class="fas fa-map-pin mr-1 text-slate-400"></i> ${customer.address}</p>
                    </div>
                    
                    <div class="text-left md:text-right w-full md:w-auto flex flex-row md:flex-col items-center md:items-end justify-between">
                        <div>
                            <p class="text-[9px] font-black text-slate-400 uppercase tracking-widest">Net Wallet Balance</p>
                            <p class="text-2xl font-extrabold tracking-tight ${amountColor}">Rs. ${pureAmount}</p>
                        </div>
                        <button onclick="sendAlert('${w.customer_phone}')" class="mt-0 md:mt-3 px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white text-[9px] font-black uppercase tracking-widest rounded-xl transition-all shadow-md active:scale-95 flex items-center gap-1.5">
                            <i class="fas fa-paper-plane"></i> Send Alert
                        </button>
                    </div>
                </div>
                ${orderBreakdownHtml}
            </div>
        `;
    }).join('');
}

// --- NEW: PURE APP_SETTINGS BASED REVENUE CALCULATION ---
function renderRevenueSplit() {
    let totalDC = 0;
    let totalRider = 0;
    let totalCompany = 0;
    
    const revListHtml = allCompletedOrders.map(o => {
        // --- HYBRID LOGIC ---
        // 1. Order se actual DC Amount uthao
        const dc = parseFloat(o.dc_amount || 0); 
        
        // 2. Settings se Rider Commission uthao
        const rShare = systemRiderCommission; 
        
        // 3. Company Profit nikalne ke liye DC mein se Rider ka hissa nikaal do
        const cShare = dc - rShare; 
        
        totalDC += dc;
        totalRider += rShare;
        totalCompany += cShare;

        const rider = ridersMap[o.rider_phone] || { name: 'Unknown', rider_id: 'N/A' };

        return `
            <div class="bg-white p-4 border border-slate-200 rounded-2xl flex justify-between items-center">
                <div>
                    <span class="text-[9px] font-black text-slate-400 uppercase tracking-widest block">Order #${o.id.toString().slice(-5).toUpperCase()}</span>
                    <span class="text-xs font-extrabold text-slate-800">${rider.name}</span>
                </div>
                <div class="flex gap-6 text-right">
                    <div><p class="text-[8px] text-slate-400 uppercase font-black">Fee</p><p class="text-xs font-black text-blue-600">Rs. ${dc}</p></div>
                    <div><p class="text-[8px] text-slate-400 uppercase font-black">Rider</p><p class="text-xs font-black text-emerald-600">- Rs. ${rShare}</p></div>
                    <div><p class="text-[8px] text-slate-400 uppercase font-black">Profit</p><p class="text-xs font-black text-orange-600">Rs. ${cShare}</p></div>
                </div>
            </div>
        `;
    }).join('');

    document.getElementById('totalDcRevenue').innerText = `Rs. ${totalDC.toLocaleString()}`;
    document.getElementById('totalRiderShare').innerText = `Rs. ${totalRider.toLocaleString()}`;
    document.getElementById('totalCompanyProfit').innerText = `Rs. ${totalCompany.toLocaleString()}`;
    document.getElementById('revenueList').innerHTML = revListHtml;
}

async function sendAlert(phone) {
    const msg = prompt(`Send Direct Alert to Customer (${phone}):`, "Company Alert: Dear customer, please clear your outstanding dues.");
    if(!msg) return;

    showToast("Sending notification...");
    try {
        const { error } = await _supabase.from('notifications').insert([{
            phone: phone,
            title: '💼 Finance / Wallet Alert',
            message: msg,
            created_at: new Date().toISOString()
        }]);
        if(error) throw error;
        showToast("Alert Successfully Sent to Customer!");
    } catch(e) {
        showToast("Failed to send alert.", "error");
    }
}

window.onload = () => {
    fetchSystemData();
    
    _supabase.channel('finance-tracker')
        .on('postgres_changes', { event: '*', schema: 'public', table: 'wallets' }, () => fetchSystemData())
        .subscribe();
};
