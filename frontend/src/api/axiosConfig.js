import axios from "axios";

// 1. رابط الباك إند الأساسي (بدون /api/v1) عشان نستخدمه للصور والـ Sockets
//export const BACKEND_URL = "http://192.168.1.4:3000";
//export const BACKEND_URL = "http://127.0.0.1:3000";
//export const BACKEND_URL = "https://goalsmash-api.onrender.com";
export const BACKEND_URL = "https://mla3balexandria-api.online";

// 2. رابط الـ API
const baseURL = `${BACKEND_URL}/api/v1`;

const apiClient = axios.create({
  baseURL: baseURL,
  headers: {
    "Content-Type": "application/json",
  },
});

apiClient.interceptors.request.use(
  (config) => {
    // 2. تغليف localStorage بشرط التأكد من وجود المتصفح (window) لمنع سقوط الـ SSR
    if (typeof window !== "undefined") {
      const token = localStorage.getItem("token") || sessionStorage.getItem("token");
      if (token) {
        config.headers.Authorization = `Bearer ${token}`;
      }
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  },
);

export default apiClient;
