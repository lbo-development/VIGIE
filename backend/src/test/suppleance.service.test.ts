import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

const findById = vi.fn()
const findByRoles = vi.fn()
const findOverlapping = vi.fn()
const create = vi.fn()
const retire = vi.fn()
vi.mock('../repositories/suppleance.repository.js', () => ({
  findById: (...args: unknown[]) => findById(...args),
  findByRoles: (...args: unknown[]) => findByRoles(...args),
  findOverlapping: (...args: unknown[]) => findOverlapping(...args),
  create: (...args: unknown[]) => create(...args),
  retire: (...args: unknown[]) => retire(...args),
}))

const findBySuppleances = vi.fn()
vi.mock('../repositories/suppleanceAudit.repository.js', () => ({
  findBySuppleances: (...args: unknown[]) => findBySuppleances(...args),
}))

const findRoleById = vi.fn()
const findActiveByMatricule = vi.fn()
const resolvePerimeterLabel = vi.fn()
const findAllActive = vi.fn()
const findActiveByCellules = vi.fn()
const findActiveByService = vi.fn()
const findActiveForPerimeter = vi.fn()
vi.mock('../repositories/roleAttribution.repository.js', () => ({
  findById: (...args: unknown[]) => findRoleById(...args),
  findActiveByMatricule: (...args: unknown[]) => findActiveByMatricule(...args),
  resolvePerimeterLabel: (...args: unknown[]) => resolvePerimeterLabel(...args),
  findAllActive: (...args: unknown[]) => findAllActive(...args),
  findActiveByCellules: (...args: unknown[]) => findActiveByCellules(...args),
  findActiveByService: (...args: unknown[]) => findActiveByService(...args),
  findActiveForPerimeter: (...args: unknown[]) => findActiveForPerimeter(...args),
}))

const findByMatricule = vi.fn()
const findByMatricules = vi.fn()
const findAllByService = vi.fn()
const findAllByDirection = vi.fn()
vi.mock('../repositories/acteur.repository.js', () => ({
  findByMatricule: (...args: unknown[]) => findByMatricule(...args),
  findByMatricules: (...args: unknown[]) => findByMatricules(...args),
  findAllByService: (...args: unknown[]) => findAllByService(...args),
  findAllByDirection: (...args: unknown[]) => findAllByDirection(...args),
}))

const findCelluleById = vi.fn()
const findAllCellules = vi.fn()
vi.mock('../repositories/cellule.repository.js', () => ({
  findById: (...args: unknown[]) => findCelluleById(...args),
  findAll: (...args: unknown[]) => findAllCellules(...args),
}))

const findServiceById = vi.fn()
vi.mock('../repositories/service.repository.js', () => ({
  findById: (...args: unknown[]) => findServiceById(...args),
}))

const hasActiveRole = vi.fn()
vi.mock('../repositories/auth.repository.js', () => ({
  hasActiveRole: (...args: unknown[]) => hasActiveRole(...args),
}))

const assertManagesService = vi.fn()
vi.mock('../services/authorization.service.js', () => ({
  assertManagesService: (...args: unknown[]) => assertManagesService(...args),
}))

const { createSuppleance, retireSuppleance, listCandidats, listMesSuppleances, listSupervision } = await import('../services/suppleance.service.js')

const TITULAIRE = '100001'
const SUPPLEANT = '100002'
const AUTRE = '100003'
const ID_ROLE = 42

const acteur = (matricule: string, overrides: Record<string, unknown> = {}) => ({
  matricule, nom: `NOM${matricule}`, prenom: 'Jean', fonction: 'Agent', id_cellule: 7, actif: true, ...overrides,
})

const ROLE_RC_ACTIF = { id_role: ID_ROLE, matricule: TITULAIRE, type_role: 'RC', id_cellule: 7, id_service: null, id_direction: null, date_debut: '2026-01-01', date_fin: null, actif: true }
const ROLE_CDS_ACTIF = { ...ROLE_RC_ACTIF, type_role: 'CDS', id_cellule: null, id_service: 12 }
const ROLE_DS_ACTIF = { ...ROLE_RC_ACTIF, type_role: 'DS', id_cellule: null, id_direction: 3 }

const INPUT_VALIDE = { idRole: ID_ROLE, matriculeSuppleant: SUPPLEANT, dateDebut: '2026-09-20', dateFin: '2026-09-25' }
const LIGNE = { id_suppleance: 5, id_role: ID_ROLE, matricule_suppleant: SUPPLEANT, date_debut: '2026-09-20', date_fin: '2026-09-25', date_retrait: null }

beforeEach(() => {
  // « Aujourd'hui » = 20/09/2026 à Paris — figé pour les règles de non-rétroactivité et de statut.
  vi.useFakeTimers({ toFake: ['Date'] })
  vi.setSystemTime(new Date('2026-09-20T10:00:00Z'))

  for (const fn of [findById, findByRoles, findOverlapping, create, retire, findBySuppleances, findAllActive, findActiveByCellules, findActiveByService, findActiveForPerimeter, findAllCellules, findServiceById, assertManagesService]) {
    fn.mockReset()
  }
  findByRoles.mockResolvedValue([])
  findOverlapping.mockResolvedValue(null)
  findBySuppleances.mockResolvedValue([])
  findAllActive.mockResolvedValue([])
  findActiveByCellules.mockResolvedValue([])
  findActiveByService.mockResolvedValue([])
  findActiveForPerimeter.mockResolvedValue(null)
  findAllCellules.mockResolvedValue([])
  findRoleById.mockReset().mockResolvedValue(ROLE_RC_ACTIF)
  findActiveByMatricule.mockReset().mockResolvedValue([])
  resolvePerimeterLabel.mockReset().mockResolvedValue('Cellule Achats')
  findByMatricule.mockReset().mockResolvedValue(acteur(SUPPLEANT))
  findByMatricules.mockReset().mockResolvedValue([acteur(SUPPLEANT, { nom: 'DUPONT' })])
  // RC : cellule 7 → service 12, dont SUPPLEANT fait partie (aucun rôle applicatif requis).
  findCelluleById.mockReset().mockResolvedValue({ id_cellule: 7, id_service: 12 })
  findAllByService.mockReset().mockResolvedValue([acteur(TITULAIRE), acteur(SUPPLEANT)])
  findAllByDirection.mockReset().mockResolvedValue([acteur(TITULAIRE), acteur(SUPPLEANT)])
  hasActiveRole.mockReset().mockResolvedValue(false)
})

afterEach(() => {
  vi.useRealTimers()
})

describe('createSuppleance', () => {
  it('rejette sans authentification (401)', async () => {
    await expect(createSuppleance(null, INPUT_VALIDE)).rejects.toMatchObject({ status: 401 })
  })

  it('rejette une entrée invalide (400)', async () => {
    await expect(createSuppleance(TITULAIRE, { ...INPUT_VALIDE, dateFin: '2026-09-10' })).rejects.toMatchObject({ status: 400 })
  })

  it('rejette une suppléance rétroactive (400) — décision du 20/09/2026', async () => {
    await expect(createSuppleance(TITULAIRE, { ...INPUT_VALIDE, dateDebut: '2026-09-19' })).rejects.toMatchObject({ status: 400 })
    expect(create).not.toHaveBeenCalled()
  })

  it("accepte une suppléance qui commence aujourd'hui (heure de Paris)", async () => {
    create.mockResolvedValue(LIGNE)
    await expect(createSuppleance(TITULAIRE, INPUT_VALIDE)).resolves.toMatchObject({ idSuppleance: 5 })
  })

  it('rejette si le rôle est introuvable (404)', async () => {
    findRoleById.mockResolvedValue(null)
    await expect(createSuppleance(TITULAIRE, INPUT_VALIDE)).rejects.toMatchObject({ status: 404 })
  })

  it("rejette si le rôle n'est plus actif (409)", async () => {
    findRoleById.mockResolvedValue({ ...ROLE_RC_ACTIF, actif: false })
    await expect(createSuppleance(TITULAIRE, INPUT_VALIDE)).rejects.toMatchObject({ status: 409 })
  })

  it.each(['CB', 'ADMIN_SERVICE', 'ADMIN_APP'])('rejette un rôle %s, non éligible à la suppléance (400)', async (typeRole) => {
    findRoleById.mockResolvedValue({ ...ROLE_RC_ACTIF, type_role: typeRole, matricule: TITULAIRE })
    await expect(createSuppleance(TITULAIRE, INPUT_VALIDE)).rejects.toMatchObject({ status: 400 })
  })

  it("rejette si l'appelant n'est pas le titulaire du rôle (403) — bloque aussi la suppléance en chaîne et les admins", async () => {
    await expect(createSuppleance(AUTRE, INPUT_VALIDE)).rejects.toMatchObject({ status: 403 })
    expect(hasActiveRole).not.toHaveBeenCalled()
  })

  it('rejette si le suppléant désigné est le titulaire lui-même (400)', async () => {
    await expect(createSuppleance(TITULAIRE, { ...INPUT_VALIDE, matriculeSuppleant: TITULAIRE })).rejects.toMatchObject({ status: 400 })
  })

  it("rejette si l'acteur suppléant est introuvable (404)", async () => {
    findByMatricule.mockResolvedValue(null)
    await expect(createSuppleance(TITULAIRE, INPUT_VALIDE)).rejects.toMatchObject({ status: 404 })
  })

  it("rejette un suppléant inactif (409)", async () => {
    findByMatricule.mockResolvedValue(acteur(SUPPLEANT, { actif: false }))
    await expect(createSuppleance(TITULAIRE, INPUT_VALIDE)).rejects.toMatchObject({ status: 409 })
  })

  it('rejette un suppléant hors du service du titulaire (409)', async () => {
    findAllByService.mockResolvedValue([acteur(TITULAIRE)])
    await expect(createSuppleance(TITULAIRE, INPUT_VALIDE)).rejects.toMatchObject({ status: 409 })
  })

  it("n'exige plus de rôle applicatif chez le suppléant — un simple demandeur du service convient (20/09/2026)", async () => {
    create.mockResolvedValue(LIGNE)
    await createSuppleance(TITULAIRE, INPUT_VALIDE)
    expect(findActiveByMatricule).not.toHaveBeenCalled()
    expect(create).toHaveBeenCalled()
  })

  it('RC : le périmètre du suppléant est le service de la cellule du RC', async () => {
    create.mockResolvedValue(LIGNE)
    await createSuppleance(TITULAIRE, INPUT_VALIDE)
    expect(findCelluleById).toHaveBeenCalledWith(7)
    expect(findAllByService).toHaveBeenCalledWith(12)
  })

  it('CDS : le périmètre du suppléant est le service du CDS', async () => {
    findRoleById.mockResolvedValue(ROLE_CDS_ACTIF)
    create.mockResolvedValue(LIGNE)
    await createSuppleance(TITULAIRE, INPUT_VALIDE)
    expect(findAllByService).toHaveBeenCalledWith(12)
    expect(findCelluleById).not.toHaveBeenCalled()
  })

  it('DS : le périmètre du suppléant est la direction du DS', async () => {
    findRoleById.mockResolvedValue(ROLE_DS_ACTIF)
    create.mockResolvedValue(LIGNE)
    await createSuppleance(TITULAIRE, INPUT_VALIDE)
    expect(findAllByDirection).toHaveBeenCalledWith(3)
    expect(findAllByService).not.toHaveBeenCalled()
  })

  it('rejette une période chevauchante (409)', async () => {
    findOverlapping.mockResolvedValue({ ...LIGNE, date_debut: '2026-09-18', date_fin: '2026-09-22' })
    await expect(createSuppleance(TITULAIRE, INPUT_VALIDE)).rejects.toMatchObject({ status: 409 })
  })

  it("traduit la contrainte d'exclusion en base (accès concurrent) en 409", async () => {
    create.mockRejectedValue({ code: '23P01', message: 'conflicting key value violates exclusion constraint' })
    await expect(createSuppleance(TITULAIRE, INPUT_VALIDE)).rejects.toMatchObject({ status: 409 })
  })

  it('relance toute autre erreur base telle quelle (masquée en 500 par le gestionnaire global)', async () => {
    create.mockRejectedValue(new Error('boom'))
    await expect(createSuppleance(TITULAIRE, INPUT_VALIDE)).rejects.toThrow('boom')
  })

  it('crée la suppléance quand toutes les conditions sont réunies', async () => {
    create.mockResolvedValue(LIGNE)

    const result = await createSuppleance(TITULAIRE, INPUT_VALIDE)

    expect(create).toHaveBeenCalledWith({
      id_role: ID_ROLE,
      matricule_suppleant: SUPPLEANT,
      date_debut: '2026-09-20',
      date_fin: '2026-09-25',
    })
    expect(result).toMatchObject({
      idSuppleance: 5,
      idRole: ID_ROLE,
      typeRole: 'RC',
      matriculeSuppleant: SUPPLEANT,
      suppleantNomPrenom: 'Jean DUPONT',
      dateDebut: '2026-09-20',
      dateFin: '2026-09-25',
      dateRetrait: null,
      statut: 'EN_COURS',
    })
  })
})

describe('retireSuppleance', () => {
  beforeEach(() => {
    findById.mockResolvedValue(LIGNE)
    retire.mockResolvedValue({ ...LIGNE, date_retrait: '2026-09-20T10:00:00.000Z' })
  })

  it('rejette sans authentification (401)', async () => {
    await expect(retireSuppleance(null, 5)).rejects.toMatchObject({ status: 401 })
  })

  it('rejette une suppléance introuvable (404)', async () => {
    findById.mockResolvedValue(null)
    await expect(retireSuppleance(TITULAIRE, 5)).rejects.toMatchObject({ status: 404 })
  })

  it('rejette un appelant qui n\'est pas le titulaire du rôle (403) — pas même le suppléant', async () => {
    await expect(retireSuppleance(SUPPLEANT, 5)).rejects.toMatchObject({ status: 403 })
    await expect(retireSuppleance(AUTRE, 5)).rejects.toMatchObject({ status: 403 })
    expect(retire).not.toHaveBeenCalled()
  })

  it('rejette une suppléance déjà retirée (409)', async () => {
    findById.mockResolvedValue({ ...LIGNE, date_retrait: '2026-09-19T08:00:00.000Z' })
    await expect(retireSuppleance(TITULAIRE, 5)).rejects.toMatchObject({ status: 409 })
  })

  it('rejette une suppléance terminée (409)', async () => {
    findById.mockResolvedValue({ ...LIGNE, date_debut: '2026-09-10', date_fin: '2026-09-19' })
    await expect(retireSuppleance(TITULAIRE, 5)).rejects.toMatchObject({ status: 409 })
  })

  it("la suppléance qui se termine aujourd'hui est encore retirable (fin inclusive)", async () => {
    findById.mockResolvedValue({ ...LIGNE, date_debut: '2026-09-15', date_fin: '2026-09-20' })
    await expect(retireSuppleance(TITULAIRE, 5)).resolves.toMatchObject({ statut: 'RETIREE' })
  })

  it('retire une suppléance à venir', async () => {
    findById.mockResolvedValue({ ...LIGNE, date_debut: '2026-10-01', date_fin: '2026-10-05' })
    await retireSuppleance(TITULAIRE, 5)
    expect(retire).toHaveBeenCalledWith(5)
  })

  it('retire une suppléance en cours et la renvoie au statut RETIREE', async () => {
    const result = await retireSuppleance(TITULAIRE, 5)
    expect(retire).toHaveBeenCalledWith(5)
    expect(result).toMatchObject({ idSuppleance: 5, statut: 'RETIREE' })
  })
})

describe('listCandidats', () => {
  it('rejette sans authentification (401)', async () => {
    await expect(listCandidats(null, ID_ROLE)).rejects.toMatchObject({ status: 401 })
  })

  it("rejette un appelant qui n'est pas le titulaire (403)", async () => {
    await expect(listCandidats(AUTRE, ID_ROLE)).rejects.toMatchObject({ status: 403 })
  })

  it("rejette un rôle qui n'est plus actif (409)", async () => {
    findRoleById.mockResolvedValue({ ...ROLE_RC_ACTIF, actif: false })
    await expect(listCandidats(TITULAIRE, ID_ROLE)).rejects.toMatchObject({ status: 409 })
  })

  it('liste les acteurs actifs du service, titulaire et inactifs exclus', async () => {
    findAllByService.mockResolvedValue([acteur(TITULAIRE), acteur(SUPPLEANT), acteur('100004', { actif: false })])

    const result = await listCandidats(TITULAIRE, ID_ROLE)

    expect(result).toEqual([{ matricule: SUPPLEANT, nom: `NOM${SUPPLEANT}`, prenom: 'Jean', fonction: 'Agent' }])
  })
})

describe('listMesSuppleances', () => {
  it('rejette sans authentification (401)', async () => {
    await expect(listMesSuppleances(null)).rejects.toMatchObject({ status: 401 })
  })

  it("ne renvoie que les rôles RC/CDS/DS de l'appelant, jamais CB ni ADMIN_*", async () => {
    findActiveByMatricule.mockResolvedValue([ROLE_RC_ACTIF, { ...ROLE_RC_ACTIF, id_role: 43, type_role: 'CB' }, { ...ROLE_RC_ACTIF, id_role: 44, type_role: 'ADMIN_SERVICE' }])

    const result = await listMesSuppleances(TITULAIRE)

    expect(result.roles).toEqual([{ idRole: ID_ROLE, typeRole: 'RC', perimeterLabel: 'Cellule Achats' }])
    expect(findByRoles).toHaveBeenCalledWith([ID_ROLE])
  })

  it('calcule le statut de chaque suppléance : passée, en cours, à venir, retirée', async () => {
    findActiveByMatricule.mockResolvedValue([ROLE_RC_ACTIF])
    findByRoles.mockResolvedValue([
      { ...LIGNE, id_suppleance: 1, date_debut: '2026-10-01', date_fin: '2026-10-05' },
      { ...LIGNE, id_suppleance: 2, date_debut: '2026-09-18', date_fin: '2026-09-20' },
      { ...LIGNE, id_suppleance: 3, date_debut: '2026-09-01', date_fin: '2026-09-05' },
      { ...LIGNE, id_suppleance: 4, date_debut: '2026-09-18', date_fin: '2026-09-25', date_retrait: '2026-09-19T08:00:00.000Z' },
    ])

    const result = await listMesSuppleances(TITULAIRE)

    expect(result.suppleances.map((s) => [s.idSuppleance, s.statut])).toEqual([
      [1, 'A_VENIR'],
      [2, 'EN_COURS'],
      [3, 'TERMINEE'],
      [4, 'RETIREE'],
    ])
  })

  it("sans rôle suppléable, aucune requête sur les suppléances n'est utile", async () => {
    findActiveByMatricule.mockResolvedValue([{ ...ROLE_RC_ACTIF, type_role: 'CB' }])
    const result = await listMesSuppleances(TITULAIRE)
    expect(result).toEqual({ roles: [], suppleances: [] })
  })
})

describe('listSupervision', () => {
  const ROLE_ADMIN_SERVICE = { ...ROLE_RC_ACTIF, id_role: 90, matricule: AUTRE, type_role: 'ADMIN_SERVICE', id_cellule: null, id_service: 12 }

  it('rejette sans authentification (401)', async () => {
    await expect(listSupervision(null)).rejects.toMatchObject({ status: 401 })
  })

  it("rejette un acteur qui n'est ni ADMIN_APP ni ADMIN_SERVICE (403)", async () => {
    findActiveByMatricule.mockResolvedValue([ROLE_RC_ACTIF])
    await expect(listSupervision(TITULAIRE)).rejects.toMatchObject({ status: 403 })
  })

  it("ADMIN_SERVICE : lecture limitée à son service, via assertManagesService quand un service est demandé", async () => {
    assertManagesService.mockRejectedValue(Object.assign(new Error('Droits insuffisants'), { status: 403 }))
    await expect(listSupervision(AUTRE, 99)).rejects.toMatchObject({ status: 403 })
    expect(findByRoles).not.toHaveBeenCalled()
  })

  it('ADMIN_SERVICE : agrège les rôles RC, CDS et DS de son service, avec la piste d\'audit', async () => {
    findActiveByMatricule.mockResolvedValue([ROLE_ADMIN_SERVICE])
    findAllCellules.mockResolvedValue([{ id_cellule: 7, id_service: 12 }, { id_cellule: 8, id_service: 99 }])
    findActiveByCellules.mockResolvedValue([ROLE_RC_ACTIF])
    findActiveByService.mockResolvedValue([ROLE_CDS_ACTIF, ROLE_ADMIN_SERVICE])
    findServiceById.mockResolvedValue({ id_service: 12, id_direction: 3 })
    findActiveForPerimeter.mockResolvedValue(ROLE_DS_ACTIF)
    findByRoles.mockResolvedValue([LIGNE])
    findBySuppleances.mockResolvedValue([
      { id_audit: 1, id_suppleance: 5, action: 'CREATION', matricule_acteur: TITULAIRE, date_heure: '2026-09-20T09:00:00Z' },
    ])
    findByMatricules.mockResolvedValue([acteur(TITULAIRE, { nom: 'MARTIN', prenom: 'Anne' }), acteur(SUPPLEANT)])

    const result = await listSupervision(AUTRE)

    expect(findActiveByCellules).toHaveBeenCalledWith([7])
    expect(findActiveForPerimeter).toHaveBeenCalledWith('DS', { id_direction: 3 })
    // Les trois rôles (RC, CDS, DS) sont interrogés — ADMIN_SERVICE lui-même est exclu.
    expect(findByRoles).toHaveBeenCalledWith([ID_ROLE, ID_ROLE, ID_ROLE])
    expect(result[0].audit).toEqual([{ action: 'CREATION', matriculeActeur: TITULAIRE, acteurNomPrenom: 'Anne MARTIN', dateHeure: '2026-09-20T09:00:00Z' }])
  })

  it('ADMIN_APP sans service précisé : tous les rôles suppléables actifs', async () => {
    hasActiveRole.mockResolvedValue(true)
    findAllActive.mockResolvedValue([ROLE_RC_ACTIF, { ...ROLE_RC_ACTIF, id_role: 43, type_role: 'CB' }])

    await listSupervision(AUTRE)

    expect(findByRoles).toHaveBeenCalledWith([ID_ROLE])
    expect(assertManagesService).not.toHaveBeenCalled()
  })
})
