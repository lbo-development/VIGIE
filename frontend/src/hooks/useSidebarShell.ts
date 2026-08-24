import { useCallback, useEffect, useState } from 'react'

const OVERLAY_QUERY = '(max-width: 1199px)'

/**
 * État de la sidebar rétractable GPMM — miroir React de la partie sidebar
 * d'`initShell` (app.js). Desktop (>1199px) : repliage sur place (collapsed).
 * Mobile/tablette (<=1199px) : recouvrement (overlay open/close). Le passage
 * d'un mode à l'autre réinitialise l'état, comme dans le template original.
 */
export function useSidebarShell() {
  const [isOverlay, setIsOverlay] = useState(() => window.matchMedia(OVERLAY_QUERY).matches)
  const [collapsed, setCollapsed] = useState(false)
  const [open, setOpen] = useState(false)

  useEffect(() => {
    const mq = window.matchMedia(OVERLAY_QUERY)
    const syncLayout = (e: MediaQueryListEvent) => {
      setIsOverlay(e.matches)
      setCollapsed(false)
      setOpen(false)
    }
    mq.addEventListener('change', syncLayout)
    return () => mq.removeEventListener('change', syncLayout)
  }, [])

  const toggle = useCallback(() => {
    if (isOverlay) setOpen((v) => !v)
    else setCollapsed((v) => !v)
  }, [isOverlay])

  const expanded = isOverlay ? open : !collapsed
  const railLabel = expanded ? 'Escamoter la navigation' : 'Afficher la navigation'
  const railIcon = expanded ? 'i-chevron-left' : 'i-chevron-right'
  const sidebarHidden = isOverlay && !open

  const shellClassName = [
    'app-shell',
    !isOverlay && collapsed ? 'sidebar-collapsed' : '',
    isOverlay && open ? 'sidebar-open' : '',
  ]
    .filter(Boolean)
    .join(' ')

  return { isOverlay, expanded, railLabel, railIcon, sidebarHidden, shellClassName, toggle }
}
