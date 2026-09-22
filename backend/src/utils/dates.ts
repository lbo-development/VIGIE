const PARIS_DATE_FORMAT = new Intl.DateTimeFormat('en-CA', {
  timeZone: 'Europe/Paris',
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
})

/**
 * Date du jour (AAAA-MM-JJ) à l'heure de Paris — même référence que
 * finances.aujourdhui() en base (migration 20260920090000). Ne jamais utiliser
 * `new Date().toISOString().slice(0, 10)` pour une règle de suppléance : c'est
 * l'UTC, décalé de 1 à 2 heures, donc faux entre minuit et 1h/2h du matin.
 */
export function todayParis(now: Date = new Date()): string {
  return PARIS_DATE_FORMAT.format(now)
}

/** AAAA-MM-JJ → JJ/MM/AAAA, pour les messages affichés à l'utilisateur. */
export function formatDateFr(isoDate: string): string {
  const [year, month, day] = isoDate.split('-')
  return `${day}/${month}/${year}`
}
