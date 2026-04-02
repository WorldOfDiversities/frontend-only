const { API_BASE_URL, ACCESS_TOKEN_KEY, REFRESH_TOKEN_KEY, USER_ROLE_KEY, USER_NAME_KEY } = window.POS_CONFIG;

const form = document.getElementById("login-form");
const usernameInput = document.getElementById("username");
const passwordInput = document.getElementById("password");
const passwordToggleButtons = document.querySelectorAll("[data-password-toggle]");
const loginButton = document.getElementById("login-btn");
const statusText = document.getElementById("login-status");
const roleTabs = document.querySelectorAll(".role-tab");
const defaultLoginButtonText = loginButton.textContent;

const ROLE_PLACEHOLDERS = {
  admin: "admin",
  manager: "manager",
  cashier: "cashier",
};

function updateUsernamePlaceholderByRole(role) {
  const key = role.toLowerCase();
  usernameInput.placeholder = ROLE_PLACEHOLDERS[key] || "username";
}

function setStatus(message, type = "") {
  statusText.textContent = message;
  statusText.classList.remove("error", "success");
  if (type) {
    statusText.classList.add(type);
  }
}

function setLoginLoading(isLoading) {
  loginButton.disabled = isLoading;
  if (isLoading) {
    loginButton.innerHTML = '<span class="btn-spinner" aria-hidden="true"></span><span>Logging in...</span>';
    return;
  }
  loginButton.textContent = defaultLoginButtonText;
}

function removeFieldTooltip(input) {
  const tooltipId = input.getAttribute("data-error-id");
  if (!tooltipId) {
    return;
  }

  const tooltip = document.getElementById(tooltipId);
  if (tooltip) {
    tooltip.remove();
  }

  input.removeAttribute("data-error-id");
  input.removeAttribute("aria-describedby");
}

function showFieldTooltip(input, message) {
  removeFieldTooltip(input);

  const tooltip = document.createElement("span");
  const tooltipId = `${input.id}-error`;
  tooltip.id = tooltipId;
  tooltip.className = "field-error-tooltip";
  tooltip.setAttribute("role", "alert");
  tooltip.textContent = message;

  const fieldWrapper = input.closest(".password-field");
  if (fieldWrapper) {
    fieldWrapper.insertAdjacentElement("afterend", tooltip);
  } else {
    input.insertAdjacentElement("afterend", tooltip);
  }
  input.setAttribute("data-error-id", tooltipId);
  input.setAttribute("aria-describedby", tooltipId);
}

function wirePasswordVisibilityToggle() {
  passwordToggleButtons.forEach((button) => {
    const targetId = button.getAttribute("data-password-toggle");
    const targetInput = targetId ? document.getElementById(targetId) : null;
    if (!targetInput) {
      return;
    }

    button.addEventListener("click", () => {
      const shouldShow = targetInput.type === "password";
      targetInput.type = shouldShow ? "text" : "password";
      button.classList.toggle("is-visible", shouldShow);
      button.setAttribute("aria-label", shouldShow ? "Hide password" : "Show password");
      button.setAttribute("aria-pressed", String(shouldShow));
      targetInput.focus();
    });
  });
}

function clearInvalidState() {
  [usernameInput, passwordInput].forEach((field) => {
    field.classList.remove("input-invalid");
    field.removeAttribute("aria-invalid");
    removeFieldTooltip(field);
  });
}

function validateLoginRequiredFields() {
  clearInvalidState();

  const requiredFields = [
    { input: usernameInput, label: "Username" },
    { input: passwordInput, label: "Password" },
  ];

  for (const { input, label } of requiredFields) {
    if (!input.value.trim()) {
      input.classList.add("input-invalid");
      input.setAttribute("aria-invalid", "true");
      showFieldTooltip(input, `${label} is required.`);
      input.focus();
      return false;
    }
  }

  return true;
}

async function login(username, password, role) {
  let response;
  try {
    response = await fetch(`${API_BASE_URL}/auth/token/`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ username, password, role }),
    });
  } catch {
    throw new Error("Unable to reach backend. Confirm Django server is running on 127.0.0.1:8000.");
  }

  if (!response.ok) {
    let errorMessage = "Incorrect credentials.";

    try {
      const data = await response.json();
      if (data.detail) {
        const detail = String(data.detail).toLowerCase();
        if (detail.includes("no active account") || detail.includes("credentials")) {
          errorMessage = "Incorrect credentials.";
        } else if (detail.includes("incorrect role selected")) {
          errorMessage = "Incorrect role selected.";
        }
      }
    } catch {
      // Fall back to generic message when backend does not return JSON.
    }

    throw new Error(errorMessage);
  }

  return response.json();
}

roleTabs.forEach((tab) => {
  tab.addEventListener("click", () => {
    roleTabs.forEach((item) => {
      item.classList.remove("active");
      item.setAttribute("aria-selected", "false");
    });

    tab.classList.add("active");
    tab.setAttribute("aria-selected", "true");
    updateUsernamePlaceholderByRole(tab.textContent.trim());
  });
});

const activeRoleTab = document.querySelector(".role-tab.active");
if (activeRoleTab) {
  updateUsernamePlaceholderByRole(activeRoleTab.textContent.trim());
}

wirePasswordVisibilityToggle();

form.addEventListener("submit", async (event) => {
  event.preventDefault();

  if (!validateLoginRequiredFields()) {
    return;
  }

  const username = usernameInput.value.trim();
  const password = passwordInput.value;
  const selectedRole = (document.querySelector(".role-tab.active")?.textContent || "Admin").trim().toUpperCase();

  setLoginLoading(true);
  setStatus("");

  try {
    const tokenData = await login(username, password, selectedRole);

    localStorage.setItem(ACCESS_TOKEN_KEY, tokenData.access);
    localStorage.setItem(REFRESH_TOKEN_KEY, tokenData.refresh);
    localStorage.setItem(USER_ROLE_KEY, tokenData.role || selectedRole);
    localStorage.setItem(USER_NAME_KEY, username);

    setTimeout(() => {
      window.location.href = "dashboard.html";
    }, 500);
  } catch (error) {
    if (error.message === "Incorrect credentials.") {
      passwordInput.classList.add("input-invalid");
      passwordInput.setAttribute("aria-invalid", "true");
      showFieldTooltip(passwordInput, error.message);
      passwordInput.focus();
      setStatus("");
    } else {
      setStatus(error.message, "error");
    }
  } finally {
    setLoginLoading(false);
  }
});

[usernameInput, passwordInput].forEach((input) => {
  input.addEventListener("input", () => {
    input.classList.remove("input-invalid");
    input.removeAttribute("aria-invalid");
    removeFieldTooltip(input);
  });
});
