import { describe, it, expect, vi, beforeEach } from 'vitest'

const findAllByService = vi.fn()
const findAllByTiers = vi.fn()
const findById = vi.fn()
const create = vi.fn()
const updateMetadata = vi.fn()
const remove = vi.fn()
const uploadFile = vi.fn()
const downloadFile = vi.fn()
const removeFile = vi.fn()

const findByNummarche = vi.fn()
const findByIdMarcheTiers = vi.fn()
const findByCode = vi.fn()
const findByIdFournisseur = vi.fn()
const findIdServiceByMatricule = vi.fn()
const findActiveByMatricule = vi.fn()
const assertManagesServiceOrHasRoleCb = vi.fn()

vi.mock('../repositories/marchePiece.repository.js', () => ({
  findAllByService: (...args: unknown[]) => findAllByService(...args),
  findAllByTiers: (...args: unknown[]) => findAllByTiers(...args),
  findById: (...args: unknown[]) => findById(...args),
  create: (...args: unknown[]) => create(...args),
  updateMetadata: (...args: unknown[]) => updateMetadata(...args),
  remove: (...args: unknown[]) => remove(...args),
  uploadFile: (...args: unknown[]) => uploadFile(...args),
  downloadFile: (...args: unknown[]) => downloadFile(...args),
  removeFile: (...args: unknown[]) => removeFile(...args),
}))
vi.mock('../repositories/marche.repository.js', () => ({
  findByNummarche: (...args: unknown[]) => findByNummarche(...args),
}))
vi.mock('../repositories/marcheTiers.repository.js', () => ({
  findById: (...args: unknown[]) => findByIdMarcheTiers(...args),
}))
vi.mock('../repositories/cug.repository.js', () => ({
  findByCode: (...args: unknown[]) => findByCode(...args),
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
vi.mock('../services/authorization.service.js', () => ({
  assertManagesServiceOrHasRoleCb: (...args: unknown[]) => assertManagesServiceOrHasRoleCb(...args),
}))

const { listPieces, uploadPiece, updatePieceMetadata, deletePiece, downloadPiece } = await import(
  '../services/marchePiece.service.js'
)

const MATRICULE = '12520'
const ID_SERVICE = 1

const MARCHE = {
  nummarche: 'M1234567',
  code_cug: 'CUG01',
  id_fournisseur: null,
}

const MARCHE_TIERS = { id_marche_tiers: 7, id_service: ID_SERVICE }

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
  taille_octets: 1000,
  matricule_depot: MATRICULE,
  created_at: '2026-09-02T10:00:00.000Z',
  updated_at: '2026-09-02T10:00:00.000Z',
}

const PDF_BUFFER = Buffer.concat([Buffer.from('%PDF-1.4\n'), Buffer.alloc(10)])

function validFile(overrides: Partial<{ buffer: Buffer; size: number; originalname: string }> = {}) {
  return { buffer: PDF_BUFFER, size: PDF_BUFFER.length, originalname: 'ccap.pdf', ...overrides }
}

beforeEach(() => {
  findAllByService.mockReset().mockResolvedValue([PIECE_SERVICE])
  findAllByTiers.mockReset().mockResolvedValue([])
  findById.mockReset().mockResolvedValue(PIECE_SERVICE)
  create.mockReset().mockResolvedValue(PIECE_SERVICE)
  updateMetadata.mockReset().mockResolvedValue(PIECE_SERVICE)
  remove.mockReset().mockResolvedValue(undefined)
  uploadFile.mockReset().mockResolvedValue(undefined)
  downloadFile.mockReset().mockResolvedValue(Buffer.from('contenu'))
  removeFile.mockReset().mockResolvedValue(undefined)

  findByNummarche.mockReset().mockResolvedValue(MARCHE)
  findByIdMarcheTiers.mockReset().mockResolvedValue(MARCHE_TIERS)
  findByCode.mockReset().mockResolvedValue({ code_cug: 'CUG01', id_service: ID_SERVICE })
  findByIdFournisseur.mockReset().mockResolvedValue(null)
  findIdServiceByMatricule.mockReset().mockResolvedValue(ID_SERVICE)
  findActiveByMatricule.mockReset().mockResolvedValue([])
  assertManagesServiceOrHasRoleCb.mockReset().mockResolvedValue(undefined)
})

describe('listPieces', () => {
  it('rejette sans matricule', async () => {
    await expect(listPieces(null, { typeMarche: 'SERVICE', nummarche: 'M1234567' })).rejects.toMatchObject({ status: 401 })
  })

  it('rejette un acteur d\'un autre service (403)', async () => {
    findIdServiceByMatricule.mockResolvedValue(2)
    await expect(listPieces(MATRICULE, { typeMarche: 'SERVICE', nummarche: 'M1234567' })).rejects.toMatchObject({ status: 403 })
  })

  it('ADMIN_APP peut lister les pièces de n\'importe quel service', async () => {
    findActiveByMatricule.mockResolvedValue([{ type_role: 'ADMIN_APP', id_service: null, id_cellule: null, id_direction: null, id_role: 1 }])
    findIdServiceByMatricule.mockResolvedValue(999)
    const result = await listPieces(MATRICULE, { typeMarche: 'SERVICE', nummarche: 'M1234567' })
    expect(result).toEqual([PIECE_SERVICE])
  })

  it('marché introuvable -> 404', async () => {
    findByNummarche.mockResolvedValue(null)
    await expect(listPieces(MATRICULE, { typeMarche: 'SERVICE', nummarche: 'INCONNU' })).rejects.toMatchObject({ status: 404 })
  })

  it('marché tiers : résout id_service via marcheTiersRepository', async () => {
    const result = await listPieces(MATRICULE, { typeMarche: 'TIERS', idMarcheTiers: 7 })
    expect(findAllByTiers).toHaveBeenCalledWith(7)
    expect(result).toEqual([])
  })
})

describe('uploadPiece', () => {
  const input = { typeMarche: 'SERVICE', nummarche: 'M1234567', typePiece: 'CCAP', numeroAvenant: 0 }

  it('rejette sans matricule', async () => {
    await expect(uploadPiece(null, input, validFile())).rejects.toMatchObject({ status: 401 })
  })

  it('rejette sans fichier', async () => {
    await expect(uploadPiece(MATRICULE, input, undefined)).rejects.toMatchObject({ status: 400 })
  })

  it('vérifie les droits (assertManagesServiceOrHasRoleCb) avant tout upload', async () => {
    assertManagesServiceOrHasRoleCb.mockRejectedValue(Object.assign(new Error('Droits insuffisants pour ce service'), { status: 403 }))
    await expect(uploadPiece(MATRICULE, input, validFile())).rejects.toMatchObject({ status: 403 })
    expect(uploadFile).not.toHaveBeenCalled()
  })

  it('rejette un fichier dont la signature n\'est pas %PDF', async () => {
    await expect(uploadPiece(MATRICULE, input, validFile({ buffer: Buffer.from('pas un pdf') }))).rejects.toMatchObject({ status: 400 })
    expect(uploadFile).not.toHaveBeenCalled()
  })

  it('rejette un fichier de plus de 10 Mo', async () => {
    await expect(uploadPiece(MATRICULE, input, validFile({ size: 10 * 1024 * 1024 + 1 }))).rejects.toMatchObject({ status: 400 })
    expect(uploadFile).not.toHaveBeenCalled()
  })

  it('upload le fichier avant d\'insérer la ligne de métadonnées, avec un chemin neutre (jamais le nom d\'origine)', async () => {
    await uploadPiece(MATRICULE, input, validFile())

    expect(uploadFile).toHaveBeenCalledTimes(1)
    const [storagePath] = uploadFile.mock.calls[0]
    expect(storagePath).toMatch(/^service\/M1234567\/[0-9a-f-]+\.pdf$/)
    expect(storagePath).not.toContain('ccap.pdf')

    expect(create).toHaveBeenCalledWith(
      expect.objectContaining({ storage_path: storagePath, nom_fichier_original: 'ccap.pdf', id_service: ID_SERVICE }),
    )
    // uploadFile doit avoir été appelé avant create (ordre défensif contre les métadonnées orphelines).
    expect(uploadFile.mock.invocationCallOrder[0]).toBeLessThan(create.mock.invocationCallOrder[0])
  })

  it('rejette si le service du marché est irrésolvable (404), avant tout upload — ID_SERVICE est NOT NULL en base', async () => {
    findByCode.mockResolvedValue(null)
    findByIdFournisseur.mockResolvedValue(null)
    await expect(uploadPiece(MATRICULE, { ...input, nummarche: 'M1234567' }, validFile())).rejects.toMatchObject({ status: 404 })
    expect(uploadFile).not.toHaveBeenCalled()
    expect(create).not.toHaveBeenCalled()
  })

  it('nettoie le fichier uploadé si l\'insertion de la ligne échoue', async () => {
    create.mockRejectedValue(new Error('insert failed'))
    await expect(uploadPiece(MATRICULE, input, validFile())).rejects.toThrow('insert failed')
    expect(removeFile).toHaveBeenCalledTimes(1)
    expect(removeFile.mock.calls[0][0]).toBe(uploadFile.mock.calls[0][0])
  })

  it('chemin tiers : utilise id_marche_tiers, pas nummarche', async () => {
    await uploadPiece(MATRICULE, { typeMarche: 'TIERS', idMarcheTiers: 7, typePiece: 'AE', numeroAvenant: 1 }, validFile())
    const [storagePath] = uploadFile.mock.calls[0]
    expect(storagePath).toMatch(/^tiers\/7\/[0-9a-f-]+\.pdf$/)
    expect(create).toHaveBeenCalledWith(expect.objectContaining({ type_marche: 'TIERS', id_marche_tiers: 7, nummarche: null }))
  })
})

describe('updatePieceMetadata', () => {
  it('pièce introuvable -> 404', async () => {
    findById.mockResolvedValue(null)
    await expect(updatePieceMetadata(MATRICULE, 1, { typePiece: 'AE', numeroAvenant: 1 })).rejects.toMatchObject({ status: 404 })
  })

  it('vérifie les droits sur le service propriétaire du marché', async () => {
    await updatePieceMetadata(MATRICULE, 1, { typePiece: 'AE', numeroAvenant: 2 })
    expect(assertManagesServiceOrHasRoleCb).toHaveBeenCalledWith(MATRICULE, ID_SERVICE)
    expect(updateMetadata).toHaveBeenCalledWith(1, { type_piece: 'AE', numero_avenant: 2 })
  })
})

describe('deletePiece', () => {
  it('pièce introuvable -> 404', async () => {
    findById.mockResolvedValue(null)
    await expect(deletePiece(MATRICULE, 1)).rejects.toMatchObject({ status: 404 })
  })

  it('supprime la ligne avant le fichier (jamais l\'inverse)', async () => {
    await deletePiece(MATRICULE, 1)
    expect(remove).toHaveBeenCalledWith(1)
    expect(removeFile).toHaveBeenCalledWith(PIECE_SERVICE.storage_path)
    expect(remove.mock.invocationCallOrder[0]).toBeLessThan(removeFile.mock.invocationCallOrder[0])
  })

  it('un échec de suppression du fichier ne fait pas échouer la requête (best-effort)', async () => {
    removeFile.mockRejectedValue(new Error('storage down'))
    await expect(deletePiece(MATRICULE, 1)).resolves.toBeUndefined()
  })
})

describe('downloadPiece', () => {
  it('pièce introuvable -> 404', async () => {
    findById.mockResolvedValue(null)
    await expect(downloadPiece(MATRICULE, 1)).rejects.toMatchObject({ status: 404 })
  })

  it('rejette un acteur d\'un autre service (403)', async () => {
    findIdServiceByMatricule.mockResolvedValue(2)
    await expect(downloadPiece(MATRICULE, 1)).rejects.toMatchObject({ status: 403 })
  })

  it('renvoie le contenu du fichier et le nom d\'origine', async () => {
    const result = await downloadPiece(MATRICULE, 1)
    expect(result.nomFichier).toBe('ccap.pdf')
    expect(downloadFile).toHaveBeenCalledWith(PIECE_SERVICE.storage_path)
  })
})
