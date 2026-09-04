import { describe, it, expect, vi, beforeEach } from 'vitest'

const findAllCommandePgi = vi.fn()
const findIdServiceByMatricule = vi.fn()
const findActiveByMatricule = vi.fn()
const findLastImportRow = vi.fn()

vi.mock('../repositories/commandePgi.repository.js', () => ({
  findAll: (...args: unknown[]) => findAllCommandePgi(...args),
}))
vi.mock('../repositories/acteur.repository.js', () => ({
  findIdServiceByMatricule: (...args: unknown[]) => findIdServiceByMatricule(...args),
}))
vi.mock('../repositories/roleAttribution.repository.js', () => ({
  findActiveByMatricule: (...args: unknown[]) => findActiveByMatricule(...args),
}))
vi.mock('../services/commandePgiImport.service.js', () => ({
  findLastImportRow: (...args: unknown[]) => findLastImportRow(...args),
}))

const { listCommandesPgi, getLastImportStatus } = await import('../services/commandePgi.service.js')

const MATRICULE = '12520'
const ID_SERVICE = 1
const COMMANDE = { numcmd: 'P100', id_service: ID_SERVICE, code_cug: '268' }

beforeEach(() => {
  findAllCommandePgi.mockReset().mockResolvedValue([COMMANDE])
  findIdServiceByMatricule.mockReset()
  findActiveByMatricule.mockReset().mockResolvedValue([])
  findLastImportRow.mockReset().mockResolvedValue({ exists: true, valeur: '2026-09-03' })
})

describe('listCommandesPgi', () => {
  it('rejette sans matricule (authentification requise)', async () => {
    await expect(listCommandesPgi(null, ID_SERVICE)).rejects.toMatchObject({ status: 401 })
  })

  it("ADMIN_APP : utilise l'idService transmis", async () => {
    findActiveByMatricule.mockResolvedValue([{ type_role: 'ADMIN_APP', id_service: null, id_cellule: null, id_direction: null, id_role: 1 }])

    const result = await listCommandesPgi(MATRICULE, ID_SERVICE)

    expect(findIdServiceByMatricule).not.toHaveBeenCalled()
    expect(findAllCommandePgi).toHaveBeenCalledWith(ID_SERVICE)
    expect(result).toEqual([COMMANDE])
  })

  it("ADMIN_APP sans idService transmis : renvoie une liste vide", async () => {
    findActiveByMatricule.mockResolvedValue([{ type_role: 'ADMIN_APP', id_service: null, id_cellule: null, id_direction: null, id_role: 1 }])

    const result = await listCommandesPgi(MATRICULE, undefined)

    expect(result).toEqual([])
    expect(findAllCommandePgi).not.toHaveBeenCalled()
  })

  it("acteur non ADMIN_APP : ignore l'idService transmis, utilise son propre service", async () => {
    findIdServiceByMatricule.mockResolvedValue(ID_SERVICE)

    const result = await listCommandesPgi(MATRICULE, 999)

    expect(findIdServiceByMatricule).toHaveBeenCalledWith(MATRICULE)
    expect(findAllCommandePgi).toHaveBeenCalledWith(ID_SERVICE)
    expect(result).toEqual([COMMANDE])
  })

  it("acteur non ADMIN_APP sans service propre : renvoie une liste vide", async () => {
    findIdServiceByMatricule.mockResolvedValue(null)

    const result = await listCommandesPgi(MATRICULE, undefined)

    expect(result).toEqual([])
    expect(findAllCommandePgi).not.toHaveBeenCalled()
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
