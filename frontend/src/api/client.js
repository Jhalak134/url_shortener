import axios from 'axios';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000';

const client = axios.create({
  baseURL:         API_BASE_URL,
  withCredentials: true, // Always send the session cookie cross-origin
  headers: {
    'Content-Type': 'application/json',
  },
});

// ── Response interceptor ──────────────────────────────────────────────────────
// On a 401, redirect to /login unless we're already there.
// This handles expired sessions transparently across all API calls.
client.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      if (window.location.pathname !== '/login') {
        window.location.href = '/login';
      }
    }
    return Promise.reject(error);
  }
);

// ── Auth ──────────────────────────────────────────────────────────────────────
export const authAPI = {
  /**
   * GET /api/auth/me
   * Returns { isAuthenticated: bool, user: { id, email, display_name, profile_image_url } }
   * Called on every page load to rehydrate auth state from the session cookie.
   */
  me: () => client.get('/api/auth/me'),

  /**
   * Initiates the Google OAuth flow.
   * This is a full browser redirect (not an XHR) because the OAuth handshake
   * involves multiple server ↔ Google ↔ browser round-trips with cookies and redirects.
   */
  loginWithGoogle: () => {
    window.location.href = `${API_BASE_URL}/api/auth/google`;
  },

  /**
   * POST /api/auth/logout
   * Destroys the server-side session and clears the cookie.
   * Using POST (not GET) to prevent CSRF logout attacks.
   */
  logout: () => client.post('/api/auth/logout'),
};

// ── Links ─────────────────────────────────────────────────────────────────────
export const linksAPI = {
  /** POST /api/links — create a new short link */
  create: (originalUrl) => client.post('/api/links', { originalUrl }),
  /** GET  /api/links — fetch all links owned by the authenticated user */
  getAll: () => client.get('/api/links'),
};

// ── Analytics ─────────────────────────────────────────────────────────────────
export const analyticsAPI = {
  /** GET /api/analytics/:shortCode — detailed click breakdown for one link */
  getByCode: (shortCode) => client.get(`/api/analytics/${shortCode}`),
};

export default client;
