import { randomUUID } from 'crypto'
import { z } from 'zod'
import * as investissementPieceRepository from '../repositories/investissementPiece.repository.js'
import * as investissementRepository from '../repositories/investissement.repository.js'
import * as acteurRepository from '../repositories/acteur.repository.js'
import * as roleAttributionRepository from '../repositories/roleAttribution.repository.js'
import { assertManagesServiceOrHasRoleCb } from './authorization.service.js'
import { AppError } from '../middlewares/errorHandler.js'
import type { InvestissementPiece } from '../repositories/investissementPiece.repository.js'

const TYPE_PIECE_VALUES = [
  'RAPPORT_CODIR',
  'RAPPORT_CODIR_VALIDE',
  'RAPPORT_CODIR_ANNEXES',
  'RAPPORT_CODIR_PLANS',
  'DECISION_DIRECTOIRE',
  'DECISION_DIRECTOIRE_ANNEXES',
  'DECISION_DIRECTOIRE_PLANS',
  'RAPPORT_CS',
  'RAPPORT_CS_VALIDE',
  'RAPPORT_CS_DOE',
  'RAPPORT_CS_ANNEXES',
  'RAPPORT_CS_PLANS',
  'DECISION_CS',
  'FICHE_OUVERTURE_HO_VALIDEE',
  'PROJET_TECHNIQUE',
  'AUTRE',
] as const
const MAX_TAILLE_OCTETS = 10 * 1024 * 1024
const PDF_MAGIC_BYTES = Buffer.from('%PDF')

function isPdfBuffer(buffer: Buffer): boolean {
  return buffer.subarray(0, 4).equals(PDF_MAGIC_BYTES)
}

/**
 * Service propriétaire de l'opération visée — lève 404 si elle n'existe pas. Contrairement à
 * marchePiece.service.ts#resolveTargetIdService, ID_SERVICE est une colonne directe de
 * finances.operation_investissement : aucune résolution CUG/fournisseur nécessaire.
 */
async function resolveTargetIdService(numeroOperation: string): Promise<number> {
  const operation = await investissementRepository.findByNumeroOperation(numeroOperation)
  if (!operation) throw new AppError('Opération introuvable', 404)
  return operation.id_service
}

/**
 * Lecture ouverte à tout utilisateur authentifié pour son propre service — même principe que
 * marchePiece.service.ts#resolveReadScope, ADMIN_APP (transverse) sans restriction.
 */
async function resolveReadScope(matricule: string | null): Promise<{ isAdminApp: boolean; ownIdService: number | null }> {
  if (!matricule) throw new AppError('Authentification requise', 401)

  const roles = await roleAttributionRepository.findActiveByMatricule(matricule)
  if (roles.some((r) => r.type_role === 'ADMIN_APP')) return { isAdminApp: true, ownIdService: null }

  const ownIdService = await acteurRepository.findIdServiceByMatricule(matricule)
  return { isAdminApp: false, ownIdService }
}

/** Consultation/téléchargement : même périmètre que la lecture de l'opération visée elle-même. */
async function assertReadAccess(matricule: string | null, idService: number): Promise<void> {
  const { isAdminApp, ownIdService } = await resolveReadScope(matricule)
  if (isAdminApp) return
  if (ownIdService === idService) return
  throw new AppError('Droits insuffisants pour ce service', 403)
}

export async function listPieces(matricule: string | null, numeroOperation: string): Promise<InvestissementPiece[]> {
  const idService = await resolveTargetIdService(numeroOperation)
  await assertReadAccess(matricule, idService)
  return investissementPieceRepository.findAllByOperation(numeroOperation)
}

const uploadPieceSchema = z.object({
  numeroOperation: z.string().trim().min(1, "Numéro d'opération requis."),
  typePiece: z.enum(TYPE_PIECE_VALUES),
  numeroReevaluation: z.coerce.number().int().nonnegative(),
})

export interface UploadedFile {
  buffer: Buffer
  size: number
  originalname: string
}

/**
 * Dépôt d'une pièce — réservé ADMIN_APP/ADMIN_SERVICE/CB (`assertManagesServiceOrHasRoleCb`).
 * Ordre délibéré : upload Storage d'abord (chemin neutre `<uuid>.pdf`, jamais le nom d'origine —
 * SECURITY.md §10), puis insertion de la ligne de métadonnées ; si l'insertion échoue, le fichier
 * vient d'être uploadé pour rien — nettoyage immédiat plutôt que de laisser une ligne pointer vers
 * un fichier absent (même logique que marchePiece.service.ts#uploadPiece).
 */
export async function uploadPiece(matricule: string | null, input: unknown, file: UploadedFile | undefined): Promise<InvestissementPiece> {
  if (!matricule) throw new AppError('Authentification requise', 401)
  if (!file) throw new AppError('Fichier requis.', 400)

  const result = uploadPieceSchema.safeParse(input)
  if (!result.success) throw new AppError(result.error.issues[0]?.message ?? 'Requête invalide', 400)
  const data = result.data

  const idService = await resolveTargetIdService(data.numeroOperation)
  await assertManagesServiceOrHasRoleCb(matricule, idService)

  if (!isPdfBuffer(file.buffer)) throw new AppError('Seuls les fichiers PDF sont acceptés.', 400)
  if (file.size > MAX_TAILLE_OCTETS) throw new AppError('Le fichier dépasse la taille maximale autorisée (10 Mo).', 400)

  const storagePath = `${data.numeroOperation}/${randomUUID()}.pdf`

  await investissementPieceRepository.uploadFile(storagePath, file.buffer)

  try {
    return await investissementPieceRepository.create({
      numero_operation: data.numeroOperation,
      id_service: idService,
      type_piece: data.typePiece,
      numero_reevaluation: data.numeroReevaluation,
      nom_fichier_original: file.originalname,
      storage_path: storagePath,
      taille_octets: file.size,
      matricule_depot: matricule,
    })
  } catch (err) {
    await investissementPieceRepository.removeFile(storagePath).catch(() => {})
    throw err
  }
}

const updateMetadataSchema = z.object({
  typePiece: z.enum(TYPE_PIECE_VALUES),
  numeroReevaluation: z.number().int().nonnegative(),
})

/** Type de pièce / numéro de réévaluation modifiables indépendamment du fichier — même principe que marchePiece.service.ts#updatePieceMetadata. */
export async function updatePieceMetadata(
  matricule: string | null,
  idInvestissementPiece: number,
  input: unknown,
): Promise<InvestissementPiece> {
  const result = updateMetadataSchema.safeParse(input)
  if (!result.success) throw new AppError(result.error.issues[0]?.message ?? 'Requête invalide', 400)

  const existing = await investissementPieceRepository.findById(idInvestissementPiece)
  if (!existing) throw new AppError('Pièce introuvable', 404)

  await assertManagesServiceOrHasRoleCb(matricule, existing.id_service)

  return investissementPieceRepository.updateMetadata(idInvestissementPiece, {
    type_piece: result.data.typePiece,
    numero_reevaluation: result.data.numeroReevaluation,
  })
}

/**
 * Suppression physique, sans trace résiduelle. Ordre inverse de l'upload : ligne d'abord (aucune
 * pièce visible ne doit pouvoir survivre à son propre fichier), puis fichier en best-effort — même
 * principe que marchePiece.service.ts#deletePiece.
 */
export async function deletePiece(matricule: string | null, idInvestissementPiece: number): Promise<void> {
  const existing = await investissementPieceRepository.findById(idInvestissementPiece)
  if (!existing) throw new AppError('Pièce introuvable', 404)

  await assertManagesServiceOrHasRoleCb(matricule, existing.id_service)

  await investissementPieceRepository.remove(idInvestissementPiece)
  await investissementPieceRepository.removeFile(existing.storage_path).catch((err) => {
    console.error('[investissement_piece] échec de suppression du fichier', existing.storage_path, err)
  })
}

export interface PieceDownload {
  buffer: Buffer
  nomFichier: string
}

export async function downloadPiece(matricule: string | null, idInvestissementPiece: number): Promise<PieceDownload> {
  const existing = await investissementPieceRepository.findById(idInvestissementPiece)
  if (!existing) throw new AppError('Pièce introuvable', 404)

  await assertReadAccess(matricule, existing.id_service)

  const buffer = await investissementPieceRepository.downloadFile(existing.storage_path)
  return { buffer, nomFichier: existing.nom_fichier_original }
}
