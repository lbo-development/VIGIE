import { describe, it, expect, vi, beforeEach } from 'vitest'

const findAll = vi.fn()
const findByCode = vi.fn()
const create = vi.fn()
const update = vi.fn()
const reorder = vi.fn()
const findBySites = vi.fn()
const hasActiveRole = vi.fn()
const hasActiveRoleForService = vi.fn()

vi.mock('../repositories/site.repository.js', () => ({
  findAll: (...args: unknown[]) => findAll(...args),
  findByCode: (...args: unknown[]) => findByCode(...args),
  create: (...args: unknown[]) => create(...args),
  update: (...args: unknown[]) => update(...args),
  reorder: (...args: unknown[]) => reorder(...args),
}))
vi.mock('../repositories/sousSite.repository.js', () => ({
  findBySites: (...args: unknown[]) => findBySites(...args),
}))
vi.mock('../repositories/auth.repository.js', () => ({
  hasActiveRole: (...args: unknown[]) => hasActiveRole(...args),
  hasActiveRoleForService: (...args: unknown[]) => hasActiveRoleForService(...args),
}))

const { createSite, updateSite, listSites, reorderSites } = await import('../services/site.service.js')

const MATRICULE = '12520'
const ID_SERVICE = 1

beforeEach(() => {
  findAll.mockReset()
  findByCode.mockReset()
  create.mockReset()
  update.mockReset()
  reorder.mockReset()
  findBySites.mockReset()
  hasActiveRole.mockReset()
  hasActiveRoleForService.mockReset()
})

describe('createSite', () => {
  it('rejette une entrée invalide (400)', async () => {
    await expect(createSite(MATRICULE, { codeSite: '', libSite: 'X', idService: 1 })).rejects.toMatchObject({
      status: 400,
    })
    expect(create).not.toHaveBeenCalled()
  })

  it("rejette si l'utilisateur n'a ni ADMIN_APP ni ADMIN_SERVICE sur le service visé (403)", async () => {
    hasActiveRole.mockResolvedValue(false)
    hasActiveRoleForService.mockResolvedValue(false)

    await expect(
      createSite(MATRICULE, { codeSite: 'X', libSite: 'Site X', idService: ID_SERVICE }),
    ).rejects.toMatchObject({ status: 403 })
    expect(create).not.toHaveBeenCalled()
  })

  it('autorise ADMIN_APP quel que soit le service', async () => {
    hasActiveRole.mockResolvedValue(true)
    findByCode.mockResolvedValue(null)
    create.mockResolvedValue({ code_site: 'X', lib_site: 'Site X', ordre_site: 0, id_service: ID_SERVICE, actif: true })

    await createSite(MATRICULE, { codeSite: 'X', libSite: 'Site X', idService: ID_SERVICE })

    expect(create).toHaveBeenCalledWith(
      expect.objectContaining({ code_site: 'X', lib_site: 'Site X', id_service: ID_SERVICE }),
    )
  })

  it('autorise ADMIN_SERVICE scopé au service visé', async () => {
    hasActiveRole.mockResolvedValue(false)
    hasActiveRoleForService.mockResolvedValue(true)
    findByCode.mockResolvedValue(null)
    create.mockResolvedValue({ code_site: 'X', lib_site: 'Site X', ordre_site: 0, id_service: ID_SERVICE, actif: true })

    await createSite(MATRICULE, { codeSite: 'X', libSite: 'Site X', idService: ID_SERVICE })

    expect(hasActiveRoleForService).toHaveBeenCalledWith(MATRICULE, 'ADMIN_SERVICE', ID_SERVICE)
    expect(create).toHaveBeenCalled()
  })

  it('rejette un code_site déjà existant (409)', async () => {
    hasActiveRole.mockResolvedValue(true)
    findByCode.mockResolvedValue({ code_site: 'X', lib_site: 'Existant', ordre_site: 0, id_service: 1, actif: true })

    await expect(createSite(MATRICULE, { codeSite: 'X', libSite: 'Site X', idService: ID_SERVICE })).rejects.toMatchObject(
      { status: 409 },
    )
    expect(create).not.toHaveBeenCalled()
  })
})

describe('updateSite', () => {
  it('rejette si le site est introuvable (404)', async () => {
    findByCode.mockResolvedValue(null)

    await expect(updateSite(MATRICULE, 'INCONNU', { libSite: 'Nouveau libellé' })).rejects.toMatchObject({
      status: 404,
    })
  })

  it("rejette sans droit sur le service actuel du site (403)", async () => {
    findByCode.mockResolvedValue({ code_site: 'X', lib_site: 'X', ordre_site: 0, id_service: ID_SERVICE, actif: true })
    hasActiveRole.mockResolvedValue(false)
    hasActiveRoleForService.mockResolvedValue(false)

    await expect(updateSite(MATRICULE, 'X', { libSite: 'Nouveau' })).rejects.toMatchObject({ status: 403 })
    expect(update).not.toHaveBeenCalled()
  })

  it("vérifie aussi le droit sur le service cible quand on déplace le site vers un autre service", async () => {
    findByCode.mockResolvedValue({ code_site: 'X', lib_site: 'X', ordre_site: 0, id_service: 1, actif: true })
    hasActiveRole.mockResolvedValue(false)
    // Autorisé sur le service actuel (1) mais pas sur le service cible (2)
    hasActiveRoleForService.mockImplementation(async (_m: string, _r: string, idService: number) => idService === 1)

    await expect(updateSite(MATRICULE, 'X', { idService: 2 })).rejects.toMatchObject({ status: 403 })
    expect(update).not.toHaveBeenCalled()
  })

  it('autorise et délègue au repository quand les droits sont réunis', async () => {
    findByCode.mockResolvedValue({ code_site: 'X', lib_site: 'X', ordre_site: 0, id_service: ID_SERVICE, actif: true })
    hasActiveRole.mockResolvedValue(true)
    update.mockResolvedValue({ code_site: 'X', lib_site: 'Nouveau', ordre_site: 0, id_service: ID_SERVICE, actif: true })

    await updateSite(MATRICULE, 'X', { libSite: 'Nouveau' })

    expect(update).toHaveBeenCalledWith('X', expect.objectContaining({ lib_site: 'Nouveau' }))
  })
})

describe('reorderSites', () => {
  it('rejette une entrée invalide (400)', async () => {
    await expect(reorderSites(MATRICULE, { idService: ID_SERVICE, codeSites: [] })).rejects.toMatchObject({
      status: 400,
    })
    expect(reorder).not.toHaveBeenCalled()
  })

  it('rejette sans droit sur le service (403)', async () => {
    hasActiveRole.mockResolvedValue(false)
    hasActiveRoleForService.mockResolvedValue(false)

    await expect(
      reorderSites(MATRICULE, { idService: ID_SERVICE, codeSites: ['A', 'B'] }),
    ).rejects.toMatchObject({ status: 403 })
    expect(reorder).not.toHaveBeenCalled()
  })

  it("rejette si un des sites n'appartient pas au service annoncé (400)", async () => {
    hasActiveRole.mockResolvedValue(true)
    findByCode.mockImplementation(async (code: string) => ({
      code_site: code,
      lib_site: code,
      ordre_site: 0,
      id_service: code === 'B' ? 2 : ID_SERVICE, // B appartient à un autre service
      actif: true,
    }))

    await expect(
      reorderSites(MATRICULE, { idService: ID_SERVICE, codeSites: ['A', 'B'] }),
    ).rejects.toMatchObject({ status: 400 })
    expect(reorder).not.toHaveBeenCalled()
  })

  it('délègue au repository avec le nouvel ordre quand tout est valide', async () => {
    hasActiveRole.mockResolvedValue(true)
    findByCode.mockImplementation(async (code: string) => ({
      code_site: code,
      lib_site: code,
      ordre_site: 0,
      id_service: ID_SERVICE,
      actif: true,
    }))
    reorder.mockResolvedValue(undefined)

    await reorderSites(MATRICULE, { idService: ID_SERVICE, codeSites: ['B', 'A'] })

    expect(reorder).toHaveBeenCalledWith(['B', 'A'])
  })
})

describe('listSites', () => {
  it('regroupe les sous-sites sous leur site parent', async () => {
    findAll.mockResolvedValue([
      { code_site: 'A', lib_site: 'A', ordre_site: 1, id_service: ID_SERVICE, actif: true },
      { code_site: 'B', lib_site: 'B', ordre_site: 2, id_service: ID_SERVICE, actif: true },
    ])
    findBySites.mockResolvedValue([
      { code_site: 'A', code_sous_site: 'A1', ordre_sous_site: 1, actif: true },
      { code_site: 'A', code_sous_site: 'A2', ordre_sous_site: 2, actif: true },
    ])

    const result = await listSites(ID_SERVICE)

    expect(result).toEqual([
      {
        code_site: 'A',
        lib_site: 'A',
        ordre_site: 1,
        id_service: ID_SERVICE,
        actif: true,
        sous_sites: [
          { code_site: 'A', code_sous_site: 'A1', ordre_sous_site: 1, actif: true },
          { code_site: 'A', code_sous_site: 'A2', ordre_sous_site: 2, actif: true },
        ],
      },
      { code_site: 'B', lib_site: 'B', ordre_site: 2, id_service: ID_SERVICE, actif: true, sous_sites: [] },
    ])
    expect(findAll).toHaveBeenCalledWith(ID_SERVICE)
  })
})
