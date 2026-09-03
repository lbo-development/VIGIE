import { randomUUID } from 'crypto'
import { z } from 'zod'
import * as marchePieceRepository from '../repositories/marchePiece.repository.js'
import * as marcheRepository from '../repositories/marche.repository.js'
import * as marcheTiersRepository from '../repositories/marcheTiers.repository.js'
import * as cugRepository from '../repositories/cug.repository.js'
import * as fournisseurRepository from '../repositories/fournisseur.repository.js'
import * as acteurRepository from '../repositories/acteur.repository.js'
import * as roleAttributionRepository from '../repositories/roleAttribution.repository.js'
import { assertManagesServiceOrHasRoleCb } from './authorization.service.js'
import { AppError } from '../middlewares/errorHandler.js'
import type { Marche } from '../repositories/marche.repository.js'
import type { MarchePiece, TypeMarchePiece } from '../repositories/marchePiece.repository.js'

const TYPE_PIECE_VALUES = ['CCAP', 'CCTP', 'AE', 'AVENANT', 'BPU', 'AUTRE'] as const
const MAX_TAILLE_OCTETS = 10 * 1024 * 1024
const PDF_MAGIC_BYTES = Buffer.from('%PDF')

function isPdfBuffer(buffer: Buffer): boolean {
  return buffer.subarray(0, 4).equals(PDF_MAGIC_BYTES)
}

interface MarcheRef {
  typeMarche: TypeMarchePiece
  nummarche?: string
  idMarcheTiers?: number
}

function toRef(piece: MarchePiece): MarcheRef {
  return piece.type_marche === 'SERVICE'
    ? { typeMarche: 'SERVICE', nummarche: piece.nummarche as string }
    : { typeMarche: 'TIERS', idMarcheTiers: piece.id_marche_tiers as number }
}

/**
 * Résout le service propriétaire d'un marché service — même double voie que
 * marche.service.ts#resolveMarcheIdService (CODE_CUG → CUG.ID_SERVICE, repli
 * ID_FOURNISSEUR → FOURNISSEUR.ID_SERVICE), dupliquée ici plutôt qu'exportée
 * de marche.service.ts pour garder chaque ressource autonome (même principe
 * que resolveReadScope, redéfini par service dans ce backend).
 */
async function resolveMarcheServiceIdService(marche: Marche): Promise<number | null> {
  if (marche.code_cug) {
    const cug = await cugRepository.findByCode(marche.code_cug)
    if (cug) return cug.id_service
  }
  if (marche.id_fournisseur !== null) {
    const fournisseur = await fournisseurRepository.findById(marche.id_fournisseur)
    if (fournisseur) return fournisseur.id_service
  }
  return null
}

/** Service propriétaire du marché visé (service ou tiers) — lève 404 s'il n'existe pas. */
async function resolveTargetIdService(ref: MarcheRef): Promise<number | null> {
  if (ref.typeMarche === 'SERVICE') {
    if (!ref.nummarche) throw new AppError('Numéro de marché requis.', 400)
    const marche = await marcheRepository.findByNummarche(ref.nummarche)
    if (!marche) throw new AppError('Marché introuvable', 404)
    return resolveMarcheServiceIdService(marche)
  }
  if (ref.idMarcheTiers === undefined) throw new AppError('Marché tiers requis.', 400)
  const marcheTiers = await marcheTiersRepository.findById(ref.idMarcheTiers)
  if (!marcheTiers) throw new AppError('Marché tiers introuvable', 404)
  return marcheTiers.id_service
}

/**
 * Lecture ouverte à tout utilisateur authentifié pour son propre service —
 * même principe que marche.service.ts/marcheTiers.service.ts#resolveReadScope,
 * ADMIN_APP (transverse) sans restriction.
 */
async function resolveReadScope(matricule: string | null): Promise<{ isAdminApp: boolean; ownIdService: number | null }> {
  if (!matricule) throw new AppError('Authentification requise', 401)

  const roles = await roleAttributionRepository.findActiveByMatricule(matricule)
  if (roles.some((r) => r.type_role === 'ADMIN_APP')) return { isAdminApp: true, ownIdService: null }

  const ownIdService = await acteurRepository.findIdServiceByMatricule(matricule)
  return { isAdminApp: false, ownIdService }
}

/** Consultation/téléchargement : même périmètre que la lecture du marché visé lui-même. */
async function assertReadAccess(matricule: string | null, idService: number | null): Promise<void> {
  const { isAdminApp, ownIdService } = await resolveReadScope(matricule)
  if (isAdminApp) return
  if (idService !== null && ownIdService === idService) return
  throw new AppError('Droits insuffisants pour ce service', 403)
}

export interface ListPiecesQuery {
  typeMarche: TypeMarchePiece
  nummarche?: string
  idMarcheTiers?: number
}

export async function listPieces(matricule: string | null, query: ListPiecesQuery): Promise<MarchePiece[]> {
  const idService = await resolveTargetIdService(query)
  await assertReadAccess(matricule, idService)

  if (query.typeMarche === 'SERVICE') return marchePieceRepository.findAllByService(query.nummarche as string)
  return marchePieceRepository.findAllByTiers(query.idMarcheTiers as number)
}

const uploadPieceSchema = z
  .object({
    typeMarche: z.enum(['SERVICE', 'TIERS']),
    nummarche: z.string().trim().min(1).optional(),
    idMarcheTiers: z.coerce.number().int().optional(),
    typePiece: z.enum(TYPE_PIECE_VALUES),
    numeroAvenant: z.coerce.number().int().nonnegative(),
  })
  .superRefine((data, ctx) => {
    if (data.typeMarche === 'SERVICE' && !data.nummarche) {
      ctx.addIssue({ code: 'custom', message: 'Numéro de marché requis.', path: ['nummarche'] })
    }
    if (data.typeMarche === 'TIERS' && data.idMarcheTiers === undefined) {
      ctx.addIssue({ code: 'custom', message: 'Marché tiers requis.', path: ['idMarcheTiers'] })
    }
  })

export interface UploadedFile {
  buffer: Buffer
  size: number
  originalname: string
}

/**
 * Dépôt d'une pièce — réservé ADMIN_APP/ADMIN_SERVICE/CB
 * (`assertManagesServiceOrHasRoleCb`). Ordre délibéré : upload Storage
 * d'abord (chemin neutre `<uuid>.pdf`, jamais le nom d'origine — SECURITY.md
 * §10), puis insertion de la ligne de métadonnées ; si l'insertion échoue, le
 * fichier vient d'être uploadé pour rien — nettoyage immédiat plutôt que de
 * laisser une ligne pointer vers un fichier absent (l'inverse aurait été pire
 * : une pièce visible en consultation mais impossible à télécharger).
 */
export async function uploadPiece(matricule: string | null, input: unknown, file: UploadedFile | undefined): Promise<MarchePiece> {
  if (!matricule) throw new AppError('Authentification requise', 401)
  if (!file) throw new AppError('Fichier requis.', 400)

  const result = uploadPieceSchema.safeParse(input)
  if (!result.success) throw new AppError(result.error.issues[0]?.message ?? 'Requête invalide', 400)
  const data = result.data

  const ref: MarcheRef = { typeMarche: data.typeMarche, nummarche: data.nummarche, idMarcheTiers: data.idMarcheTiers }
  const idService = await resolveTargetIdService(ref)
  // ID_SERVICE est NOT NULL en base (migration 20260902130000, scoping RLS) — un marché sans
  // service résolvable (CUG/fournisseur introuvable) ne doit jamais atteindre l'insertion,
  // même pour ADMIN_APP (qui court-circuite sinon la vérification idService ci-dessous).
  if (idService === null) throw new AppError('Service du marché introuvable.', 404)
  await assertManagesServiceOrHasRoleCb(matricule, idService)

  if (!isPdfBuffer(file.buffer)) throw new AppError('Seuls les fichiers PDF sont acceptés.', 400)
  if (file.size > MAX_TAILLE_OCTETS) throw new AppError('Le fichier dépasse la taille maximale autorisée (10 Mo).', 400)

  const storagePath =
    data.typeMarche === 'SERVICE' ? `service/${data.nummarche}/${randomUUID()}.pdf` : `tiers/${data.idMarcheTiers}/${randomUUID()}.pdf`

  await marchePieceRepository.uploadFile(storagePath, file.buffer)

  try {
    return await marchePieceRepository.create({
      type_marche: data.typeMarche,
      nummarche: data.typeMarche === 'SERVICE' ? (data.nummarche as string) : null,
      id_marche_tiers: data.typeMarche === 'TIERS' ? (data.idMarcheTiers as number) : null,
      id_service: idService,
      type_piece: data.typePiece,
      numero_avenant: data.numeroAvenant,
      nom_fichier_original: file.originalname,
      storage_path: storagePath,
      taille_octets: file.size,
      matricule_depot: matricule,
    })
  } catch (err) {
    await marchePieceRepository.removeFile(storagePath).catch(() => {})
    throw err
  }
}

const updateMetadataSchema = z.object({
  typePiece: z.enum(TYPE_PIECE_VALUES),
  numeroAvenant: z.number().int().nonnegative(),
})

/** Type de pièce / numéro d'avenant modifiables indépendamment du fichier (décision du 02/09/2026). */
export async function updatePieceMetadata(matricule: string | null, idMarchePiece: number, input: unknown): Promise<MarchePiece> {
  const result = updateMetadataSchema.safeParse(input)
  if (!result.success) throw new AppError(result.error.issues[0]?.message ?? 'Requête invalide', 400)

  const existing = await marchePieceRepository.findById(idMarchePiece)
  if (!existing) throw new AppError('Pièce de marché introuvable', 404)

  const idService = await resolveTargetIdService(toRef(existing))
  await assertManagesServiceOrHasRoleCb(matricule, idService)

  return marchePieceRepository.updateMetadata(idMarchePiece, {
    type_piece: result.data.typePiece,
    numero_avenant: result.data.numeroAvenant,
  })
}

/**
 * Suppression physique, sans trace résiduelle (décision explicite du
 * 02/09/2026). Ordre inverse de l'upload : ligne d'abord (aucune pièce
 * visible ne doit pouvoir survivre à son propre fichier), puis fichier en
 * best-effort — un échec de suppression du fichier laisse au pire un objet
 * orphelin dans le bucket, sans impact utilisateur.
 */
export async function deletePiece(matricule: string | null, idMarchePiece: number): Promise<void> {
  const existing = await marchePieceRepository.findById(idMarchePiece)
  if (!existing) throw new AppError('Pièce de marché introuvable', 404)

  const idService = await resolveTargetIdService(toRef(existing))
  await assertManagesServiceOrHasRoleCb(matricule, idService)

  await marchePieceRepository.remove(idMarchePiece)
  await marchePieceRepository.removeFile(existing.storage_path).catch((err) => {
    console.error('[marche_piece] échec de suppression du fichier', existing.storage_path, err)
  })
}

export interface PieceDownload {
  buffer: Buffer
  nomFichier: string
}

export async function downloadPiece(matricule: string | null, idMarchePiece: number): Promise<PieceDownload> {
  const existing = await marchePieceRepository.findById(idMarchePiece)
  if (!existing) throw new AppError('Pièce de marché introuvable', 404)

  const idService = await resolveTargetIdService(toRef(existing))
  await assertReadAccess(matricule, idService)

  const buffer = await marchePieceRepository.downloadFile(existing.storage_path)
  return { buffer, nomFichier: existing.nom_fichier_original }
}
