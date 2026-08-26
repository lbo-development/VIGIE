import { useState } from 'react'
import { Link, useLocation } from 'react-router-dom'
import type { NavGroup, NavItem } from '../../config/navigation'
import type { Theme } from '../../hooks/useTheme'

function isItemActive(pathname: string, to: string) {
  return to === '/' ? pathname === '/' : pathname.startsWith(to)
}

interface SidebarProps {
  items: NavItem[]
  groups: NavGroup[]
  hidden: boolean
  theme: Theme
  onToggleTheme: () => void
}

/**
 * Sidebar rétractable GPMM. Le repli/dépli est piloté depuis AppShell
 * (classes sidebar-collapsed/sidebar-open sur .app-shell + languette
 * .sidebar-rail-toggle) — ce composant ne gère que son propre contenu.
 *
 * groups (menu-group/submenu, cf. app.js/gpmm.css) : réimplémentation React
 * du toggle du template (clic sur .menu-trigger -> .is-open sur .menu-group).
 * Un groupe contenant la route active s'ouvre automatiquement, en plus du
 * toggle manuel.
 */
export function Sidebar({ items, groups, hidden, theme, onToggleTheme }: SidebarProps) {
  const location = useLocation()
  const isDark = theme === 'dark'
  const [manuallyOpen, setManuallyOpen] = useState<Set<string>>(new Set())

  // Raccourci du pied de sidebar : mène à la première page du groupe
  // "Paramètres" de la nav plutôt que de dupliquer une destination en dur.
  const parametresShortcut = groups.find((group) => group.label === 'Paramètres')?.items[0]?.to

  const toggleGroup = (label: string) => {
    setManuallyOpen((prev) => {
      const next = new Set(prev)
      if (next.has(label)) next.delete(label)
      else next.add(label)
      return next
    })
  }

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

        {groups.map((group) => {
          const hasActiveChild = group.items.some((item) => isItemActive(location.pathname, item.to))
          const isOpen = manuallyOpen.has(group.label) || hasActiveChild

          return (
            <div key={group.label} className={`menu-group${isOpen ? ' is-open' : ''}`}>
              <button
                type="button"
                className="sidebar-item menu-trigger"
                aria-expanded={isOpen}
                onClick={() => toggleGroup(group.label)}
              >
                <svg className="ti">
                  <use href={`#${group.icon}`} />
                </svg>
                <span className="sidebar-label">{group.label}</span>
                <svg className="ti menu-chevron">
                  <use href="#i-chevron-down" />
                </svg>
              </button>
              <div className="submenu">
                {group.items.map((item) => (
                  <Link key={item.to} to={item.to}>
                    {item.label}
                  </Link>
                ))}
              </div>
            </div>
          )
        })}
      </nav>

      <div className="sidebar-footer">
        {parametresShortcut && (
          <>
            <Link to={parametresShortcut} className="sidebar-footer-action" title="Paramètres">
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
