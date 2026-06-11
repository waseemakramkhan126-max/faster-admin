
        // ─── SUPABASE ───
        const SB_URL = "https://hkabhikizdlbavfkualt.supabase.co";
        const SB_KEY =
            "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImhrYWJoaWtpemRsYmF2Zmt1YWx0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzY0ODgyMjUsImV4cCI6MjA5MjA2NDIyNX0.iMlS6-M1aylW8K915LPYDHOg7qUxwu5GelH_CPHLP2U";
        const _supabase = supabase.createClient(SB_URL, SB_KEY);

        let weeklyChartInst = null;
        let statusChartInst = null;

        // ─── TOAST ───
        function showToast(msg, type = 'info') {
            const icons = { success: '✅', error: '❌', info: 'ℹ️', warning: '⚠️' };
            const t = document.createElement('div');
            t.className = 'toast';
            t.innerHTML = `<span>${icons[type]||'•'}</span><span>${msg}</span>`;
            document.body.appendChild(t);
            setTimeout(() => { t.classList.add('hide');
                setTimeout(() => t.remove(), 300); }, 3000);
        }

        // ─── CURRENT DATE ───
        function setDate() {
            const el = document.getElementById('currentDate');
            if (el) el.textContent = new Date().toLocaleDateString('en-PK', { weekday: 'long', year: 'numeric',
                month: 'long', day: 'numeric' });
        }

        // ─── COUNT UP ───
        function animateCount(el, target) {
            let start = 0;
            const step = Math.ceil(target / 20);
            const interval = setInterval(() => {
                start = Math.min(start + step, target);
                el.textContent = start;
                if (start >= target) clearInterval(interval);
            }, 30);
        }

        // ─── SET STAT CARD (no badge update) ───
        function setStatCard(valId, progId, count, total) {
            const valEl = document.getElementById(valId);
            const progEl = document.getElementById(progId);
            valEl.className = 'stat-value count-animate';
            valEl.innerHTML = '0';
            animateCount(valEl, count);
            if (progEl && total > 0) progEl.style.width = Math.round((count / total) * 100) + '%';
        }

        // ─── FETCH DASHBOARD COUNTS (original logic preserved) ───
        async function fetchDashboardCounts() {
            try {
                const [topupsRes, withdrawsRes, activeOrdersRes, pendingOrdersRes, completedOrdersRes,
                    canceledOrdersRes
                ] = await Promise.all([
                    _supabase.from('topup_requests').select('id', { count: 'exact', head: true }).eq('status',
                        'pending'),
                    _supabase.from('withdraw_requests').select('id', { count: 'exact', head: true }).eq('status',
                        'pending'),
                    _supabase.from('orders').select('id', { count: 'exact', head: true }).in('status', ['assigned',
                        'processing'
                    ]),
                    _supabase.from('orders').select('id', { count: 'exact', head: true }).eq('status', 'pending'),
                    _supabase.from('orders').select('id', { count: 'exact', head: true }).eq('status', 'completed'),
                    _supabase.from('orders').select('id', { count: 'exact', head: true }).in('status', ['canceled',
                        'cancelled', 'CANCELLED'
                    ])
                ]);

                const topup = topupsRes.count || 0;
                const payout = withdrawsRes.count || 0;
                const active = activeOrdersRes.count || 0;
                const pending = pendingOrdersRes.count || 0;
                const completed = completedOrdersRes.count || 0;
                const canceled = canceledOrdersRes.count || 0;
                const total = active + pending + completed + canceled;

                // Header badges still update
                document.getElementById('badgeTopup').textContent = topup;
                document.getElementById('badgePayout').textContent = payout;

                setStatCard('valActive', 'progActive', active, total);
                setStatCard('valPending', 'progPending', pending, total);
                setStatCard('valCompleted', 'progCompleted', completed, total);
                setStatCard('valCanceled', 'progCanceled', canceled, total);
                setStatCard('valTopup', 'progTopup', topup, topup + payout + 1);
                setStatCard('valPayout', 'progPayout', payout, topup + payout + 1);

                const colorMap = {
                    valActive: 'var(--sky)',
                    valPending: 'var(--amber)',
                    valCompleted: 'var(--green)',
                    valCanceled: 'var(--red)',
                    valTopup: 'var(--accent)',
                    valPayout: 'var(--purple)'
                };
                Object.entries(colorMap).forEach(([id, color]) => {
                    const el = document.getElementById(id);
                    if (el) el.style.color = color;
                });

                const syncEl = document.getElementById('lastSync');
                if (syncEl) {
                    syncEl.textContent = 'Synced ' + new Date().toLocaleTimeString([], { hour: '2-digit',
                        minute: '2-digit', second: '2-digit' });
                    syncEl.style.display = 'block';
                }
            } catch (error) {
                console.error("Dashboard Sync Error:", error);
                showToast('Sync failed', 'error');
            }
        }

        // ─── CHARTS (original logic preserved) ───
        async function loadCharts() {
            try {
                const todayStart = new Date();
                todayStart.setHours(0, 0, 0, 0);
                const weekStart = new Date();
                weekStart.setDate(weekStart.getDate() - 6);
                weekStart.setHours(0, 0, 0, 0);

                const { data: weekOrders } = await _supabase
                    .from('orders').select('id, status, created_at')
                    .gte('created_at', weekStart.toISOString());

                const orders = weekOrders || [];
                const days = [],
                    counts = [];
                for (let i = 6; i >= 0; i--) {
                    const d = new Date();
                    d.setDate(d.getDate() - i);
                    days.push(d.toLocaleDateString('en-US', { weekday: 'short' }));
                    counts.push(orders.filter(o => new Date(o.created_at).toDateString() === d.toDateString())
                        .length);
                }

                if (weeklyChartInst) weeklyChartInst.destroy();
                const wCtx = document.getElementById('weeklyChart').getContext('2d');
                const grad = wCtx.createLinearGradient(0, 0, 0, 160);
                grad.addColorStop(0, 'rgba(240,90,20,0.18)');
                grad.addColorStop(1, 'rgba(240,90,20,0)');

                weeklyChartInst = new Chart(wCtx, {
                    type: 'line',
                    data: {
                        labels: days,
                        datasets: [{
                            data: counts,
                            borderColor: '#f05a14',
                            borderWidth: 2.5,
                            backgroundColor: grad,
                            fill: true,
                            tension: 0.45,
                            pointBackgroundColor: '#f05a14',
                            pointRadius: 4,
                            pointHoverRadius: 7,
                            pointBorderColor: '#fff',
                            pointBorderWidth: 2,
                        }]
                    },
                    options: {
                        responsive: true,
                        maintainAspectRatio: false,
                        plugins: {
                            legend: { display: false },
                            tooltip: {
                                backgroundColor: '#fff',
                                borderColor: 'rgba(11,16,24,0.12)',
                                borderWidth: 1,
                                titleColor: '#0b1018',
                                bodyColor: '#f05a14',
                                titleFont: { family: 'Inter, Plus Jakarta Sans', weight: '700',
                                    size: 10 },
                                bodyFont: { family: 'Inter, Plus Jakarta Sans', size: 11 },
                                padding: 10,
                                cornerRadius: 8,
                                callbacks: { label: ctx => ` ${ctx.parsed.y} orders` }
                            }
                        },
                        scales: {
                            x: {
                                grid: { color: 'rgba(11,16,24,0.05)' },
                                ticks: { color: '#7b8298', font: { family: 'Inter, Plus Jakarta Sans',
                                        size: 9, weight: '600' } }
                            },
                            y: {
                                grid: { color: 'rgba(11,16,24,0.05)' },
                                ticks: { color: '#7b8298', font: { family: 'Inter, Plus Jakarta Sans',
                                        size: 9 }, stepSize: 1 },
                                beginAtZero: true
                            }
                        }
                    }
                });

                const todayOrders = orders.filter(o => new Date(o.created_at) >= todayStart);
                const statusMap = {};
                todayOrders.forEach(o => { const s = o.status || 'unknown';
                    statusMap[s] = (statusMap[s] || 0) + 1; });

                const labels = Object.keys(statusMap);
                const vals = Object.values(statusMap);
                const colorMap2 = { pending: '#c27803', assigned: '#1a56db', processing: '#0374a8',
                    completed: '#0f9d4a', canceled: '#d92c2c', cancelled: '#d92c2c', unknown: '#7b8298' };
                const colors = labels.map(l => colorMap2[l] || '#94a3b8');

                if (statusChartInst) statusChartInst.destroy();
                const sCtx = document.getElementById('statusChart').getContext('2d');
                statusChartInst = new Chart(sCtx, {
                    type: 'doughnut',
                    data: { labels, datasets: [{ data: vals, backgroundColor: colors,
                            borderColor: 'transparent', hoverOffset: 8 }] },
                    options: {
                        responsive: true,
                        maintainAspectRatio: false,
                        cutout: '72%',
                        plugins: {
                            legend: { display: false },
                            tooltip: {
                                backgroundColor: '#fff',
                                borderColor: 'rgba(11,16,24,0.12)',
                                borderWidth: 1,
                                titleColor: '#0b1018',
                                titleFont: { family: 'Inter, Plus Jakarta Sans', weight: '700',
                                    size: 10 },
                                bodyFont: { family: 'Inter, Plus Jakarta Sans', size: 11 },
                                padding: 10,
                                cornerRadius: 8,
                            }
                        }
                    }
                });

                const total = vals.reduce((a, b) => a + b, 0) || 1;
                document.getElementById('statusLegend').innerHTML = labels.length ?
                    labels.map((lbl, i) => `
                    <div style="display:flex;align-items:center;justify-content:space-between;gap:8px;">
                        <div style="display:flex;align-items:center;gap:7px;">
                            <div style="width:8px;height:8px;border-radius:3px;background:${colors[i]};flex-shrink:0;"></div>
                            <span style="font-size:10.5px;font-weight:600;color:var(--muted2);text-transform:capitalize;">${lbl}</span>
                        </div>
                        <span style="font-size:10.5px;font-weight:700;color:var(--text);">${vals[i]} <span style="color:var(--muted);font-weight:400;">${Math.round(vals[i]/total*100)}%</span></span>
                    </div>`).join('') :
                    '<div style="font-size:10.5px;color:var(--muted);text-align:center;padding:22px 0;">No orders today</div>';
            } catch (err) {
                console.error('Chart error:', err);
            }
        }

        // ─── MANUAL REFRESH (original logic preserved) ───
        async function manualRefresh() {
            const icon = document.getElementById('refreshIcon');
            icon.classList.add('fa-spin');
            await Promise.all([fetchDashboardCounts(), loadCharts()]);
            setTimeout(() => icon.classList.remove('fa-spin'), 600);
            showToast('Dashboard refreshed', 'success');
        }

        // ─── REALTIME SYNC (original logic preserved) ───
        function setupDashboardLiveSync() {
            _supabase.channel('db-orders-sync')
                .on('postgres_changes', { event: '*', schema: 'public', table: 'orders' }, () => {
                    fetchDashboardCounts();
                    loadCharts();
                }).subscribe();
            _supabase.channel('db-topups-sync')
                .on('postgres_changes', { event: '*', schema: 'public', table: 'topup_requests' }, () => {
                    fetchDashboardCounts();
                }).subscribe();
            _supabase.channel('db-withdraws-sync')
                .on('postgres_changes', { event: '*', schema: 'public', table: 'withdraw_requests' }, () => {
                    fetchDashboardCounts();
                }).subscribe();
        }

        // ─── MOBILE SIDEBAR ───
        const sidebar = document.getElementById('sidebar');
        const overlay = document.getElementById('mobileOverlay');
        const openBtn = document.getElementById('openMobileMenu');
        openBtn.addEventListener('click', () => {
            sidebar.classList.toggle('open');
            overlay.classList.toggle('show');
        });
        overlay.addEventListener('click', () => {
            sidebar.classList.remove('open');
            overlay.classList.remove('show');
        });

        // ════════════════════════════════════════
        // MODAL HELPERS
        // ════════════════════════════════════════
        function openOrdersModal() {
            const to = new Date();
            const from = new Date();
            from.setDate(from.getDate() - 30);
            document.getElementById('dlDateTo').value = to.toISOString().split('T')[0];
            document.getElementById('dlDateFrom').value = from.toISOString().split('T')[0];
            document.getElementById('ordersModal').classList.add('open');
        }

        function closeOrdersModal() { document.getElementById('ordersModal').classList.remove('open'); }

        function openCustomersModal() { document.getElementById('customersModal').classList.add('open'); }

        function closeCustomersModal() { document.getElementById('customersModal').classList.remove('open'); }

        function handleCustomerTypeChange() {
            const val = document.getElementById('dlCustomerType').value;
            document.getElementById('singleCustomerField').style.display = val === 'single' ? 'block' : 'none';
        }

        document.getElementById('ordersModal').addEventListener('click', function(e) {
            if (e.target === this) closeOrdersModal();
        });
        document.getElementById('customersModal').addEventListener('click', function(e) {
            if (e.target === this) closeCustomersModal();
        });

        // ════════════════════════════════════════
        // PDF GENERATION — ORDERS
        // ════════════════════════════════════════
        async function downloadOrdersPDF() {
            const btn = document.getElementById('dlOrdersBtn');
            btn.innerHTML = '<i class="fas fa-spinner fa-spin" style="margin-right:6px;"></i>Fetching...';
            btn.disabled = true;

            try {
                const statusVal = document.getElementById('dlStatus').value;
                const dateFrom = document.getElementById('dlDateFrom').value;
                const dateTo = document.getElementById('dlDateTo').value;

                let query = _supabase.from('orders').select('*').order('created_at', { ascending: false });

                if (statusVal === 'cancelled') {
                    query = query.in('status', ['canceled', 'cancelled', 'CANCELLED']);
                } else if (statusVal !== 'all') {
                    query = query.eq('status', statusVal);
                }

                if (dateFrom) query = query.gte('created_at', dateFrom + 'T00:00:00');
                if (dateTo) query = query.lte('created_at', dateTo + 'T23:59:59');

                const { data: orders, error } = await query;
                if (error) throw error;

                if (!orders || orders.length === 0) {
                    showToast('No orders found for selected filters.', 'warning');
                    btn.innerHTML =
                        '<i class="fas fa-download" style="margin-right:6px;"></i>Download PDF';
                    btn.disabled = false;
                    return;
                }

                const { jsPDF } = window.jspdf;
                const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });

                doc.setFillColor(240, 90, 20);
                doc.rect(0, 0, 297, 18, 'F');
                doc.setTextColor(255, 255, 255);
                doc.setFontSize(13);
                doc.setFont('helvetica', 'bold');
                doc.text('FasterHub — Orders Report', 14, 12);
                doc.setFontSize(8);
                doc.setFont('helvetica', 'normal');
                const filterLabel = statusVal === 'all' ? 'All Statuses' : statusVal;
                const dateLabel = (dateFrom && dateTo) ? `${dateFrom} to ${dateTo}` : 'All Dates';
                doc.text(
                    `Status: ${filterLabel}   |   Date Range: ${dateLabel}   |   Total: ${orders.length} orders   |   Generated: ${new Date().toLocaleString()}`,
                    14, 16.5);

                const sampleOrder = orders[0];
                const cols = [];
                const colMap = {
                    'id': 'Order ID',
                    'status': 'Status',
                    'created_at': 'Date',
                    'customer_name': 'Customer',
                    'customer_phone': 'Phone',
                    'pickup_address': 'Pickup',
                    'delivery_address': 'Delivery',
                    'amount': 'Amount',
                    'rider_name': 'Rider',
                    'notes': 'Notes'
                };
                Object.keys(colMap).forEach(k => {
                    if (k in sampleOrder) cols.push({ key: k, header: colMap[k] });
                });

                const head = [cols.map(c => c.header)];
                const body = orders.map(o => cols.map(c => {
                    if (c.key === 'created_at') return o[c.key] ? new Date(o[c.key])
                        .toLocaleString('en-PK') : '-';
                    return o[c.key] !== null && o[c.key] !== undefined ? String(o[c.key]) : '-';
                }));

                doc.autoTable({
                    head,
                    body,
                    startY: 22,
                    styles: { fontSize: 7, cellPadding: 2.5, font: 'helvetica',
                        textColor: [30, 30, 40] },
                    headStyles: { fillColor: [30, 36, 60], textColor: [255, 255, 255],
                        fontStyle: 'bold', fontSize: 7.5 },
                    alternateRowStyles: { fillColor: [248, 249, 252] },
                    margin: { left: 8, right: 8 },
                    tableLineColor: [220, 222, 230],
                    tableLineWidth: 0.1,
                });

                const filename =
                    `orders_${statusVal}_${dateFrom || 'start'}_${dateTo || 'end'}.pdf`;
                doc.save(filename);
                showToast(`Downloaded ${orders.length} orders`, 'success');
                closeOrdersModal();
            } catch (err) {
                console.error(err);
                showToast('Download failed: ' + err.message, 'error');
            }

            btn.innerHTML = '<i class="fas fa-download" style="margin-right:6px;"></i>Download PDF';
            btn.disabled = false;
        }

        // ════════════════════════════════════════
        // PDF GENERATION — CUSTOMERS
        // ════════════════════════════════════════
        async function downloadCustomersPDF() {
            try {
                const type = document.getElementById('dlCustomerType').value;
                const search = document.getElementById('dlCustomerSearch').value.trim();

                showToast('Fetching customer data...', 'info');

                let query = _supabase.from('orders').select(
                    'customer_name, customer_phone, customer_address, delivery_address, pickup_address, created_at'
                ).order('created_at', { ascending: false });

                const { data: raw, error } = await query;
                if (error) throw error;

                if (!raw || raw.length === 0) {
                    showToast('No customer data found.', 'warning');
                    return;
                }

                const customerMap = {};
                raw.forEach(r => {
                    const phone = r.customer_phone || 'Unknown';
                    if (!customerMap[phone]) customerMap[phone] = r;
                });
                let customers = Object.values(customerMap);

                if (type === 'single' && search) {
                    const s = search.toLowerCase();
                    customers = customers.filter(c =>
                        (c.customer_name && c.customer_name.toLowerCase().includes(s)) ||
                        (c.customer_phone && c.customer_phone.includes(s))
                    );
                }

                if (customers.length === 0) {
                    showToast('No customers match your search.', 'warning');
                    return;
                }

                const { jsPDF } = window.jspdf;
                const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });

                doc.setFillColor(26, 86, 219);
                doc.rect(0, 0, 210, 18, 'F');
                doc.setTextColor(255, 255, 255);
                doc.setFontSize(13);
                doc.setFont('helvetica', 'bold');
                doc.text('FasterHub — Customer Directory', 14, 12);
                doc.setFontSize(8);
                doc.setFont('helvetica', 'normal');
                doc.text(
                    `Total: ${customers.length} unique customers   |   Generated: ${new Date().toLocaleString()}`,
                    14, 16.5);

                const head = [
                    ['#', 'Customer Name', 'Phone', 'Address', 'Last Order']
                ];
                const body = customers.map((c, i) => [
                    i + 1,
                    c.customer_name || '-',
                    c.customer_phone || '-',
                    c.customer_address || c.delivery_address || '-',
                    c.created_at ? new Date(c.created_at).toLocaleDateString('en-PK') : '-'
                ]);

                doc.autoTable({
                    head,
                    body,
                    startY: 22,
                    styles: { fontSize: 8, cellPadding: 3, font: 'helvetica',
                        textColor: [30, 30, 40] },
                    headStyles: { fillColor: [26, 86, 219], textColor: [255, 255, 255],
                        fontStyle: 'bold', fontSize: 8.5 },
                    alternateRowStyles: { fillColor: [248, 249, 252] },
                    columnStyles: { 0: { cellWidth: 10 }, 1: { cellWidth: 42 }, 2: { cellWidth: 35 },
                        3: { cellWidth: 80 }, 4: { cellWidth: 28 } },
                    margin: { left: 10, right: 10 },
                    tableLineColor: [220, 222, 230],
                    tableLineWidth: 0.1,
                });

                const filename = type === 'single' && search ?
                    `customer_${search.replace(/\s+/g, '_')}.pdf` :
                    `all_customers_${new Date().toISOString().split('T')[0]}.pdf`;

                doc.save(filename);
                showToast(`Downloaded ${customers.length} customers`, 'success');
                closeCustomersModal();
            } catch (err) {
                console.error(err);
                showToast('Download failed: ' + err.message, 'error');
            }
        }
// ── EXPORT ANY TABLE MODAL CLOSING LOGIC ──
    ['ordersModal', 'customersModal', 'exportModal'].forEach(id => {
        const modalEl = document.getElementById(id);
        if (modalEl) {
            modalEl.addEventListener('click', function(e) { 
                if (e.target === this) this.classList.remove('open'); 
            });
        }
    });

    // ── EXPORT ANY TABLE FUNCTIONS ──
    const exportTableColumns = {
        orders: ['id','customer_phone','customer_name','delivery_address','order_details','status','rider_status','item_price','dc_amount','bill_amount','balance_amount','final_amount','previous_due','rider_phone','rider_name','rider_id','assigned_at','arrived_at','created_at','updated_at','cancel_reason','area'],
        riders: ['id','rider_id','phone','name','shift_status','status','area','created_at'],
        customers: ['phone','name','email','address','wallet_balance','total_pending','total_advance','city','area','created_at'],
        topup_requests: ['id','customer_phone','amount','status','created_at','updated_at'],
        withdraw_requests: ['id','customer_phone','bank_name','account_title','account_number','amount','status','created_at','admin_reference','cancel_reason'],
        notifications: ['id','phone','title','message','is_read','created_at','customer_phone'],
        delivery_areas: ['id','city','area_name','is_active','customer_delivery_fee','open_hour','close_hour'],
        promotions: ['id','title','promo_type','promo_text','duration','promo_active','created_at','category','vendor_name','start_date','expiry_date'],
        order_chats: ['id','order_id','sender_phone','receiver_phone','message','file_url','type','status','created_at'],
        admin_profile: ['id','name','gmail','role','created_at'],
        app_settings: ['id','rider_commission','delivery_timer','logo_url','promo_active','promo_type','promo_text','bank_name','bank_account_title','bank_account_number','support_phone','delivery_popup_message']
    };

    const exportStatusCols = { orders: 'status', topup_requests: 'status', withdraw_requests: 'status', riders: 'status', delivery_areas: 'is_active', promotions: 'promo_active', order_chats: 'status' };

    function openExportModal() { document.getElementById('exportModal').classList.add('open'); }
    function closeExportModal() { document.getElementById('exportModal').classList.remove('open'); }

    function onExportTableChange() {
        const table = document.getElementById('exportTable').value;
        const statusSelect = document.getElementById('exportStatus');
        statusSelect.innerHTML = '<option value="">All</option>';
        if (!table || !exportStatusCols[table]) return;
        const col = exportStatusCols[table];
        if (col === 'is_active' || col === 'promo_active') {
            statusSelect.innerHTML += '<option value="true">Active</option><option value="false">Inactive</option>';
            return;
        }
        _supabase.from(table).select(col).then(({ data }) => {
            if (data) {
                [...new Set(data.map(d => d[col]).filter(Boolean))].forEach(v => {
                    statusSelect.innerHTML += `<option value="${v}">${v}</option>`;
                });
            }
        });
    }

    async function buildExportQuery() {
        const table = document.getElementById('exportTable').value;
        const search = document.getElementById('exportSearch').value.trim();
        const statusVal = document.getElementById('exportStatus').value;
        const dateFrom = document.getElementById('exportDateFrom').value;
        const dateTo = document.getElementById('exportDateTo').value;
        const columns = exportTableColumns[table] || [];

        let query = _supabase.from(table).select('*');
        if (search && columns.length) {
            if (table === 'orders') query = query.or(`customer_phone.ilike.%${search}%,customer_name.ilike.%${search}%,id.eq.${isNaN(search)?-1:search}`);
            else if (table === 'riders') query = query.or(`name.ilike.%${search}%,phone.ilike.%${search}%,rider_id.ilike.%${search}%`);
            else if (table === 'customers') query = query.or(`name.ilike.%${search}%,phone.ilike.%${search}%`);
            else query = query.ilike(columns[0], `%${search}%`);
        }
        if (statusVal && exportStatusCols[table]) {
            const col = exportStatusCols[table];
            query = query.eq(col, statusVal === 'true' ? true : statusVal === 'false' ? false : statusVal);
        }
        if (dateFrom) query = query.gte('created_at', dateFrom + 'T00:00:00');
        if (dateTo) query = query.lte('created_at', dateTo + 'T23:59:59');
        query = query.order('created_at', { ascending: false }).limit(5000);
        return await query;
    }

    async function exportPreview() {
        const table = document.getElementById('exportTable').value;
        if (!table) return showToast('Select a table', 'warning');
        const columns = exportTableColumns[table] || [];
        const { data } = await buildExportQuery();
        if (!data) return;
        const thead = document.getElementById('exportTableHead');
        const tbody = document.getElementById('exportTableBody');
        if (!data.length) {
            thead.innerHTML = ''; tbody.innerHTML = '<tr><td style="padding:20px;color:var(--muted);text-align:center;">No data found</td></tr>';
            document.getElementById('exportRowCount').textContent = '';
            return;
        }
        thead.innerHTML = '<tr>' + columns.map(c => `<th style="padding:8px 12px;text-align:left;font-weight:600;border-bottom:1px solid var(--border);">${c}</th>`).join('') + '</tr>';
        tbody.innerHTML = data.map(row => '<tr>' + columns.map(c => {
            let val = row[c];
            if (val === null || val === undefined) val = '';
            else if (typeof val === 'boolean') val = val ? '✅' : '❌';
            else if (c.includes('at') && val) val = new Date(val).toLocaleString();
            return `<td style="padding:8px 12px;border-bottom:1px solid var(--border);">${val}</td>`;
        }).join('') + '</tr>').join('');
        document.getElementById('exportRowCount').textContent = `${data.length} rows`;
    }

    async function exportDownload(format) {
        const table = document.getElementById('exportTable').value;
        if (!table) return showToast('Select a table', 'warning');
        const columns = exportTableColumns[table] || [];
        const { data } = await buildExportQuery();
        if (!data || !data.length) return showToast('No data to export', 'warning');

        if (format === 'pdf') {
            const { jsPDF } = window.jspdf;
            const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
            const head = [columns];
            const body = data.map(row => columns.map(c => {
                let val = row[c];
                if (val === null || val === undefined) return '';
                if (typeof val === 'boolean') return val ? 'Yes' : 'No';
                if (c.includes('at') && val) return new Date(val).toLocaleString();
                return String(val);
            }));
            doc.setFontSize(12); doc.text(`FasterHub - ${table}`, 14, 12);
            doc.autoTable({ head, body, startY: 18, styles: { fontSize: 7, cellPadding: 1.5 }, margin: { left: 5, right: 5 } });
            doc.save(`${table}_${new Date().toISOString().slice(0,10)}.pdf`);
        } else {
            const sheetData = data.map(row => columns.map(c => row[c]));
            sheetData.unshift(columns);
            const ws = XLSX.utils.aoa_to_sheet(sheetData);
            const wb = XLSX.utils.book_new(); XLSX.utils.book_append_sheet(wb, ws, table);
            XLSX.writeFile(wb, `${table}_${new Date().toISOString().slice(0,10)}.xlsx`);
        }
        showToast(`${format.toUpperCase()} downloaded`, 'success');
    }
        // ─── INIT ───
        window.onload = () => {
            setDate();
            fetchDashboardCounts();
            loadCharts();
            setupDashboardLiveSync();
        };
