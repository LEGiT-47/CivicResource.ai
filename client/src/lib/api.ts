import axios from 'axios';

// Create Centralized Axios instance
const api = axios.create({
  baseURL: 'http://localhost:5000/api', // Maps to backend port
  headers: {
    'Content-Type': 'application/json',
  },
});

// Request Interceptor: Attach JWT Token if stored
api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('CivicFlow_token');
    if (token && config.headers) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Response Interceptor: Handle 401s (Token expiration) globally
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response && error.response.status === 401) {
      localStorage.removeItem('CivicFlow_token');
      // Only redirect if we're not on the login/signup screens
      if (!window.location.pathname.match(/\/(login|signup)$/)) {
        window.location.href = '/login';
      }
    }
    return Promise.reject(error);
  }
);

export default api;
