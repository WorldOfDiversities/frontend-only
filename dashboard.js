const { API_BASE_URL, ACCESS_TOKEN_KEY, REFRESH_TOKEN_KEY, USER_ROLE_KEY, USER_NAME_KEY } = window.POS_CONFIG;

const logoutButton = document.getElementById("logout-btn");
const backHomeButton = document.getElementById("back-home-btn");
const exportButton = document.getElementById("export-btn");
const dateLine = document.getElementById("date-line");
const userNameNode = document.getElementById("user-name");
const userRoleNode = document.getElementById("user-role");
const userAvatarNode = document.getElementById("user-avatar");
const toast = document.getElementById("toast");
const weeklyChartNode = document.getElementById("weekly-chart");
const activityListNode = document.getElementById("activity-list");
const recentTransactionsBodyNode = document.getElementById("recent-transactions-body");
const stockAlertsListNode = document.getElementById("stock-alerts-list");
const topCashiersListNode = document.getElementById("top-cashiers-list");
const inventoryNavBadgeNode = document.getElementById("inventory-nav-badge");

let cachedSales = [];
let cachedPayments = [];

function redirectToHome() {
  window.location.href = "what.html";
}

function redirectToLogin() {
  window.location.href = "login.html";
}

function clearAuthAndRedirectToLogin() {
  localStorage.removeItem(ACCESS_TOKEN_KEY);
  localStorage.removeItem(REFRESH_TOKEN_KEY);
  localStorage.removeItem(USER_ROLE_KEY);
  localStorage.removeItem(USER_NAME_KEY);
  redirectToLogin();
}

function normalizeRole(rawRole) {
  const upper = String(rawRole || "ADMIN").toUpperCase();
  if (["ADMIN", "MANAGER", "CASHIER"].includes(upper)) {
    return upper;
  }
  return "ADMIN";
}

function roleDisplayName(role) {
  if (role === "CASHIER") {
    return "Cashier";
  }
  if (role === "MANAGER") {
    return "Manager";
  }
  return "Admin";
}

function normalizeListResponse(payload) {
  if (Array.isArray(payload)) {
    return payload;
  }
  if (payload && Array.isArray(payload.results)) {
    return payload.results;
  }
  return [];
}

function toAmount(value) {
  const parsed = Number.parseFloat(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function localIsoDate(dateValue = new Date()) {
  const date = new Date(dateValue);
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function formatCurrency(amount) {
  const value = Number.isFinite(amount) ? amount : 0;
  return `GHc ${value.toLocaleString("en-GB", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function formatPaymentMethod(method) {
  if (!method) {
    return "-";
  }
  return String(method)
    .toLowerCase()
    .split("_")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function showToast(message) {
  toast.textContent = message;
  toast.classList.add("show");
  setTimeout(() => toast.classList.remove("show"), 2200);
}

function applyRoleAccess(role) {
  const roleAwareNodes = document.querySelectorAll("[data-roles]");

  roleAwareNodes.forEach((node) => {
    const allowed = (node.getAttribute("data-roles") || "")
      .split(",")
      .map((item) => item.trim().toUpperCase())
      .filter(Boolean);

    if (!allowed.includes(role)) {
      node.classList.add("is-hidden-by-role");
    } else {
      node.classList.remove("is-hidden-by-role");
    }
  });
}

function setKpiValue(id, value, delta, deltaClass = "neutral") {
  const valueNode = document.getElementById(`${id}-value`);
  const deltaNode = document.getElementById(`${id}-delta`);
  if (!valueNode || !deltaNode) {
    return;
  }

  valueNode.textContent = value;
  deltaNode.textContent = delta;
  deltaNode.classList.remove("up", "down", "neutral");
  deltaNode.classList.add(deltaClass);
}

function renderWeeklyChart(values) {
  const safeValues = values.length ? values : [0, 0, 0, 0, 0, 0, 0];
  const maxValue = Math.max(...safeValues, 1);
  const todayIndex = safeValues.length - 1;

  weeklyChartNode.innerHTML = safeValues
    .map((value, index) => {
      const height = Math.round((value / maxValue) * 95);
      const isToday = index === todayIndex;
      return `<div class="bar${isToday ? " hi" : ""}" style="height:${height}px"></div>`;
    })
    .join("");
}

function renderRecentActivity(items) {
  if (!items.length) {
    activityListNode.innerHTML = "<li><span>No recent activity</span><strong class=\"mono\">-</strong></li>";
    return;
  }

  activityListNode.innerHTML = items
    .slice(0, 3)
    .map((item) => `<li><span>${item.label}</span><strong class="mono">${item.value}</strong></li>`)
    .join("");
}

function renderRecentTransactions(sales, paymentsBySaleId) {
  if (!sales.length) {
    recentTransactionsBodyNode.innerHTML = "<tr><td class=\"mono\" colspan=\"5\">No transactions yet</td></tr>";
    return;
  }

  const rows = sales.slice(0, 6).map((sale) => {
    const paymentMethod = formatPaymentMethod(paymentsBySaleId.get(sale.id));
    const amount = formatCurrency(toAmount(sale.total_amount));
    const statusText = String(sale.status || "PENDING").toUpperCase();
    const badgeClass = statusText === "COMPLETED" ? "success" : "warning";
    return `
      <tr>
        <td class="mono">${sale.sale_number || `TXN-${sale.id}`}</td>
        <td>${sale.customer_name || "Walk-in"}</td>
        <td>${paymentMethod}</td>
        <td class="mono">${amount}</td>
        <td><span class="badge ${badgeClass}">${statusText}</span></td>
      </tr>
    `;
  });

  recentTransactionsBodyNode.innerHTML = rows.join("");
}

function renderStockAlerts(lowStockProducts) {
  if (!lowStockProducts.length) {
    stockAlertsListNode.innerHTML = "<li><span>No stock alerts</span><strong class=\"mono\">OK</strong></li>";
    return;
  }

  stockAlertsListNode.innerHTML = lowStockProducts
    .slice(0, 5)
    .map((product) => `<li><span>${product.name}</span><strong class="mono">${product.quantity} / ${product.low_stock_threshold}</strong></li>`)
    .join("");
}

function renderTopCashiers(todayCompletedSales) {
  const totalsByCashier = new Map();

  todayCompletedSales.forEach((sale) => {
    const cashier = sale.cashier_name || "Unknown";
    const current = totalsByCashier.get(cashier) || 0;
    totalsByCashier.set(cashier, current + toAmount(sale.total_amount));
  });

  const entries = [...totalsByCashier.entries()].sort((a, b) => b[1] - a[1]).slice(0, 5);

  if (!entries.length) {
    topCashiersListNode.innerHTML = "<li><span>No cashier sales yet</span><strong class=\"mono\">-</strong></li>";
    return;
  }

  topCashiersListNode.innerHTML = entries
    .map(([cashier, total]) => `<li><span>${cashier}</span><strong class="mono">${formatCurrency(total)}</strong></li>`)
    .join("");
}

function setInventoryNavBadge(count) {
  if (!inventoryNavBadgeNode) {
    return;
  }

  const safeCount = Number.isFinite(count) && count >= 0 ? Math.trunc(count) : 0;
  inventoryNavBadgeNode.textContent = safeCount > 999 ? "999+" : String(safeCount);
}

async function apiGet(path) {
  const token = localStorage.getItem(ACCESS_TOKEN_KEY);
  const response = await fetch(`${API_BASE_URL}${path}`, {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });

  if (response.status === 401) {
    clearAuthAndRedirectToLogin();
    throw new Error("Session expired.");
  }

  if (!response.ok) {
    throw new Error(`Request failed: ${response.status}`);
  }

  return response.json();
}

function buildSalesDateBuckets(sales) {
  const buckets = new Map();

  for (let offset = 6; offset >= 0; offset -= 1) {
    const day = new Date();
    day.setDate(day.getDate() - offset);
    buckets.set(localIsoDate(day), 0);
  }

  sales.forEach((sale) => {
    if (String(sale.status).toUpperCase() !== "COMPLETED") {
      return;
    }
    const saleDate = localIsoDate(sale.created_at);
    if (buckets.has(saleDate)) {
      buckets.set(saleDate, buckets.get(saleDate) + toAmount(sale.total_amount));
    }
  });

  return [...buckets.values()];
}

async function loadDashboardData(role) {
  const isManagementRole = role === "ADMIN" || role === "MANAGER";

  const tasks = [
    apiGet("/sales/?ordering=-created_at"),
    apiGet("/customers/?ordering=-created_at"),
    apiGet("/payments/?ordering=-created_at"),
  ];

  if (isManagementRole) {
    tasks.push(apiGet("/reports/inventory/summary/"));
  }

  const results = await Promise.allSettled(tasks);
  const [salesResult, customersResult, paymentsResult, inventoryResult] = results;

  if (salesResult.status !== "fulfilled") {
    throw new Error("Could not load sales data.");
  }

  cachedSales = normalizeListResponse(salesResult.value);
  cachedPayments = paymentsResult.status === "fulfilled" ? normalizeListResponse(paymentsResult.value) : [];
  const customers = customersResult.status === "fulfilled" ? normalizeListResponse(customersResult.value) : [];
  const lowStock = inventoryResult?.status === "fulfilled" ? inventoryResult.value.low_stock || [] : [];
  const inventorySummary = inventoryResult?.status === "fulfilled" ? inventoryResult.value.summary || {} : {};

  const today = localIsoDate();
  const yesterdayDate = new Date();
  yesterdayDate.setDate(yesterdayDate.getDate() - 1);
  const yesterday = localIsoDate(yesterdayDate);

  const completedSales = cachedSales.filter((sale) => String(sale.status).toUpperCase() === "COMPLETED");
  const todayCompletedSales = completedSales.filter((sale) => localIsoDate(sale.created_at) === today);
  const yesterdayCompletedSales = completedSales.filter((sale) => localIsoDate(sale.created_at) === yesterday);

  const todayRevenue = todayCompletedSales.reduce((total, sale) => total + toAmount(sale.total_amount), 0);
  const yesterdayRevenue = yesterdayCompletedSales.reduce((total, sale) => total + toAmount(sale.total_amount), 0);
  const revenueChange = yesterdayRevenue > 0 ? ((todayRevenue - yesterdayRevenue) / yesterdayRevenue) * 100 : 0;
  const revenueDeltaClass = revenueChange > 0 ? "up" : revenueChange < 0 ? "down" : "neutral";
  const revenueDeltaText =
    yesterdayRevenue > 0
      ? `${revenueChange >= 0 ? "+" : ""}${revenueChange.toFixed(1)}% vs yesterday`
      : "No yesterday baseline";

  const todayTransactions = todayCompletedSales.length;
  const yesterdayTransactions = yesterdayCompletedSales.length;
  const transactionDiff = todayTransactions - yesterdayTransactions;
  const transactionDeltaClass = transactionDiff > 0 ? "up" : transactionDiff < 0 ? "down" : "neutral";
  const transactionDeltaText =
    transactionDiff === 0
      ? "Same as yesterday"
      : `${Math.abs(transactionDiff)} ${transactionDiff > 0 ? "above" : "below"} yesterday`;

  const newCustomersToday = customers.filter((customer) => localIsoDate(customer.created_at) === today).length;
  const lowStockCount = lowStock.length;
  const inventoryCount = Number.parseInt(
    inventorySummary.active_products ?? inventorySummary.total_products ?? lowStockCount,
    10
  );

  setInventoryNavBadge(inventoryCount);

  setKpiValue("kpi-revenue", formatCurrency(todayRevenue), revenueDeltaText, revenueDeltaClass);
  setKpiValue("kpi-transactions", String(todayTransactions), transactionDeltaText, transactionDeltaClass);
  setKpiValue(
    "kpi-low-stock",
    String(lowStockCount),
    lowStockCount ? `${lowStockCount} product${lowStockCount > 1 ? "s" : ""} below threshold` : "Stock levels healthy",
    lowStockCount ? "down" : "up"
  );
  setKpiValue("kpi-customers", String(newCustomersToday), `${customers.length} total customers`, "neutral");

  renderWeeklyChart(buildSalesDateBuckets(cachedSales));

  const paymentsBySaleId = new Map(
    cachedPayments
      .filter((payment) => payment.sale)
      .map((payment) => [payment.sale, payment.method])
  );

  renderRecentTransactions(cachedSales, paymentsBySaleId);
  renderStockAlerts(lowStock);
  renderTopCashiers(todayCompletedSales);

  const activityItems = [];
  if (todayCompletedSales[0]) {
    activityItems.push({
      label: "Latest sale completed",
      value: formatCurrency(toAmount(todayCompletedSales[0].total_amount)),
    });
  }

  activityItems.push({
    label: "New customers today",
    value: String(newCustomersToday),
  });

  if (isManagementRole) {
    activityItems.push({
      label: "Low stock alerts",
      value: String(lowStockCount),
    });
  } else {
    const todayPayments = cachedPayments.filter((payment) => localIsoDate(payment.created_at) === today).length;
    activityItems.push({
      label: "Payments processed today",
      value: String(todayPayments),
    });
  }

  renderRecentActivity(activityItems);
}

function setProfile(role) {
  const username = localStorage.getItem(USER_NAME_KEY) || "User";
  userNameNode.textContent = username;
  userRoleNode.textContent = roleDisplayName(role);

  const initials = username
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() || "")
    .join("");

  userAvatarNode.textContent = initials || "US";
}

async function checkAuthAndLoad() {
  const accessToken = localStorage.getItem(ACCESS_TOKEN_KEY);
  if (!accessToken) {
    redirectToLogin();
    return;
  }

  const role = normalizeRole(localStorage.getItem(USER_ROLE_KEY));
  applyRoleAccess(role);
  setProfile(role);

  dateLine.textContent = new Date().toLocaleDateString("en-GB", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  });

  try {
    await loadDashboardData(role);
  } catch (error) {
    showToast(error.message || "Could not load dashboard data.");
  }
}

document.querySelectorAll(".nav-item").forEach((item) => {
  item.addEventListener("click", () => {
    document.querySelectorAll(".nav-item").forEach((node) => node.classList.remove("active"));
    item.classList.add("active");

    const targetRoute = item.getAttribute("data-route");
    if (targetRoute) {
      window.location.href = targetRoute;
    }
  });
});

logoutButton.addEventListener("click", () => {
  localStorage.removeItem(ACCESS_TOKEN_KEY);
  localStorage.removeItem(REFRESH_TOKEN_KEY);
  localStorage.removeItem(USER_ROLE_KEY);
  localStorage.removeItem(USER_NAME_KEY);
  redirectToHome();
});

backHomeButton.addEventListener("click", redirectToHome);

exportButton.addEventListener("click", () => {
  if (!cachedSales.length) {
    showToast("No transaction data available to export.");
    return;
  }

  const headers = ["Sale Number", "Customer", "Status", "Amount", "Created At"];
  const rows = cachedSales.slice(0, 200).map((sale) => [
    sale.sale_number || `TXN-${sale.id}`,
    sale.customer_name || "Walk-in",
    sale.status || "PENDING",
    toAmount(sale.total_amount).toFixed(2),
    sale.created_at || "",
  ]);

  const csv = [headers, ...rows]
    .map((row) => row.map((cell) => `"${String(cell).replaceAll('"', '""')}"`).join(","))
    .join("\n");

  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = `dashboard-export-${localIsoDate()}.csv`;
  document.body.appendChild(anchor);
  anchor.click();
  document.body.removeChild(anchor);
  URL.revokeObjectURL(url);
  showToast("Report exported successfully.");
});

checkAuthAndLoad();
