import { useCallback, useEffect, useRef, useState } from 'react';
import { BadgePercent, ChevronDown, Gift, Medal, RotateCcw, Sparkles, Target, Trophy, Zap } from 'lucide-react';
import SectionTitle from '../components/SectionTitle.jsx';
import { api } from '../lib/api.js';

const WIDTH = 420;
const HEIGHT = 560;
const PLAYER_SIZE = 30;
const GROUND_HEIGHT = 46;
const DIFFICULTY_CONFIG = {
  baseGravity: 0.34,
  maxGravity: 0.42,
  jump: -6.65,
  pipeWidth: 64,
  baseGap: 164,
  minGap: 132,
  baseSpeed: 2.25,
  maxSpeed: 3.25,
  baseSpacing: 246,
  minSpacing: 198,
  maxDifficulty: 1,
  scoreWeight: 0.062,
  timeWeight: 0.012,
  levelBoost: {
    Bronzo: 0,
    Argento: 0.08,
    Oro: 0.14
  }
};
const LEVEL_NAMES = ['Bronzo', 'Argento', 'Oro'];

export default function ArcadePage() {
  const canvasRef = useRef(null);
  const frameRef = useRef(null);
  const stateRef = useRef(null);
  const lastTimeRef = useRef(0);
  const [status, setStatus] = useState('ready');
  const [score, setScore] = useState(0);
  const [best, setBest] = useState(() => Number(localStorage.getItem('eventi-forette-best') || 0));
  const [playerName, setPlayerName] = useState(() => localStorage.getItem('eventi-forette-player-name') || '');
  const [leaderboard, setLeaderboard] = useState({ weekRef: '', scores: [] });
  const [profile, setProfile] = useState(null);
  const [saved, setSaved] = useState(false);
  const [saveError, setSaveError] = useState('');
  const [rewardMessage, setRewardMessage] = useState('');
  const [leaderboardExpanded, setLeaderboardExpanded] = useState(false);

  const loadLeaderboard = useCallback(() => {
    api.getLeaderboard().then(setLeaderboard).catch(() => setLeaderboard({ weekRef: '', scores: [] }));
  }, []);

  useEffect(() => {
    loadLeaderboard();
  }, [loadLeaderboard]);

  const loadProfile = useCallback((name = playerName) => {
    if (!name.trim()) {
      setProfile(null);
      return;
    }
    api.getArcadeProfile(name).then(setProfile).catch(() => setProfile(null));
  }, [playerName]);

  useEffect(() => {
    if (playerName.trim()) loadProfile(playerName);
  }, []);

  const draw = useCallback((ctx, state) => {
    const safeState = normalizeGameState(state);
    const difficulty = getDifficultyLevel({
      score: safeState.score,
      elapsedMs: safeState.startedAt ? Date.now() - safeState.startedAt : 0,
      userLevel: safeState.userLevel
    });

    ctx.clearRect(0, 0, WIDTH, HEIGHT);
    const sky = ctx.createLinearGradient(0, 0, 0, HEIGHT);
    sky.addColorStop(0, '#66d8ff');
    sky.addColorStop(0.52, '#dff7ff');
    sky.addColorStop(1, '#ffffff');
    ctx.fillStyle = sky;
    ctx.fillRect(0, 0, WIDTH, HEIGHT);

    ctx.fillStyle = 'rgba(255, 214, 71, 0.64)';
    ctx.beginPath();
    ctx.arc(350, 74, 42, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = 'rgba(255, 255, 255, 0.2)';
    ctx.fillRect(0, 0, WIDTH, 74);

    ctx.fillStyle = '#f6fbff';
    for (const cloud of safeState.clouds) {
      ctx.beginPath();
      ctx.ellipse(cloud.x, cloud.y, 34, 14, 0, 0, Math.PI * 2);
      ctx.ellipse(cloud.x + 24, cloud.y + 4, 28, 12, 0, 0, Math.PI * 2);
      ctx.ellipse(cloud.x - 22, cloud.y + 5, 22, 10, 0, 0, Math.PI * 2);
      ctx.fill();
    }

    for (const pipe of safeState.pipes) {
      const pipeGradient = ctx.createLinearGradient(pipe.x, 0, pipe.x + DIFFICULTY_CONFIG.pipeWidth, 0);
      pipeGradient.addColorStop(0, '#ffd447');
      pipeGradient.addColorStop(0.55, '#fff0a1');
      pipeGradient.addColorStop(1, '#f5b700');
      ctx.fillStyle = pipeGradient;
      fillRoundRect(ctx, pipe.x, -12, DIFFICULTY_CONFIG.pipeWidth, pipe.top + 12, 6);
      fillRoundRect(
        ctx,
        pipe.x,
        pipe.top + pipe.gap,
        DIFFICULTY_CONFIG.pipeWidth,
        HEIGHT - pipe.top - pipe.gap - GROUND_HEIGHT + 8,
        6
      );

      ctx.fillStyle = '#e5a800';
      fillRoundRect(ctx, pipe.x - 7, pipe.top - 18, DIFFICULTY_CONFIG.pipeWidth + 14, 18, 5);
      fillRoundRect(ctx, pipe.x - 7, pipe.top + pipe.gap, DIFFICULTY_CONFIG.pipeWidth + 14, 18, 5);

      ctx.fillStyle = 'rgba(255, 255, 255, 0.38)';
      fillRoundRect(ctx, pipe.x + 10, 0, 7, Math.max(0, pipe.top - 26), 4);
      fillRoundRect(
        ctx,
        pipe.x + 10,
        pipe.top + pipe.gap + 26,
        7,
        Math.max(0, HEIGHT - pipe.top - pipe.gap - GROUND_HEIGHT - 28),
        4
      );

      ctx.strokeStyle = 'rgba(181, 132, 0, 0.24)';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(pipe.x + DIFFICULTY_CONFIG.pipeWidth - 2, 0);
      ctx.lineTo(pipe.x + DIFFICULTY_CONFIG.pipeWidth - 2, pipe.top - 18);
      ctx.moveTo(pipe.x + DIFFICULTY_CONFIG.pipeWidth - 2, pipe.top + pipe.gap + 18);
      ctx.lineTo(pipe.x + DIFFICULTY_CONFIG.pipeWidth - 2, HEIGHT - GROUND_HEIGHT + 8);
      ctx.stroke();
    }

    const ground = ctx.createLinearGradient(0, HEIGHT - GROUND_HEIGHT, 0, HEIGHT);
    ground.addColorStop(0, '#25aeea');
    ground.addColorStop(1, '#117dab');
    ctx.fillStyle = ground;
    ctx.fillRect(0, HEIGHT - GROUND_HEIGHT, WIDTH, GROUND_HEIGHT);
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, HEIGHT - GROUND_HEIGHT, WIDTH, 8);
    ctx.fillStyle = 'rgba(255, 255, 255, 0.35)';
    for (let x = -20; x < WIDTH + 20; x += 38) {
      ctx.fillRect(x - (safeState.groundOffset % 38), HEIGHT - 26, 18, 3);
    }

    const { player } = safeState;
    ctx.save();
    ctx.translate(player.x + PLAYER_SIZE / 2, player.y + PLAYER_SIZE / 2);
    ctx.rotate(Math.max(-0.35, Math.min(0.45, player.velocity / 10)));
    ctx.fillStyle = '#ffd447';
    fillRoundRect(ctx, -15, -15, 30, 30, 9);
    ctx.fillStyle = '#f5b700';
    fillRoundRect(ctx, -14, 7, 26, 7, 5);
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

    for (const effect of safeState.effects) {
      ctx.save();
      ctx.globalAlpha = effect.alpha;
      ctx.fillStyle = effect.color;
      ctx.font = '900 18px Inter, system-ui';
      ctx.fillText(effect.text, effect.x, effect.y);
      ctx.restore();
    }

    const hudGradient = ctx.createLinearGradient(18, 14, 184, 14);
    hudGradient.addColorStop(0, 'rgba(255, 255, 255, 0.92)');
    hudGradient.addColorStop(1, 'rgba(255, 255, 255, 0.72)');
    ctx.fillStyle = hudGradient;
    fillRoundRect(ctx, 16, 14, 170, 50, 18);
    ctx.fillStyle = '#15324a';
    ctx.font = `${safeState.scorePulse > 0 ? 900 : 800} ${safeState.scorePulse > 0 ? 34 : 30}px Inter, system-ui`;
    ctx.fillText(String(safeState.score), 30, 49);
    ctx.fillStyle = '#63758a';
    ctx.font = '800 11px Inter, system-ui';
    ctx.fillText(`Difficolta ${difficulty.label}`, 82, 44);

    ctx.fillStyle = 'rgba(17, 125, 171, 0.16)';
    fillRoundRect(ctx, 242, 24, 132, 12, 6);
    ctx.fillStyle = '#25aeea';
    fillRoundRect(ctx, 242, 24, Math.max(4, 132 * difficulty.progress), 12, 6);
  }, []);

  const startGame = useCallback(() => {
    const userLevel = profile?.user?.level?.name || 'Bronzo';
    const openingDifficulty = getDifficultyLevel({ score: 0, elapsedMs: 0, userLevel });
    const initialState = {
      player: { x: 86, y: HEIGHT / 2 - PLAYER_SIZE / 2, velocity: 0 },
      pipes: [
        createPipe(WIDTH + 90, openingDifficulty),
        createPipe(WIDTH + 90 + openingDifficulty.spacing, openingDifficulty)
      ],
      clouds: [
        { x: 80, y: 92 },
        { x: 250, y: 150 },
        { x: 390, y: 110 }
      ],
      effects: [],
      groundOffset: 0,
      scorePulse: 0,
      userLevel,
      score: 0,
      running: true,
      paused: false,
      startedAt: Date.now(),
      runId: `run-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`
    };
    stateRef.current = initialState;
    setScore(0);
    setSaved(false);
    setSaveError('');
    setRewardMessage('');
    setStatus('playing');
  }, [profile]);

  const flap = useCallback(() => {
    if (status === 'ready' || status === 'over') {
      startGame();
      return;
    }
    if (stateRef.current?.running && !stateRef.current.paused) {
      stateRef.current.player.velocity = DIFFICULTY_CONFIG.jump;
    }
  }, [startGame, status]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return undefined;
    const ctx = canvas.getContext('2d');
    if (!ctx) return undefined;
    if (!stateRef.current) {
      const openingDifficulty = getDifficultyLevel({ score: 0, elapsedMs: 0, userLevel: 'Bronzo' });
      stateRef.current = {
        player: { x: 86, y: HEIGHT / 2 - PLAYER_SIZE / 2, velocity: 0 },
        pipes: [
          createPipe(WIDTH + 100, openingDifficulty),
          createPipe(WIDTH + 100 + openingDifficulty.spacing, openingDifficulty)
        ],
        clouds: [
          { x: 80, y: 92 },
          { x: 250, y: 150 },
          { x: 390, y: 110 }
        ],
        effects: [],
        groundOffset: 0,
        scorePulse: 0,
        userLevel: 'Bronzo',
        score: 0,
        running: false,
        paused: false
      };
    }

    function loop(timestamp) {
      const state = normalizeGameState(stateRef.current);
      stateRef.current = state;
      const delta = Math.min(1.8, Math.max(0.7, (timestamp - (lastTimeRef.current || timestamp)) / 16.67));
      lastTimeRef.current = timestamp;

      if (state.running && !state.paused) {
        const elapsedMs = state.startedAt ? Date.now() - state.startedAt : 0;
        const difficulty = getDifficultyLevel({
          score: state.score,
          elapsedMs,
          userLevel: state.userLevel
        });

        state.player.velocity += difficulty.gravity * delta;
        state.player.y += state.player.velocity * delta;
        state.groundOffset += difficulty.speed * delta;
        state.scorePulse = Math.max(0, state.scorePulse - 0.06 * delta);
        state.effects = state.effects
          .map((effect) => ({
            ...effect,
            y: effect.y - effect.rise * delta,
            alpha: Math.max(0, effect.alpha - 0.035 * delta)
          }))
          .filter((effect) => effect.alpha > 0);
        state.clouds.forEach((cloud) => {
          cloud.x = cloud.x < -70 ? WIDTH + 50 : cloud.x - (0.28 + difficulty.progress * 0.3) * delta;
        });
        state.pipes.forEach((pipe) => {
          pipe.x -= difficulty.speed * delta;
          if (!pipe.scored && pipe.x + DIFFICULTY_CONFIG.pipeWidth < state.player.x) {
            pipe.scored = true;
            state.score += 1;
            state.scorePulse = 1;
            state.effects.push({
              text: '+1',
              x: state.player.x + 38,
              y: state.player.y + 10,
              alpha: 1,
              rise: 1.1,
              color: '#116149'
            });
            setScore(state.score);
          }
        });
        if (state.pipes[0]?.x < -DIFFICULTY_CONFIG.pipeWidth - 12) {
          state.pipes.shift();
          const lastX = state.pipes[state.pipes.length - 1]?.x || WIDTH;
          state.pipes.push(createPipe(lastX + difficulty.spacing, difficulty));
        }

        const hitGround = state.player.y + PLAYER_SIZE >= HEIGHT - GROUND_HEIGHT;
        const hitCeiling = state.player.y <= 0;
        const hitPipe = state.pipes.some((pipe) => {
          const overlapsX =
            state.player.x < pipe.x + DIFFICULTY_CONFIG.pipeWidth && state.player.x + PLAYER_SIZE > pipe.x;
          const outsideGap =
            state.player.y < pipe.top || state.player.y + PLAYER_SIZE > pipe.top + pipe.gap;
          return overlapsX && outsideGap;
        });

        if (hitGround || hitCeiling || hitPipe) {
          state.running = false;
          if (navigator.vibrate) navigator.vibrate(45);
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
    function pauseGame() {
      if (stateRef.current?.running) {
        stateRef.current.paused = true;
        setStatus('paused');
      }
    }

    function resumeGame() {
      if (stateRef.current?.running && stateRef.current.paused) {
        stateRef.current.paused = false;
        lastTimeRef.current = 0;
        setStatus('playing');
      }
    }

    function handleVisibilityChange() {
      if (document.hidden) pauseGame();
    }

    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('blur', pauseGame);
    window.addEventListener('focus', resumeGame);

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('blur', pauseGame);
      window.removeEventListener('focus', resumeGame);
    };
  }, []);

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
    const activeState = stateRef.current;
    const durationMs = activeState?.startedAt ? Date.now() - activeState.startedAt : 0;

    try {
      const result = await api.saveScore({
        playerName,
        score,
        durationMs,
        runId: activeState?.runId
      });
      localStorage.setItem('eventi-forette-player-name', playerName.trim());
      setSaved(true);
      setSaveError('');
      if (result.profile) {
        setProfile(result.profile);
        const completed = result.profile.completedMissions?.map((mission) => mission.title).join(', ');
        const coupons = result.profile.generatedCoupons?.map((coupon) => coupon.code).join(', ');
        setRewardMessage(
          [completed ? `Missione completata: ${completed}.` : '', coupons ? `Coupon generato: ${coupons}.` : '']
            .filter(Boolean)
            .join(' ')
        );
      }
      loadLeaderboard();
    } catch (error) {
      setSaveError(error.message);
    }
  }

  const currentDifficulty = getDifficultyLevel({
    score,
    elapsedMs: stateRef.current?.startedAt ? Date.now() - stateRef.current.startedAt : 0,
    userLevel: profile?.user?.level?.name || 'Bronzo'
  });

  return (
    <div className="page">
      <section className="page-heading">
        <SectionTitle kicker="Arcade" title="Forette Fly">
          Salta tra gli ostacoli, salva il punteggio e prova la classifica settimanale.
        </SectionTitle>
        <div className="score-box">
          <span>Punti {score}</span>
          <strong>Best {best}</strong>
          <small>{currentDifficulty.label}</small>
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
            <div className={`game-overlay game-overlay-${status}`}>
              <span className="arcade-chip">{status === 'over' ? `${score} punti` : currentDifficulty.label}</span>
              <h3>{status === 'over' ? 'Game over' : status === 'paused' ? 'Pausa' : 'Forette Fly'}</h3>
              <p>
                {status === 'over'
                  ? `Hai totalizzato ${score} punti.`
                  : status === 'paused'
                    ? 'Torna sulla pagina per continuare.'
                    : 'Tocca, clicca o premi spazio per volare.'}
              </p>
              <div className="overlay-meter" aria-label={`Difficolta ${Math.round(currentDifficulty.progress * 100)}%`}>
                <span style={{ width: `${Math.max(6, currentDifficulty.progress * 100)}%` }} />
              </div>
              <button
                className="primary-button"
                onClick={() => {
                  if (status === 'paused' && stateRef.current) {
                    stateRef.current.paused = false;
                    lastTimeRef.current = 0;
                    setStatus('playing');
                    return;
                  }
                  startGame();
                }}
              >
                <RotateCcw size={18} />
                {status === 'over' ? 'Rigioca' : status === 'paused' ? 'Riprendi' : 'Inizia'}
              </button>
            </div>
          )}
        </div>

        <aside className={`leaderboard-card ${status === 'playing' ? 'is-compact' : ''}`}>
          {status === 'over' && (
            <PostGameSummary
              score={score}
              best={best}
              profile={profile}
              saved={saved}
              rewardMessage={rewardMessage}
              onReplay={startGame}
            />
          )}
          {status === 'over' && !saved && (
            <form onSubmit={saveScore} className="score-form">
              <input
                value={playerName}
                onChange={(event) => setPlayerName(event.target.value)}
                onBlur={() => loadProfile(playerName)}
                maxLength="40"
                placeholder="Nome giocatore"
              />
              <button className="primary-button" type="submit">
                Salva
              </button>
            </form>
          )}
          {saved && <p className="alert success">Punteggio salvato.</p>}
          {rewardMessage && <p className="alert success reward-flash">{rewardMessage}</p>}
          {saveError && <p className="alert">{saveError}</p>}
          <LeaderboardPanel
            leaderboard={leaderboard}
            playerName={playerName}
            expanded={leaderboardExpanded}
            onToggle={() => setLeaderboardExpanded((expanded) => !expanded)}
          />
        </aside>
      </section>

      {profile && <ArcadeProfile profile={profile} />}
      {profile && <ArcadeRewards profile={profile} />}
    </div>
  );
}

function PostGameSummary({ score, best, profile, saved, rewardMessage, onReplay }) {
  const level = profile?.user?.level?.name || 'Bronzo';
  const credit = profile?.user?.arcadeCredit || 0;

  return (
    <section className="post-game-summary" aria-label="Riepilogo partita">
      <span className="summary-kicker">
        <Sparkles size={15} />
        Run completata
      </span>
      <div className="summary-score">
        <span>Score</span>
        <strong>{score}</strong>
      </div>
      <div className="summary-rewards">
        <span>Best {best}</span>
        <span>{level}</span>
        <span>{credit} crediti</span>
      </div>
      <p>{saved ? rewardMessage || 'Progressi aggiornati.' : 'Salva la run per sbloccare XP, crediti e coupon.'}</p>
      <button className="primary-button replay-button" type="button" onClick={onReplay}>
        <RotateCcw size={18} />
        Rigioca
      </button>
    </section>
  );
}

function LeaderboardPanel({ leaderboard, playerName, expanded, onToggle }) {
  const visibleScores = expanded ? leaderboard.scores : leaderboard.scores.slice(0, 3);

  return (
    <div className="leaderboard-panel">
      <div className="leaderboard-title">
        <Trophy size={22} />
        <div>
          <h3>Top arcade</h3>
          <span>{leaderboard.weekRef}</span>
        </div>
      </div>
      <ol className="leaderboard-list">
        {visibleScores.map((entry, index) => {
          const isCurrentUser =
            playerName.trim() && entry.player_name.toLowerCase() === playerName.trim().toLowerCase();
          return (
            <li key={entry.id} className={isCurrentUser ? 'current-player' : ''}>
              <span className="leaderboard-rank">{index + 1}</span>
              <span className="leaderboard-avatar">{entry.player_name.slice(0, 1).toUpperCase()}</span>
              <span>{entry.player_name}</span>
              <strong>{entry.score}</strong>
            </li>
          );
        })}
      </ol>
      {leaderboard.scores.length === 0 && <div className="empty-state">Ancora nessun punteggio.</div>}
      {leaderboard.scores.length > 3 && (
        <button className="leaderboard-toggle" type="button" onClick={onToggle}>
          {expanded ? 'Mostra top 3' : `Vedi tutti (${leaderboard.scores.length})`}
          <ChevronDown size={16} className={expanded ? 'is-open' : ''} />
        </button>
      )}
    </div>
  );
}

function ArcadeProfile({ profile }) {
  const { user } = profile;
  const nextLabel = user.level.nextMinXp ? `${user.xp}/${user.level.nextMinXp} XP` : `${user.xp} XP`;
  const nextReward = user.level.name === 'Bronzo' ? 'Argento sblocca coupon migliori' : user.level.name === 'Argento' ? 'Oro sblocca reward premium' : 'Reward premium attivi';

  return (
    <section className="arcade-profile" aria-label="Profilo arcade">
      <div className="level-card">
        <div className="leaderboard-title">
          <span className="level-emblem">
            <Medal size={22} />
          </span>
          <div>
            <h3>Livello {user.level.name}</h3>
            <span>{nextLabel}</span>
          </div>
          <strong className="credit-badge">{user.arcadeCredit} cr</strong>
        </div>
        <div className="level-progress" aria-label={`Avanzamento livello ${user.progressToNext}%`}>
          <span style={{ width: `${user.progressToNext}%` }} />
        </div>
        <div className="next-reward">
          <Zap size={15} />
          {nextReward}
        </div>
      </div>
      <div className="level-benefits">
        {user.level.benefits.map((benefit) => (
          <span key={benefit}>{benefit}</span>
        ))}
      </div>
    </section>
  );
}

function ArcadeRewards({ profile }) {
  const activeCoupons = profile.coupons.filter((coupon) => coupon.status === 'unused');
  const inactiveCoupons = profile.coupons.filter((coupon) => coupon.status !== 'unused');

  return (
    <section className="arcade-rewards-grid">
      <article className="missions-card">
        <div className="leaderboard-title">
          <Target size={22} />
          <div>
            <h3>Quest arcade</h3>
            <span>Scadono il {formatDateTime(profile.missions[0]?.expires_at)}</span>
          </div>
        </div>
        <div className="mission-list">
          {profile.missions.map((mission) => (
            <div key={mission.id} className={`mission-item ${mission.completed ? 'completed' : ''}`}>
              <span className="mission-icon">
                <Target size={16} />
              </span>
              <div>
                <strong>{mission.title}</strong>
                <p>{compactMissionText(mission)}</p>
              </div>
              <span className="mission-count">
                {mission.current_progress}/{mission.target}
              </span>
              <div className="mission-progress">
                <span style={{ width: `${Math.min(100, (mission.current_progress / mission.target) * 100)}%` }} />
              </div>
              <small className="mission-reward">
                +{mission.reward_xp} XP · +{mission.reward_credit} cr
              </small>
            </div>
          ))}
        </div>
      </article>

      <article className="coupons-card">
        <div className="leaderboard-title">
          <BadgePercent size={22} />
          <div>
            <h3>Reward ticket</h3>
            <span>{activeCoupons.length} attivi · {inactiveCoupons.length} scaduti o usati</span>
          </div>
        </div>
        <CouponList coupons={activeCoupons} emptyText="Nessun coupon attivo." />
        {inactiveCoupons.length > 0 && (
          <>
            <h4>Archivio</h4>
            <CouponList coupons={inactiveCoupons} emptyText="" />
          </>
        )}
      </article>
    </section>
  );
}

function CouponList({ coupons, emptyText }) {
  if (coupons.length === 0) {
    return emptyText ? <div className="empty-state">{emptyText}</div> : null;
  }

  return (
    <div className="coupon-list">
      {coupons.map((coupon) => (
        <div key={coupon.id} className={`coupon-item ${coupon.status}`}>
          <span className="coupon-ticket-icon">
            <Gift size={18} />
          </span>
          <div>
            <strong>{coupon.code}</strong>
            <span>
              {coupon.discount_value}% sconto
              {coupon.event_title ? ` · ${coupon.event_title}` : ''}
            </span>
          </div>
          <small>{coupon.status === 'unused' ? couponCountdown(coupon.expires_at) : coupon.status}</small>
        </div>
      ))}
    </div>
  );
}

function compactMissionText(mission) {
  if (mission.mission_key === 'weekly_plays_3') return '3 partite arcade';
  if (mission.mission_key === 'weekly_score_1000') return '1000 punti totali';
  if (mission.mission_key === 'weekly_challenge_1') return 'Completa 1 sfida';
  return mission.description;
}

function couponCountdown(value) {
  const days = Math.ceil((new Date(value).getTime() - Date.now()) / 86400000);
  if (!Number.isFinite(days) || days <= 0) return 'Scade oggi';
  if (days === 1) return '1 giorno';
  return `${days} giorni`;
}

function formatDateTime(value) {
  if (!value) return '';
  return new Intl.DateTimeFormat('it-IT', { day: '2-digit', month: 'short' }).format(new Date(value));
}

function getDifficultyLevel({ score = 0, elapsedMs = 0, userLevel = 'Bronzo' }) {
  const levelName = LEVEL_NAMES.includes(userLevel) ? userLevel : 'Bronzo';
  const elapsedSeconds = Math.max(0, elapsedMs / 1000);
  const raw =
    1 -
    Math.exp(
      -(score * DIFFICULTY_CONFIG.scoreWeight +
        elapsedSeconds * DIFFICULTY_CONFIG.timeWeight +
        DIFFICULTY_CONFIG.levelBoost[levelName])
    );
  const progress = clamp(raw, 0, DIFFICULTY_CONFIG.maxDifficulty);
  const speed = lerp(DIFFICULTY_CONFIG.baseSpeed, DIFFICULTY_CONFIG.maxSpeed, progress);
  const gap = Math.round(lerp(DIFFICULTY_CONFIG.baseGap, DIFFICULTY_CONFIG.minGap, progress));
  const spacing = Math.round(lerp(DIFFICULTY_CONFIG.baseSpacing, DIFFICULTY_CONFIG.minSpacing, progress));
  const gravity = lerp(DIFFICULTY_CONFIG.baseGravity, DIFFICULTY_CONFIG.maxGravity, progress);

  return {
    progress,
    speed,
    gap,
    spacing,
    gravity,
    label: progress > 0.78 ? 'Esperto' : progress > 0.48 ? 'Medio' : 'Soft'
  };
}

function createPipe(x, difficulty) {
  const minTop = 82;
  const maxTop = HEIGHT - GROUND_HEIGHT - difficulty.gap - 74;
  return {
    x,
    top: minTop + Math.floor(Math.random() * Math.max(1, maxTop - minTop)),
    gap: difficulty.gap,
    scored: false
  };
}

function normalizeGameState(state) {
  const fallbackDifficulty = getDifficultyLevel({ score: 0, elapsedMs: 0, userLevel: 'Bronzo' });
  const player = state?.player || { x: 86, y: HEIGHT / 2 - PLAYER_SIZE / 2, velocity: 0 };
  const pipes = Array.isArray(state?.pipes)
    ? state.pipes.filter(
        (pipe) =>
          Number.isFinite(pipe.x) &&
          Number.isFinite(pipe.top) &&
          Number.isFinite(pipe.gap) &&
          pipe.gap > 0
      )
    : [];
  return {
    player: {
      x: Number.isFinite(player.x) ? clamp(player.x, 12, WIDTH - PLAYER_SIZE - 12) : 86,
      y: Number.isFinite(player.y) ? clamp(player.y, 0, HEIGHT - GROUND_HEIGHT - PLAYER_SIZE) : HEIGHT / 2 - PLAYER_SIZE / 2,
      velocity: Number.isFinite(player.velocity) ? clamp(player.velocity, -12, 12) : 0
    },
    pipes:
      pipes.length > 0
        ? pipes
        : [createPipe(WIDTH + 100, fallbackDifficulty), createPipe(WIDTH + 100 + fallbackDifficulty.spacing, fallbackDifficulty)],
    clouds: Array.isArray(state?.clouds)
      ? state.clouds.filter((cloud) => Number.isFinite(cloud.x) && Number.isFinite(cloud.y))
      : [
          { x: 80, y: 92 },
          { x: 250, y: 150 },
          { x: 390, y: 110 }
        ],
    effects: Array.isArray(state?.effects) ? state.effects : [],
    groundOffset: Number.isFinite(state?.groundOffset) ? state.groundOffset : 0,
    scorePulse: Number.isFinite(state?.scorePulse) ? state.scorePulse : 0,
    userLevel: LEVEL_NAMES.includes(state?.userLevel) ? state.userLevel : 'Bronzo',
    score: Number.isFinite(state?.score) ? state.score : 0,
    running: Boolean(state?.running),
    paused: Boolean(state?.paused),
    startedAt: Number.isFinite(state?.startedAt) ? state.startedAt : null,
    runId: state?.runId || null
  };
}

function lerp(start, end, progress) {
  return start + (end - start) * progress;
}

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function fillRoundRect(ctx, x, y, width, height, radius) {
  if (!Number.isFinite(x) || !Number.isFinite(y) || !Number.isFinite(width) || !Number.isFinite(height)) {
    return;
  }
  if (width <= 0 || height <= 0) return;
  roundRect(ctx, x, y, width, height, radius);
  ctx.fill();
}

function roundRect(ctx, x, y, width, height, radius) {
  const safeRadius = Math.min(Math.max(0, radius), Math.abs(width) / 2, Math.abs(height) / 2);
  ctx.beginPath();
  ctx.moveTo(x + safeRadius, y);
  ctx.arcTo(x + width, y, x + width, y + height, safeRadius);
  ctx.arcTo(x + width, y + height, x, y + height, safeRadius);
  ctx.arcTo(x, y + height, x, y, safeRadius);
  ctx.arcTo(x, y, x + width, y, safeRadius);
  ctx.closePath();
}
