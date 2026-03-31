const { API_BASE_URL, ACCESS_TOKEN_KEY, REFRESH_TOKEN_KEY, USER_ROLE_KEY, USER_NAME_KEY } = window.POS_CONFIG;

const TAX_RATE = 0.05;
const ROLE_LABELS = { ADMIN: "Admin", MANAGER: "Manager", CASHIER: "Cashier" };

const state = {
  role: "CASHIER",
  products: [],
  customers: [],
  categories: ["All"],
  activeCategory: "All",
  searchText: "",
  cart: {},
  paymentMethod: "CASH",
  saleReference: "-",
  sessionSeconds: 0,
  lastTotals: { subtotal: 0, tax: 0, discount: 0, total: 0 },
};

const userAvatarNode = document.getElementById("user-avatar");
const userNameNode = document.getElementById("user-name");
const userRoleNode = document.getElementById("user-role");
const sessionTimeNode = document.getElementById("session-time");
const saleReferenceNode = document.getElementById("sale-reference");
const productsGridNode = document.getElementById("products-grid");
const categoryTabsNode = document.getElementById("category-tabs");
const searchInputNode = document.getElementById("search-input");
const customerSelectNode = document.getElementById("customer-select");
const cartCountNode = document.getElementById("cart-count");
const cartItemsNode = document.getElementById("cart-items");
const cartEmptyNode = document.getElementById("cart-empty");
const subtotalNode = document.getElementById("subtotal-val");
const taxNode = document.getElementById("tax-val");
const discountInputNode = document.getElementById("discount-input");
const totalNode = document.getElementById("total-val");
const paymentMethodsNode = document.getElementById("payment-methods");
const cashTenderRowNode = document.getElementById("cash-tender-row");
const tenderedInputNode = document.getElementById("tendered-input");
const changeDisplayNode = document.getElementById("change-display");
const checkoutButtonNode = document.getElementById("checkout-btn");
const clearCartButtonNode = document.getElementById("clear-cart-btn");
const confirmModalNode = document.getElementById("confirm-modal");
const successModalNode = document.getElementById("success-modal");
const closeConfirmButtonNode = document.getElementById("close-confirm-btn");
const cancelCheckoutButtonNode = document.getElementById("cancel-checkout-btn");
const confirmCheckoutButtonNode = document.getElementById("confirm-checkout-btn");
const receiptMetaNode = document.getElementById("receipt-meta");
const receiptItemsNode = document.getElementById("receipt-items");
const receiptSubtotalNode = document.getElementById("receipt-subtotal");
const receiptTaxNode = document.getElementById("receipt-tax");
const receiptDiscountNode = document.getElementById("receipt-discount");
const receiptTotalNode = document.getElementById("receipt-total");
const successTotalNode = document.getElementById("success-total");
const successExtraNode = document.getElementById("success-extra");
const newSaleButtonNode = document.getElementById("new-sale-btn");
const toastNode = document.getElementById("toast");
const logoutButtonNode = document.getElementById("logout-btn");
const backHomeButtonNode = document.getElementById("back-home-btn");
const refreshButtonNode = document.getElementById("refresh-btn");

function redirectToLogin() {
  window.location.href = "login.html";
}

function redirectToHome() {
  window.location.href = "what.html";
}

function redirectToDashboard() {
  window.location.href = "dashboard.html";
}

function clearAuthAndRedirectToLogin() {
  localStorage.removeItem(ACCESS_TOKEN_KEY);
  localStorage.removeItem(REFRESH_TOKEN_KEY);
  localStorage.removeItem(USER_ROLE_KEY);
  localStorage.removeItem(USER_NAME_KEY);
  redirectToLogin();
}

function showToast(message) {
  toastNode.textContent = message;
  toastNode.classList.add("show");
  setTimeout(() => toastNode.classList.remove("show"), 2400);
}

function formatMoney(value) {
  return `GHc ${value.toLocaleString("en-GB", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function toNumber(value) {
  const parsed = Number.parseFloat(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function normalizeList(payload) {
  if (Array.isArray(payload)) {
    return payload;
  }
  if (payload && Array.isArray(payload.results)) {
    return payload.results;
  }
  return [];
}

function getInitials(name) {
  return String(name || "User")
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0].toUpperCase())
    .join("") || "US";
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
    throw new Error(`Request failed (${response.status})`);
  }

  return response.json();
}

async function apiPost(path, body) {
  const token = localStorage.getItem(ACCESS_TOKEN_KEY);
  const response = await fetch(`${API_BASE_URL}${path}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(body),
  });

  if (response.status === 401) {
    clearAuthAndRedirectToLogin();
    throw new Error("Session expired.");
  }

  let payload = null;
  try {
    payload = await response.json();
  } catch {
    payload = null;
  }

  if (!response.ok) {
    const detail = payload?.detail;
    if (typeof detail === "string") {
      throw new Error(detail);
    }
    throw new Error("Checkout failed.");
  }

  return payload;
}

function setupProfile() {
  const role = String(localStorage.getItem(USER_ROLE_KEY) || "CASHIER").toUpperCase();
  state.role = ["ADMIN", "MANAGER", "CASHIER"].includes(role) ? role : "CASHIER";

  const username = localStorage.getItem(USER_NAME_KEY) || "User";
  userNameNode.textContent = username;
  userRoleNode.textContent = ROLE_LABELS[state.role] || "Cashier";
  userAvatarNode.textContent = getInitials(username);
}

function startSessionTimer() {
  setInterval(() => {
    state.sessionSeconds += 1;
    const h = String(Math.floor(state.sessionSeconds / 3600)).padStart(2, "0");
    const m = String(Math.floor((state.sessionSeconds % 3600) / 60)).padStart(2, "0");
    const s = String(state.sessionSeconds % 60).padStart(2, "0");
    sessionTimeNode.textContent = `${h}:${m}:${s}`;
  }, 1000);
}

function buildCategoryTabs() {
  categoryTabsNode.innerHTML = "";

  state.categories.forEach((category) => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = `cat-tab${state.activeCategory === category ? " active" : ""}`;
    button.textContent = category;
    button.addEventListener("click", () => {
      state.activeCategory = category;
      buildCategoryTabs();
      renderProducts();
    });
    categoryTabsNode.appendChild(button);
  });
}

function createProductCard(product) {
  const isOut = product.quantity <= 0;
  const isLow = product.quantity > 0 && product.is_low_stock;
  const stockClass = isOut ? "none" : isLow ? "low" : "";
  const stockText = isOut ? "Out of stock" : isLow ? `Low stock: ${product.quantity}` : `${product.quantity} in stock`;

  return `
    <button class="product-card${isOut ? " out" : ""}" type="button" data-product-id="${product.id}" ${isOut ? "disabled" : ""}>
      <div class="product-name">${product.name}</div>
      <div class="product-category">${product.category_name || "General"}</div>
      <div class="product-price">${formatMoney(toNumber(product.price))}</div>
      <div class="product-stock ${stockClass}">${stockText}</div>
    </button>
  `;
}

function filteredProducts() {
  const q = state.searchText.trim().toLowerCase();
  return state.products.filter((product) => {
    const byCategory = state.activeCategory === "All" || (product.category_name || "General") === state.activeCategory;
    if (!byCategory) {
      return false;
    }

    if (!q) {
      return true;
    }

    return (
      String(product.name || "").toLowerCase().includes(q) ||
      String(product.sku || "").toLowerCase().includes(q) ||
      String(product.barcode || "").toLowerCase().includes(q)
    );
  });
}

function renderProducts() {
  const list = filteredProducts();
  if (!list.length) {
    productsGridNode.innerHTML = "<div class=\"empty-list\">No products found.</div>";
    return;
  }

  productsGridNode.innerHTML = list.map((product) => createProductCard(product)).join("");

  productsGridNode.querySelectorAll(".product-card").forEach((node) => {
    node.addEventListener("click", () => {
      const id = Number.parseInt(node.getAttribute("data-product-id"), 10);
      addProductToCart(id);
    });
  });
}

function loadCustomersSelect() {
  customerSelectNode.innerHTML = "<option value=\"\">Walk-in customer</option>";
  state.customers.forEach((customer) => {
    const option = document.createElement("option");
    option.value = String(customer.id);
    option.textContent = `${customer.name} (${customer.customer_code})`;
    customerSelectNode.appendChild(option);
  });
}

function getCartItems() {
  return Object.values(state.cart);
}

function addProductToCart(productId) {
  const product = state.products.find((item) => item.id === productId);
  if (!product) {
    return;
  }

  if (product.quantity <= 0) {
    showToast("Product is out of stock.");
    return;
  }

  const existing = state.cart[product.id];
  if (existing && existing.qty >= product.quantity) {
    showToast("Cannot exceed available stock.");
    return;
  }

  if (!existing) {
    state.cart[product.id] = {
      id: product.id,
      name: product.name,
      price: toNumber(product.price),
      qty: 1,
      available: product.quantity,
    };
  } else {
    existing.qty += 1;
  }

  renderCart();
}

function changeQuantity(productId, delta) {
  const item = state.cart[productId];
  if (!item) {
    return;
  }

  item.qty += delta;
  if (item.qty <= 0) {
    delete state.cart[productId];
  } else if (item.qty > item.available) {
    item.qty = item.available;
    showToast("Reached stock limit.");
  }

  renderCart();
}

function removeItem(productId) {
  delete state.cart[productId];
  renderCart();
}

function readTotals() {
  const subtotal = getCartItems().reduce((sum, item) => sum + item.price * item.qty, 0);
  const tax = subtotal * TAX_RATE;
  const discount = Math.min(Math.max(toNumber(discountInputNode.value), 0), subtotal + tax);
  const total = Math.max(0, subtotal + tax - discount);
  state.lastTotals = { subtotal, tax, discount, total };
  return state.lastTotals;
}

function renderTotals() {
  const totals = readTotals();

  subtotalNode.textContent = formatMoney(totals.subtotal);
  taxNode.textContent = formatMoney(totals.tax);
  totalNode.textContent = formatMoney(totals.total);

  const tendered = toNumber(tenderedInputNode.value);
  const change = tendered - totals.total;
  if (state.paymentMethod === "CASH" && tendered > 0) {
    if (change >= 0) {
      changeDisplayNode.textContent = `Change: ${formatMoney(change)}`;
      changeDisplayNode.style.color = "var(--success)";
    } else {
      changeDisplayNode.textContent = `Short: ${formatMoney(Math.abs(change))}`;
      changeDisplayNode.style.color = "var(--danger)";
    }
  } else {
    changeDisplayNode.textContent = "Change: GHc 0.00";
    changeDisplayNode.style.color = "var(--success)";
  }

  checkoutButtonNode.disabled = getCartItems().length === 0;
}

function cartItemTemplate(item) {
  return `
    <div class="cart-item" data-cart-id="${item.id}">
      <div class="item-main">
        <div class="item-name">${item.name}</div>
        <div class="item-unit mono">${formatMoney(item.price)} each</div>
      </div>
      <div class="qty-wrap">
        <button class="qty-btn" type="button" data-act="dec">-</button>
        <span class="qty-num mono">${item.qty}</span>
        <button class="qty-btn" type="button" data-act="inc">+</button>
      </div>
      <div class="item-total mono">${formatMoney(item.price * item.qty)}</div>
      <button class="item-remove" type="button" data-act="remove">X</button>
    </div>
  `;
}

function renderCart() {
  const items = getCartItems();
  cartCountNode.textContent = String(items.reduce((sum, item) => sum + item.qty, 0));

  cartItemsNode.querySelectorAll(".cart-item").forEach((node) => node.remove());

  if (!items.length) {
    cartEmptyNode.style.display = "grid";
  } else {
    cartEmptyNode.style.display = "none";
    cartItemsNode.insertAdjacentHTML("beforeend", items.map((item) => cartItemTemplate(item)).join(""));
  }

  cartItemsNode.querySelectorAll(".cart-item").forEach((row) => {
    const id = Number.parseInt(row.getAttribute("data-cart-id"), 10);
    row.querySelectorAll("button").forEach((button) => {
      button.addEventListener("click", () => {
        const action = button.getAttribute("data-act");
        if (action === "inc") {
          changeQuantity(id, 1);
        } else if (action === "dec") {
          changeQuantity(id, -1);
        } else {
          removeItem(id);
        }
      });
    });
  });

  renderTotals();
}

function setPaymentMethod(method) {
  state.paymentMethod = method;
  paymentMethodsNode.querySelectorAll(".pay-method").forEach((node) => {
    node.classList.toggle("active", node.getAttribute("data-method") === method);
  });

  cashTenderRowNode.style.display = method === "CASH" ? "flex" : "none";
  renderTotals();
}

function openConfirmModal() {
  const items = getCartItems();
  if (!items.length) {
    return;
  }

  const totals = readTotals();
  const customerId = customerSelectNode.value;
  const customer = state.customers.find((entry) => String(entry.id) === customerId);

  receiptMetaNode.innerHTML = [
    `<div>Reference: ${state.saleReference}</div>`,
    `<div>Date: ${new Date().toLocaleString("en-GB")}</div>`,
    `<div>Customer: ${customer ? customer.name : "Walk-in"}</div>`,
    `<div>Payment: ${state.paymentMethod.replaceAll("_", " ")}</div>`,
  ].join("");

  receiptItemsNode.innerHTML = items
    .map((item) => `<div class=\"receipt-line\"><span>${item.name} x${item.qty}</span><span class=\"mono\">${formatMoney(item.qty * item.price)}</span></div>`)
    .join("");

  receiptSubtotalNode.textContent = formatMoney(totals.subtotal);
  receiptTaxNode.textContent = formatMoney(totals.tax);
  receiptDiscountNode.textContent = totals.discount > 0 ? `- ${formatMoney(totals.discount)}` : "-";
  receiptTotalNode.textContent = formatMoney(totals.total);

  confirmModalNode.classList.add("open");
}

function closeConfirmModal() {
  confirmModalNode.classList.remove("open");
}

function openSuccessModal(total, change) {
  successTotalNode.textContent = formatMoney(total);
  if (state.paymentMethod === "CASH") {
    successExtraNode.textContent = `Change: ${formatMoney(Math.max(change, 0))}`;
  } else {
    successExtraNode.textContent = `Paid by ${state.paymentMethod.replaceAll("_", " ")}`;
  }
  successModalNode.classList.add("open");
}

function resetForNewSale(referenceHint = null) {
  state.cart = {};
  discountInputNode.value = "";
  tenderedInputNode.value = "";
  customerSelectNode.value = "";
  setPaymentMethod("CASH");
  renderCart();

  if (referenceHint) {
    state.saleReference = referenceHint;
    saleReferenceNode.textContent = referenceHint;
  } else {
    const candidate = `S-${String(Date.now()).slice(-6)}`;
    state.saleReference = candidate;
    saleReferenceNode.textContent = candidate;
  }
}

async function submitCheckout() {
  const items = getCartItems();
  if (!items.length) {
    return;
  }

  const totals = readTotals();
  const tendered = toNumber(tenderedInputNode.value);
  if (state.paymentMethod === "CASH" && tendered > 0 && tendered < totals.total) {
    showToast("Tendered amount is below total.");
    return;
  }

  confirmCheckoutButtonNode.disabled = true;

  try {
    const customerId = customerSelectNode.value ? Number.parseInt(customerSelectNode.value, 10) : null;

    const payload = {
      customer_id: customerId,
      items: items.map((item) => ({ product_id: item.id, quantity: item.qty })),
      payment_method: state.paymentMethod,
      discount_amount: Number.parseFloat(totals.discount.toFixed(2)),
      tax_amount: Number.parseFloat(totals.tax.toFixed(2)),
      notes: `POS checkout by ${localStorage.getItem(USER_NAME_KEY) || "user"}`,
    };

    const response = await apiPost("/sales/checkout/", payload);
    closeConfirmModal();

    const change = tendered - totals.total;
    openSuccessModal(totals.total, change);

    if (response?.sale_number) {
      state.saleReference = response.sale_number;
    }

    await refreshProductsAndCustomers();
    resetForNewSale(response?.sale_number || null);
    showToast("Checkout completed.");
  } catch (error) {
    showToast(error.message || "Checkout failed.");
  } finally {
    confirmCheckoutButtonNode.disabled = false;
  }
}

async function refreshProductsAndCustomers() {
  const [productsPayload, customersPayload, salesPayload] = await Promise.all([
    apiGet("/products/items/?ordering=name"),
    apiGet("/customers/?ordering=name"),
    apiGet("/sales/?ordering=-created_at"),
  ]);

  state.products = normalizeList(productsPayload).filter((product) => product.is_active !== false);
  state.customers = normalizeList(customersPayload);

  const categories = new Set(["All"]);
  state.products.forEach((product) => categories.add(product.category_name || "General"));
  state.categories = [...categories];

  const latestSale = normalizeList(salesPayload)[0];
  state.saleReference = latestSale?.sale_number || `S-${String(Date.now()).slice(-6)}`;
  saleReferenceNode.textContent = state.saleReference;

  buildCategoryTabs();
  renderProducts();
  loadCustomersSelect();
}

function bindEvents() {
  searchInputNode.addEventListener("input", () => {
    state.searchText = searchInputNode.value;
    renderProducts();
  });

  discountInputNode.addEventListener("input", renderTotals);
  tenderedInputNode.addEventListener("input", renderTotals);

  paymentMethodsNode.querySelectorAll(".pay-method").forEach((node) => {
    node.addEventListener("click", () => setPaymentMethod(node.getAttribute("data-method")));
  });

  checkoutButtonNode.addEventListener("click", openConfirmModal);
  clearCartButtonNode.addEventListener("click", () => {
    state.cart = {};
    renderCart();
    showToast("Cart cleared.");
  });

  closeConfirmButtonNode.addEventListener("click", closeConfirmModal);
  cancelCheckoutButtonNode.addEventListener("click", closeConfirmModal);
  confirmCheckoutButtonNode.addEventListener("click", submitCheckout);

  newSaleButtonNode.addEventListener("click", () => {
    successModalNode.classList.remove("open");
    showToast("Ready for next sale.");
  });

  confirmModalNode.addEventListener("click", (event) => {
    if (event.target === confirmModalNode) {
      closeConfirmModal();
    }
  });

  logoutButtonNode.addEventListener("click", clearAuthAndRedirectToLogin);
  backHomeButtonNode.addEventListener("click", redirectToHome);
  refreshButtonNode.addEventListener("click", () => {
    refreshProductsAndCustomers()
      .then(() => showToast("POS data refreshed."))
      .catch((error) => showToast(error.message || "Refresh failed."));
  });

  document.querySelectorAll("[data-route]").forEach((button) => {
    button.addEventListener("click", () => {
      const route = button.getAttribute("data-route");
      if (route === "dashboard.html") {
        redirectToDashboard();
      }
    });
  });
}

// ===== BARCODE SCANNER =====
let scannedProduct = null;

const barcodeModalNode = document.getElementById("modal-barcode");
const barcodeInputNode = document.getElementById("barcode-input");
const barcodeResultNode = document.getElementById("barcode-result");
const barcodeMessageNode = document.getElementById("barcode-message");
const addScannedBtnNode = document.getElementById("add-scanned-btn");
const resultEmojiNode = document.getElementById("result-emoji");
const resultNameNode = document.getElementById("result-name");
const resultSkuNode = document.getElementById("result-sku");
const resultPriceNode = document.getElementById("result-price");

function openBarcodeScanner() {
  barcodeModalNode.classList.add("open");
  scannedProduct = null;
  barcodeInputNode.value = "";
  barcodeResultNode.style.display = "none";
  barcodeMessageNode.style.display = "none";
  addScannedBtnNode.style.display = "none";
  setTimeout(() => barcodeInputNode.focus(), 100);
}

function closeBarcodeScanner() {
  barcodeModalNode.classList.remove("open");
  scannedProduct = null;
  barcodeInputNode.value = "";
  barcodeResultNode.style.display = "none";
  barcodeMessageNode.style.display = "none";
  addScannedBtnNode.style.display = "none";
}

async function lookupProductByBarcode(barcode) {
  if (!barcode || barcode.trim().length === 0) {
    barcodeResultNode.style.display = "none";
    barcodeMessageNode.style.display = "none";
    addScannedBtnNode.style.display = "none";
    return;
  }

  try {
    const data = await apiGet(`/products/lookup-barcode/?barcode=${encodeURIComponent(barcode.trim())}`);
    if (data && data.id) {
      scannedProduct = {
        id: data.id,
        name: data.name,
        sku: data.sku,
        barcode: data.barcode,
        price: toNumber(data.price),
        quantity: data.quantity,
        category_name: data.category_name || "General",
      };

      // Display result
      barcodeResultNode.style.display = "block";
      barcodeMessageNode.style.display = "none";
      resultEmojiNode.textContent = getEmojiForCategory(scannedProduct.category_name);
      resultNameNode.textContent = scannedProduct.name;
      resultSkuNode.textContent = scannedProduct.sku;
      resultPriceNode.textContent = formatMoney(scannedProduct.price);
      addScannedBtnNode.style.display = "block";

      // Auto-add to cart if in stock
      if (scannedProduct.quantity > 0) {
        addScannedProduct();
      } else {
        addScannedBtnNode.textContent = "Out of Stock";
        addScannedBtnNode.disabled = true;
        showToast("Product is out of stock.");
      }
    } else {
      throw new Error("Invalid product data");
    }
  } catch (error) {
    scannedProduct = null;
    barcodeResultNode.style.display = "none";
    barcodeMessageNode.style.display = "block";
    addScannedBtnNode.style.display = "none";
    showToast("Product not found for this barcode.");
    console.error("Barcode lookup error:", error);
  }
}

function addScannedProduct() {
  if (!scannedProduct) {
    return;
  }

  const product = state.products.find((p) => p.id === scannedProduct.id);
  if (!product) {
    showToast("Product no longer available.");
    return;
  }

  addProductToCart(scannedProduct.id);
  showToast(`${scannedProduct.name} added to cart.`);
  closeBarcodeScanner();
}

function getEmojiForCategory(category) {
  const emojiMap = {
    Beverages: "🧃",
    Food: "🍱",
    Household: "🧹",
    "Personal Care": "🧴",
  };
  return emojiMap[category] || "📦";
}

async function init() {
  const accessToken = localStorage.getItem(ACCESS_TOKEN_KEY);
  if (!accessToken) {
    redirectToLogin();
    return;
  }

  setupProfile();
  bindEvents();
  setPaymentMethod("CASH");
  renderCart();
  startSessionTimer();

  // Setup barcode scanner input listener
  barcodeInputNode.addEventListener("keydown", async (event) => {
    if (event.key === "Enter") {
      const barcode = barcodeInputNode.value.trim();
      if (barcode) {
        await lookupProductByBarcode(barcode);
        barcodeInputNode.value = "";
        barcodeInputNode.focus();
      }
    }
  });

  // Trigger lookup on input (debounced for barcode scanners)
  let barcodeTimeout;
  barcodeInputNode.addEventListener("input", () => {
    clearTimeout(barcodeTimeout);
    const barcode = barcodeInputNode.value.trim();
    if (barcode.length > 3) {
      barcodeTimeout = setTimeout(() => {
        lookupProductByBarcode(barcode);
      }, 300);
    }
  });

  // Close barcode modal on overlay click
  barcodeModalNode.addEventListener("click", (event) => {
    if (event.target === barcodeModalNode) {
      closeBarcodeScanner();
    }
  });

  try {
    await refreshProductsAndCustomers();
  } catch (error) {
    showToast(error.message || "Could not load POS data.");
  }
}

init();
