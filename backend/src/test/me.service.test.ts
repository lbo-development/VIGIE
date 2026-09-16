import { describe, it, expect, vi, beforeEach } from 'vitest'

const findByMatricule = vi.fn()
const findIdServiceByMatricule = vi.fn()
vi.mock('../repositories/acteur.repository.js', () => ({
  findByMatricule: (...args: unknown[]) => findByMatricule(...args),
  findIdServiceByMatricule: (...args: unknown[]) => findIdServiceByMatricule(...args),
}))

const resolvePerimeterLabel = vi.fn()
vi.mock('../repositories/roleAttribution.repository.js', () => ({
  resolvePerimeterLabel: (...args: unknown[]) => resolvePerimeterLabel(...args),
}))

const findEffectiveRoles = vi.fn()
vi.mock('../services/roleEffectif.service.js', () => ({
  findEffectiveRoles: (...args: unknown[]) => findEffectiveRoles(...args),
}))

const { getCurrentUser } = await import('../services/me.service.js')

const MATRICULE = '20001'

beforeEach(() => {
  findByMatricule.mockReset().mockResolvedValue({ matricule: MATRICULE, nom: 'DURAND', prenom: 'Paul', fonction: 'RC', id_cellule: 7, actif: true })
  findIdServiceByMatricule.mockReset().mockResolvedValue(10)
  resolvePerimeterLabel.mockReset().mockResolvedValue(null)
  findEffectiveRoles.mockReset().mockResolvedValue([])
})

describe('getCurrentUser', () => {
  it('sans matricule (compte non rattaché) : identité vide, aucun appel réseau', async () => {
    const result = await getCurrentUser(null)
    expect(result).toEqual({ matricule: null, nom: null, prenom: null, idService: null, idCellule: null, roles: [] })
    expect(findByMatricule).not.toHaveBeenCalled()
  })

  it('idCellule top-level reste le rattachement propre de ACTEUR, indépendant des rôles', async () => {
    const result = await getCurrentUser(MATRICULE)
    expect(result.idCellule).toBe(7)
    expect(result.idService).toBe(10)
  })

  it('un rôle RC direct expose typeRole/perimeterLabel/idCellule/idService', async () => {
    findEffectiveRoles.mockResolvedValue([
      { idRole: 1, typeRole: 'RC', idCellule: 42, idService: null, idDirection: null, idSuppleance: null },
    ])
    resolvePerimeterLabel.mockResolvedValue('Cellule Achats Nord')

    const result = await getCurrentUser(MATRICULE)

    expect(result.roles).toEqual([{ typeRole: 'RC', perimeterLabel: 'Cellule Achats Nord', idService: null, idCellule: 42 }])
    expect(resolvePerimeterLabel).toHaveBeenCalledWith(expect.objectContaining({ id_cellule: 42, id_service: null, id_direction: null }))
  })

  it('bug corrigé le 15/09/2026 : un rôle hérité par suppléance (findEffectiveRoles) apparaît aussi dans roles', async () => {
    // Aucune ligne role_attribution directe pour ce matricule — uniquement un rôle RC hérité par
    // suppléance (idSuppleance non null), exactement ce que produirait roleEffectifService pour un
    // suppléant pur. Avant le correctif (source = roleAttributionRepository.findActiveByMatricule
    // seul), ce rôle n'apparaissait jamais dans /api/me.
    findEffectiveRoles.mockResolvedValue([
      { idRole: 5, typeRole: 'RC', idCellule: 99, idService: null, idDirection: null, idSuppleance: 123 },
    ])
    resolvePerimeterLabel.mockResolvedValue('Cellule Achats Sud')

    const result = await getCurrentUser(MATRICULE)

    expect(result.roles).toEqual([{ typeRole: 'RC', perimeterLabel: 'Cellule Achats Sud', idService: null, idCellule: 99 }])
  })

  it('plusieurs rôles cumulés sont tous exposés', async () => {
    findEffectiveRoles.mockResolvedValue([
      { idRole: 1, typeRole: 'RC', idCellule: 42, idService: null, idDirection: null, idSuppleance: null },
      { idRole: 2, typeRole: 'ADMIN_SERVICE', idCellule: null, idService: 10, idDirection: null, idSuppleance: null },
    ])
    resolvePerimeterLabel.mockResolvedValueOnce('Cellule Achats Nord').mockResolvedValueOnce('Service Voyageurs')

    const result = await getCurrentUser(MATRICULE)

    expect(result.roles).toHaveLength(2)
    expect(result.roles[0]).toEqual({ typeRole: 'RC', perimeterLabel: 'Cellule Achats Nord', idService: null, idCellule: 42 })
    expect(result.roles[1]).toEqual({ typeRole: 'ADMIN_SERVICE', perimeterLabel: 'Service Voyageurs', idService: 10, idCellule: null })
  })

  it('acteur introuvable : nom/prenom null, sans planter', async () => {
    findByMatricule.mockResolvedValue(null)
    const result = await getCurrentUser(MATRICULE)
    expect(result.nom).toBeNull()
    expect(result.prenom).toBeNull()
    expect(result.idCellule).toBeNull()
  })
})
