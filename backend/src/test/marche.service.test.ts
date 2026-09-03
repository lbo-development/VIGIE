import { describe, it, expect, vi, beforeEach } from 'vitest'

const findByCugCodes = vi.fn()
const findByFournisseurIds = vi.fn()
const findByNummarche = vi.fn()
const updateManagedFields = vi.fn()
const findAllCug = vi.fn()
const findByCodeCug = vi.fn()
const findAllFournisseur = vi.fn()
const findByIdFournisseur = vi.fn()
const findAllByServiceActeur = vi.fn()
const findIdServiceByMatricule = vi.fn()
const findActiveByMatricule = vi.fn()
const assertManagesServiceOrHasRoleCb = vi.fn()
const findLastImportRow = vi.fn()

vi.mock('../repositories/marche.repository.js', () => ({
  findByCugCodes: (...args: unknown[]) => findByCugCodes(...args),
  findByFournisseurIds: (...args: unknown[]) => findByFournisseurIds(...args),
  findByNummarche: (...args: unknown[]) => findByNummarche(...args),
  updateManagedFields: (...args: unknown[]) => updateManagedFields(...args),
}))
vi.mock('../repositories/cug.repository.js', () => ({
  findAll: (...args: unknown[]) => findAllCug(...args),
  findByCode: (...args: unknown[]) => findByCodeCug(...args),
}))
vi.mock('../repositories/fournisseur.repository.js', () => ({
  findAll: (...args: unknown[]) => findAllFournisseur(...args),
  findById: (...args: unknown[]) => findByIdFournisseur(...args),
}))
vi.mock('../repositories/acteur.repository.js', () => ({
  findIdServiceByMatricule: (...args: unknown[]) => findIdServiceByMatricule(...args),
  findAllByService: (...args: unknown[]) => findAllByServiceActeur(...args),
}))
vi.mock('../repositories/roleAttribution.repository.js', () => ({
  findActiveByMatricule: (...args: unknown[]) => findActiveByMatricule(...args),
}))
vi.mock('../services/authorization.service.js', () => ({
  assertManagesServiceOrHasRoleCb: (...args: unknown[]) => assertManagesServiceOrHasRoleCb(...args),
}))
vi.mock('../services/marcheImport.service.js', () => ({
  findLastImportRow: (...args: unknown[]) => findLastImportRow(...args),
}))

const {
  listMarches,
  listMarcheOptions,
  updateMarcheManagedFields,
  getLastImportStatus,
} = await import('../services/marche.service.js')

const MATRICULE = '12520'
const ID_SERVICE = 1
const NUMMARCHE = 'M1234567'

const EXISTING_MARCHE = {
  nummarche: NUMMARCHE,
  code_cug: '268',
  id_fournisseur: 5,
  typeproc: 'MARCHE',
}

function validUpdateInput(overrides: Record<string, unknown> = {}) {
  return {
    typedecompoprix: 'FORFAIT',
    naturepresta: 'TRAVAUX',
    libelleService: 'Nettoyage des locaux',
    agentgestion: 'DUPONT Jean',
    alertedate: 120,
    alertemt: 0.8,
    planpreventionactif: null,
    ...overrides,
  }
}

beforeEach(() => {
  findByCugCodes.mockReset().mockResolvedValue([{ nummarche: 'M0909311', id_fournisseur: 5 }])
  findByFournisseurIds.mockReset().mockResolvedValue([])
  findByNummarche.mockReset().mockResolvedValue(EXISTING_MARCHE)
  updateManagedFields.mockReset().mockResolvedValue({ nummarche: NUMMARCHE })
  findAllCug.mockReset().mockResolvedValue([{ code_cug: '268', libelle_cug: 'Fournitures', id_service: ID_SERVICE, actif: true }])
  findByCodeCug.mockReset().mockResolvedValue({ code_cug: '268', libelle_cug: 'Fournitures', id_service: ID_SERVICE, actif: true })
  findAllFournisseur.mockReset().mockResolvedValue([{ id_fournisseur: 5, raison_sociale_service: 'NAID' }])
  findByIdFournisseur.mockReset().mockResolvedValue({
    id_fournisseur: 5,
    id_service: ID_SERVICE,
    raison_sociale_service: 'NAID',
    etatfournisseur: 'Actif',
  })
  findAllByServiceActeur.mockReset().mockResolvedValue([{ matricule: '12520', nom: 'DUPONT', prenom: 'Jean', fonction: 'Agent', id_cellule: 1 }])
  findIdServiceByMatricule.mockReset()
  findActiveByMatricule.mockReset().mockResolvedValue([])
  assertManagesServiceOrHasRoleCb.mockReset().mockResolvedValue(undefined)
  findLastImportRow.mockReset().mockResolvedValue({ exists: true, valeur: '2026-08-10' })
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
    expect(findByFournisseurIds).toHaveBeenCalledWith([5])
    expect(result).toEqual([{ nummarche: 'M0909311', id_fournisseur: 5, fournisseur_raison_sociale: 'NAID' }])
  })

  it('marché créé manuellement sans CUG (CODE_CUG null) : reste visible via son fournisseur, pas de doublon si aussi trouvé par CUG', async () => {
    findActiveByMatricule.mockResolvedValue([{ type_role: 'ADMIN_APP', id_service: null, id_cellule: null, id_direction: null, id_role: 1 }])
    findByCugCodes.mockResolvedValue([{ nummarche: 'M0909311', id_fournisseur: 5, code_cug: '268' }])
    findByFournisseurIds.mockResolvedValue([
      { nummarche: 'M0909311', id_fournisseur: 5, code_cug: '268' }, // même marché, trouvé par les deux voies
      { nummarche: 'M_SANS_CUG', id_fournisseur: 5, code_cug: null },
    ])

    const result = await listMarches(MATRICULE, ID_SERVICE)

    expect(result).toEqual([
      { nummarche: 'M0909311', id_fournisseur: 5, code_cug: '268', fournisseur_raison_sociale: 'NAID' },
      { nummarche: 'M_SANS_CUG', id_fournisseur: 5, code_cug: null, fournisseur_raison_sociale: 'NAID' },
    ])
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
    expect(findByFournisseurIds).toHaveBeenCalledWith([5])
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

describe('listMarcheOptions', () => {
  it("vérifie l'autorisation (ADMIN_APP/ADMIN_SERVICE/CB) avant de lire quoi que ce soit", async () => {
    assertManagesServiceOrHasRoleCb.mockRejectedValue(Object.assign(new Error('Droits insuffisants'), { status: 403 }))

    await expect(listMarcheOptions(MATRICULE, ID_SERVICE)).rejects.toMatchObject({ status: 403 })
    expect(findAllByServiceActeur).not.toHaveBeenCalled()
  })

  it('renvoie les acteurs du service, plus de CUG (01/09/2026 : CODE_CUG non modifiable via « Modifier »)', async () => {
    const result = await listMarcheOptions(MATRICULE, ID_SERVICE)

    expect(assertManagesServiceOrHasRoleCb).toHaveBeenCalledWith(MATRICULE, ID_SERVICE)
    expect(findAllCug).not.toHaveBeenCalled()
    expect(result).toEqual({
      acteurs: [{ matricule: '12520', nom: 'DUPONT', prenom: 'Jean' }],
    })
  })
})

describe('updateMarcheManagedFields', () => {
  it('rejette si le marché est introuvable (404)', async () => {
    findByNummarche.mockResolvedValue(null)

    await expect(updateMarcheManagedFields(MATRICULE, NUMMARCHE, validUpdateInput())).rejects.toMatchObject({ status: 404 })
    expect(updateManagedFields).not.toHaveBeenCalled()
  })

  it('résout le service du marché via son CUG puis vérifie les droits (ADMIN_APP/ADMIN_SERVICE/CB)', async () => {
    assertManagesServiceOrHasRoleCb.mockRejectedValue(Object.assign(new Error('Droits insuffisants'), { status: 403 }))

    await expect(updateMarcheManagedFields(MATRICULE, NUMMARCHE, validUpdateInput())).rejects.toMatchObject({ status: 403 })

    expect(findByCodeCug).toHaveBeenCalledWith('268')
    expect(assertManagesServiceOrHasRoleCb).toHaveBeenCalledWith(MATRICULE, ID_SERVICE)
    expect(updateManagedFields).not.toHaveBeenCalled()
  })

  it("résout le service via le fournisseur si le marché n'a pas de CUG (héritage création manuelle retirée)", async () => {
    findByNummarche.mockResolvedValue({ nummarche: NUMMARCHE, code_cug: null, id_fournisseur: 5 })

    await updateMarcheManagedFields(MATRICULE, NUMMARCHE, validUpdateInput())

    expect(findByCodeCug).not.toHaveBeenCalled()
    expect(findByIdFournisseur).toHaveBeenCalledWith(5)
    expect(assertManagesServiceOrHasRoleCb).toHaveBeenCalledWith(MATRICULE, ID_SERVICE)
  })

  it('rejette une entrée invalide (400) — ex. TYPEDECOMPOPRIX hors énumération', async () => {
    await expect(
      updateMarcheManagedFields(MATRICULE, NUMMARCHE, validUpdateInput({ typedecompoprix: 'AUTRE' })),
    ).rejects.toMatchObject({ status: 400 })
    expect(updateManagedFields).not.toHaveBeenCalled()
  })

  it("ne transmet plus TYPEPROC en entrée (retiré le 01/09/2026, renseigné à l'import, jamais modifiable ensuite) : un TYPEPROC fourni est simplement ignoré, pas d'erreur", async () => {
    await expect(
      updateMarcheManagedFields(MATRICULE, NUMMARCHE, validUpdateInput({ typeproc: 'AUTRE' })),
    ).resolves.toBeDefined()
    expect(updateManagedFields).toHaveBeenCalledWith(NUMMARCHE, expect.not.objectContaining({ typeproc: expect.anything() }))
  })

  it('rejette un ALERTEMT hors [0,1] (ratio, pas un pourcentage)', async () => {
    await expect(updateMarcheManagedFields(MATRICULE, NUMMARCHE, validUpdateInput({ alertemt: 80 }))).rejects.toMatchObject({
      status: 400,
    })
  })

  it('délègue au repository exactement les sept champs modifiables, plus COMPLETUDE recalculée', async () => {
    await updateMarcheManagedFields(MATRICULE, NUMMARCHE, validUpdateInput({ libelleService: '  Nettoyage des locaux  ' }))

    expect(updateManagedFields).toHaveBeenCalledWith(NUMMARCHE, {
      typedecompoprix: 'FORFAIT',
      naturepresta: 'TRAVAUX',
      libelle_service: 'Nettoyage des locaux',
      agentgestion: 'DUPONT Jean',
      alertedate: 120,
      alertemt: 0.8,
      planpreventionactif: null,
      completude: true,
    })
  })

  it('COMPLETUDE=true si TYPEPROC/TYPEDECOMPOPRIX/NATUREPRESTA/LIBELLE_SERVICE/AGENTGESTION/ALERTEDATE/ALERTEMT sont tous renseignés (PLANPREVENTIONACTIF exclu)', async () => {
    await updateMarcheManagedFields(MATRICULE, NUMMARCHE, validUpdateInput({ planpreventionactif: null }))

    expect(updateManagedFields).toHaveBeenCalledWith(NUMMARCHE, expect.objectContaining({ completude: true }))
  })

  it('COMPLETUDE=false si un seul des sept champs déterminants manque (ex. AGENTGESTION)', async () => {
    await updateMarcheManagedFields(MATRICULE, NUMMARCHE, validUpdateInput({ agentgestion: null }))

    expect(updateManagedFields).toHaveBeenCalledWith(NUMMARCHE, expect.objectContaining({ completude: false }))
  })

  it("COMPLETUDE=false si TYPEDECOMPOPRIX ou NATUREPRESTA manque", async () => {
    await updateMarcheManagedFields(MATRICULE, NUMMARCHE, validUpdateInput({ typedecompoprix: null }))
    expect(updateManagedFields).toHaveBeenCalledWith(NUMMARCHE, expect.objectContaining({ completude: false }))

    await updateMarcheManagedFields(MATRICULE, NUMMARCHE, validUpdateInput({ naturepresta: null }))
    expect(updateManagedFields).toHaveBeenCalledWith(NUMMARCHE, expect.objectContaining({ completude: false }))
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
    expect(result).toEqual({ exists: true, valeur: '2026-08-10' })
  })

  it("acteur non ADMIN_APP sans service propre : exists=false, ne lit rien", async () => {
    findIdServiceByMatricule.mockResolvedValue(null)

    const result = await getLastImportStatus(MATRICULE, undefined)

    expect(result).toEqual({ exists: false, valeur: null })
    expect(findLastImportRow).not.toHaveBeenCalled()
  })

  it("paramètre jamais initialisé pour ce service : exists=false, valeur=null", async () => {
    findIdServiceByMatricule.mockResolvedValue(ID_SERVICE)
    findLastImportRow.mockResolvedValue({ exists: false, valeur: null })

    const result = await getLastImportStatus(MATRICULE, ID_SERVICE)

    expect(result).toEqual({ exists: false, valeur: null })
  })
})
