import { useEffect, useState } from 'react';
import { NavLink, Outlet, useLocation } from 'react-router-dom';
import { CalendarDays, Gamepad2, Home, Shield } from 'lucide-react';

export default function App() {
  const [menuOpen, setMenuOpen] = useState(false);
  const location = useLocation();

  useEffect(() => {
    setMenuOpen(false);
  }, [location.pathname]);

  useEffect(() => {
    document.body.classList.toggle('nav-open', menuOpen);
    return () => document.body.classList.remove('nav-open');
  }, [menuOpen]);

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
          <NavLink to="/arcade">
            <Gamepad2 size={18} />
            Arcade
          </NavLink>
          <NavLink to="/admin">
            <Shield size={18} />
            Admin
          </NavLink>
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
