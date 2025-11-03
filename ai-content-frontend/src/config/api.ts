// API Configuration
export const API_BASE_URL = import.meta.env.VITE_API_URL || 'https://vibecraft-backend-1nbt.onrender.com';

export const API_ENDPOINTS = {
  // Auth endpoints
  LOGIN: '/auth/login',
  SIGNUP: '/auth/signup',
  LOGOUT: '/auth/logout',
  
  // Content endpoints
  GENERATE: '/content/generate',
  SAVE: '/content/save',
  LIST: '/content/dashboard',
  GET_CONTENT: '/content',
  HISTORY: '/content/history',
  // use RESTful delete: DELETE /content/:id
  DELETE: '/content',
  
  // User endpoints
  PREFERENCES: '/user/preferences',
  UPDATE_PREFERENCES: '/user/preferences/update',
  
  // LinkedIn endpoints
  LINKEDIN_AUTH_URL: '/linkedin/auth-url',
  LINKEDIN_CALLBACK: '/linkedin/callback',
  LINKEDIN_STATUS: '/linkedin/status',
  LINKEDIN_DISCONNECT: '/linkedin/disconnect',
  LINKEDIN_POST: '/linkedin/post',
};
