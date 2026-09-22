import type { MeResponse } from '../hooks/useCurrentUser'

export interface NavItem {
  to: string
  label: string
  /** id du symbole dans icons.svg, sans le "#" (ex: "i-home") */
  icon: string
  /** Affiche un séparateur (`<hr class="divider">`, gpmm.css) juste avant cet item dans la sidebar — voir Sidebar.tsx. Ordre demandé par l'utilisateur pour PARAMETRES_ITEMS (05/09/2026). */
  separatorBefore?: boolean
}

/**
 * Entrées des onglets du header (AppShell : <Header items={visibleNavItems} />,
 * filtrées par filterNavItems ci-dessous).
 *
 * "Fournisseurs" déplacé ici depuis le groupe sidebar "Paramètres" (décision
 * du 29/08/2026).
 *
 * "Suivi des DA" retiré le 15/09/2026 : contenu absorbé par l'onglet
 * "A finaliser" de l'écran d'accueil (pages/Home.tsx, chantier écran
 * d'accueil/workflow FAD) — la page /demandes-achat elle-même a été
 * supprimée, ce n'est plus un doublon.
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
 * "Mes demandes" ci-dessous) — jamais partagé entre deux onglets. C'est pour ça
 * que "Fournisseurs" vit sur `/fournisseurs` et non `/parametres/fournisseurs`
 * (renommé le 30/08/2026) : rester sous `/parametres/...` aurait fait
 * apparaître à tort la sidebar de "Paramètres" sur cette page, `isParametresSection`
 * ne faisant qu'un test de préfixe sur le chemin.
 *
 * "Mes demandes" (décision du 17/09/2026) : sorti de la sidebar "Accueil"
 * pour devenir son propre onglet, juste après "Accueil" — `/` (Accueil)
 * redirige désormais vers la page de suivi du rôle actif de l'utilisateur
 * (AccueilRedirect.tsx), "Mes demandes" (`/mes-demandes`, pages/Home.tsx)
 * restant accessible en permanence à tout utilisateur, avec ou sans rôle.
 */
export const NAV_ITEMS: NavItem[] = [
  { to: '/', label: 'Accueil', icon: 'i-home' },
  { to: '/mes-demandes', label: 'Mes demandes', icon: '' },
  { to: '/marches', label: 'Marchés', icon: '' },
  { to: '/commandes', label: 'Commandes PGI', icon: '' },
  { to: '/investissements', label: 'Investissements', icon: '' },
  { to: '/fournisseurs', label: 'Fournisseurs', icon: '' },
  { to: '/manuel', label: 'Manuel', icon: '' },
]

/**
 * Contenu de la sidebar de la section "Accueil" (décision du 16/09/2026,
 * étend le chantier écran de suivi RC du 15/09/2026 ; "Mes demandes d'achat"
 * sorti de cette liste le 17/09/2026 — devenu son propre onglet du header,
 * voir NAV_ITEMS et AccueilRedirect.tsx) — construite à l'exécution plutôt
 * que filtrée depuis un tableau statique (seule fonction de ce fichier dans
 * ce cas) : le libellé de chaque item dépend d'une donnée runtime (le nom de
 * la cellule/du service du rôle), pas seulement d'une combinaison de
 * booléens de rôle comme les autres filtres ci-dessous.
 *
 * Une entrée par rôle actif de l'utilisateur courant, chacune pointant vers
 * l'écran de suivi propre à ce rôle : RC ("FAD — <cellule>") et, depuis le
 * 16/09/2026, CDS ("FAD (N+2) — <service>", préfixe distinct de RC pour
 * qu'un agent cumulant les deux rôles distingue les deux entrées au premier
 * coup d'œil) — masquées sans le rôle correspondant actif, titulaire ou
 * suppléant (`currentUser.roles` vient déjà de roleEffectifService côté
 * serveur, voir me.service.ts#getCurrentUser, donc couvre la suppléance sans
 * traitement supplémentaire ici) ; liste vide sans aucun rôle (l'utilisateur
 * est alors redirigé vers "Mes demandes" par AccueilRedirect.tsx, jamais
 * vers cette section). CB ("FAD (CB) — <service>", 18/09/2026) et DS
 * ("FAD (N+3) — <direction>", 22/09/2026) rejoignent cette même liste,
 * plutôt que d'ajouter un mécanisme parallèle.
 *
 * Icône par rôle (décision du 17/09/2026, nomenclature #iv-xxx — voir
 * assets/icons-vigie.svg pour l'exception documentée au sprite GPMM) : une
 * icône dédiée par rôle pour distinguer les rôles au premier coup d'œil dans
 * la sidebar (utile en particulier pour un acteur qui cumule plusieurs
 * rôles). #iv-cb/#iv-ds existent déjà dans le sprite — #iv-cb utilisée
 * depuis le 18/09/2026 (écran de suivi CB), #iv-ds depuis le 22/09/2026
 * (écran de suivi DS).
 */
export function getAccueilSidebarItems(currentUser: MeResponse | null): NavItem[] {
  const items: NavItem[] = []
  const rcRole = currentUser?.roles.find((r) => r.typeRole === 'RC')
  if (rcRole) items.push({ to: '/suivi-rc', label: `FAD — ${rcRole.perimeterLabel ?? ''}`, icon: 'iv-rc' })
  const cdsRole = currentUser?.roles.find((r) => r.typeRole === 'CDS')
  if (cdsRole) items.push({ to: '/suivi-cds', label: `FAD (N+2) — ${cdsRole.perimeterLabel ?? ''}`, icon: 'iv-cds' })
  const cbRole = currentUser?.roles.find((r) => r.typeRole === 'CB')
  if (cbRole) items.push({ to: '/suivi-cb', label: `FAD (CB) — ${cbRole.perimeterLabel ?? ''}`, icon: 'iv-cb' })
  const dsRole = currentUser?.roles.find((r) => r.typeRole === 'DS')
  if (dsRole) items.push({ to: '/suivi-ds', label: `FAD (N+3) — ${dsRole.perimeterLabel ?? ''}`, icon: 'iv-ds' })
  return items
}

/** Vrai si la route courante appartient à la section "Accueil" (Accueil Demandeur + suivi RC + suivi CDS + suivi CB + suivi DS — voir AppShell.tsx). */
export function isHomeSection(pathname: string): boolean {
  return (
    pathname === '/' ||
    pathname.startsWith('/suivi-rc') ||
    pathname.startsWith('/suivi-cds') ||
    pathname.startsWith('/suivi-cb') ||
    pathname.startsWith('/suivi-ds')
  )
}

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
 * (page de consultation "État des commandes PGI", voir App.tsx)
 * et de préfixe pour détecter que cette section est active (voir
 * `isCommandesSection`), même mécanique que MARCHES_SECTION_PATH.
 */
export const COMMANDES_SECTION_PATH = '/commandes'

/**
 * "État des commandes PGI" (03/09/2026, CommandesPGI.tsx) reste
 * toujours visible — lecture ouverte à tout utilisateur authentifié, même
 * principe que "États des marchés du service". "Importation des commandes PGI"
 * est réservée ADMIN_APP/ADMIN_SERVICE/CB (voir filterCommandesSidebarItems).
 */
export const COMMANDES_SIDEBAR_ITEMS: NavItem[] = [
  { to: '/commandes', label: 'État des commandes PGI', icon: '' },
  { to: '/commandes/import', label: 'Importation des commandes PGI', icon: '' },
]

/** Vrai si la route courante appartient à la section "Commandes" (voir AppShell.tsx). */
export function isCommandesSection(pathname: string): boolean {
  return pathname === COMMANDES_SECTION_PATH || pathname.startsWith(`${COMMANDES_SECTION_PATH}/`)
}

/**
 * "État des commandes PGI" reste toujours visible (lecture ouverte
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
  return items.filter((item) => item.label !== 'Importation des commandes PGI')
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
 * "Importation des commandes PGI" (filterCommandesSidebarItems).
 */
export function filterInvestissementsSidebarItems(
  items: NavItem[],
  { isAdminApp, isAdminService, isCB }: { isAdminApp: boolean; isAdminService: boolean; isCB: boolean },
): NavItem[] {
  if (isAdminApp || isAdminService || isCB) return items
  return items.filter((item) => item.label !== 'Importation investissements PGI')
}

/**
 * Racine de la section "Manuel" (16/09/2026) — manuel d'utilisation HTML
 * rédigé au fil du développement (un fichier par module fonctionnel, voir
 * frontend/src/assets/manuel/*.html et pages/Manuel.tsx), accessible aux
 * utilisateurs authentifiés comme n'importe quelle autre page de l'app —
 * pas de route publique dédiée, ni de fichier statique servi hors de
 * l'authentification.
 */
export const MANUEL_SECTION_PATH = '/manuel'

/**
 * Un item par module documenté — ajouter une entrée ici en même temps que
 * le fichier frontend/src/assets/manuel/<slug>.html correspondant (voir
 * pages/Manuel.tsx, qui charge le contenu par le même slug).
 */
export const MANUEL_SIDEBAR_ITEMS: NavItem[] = [{ to: '/manuel/accueil', label: 'Accueil', icon: '' }]

/** Vrai si la route courante appartient à la section "Manuel" (voir AppShell.tsx). */
export function isManuelSection(pathname: string): boolean {
  return pathname === MANUEL_SECTION_PATH || pathname.startsWith(`${MANUEL_SECTION_PATH}/`)
}

/** Racine de la section "Paramètres" (voir `isParametresSection`). */
export const PARAMETRES_SECTION_PATH = '/parametres'

/**
 * Pages de paramétrage, montrées en liste plate dans la sidebar quand la
 * section "Paramètres" est active (décision du 30/08/2026 : plus de
 * sous-menu dépliable — remplace l'ancien groupe SIDEBAR_GROUPS/NavGroup).
 * Le point d'entrée de la section est le bouton dédié en pied de sidebar
 * (voir Sidebar.tsx), visible pour ADMIN_APP/ADMIN_SERVICE uniquement.
 *
 * Ordre et séparateurs (`separatorBefore`) fixés par l'utilisateur le
 * 05/09/2026 : référentiel organisationnel (Directions/Services/Cellules),
 * puis CUG et les deux gisements, un trait, les deux référentiels de
 * paramétrage transverses (Seuils de validation DS / Référentiel libellé),
 * un trait, puis Réglages seul en dernier.
 */
export const PARAMETRES_ITEMS: NavItem[] = [
  { to: '/parametres/directions', label: 'Directions', icon: '' },
  { to: '/parametres/services', label: 'Services', icon: '' },
  { to: '/parametres/cellules', label: 'Cellules', icon: '' },
  { to: '/parametres/cug', label: 'CUG', icon: '' },
  { to: '/parametres/gisement-geographique', label: 'Gisement géographique', icon: '' },
  { to: '/parametres/gisement-technique', label: 'Gisement technique', icon: '' },
  { to: '/parametres/seuils-validation-ds', label: 'Seuils de validation DS', icon: '', separatorBefore: true },
  { to: '/parametres/libelle-referentiel', label: 'Référentiel libellé', icon: '' },
  // Utilisateurs (fiche acteur + compte, ADMIN_APP seul) et Rôles (attribution
  // de rôle, ADMIN_APP + ADMIN_SERVICE scopé à son service) — décision du
  // 10/09/2026, ForClaude/CDC/mot-phases-1-2.md.
  { to: '/parametres/utilisateurs', label: 'Utilisateurs', icon: '', separatorBefore: true },
  { to: '/parametres/roles', label: 'Rôles', icon: '' },
  // Signatures (dépôt/remplacement de l'image de signature d'un acteur, ADMIN_APP +
  // ADMIN_SERVICE scopé à son service, même périmètre que Rôles) — décision du 19/09/2026,
  // alimente la fiche FAD papier générée par la CB (demandeAchat.service.ts#genererFadPdf).
  { to: '/parametres/signatures', label: 'Signatures', icon: '' },
  { to: '/parametres/reglages', label: 'Réglages', icon: '', separatorBefore: true },
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
 * SITE/SECTEUR). "Référentiel libellé" (05/09/2026) rejoint cet ensemble :
 * référentiel générique transverse (finances.libelle_referentiel), sans
 * notion de service propriétaire, contrairement à CUG. "Seuils de validation
 * DS" et "CUG" sont accessibles à ADMIN_SERVICE (scopé à son service) : ils
 * ne sont donc pas dans cet ensemble.
 */
const ADMIN_APP_ONLY_LABELS = new Set(['Réglages', 'Directions', 'Services', 'Cellules', 'Référentiel libellé', 'Utilisateurs'])

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
