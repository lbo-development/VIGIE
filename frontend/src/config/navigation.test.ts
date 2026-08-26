import { describe, it, expect } from 'vitest'
import { filterSidebarGroups, SIDEBAR_GROUPS } from './navigation'

describe('filterSidebarGroups', () => {
  it('retire entièrement "Paramètres" sans ADMIN_APP ni ADMIN_SERVICE', () => {
    const result = filterSidebarGroups(SIDEBAR_GROUPS, { isAdminApp: false, isAdminService: false })

    expect(result.find((g) => g.label === 'Paramètres')).toBeUndefined()
  })

  it('ADMIN_SERVICE voit "Paramètres" mais pas "Réglages"', () => {
    const result = filterSidebarGroups(SIDEBAR_GROUPS, { isAdminApp: false, isAdminService: true })
    const parametres = result.find((g) => g.label === 'Paramètres')

    expect(parametres).toBeDefined()
    expect(parametres!.items.map((i) => i.label)).toEqual(['Gisement géographique', 'Gisement technique'])
  })

  it('ADMIN_APP voit "Paramètres" et toutes ses entrées (Réglages, Directions, Services, Cellules)', () => {
    const result = filterSidebarGroups(SIDEBAR_GROUPS, { isAdminApp: true, isAdminService: false })
    const parametres = result.find((g) => g.label === 'Paramètres')

    expect(parametres!.items.map((i) => i.label)).toEqual([
      'Gisement géographique',
      'Gisement technique',
      'Réglages',
      'Directions',
      'Services',
      'Cellules',
    ])
  })
})
