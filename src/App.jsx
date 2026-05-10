import { NavLink, Outlet } from 'react-router-dom';
import { CalendarDays, Gamepad2, Home, Shield } from 'lucide-react';

export default function App() {
  return (
    <div className="app-shell">
      <header className="site-header">
        <NavLink to="/" className="brand" aria-label="Eventi Forette home">
          <span className="brand-mark">EF</span>
          <span>Eventi Forette</span>
        </NavLink>
        <nav className="main-nav" aria-label="Navigazione principale">
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
