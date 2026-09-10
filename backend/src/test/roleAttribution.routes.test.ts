import { describe, it, expect, vi, beforeEach } from 'vitest'
import request from 'supertest'

/** Test d'intégration bout-en-bout : routes → requireAuth → service (permission variable selon TYPE_ROLE) → repository. */

const getUser = vi.fn()
vi.mock('../config/supabaseClient.js', () => ({
  supabase: { auth: { getUser: (...args: unknown[]) => getUser(...args) } },
}))

const findMatriculeByUserId = vi.fn()
const hasActiveRole = vi.fn()
const hasActiveRoleForService = vi.fn()
vi.mock('../repositories/auth.repository.js', () => ({
  findMatriculeByUserId: (...args: unknown[]) => findMatriculeByUserId(...args),
  hasActiveRole: (...args: unknown[]) => hasActiveRole(...args),
  hasActiveRoleForService: (...args: unknown[]) => hasActiveRoleForService(...args),
}))

const findByMatricule = vi.fn()
const findByMatricules = vi.fn()
vi.mock('../repositories/acteur.repository.js', () => ({
  findByMatricule: (...args: unknown[]) => findByMatricule(...args),
  findByMatricules: (...args: unknown[]) => findByMatricules(...args),
}))

const findCelluleById = vi.fn()
const findAllCellules = vi.fn()
vi.mock('../repositories/cellule.repository.js', () => ({
  findById: (...args: unknown[]) => findCelluleById(...args),
  findAll: (...args: unknown[]) => findAllCellules(...args),
}))
vi.mock('../repositories/service.repository.js', () => ({
  findById: vi.fn().mockResolvedValue({ id_service: 1 }),
}))
vi.mock('../repositories/direction.repository.js', () => ({
  findById: vi.fn().mockResolvedValue({ id_direction: 3 }),
}))

const findActiveByMatricule = vi.fn()
const findById = vi.fn()
const findActiveForPerimeter = vi.fn()
const findActiveByService = vi.fn()
const findActiveByCellules = vi.fn()
const findAllActive = vi.fn()
const create = vi.fn()
const deactivate = vi.fn()
const resolvePerimeterLabel = vi.fn()
vi.mock('../repositories/roleAttribution.repository.js', () => ({
  findActiveByMatricule: (...args: unknown[]) => findActiveByMatricule(...args),
  findById: (...args: unknown[]) => findById(...args),
  findActiveForPerimeter: (...args: unknown[]) => findActiveForPerimeter(...args),
  findActiveByService: (...args: unknown[]) => findActiveByService(...args),
  findActiveByCellules: (...args: unknown[]) => findActiveByCellules(...args),
  findAllActive: (...args: unknown[]) => findAllActive(...args),
  create: (...args: unknown[]) => create(...args),
  deactivate: (...args: unknown[]) => deactivate(...args),
  resolvePerimeterLabel: (...args: unknown[]) => resolvePerimeterLabel(...args),
}))

const { app } = await import('../app.js')

const MATRICULE = '12520'
const TARGET_MATRICULE = '99999'
const ID_SERVICE = 1
const ACTEUR = { matricule: MATRICULE, nom: 'DUPONT', prenom: 'Jean', fonction: 'Agent', id_cellule: 7, actif: true }
const TARGET = { matricule: TARGET_MATRICULE, nom: 'MARTIN', prenom: 'Alice', fonction: 'Agent', id_cellule: 7, actif: true }

function authed() {
  return { Authorization: 'Bearer test-token' }
}

beforeEach(() => {
  getUser.mockReset().mockResolvedValue({ data: { user: { id: 'user-1', email: 'a@b.fr' } }, error: null })
  findMatriculeByUserId.mockReset().mockResolvedValue(MATRICULE)
  findByMatricule.mockReset().mockImplementation(async (m: string) => (m === TARGET_MATRICULE ? TARGET : ACTEUR))
  findByMatricules.mockReset().mockResolvedValue([ACTEUR])
  hasActiveRole.mockReset().mockResolvedValue(false)
  hasActiveRoleForService.mockReset().mockResolvedValue(false)
  findActiveByMatricule.mockReset().mockResolvedValue([])
  findAllActive.mockReset().mockResolvedValue([])
  findActiveForPerimeter.mockReset().mockResolvedValue(null)
  resolvePerimeterLabel.mockReset().mockResolvedValue('Service X')
  findCelluleById.mockReset()
  findAllCellules.mockReset().mockResolvedValue([])
})

describe('GET /api/role-attributions', () => {
  it('rejette sans token (401)', async () => {
    const res = await request(app).get('/api/role-attributions')
    expect(res.status).toBe(401)
  })

  it('ADMIN_APP voit tout', async () => {
    hasActiveRole.mockResolvedValue(true)

    const res = await request(app).get('/api/role-attributions').set(authed())

    expect(res.status).toBe(200)
    expect(findAllActive).toHaveBeenCalled()
  })

  it('rejette (403) un appelant sans ADMIN_APP ni ADMIN_SERVICE', async () => {
    const res = await request(app).get('/api/role-attributions').set(authed())
    expect(res.status).toBe(403)
  })
})

describe('POST /api/role-attributions', () => {
  it('rejette (403) une attribution DS par un non-ADMIN_APP', async () => {
    hasActiveRole.mockResolvedValue(false)

    const res = await request(app)
      .post('/api/role-attributions')
      .set(authed())
      .send({ matricule: TARGET_MATRICULE, typeRole: 'DS', idDirection: 3 })

    expect(res.status).toBe(403)
    expect(create).not.toHaveBeenCalled()
  })

  it('ADMIN_SERVICE peut attribuer CDS sur son propre service (201)', async () => {
    hasActiveRole.mockResolvedValue(false)
    hasActiveRoleForService.mockImplementation(async (_m: string, role: string) => role === 'ADMIN_SERVICE')
    create.mockResolvedValue({
      id_role: 1,
      matricule: TARGET_MATRICULE,
      type_role: 'CDS',
      id_cellule: null,
      id_service: ID_SERVICE,
      id_direction: null,
      date_debut: '2026-09-10',
      date_fin: null,
      actif: true,
    })

    const res = await request(app)
      .post('/api/role-attributions')
      .set(authed())
      .send({ matricule: TARGET_MATRICULE, typeRole: 'CDS', idService: ID_SERVICE })

    expect(res.status).toBe(201)
    expect(create).toHaveBeenCalled()
  })
})

describe('PUT /api/role-attributions/:idRole/desactiver', () => {
  it('rejette (404) une attribution introuvable', async () => {
    findById.mockResolvedValue(null)

    const res = await request(app).put('/api/role-attributions/1/desactiver').set(authed()).send({})

    expect(res.status).toBe(404)
  })

  it('clôture (200) avec les droits ADMIN_APP', async () => {
    hasActiveRole.mockResolvedValue(true)
    findById.mockResolvedValue({
      id_role: 1,
      type_role: 'DS',
      id_cellule: null,
      id_service: null,
      id_direction: 3,
      actif: true,
    })
    deactivate.mockResolvedValue({
      id_role: 1,
      matricule: TARGET_MATRICULE,
      type_role: 'DS',
      id_cellule: null,
      id_service: null,
      id_direction: 3,
      date_debut: '2026-01-01',
      date_fin: '2026-09-10',
      actif: false,
    })

    const res = await request(app).put('/api/role-attributions/1/desactiver').set(authed()).send({})

    expect(res.status).toBe(200)
    expect(deactivate).toHaveBeenCalledWith(1)
  })
})
