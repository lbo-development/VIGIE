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
  { to: '/commandes', label: 'Commandes', icon: '' },
  { to: '/investissements', label: 'Investissements', icon: '' },
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
  { to: '/marches', label: 'États des marchés du service', icon: '' },
  { to: '/marches/import', label: 'Importation marchés service', icon: '' },
  { to: '/marches/tiers', label: "Marchés d'un service tiers", icon: '' },
  { to: '/marches/tdb', label: 'Tableau de bord', icon: '' },
]

/** Vrai si la route courante appartient à la section "Marchés" (voir AppShell.tsx). */
export function isMarchesSection(pathname: string): boolean {
  return pathname === MARCHES_SECTION_PATH || pathname.startsWith(`${MARCHES_SECTION_PATH}/`)
}

/**
 * Filtre les items de la section "Marchés" : "États des marchés du service",
 * "Marchés d'un service tiers" (nommé ainsi le 01/09/2026 — anciennement
 * "Marchés externes", coquille sans définition métier) et "Tableau de bord"
 * (ajouté le 02/09/2026, lecture agrégée des deux entités ci-dessus) restent
 * toujours visibles : la lecture y est ouverte à tout utilisateur authentifié
 * (voir marcheTiers.service.ts#listMarcheTiers, même principe que
 * marche.service.ts#listMarches — seules la création et la modification d'un
 * marché tiers y sont réservées ADMIN_APP/ADMIN_SERVICE/CB, appliqué dans
 * MarchesTiers.tsx via `canManage`, pas au niveau de cette entrée de menu).
 * "Importation marchés service" (renommé le 01/09/2026, anciennement
 * "Importation marchés PGI") est réservée à ADMIN_APP (transverse),
 * ADMIN_SERVICE (scopé à son service) et CB (Contrôle Budgétaire, scopé à
 * son service — décision du 30/08/2026, voir
 * `ForClaude/Importation-marches/import-marches-pgi.md` §4) — pas de rôle
 * ADMIN_APP/ADMIN_SERVICE nécessaire, mais un des trois.
 */
export function filterMarchesSidebarItems(
  items: NavItem[],
  { isAdminApp, isAdminService, isCB }: { isAdminApp: boolean; isAdminService: boolean; isCB: boolean },
): NavItem[] {
  if (isAdminApp || isAdminService || isCB) return items
  return items.filter((item) => item.label !== 'Importation marchés service')
}

/**
 * Racine de la section "Commandes" — sert à la fois de route par défaut
 * (page de consultation "État des commandes PGI du service", voir App.tsx)
 * et de préfixe pour détecter que cette section est active (voir
 * `isCommandesSection`), même mécanique que MARCHES_SECTION_PATH.
 */
export const COMMANDES_SECTION_PATH = '/commandes'

/**
 * "État des commandes PGI du service" (03/09/2026, CommandesPGI.tsx) reste
 * toujours visible — lecture ouverte à tout utilisateur authentifié, même
 * principe que "États des marchés du service". "Importation commandes PGI"
 * est réservée ADMIN_APP/ADMIN_SERVICE/CB (voir filterCommandesSidebarItems).
 */
export const COMMANDES_SIDEBAR_ITEMS: NavItem[] = [
  { to: '/commandes', label: 'État des commandes PGI du service', icon: '' },
  { to: '/commandes/import', label: 'Importation commandes PGI', icon: '' },
]

/** Vrai si la route courante appartient à la section "Commandes" (voir AppShell.tsx). */
export function isCommandesSection(pathname: string): boolean {
  return pathname === COMMANDES_SECTION_PATH || pathname.startsWith(`${COMMANDES_SECTION_PATH}/`)
}

/**
 * "État des commandes PGI du service" reste toujours visible (lecture ouverte
 * à tous, voir commandePgi.service.ts#listCommandesPgi). "Importation
 * commandes PGI" est réservée à ADMIN_APP (transverse), ADMIN_SERVICE et CB
 * (scopés à leur service) — même triplet que "Importation marchés service"
 * (filterMarchesSidebarItems).
 */
export function filterCommandesSidebarItems(
  items: NavItem[],
  { isAdminApp, isAdminService, isCB }: { isAdminApp: boolean; isAdminService: boolean; isCB: boolean },
): NavItem[] {
  if (isAdminApp || isAdminService || isCB) return items
  return items.filter((item) => item.label !== 'Importation commandes PGI')
}

/**
 * Racine de la section "Investissements" — sert à la fois de route par défaut (page de
 * consultation "État des investissements PGI du service", voir App.tsx) et de préfixe pour
 * détecter que cette section est active (voir `isInvestissementsSection`), même mécanique que
 * COMMANDES_SECTION_PATH.
 */
export const INVESTISSEMENTS_SECTION_PATH = '/investissements'

/**
 * "État des investissements PGI du service" (InvestissementsPGI.tsx) reste toujours visible —
 * lecture ouverte à tout utilisateur authentifié, même principe que "État des commandes PGI du
 * service". "Importation investissements PGI" est réservée ADMIN_APP/ADMIN_SERVICE/CB (voir
 * filterInvestissementsSidebarItems).
 */
export const INVESTISSEMENTS_SIDEBAR_ITEMS: NavItem[] = [
  { to: '/investissements', label: 'État des investissements PGI du service', icon: '' },
  { to: '/investissements/import', label: 'Importation investissements PGI', icon: '' },
]

/** Vrai si la route courante appartient à la section "Investissements" (voir AppShell.tsx). */
export function isInvestissementsSection(pathname: string): boolean {
  return pathname === INVESTISSEMENTS_SECTION_PATH || pathname.startsWith(`${INVESTISSEMENTS_SECTION_PATH}/`)
}

/**
 * "État des investissements PGI du service" reste toujours visible (lecture ouverte à tous, voir
 * investissement.service.ts#listInvestissements). "Importation investissements PGI" est réservée
 * à ADMIN_APP (transverse), ADMIN_SERVICE et CB (scopés à leur service) — même triplet que
 * "Importation commandes PGI" (filterCommandesSidebarItems).
 */
export function filterInvestissementsSidebarItems(
  items: NavItem[],
  { isAdminApp, isAdminService, isCB }: { isAdminApp: boolean; isAdminService: boolean; isCB: boolean },
): NavItem[] {
  if (isAdminApp || isAdminService || isCB) return items
  return items.filter((item) => item.label !== 'Importation investissements PGI')
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
