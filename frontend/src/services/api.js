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
  // If it's localhost or an IP, use explicit port 8001
  return `${protocol}//${hostname}:8001/api`;
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
  update: (id, data) => api.put(`/vouchers/${id}`, data),
  get: (id) => api.get(`/vouchers/${id}`),
  listAll: () => api.get('/vouchers'),
  listPage: (params) => api.get('/vouchers/page', { params }),
  getCustomerVouchers: (customerId) => api.get(`/customers/${customerId}/vouchers`),
  delete: (id) => api.delete(`/vouchers/${id}`),
};

export const paymentService = {
  create: (data) => api.post('/payments', data),
  listAll: () => api.get('/payments'),
  getCustomerPayments: (customerId) => api.get(`/customers/${customerId}/payments`),
  update: (id, data) => api.put(`/payments/${id}`, data),
  delete: (id) => api.delete(`/payments/${id}`),
};

export const analyticsService = {
  getDashboard: (period = 'month') => api.get('/analytics/dashboard', { params: { period } }),
};

export const auditService = {
  list: (page = 1, page_size = 25) => api.get('/audit-logs', { params: { page, page_size } }),
};

export const spendingService = {
  create: (data) => api.post('/spendings', data),
  list: () => api.get('/spendings'),
  update: (id, data) => api.put(`/spendings/${id}`, data),
  delete: (id) => api.delete(`/spendings/${id}`),
};

export const optionService = {
  list: () => api.get('/options'),
  add: (kind, name) => api.post('/options', { kind, name }),
  rename: (id, name) => api.put(`/options/${id}`, { name }),
  remove: (id) => api.delete(`/options/${id}`),
};

export const stockService = {
  list: () => api.get('/stock'),
  opening: (data) => api.post('/stock/opening', data),
  adjust: (id, data) => api.post(`/stock/${id}/adjust`, data),
  removeStock: (id) => api.delete(`/stock/${id}`),
  movements: (id, page = 1) => api.get(`/stock/${id}/movements`, { params: { page, page_size: 20 } }),
  listPurchases: (page = 1) => api.get('/purchases', { params: { page, page_size: 10 } }),
  createPurchase: (data) => api.post('/purchases', data),
  updatePurchase: (id, data) => api.put(`/purchases/${id}`, data),
  deletePurchase: (id) => api.delete(`/purchases/${id}`),
  coreWeight: (start, end, page, page_size) => api.get('/analytics/core-weight', { params: { start, end, page, page_size } }),
  profit: (start, end) => api.get('/analytics/profit', { params: { start, end } }),
  alerts: () => api.get('/stock/alerts'),
  profitBreakdown: (by, start, end, page = 1) => api.get('/analytics/profit-breakdown', { params: { by, start, end, page, page_size: 10 } }),
  coreByCustomer: (page = 1) => api.get('/analytics/core-weight', { params: { group: 'customer', page, page_size: 15 } }),
};

export default api;
