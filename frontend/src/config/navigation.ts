export interface NavItem {
  to: string
  label: string
  /** id du symbole dans icons.svg, sans le "#" (ex: "i-home") */
  icon: string
}

/**
 * Entrées des onglets du header (AppShell : <Header items={visibleNavItems} />,
 * filtrées par filterNavItems ci-dessous).
 *
 * "Fournisseurs" déplacé ici depuis le groupe sidebar "Paramètres" (décision
 * du 29/08/2026) — juste après "Accueil".
 *
 * "Marchés" ajouté le 30/08/2026, juste avant "Fournisseurs" — section à part :
 * sa sélection bascule tout le contenu de la sidebar sur `MARCHES_SIDEBAR_ITEMS`
 * (voir `isMarchesSection` ci-dessous et AppShell.tsx).
 *
 * "Paramètres" ne figure PAS dans ce tableau : son point d'entrée est le
 * bouton dédié en bas de la sidebar (pied de sidebar, voir Sidebar.tsx),
 * pas un onglet du header (décision du 30/08/2026).
 *
 * Règle générale (30/08/2026) : chaque onglet du header est associé à son
 * propre contenu de sidebar (liste vide si aucun, comme "Fournisseurs" et
 * "Accueil" ci-dessous) — jamais partagé entre deux onglets. C'est pour ça
 * que "Fournisseurs" vit sur `/fournisseurs` et non `/parametres/fournisseurs`
 * (renommé le 30/08/2026) : rester sous `/parametres/...` aurait fait
 * apparaître à tort la sidebar de "Paramètres" sur cette page, `isParametresSection`
 * ne faisant qu'un test de préfixe sur le chemin.
 */
export const NAV_ITEMS: NavItem[] = [
  { to: '/', label: 'Accueil', icon: 'i-home' },
  { to: '/marches', label: 'Marchés', icon: '' },
  { to: '/fournisseurs', label: 'Fournisseurs', icon: '' },
]

/**
 * Racine de la section "Marchés" — sert à la fois de route par défaut
 * (sélectionnée à l'entrée dans la section, voir App.tsx) et de préfixe pour
 * détecter que cette section est active (voir `isMarchesSection`).
 */
export const MARCHES_SECTION_PATH = '/marches'

/**
 * Contenu de la sidebar quand la section "Marchés" est active : remplace
 * entièrement ce qui y figurait (décision du 30/08/2026 : "en lieu et place
 * des options présentes", pas en plus) — liste plate, pas de sous-menu.
 */
export const MARCHES_SIDEBAR_ITEMS: NavItem[] = [
  { to: '/marches', label: 'États des marchés', icon: '' },
  { to: '/marches/import', label: 'Importation marchés PGI', icon: '' },
]

/** Vrai si la route courante appartient à la section "Marchés" (voir AppShell.tsx). */
export function isMarchesSection(pathname: string): boolean {
  return pathname === MARCHES_SECTION_PATH || pathname.startsWith(`${MARCHES_SECTION_PATH}/`)
}

/** Racine de la section "Paramètres" (voir `isParametresSection`). */
export const PARAMETRES_SECTION_PATH = '/parametres'

/**
 * Pages de paramétrage, montrées en liste plate dans la sidebar quand la
 * section "Paramètres" est active (décision du 30/08/2026 : plus de
 * sous-menu dépliable — remplace l'ancien groupe SIDEBAR_GROUPS/NavGroup).
 * Le point d'entrée de la section est le bouton dédié en pied de sidebar
 * (voir Sidebar.tsx), visible pour ADMIN_APP/ADMIN_SERVICE uniquement.
 */
export const PARAMETRES_ITEMS: NavItem[] = [
  { to: '/parametres/gisement-geographique', label: 'Gisement géographique', icon: '' },
  { to: '/parametres/gisement-technique', label: 'Gisement technique', icon: '' },
  { to: '/parametres/reglages', label: 'Réglages', icon: '' },
  { to: '/parametres/directions', label: 'Directions', icon: '' },
  { to: '/parametres/services', label: 'Services', icon: '' },
  { to: '/parametres/cellules', label: 'Cellules', icon: '' },
  { to: '/parametres/seuils-validation-ds', label: 'Seuils de validation DS', icon: '' },
  { to: '/parametres/cug', label: 'CUG', icon: '' },
]

/** Vrai si la route courante appartient à la section "Paramètres" (voir AppShell.tsx). */
export function isParametresSection(pathname: string): boolean {
  return pathname === PARAMETRES_SECTION_PATH || pathname.startsWith(`${PARAMETRES_SECTION_PATH}/`)
}

/**
 * Entrées réservées à ADMIN_APP seul, même quand la section reste accessible
 * à ADMIN_SERVICE : "Réglages" (paramétrage applicatif) et le référentiel
 * organisationnel Direction/Service/Cellule — DIRECTION/SERVICE/CELLULE
 * forment la hiérarchie elle-même, leur gestion est nécessairement
 * transverse (pas de périmètre ADMIN_SERVICE possible, contrairement à
 * SITE/SECTEUR). "Seuils de validation DS" et "CUG" sont accessibles à
 * ADMIN_SERVICE (scopé à son service) : ils ne sont donc pas dans cet
 * ensemble.
 */
const ADMIN_APP_ONLY_LABELS = new Set(['Réglages', 'Directions', 'Services', 'Cellules'])

/**
 * Filtre les pages de "Paramètres" selon les rôles courants : section
 * entièrement masquée sans ADMIN_APP ni ADMIN_SERVICE (liste vide) ; les
 * entrées de ADMIN_APP_ONLY_LABELS sont en plus réservées à ADMIN_APP seul.
 */
export function filterParametresItems(
  items: NavItem[],
  { isAdminApp, isAdminService }: { isAdminApp: boolean; isAdminService: boolean },
): NavItem[] {
  if (!isAdminApp && !isAdminService) return []
  return items.filter((item) => !ADMIN_APP_ONLY_LABELS.has(item.label) || isAdminApp)
}

/**
 * Filtre les onglets du header : "Accueil" et "Marchés" restent toujours
 * visibles. "Fournisseurs" (déplacé ici depuis la sidebar le 29/08/2026)
 * suit la réalité des droits d'accès à la gestion des fournisseurs (décision
 * du 29/08/2026, voir fournisseur.service.ts) : ADMIN_APP (transverse),
 * ADMIN_SERVICE (scopé à son service), **et** un Demandeur scopé à son
 * propre service (pas de rôle dédié, voir ForClaude/CDC/mot-phases-1-2.md
 * l.15 — un Demandeur peut créer un fournisseur pour son service). `hasOwnService`
 * couvre ce troisième cas : vrai dès que l'acteur est rattaché à un service
 * (ACTEUR.ID_CELLULE → SERVICE, exposé par `/api/me#idService`), qu'il ait
 * ou non un rôle d'administration. Seul un compte non rattaché à un ACTEUR
 * (matricule/idService encore `null`) ne voit pas l'onglet.
 */
export function filterNavItems(
  items: NavItem[],
  {
    isAdminApp,
    isAdminService,
    hasOwnService,
  }: { isAdminApp: boolean; isAdminService: boolean; hasOwnService: boolean },
): NavItem[] {
  if (isAdminApp || isAdminService || hasOwnService) return items
  return items.filter((item) => item.label !== 'Fournisseurs')
}
