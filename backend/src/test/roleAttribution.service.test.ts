import { describe, it, expect, vi, beforeEach } from 'vitest'

const findActiveByMatricule = vi.fn()
const findById = vi.fn()
const findActiveForPerimeter = vi.fn()
const findActiveByService = vi.fn()
const findActiveByCellules = vi.fn()
const findAllActive = vi.fn()
const create = vi.fn()
const deactivate = vi.fn()
const resolvePerimeterLabel = vi.fn()

vi.mock('../repositories/roleAttribution.repository.js', () => ({
  findActiveByMatricule: (...args: unknown[]) => findActiveByMatricule(...args),
  findById: (...args: unknown[]) => findById(...args),
  findActiveForPerimeter: (...args: unknown[]) => findActiveForPerimeter(...args),
  findActiveByService: (...args: unknown[]) => findActiveByService(...args),
  findActiveByCellules: (...args: unknown[]) => findActiveByCellules(...args),
  findAllActive: (...args: unknown[]) => findAllActive(...args),
  create: (...args: unknown[]) => create(...args),
  deactivate: (...args: unknown[]) => deactivate(...args),
  resolvePerimeterLabel: (...args: unknown[]) => resolvePerimeterLabel(...args),
}))

const findByMatricule = vi.fn()
const findByMatricules = vi.fn()
vi.mock('../repositories/acteur.repository.js', () => ({
  findByMatricule: (...args: unknown[]) => findByMatricule(...args),
  findByMatricules: (...args: unknown[]) => findByMatricules(...args),
}))

const findCelluleById = vi.fn()
const findAllCellules = vi.fn()
vi.mock('../repositories/cellule.repository.js', () => ({
  findById: (...args: unknown[]) => findCelluleById(...args),
  findAll: (...args: unknown[]) => findAllCellules(...args),
}))

const findServiceById = vi.fn()
vi.mock('../repositories/service.repository.js', () => ({
  findById: (...args: unknown[]) => findServiceById(...args),
}))

const findDirectionById = vi.fn()
vi.mock('../repositories/direction.repository.js', () => ({
  findById: (...args: unknown[]) => findDirectionById(...args),
}))

const hasActiveRole = vi.fn()
const hasActiveRoleForService = vi.fn()
vi.mock('../repositories/auth.repository.js', () => ({
  hasActiveRole: (...args: unknown[]) => hasActiveRole(...args),
  hasActiveRoleForService: (...args: unknown[]) => hasActiveRoleForService(...args),
}))

const { createAttribution, deactivateAttribution, listAttributions } = await import('../services/roleAttribution.service.js')

const MATRICULE = '12520'
const TARGET_MATRICULE = '99999'
const ID_CELLULE = 7
const ID_SERVICE = 1
const ID_DIRECTION = 3

const ACTEUR = { matricule: TARGET_MATRICULE, nom: 'MARTIN', prenom: 'Alice', fonction: 'RC', id_cellule: ID_CELLULE, actif: true }

beforeEach(() => {
  findActiveByMatricule.mockReset()
  findById.mockReset()
  findActiveForPerimeter.mockReset().mockResolvedValue(null)
  findActiveByService.mockReset()
  findActiveByCellules.mockReset()
  findAllActive.mockReset()
  create.mockReset()
  deactivate.mockReset()
  resolvePerimeterLabel.mockReset().mockResolvedValue('Cellule X')
  findByMatricule.mockReset().mockResolvedValue(ACTEUR)
  findByMatricules.mockReset().mockResolvedValue([ACTEUR])
  findCelluleById.mockReset()
  findAllCellules.mockReset().mockResolvedValue([])
  findServiceById.mockReset()
  findDirectionById.mockReset()
  hasActiveRole.mockReset()
  hasActiveRoleForService.mockReset()
})

describe('createAttribution', () => {
  it('rejette un périmètre incohérent avec le type de rôle (400)', async () => {
    await expect(
      createAttribution(MATRICULE, { matricule: TARGET_MATRICULE, typeRole: 'RC', idService: ID_SERVICE }),
    ).rejects.toMatchObject({ status: 400 })
    expect(create).not.toHaveBeenCalled()
  })

  it("réserve DS à ADMIN_APP — rejette (403) un appelant sans ADMIN_APP", async () => {
    hasActiveRole.mockResolvedValue(false)

    await expect(
      createAttribution(MATRICULE, { matricule: TARGET_MATRICULE, typeRole: 'DS', idDirection: ID_DIRECTION }),
    ).rejects.toMatchObject({ status: 403 })
    expect(create).not.toHaveBeenCalled()
  })

  it('autorise ADMIN_APP à attribuer DS', async () => {
    hasActiveRole.mockResolvedValue(true)
    findDirectionById.mockResolvedValue({ id_direction: ID_DIRECTION })
    create.mockResolvedValue({
      id_role: 1,
      matricule: TARGET_MATRICULE,
      type_role: 'DS',
      id_cellule: null,
      id_service: null,
      id_direction: ID_DIRECTION,
      date_debut: '2026-09-10',
      date_fin: null,
      actif: true,
    })

    await createAttribution(MATRICULE, { matricule: TARGET_MATRICULE, typeRole: 'DS', idDirection: ID_DIRECTION })

    expect(create).toHaveBeenCalledWith(
      expect.objectContaining({ type_role: 'DS', id_direction: ID_DIRECTION, id_cellule: null, id_service: null }),
    )
  })

  it('ADMIN_SERVICE peut attribuer RC sur son propre service (résolu via la cellule)', async () => {
    hasActiveRole.mockResolvedValue(false)
    hasActiveRoleForService.mockImplementation(async (_m: string, role: string, idService: number) => role === 'ADMIN_SERVICE' && idService === ID_SERVICE)
    findCelluleById.mockResolvedValue({ id_cellule: ID_CELLULE, id_service: ID_SERVICE })
    create.mockResolvedValue({
      id_role: 2,
      matricule: TARGET_MATRICULE,
      type_role: 'RC',
      id_cellule: ID_CELLULE,
      id_service: null,
      id_direction: null,
      date_debut: '2026-09-10',
      date_fin: null,
      actif: true,
    })

    await createAttribution(MATRICULE, { matricule: TARGET_MATRICULE, typeRole: 'RC', idCellule: ID_CELLULE })

    expect(hasActiveRoleForService).toHaveBeenCalledWith(MATRICULE, 'ADMIN_SERVICE', ID_SERVICE)
    expect(create).toHaveBeenCalledWith(expect.objectContaining({ type_role: 'RC', id_cellule: ID_CELLULE }))
  })

  it("rejette (403) un ADMIN_SERVICE d'un autre service", async () => {
    hasActiveRole.mockResolvedValue(false)
    hasActiveRoleForService.mockResolvedValue(false)
    findCelluleById.mockResolvedValue({ id_cellule: ID_CELLULE, id_service: ID_SERVICE })

    await expect(
      createAttribution(MATRICULE, { matricule: TARGET_MATRICULE, typeRole: 'RC', idCellule: ID_CELLULE }),
    ).rejects.toMatchObject({ status: 403 })
    expect(create).not.toHaveBeenCalled()
  })

  it("rejette (409) si un titulaire RC actif existe déjà pour la cellule", async () => {
    hasActiveRole.mockResolvedValue(true)
    findCelluleById.mockResolvedValue({ id_cellule: ID_CELLULE, id_service: ID_SERVICE })
    findActiveForPerimeter.mockResolvedValue({ id_role: 99, type_role: 'RC', actif: true })

    await expect(
      createAttribution(MATRICULE, { matricule: TARGET_MATRICULE, typeRole: 'RC', idCellule: ID_CELLULE }),
    ).rejects.toMatchObject({ status: 409 })
    expect(create).not.toHaveBeenCalled()
  })

  it("rejette (404) si l'acteur cible est introuvable", async () => {
    hasActiveRole.mockResolvedValue(true)
    findCelluleById.mockResolvedValue({ id_cellule: ID_CELLULE, id_service: ID_SERVICE })
    findByMatricule.mockResolvedValue(null)

    await expect(
      createAttribution(MATRICULE, { matricule: TARGET_MATRICULE, typeRole: 'RC', idCellule: ID_CELLULE }),
    ).rejects.toMatchObject({ status: 404 })
    expect(create).not.toHaveBeenCalled()
  })
})

describe('deactivateAttribution', () => {
  it('rejette si l\'attribution est introuvable (404)', async () => {
    findById.mockResolvedValue(null)

    await expect(deactivateAttribution(MATRICULE, 1)).rejects.toMatchObject({ status: 404 })
  })

  it('rejette si déjà clôturée (409)', async () => {
    findById.mockResolvedValue({ id_role: 1, type_role: 'CDS', id_cellule: null, id_service: ID_SERVICE, id_direction: null, actif: false })

    await expect(deactivateAttribution(MATRICULE, 1)).rejects.toMatchObject({ status: 409 })
    expect(deactivate).not.toHaveBeenCalled()
  })

  it('clôture avec les droits (ADMIN_SERVICE sur le service de la ligne)', async () => {
    findById.mockResolvedValue({ id_role: 1, type_role: 'CDS', id_cellule: null, id_service: ID_SERVICE, id_direction: null, actif: true })
    hasActiveRole.mockResolvedValue(false)
    hasActiveRoleForService.mockResolvedValue(true)
    deactivate.mockResolvedValue({
      id_role: 1,
      matricule: TARGET_MATRICULE,
      type_role: 'CDS',
      id_cellule: null,
      id_service: ID_SERVICE,
      id_direction: null,
      date_debut: '2026-01-01',
      date_fin: '2026-09-10',
      actif: false,
    })

    await deactivateAttribution(MATRICULE, 1)

    expect(deactivate).toHaveBeenCalledWith(1)
  })
})

describe('listAttributions', () => {
  it('ADMIN_APP voit toutes les attributions actives', async () => {
    hasActiveRole.mockResolvedValue(true)
    findAllActive.mockResolvedValue([])

    await listAttributions(MATRICULE)

    expect(findAllActive).toHaveBeenCalled()
  })

  it('ADMIN_SERVICE ne voit que son service (et les cellules de ce service)', async () => {
    hasActiveRole.mockResolvedValue(false)
    findActiveByMatricule.mockResolvedValue([
      { id_role: 1, matricule: MATRICULE, type_role: 'ADMIN_SERVICE', id_cellule: null, id_service: ID_SERVICE, id_direction: null, actif: true },
    ])
    findAllCellules.mockResolvedValue([{ id_cellule: ID_CELLULE, id_service: ID_SERVICE }])
    findActiveByService.mockResolvedValue([])
    findActiveByCellules.mockResolvedValue([])

    await listAttributions(MATRICULE)

    expect(findActiveByService).toHaveBeenCalledWith(ID_SERVICE)
    expect(findActiveByCellules).toHaveBeenCalledWith([ID_CELLULE])
  })

  it('rejette (403) un appelant sans ADMIN_APP ni ADMIN_SERVICE', async () => {
    hasActiveRole.mockResolvedValue(false)
    findActiveByMatricule.mockResolvedValue([])

    await expect(listAttributions(MATRICULE)).rejects.toMatchObject({ status: 403 })
  })
})
