import { describe, it, expect, vi, beforeEach } from 'vitest'

const findAllInvestissement = vi.fn()
const findByNumeroOperation = vi.fn()
const updateManagedFieldsRepo = vi.fn()
const findIdServiceByMatricule = vi.fn()
const findActiveByMatricule = vi.fn()
const findLastImportRow = vi.fn()
const assertManagesServiceOrHasRoleCb = vi.fn()

vi.mock('../repositories/investissement.repository.js', () => ({
  findAll: (...args: unknown[]) => findAllInvestissement(...args),
  findByNumeroOperation: (...args: unknown[]) => findByNumeroOperation(...args),
  updateManagedFields: (...args: unknown[]) => updateManagedFieldsRepo(...args),
}))
vi.mock('../repositories/acteur.repository.js', () => ({
  findIdServiceByMatricule: (...args: unknown[]) => findIdServiceByMatricule(...args),
}))
vi.mock('../repositories/roleAttribution.repository.js', () => ({
  findActiveByMatricule: (...args: unknown[]) => findActiveByMatricule(...args),
}))
vi.mock('../services/investissementImport.service.js', () => ({
  findLastImportRow: (...args: unknown[]) => findLastImportRow(...args),
}))
vi.mock('../services/authorization.service.js', () => ({
  assertManagesServiceOrHasRoleCb: (...args: unknown[]) => assertManagesServiceOrHasRoleCb(...args),
}))

const { listInvestissements, getLastImportStatus, updateManagedFields } = await import('../services/investissement.service.js')

const MATRICULE = '12520'
const ID_SERVICE = 1
const OPERATION = { numero_operation: 'VN000203', id_service: ID_SERVICE, code_cug: '268' }

beforeEach(() => {
  findAllInvestissement.mockReset().mockResolvedValue([OPERATION])
  findByNumeroOperation.mockReset().mockResolvedValue(OPERATION)
  updateManagedFieldsRepo.mockReset().mockResolvedValue({ ...OPERATION, libelle_service: 'Nouveau libellé', actif: false, utilisable: false })
  findIdServiceByMatricule.mockReset()
  findActiveByMatricule.mockReset().mockResolvedValue([])
  findLastImportRow.mockReset().mockResolvedValue({ exists: true, valeur: '2026-09-03' })
  assertManagesServiceOrHasRoleCb.mockReset().mockResolvedValue(undefined)
})

describe('listInvestissements', () => {
  it('rejette sans matricule (authentification requise)', async () => {
    await expect(listInvestissements(null, ID_SERVICE)).rejects.toMatchObject({ status: 401 })
  })

  it("ADMIN_APP : utilise l'idService transmis", async () => {
    findActiveByMatricule.mockResolvedValue([{ type_role: 'ADMIN_APP', id_service: null, id_cellule: null, id_direction: null, id_role: 1 }])

    const result = await listInvestissements(MATRICULE, ID_SERVICE)

    expect(findIdServiceByMatricule).not.toHaveBeenCalled()
    expect(findAllInvestissement).toHaveBeenCalledWith(ID_SERVICE)
    expect(result).toEqual([OPERATION])
  })

  it("ADMIN_APP sans idService transmis : renvoie une liste vide", async () => {
    findActiveByMatricule.mockResolvedValue([{ type_role: 'ADMIN_APP', id_service: null, id_cellule: null, id_direction: null, id_role: 1 }])

    const result = await listInvestissements(MATRICULE, undefined)

    expect(result).toEqual([])
    expect(findAllInvestissement).not.toHaveBeenCalled()
  })

  it("acteur non ADMIN_APP : ignore l'idService transmis, utilise son propre service", async () => {
    findIdServiceByMatricule.mockResolvedValue(ID_SERVICE)

    const result = await listInvestissements(MATRICULE, 999)

    expect(findIdServiceByMatricule).toHaveBeenCalledWith(MATRICULE)
    expect(findAllInvestissement).toHaveBeenCalledWith(ID_SERVICE)
    expect(result).toEqual([OPERATION])
  })

  it("acteur non ADMIN_APP sans service propre : renvoie une liste vide", async () => {
    findIdServiceByMatricule.mockResolvedValue(null)

    const result = await listInvestissements(MATRICULE, undefined)

    expect(result).toEqual([])
    expect(findAllInvestissement).not.toHaveBeenCalled()
  })
})

describe('getLastImportStatus', () => {
  it('rejette sans matricule (authentification requise)', async () => {
    await expect(getLastImportStatus(null, ID_SERVICE)).rejects.toMatchObject({ status: 401 })
  })

  it("ADMIN_APP : utilise l'idService transmis", async () => {
    findActiveByMatricule.mockResolvedValue([{ type_role: 'ADMIN_APP', id_service: null, id_cellule: null, id_direction: null, id_role: 1 }])
    findLastImportRow.mockResolvedValue({ exists: true, valeur: '2026-08-20' })

    const result = await getLastImportStatus(MATRICULE, ID_SERVICE)

    expect(findIdServiceByMatricule).not.toHaveBeenCalled()
    expect(findLastImportRow).toHaveBeenCalledWith(ID_SERVICE)
    expect(result).toEqual({ exists: true, valeur: '2026-08-20' })
  })

  it("ADMIN_APP sans idService transmis : exists=false, ne lit rien", async () => {
    findActiveByMatricule.mockResolvedValue([{ type_role: 'ADMIN_APP', id_service: null, id_cellule: null, id_direction: null, id_role: 1 }])

    const result = await getLastImportStatus(MATRICULE, undefined)

    expect(result).toEqual({ exists: false, valeur: null })
    expect(findLastImportRow).not.toHaveBeenCalled()
  })

  it("acteur non ADMIN_APP : ignore l'idService transmis, utilise son propre service (défense en profondeur)", async () => {
    findIdServiceByMatricule.mockResolvedValue(ID_SERVICE)

    const result = await getLastImportStatus(MATRICULE, 999)

    expect(findIdServiceByMatricule).toHaveBeenCalledWith(MATRICULE)
    expect(findLastImportRow).toHaveBeenCalledWith(ID_SERVICE)
    expect(result).toEqual({ exists: true, valeur: '2026-09-03' })
  })

  it("acteur non ADMIN_APP sans service propre : exists=false, ne lit rien", async () => {
    findIdServiceByMatricule.mockResolvedValue(null)

    const result = await getLastImportStatus(MATRICULE, undefined)

    expect(result).toEqual({ exists: false, valeur: null })
    expect(findLastImportRow).not.toHaveBeenCalled()
  })
})

describe('updateManagedFields', () => {
  const VALID_INPUT = { libelleService: 'Nouveau libellé', actif: false, utilisable: false }

  it('rejette une valeur de libellé vide', async () => {
    await expect(updateManagedFields(MATRICULE, 'VN000203', { ...VALID_INPUT, libelleService: '  ' })).rejects.toMatchObject({
      status: 400,
    })
    expect(findByNumeroOperation).not.toHaveBeenCalled()
  })

  it('rejette si actif ou utilisable est absent (pas un simple booléen)', async () => {
    await expect(updateManagedFields(MATRICULE, 'VN000203', { libelleService: 'Test' })).rejects.toMatchObject({ status: 400 })
    expect(findByNumeroOperation).not.toHaveBeenCalled()
  })

  it("rejette si l'opération est introuvable", async () => {
    findByNumeroOperation.mockResolvedValue(null)

    await expect(updateManagedFields(MATRICULE, 'INCONNU', VALID_INPUT)).rejects.toMatchObject({ status: 404 })
    expect(assertManagesServiceOrHasRoleCb).not.toHaveBeenCalled()
  })

  it("vérifie l'autorisation sur le service de l'opération existante (pas un idService transmis par le client)", async () => {
    findByNumeroOperation.mockResolvedValue({ ...OPERATION, id_service: 42 })

    await updateManagedFields(MATRICULE, 'VN000203', VALID_INPUT)

    expect(assertManagesServiceOrHasRoleCb).toHaveBeenCalledWith(MATRICULE, 42)
  })

  it('rejette si les droits sont insuffisants', async () => {
    assertManagesServiceOrHasRoleCb.mockRejectedValue(Object.assign(new Error('Droits insuffisants'), { status: 403 }))

    await expect(updateManagedFields(MATRICULE, 'VN000203', VALID_INPUT)).rejects.toMatchObject({ status: 403 })
    expect(updateManagedFieldsRepo).not.toHaveBeenCalled()
  })

  it('met à jour libellé/actif/utilisable et retourne l\'opération modifiée', async () => {
    const result = await updateManagedFields(MATRICULE, 'VN000203', { ...VALID_INPUT, libelleService: '  Nouveau libellé  ' })

    expect(updateManagedFieldsRepo).toHaveBeenCalledWith('VN000203', { libelleService: 'Nouveau libellé', actif: false, utilisable: false })
    expect(result).toEqual({ ...OPERATION, libelle_service: 'Nouveau libellé', actif: false, utilisable: false })
  })
})
