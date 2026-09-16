import { describe, it, expect, vi, beforeEach } from 'vitest'

const findById = vi.fn()
const findByRole = vi.fn()
const findOverlapping = vi.fn()
const create = vi.fn()

vi.mock('../repositories/suppleance.repository.js', () => ({
  findById: (...args: unknown[]) => findById(...args),
  findByRole: (...args: unknown[]) => findByRole(...args),
  findOverlapping: (...args: unknown[]) => findOverlapping(...args),
  create: (...args: unknown[]) => create(...args),
}))

const findRoleById = vi.fn()
const findActiveByMatricule = vi.fn()
vi.mock('../repositories/roleAttribution.repository.js', () => ({
  findById: (...args: unknown[]) => findRoleById(...args),
  findActiveByMatricule: (...args: unknown[]) => findActiveByMatricule(...args),
}))

const findByMatricule = vi.fn()
vi.mock('../repositories/acteur.repository.js', () => ({
  findByMatricule: (...args: unknown[]) => findByMatricule(...args),
}))

const { createSuppleance, listSuppleancesByRole } = await import('../services/suppleance.service.js')

const TITULAIRE = '10001'
const SUPPLEANT = '10002'
const AUTRE = '10003'
const ID_ROLE = 42

const ROLE_RC_ACTIF = { id_role: ID_ROLE, matricule: TITULAIRE, type_role: 'RC', id_cellule: 7, id_service: null, id_direction: null, date_debut: '2026-01-01', date_fin: null, actif: true }

const INPUT_VALIDE = { idRole: ID_ROLE, matriculeSuppleant: SUPPLEANT, dateDebut: '2026-09-20', dateFin: '2026-09-25' }

beforeEach(() => {
  findById.mockReset()
  findByRole.mockReset()
  findOverlapping.mockReset().mockResolvedValue(null)
  create.mockReset()
  findRoleById.mockReset().mockResolvedValue(ROLE_RC_ACTIF)
  findActiveByMatricule.mockReset().mockResolvedValue([{ type_role: 'RC' }])
  findByMatricule.mockReset().mockResolvedValue({ matricule: SUPPLEANT, nom: 'DUPONT', prenom: 'Jean' })
})

describe('createSuppleance', () => {
  it('rejette sans authentification (401)', async () => {
    await expect(createSuppleance(null, INPUT_VALIDE)).rejects.toMatchObject({ status: 401 })
  })

  it('rejette une entrée invalide (400)', async () => {
    await expect(createSuppleance(TITULAIRE, { ...INPUT_VALIDE, dateFin: '2026-09-10' })).rejects.toMatchObject({ status: 400 })
  })

  it('rejette si le rôle est introuvable (404)', async () => {
    findRoleById.mockResolvedValue(null)
    await expect(createSuppleance(TITULAIRE, INPUT_VALIDE)).rejects.toMatchObject({ status: 404 })
  })

  it('rejette si le rôle n\'est plus actif (409)', async () => {
    findRoleById.mockResolvedValue({ ...ROLE_RC_ACTIF, actif: false })
    await expect(createSuppleance(TITULAIRE, INPUT_VALIDE)).rejects.toMatchObject({ status: 409 })
  })

  it.each(['CB', 'ADMIN_SERVICE', 'ADMIN_APP'])('rejette un rôle %s, non éligible à la suppléance (400)', async (typeRole) => {
    findRoleById.mockResolvedValue({ ...ROLE_RC_ACTIF, type_role: typeRole, matricule: TITULAIRE })
    await expect(createSuppleance(TITULAIRE, INPUT_VALIDE)).rejects.toMatchObject({ status: 400 })
  })

  it('rejette si l\'appelant n\'est pas le titulaire du rôle (403) — bloque aussi la suppléance en chaîne', async () => {
    await expect(createSuppleance(AUTRE, INPUT_VALIDE)).rejects.toMatchObject({ status: 403 })
  })

  it('rejette si le suppléant désigné est le titulaire lui-même (400)', async () => {
    await expect(createSuppleance(TITULAIRE, { ...INPUT_VALIDE, matriculeSuppleant: TITULAIRE })).rejects.toMatchObject({ status: 400 })
  })

  it('rejette si l\'acteur suppléant est introuvable (404)', async () => {
    findByMatricule.mockResolvedValue(null)
    await expect(createSuppleance(TITULAIRE, INPUT_VALIDE)).rejects.toMatchObject({ status: 404 })
  })

  it('rejette si le suppléant ne détient aucun rôle actif de même type (409)', async () => {
    findActiveByMatricule.mockResolvedValue([{ type_role: 'CDS' }])
    await expect(createSuppleance(TITULAIRE, INPUT_VALIDE)).rejects.toMatchObject({ status: 409 })
  })

  it('rejette une période chevauchante (409)', async () => {
    findOverlapping.mockResolvedValue({ id_suppleance: 1, id_role: ID_ROLE, matricule_suppleant: SUPPLEANT, date_debut: '2026-09-18', date_fin: '2026-09-22' })
    await expect(createSuppleance(TITULAIRE, INPUT_VALIDE)).rejects.toMatchObject({ status: 409 })
  })

  it('crée la suppléance quand toutes les conditions sont réunies', async () => {
    create.mockResolvedValue({ id_suppleance: 5, id_role: ID_ROLE, matricule_suppleant: SUPPLEANT, date_debut: '2026-09-20', date_fin: '2026-09-25' })

    const result = await createSuppleance(TITULAIRE, INPUT_VALIDE)

    expect(create).toHaveBeenCalledWith({
      id_role: ID_ROLE,
      matricule_suppleant: SUPPLEANT,
      date_debut: '2026-09-20',
      date_fin: '2026-09-25',
    })
    expect(result).toEqual({ idSuppleance: 5, idRole: ID_ROLE, matriculeSuppleant: SUPPLEANT, dateDebut: '2026-09-20', dateFin: '2026-09-25' })
  })
})

describe('listSuppleancesByRole', () => {
  it('rejette sans authentification (401)', async () => {
    await expect(listSuppleancesByRole(null, ID_ROLE)).rejects.toMatchObject({ status: 401 })
  })

  it('rejette si le rôle est introuvable (404)', async () => {
    findRoleById.mockResolvedValue(null)
    await expect(listSuppleancesByRole(TITULAIRE, ID_ROLE)).rejects.toMatchObject({ status: 404 })
  })

  it('rejette un appelant qui n\'est pas le titulaire (403)', async () => {
    await expect(listSuppleancesByRole(AUTRE, ID_ROLE)).rejects.toMatchObject({ status: 403 })
  })

  it('retourne la liste pour le titulaire', async () => {
    findByRole.mockResolvedValue([{ id_suppleance: 5, id_role: ID_ROLE, matricule_suppleant: SUPPLEANT, date_debut: '2026-09-20', date_fin: '2026-09-25' }])

    const result = await listSuppleancesByRole(TITULAIRE, ID_ROLE)

    expect(result).toEqual([{ idSuppleance: 5, idRole: ID_ROLE, matriculeSuppleant: SUPPLEANT, dateDebut: '2026-09-20', dateFin: '2026-09-25' }])
  })
})
