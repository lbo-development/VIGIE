import type { HealthStatus } from '../hooks/useHealthCheck'
import './StatusBadge.css'

const LABELS: Record<HealthStatus, string> = {
  idle: 'vérification…',
  ok: 'connectée ✅',
  error: 'injoignable ❌',
}

/**
 * Composant réutilisable d'exemple : affiche un badge de statut.
 * Convention : un composant par fichier, style associé dans un .css du même nom.
 */
export function StatusBadge({ status }: { status: HealthStatus }) {
  return <span className={`status-badge status-badge--${status}`}>{LABELS[status]}</span>
}
