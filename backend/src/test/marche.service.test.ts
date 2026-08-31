import { describe, it, expect, vi, beforeEach } from 'vitest'

const findByCugCodes = vi.fn()
const findAllCug = vi.fn()
const findAllFournisseur = vi.fn()
const findIdServiceByMatricule = vi.fn()
const findActiveByMatricule = vi.fn()

vi.mock('../repositories/marche.repository.js', () => ({
  findByCugCodes: (...args: unknown[]) => findByCugCodes(...args),
}))
vi.mock('../repositories/cug.repository.js', () => ({
  findAll: (...args: unknown[]) => findAllCug(...args),
}))
vi.mock('../repositories/fournisseur.repository.js', () => ({
  findAll: (...args: unknown[]) => findAllFournisseur(...args),
}))
vi.mock('../repositories/acteur.repository.js', () => ({
  findIdServiceByMatricule: (...args: unknown[]) => findIdServiceByMatricule(...args),
}))
vi.mock('../repositories/roleAttribution.repository.js', () => ({
  findActiveByMatricule: (...args: unknown[]) => findActiveByMatricule(...args),
}))

const { listMarches } = await import('../services/marche.service.js')

const MATRICULE = '12520'
const ID_SERVICE = 1

beforeEach(() => {
  findByCugCodes.mockReset().mockResolvedValue([{ nummarche: 'M0909311', id_fournisseur: 5 }])
  findAllCug.mockReset().mockResolvedValue([{ code_cug: '268', libelle_cug: 'Fournitures', id_service: ID_SERVICE, actif: true }])
  findAllFournisseur.mockReset().mockResolvedValue([{ id_fournisseur: 5, raison_sociale_service: 'NAID' }])
  findIdServiceByMatricule.mockReset()
  findActiveByMatricule.mockReset().mockResolvedValue([])
})

describe('listMarches', () => {
  it('rejette sans matricule (authentification requise)', async () => {
    await expect(listMarches(null, ID_SERVICE)).rejects.toMatchObject({ status: 401 })
  })

  it("ADMIN_APP : utilise l'idService transmis, enrichit chaque marché avec le nom du fournisseur (FOURNISSEUR.RAISON_SOCIALE_SERVICE via ID_FOURNISSEUR)", async () => {
    findActiveByMatricule.mockResolvedValue([{ type_role: 'ADMIN_APP', id_service: null, id_cellule: null, id_direction: null, id_role: 1 }])

    const result = await listMarches(MATRICULE, ID_SERVICE)

    expect(findIdServiceByMatricule).not.toHaveBeenCalled()
    expect(findAllCug).toHaveBeenCalledWith(ID_SERVICE)
    expect(findAllFournisseur).toHaveBeenCalledWith(ID_SERVICE)
    expect(result).toEqual([{ nummarche: 'M0909311', id_fournisseur: 5, fournisseur_raison_sociale: 'NAID' }])
  })

  it("marché sans ID_FOURNISSEUR ou dont le fournisseur n'est pas résolu : fournisseur_raison_sociale à null", async () => {
    findActiveByMatricule.mockResolvedValue([{ type_role: 'ADMIN_APP', id_service: null, id_cellule: null, id_direction: null, id_role: 1 }])
    findByCugCodes.mockResolvedValue([
      { nummarche: 'M_SANS_FOURNISSEUR', id_fournisseur: null },
      { nummarche: 'M_FOURNISSEUR_INCONNU', id_fournisseur: 999 },
    ])

    const result = await listMarches(MATRICULE, ID_SERVICE)

    expect(result).toEqual([
      { nummarche: 'M_SANS_FOURNISSEUR', id_fournisseur: null, fournisseur_raison_sociale: null },
      { nummarche: 'M_FOURNISSEUR_INCONNU', id_fournisseur: 999, fournisseur_raison_sociale: null },
    ])
  })

  it("ADMIN_APP sans idService transmis : renvoie une liste vide", async () => {
    findActiveByMatricule.mockResolvedValue([{ type_role: 'ADMIN_APP', id_service: null, id_cellule: null, id_direction: null, id_role: 1 }])

    const result = await listMarches(MATRICULE, undefined)

    expect(result).toEqual([])
    expect(findAllCug).not.toHaveBeenCalled()
    expect(findAllFournisseur).not.toHaveBeenCalled()
  })

  it("acteur non ADMIN_APP : ignore l'idService transmis, utilise son propre service", async () => {
    findIdServiceByMatricule.mockResolvedValue(ID_SERVICE)

    const result = await listMarches(MATRICULE, 999)

    expect(findIdServiceByMatricule).toHaveBeenCalledWith(MATRICULE)
    expect(findAllCug).toHaveBeenCalledWith(ID_SERVICE)
    expect(findAllFournisseur).toHaveBeenCalledWith(ID_SERVICE)
    expect(result).toEqual([{ nummarche: 'M0909311', id_fournisseur: 5, fournisseur_raison_sociale: 'NAID' }])
  })

  it("acteur non ADMIN_APP sans service propre : renvoie une liste vide", async () => {
    findIdServiceByMatricule.mockResolvedValue(null)

    const result = await listMarches(MATRICULE, undefined)

    expect(result).toEqual([])
    expect(findAllCug).not.toHaveBeenCalled()
    expect(findAllFournisseur).not.toHaveBeenCalled()
  })
})
