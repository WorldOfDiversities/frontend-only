const POS_CONFIG_SAFE = window.POS_CONFIG || {
  API_BASE_URL: 'http://127.0.0.1:8000/api/v1',
  ACCESS_TOKEN_KEY: 'pos_access_token',
  REFRESH_TOKEN_KEY: 'pos_refresh_token',
  USER_ROLE_KEY: 'pos_user_role',
  USER_NAME_KEY: 'pos_user_name',
};
const { API_BASE_URL, ACCESS_TOKEN_KEY, REFRESH_TOKEN_KEY, USER_ROLE_KEY, USER_NAME_KEY } = POS_CONFIG_SAFE;

let currentPeriod = 'month';
let currentReportType = 'sales';
let currentUserRole = 'ADMIN';
let currentUserName = 'User';
let cached = {
  sales: [],
  payments: [],
  products: [],
  daily: [],
  paymentBreakdown: [],
  weekly: [],
  performance: [],
  inventorySummary: null,
};

const periodLabels = {
  day: 'Today',
  week: 'This Week',
  month: 'This Month',
  year: 'This Year',
};

function redirectToHome(){ window.location.href = 'what.html'; }
function redirectToLogin(){ window.location.href = 'login.html'; }

function clearAuthAndRedirectToLogin(){
  localStorage.removeItem(ACCESS_TOKEN_KEY);
  localStorage.removeItem(REFRESH_TOKEN_KEY);
  localStorage.removeItem(USER_ROLE_KEY);
  localStorage.removeItem(USER_NAME_KEY);
  redirectToLogin();
}

function normalizeRole(rawRole){
  const upper = String(rawRole || 'ADMIN').toUpperCase();
  return ['ADMIN','MANAGER','CASHIER'].includes(upper) ? upper : 'ADMIN';
}

function roleDisplayName(role){
  if (role === 'ADMIN') return 'Administrator';
  if (role === 'MANAGER') return 'Manager';
  return 'Cashier';
}

function toAmount(value){
  const n = Number.parseFloat(value);
  return Number.isFinite(n) ? n : 0;
}

function escapeHtml(value){
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

function resolveMediaUrl(rawUrl){
  const value = String(rawUrl || '').trim();
  if (!value) return '';
  if (/^https?:\/\//i.test(value)) return value;

  try {
    const apiOrigin = new URL(API_BASE_URL).origin;
    if (value.startsWith('/')) return `${apiOrigin}${value}`;
    return `${apiOrigin}/${value.replace(/^\/+/, '')}`;
  } catch {
    return value;
  }
}

function getProductById(productId){
  return cached.products.find((item) => Number(item.id) === Number(productId));
}

function getProductImageUrl(product){
  if (!product) return '';
  return resolveMediaUrl(
    product.image_url ||
    product.image ||
    product.thumbnail_url ||
    product.thumbnail ||
    product.photo_url ||
    product.photo ||
    ''
  );
}

function initialsFromName(name){
  const parts = String(name || 'Product').trim().split(/\s+/).filter(Boolean);
  return (parts[0]?.[0] || 'P').toUpperCase() + (parts[1]?.[0] || '').toUpperCase();
}

function productThumbMarkup(name, imageUrl){
  const safeName = escapeHtml(name || 'Product');
  const initials = escapeHtml(initialsFromName(name));

  if (!imageUrl){
    return `<div class="prod-thumb-fallback" aria-label="${safeName}">${initials}</div>`;
  }

  const safeUrl = escapeHtml(imageUrl);
  return `<div class="prod-thumb-wrap"><img class="prod-thumb" src="${safeUrl}" alt="${safeName}" onerror="this.style.display='none';this.nextElementSibling.style.display='flex';"><div class="prod-thumb-fallback" style="display:none;" aria-hidden="true">${initials}</div></div>`;
}

function normalizeList(data){
  if (Array.isArray(data)) return data;
  if (data && Array.isArray(data.results)) return data.results;
  return [];
}

function formatCurrency(value){
  return `GHS ${toAmount(value).toLocaleString('en-GB', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function localIsoDate(dateValue = new Date()){
  const date = new Date(dateValue);
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function showToast(msg, type=''){
  const t = document.getElementById('toast');
  t.textContent = msg;
  t.className = `toast${type ? ' ' + type : ''}`;
  t.classList.add('show');
  setTimeout(() => t.classList.remove('show'), 2400);
}

async function apiGet(path){
  const token = localStorage.getItem(ACCESS_TOKEN_KEY);
  const response = await fetch(`${API_BASE_URL}${path}`, { headers: { Authorization: `Bearer ${token}` } });
  if (response.status === 401){
    clearAuthAndRedirectToLogin();
    throw new Error('Session expired.');
  }
  if (!response.ok){
    throw new Error(`Request failed (${response.status})`);
  }
  return response.json();
}

function wireNavigation(){
  document.querySelectorAll('.nav-item[data-route]').forEach((node) => {
    node.addEventListener('click', () => {
      const route = node.getAttribute('data-route');
      if (route) window.location.href = route;
    });
  });

  document.getElementById('logout-btn').addEventListener('click', () => {
    localStorage.removeItem(ACCESS_TOKEN_KEY);
    localStorage.removeItem(REFRESH_TOKEN_KEY);
    localStorage.removeItem(USER_ROLE_KEY);
    localStorage.removeItem(USER_NAME_KEY);
    redirectToHome();
  });

  document.getElementById('export-btn').addEventListener('click', exportCurrentCsv);
  document.getElementById('export-pdf-btn').addEventListener('click', exportCurrentPdf);

  const periodNodes = document.querySelectorAll('.range-tab');
  periodNodes.forEach((node) => {
    node.addEventListener('click', () => {
      const label = (node.textContent || '').trim().toLowerCase();
      const map = {
        'today': 'day',
        'this week': 'week',
        'this month': 'month',
        'this year': 'year',
      };
      const nextPeriod = map[label];
      if (nextPeriod) setPeriod(node, nextPeriod);
    });
  });

  const reportNodes = document.querySelectorAll('.report-tab');
  reportNodes.forEach((node) => {
    node.addEventListener('click', () => {
      const label = (node.textContent || '').toLowerCase();
      if (label.includes('sales')) setReportType(node, 'sales');
      else if (label.includes('product')) setReportType(node, 'products');
      else if (label.includes('cashier')) setReportType(node, 'cashiers');
      else if (label.includes('inventory')) setReportType(node, 'inventory');
    });
  });
}

function setProfileAndGuard(){
  const role = normalizeRole(localStorage.getItem(USER_ROLE_KEY));
  if (role === 'CASHIER'){
    showToast('Reports are available to Admin and Manager only.', 'error');
    window.location.href = 'dashboard.html';
    return false;
  }

  const username = localStorage.getItem(USER_NAME_KEY) || 'User';
  currentUserRole = role;
  currentUserName = username;
  document.getElementById('user-name').textContent = username;
  document.getElementById('user-role').textContent = roleDisplayName(role);
  const initials = username.split(' ').filter(Boolean).slice(0,2).map((p) => p[0]?.toUpperCase() || '').join('');
  document.getElementById('user-avatar').textContent = initials || 'US';
  return true;
}

function dateRangeForPeriod(period){
  const end = new Date();
  const start = new Date(end);
  if (period === 'day') {
    return { start: localIsoDate(start), end: localIsoDate(end), weeks: 1 };
  }
  if (period === 'week') {
    start.setDate(end.getDate() - 6);
    return { start: localIsoDate(start), end: localIsoDate(end), weeks: 2 };
  }
  if (period === 'month') {
    start.setDate(end.getDate() - 29);
    return { start: localIsoDate(start), end: localIsoDate(end), weeks: 5 };
  }
  start.setDate(end.getDate() - 364);
  return { start: localIsoDate(start), end: localIsoDate(end), weeks: 52 };
}

function setPeriod(el, period){
  currentPeriod = period;
  document.querySelectorAll('.range-tab').forEach((t) => t.classList.remove('active'));
  el.classList.add('active');
  document.getElementById('report-period-label').textContent = `${periodLabels[period]} - Live overview`;
  loadAndRender().catch((error) => showToast(error.message || 'Failed to refresh reports', 'error'));
}

function setReportType(el, type){
  currentReportType = type;
  document.querySelectorAll('.report-tab').forEach((t) => t.classList.remove('active'));
  el.classList.add('active');
  ['sales','products','cashiers','inventory'].forEach((name) => {
    document.getElementById(`tab-${name}`).style.display = name === type ? 'block' : 'none';
  });
}

function renderSalesKpis(){
  const completed = cached.sales.filter((s) => String(s.status || '').toUpperCase() === 'COMPLETED');
  const revenue = completed.reduce((sum, s) => sum + toAmount(s.total_amount), 0);
  const txns = completed.length;
  const avgBasket = txns ? revenue / txns : 0;
  const grossProfit = revenue * 0.35;

  document.getElementById('k-revenue').textContent = formatCurrency(revenue);
  document.getElementById('k-txns').textContent = txns.toLocaleString('en-GB');
  document.getElementById('k-basket').textContent = formatCurrency(avgBasket);
  document.getElementById('k-profit').textContent = formatCurrency(grossProfit);
  document.getElementById('k-revenue-delta').textContent = `${cached.daily.length} day points loaded`;
  document.getElementById('k-txns-delta').textContent = `${cached.paymentBreakdown.length} payment channels`;
}

function renderBarChart(containerId, pairs, labelFormatter){
  const node = document.getElementById(containerId);
  if (!node) return;
  if (!pairs.length){
    node.innerHTML = '<div style="color:var(--text-muted);font-size:12px;">No data available.</div>';
    return;
  }
  const maxVal = Math.max(...pairs.map((x) => x.value), 1);
  node.innerHTML = pairs.map((row, idx) => {
    const h = Math.max(4, Math.round((row.value / maxVal) * 110));
    const hiClass = idx === pairs.length - 1 ? 'hi' : 'mid';
    return `<div class="bar-col"><div class="bar ${hiClass}" style="height:${h}px;"><div class="bar-tooltip">${formatCurrency(row.value)}</div></div><div class="bar-lbl">${labelFormatter(row.label)}</div></div>`;
  }).join('');
}

function renderSalesCharts(){
  const dailyPairs = cached.daily.map((d) => ({ label: d.report_date, value: toAmount(d.gross_total) }));
  renderBarChart('daily-chart', dailyPairs, (label) => String(label).slice(5));

  const total = dailyPairs.reduce((sum, r) => sum + r.value, 0);
  const avg = dailyPairs.length ? total / dailyPairs.length : 0;
  const peak = dailyPairs.reduce((best, item) => (item.value > best.value ? item : best), { label: '-', value: 0 });
  document.getElementById('daily-summary').innerHTML = `
    <div class="cs-item"><div class="cs-val">${formatCurrency(total)}</div><div class="cs-lbl">Period total</div></div>
    <div class="cs-item"><div class="cs-val">${formatCurrency(avg)}</div><div class="cs-lbl">Daily avg</div></div>
    <div class="cs-item"><div class="cs-val">${formatCurrency(peak.value)}</div><div class="cs-lbl">Peak day</div></div>`;

  const paymentRows = cached.paymentBreakdown.map((p) => ({ method: String(p.method || '').replaceAll('_', ' '), total: toAmount(p.total) }));
  const payTotal = paymentRows.reduce((sum, p) => sum + p.total, 0) || 1;
  const paymentNode = document.getElementById('payment-split');
  paymentNode.innerHTML = paymentRows.length
    ? paymentRows.map((p, idx) => {
        const pct = Math.round((p.total / payTotal) * 100);
        const colors = ['#0f1f3d', '#4e80ee', '#93c5fd', '#3b82f6'];
        const color = colors[idx % colors.length];
        return `<div class="h-bar-item"><div class="h-bar-label">${p.method}</div><div class="h-bar-track"><div class="h-bar-fill" style="width:${pct}%;background:${color};"></div></div><div class="h-bar-val">${pct}%</div></div>`;
      }).join('')
    : '<div style="color:var(--text-muted);font-size:12px;">No payment data.</div>';

  const byHour = Array.from({ length: 24 }, (_, i) => ({ label: i, value: 0 }));
  cached.sales.filter((s) => String(s.status || '').toUpperCase() === 'COMPLETED').forEach((s) => {
    const hour = new Date(s.created_at).getHours();
    byHour[hour].value += 1;
  });
  renderBarChart('hourly-chart', byHour, (h) => (h % 4 === 0 ? `${h}h` : ''));

  const dowNames = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];
  const byDow = dowNames.map((n) => ({ label: n, value: 0 }));
  cached.sales.filter((s) => String(s.status || '').toUpperCase() === 'COMPLETED').forEach((s) => {
    const d = new Date(s.created_at).getDay();
    byDow[d].value += toAmount(s.total_amount);
  });
  const dowNode = document.getElementById('dow-chart');
  const maxDow = Math.max(...byDow.map((r) => r.value), 1);
  dowNode.innerHTML = `<div style="display:flex;gap:6px;align-items:flex-end;height:80px;margin-bottom:8px;">${byDow.map((d) => `<div class="bar-col"><div class="bar mid" style="height:${Math.max(4, Math.round((d.value / maxDow) * 72))}px;"><div class="bar-tooltip">${formatCurrency(d.value)}</div></div><div class="bar-lbl">${d.label}</div></div>`).join('')}</div>`;

  const perfByCategory = new Map();
  cached.performance.forEach((r) => {
    const cat = r.product__category__name || 'Uncategorized';
    perfByCategory.set(cat, (perfByCategory.get(cat) || 0) + toAmount(r.revenue));
  });
  const catRows = [...perfByCategory.entries()].sort((a,b) => b[1]-a[1]);
  const catTotal = catRows.reduce((sum, row) => sum + row[1], 0) || 1;
  const catNode = document.getElementById('category-breakdown');
  catNode.innerHTML = catRows.length
    ? catRows.map((row) => {
        const pct = Math.round((row[1] / catTotal) * 100);
        return `<div class="h-bar-item"><div class="h-bar-label">${row[0]}</div><div class="h-bar-track"><div class="h-bar-fill" style="width:${pct}%"></div></div><div class="h-bar-val">${pct}%</div></div>`;
      }).join('')
    : '<div style="color:var(--text-muted);font-size:12px;">No category performance data.</div>';
}

function renderProducts(){
  const perf = [...cached.performance];
  const byUnits = [...perf].sort((a,b) => toAmount(b.units_sold) - toAmount(a.units_sold));
  const byRevenue = [...perf].sort((a,b) => toAmount(b.revenue) - toAmount(a.revenue));

  const topByUnits = document.getElementById('top-products');
  topByUnits.innerHTML = byUnits.length
    ? byUnits.slice(0, 8).map((p, i) => {
        const product = getProductById(p.product__id);
        const name = p.product__name || 'Product';
        const thumb = productThumbMarkup(name, getProductImageUrl(product));
        return `<div class="prod-row"><div class="prod-rank">${i+1}</div>${thumb}<div class="prod-info"><div class="prod-name-sm">${escapeHtml(name)}</div><div class="prod-cat-sm">${escapeHtml(p.product__category__name || 'Uncategorized')}</div></div><div class="prod-units">${toAmount(p.units_sold).toLocaleString()} units</div></div>`;
      }).join('')
    : '<div style="padding:1rem 0;color:var(--text-muted);font-size:12px;">No product performance data.</div>';

  const topByRevenue = document.getElementById('top-revenue-products');
  topByRevenue.innerHTML = byRevenue.length
    ? byRevenue.slice(0, 8).map((p, i) => {
        const product = getProductById(p.product__id);
        const name = p.product__name || 'Product';
        const thumb = productThumbMarkup(name, getProductImageUrl(product));
        return `<div class="prod-row"><div class="prod-rank">${i+1}</div>${thumb}<div class="prod-info"><div class="prod-name-sm">${escapeHtml(name)}</div><div class="prod-cat-sm">${escapeHtml(p.product__category__name || 'Uncategorized')}</div></div><div class="prod-rev">${formatCurrency(p.revenue)}</div></div>`;
      }).join('')
    : '<div style="padding:1rem 0;color:var(--text-muted);font-size:12px;">No revenue data.</div>';

  const tbody = document.getElementById('product-report-tbody');
  tbody.innerHTML = byRevenue.length
    ? byRevenue.map((p, i) => `<tr><td>${i+1}</td><td>${p.product__name || 'Product'}</td><td>${p.product__category__name || 'Uncategorized'}</td><td style="font-family:'Geist Mono',monospace;">${toAmount(p.units_sold).toLocaleString()}</td><td style="font-family:'Geist Mono',monospace;font-weight:500;">${formatCurrency(p.revenue)}</td><td style="font-family:'Geist Mono',monospace;">${Math.max(0, Number(cached.products.find((x) => Number(x.id) === Number(p.product__id))?.quantity || 0))}</td></tr>`).join('')
    : '<tr><td colspan="6" style="color:var(--text-muted);">No product report rows.</td></tr>';
}

function renderCashiers(){
  const rowsMap = new Map();
  let refundCount = 0;

  cached.sales.forEach((s) => {
    const status = String(s.status || '').toUpperCase();
    if (status === 'REFUNDED') refundCount += 1;
    if (status !== 'COMPLETED') return;
    const cashier = s.cashier_name || 'Unknown';
    const row = rowsMap.get(cashier) || { name: cashier, txns: 0, rev: 0 };
    row.txns += 1;
    row.rev += toAmount(s.total_amount);
    rowsMap.set(cashier, row);
  });

  const rows = [...rowsMap.values()].sort((a,b) => b.rev - a.rev);
  const totalRevenue = rows.reduce((sum, r) => sum + r.rev, 0);
  const avgPerCashier = rows.length ? totalRevenue / rows.length : 0;
  const top = rows[0];

  document.getElementById('c-total').textContent = String(rows.length);
  document.getElementById('c-top').textContent = top ? top.name : '-';
  document.getElementById('c-top-rev').textContent = top ? formatCurrency(top.rev) : formatCurrency(0);
  document.getElementById('c-avg').textContent = formatCurrency(avgPerCashier);
  document.getElementById('c-refunds').textContent = String(refundCount);

  const maxRev = Math.max(...rows.map((r) => r.rev), 1);
  document.getElementById('cashier-tbody').innerHTML = rows.length
    ? rows.map((r) => {
        const pct = Math.round((r.rev / maxRev) * 100);
        return `<tr><td>${r.name}</td><td style="font-family:'Geist Mono',monospace;">${r.txns}</td><td style="font-family:'Geist Mono',monospace;font-weight:500;">${formatCurrency(r.rev)}</td><td style="font-family:'Geist Mono',monospace;">${formatCurrency(r.txns ? r.rev / r.txns : 0)}</td><td><div class="perf-bar"><div class="perf-track"><div class="perf-fill" style="width:${pct}%"></div></div><div class="perf-pct">${pct}%</div></div></td></tr>`;
      }).join('')
    : '<tr><td colspan="5" style="color:var(--text-muted);">No cashier sales data.</td></tr>';

  document.getElementById('cashier-chart').innerHTML = rows.length
    ? rows.map((r) => `<div class="bar-col"><div class="bar hi" style="height:${Math.max(4, Math.round((r.rev / maxRev) * 90))}px;opacity:${r.rev === maxRev ? 1 : 0.5};"><div class="bar-tooltip">${formatCurrency(r.rev)}</div></div><div class="bar-lbl">${r.name.split(' ').map((x) => x[0]).join('').slice(0,2)}</div></div>`).join('')
    : '<div style="color:var(--text-muted);font-size:12px;">No chart data.</div>';
}

function renderInventory(){
  const summary = cached.inventorySummary?.summary || {};
  const low = cached.inventorySummary?.low_stock || [];
  const activeProducts = Number(summary.active_products || 0);
  const totalUnits = Number(summary.total_units || 0);
  const lowCount = low.length;

  const stockValue = cached.products.reduce((sum, p) => sum + (toAmount(p.price) * Number(p.quantity || 0)), 0);

  document.getElementById('i-products').textContent = activeProducts.toLocaleString('en-GB');
  document.getElementById('i-units').textContent = totalUnits.toLocaleString('en-GB');
  document.getElementById('i-low').textContent = String(lowCount);
  document.getElementById('i-value').textContent = formatCurrency(stockValue);

  document.getElementById('fast-moving').innerHTML = low.length
    ? low.map((p, idx) => `<div class="prod-row"><div class="prod-rank">${idx+1}</div><div class="prod-emoji-sm">!</div><div class="prod-info"><div class="prod-name-sm">${p.name}</div><div class="prod-cat-sm">SKU: ${p.sku}</div></div><div class="prod-units">${p.quantity} / ${p.low_stock_threshold}</div></div>`).join('')
    : '<div style="padding:1rem 0;color:var(--text-muted);font-size:12px;">No low stock products.</div>';

  const byCat = new Map();
  cached.products.forEach((p) => {
    const cat = p.category_name || 'Uncategorized';
    byCat.set(cat, (byCat.get(cat) || 0) + Number(p.quantity || 0));
  });
  const catRows = [...byCat.entries()];
  const maxCat = Math.max(...catRows.map((r) => r[1]), 1);
  document.getElementById('inv-chart').innerHTML = catRows.length
    ? catRows.map((row) => `<div class="bar-col"><div class="bar mid" style="height:${Math.max(4, Math.round((row[1] / maxCat) * 80))}px;"><div class="bar-tooltip">${row[1]} units</div></div><div class="bar-lbl">${row[0].slice(0,3)}</div></div>`).join('')
    : '<div style="color:var(--text-muted);font-size:12px;">No category data.</div>';

  document.getElementById('inv-tbody').innerHTML = cached.products.length
    ? cached.products.map((p) => {
        const qty = Number(p.quantity || 0);
        const threshold = Number(p.low_stock_threshold || 0);
        const status = qty <= threshold ? 'Low Stock' : 'In Stock';
        return `<tr><td>${p.name}</td><td>${p.category_name || 'Uncategorized'}</td><td style="font-family:'Geist Mono',monospace;">${formatCurrency(p.price)}</td><td style="font-family:'Geist Mono',monospace;font-weight:500;">${qty}</td><td style="font-family:'Geist Mono',monospace;">${formatCurrency(toAmount(p.price) * qty)}</td><td><span class="badge ${qty <= threshold ? 'badge-yellow' : 'badge-green'}">${status}</span></td></tr>`;
      }).join('')
    : '<tr><td colspan="6" style="color:var(--text-muted);">No inventory rows.</td></tr>';
}

function getCurrentExportPayload(){
  if (currentReportType === 'sales'){
    return {
      title: 'Sales Report',
      headers: ['Date','Revenue'],
      rows: cached.daily.map((d) => [d.report_date, toAmount(d.gross_total).toFixed(2)]),
    };
  }

  if (currentReportType === 'products'){
    return {
      title: 'Product Performance Report',
      headers: ['Product','Category','Units Sold','Revenue'],
      rows: cached.performance.map((p) => [p.product__name || '', p.product__category__name || '', toAmount(p.units_sold), toAmount(p.revenue).toFixed(2)]),
    };
  }

  if (currentReportType === 'cashiers'){
    return {
      title: 'Cashier Report',
      headers: ['Sale Number','Cashier','Total','Status','Created At'],
      rows: cached.sales.map((s) => [s.sale_number || `TXN-${s.id}`, s.cashier_name || 'Unknown', toAmount(s.total_amount).toFixed(2), s.status || '', s.created_at || '']),
    };
  }

  return {
    title: 'Inventory Report',
    headers: ['Product','Category','Price','Quantity','Low Threshold'],
    rows: cached.products.map((p) => [p.name, p.category_name || '', toAmount(p.price).toFixed(2), Number(p.quantity || 0), Number(p.low_stock_threshold || 0)]),
  };
}

function exportCurrentCsv(){
  const payload = getCurrentExportPayload();
  const headers = payload.headers;
  const rows = payload.rows;

  if (!rows.length){
    showToast('No data to export', 'error');
    return;
  }

  const csv = [headers, ...rows].map((row) => row.map((cell) => `"${String(cell ?? '').replaceAll('"', '""')}"`).join(',')).join('\n');
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `reports-${currentReportType}-${currentPeriod}.csv`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
  showToast('Report exported', 'success');
}

function exportCurrentPdf(){
  const payload = getCurrentExportPayload();
  const rows = payload.rows;

  if (!rows.length){
    showToast('No data to export', 'error');
    return;
  }

  const jspdfNamespace = window.jspdf;
  if (!jspdfNamespace || typeof jspdfNamespace.jsPDF !== 'function'){
    exportCurrentPdfPrintFallback(payload);
    showToast('Using print fallback for PDF.', 'success');
    return;
  }

  const { jsPDF } = jspdfNamespace;
  const doc = new jsPDF({ orientation: 'landscape', unit: 'pt', format: 'a4' });
  const generatedAt = new Date().toLocaleString('en-GB');
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const watermark = `Generated by ${roleDisplayName(currentUserRole)}`;

  const drawHeader = () => {
    doc.setFillColor(15, 31, 61);
    doc.rect(0, 0, pageWidth, 44, 'F');

    doc.setTextColor(255, 255, 255);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(13);
    doc.text('SwiftPOS', 40, 28);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(10);
    doc.text(`${payload.title} â€¢ ${periodLabels[currentPeriod] || currentPeriod}`, pageWidth - 40, 28, { align: 'right' });

    doc.setTextColor(17, 24, 39);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(16);
    doc.text(payload.title, 40, 68);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(10);
    doc.text(`Generated: ${generatedAt}`, 40, 84);
    doc.text(`By: ${currentUserName} (${roleDisplayName(currentUserRole)})`, pageWidth - 40, 84, { align: 'right' });
  };

  drawHeader();

  const body = rows.map((row) => row.map((cell) => String(cell ?? '')));
  doc.autoTable({
    startY: 98,
    head: [payload.headers],
    body,
    styles: { fontSize: 9, cellPadding: 5 },
    headStyles: { fillColor: [15, 31, 61], textColor: [255, 255, 255] },
    alternateRowStyles: { fillColor: [247, 249, 253] },
    margin: { left: 40, right: 40 },
    didDrawPage: () => {
      drawHeader();

      doc.setTextColor(224, 229, 238);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(42);
      doc.text(watermark, pageWidth / 2, pageHeight / 2, { align: 'center', angle: 32 });
      doc.setTextColor(17, 24, 39);
    },
  });

  const totalPages = doc.internal.getNumberOfPages();
  for (let page = 1; page <= totalPages; page += 1){
    doc.setPage(page);
    doc.setDrawColor(229, 231, 235);
    doc.line(40, pageHeight - 34, pageWidth - 40, pageHeight - 34);
    doc.setTextColor(107, 114, 128);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    doc.text(`Generated ${generatedAt}`, 40, pageHeight - 18);
    doc.text(`Page ${page} of ${totalPages}`, pageWidth - 40, pageHeight - 18, { align: 'right' });
  }

  doc.save(`reports-${currentReportType}-${currentPeriod}.pdf`);
  showToast('PDF exported', 'success');
}

function exportCurrentPdfPrintFallback(payload){
  const generatedAt = new Date().toLocaleString('en-GB');
  const rows = payload.rows;
  const watermarkText = `Generated by ${roleDisplayName(currentUserRole)}`;
  const safeTitle = escapeHtml(payload.title);
  const safePeriod = escapeHtml(periodLabels[currentPeriod] || currentPeriod);
  const safeGeneratedAt = escapeHtml(generatedAt);
  const safeUserLine = `${escapeHtml(currentUserName)} (${escapeHtml(roleDisplayName(currentUserRole))})`;
  const safeWatermark = escapeHtml(watermarkText);
  const tableHead = `<tr>${payload.headers.map((header) => `<th>${escapeHtml(header)}</th>`).join('')}</tr>`;
  const tableBody = rows.map((row) => `<tr>${row.map((cell) => `<td>${escapeHtml(cell)}</td>`).join('')}</tr>`).join('');

  const html = [
    '<!DOCTYPE html>',
    '<html lang="en">',
    '<head>',
    '  <meta charset="UTF-8">',
    `  <title>${safeTitle}</title>`,
    '  <style>',
    '    body { font-family: Arial, sans-serif; color: #111827; padding: 24px; }',
    '    .top { border-bottom: 2px solid #0f1f3d; margin-bottom: 14px; padding-bottom: 8px; }',
    '    .brand { font-size: 18px; font-weight: 700; color: #0f1f3d; }',
    '    .meta { color: #4b5563; font-size: 12px; margin-top: 4px; }',
    '    .wm { position: fixed; top: 45%; left: 50%; transform: translate(-50%, -50%) rotate(-28deg); color: rgba(15,31,61,0.08); font-size: 52px; font-weight: 700; pointer-events: none; }',
    '    table { width: 100%; border-collapse: collapse; margin-top: 14px; font-size: 12px; }',
    '    th, td { border: 1px solid #e5e7eb; padding: 8px; text-align: left; }',
    '    th { background: #0f1f3d; color: #fff; }',
    '    tr:nth-child(even) td { background: #f8fafc; }',
    '    .foot { margin-top: 12px; color: #6b7280; font-size: 11px; }',
    '  </style>',
    '</head>',
    '<body>',
    `  <div class="wm">${safeWatermark}</div>`,
    '  <div class="top">',
    `    <div class="brand">SwiftPOS - ${safeTitle}</div>`,
    `    <div class="meta">Period: ${safePeriod} | Generated: ${safeGeneratedAt} | By: ${safeUserLine}</div>`,
    '  </div>',
    '  <table>',
    `    <thead>${tableHead}</thead>`,
    `    <tbody>${tableBody}</tbody>`,
    '  </table>',
    '  <div class="foot">If your browser does not auto-save, choose Save as PDF in the print dialog.</div>',
    '</body>',
    '</html>',
  ].join('\n');

  const printWindow = window.open('', '_blank', 'noopener,noreferrer,width=1200,height=850');
  if (!printWindow){
    showToast('Popup blocked. Allow popups to use PDF fallback.', 'error');
    return;
  }

  printWindow.document.open();
  printWindow.document.write(html);
  printWindow.document.close();
  printWindow.focus();
  setTimeout(() => {
    printWindow.print();
  }, 200);
}

async function updateInventoryBadge(){
  const badge = document.getElementById('inventory-nav-badge');
  if (!badge) return;
  const low = cached.inventorySummary?.low_stock || [];
  badge.textContent = String(low.length);
}

async function loadAndRender(){
  const { start, end, weeks } = dateRangeForPeriod(currentPeriod);

  const [salesData, paymentsData, productsData, dailyData, weeklyData, perfData, inventoryData] = await Promise.all([
    apiGet('/sales/?ordering=-created_at'),
    apiGet('/payments/?ordering=-created_at'),
    apiGet('/products/items/?ordering=name'),
    apiGet(`/reports/sales/daily/?start_date=${start}&end_date=${end}`),
    apiGet(`/reports/sales/weekly/?weeks=${weeks}`),
    apiGet(`/reports/products/performance/?start_date=${start}&end_date=${end}&limit=100`),
    apiGet('/reports/inventory/summary/'),
  ]);

  cached.sales = normalizeList(salesData);
  cached.payments = normalizeList(paymentsData);
  cached.products = normalizeList(productsData).filter((p) => !p.is_deleted);
  cached.daily = normalizeList(dailyData?.daily);
  cached.paymentBreakdown = normalizeList(dailyData?.payment_breakdown);
  cached.weekly = normalizeList(weeklyData?.weekly);
  cached.performance = normalizeList(perfData?.top_products);
  cached.inventorySummary = inventoryData;

  renderSalesKpis();
  renderSalesCharts();
  renderProducts();
  renderCashiers();
  renderInventory();
  updateInventoryBadge();
}

async function initPage(){
  const token = localStorage.getItem(ACCESS_TOKEN_KEY);
  if (!token){
    redirectToLogin();
    return;
  }

  if (!setProfileAndGuard()) return;
  wireNavigation();

  try {
    await loadAndRender();
  } catch (error) {
    console.error(error);
    showToast(error.message || 'Failed to load reports', 'error');
  }
}

initPage();
