import { Navigate, Outlet } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'

/**
 * Garde de route : bloque l'accès aux routes filles tant qu'aucune session
 * Supabase n'existe, en redirigeant vers /login. Monté autour de <AppShell />
 * dans App.tsx — /login reste seule route publique.
 */
export function RequireAuth() {
  const { session, loading } = useAuth()

  if (loading) return null
  if (!session) return <Navigate to="/login" replace />

  return <Outlet />
}
