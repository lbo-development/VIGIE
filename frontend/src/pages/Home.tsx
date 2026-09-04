import { useAuth } from '../hooks/useAuth'
import { useCurrentUser } from '../hooks/useCurrentUser'

/**
 * Page d'accueil post-connexion, montée sur la route "/" (voir App.tsx,
 * derrière <RequireAuth />). Coquille minimale : preuve que l'authentification
 * bout-en-bout fonctionne (session Supabase + rattachement ACTEUR + rôles
 * actifs) — aucun écran métier pour l'instant.
 */
export function Home() {
  const { session } = useAuth()
  const { data, loading } = useCurrentUser()

  const displayName = data?.prenom && data?.nom ? `${data.prenom} ${data.nom}` : session?.user.email

  return (
    <div className="stack">
      <h1>Bienvenue, {displayName}</h1>

      <div className="gp-panel">
        {loading ? (
          <p>Chargement du profil…</p>
        ) : !data?.matricule ? (
          <div className="gp-errmsg">
            <svg className="ti">
              <use href="#i-alert-circle" />
            </svg>
            Ce compte n'est pas encore rattaché à un ACTEUR — aucune autorisation métier tant
            qu'un administrateur n'a pas renseigné le matricule correspondant.
          </div>
        ) : data.roles.length === 0 ? (
          <p>Aucun rôle actif pour le moment.</p>
        ) : (
          <div className="stack">
            <p className="gp-label">Rôles actifs</p>
            <div className="row">
              {data.roles.map((role) => (
                <span key={role.typeRole + (role.perimeterLabel ?? '')} className="gp-badge gp-badge--info">
                  {role.typeRole}
                  {role.perimeterLabel ? ` — ${role.perimeterLabel}` : ''}
                </span>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
