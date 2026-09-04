import { describe, it, expect, vi, beforeEach } from 'vitest'

const findAllByOperation = vi.fn()
const findById = vi.fn()
const create = vi.fn()
const updateMetadata = vi.fn()
const remove = vi.fn()
const uploadFile = vi.fn()
const downloadFile = vi.fn()
const removeFile = vi.fn()

const findByNumeroOperation = vi.fn()
const findIdServiceByMatricule = vi.fn()
const findActiveByMatricule = vi.fn()
const assertManagesServiceOrHasRoleCb = vi.fn()

vi.mock('../repositories/investissementPiece.repository.js', () => ({
  findAllByOperation: (...args: unknown[]) => findAllByOperation(...args),
  findById: (...args: unknown[]) => findById(...args),
  create: (...args: unknown[]) => create(...args),
  updateMetadata: (...args: unknown[]) => updateMetadata(...args),
  remove: (...args: unknown[]) => remove(...args),
  uploadFile: (...args: unknown[]) => uploadFile(...args),
  downloadFile: (...args: unknown[]) => downloadFile(...args),
  removeFile: (...args: unknown[]) => removeFile(...args),
}))
vi.mock('../repositories/investissement.repository.js', () => ({
  findByNumeroOperation: (...args: unknown[]) => findByNumeroOperation(...args),
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
  '../services/investissementPiece.service.js'
)

const MATRICULE = '12520'
const ID_SERVICE = 1
const NUMERO_OPERATION = 'IN025393'

const OPERATION = { numero_operation: NUMERO_OPERATION, id_service: ID_SERVICE }

const PIECE = {
  id_investissement_piece: 1,
  numero_operation: NUMERO_OPERATION,
  id_service: ID_SERVICE,
  type_piece: 'RAPPORT_CODIR' as const,
  numero_reevaluation: 0,
  nom_fichier_original: 'rapport-codir.pdf',
  storage_path: `${NUMERO_OPERATION}/uuid.pdf`,
  taille_octets: 1000,
  matricule_depot: MATRICULE,
  created_at: '2026-09-04T10:00:00.000Z',
  updated_at: '2026-09-04T10:00:00.000Z',
}

const PDF_BUFFER = Buffer.concat([Buffer.from('%PDF-1.4\n'), Buffer.alloc(10)])

function validFile(overrides: Partial<{ buffer: Buffer; size: number; originalname: string }> = {}) {
  return { buffer: PDF_BUFFER, size: PDF_BUFFER.length, originalname: 'rapport-codir.pdf', ...overrides }
}

beforeEach(() => {
  findAllByOperation.mockReset().mockResolvedValue([PIECE])
  findById.mockReset().mockResolvedValue(PIECE)
  create.mockReset().mockResolvedValue(PIECE)
  updateMetadata.mockReset().mockResolvedValue(PIECE)
  remove.mockReset().mockResolvedValue(undefined)
  uploadFile.mockReset().mockResolvedValue(undefined)
  downloadFile.mockReset().mockResolvedValue(Buffer.from('contenu'))
  removeFile.mockReset().mockResolvedValue(undefined)

  findByNumeroOperation.mockReset().mockResolvedValue(OPERATION)
  findIdServiceByMatricule.mockReset().mockResolvedValue(ID_SERVICE)
  findActiveByMatricule.mockReset().mockResolvedValue([])
  assertManagesServiceOrHasRoleCb.mockReset().mockResolvedValue(undefined)
})

describe('listPieces', () => {
  it('rejette sans matricule', async () => {
    await expect(listPieces(null, NUMERO_OPERATION)).rejects.toMatchObject({ status: 401 })
  })

  it("rejette un acteur d'un autre service (403)", async () => {
    findIdServiceByMatricule.mockResolvedValue(2)
    await expect(listPieces(MATRICULE, NUMERO_OPERATION)).rejects.toMatchObject({ status: 403 })
  })

  it("ADMIN_APP peut lister les pièces de n'importe quel service", async () => {
    findActiveByMatricule.mockResolvedValue([{ type_role: 'ADMIN_APP', id_service: null, id_cellule: null, id_direction: null, id_role: 1 }])
    findIdServiceByMatricule.mockResolvedValue(999)
    const result = await listPieces(MATRICULE, NUMERO_OPERATION)
    expect(result).toEqual([PIECE])
  })

  it('opération introuvable -> 404', async () => {
    findByNumeroOperation.mockResolvedValue(null)
    await expect(listPieces(MATRICULE, 'INCONNU')).rejects.toMatchObject({ status: 404 })
  })
})

describe('uploadPiece', () => {
  const input = { numeroOperation: NUMERO_OPERATION, typePiece: 'RAPPORT_CODIR', numeroReevaluation: 0 }

  it('rejette sans matricule', async () => {
    await expect(uploadPiece(null, input, validFile())).rejects.toMatchObject({ status: 401 })
  })

  it('rejette sans fichier', async () => {
    await expect(uploadPiece(MATRICULE, input, undefined)).rejects.toMatchObject({ status: 400 })
  })

  it("rejette un type_piece hors nomenclature", async () => {
    await expect(uploadPiece(MATRICULE, { ...input, typePiece: 'INCONNU' }, validFile())).rejects.toMatchObject({ status: 400 })
    expect(uploadFile).not.toHaveBeenCalled()
  })

  it('vérifie les droits (assertManagesServiceOrHasRoleCb) avant tout upload', async () => {
    assertManagesServiceOrHasRoleCb.mockRejectedValue(Object.assign(new Error('Droits insuffisants pour ce service'), { status: 403 }))
    await expect(uploadPiece(MATRICULE, input, validFile())).rejects.toMatchObject({ status: 403 })
    expect(uploadFile).not.toHaveBeenCalled()
  })

  it("rejette un fichier dont la signature n'est pas %PDF", async () => {
    await expect(uploadPiece(MATRICULE, input, validFile({ buffer: Buffer.from('pas un pdf') }))).rejects.toMatchObject({ status: 400 })
    expect(uploadFile).not.toHaveBeenCalled()
  })

  it('rejette un fichier de plus de 10 Mo', async () => {
    await expect(uploadPiece(MATRICULE, input, validFile({ size: 10 * 1024 * 1024 + 1 }))).rejects.toMatchObject({ status: 400 })
    expect(uploadFile).not.toHaveBeenCalled()
  })

  it("upload le fichier avant d'insérer la ligne de métadonnées, avec un chemin neutre (jamais le nom d'origine)", async () => {
    await uploadPiece(MATRICULE, input, validFile())

    expect(uploadFile).toHaveBeenCalledTimes(1)
    const [storagePath] = uploadFile.mock.calls[0]
    expect(storagePath).toMatch(new RegExp(`^${NUMERO_OPERATION}/[0-9a-f-]+\\.pdf$`))
    expect(storagePath).not.toContain('rapport-codir.pdf')

    expect(create).toHaveBeenCalledWith(
      expect.objectContaining({ storage_path: storagePath, nom_fichier_original: 'rapport-codir.pdf', id_service: ID_SERVICE }),
    )
    // uploadFile doit avoir été appelé avant create (ordre défensif contre les métadonnées orphelines).
    expect(uploadFile.mock.invocationCallOrder[0]).toBeLessThan(create.mock.invocationCallOrder[0])
  })

  it("rejette si l'opération est introuvable (404), avant tout upload", async () => {
    findByNumeroOperation.mockResolvedValue(null)
    await expect(uploadPiece(MATRICULE, input, validFile())).rejects.toMatchObject({ status: 404 })
    expect(uploadFile).not.toHaveBeenCalled()
    expect(create).not.toHaveBeenCalled()
  })

  it("nettoie le fichier uploadé si l'insertion de la ligne échoue", async () => {
    create.mockRejectedValue(new Error('insert failed'))
    await expect(uploadPiece(MATRICULE, input, validFile())).rejects.toThrow('insert failed')
    expect(removeFile).toHaveBeenCalledTimes(1)
    expect(removeFile.mock.calls[0][0]).toBe(uploadFile.mock.calls[0][0])
  })
})

describe('updatePieceMetadata', () => {
  it('pièce introuvable -> 404', async () => {
    findById.mockResolvedValue(null)
    await expect(updatePieceMetadata(MATRICULE, 1, { typePiece: 'AUTRE', numeroReevaluation: 1 })).rejects.toMatchObject({ status: 404 })
  })

  it("vérifie les droits sur le service propriétaire de l'opération", async () => {
    await updatePieceMetadata(MATRICULE, 1, { typePiece: 'AUTRE', numeroReevaluation: 2 })
    expect(assertManagesServiceOrHasRoleCb).toHaveBeenCalledWith(MATRICULE, ID_SERVICE)
    expect(updateMetadata).toHaveBeenCalledWith(1, { type_piece: 'AUTRE', numero_reevaluation: 2 })
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
    expect(removeFile).toHaveBeenCalledWith(PIECE.storage_path)
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

  it("rejette un acteur d'un autre service (403)", async () => {
    findIdServiceByMatricule.mockResolvedValue(2)
    await expect(downloadPiece(MATRICULE, 1)).rejects.toMatchObject({ status: 403 })
  })

  it("renvoie le contenu du fichier et le nom d'origine", async () => {
    const result = await downloadPiece(MATRICULE, 1)
    expect(result.nomFichier).toBe('rapport-codir.pdf')
    expect(downloadFile).toHaveBeenCalledWith(PIECE.storage_path)
  })
})
