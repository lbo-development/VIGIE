import { describe, it, expect } from 'vitest'
import {
  filterParametresItems,
  filterMarchesSidebarItems,
  filterCommandesSidebarItems,
  filterInvestissementsSidebarItems,
  filterNavItems,
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

describe('filterParametresItems', () => {
  it("retourne une liste vide sans ADMIN_APP ni ADMIN_SERVICE (section masquée)", () => {
    const result = filterParametresItems(PARAMETRES_ITEMS, { isAdminApp: false, isAdminService: false })

    expect(result).toEqual([])
  })

  it('ADMIN_SERVICE voit "Paramètres" (dont "Seuils de validation DS" et "CUG") mais pas "Réglages"', () => {
    const result = filterParametresItems(PARAMETRES_ITEMS, { isAdminApp: false, isAdminService: true })

    expect(result.map((i) => i.label)).toEqual([
      'Gisement géographique',
      'Gisement technique',
      'Seuils de validation DS',
      'CUG',
    ])
  })

  it('ADMIN_APP voit toutes les entrées (Réglages, Directions, Services, Cellules, Seuils de validation DS, CUG)', () => {
    const result = filterParametresItems(PARAMETRES_ITEMS, { isAdminApp: true, isAdminService: false })

    expect(result.map((i) => i.label)).toEqual([
      'Gisement géographique',
      'Gisement technique',
      'Réglages',
      'Directions',
      'Services',
      'Cellules',
      'Seuils de validation DS',
      'CUG',
    ])
  })

  it('"Fournisseurs" n\'apparaît pas dans "Paramètres" (déplacé dans l\'en-tête)', () => {
    expect(PARAMETRES_ITEMS.map((i) => i.label)).not.toContain('Fournisseurs')
  })
})

describe('filterNavItems', () => {
  it('"Accueil", "Marchés", "Commandes" et "Investissements" sont toujours visibles', () => {
    const result = filterNavItems(NAV_ITEMS, { isAdminApp: false, isAdminService: false, hasOwnService: false })

    expect(result.map((i) => i.label)).toEqual(['Accueil', 'Marchés', 'Commandes', 'Investissements'])
  })

  it("masque \"Fournisseurs\" pour un compte non rattaché à un ACTEUR (ni rôle d'administration, ni service propre)", () => {
    const result = filterNavItems(NAV_ITEMS, { isAdminApp: false, isAdminService: false, hasOwnService: false })

    expect(result.map((i) => i.label)).not.toContain('Fournisseurs')
  })

  it('ADMIN_SERVICE voit "Marchés", "Commandes", "Investissements" puis "Fournisseurs"', () => {
    const result = filterNavItems(NAV_ITEMS, { isAdminApp: false, isAdminService: true, hasOwnService: false })

    expect(result.map((i) => i.label)).toEqual(['Accueil', 'Marchés', 'Commandes', 'Investissements', 'Fournisseurs'])
  })

  it('ADMIN_APP voit "Marchés", "Commandes", "Investissements" puis "Fournisseurs"', () => {
    const result = filterNavItems(NAV_ITEMS, { isAdminApp: true, isAdminService: false, hasOwnService: false })

    expect(result.map((i) => i.label)).toEqual(['Accueil', 'Marchés', 'Commandes', 'Investissements', 'Fournisseurs'])
  })

  it('un Demandeur (sans rôle dédié, mais rattaché à un service) voit "Marchés", "Commandes", "Investissements" puis "Fournisseurs"', () => {
    const result = filterNavItems(NAV_ITEMS, { isAdminApp: false, isAdminService: false, hasOwnService: true })

    expect(result.map((i) => i.label)).toEqual(['Accueil', 'Marchés', 'Commandes', 'Investissements', 'Fournisseurs'])
  })

  it('"Paramètres" ne figure pas dans les onglets du header (point d\'entrée : pied de sidebar)', () => {
    expect(NAV_ITEMS.map((i) => i.label)).not.toContain('Paramètres')
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
  it('"État des commandes PGI du service" reste visible sans ADMIN_APP/ADMIN_SERVICE/CB, "Importation commandes PGI" masquée', () => {
    const result = filterCommandesSidebarItems(COMMANDES_SIDEBAR_ITEMS, {
      isAdminApp: false,
      isAdminService: false,
      isCB: false,
    })

    expect(result.map((i) => i.label)).toEqual(['État des commandes PGI du service'])
  })

  it('ADMIN_APP voit les deux options', () => {
    const result = filterCommandesSidebarItems(COMMANDES_SIDEBAR_ITEMS, {
      isAdminApp: true,
      isAdminService: false,
      isCB: false,
    })

    expect(result.map((i) => i.label)).toEqual(['État des commandes PGI du service', 'Importation commandes PGI'])
  })

  it('ADMIN_SERVICE voit les deux options', () => {
    const result = filterCommandesSidebarItems(COMMANDES_SIDEBAR_ITEMS, {
      isAdminApp: false,
      isAdminService: true,
      isCB: false,
    })

    expect(result.map((i) => i.label)).toEqual(['État des commandes PGI du service', 'Importation commandes PGI'])
  })

  it('CB voit les deux options', () => {
    const result = filterCommandesSidebarItems(COMMANDES_SIDEBAR_ITEMS, {
      isAdminApp: false,
      isAdminService: false,
      isCB: true,
    })

    expect(result.map((i) => i.label)).toEqual(['État des commandes PGI du service', 'Importation commandes PGI'])
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
