import { describe, it, expect, vi, beforeEach } from 'vitest'

const findActiveByMatricule = vi.fn()
vi.mock('../repositories/roleAttribution.repository.js', () => ({
  findActiveByMatricule: (...args: unknown[]) => findActiveByMatricule(...args),
}))

const findActiveForSuppleant = vi.fn()
vi.mock('../repositories/suppleance.repository.js', () => ({
  findActiveForSuppleant: (...args: unknown[]) => findActiveForSuppleant(...args),
}))

const { findEffectiveRoles, assertHasEffectiveRole } = await import('../services/roleEffectif.service.js')

const TITULAIRE = '10001'
const SUPPLEANT = '10002'
const AUTRE = '10003'

const ROLE_RC_TITULAIRE = { id_role: 1, matricule: TITULAIRE, type_role: 'RC', id_cellule: 7, id_service: null, id_direction: null, date_debut: '2026-01-01', date_fin: null, actif: true }
const ROLE_DS_TITULAIRE = { id_role: 2, matricule: TITULAIRE, type_role: 'DS', id_cellule: null, id_service: null, id_direction: 3, date_debut: '2026-01-01', date_fin: null, actif: true }

const SUPPLEANCE_CDS = { id_suppleance: 99, id_role: 5, type_role: 'CDS', id_cellule: null, id_service: 12, id_direction: null }

beforeEach(() => {
  findActiveByMatricule.mockReset().mockResolvedValue([])
  findActiveForSuppleant.mockReset().mockResolvedValue([])
})

describe('findEffectiveRoles', () => {
  it('combine les rôles directs et les rôles hérités par suppléance', async () => {
    findActiveByMatricule.mockResolvedValue([ROLE_RC_TITULAIRE, ROLE_DS_TITULAIRE])
    findActiveForSuppleant.mockResolvedValue([SUPPLEANCE_CDS])

    const roles = await findEffectiveRoles(TITULAIRE)

    expect(roles).toEqual([
      { idRole: 1, typeRole: 'RC', idCellule: 7, idService: null, idDirection: null, idSuppleance: null },
      { idRole: 2, typeRole: 'DS', idCellule: null, idService: null, idDirection: 3, idSuppleance: null },
      { idRole: 5, typeRole: 'CDS', idCellule: null, idService: 12, idDirection: null, idSuppleance: 99 },
    ])
  })

  it('renvoie une liste vide sans rôle ni suppléance', async () => {
    expect(await findEffectiveRoles(AUTRE)).toEqual([])
  })
})

describe('assertHasEffectiveRole', () => {
  it('rejette sans authentification (401)', async () => {
    await expect(assertHasEffectiveRole(null, 'RC', 7)).rejects.toMatchObject({ status: 401 })
  })

  it('autorise le titulaire sur son propre périmètre (RC → cellule)', async () => {
    findActiveByMatricule.mockResolvedValue([ROLE_RC_TITULAIRE])
    const role = await assertHasEffectiveRole(TITULAIRE, 'RC', 7)
    expect(role.idSuppleance).toBeNull()
  })

  it('autorise le suppléant sur le périmètre du titulaire remplacé (CDS → service)', async () => {
    findActiveForSuppleant.mockResolvedValue([SUPPLEANCE_CDS])
    const role = await assertHasEffectiveRole(SUPPLEANT, 'CDS', 12)
    expect(role.idSuppleance).toBe(99)
  })

  it('rejette (403) un rôle du bon type mais du mauvais périmètre', async () => {
    findActiveByMatricule.mockResolvedValue([ROLE_RC_TITULAIRE])
    await expect(assertHasEffectiveRole(TITULAIRE, 'RC', 99)).rejects.toMatchObject({ status: 403 })
  })

  it('rejette (403) un acteur sans le rôle demandé, ni en titulaire ni en suppléant', async () => {
    await expect(assertHasEffectiveRole(AUTRE, 'DS', 3)).rejects.toMatchObject({ status: 403 })
  })

  it('résout le bon champ de périmètre pour DS (direction)', async () => {
    findActiveByMatricule.mockResolvedValue([ROLE_DS_TITULAIRE])
    const role = await assertHasEffectiveRole(TITULAIRE, 'DS', 3)
    expect(role.idDirection).toBe(3)
  })
})
