import { sha256 } from 'js-sha256';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3001';
const STATIC_MODE = import.meta.env.VITE_STATIC_MODE === 'true';
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY || '';
const SUPABASE_REST_URL = normalizeSupabaseRestUrl(
  import.meta.env.VITE_SUPABASE_REST_URL || import.meta.env.VITE_SUPABASE_URL || ''
);
const SUPABASE_MODE = !STATIC_MODE && Boolean(SUPABASE_REST_URL && SUPABASE_ANON_KEY);
const EVENTS_KEY = 'eventi-forette-static-events';
const LEADERBOARD_KEY = 'eventi-forette-static-leaderboard';
const ARCADE_USERS_KEY = 'eventi-forette-static-users';
const ARCADE_ATTEMPTS_KEY = 'eventi-forette-static-attempts';
const ARCADE_MISSIONS_KEY = 'eventi-forette-static-missions';
const ARCADE_COUPONS_KEY = 'eventi-forette-static-coupons';
const USER_SESSION_KEY = 'eventi-forette-user-session';
const TOURNAMENT_REGISTRATIONS_KEY = 'eventi-forette-static-tournament-registrations';

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

function normalizeSupabaseRestUrl(value) {
  const url = String(value || '').trim().replace(/\/+$/, '');
  if (!url) return '';
  return url.endsWith('/rest/v1') ? url : `${url}/rest/v1`;
}

async function supabaseRequest(path, options = {}) {
  const url = `${SUPABASE_REST_URL}${path.startsWith('/') ? path : `/${path}`}`;
  let response;
  try {
    response = await fetch(url, {
      method: options.method || 'GET',
      headers: {
        apikey: SUPABASE_ANON_KEY,
        Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
        'Content-Type': 'application/json',
        ...(options.prefer ? { Prefer: options.prefer } : {}),
        ...options.headers
      },
      body: options.body ? JSON.stringify(options.body) : undefined
    });
  } catch (error) {
    console.error('Supabase request failed before response', { url, error });
    throw new Error('Errore di comunicazione con Supabase. Ricarica la pagina e riprova.');
  }

  if (!response.ok) {
    const text = await response.text().catch(() => '');
    const payload = text ? JSON.parse(text) : {};
    throw new Error(payload.message || payload.error || 'Errore di comunicazione con Supabase');
  }

  const text = await response.text();
  return text ? JSON.parse(text) : null;
}

function queryString(params) {
  const value = Object.entries(params)
    .filter(([, item]) => item !== undefined && item !== null && item !== '')
    .map(([key, item]) => `${encodeURIComponent(key)}=${encodeURIComponent(String(item))}`)
    .join('&');
  return value ? `?${value}` : '';
}

function bestLeaderboardRows(rows) {
  const bestByPlayer = new Map();
  for (const row of rows) {
    const key = row.app_user_id ? `user:${row.app_user_id}` : `name:${String(row.player_name || '').toLowerCase()}`;
    const current = bestByPlayer.get(key);
    if (
      !current ||
      Number(row.score || 0) > Number(current.score || 0) ||
      (Number(row.score || 0) === Number(current.score || 0) && String(row.played_at || '').localeCompare(String(current.played_at || '')) < 0)
    ) {
      bestByPlayer.set(key, row);
    }
  }
  return [...bestByPlayer.values()]
    .sort((a, b) => Number(b.score || 0) - Number(a.score || 0) || String(a.played_at || '').localeCompare(String(b.played_at || '')))
    .slice(0, 20);
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

function normalizeEmail(value) {
  return String(value || '').trim().toLowerCase();
}

async function hashPin(email, pin) {
  const source = `${normalizeEmail(email)}:${String(pin || '')}`;
  if (!globalThis.crypto?.subtle) return sha256(source);
  const bytes = new TextEncoder().encode(source);
  const digest = await crypto.subtle.digest('SHA-256', bytes);
  return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, '0')).join('');
}

export function getCurrentUser() {
  return readJson(USER_SESSION_KEY, null);
}

export function isAdminUser(user = getCurrentUser()) {
  return user?.role === 'admin';
}

function saveCurrentUser(user) {
  const sessionUser = user
    ? {
        id: user.id,
        displayName: user.display_name || user.displayName,
        email: user.email,
        role: user.role || 'user'
      }
    : null;
  if (sessionUser) writeJson(USER_SESSION_KEY, sessionUser);
  else localStorage.removeItem(USER_SESSION_KEY);
  window.dispatchEvent(new CustomEvent('eventi-forette-user', { detail: sessionUser }));
  return sessionUser;
}

export function logoutCurrentUser() {
  saveCurrentUser(null);
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

function couponCodeFromPayload(value) {
  const raw = String(value || '').trim();
  if (!raw) return '';
  try {
    const parsed = JSON.parse(raw);
    return String(parsed.code || '').trim().toUpperCase();
  } catch {
    return raw.trim().toUpperCase();
  }
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

function initialTournaments() {
  return [
    {
      id: 1,
      slug: 'calcetto-estate',
      name: 'Torneo Calcetto Estate',
      status: 'Iscrizioni aperte',
      teams: 8,
      max_teams: 16,
      date_label: '15 Giu',
      time: '20:30',
      location: 'Campo sportivo Forette',
      leader: 'Forette Blu',
      format: 'Gironi + semifinali',
      description: 'Partite serali da 20 minuti, squadre da 5 giocatori e finale durante la serata conclusiva.',
      accent: 'tournament-tone-1',
      bracket: [
        {
          title: 'Semifinali',
          matches: [
            { teamA: 'Forette Blu', scoreA: 3, teamB: 'San Pietro', scoreB: 1 },
            { teamA: 'I Solari', scoreA: 2, teamB: 'Bar Centrale', scoreB: 0 }
          ]
        },
        { title: 'Finale', matches: [{ teamA: 'Forette Blu', scoreA: '-', teamB: 'I Solari', scoreB: '-' }] },
        { title: 'Podio', matches: [{ teamA: '1° Forette Blu', scoreA: '', teamB: '2° I Solari', scoreB: '' }] }
      ]
    },
    {
      id: 2,
      slug: 'beach-volley',
      name: 'Beach Volley in Piazza',
      status: 'Semifinali',
      teams: 6,
      max_teams: 12,
      date_label: '22 Giu',
      time: '18:00',
      location: 'Piazza centrale',
      leader: 'I Solari',
      format: 'Eliminazione diretta',
      description: 'Coppie miste, set ai 21 punti e rotazione rapida per tenere il torneo vivace fino alla finale.',
      accent: 'tournament-tone-2',
      bracket: [
        {
          title: 'Quarti',
          matches: [
            { teamA: 'I Solari', scoreA: 21, teamB: 'Volley Bar', scoreB: 14 },
            { teamA: 'Forette Beach', scoreA: 18, teamB: 'Team Sprint', scoreB: 21 }
          ]
        },
        { title: 'Semifinali', matches: [{ teamA: 'I Solari', scoreA: '-', teamB: 'Team Sprint', scoreB: '-' }] },
        { title: 'Finale', matches: [{ teamA: 'Vincente SF1', scoreA: '', teamB: 'Vincente SF2', scoreB: '' }] }
      ]
    },
    {
      id: 3,
      slug: 'burraco-sagra',
      name: 'Burraco della Sagra',
      status: 'Finale pronta',
      teams: 12,
      max_teams: 20,
      date_label: '29 Giu',
      time: '21:00',
      location: 'Sala civica',
      leader: 'Coppia Neri',
      format: 'Classifica a punti',
      description: 'Tavoli sorteggiati, tre turni di qualificazione e finale tra le due coppie con punteggio migliore.',
      accent: 'tournament-tone-3',
      bracket: [
        {
          title: 'Qualifica',
          matches: [
            { teamA: 'Coppia Neri', scoreA: 1240, teamB: 'Coppia Rizzi', scoreB: 980 },
            { teamA: 'Coppia Blu', scoreA: 1110, teamB: 'Coppia Festa', scoreB: 1040 }
          ]
        },
        { title: 'Finale', matches: [{ teamA: 'Coppia Neri', scoreA: '-', teamB: 'Coppia Blu', scoreB: '-' }] },
        { title: 'Premi', matches: [{ teamA: '1° Buono cena', scoreA: '', teamB: '2° Cesto festa', scoreB: '' }] }
      ]
    }
  ];
}

function getStoredTournaments() {
  return readJson('eventi-forette-static-tournaments', null) || initialTournaments();
}

const staticApi = {
  async registerUser(payload) {
    const displayName = normalizePlayerName(payload.displayName);
    const email = normalizeEmail(payload.email);
    const pin = String(payload.pin || '');
    if (!displayName || !email || pin.length < 4) throw new Error('Inserisci nome, email e PIN di almeno 4 cifre');
    const users = readJson('eventi-forette-static-app-users', []);
    if (users.some((user) => user.email === email)) throw new Error('Email gia registrata');
    const user = {
      id: Date.now(),
      display_name: displayName,
      email,
      pin_hash: await hashPin(email, pin),
      role: 'user',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };
    writeJson('eventi-forette-static-app-users', [...users, user]);
    return saveCurrentUser(user);
  },
  async loginUser(payload) {
    const email = normalizeEmail(payload.email);
    const pinHash = await hashPin(email, payload.pin);
    const user = readJson('eventi-forette-static-app-users', []).find(
      (item) => item.email === email && item.pin_hash === pinHash
    );
    if (!user) throw new Error('Email o PIN non validi');
    return saveCurrentUser(user);
  },
  getCurrentUser,
  logoutUser: logoutCurrentUser,
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
    const scores = bestLeaderboardRows(readJson(LEADERBOARD_KEY, [])
      .filter((entry) => entry.week_ref === weekRef)
      .sort((a, b) => b.score - a.score || a.played_at.localeCompare(b.played_at))
      .slice(0, 200));
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
  },
  async validateCoupon(value) {
    const code = couponCodeFromPayload(value);
    if (!code) throw new Error('Codice coupon richiesto');
    const coupons = readJson(ARCADE_COUPONS_KEY, []);
    const coupon = coupons.find((item) => item.code === code);
    if (!coupon) return { valid: false, message: 'Coupon non trovato', coupon: null };
    if (coupon.status !== 'unused') return { valid: false, message: `Coupon gia ${coupon.status}`, coupon };
    if (new Date(coupon.expires_at).getTime() < Date.now()) {
      const expired = { ...coupon, status: 'expired' };
      writeJson(ARCADE_COUPONS_KEY, coupons.map((item) => (item.id === coupon.id ? expired : item)));
      return { valid: false, message: 'Coupon scaduto', coupon: expired };
    }
    const used = { ...coupon, status: 'used', used_at: new Date().toISOString() };
    writeJson(ARCADE_COUPONS_KEY, coupons.map((item) => (item.id === coupon.id ? used : item)));
    return { valid: true, message: 'Coupon valido e consumato', coupon: used };
  },
  async getTournaments() {
    return getStoredTournaments();
  },
  async getTournamentRegistrations(appUserId = getCurrentUser()?.id) {
    if (!appUserId) return [];
    const tournaments = getStoredTournaments();
    return readJson(TOURNAMENT_REGISTRATIONS_KEY, [])
      .filter((registration) => registration.app_user_id === appUserId)
      .map((registration) => ({
        ...registration,
        tournament: tournaments.find((tournament) => tournament.id === registration.tournament_id) || null
      }));
  },
  async registerTournament(tournamentId, payload = {}) {
    const currentUser = getCurrentUser();
    if (!currentUser) throw new Error('Accedi per iscriverti al torneo');
    const registrations = readJson(TOURNAMENT_REGISTRATIONS_KEY, []);
    if (registrations.some((item) => item.tournament_id === tournamentId && item.app_user_id === currentUser.id)) {
      throw new Error('Sei gia iscritto a questo torneo');
    }
    const registration = {
      id: Date.now(),
      tournament_id: tournamentId,
      app_user_id: currentUser.id,
      team_name: String(payload.teamName || currentUser.displayName).trim(),
      notes: String(payload.notes || '').trim() || null,
      status: 'pending',
      created_at: new Date().toISOString()
    };
    writeJson(TOURNAMENT_REGISTRATIONS_KEY, [...registrations, registration]);
    return registration;
  }
};

function supabaseEventPayload(event) {
  validateEvent(event);
  return {
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

async function registerSupabaseUser(payload) {
  const displayName = normalizePlayerName(payload.displayName);
  const email = normalizeEmail(payload.email);
  const pin = String(payload.pin || '');
  if (!displayName || !email || pin.length < 4) throw new Error('Inserisci nome, email e PIN di almeno 4 cifre');

  const existing = await supabaseRequest(
    `/app_users${queryString({ select: 'id', email: `eq.${email}`, limit: '1' })}`
  );
  if (existing[0]) throw new Error('Email gia registrata');

  const created = await supabaseRequest('/app_users', {
    method: 'POST',
    prefer: 'return=representation',
    body: {
      display_name: displayName,
      email,
      pin_hash: await hashPin(email, pin)
    }
  });
  return saveCurrentUser(created[0]);
}

async function loginSupabaseUser(payload) {
  const email = normalizeEmail(payload.email);
  const rows = await supabaseRequest(
    `/app_users${queryString({ select: '*', email: `eq.${email}`, limit: '1' })}`
  );
  const user = rows[0];
  if (!user || user.pin_hash !== (await hashPin(email, payload.pin))) {
    throw new Error('Email o PIN non validi');
  }
  return saveCurrentUser(user);
}

async function getSupabaseEvent(id) {
  const rows = await supabaseRequest(`/events${queryString({ select: '*', id: `eq.${id}`, limit: '1' })}`);
  return rows[0] || null;
}

async function getOrCreateSupabaseUser(playerName, appUser = getCurrentUser()) {
  const normalized = normalizePlayerName(playerName);
  if (!normalized) throw new Error('Nome giocatore richiesto');

  if (appUser?.id) {
    const linked = await supabaseRequest(
      `/arcade_users${queryString({ select: '*', app_user_id: `eq.${appUser.id}`, limit: '1' })}`
    );
    if (linked[0]) return linked[0];
  }

  const existing = appUser?.id
    ? []
    : await supabaseRequest(
        `/arcade_users${queryString({ select: '*', player_name: `eq.${normalized}`, limit: '1' })}`
      );
  if (existing[0]) {
    if (appUser?.id && !existing[0].app_user_id) {
      const updated = await supabaseRequest(`/arcade_users${queryString({ id: `eq.${existing[0].id}` })}`, {
        method: 'PATCH',
        prefer: 'return=representation',
        body: { app_user_id: appUser.id, player_name: appUser.displayName || normalized }
      });
      return updated[0] || existing[0];
    }
    return existing[0];
  }

  try {
    const created = await supabaseRequest('/arcade_users', {
      method: 'POST',
      prefer: 'return=representation',
      body: { player_name: appUser?.displayName || normalized, app_user_id: appUser?.id || null }
    });
    return created[0];
  } catch (error) {
    const retried = await supabaseRequest(
      `/arcade_users${queryString({ select: '*', player_name: `eq.${normalized}`, limit: '1' })}`
    );
    if (retried[0]) return retried[0];
    throw error;
  }
}

async function ensureSupabaseMissions(userId, weekRef = getWeekRef()) {
  const existing = await supabaseRequest(
    `/arcade_missions${queryString({ select: 'mission_key', user_id: `eq.${userId}`, week_ref: `eq.${weekRef}` })}`
  );
  const existingKeys = new Set(existing.map((mission) => mission.mission_key));
  const missing = missionTemplates(weekRef)
    .filter((mission) => !existingKeys.has(mission.mission_key))
    .map((mission) => ({
      user_id: userId,
      mission_key: mission.mission_key,
      title: mission.title,
      description: mission.description,
      current_progress: 0,
      target: mission.target,
      completed: false,
      reward_xp: mission.reward_xp,
      reward_credit: mission.reward_credit,
      week_ref: mission.week_ref,
      expires_at: mission.expires_at,
      completed_at: null
    }));

  if (missing.length > 0) {
    await supabaseRequest('/arcade_missions', {
      method: 'POST',
      prefer: 'return=minimal',
      body: missing
    });
  }
}

async function refreshSupabaseCouponStatuses(userId) {
  await supabaseRequest(
    `/arcade_coupons${queryString({
      user_id: `eq.${userId}`,
      status: 'eq.unused',
      expires_at: `lt.${new Date().toISOString()}`
    })}`,
    {
      method: 'PATCH',
      prefer: 'return=minimal',
      body: { status: 'expired' }
    }
  );
}

async function createSupabaseCoupon(userId, source, levelName, eventId = null) {
  const code = `FORETTE-${source.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 8)}-${Math.random()
    .toString(36)
    .slice(2, 8)
    .toUpperCase()}`;
  const created = await supabaseRequest('/arcade_coupons', {
    method: 'POST',
    prefer: 'return=representation',
    body: {
      user_id: userId,
      code,
      discount_type: 'percent',
      discount_value: couponValueForLevel(levelName, source),
      status: 'unused',
      event_id: eventId,
      source,
      expires_at: new Date(Date.now() + 10 * 24 * 60 * 60 * 1000).toISOString(),
      used_at: null
    }
  });
  return { ...created[0], event_title: null };
}

async function serializeSupabaseProfile(user, generatedCoupons = [], completedMissions = []) {
  await ensureSupabaseMissions(user.id);
  await refreshSupabaseCouponStatuses(user.id);

  const [missions, coupons] = await Promise.all([
    supabaseRequest(
      `/arcade_missions${queryString({
        select: '*',
        user_id: `eq.${user.id}`,
        week_ref: `eq.${getWeekRef()}`,
        order: 'id.asc'
      })}`
    ),
    supabaseRequest(
      `/arcade_coupons${queryString({
        select: '*',
        user_id: `eq.${user.id}`,
        order: 'expires_at.asc'
      })}`
    )
  ]);

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
    missions,
    coupons: coupons.sort(
      (a, b) => Number(b.status === 'unused') - Number(a.status === 'unused') || a.expires_at.localeCompare(b.expires_at)
    ),
    generatedCoupons,
    completedMissions
  };
}

function basicSupabaseProfile(user, generatedCoupons = [], completedMissions = []) {
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
    missions: [],
    coupons: generatedCoupons,
    generatedCoupons,
    completedMissions
  };
}

async function validateSupabaseScore(userId, score, durationMs, runId) {
  if (!runId || !/^[a-zA-Z0-9_-]{8,80}$/.test(runId)) throw new Error('Run arcade non valido');
  if (!Number.isInteger(score) || score < 0 || score > 150) {
    throw new Error('Punteggio rifiutato: valore non plausibile');
  }
  if (!Number.isInteger(durationMs) || durationMs < 300 || durationMs > 15 * 60 * 1000) {
    throw new Error('Durata partita non valida');
  }
  if (score > Math.ceil(durationMs / 900) + 3) {
    throw new Error('Punteggio rifiutato: troppo alto per la durata dichiarata');
  }

  const duplicate = await supabaseRequest(
    `/arcade_attempts${queryString({ select: 'id', run_id: `eq.${runId}`, limit: '1' })}`
  );
  if (duplicate[0]) throw new Error('Risultato gia inviato');

  const latest = await supabaseRequest(
    `/arcade_attempts${queryString({
      select: 'submitted_at',
      user_id: `eq.${userId}`,
      order: 'submitted_at.desc',
      limit: '1'
    })}`
  );
  const now = Date.now();
  if (latest[0] && now - new Date(latest[0].submitted_at).getTime() < 12000) {
    throw new Error('Invii troppo ravvicinati, riprova tra poco');
  }

  const [hourAttempts, dayAttempts] = await Promise.all([
    supabaseRequest(
      `/arcade_attempts${queryString({
        select: 'id',
        user_id: `eq.${userId}`,
        submitted_at: `gte.${new Date(now - 3600000).toISOString()}`
      })}`
    ),
    supabaseRequest(
      `/arcade_attempts${queryString({
        select: 'id',
        user_id: `eq.${userId}`,
        submitted_at: `gte.${new Date(now - 86400000).toISOString()}`
      })}`
    )
  ]);
  if (hourAttempts.length >= 12) throw new Error('Limite tentativi orari raggiunto');
  if (dayAttempts.length >= 40) throw new Error('Limite tentativi giornalieri raggiunto');
}

async function updateSupabaseMissionsAfterScore(user) {
  const weekRef = getWeekRef();
  await ensureSupabaseMissions(user.id, weekRef);

  const [attempts, missions] = await Promise.all([
    supabaseRequest(
      `/arcade_attempts${queryString({ select: 'score', user_id: `eq.${user.id}`, week_ref: `eq.${weekRef}` })}`
    ),
    supabaseRequest(
      `/arcade_missions${queryString({ select: '*', user_id: `eq.${user.id}`, week_ref: `eq.${weekRef}` })}`
    )
  ]);
  const weeklyScore = attempts.reduce((total, attempt) => total + Number(attempt.score || 0), 0);
  const progressByKey = {
    weekly_plays_3: attempts.length,
    weekly_score_1000: weeklyScore,
    weekly_challenge_1: attempts.length > 0 ? 1 : 0
  };
  const previousLevel = levelForXp(user.xp).name;
  const completedMissions = [];
  let rewardXp = 0;
  let rewardCredit = 0;

  await Promise.all(
    missions.map((mission) => {
      const current = Math.min(mission.target, progressByKey[mission.mission_key] ?? mission.current_progress);
      const completeNow = !mission.completed && current >= mission.target;
      if (completeNow) {
        rewardXp += mission.reward_xp;
        rewardCredit += mission.reward_credit;
        completedMissions.push({ title: mission.title, rewardXp: mission.reward_xp, rewardCredit: mission.reward_credit });
      }
      return supabaseRequest(`/arcade_missions${queryString({ id: `eq.${mission.id}` })}`, {
        method: 'PATCH',
        prefer: 'return=minimal',
        body: {
          current_progress: current,
          completed: mission.completed || completeNow,
          completed_at: completeNow ? new Date().toISOString() : mission.completed_at
        }
      });
    })
  );

  let updatedUser = user;
  if (rewardXp > 0 || rewardCredit > 0) {
    const updated = await supabaseRequest(`/arcade_users${queryString({ id: `eq.${user.id}` })}`, {
      method: 'PATCH',
      prefer: 'return=representation',
      body: {
        xp: user.xp + rewardXp,
        arcade_credit: user.arcade_credit + rewardCredit,
        updated_at: new Date().toISOString()
      }
    });
    updatedUser = updated[0] || user;
  }

  const nextLevel = levelForXp(updatedUser.xp).name;
  const generatedCoupons = [];
  if (completedMissions.length > 0) generatedCoupons.push(await createSupabaseCoupon(user.id, 'missione', nextLevel));
  if (previousLevel !== nextLevel && nextLevel === 'Argento') {
    generatedCoupons.push(await createSupabaseCoupon(user.id, 'level_silver', nextLevel));
  }
  if (previousLevel !== nextLevel && nextLevel === 'Oro') {
    generatedCoupons.push(await createSupabaseCoupon(user.id, 'level_gold', nextLevel));
  }

  return { user: updatedUser, completedMissions, generatedCoupons };
}

const supabaseApi = {
  registerUser: registerSupabaseUser,
  loginUser: loginSupabaseUser,
  getCurrentUser,
  logoutUser: logoutCurrentUser,
  getEvents: () => supabaseRequest(`/events${queryString({ select: '*', order: 'date.asc,time.asc' })}`),
  async createEvent(event) {
    const created = await supabaseRequest('/events', {
      method: 'POST',
      prefer: 'return=representation',
      body: supabaseEventPayload(event)
    });
    return created[0];
  },
  async updateEvent(id, event) {
    const updated = await supabaseRequest(`/events${queryString({ id: `eq.${id}` })}`, {
      method: 'PATCH',
      prefer: 'return=representation',
      body: supabaseEventPayload(event)
    });
    if (!updated[0]) throw new Error('Evento non trovato');
    return updated[0];
  },
  async deleteEvent(id) {
    await supabaseRequest(`/events${queryString({ id: `eq.${id}` })}`, {
      method: 'DELETE',
      prefer: 'return=minimal'
    });
    return null;
  },
  async attendEvent(id) {
    const event = await getSupabaseEvent(id);
    if (!event) throw new Error('Evento non trovato');
    const updated = await supabaseRequest(`/events${queryString({ id: `eq.${id}` })}`, {
      method: 'PATCH',
      prefer: 'return=representation',
      body: { participants: Number(event.participants || 0) + 1 }
    });
    return updated[0];
  },
  async loginAdmin(credentials) {
    if (credentials.username === 'admin' && credentials.password === 'admin') {
      return { token: 'supabase-admin-token', username: 'admin' };
    }
    throw new Error('Credenziali non valide');
  },
  async getLeaderboard() {
    const weekRef = getWeekRef();
    const scores = await supabaseRequest(
      `/leaderboard${queryString({
        select: '*',
        week_ref: `eq.${weekRef}`,
        order: 'score.desc,played_at.asc',
        limit: '200'
      })}`
    );
    return { weekRef, scores: bestLeaderboardRows(scores) };
  },
  async getArcadeProfile(playerName) {
    const currentUser = getCurrentUser();
    const user = await getOrCreateSupabaseUser(playerName || currentUser?.displayName, currentUser);
    return serializeSupabaseProfile(user);
  },
  async saveScore(entry) {
    const currentUser = getCurrentUser();
    const playerName = normalizePlayerName(currentUser?.displayName || entry.playerName);
    const score = Number(entry.score);
    const durationMs = Number(entry.durationMs);
    const runId = String(entry.runId || '').trim();
    if (!playerName || !Number.isInteger(score) || score < 0) {
      throw new Error('Nome giocatore o punteggio non valido');
    }
    if (!runId || !/^[a-zA-Z0-9_-]{8,80}$/.test(runId)) {
      throw new Error('Run arcade non valida');
    }
    if (!Number.isInteger(durationMs) || durationMs < 300 || durationMs > 15 * 60 * 1000) {
      throw new Error('Durata partita non valida');
    }

    const user = await getOrCreateSupabaseUser(playerName, currentUser);
    const weekRef = getWeekRef();
    await supabaseRequest('/arcade_attempts', {
      method: 'POST',
      prefer: 'return=minimal',
      body: { user_id: user.id, app_user_id: currentUser?.id || null, run_id: runId, score, duration_ms: durationMs, week_ref: weekRef }
    });
    const leaderboardFilter = currentUser?.id
      ? { app_user_id: `eq.${currentUser.id}`, week_ref: `eq.${weekRef}` }
      : { player_name: `eq.${playerName}`, week_ref: `eq.${weekRef}` };
    const existingLeaderboard = await supabaseRequest(
      `/leaderboard${queryString({
        select: '*',
        ...leaderboardFilter,
        order: 'score.desc,played_at.asc',
        limit: '1'
      })}`
    );
    let leaderboardEntry = existingLeaderboard[0] || null;
    if (!leaderboardEntry) {
      const savedRows = await supabaseRequest('/leaderboard', {
        method: 'POST',
        prefer: 'return=representation',
        body: { app_user_id: currentUser?.id || null, player_name: playerName, score, week_ref: weekRef }
      });
      leaderboardEntry = savedRows[0];
    } else if (score > Number(leaderboardEntry.score || 0)) {
      try {
        const savedRows = await supabaseRequest(`/leaderboard${queryString({ id: `eq.${leaderboardEntry.id}` })}`, {
          method: 'PATCH',
          prefer: 'return=representation',
          body: {
            player_name: playerName,
            score,
            played_at: new Date().toISOString()
          }
        });
        if (savedRows[0]) {
          leaderboardEntry = savedRows[0];
        } else {
          const insertedRows = await supabaseRequest('/leaderboard', {
            method: 'POST',
            prefer: 'return=representation',
            body: { app_user_id: currentUser?.id || null, player_name: playerName, score, week_ref: weekRef }
          });
          leaderboardEntry = insertedRows[0] || leaderboardEntry;
        }
      } catch {
        const savedRows = await supabaseRequest('/leaderboard', {
          method: 'POST',
          prefer: 'return=representation',
          body: { app_user_id: currentUser?.id || null, player_name: playerName, score, week_ref: weekRef }
        });
        leaderboardEntry = savedRows[0] || leaderboardEntry;
      }
    }
    const gainedXp = Math.max(5, score * 4);
    const gainedCredit = Math.floor(score / 5);
    const updatedRows = await supabaseRequest(`/arcade_users${queryString({ id: `eq.${user.id}` })}`, {
      method: 'PATCH',
      prefer: 'return=representation',
      body: {
        xp: Number(user.xp || 0) + gainedXp,
        arcade_credit: Number(user.arcade_credit || 0) + gainedCredit,
        updated_at: new Date().toISOString()
      }
    });
    const updatedUser = updatedRows[0] || { ...user, xp: Number(user.xp || 0) + gainedXp, arcade_credit: Number(user.arcade_credit || 0) + gainedCredit };
    const completedMissions = [{ title: 'Run salvata', rewardXp: gainedXp, rewardCredit: gainedCredit }];
    const generatedCoupons = score >= 10 ? [await createSupabaseCoupon(user.id, 'arcade_score', levelForXp(updatedUser.xp).name)] : [];
    return {
      entry: leaderboardEntry,
      profile: basicSupabaseProfile(updatedUser, generatedCoupons, completedMissions)
    };
  },
  async validateCoupon(value) {
    const code = couponCodeFromPayload(value);
    if (!code) throw new Error('Codice coupon richiesto');

    const rows = await supabaseRequest(
      `/arcade_coupons${queryString({ select: '*', code: `eq.${code}`, limit: '1' })}`
    );
    const coupon = rows[0];
    if (!coupon) return { valid: false, message: 'Coupon non trovato', coupon: null };
    if (coupon.status !== 'unused') return { valid: false, message: `Coupon gia ${coupon.status}`, coupon };

    if (new Date(coupon.expires_at).getTime() < Date.now()) {
      const updatedRows = await supabaseRequest(`/arcade_coupons${queryString({ id: `eq.${coupon.id}` })}`, {
        method: 'PATCH',
        prefer: 'return=representation',
        body: { status: 'expired' }
      });
      return { valid: false, message: 'Coupon scaduto', coupon: updatedRows[0] || { ...coupon, status: 'expired' } };
    }

    const updatedRows = await supabaseRequest(`/arcade_coupons${queryString({ id: `eq.${coupon.id}` })}`, {
      method: 'PATCH',
      prefer: 'return=representation',
      body: { status: 'used', used_at: new Date().toISOString() }
    });
    return { valid: true, message: 'Coupon valido e consumato', coupon: updatedRows[0] || { ...coupon, status: 'used' } };
  },
  async getTournaments() {
    return supabaseRequest(`/tournaments${queryString({ select: '*', order: 'id.asc' })}`);
  },
  async getTournamentRegistrations(appUserId = getCurrentUser()?.id) {
    if (!appUserId) return [];
    return supabaseRequest(
      `/tournament_registrations${queryString({
        select: '*,tournament:tournaments(*)',
        app_user_id: `eq.${appUserId}`,
        order: 'created_at.desc'
      })}`
    );
  },
  async registerTournament(tournamentId, payload = {}) {
    const currentUser = getCurrentUser();
    if (!currentUser) throw new Error('Accedi per iscriverti al torneo');
    const teamName = String(payload.teamName || currentUser.displayName || '').trim();
    if (!teamName) throw new Error('Nome squadra richiesto');

    const existing = await supabaseRequest(
      `/tournament_registrations${queryString({
        select: 'id',
        tournament_id: `eq.${tournamentId}`,
        app_user_id: `eq.${currentUser.id}`,
        limit: '1'
      })}`
    );
    if (existing[0]) throw new Error('Sei gia iscritto a questo torneo');

    const created = await supabaseRequest('/tournament_registrations', {
      method: 'POST',
      prefer: 'return=representation',
      body: {
        tournament_id: tournamentId,
        app_user_id: currentUser.id,
        team_name: teamName,
        notes: String(payload.notes || '').trim() || null,
        status: 'pending'
      }
    });
    const tournament = await supabaseRequest(
      `/tournaments${queryString({ select: 'teams', id: `eq.${tournamentId}`, limit: '1' })}`
    );
    if (tournament[0]) {
      await supabaseRequest(`/tournaments${queryString({ id: `eq.${tournamentId}` })}`, {
        method: 'PATCH',
        prefer: 'return=minimal',
        body: { teams: Number(tournament[0].teams || 0) + 1 }
      });
    }
    return created[0];
  }
};

const serverApi = {
  registerUser: staticApi.registerUser,
  loginUser: staticApi.loginUser,
  getCurrentUser,
  logoutUser: logoutCurrentUser,
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
    request('/api/leaderboard', { method: 'POST', body: JSON.stringify(entry) }),
  validateCoupon: staticApi.validateCoupon,
  getTournaments: staticApi.getTournaments,
  getTournamentRegistrations: staticApi.getTournamentRegistrations,
  registerTournament: staticApi.registerTournament
};

export const api = STATIC_MODE ? staticApi : SUPABASE_MODE ? supabaseApi : serverApi;
export const isStaticMode = STATIC_MODE;
export const isSupabaseMode = SUPABASE_MODE;
