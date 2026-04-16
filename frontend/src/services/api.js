import axios from 'axios';

// In production (Vercel), VITE_API_URL must point to the VPS backend.
// In development, proxy through Vite dev server.
const getBaseURL = () => {
  if (import.meta.env.VITE_API_URL) {
    return import.meta.env.VITE_API_URL;
  }
  const { protocol, hostname } = window.location;
  // If it's a domain (like trycloudflare.com), use relative path
  if (hostname.includes('.') && !hostname.match(/^\d/)) {
    return '/api';
  }
  // If it's localhost or an IP, use explicit port 8000
  return `${protocol}//${hostname}:8000/api`;
};

const api = axios.create({
  baseURL: getBaseURL(),
});

// Add a request interceptor to attach the JWT token
api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Add a response interceptor to handle 401 errors
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response && error.response.status === 401) {
      localStorage.removeItem('token');
      localStorage.removeItem('user');
      if (window.location.pathname !== '/login') {
        window.location.href = '/login';
      }
    }
    return Promise.reject(error);
  }
);

export const authService = {
  checkSetup: () => api.get('/auth/check-setup'),
  setup: (data) => api.post('/auth/setup', data),
  login: async (username, password) => {
    const formData = new FormData();
    formData.append('username', username);
    formData.append('password', password);
    const response = await api.post('/auth/login', formData);
    if (response.data.access_token) {
      localStorage.setItem('token', response.data.access_token);
      const userRes = await api.get('/users/me');
      localStorage.setItem('user', JSON.stringify(userRes.data));
      return userRes.data;
    }
    return null;
  },
  logout: () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    window.location.href = '/login';
  },
  getCurrentUser: () => {
    const user = localStorage.getItem('user');
    return user ? JSON.parse(user) : null;
  }
};

export const userService = {
  create: (data) => api.post('/users', data),
  list: () => api.get('/users'),
  delete: (id) => api.delete(`/users/${id}`),
  toggleActive: (id) => api.patch(`/users/${id}/toggle-active`),
  getMe: () => api.get('/users/me'),
};

export const customerService = {
  create: (data) => api.post('/customers/', data),
  update: (id, data) => api.put(`/customers/${id}`, data),
  list: () => api.get('/customers/'),
  search: (name) => api.get(`/customers/search?name=${name}`),
  getBalance: (id) => api.get(`/customers/${id}/balance`),
  delete: (id) => api.delete(`/customers/${id}`),
};

export const voucherService = {
  create: (data) => api.post('/vouchers', data),
  get: (id) => api.get(`/vouchers/${id}`),
  listAll: () => api.get('/vouchers'),
  getCustomerVouchers: (customerId) => api.get(`/customers/${customerId}/vouchers`),
  delete: (id) => api.delete(`/vouchers/${id}`),
};

export const paymentService = {
  create: (data) => api.post('/payments', data),
  listAll: () => api.get('/payments'),
  getCustomerPayments: (customerId) => api.get(`/customers/${customerId}/payments`),
  delete: (id) => api.delete(`/payments/${id}`),
};

export const analyticsService = {
  getDashboard: () => api.get('/analytics/dashboard'),
};

export const auditService = {
  list: () => api.get('/audit-logs'),
};

export default api;
