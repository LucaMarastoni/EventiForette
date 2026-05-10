const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3001';
const STATIC_MODE = import.meta.env.VITE_STATIC_MODE === 'true';
const EVENTS_KEY = 'eventi-forette-static-events';
const LEADERBOARD_KEY = 'eventi-forette-static-leaderboard';

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

function isoDate(offsetDays) {
  const date = new Date();
  date.setDate(date.getDate() + offsetDays);
  return date.toISOString().slice(0, 10);
}

function getWeekRef(date = new Date()) {
  const current = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const day = current.getUTCDay() || 7;
  current.setUTCDate(current.getUTCDate() + 4 - day);
  const yearStart = new Date(Date.UTC(current.getUTCFullYear(), 0, 1));
  const weekNo = Math.ceil(((current - yearStart) / 86400000 + 1) / 7);
  return `${current.getUTCFullYear()}-W${String(weekNo).padStart(2, '0')}`;
}

function readJson(key, fallback) {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : fallback;
  } catch {
    return fallback;
  }
}

function writeJson(key, value) {
  localStorage.setItem(key, JSON.stringify(value));
}

function initialEvents() {
  return [
    {
      id: 1,
      title: 'Aperitivo in piazza',
      description:
        'Musica, tavoli condivisi e un aperitivo informale per ritrovarsi nel cuore di Forette.',
      date: isoDate(6),
      time: '19:00',
      location: 'Piazza centrale, Forette',
      image:
        'https://images.unsplash.com/photo-1519671482749-fd09be7ccebf?auto=format&fit=crop&w=1200&q=80',
      participants: 28,
      category: 'Sociale'
    },
    {
      id: 2,
      title: 'Torneo arcade e giochi',
      description:
        'Una serata per ragazzi e famiglie con sfide arcade, giochi da tavolo e classifica finale.',
      date: isoDate(13),
      time: '20:30',
      location: 'Sala civica di Forette',
      image:
        'https://images.unsplash.com/photo-1550745165-9bc0b252726f?auto=format&fit=crop&w=1200&q=80',
      participants: 41,
      category: 'Giovani'
    },
    {
      id: 3,
      title: 'Laboratorio creativo famiglie',
      description:
        'Attivita manuali, colori e piccoli progetti creativi per bambini, genitori e nonni.',
      date: isoDate(20),
      time: '16:00',
      location: 'Parco comunale',
      image:
        'https://images.unsplash.com/photo-1491438590914-bc09fcaaf77a?auto=format&fit=crop&w=1200&q=80',
      participants: 17,
      category: 'Famiglie'
    }
  ];
}

function getStoredEvents() {
  const events = readJson(EVENTS_KEY, null);
  if (events) return events;
  const seeded = initialEvents();
  writeJson(EVENTS_KEY, seeded);
  return seeded;
}

function saveStoredEvents(events) {
  const sorted = [...events].sort((a, b) => `${a.date} ${a.time}`.localeCompare(`${b.date} ${b.time}`));
  writeJson(EVENTS_KEY, sorted);
  return sorted;
}

function normalizeEvent(event, id) {
  return {
    id,
    title: String(event.title || '').trim(),
    description: String(event.description || '').trim(),
    date: event.date,
    time: event.time,
    location: String(event.location || '').trim(),
    image: event.image?.trim() || null,
    participants: Number(event.participants || 0),
    category: event.category?.trim() || null
  };
}

function validateEvent(event) {
  const required = ['title', 'description', 'date', 'time', 'location'];
  const missing = required.filter((field) => !String(event[field] || '').trim());
  if (missing.length > 0) {
    throw new Error(`Campi obbligatori mancanti: ${missing.join(', ')}`);
  }
}

const staticApi = {
  async getEvents() {
    return getStoredEvents();
  },
  async createEvent(event) {
    validateEvent(event);
    const events = getStoredEvents();
    const id = events.reduce((max, item) => Math.max(max, item.id), 0) + 1;
    const nextEvent = normalizeEvent(event, id);
    saveStoredEvents([...events, nextEvent]);
    return nextEvent;
  },
  async updateEvent(id, event) {
    validateEvent(event);
    const events = getStoredEvents();
    const numericId = Number(id);
    const index = events.findIndex((item) => item.id === numericId);
    if (index === -1) throw new Error('Evento non trovato');
    const nextEvent = normalizeEvent(event, numericId);
    const nextEvents = [...events];
    nextEvents[index] = nextEvent;
    saveStoredEvents(nextEvents);
    return nextEvent;
  },
  async deleteEvent(id) {
    saveStoredEvents(getStoredEvents().filter((event) => event.id !== Number(id)));
    return null;
  },
  async attendEvent(id) {
    const numericId = Number(id);
    const events = getStoredEvents();
    const nextEvents = events.map((event) =>
      event.id === numericId ? { ...event, participants: event.participants + 1 } : event
    );
    saveStoredEvents(nextEvents);
    const updated = nextEvents.find((event) => event.id === numericId);
    if (!updated) throw new Error('Evento non trovato');
    return updated;
  },
  async loginAdmin(credentials) {
    if (credentials.username === 'admin' && credentials.password === 'admin') {
      return { token: 'static-admin-token', username: 'admin' };
    }
    throw new Error('Credenziali non valide');
  },
  async getLeaderboard() {
    const weekRef = getWeekRef();
    const scores = readJson(LEADERBOARD_KEY, [])
      .filter((entry) => entry.week_ref === weekRef)
      .sort((a, b) => b.score - a.score || a.played_at.localeCompare(b.played_at))
      .slice(0, 20);
    return { weekRef, scores };
  },
  async saveScore(entry) {
    const playerName = String(entry.playerName || '').trim().slice(0, 40);
    const score = Number(entry.score);
    if (!playerName || !Number.isInteger(score) || score < 0) {
      throw new Error('Nome giocatore o punteggio non valido');
    }
    const scores = readJson(LEADERBOARD_KEY, []);
    const saved = {
      id: Date.now(),
      player_name: playerName,
      score,
      played_at: new Date().toISOString(),
      week_ref: getWeekRef()
    };
    writeJson(LEADERBOARD_KEY, [...scores, saved]);
    return saved;
  }
};

const serverApi = {
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

export const api = STATIC_MODE ? staticApi : serverApi;
export const isStaticMode = STATIC_MODE;
