export function formatDate(dateString) {
  return new Intl.DateTimeFormat('it-IT', {
    weekday: 'short',
    day: '2-digit',
    month: 'short',
    year: 'numeric'
  }).format(new Date(`${dateString}T12:00:00`));
}

export function dayNumber(dateString) {
  return new Intl.DateTimeFormat('it-IT', { day: '2-digit' }).format(
    new Date(`${dateString}T12:00:00`)
  );
}

export function monthShort(dateString) {
  return new Intl.DateTimeFormat('it-IT', { month: 'short' }).format(
    new Date(`${dateString}T12:00:00`)
  );
}
