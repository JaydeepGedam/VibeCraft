// API Configuration
export const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000';

export const API_ENDPOINTS = {
  // Auth endpoints
  LOGIN: '/auth/login',
  SIGNUP: '/auth/signup',
  LOGOUT: '/auth/logout',
  
  // Content endpoints
  GENERATE: '/content/generate',
  SAVE: '/content/save',
  LIST: '/content/dashboard',
  // use RESTful delete: DELETE /content/:id
  DELETE: '/content',
  
  // User endpoints
  PREFERENCES: '/user/preferences',
  UPDATE_PREFERENCES: '/user/preferences/update',
};
