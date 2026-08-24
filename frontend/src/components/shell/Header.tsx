import { useEffect, useRef, useState } from 'react'
import { Link, useLocation } from 'react-router-dom'
import logo from '../../assets/logo-gpmm.png'
import type { NavItem } from '../../config/navigation'

const APP_NAME = 'VIGIE'

function isItemActive(pathname: string, to: string) {
  return to === '/' ? pathname === '/' : pathname.startsWith(to)
}

/**
 * En-tête du shell GPMM : bloc marque + onglets de navigation principale.
 * Miroir React de la partie "onglets de navigation" d'`initShell` (app.js) :
 * ici la sélection et le défilement horizontal restent pilotés par le DOM/CSS
 * du template, mais l'onglet actif est déterminé par la route React Router
 * courante plutôt que par un état de clic local (l'appli a de vraies routes,
 * pas des panneaux masqués/affichés dans une page unique).
 */
export function Header({ items }: { items: NavItem[] }) {
  const location = useLocation()
  const tabsRef = useRef<HTMLElement>(null)
  const [scrollState, setScrollState] = useState({ canScrollLeft: false, canScrollRight: false })

  useEffect(() => {
    const tabs = tabsRef.current
    if (!tabs) return

    const updateIndicators = () => {
      const maxScroll = Math.max(0, tabs.scrollWidth - tabs.clientWidth)
      const overflow = maxScroll > 2
      setScrollState({
        canScrollLeft: overflow && tabs.scrollLeft > 2,
        canScrollRight: overflow && tabs.scrollLeft < maxScroll - 2,
      })
    }

    updateIndicators()
    tabs.addEventListener('scroll', updateIndicators, { passive: true })
    window.addEventListener('resize', updateIndicators)
    const observer = new ResizeObserver(updateIndicators)
    observer.observe(tabs)

    return () => {
      tabs.removeEventListener('scroll', updateIndicators)
      window.removeEventListener('resize', updateIndicators)
      observer.disconnect()
    }
  }, [items])

  const scrollTabs = (direction: 1 | -1) => {
    const tabs = tabsRef.current
    if (!tabs) return
    tabs.scrollBy({ left: direction * Math.max(140, tabs.clientWidth * 0.58), behavior: 'smooth' })
  }

  return (
    <header className="app-header">
      <div className="brand-block">
        <img src={logo} alt="Marseille Fos" className="brand-logo" />
        <span className="brand-separator" aria-hidden="true" />
        <span className="app-name">{APP_NAME}</span>
      </div>

      <div className="header-tabs-shell">
        <button
          type="button"
          className="tabs-scroll-btn tabs-scroll-btn--left"
          aria-label="Afficher les onglets précédents"
          hidden={!scrollState.canScrollLeft}
          onClick={() => scrollTabs(-1)}
        >
          <svg className="ti">
            <use href="#i-chevron-left" />
          </svg>
        </button>
        <nav className="header-tabs gp-tabs" ref={tabsRef} aria-label="Modules de l'application" tabIndex={0}>
          {items.map((item) => (
            <Link key={item.to} to={item.to} className="gp-tab" aria-selected={isItemActive(location.pathname, item.to)}>
              {item.label}
            </Link>
          ))}
        </nav>
        <button
          type="button"
          className="tabs-scroll-btn tabs-scroll-btn--right"
          aria-label="Afficher les onglets suivants"
          hidden={!scrollState.canScrollRight}
          onClick={() => scrollTabs(1)}
        >
          <svg className="ti">
            <use href="#i-chevron-right" />
          </svg>
        </button>
      </div>
    </header>
  )
}
