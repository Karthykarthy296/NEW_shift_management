/**
 * PRODUCTION READY API SERVICE
 * Enterprise-grade error handling for React frontend
 */

import axios from 'axios';

// Configuration for different environments
const API_CONFIG = {
  development: {
    baseURL: import.meta.env.VITE_API_URL ,
    timeout: 30000,
  },
  production: {
    baseURL: import.meta.env.VITE_API_URL ,
    timeout: 30000,
  }
};

const config = API_CONFIG[process.env.NODE_ENV] || API_CONFIG.development;

// Create axios instance with production configuration
const api = axios.create({
  baseURL: config.baseURL,
  timeout: config.timeout,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Request interceptor for logging and auth
api.interceptors.request.use(
  (config) => {
    console.log(`🚀 API Request: ${config.method?.toUpperCase()} ${config.url}`);

    // Add auth token if available
    const token = localStorage.getItem('authToken') || localStorage.getItem('token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }

    return config;
  },
  (error) => {
    console.error('❌ Request Error:', error);
    return Promise.reject(error);
  }
);

// Response interceptor for comprehensive error handling
api.interceptors.response.use(
  (response) => {
    console.log(`✅ API Response: ${response.config.method?.toUpperCase()} ${response.config.url} - Status: ${response.status}`);
    return response;
  },
  (error) => {
    console.error('❌ API Error:', error);

    // Handle different error types
    if (error.response) {
      // Server responded with error status
      const { status, data } = error.response;

      console.error(`Server Error ${status}:`, data);

      // Specific handling for common errors
      switch (status) {
        case 400:
          error.message = data?.error || data?.detail || 'Bad Request';
          break;
        case 401:
          error.message = 'Authentication required';
          // Clear invalid token
          localStorage.removeItem('authToken');
          // Redirect to login if needed
          window.location.href = '/login';
          break;
        case 403:
          error.message = 'Access denied';
          break;
        case 404:
          error.message = 'Resource not found';
          break;
        case 422:
          error.message = 'Validation error: ' + (data?.detail || 'Invalid data');
          break;
        case 500:
          error.message = 'Server error. Please try again later.';
          break;
        default:
          error.message = data?.error || data?.detail || `Server error ${status}`;
      }

      // Add server error details to error object
      error.serverError = data;

    } else if (error.request) {
      // Network error (no response received)
      console.error('Network Error:', error.request);

      if (error.code === 'ECONNABORTED') {
        error.message = 'Request timeout. Please check your connection.';
      } else if (error.message.includes('Network Error')) {
        error.message = 'Network error. Please check your internet connection.';
      } else {
        error.message = 'Unable to connect to server. Please try again.';
      }

    } else {
      // Other error (request setup)
      console.error('Request Setup Error:', error.message);
      error.message = 'Request setup error';
    }

    return Promise.reject(error);
  }
);

// Production-ready API service functions
export const apiService = {
  // Generic request method
  async request(method, url, data = null, config = {}) {
    try {
      const response = await api({
        method,
        url,
        data,
        ...config
      });
      return response.data;
    } catch (error) {
      console.error(`API ${method.toUpperCase()} ${url} failed:`, error);
      throw error;
    }
  },

  // GET request
  async get(url, config = {}) {
    return this.request('GET', url, null, config);
  },

  // POST request
  async post(url, data = null, config = {}) {
    return this.request('POST', url, data, config);
  },

  // PUT request
  async put(url, data = null, config = {}) {
    return this.request('PUT', url, data, config);
  },

  // DELETE request
  async delete(url, config = {}) {
    return this.request('DELETE', url, null, config);
  },

  // Dashboard API
  async getDashboardSummary() {
    try {
      const response = await this.get('/dashboard-summary');
      return {
        success: true,
        data: response,
        error: null
      };
    } catch (error) {
      return {
        success: false,
        data: null,
        error: {
          message: error.message,
          details: error.serverError || error,
          code: error.response?.status
        }
      };
    }
  },

  // Schedule API
  async getSchedule(date = null) {
    try {
      const url = date ? `/get-schedule?date=${date}` : '/get-schedule';
      const response = await this.get(url);
      return {
        success: true,
        data: response,
        error: null
      };
    } catch (error) {
      return {
        success: false,
        data: null,
        error: {
          message: error.message,
          details: error.serverError || error,
          code: error.response?.status
        }
      };
    }
  },

  async generateSchedule(date) {
    try {
      const response = await this.post('/generate-schedule', { date });
      return {
        success: true,
        data: response,
        error: null
      };
    } catch (error) {
      return {
        success: false,
        data: null,
        error: {
          message: error.message,
          details: error.serverError || error,
          code: error.response?.status
        }
      };
    }
  },

  // Employees API
  async getEmployees() {
    try {
      const response = await this.get('/employees');
      return {
        success: true,
        data: response,
        error: null
      };
    } catch (error) {
      return {
        success: false,
        data: null,
        error: {
          message: error.message,
          details: error.serverError || error,
          code: error.response?.status
        }
      };
    }
  },

  // Overtime API
  async calculateOvertime(employeeId, date, overtimeHours) {
    try {
      const response = await this.post('/overtime/calculate', {
        employee_id: employeeId,
        date,
        overtime_hours: overtimeHours
      });
      return {
        success: true,
        data: response,
        error: null
      };
    } catch (error) {
      return {
        success: false,
        data: null,
        error: {
          message: error.message,
          details: error.serverError || error,
          code: error.response?.status
        }
      };
    }
  },

  // Weekly Off Swap API
  async requestWeeklyOffSwap(employee1Name, employee2Name, targetOffDay) {
    try {
      const response = await this.post('/request-weekly-off-swap', {
        employee_1_name: employee1Name,
        employee_2_name: employee2Name,
        target_off_day: targetOffDay
      });
      return {
        success: true,
        data: response,
        error: null
      };
    } catch (error) {
      return {
        success: false,
        data: null,
        error: {
          message: error.message,
          details: error.serverError || error,
          code: error.response?.status
        }
      };
    }
  },

  async approveWeeklyOffSwap(swapId, approve, reason = null, approverId = 1) {
    try {
      const response = await this.post('/approve-weekly-off-swap', {
        swap_id: swapId,
        approve,
        reason,
        approver_id: approverId
      });
      return {
        success: true,
        data: response,
        error: null
      };
    } catch (error) {
      return {
        success: false,
        data: null,
        error: {
          message: error.message,
          details: error.serverError || error,
          code: error.response?.status
        }
      };
    }
  },

  // Health check
  async healthCheck() {
    try {
      const response = await this.get('/');
      return {
        success: true,
        data: response,
        error: null
      };
    } catch (error) {
      return {
        success: false,
        data: null,
        error: {
          message: error.message,
          details: error.serverError || error,
          code: error.response?.status
        }
      };
    }
  }
};

export default api;
