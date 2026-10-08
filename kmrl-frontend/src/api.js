const API_URL = (
  process.env.REACT_APP_API_URL ||
  (process.env.NODE_ENV === "production"
    ? "https://kmrl-3.onrender.com"
    : "http://127.0.0.1:5000")
).replace(/\/+$/, "");

export const apiFetch = async (input, options = {}) => {
  const requestUrl = typeof input === "string" ? input : input.url;
  const headers = new Headers(
    options.headers ||
      (typeof Request !== "undefined" && input instanceof Request
        ? input.headers
        : undefined),
  );
  const token = sessionStorage.getItem("document_routing_token");

  if (
    token &&
    new URL(requestUrl, window.location.href).origin ===
      new URL(API_URL, window.location.href).origin
  ) {
    headers.set("Authorization", `Bearer ${token}`);
  }

  const response = await fetch(input, { ...options, headers });
  if (response.status === 401 && token) {
    sessionStorage.removeItem("document_routing_token");
    sessionStorage.removeItem("document_routing_user");
    window.dispatchEvent(new Event("auth-expired"));
  }
  return response;
};

export default API_URL;
