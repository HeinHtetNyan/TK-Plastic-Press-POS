import axios from 'axios';

// This logic ensures it works on Localhost, Local IP (WiFi), and Cloudflare Tunnel URL
const getBaseURL = () => {
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

export const customerService = {
  create: (data) => api.post('/customers/', data),
  list: () => api.get('/customers/'),
  search: (name) => api.get(`/customers/search?name=${name}`),
  getBalance: (id) => api.get(`/customers/${id}/balance`),
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

export default api;
