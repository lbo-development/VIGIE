interface InactivityWarningProps {
  remainingMs: number
  onStayActive: () => void
}

function formatRemaining(ms: number) {
  const totalSeconds = Math.ceil(ms / 1000)
  const minutes = Math.floor(totalSeconds / 60)
  const seconds = totalSeconds % 60
  return `${minutes}:${String(seconds).padStart(2, '0')}`
}

/**
 * Avertissement affiché juste avant la déconnexion automatique pour inactivité
 * (voir useInactivityLogout et SECURITY.md §1.1). Toute activité — y compris
 * ignorer cet avertissement et bouger la souris — suffit à rester connecté ;
 * le bouton n'est qu'un raccourci explicite pour le confirmer sans délai.
 */
export function InactivityWarning({ remainingMs, onStayActive }: InactivityWarningProps) {
  return (
    <div className="gp-toast-region" aria-live="assertive">
      <div className="gp-toast gp-toast--warning" role="alertdialog">
        <svg className="ti gp-toast__icon">
          <use href="#i-alert-triangle" />
        </svg>
        <div style={{ flex: 1 }}>
          <p className="gp-toast__title">Session sur le point d'expirer</p>
          <p className="gp-toast__text">
            Déconnexion automatique dans <span className="mono">{formatRemaining(remainingMs)}</span> par inactivité
            (poste partagé).
          </p>
          <button type="button" className="gp-toast__action" onClick={onStayActive}>
            Rester connecté
          </button>
        </div>
      </div>
    </div>
  )
}
