import { describe, it, expect, vi, beforeEach } from 'vitest'

const findAll = vi.fn()
const findByCode = vi.fn()
const create = vi.fn()
const update = vi.fn()

const hasActiveRole = vi.fn()
const hasActiveRoleForService = vi.fn()

const findActiveByMatricule = vi.fn()

vi.mock('../repositories/cug.repository.js', () => ({
  findAll: (...args: unknown[]) => findAll(...args),
  findByCode: (...args: unknown[]) => findByCode(...args),
  create: (...args: unknown[]) => create(...args),
  update: (...args: unknown[]) => update(...args),
}))
vi.mock('../repositories/auth.repository.js', () => ({
  hasActiveRole: (...args: unknown[]) => hasActiveRole(...args),
  hasActiveRoleForService: (...args: unknown[]) => hasActiveRoleForService(...args),
}))
vi.mock('../repositories/roleAttribution.repository.js', () => ({
  findActiveByMatricule: (...args: unknown[]) => findActiveByMatricule(...args),
}))

const { listCug, createCug, updateCug } = await import('../services/cug.service.js')

const MATRICULE = '12520'
const ID_SERVICE = 1

const CUG = { code_cug: 'CUG1', libelle_cug: 'Fournitures bureau', id_service: ID_SERVICE, actif: true }

beforeEach(() => {
  findAll.mockReset()
  findByCode.mockReset()
  create.mockReset()
  update.mockReset()
  hasActiveRole.mockReset()
  hasActiveRoleForService.mockReset()
  findActiveByMatricule.mockReset()
})

describe('listCug', () => {
  it('rejette sans authentification (401)', async () => {
    await expect(listCug(null)).rejects.toMatchObject({ status: 401 })
  })

  it("rejette un acteur sans ADMIN_APP ni ADMIN_SERVICE (403) — pas de périmètre Demandeur pour CUG", async () => {
    hasActiveRole.mockResolvedValue(false)
    findActiveByMatricule.mockResolvedValue([])

    await expect(listCug(MATRICULE)).rejects.toMatchObject({ status: 403 })
    expect(findAll).not.toHaveBeenCalled()
  })

  it('ADMIN_APP voit tout (transverse), idService explicite respecté', async () => {
    hasActiveRole.mockResolvedValue(true)
    findAll.mockResolvedValue([CUG])

    await listCug(MATRICULE, 42)

    expect(findAll).toHaveBeenCalledWith(42)
  })

  it('ADMIN_SERVICE ne voit que son propre service (idService explicite ignoré)', async () => {
    hasActiveRole.mockResolvedValue(false)
    findActiveByMatricule.mockResolvedValue([
      { id_role: 1, type_role: 'ADMIN_SERVICE', id_cellule: null, id_service: ID_SERVICE, id_direction: null },
    ])
    findAll.mockResolvedValue([CUG])

    await listCug(MATRICULE, 999)

    expect(findAll).toHaveBeenCalledWith(ID_SERVICE)
  })
})

describe('createCug', () => {
  it('rejette une entrée invalide (400)', async () => {
    await expect(createCug(MATRICULE, { codeCug: '', libelleCug: 'X', idService: ID_SERVICE })).rejects.toMatchObject(
      { status: 400 },
    )
    expect(create).not.toHaveBeenCalled()
  })

  it("rejette si l'utilisateur n'a ni ADMIN_APP ni ADMIN_SERVICE sur le service visé (403)", async () => {
    hasActiveRole.mockResolvedValue(false)
    hasActiveRoleForService.mockResolvedValue(false)

    await expect(
      createCug(MATRICULE, { codeCug: 'CUG1', libelleCug: 'Fournitures', idService: ID_SERVICE }),
    ).rejects.toMatchObject({ status: 403 })
    expect(create).not.toHaveBeenCalled()
  })

  it('rejette un code_cug déjà existant (409)', async () => {
    hasActiveRole.mockResolvedValue(true)
    findByCode.mockResolvedValue(CUG)

    await expect(
      createCug(MATRICULE, { codeCug: 'CUG1', libelleCug: 'Fournitures', idService: ID_SERVICE }),
    ).rejects.toMatchObject({ status: 409 })
    expect(create).not.toHaveBeenCalled()
  })

  it('autorise ADMIN_APP et délègue au repository', async () => {
    hasActiveRole.mockResolvedValue(true)
    findByCode.mockResolvedValue(null)
    create.mockResolvedValue(CUG)

    await createCug(MATRICULE, { codeCug: 'CUG1', libelleCug: 'Fournitures bureau', idService: ID_SERVICE })

    expect(create).toHaveBeenCalledWith(
      expect.objectContaining({ code_cug: 'CUG1', libelle_cug: 'Fournitures bureau', id_service: ID_SERVICE, actif: true }),
    )
  })

  it('autorise ADMIN_SERVICE scopé au service visé', async () => {
    hasActiveRole.mockResolvedValue(false)
    hasActiveRoleForService.mockResolvedValue(true)
    findByCode.mockResolvedValue(null)
    create.mockResolvedValue(CUG)

    await createCug(MATRICULE, { codeCug: 'CUG1', libelleCug: 'Fournitures bureau', idService: ID_SERVICE })

    expect(hasActiveRoleForService).toHaveBeenCalledWith(MATRICULE, 'ADMIN_SERVICE', ID_SERVICE)
    expect(create).toHaveBeenCalled()
  })
})

describe('updateCug', () => {
  it('rejette si le CUG est introuvable (404)', async () => {
    findByCode.mockResolvedValue(null)

    await expect(updateCug(MATRICULE, 'INCONNU', { libelleCug: 'Nouveau' })).rejects.toMatchObject({ status: 404 })
    expect(update).not.toHaveBeenCalled()
  })

  it('rejette sans droit sur le service du CUG (403)', async () => {
    findByCode.mockResolvedValue(CUG)
    hasActiveRole.mockResolvedValue(false)
    hasActiveRoleForService.mockResolvedValue(false)

    await expect(updateCug(MATRICULE, 'CUG1', { libelleCug: 'Nouveau' })).rejects.toMatchObject({ status: 403 })
    expect(update).not.toHaveBeenCalled()
  })

  it('autorise et délègue au repository (libellé et/ou actif) quand les droits sont réunis', async () => {
    findByCode.mockResolvedValue(CUG)
    hasActiveRole.mockResolvedValue(true)
    update.mockResolvedValue({ ...CUG, libelle_cug: 'Nouveau', actif: false })

    await updateCug(MATRICULE, 'CUG1', { libelleCug: 'Nouveau', actif: false })

    expect(update).toHaveBeenCalledWith('CUG1', { libelle_cug: 'Nouveau', actif: false })
  })
})
