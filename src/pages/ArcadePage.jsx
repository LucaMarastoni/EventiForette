import { useCallback, useEffect, useRef, useState } from 'react';
import { RotateCcw, Trophy } from 'lucide-react';
import SectionTitle from '../components/SectionTitle.jsx';
import { api } from '../lib/api.js';

const WIDTH = 420;
const HEIGHT = 560;
const GRAVITY = 0.36;
const JUMP = -6.6;
const PLAYER_SIZE = 30;
const PIPE_WIDTH = 64;
const GAP = 150;

export default function ArcadePage() {
  const canvasRef = useRef(null);
  const frameRef = useRef(null);
  const stateRef = useRef(null);
  const [status, setStatus] = useState('ready');
  const [score, setScore] = useState(0);
  const [best, setBest] = useState(() => Number(localStorage.getItem('eventi-forette-best') || 0));
  const [playerName, setPlayerName] = useState('');
  const [leaderboard, setLeaderboard] = useState({ weekRef: '', scores: [] });
  const [saved, setSaved] = useState(false);

  const loadLeaderboard = useCallback(() => {
    api.getLeaderboard().then(setLeaderboard).catch(() => setLeaderboard({ weekRef: '', scores: [] }));
  }, []);

  useEffect(() => {
    loadLeaderboard();
  }, [loadLeaderboard]);

  const draw = useCallback((ctx, state) => {
    ctx.clearRect(0, 0, WIDTH, HEIGHT);
    const sky = ctx.createLinearGradient(0, 0, 0, HEIGHT);
    sky.addColorStop(0, '#8edcff');
    sky.addColorStop(1, '#ffffff');
    ctx.fillStyle = sky;
    ctx.fillRect(0, 0, WIDTH, HEIGHT);

    ctx.fillStyle = 'rgba(255, 214, 71, 0.55)';
    ctx.beginPath();
    ctx.arc(350, 74, 42, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = '#f6fbff';
    for (const cloud of state.clouds) {
      ctx.beginPath();
      ctx.ellipse(cloud.x, cloud.y, 34, 14, 0, 0, Math.PI * 2);
      ctx.ellipse(cloud.x + 24, cloud.y + 4, 28, 12, 0, 0, Math.PI * 2);
      ctx.fill();
    }

    for (const pipe of state.pipes) {
      ctx.fillStyle = '#ffd447';
      ctx.fillRect(pipe.x, 0, PIPE_WIDTH, pipe.top);
      ctx.fillRect(pipe.x, pipe.top + GAP, PIPE_WIDTH, HEIGHT - pipe.top - GAP - 46);
      ctx.fillStyle = '#f5b700';
      ctx.fillRect(pipe.x - 6, pipe.top - 16, PIPE_WIDTH + 12, 16);
      ctx.fillRect(pipe.x - 6, pipe.top + GAP, PIPE_WIDTH + 12, 16);
    }

    ctx.fillStyle = '#2bb9f0';
    ctx.fillRect(0, HEIGHT - 46, WIDTH, 46);
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, HEIGHT - 46, WIDTH, 8);

    const { player } = state;
    ctx.save();
    ctx.translate(player.x + PLAYER_SIZE / 2, player.y + PLAYER_SIZE / 2);
    ctx.rotate(Math.max(-0.35, Math.min(0.45, player.velocity / 10)));
    ctx.fillStyle = '#ffd447';
    roundRect(ctx, -15, -15, 30, 30, 9);
    ctx.fill();
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.arc(4, -5, 6, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#15324a';
    ctx.beginPath();
    ctx.arc(6, -5, 2.5, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#2bb9f0';
    ctx.beginPath();
    ctx.moveTo(-14, 0);
    ctx.lineTo(-30, -9);
    ctx.lineTo(-24, 9);
    ctx.closePath();
    ctx.fill();
    ctx.restore();

    ctx.fillStyle = '#15324a';
    ctx.font = '700 34px Inter, system-ui';
    ctx.fillText(String(state.score), 22, 48);
  }, []);

  const startGame = useCallback(() => {
    const initialState = {
      player: { x: 86, y: HEIGHT / 2 - PLAYER_SIZE / 2, velocity: 0 },
      pipes: [
        { x: WIDTH + 90, top: 130, scored: false },
        { x: WIDTH + 310, top: 220, scored: false }
      ],
      clouds: [
        { x: 80, y: 92 },
        { x: 250, y: 150 },
        { x: 390, y: 110 }
      ],
      score: 0,
      running: true
    };
    stateRef.current = initialState;
    setScore(0);
    setSaved(false);
    setStatus('playing');
  }, []);

  const flap = useCallback(() => {
    if (status === 'ready' || status === 'over') {
      startGame();
      return;
    }
    if (stateRef.current?.running) {
      stateRef.current.player.velocity = JUMP;
    }
  }, [startGame, status]);

  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    if (!stateRef.current) {
      stateRef.current = {
        player: { x: 86, y: HEIGHT / 2 - PLAYER_SIZE / 2, velocity: 0 },
        pipes: [],
        clouds: [
          { x: 80, y: 92 },
          { x: 250, y: 150 },
          { x: 390, y: 110 }
        ],
        score: 0,
        running: false
      };
    }

    function loop() {
      const state = stateRef.current;
      if (state.running) {
        state.player.velocity += GRAVITY;
        state.player.y += state.player.velocity;
        state.clouds.forEach((cloud) => {
          cloud.x = cloud.x < -60 ? WIDTH + 40 : cloud.x - 0.35;
        });
        state.pipes.forEach((pipe) => {
          pipe.x -= 2.4;
          if (!pipe.scored && pipe.x + PIPE_WIDTH < state.player.x) {
            pipe.scored = true;
            state.score += 1;
            setScore(state.score);
          }
        });
        if (state.pipes[0]?.x < -PIPE_WIDTH) {
          state.pipes.shift();
          const lastX = state.pipes[state.pipes.length - 1]?.x || WIDTH;
          state.pipes.push({
            x: lastX + 230,
            top: 86 + Math.floor(Math.random() * 240),
            scored: false
          });
        }

        const hitGround = state.player.y + PLAYER_SIZE >= HEIGHT - 46;
        const hitCeiling = state.player.y <= 0;
        const hitPipe = state.pipes.some((pipe) => {
          const overlapsX =
            state.player.x < pipe.x + PIPE_WIDTH && state.player.x + PLAYER_SIZE > pipe.x;
          const outsideGap =
            state.player.y < pipe.top || state.player.y + PLAYER_SIZE > pipe.top + GAP;
          return overlapsX && outsideGap;
        });

        if (hitGround || hitCeiling || hitPipe) {
          state.running = false;
          setStatus('over');
          setBest((currentBest) => {
            const nextBest = Math.max(currentBest, state.score);
            localStorage.setItem('eventi-forette-best', String(nextBest));
            return nextBest;
          });
        }
      }

      draw(ctx, state);
      frameRef.current = requestAnimationFrame(loop);
    }

    frameRef.current = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(frameRef.current);
  }, [draw]);

  useEffect(() => {
    function handleKey(event) {
      if (event.code === 'Space') {
        event.preventDefault();
        flap();
      }
    }
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [flap]);

  async function saveScore(event) {
    event.preventDefault();
    if (!playerName.trim()) return;
    await api.saveScore({ playerName, score });
    setSaved(true);
    setPlayerName('');
    loadLeaderboard();
  }

  return (
    <div className="page">
      <section className="page-heading">
        <SectionTitle kicker="Arcade" title="Forette Fly">
          Salta tra gli ostacoli, salva il punteggio e prova la classifica settimanale.
        </SectionTitle>
        <div className="score-box">
          <span>Punti {score}</span>
          <strong>Best {best}</strong>
        </div>
      </section>

      <section className="arcade-layout">
        <div className="game-wrap">
          <canvas
            ref={canvasRef}
            width={WIDTH}
            height={HEIGHT}
            className="game-canvas"
            onPointerDown={flap}
          />
          {status !== 'playing' && (
            <div className="game-overlay">
              <h3>{status === 'over' ? 'Game over' : 'Forette Fly'}</h3>
              <p>
                {status === 'over'
                  ? `Hai totalizzato ${score} punti.`
                  : 'Tocca, clicca o premi spazio per volare.'}
              </p>
              <button className="primary-button" onClick={startGame}>
                <RotateCcw size={18} />
                {status === 'over' ? 'Rigioca' : 'Inizia'}
              </button>
            </div>
          )}
        </div>

        <aside className="leaderboard-card">
          <div className="leaderboard-title">
            <Trophy size={22} />
            <div>
              <h3>Classifica settimanale</h3>
              <span>{leaderboard.weekRef}</span>
            </div>
          </div>
          <p className="coupon-note">
            Ogni settimana il primo classificato potrà ricevere uno sconto del 20% su un evento
            selezionato.
          </p>
          {status === 'over' && !saved && (
            <form onSubmit={saveScore} className="score-form">
              <input
                value={playerName}
                onChange={(event) => setPlayerName(event.target.value)}
                maxLength="40"
                placeholder="Nome giocatore"
              />
              <button className="primary-button" type="submit">
                Salva
              </button>
            </form>
          )}
          {saved && <p className="alert success">Punteggio salvato.</p>}
          <ol className="leaderboard-list">
            {leaderboard.scores.map((entry) => (
              <li key={entry.id}>
                <span>{entry.player_name}</span>
                <strong>{entry.score}</strong>
              </li>
            ))}
          </ol>
          {leaderboard.scores.length === 0 && <div className="empty-state">Ancora nessun punteggio.</div>}
        </aside>
      </section>
    </div>
  );
}

function roundRect(ctx, x, y, width, height, radius) {
  ctx.beginPath();
  ctx.moveTo(x + radius, y);
  ctx.arcTo(x + width, y, x + width, y + height, radius);
  ctx.arcTo(x + width, y + height, x, y + height, radius);
  ctx.arcTo(x, y + height, x, y, radius);
  ctx.arcTo(x, y, x + width, y, radius);
  ctx.closePath();
}
