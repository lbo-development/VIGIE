import { useCallback } from 'react'
import { Outlet } from 'react-router-dom'
import { useSidebarShell } from '../../hooks/useSidebarShell'
import { useTheme } from '../../hooks/useTheme'
import { useAuth } from '../../context/AuthContext'
import { useInactivityLogout } from '../../hooks/useInactivityLogout'
import { NAV_ITEMS } from '../../config/navigation'
import { Header } from './Header'
import { Sidebar } from './Sidebar'
import { StatusBar } from './StatusBar'
import { InactivityWarning } from './InactivityWarning'

// SECURITY.md §1.1 : délai d'inactivité avant déconnexion automatique (poste
// partagé), et durée de l'avertissement affiché juste avant l'échéance.
const INACTIVITY_TIMEOUT_MS = 30 * 60 * 1000
const INACTIVITY_WARNING_MS = 60 * 1000

/**
 * Shell applicatif GPMM (header / sidebar rétractable / statusbar), monté
 * une seule fois autour du routing (voir App.tsx). Réimplémentation React de
 * la structure décrite dans starter-vierge.html — voir la mémoire projet
 * "UX React integration" pour le choix de ne pas charger app.js.
 */
export function AppShell() {
  const { theme, toggleTheme } = useTheme()
  const sidebarShell = useSidebarShell()
  const { session, signOut } = useAuth()

  const onLocalTimeout = useCallback(() => {
    void signOut()
  }, [signOut])
  const onRemoteLogout = useCallback(() => {
    window.location.replace('/login')
  }, [])

  const inactivity = useInactivityLogout({
    enabled: Boolean(session),
    timeoutMs: INACTIVITY_TIMEOUT_MS,
    warnBeforeMs: INACTIVITY_WARNING_MS,
    onLocalTimeout,
    onRemoteLogout,
  })

  return (
    <div className={sidebarShell.shellClassName}>
      <Header items={NAV_ITEMS} />

      <main className="app-main">
        <section className="content-area" aria-label="Contenu principal">
          <Outlet />
        </section>

        <Sidebar items={NAV_ITEMS} hidden={sidebarShell.sidebarHidden} theme={theme} onToggleTheme={toggleTheme} />

        <button
          type="button"
          className="sidebar-rail-toggle"
          aria-expanded={sidebarShell.expanded}
          aria-label={sidebarShell.railLabel}
          onClick={sidebarShell.toggle}
        >
          <svg className="ti">
            <use href={`#${sidebarShell.railIcon}`} />
          </svg>
        </button>
      </main>

      <StatusBar />

      <div className="sidebar-backdrop" aria-hidden="true" />

      {inactivity.warning && (
        <InactivityWarning remainingMs={inactivity.remainingMs} onStayActive={inactivity.stayActive} />
      )}
    </div>
  )
}
