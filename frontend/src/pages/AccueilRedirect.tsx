import { Navigate } from 'react-router-dom'
import { useCurrentUser } from '../hooks/useCurrentUser'

/**
 * Racine `/` (onglet « Accueil ») — décision du 17/09/2026, étendue le
 * 18/09/2026 : redirige vers la page de suivi du rôle actif de l'utilisateur
 * (RC prioritaire sur CDS, lui-même prioritaire sur CB, s'il cumule
 * plusieurs de ces rôles — ordre hiérarchique N+1 > N+2 > CB, cohérent avec
 * getAccueilSidebarItems côté config/navigation.ts), ou vers « Mes demandes
 * d'achat » (`/mes-demandes`, désormais son propre onglet du header, sorti
 * de la sidebar « Accueil ») s'il n'a aucun de ces rôles actifs. `null`
 * pendant le chargement de `/api/me`, même principe que RequireAuth.tsx —
 * éviter un flash vers la mauvaise page avant que les rôles ne soient
 * connus.
 */
export function AccueilRedirect() {
  const { data: currentUser, loading } = useCurrentUser()

  if (loading) return null

  const hasRc = currentUser?.roles.some((r) => r.typeRole === 'RC') ?? false
  if (hasRc) return <Navigate to="/suivi-rc" replace />

  const hasCds = currentUser?.roles.some((r) => r.typeRole === 'CDS') ?? false
  if (hasCds) return <Navigate to="/suivi-cds" replace />

  const hasCb = currentUser?.roles.some((r) => r.typeRole === 'CB') ?? false
  if (hasCb) return <Navigate to="/suivi-cb" replace />

  return <Navigate to="/mes-demandes" replace />
}
