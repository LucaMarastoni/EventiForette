const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3001';
const STATIC_MODE = import.meta.env.VITE_STATIC_MODE === 'true';
const EVENTS_KEY = 'eventi-forette-static-events';
const LEADERBOARD_KEY = 'eventi-forette-static-leaderboard';
const ARCADE_USERS_KEY = 'eventi-forette-static-users';
const ARCADE_ATTEMPTS_KEY = 'eventi-forette-static-attempts';
const ARCADE_MISSIONS_KEY = 'eventi-forette-static-missions';
const ARCADE_COUPONS_KEY = 'eventi-forette-static-coupons';

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

function weekExpiry(date = new Date()) {
  const expiry = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const day = expiry.getUTCDay() || 7;
  expiry.setUTCDate(expiry.getUTCDate() + (7 - day));
  expiry.setUTCHours(23, 59, 59, 999);
  return expiry.toISOString();
}

function levelForXp(xp) {
  if (xp >= 700) {
    return {
      name: 'Oro',
      minXp: 700,
      nextMinXp: null,
      benefits: ['Coupon premium', 'Priorita eventi', 'Vantaggi speciali']
    };
  }
  if (xp >= 250) {
    return {
      name: 'Argento',
      minXp: 250,
      nextMinXp: 700,
      benefits: ['Coupon migliori', 'Reward piu frequenti']
    };
  }
  return { name: 'Bronzo', minXp: 0, nextMinXp: 250, benefits: ['Accesso ai coupon base'] };
}

function missionTemplates(weekRef = getWeekRef()) {
  const expiresAt = weekExpiry();
  return [
    {
      mission_key: 'weekly_plays_3',
      title: 'Gioca 3 volte questa settimana',
      description: 'Salva tre partite arcade valide entro la fine della settimana.',
      target: 3,
      reward_xp: 90,
      reward_credit: 20,
      week_ref: weekRef,
      expires_at: expiresAt
    },
    {
      mission_key: 'weekly_score_1000',
      title: 'Raggiungi 1000 punti totali',
      description: 'Accumula 1000 punti nella classifica settimanale.',
      target: 1000,
      reward_xp: 180,
      reward_credit: 45,
      week_ref: weekRef,
      expires_at: expiresAt
    },
    {
      mission_key: 'weekly_challenge_1',
      title: 'Partecipa ad almeno una sfida arcade',
      description: 'Completa una partita e registra il punteggio nella sfida settimanale.',
      target: 1,
      reward_xp: 60,
      reward_credit: 15,
      week_ref: weekRef,
      expires_at: expiresAt
    }
  ];
}

function normalizePlayerName(value) {
  return String(value || '').trim().slice(0, 40);
}

function getOrCreateStaticUser(playerName) {
  const normalized = normalizePlayerName(playerName);
  if (!normalized) throw new Error('Nome giocatore richiesto');

  const users = readJson(ARCADE_USERS_KEY, []);
  const existing = users.find((user) => user.player_name.toLowerCase() === normalized.toLowerCase());
  if (existing) return existing;

  const user = {
    id: Date.now(),
    player_name: normalized,
    xp: 0,
    arcade_credit: 0,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString()
  };
  writeJson(ARCADE_USERS_KEY, [...users, user]);
  return user;
}

function ensureStaticMissions(userId) {
  const weekRef = getWeekRef();
  const missions = readJson(ARCADE_MISSIONS_KEY, []);
  const next = [...missions];
  for (const template of missionTemplates(weekRef)) {
    const exists = next.some(
      (mission) => mission.user_id === userId && mission.mission_key === template.mission_key && mission.week_ref === weekRef
    );
    if (!exists) {
      next.push({
        id: Date.now() + next.length,
        user_id: userId,
        current_progress: 0,
        completed: false,
        completed_at: null,
        ...template
      });
    }
  }
  writeJson(ARCADE_MISSIONS_KEY, next);
}

function couponValueForLevel(levelName, source) {
  if (source === 'level_gold') return 25;
  if (source === 'level_silver') return 18;
  if (levelName === 'Oro') return 20;
  if (levelName === 'Argento') return 15;
  return 10;
}

function createStaticCoupon(userId, source, levelName) {
  const coupon = {
    id: Date.now() + Math.floor(Math.random() * 1000),
    user_id: userId,
    code: `FORETTE-${source.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 8)}-${Math.random()
      .toString(36)
      .slice(2, 8)
      .toUpperCase()}`,
    discount_type: 'percent',
    discount_value: couponValueForLevel(levelName, source),
    status: 'unused',
    event_id: null,
    event_title: null,
    source,
    expires_at: new Date(Date.now() + 10 * 24 * 60 * 60 * 1000).toISOString(),
    created_at: new Date().toISOString(),
    used_at: null
  };
  writeJson(ARCADE_COUPONS_KEY, [...readJson(ARCADE_COUPONS_KEY, []), coupon]);
  return coupon;
}

function staticProfileFor(user, generatedCoupons = [], completedMissions = []) {
  ensureStaticMissions(user.id);
  const now = Date.now();
  const coupons = readJson(ARCADE_COUPONS_KEY, []).map((coupon) =>
    coupon.user_id === user.id && coupon.status === 'unused' && new Date(coupon.expires_at).getTime() < now
      ? { ...coupon, status: 'expired' }
      : coupon
  );
  writeJson(ARCADE_COUPONS_KEY, coupons);

  const level = levelForXp(user.xp);
  return {
    user: {
      id: user.id,
      playerName: user.player_name,
      xp: user.xp,
      arcadeCredit: user.arcade_credit,
      level,
      progressToNext: level.nextMinXp
        ? Math.min(100, Math.round(((user.xp - level.minXp) / (level.nextMinXp - level.minXp)) * 100))
        : 100
    },
    missions: readJson(ARCADE_MISSIONS_KEY, [])
      .filter((mission) => mission.user_id === user.id && mission.week_ref === getWeekRef())
      .sort((a, b) => a.id - b.id),
    coupons: coupons
      .filter((coupon) => coupon.user_id === user.id)
      .sort((a, b) => Number(b.status === 'unused') - Number(a.status === 'unused') || a.expires_at.localeCompare(b.expires_at)),
    generatedCoupons,
    completedMissions
  };
}

function validateStaticScore(userId, score, durationMs, runId) {
  const attempts = readJson(ARCADE_ATTEMPTS_KEY, []);
  if (!runId || attempts.some((attempt) => attempt.run_id === runId)) throw new Error('Risultato gia inviato');
  if (!Number.isInteger(score) || score < 0 || score > 150) {
    throw new Error('Punteggio rifiutato: valore non plausibile');
  }
  if (!Number.isInteger(durationMs) || durationMs < 300 || score > Math.ceil(durationMs / 900) + 3) {
    throw new Error('Punteggio rifiutato: troppo alto per la durata dichiarata');
  }
  const now = Date.now();
  const userAttempts = attempts.filter((attempt) => attempt.user_id === userId);
  const latest = userAttempts.at(-1);
  if (latest && now - new Date(latest.submitted_at).getTime() < 12000) {
    throw new Error('Invii troppo ravvicinati, riprova tra poco');
  }
  if (userAttempts.filter((attempt) => now - new Date(attempt.submitted_at).getTime() < 3600000).length >= 12) {
    throw new Error('Limite tentativi orari raggiunto');
  }
  if (userAttempts.filter((attempt) => now - new Date(attempt.submitted_at).getTime() < 86400000).length >= 40) {
    throw new Error('Limite tentativi giornalieri raggiunto');
  }
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
  async getArcadeProfile(playerName) {
    return staticProfileFor(getOrCreateStaticUser(playerName));
  },
  async saveScore(entry) {
    const playerName = String(entry.playerName || '').trim().slice(0, 40);
    const score = Number(entry.score);
    const durationMs = Number(entry.durationMs);
    const runId = String(entry.runId || '').trim();
    if (!playerName || !Number.isInteger(score) || score < 0) {
      throw new Error('Nome giocatore o punteggio non valido');
    }
    const user = getOrCreateStaticUser(playerName);
    validateStaticScore(user.id, score, durationMs, runId);
    const scores = readJson(LEADERBOARD_KEY, []);
    const saved = {
      id: Date.now(),
      player_name: playerName,
      score,
      played_at: new Date().toISOString(),
      week_ref: getWeekRef()
    };
    writeJson(LEADERBOARD_KEY, [...scores, saved]);
    const attempts = readJson(ARCADE_ATTEMPTS_KEY, []);
    writeJson(ARCADE_ATTEMPTS_KEY, [
      ...attempts,
      {
        id: Date.now() + 1,
        user_id: user.id,
        run_id: runId,
        score,
        duration_ms: durationMs,
        submitted_at: new Date().toISOString(),
        week_ref: getWeekRef()
      }
    ]);

    ensureStaticMissions(user.id);
    const weekAttempts = readJson(ARCADE_ATTEMPTS_KEY, []).filter(
      (attempt) => attempt.user_id === user.id && attempt.week_ref === getWeekRef()
    );
    const progressByKey = {
      weekly_plays_3: weekAttempts.length,
      weekly_score_1000: weekAttempts.reduce((total, attempt) => total + attempt.score, 0),
      weekly_challenge_1: weekAttempts.length > 0 ? 1 : 0
    };
    const missions = readJson(ARCADE_MISSIONS_KEY, []);
    const completedMissions = [];
    let rewardXp = 0;
    let rewardCredit = 0;
    const nextMissions = missions.map((mission) => {
      if (mission.user_id !== user.id || mission.week_ref !== getWeekRef()) return mission;
      const current = Math.min(mission.target, progressByKey[mission.mission_key] ?? mission.current_progress);
      const completeNow = !mission.completed && current >= mission.target;
      if (completeNow) {
        rewardXp += mission.reward_xp;
        rewardCredit += mission.reward_credit;
        completedMissions.push({ title: mission.title, rewardXp: mission.reward_xp, rewardCredit: mission.reward_credit });
      }
      return {
        ...mission,
        current_progress: current,
        completed: mission.completed || completeNow,
        completed_at: completeNow ? new Date().toISOString() : mission.completed_at
      };
    });
    writeJson(ARCADE_MISSIONS_KEY, nextMissions);

    const users = readJson(ARCADE_USERS_KEY, []);
    const previousLevel = levelForXp(user.xp).name;
    const updatedUser = {
      ...user,
      xp: user.xp + rewardXp,
      arcade_credit: user.arcade_credit + rewardCredit,
      updated_at: new Date().toISOString()
    };
    writeJson(
      ARCADE_USERS_KEY,
      users.map((item) => (item.id === user.id ? updatedUser : item))
    );
    const nextLevel = levelForXp(updatedUser.xp).name;
    const generatedCoupons = [];
    if (completedMissions.length > 0) generatedCoupons.push(createStaticCoupon(user.id, 'missione', nextLevel));
    if (previousLevel !== nextLevel && nextLevel === 'Argento') generatedCoupons.push(createStaticCoupon(user.id, 'level_silver', nextLevel));
    if (previousLevel !== nextLevel && nextLevel === 'Oro') generatedCoupons.push(createStaticCoupon(user.id, 'level_gold', nextLevel));

    return { entry: saved, profile: staticProfileFor(updatedUser, generatedCoupons, completedMissions) };
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
  getArcadeProfile: (playerName) =>
    request(`/api/arcade/profile?playerName=${encodeURIComponent(playerName)}`),
  saveScore: (entry) =>
    request('/api/leaderboard', { method: 'POST', body: JSON.stringify(entry) })
};

export const api = STATIC_MODE ? staticApi : serverApi;
export const isStaticMode = STATIC_MODE;
