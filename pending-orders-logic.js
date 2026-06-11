
        const SB_URL = "https://hkabhikizdlbavfkualt.supabase.co";
        const SB_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImhrYWJoaWtpemRsYmF2Zmt1YWx0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzY0ODgyMjUsImV4cCI6MjA5MjA2NDIyNX0.iMlS6-M1aylW8K915LPYDHOg7qUxwu5GelH_CPHLP2U";
        const _supabase = supabase.createClient(SB_URL, SB_KEY);

        let activeTargetOrderId = null;
        let globalRidersArray = []; 

        // --- FETCH & LOAD PENDING ORDERS ---
        async function loadPendingOrders() {
            try {
                const { data: orders, error } = await _supabase
                    .from('orders')
                    .select('*')
                    .eq('status', 'pending')
                    .order('created_at', { ascending: false });

                if (error) throw error;

                document.getElementById('mainLoader').classList.add('hidden');
                const container = document.getElementById('ordersList');
                const emptyState = document.getElementById('emptyState');

                if (!orders || orders.length === 0) {
                    container.classList.add('hidden');
                    emptyState.classList.remove('hidden');
                    return;
                }

                emptyState.classList.add('hidden');
                container.classList.remove('hidden');

                container.innerHTML = orders.map(order => {
                    const timeStr = new Date(order.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
                    const dateStr = new Date(order.created_at).toLocaleDateString();
                    const shortDetails = order.order_details ? order.order_details.replace(/\n/g, ', ') : 'No items description.';

                    return `
                        <div class="premium-card rounded-2xl p-3 sm:px-5 sm:py-3.5 flex flex-col lg:flex-row lg:items-center justify-between gap-4 relative group w-full">
                            <div class="flex-1 min-w-0">
                                <div class="flex items-center gap-2 text-[10px] font-bold uppercase text-slate-400 mb-1">
                                    <span class="text-slate-800 font-black">ID: #${order.id.toString().slice(-6).toUpperCase()}</span>
                                    <span>•</span>
                                    <span><i class="fas fa-clock text-blue-500 mr-1"></i>${timeStr}</span>
                                    <span class="hidden sm:inline">•</span>
                                    <span class="hidden sm:inline text-[9px]">${dateStr}</span>
                                    <span class="ml-1 bg-orange-500/10 text-orange-600 px-1.5 py-0.5 rounded text-[8px] font-black uppercase tracking-widest border border-orange-500/10">Pending</span>
                                </div>
                                <div class="flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-3">
                                    <h4 class="text-slate-800 font-black text-sm truncate max-w-[180px]">${order.customer_name || 'Customer'}</h4>
                                    <span class="hidden sm:inline text-slate-300">|</span>
                                    <p class="text-[11px] font-semibold text-slate-500 truncate"><i class="fas fa-map-marker-alt text-[9px] mr-1 text-orange-500"></i>${order.delivery_address || 'No Address'}</p>
                                </div>
                            </div>

                            <div class="flex-1 min-w-0 bg-slate-50 border border-slate-100 rounded-xl px-3 py-1.5 lg:max-w-md">
                                <p class="font-black text-[8px] text-slate-400 uppercase tracking-widest mb-0.5">Order Items</p>
                                <p class="text-slate-700 text-xs font-semibold truncate">${shortDetails}</p>
                            </div>

                            <div class="flex items-center justify-between lg:justify-end gap-5 border-t border-slate-100 pt-2.5 lg:pt-0 lg:border-t-0 shrink-0">
                                <div class="lg:text-right">
                                    <p class="text-[8px] font-black text-slate-400 uppercase tracking-widest">Est. Bill</p>
                                    <p class="text-base font-black text-slate-800">Rs. ${order.bill_amount || 0}</p>
                                </div>
                                <div class="flex gap-2">
                                    <button onclick="triggerCancelOrder(${order.id})" class="px-3 py-2 bg-red-50 hover:bg-red-500 border border-red-200 text-red-600 hover:text-white font-black text-[9px] uppercase tracking-widest rounded-lg transition-all flex items-center gap-1">
                                        <i class="fas fa-ban text-[8px]"></i> Cancel
                                    </button>
                                    <button onclick="openRiderModal(${order.id})" class="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white font-black text-[9px] uppercase tracking-widest rounded-lg shadow-sm active:scale-95 transition-all flex items-center gap-1">
                                        <i class="fas fa-paper-plane text-[8px]"></i> Assign
                                    </button>
                                </div>
                            </div>
                        </div>
                    `;
                }).join('');

            } catch (err) {
                console.error("Fetch Error:", err);
            }
        }

        // --- CANCEL ORDER WITH REASON ---
        async function triggerCancelOrder(id) {
            const reason = prompt("Order cancel karne ki wajah (Reason) likhen:");
            if (reason === null) return; 
            if (reason.trim() === "") {
                alert("❌ Reason likhna zaroori hai order cancel karne ke liye!");
                return;
            }

            try {
                const { error } = await _supabase
                    .from('orders')
                    .update({ 
                        status: 'canceled', 
                        rider_status: 'Canceled by Admin',
                        cancel_reason: reason.trim(),
                        updated_at: new Date().toISOString()
                    })
                    .eq('id', id);

                if (error) throw error;
                alert("✅ Order kamyabi se cancel kar diya gaya hai.");
                loadPendingOrders();
            } catch (err) {
                alert("❌ Operation Fail: " + err.message);
            }
        }

        // --- RIDER ASSIGNMENT MODAL OPERATIONS ---
        async function openRiderModal(orderId) {
            activeTargetOrderId = orderId;
            const modal = document.getElementById('riderModal');
            const listContainer = document.getElementById('ridersContainer');
            document.getElementById('riderSearch').value = ''; 
            
            modal.classList.remove('hidden');
            listContainer.innerHTML = `<div class="text-center py-10 opacity-60"><i class="fas fa-circle-notch animate-spin text-lg mb-1 text-slate-600"></i><p class="text-[10px] font-bold uppercase tracking-wider text-slate-500">Loading Riders...</p></div>`;

            try {
                const { data: riders, error } = await _supabase.from('riders').select('*').order('rider_id', { ascending: true });
                if (error) throw error;

                globalRidersArray = riders || []; 
                renderRiders(globalRidersArray);

            } catch (err) {
                listContainer.innerHTML = `<div class="text-center py-10 text-xs text-red-500 font-bold uppercase">Riders data fetch fail.</div>`;
            }
        }

        // Renders rider_id inside display layout views
        function renderRiders(ridersList) {
            const listContainer = document.getElementById('ridersContainer');
            if (ridersList.length === 0) {
                listContainer.innerHTML = `<div class="text-center py-10 text-xs font-bold text-slate-400 uppercase">No riders match search query.</div>`;
                return;
            }

            listContainer.innerHTML = ridersList.map(rider => `
                <div class="p-3 bg-slate-50 border border-slate-100 rounded-xl flex items-center justify-between gap-4 hover:border-slate-200 transition-all">
                    <div class="flex items-center gap-3">
                        <div class="w-9 h-9 rounded-lg bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center font-black text-emerald-600 text-xs">
                            ${rider.rider_id || 'R'}
                        </div>
                        <div>
                            <div class="flex items-center gap-2">
                                <h4 class="text-slate-800 font-bold text-xs tracking-tight">${rider.name || 'Unnamed Rider'}</h4>
                                <span class="bg-blue-50 text-blue-600 text-[9px] font-extrabold px-1.5 py-0.5 rounded border border-blue-100">ID: ${rider.rider_id}</span>
                            </div>
                            <p class="text-[10px] text-slate-500 font-bold mt-0.5"><i class="fas fa-phone mr-1 text-[8px] text-slate-400"></i>${rider.phone}</p>
                        </div>
                    </div>
                    <button onclick="executeRiderAssignment('${rider.rider_id}', '${rider.phone}')" class="px-3 py-2 bg-emerald-600 hover:bg-emerald-500 text-white font-black text-[9px] uppercase tracking-widest rounded-lg transition-all active:scale-95">
                        Select
                    </button>
                </div>
            `).join('');
        }

        // --- SEARCH FILTER MATCHING EXACT RIDER_ID ---
        function filterRidersList() {
            const query = document.getElementById('riderSearch').value.toLowerCase().trim();
            if (!query) {
                renderRiders(globalRidersArray);
                return;
            }

            const filtered = globalRidersArray.filter(rider => {
                const idMatch = rider.rider_id ? rider.rider_id.toString().toLowerCase().includes(query) : false;
                const nameMatch = rider.name ? rider.name.toLowerCase().includes(query) : false;
                const phoneMatch = rider.phone ? rider.phone.includes(query) : false;
                return idMatch || nameMatch || phoneMatch;
            });

            renderRiders(filtered);
        }

        function closeRiderModal() {
            document.getElementById('riderModal').classList.add('hidden');
            activeTargetOrderId = null;
        }

        // --- ⚡ FIXED & OLYMPIAN UPDATE: STATUS SHIFTED TO 'assigned' & TIMESTAMP MAPS PERFECTLY ---
        async function executeRiderAssignment(riderId, riderPhone) {
            if (!activeTargetOrderId) return;
            
            // Matches exact format: YYYY-MM-DD HH:mm:ss.SSS+00
            const currentDate = new Date();
            const formattedAssignedAt = currentDate.toISOString().replace('T', ' ').replace('Z', '+00');

            try {
                // ⚡ status value shifted from 'pending' to 'assigned' so it unlocks instantly inside Rider Application
                const { error } = await _supabase
                    .from('orders')
                    .update({
                        rider_id: riderId, 
                        rider_phone: riderPhone,
                        status: 'assigned', // Status ab perfect 'assigned' update hoga!
                        rider_status: 'Assigned',
                        assigned_at: formattedAssignedAt, 
                        updated_at: new Date().toISOString()
                    })
                    .eq('id', activeTargetOrderId);

                if (error) throw error;

                alert("🚀 Order rider ko kamyabi se assign kar diya gaya hai aur status 'assigned' ho chuka hai!");
                closeRiderModal();
                loadPendingOrders();

            } catch (err) {
                alert("❌ Assignment Failed: " + err.message);
            }
        }

        // --- REALTIME DATABASE SYNC CHANNEL ---
        function initiateRealtimeTracker() {
            _supabase.channel('live-pending-tracker')
                .on('postgres_changes', { event: '*', schema: 'public', table: 'orders' }, () => {
                    loadPendingOrders();
                }).subscribe();
        }

        window.onload = () => {
            loadPendingOrders();
            initiateRealtimeTracker();
        };
