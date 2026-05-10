import express from 'express';
import cors from 'cors';
import db, { initDb } from './db.js';

const app = express();
const PORT = process.env.PORT || 3001;
const ADMIN_USERNAME = process.env.ADMIN_USERNAME || 'admin';
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'admin';

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

app.post('/api/leaderboard', (req, res) => {
  const playerName = String(req.body.playerName || '').trim().slice(0, 40);
  const score = Number(req.body.score);
  const weekRef = req.body.weekRef || getWeekRef();

  if (!playerName || !Number.isInteger(score) || score < 0) {
    return res.status(400).json({ error: 'Nome giocatore o punteggio non valido' });
  }

  const result = db
    .prepare('INSERT INTO leaderboard (player_name, score, week_ref) VALUES (?, ?, ?)')
    .run(playerName, score, weekRef);
  const entry = db.prepare('SELECT * FROM leaderboard WHERE id = ?').get(result.lastInsertRowid);
  res.status(201).json(entry);
});

app.listen(PORT, () => {
  console.log(`Eventi Forette API attiva su http://localhost:${PORT}`);
});
