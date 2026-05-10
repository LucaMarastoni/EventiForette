import Database from 'better-sqlite3';

const db = new Database('data.sqlite');
db.pragma('journal_mode = WAL');

const today = new Date();
const isoDate = (offsetDays) => {
  const date = new Date(today);
  date.setDate(today.getDate() + offsetDays);
  return date.toISOString().slice(0, 10);
};

export function initDb() {
  db.exec(`
    CREATE TABLE IF NOT EXISTS events (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      title TEXT NOT NULL,
      description TEXT NOT NULL,
      date TEXT NOT NULL,
      time TEXT NOT NULL,
      location TEXT NOT NULL,
      image TEXT,
      participants INTEGER NOT NULL DEFAULT 0,
      category TEXT,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS leaderboard (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      player_name TEXT NOT NULL,
      score INTEGER NOT NULL,
      played_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      week_ref TEXT NOT NULL
    );
  `);

  const eventCount = db.prepare('SELECT COUNT(*) AS count FROM events').get().count;
  if (eventCount === 0) {
    const insertEvent = db.prepare(`
      INSERT INTO events (title, description, date, time, location, image, participants, category)
      VALUES (@title, @description, @date, @time, @location, @image, @participants, @category)
    `);

    [
      {
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
        title: 'Laboratorio creativo famiglie',
        description:
          'Attività manuali, colori e piccoli progetti creativi per bambini, genitori e nonni.',
        date: isoDate(20),
        time: '16:00',
        location: 'Parco comunale',
        image:
          'https://images.unsplash.com/photo-1491438590914-bc09fcaaf77a?auto=format&fit=crop&w=1200&q=80',
        participants: 17,
        category: 'Famiglie'
      }
    ].forEach((event) => insertEvent.run(event));
  }
}

export default db;
