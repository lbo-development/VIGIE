import { describe, it, expect, vi, beforeEach } from 'vitest'
import request from 'supertest'

/**
 * Test d'intégration bout-en-bout des pièces d'investissement : routes → requireAuth → multer
 * (vrai parsing multipart) → controller → service → repository — même principe que
 * marchePiece.routes.test.ts.
 */

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

const findIdServiceByMatricule = vi.fn()
vi.mock('../repositories/acteur.repository.js', () => ({
  findIdServiceByMatricule: (...args: unknown[]) => findIdServiceByMatricule(...args),
}))

const findActiveByMatricule = vi.fn()
vi.mock('../repositories/roleAttribution.repository.js', () => ({
  findActiveByMatricule: (...args: unknown[]) => findActiveByMatricule(...args),
}))

const findByNumeroOperation = vi.fn()
vi.mock('../repositories/investissement.repository.js', () => ({
  findByNumeroOperation: (...args: unknown[]) => findByNumeroOperation(...args),
}))

const findAllByOperation = vi.fn()
const findById = vi.fn()
const create = vi.fn()
const remove = vi.fn()
const uploadFile = vi.fn()
const downloadFile = vi.fn()
const removeFile = vi.fn()
vi.mock('../repositories/investissementPiece.repository.js', () => ({
  findAllByOperation: (...args: unknown[]) => findAllByOperation(...args),
  findById: (...args: unknown[]) => findById(...args),
  create: (...args: unknown[]) => create(...args),
  updateMetadata: vi.fn(),
  remove: (...args: unknown[]) => remove(...args),
  uploadFile: (...args: unknown[]) => uploadFile(...args),
  downloadFile: (...args: unknown[]) => downloadFile(...args),
  removeFile: (...args: unknown[]) => removeFile(...args),
}))

const { app } = await import('../app.js')

const MATRICULE = '12520'
const ID_SERVICE = 1
const NUMERO_OPERATION = 'IN025393'
const OPERATION = { numero_operation: NUMERO_OPERATION, id_service: ID_SERVICE }
const PDF_BUFFER = Buffer.concat([Buffer.from('%PDF-1.4\n'), Buffer.alloc(20, 'a')])

const PIECE = {
  id_investissement_piece: 1,
  numero_operation: NUMERO_OPERATION,
  id_service: ID_SERVICE,
  type_piece: 'RAPPORT_CODIR' as const,
  numero_reevaluation: 0,
  nom_fichier_original: 'rapport-codir.pdf',
  storage_path: `${NUMERO_OPERATION}/uuid.pdf`,
  taille_octets: PDF_BUFFER.length,
  matricule_depot: MATRICULE,
  created_at: '2026-09-04T10:00:00.000Z',
  updated_at: '2026-09-04T10:00:00.000Z',
}

function authed() {
  return { Authorization: 'Bearer test-token' }
}

beforeEach(() => {
  getUser.mockReset().mockResolvedValue({ data: { user: { id: 'user-1', email: 'a@b.fr' } }, error: null })
  findMatriculeByUserId.mockReset().mockResolvedValue(MATRICULE)
  hasActiveRole.mockReset().mockResolvedValue(false)
  hasActiveRoleForService.mockReset().mockImplementation(async (_m: string, role: string) => role === 'ADMIN_SERVICE')
  findIdServiceByMatricule.mockReset().mockResolvedValue(ID_SERVICE)
  findActiveByMatricule.mockReset().mockResolvedValue([])

  findByNumeroOperation.mockReset().mockResolvedValue(OPERATION)

  findAllByOperation.mockReset().mockResolvedValue([PIECE])
  findById.mockReset().mockResolvedValue(PIECE)
  create.mockReset().mockResolvedValue(PIECE)
  remove.mockReset().mockResolvedValue(undefined)
  uploadFile.mockReset().mockResolvedValue(undefined)
  downloadFile.mockReset().mockResolvedValue(Buffer.from('contenu-pdf'))
  removeFile.mockReset().mockResolvedValue(undefined)
})

describe('POST /api/investissements/pieces (upload réel via multer)', () => {
  it('accepte un vrai multipart, upload le fichier en storage puis insère la ligne (201)', async () => {
    const res = await request(app)
      .post('/api/investissements/pieces')
      .set(authed())
      .field('numeroOperation', NUMERO_OPERATION)
      .field('typePiece', 'RAPPORT_CODIR')
      .field('numeroReevaluation', '0')
      .attach('fichier', PDF_BUFFER, 'rapport-codir-original.pdf')

    expect(res.status).toBe(201)
    expect(res.body).toMatchObject({ id_investissement_piece: 1, nom_fichier_original: 'rapport-codir.pdf' })

    expect(uploadFile).toHaveBeenCalledTimes(1)
    const [storagePath, uploadedBuffer] = uploadFile.mock.calls[0]
    expect(Buffer.isBuffer(uploadedBuffer)).toBe(true)
    expect(uploadedBuffer.equals(PDF_BUFFER)).toBe(true)
    expect(storagePath).toMatch(new RegExp(`^${NUMERO_OPERATION}/[0-9a-f-]+\\.pdf$`))

    expect(create).toHaveBeenCalledWith(
      expect.objectContaining({
        nom_fichier_original: 'rapport-codir-original.pdf',
        storage_path: storagePath,
        taille_octets: PDF_BUFFER.length,
        id_service: ID_SERVICE,
      }),
    )
  })

  it('rejette sans authentification (401), avant tout parsing multer', async () => {
    const res = await request(app)
      .post('/api/investissements/pieces')
      .field('numeroOperation', NUMERO_OPERATION)
      .field('typePiece', 'RAPPORT_CODIR')
      .field('numeroReevaluation', '0')
      .attach('fichier', PDF_BUFFER, 'rapport-codir.pdf')

    expect(res.status).toBe(401)
    expect(uploadFile).not.toHaveBeenCalled()
  })

  it('rejette un acteur sans droit de dépôt (403), avant tout upload en storage', async () => {
    hasActiveRoleForService.mockResolvedValue(false)

    const res = await request(app)
      .post('/api/investissements/pieces')
      .set(authed())
      .field('numeroOperation', NUMERO_OPERATION)
      .field('typePiece', 'RAPPORT_CODIR')
      .field('numeroReevaluation', '0')
      .attach('fichier', PDF_BUFFER, 'rapport-codir.pdf')

    expect(res.status).toBe(403)
    expect(uploadFile).not.toHaveBeenCalled()
  })

  it("rejette un fichier dont le contenu réel (pas seulement le nom) n'est pas un PDF", async () => {
    const res = await request(app)
      .post('/api/investissements/pieces')
      .set(authed())
      .field('numeroOperation', NUMERO_OPERATION)
      .field('typePiece', 'RAPPORT_CODIR')
      .field('numeroReevaluation', '0')
      .attach('fichier', Buffer.from('pas un pdf'), 'faux.pdf')

    expect(res.status).toBe(400)
    expect(uploadFile).not.toHaveBeenCalled()
  })

  it("répond 400 si aucun fichier n'est joint", async () => {
    const res = await request(app)
      .post('/api/investissements/pieces')
      .set(authed())
      .field('numeroOperation', NUMERO_OPERATION)
      .field('typePiece', 'RAPPORT_CODIR')
      .field('numeroReevaluation', '0')

    expect(res.status).toBe(400)
  })
})

describe('GET /api/investissements/pieces (liste)', () => {
  it("renvoie la liste des pièces de l'opération (200)", async () => {
    const res = await request(app).get(`/api/investissements/pieces?numeroOperation=${NUMERO_OPERATION}`).set(authed())

    expect(res.status).toBe(200)
    expect(res.body).toEqual([PIECE])
  })

  it('répond 400 si numeroOperation est absent', async () => {
    const res = await request(app).get('/api/investissements/pieces').set(authed())
    expect(res.status).toBe(400)
  })
})

describe('GET /api/investissements/pieces/:id/download (téléchargement réel)', () => {
  it('renvoie le contenu du fichier avec les bons en-têtes', async () => {
    const res = await request(app).get('/api/investissements/pieces/1/download').set(authed())

    expect(res.status).toBe(200)
    expect(res.headers['content-type']).toBe('application/pdf')
    expect(res.headers['content-disposition']).toBe(`attachment; filename="${encodeURIComponent('rapport-codir.pdf')}"`)
    expect(Buffer.isBuffer(res.body) ? res.body : Buffer.from(res.text)).toEqual(Buffer.from('contenu-pdf'))
  })

  it('pièce introuvable -> 404', async () => {
    findById.mockResolvedValue(null)
    const res = await request(app).get('/api/investissements/pieces/999/download').set(authed())
    expect(res.status).toBe(404)
  })
})

describe('DELETE /api/investissements/pieces/:id (suppression best-effort)', () => {
  it('supprime la ligne puis le fichier, répond 204', async () => {
    const res = await request(app).delete('/api/investissements/pieces/1').set(authed())

    expect(res.status).toBe(204)
    expect(remove).toHaveBeenCalledWith(1)
    expect(removeFile).toHaveBeenCalledWith(PIECE.storage_path)
  })

  it('répond quand même 204 si la suppression du fichier en storage échoue (best-effort)', async () => {
    removeFile.mockRejectedValue(new Error('storage down'))

    const res = await request(app).delete('/api/investissements/pieces/1').set(authed())

    expect(res.status).toBe(204)
    expect(remove).toHaveBeenCalledWith(1)
  })

  it("rejette un acteur sans droit de suppression (403), la ligne n'est pas supprimée", async () => {
    hasActiveRoleForService.mockResolvedValue(false)

    const res = await request(app).delete('/api/investissements/pieces/1').set(authed())

    expect(res.status).toBe(403)
    expect(remove).not.toHaveBeenCalled()
  })
})
