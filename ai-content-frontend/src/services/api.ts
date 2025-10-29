import { API_BASE_URL, API_ENDPOINTS } from '@/config/api';

// Helper function to get auth token
const getAuthToken = () => {
  return localStorage.getItem('authToken');
};

// Helper function to make API calls
const apiCall = async (endpoint: string, options: RequestInit = {}) => {
  const token = getAuthToken();
  
  const headers: HeadersInit = {
    'Content-Type': 'application/json',
    ...options.headers,
  };
  
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }
  // ensure GET requests do not use browser cache which can return 304
  const method = (options.method || 'GET').toString().toUpperCase();
  const fetchOptions: RequestInit = {
    ...options,
    headers,
    // prevent cached GET responses
    ...(method === 'GET' ? { cache: 'no-store' } : {}),
  };

  const response = await fetch(`${API_BASE_URL}${endpoint}`, fetchOptions);
  
  if (!response.ok) {
    // Try to parse JSON error body and pick a helpful field
    const errorBody = await response.json().catch(() => ({}));
    const msg = (errorBody && (errorBody.message || errorBody.error || errorBody.msg)) || 'Request failed';
    throw new Error(msg);
  }

  return response.json();
};

// Auth API
export const authAPI = {
  login: async (email: string, password: string) => {
    return apiCall(API_ENDPOINTS.LOGIN, {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    });
  },
  
  signup: async (name: string, email: string, password: string) => {
    return apiCall(API_ENDPOINTS.SIGNUP, {
      method: 'POST',
      body: JSON.stringify({ name, email, password }),
    });
  },
  
  logout: async () => {
    return apiCall(API_ENDPOINTS.LOGOUT, {
      method: 'POST',
    });
  },
};

// Content API
export const contentAPI = {
  generate: async (params: {
    topic: string;
    contentType: string;
    goal: string;
    tone: string;
    mood: number;
  }) => {
    return apiCall(API_ENDPOINTS.GENERATE, {
      method: 'POST',
      body: JSON.stringify(params),
    });
  },
  
  save: async (content: {
    topic: string;
    contentType: string;
    goal: string;
    tone: string;
    mood: number;
    generatedText: string;
  }) => {
    // Map frontend field names to the backend expectations:
    // backend expects `type` and `content` keys.
    const payload = {
      topic: content.topic,
      type: content.contentType, // backend uses `type`
      goal: content.goal,
      tone: content.tone,
      mood: content.mood,
      content: content.generatedText, // backend uses `content`
    };

    return apiCall(API_ENDPOINTS.SAVE, {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  },
  
  list: async () => {
    const data = await apiCall(API_ENDPOINTS.LIST, {
      method: 'GET',
    });
    // backend returns an array for the dashboard; normalize to { contents }
    // Map backend fields to frontend shape so UI doesn't need to know backend naming
    if (Array.isArray(data)) {
      const mapped = data.map((item: any) => ({
        _id: item._id,
        topic: item.topic || item.name || "",
        // backend uses `type` and `content` and `created_at`
        contentType: item.type || item.contentType || "",
        goal: item.goal || "",
        tone: item.tone || "",
        // frontend expects `generatedText`
        generatedText: item.generatedText || item.content || "",
        // frontend expects `createdAt`
        createdAt: item.createdAt || item.created_at || item.created || "",
        mood: item.mood,
        user_id: item.user_id,
      }));
      return { contents: mapped };
    }
    return data;
  },
  get: async (id: string) => {
    return apiCall(`${API_ENDPOINTS.GET_CONTENT}/${id}`, {
      method: 'GET',
    });
  },
  // History APIs
  historyList: async () => {
    return apiCall(API_ENDPOINTS.HISTORY, { method: 'GET' });
  },
  historySave: async (payload: { topic: string; contentType: string; goal: string; tone: string; mood: number; generatedText: string; original_content_id?: string }) => {
    const body = {
      topic: payload.topic,
      type: payload.contentType,
      goal: payload.goal,
      tone: payload.tone,
      mood: payload.mood,
      content: payload.generatedText,
      original_content_id: payload.original_content_id,
    };
    return apiCall(API_ENDPOINTS.HISTORY, { method: 'POST', body: JSON.stringify(body) });
  },
  historyDelete: async (id: string) => {
    return apiCall(`${API_ENDPOINTS.HISTORY}/${id}`, { method: 'DELETE' });
  },
  
  delete: async (id: string) => {
    // Call DELETE /content/:id
    return apiCall(`${API_ENDPOINTS.DELETE}/${id}`, {
      method: 'DELETE',
    });
  },
};

// User API
export const userAPI = {
  getPreferences: async () => {
    return apiCall(API_ENDPOINTS.PREFERENCES, {
      method: 'GET',
    });
  },
  
  updatePreferences: async (preferences: {
    defaultTone?: string;
    defaultContentType?: string;
    defaultGoal?: string;
  }) => {
    return apiCall(API_ENDPOINTS.UPDATE_PREFERENCES, {
      method: 'PUT',
      body: JSON.stringify(preferences),
    });
  },
};
