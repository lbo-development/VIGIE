import { describe, it, expect, vi, beforeEach } from 'vitest'

const findByCode = vi.fn()
const create = vi.fn()
const update = vi.fn()
const reorder = vi.fn()
const hasActiveRole = vi.fn()
const hasActiveRoleForService = vi.fn()

vi.mock('../repositories/secteur.repository.js', () => ({
  findByCode: (...args: unknown[]) => findByCode(...args),
}))
vi.mock('../repositories/sousSecteur.repository.js', () => ({
  create: (...args: unknown[]) => create(...args),
  update: (...args: unknown[]) => update(...args),
  reorder: (...args: unknown[]) => reorder(...args),
}))
vi.mock('../repositories/auth.repository.js', () => ({
  hasActiveRole: (...args: unknown[]) => hasActiveRole(...args),
  hasActiveRoleForService: (...args: unknown[]) => hasActiveRoleForService(...args),
}))

const { createSousSecteur, updateSousSecteur, reorderSousSecteurs } = await import(
  '../services/sousSecteur.service.js'
)

const MATRICULE = '12520'
const CODE_SECTEUR = 'MANUT'
const SECTEUR = { code_secteur: CODE_SECTEUR, lib_secteur: 'Manutention', ordre_secteur: 1, id_service: 1, actif: true }

beforeEach(() => {
  findByCode.mockReset()
  create.mockReset()
  update.mockReset()
  reorder.mockReset()
  hasActiveRole.mockReset()
  hasActiveRoleForService.mockReset()
})

describe('createSousSecteur', () => {
  it('rejette une entrée invalide (400)', async () => {
    await expect(createSousSecteur(MATRICULE, CODE_SECTEUR, { codeSousSecteur: '' })).rejects.toMatchObject({
      status: 400,
    })
    expect(create).not.toHaveBeenCalled()
  })

  it('rejette si le secteur parent est introuvable (404)', async () => {
    findByCode.mockResolvedValue(null)

    await expect(createSousSecteur(MATRICULE, 'INCONNU', { codeSousSecteur: 'A1' })).rejects.toMatchObject({
      status: 404,
    })
    expect(create).not.toHaveBeenCalled()
  })

  it("hérite du périmètre du secteur parent : rejette sans droit sur son service (403)", async () => {
    findByCode.mockResolvedValue(SECTEUR)
    hasActiveRole.mockResolvedValue(false)
    hasActiveRoleForService.mockResolvedValue(false)

    await expect(createSousSecteur(MATRICULE, CODE_SECTEUR, { codeSousSecteur: 'A1' })).rejects.toMatchObject({
      status: 403,
    })
    expect(create).not.toHaveBeenCalled()
  })

  it('autorise et délègue au repository avec le code_secteur du parent', async () => {
    findByCode.mockResolvedValue(SECTEUR)
    hasActiveRole.mockResolvedValue(true)
    create.mockResolvedValue({ code_secteur: CODE_SECTEUR, code_sous_secteur: 'A1', ordre_sous_secteur: 0, actif: true })

    await createSousSecteur(MATRICULE, CODE_SECTEUR, { codeSousSecteur: 'A1' })

    expect(create).toHaveBeenCalledWith(
      expect.objectContaining({ code_secteur: CODE_SECTEUR, code_sous_secteur: 'A1', actif: true }),
    )
  })
})

describe('updateSousSecteur', () => {
  it('rejette si le secteur parent est introuvable (404)', async () => {
    findByCode.mockResolvedValue(null)

    await expect(updateSousSecteur(MATRICULE, 'INCONNU', 'A1', { actif: false })).rejects.toMatchObject({
      status: 404,
    })
    expect(update).not.toHaveBeenCalled()
  })

  it('rejette sans droit sur le service du secteur parent (403)', async () => {
    findByCode.mockResolvedValue(SECTEUR)
    hasActiveRole.mockResolvedValue(false)
    hasActiveRoleForService.mockResolvedValue(false)

    await expect(updateSousSecteur(MATRICULE, CODE_SECTEUR, 'A1', { actif: false })).rejects.toMatchObject({
      status: 403,
    })
    expect(update).not.toHaveBeenCalled()
  })

  it('autorise et délègue au repository', async () => {
    findByCode.mockResolvedValue(SECTEUR)
    hasActiveRole.mockResolvedValue(true)
    update.mockResolvedValue({ code_secteur: CODE_SECTEUR, code_sous_secteur: 'A1', ordre_sous_secteur: 0, actif: false })

    await updateSousSecteur(MATRICULE, CODE_SECTEUR, 'A1', { actif: false })

    expect(update).toHaveBeenCalledWith(CODE_SECTEUR, 'A1', { actif: false })
  })

  it('convertit ordreSousSecteur (camelCase, entrée) en ordre_sous_secteur (snake_case, colonne réelle)', async () => {
    findByCode.mockResolvedValue(SECTEUR)
    hasActiveRole.mockResolvedValue(true)
    update.mockResolvedValue({ code_secteur: CODE_SECTEUR, code_sous_secteur: 'A1', ordre_sous_secteur: 5, actif: true })

    await updateSousSecteur(MATRICULE, CODE_SECTEUR, 'A1', { ordreSousSecteur: 5, actif: true })

    expect(update).toHaveBeenCalledWith(CODE_SECTEUR, 'A1', { ordre_sous_secteur: 5, actif: true })
  })
})

describe('reorderSousSecteurs', () => {
  it('rejette une entrée invalide (400)', async () => {
    await expect(reorderSousSecteurs(MATRICULE, CODE_SECTEUR, { codeSousSecteurs: [] })).rejects.toMatchObject({
      status: 400,
    })
    expect(reorder).not.toHaveBeenCalled()
  })

  it('rejette si le secteur parent est introuvable (404)', async () => {
    findByCode.mockResolvedValue(null)

    await expect(
      reorderSousSecteurs(MATRICULE, 'INCONNU', { codeSousSecteurs: ['A1', 'A2'] }),
    ).rejects.toMatchObject({ status: 404 })
    expect(reorder).not.toHaveBeenCalled()
  })

  it('rejette sans droit sur le service du secteur parent (403)', async () => {
    findByCode.mockResolvedValue(SECTEUR)
    hasActiveRole.mockResolvedValue(false)
    hasActiveRoleForService.mockResolvedValue(false)

    await expect(
      reorderSousSecteurs(MATRICULE, CODE_SECTEUR, { codeSousSecteurs: ['A1', 'A2'] }),
    ).rejects.toMatchObject({ status: 403 })
    expect(reorder).not.toHaveBeenCalled()
  })

  it('délègue au repository avec le nouvel ordre', async () => {
    findByCode.mockResolvedValue(SECTEUR)
    hasActiveRole.mockResolvedValue(true)
    reorder.mockResolvedValue(undefined)

    await reorderSousSecteurs(MATRICULE, CODE_SECTEUR, { codeSousSecteurs: ['A2', 'A1'] })

    expect(reorder).toHaveBeenCalledWith(CODE_SECTEUR, ['A2', 'A1'])
  })
})
