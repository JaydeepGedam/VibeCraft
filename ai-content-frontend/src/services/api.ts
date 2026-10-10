import { API_BASE_URL, API_ENDPOINTS } from '@/config/api';

// Helper function to get auth token
const getAuthToken = () => {
  return localStorage.getItem('authToken');
};

// Helper function to make API calls
const apiCall = async (endpoint: string, options: RequestInit = {}) => {
  const token = getAuthToken();
  
  const headers: HeadersInit = {
    ...options.headers,
  };
  // Only set Content-Type for requests that send a JSON body
  const hasBody = typeof (options as any).body !== 'undefined' && (options as any).body !== null;
  if (hasBody && !('Content-Type' in headers)) {
    (headers as any)['Content-Type'] = 'application/json';
  }
  
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
    if (response.status === 401) {
      localStorage.removeItem('authToken');
      localStorage.removeItem('userName');
      localStorage.removeItem('isAuthenticated');
      if (typeof window !== 'undefined' && !window.location.pathname.includes('/login') && !window.location.pathname.includes('/signup')) {
        window.location.href = '/login';
      }
    }
    // Try to parse JSON error body and pick a helpful field
    const errorBody = await response.json().catch(() => ({}));
    const msg = (errorBody && (errorBody.message || errorBody.error || errorBody.msg)) || 'Request failed';
    const err = new Error(msg);
    (err as any).status = response.status;
    (err as any).data = errorBody;
    throw err;
  }

  // Safely handle empty or 204 responses
  if (response.status === 204) return {};
  const contentLength = response.headers.get('content-length');
  if (contentLength === '0') return {};
  // Some servers omit content-length but return empty body; guard with text peek
  const text = await response.text();
  if (!text) return {};
  return JSON.parse(text);
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

// Quota Info interface
export interface QuotaInfo {
  generationsUsed: number;
  freeGenerationLimit: number;
  hasCustomKey: boolean;
  remaining: number;
}

// Content API
export const contentAPI = {
  generate: async (params: {
    topic: string;
    contentType: string;
    goal: string;
    tone: string;
    mood: number;
    audience?: string;
    instructions?: string;
    count?: number;
  }) => {
    const payload = {
      topic: params.topic,
      type: params.contentType,
      goal: params.goal,
      tone: params.tone,
      mood: params.mood,
      audience: params.audience,
      instructions: params.instructions,
      count: params.count || 1,
    };
    return apiCall(API_ENDPOINTS.GENERATE, {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  },

  generateStream: async (
    params: {
      topic: string;
      contentType: string;
      goal: string;
      tone: string;
      mood: number;
      audience?: string;
      instructions?: string;
    },
    onChunk: (text: string) => void,
    signal?: AbortSignal,
    onQuota?: (quota: any) => void
  ) => {
    const token = getAuthToken();
    const payload = {
      topic: params.topic,
      type: params.contentType,
      goal: params.goal,
      tone: params.tone,
      mood: params.mood,
      audience: params.audience,
      instructions: params.instructions,
    };
    const response = await fetch(`${API_BASE_URL}${API_ENDPOINTS.GENERATE_STREAM}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: JSON.stringify(payload),
      signal,
    });

    if (!response.ok) {
      if (response.status === 401) {
        localStorage.removeItem('authToken');
        localStorage.removeItem('userName');
        localStorage.removeItem('isAuthenticated');
        if (typeof window !== 'undefined' && !window.location.pathname.includes('/login') && !window.location.pathname.includes('/signup')) {
          window.location.href = '/login';
        }
      }
      const errBody = await response.json().catch(() => ({}));
      const err = new Error(errBody.message || errBody.error || 'Streaming request failed');
      (err as any).status = response.status;
      (err as any).data = errBody;
      throw err;
    }

    const reader = response.body?.getReader();
    if (!reader) throw new Error('Streaming not supported in browser');
    const decoder = new TextDecoder();
    let accumulated = '';

    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      if (value) {
        const chunk = decoder.decode(value, { stream: true });
        const lines = chunk.split('\n');
        for (const line of lines) {
          if (line.startsWith('data: ')) {
            const dataStr = line.replace('data: ', '').trim();
            if (dataStr === '[DONE]') {
              return accumulated;
            }
            try {
              const parsed = JSON.parse(dataStr);
              if (parsed.text) {
                accumulated += parsed.text;
                onChunk(parsed.text);
              }
              if (parsed.quota && onQuota) {
                onQuota(parsed.quota);
              }
            } catch (e) {
              // Ignore incomplete chunks
            }
          }
        }
      }
    }
    return accumulated;
  },

  refine: async (params: {
    content: string;
    action: string;
    instruction?: string;
  }) => {
    return apiCall(API_ENDPOINTS.REFINE, {
      method: 'POST',
      body: JSON.stringify(params),
    });
  },

  toggleFavorite: async (id: string) => {
    return apiCall(`${API_ENDPOINTS.FAVORITE}/${id}/favorite`, {
      method: 'PATCH',
    });
  },

  markPublished: async (id: string, platform = 'LinkedIn') => {
    return apiCall(`/content/${id}/published`, {
      method: 'PATCH',
      body: JSON.stringify({ platform }),
    });
  },
  
  save: async (content: {
    topic: string;
    contentType: string;
    goal: string;
    tone: string;
    mood: number;
    audience?: string;
    instructions?: string;
    generatedText: string;
    isFavorite?: boolean;
    isPublished?: boolean;
    publishedPlatform?: string;
  }) => {
    const payload = {
      topic: content.topic,
      type: content.contentType,
      goal: content.goal,
      tone: content.tone,
      mood: content.mood,
      audience: content.audience,
      instructions: content.instructions,
      content: content.generatedText,
      is_favorite: content.isFavorite || false,
      is_published: content.isPublished || false,
      published_platform: content.publishedPlatform || '',
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
    if (Array.isArray(data)) {
      const mapped = data.map((item: any) => ({
        _id: item._id,
        topic: item.topic || item.name || "",
        contentType: item.type || item.contentType || "",
        goal: item.goal || "",
        tone: item.tone || "",
        generatedText: item.generatedText || item.content || "",
        createdAt: item.createdAt || item.created_at || item.created || "",
        mood: item.mood,
        audience: item.audience || "",
        instructions: item.instructions || "",
        isFavorite: !!item.is_favorite,
        isPublished: !!item.is_published,
        publishedAt: item.published_at || null,
        publishedPlatform: item.published_platform || "",
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
    defaultAudience?: string;
    customOpenAiKey?: string;
  }) => {
    return apiCall(API_ENDPOINTS.UPDATE_PREFERENCES, {
      method: 'PUT',
      body: JSON.stringify(preferences),
    });
  },
};

// LinkedIn API
export const linkedInAPI = {
  getAuthUrl: async (redirectTo = 'settings') => {
    return apiCall(`${API_ENDPOINTS.LINKEDIN_AUTH_URL}?redirect_to=${redirectTo}`, {
      method: 'GET',
    });
  },
  
  getStatus: async () => {
    return apiCall(API_ENDPOINTS.LINKEDIN_STATUS, {
      method: 'GET',
    });
  },
  
  disconnect: async () => {
    return apiCall(API_ENDPOINTS.LINKEDIN_DISCONNECT, {
      method: 'DELETE',
    });
  },
  
  post: async (content: string) => {
    return apiCall(API_ENDPOINTS.LINKEDIN_POST, {
      method: 'POST',
      body: JSON.stringify({ content }),
    });
  },
};