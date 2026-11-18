// ==============================================================================
// Codest API Service Layer
// Connects to the Express & PostgreSQL backend API on http://127.0.0.1:5001/api
// ==============================================================================

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:5001/api';

// Helper to get stored auth token
function getAuthHeader() {
  const token = localStorage.getItem('codest_token');
  return token ? { Authorization: `Bearer ${token}` } : {};
}

// ------------------------------------------------------------------------------
// Authentication API
// ------------------------------------------------------------------------------
export const authApi = {
  async register(username, email, password) {
    const response = await fetch(`${API_BASE_URL}/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, email, password }),
    });
    const data = await response.json();
    if (!response.ok) {
      throw new Error(data.message || 'Registration failed');
    }
    return data;
  },

  async login(usernameOrEmail, password) {
    const response = await fetch(`${API_BASE_URL}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ usernameOrEmail, password }),
    });
    const data = await response.json();
    if (!response.ok) {
      throw new Error(data.message || 'Login failed');
    }
    return data;
  },

  async getMe() {
    const token = localStorage.getItem('codest_token');
    if (!token) return { success: false, user: null };

    const response = await fetch(`${API_BASE_URL}/auth/me`, {
      headers: { ...getAuthHeader() },
    });
    const data = await response.json();
    if (!response.ok) {
      throw new Error(data.message || 'Session expired');
    }
    return data;
  },

  logout() {
    localStorage.removeItem('codest_token');
  },
};

// ------------------------------------------------------------------------------
// Room API
// ------------------------------------------------------------------------------
export const roomApi = {
  async createRoom() {
    const response = await fetch(`${API_BASE_URL}/rooms`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...getAuthHeader() },
    });
    const data = await response.json();
    if (!response.ok) {
      throw new Error(data.message || 'Could not create room');
    }
    return data;
  },

  async joinRoom(code) {
    const cleanCode = code.trim().toUpperCase();
    const response = await fetch(`${API_BASE_URL}/rooms/join`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...getAuthHeader() },
      body: JSON.stringify({ code: cleanCode }),
    });
    const data = await response.json();
    if (!response.ok) {
      throw new Error(data.message || 'Could not join room');
    }
    return data;
  },

  async getRoom(code) {
    const cleanCode = code.trim().toUpperCase();
    const response = await fetch(`${API_BASE_URL}/rooms/${cleanCode}`, {
      headers: { ...getAuthHeader() },
    });
    const data = await response.json();
    if (!response.ok) {
      throw new Error(data.message || 'Could not fetch room');
    }
    return data;
  },

  async getMyRooms() {
    const response = await fetch(`${API_BASE_URL}/rooms/my-rooms`, {
      headers: { ...getAuthHeader() },
    });
    const data = await response.json();
    if (!response.ok) {
      throw new Error(data.message || 'Could not fetch rooms');
    }
    return data;
  },
};

// ------------------------------------------------------------------------------
// Submissions API
// ------------------------------------------------------------------------------
export const submissionApi = {
  async submit(roomId, sourceCode) {
    const response = await fetch(`${API_BASE_URL}/rooms/${roomId}/submissions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...getAuthHeader() },
      body: JSON.stringify({ sourceCode }),
    });
    const data = await response.json();
    if (!response.ok) {
      throw new Error(data.message || 'Submission failed');
    }
    return data;
  },

  async getMySubmissions(roomId) {
    const response = await fetch(`${API_BASE_URL}/rooms/${roomId}/my-submissions`, {
      headers: { ...getAuthHeader() },
    });
    const data = await response.json();
    if (!response.ok) {
      throw new Error(data.message || 'Could not fetch submissions');
    }
    return data;
  },
};
