import axios from 'axios';

const baseURL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:5000/api';

const api = axios.create({
  baseURL,
  withCredentials: true, // send httpOnly auth cookie
  headers: {
    'Content-Type': 'application/json',
  },
});

// Attach Bearer token from localStorage as a fallback to the cookie
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('devplatform_token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Normalize error responses so callers can just read `error.message`
api.interceptors.response.use(
  (response) => response,
  (error) => {
    const message =
      error.response?.data?.message || error.message || 'Something went wrong. Please try again.';
    return Promise.reject({ ...error, message });
  }
);

export default api;
