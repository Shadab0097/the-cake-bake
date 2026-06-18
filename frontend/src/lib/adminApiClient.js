import axios from 'axios';
import { getAdminAccessToken, setAdminAccessToken, clearAdminAccessToken } from './authToken.mjs';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000/api/v1';

/**
 * Separate axios instance for admin panel.
 * Uses an in-memory access token and an HttpOnly admin refresh cookie,
 * so admin refresh sessions don't collide with customer sessions.
 */
const adminApiClient = axios.create({
  baseURL: API_BASE_URL,
  timeout: 30000,
  headers: {
    'Content-Type': 'application/json',
  },
  withCredentials: true,
});

// Request interceptor — attach admin JWT
adminApiClient.interceptors.request.use(
  (config) => {
    const token = getAdminAccessToken();
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

// Response interceptor — handle 401 + refresh
let isRefreshing = false;
let failedQueue = [];

const processQueue = (error, token = null) => {
  failedQueue.forEach((prom) => {
    if (error) {
      prom.reject(error);
    } else {
      prom.resolve(token);
    }
  });
  failedQueue = [];
};

const shouldSkipRefresh = (url = '') => (
  url.includes('/auth/login') ||
  url.includes('/auth/register') ||
  url.includes('/auth/refresh') ||
  url.includes('/auth/forgot-password') ||
  url.includes('/auth/reset-password')
);

adminApiClient.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;

    if (error.response?.status === 401 && !originalRequest._retry && !shouldSkipRefresh(originalRequest.url || '')) {
      if (isRefreshing) {
        return new Promise((resolve, reject) => {
          failedQueue.push({ resolve, reject });
        })
          .then((token) => {
            originalRequest.headers.Authorization = `Bearer ${token}`;
            return adminApiClient(originalRequest);
          })
          .catch((err) => Promise.reject(err));
      }

      originalRequest._retry = true;
      isRefreshing = true;

      try {
        const res = await axios.post(
          `${API_BASE_URL}/auth/refresh`,
          { scope: 'admin' },
          { withCredentials: true }
        );

        const { accessToken } = res.data.data;
        setAdminAccessToken(accessToken);

        processQueue(null, accessToken);
        originalRequest.headers.Authorization = `Bearer ${accessToken}`;
        return adminApiClient(originalRequest);
      } catch (refreshError) {
        processQueue(refreshError, null);
        clearAdminAccessToken();
        // Do not hard-reload here. The admin login page also probes /users/me;
        // reloading it after a failed refresh restarts the probe and loops.
        // Protected admin pages redirect through AdminGuard instead.
        return Promise.reject(refreshError);
      } finally {
        isRefreshing = false;
      }
    }

    return Promise.reject(error);
  }
);

export default adminApiClient;
