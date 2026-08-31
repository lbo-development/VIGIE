import { Link, useLocation } from 'react-router-dom'
import type { NavItem } from '../../config/navigation'
import type { Theme } from '../../hooks/useTheme'

/**
 * Correspondance EXACTE, contrairement à Header.tsx (préfixe, car un onglet y
 * représente toute une section). Les items de la sidebar sont des pages
 * précises (feuilles), pas des sections — un préfixe romprait dès que deux
 * routes s'emboîtent littéralement (ex. "/marches" est un préfixe de
 * "/marches/import" : les deux s'activaient en même temps, bug du 30/08/2026).
 */
function isItemActive(pathname: string, to: string) {
  return pathname === to
}

interface SidebarProps {
  items: NavItem[]
  /** Cible du bouton "Paramètres" en pied de sidebar, ou `null` si la section n'est pas accessible à l'utilisateur courant. */
  parametresLink: string | null
  hidden: boolean
  theme: Theme
  onToggleTheme: () => void
}

/**
 * Sidebar rétractable GPMM. Le repli/dépli est piloté depuis AppShell
 * (classes sidebar-collapsed/sidebar-open sur .app-shell + languette
 * .sidebar-rail-toggle) — ce composant ne gère que son propre contenu.
 *
 * `items` : liste plate, contenu contextuel selon la section active (voir
 * AppShell.tsx — Marchés/Paramètres remplacent entièrement ce qui y figurait
 * selon la route courante). Plus de sous-menu dépliable depuis le 30/08/2026
 * (l'ancien groupe "Paramètres" du pattern .menu-group/.submenu a été
 * retiré) : `parametresLink` est le seul vestige de "Paramètres" hors
 * section, un simple lien fixe en pied de sidebar.
 */
export function Sidebar({ items, parametresLink, hidden, theme, onToggleTheme }: SidebarProps) {
  const location = useLocation()
  const isDark = theme === 'dark'

  return (
    <aside className="app-sidebar" aria-label="Navigation principale latérale" aria-hidden={hidden}>
      <nav className="sidebar-nav gp-scroll">
        {items.map((item) => (
          <Link
            key={item.to}
            to={item.to}
            className={`sidebar-item${isItemActive(location.pathname, item.to) ? ' is-active' : ''}`}
            data-label={item.label}
          >
            <svg className="ti">
              <use href={`#${item.icon}`} />
            </svg>
            <span className="sidebar-label">{item.label}</span>
          </Link>
        ))}
      </nav>

      <div className="sidebar-footer">
        {parametresLink && (
          <>
            <Link to={parametresLink} className="sidebar-footer-action" title="Paramètres">
              <svg className="ti">
                <use href="#i-settings" />
              </svg>
              <span className="sidebar-label">Paramètres</span>
            </Link>
            <span className="sidebar-footer-separator" aria-hidden="true" />
          </>
        )}
        <button
          type="button"
          className="sidebar-footer-action theme-toggle"
          title="Changer de thème"
          aria-pressed={isDark}
          onClick={onToggleTheme}
        >
          <svg className="ti">
            <use href={isDark ? '#i-sun' : '#i-moon'} />
          </svg>
          <span className="sidebar-label">{isDark ? 'Clair' : 'Sombre'}</span>
        </button>
      </div>
    </aside>
  )
}
