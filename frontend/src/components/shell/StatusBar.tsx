import { useAuth } from '../../context/AuthContext'

const APP_NAME = 'VIGIE'
const APP_VERSION = 'v0.1.0'
const ENVIRONMENT_LABEL = import.meta.env.MODE === 'production' ? 'Production' : 'Développement'

export function StatusBar() {
  const { session, signOut } = useAuth()

  return (
    <footer className="status-bar" role="status">
      <div className="status-left">
        <span className="status-dot" />
        <span>{APP_NAME}</span>
        <span className="status-sep">•</span>
        <span>Environnement {ENVIRONMENT_LABEL}</span>
      </div>
      <div className="status-right">
        <span>{session ? 'Connecté' : 'Non connecté'}</span>
        <span className="status-sep">•</span>
        <span className="mono">{APP_VERSION}</span>
        {session?.user.email && (
          <>
            <span className="status-sep">•</span>
            <span>{session.user.email}</span>
            <button type="button" className="status-logout" onClick={() => void signOut()}>
              <svg className="ti">
                <use href="#i-log-out" />
              </svg>
              Se déconnecter
            </button>
          </>
        )}
      </div>
    </footer>
  )
}
