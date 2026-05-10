# Eventi Forette

Sito completo per promuovere eventi sociali, feste, attivita locali e un mini arcade per Forette, Verona.

## Stack

- Frontend: React + Vite + React Router
- Backend: Node.js + Express
- Database: SQLite tramite `better-sqlite3`
- Gioco: canvas HTML5 con classifica salvata via API

## Avvio locale

```bash
npm install
npm run dev
```

Frontend: `http://localhost:5173`  
Backend API: `http://localhost:3001`

Per avviare solo il backend:

```bash
npm start
```

Il file `data.sqlite` viene creato automaticamente al primo avvio e contiene eventi demo iniziali.

## Demo statica per GitHub Pages

Per mostrare il sito ai clienti senza backend, usa la build statica:

```bash
npm run build:pages
```

Questa modalita:

- non chiama Express o SQLite
- usa dati demo iniziali nel browser
- salva eventi, presenze e classifica in `localStorage`
- usa routing hash, quindi funziona su GitHub Pages anche ricaricando le pagine

Per provarla in locale:

```bash
npm run build:pages
npm run preview
```

## Pubblicazione su GitHub Pages

Il workflow `.github/workflows/pages.yml` pubblica automaticamente il sito quando fai push su `main`.

Nel repository GitHub abilita:

1. `Settings` → `Pages`
2. `Build and deployment`
3. `Source: GitHub Actions`

Poi fai push del progetto su GitHub. La action compilera il frontend in modalita statica e pubblichera la cartella `dist`.

## Pagine

- `/` landing page
- `/calendario` calendario eventi con pulsante `Parteciperò`
- `/arcade` gioco stile Flappy Bird con classifica settimanale
- `/admin` area gestione eventi

Credenziali admin provvisorie:

```txt
username: admin
password: admin
```

## API principali

Eventi:

- `GET /api/events`
- `POST /api/events`
- `PUT /api/events/:id`
- `DELETE /api/events/:id`
- `POST /api/events/:id/attend`

Admin:

- `POST /api/admin/login`

Gioco:

- `GET /api/leaderboard`
- `POST /api/leaderboard`

## Note di sviluppo

L'autenticazione admin e volutamente basilare: il backend centralizza comunque l'endpoint di login e le credenziali possono essere sostituite con variabili ambiente:

```bash
ADMIN_USERNAME=admin ADMIN_PASSWORD=una-password-piu-sicura npm start
```

La classifica salva `nome giocatore`, `punteggio`, `data` e `settimana di riferimento`, lasciando spazio a future logiche coupon.
