import { describe, it, expect } from 'vitest'
import {
  filterParametresItems,
  filterMarchesSidebarItems,
  filterCommandesSidebarItems,
  filterInvestissementsSidebarItems,
  filterNavItems,
  getAccueilSidebarItems,
  isHomeSection,
  isMarchesSection,
  isCommandesSection,
  isInvestissementsSection,
  isParametresSection,
  PARAMETRES_ITEMS,
  MARCHES_SIDEBAR_ITEMS,
  COMMANDES_SIDEBAR_ITEMS,
  INVESTISSEMENTS_SIDEBAR_ITEMS,
  NAV_ITEMS,
} from './navigation'
import type { MeResponse } from '../hooks/useCurrentUser'

describe('filterParametresItems', () => {
  it("retourne une liste vide sans ADMIN_APP ni ADMIN_SERVICE (section masquée)", () => {
    const result = filterParametresItems(PARAMETRES_ITEMS, { isAdminApp: false, isAdminService: false })

    expect(result).toEqual([])
  })

  it('ADMIN_SERVICE voit "Paramètres" (dont "Seuils de validation DS", "CUG" et "Rôles") mais pas "Réglages", "Référentiel libellé" ni "Utilisateurs"', () => {
    const result = filterParametresItems(PARAMETRES_ITEMS, { isAdminApp: false, isAdminService: true })

    expect(result.map((i) => i.label)).toEqual([
      'CUG',
      'Gisement géographique',
      'Gisement technique',
      'Seuils de validation DS',
      'Rôles',
      'Signatures',
    ])
  })

  it('ADMIN_APP voit toutes les entrées, dans l\'ordre Directions/Services/Cellules/CUG/gisements puis Seuils de validation DS/Référentiel libellé/Utilisateurs/Rôles/Signatures puis Réglages', () => {
    const result = filterParametresItems(PARAMETRES_ITEMS, { isAdminApp: true, isAdminService: false })

    expect(result.map((i) => i.label)).toEqual([
      'Directions',
      'Services',
      'Cellules',
      'CUG',
      'Gisement géographique',
      'Gisement technique',
      'Seuils de validation DS',
      'Référentiel libellé',
      'Utilisateurs',
      'Rôles',
      'Signatures',
      'Réglages',
    ])
  })

  it('"Fournisseurs" n\'apparaît pas dans "Paramètres" (déplacé dans l\'en-tête)', () => {
    expect(PARAMETRES_ITEMS.map((i) => i.label)).not.toContain('Fournisseurs')
  })

  it('un séparateur (separatorBefore) précède "Seuils de validation DS", "Utilisateurs" et "Réglages", et eux seuls', () => {
    const withSeparator = PARAMETRES_ITEMS.filter((i) => i.separatorBefore).map((i) => i.label)
    expect(withSeparator).toEqual(['Seuils de validation DS', 'Utilisateurs', 'Réglages'])
  })
})

describe('filterNavItems', () => {
  it('"Accueil", "Mes demandes", "Marchés", "Commandes PGI" et "Investissements" sont toujours visibles', () => {
    const result = filterNavItems(NAV_ITEMS, { isAdminApp: false, isAdminService: false, hasOwnService: false })

    expect(result.map((i) => i.label)).toEqual(['Accueil', 'Mes demandes', 'Marchés', 'Commandes PGI', 'Investissements', 'Manuel'])
  })

  it("masque \"Fournisseurs\" pour un compte non rattaché à un ACTEUR (ni rôle d'administration, ni service propre)", () => {
    const result = filterNavItems(NAV_ITEMS, { isAdminApp: false, isAdminService: false, hasOwnService: false })

    expect(result.map((i) => i.label)).not.toContain('Fournisseurs')
  })

  it('ADMIN_SERVICE voit "Marchés", "Commandes PGI", "Investissements" puis "Fournisseurs"', () => {
    const result = filterNavItems(NAV_ITEMS, { isAdminApp: false, isAdminService: true, hasOwnService: false })

    expect(result.map((i) => i.label)).toEqual([
      'Accueil',
      'Mes demandes',
      'Marchés',
      'Commandes PGI',
      'Investissements',
      'Fournisseurs',
      'Manuel',
    ])
  })

  it('ADMIN_APP voit "Marchés", "Commandes PGI", "Investissements" puis "Fournisseurs"', () => {
    const result = filterNavItems(NAV_ITEMS, { isAdminApp: true, isAdminService: false, hasOwnService: false })

    expect(result.map((i) => i.label)).toEqual([
      'Accueil',
      'Mes demandes',
      'Marchés',
      'Commandes PGI',
      'Investissements',
      'Fournisseurs',
      'Manuel',
    ])
  })

  it('un Demandeur (sans rôle dédié, mais rattaché à un service) voit "Marchés", "Commandes PGI", "Investissements" puis "Fournisseurs"', () => {
    const result = filterNavItems(NAV_ITEMS, { isAdminApp: false, isAdminService: false, hasOwnService: true })

    expect(result.map((i) => i.label)).toEqual([
      'Accueil',
      'Mes demandes',
      'Marchés',
      'Commandes PGI',
      'Investissements',
      'Fournisseurs',
      'Manuel',
    ])
  })

  it('"Paramètres" ne figure pas dans les onglets du header (point d\'entrée : pied de sidebar)', () => {
    expect(NAV_ITEMS.map((i) => i.label)).not.toContain('Paramètres')
  })
})

function meResponse(roles: MeResponse['roles']): MeResponse {
  return { matricule: '20001', nom: 'PETIT', prenom: 'Julie', idService: 10, idCellule: 7, roles }
}

describe('getAccueilSidebarItems', () => {
  it('liste vide sans utilisateur résolu (currentUser null) — "Mes demandes" a son propre onglet, plus dans cette sidebar', () => {
    expect(getAccueilSidebarItems(null)).toEqual([])
  })

  it('liste vide sans rôle RC, CDS ni CB actif (autres rôles présents)', () => {
    const currentUser = meResponse([{ typeRole: 'ADMIN_SERVICE', perimeterLabel: 'Service Achats', idService: 10, idCellule: null }])

    expect(getAccueilSidebarItems(currentUser)).toEqual([])
  })

  it('ajoute "FAD — <cellule>" pointant vers /suivi-rc avec un rôle RC (titulaire ou suppléant)', () => {
    const currentUser = meResponse([{ typeRole: 'RC', perimeterLabel: 'Cellule Achats Nord', idService: null, idCellule: 7 }])

    expect(getAccueilSidebarItems(currentUser)).toEqual([{ to: '/suivi-rc', label: 'FAD — Cellule Achats Nord', icon: 'iv-rc' }])
  })

  it('ajoute "FAD (N+2) — <service>" pointant vers /suivi-cds avec un rôle CDS (titulaire ou suppléant)', () => {
    const currentUser = meResponse([{ typeRole: 'CDS', perimeterLabel: 'Service Maintenance', idService: 10, idCellule: null }])

    expect(getAccueilSidebarItems(currentUser)).toEqual([{ to: '/suivi-cds', label: 'FAD (N+2) — Service Maintenance', icon: 'iv-cds' }])
  })

  it('cumul RC+CDS : les deux entrées apparaissent, RC avant CDS, avec des libellés distincts', () => {
    const currentUser = meResponse([
      { typeRole: 'RC', perimeterLabel: 'Cellule Achats Nord', idService: null, idCellule: 7 },
      { typeRole: 'CDS', perimeterLabel: 'Service Maintenance', idService: 10, idCellule: null },
    ])

    expect(getAccueilSidebarItems(currentUser)).toEqual([
      { to: '/suivi-rc', label: 'FAD — Cellule Achats Nord', icon: 'iv-rc' },
      { to: '/suivi-cds', label: 'FAD (N+2) — Service Maintenance', icon: 'iv-cds' },
    ])
  })

  it('ajoute "FAD (CB) — <service>" pointant vers /suivi-cb avec un rôle CB (titulaire ou suppléant)', () => {
    const currentUser = meResponse([{ typeRole: 'CB', perimeterLabel: 'Service Maintenance', idService: 10, idCellule: null }])

    expect(getAccueilSidebarItems(currentUser)).toEqual([{ to: '/suivi-cb', label: 'FAD (CB) — Service Maintenance', icon: 'iv-cb' }])
  })

  it('cumul RC+CDS+CB : les trois entrées apparaissent, dans l\'ordre RC/CDS/CB', () => {
    const currentUser = meResponse([
      { typeRole: 'RC', perimeterLabel: 'Cellule Achats Nord', idService: null, idCellule: 7 },
      { typeRole: 'CDS', perimeterLabel: 'Service Maintenance', idService: 10, idCellule: null },
      { typeRole: 'CB', perimeterLabel: 'Service Maintenance', idService: 10, idCellule: null },
    ])

    expect(getAccueilSidebarItems(currentUser)).toEqual([
      { to: '/suivi-rc', label: 'FAD — Cellule Achats Nord', icon: 'iv-rc' },
      { to: '/suivi-cds', label: 'FAD (N+2) — Service Maintenance', icon: 'iv-cds' },
      { to: '/suivi-cb', label: 'FAD (CB) — Service Maintenance', icon: 'iv-cb' },
    ])
  })
})

describe('isHomeSection', () => {
  it('reconnaît la racine "/"', () => {
    expect(isHomeSection('/')).toBe(true)
  })

  it('reconnaît "/suivi-rc" et ses sous-pages', () => {
    expect(isHomeSection('/suivi-rc')).toBe(true)
  })

  it('reconnaît "/suivi-cds" et ses sous-pages', () => {
    expect(isHomeSection('/suivi-cds')).toBe(true)
  })

  it('reconnaît "/suivi-cb" et ses sous-pages', () => {
    expect(isHomeSection('/suivi-cb')).toBe(true)
  })

  it('ignore une route hors de la section', () => {
    expect(isHomeSection('/marches')).toBe(false)
    expect(isHomeSection('/parametres')).toBe(false)
  })
})

describe('isMarchesSection', () => {
  it('reconnaît la racine de la section', () => {
    expect(isMarchesSection('/marches')).toBe(true)
  })

  it('reconnaît une sous-page de la section', () => {
    expect(isMarchesSection('/marches/import')).toBe(true)
  })

  it('ignore une route hors de la section', () => {
    expect(isMarchesSection('/parametres/fournisseurs')).toBe(false)
    expect(isMarchesSection('/')).toBe(false)
  })
})

describe('filterMarchesSidebarItems', () => {
  it("masque \"Importation marchés service\" sans ADMIN_APP/ADMIN_SERVICE/CB, garde \"États des marchés du service\", \"Marchés d'un service tiers\" et \"Tableau de bord\"", () => {
    const result = filterMarchesSidebarItems(MARCHES_SIDEBAR_ITEMS, {
      isAdminApp: false,
      isAdminService: false,
      isCB: false,
    })

    expect(result.map((i) => i.label)).toEqual(['États des marchés du service', "Marchés d'un service tiers", 'Tableau de bord'])
  })

  it('ADMIN_APP voit les quatre options', () => {
    const result = filterMarchesSidebarItems(MARCHES_SIDEBAR_ITEMS, {
      isAdminApp: true,
      isAdminService: false,
      isCB: false,
    })

    expect(result.map((i) => i.label)).toEqual([
      'États des marchés du service',
      'Importation marchés service',
      "Marchés d'un service tiers",
      'Tableau de bord',
    ])
  })

  it('ADMIN_SERVICE voit les quatre options', () => {
    const result = filterMarchesSidebarItems(MARCHES_SIDEBAR_ITEMS, {
      isAdminApp: false,
      isAdminService: true,
      isCB: false,
    })

    expect(result.map((i) => i.label)).toEqual([
      'États des marchés du service',
      'Importation marchés service',
      "Marchés d'un service tiers",
      'Tableau de bord',
    ])
  })

  it('CB voit les quatre options', () => {
    const result = filterMarchesSidebarItems(MARCHES_SIDEBAR_ITEMS, {
      isAdminApp: false,
      isAdminService: false,
      isCB: true,
    })

    expect(result.map((i) => i.label)).toEqual([
      'États des marchés du service',
      'Importation marchés service',
      "Marchés d'un service tiers",
      'Tableau de bord',
    ])
  })
})

describe('isCommandesSection', () => {
  it('reconnaît la racine de la section', () => {
    expect(isCommandesSection('/commandes')).toBe(true)
  })

  it('reconnaît une sous-page de la section', () => {
    expect(isCommandesSection('/commandes/import')).toBe(true)
  })

  it('ignore une route hors de la section', () => {
    expect(isCommandesSection('/marches')).toBe(false)
    expect(isCommandesSection('/')).toBe(false)
  })
})

describe('filterCommandesSidebarItems', () => {
  it('"État des commandes PGI" reste visible sans ADMIN_APP/ADMIN_SERVICE/CB, "Importation des commandes PGI" masquée', () => {
    const result = filterCommandesSidebarItems(COMMANDES_SIDEBAR_ITEMS, {
      isAdminApp: false,
      isAdminService: false,
      isCB: false,
    })

    expect(result.map((i) => i.label)).toEqual(['État des commandes PGI'])
  })

  it('ADMIN_APP voit les deux options', () => {
    const result = filterCommandesSidebarItems(COMMANDES_SIDEBAR_ITEMS, {
      isAdminApp: true,
      isAdminService: false,
      isCB: false,
    })

    expect(result.map((i) => i.label)).toEqual(['État des commandes PGI', 'Importation des commandes PGI'])
  })

  it('ADMIN_SERVICE voit les deux options', () => {
    const result = filterCommandesSidebarItems(COMMANDES_SIDEBAR_ITEMS, {
      isAdminApp: false,
      isAdminService: true,
      isCB: false,
    })

    expect(result.map((i) => i.label)).toEqual(['État des commandes PGI', 'Importation des commandes PGI'])
  })

  it('CB voit les deux options', () => {
    const result = filterCommandesSidebarItems(COMMANDES_SIDEBAR_ITEMS, {
      isAdminApp: false,
      isAdminService: false,
      isCB: true,
    })

    expect(result.map((i) => i.label)).toEqual(['État des commandes PGI', 'Importation des commandes PGI'])
  })
})

describe('isInvestissementsSection', () => {
  it('reconnaît la racine de la section', () => {
    expect(isInvestissementsSection('/investissements')).toBe(true)
  })

  it('reconnaît une sous-page de la section', () => {
    expect(isInvestissementsSection('/investissements/import')).toBe(true)
  })

  it('ignore une route hors de la section', () => {
    expect(isInvestissementsSection('/commandes')).toBe(false)
    expect(isInvestissementsSection('/')).toBe(false)
  })
})

describe('filterInvestissementsSidebarItems', () => {
  it('"État des investissements PGI du service" reste visible sans ADMIN_APP/ADMIN_SERVICE/CB, "Importation investissements PGI" masquée', () => {
    const result = filterInvestissementsSidebarItems(INVESTISSEMENTS_SIDEBAR_ITEMS, {
      isAdminApp: false,
      isAdminService: false,
      isCB: false,
    })

    expect(result.map((i) => i.label)).toEqual(['État des investissements PGI du service'])
  })

  it('ADMIN_APP voit les deux options', () => {
    const result = filterInvestissementsSidebarItems(INVESTISSEMENTS_SIDEBAR_ITEMS, {
      isAdminApp: true,
      isAdminService: false,
      isCB: false,
    })

    expect(result.map((i) => i.label)).toEqual(['État des investissements PGI du service', 'Importation investissements PGI'])
  })

  it('ADMIN_SERVICE voit les deux options', () => {
    const result = filterInvestissementsSidebarItems(INVESTISSEMENTS_SIDEBAR_ITEMS, {
      isAdminApp: false,
      isAdminService: true,
      isCB: false,
    })

    expect(result.map((i) => i.label)).toEqual(['État des investissements PGI du service', 'Importation investissements PGI'])
  })

  it('CB voit les deux options', () => {
    const result = filterInvestissementsSidebarItems(INVESTISSEMENTS_SIDEBAR_ITEMS, {
      isAdminApp: false,
      isAdminService: false,
      isCB: true,
    })

    expect(result.map((i) => i.label)).toEqual(['État des investissements PGI du service', 'Importation investissements PGI'])
  })
})

describe('isParametresSection', () => {
  it('reconnaît la racine de la section', () => {
    expect(isParametresSection('/parametres')).toBe(true)
  })

  it('reconnaît une sous-page de la section', () => {
    expect(isParametresSection('/parametres/cug')).toBe(true)
  })

  it('ignore une route hors de la section', () => {
    expect(isParametresSection('/marches')).toBe(false)
    expect(isParametresSection('/')).toBe(false)
  })

  it('ignore "/fournisseurs" — sa sidebar doit rester vide, pas celle de "Paramètres" (régression 30/08/2026)', () => {
    expect(isParametresSection('/fournisseurs')).toBe(false)
  })
})
