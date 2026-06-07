import { useEffect, useState } from 'react';
import { NavLink, Outlet, useLocation } from 'react-router-dom';
import { CalendarDays, Gamepad2, Home, Shield, Trophy, UserCircle } from 'lucide-react';
import { getCurrentUser, isAdminUser } from './lib/api.js';

export default function App() {
  const [menuOpen, setMenuOpen] = useState(false);
  const [user, setUser] = useState(() => getCurrentUser());
  const location = useLocation();

  useEffect(() => {
    setMenuOpen(false);
  }, [location.pathname]);

  useEffect(() => {
    document.body.classList.toggle('nav-open', menuOpen);
    return () => document.body.classList.remove('nav-open');
  }, [menuOpen]);

  useEffect(() => {
    function handleUserChange(event) {
      setUser(event.detail || getCurrentUser());
    }
    window.addEventListener('eventi-forette-user', handleUserChange);
    window.addEventListener('storage', handleUserChange);
    return () => {
      window.removeEventListener('eventi-forette-user', handleUserChange);
      window.removeEventListener('storage', handleUserChange);
    };
  }, []);

  return (
    <div className="app-shell">
      <header className={`site-header ${menuOpen ? 'menu-is-open' : ''}`}>
        <NavLink to="/" className="brand" aria-label="Eventi Forette home">
          <span className="brand-mark">EF</span>
          <span>Eventi Forette</span>
        </NavLink>
        <button
          className="menu-toggle"
          type="button"
          aria-label={menuOpen ? 'Chiudi menu' : 'Apri menu'}
          aria-expanded={menuOpen}
          onClick={() => setMenuOpen((open) => !open)}
        >
          <span />
          <span />
        </button>
        <div
          className={`nav-backdrop ${menuOpen ? 'open' : ''}`}
          onClick={() => setMenuOpen(false)}
          aria-hidden="true"
        />
        <nav
          className={`main-nav ${menuOpen ? 'open' : ''}`}
          aria-label="Navigazione principale"
          onClick={(event) => {
            if (event.target.closest('a')) setMenuOpen(false);
          }}
        >
          <NavLink to="/">
            <Home size={18} />
            Home
          </NavLink>
          <NavLink to="/calendario">
            <CalendarDays size={18} />
            Calendario
          </NavLink>
          <NavLink to="/tornei">
            <Trophy size={18} />
            Tornei
          </NavLink>
          <NavLink to="/arcade">
            <Gamepad2 size={18} />
            Arcade
          </NavLink>
          <NavLink to="/account">
            <UserCircle size={18} />
            {user ? user.displayName : 'Accedi'}
          </NavLink>
          {isAdminUser(user) && (
            <NavLink to="/admin">
              <Shield size={18} />
              Admin
            </NavLink>
          )}
        </nav>
      </header>
      <main>
        <Outlet />
      </main>
      <footer className="site-footer">
        <strong>Eventi Forette</strong>
        <span>Feste, iniziative e socialita locale a Forette, Verona.</span>
      </footer>
    </div>
  );
}
