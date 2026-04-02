const isLocalHost = ["127.0.0.1", "localhost"].includes(window.location.hostname);
const deployedBackendApiBase = "https://backend-only-yk47.onrender.com/api/v1";
const apiBaseOverride = window.POS_API_BASE_URL || "";

window.POS_CONFIG = {
  API_BASE_URL: apiBaseOverride || (isLocalHost ? "http://127.0.0.1:8000/api/v1" : deployedBackendApiBase),
  ACCESS_TOKEN_KEY: "pos_access_token",
  REFRESH_TOKEN_KEY: "pos_refresh_token",
  USER_ROLE_KEY: "pos_user_role",
  USER_NAME_KEY: "pos_user_name",
};

(function initPosUiLoader() {
  const STYLE_ID = 'pos-global-loader-style';
  const LOADER_ID = 'pos-global-loader';

  function ensureStyle() {
    if (document.getElementById(STYLE_ID)) return;
    const style = document.createElement('style');
    style.id = STYLE_ID;
    style.textContent = [
      '.pos-global-loader{position:fixed;inset:0;display:flex;align-items:center;justify-content:center;z-index:9999;background:rgba(255,255,255,0.78);backdrop-filter:blur(2px);opacity:0;pointer-events:none;transition:opacity 180ms ease;}',
      '.pos-global-loader.show{opacity:1;pointer-events:auto;}',
      '.pos-global-loader-card{display:flex;align-items:center;gap:10px;background:#ffffff;border:1px solid #e5e7eb;border-radius:12px;padding:12px 14px;box-shadow:0 10px 28px rgba(15,31,61,0.16);font:500 13px/1.2 Geist,sans-serif;color:#0f1f3d;}',
      '.pos-global-loader-spin{width:18px;height:18px;border:2px solid #dbe3f7;border-top-color:#1e40af;border-radius:50%;animation:posSpin 800ms linear infinite;}',
      '@keyframes posSpin{to{transform:rotate(360deg);}}',
    ].join('');
    document.head.appendChild(style);
  }

  function ensureLoader() {
    ensureStyle();
    let node = document.getElementById(LOADER_ID);
    if (node) return node;

    node = document.createElement('div');
    node.id = LOADER_ID;
    node.className = 'pos-global-loader';
    node.setAttribute('aria-hidden', 'true');
    node.innerHTML = '<div class="pos-global-loader-card"><div class="pos-global-loader-spin"></div><div id="pos-global-loader-label">Loading...</div></div>';
    document.body.appendChild(node);
    return node;
  }

  function showGlobalLoader(label) {
    const node = ensureLoader();
    const labelNode = document.getElementById('pos-global-loader-label');
    if (labelNode) labelNode.textContent = label || 'Loading...';
    node.classList.add('show');
    node.setAttribute('aria-hidden', 'false');
  }

  function hideGlobalLoader() {
    const node = document.getElementById(LOADER_ID);
    if (!node) return;
    node.classList.remove('show');
    node.setAttribute('aria-hidden', 'true');
  }

  async function withGlobalLoader(task, label) {
    showGlobalLoader(label);
    try {
      return await task();
    } finally {
      hideGlobalLoader();
    }
  }

  window.POS_UI = {
    ...(window.POS_UI || {}),
    ensureGlobalLoader: ensureLoader,
    showGlobalLoader,
    hideGlobalLoader,
    withGlobalLoader,
  };
})();
