import { useEffect, useMemo, useRef, useState } from 'react';
import { BadgeCheck, Camera, Edit3, Plus, Save, ScanLine, Trash2, Users, XCircle } from 'lucide-react';
import SectionTitle from '../components/SectionTitle.jsx';
import { api, getCurrentUser, isAdminUser } from '../lib/api.js';
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
  const currentUser = getCurrentUser();
  const [events, setEvents] = useState([]);
  const [form, setForm] = useState(emptyEvent);
  const [editingId, setEditingId] = useState(null);
  const [message, setMessage] = useState('');
  const [couponInput, setCouponInput] = useState('');
  const [couponResult, setCouponResult] = useState(null);
  const [couponMessage, setCouponMessage] = useState('');
  const [scannerOpen, setScannerOpen] = useState(false);
  const videoRef = useRef(null);
  const scannerTimerRef = useRef(null);
  const streamRef = useRef(null);
  const isEditing = useMemo(() => editingId !== null, [editingId]);

  useEffect(() => {
    if (isAdminUser(currentUser)) loadEvents();
  }, [currentUser?.id, currentUser?.role]);

  useEffect(() => () => stopScanner(), []);

  useEffect(() => {
    if (scannerOpen) startScanner();
    return () => stopScanner();
  }, [scannerOpen]);

  if (!isAdminUser(currentUser)) {
    return (
      <div className="page narrow-page">
        <section className="auth-card">
          <SectionTitle kicker="Admin" title="Accesso riservato">
            Questa area e visibile solo ai profili amministratore.
          </SectionTitle>
        </section>
      </div>
    );
  }

  async function loadEvents() {
    const data = await api.getEvents();
    setEvents(data);
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

  async function handleValidateCoupon(value = couponInput) {
    setCouponMessage('');
    setCouponResult(null);
    try {
      const result = await api.validateCoupon(value);
      setCouponResult(result);
      setCouponMessage(result.message);
      if (result.coupon?.code) setCouponInput(result.coupon.code);
    } catch (err) {
      setCouponMessage(err.message);
    }
  }

  async function startScanner() {
    if (!('BarcodeDetector' in window)) {
      setCouponMessage('Scanner QR non supportato da questo browser. Inserisci il codice manualmente.');
      setScannerOpen(false);
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: { ideal: 'environment' } },
        audio: false
      });
      streamRef.current = stream;
      if (!videoRef.current) return;
      videoRef.current.srcObject = stream;
      await videoRef.current.play();
      const detector = new window.BarcodeDetector({ formats: ['qr_code'] });
      scannerTimerRef.current = window.setInterval(async () => {
        if (!videoRef.current) return;
        const codes = await detector.detect(videoRef.current).catch(() => []);
        const rawValue = codes[0]?.rawValue;
        if (!rawValue) return;
        stopScanner();
        setScannerOpen(false);
        setCouponInput(rawValue);
        handleValidateCoupon(rawValue);
      }, 450);
    } catch {
      setCouponMessage('Impossibile accedere alla fotocamera. Controlla i permessi o inserisci il codice manualmente.');
      setScannerOpen(false);
    }
  }

  function stopScanner() {
    if (scannerTimerRef.current) {
      window.clearInterval(scannerTimerRef.current);
      scannerTimerRef.current = null;
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
    if (videoRef.current) videoRef.current.srcObject = null;
  }

  return (
    <div className="page">
      <section className="page-heading">
        <SectionTitle kicker="Admin" title="Gestione eventi">
          Crea, modifica o elimina gli appuntamenti pubblicati nel calendario.
        </SectionTitle>
      </section>

      {message && <p className="alert success">{message}</p>}

      <section className="admin-coupon-validator">
        <div className="leaderboard-title">
          <ScanLine size={24} />
          <div>
            <h3>Convalida coupon</h3>
            <span>Scansiona il QR o inserisci il codice coupon.</span>
          </div>
        </div>
        <form
          className="coupon-validator-form"
          onSubmit={(event) => {
            event.preventDefault();
            handleValidateCoupon();
          }}
        >
          <input
            value={couponInput}
            onChange={(event) => setCouponInput(event.target.value)}
            placeholder="FORETTE-..."
          />
          <button className="primary-button" type="submit">
            <BadgeCheck size={18} />
            Convalida
          </button>
          <button className="secondary-button" type="button" onClick={() => setScannerOpen((open) => !open)}>
            {scannerOpen ? <XCircle size={18} /> : <Camera size={18} />}
            {scannerOpen ? 'Chiudi scanner' : 'Scansiona QR'}
          </button>
        </form>
        {scannerOpen && (
          <div className="coupon-scanner">
            <video ref={videoRef} muted playsInline />
          </div>
        )}
        {couponMessage && (
          <p className={`alert ${couponResult?.valid ? 'success' : ''}`}>
            {couponMessage}
          </p>
        )}
        {couponResult?.coupon && (
          <div className={`coupon-validation-result ${couponResult.valid ? 'valid' : 'invalid'}`}>
            <strong>{couponResult.coupon.code}</strong>
            <span>{couponResult.coupon.discount_value}% sconto · {couponResult.coupon.status}</span>
          </div>
        )}
      </section>

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
