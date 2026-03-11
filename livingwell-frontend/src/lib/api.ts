import axios from "axios";

const BASE_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

export const apiClient = axios.create({ baseURL: BASE_URL });

apiClient.interceptors.request.use((config) => {
  if (typeof window !== "undefined") {
    const token = localStorage.getItem("lwc_access_token");
    if (token) config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

apiClient.interceptors.response.use(
  (res) => res,
  async (error) => {
    const original = error.config;
    if (error.response?.status === 401 && !original._retry) {
      original._retry = true;
      const refreshToken =
        typeof window !== "undefined"
          ? localStorage.getItem("lwc_refresh_token")
          : null;
      if (!refreshToken) {
        if (typeof window !== "undefined") window.location.href = "/login";
        return Promise.reject(error);
      }
      try {
        const { data } = await axios.post(`${BASE_URL}/api/auth/refresh`, {
          refresh_token: refreshToken,
        });
        localStorage.setItem("lwc_access_token", data.access_token);
        localStorage.setItem("lwc_refresh_token", data.refresh_token);
        original.headers.Authorization = `Bearer ${data.access_token}`;
        return apiClient(original);
      } catch {
        if (typeof window !== "undefined") {
          localStorage.clear();
          document.cookie =
            "lwc_token_present=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;";
          window.location.href = "/login";
        }
      }
    }
    return Promise.reject(error);
  }
);
