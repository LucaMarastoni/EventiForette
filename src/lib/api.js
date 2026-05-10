const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3001';

async function request(path, options = {}) {
  const response = await fetch(`${API_BASE_URL}${path}`, {
    headers: {
      'Content-Type': 'application/json',
      ...options.headers
    },
    ...options
  });

  if (!response.ok) {
    const payload = await response.json().catch(() => ({}));
    throw new Error(payload.error || 'Errore di comunicazione con il server');
  }

  if (response.status === 204) return null;
  return response.json();
}

export const api = {
  getEvents: () => request('/api/events'),
  createEvent: (event) => request('/api/events', { method: 'POST', body: JSON.stringify(event) }),
  updateEvent: (id, event) =>
    request(`/api/events/${id}`, { method: 'PUT', body: JSON.stringify(event) }),
  deleteEvent: (id) => request(`/api/events/${id}`, { method: 'DELETE' }),
  attendEvent: (id) => request(`/api/events/${id}/attend`, { method: 'POST' }),
  loginAdmin: (credentials) =>
    request('/api/admin/login', { method: 'POST', body: JSON.stringify(credentials) }),
  getLeaderboard: () => request('/api/leaderboard'),
  saveScore: (entry) =>
    request('/api/leaderboard', { method: 'POST', body: JSON.stringify(entry) })
};
