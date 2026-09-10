import { Navigate, Outlet } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'
import { ForcePasswordChange } from '../pages/ForcePasswordChange'

/**
 * Garde de route : bloque l'accès aux routes filles tant qu'aucune session
 * Supabase n'existe, en redirigeant vers /login. Monté autour de <AppShell />
 * dans App.tsx — /login reste seule route publique.
 *
 * `must_change_password` (user_metadata, posé par acteur.service.ts#createActeur
 * à la création d'un compte par ADMIN_APP) affiche ForcePasswordChange à la
 * place de tout le reste de l'application tant que le mot de passe temporaire
 * n'a pas été changé — pas de route dédiée dans App.tsx, même principe que
 * /login (hors shell). Décision du 10/09/2026, ForClaude/CDC/mot-phases-1-2.md.
 */
export function RequireAuth() {
  const { session, loading } = useAuth()

  if (loading) return null
  if (!session) return <Navigate to="/login" replace />
  if (session.user.user_metadata?.must_change_password === true) return <ForcePasswordChange />

  return <Outlet />
}
