import { describe, it, expect, vi, beforeEach } from 'vitest'

const findAll = vi.fn()
const findById = vi.fn()
const create = vi.fn()
const update = vi.fn()
const remove = vi.fn()

const findByFournisseurs = vi.fn()
const removeByFournisseur = vi.fn()

const serviceFindById = vi.fn()

const findIdServiceByMatricule = vi.fn()

const findActiveByMatricule = vi.fn()

const hasActiveRole = vi.fn()
const hasActiveRoleForService = vi.fn()

const marcheExistsForFournisseur = vi.fn()
const demandeAchatExistsForFournisseurRetenu = vi.fn()
const devisConsulteExistsForFournisseur = vi.fn()

vi.mock('../repositories/fournisseur.repository.js', () => ({
  findAll: (...args: unknown[]) => findAll(...args),
  findById: (...args: unknown[]) => findById(...args),
  create: (...args: unknown[]) => create(...args),
  update: (...args: unknown[]) => update(...args),
  remove: (...args: unknown[]) => remove(...args),
}))
vi.mock('../repositories/contact.repository.js', () => ({
  findByFournisseurs: (...args: unknown[]) => findByFournisseurs(...args),
  removeByFournisseur: (...args: unknown[]) => removeByFournisseur(...args),
}))
vi.mock('../repositories/service.repository.js', () => ({
  findById: (...args: unknown[]) => serviceFindById(...args),
}))
vi.mock('../repositories/acteur.repository.js', () => ({
  findIdServiceByMatricule: (...args: unknown[]) => findIdServiceByMatricule(...args),
}))
vi.mock('../repositories/roleAttribution.repository.js', () => ({
  findActiveByMatricule: (...args: unknown[]) => findActiveByMatricule(...args),
}))
vi.mock('../repositories/auth.repository.js', () => ({
  hasActiveRole: (...args: unknown[]) => hasActiveRole(...args),
  hasActiveRoleForService: (...args: unknown[]) => hasActiveRoleForService(...args),
}))
vi.mock('../repositories/marche.repository.js', () => ({
  existsForFournisseur: (...args: unknown[]) => marcheExistsForFournisseur(...args),
}))
vi.mock('../repositories/demandeAchat.repository.js', () => ({
  existsForFournisseurRetenu: (...args: unknown[]) => demandeAchatExistsForFournisseurRetenu(...args),
}))
vi.mock('../repositories/devisConsulte.repository.js', () => ({
  existsForFournisseur: (...args: unknown[]) => devisConsulteExistsForFournisseur(...args),
}))

const { listFournisseurs, createFournisseur, updateFournisseur, deleteFournisseur } = await import(
  '../services/fournisseur.service.js'
)

const MATRICULE = '12520'
const ID_SERVICE = 1

const FOURNISSEUR = {
  id_fournisseur: 1,
  id_service: ID_SERVICE,
  etatfournisseur: 'Actif' as const,
  raison_sociale_pgi: null,
  raison_sociale_service: 'Acme',
  siren: '732829320',
  numpgi: null,
  adr1: null,
  adr2: null,
  cp: null,
  ville: null,
  cedex: null,
  type_creation: 'SERVICE' as const,
}

beforeEach(() => {
  findAll.mockReset()
  findById.mockReset()
  create.mockReset()
  update.mockReset()
  remove.mockReset()
  findByFournisseurs.mockReset()
  removeByFournisseur.mockReset()
  serviceFindById.mockReset()
  findIdServiceByMatricule.mockReset()
  findActiveByMatricule.mockReset()
  hasActiveRole.mockReset()
  hasActiveRoleForService.mockReset()
  marcheExistsForFournisseur.mockReset()
  demandeAchatExistsForFournisseurRetenu.mockReset()
  devisConsulteExistsForFournisseur.mockReset()
})

describe('listFournisseurs', () => {
  it('rejette sans authentification (401)', async () => {
    await expect(listFournisseurs(null)).rejects.toMatchObject({ status: 401 })
  })

  it('ADMIN_APP voit tous les fournisseurs (transverse)', async () => {
    findActiveByMatricule.mockResolvedValue([{ type_role: 'ADMIN_APP', id_service: null, id_cellule: null, id_direction: null, id_role: 1 }])
    findAll.mockResolvedValue([FOURNISSEUR])
    findByFournisseurs.mockResolvedValue([])

    const result = await listFournisseurs(MATRICULE)

    expect(findAll).toHaveBeenCalledWith(undefined)
    expect(result).toEqual([
      {
        id_fournisseur: 1,
        id_service: ID_SERVICE,
        raison_sociale_pgi: null,
        raison_sociale_service: 'Acme',
        siren: '732829320',
        numpgi: null,
        adr1: null,
        adr2: null,
        cp: null,
        ville: null,
        cedex: null,
        type_creation: 'SERVICE',
        actif: true,
        contacts: [],
      },
    ])
  })

  it('ADMIN_APP peut filtrer par service explicitement', async () => {
    findActiveByMatricule.mockResolvedValue([{ type_role: 'ADMIN_APP', id_service: null, id_cellule: null, id_direction: null, id_role: 1 }])
    findAll.mockResolvedValue([])
    findByFournisseurs.mockResolvedValue([])

    await listFournisseurs(MATRICULE, 42)

    expect(findAll).toHaveBeenCalledWith(42)
  })

  it('ADMIN_SERVICE ne voit que son propre service (via son rôle)', async () => {
    findActiveByMatricule.mockResolvedValue([
      { type_role: 'ADMIN_SERVICE', id_service: ID_SERVICE, id_cellule: null, id_direction: null, id_role: 1 },
    ])
    findAll.mockResolvedValue([FOURNISSEUR])
    findByFournisseurs.mockResolvedValue([])

    await listFournisseurs(MATRICULE, 999) // un idService différent demandé, ignoré

    expect(findAll).toHaveBeenCalledWith(ID_SERVICE)
    expect(findIdServiceByMatricule).not.toHaveBeenCalled()
  })

  it("un acteur sans rôle particulier (Demandeur) ne voit que le service de son ACTEUR", async () => {
    findActiveByMatricule.mockResolvedValue([])
    findIdServiceByMatricule.mockResolvedValue(ID_SERVICE)
    findAll.mockResolvedValue([FOURNISSEUR])
    findByFournisseurs.mockResolvedValue([])

    await listFournisseurs(MATRICULE)

    expect(findIdServiceByMatricule).toHaveBeenCalledWith(MATRICULE)
    expect(findAll).toHaveBeenCalledWith(ID_SERVICE)
  })

  it("renvoie une liste vide si l'acteur n'est rattaché à aucun service", async () => {
    findActiveByMatricule.mockResolvedValue([])
    findIdServiceByMatricule.mockResolvedValue(null)

    const result = await listFournisseurs(MATRICULE)

    expect(result).toEqual([])
    expect(findAll).not.toHaveBeenCalled()
  })

  it('regroupe les contacts sous leur fournisseur', async () => {
    findActiveByMatricule.mockResolvedValue([{ type_role: 'ADMIN_APP', id_service: null, id_cellule: null, id_direction: null, id_role: 1 }])
    findAll.mockResolvedValue([FOURNISSEUR])
    findByFournisseurs.mockResolvedValue([
      { id_contact: 1, id_fournisseur: 1, nom: 'Dupont', prenom: null, mail: null, telfixe: null, telmobile: null, fonction: null, naturefonction: null },
    ])

    const result = await listFournisseurs(MATRICULE)

    expect(result[0].contacts).toHaveLength(1)
    expect(result[0].contacts[0].nom).toBe('Dupont')
  })
})

describe('createFournisseur', () => {
  it('rejette une entrée invalide (400)', async () => {
    await expect(createFournisseur(MATRICULE, { idService: ID_SERVICE, raisonSocialeService: '' })).rejects.toMatchObject({
      status: 400,
    })
    expect(create).not.toHaveBeenCalled()
  })

  it('rejette un SIREN manquant (400)', async () => {
    await expect(
      createFournisseur(MATRICULE, { idService: ID_SERVICE, raisonSocialeService: 'Acme' }),
    ).rejects.toMatchObject({ status: 400 })
    expect(create).not.toHaveBeenCalled()
  })

  it('rejette un SIREN dont la clé de contrôle est incorrecte (400)', async () => {
    await expect(
      createFournisseur(MATRICULE, { idService: ID_SERVICE, raisonSocialeService: 'Acme', siren: '123456789' }),
    ).rejects.toMatchObject({ status: 400 })
    expect(create).not.toHaveBeenCalled()
  })

  it("rejette un SIREN qui n'a pas 9 chiffres (400)", async () => {
    await expect(
      createFournisseur(MATRICULE, { idService: ID_SERVICE, raisonSocialeService: 'Acme', siren: '123' }),
    ).rejects.toMatchObject({ status: 400 })
    expect(create).not.toHaveBeenCalled()
  })

  it('accepte un SIREN valide saisi avec des espaces et le stocke normalisé', async () => {
    hasActiveRole.mockResolvedValue(true)
    serviceFindById.mockResolvedValue({ id_service: ID_SERVICE })
    create.mockResolvedValue(FOURNISSEUR)

    await createFournisseur(MATRICULE, {
      idService: ID_SERVICE,
      raisonSocialeService: 'Acme',
      siren: '732 829 320',
    })

    expect(create).toHaveBeenCalledWith(expect.objectContaining({ siren: '732829320' }))
  })

  it("rejette si l'utilisateur n'a ni ADMIN_APP ni ADMIN_SERVICE ni son propre service sur le service visé (403)", async () => {
    hasActiveRole.mockResolvedValue(false)
    hasActiveRoleForService.mockResolvedValue(false)
    findIdServiceByMatricule.mockResolvedValue(null)

    await expect(
      createFournisseur(MATRICULE, { idService: ID_SERVICE, raisonSocialeService: 'Acme', siren: '732829320' }),
    ).rejects.toMatchObject({ status: 403 })
    expect(create).not.toHaveBeenCalled()
  })

  it("rejette un Demandeur créant pour un service qui n'est pas le sien (403)", async () => {
    hasActiveRole.mockResolvedValue(false)
    hasActiveRoleForService.mockResolvedValue(false)
    findIdServiceByMatricule.mockResolvedValue(2) // rattaché au service 2, pas au service visé (1)

    await expect(
      createFournisseur(MATRICULE, { idService: ID_SERVICE, raisonSocialeService: 'Acme', siren: '732829320' }),
    ).rejects.toMatchObject({ status: 403 })
    expect(create).not.toHaveBeenCalled()
  })

  it('autorise un Demandeur (sans rôle) créant pour son propre service', async () => {
    hasActiveRole.mockResolvedValue(false)
    hasActiveRoleForService.mockResolvedValue(false)
    findIdServiceByMatricule.mockResolvedValue(ID_SERVICE)
    serviceFindById.mockResolvedValue({ id_service: ID_SERVICE })
    create.mockResolvedValue(FOURNISSEUR)

    await createFournisseur(MATRICULE, { idService: ID_SERVICE, raisonSocialeService: 'Acme', siren: '732829320' })

    expect(create).toHaveBeenCalled()
  })

  it('rejette si le service est introuvable (404)', async () => {
    hasActiveRole.mockResolvedValue(true)
    serviceFindById.mockResolvedValue(null)

    await expect(
      createFournisseur(MATRICULE, { idService: ID_SERVICE, raisonSocialeService: 'Acme', siren: '732829320' }),
    ).rejects.toMatchObject({ status: 404 })
    expect(create).not.toHaveBeenCalled()
  })

  it('crée avec type_creation=SERVICE et raison_sociale_pgi/numpgi à null', async () => {
    hasActiveRole.mockResolvedValue(true)
    serviceFindById.mockResolvedValue({ id_service: ID_SERVICE })
    create.mockResolvedValue(FOURNISSEUR)

    await createFournisseur(MATRICULE, { idService: ID_SERVICE, raisonSocialeService: 'Acme', siren: '732829320' })

    expect(create).toHaveBeenCalledWith(
      expect.objectContaining({
        id_service: ID_SERVICE,
        raison_sociale_service: 'Acme',
        raison_sociale_pgi: null,
        numpgi: null,
        type_creation: 'SERVICE',
        etatfournisseur: 'Actif',
      }),
    )
  })

  it('autorise ADMIN_SERVICE scopé au service visé', async () => {
    hasActiveRole.mockResolvedValue(false)
    hasActiveRoleForService.mockResolvedValue(true)
    serviceFindById.mockResolvedValue({ id_service: ID_SERVICE })
    create.mockResolvedValue(FOURNISSEUR)

    await createFournisseur(MATRICULE, { idService: ID_SERVICE, raisonSocialeService: 'Acme', siren: '732829320' })

    expect(hasActiveRoleForService).toHaveBeenCalledWith(MATRICULE, 'ADMIN_SERVICE', ID_SERVICE)
    expect(create).toHaveBeenCalled()
  })
})

describe('updateFournisseur', () => {
  it('rejette si le fournisseur est introuvable (404)', async () => {
    findById.mockResolvedValue(null)

    await expect(updateFournisseur(MATRICULE, 1, { raisonSocialeService: 'Nouveau', siren: '732829320' })).rejects.toMatchObject({
      status: 404,
    })
  })

  it('rejette sans droit sur le service du fournisseur (403)', async () => {
    findById.mockResolvedValue(FOURNISSEUR)
    hasActiveRole.mockResolvedValue(false)
    hasActiveRoleForService.mockResolvedValue(false)

    await expect(updateFournisseur(MATRICULE, 1, { raisonSocialeService: 'Nouveau', siren: '732829320' })).rejects.toMatchObject({
      status: 403,
    })
    expect(update).not.toHaveBeenCalled()
  })

  it('traduit actif en etatfournisseur (Actif/Inactif)', async () => {
    findById.mockResolvedValue(FOURNISSEUR)
    hasActiveRole.mockResolvedValue(true)
    update.mockResolvedValue({ ...FOURNISSEUR, etatfournisseur: 'Inactif' })
    findByFournisseurs.mockResolvedValue([])

    await updateFournisseur(MATRICULE, 1, { raisonSocialeService: 'Acme', siren: '732829320', actif: false })

    expect(update).toHaveBeenCalledWith(1, expect.objectContaining({ etatfournisseur: 'Inactif' }))
  })
})

describe('deleteFournisseur', () => {
  it('rejette si le fournisseur est introuvable (404)', async () => {
    findById.mockResolvedValue(null)

    await expect(deleteFournisseur(MATRICULE, 1)).rejects.toMatchObject({ status: 404 })
    expect(remove).not.toHaveBeenCalled()
  })

  it('rejette sans droit sur le service du fournisseur (403)', async () => {
    findById.mockResolvedValue(FOURNISSEUR)
    hasActiveRole.mockResolvedValue(false)
    hasActiveRoleForService.mockResolvedValue(false)

    await expect(deleteFournisseur(MATRICULE, 1)).rejects.toMatchObject({ status: 403 })
    expect(remove).not.toHaveBeenCalled()
  })

  it('rejette si un marché référence encore le fournisseur (409)', async () => {
    findById.mockResolvedValue(FOURNISSEUR)
    hasActiveRole.mockResolvedValue(true)
    marcheExistsForFournisseur.mockResolvedValue(true)
    demandeAchatExistsForFournisseurRetenu.mockResolvedValue(false)
    devisConsulteExistsForFournisseur.mockResolvedValue(false)

    await expect(deleteFournisseur(MATRICULE, 1)).rejects.toMatchObject({ status: 409 })
    expect(removeByFournisseur).not.toHaveBeenCalled()
    expect(remove).not.toHaveBeenCalled()
  })

  it("rejette si une demande d'achat retient encore ce fournisseur (409)", async () => {
    findById.mockResolvedValue(FOURNISSEUR)
    hasActiveRole.mockResolvedValue(true)
    marcheExistsForFournisseur.mockResolvedValue(false)
    demandeAchatExistsForFournisseurRetenu.mockResolvedValue(true)
    devisConsulteExistsForFournisseur.mockResolvedValue(false)

    await expect(deleteFournisseur(MATRICULE, 1)).rejects.toMatchObject({ status: 409 })
    expect(remove).not.toHaveBeenCalled()
  })

  it('rejette si un devis consulté (même non retenu) référence encore ce fournisseur (409)', async () => {
    findById.mockResolvedValue(FOURNISSEUR)
    hasActiveRole.mockResolvedValue(true)
    marcheExistsForFournisseur.mockResolvedValue(false)
    demandeAchatExistsForFournisseurRetenu.mockResolvedValue(false)
    devisConsulteExistsForFournisseur.mockResolvedValue(true)

    await expect(deleteFournisseur(MATRICULE, 1)).rejects.toMatchObject({ status: 409 })
    expect(remove).not.toHaveBeenCalled()
  })

  it('supprime les contacts puis le fournisseur quand rien ne le référence', async () => {
    findById.mockResolvedValue(FOURNISSEUR)
    hasActiveRole.mockResolvedValue(true)
    marcheExistsForFournisseur.mockResolvedValue(false)
    demandeAchatExistsForFournisseurRetenu.mockResolvedValue(false)
    devisConsulteExistsForFournisseur.mockResolvedValue(false)
    removeByFournisseur.mockResolvedValue(undefined)
    remove.mockResolvedValue(undefined)

    await deleteFournisseur(MATRICULE, 1)

    expect(removeByFournisseur).toHaveBeenCalledWith(1)
    expect(remove).toHaveBeenCalledWith(1)
  })
})
