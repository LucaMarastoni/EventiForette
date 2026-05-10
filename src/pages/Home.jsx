import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, CalendarDays, Gamepad2, Sparkles, Users } from 'lucide-react';
import EventCard from '../components/EventCard.jsx';
import SectionTitle from '../components/SectionTitle.jsx';
import { api } from '../lib/api.js';

export default function Home() {
  const [events, setEvents] = useState([]);

  useEffect(() => {
    api.getEvents().then((data) => setEvents(data.slice(0, 3))).catch(() => setEvents([]));
  }, []);

  return (
    <div className="page">
      <section className="hero">
        <div className="hero-content">
          <div className="hero-badge">
            <Sparkles size={18} />
            Forette si incontra
          </div>
          <h1>Eventi Forette</h1>
          <p>
            Il punto di riferimento per scoprire eventi, feste, attivita sociali e iniziative
            locali a Forette, in provincia di Verona.
          </p>
          <div className="hero-actions">
            <Link className="primary-button" to="/calendario">
              <CalendarDays size={20} />
              Vedi calendario
            </Link>
            <Link className="secondary-button" to="/arcade">
              <Gamepad2 size={20} />
              Gioca arcade
            </Link>
          </div>
        </div>
        <div className="hero-panel" aria-label="Anteprima prossimi eventi">
          <div className="floating-ticket">
            <strong>Prossimi eventi</strong>
            <span>{events.length || 3} appuntamenti in arrivo</span>
          </div>
          <div className="hero-calendar">
            {events.map((event) => (
              <div key={event.id} className="mini-event">
                <span>{event.date.slice(8, 10)}</span>
                <div>
                  <strong>{event.title}</strong>
                  <small>
                    {event.time} · {event.location}
                  </small>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="content-section">
        <SectionTitle kicker="In evidenza" title="Prossimi appuntamenti">
          Un assaggio delle iniziative in programma, aggiornate direttamente dal calendario.
        </SectionTitle>
        <div className="event-grid">
          {events.map((event) => (
            <EventCard key={event.id} event={event} compact />
          ))}
        </div>
      </section>

      <section className="split-section">
        <div>
          <SectionTitle kicker="Community" title="Cos'è Eventi Forette">
            Una bacheca digitale semplice per trovare cosa succede in paese, proporre momenti di
            ritrovo e rendere piu visibili le iniziative locali.
          </SectionTitle>
          <div className="feature-list">
            <div>
              <Users size={22} />
              <span>Attivita per giovani, famiglie e gruppi locali</span>
            </div>
            <div>
              <CalendarDays size={22} />
              <span>Eventi aggiornati con presenze e dettagli pratici</span>
            </div>
            <div>
              <Gamepad2 size={22} />
              <span>Un arcade leggero con classifica settimanale</span>
            </div>
          </div>
        </div>
        <div className="cta-card">
          <h3>Scopri cosa succede questa settimana</h3>
          <p>Consulta il calendario, segnala la tua presenza e prova a scalare la classifica.</p>
          <Link className="primary-button" to="/calendario">
            Vai agli eventi
            <ArrowRight size={18} />
          </Link>
        </div>
      </section>
    </div>
  );
}
