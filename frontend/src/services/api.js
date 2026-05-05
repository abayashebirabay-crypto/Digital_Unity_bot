import axios from 'axios';

// Use the current window's origin (works for localhost and ngrok)
const API_BASE_URL = process.env.REACT_APP_API_URL || window.location.origin;
console.log('API Base URL:', API_BASE_URL);

const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
    'ngrok-skip-browser-warning': 'true',
  },
  timeout: 30000, // 30 second timeout
});

// Request interceptor for debugging
api.interceptors.request.use(
  (config) => {
    console.log(`📤 ${config.method?.toUpperCase()} ${config.url}`);
    return config;
  },
  (error) => {
    console.error('Request error:', error);
    return Promise.reject(error);
  }
);

// Response interceptor for debugging
api.interceptors.response.use(
  (response) => {
    console.log(`📥 ${response.status} ${response.config.url}`);
    return response;
  },
  (error) => {
    console.error('Response error:', error.response?.status, error.config?.url, error.message);
    return Promise.reject(error);
  }
);

// For file uploads (multipart/form-data)
export const uploadPayment = (formData) => {
  return axios.post(`${API_BASE_URL}/api/submit-payment-web`, formData, {
    headers: {
      'Content-Type': 'multipart/form-data',
      'ngrok-skip-browser-warning': 'true',
    },
  });
};

// API endpoints
export const getUserDashboard = (userId) => api.get(`/api/bootstrap/${userId}`);
export const getLuckyNumbers = (userId, page = 1, pageSize = 16, q = '') => 
  api.get(`/api/lucky-numbers?telegram_id=${userId}&page=${page}&page_size=${pageSize}&q=${q}`);
export const selectNumber = (userId, number) => 
  api.post('/api/select-number', { user_id: userId, number });
export const getWinners = () => api.get('/api/winners');
export const getAnnouncements = () => api.get('/api/announcements');
export const getReferralStats = (userId) => api.get(`/api/referral/${userId}`);
export const getReferralLeaderboard = () => api.get('/api/referral-leaderboard');
export const getGameConfig = () => api.get('/api/game/config');
export const getWallet = (userId) => api.get(`/api/wallet/${userId}`);
export const requestWithdrawal = (telegramId, amount = 100) =>
  api.post('/api/withdraw', { telegram_id: telegramId, amount });
export const claimChannelBonus = (telegramId) =>
  api.post('/api/channel_bonus', { telegram_id: telegramId });

export default api;