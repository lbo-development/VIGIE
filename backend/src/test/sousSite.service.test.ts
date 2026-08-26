import { describe, it, expect, vi, beforeEach } from 'vitest'

const findByCode = vi.fn()
const create = vi.fn()
const update = vi.fn()
const reorder = vi.fn()
const hasActiveRole = vi.fn()
const hasActiveRoleForService = vi.fn()

vi.mock('../repositories/site.repository.js', () => ({
  findByCode: (...args: unknown[]) => findByCode(...args),
}))
vi.mock('../repositories/sousSite.repository.js', () => ({
  create: (...args: unknown[]) => create(...args),
  update: (...args: unknown[]) => update(...args),
  reorder: (...args: unknown[]) => reorder(...args),
}))
vi.mock('../repositories/auth.repository.js', () => ({
  hasActiveRole: (...args: unknown[]) => hasActiveRole(...args),
  hasActiveRoleForService: (...args: unknown[]) => hasActiveRoleForService(...args),
}))

const { createSousSite, updateSousSite, reorderSousSites } = await import('../services/sousSite.service.js')

const MATRICULE = '12520'
const CODE_SITE = 'CAP_JANET'
const SITE = { code_site: CODE_SITE, lib_site: 'Cap Janet', ordre_site: 1, id_service: 1, actif: true }

beforeEach(() => {
  findByCode.mockReset()
  create.mockReset()
  update.mockReset()
  reorder.mockReset()
  hasActiveRole.mockReset()
  hasActiveRoleForService.mockReset()
})

describe('createSousSite', () => {
  it('rejette une entrée invalide (400)', async () => {
    await expect(createSousSite(MATRICULE, CODE_SITE, { codeSousSite: '' })).rejects.toMatchObject({ status: 400 })
    expect(create).not.toHaveBeenCalled()
  })

  it('rejette si le site parent est introuvable (404)', async () => {
    findByCode.mockResolvedValue(null)

    await expect(createSousSite(MATRICULE, 'INCONNU', { codeSousSite: 'A1' })).rejects.toMatchObject({ status: 404 })
    expect(create).not.toHaveBeenCalled()
  })

  it("hérite du périmètre du site parent : rejette sans droit sur son service (403)", async () => {
    findByCode.mockResolvedValue(SITE)
    hasActiveRole.mockResolvedValue(false)
    hasActiveRoleForService.mockResolvedValue(false)

    await expect(createSousSite(MATRICULE, CODE_SITE, { codeSousSite: 'A1' })).rejects.toMatchObject({ status: 403 })
    expect(create).not.toHaveBeenCalled()
  })

  it('autorise et délègue au repository avec le code_site du parent', async () => {
    findByCode.mockResolvedValue(SITE)
    hasActiveRole.mockResolvedValue(true)
    create.mockResolvedValue({ code_site: CODE_SITE, code_sous_site: 'A1', ordre_sous_site: 0, actif: true })

    await createSousSite(MATRICULE, CODE_SITE, { codeSousSite: 'A1' })

    expect(create).toHaveBeenCalledWith(
      expect.objectContaining({ code_site: CODE_SITE, code_sous_site: 'A1', actif: true }),
    )
  })
})

describe('updateSousSite', () => {
  it('rejette si le site parent est introuvable (404)', async () => {
    findByCode.mockResolvedValue(null)

    await expect(updateSousSite(MATRICULE, 'INCONNU', 'A1', { actif: false })).rejects.toMatchObject({ status: 404 })
    expect(update).not.toHaveBeenCalled()
  })

  it('rejette sans droit sur le service du site parent (403)', async () => {
    findByCode.mockResolvedValue(SITE)
    hasActiveRole.mockResolvedValue(false)
    hasActiveRoleForService.mockResolvedValue(false)

    await expect(updateSousSite(MATRICULE, CODE_SITE, 'A1', { actif: false })).rejects.toMatchObject({ status: 403 })
    expect(update).not.toHaveBeenCalled()
  })

  it('autorise et délègue au repository', async () => {
    findByCode.mockResolvedValue(SITE)
    hasActiveRole.mockResolvedValue(true)
    update.mockResolvedValue({ code_site: CODE_SITE, code_sous_site: 'A1', ordre_sous_site: 0, actif: false })

    await updateSousSite(MATRICULE, CODE_SITE, 'A1', { actif: false })

    expect(update).toHaveBeenCalledWith(CODE_SITE, 'A1', { actif: false })
  })

  it('convertit ordreSousSite (camelCase, entrée) en ordre_sous_site (snake_case, colonne réelle)', async () => {
    // Régression : le payload envoyé par le formulaire contient toujours les deux
    // champs (ordreSousSite + actif) — passer result.data tel quel au repository
    // enverrait une clé "ordreSousSite" que Supabase ne reconnaît pas comme colonne.
    findByCode.mockResolvedValue(SITE)
    hasActiveRole.mockResolvedValue(true)
    update.mockResolvedValue({ code_site: CODE_SITE, code_sous_site: 'A1', ordre_sous_site: 5, actif: true })

    await updateSousSite(MATRICULE, CODE_SITE, 'A1', { ordreSousSite: 5, actif: true })

    expect(update).toHaveBeenCalledWith(CODE_SITE, 'A1', { ordre_sous_site: 5, actif: true })
  })
})

describe('reorderSousSites', () => {
  it('rejette une entrée invalide (400)', async () => {
    await expect(reorderSousSites(MATRICULE, CODE_SITE, { codeSousSites: [] })).rejects.toMatchObject({
      status: 400,
    })
    expect(reorder).not.toHaveBeenCalled()
  })

  it('rejette si le site parent est introuvable (404)', async () => {
    findByCode.mockResolvedValue(null)

    await expect(
      reorderSousSites(MATRICULE, 'INCONNU', { codeSousSites: ['A1', 'A2'] }),
    ).rejects.toMatchObject({ status: 404 })
    expect(reorder).not.toHaveBeenCalled()
  })

  it('rejette sans droit sur le service du site parent (403)', async () => {
    findByCode.mockResolvedValue(SITE)
    hasActiveRole.mockResolvedValue(false)
    hasActiveRoleForService.mockResolvedValue(false)

    await expect(
      reorderSousSites(MATRICULE, CODE_SITE, { codeSousSites: ['A1', 'A2'] }),
    ).rejects.toMatchObject({ status: 403 })
    expect(reorder).not.toHaveBeenCalled()
  })

  it('délègue au repository avec le nouvel ordre', async () => {
    findByCode.mockResolvedValue(SITE)
    hasActiveRole.mockResolvedValue(true)
    reorder.mockResolvedValue(undefined)

    await reorderSousSites(MATRICULE, CODE_SITE, { codeSousSites: ['A2', 'A1'] })

    expect(reorder).toHaveBeenCalledWith(CODE_SITE, ['A2', 'A1'])
  })
})
