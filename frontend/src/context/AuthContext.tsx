import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react'
import type { Session } from '@supabase/supabase-js'
import { supabase } from '../lib/supabaseClient'
import { INACTIVITY_CHANNEL_NAME } from '../hooks/useInactivityLogout'
import { AuthContext } from '../hooks/useAuth'

/**
 * Fournit l'état d'authentification Supabase à toute l'application via Context API.
 * Enveloppe l'app dans App.tsx : <AuthProvider><...></AuthProvider>
 */
export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session)
      setLoading(false)
    })

    const { data: subscription } = supabase.auth.onAuthStateChange((_event, newSession) => {
      setSession(newSession)
    })

    return () => subscription.subscription.unsubscribe()
  }, [])

  // Référence stable (voir SECURITY.md §1.1) : toute déconnexion — manuelle ou
  // par inactivité — révoque réellement le refresh token côté serveur, prévient
  // les autres onglets ouverts, puis force un rechargement complet plutôt qu'une
  // navigation SPA, pour purger tout état résiduel en mémoire (state React,
  // caches, données encore affichées à l'écran).
  const signOut = useCallback(async () => {
    if ('BroadcastChannel' in window) {
      const channel = new BroadcastChannel(INACTIVITY_CHANNEL_NAME)
      channel.postMessage({ type: 'logout' })
      channel.close()
    }
    await supabase.auth.signOut()
    window.location.replace('/login')
  }, [])

  const value = useMemo(() => ({ session, loading, signOut }), [session, loading, signOut])

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}
