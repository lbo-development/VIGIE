import { describe, it, expect, vi, beforeEach } from 'vitest'

const directionFindAll = vi.fn()
const directionFindById = vi.fn()
const directionFindByCode = vi.fn()
const directionCreate = vi.fn()
const directionUpdate = vi.fn()

const serviceFindAll = vi.fn()
const serviceFindById = vi.fn()
const serviceFindByCode = vi.fn()
const serviceCreate = vi.fn()
const serviceUpdate = vi.fn()

const celluleFindAll = vi.fn()
const celluleFindById = vi.fn()
const celluleFindByCode = vi.fn()
const celluleCreate = vi.fn()
const celluleUpdate = vi.fn()

vi.mock('../repositories/direction.repository.js', () => ({
  findAll: (...args: unknown[]) => directionFindAll(...args),
  findById: (...args: unknown[]) => directionFindById(...args),
  findByCode: (...args: unknown[]) => directionFindByCode(...args),
  create: (...args: unknown[]) => directionCreate(...args),
  update: (...args: unknown[]) => directionUpdate(...args),
}))
vi.mock('../repositories/service.repository.js', () => ({
  findAll: (...args: unknown[]) => serviceFindAll(...args),
  findById: (...args: unknown[]) => serviceFindById(...args),
  findByCode: (...args: unknown[]) => serviceFindByCode(...args),
  create: (...args: unknown[]) => serviceCreate(...args),
  update: (...args: unknown[]) => serviceUpdate(...args),
}))
vi.mock('../repositories/cellule.repository.js', () => ({
  findAll: (...args: unknown[]) => celluleFindAll(...args),
  findById: (...args: unknown[]) => celluleFindById(...args),
  findByCode: (...args: unknown[]) => celluleFindByCode(...args),
  create: (...args: unknown[]) => celluleCreate(...args),
  update: (...args: unknown[]) => celluleUpdate(...args),
}))

const {
  createDirection,
  updateDirection,
  createService,
  updateService,
  createCellule,
  updateCellule,
} = await import('../services/organisation.service.js')

beforeEach(() => {
  directionFindAll.mockReset()
  directionFindById.mockReset()
  directionFindByCode.mockReset()
  directionCreate.mockReset()
  directionUpdate.mockReset()
  serviceFindAll.mockReset()
  serviceFindById.mockReset()
  serviceFindByCode.mockReset()
  serviceCreate.mockReset()
  serviceUpdate.mockReset()
  celluleFindAll.mockReset()
  celluleFindById.mockReset()
  celluleFindByCode.mockReset()
  celluleCreate.mockReset()
  celluleUpdate.mockReset()
})

describe('createDirection', () => {
  it('rejette une entrée invalide (400)', async () => {
    await expect(createDirection({ codeDirection: '', libelleDirection: 'X' })).rejects.toMatchObject({
      status: 400,
    })
    expect(directionCreate).not.toHaveBeenCalled()
  })

  it('rejette un code déjà existant (409)', async () => {
    directionFindByCode.mockResolvedValue({ id_direction: 1, code_direction: 'DG', libelle_direction: 'Existant' })

    await expect(createDirection({ codeDirection: 'DG', libelleDirection: 'Direction générale' })).rejects.toMatchObject(
      { status: 409 },
    )
    expect(directionCreate).not.toHaveBeenCalled()
  })

  it('délègue au repository quand valide', async () => {
    directionFindByCode.mockResolvedValue(null)
    directionCreate.mockResolvedValue({ id_direction: 1, code_direction: 'DG', libelle_direction: 'Direction générale' })

    await createDirection({ codeDirection: 'DG', libelleDirection: 'Direction générale' })

    expect(directionCreate).toHaveBeenCalledWith({
      code_direction: 'DG',
      libelle_direction: 'Direction générale',
      actif: true,
    })
  })
})

describe('updateDirection', () => {
  it('rejette si la direction est introuvable (404)', async () => {
    directionFindById.mockResolvedValue(null)

    await expect(updateDirection(1, { libelleDirection: 'Nouveau' })).rejects.toMatchObject({ status: 404 })
    expect(directionUpdate).not.toHaveBeenCalled()
  })

  it('rejette si le nouveau code est déjà pris par une autre direction (409)', async () => {
    directionFindById.mockResolvedValue({ id_direction: 1, code_direction: 'DG', libelle_direction: 'X' })
    directionFindByCode.mockResolvedValue({ id_direction: 2, code_direction: 'DF', libelle_direction: 'Autre' })

    await expect(updateDirection(1, { codeDirection: 'DF' })).rejects.toMatchObject({ status: 409 })
    expect(directionUpdate).not.toHaveBeenCalled()
  })

  it('autorise de garder le même code (pas de conflit avec soi-même)', async () => {
    directionFindById.mockResolvedValue({ id_direction: 1, code_direction: 'DG', libelle_direction: 'X' })
    directionUpdate.mockResolvedValue({ id_direction: 1, code_direction: 'DG', libelle_direction: 'Nouveau' })

    await updateDirection(1, { codeDirection: 'DG', libelleDirection: 'Nouveau' })

    expect(directionFindByCode).not.toHaveBeenCalled()
    expect(directionUpdate).toHaveBeenCalledWith(1, { code_direction: 'DG', libelle_direction: 'Nouveau' })
  })
})

describe('createService', () => {
  it('rejette une entrée invalide (400)', async () => {
    await expect(createService({ codeService: '', libelleService: 'X', idDirection: 1 })).rejects.toMatchObject({
      status: 400,
    })
    expect(serviceCreate).not.toHaveBeenCalled()
  })

  it('rejette un code déjà existant (409)', async () => {
    serviceFindByCode.mockResolvedValue({ id_service: 1, code_service: 'X', libelle_service: 'Existant', id_direction: 1 })

    await expect(
      createService({ codeService: 'X', libelleService: 'Service X', idDirection: 1 }),
    ).rejects.toMatchObject({ status: 409 })
    expect(serviceCreate).not.toHaveBeenCalled()
  })

  it('rejette si la direction visée est introuvable (404)', async () => {
    serviceFindByCode.mockResolvedValue(null)
    directionFindById.mockResolvedValue(null)

    await expect(
      createService({ codeService: 'X', libelleService: 'Service X', idDirection: 99 }),
    ).rejects.toMatchObject({ status: 404 })
    expect(serviceCreate).not.toHaveBeenCalled()
  })

  it('délègue au repository quand valide', async () => {
    serviceFindByCode.mockResolvedValue(null)
    directionFindById.mockResolvedValue({ id_direction: 1, code_direction: 'DG', libelle_direction: 'X' })
    serviceCreate.mockResolvedValue({ id_service: 1, code_service: 'X', libelle_service: 'Service X', id_direction: 1 })

    await createService({ codeService: 'X', libelleService: 'Service X', idDirection: 1 })

    expect(serviceCreate).toHaveBeenCalledWith({
      code_service: 'X',
      libelle_service: 'Service X',
      id_direction: 1,
      actif: true,
    })
  })
})

describe('updateService', () => {
  it('rejette si le service est introuvable (404)', async () => {
    serviceFindById.mockResolvedValue(null)

    await expect(updateService(1, { libelleService: 'Nouveau' })).rejects.toMatchObject({ status: 404 })
    expect(serviceUpdate).not.toHaveBeenCalled()
  })

  it('rejette si la nouvelle direction est introuvable (404)', async () => {
    serviceFindById.mockResolvedValue({ id_service: 1, code_service: 'X', libelle_service: 'X', id_direction: 1 })
    directionFindById.mockResolvedValue(null)

    await expect(updateService(1, { idDirection: 99 })).rejects.toMatchObject({ status: 404 })
    expect(serviceUpdate).not.toHaveBeenCalled()
  })

  it('délègue au repository quand valide', async () => {
    serviceFindById.mockResolvedValue({ id_service: 1, code_service: 'X', libelle_service: 'X', id_direction: 1 })
    serviceUpdate.mockResolvedValue({ id_service: 1, code_service: 'X', libelle_service: 'Nouveau', id_direction: 1 })

    await updateService(1, { libelleService: 'Nouveau' })

    expect(serviceUpdate).toHaveBeenCalledWith(1, { code_service: undefined, libelle_service: 'Nouveau', id_direction: undefined })
  })
})

describe('createCellule', () => {
  it('rejette une entrée invalide (400)', async () => {
    await expect(createCellule({ codeCellule: '', libelleCellule: 'X', idService: 1 })).rejects.toMatchObject({
      status: 400,
    })
    expect(celluleCreate).not.toHaveBeenCalled()
  })

  it('rejette si le service visé est introuvable (404)', async () => {
    celluleFindByCode.mockResolvedValue(null)
    serviceFindById.mockResolvedValue(null)

    await expect(
      createCellule({ codeCellule: 'X', libelleCellule: 'Cellule X', idService: 99 }),
    ).rejects.toMatchObject({ status: 404 })
    expect(celluleCreate).not.toHaveBeenCalled()
  })

  it('délègue au repository quand valide', async () => {
    celluleFindByCode.mockResolvedValue(null)
    serviceFindById.mockResolvedValue({ id_service: 1, code_service: 'S', libelle_service: 'S', id_direction: 1 })
    celluleCreate.mockResolvedValue({ id_cellule: 1, code_cellule: 'X', libelle_cellule: 'Cellule X', id_service: 1 })

    await createCellule({ codeCellule: 'X', libelleCellule: 'Cellule X', idService: 1 })

    expect(celluleCreate).toHaveBeenCalledWith({
      code_cellule: 'X',
      libelle_cellule: 'Cellule X',
      id_service: 1,
      actif: true,
    })
  })
})

describe('updateCellule', () => {
  it('rejette si la cellule est introuvable (404)', async () => {
    celluleFindById.mockResolvedValue(null)

    await expect(updateCellule(1, { libelleCellule: 'Nouveau' })).rejects.toMatchObject({ status: 404 })
    expect(celluleUpdate).not.toHaveBeenCalled()
  })

  it('délègue au repository quand valide', async () => {
    celluleFindById.mockResolvedValue({ id_cellule: 1, code_cellule: 'X', libelle_cellule: 'X', id_service: 1 })
    celluleUpdate.mockResolvedValue({ id_cellule: 1, code_cellule: 'X', libelle_cellule: 'Nouveau', id_service: 1 })

    await updateCellule(1, { libelleCellule: 'Nouveau' })

    expect(celluleUpdate).toHaveBeenCalledWith(1, { code_cellule: undefined, libelle_cellule: 'Nouveau', id_service: undefined })
  })
})
