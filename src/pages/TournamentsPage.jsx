import {
  CalendarDays,
  ChevronRight,
  Clock,
  Info,
  MapPin,
  Medal,
  Trophy,
  Users,
  X,
} from 'lucide-react';
import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import SectionTitle from '../components/SectionTitle.jsx';
import { api, getCurrentUser } from '../lib/api.js';

const tournaments = [
  {
    id: 'calcetto-estate',
    name: 'Torneo Calcetto Estate',
    status: 'Iscrizioni aperte',
    teams: 8,
    date: '15 Giu',
    time: '20:30',
    location: 'Campo sportivo Forette',
    leader: 'Forette Blu',
    format: 'Gironi + semifinali',
    description:
      'Partite serali da 20 minuti, squadre da 5 giocatori e finale durante la serata conclusiva.',
    accent: 'tournament-tone-1',
    bracket: [
      {
        title: 'Semifinali',
        matches: [
          { teamA: 'Forette Blu', scoreA: 3, teamB: 'San Pietro', scoreB: 1 },
          { teamA: 'I Solari', scoreA: 2, teamB: 'Bar Centrale', scoreB: 0 },
        ],
      },
      {
        title: 'Finale',
        matches: [{ teamA: 'Forette Blu', scoreA: '-', teamB: 'I Solari', scoreB: '-' }],
      },
      {
        title: 'Podio',
        matches: [{ teamA: '1° Forette Blu', scoreA: '', teamB: '2° I Solari', scoreB: '' }],
      },
    ],
  },
  {
    id: 'beach-volley',
    name: 'Beach Volley in Piazza',
    status: 'Semifinali',
    teams: 6,
    date: '22 Giu',
    time: '18:00',
    location: 'Piazza centrale',
    leader: 'I Solari',
    format: 'Eliminazione diretta',
    description:
      'Coppie miste, set ai 21 punti e rotazione rapida per tenere il torneo vivace fino alla finale.',
    accent: 'tournament-tone-2',
    bracket: [
      {
        title: 'Quarti',
        matches: [
          { teamA: 'I Solari', scoreA: 21, teamB: 'Volley Bar', scoreB: 14 },
          { teamA: 'Forette Beach', scoreA: 18, teamB: 'Team Sprint', scoreB: 21 },
        ],
      },
      {
        title: 'Semifinali',
        matches: [{ teamA: 'I Solari', scoreA: '-', teamB: 'Team Sprint', scoreB: '-' }],
      },
      {
        title: 'Finale',
        matches: [{ teamA: 'Vincente SF1', scoreA: '', teamB: 'Vincente SF2', scoreB: '' }],
      },
    ],
  },
  {
    id: 'burraco-sagra',
    name: 'Burraco della Sagra',
    status: 'Finale pronta',
    teams: 12,
    date: '29 Giu',
    time: '21:00',
    location: 'Sala civica',
    leader: 'Coppia Neri',
    format: 'Classifica a punti',
    description:
      'Tavoli sorteggiati, tre turni di qualificazione e finale tra le due coppie con punteggio migliore.',
    accent: 'tournament-tone-3',
    bracket: [
      {
        title: 'Qualifica',
        matches: [
          { teamA: 'Coppia Neri', scoreA: 1240, teamB: 'Coppia Rizzi', scoreB: 980 },
          { teamA: 'Coppia Blu', scoreA: 1110, teamB: 'Coppia Festa', scoreB: 1040 },
        ],
      },
      {
        title: 'Finale',
        matches: [{ teamA: 'Coppia Neri', scoreA: '-', teamB: 'Coppia Blu', scoreB: '-' }],
      },
      {
        title: 'Premi',
        matches: [{ teamA: '1° Buono cena', scoreA: '', teamB: '2° Cesto festa', scoreB: '' }],
      },
    ],
  },
];

export default function TournamentsPage() {
  const [tournamentList, setTournamentList] = useState(tournaments);
  const [selectedId, setSelectedId] = useState(tournaments[0].id);
  const [infoOpen, setInfoOpen] = useState(false);
  const [user, setUser] = useState(() => getCurrentUser());
  const [registrations, setRegistrations] = useState([]);
  const [teamName, setTeamName] = useState(() => getCurrentUser()?.displayName || '');
  const [notes, setNotes] = useState('');
  const [message, setMessage] = useState('');
  const selectedTournament =
    tournamentList.find((tournament) => tournament.id === selectedId) || tournamentList[0];

  useEffect(() => {
    api.getTournaments().then((data) => {
      if (!data.length) return;
      setTournamentList(data);
      setSelectedId((current) => data.some((tournament) => tournament.id === current) ? current : data[0].id);
    }).catch(() => {});
  }, []);

  useEffect(() => {
    function refreshUser(event) {
      const nextUser = event.detail || getCurrentUser();
      setUser(nextUser);
      setTeamName((current) => current || nextUser?.displayName || '');
    }
    window.addEventListener('eventi-forette-user', refreshUser);
    return () => window.removeEventListener('eventi-forette-user', refreshUser);
  }, []);

  useEffect(() => {
    if (!user) {
      setRegistrations([]);
      return;
    }
    api.getTournamentRegistrations(user.id).then(setRegistrations).catch(() => setRegistrations([]));
  }, [user]);

  useEffect(() => {
    document.body.classList.toggle('drawer-open', infoOpen);
    return () => document.body.classList.remove('drawer-open');
  }, [infoOpen]);

  async function handleRegister(event) {
    event.preventDefault();
    setMessage('');
    try {
      await api.registerTournament(selectedTournament.id, { teamName, notes });
      setMessage('Iscrizione salvata.');
      setNotes('');
      setRegistrations(await api.getTournamentRegistrations(user.id));
    } catch (error) {
      setMessage(error.message);
    }
  }

  const isRegistered = registrations.some((registration) => registration.tournament_id === selectedTournament?.id);

  return (
    <div className="page">
      <section className="content-section tournaments-section">
        <div className="tournaments-heading">
          <SectionTitle kicker="Tornei" title="Sfide e classifiche">
            Una panoramica rapida dei tornei in corso, con stato, partecipanti e tabellone.
          </SectionTitle>
        </div>

        <div className="tournament-showcase">
          <div className="tournament-list">
            {tournamentList.map((tournament) => (
              <button
                key={tournament.id}
                className={`tournament-card ${tournament.accent} ${
                  selectedTournament.id === tournament.id ? 'active' : ''
                }`}
                type="button"
                aria-pressed={selectedTournament.id === tournament.id}
                onClick={() => {
                  setSelectedId(tournament.id);
                  setInfoOpen(false);
                }}
              >
                <div className="tournament-card-top">
                  <span>
                    <Trophy size={16} />
                    {tournament.status}
                  </span>
                  <strong>{tournament.date_label || tournament.date}</strong>
                </div>
                <h3>{tournament.name}</h3>
                <div className="tournament-card-meta">
                  <span>{tournament.teams} squadre</span>
                  <span>In testa: {tournament.leader}</span>
                </div>
                <ChevronRight className="tournament-open-icon" size={20} />
              </button>
            ))}
          </div>

          <div className="tournament-detail-stack">
            <div className="bracket-board" aria-label={`Panoramica tabellone ${selectedTournament.name}`}>
              <div className="bracket-board-header">
                <div>
                  <span>Tabellone live</span>
                  <h3>{selectedTournament.name}</h3>
                </div>
                <div className="bracket-board-actions">
                  <button className="tournament-info-button" type="button" onClick={() => setInfoOpen(true)}>
                    <Info size={18} />
                    Informazioni
                  </button>
                  <Medal size={26} />
                </div>
              </div>
              <div className="bracket-rounds">
                {(selectedTournament.bracket || []).map((round) => (
                  <div key={round.title} className="bracket-round">
                    <strong>{round.title}</strong>
                    {round.matches.map((match) => (
                      <div key={`${round.title}-${match.teamA}`} className="bracket-match">
                        <span>
                          {match.teamA}
                          <b>{match.scoreA}</b>
                        </span>
                        <span>
                          {match.teamB}
                          <b>{match.scoreB}</b>
                        </span>
                      </div>
                    ))}
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      {infoOpen && (
        <div className="tournament-modal-backdrop" onClick={() => setInfoOpen(false)}>
          <div
            className="tournament-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="tournament-modal-title"
            onClick={(event) => event.stopPropagation()}
          >
            <button
              className="drawer-close tournament-modal-close"
              type="button"
              aria-label="Chiudi informazioni torneo"
              onClick={() => setInfoOpen(false)}
            >
              <X size={20} />
            </button>
            <div className="tournament-detail-card">
              <div className="tournament-detail-header">
                <span>{selectedTournament.status}</span>
                <h3 id="tournament-modal-title">{selectedTournament.name}</h3>
                <p>{selectedTournament.description}</p>
              </div>
              <div className="tournament-detail-grid">
                <span>
                  <CalendarDays size={17} />
                  {selectedTournament.date_label || selectedTournament.date}
                </span>
                <span>
                  <Clock size={17} />
                  {selectedTournament.time}
                </span>
                <span>
                  <MapPin size={17} />
                  {selectedTournament.location}
                </span>
                <span>
                  <Users size={17} />
                  {selectedTournament.teams} squadre
                </span>
              </div>
              <div className="tournament-format">
                <strong>Formula</strong>
                <span>{selectedTournament.format}</span>
              </div>
              <div className="tournament-signup">
                <strong>Iscrizione</strong>
                {!user ? (
                  <Link className="primary-button" to="/account">
                    Accedi per iscriverti
                  </Link>
                ) : isRegistered ? (
                  <p className="alert success">Sei gia iscritto a questo torneo.</p>
                ) : (
                  <form className="stack-form" onSubmit={handleRegister}>
                    <label>
                      Nome squadra o coppia
                      <input value={teamName} onChange={(event) => setTeamName(event.target.value)} required />
                    </label>
                    <label>
                      Note opzionali
                      <textarea value={notes} onChange={(event) => setNotes(event.target.value)} rows="3" />
                    </label>
                    {message && <p className={`alert ${message.includes('salvata') ? 'success' : ''}`}>{message}</p>}
                    <button className="primary-button" type="submit">
                      Iscriviti
                    </button>
                  </form>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
