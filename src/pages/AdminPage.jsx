import { useEffect, useMemo, useState } from 'react';
import { Edit3, Plus, Save, Trash2, Users } from 'lucide-react';
import SectionTitle from '../components/SectionTitle.jsx';
import { api } from '../lib/api.js';
import { formatDate } from '../lib/date.js';

const emptyEvent = {
  title: '',
  description: '',
  date: '',
  time: '',
  location: '',
  image: '',
  participants: 0,
  category: ''
};

export default function AdminPage() {
  const [token, setToken] = useState(() => localStorage.getItem('eventi-forette-admin-token'));
  const [credentials, setCredentials] = useState({ username: 'admin', password: 'admin' });
  const [events, setEvents] = useState([]);
  const [form, setForm] = useState(emptyEvent);
  const [editingId, setEditingId] = useState(null);
  const [message, setMessage] = useState('');
  const isEditing = useMemo(() => editingId !== null, [editingId]);

  useEffect(() => {
    if (token) loadEvents();
  }, [token]);

  async function loadEvents() {
    const data = await api.getEvents();
    setEvents(data);
  }

  async function handleLogin(event) {
    event.preventDefault();
    setMessage('');
    try {
      const result = await api.loginAdmin(credentials);
      localStorage.setItem('eventi-forette-admin-token', result.token);
      setToken(result.token);
    } catch (err) {
      setMessage(err.message);
    }
  }

  function updateField(field, value) {
    setForm((current) => ({ ...current, [field]: value }));
  }

  function startEdit(event) {
    setEditingId(event.id);
    setForm({
      title: event.title,
      description: event.description,
      date: event.date,
      time: event.time,
      location: event.location,
      image: event.image || '',
      participants: event.participants,
      category: event.category || ''
    });
  }

  function resetForm() {
    setEditingId(null);
    setForm(emptyEvent);
  }

  async function handleSubmit(event) {
    event.preventDefault();
    setMessage('');
    try {
      if (isEditing) {
        await api.updateEvent(editingId, form);
        setMessage('Evento aggiornato.');
      } else {
        await api.createEvent(form);
        setMessage('Evento creato.');
      }
      resetForm();
      await loadEvents();
    } catch (err) {
      setMessage(err.message);
    }
  }

  async function handleDelete(id) {
    if (!window.confirm('Eliminare questo evento?')) return;
    await api.deleteEvent(id);
    if (editingId === id) resetForm();
    await loadEvents();
  }

  if (!token) {
    return (
      <div className="page narrow-page">
        <section className="auth-card">
          <SectionTitle kicker="Admin" title="Accesso gestione eventi">
            Login provvisorio per gestire il calendario. Credenziali: admin / admin.
          </SectionTitle>
          <form onSubmit={handleLogin} className="stack-form">
            <label>
              Username
              <input
                value={credentials.username}
                onChange={(event) => updateCredentials(setCredentials, 'username', event.target.value)}
              />
            </label>
            <label>
              Password
              <input
                type="password"
                value={credentials.password}
                onChange={(event) => updateCredentials(setCredentials, 'password', event.target.value)}
              />
            </label>
            {message && <p className="alert">{message}</p>}
            <button className="primary-button" type="submit">
              Accedi
            </button>
          </form>
        </section>
      </div>
    );
  }

  return (
    <div className="page">
      <section className="page-heading">
        <SectionTitle kicker="Admin" title="Gestione eventi">
          Crea, modifica o elimina gli appuntamenti pubblicati nel calendario.
        </SectionTitle>
        <button
          className="secondary-button"
          onClick={() => {
            localStorage.removeItem('eventi-forette-admin-token');
            setToken(null);
          }}
        >
          Esci
        </button>
      </section>

      {message && <p className="alert success">{message}</p>}

      <section className="admin-layout">
        <form className="admin-form" onSubmit={handleSubmit}>
          <h3>{isEditing ? 'Modifica evento' : 'Nuovo evento'}</h3>
          <div className="form-grid">
            <label>
              Titolo
              <input value={form.title} onChange={(event) => updateField('title', event.target.value)} required />
            </label>
            <label>
              Categoria
              <input
                value={form.category}
                onChange={(event) => updateField('category', event.target.value)}
                placeholder="Sociale, Giovani, Famiglie..."
              />
            </label>
            <label>
              Data
              <input
                type="date"
                value={form.date}
                onChange={(event) => updateField('date', event.target.value)}
                required
              />
            </label>
            <label>
              Ora
              <input
                type="time"
                value={form.time}
                onChange={(event) => updateField('time', event.target.value)}
                required
              />
            </label>
            <label>
              Luogo
              <input
                value={form.location}
                onChange={(event) => updateField('location', event.target.value)}
                required
              />
            </label>
            <label>
              Partecipanti
              <input
                type="number"
                min="0"
                value={form.participants}
                onChange={(event) => updateField('participants', Number(event.target.value))}
              />
            </label>
          </div>
          <label>
            URL immagine opzionale
            <input value={form.image} onChange={(event) => updateField('image', event.target.value)} />
          </label>
          <label>
            Descrizione
            <textarea
              value={form.description}
              onChange={(event) => updateField('description', event.target.value)}
              rows="5"
              required
            />
          </label>
          <div className="form-actions">
            <button className="primary-button" type="submit">
              {isEditing ? <Save size={18} /> : <Plus size={18} />}
              {isEditing ? 'Salva modifiche' : 'Aggiungi evento'}
            </button>
            {isEditing && (
              <button className="secondary-button" type="button" onClick={resetForm}>
                Annulla
              </button>
            )}
          </div>
        </form>

        <div className="admin-events">
          {events.map((event) => (
            <article key={event.id} className="admin-event-row">
              <div>
                <strong>{event.title}</strong>
                <span>
                  {formatDate(event.date)} · {event.time} · {event.location}
                </span>
                <small>
                  <Users size={14} />
                  {event.participants} partecipanti
                </small>
              </div>
              <div className="row-actions">
                <button className="icon-button" onClick={() => startEdit(event)} title="Modifica">
                  <Edit3 size={18} />
                </button>
                <button className="icon-button danger" onClick={() => handleDelete(event.id)} title="Elimina">
                  <Trash2 size={18} />
                </button>
              </div>
            </article>
          ))}
        </div>
      </section>
    </div>
  );
}

function updateCredentials(setter, field, value) {
  setter((current) => ({ ...current, [field]: value }));
}
