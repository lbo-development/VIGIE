import { useCallback, useEffect, useRef, useState } from 'react'

const ACTIVITY_EVENTS = ['mousemove', 'keydown', 'click', 'scroll', 'touchstart'] as const
export const INACTIVITY_CHANNEL_NAME = 'vigie-inactivity'
const ACTIVITY_THROTTLE_MS = 1000

type InactivityMessage = { type: 'activity' } | { type: 'logout' }

interface UseInactivityLogoutOptions {
  /** N'installe les écouteurs/minuteurs que si une session est active. */
  enabled: boolean
  /** Délai total d'inactivité avant déconnexion forcée. */
  timeoutMs: number
  /** Durée de l'avertissement affiché juste avant l'expiration. */
  warnBeforeMs: number
  /**
   * Le minuteur de CET onglet a atteint le délai d'inactivité : doit déclencher
   * la vraie déconnexion (supabase.auth.signOut() + rechargement complet).
   */
  onLocalTimeout: () => void
  /**
   * Un AUTRE onglet vient de se déconnecter (inactivité ou action manuelle) :
   * purger cet onglet aussi, sans relancer signOut() (déjà fait ailleurs).
   */
  onRemoteLogout: () => void
}

/**
 * Détection d'inactivité + synchronisation multi-onglets (SECURITY.md §1.1).
 * Un minuteur isolé par onglet ne suffit pas : une activité dans un onglet ne
 * doit pas laisser un autre onglet, resté inactif, déclencher une déconnexion
 * intempestive — l'activité est donc diffusée via BroadcastChannel pour
 * réinitialiser le minuteur de tous les onglets ouverts.
 */
export function useInactivityLogout({
  enabled,
  timeoutMs,
  warnBeforeMs,
  onLocalTimeout,
  onRemoteLogout,
}: UseInactivityLogoutOptions) {
  const [warning, setWarning] = useState(false)
  const [remainingMs, setRemainingMs] = useState(warnBeforeMs)

  const warnTimer = useRef<ReturnType<typeof setTimeout>>()
  const logoutTimer = useRef<ReturnType<typeof setTimeout>>()
  const tickInterval = useRef<ReturnType<typeof setInterval>>()
  const channelRef = useRef<BroadcastChannel | null>(null)
  const lastRegisteredAt = useRef(0)

  const clearTimers = useCallback(() => {
    clearTimeout(warnTimer.current)
    clearTimeout(logoutTimer.current)
    clearInterval(tickInterval.current)
  }, [])

  const scheduleTimers = useCallback(() => {
    clearTimers()
    setWarning(false)

    warnTimer.current = setTimeout(() => {
      const start = Date.now()
      setWarning(true)
      setRemainingMs(warnBeforeMs)
      tickInterval.current = setInterval(() => {
        setRemainingMs(Math.max(0, warnBeforeMs - (Date.now() - start)))
      }, 1000)
    }, Math.max(0, timeoutMs - warnBeforeMs))

    logoutTimer.current = setTimeout(onLocalTimeout, timeoutMs)
  }, [timeoutMs, warnBeforeMs, onLocalTimeout, clearTimers])

  const registerActivity = useCallback(
    (broadcast: boolean) => {
      const now = Date.now()
      if (now - lastRegisteredAt.current < ACTIVITY_THROTTLE_MS) return
      lastRegisteredAt.current = now
      scheduleTimers()
      if (broadcast) channelRef.current?.postMessage({ type: 'activity' } satisfies InactivityMessage)
    },
    [scheduleTimers],
  )

  useEffect(() => {
    if (!enabled) {
      clearTimers()
      setWarning(false)
      return
    }

    const channel = 'BroadcastChannel' in window ? new BroadcastChannel(INACTIVITY_CHANNEL_NAME) : null
    channelRef.current = channel

    const handleMessage = (event: MessageEvent<InactivityMessage>) => {
      if (event.data.type === 'activity') registerActivity(false)
      if (event.data.type === 'logout') onRemoteLogout()
    }
    channel?.addEventListener('message', handleMessage)

    const handleActivity = () => registerActivity(true)
    ACTIVITY_EVENTS.forEach((evt) => window.addEventListener(evt, handleActivity, { passive: true }))

    scheduleTimers()

    return () => {
      clearTimers()
      ACTIVITY_EVENTS.forEach((evt) => window.removeEventListener(evt, handleActivity))
      channel?.removeEventListener('message', handleMessage)
      channel?.close()
      channelRef.current = null
    }
  }, [enabled, registerActivity, scheduleTimers, onRemoteLogout, clearTimers])

  const stayActive = useCallback(() => registerActivity(true), [registerActivity])

  return { warning, remainingMs, stayActive }
}
