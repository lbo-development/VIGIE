import { Link, useLocation } from 'react-router-dom'
import type { NavItem } from '../../config/navigation'
import type { Theme } from '../../hooks/useTheme'

function isItemActive(pathname: string, to: string) {
  return to === '/' ? pathname === '/' : pathname.startsWith(to)
}

interface SidebarProps {
  items: NavItem[]
  hidden: boolean
  theme: Theme
  onToggleTheme: () => void
}

/**
 * Sidebar rétractable GPMM. Le repli/dépli est piloté depuis AppShell
 * (classes sidebar-collapsed/sidebar-open sur .app-shell + languette
 * .sidebar-rail-toggle) — ce composant ne gère que son propre contenu.
 */
export function Sidebar({ items, hidden, theme, onToggleTheme }: SidebarProps) {
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
        <button type="button" className="sidebar-footer-action" title="Paramètres">
          <svg className="ti">
            <use href="#i-settings" />
          </svg>
          <span className="sidebar-label">Paramètres</span>
        </button>
        <span className="sidebar-footer-separator" aria-hidden="true" />
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
