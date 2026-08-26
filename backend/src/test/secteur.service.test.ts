import { describe, it, expect, vi, beforeEach } from 'vitest'

const findAll = vi.fn()
const findByCode = vi.fn()
const create = vi.fn()
const update = vi.fn()
const reorder = vi.fn()
const findBySecteurs = vi.fn()
const hasActiveRole = vi.fn()
const hasActiveRoleForService = vi.fn()

vi.mock('../repositories/secteur.repository.js', () => ({
  findAll: (...args: unknown[]) => findAll(...args),
  findByCode: (...args: unknown[]) => findByCode(...args),
  create: (...args: unknown[]) => create(...args),
  update: (...args: unknown[]) => update(...args),
  reorder: (...args: unknown[]) => reorder(...args),
}))
vi.mock('../repositories/sousSecteur.repository.js', () => ({
  findBySecteurs: (...args: unknown[]) => findBySecteurs(...args),
}))
vi.mock('../repositories/auth.repository.js', () => ({
  hasActiveRole: (...args: unknown[]) => hasActiveRole(...args),
  hasActiveRoleForService: (...args: unknown[]) => hasActiveRoleForService(...args),
}))

const { createSecteur, updateSecteur, listSecteurs, reorderSecteurs } = await import('../services/secteur.service.js')

const MATRICULE = '12520'
const ID_SERVICE = 1

beforeEach(() => {
  findAll.mockReset()
  findByCode.mockReset()
  create.mockReset()
  update.mockReset()
  reorder.mockReset()
  findBySecteurs.mockReset()
  hasActiveRole.mockReset()
  hasActiveRoleForService.mockReset()
})

describe('createSecteur', () => {
  it('rejette une entrée invalide (400)', async () => {
    await expect(createSecteur(MATRICULE, { codeSecteur: '', libSecteur: 'X', idService: 1 })).rejects.toMatchObject({
      status: 400,
    })
    expect(create).not.toHaveBeenCalled()
  })

  it("rejette si l'utilisateur n'a ni ADMIN_APP ni ADMIN_SERVICE sur le service visé (403)", async () => {
    hasActiveRole.mockResolvedValue(false)
    hasActiveRoleForService.mockResolvedValue(false)

    await expect(
      createSecteur(MATRICULE, { codeSecteur: 'X', libSecteur: 'Secteur X', idService: ID_SERVICE }),
    ).rejects.toMatchObject({ status: 403 })
    expect(create).not.toHaveBeenCalled()
  })

  it('autorise ADMIN_APP quel que soit le service', async () => {
    hasActiveRole.mockResolvedValue(true)
    findByCode.mockResolvedValue(null)
    create.mockResolvedValue({
      code_secteur: 'X',
      lib_secteur: 'Secteur X',
      ordre_secteur: 0,
      id_service: ID_SERVICE,
      actif: true,
    })

    await createSecteur(MATRICULE, { codeSecteur: 'X', libSecteur: 'Secteur X', idService: ID_SERVICE })

    expect(create).toHaveBeenCalledWith(
      expect.objectContaining({ code_secteur: 'X', lib_secteur: 'Secteur X', id_service: ID_SERVICE }),
    )
  })

  it('autorise ADMIN_SERVICE scopé au service visé', async () => {
    hasActiveRole.mockResolvedValue(false)
    hasActiveRoleForService.mockResolvedValue(true)
    findByCode.mockResolvedValue(null)
    create.mockResolvedValue({
      code_secteur: 'X',
      lib_secteur: 'Secteur X',
      ordre_secteur: 0,
      id_service: ID_SERVICE,
      actif: true,
    })

    await createSecteur(MATRICULE, { codeSecteur: 'X', libSecteur: 'Secteur X', idService: ID_SERVICE })

    expect(hasActiveRoleForService).toHaveBeenCalledWith(MATRICULE, 'ADMIN_SERVICE', ID_SERVICE)
    expect(create).toHaveBeenCalled()
  })

  it('rejette un code_secteur déjà existant (409)', async () => {
    hasActiveRole.mockResolvedValue(true)
    findByCode.mockResolvedValue({
      code_secteur: 'X',
      lib_secteur: 'Existant',
      ordre_secteur: 0,
      id_service: 1,
      actif: true,
    })

    await expect(
      createSecteur(MATRICULE, { codeSecteur: 'X', libSecteur: 'Secteur X', idService: ID_SERVICE }),
    ).rejects.toMatchObject({ status: 409 })
    expect(create).not.toHaveBeenCalled()
  })
})

describe('updateSecteur', () => {
  it('rejette si le secteur est introuvable (404)', async () => {
    findByCode.mockResolvedValue(null)

    await expect(updateSecteur(MATRICULE, 'INCONNU', { libSecteur: 'Nouveau libellé' })).rejects.toMatchObject({
      status: 404,
    })
  })

  it("rejette sans droit sur le service actuel du secteur (403)", async () => {
    findByCode.mockResolvedValue({ code_secteur: 'X', lib_secteur: 'X', ordre_secteur: 0, id_service: ID_SERVICE, actif: true })
    hasActiveRole.mockResolvedValue(false)
    hasActiveRoleForService.mockResolvedValue(false)

    await expect(updateSecteur(MATRICULE, 'X', { libSecteur: 'Nouveau' })).rejects.toMatchObject({ status: 403 })
    expect(update).not.toHaveBeenCalled()
  })

  it("vérifie aussi le droit sur le service cible quand on déplace le secteur vers un autre service", async () => {
    findByCode.mockResolvedValue({ code_secteur: 'X', lib_secteur: 'X', ordre_secteur: 0, id_service: 1, actif: true })
    hasActiveRole.mockResolvedValue(false)
    // Autorisé sur le service actuel (1) mais pas sur le service cible (2)
    hasActiveRoleForService.mockImplementation(async (_m: string, _r: string, idService: number) => idService === 1)

    await expect(updateSecteur(MATRICULE, 'X', { idService: 2 })).rejects.toMatchObject({ status: 403 })
    expect(update).not.toHaveBeenCalled()
  })

  it('autorise et délègue au repository quand les droits sont réunis', async () => {
    findByCode.mockResolvedValue({ code_secteur: 'X', lib_secteur: 'X', ordre_secteur: 0, id_service: ID_SERVICE, actif: true })
    hasActiveRole.mockResolvedValue(true)
    update.mockResolvedValue({ code_secteur: 'X', lib_secteur: 'Nouveau', ordre_secteur: 0, id_service: ID_SERVICE, actif: true })

    await updateSecteur(MATRICULE, 'X', { libSecteur: 'Nouveau' })

    expect(update).toHaveBeenCalledWith('X', expect.objectContaining({ lib_secteur: 'Nouveau' }))
  })
})

describe('reorderSecteurs', () => {
  it('rejette une entrée invalide (400)', async () => {
    await expect(reorderSecteurs(MATRICULE, { idService: ID_SERVICE, codeSecteurs: [] })).rejects.toMatchObject({
      status: 400,
    })
    expect(reorder).not.toHaveBeenCalled()
  })

  it('rejette sans droit sur le service (403)', async () => {
    hasActiveRole.mockResolvedValue(false)
    hasActiveRoleForService.mockResolvedValue(false)

    await expect(
      reorderSecteurs(MATRICULE, { idService: ID_SERVICE, codeSecteurs: ['A', 'B'] }),
    ).rejects.toMatchObject({ status: 403 })
    expect(reorder).not.toHaveBeenCalled()
  })

  it("rejette si un des secteurs n'appartient pas au service annoncé (400)", async () => {
    hasActiveRole.mockResolvedValue(true)
    findByCode.mockImplementation(async (code: string) => ({
      code_secteur: code,
      lib_secteur: code,
      ordre_secteur: 0,
      id_service: code === 'B' ? 2 : ID_SERVICE, // B appartient à un autre service
      actif: true,
    }))

    await expect(
      reorderSecteurs(MATRICULE, { idService: ID_SERVICE, codeSecteurs: ['A', 'B'] }),
    ).rejects.toMatchObject({ status: 400 })
    expect(reorder).not.toHaveBeenCalled()
  })

  it('délègue au repository avec le nouvel ordre quand tout est valide', async () => {
    hasActiveRole.mockResolvedValue(true)
    findByCode.mockImplementation(async (code: string) => ({
      code_secteur: code,
      lib_secteur: code,
      ordre_secteur: 0,
      id_service: ID_SERVICE,
      actif: true,
    }))
    reorder.mockResolvedValue(undefined)

    await reorderSecteurs(MATRICULE, { idService: ID_SERVICE, codeSecteurs: ['B', 'A'] })

    expect(reorder).toHaveBeenCalledWith(['B', 'A'])
  })
})

describe('listSecteurs', () => {
  it('regroupe les sous-secteurs sous leur secteur parent', async () => {
    findAll.mockResolvedValue([
      { code_secteur: 'A', lib_secteur: 'A', ordre_secteur: 1, id_service: ID_SERVICE, actif: true },
      { code_secteur: 'B', lib_secteur: 'B', ordre_secteur: 2, id_service: ID_SERVICE, actif: true },
    ])
    findBySecteurs.mockResolvedValue([
      { code_secteur: 'A', code_sous_secteur: 'A1', ordre_sous_secteur: 1, actif: true },
      { code_secteur: 'A', code_sous_secteur: 'A2', ordre_sous_secteur: 2, actif: true },
    ])

    const result = await listSecteurs(ID_SERVICE)

    expect(result).toEqual([
      {
        code_secteur: 'A',
        lib_secteur: 'A',
        ordre_secteur: 1,
        id_service: ID_SERVICE,
        actif: true,
        sous_secteurs: [
          { code_secteur: 'A', code_sous_secteur: 'A1', ordre_sous_secteur: 1, actif: true },
          { code_secteur: 'A', code_sous_secteur: 'A2', ordre_sous_secteur: 2, actif: true },
        ],
      },
      { code_secteur: 'B', lib_secteur: 'B', ordre_secteur: 2, id_service: ID_SERVICE, actif: true, sous_secteurs: [] },
    ])
    expect(findAll).toHaveBeenCalledWith(ID_SERVICE)
  })
})
