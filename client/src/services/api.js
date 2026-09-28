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

// Normalize error responses so callers can read `error.message`, `error.code`, and `error.model`
api.interceptors.response.use(
  (response) => response,
  (error) => {
    const data = error.response?.data;
    let message = data?.message || error.message || 'Something went wrong. Please try again.';

    // Sanitize any raw API keys or internal urls from client-facing messages
    if (typeof message === 'string') {
      message = message
        .replace(/key=[a-zA-Z0-9_\-]+/gi, 'key=[REDACTED]')
        .replace(/AIza[a-zA-Z0-9_\-]{35}/g, '[REDACTED_API_KEY]')
        .replace(/models\/[a-zA-Z0-9_\-\.]+/gi, 'configured Gemini model');
    }

    const code =
      data?.code ||
      (error.response?.status === 503 ||
      (typeof message === 'string' &&
        (message.toLowerCase().includes('high demand') ||
          message.toLowerCase().includes('temporarily busy') ||
          message.toLowerCase().includes('temporarily unavailable') ||
          message.toLowerCase().includes('capacity') ||
          message.toLowerCase().includes('overloaded')))
        ? 'AI_PROVIDER_TEMPORARILY_UNAVAILABLE'
        : error.response?.status === 429
        ? 'AI_QUOTA_EXCEEDED'
        : error.response?.status === 404
        ? 'AI_MODEL_UNAVAILABLE'
        : undefined);

    if (code === 'AI_PROVIDER_TEMPORARILY_UNAVAILABLE' || error.response?.status === 503) {
      message = 'AI service is temporarily busy. Please try again in a few moments.';
    }

    const model = data?.model;
    const details = data?.details;

    return Promise.reject({
      ...error,
      message,
      code,
      model,
      details,
      statusCode: error.response?.status,
    });
  }
);

export default api;
