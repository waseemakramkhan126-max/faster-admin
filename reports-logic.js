
const SUPABASE_URL = 'https://hkabhikizdlbavfkualt.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImhrYWJoaWtpemRsYmF2Zmt1YWx0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzY0ODgyMjUsImV4cCI6MjA5MjA2NDIyNX0.iMlS6-M1aylW8K915LPYDHOg7qUxwu5GelH_CPHLP2U';
const sb = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

let currentFilter = 'week';
let allOrders = [];

function getDateRange(filter) {
  const now = new Date();
  const start = new Date();
  if (filter === 'today') { start.setHours(0,0,0,0); }
  else if (filter === 'week') { start.setDate(now.getDate() - 7); }
  else if (filter === 'month') { start.setDate(now.getDate() - 30); }
  else { return null; }
  return start.toISOString();
}

function setFilter(f, el) {
  currentFilter = f;
  document.querySelectorAll('.filter-tab').forEach(t => t.classList.remove('active'));
  el.classList.add('active');
  const sub = { today:'Today', week:'Last 7 days', month:'Last 30 days', all:'All time' };
  document.getElementById('chart-subtitle').textContent = sub[f];
  loadAllData();
}

function fmt(n) {
  if (n >= 1000000) return 'Rs ' + (n/1000000).toFixed(1) + 'M';
  if (n >= 1000) return 'Rs ' + (n/1000).toFixed(0) + 'K';
  return 'Rs ' + n.toLocaleString();
}

function timeAgo(dateStr) {
  const diff = Math.floor((Date.now() - new Date(dateStr)) / 1000);
  if (diff < 60) return diff + 's ago';
  if (diff < 3600) return Math.floor(diff/60) + 'm ago';
  if (diff < 86400) return Math.floor(diff/3600) + 'h ago';
  return Math.floor(diff/86400) + 'd ago';
}

function statusBadge(s) {
  const map = {
    'delivered':'green','pending':'yellow','cancelled':'red',
    'assigned':'blue','picked':'blue','arrived':'blue','in_transit':'blue'
  };
  const cls = map[s?.toLowerCase()] || 'gray';
  return `<span class="badge ${cls}">${s || 'unknown'}</span>`;
}

const riderColors = ['linear-gradient(135deg,#ff6b35,#ff3d00)','linear-gradient(135deg,#3b82f6,#1d4ed8)',
  'linear-gradient(135deg,#22c55e,#16a34a)','linear-gradient(135deg,#a855f7,#7c3aed)',
  'linear-gradient(135deg,#f59e0b,#d97706)','linear-gradient(135deg,#06b6d4,#0891b2)'];

async function loadAllData() {
  try {
    const dateFrom = getDateRange(currentFilter);

    // BUILD ORDERS QUERY
    let q = sb.from('orders').select('*').order('created_at', {ascending: false});
    if (dateFrom) q = q.gte('created_at', dateFrom);
    const { data: orders, error: oErr } = await q;
    if (oErr) throw oErr;
    allOrders = orders || [];

    // RIDERS
    const { data: riders } = await sb.from('riders').select('*');
    // WALLETS
    const { data: wallets } = await sb.from('rider_wallets').select('*');
    // CUSTOMERS
    const { data: customers } = await sb.from('customers').select('phone');

    renderKPIs(allOrders, riders, customers);
    renderBarChart(allOrders);
    renderDonut(allOrders);
    renderAreaChart(allOrders);
    renderTopRiders(allOrders, riders);
    renderQuickStats(allOrders, riders, customers);
    renderAreaTable(allOrders);
    renderRecentOrders(allOrders.slice(0,8));
    renderCOD(allOrders, wallets, riders);

    document.getElementById('loadingOverlay').classList.add('hidden');
  } catch(e) {
    console.error(e);
    document.getElementById('loadingOverlay').innerHTML = `<div style="color:var(--red);font-size:0.9rem;text-align:center;padding:20px;">⚠️ Error loading data<br><small style="color:var(--text3)">${e.message}</small></div>`;
  }
}

function renderKPIs(orders, riders, customers) {
  const total = orders.length;
  const delivered = orders.filter(o => o.status?.toLowerCase() === 'delivered').length;
  const revenue = orders.filter(o => o.status?.toLowerCase() === 'delivered').reduce((s,o) => s + (parseFloat(o.bill_amount)||0), 0);
  const activeRiders = (riders||[]).filter(r => r.shift_status === 'online' || r.status === 'active').length;
  const totalRiders = (riders||[]).length;
  const pct = total ? Math.round(delivered/total*100) : 0;

  document.getElementById('kpi-total').textContent = total.toLocaleString();
  document.getElementById('kpi-total-sub').innerHTML = `<b>${orders.filter(o=>o.status?.toLowerCase()==='pending').length}</b> pending • <b>${orders.filter(o=>['cancelled','cancel'].includes(o.status?.toLowerCase())).length}</b> cancelled`;
  document.getElementById('kpi-delivered').textContent = delivered.toLocaleString();
  document.getElementById('kpi-delivered-sub').innerHTML = `<b>${pct}%</b> success rate`;
  document.getElementById('kpi-revenue').textContent = fmt(revenue);
  document.getElementById('kpi-revenue-sub').innerHTML = `avg: <b>${total ? fmt(Math.round(revenue/Math.max(delivered,1))) : 'Rs 0'}</b> per order`;
  document.getElementById('kpi-riders').textContent = activeRiders;
  document.getElementById('kpi-riders-sub').innerHTML = `<b>${totalRiders}</b> total riders registered`;
}

function renderBarChart(orders) {
  const chart = document.getElementById('barChart');
  chart.innerHTML = '';
  const days = {};
  const now = new Date();
  for (let i = 6; i >= 0; i--) {
    const d = new Date(now); d.setDate(now.getDate() - i);
    const key = d.toISOString().slice(0,10);
    days[key] = { delivered: 0, other: 0 };
  }
  orders.forEach(o => {
    const key = (o.created_at||'').slice(0,10);
    if (!days[key]) return;
    if (o.status?.toLowerCase() === 'delivered') days[key].delivered++;
    else days[key].other++;
  });
  const vals = Object.entries(days);
  const maxV = Math.max(...vals.map(([,v]) => v.delivered + v.other), 1);
  const labels = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];
  vals.forEach(([date, v]) => {
    const pD = Math.max((v.delivered / maxV) * 100, v.delivered > 0 ? 4 : 0);
    const pO = Math.max((v.other / maxV) * 100, v.other > 0 ? 4 : 0);
    const day = labels[new Date(date).getDay()];
    const g = document.createElement('div');
    g.className = 'bar-group';
    g.innerHTML = `<div class="bar-wrap">
      <div class="bar delivered" style="height:${pD}%" title="${v.delivered} delivered on ${date}"></div>
      <div class="bar returned" style="height:${pO}%" title="${v.other} other on ${date}"></div>
    </div><div class="bar-label">${day}</div>`;
    chart.appendChild(g);
  });
}

function renderDonut(orders) {
  const total = orders.length || 1;
  const statuses = {};
  orders.forEach(o => {
    const s = o.status?.toLowerCase() || 'unknown';
    statuses[s] = (statuses[s]||0) + 1;
  });
  const colors = { delivered:'#ff6b35', pending:'#f59e0b', assigned:'#3b82f6', cancelled:'#ef4444', picked:'#06b6d4', arrived:'#a855f7' };
  const sorted = Object.entries(statuses).sort((a,b) => b[1]-a[1]).slice(0,5);

  document.getElementById('donut-total').textContent = orders.length.toLocaleString();
  let offset = 25;
  const svg = document.getElementById('donutSvg');
  svg.innerHTML = `<circle cx="18" cy="18" r="15.9" fill="none" stroke="var(--surface3)" stroke-width="3.5"/>`;
  sorted.forEach(([s, cnt]) => {
    const pct = (cnt / total) * 100;
    const color = colors[s] || '#64748b';
    svg.innerHTML += `<circle cx="18" cy="18" r="15.9" fill="none" stroke="${color}" stroke-width="3.5"
      stroke-dasharray="${pct} ${100-pct}" stroke-dashoffset="${-offset+25}" stroke-linecap="round"/>`;
    offset += pct;
  });

  const statsEl = document.getElementById('donutStats');
  statsEl.innerHTML = sorted.map(([s,cnt]) => `
    <div class="donut-stat">
      <div class="donut-stat-left"><div class="donut-stat-dot" style="background:${colors[s]||'#64748b'}"></div>${s}</div>
      <div><span class="donut-stat-val">${cnt.toLocaleString()}</span> <span class="donut-stat-pct">${Math.round(cnt/total*100)}%</span></div>
    </div>`).join('');
}

function renderAreaChart(orders) {
  const areas = {};
  orders.forEach(o => { const a = o.area || 'Unknown'; areas[a] = (areas[a]||0)+1; });
  const sorted = Object.entries(areas).sort((a,b)=>b[1]-a[1]).slice(0,7);
  const max = sorted[0]?.[1] || 1;
  const aColors = ['var(--accent)','var(--blue)','var(--green)','var(--purple)','var(--yellow)','var(--text3)','var(--red)'];
  document.getElementById('areaChart').innerHTML = sorted.map(([a,cnt],i) => `
    <div class="spark-item">
      <div class="spark-label" title="${a}">${a}</div>
      <div class="spark-bar-bg"><div class="spark-bar-fill" style="width:${Math.round(cnt/max*100)}%; background:${aColors[i]}"></div></div>
      <div class="spark-val" style="color:${aColors[i]}">${cnt}</div>
    </div>`).join('');
}

function renderTopRiders(orders, riders) {
  const riderCounts = {};
  orders.filter(o => o.status?.toLowerCase() === 'delivered').forEach(o => {
    if (o.rider_name) riderCounts[o.rider_name] = (riderCounts[o.rider_name]||0)+1;
  });
  const sorted = Object.entries(riderCounts).sort((a,b)=>b[1]-a[1]).slice(0,5);
  if (!sorted.length) { document.getElementById('riderList').innerHTML = '<div style="color:var(--text3);font-size:0.82rem;padding:10px 0;">No delivery data yet</div>'; return; }
  document.getElementById('riderList').innerHTML = sorted.map(([name,cnt],i) => {
    const initials = name.split(' ').map(n=>n[0]).join('').slice(0,2).toUpperCase();
    const totalByRider = orders.filter(o=>o.rider_name===name).length;
    const rate = totalByRider ? Math.round(cnt/totalByRider*100) : 0;
    return `<div class="rider-row">
      <div class="rider-rank ${i<3?'top':''}">${i+1}</div>
      <div class="rider-avatar" style="background:${riderColors[i]}">${initials}</div>
      <div class="rider-name">${name}</div>
      <div class="rider-deliveries">${cnt}</div>
      <div class="rider-rate">${rate}%</div>
    </div>`;
  }).join('');
}

function renderQuickStats(orders, riders, customers) {
  const pending = orders.filter(o=>o.status?.toLowerCase()==='pending').length;
  const cancelled = orders.filter(o=>['cancelled','cancel'].includes(o.status?.toLowerCase())).length;
  const settled = orders.filter(o=>o.is_settled===true).length;
  const unsettled = orders.filter(o=>o.is_settled===false && o.status?.toLowerCase()==='delivered').length;
  document.getElementById('quickStats').innerHTML = `
    <div class="summary-stat"><div class="summary-stat-val" style="color:var(--yellow)">${pending}</div><div class="summary-stat-lbl">Pending Orders</div></div>
    <div class="summary-stat"><div class="summary-stat-val" style="color:var(--red)">${cancelled}</div><div class="summary-stat-lbl">Cancelled</div></div>
    <div class="summary-stat"><div class="summary-stat-val" style="color:var(--green)">${settled}</div><div class="summary-stat-lbl">COD Settled</div></div>
    <div class="summary-stat"><div class="summary-stat-val" style="color:var(--accent)">${unsettled}</div><div class="summary-stat-lbl">COD Unsettled</div></div>
    <div class="summary-stat"><div class="summary-stat-val" style="color:var(--blue)">${(customers||[]).length.toLocaleString()}</div><div class="summary-stat-lbl">Total Customers</div></div>
    <div class="summary-stat"><div class="summary-stat-val" style="color:var(--purple)">${(riders||[]).length}</div><div class="summary-stat-lbl">Total Riders</div></div>`;
}

function renderAreaTable(orders) {
  const areas = {};
  orders.forEach(o => {
    const a = o.area || 'Unknown';
    if (!areas[a]) areas[a] = { total:0, delivered:0, pending:0, cancelled:0, revenue:0 };
    areas[a].total++;
    const s = o.status?.toLowerCase();
    if (s === 'delivered') { areas[a].delivered++; areas[a].revenue += parseFloat(o.bill_amount)||0; }
    else if (s === 'pending') areas[a].pending++;
    else if (['cancelled','cancel'].includes(s)) areas[a].cancelled++;
  });
  const sorted = Object.entries(areas).sort((a,b)=>b[1].total-a[1].total);
  if (!sorted.length) { document.getElementById('areaTable').innerHTML = '<tr><td colspan="7" style="text-align:center;color:var(--text3);padding:20px;">No data</td></tr>'; return; }
  document.getElementById('areaTable').innerHTML = sorted.map(([area,d]) => {
    const pct = d.total ? Math.round(d.delivered/d.total*100) : 0;
    const cls = pct>=90?'var(--accent)':pct>=75?'var(--blue)':pct>=60?'var(--yellow)':'var(--red)';
    return `<tr>
      <td class="text-main">${area}</td>
      <td>${d.total}</td>
      <td style="color:var(--green)">${d.delivered}</td>
      <td style="color:var(--yellow)">${d.pending}</td>
      <td style="color:var(--red)">${d.cancelled}</td>
      <td><div class="progress-mini"><div class="progress-mini-fill" style="width:${pct}%;background:${cls}"></div></div>${pct}%</td>
      <td style="color:var(--text)">${fmt(d.revenue)}</td>
    </tr>`;
  }).join('');
}

function renderRecentOrders(orders) {
  const icons = { delivered:['✅','var(--green-soft)'], pending:['⏳','var(--yellow-soft)'], cancelled:['❌','var(--red-soft)'], assigned:['🏍️','var(--blue-soft)'] };
  document.getElementById('recentOrders').innerHTML = orders.map(o => {
    const s = o.status?.toLowerCase() || 'unknown';
    const [ico, bg] = icons[s] || ['📦','var(--surface2)'];
    return `<div class="activity-item">
      <div class="activity-icon" style="background:${bg}">${ico}</div>
      <div>
        <div class="activity-main">Order <b>#${o.id}</b> — ${o.customer_name||'Customer'} ${statusBadge(o.status)}</div>
        <div class="activity-time">${timeAgo(o.created_at)} · ${o.area||'Unknown area'} · ${fmt(parseFloat(o.bill_amount)||0)}</div>
      </div>
    </div>`;
  }).join('');
}

function renderCOD(orders, wallets, riders) {
  const delivered = orders.filter(o => o.status?.toLowerCase()==='delivered');
  const totalCOD = delivered.reduce((s,o) => s+(parseFloat(o.bill_amount)||0), 0);
  const settled = delivered.filter(o=>o.is_settled).reduce((s,o)=>s+(parseFloat(o.bill_amount)||0),0);
  const unsettled = totalCOD - settled;
  document.getElementById('cod-total').textContent = fmt(totalCOD);
  document.getElementById('codBreakdown').innerHTML = `
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-bottom:14px;">
      <div style="background:var(--surface2);border-radius:9px;padding:12px;border:1px solid var(--border);text-align:center;">
        <div style="font-size:1rem;font-weight:700;color:var(--green)">${fmt(settled)}</div>
        <div style="font-size:0.7rem;color:var(--text3);margin-top:3px">Settled</div>
      </div>
      <div style="background:var(--surface2);border-radius:9px;padding:12px;border:1px solid var(--border);text-align:center;">
        <div style="font-size:1rem;font-weight:700;color:var(--yellow)">${fmt(unsettled)}</div>
        <div style="font-size:0.7rem;color:var(--text3);margin-top:3px">Unsettled</div>
      </div>
    </div>`;

  // Rider wallets
  const riderMap = {};
  (riders||[]).forEach(r => { riderMap[r.phone] = r.name; });
  const wHTML = (wallets||[]).slice(0,5).map(w => `
    <div class="cod-row">
      <span style="font-size:0.8rem;color:var(--text2)">${riderMap[w.rider_phone]||w.rider_phone}</span>
      <span style="font-size:0.82rem;font-weight:600;color:var(--text)">${fmt(parseFloat(w.balance)||0)}</span>
    </div>`).join('');
  document.getElementById('riderWallets').innerHTML = wHTML || '<div style="color:var(--text3);font-size:0.8rem">No wallet data</div>';
}

function exportCSV() {
  if (!allOrders.length) return alert('No data loaded');
  const keys = ['id','customer_name','customer_phone','area','status','bill_amount','is_settled','rider_name','created_at'];
  const csv = [keys.join(','), ...allOrders.map(o => keys.map(k => `"${o[k]??''}"`).join(','))].join('\n');
  const a = document.createElement('a'); a.href = 'data:text/csv;charset=utf-8,' + encodeURIComponent(csv);
  a.download = `fasterhub_report_${new Date().toISOString().slice(0,10)}.csv`; a.click();
}

// Filter tab click
document.querySelectorAll('.filter-tab').forEach(t => {
  t.addEventListener('click', () => { document.querySelectorAll('.filter-tab').forEach(x=>x.classList.remove('active')); t.classList.add('active'); });
});

loadAllData();
