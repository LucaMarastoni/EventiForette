import express from 'express';
import cors from 'cors';
import db, { initDb } from './db.js';

const app = express();
const PORT = process.env.PORT || 3001;
const ADMIN_USERNAME = process.env.ADMIN_USERNAME || 'admin';
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'admin';
const MAX_SCORE = 150;
const MAX_ATTEMPTS_PER_HOUR = 12;
const MAX_ATTEMPTS_PER_DAY = 40;
const MIN_SECONDS_BETWEEN_SUBMISSIONS = 12;

initDb();

app.use(cors());
app.use(express.json({ limit: '1mb' }));

const requiredEventFields = ['title', 'description', 'date', 'time', 'location'];

function validateEvent(payload) {
  const missing = requiredEventFields.filter((field) => !String(payload[field] || '').trim());
  if (missing.length > 0) {
    return `Campi obbligatori mancanti: ${missing.join(', ')}`;
  }
  return null;
}

function getWeekRef(date = new Date()) {
  const current = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const day = current.getUTCDay() || 7;
  current.setUTCDate(current.getUTCDate() + 4 - day);
  const yearStart = new Date(Date.UTC(current.getUTCFullYear(), 0, 1));
  const weekNo = Math.ceil(((current - yearStart) / 86400000 + 1) / 7);
  return `${current.getUTCFullYear()}-W${String(weekNo).padStart(2, '0')}`;
}

function getWeekExpiry(date = new Date()) {
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
  return {
    name: 'Bronzo',
    minXp: 0,
    nextMinXp: 250,
    benefits: ['Accesso ai coupon base']
  };
}

function missionTemplates(weekRef, expiresAt) {
  return [
    {
      missionKey: 'weekly_plays_3',
      title: 'Gioca 3 volte questa settimana',
      description: 'Salva tre partite arcade valide entro la fine della settimana.',
      target: 3,
      rewardXp: 90,
      rewardCredit: 20,
      weekRef,
      expiresAt
    },
    {
      missionKey: 'weekly_score_1000',
      title: 'Raggiungi 1000 punti totali',
      description: 'Accumula 1000 punti nella classifica settimanale.',
      target: 1000,
      rewardXp: 180,
      rewardCredit: 45,
      weekRef,
      expiresAt
    },
    {
      missionKey: 'weekly_challenge_1',
      title: 'Partecipa ad almeno una sfida arcade',
      description: 'Completa una partita e registra il punteggio nella sfida settimanale.',
      target: 1,
      rewardXp: 60,
      rewardCredit: 15,
      weekRef,
      expiresAt
    }
  ];
}

function normalizePlayerName(value) {
  return String(value || '').trim().slice(0, 40);
}

function getOrCreateArcadeUser(playerName) {
  const normalized = normalizePlayerName(playerName);
  if (!normalized) return null;

  const existing = db.prepare('SELECT * FROM arcade_users WHERE lower(player_name) = lower(?)').get(normalized);
  if (existing) return existing;

  const result = db
    .prepare('INSERT INTO arcade_users (player_name) VALUES (?)')
    .run(normalized);
  return db.prepare('SELECT * FROM arcade_users WHERE id = ?').get(result.lastInsertRowid);
}

function ensureWeeklyMissions(userId, weekRef = getWeekRef()) {
  const expiresAt = getWeekExpiry();
  const insert = db.prepare(`
    INSERT OR IGNORE INTO arcade_missions
      (user_id, mission_key, title, description, target, reward_xp, reward_credit, week_ref, expires_at)
    VALUES
      (@userId, @missionKey, @title, @description, @target, @rewardXp, @rewardCredit, @weekRef, @expiresAt)
  `);

  missionTemplates(weekRef, expiresAt).forEach((mission) => insert.run({ userId, ...mission }));
}

function couponValueForLevel(levelName, source) {
  if (source === 'level_gold') return 25;
  if (source === 'level_silver') return 18;
  if (levelName === 'Oro') return 20;
  if (levelName === 'Argento') return 15;
  return 10;
}

function createCoupon(userId, source, levelName, eventId = null) {
  const expiresAt = new Date(Date.now() + 10 * 24 * 60 * 60 * 1000).toISOString();
  const code = `FORETTE-${source.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 8)}-${Math.random()
    .toString(36)
    .slice(2, 8)
    .toUpperCase()}`;
  const result = db
    .prepare(
      `INSERT INTO arcade_coupons
        (user_id, code, discount_type, discount_value, event_id, source, expires_at)
       VALUES (?, ?, 'percent', ?, ?, ?, ?)`
    )
    .run(userId, code, couponValueForLevel(levelName, source), eventId, source, expiresAt);
  return db.prepare('SELECT * FROM arcade_coupons WHERE id = ?').get(result.lastInsertRowid);
}

function refreshCouponStatuses(userId) {
  db.prepare(
    "UPDATE arcade_coupons SET status = 'expired' WHERE user_id = ? AND status = 'unused' AND datetime(expires_at) < datetime('now')"
  ).run(userId);
}

function serializeProfile(user, generatedCoupons = [], completedMissions = []) {
  ensureWeeklyMissions(user.id);
  refreshCouponStatuses(user.id);

  const missions = db
    .prepare(
      `SELECT id, mission_key, title, description, current_progress, target, completed,
              reward_xp, reward_credit, week_ref, expires_at, completed_at
       FROM arcade_missions
       WHERE user_id = ? AND week_ref = ?
       ORDER BY id ASC`
    )
    .all(user.id, getWeekRef())
    .map((mission) => ({ ...mission, completed: Boolean(mission.completed) }));

  const coupons = db
    .prepare(
      `SELECT c.id, c.code, c.discount_type, c.discount_value, c.status, c.event_id,
              e.title AS event_title, c.source, c.expires_at, c.created_at, c.used_at
       FROM arcade_coupons c
       LEFT JOIN events e ON e.id = c.event_id
       WHERE c.user_id = ?
       ORDER BY c.status = 'unused' DESC, c.expires_at ASC`
    )
    .all(user.id);

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
    coupons,
    generatedCoupons,
    completedMissions
  };
}

function validateScoreSubmission(userId, score, durationMs, runId) {
  if (!runId || !/^[a-zA-Z0-9_-]{8,80}$/.test(runId)) {
    return 'Run arcade non valido';
  }
  if (!Number.isInteger(score) || score < 0 || score > MAX_SCORE) {
    return 'Punteggio rifiutato: valore non plausibile';
  }
  if (!Number.isInteger(durationMs) || durationMs < 300 || durationMs > 15 * 60 * 1000) {
    return 'Durata partita non valida';
  }
  const maxByDuration = Math.ceil(durationMs / 900) + 3;
  if (score > maxByDuration) {
    return 'Punteggio rifiutato: troppo alto per la durata dichiarata';
  }

  const duplicate = db.prepare('SELECT id FROM arcade_attempts WHERE run_id = ?').get(runId);
  if (duplicate) return 'Risultato gia inviato';

  const latest = db
    .prepare(
      "SELECT submitted_at FROM arcade_attempts WHERE user_id = ? ORDER BY submitted_at DESC LIMIT 1"
    )
    .get(userId);
  if (latest) {
    const seconds = (Date.now() - new Date(`${latest.submitted_at}Z`).getTime()) / 1000;
    if (seconds < MIN_SECONDS_BETWEEN_SUBMISSIONS) return 'Invii troppo ravvicinati, riprova tra poco';
  }

  const hourCount = db
    .prepare(
      "SELECT COUNT(*) AS count FROM arcade_attempts WHERE user_id = ? AND submitted_at >= datetime('now', '-1 hour')"
    )
    .get(userId).count;
  if (hourCount >= MAX_ATTEMPTS_PER_HOUR) return 'Limite tentativi orari raggiunto';

  const dayCount = db
    .prepare(
      "SELECT COUNT(*) AS count FROM arcade_attempts WHERE user_id = ? AND submitted_at >= datetime('now', '-1 day')"
    )
    .get(userId).count;
  if (dayCount >= MAX_ATTEMPTS_PER_DAY) return 'Limite tentativi giornalieri raggiunto';

  return null;
}

function updateMissionsAfterScore(user, score) {
  const weekRef = getWeekRef();
  ensureWeeklyMissions(user.id, weekRef);

  const weeklyAttempts = db
    .prepare('SELECT COUNT(*) AS count FROM arcade_attempts WHERE user_id = ? AND week_ref = ?')
    .get(user.id, weekRef).count;
  const weeklyScore = db
    .prepare('SELECT COALESCE(SUM(score), 0) AS total FROM arcade_attempts WHERE user_id = ? AND week_ref = ?')
    .get(user.id, weekRef).total;

  const progressByKey = {
    weekly_plays_3: weeklyAttempts,
    weekly_score_1000: weeklyScore,
    weekly_challenge_1: weeklyAttempts > 0 ? 1 : 0
  };

  const missions = db
    .prepare('SELECT * FROM arcade_missions WHERE user_id = ? AND week_ref = ?')
    .all(user.id, weekRef);
  const previousLevel = levelForXp(user.xp).name;
  const completedMissions = [];
  let rewardXp = 0;
  let rewardCredit = 0;

  for (const mission of missions) {
    const progress = Math.min(mission.target, progressByKey[mission.mission_key] ?? mission.current_progress);
    const completeNow = !mission.completed && progress >= mission.target;
    db.prepare(
      `UPDATE arcade_missions
       SET current_progress = ?, completed = CASE WHEN ? THEN 1 ELSE completed END,
           completed_at = CASE WHEN ? THEN CURRENT_TIMESTAMP ELSE completed_at END
       WHERE id = ?`
    ).run(progress, completeNow ? 1 : 0, completeNow ? 1 : 0, mission.id);

    if (completeNow) {
      rewardXp += mission.reward_xp;
      rewardCredit += mission.reward_credit;
      completedMissions.push({ title: mission.title, rewardXp: mission.reward_xp, rewardCredit: mission.reward_credit });
    }
  }

  if (rewardXp > 0 || rewardCredit > 0) {
    db.prepare(
      'UPDATE arcade_users SET xp = xp + ?, arcade_credit = arcade_credit + ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?'
    ).run(rewardXp, rewardCredit, user.id);
  }

  const updatedUser = db.prepare('SELECT * FROM arcade_users WHERE id = ?').get(user.id);
  const nextLevel = levelForXp(updatedUser.xp).name;
  const generatedCoupons = [];
  if (completedMissions.length > 0) {
    generatedCoupons.push(createCoupon(updatedUser.id, 'missione', nextLevel));
  }
  if (previousLevel !== nextLevel && nextLevel === 'Argento') {
    generatedCoupons.push(createCoupon(updatedUser.id, 'level_silver', nextLevel));
  }
  if (previousLevel !== nextLevel && nextLevel === 'Oro') {
    generatedCoupons.push(createCoupon(updatedUser.id, 'level_gold', nextLevel));
  }

  return { user: updatedUser, completedMissions, generatedCoupons };
}

app.get('/api/health', (_req, res) => {
  res.json({ ok: true });
});

app.get('/api/events', (_req, res) => {
  const events = db
    .prepare('SELECT * FROM events ORDER BY date ASC, time ASC')
    .all();
  res.json(events);
});

app.post('/api/events', (req, res) => {
  const validationError = validateEvent(req.body);
  if (validationError) return res.status(400).json({ error: validationError });

  const statement = db.prepare(`
    INSERT INTO events (title, description, date, time, location, image, participants, category)
    VALUES (@title, @description, @date, @time, @location, @image, @participants, @category)
  `);

  const result = statement.run({
    title: req.body.title.trim(),
    description: req.body.description.trim(),
    date: req.body.date,
    time: req.body.time,
    location: req.body.location.trim(),
    image: req.body.image?.trim() || null,
    participants: Number(req.body.participants || 0),
    category: req.body.category?.trim() || null
  });

  const event = db.prepare('SELECT * FROM events WHERE id = ?').get(result.lastInsertRowid);
  res.status(201).json(event);
});

app.put('/api/events/:id', (req, res) => {
  const id = Number(req.params.id);
  const existing = db.prepare('SELECT * FROM events WHERE id = ?').get(id);
  if (!existing) return res.status(404).json({ error: 'Evento non trovato' });

  const validationError = validateEvent(req.body);
  if (validationError) return res.status(400).json({ error: validationError });

  db.prepare(`
    UPDATE events
    SET title = @title,
        description = @description,
        date = @date,
        time = @time,
        location = @location,
        image = @image,
        participants = @participants,
        category = @category
    WHERE id = @id
  `).run({
    id,
    title: req.body.title.trim(),
    description: req.body.description.trim(),
    date: req.body.date,
    time: req.body.time,
    location: req.body.location.trim(),
    image: req.body.image?.trim() || null,
    participants: Number(req.body.participants ?? existing.participants),
    category: req.body.category?.trim() || null
  });

  const event = db.prepare('SELECT * FROM events WHERE id = ?').get(id);
  res.json(event);
});

app.delete('/api/events/:id', (req, res) => {
  const result = db.prepare('DELETE FROM events WHERE id = ?').run(Number(req.params.id));
  if (result.changes === 0) return res.status(404).json({ error: 'Evento non trovato' });
  res.status(204).send();
});

app.post('/api/events/:id/attend', (req, res) => {
  const id = Number(req.params.id);
  const existing = db.prepare('SELECT * FROM events WHERE id = ?').get(id);
  if (!existing) return res.status(404).json({ error: 'Evento non trovato' });

  db.prepare('UPDATE events SET participants = participants + 1 WHERE id = ?').run(id);
  const event = db.prepare('SELECT * FROM events WHERE id = ?').get(id);
  res.json(event);
});

app.post('/api/admin/login', (req, res) => {
  const { username, password } = req.body;
  if (username === ADMIN_USERNAME && password === ADMIN_PASSWORD) {
    return res.json({ token: 'demo-admin-token', username: ADMIN_USERNAME });
  }
  res.status(401).json({ error: 'Credenziali non valide' });
});

app.get('/api/leaderboard', (req, res) => {
  const weekRef = req.query.week || getWeekRef();
  const scores = db
    .prepare(
      'SELECT * FROM leaderboard WHERE week_ref = ? ORDER BY score DESC, played_at ASC LIMIT 20'
    )
    .all(weekRef);
  res.json({ weekRef, scores });
});

app.get('/api/arcade/profile', (req, res) => {
  const playerName = normalizePlayerName(req.query.playerName);
  if (!playerName) return res.status(400).json({ error: 'Nome giocatore richiesto' });

  const user = getOrCreateArcadeUser(playerName);
  res.json(serializeProfile(user));
});

app.post('/api/leaderboard', (req, res) => {
  const playerName = normalizePlayerName(req.body.playerName);
  const score = Number(req.body.score);
  const durationMs = Number(req.body.durationMs);
  const runId = String(req.body.runId || '').trim();
  const weekRef = req.body.weekRef || getWeekRef();

  if (!playerName || !Number.isInteger(score) || score < 0) {
    return res.status(400).json({ error: 'Nome giocatore o punteggio non valido' });
  }

  const user = getOrCreateArcadeUser(playerName);
  const antiCheatError = validateScoreSubmission(user.id, score, durationMs, runId);
  if (antiCheatError) return res.status(429).json({ error: antiCheatError });

  const result = db.transaction(() => {
    db.prepare(
      'INSERT INTO arcade_attempts (user_id, run_id, score, duration_ms, week_ref) VALUES (?, ?, ?, ?, ?)'
    ).run(user.id, runId, score, durationMs, weekRef);
    const leaderboardResult = db
      .prepare('INSERT INTO leaderboard (player_name, score, week_ref) VALUES (?, ?, ?)')
      .run(playerName, score, weekRef);
    const entry = db.prepare('SELECT * FROM leaderboard WHERE id = ?').get(leaderboardResult.lastInsertRowid);
    const rewards = updateMissionsAfterScore(user, score);
    return { entry, profile: serializeProfile(rewards.user, rewards.generatedCoupons, rewards.completedMissions) };
  })();

  res.status(201).json(result);
});

app.listen(PORT, () => {
  console.log(`Eventi Forette API attiva su http://localhost:${PORT}`);
});
