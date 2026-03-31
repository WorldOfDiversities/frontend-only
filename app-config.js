const isLocalHost = ["127.0.0.1", "localhost"].includes(window.location.hostname);
const hostedDefaultApiBase = `${window.location.origin}/api/v1`;
const apiBaseOverride = window.POS_API_BASE_URL || "";

window.POS_CONFIG = {
  API_BASE_URL: apiBaseOverride || (isLocalHost ? "http://127.0.0.1:8000/api/v1" : hostedDefaultApiBase),
  ACCESS_TOKEN_KEY: "pos_access_token",
  REFRESH_TOKEN_KEY: "pos_refresh_token",
  USER_ROLE_KEY: "pos_user_role",
  USER_NAME_KEY: "pos_user_name",
};
