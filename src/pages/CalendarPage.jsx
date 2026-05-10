import { useEffect, useMemo, useState } from 'react';
import { CalendarCheck, Search } from 'lucide-react';
import EventCard from '../components/EventCard.jsx';
import SectionTitle from '../components/SectionTitle.jsx';
import { api } from '../lib/api.js';
import { dayNumber, monthShort } from '../lib/date.js';

export default function CalendarPage() {
  const [events, setEvents] = useState([]);
  const [selectedId, setSelectedId] = useState(null);
  const [query, setQuery] = useState('');
  const [attended, setAttended] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem('eventi-forette-attended') || '[]');
    } catch {
      return [];
    }
  });
  const [error, setError] = useState('');

  useEffect(() => {
    api.getEvents().then((data) => {
      setEvents(data);
      setSelectedId(data[0]?.id || null);
    });
  }, []);

  const filteredEvents = useMemo(() => {
    const normalized = query.toLowerCase();
    return events.filter((event) =>
      [event.title, event.description, event.location, event.category]
        .join(' ')
        .toLowerCase()
        .includes(normalized)
    );
  }, [events, query]);

  const selectedEvent = events.find((event) => event.id === selectedId) || filteredEvents[0];

  async function handleAttend(event) {
    if (attended.includes(event.id)) return;
    setError('');
    try {
      const updated = await api.attendEvent(event.id);
      setEvents((current) => current.map((item) => (item.id === updated.id ? updated : item)));
      const next = [...attended, event.id];
      setAttended(next);
      localStorage.setItem('eventi-forette-attended', JSON.stringify(next));
    } catch (err) {
      setError(err.message);
    }
  }

  return (
    <div className="page">
      <section className="page-heading">
        <SectionTitle kicker="Calendario" title="Eventi in programma">
          Clicca un appuntamento, leggi i dettagli e segnala la tua presenza.
        </SectionTitle>
        <div className="search-box">
          <Search size={18} />
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Cerca per titolo, luogo o categoria"
          />
        </div>
      </section>

      {error && <p className="alert">{error}</p>}

      <section className="calendar-layout">
        <div className="calendar-list">
          {filteredEvents.map((event) => (
            <button
              key={event.id}
              className={`calendar-row ${selectedEvent?.id === event.id ? 'active' : ''}`}
              onClick={() => setSelectedId(event.id)}
            >
              <span className="date-pill">
                <strong>{dayNumber(event.date)}</strong>
                {monthShort(event.date)}
              </span>
              <span>
                <strong>{event.title}</strong>
                <small>
                  {event.time} · {event.location}
                </small>
              </span>
              <CalendarCheck size={20} />
            </button>
          ))}
        </div>
        <div className="calendar-detail">
          {selectedEvent ? (
            <EventCard
              event={selectedEvent}
              onAttend={handleAttend}
              disabledAttend={attended.includes(selectedEvent.id)}
            />
          ) : (
            <div className="empty-state">Nessun evento trovato.</div>
          )}
        </div>
      </section>
    </div>
  );
}
