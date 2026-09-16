import { z } from 'zod'
import * as cugRepository from '../repositories/cug.repository.js'
import * as authRepository from '../repositories/auth.repository.js'
import * as roleAttributionRepository from '../repositories/roleAttribution.repository.js'
import * as celluleRepository from '../repositories/cellule.repository.js'
import * as roleEffectifService from './roleEffectif.service.js'
import { assertManagesService } from './authorization.service.js'
import { AppError } from '../middlewares/errorHandler.js'
import type { Cug } from '../repositories/cug.repository.js'

const createCugSchema = z.object({
  codeCug: z.string().trim().min(1).max(20),
  libelleCug: z.string().trim().min(1).max(200),
  idService: z.number().int(),
  actif: z.boolean().default(true),
})

const updateCugSchema = z.object({
  libelleCug: z.string().trim().min(1).max(200).optional(),
  actif: z.boolean().optional(),
})

/**
 * Périmètre de lecture : ADMIN_APP voit tout (transverse), ADMIN_SERVICE et
 * RC (titulaire ou suppléant — écran de suivi RC, décision du 15/09/2026) ne
 * voient que leur propre service (attribution directe pour ADMIN_SERVICE,
 * via sa cellule pour RC — findEffectiveRoles couvre la suppléance, même
 * source que demandeAchat.service.ts#resolveAccessContext). Contrairement à
 * SITE/SECTEUR/FOURNISSEUR, **aucun autre appelant** n'a de droit ici (pas de
 * périmètre Demandeur pour CUG — décision du 29/08/2026, voir
 * ForClaude/CDC/mot-phases-1-2.md) : rejeté en 403, pas une simple liste vide.
 */
async function resolveReadScope(matricule: string | null): Promise<{ isAdminApp: boolean; ownIdService: number | null }> {
  if (!matricule) throw new AppError('Authentification requise', 401)

  if (await authRepository.hasActiveRole(matricule, 'ADMIN_APP')) return { isAdminApp: true, ownIdService: null }

  const roles = await roleAttributionRepository.findActiveByMatricule(matricule)
  const adminServiceRole = roles.find((r) => r.type_role === 'ADMIN_SERVICE' && r.id_service !== null)
  if (adminServiceRole) return { isAdminApp: false, ownIdService: adminServiceRole.id_service }

  const effectiveRoles = await roleEffectifService.findEffectiveRoles(matricule)
  const rcRole = effectiveRoles.find((r) => r.typeRole === 'RC' && r.idCellule !== null)
  if (rcRole) {
    const cellule = await celluleRepository.findById(rcRole.idCellule as number)
    if (cellule) return { isAdminApp: false, ownIdService: cellule.id_service }
  }

  throw new AppError('Droits insuffisants', 403)
}

export async function listCug(matricule: string | null, idService?: number): Promise<Cug[]> {
  const { isAdminApp, ownIdService } = await resolveReadScope(matricule)
  const effectiveIdService = isAdminApp ? idService : (ownIdService ?? undefined)
  return cugRepository.findAll(effectiveIdService)
}

export async function createCug(matricule: string | null, input: unknown): Promise<Cug> {
  const result = createCugSchema.safeParse(input)
  if (!result.success) throw new AppError(result.error.issues[0]?.message ?? 'Requête invalide', 400)

  await assertManagesService(matricule, result.data.idService)

  const existing = await cugRepository.findByCode(result.data.codeCug)
  if (existing) throw new AppError(`Le CUG "${result.data.codeCug}" existe déjà`, 409)

  return cugRepository.create({
    code_cug: result.data.codeCug,
    libelle_cug: result.data.libelleCug,
    id_service: result.data.idService,
    actif: result.data.actif,
  })
}

export async function updateCug(matricule: string | null, codeCug: string, input: unknown): Promise<Cug> {
  const result = updateCugSchema.safeParse(input)
  if (!result.success) throw new AppError(result.error.issues[0]?.message ?? 'Requête invalide', 400)

  const cug = await cugRepository.findByCode(codeCug)
  if (!cug) throw new AppError('CUG introuvable', 404)

  await assertManagesService(matricule, cug.id_service)

  return cugRepository.update(codeCug, {
    libelle_cug: result.data.libelleCug,
    actif: result.data.actif,
  })
}
