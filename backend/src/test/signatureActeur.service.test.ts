import { describe, it, expect, vi, beforeEach } from 'vitest'

const findByMatricule = vi.fn()
const findIdServiceByMatricule = vi.fn()

const sigFindByMatricule = vi.fn()
const sigUpsert = vi.fn()
const sigRemove = vi.fn()
const sigBuildStoragePath = vi.fn()
const sigUploadFile = vi.fn()
const sigDownloadFile = vi.fn()
const sigRemoveFile = vi.fn()

const assertManagesService = vi.fn()

vi.mock('../repositories/acteur.repository.js', () => ({
  findByMatricule: (...args: unknown[]) => findByMatricule(...args),
  findIdServiceByMatricule: (...args: unknown[]) => findIdServiceByMatricule(...args),
}))

vi.mock('../repositories/signatureActeur.repository.js', () => ({
  findByMatricule: (...args: unknown[]) => sigFindByMatricule(...args),
  upsert: (...args: unknown[]) => sigUpsert(...args),
  remove: (...args: unknown[]) => sigRemove(...args),
  buildStoragePath: (...args: unknown[]) => sigBuildStoragePath(...args),
  uploadFile: (...args: unknown[]) => sigUploadFile(...args),
  downloadFile: (...args: unknown[]) => sigDownloadFile(...args),
  removeFile: (...args: unknown[]) => sigRemoveFile(...args),
}))

vi.mock('../services/authorization.service.js', () => ({
  assertManagesService: (...args: unknown[]) => assertManagesService(...args),
}))

const { uploadSignature, downloadSignature, deleteSignature, getSignatureBufferForPdf, getSignature } = await import(
  '../services/signatureActeur.service.js'
)

const AUTEUR = '100001'
const CIBLE = '100002'
const CIBLE_ACTEUR = { matricule: CIBLE, nom: 'Dupont', prenom: 'Jean', fonction: 'Chef de groupe', id_cellule: 5, actif: true }

const PNG_BYTES = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])
const JPEG_BYTES = Buffer.from([0xff, 0xd8, 0xff, 0xe0])
const TEXT_BYTES = Buffer.from('not an image')

beforeEach(() => {
  findByMatricule.mockReset()
  findIdServiceByMatricule.mockReset()
  sigFindByMatricule.mockReset()
  sigUpsert.mockReset()
  sigRemove.mockReset()
  sigBuildStoragePath.mockReset()
  sigUploadFile.mockReset()
  sigDownloadFile.mockReset()
  sigRemoveFile.mockReset()
  assertManagesService.mockReset()

  findByMatricule.mockResolvedValue(CIBLE_ACTEUR)
  findIdServiceByMatricule.mockResolvedValue(7)
  assertManagesService.mockResolvedValue(undefined)
  sigRemoveFile.mockResolvedValue(undefined)
})

describe('uploadSignature', () => {
  it('rejette sans authentification (401)', async () => {
    await expect(uploadSignature(null, CIBLE, { buffer: PNG_BYTES, originalname: 'sig.png', size: PNG_BYTES.length })).rejects.toMatchObject({
      status: 401,
    })
  })

  it('rejette sans fichier (400)', async () => {
    await expect(uploadSignature(AUTEUR, CIBLE, undefined)).rejects.toMatchObject({ status: 400 })
  })

  it("rejette si l'acteur cible est introuvable (404)", async () => {
    findByMatricule.mockResolvedValue(null)
    await expect(uploadSignature(AUTEUR, CIBLE, { buffer: PNG_BYTES, originalname: 'sig.png', size: PNG_BYTES.length })).rejects.toMatchObject({
      status: 404,
    })
  })

  it("délègue les droits à assertManagesService, scopé au service de l'acteur cible", async () => {
    sigFindByMatricule.mockResolvedValue(null)
    sigBuildStoragePath.mockReturnValue('100002/uuid.png')
    sigUpsert.mockResolvedValue({
      matricule: CIBLE,
      chemin_stockage: '100002/uuid.png',
      nom_fichier_original: 'sig.png',
      taille_octets: PNG_BYTES.length,
      matricule_depose_par: AUTEUR,
    })

    await uploadSignature(AUTEUR, CIBLE, { buffer: PNG_BYTES, originalname: 'sig.png', size: PNG_BYTES.length })

    expect(assertManagesService).toHaveBeenCalledWith(AUTEUR, 7)
  })

  it('propage le 403 levé par assertManagesService (ADMIN_APP/ADMIN_SERVICE requis)', async () => {
    assertManagesService.mockRejectedValue(Object.assign(new Error('Droits insuffisants'), { status: 403 }))

    await expect(uploadSignature(AUTEUR, CIBLE, { buffer: PNG_BYTES, originalname: 'sig.png', size: PNG_BYTES.length })).rejects.toMatchObject({
      status: 403,
    })
    expect(sigUploadFile).not.toHaveBeenCalled()
  })

  it('rejette un fichier qui ne commence pas par les magic bytes PNG/JPEG (400)', async () => {
    await expect(uploadSignature(AUTEUR, CIBLE, { buffer: TEXT_BYTES, originalname: 'sig.png', size: TEXT_BYTES.length })).rejects.toMatchObject({
      status: 400,
    })
    expect(sigUploadFile).not.toHaveBeenCalled()
  })

  it('rejette un fichier trop volumineux (> 2 Mo, 400)', async () => {
    const size = 2 * 1024 * 1024 + 1
    await expect(uploadSignature(AUTEUR, CIBLE, { buffer: PNG_BYTES, originalname: 'sig.png', size })).rejects.toMatchObject({ status: 400 })
    expect(sigUploadFile).not.toHaveBeenCalled()
  })

  it('accepte un JPEG valide et upsert la ligne', async () => {
    sigFindByMatricule.mockResolvedValue(null)
    sigBuildStoragePath.mockReturnValue('100002/uuid.jpg')
    sigUpsert.mockResolvedValue({
      matricule: CIBLE,
      chemin_stockage: '100002/uuid.jpg',
      nom_fichier_original: 'sig.jpg',
      taille_octets: JPEG_BYTES.length,
      matricule_depose_par: AUTEUR,
    })

    const result = await uploadSignature(AUTEUR, CIBLE, { buffer: JPEG_BYTES, originalname: 'sig.jpg', size: JPEG_BYTES.length })

    expect(sigUploadFile).toHaveBeenCalledWith('100002/uuid.jpg', JPEG_BYTES, 'image/jpeg')
    expect(result.matricule).toBe(CIBLE)
  })

  it('remplace le fichier existant et supprime l\'ancien en best-effort', async () => {
    sigFindByMatricule.mockResolvedValue({
      matricule: CIBLE,
      chemin_stockage: '100002/old.png',
      nom_fichier_original: 'old.png',
      taille_octets: 10,
      matricule_depose_par: AUTEUR,
    })
    sigBuildStoragePath.mockReturnValue('100002/new.png')
    sigUpsert.mockResolvedValue({
      matricule: CIBLE,
      chemin_stockage: '100002/new.png',
      nom_fichier_original: 'sig.png',
      taille_octets: PNG_BYTES.length,
      matricule_depose_par: AUTEUR,
    })

    await uploadSignature(AUTEUR, CIBLE, { buffer: PNG_BYTES, originalname: 'sig.png', size: PNG_BYTES.length })

    expect(sigRemoveFile).toHaveBeenCalledWith('100002/old.png')
  })
})

describe('downloadSignature / deleteSignature', () => {
  it("downloadSignature rejette si aucune signature n'a été déposée (404)", async () => {
    sigFindByMatricule.mockResolvedValue(null)
    await expect(downloadSignature(AUTEUR, CIBLE)).rejects.toMatchObject({ status: 404 })
  })

  it("deleteSignature rejette si aucune signature n'a été déposée (404)", async () => {
    sigFindByMatricule.mockResolvedValue(null)
    await expect(deleteSignature(AUTEUR, CIBLE)).rejects.toMatchObject({ status: 404 })
  })

  it('deleteSignature supprime la ligne puis le fichier', async () => {
    sigFindByMatricule.mockResolvedValue({
      matricule: CIBLE,
      chemin_stockage: '100002/sig.png',
      nom_fichier_original: 'sig.png',
      taille_octets: 10,
      matricule_depose_par: AUTEUR,
    })

    await deleteSignature(AUTEUR, CIBLE)

    expect(sigRemove).toHaveBeenCalledWith(CIBLE)
    expect(sigRemoveFile).toHaveBeenCalledWith('100002/sig.png')
  })

  it('getSignature renvoie null sans erreur si aucune signature déposée (pas un 404 — simple absence)', async () => {
    sigFindByMatricule.mockResolvedValue(null)
    await expect(getSignature(AUTEUR, CIBLE)).resolves.toBeNull()
  })
})

describe('getSignatureBufferForPdf', () => {
  it('renvoie null sans vérification de droits si aucune signature déposée', async () => {
    sigFindByMatricule.mockResolvedValue(null)
    const result = await getSignatureBufferForPdf(CIBLE)
    expect(result).toBeNull()
    expect(assertManagesService).not.toHaveBeenCalled()
  })

  it("déduit l'extension du chemin de stockage (pas de nouvelle détection par magic bytes)", async () => {
    sigFindByMatricule.mockResolvedValue({
      matricule: CIBLE,
      chemin_stockage: '100002/sig.jpg',
      nom_fichier_original: 'sig.jpg',
      taille_octets: 10,
      matricule_depose_par: AUTEUR,
    })
    sigDownloadFile.mockResolvedValue(JPEG_BYTES)

    const result = await getSignatureBufferForPdf(CIBLE)

    expect(result).toEqual({ buffer: JPEG_BYTES, extension: 'jpg' })
  })
})
