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
});

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

export default api;