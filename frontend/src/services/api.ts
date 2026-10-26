import axios, { AxiosInstance, InternalAxiosRequestConfig } from "axios";
import { API_BASE_URL, API_CONFIGURATION_ERROR } from "./apiConfig.js";

const api: AxiosInstance = axios.create({
  baseURL: API_BASE_URL,
  withCredentials: true,
  headers: {
    "Content-Type": "application/json",
  },
});

let refreshPromise: Promise<string> | null = null;

const refreshSession = async (): Promise<string> => {
  const response = await axios.post(
    `${API_BASE_URL}/users/refresh-token`,
    {},
    { withCredentials: true }
  );
  const nextToken = response.data?.data?.accessToken;
  if (!nextToken) throw new Error("The session refresh response did not include an access token.");
  localStorage.setItem("accessToken", nextToken);
  return nextToken;
};

// Request interceptor
api.interceptors.request.use(
  (config: InternalAxiosRequestConfig) => {
    if (API_CONFIGURATION_ERROR) {
      return Promise.reject(new Error(API_CONFIGURATION_ERROR));
    }

    const token = localStorage.getItem("accessToken");
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    } else if (config.headers) {
      delete config.headers.Authorization;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

// Response interceptor
api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;
    const requestUrl = originalRequest?.url || "";
    const isRefreshRequest = requestUrl.includes("/users/refresh-token");

    if (error.response?.status !== 401 || !originalRequest || isRefreshRequest || originalRequest._sessionRetry) {
      if (error.response?.status === 401 && (isRefreshRequest || originalRequest?._sessionRetry)) {
        window.dispatchEvent(new Event("campusflow:unauthorized"));
      }
      return Promise.reject(error);
    }

    originalRequest._sessionRetry = true;
    try {
      refreshPromise ||= refreshSession();
      const nextToken = await refreshPromise;
      originalRequest.headers = originalRequest.headers || {};
      originalRequest.headers.Authorization = `Bearer ${nextToken}`;
      return api(originalRequest);
    } catch (refreshError) {
      window.dispatchEvent(new Event("campusflow:unauthorized"));
      return Promise.reject(refreshError);
    } finally {
      refreshPromise = null;
    }
  }
);

export default api;
