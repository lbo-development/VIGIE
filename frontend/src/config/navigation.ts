export interface NavItem {
  to: string
  label: string
  /** id du symbole dans icons.svg, sans le "#" (ex: "i-home") */
  icon: string
}

/**
 * Entrées de navigation communes aux onglets du header et à la sidebar.
 * Une entrée = une route déclarée dans App.tsx. À étendre au fil de l'ajout de pages.
 */
export const NAV_ITEMS: NavItem[] = [{ to: '/', label: 'Accueil', icon: 'i-home' }]
