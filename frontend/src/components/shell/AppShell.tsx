import { useCallback } from 'react'
import { Outlet } from 'react-router-dom'
import { useSidebarShell } from '../../hooks/useSidebarShell'
import { useTheme } from '../../hooks/useTheme'
import { useAuth } from '../../context/AuthContext'
import { useCurrentUser } from '../../hooks/useCurrentUser'
import { useInactivityLogout } from '../../hooks/useInactivityLogout'
import { useParametre } from '../../hooks/useParametre'
import { NAV_ITEMS, SIDEBAR_GROUPS, filterSidebarGroups } from '../../config/navigation'
import { Header } from './Header'
import { Sidebar } from './Sidebar'
import { StatusBar } from './StatusBar'
import { InactivityWarning } from './InactivityWarning'

// SECURITY.md §1.1 : délai d'inactivité avant déconnexion automatique (poste
// partagé), et durée de l'avertissement affiché juste avant l'échéance.
// Le délai lui-même est paramétrable (global/direction/service, voir
// docs/ARCHITECTURE.md "Paramétrage applicatif") — cette constante n'est plus
// que la valeur de repli tant que le paramètre n'est pas encore chargé, ou en
// cas d'échec de lecture.
const INACTIVITY_TIMEOUT_DEFAULT_MINUTES = 30
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
  const { data: currentUser } = useCurrentUser()

  const isAdminApp = currentUser?.roles.some((r) => r.typeRole === 'ADMIN_APP') ?? false
  const isAdminService = currentUser?.roles.some((r) => r.typeRole === 'ADMIN_SERVICE') ?? false
  const visibleSidebarGroups = filterSidebarGroups(SIDEBAR_GROUPS, { isAdminApp, isAdminService })

  const inactivityDelayMinutes = useParametre(
    'auth.inactivite_delai_minutes',
    INACTIVITY_TIMEOUT_DEFAULT_MINUTES,
    Boolean(session),
  )

  const onLocalTimeout = useCallback(() => {
    void signOut()
  }, [signOut])
  const onRemoteLogout = useCallback(() => {
    window.location.replace('/login')
  }, [])

  const inactivity = useInactivityLogout({
    enabled: Boolean(session),
    timeoutMs: inactivityDelayMinutes * 60 * 1000,
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

        <Sidebar
          items={[]}
          groups={visibleSidebarGroups}
          hidden={sidebarShell.sidebarHidden}
          theme={theme}
          onToggleTheme={toggleTheme}
        />

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
