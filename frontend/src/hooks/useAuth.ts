import { createContext, useContext } from 'react'
import type { Session } from '@supabase/supabase-js'

export interface AuthContextValue {
  session: Session | null
  loading: boolean
  signOut: () => Promise<void>
}

/**
 * Créé ici (et non dans context/AuthContext.tsx) pour que ce fichier n'exporte
 * que des non-composants (le contexte et le hook) — context/AuthContext.tsx
 * n'exporte alors que le composant AuthProvider, ce qui évite l'avertissement
 * ESLint react-refresh/only-export-components (Fast Refresh ne fonctionne
 * correctement que si un fichier n'exporte que des composants).
 */
export const AuthContext = createContext<AuthContextValue | undefined>(undefined)

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth doit être utilisé à l\'intérieur de <AuthProvider>')
  return ctx
}
