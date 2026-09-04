import { z } from 'zod'
import * as investissementRepository from '../repositories/investissement.repository.js'
import * as roleAttributionRepository from '../repositories/roleAttribution.repository.js'
import * as acteurRepository from '../repositories/acteur.repository.js'
import { findLastImportRow, type LastImportInfo } from './investissementImport.service.js'
import { assertManagesServiceOrHasRoleCb } from './authorization.service.js'
import { AppError } from '../middlewares/errorHandler.js'
import type { OperationInvestissement } from '../repositories/investissement.repository.js'

/**
 * Lecture de finances.operation_investissement — même principe que
 * commandePgi.service.ts#resolveReadScope : page de consultation ouverte à tout acteur (pas
 * seulement ADMIN_APP/ADMIN_SERVICE/CB comme l'import), ADMIN_APP transverse, tout le monde
 * d'autre scopé à son propre service.
 */
async function resolveReadScope(matricule: string | null): Promise<{ isAdminApp: boolean; ownIdService: number | null }> {
  if (!matricule) throw new AppError('Authentification requise', 401)

  const roles = await roleAttributionRepository.findActiveByMatricule(matricule)
  if (roles.some((r) => r.type_role === 'ADMIN_APP')) return { isAdminApp: true, ownIdService: null }

  const ownIdService = await acteurRepository.findIdServiceByMatricule(matricule)
  return { isAdminApp: false, ownIdService }
}

/**
 * Opérations d'investissement du service donné. `idService` n'a d'effet que pour ADMIN_APP ;
 * pour tout autre acteur, le service transmis est ignoré au profit de son propre service
 * (défense en profondeur, même logique que commandePgi.service.ts/marche.service.ts).
 */
export async function listInvestissements(matricule: string | null, idService?: number): Promise<OperationInvestissement[]> {
  const { isAdminApp, ownIdService } = await resolveReadScope(matricule)

  const effectiveIdService = isAdminApp ? idService : (ownIdService ?? undefined)
  if (effectiveIdService === undefined) return []

  return investissementRepository.findAll(effectiveIdService)
}

/**
 * « État des investissements PGI du service » — lecture ouverte à tout utilisateur authentifié
 * pour son propre service, ADMIN_APP pouvant consulter n'importe quel service (même règle que
 * `listInvestissements` ci-dessus). Réutilise `findLastImportRow`
 * (investissementImport.service.ts), qui lit la ligne exacte du paramètre pour CE service —
 * jamais l'héritage direction/global. Ne pas réutiliser `getLastImportInfo` à la place : celle-ci
 * réserve la lecture à ADMIN_APP/ADMIN_SERVICE/CB, adapté à l'écran d'import mais pas à cette
 * page de consultation — même distinction que commandePgi.service.ts#getLastImportStatus.
 */
export async function getLastImportStatus(matricule: string | null, idService?: number): Promise<LastImportInfo> {
  const { isAdminApp, ownIdService } = await resolveReadScope(matricule)
  const effectiveIdService = isAdminApp ? idService : (ownIdService ?? undefined)
  if (effectiveIdService === undefined) return { exists: false, valeur: null }
  return findLastImportRow(effectiveIdService)
}

const updateManagedFieldsSchema = z.object({
  libelleService: z.string().trim().min(1, 'Le libellé est obligatoire.').max(500),
  actif: z.boolean(),
  utilisable: z.boolean(),
})

/**
 * Modification manuelle des seuls champs éditables hors import — LIBELLE_SERVICE, ACTIF et
 * UTILISABLE (voir ForClaude/importation-investissementsPGI/import-investissements-pgi.md, §11 —
 * ACTIF rendu manuel le 04/09/2026, l'import ne le pilote plus du tout après création) — icône
 * « Modifier » des cartes d'InvestissementsPGI.tsx, réservée ADMIN_APP/ADMIN_SERVICE/CB
 * (`assertManagesServiceOrHasRoleCb`), même triplet que l'import. `id_service` résolu depuis la
 * ligne existante (colonne directe sur la table, pas de résolution via CUG/fournisseur
 * nécessaire, contrairement à marche.service.ts#resolveMarcheIdService).
 */
export async function updateManagedFields(matricule: string | null, numeroOperation: string, input: unknown): Promise<OperationInvestissement> {
  const result = updateManagedFieldsSchema.safeParse(input)
  if (!result.success) throw new AppError(result.error.issues[0]?.message ?? 'Requête invalide', 400)

  const existing = await investissementRepository.findByNumeroOperation(numeroOperation)
  if (!existing) throw new AppError('Opération introuvable', 404)

  await assertManagesServiceOrHasRoleCb(matricule, existing.id_service)

  return investissementRepository.updateManagedFields(numeroOperation, result.data)
}
