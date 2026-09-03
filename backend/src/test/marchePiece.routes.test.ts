import { describe, it, expect, vi, beforeEach } from 'vitest'
import request from 'supertest'

/**
 * Test d'intégration bout-en-bout des pièces de marché : routes → requireAuth
 * → multer (vrai parsing multipart) → controller → service → repository.
 * Complète marchePiece.service.test.ts (unitaire, appelle le service
 * directement avec un objet fichier construit à la main) en exerçant la
 * couche que celui-ci ne peut pas atteindre : le vrai parsing multipart par
 * multer et le câblage HTTP réel (routes, status codes, en-têtes de
 * téléchargement).
 *
 * Seule la frontière Supabase (I/O réseau réel) est mockée, au niveau
 * repository — même principe que les autres tests de ce projet, jamais de
 * vrai appel Supabase en test.
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

const findByNummarche = vi.fn()
vi.mock('../repositories/marche.repository.js', () => ({
  findByNummarche: (...args: unknown[]) => findByNummarche(...args),
}))
vi.mock('../repositories/marcheTiers.repository.js', () => ({
  findById: vi.fn(),
}))
const findByCode = vi.fn()
vi.mock('../repositories/cug.repository.js', () => ({
  findByCode: (...args: unknown[]) => findByCode(...args),
}))
vi.mock('../repositories/fournisseur.repository.js', () => ({
  findById: vi.fn(),
}))

const findAllByService = vi.fn()
const findById = vi.fn()
const create = vi.fn()
const remove = vi.fn()
const uploadFile = vi.fn()
const downloadFile = vi.fn()
const removeFile = vi.fn()
vi.mock('../repositories/marchePiece.repository.js', () => ({
  findAllByService: (...args: unknown[]) => findAllByService(...args),
  findAllByTiers: vi.fn(),
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
const MARCHE = { nummarche: 'M1234567', code_cug: 'CUG01', id_fournisseur: null }
const PDF_BUFFER = Buffer.concat([Buffer.from('%PDF-1.4\n'), Buffer.alloc(20, 'a')])

const PIECE_SERVICE = {
  id_marche_piece: 1,
  type_marche: 'SERVICE' as const,
  nummarche: 'M1234567',
  id_marche_tiers: null,
  id_service: ID_SERVICE,
  type_piece: 'CCAP' as const,
  numero_avenant: 0,
  nom_fichier_original: 'ccap.pdf',
  storage_path: 'service/M1234567/uuid.pdf',
  taille_octets: PDF_BUFFER.length,
  matricule_depot: MATRICULE,
  created_at: '2026-09-02T10:00:00.000Z',
  updated_at: '2026-09-02T10:00:00.000Z',
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

  findByNummarche.mockReset().mockResolvedValue(MARCHE)
  findByCode.mockReset().mockResolvedValue({ code_cug: 'CUG01', id_service: ID_SERVICE })

  findAllByService.mockReset().mockResolvedValue([PIECE_SERVICE])
  findById.mockReset().mockResolvedValue(PIECE_SERVICE)
  create.mockReset().mockResolvedValue(PIECE_SERVICE)
  remove.mockReset().mockResolvedValue(undefined)
  uploadFile.mockReset().mockResolvedValue(undefined)
  downloadFile.mockReset().mockResolvedValue(Buffer.from('contenu-pdf'))
  removeFile.mockReset().mockResolvedValue(undefined)
})

describe('POST /api/marches/pieces (upload réel via multer)', () => {
  it('accepte un vrai multipart, upload le fichier en storage puis insère la ligne (201)', async () => {
    const res = await request(app)
      .post('/api/marches/pieces')
      .set(authed())
      .field('typeMarche', 'SERVICE')
      .field('nummarche', 'M1234567')
      .field('typePiece', 'CCAP')
      .field('numeroAvenant', '0')
      .attach('fichier', PDF_BUFFER, 'ccap-original.pdf')

    expect(res.status).toBe(201)
    expect(res.body).toMatchObject({ id_marche_piece: 1, nom_fichier_original: 'ccap.pdf' })

    // Le buffer reçu par le repository doit être le contenu réel envoyé par multer (pas un mock).
    expect(uploadFile).toHaveBeenCalledTimes(1)
    const [storagePath, uploadedBuffer] = uploadFile.mock.calls[0]
    expect(Buffer.isBuffer(uploadedBuffer)).toBe(true)
    expect(uploadedBuffer.equals(PDF_BUFFER)).toBe(true)
    expect(storagePath).toMatch(/^service\/M1234567\/[0-9a-f-]+\.pdf$/)

    expect(create).toHaveBeenCalledWith(
      expect.objectContaining({
        nom_fichier_original: 'ccap-original.pdf',
        storage_path: storagePath,
        taille_octets: PDF_BUFFER.length,
        id_service: ID_SERVICE,
      }),
    )
  })

  it('rejette sans authentification (401), avant tout parsing multer', async () => {
    const res = await request(app)
      .post('/api/marches/pieces')
      .field('typeMarche', 'SERVICE')
      .field('nummarche', 'M1234567')
      .field('typePiece', 'CCAP')
      .field('numeroAvenant', '0')
      .attach('fichier', PDF_BUFFER, 'ccap.pdf')

    expect(res.status).toBe(401)
    expect(uploadFile).not.toHaveBeenCalled()
  })

  it('rejette un acteur sans droit de dépôt (403), avant tout upload en storage', async () => {
    hasActiveRoleForService.mockResolvedValue(false)

    const res = await request(app)
      .post('/api/marches/pieces')
      .set(authed())
      .field('typeMarche', 'SERVICE')
      .field('nummarche', 'M1234567')
      .field('typePiece', 'CCAP')
      .field('numeroAvenant', '0')
      .attach('fichier', PDF_BUFFER, 'ccap.pdf')

    expect(res.status).toBe(403)
    expect(uploadFile).not.toHaveBeenCalled()
  })

  it('rejette un fichier dont le contenu réel (pas seulement le nom) n\'est pas un PDF', async () => {
    const res = await request(app)
      .post('/api/marches/pieces')
      .set(authed())
      .field('typeMarche', 'SERVICE')
      .field('nummarche', 'M1234567')
      .field('typePiece', 'CCAP')
      .field('numeroAvenant', '0')
      .attach('fichier', Buffer.from('pas un pdf'), 'faux.pdf')

    expect(res.status).toBe(400)
    expect(uploadFile).not.toHaveBeenCalled()
  })

  it('répond 400 si aucun fichier n\'est joint', async () => {
    const res = await request(app)
      .post('/api/marches/pieces')
      .set(authed())
      .field('typeMarche', 'SERVICE')
      .field('nummarche', 'M1234567')
      .field('typePiece', 'CCAP')
      .field('numeroAvenant', '0')

    expect(res.status).toBe(400)
  })

  it('un fichier dépassant la limite multer (10 Mo) ne produit pas une 400 propre mais une 500 générique', async () => {
    // Découverte de ce test d'intégration : la limite multer (routes.ts, `limits.fileSize`)
    // rejette AVANT le contrôleur avec un MulterError, jamais traduit en AppError — il tombe
    // dans le handler générique (errorHandler.ts) comme une erreur technique (500 "Erreur
    // interne du serveur"), alors que la même limite dépassée via un champ `taille_octets`
    // cohérent avec un buffer plus petit (impossible en pratique, mais montre l'asymétrie)
    // produit une 400 propre côté service (marchePiece.service.ts#MAX_TAILLE_OCTETS). Non
    // corrigé ici (hors périmètre de cette tâche de test) — à traiter séparément si souhaité.
    const oversized = Buffer.concat([Buffer.from('%PDF-1.4\n'), Buffer.alloc(10 * 1024 * 1024 + 1)])

    const res = await request(app)
      .post('/api/marches/pieces')
      .set(authed())
      .field('typeMarche', 'SERVICE')
      .field('nummarche', 'M1234567')
      .field('typePiece', 'CCAP')
      .field('numeroAvenant', '0')
      .attach('fichier', oversized, 'gros.pdf')

    expect(res.status).toBe(500)
    expect(uploadFile).not.toHaveBeenCalled()
  })
})

describe('GET /api/marches/pieces (liste)', () => {
  it('renvoie la liste des pièces du marché (200)', async () => {
    const res = await request(app).get('/api/marches/pieces?typeMarche=SERVICE&nummarche=M1234567').set(authed())

    expect(res.status).toBe(200)
    expect(res.body).toEqual([PIECE_SERVICE])
  })
})

describe('GET /api/marches/pieces/:id/download (téléchargement réel)', () => {
  it('renvoie le contenu du fichier avec les bons en-têtes', async () => {
    const res = await request(app).get('/api/marches/pieces/1/download').set(authed())

    expect(res.status).toBe(200)
    expect(res.headers['content-type']).toBe('application/pdf')
    expect(res.headers['content-disposition']).toBe(`attachment; filename="${encodeURIComponent('ccap.pdf')}"`)
    expect(Buffer.isBuffer(res.body) ? res.body : Buffer.from(res.text)).toEqual(Buffer.from('contenu-pdf'))
  })

  it('pièce introuvable -> 404', async () => {
    findById.mockResolvedValue(null)
    const res = await request(app).get('/api/marches/pieces/999/download').set(authed())
    expect(res.status).toBe(404)
  })
})

describe('DELETE /api/marches/pieces/:id (suppression best-effort)', () => {
  it('supprime la ligne puis le fichier, répond 204', async () => {
    const res = await request(app).delete('/api/marches/pieces/1').set(authed())

    expect(res.status).toBe(204)
    expect(remove).toHaveBeenCalledWith(1)
    expect(removeFile).toHaveBeenCalledWith(PIECE_SERVICE.storage_path)
  })

  it('répond quand même 204 si la suppression du fichier en storage échoue (best-effort)', async () => {
    removeFile.mockRejectedValue(new Error('storage down'))

    const res = await request(app).delete('/api/marches/pieces/1').set(authed())

    expect(res.status).toBe(204)
    expect(remove).toHaveBeenCalledWith(1)
  })

  it('rejette un acteur sans droit de suppression (403), la ligne n\'est pas supprimée', async () => {
    hasActiveRoleForService.mockResolvedValue(false)

    const res = await request(app).delete('/api/marches/pieces/1').set(authed())

    expect(res.status).toBe(403)
    expect(remove).not.toHaveBeenCalled()
  })
})
