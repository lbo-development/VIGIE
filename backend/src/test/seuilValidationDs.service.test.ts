import { describe, it, expect, vi, beforeEach } from 'vitest'

const seuilFindAll = vi.fn()
const seuilUpsert = vi.fn()

const serviceFindById = vi.fn()

const hasActiveRole = vi.fn()
const hasActiveRoleForService = vi.fn()

vi.mock('../repositories/seuilValidationDs.repository.js', () => ({
  findAll: (...args: unknown[]) => seuilFindAll(...args),
  upsert: (...args: unknown[]) => seuilUpsert(...args),
}))
vi.mock('../repositories/service.repository.js', () => ({
  findById: (...args: unknown[]) => serviceFindById(...args),
}))
vi.mock('../repositories/auth.repository.js', () => ({
  hasActiveRole: (...args: unknown[]) => hasActiveRole(...args),
  hasActiveRoleForService: (...args: unknown[]) => hasActiveRoleForService(...args),
}))

const { listSeuils, upsertSeuil } = await import('../services/seuilValidationDs.service.js')

const MATRICULE = '12520'
const SERVICE = { id_service: 1, code_service: 'MAINT', libelle_service: 'Maintenance', id_direction: 1, actif: true }

beforeEach(() => {
  seuilFindAll.mockReset()
  seuilUpsert.mockReset()
  serviceFindById.mockReset()
  hasActiveRole.mockReset()
  hasActiveRoleForService.mockReset()
})

describe('listSeuils', () => {
  it('délègue au repository', async () => {
    seuilFindAll.mockResolvedValue([])
    await listSeuils()
    expect(seuilFindAll).toHaveBeenCalled()
  })
})

describe('upsertSeuil', () => {
  it('rejette une entrée invalide (400)', async () => {
    await expect(
      upsertSeuil(MATRICULE, 1, { seuilFonctionnement: -1, seuilInvestissement: 0 }),
    ).rejects.toMatchObject({ status: 400 })
    expect(seuilUpsert).not.toHaveBeenCalled()
  })

  it('rejette un montant décimal (nombre entier obligatoire, 400)', async () => {
    await expect(
      upsertSeuil(MATRICULE, 1, { seuilFonctionnement: 5000.5, seuilInvestissement: 0 }),
    ).rejects.toMatchObject({ status: 400 })
    expect(seuilUpsert).not.toHaveBeenCalled()
  })

  it('rejette si le service est introuvable (404)', async () => {
    serviceFindById.mockResolvedValue(null)

    await expect(
      upsertSeuil(MATRICULE, 1, { seuilFonctionnement: 5000, seuilInvestissement: 20000 }),
    ).rejects.toMatchObject({ status: 404 })
    expect(seuilUpsert).not.toHaveBeenCalled()
  })

  it("rejette si l'utilisateur n'a ni ADMIN_APP ni ADMIN_SERVICE sur le service visé (403)", async () => {
    serviceFindById.mockResolvedValue(SERVICE)
    hasActiveRole.mockResolvedValue(false)
    hasActiveRoleForService.mockResolvedValue(false)

    await expect(
      upsertSeuil(MATRICULE, 1, { seuilFonctionnement: 5000, seuilInvestissement: 20000 }),
    ).rejects.toMatchObject({ status: 403 })
    expect(seuilUpsert).not.toHaveBeenCalled()
  })

  it('autorise ADMIN_APP quel que soit le service', async () => {
    serviceFindById.mockResolvedValue(SERVICE)
    hasActiveRole.mockResolvedValue(true)
    seuilUpsert.mockResolvedValue({ id_service: 1, seuil_fonctionnement: 5000, seuil_investissement: 20000 })

    await upsertSeuil(MATRICULE, 1, { seuilFonctionnement: 5000, seuilInvestissement: 20000 })

    expect(seuilUpsert).toHaveBeenCalledWith({
      id_service: 1,
      seuil_fonctionnement: 5000,
      seuil_investissement: 20000,
    })
  })

  it('autorise ADMIN_SERVICE scopé au service visé', async () => {
    serviceFindById.mockResolvedValue(SERVICE)
    hasActiveRole.mockResolvedValue(false)
    hasActiveRoleForService.mockResolvedValue(true)
    seuilUpsert.mockResolvedValue({ id_service: 1, seuil_fonctionnement: 5000, seuil_investissement: 20000 })

    await upsertSeuil(MATRICULE, 1, { seuilFonctionnement: 5000, seuilInvestissement: 20000 })

    expect(hasActiveRoleForService).toHaveBeenCalledWith(MATRICULE, 'ADMIN_SERVICE', 1)
    expect(seuilUpsert).toHaveBeenCalled()
  })

  it('accepte un seuil à 0 (cas explicite "pas de dispense")', async () => {
    serviceFindById.mockResolvedValue(SERVICE)
    hasActiveRole.mockResolvedValue(true)
    seuilUpsert.mockResolvedValue({ id_service: 1, seuil_fonctionnement: 0, seuil_investissement: 0 })

    await upsertSeuil(MATRICULE, 1, { seuilFonctionnement: 0, seuilInvestissement: 0 })

    expect(seuilUpsert).toHaveBeenCalledWith({ id_service: 1, seuil_fonctionnement: 0, seuil_investissement: 0 })
  })
})
