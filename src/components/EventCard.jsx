import { CalendarDays, MapPin, Users } from 'lucide-react';
import { formatDate } from '../lib/date.js';

export default function EventCard({ event, onAttend, disabledAttend = false, compact = false }) {
  return (
    <article className={`event-card ${compact ? 'event-card-compact' : ''}`}>
      {event.image ? (
        <img className="event-image" src={event.image} alt="" loading="lazy" />
      ) : (
        <div className="event-image event-image-fallback">{event.category || 'Evento'}</div>
      )}
      <div className="event-body">
        <div className="event-topline">
          <span>{event.category || 'Community'}</span>
          <span>{event.time}</span>
        </div>
        <h3>{event.title}</h3>
        <p>{event.description}</p>
        <div className="event-meta">
          <span>
            <CalendarDays size={16} />
            {formatDate(event.date)}
          </span>
          <span>
            <MapPin size={16} />
            {event.location}
          </span>
          <span>
            <Users size={16} />
            {event.participants} presenti
          </span>
        </div>
        {onAttend && (
          <button className="primary-button" onClick={() => onAttend(event)} disabled={disabledAttend}>
            {disabledAttend ? 'Presenza registrata' : 'Parteciperò'}
          </button>
        )}
      </div>
    </article>
  );
}
