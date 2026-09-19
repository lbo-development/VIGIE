import * as signatureActeurRepository from '../repositories/signatureActeur.repository.js'
import * as acteurRepository from '../repositories/acteur.repository.js'
import * as authorizationService from './authorization.service.js'
import { AppError } from '../middlewares/errorHandler.js'

/**
 * Signature (image) d'un acteur — dépôt/remplacement/suppression réservés ADMIN_APP
 * (transverse) ou ADMIN_SERVICE scopé au service de l'acteur cible (assertManagesService,
 * jamais assertManagesServiceOrHasRoleCb : la CB ne doit jamais gérer les signatures — décision
 * du 19/09/2026). Réutilisée par demandeAchat.service.ts#genererFadPdf via
 * getSignatureBufferForPdf, sans re-vérification de droits (le flux appelant est déjà autorisé
 * côté CB à ce stade).
 */

const MAX_TAILLE_OCTETS = 2 * 1024 * 1024

const PNG_MAGIC_BYTES = Buffer.from([0x89, 0x50, 0x4e, 0x47])
const JPEG_MAGIC_BYTES = Buffer.from([0xff, 0xd8, 0xff])

function detectImageExtension(buffer: Buffer): 'png' | 'jpg' | null {
  if (buffer.subarray(0, 4).equals(PNG_MAGIC_BYTES)) return 'png'
  if (buffer.subarray(0, 3).equals(JPEG_MAGIC_BYTES)) return 'jpg'
  return null
}

async function assertPeutGererSignature(matriculeAuteur: string | null, matriculeCible: string): Promise<void> {
  if (!matriculeAuteur) throw new AppError('Authentification requise', 401)

  const cible = await acteurRepository.findByMatricule(matriculeCible)
  if (!cible) throw new AppError('Acteur introuvable', 404)

  const idService = await acteurRepository.findIdServiceByMatricule(matriculeCible)
  await authorizationService.assertManagesService(matriculeAuteur, idService)
}

export interface SignatureActeurView {
  matricule: string
  nomFichierOriginal: string
  tailleOctets: number
}

function toView(row: signatureActeurRepository.SignatureActeur): SignatureActeurView {
  return { matricule: row.matricule, nomFichierOriginal: row.nom_fichier_original, tailleOctets: row.taille_octets }
}

export async function getSignature(matriculeAuteur: string | null, matriculeCible: string): Promise<SignatureActeurView | null> {
  await assertPeutGererSignature(matriculeAuteur, matriculeCible)
  const row = await signatureActeurRepository.findByMatricule(matriculeCible)
  return row ? toView(row) : null
}

/**
 * Dépôt/remplacement (décision du 19/09/2026) — le fichier existant en Storage est supprimé en
 * best-effort une fois le nouveau confirmé en base, même ordre que
 * demandeAchat.service.ts#uploadDevisFile.
 */
export async function uploadSignature(
  matriculeAuteur: string | null,
  matriculeCible: string,
  file: { buffer: Buffer; originalname: string; size: number } | undefined,
): Promise<SignatureActeurView> {
  if (!file) throw new AppError('Fichier requis.', 400)
  await assertPeutGererSignature(matriculeAuteur, matriculeCible)

  const extension = detectImageExtension(file.buffer)
  if (!extension) throw new AppError('Seuls les fichiers PNG ou JPEG sont acceptés.', 400)
  if (file.size > MAX_TAILLE_OCTETS) throw new AppError('Le fichier dépasse la taille maximale autorisée (2 Mo).', 400)

  const previous = await signatureActeurRepository.findByMatricule(matriculeCible)

  const path = signatureActeurRepository.buildStoragePath(matriculeCible, extension)
  const contentType = extension === 'png' ? 'image/png' : 'image/jpeg'
  await signatureActeurRepository.uploadFile(path, file.buffer, contentType)

  let row
  try {
    row = await signatureActeurRepository.upsert({
      matricule: matriculeCible,
      chemin_stockage: path,
      nom_fichier_original: file.originalname,
      taille_octets: file.size,
      matricule_depose_par: matriculeAuteur as string,
    })
  } catch (err) {
    await signatureActeurRepository.removeFile(path).catch(() => {})
    throw err
  }

  if (previous) {
    await signatureActeurRepository.removeFile(previous.chemin_stockage).catch((removeErr: unknown) => {
      console.error('[signature_acteur] échec de suppression de l\'ancien fichier', previous.chemin_stockage, removeErr)
    })
  }
  return toView(row)
}

export async function downloadSignature(matriculeAuteur: string | null, matriculeCible: string): Promise<{ buffer: Buffer; nomFichier: string }> {
  await assertPeutGererSignature(matriculeAuteur, matriculeCible)
  const row = await signatureActeurRepository.findByMatricule(matriculeCible)
  if (!row) throw new AppError('Aucune signature déposée pour cet acteur.', 404)
  const buffer = await signatureActeurRepository.downloadFile(row.chemin_stockage)
  return { buffer, nomFichier: row.nom_fichier_original }
}

export async function deleteSignature(matriculeAuteur: string | null, matriculeCible: string): Promise<void> {
  await assertPeutGererSignature(matriculeAuteur, matriculeCible)
  const row = await signatureActeurRepository.findByMatricule(matriculeCible)
  if (!row) throw new AppError('Aucune signature déposée pour cet acteur.', 404)

  await signatureActeurRepository.remove(matriculeCible)
  await signatureActeurRepository.removeFile(row.chemin_stockage).catch((err: unknown) => {
    console.error('[signature_acteur] échec de suppression du fichier', row.chemin_stockage, err)
  })
}

export interface SignatureBufferForPdf {
  buffer: Buffer
  extension: 'png' | 'jpg'
}

/**
 * Lecture interne pour la génération du PDF FAD (demandeAchat.service.ts#genererFadPdf) — sans
 * vérification de droits ADMIN_APP/ADMIN_SERVICE : l'appelant a déjà été autorisé (rôle CB sur
 * la FAD) par le flux appelant. Renvoie `null` si aucune signature n'a été déposée pour cet
 * acteur (traduit en erreur explicite par le flux appelant, pas ici). L'extension vient du
 * chemin de stockage (posé par buildStoragePath à partir du contenu réel au dépôt), pas d'une
 * nouvelle détection par magic bytes — évite de la dupliquer ici.
 */
export async function getSignatureBufferForPdf(matricule: string): Promise<SignatureBufferForPdf | null> {
  const row = await signatureActeurRepository.findByMatricule(matricule)
  if (!row) return null
  const buffer = await signatureActeurRepository.downloadFile(row.chemin_stockage)
  const extension = row.chemin_stockage.toLowerCase().endsWith('.png') ? 'png' : 'jpg'
  return { buffer, extension }
}
