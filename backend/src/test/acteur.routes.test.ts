import { describe, it, expect, vi, beforeEach } from 'vitest'
import request from 'supertest'

/**
 * Test d'intégration bout-en-bout : routes → requireAuth (dont la
 * vérification ACTEUR.ACTIF, ajoutée le 10/09/2026) → requireRole('ADMIN_APP')
 * → controller → service → repository — même principe que
 * marchePiece.routes.test.ts. Seule la frontière Supabase est mockée.
 */

const getUser = vi.fn()
vi.mock('../config/supabaseClient.js', () => ({
  supabase: { auth: { getUser: (...args: unknown[]) => getUser(...args), admin: {} } },
}))

const findMatriculeByUserId = vi.fn()
const hasActiveRole = vi.fn()
const hasActiveRoleForService = vi.fn()
const findUserIdByMatricule = vi.fn()
const linkProfile = vi.fn()
const deleteProfile = vi.fn()
vi.mock('../repositories/auth.repository.js', () => ({
  findMatriculeByUserId: (...args: unknown[]) => findMatriculeByUserId(...args),
  hasActiveRole: (...args: unknown[]) => hasActiveRole(...args),
  hasActiveRoleForService: (...args: unknown[]) => hasActiveRoleForService(...args),
  findUserIdByMatricule: (...args: unknown[]) => findUserIdByMatricule(...args),
  linkProfile: (...args: unknown[]) => linkProfile(...args),
  deleteProfile: (...args: unknown[]) => deleteProfile(...args),
}))

const findByMatricule = vi.fn()
const findAll = vi.fn()
const create = vi.fn()
const update = vi.fn()
const remove = vi.fn()
const findIdServiceByMatricule = vi.fn()
const findAllByCellule = vi.fn()
const findAllByService = vi.fn()
vi.mock('../repositories/acteur.repository.js', () => ({
  findByMatricule: (...args: unknown[]) => findByMatricule(...args),
  findAll: (...args: unknown[]) => findAll(...args),
  create: (...args: unknown[]) => create(...args),
  update: (...args: unknown[]) => update(...args),
  remove: (...args: unknown[]) => remove(...args),
  findIdServiceByMatricule: (...args: unknown[]) => findIdServiceByMatricule(...args),
  findAllByCellule: (...args: unknown[]) => findAllByCellule(...args),
  findAllByService: (...args: unknown[]) => findAllByService(...args),
}))

const findCelluleById = vi.fn()
vi.mock('../repositories/cellule.repository.js', () => ({
  findById: (...args: unknown[]) => findCelluleById(...args),
}))

const createAuthUser = vi.fn()
const banAuthUser = vi.fn()
const unbanAuthUser = vi.fn()
const deleteAuthUser = vi.fn()
vi.mock('../repositories/authAdmin.repository.js', () => ({
  createAuthUser: (...args: unknown[]) => createAuthUser(...args),
  banAuthUser: (...args: unknown[]) => banAuthUser(...args),
  unbanAuthUser: (...args: unknown[]) => unbanAuthUser(...args),
  deleteAuthUser: (...args: unknown[]) => deleteAuthUser(...args),
}))

const findActiveByMatricule = vi.fn()
const existsForMatricule = vi.fn()
vi.mock('../repositories/roleAttribution.repository.js', () => ({
  findActiveByMatricule: (...args: unknown[]) => findActiveByMatricule(...args),
  existsForMatricule: (...args: unknown[]) => existsForMatricule(...args),
}))

vi.mock('../repositories/suppleance.repository.js', () => ({
  existsForMatriculeSuppleant: vi.fn().mockResolvedValue(false),
}))
vi.mock('../repositories/demandeAchat.repository.js', () => ({
  existsForMatriculeDemandeur: vi.fn().mockResolvedValue(false),
}))
vi.mock('../repositories/historiqueStatut.repository.js', () => ({
  existsForMatriculeActeur: vi.fn().mockResolvedValue(false),
}))

const { app } = await import('../app.js')

const MATRICULE = '12520'
const ID_CELLULE = 7
const ACTEUR = { matricule: MATRICULE, nom: 'DUPONT', prenom: 'Jean', fonction: 'Agent', id_cellule: ID_CELLULE, actif: true }

function authed() {
  return { Authorization: 'Bearer test-token' }
}

beforeEach(() => {
  getUser.mockReset().mockResolvedValue({ data: { user: { id: 'user-1', email: 'a@b.fr' } }, error: null })
  findMatriculeByUserId.mockReset().mockResolvedValue(MATRICULE)
  findByMatricule.mockReset().mockResolvedValue(ACTEUR)
  hasActiveRole.mockReset().mockResolvedValue(false)
  hasActiveRoleForService.mockReset().mockResolvedValue(false)
  findActiveByMatricule.mockReset().mockResolvedValue([])
  findAll.mockReset().mockResolvedValue([ACTEUR])
  findCelluleById.mockReset().mockResolvedValue({ id_cellule: ID_CELLULE, id_service: 1 })
  createAuthUser.mockReset().mockResolvedValue('auth-user-1')
  create.mockReset().mockResolvedValue(ACTEUR)
  existsForMatricule.mockReset().mockResolvedValue(false)
})

describe('GET /api/acteurs', () => {
  it('rejette sans token (401)', async () => {
    const res = await request(app).get('/api/acteurs')
    expect(res.status).toBe(401)
  })

  it("rejette un compte désactivé (ACTEUR.ACTIF=false) — traité comme non rattaché", async () => {
    findByMatricule.mockResolvedValue({ ...ACTEUR, actif: false })

    const res = await request(app).get('/api/acteurs').set(authed())

    expect(res.status).toBe(401)
  })

  it('ADMIN_APP sans filtre reçoit la liste complète (écran Utilisateurs)', async () => {
    hasActiveRole.mockResolvedValue(true)

    const res = await request(app).get('/api/acteurs').set(authed())

    expect(res.status).toBe(200)
    expect(findAll).toHaveBeenCalled()
    expect(res.body).toEqual([ACTEUR])
  })
})

describe('POST /api/acteurs', () => {
  const PAYLOAD = { matricule: '99999', nom: 'Martin', prenom: 'Alice', fonction: 'Agent', idCellule: ID_CELLULE, email: 'a@b.fr' }

  it('rejette (403) sans ADMIN_APP', async () => {
    hasActiveRole.mockResolvedValue(false)

    const res = await request(app).post('/api/acteurs').set(authed()).send(PAYLOAD)

    expect(res.status).toBe(403)
    expect(createAuthUser).not.toHaveBeenCalled()
  })

  it('crée l\'utilisateur et renvoie le mot de passe temporaire (201) pour ADMIN_APP', async () => {
    hasActiveRole.mockResolvedValue(true)
    findByMatricule.mockResolvedValueOnce(ACTEUR) // requireAuth (appelant)
    findByMatricule.mockResolvedValueOnce(null) // vérification matricule cible libre

    const res = await request(app).post('/api/acteurs').set(authed()).send(PAYLOAD)

    expect(res.status).toBe(201)
    expect(res.body.temporaryPassword).toBeTypeOf('string')
    expect(createAuthUser).toHaveBeenCalled()
  })
})

describe('PUT /api/acteurs/:matricule', () => {
  it('rejette (403) sans ADMIN_APP', async () => {
    hasActiveRole.mockResolvedValue(false)

    const res = await request(app).put(`/api/acteurs/${MATRICULE}`).set(authed()).send({ actif: false })

    expect(res.status).toBe(403)
    expect(update).not.toHaveBeenCalled()
  })

  it('désactive et bannit le compte pour ADMIN_APP', async () => {
    hasActiveRole.mockResolvedValue(true)
    findUserIdByMatricule.mockResolvedValue('auth-user-1')
    update.mockResolvedValue({ ...ACTEUR, actif: false })

    const res = await request(app).put(`/api/acteurs/${MATRICULE}`).set(authed()).send({ actif: false })

    expect(res.status).toBe(200)
    expect(banAuthUser).toHaveBeenCalledWith('auth-user-1')
  })
})

describe('DELETE /api/acteurs/:matricule', () => {
  it('rejette (403) sans ADMIN_APP', async () => {
    hasActiveRole.mockResolvedValue(false)

    const res = await request(app).delete(`/api/acteurs/${MATRICULE}`).set(authed())

    expect(res.status).toBe(403)
    expect(remove).not.toHaveBeenCalled()
  })

  it("rejette (409) si l'acteur est encore référencé", async () => {
    hasActiveRole.mockResolvedValue(true)
    existsForMatricule.mockResolvedValue(true)

    const res = await request(app).delete(`/api/acteurs/${MATRICULE}`).set(authed())

    expect(res.status).toBe(409)
    expect(remove).not.toHaveBeenCalled()
  })

  it('supprime (204) quand aucune référence et ADMIN_APP', async () => {
    hasActiveRole.mockResolvedValue(true)
    findUserIdByMatricule.mockResolvedValue('auth-user-1')

    const res = await request(app).delete(`/api/acteurs/${MATRICULE}`).set(authed())

    expect(res.status).toBe(204)
    expect(remove).toHaveBeenCalledWith(MATRICULE)
    expect(deleteAuthUser).toHaveBeenCalledWith('auth-user-1')
  })
})
