import { useEffect, useState } from 'react';
import { BadgePercent, LogOut, Medal, Trophy, UserPlus } from 'lucide-react';
import { Link } from 'react-router-dom';
import CouponQr from '../components/CouponQr.jsx';
import SectionTitle from '../components/SectionTitle.jsx';
import { api, getCurrentUser, logoutCurrentUser } from '../lib/api.js';

export default function AccountPage() {
  const [mode, setMode] = useState('login');
  const [user, setUser] = useState(() => getCurrentUser());
  const [form, setForm] = useState({ displayName: '', email: '', pin: '' });
  const [profile, setProfile] = useState(null);
  const [registrations, setRegistrations] = useState([]);
  const [message, setMessage] = useState('');

  useEffect(() => {
    if (!user) {
      setProfile(null);
      setRegistrations([]);
      return;
    }
    api.getArcadeProfile(user.displayName).then(setProfile).catch(() => setProfile(null));
    api.getTournamentRegistrations(user.id).then(setRegistrations).catch(() => setRegistrations([]));
  }, [user]);

  async function handleSubmit(event) {
    event.preventDefault();
    setMessage('');
    try {
      const nextUser = mode === 'register' ? await api.registerUser(form) : await api.loginUser(form);
      setUser(nextUser);
      setForm({ displayName: '', email: '', pin: '' });
    } catch (error) {
      setMessage(error.message);
    }
  }

  function updateField(field, value) {
    setForm((current) => ({ ...current, [field]: value }));
  }

  if (!user) {
    return (
      <div className="page narrow-page">
        <section className="auth-card account-auth-card">
          <SectionTitle kicker="Account" title={mode === 'register' ? 'Crea profilo' : 'Accedi'}>
            Usa un profilo per salvare punteggi, coupon e iscrizioni ai tornei.
          </SectionTitle>
          <div className="segmented-control">
            <button type="button" className={mode === 'login' ? 'active' : ''} onClick={() => setMode('login')}>
              Login
            </button>
            <button type="button" className={mode === 'register' ? 'active' : ''} onClick={() => setMode('register')}>
              Registrati
            </button>
          </div>
          <form className="stack-form" onSubmit={handleSubmit}>
            {mode === 'register' && (
              <label>
                Nome
                <input value={form.displayName} onChange={(event) => updateField('displayName', event.target.value)} required />
              </label>
            )}
            <label>
              Email
              <input type="email" value={form.email} onChange={(event) => updateField('email', event.target.value)} required />
            </label>
            <label>
              PIN
              <input
                type="password"
                inputMode="numeric"
                minLength="4"
                value={form.pin}
                onChange={(event) => updateField('pin', event.target.value)}
                required
              />
            </label>
            {message && <p className="alert">{message}</p>}
            <button className="primary-button" type="submit">
              <UserPlus size={18} />
              {mode === 'register' ? 'Crea account' : 'Accedi'}
            </button>
          </form>
        </section>
      </div>
    );
  }

  const activeCoupons = profile?.coupons?.filter((coupon) => coupon.status === 'unused') || [];
  const bestScore = profile ? null : null;

  return (
    <div className="page">
      <section className="page-heading account-heading">
        <SectionTitle kicker="Account" title={user.displayName}>
          Profilo, coupon, progressi arcade e iscrizioni.
        </SectionTitle>
        <button
          className="secondary-button"
          type="button"
          onClick={() => {
            logoutCurrentUser();
            setUser(null);
          }}
        >
          <LogOut size={18} />
          Esci
        </button>
      </section>

      <section className="account-grid">
        <article className="account-panel">
          <div className="leaderboard-title">
            <Medal size={22} />
            <div>
              <h3>Arcade</h3>
              <span>{profile?.user?.level?.name || 'Bronzo'} · {profile?.user?.xp || 0} XP</span>
            </div>
          </div>
          <div className="account-stats">
            <span>{profile?.user?.arcadeCredit || 0} crediti</span>
            <span>{activeCoupons.length} coupon attivi</span>
            <span>{bestScore || 'Classifica settimanale'}</span>
          </div>
          <Link className="primary-button" to="/arcade">
            Gioca arcade
          </Link>
        </article>

        <article className="account-panel">
          <div className="leaderboard-title">
            <BadgePercent size={22} />
            <div>
              <h3>Coupon</h3>
              <span>Reward salvati sul profilo</span>
            </div>
          </div>
          <div className="account-list">
            {activeCoupons.map((coupon) => (
              <div key={coupon.id} className="account-row account-coupon-row">
                <CouponQr coupon={coupon} size={74} />
                <strong>{coupon.code}</strong>
                <span>{coupon.discount_value}% sconto</span>
              </div>
            ))}
            {activeCoupons.length === 0 && <div className="empty-state">Nessun coupon attivo.</div>}
          </div>
        </article>

        <article className="account-panel account-panel-wide">
          <div className="leaderboard-title">
            <Trophy size={22} />
            <div>
              <h3>Tornei</h3>
              <span>{registrations.length} iscrizioni</span>
            </div>
          </div>
          <div className="account-list">
            {registrations.map((registration) => (
              <div key={registration.id} className="account-row">
                <strong>{registration.tournament?.name || 'Torneo'}</strong>
                <span>{registration.team_name} · {registration.status}</span>
              </div>
            ))}
            {registrations.length === 0 && <div className="empty-state">Nessuna iscrizione torneo.</div>}
          </div>
          <Link className="secondary-button" to="/tornei">
            Vai ai tornei
          </Link>
        </article>
      </section>
    </div>
  );
}
