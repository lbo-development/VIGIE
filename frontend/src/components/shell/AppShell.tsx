import { useCallback } from 'react'
import { Outlet, useLocation } from 'react-router-dom'
import { useSidebarShell } from '../../hooks/useSidebarShell'
import { useTheme } from '../../hooks/useTheme'
import { useAuth } from '../../context/AuthContext'
import { useCurrentUser } from '../../hooks/useCurrentUser'
import { useInactivityLogout } from '../../hooks/useInactivityLogout'
import { useParametre } from '../../hooks/useParametre'
import {
  NAV_ITEMS,
  PARAMETRES_ITEMS,
  MARCHES_SIDEBAR_ITEMS,
  filterParametresItems,
  filterMarchesSidebarItems,
  filterNavItems,
  isMarchesSection,
  isParametresSection,
} from '../../config/navigation'
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
  const location = useLocation()

  const isAdminApp = currentUser?.roles.some((r) => r.typeRole === 'ADMIN_APP') ?? false
  const isAdminService = currentUser?.roles.some((r) => r.typeRole === 'ADMIN_SERVICE') ?? false
  const isCB = currentUser?.roles.some((r) => r.typeRole === 'CB') ?? false
  // Demandeur scopé à son service (voir filterNavItems) : vrai dès qu'un
  // idService est résolu, rôle d'administration ou non.
  const hasOwnService = currentUser?.idService != null
  const visibleNavItems = filterNavItems(NAV_ITEMS, { isAdminApp, isAdminService, hasOwnService })

  // Pages de "Paramètres" accessibles à l'utilisateur courant (ADMIN_APP/
  // ADMIN_SERVICE) — sert à la fois de contenu de sidebar quand la section
  // est active, et de cible du bouton fixe en pied de sidebar (décision du
  // 30/08/2026 : plus de sous-menu dépliable, "Paramètres" n'est plus un
  // onglet du header non plus).
  const parametresItems = filterParametresItems(PARAMETRES_ITEMS, { isAdminApp, isAdminService })
  const parametresLink = parametresItems[0]?.to ?? null

  // "Importation marchés PGI" réservée à ADMIN_APP/ADMIN_SERVICE/CB (décision
  // du 30/08/2026) — "États des marchés" reste visible pour tous.
  const marchesItems = filterMarchesSidebarItems(MARCHES_SIDEBAR_ITEMS, { isAdminApp, isAdminService, isCB })

  // Contenu de la sidebar contextuel à la section active : "en lieu et place
  // des options présentes", pas en plus (Marchés et Paramètres se remplacent
  // mutuellement selon la route courante, jamais combinés).
  const inMarchesSection = isMarchesSection(location.pathname)
  const inParametresSection = isParametresSection(location.pathname)
  const sidebarItems = inMarchesSection ? marchesItems : inParametresSection ? parametresItems : []

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
      <Header items={visibleNavItems} />

      <main className="app-main">
        <section className="content-area" aria-label="Contenu principal">
          <Outlet />
        </section>

        <Sidebar
          items={sidebarItems}
          parametresLink={parametresLink}
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
