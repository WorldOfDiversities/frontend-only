const { API_BASE_URL } = window.POS_CONFIG;

const form = document.getElementById("register-form");
const registerButton = document.getElementById("register-btn");
const defaultRegisterButtonText = registerButton.textContent;
const statusText = document.getElementById("register-status");
const usernameInput = document.getElementById("username");
const passwordInput = document.getElementById("password");
const confirmPasswordInput = document.getElementById("confirm_password");
const passwordToggleButtons = document.querySelectorAll("[data-password-toggle]");

function setStatus(message, type = "") {
  statusText.textContent = message;
  statusText.classList.remove("error", "success");
  if (type) {
    statusText.classList.add(type);
  }
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
  [usernameInput, passwordInput, confirmPasswordInput].forEach((field) => {
    field.classList.remove("input-invalid");
    field.removeAttribute("aria-invalid");
    removeFieldTooltip(field);
  });
}

function markInvalid(input, message) {
  input.classList.add("input-invalid");
  input.setAttribute("aria-invalid", "true");
  showFieldTooltip(input, message);
  input.focus();
  setStatus("");
}

function validateRegistrationRequiredFields() {
  clearInvalidState();

  if (!usernameInput.value.trim()) {
    markInvalid(usernameInput, "Username is required.");
    return false;
  }

  if (!passwordInput.value) {
    markInvalid(passwordInput, "Password is required.");
    return false;
  }

  if (!confirmPasswordInput.value) {
    markInvalid(confirmPasswordInput, "Confirm password is required.");
    return false;
  }

  if (passwordInput.value !== confirmPasswordInput.value) {
    markInvalid(confirmPasswordInput, "Passwords do not match.");
    return false;
  }

  return true;
}

function normalizeErrorMessage(errorData) {
  if (!errorData || typeof errorData !== "object") {
    return "Registration failed. Please verify your details.";
  }

  if (errorData.detail) {
    return String(errorData.detail);
  }

  const firstKey = Object.keys(errorData)[0];
  if (!firstKey) {
    return "Registration failed. Please verify your details.";
  }

  const value = errorData[firstKey];
  if (Array.isArray(value) && value.length > 0) {
    return String(value[0]);
  }

  if (typeof value === "string") {
    return value;
  }

  return "Registration failed. Please verify your details.";
}

async function register(payload) {
  let response;

  try {
    response = await fetch(`${API_BASE_URL}/auth/register/`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    });
  } catch {
    throw new Error("Unable to reach backend. Confirm Django server is running on 127.0.0.1:8000.");
  }

  if (!response.ok) {
    let data;
    try {
      data = await response.json();
    } catch {
      throw new Error("Registration failed. Please try again.");
    }
    throw new Error(normalizeErrorMessage(data));
  }

  return response.json();
}

wirePasswordVisibilityToggle();

form.addEventListener("submit", async (event) => {
  event.preventDefault();

  const formData = new FormData(form);
  const payload = {
    first_name: String(formData.get("first_name") || "").trim(),
    last_name: String(formData.get("last_name") || "").trim(),
    username: String(formData.get("username") || "").trim(),
    email: String(formData.get("email") || "").trim(),
    role: String(formData.get("role") || "CASHIER").trim(),
    password: String(formData.get("password") || ""),
    confirm_password: String(formData.get("confirm_password") || ""),
  };

  if (!validateRegistrationRequiredFields()) {
    return;
  }

  registerButton.disabled = true;
  registerButton.textContent = "Creating account...";
  setStatus("");

  try {
    await register(payload);
    setStatus("Registration successful. Redirecting to login...", "success");
    setTimeout(() => {
      window.location.href = "login.html";
    }, 900);
  } catch (error) {
    setStatus(error.message, "error");
  } finally {
    registerButton.disabled = false;
    registerButton.textContent = defaultRegisterButtonText;
  }
});

[usernameInput, passwordInput, confirmPasswordInput].forEach((input) => {
  input.addEventListener("input", () => {
    input.classList.remove("input-invalid");
    input.removeAttribute("aria-invalid");
    removeFieldTooltip(input);
  });
});
