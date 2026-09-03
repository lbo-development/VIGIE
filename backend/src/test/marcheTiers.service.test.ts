import { describe, it, expect, vi, beforeEach } from 'vitest'

const findAll = vi.fn()
const findById = vi.fn()
const findByNummarche = vi.fn()
const create = vi.fn()
const update = vi.fn()
const remove = vi.fn()

const findByIdFournisseur = vi.fn()
const findIdServiceByMatricule = vi.fn()
const findActiveByMatricule = vi.fn()
const assertManagesServiceOrHasRoleCb = vi.fn()
const deriveTypeProc = vi.fn()
const existsForMarcheTiers = vi.fn()

vi.mock('../repositories/marcheTiers.repository.js', () => ({
  findAll: (...args: unknown[]) => findAll(...args),
  findById: (...args: unknown[]) => findById(...args),
  findByNummarche: (...args: unknown[]) => findByNummarche(...args),
  create: (...args: unknown[]) => create(...args),
  update: (...args: unknown[]) => update(...args),
  remove: (...args: unknown[]) => remove(...args),
}))
vi.mock('../repositories/fournisseur.repository.js', () => ({
  findById: (...args: unknown[]) => findByIdFournisseur(...args),
}))
vi.mock('../repositories/acteur.repository.js', () => ({
  findIdServiceByMatricule: (...args: unknown[]) => findIdServiceByMatricule(...args),
}))
vi.mock('../repositories/roleAttribution.repository.js', () => ({
  findActiveByMatricule: (...args: unknown[]) => findActiveByMatricule(...args),
}))
vi.mock('../repositories/demandeAchat.repository.js', () => ({
  existsForMarcheTiers: (...args: unknown[]) => existsForMarcheTiers(...args),
}))
vi.mock('../services/authorization.service.js', () => ({
  assertManagesServiceOrHasRoleCb: (...args: unknown[]) => assertManagesServiceOrHasRoleCb(...args),
}))
vi.mock('../services/marcheImport.service.js', () => ({
  deriveTypeProc: (...args: unknown[]) => deriveTypeProc(...args),
}))

const { listMarcheTiers, createMarcheTiers, updateMarcheTiers, deleteMarcheTiers } = await import(
  '../services/marcheTiers.service.js'
)

const MATRICULE = '12520'
const ID_SERVICE = 1

const MARCHE_TIERS = {
  id_marche_tiers: 1,
  id_service: ID_SERVICE,
  nummarche: 'M1234567',
  libelle_service: 'Nettoyage des locaux',
  id_fournisseur: 5,
  mtmaxi: 10000,
  dtedebut: '2026-01-01',
  dtefinmax: '2099-12-31',
  typeproc: 'MARCHE',
  typedecompoprix: 'FORFAIT',
  agentgestion: 'DUPONT Jean',
  alertedate: 120,
  actif: true,
}

/** Champs obligatoires à la création (décision du 02/09/2026) — voir marcheTiers.service.ts. */
function validCreateInput(overrides: Record<string, unknown> = {}) {
  return {
    idService: ID_SERVICE,
    nummarche: 'M1234567',
    libelleService: 'Nettoyage des locaux',
    idFournisseur: 5,
    mtmaxi: 10000,
    dtedebut: '2026-01-01',
    dtefinmax: '2099-12-31',
    typedecompoprix: 'FORFAIT',
    agentgestion: 'DUPONT Jean',
    ...overrides,
  }
}

/** Mêmes champs obligatoires qu'à la création (voir validCreateInput), sans nummarche/idService. */
function validUpdateInput(overrides: Record<string, unknown> = {}) {
  return {
    libelleService: 'Nettoyage des locaux',
    idFournisseur: 5,
    mtmaxi: 10000,
    dtedebut: '2026-01-01',
    dtefinmax: '2099-12-31',
    typedecompoprix: 'FORFAIT',
    agentgestion: 'DUPONT Jean',
    ...overrides,
  }
}

beforeEach(() => {
  findAll.mockReset().mockResolvedValue([MARCHE_TIERS])
  findById.mockReset().mockResolvedValue(MARCHE_TIERS)
  findByNummarche.mockReset().mockResolvedValue(null)
  create.mockReset().mockResolvedValue(MARCHE_TIERS)
  update.mockReset().mockResolvedValue(MARCHE_TIERS)
  remove.mockReset().mockResolvedValue(undefined)
  findByIdFournisseur.mockReset().mockResolvedValue({ id_fournisseur: 5, id_service: ID_SERVICE, etatfournisseur: 'Actif' })
  findIdServiceByMatricule.mockReset()
  findActiveByMatricule.mockReset().mockResolvedValue([])
  assertManagesServiceOrHasRoleCb.mockReset().mockResolvedValue(undefined)
  deriveTypeProc.mockReset().mockReturnValue('MARCHE')
  existsForMarcheTiers.mockReset().mockResolvedValue(false)
})

describe('listMarcheTiers', () => {
  it('rejette sans matricule (authentification requise)', async () => {
    await expect(listMarcheTiers(null, ID_SERVICE)).rejects.toMatchObject({ status: 401 })
  })

  it('ADMIN_APP : utilise l\'idService transmis (lecture ouverte, pas de 403)', async () => {
    findActiveByMatricule.mockResolvedValue([{ type_role: 'ADMIN_APP', id_service: null, id_cellule: null, id_direction: null, id_role: 1 }])

    const result = await listMarcheTiers(MATRICULE, ID_SERVICE)

    expect(findIdServiceByMatricule).not.toHaveBeenCalled()
    expect(findAll).toHaveBeenCalledWith(ID_SERVICE)
    expect(result).toEqual([MARCHE_TIERS])
  })

  it("ADMIN_APP sans idService transmis : renvoie une liste vide", async () => {
    findActiveByMatricule.mockResolvedValue([{ type_role: 'ADMIN_APP', id_service: null, id_cellule: null, id_direction: null, id_role: 1 }])

    const result = await listMarcheTiers(MATRICULE, undefined)

    expect(result).toEqual([])
    expect(findAll).not.toHaveBeenCalled()
  })

  it("acteur SANS rôle admin (simple Demandeur) : voit quand même son propre service (lecture ouverte, contrairement à CUG)", async () => {
    findActiveByMatricule.mockResolvedValue([])
    findIdServiceByMatricule.mockResolvedValue(ID_SERVICE)

    const result = await listMarcheTiers(MATRICULE, 999)

    expect(findIdServiceByMatricule).toHaveBeenCalledWith(MATRICULE)
    expect(findAll).toHaveBeenCalledWith(ID_SERVICE)
    expect(result).toEqual([MARCHE_TIERS])
  })

  it("acteur sans service propre : renvoie une liste vide", async () => {
    findIdServiceByMatricule.mockResolvedValue(null)

    const result = await listMarcheTiers(MATRICULE, undefined)

    expect(result).toEqual([])
    expect(findAll).not.toHaveBeenCalled()
  })
})

describe('createMarcheTiers', () => {
  it('rejette une entrée invalide (400)', async () => {
    await expect(createMarcheTiers(MATRICULE, validCreateInput({ nummarche: 'X123' }))).rejects.toMatchObject({ status: 400 })
    expect(create).not.toHaveBeenCalled()
  })

  it.each([
    ['idFournisseur (titulaire)', { idFournisseur: undefined }],
    ['libelleService trop court (< 15 caractères)', { libelleService: 'Court' }],
    ['typedecompoprix', { typedecompoprix: undefined }],
    ['agentgestion', { agentgestion: '' }],
    ['mtmaxi', { mtmaxi: undefined }],
    ['dtedebut', { dtedebut: '' }],
    ['dtefinmax', { dtefinmax: '' }],
  ])('rejette une entrée invalide (400) — %s manquant ou invalide', async (_label, overrides) => {
    await expect(createMarcheTiers(MATRICULE, validCreateInput(overrides))).rejects.toMatchObject({ status: 400 })
    expect(create).not.toHaveBeenCalled()
  })

  it("vérifie l'autorisation avant toute validation métier", async () => {
    assertManagesServiceOrHasRoleCb.mockRejectedValue(Object.assign(new Error('Droits insuffisants'), { status: 403 }))

    await expect(createMarcheTiers(MATRICULE, validCreateInput())).rejects.toMatchObject({ status: 403 })
    expect(create).not.toHaveBeenCalled()
  })

  it('rejette un numéro de marché dont le préfixe est non reconnu (400)', async () => {
    deriveTypeProc.mockReturnValue(null)

    await expect(createMarcheTiers(MATRICULE, validCreateInput())).rejects.toMatchObject({ status: 400 })
    expect(create).not.toHaveBeenCalled()
  })

  it("rejette si le fournisseur n'appartient pas au service cible", async () => {
    findByIdFournisseur.mockResolvedValue({ id_fournisseur: 5, id_service: 999, etatfournisseur: 'Actif' })

    await expect(createMarcheTiers(MATRICULE, validCreateInput())).rejects.toMatchObject({ status: 400 })
    expect(create).not.toHaveBeenCalled()
  })

  it('rejette si le même numéro existe déjà pour ce service (409)', async () => {
    findByNummarche.mockResolvedValue(MARCHE_TIERS)

    await expect(createMarcheTiers(MATRICULE, validCreateInput())).rejects.toMatchObject({ status: 409 })
    expect(create).not.toHaveBeenCalled()
  })

  it('crée le marché tiers avec TYPEPROC déduit du numéro et ACTIF=true', async () => {
    deriveTypeProc.mockReturnValue('MARCHE')

    await createMarcheTiers(MATRICULE, validCreateInput({ libelleService: 'Nettoyage des locaux' }))

    expect(create).toHaveBeenCalledWith(
      expect.objectContaining({
        id_service: ID_SERVICE,
        nummarche: 'M1234567',
        libelle_service: 'Nettoyage des locaux',
        id_fournisseur: 5,
        typeproc: 'MARCHE',
        alertedate: 120,
        actif: true,
      }),
    )
  })

  it('transmet le commentaire (null par défaut si absent)', async () => {
    await createMarcheTiers(MATRICULE, validCreateInput({ commentaire: 'Autorisation verbale du service X' }))
    expect(create).toHaveBeenCalledWith(expect.objectContaining({ commentaire: 'Autorisation verbale du service X' }))

    await createMarcheTiers(MATRICULE, validCreateInput())
    expect(create).toHaveBeenCalledWith(expect.objectContaining({ commentaire: null }))
  })

  it('ACTIF=false à la création si DTEFINMAX est déjà dépassée', async () => {
    const hier = new Date()
    hier.setDate(hier.getDate() - 1)

    await createMarcheTiers(MATRICULE, validCreateInput({ dtefinmax: hier.toISOString().slice(0, 10) }))

    expect(create).toHaveBeenCalledWith(expect.objectContaining({ actif: false }))
  })

  it('ACTIF=true à la création si DTEFINMAX n\'est pas dépassée', async () => {
    const demain = new Date()
    demain.setDate(demain.getDate() + 1)

    await createMarcheTiers(MATRICULE, validCreateInput({ dtefinmax: demain.toISOString().slice(0, 10) }))

    expect(create).toHaveBeenCalledWith(expect.objectContaining({ actif: true }))
  })
})

describe('updateMarcheTiers', () => {
  it('rejette si le marché tiers est introuvable (404)', async () => {
    findById.mockResolvedValue(null)

    await expect(updateMarcheTiers(MATRICULE, 1, validUpdateInput())).rejects.toMatchObject({ status: 404 })
    expect(update).not.toHaveBeenCalled()
  })

  it('rejette sans droit sur le service du marché tiers (403)', async () => {
    assertManagesServiceOrHasRoleCb.mockRejectedValue(Object.assign(new Error('Droits insuffisants'), { status: 403 }))

    await expect(updateMarcheTiers(MATRICULE, 1, validUpdateInput())).rejects.toMatchObject({ status: 403 })
    expect(update).not.toHaveBeenCalled()
  })

  it("rejette si le nouveau fournisseur n'appartient pas au service du marché tiers", async () => {
    findByIdFournisseur.mockResolvedValue({ id_fournisseur: 9, id_service: 999, etatfournisseur: 'Actif' })

    await expect(updateMarcheTiers(MATRICULE, 1, validUpdateInput({ idFournisseur: 9 }))).rejects.toMatchObject({ status: 400 })
    expect(update).not.toHaveBeenCalled()
  })

  it.each([
    ['libelleService', { libelleService: 'Court' }],
    ['idFournisseur', { idFournisseur: undefined }],
    ['mtmaxi', { mtmaxi: undefined }],
    ['dtedebut', { dtedebut: '' }],
    ['dtefinmax', { dtefinmax: '' }],
    ['typedecompoprix', { typedecompoprix: undefined }],
    ['agentgestion', { agentgestion: '' }],
  ])('rejette une entrée invalide (400) — %s manquant ou invalide', async (_label, overrides) => {
    await expect(updateMarcheTiers(MATRICULE, 1, validUpdateInput(overrides))).rejects.toMatchObject({ status: 400 })
    expect(update).not.toHaveBeenCalled()
  })

  it('autorise et délègue au repository (libellé, actif)', async () => {
    await updateMarcheTiers(MATRICULE, 1, validUpdateInput({ libelleService: 'Nettoyage des locaux modifié', actif: false }))

    expect(assertManagesServiceOrHasRoleCb).toHaveBeenCalledWith(MATRICULE, ID_SERVICE)
    expect(update).toHaveBeenCalledWith(1, expect.objectContaining({ libelle_service: 'Nettoyage des locaux modifié', actif: false }))
  })

  it('met à jour le commentaire', async () => {
    await updateMarcheTiers(MATRICULE, 1, validUpdateInput({ commentaire: 'Renouvelé pour 2027' }))

    expect(update).toHaveBeenCalledWith(1, expect.objectContaining({ commentaire: 'Renouvelé pour 2027' }))
  })

  it('ACTIF forcé à false si DTEFINMAX est déjà dépassée, quel que soit ACTIF soumis', async () => {
    const hier = new Date()
    hier.setDate(hier.getDate() - 1)

    await updateMarcheTiers(MATRICULE, 1, validUpdateInput({ dtefinmax: hier.toISOString().slice(0, 10), actif: true }))

    expect(update).toHaveBeenCalledWith(1, expect.objectContaining({ actif: false }))
  })

  it('ACTIF conserve la valeur soumise si DTEFINMAX n\'est pas dépassée', async () => {
    const demain = new Date()
    demain.setDate(demain.getDate() + 1)

    await updateMarcheTiers(MATRICULE, 1, validUpdateInput({ dtefinmax: demain.toISOString().slice(0, 10), actif: false }))

    expect(update).toHaveBeenCalledWith(1, expect.objectContaining({ actif: false }))
  })

  it("ACTIF conserve l'existant si non soumis et DTEFINMAX pas dépassée", async () => {
    findById.mockResolvedValue({ ...MARCHE_TIERS, actif: true })
    const demain = new Date()
    demain.setDate(demain.getDate() + 1)

    await updateMarcheTiers(MATRICULE, 1, validUpdateInput({ dtefinmax: demain.toISOString().slice(0, 10) }))

    expect(update).toHaveBeenCalledWith(1, expect.objectContaining({ actif: true }))
  })
})

describe('deleteMarcheTiers', () => {
  it('rejette si le marché tiers est introuvable (404)', async () => {
    findById.mockResolvedValue(null)

    await expect(deleteMarcheTiers(MATRICULE, 1)).rejects.toMatchObject({ status: 404 })
    expect(remove).not.toHaveBeenCalled()
  })

  it('rejette sans droit sur le service du marché tiers (403)', async () => {
    assertManagesServiceOrHasRoleCb.mockRejectedValue(Object.assign(new Error('Droits insuffisants'), { status: 403 }))

    await expect(deleteMarcheTiers(MATRICULE, 1)).rejects.toMatchObject({ status: 403 })
    expect(remove).not.toHaveBeenCalled()
  })

  it("vérifie l'autorisation avant de contrôler les demandes d'achat", async () => {
    assertManagesServiceOrHasRoleCb.mockRejectedValue(Object.assign(new Error('Droits insuffisants'), { status: 403 }))

    await expect(deleteMarcheTiers(MATRICULE, 1)).rejects.toMatchObject({ status: 403 })
    expect(existsForMarcheTiers).not.toHaveBeenCalled()
  })

  it("rejette si une demande d'achat référence encore ce marché tiers (409)", async () => {
    existsForMarcheTiers.mockResolvedValue(true)

    await expect(deleteMarcheTiers(MATRICULE, 1)).rejects.toMatchObject({ status: 409 })
    expect(remove).not.toHaveBeenCalled()
  })

  it('autorise (ADMIN_APP/ADMIN_SERVICE/CB, via assertManagesServiceOrHasRoleCb) et supprime si aucune DA ne le référence', async () => {
    existsForMarcheTiers.mockResolvedValue(false)

    await deleteMarcheTiers(MATRICULE, 1)

    expect(assertManagesServiceOrHasRoleCb).toHaveBeenCalledWith(MATRICULE, ID_SERVICE)
    expect(existsForMarcheTiers).toHaveBeenCalledWith(1)
    expect(remove).toHaveBeenCalledWith(1)
  })
})
