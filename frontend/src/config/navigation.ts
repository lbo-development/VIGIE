export interface NavItem {
  to: string
  label: string
  /** id du symbole dans icons.svg, sans le "#" (ex: "i-home") */
  icon: string
}

export interface NavGroup {
  label: string
  /** id du symbole dans icons.svg, sans le "#" */
  icon: string
  items: NavItem[]
}

/**
 * Entrées des onglets du header (AppShell : <Header items={NAV_ITEMS} />).
 * Depuis le retrait d'"Accueil" de la sidebar, ce tableau n'alimente plus que
 * le header — AppShell passe `items={[]}` à <Sidebar />, dont la liste plate
 * ("items", distincte des groupes dépliables SIDEBAR_GROUPS) reste utilisable
 * si un item de nav sidebar à plat redevient pertinent.
 */
export const NAV_ITEMS: NavItem[] = [{ to: '/', label: 'Accueil', icon: 'i-home' }]

/**
 * Groupes dépliables propres à la sidebar (pattern .menu-group/.submenu du
 * template GPMM — n'apparaissent jamais dans les onglets du header). À
 * distinguer du bouton "Paramètres" du pied de sidebar (sidebar-footer,
 * structure fixe du shell — voir Sidebar.tsx) : ceci est la navigation vers
 * de vraies pages de paramétrage.
 */
export const SIDEBAR_GROUPS: NavGroup[] = [
  {
    label: 'Paramètres',
    icon: 'i-settings',
    items: [
      { to: '/parametres/gisement-geographique', label: 'Gisement géographique', icon: '' },
      { to: '/parametres/gisement-technique', label: 'Gisement technique', icon: '' },
      { to: '/parametres/reglages', label: 'Réglages', icon: '' },
      { to: '/parametres/directions', label: 'Directions', icon: '' },
      { to: '/parametres/services', label: 'Services', icon: '' },
      { to: '/parametres/cellules', label: 'Cellules', icon: '' },
    ],
  },
]

/**
 * Entrées du groupe "Paramètres" réservées à ADMIN_APP seul, même quand le
 * groupe reste visible pour ADMIN_SERVICE : "Réglages" (paramétrage
 * applicatif) et le référentiel organisationnel Direction/Service/Cellule —
 * DIRECTION/SERVICE/CELLULE forment la hiérarchie elle-même, leur gestion
 * est nécessairement transverse (pas de périmètre ADMIN_SERVICE possible,
 * contrairement à SITE/SECTEUR — voir organisation.service.ts).
 */
const ADMIN_APP_ONLY_LABELS = new Set(['Réglages', 'Directions', 'Services', 'Cellules'])

/**
 * Filtre les groupes de la sidebar selon les rôles courants : une option de
 * navigation n'apparaît que si l'utilisateur peut effectivement agir dessus
 * (préférence produit : mieux vaut ne pas la montrer que la montrer
 * désactivée/inopérante). "Paramètres" (ADMIN_APP/ADMIN_SERVICE, écriture sur
 * SITE/SOUS_SITE et SECTEUR/SOUS_SECTEUR) disparaît entièrement sans l'un des
 * deux rôles ; les entrées de ADMIN_APP_ONLY_LABELS sont en plus réservées à
 * ADMIN_APP seul.
 */
export function filterSidebarGroups(
  groups: NavGroup[],
  { isAdminApp, isAdminService }: { isAdminApp: boolean; isAdminService: boolean },
): NavGroup[] {
  if (!isAdminApp && !isAdminService) return groups.filter((group) => group.label !== 'Paramètres')

  return groups.map((group) =>
    group.label === 'Paramètres'
      ? { ...group, items: group.items.filter((item) => !ADMIN_APP_ONLY_LABELS.has(item.label) || isAdminApp) }
      : group,
  )
}
