/**
 * Fonctions utilitaires pures, sans dépendance à React.
 * Exemple de convention : un fichier par domaine (dates, strings, nombres...).
 */
export function formatDate(input: string | Date, locale = 'fr-FR'): string {
  const date = typeof input === 'string' ? new Date(input) : input
  return new Intl.DateTimeFormat(locale, {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(date)
}
