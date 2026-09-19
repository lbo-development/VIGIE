import { z } from 'zod'
import * as investissementRepository from '../repositories/investissement.repository.js'
import * as investissementPieceRepository from '../repositories/investissementPiece.repository.js'
import * as roleAttributionRepository from '../repositories/roleAttribution.repository.js'
import * as acteurRepository from '../repositories/acteur.repository.js'
import { findLastImportRow, type LastImportInfo } from './investissementImport.service.js'
import { assertManagesServiceOrHasRoleCb } from './authorization.service.js'
import { AppError } from '../middlewares/errorHandler.js'
import type { OperationInvestissement } from '../repositories/investissement.repository.js'

export interface OperationInvestissementWithPieceCount extends OperationInvestissement {
  /** Nombre de pièces déposées (finances.investissement_piece) — pastille sur l'icône « Visualiser les pièces » (InvestissementsPGI.tsx, décision du 05/09/2026). */
  nombre_pieces: number
}

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
export async function listInvestissements(matricule: string | null, idService?: number): Promise<OperationInvestissementWithPieceCount[]> {
  const { isAdminApp, ownIdService } = await resolveReadScope(matricule)

  const effectiveIdService = isAdminApp ? idService : (ownIdService ?? undefined)
  if (effectiveIdService === undefined) return []

  const investissements = await investissementRepository.findAll(effectiveIdService)
  const pieceCounts = await investissementPieceRepository.countByNumeroOperations(investissements.map((i) => i.numero_operation))
  return investissements.map((i) => ({ ...i, nombre_pieces: pieceCounts.get(i.numero_operation) ?? 0 }))
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
 * Modification manuelle des champs LIBELLE_SERVICE, ACTIF et UTILISABLE — icône « Modifier » des
 * cartes d'InvestissementsPGI.tsx, réservée ADMIN_APP/ADMIN_SERVICE/CB
 * (`assertManagesServiceOrHasRoleCb`), même triplet que l'import. `id_service` résolu depuis la
 * ligne existante (colonne directe sur la table, pas de résolution via CUG/fournisseur
 * nécessaire, contrairement à marche.service.ts#resolveMarcheIdService).
 *
 * Attention : depuis le 17/09/2026, ACTIF et UTILISABLE sont aussi repilotés par STATUT à chaque
 * import (voir investissementImport.service.ts#confirm) — une modification faite ici peut être
 * écrasée par le prochain import (systématiquement sur statut F ; sur statut A, seul ACTIF est
 * réécrasé, UTILISABLE ne l'est que si l'opération vient de sortir du statut F).
 */
export async function updateManagedFields(matricule: string | null, numeroOperation: string, input: unknown): Promise<OperationInvestissement> {
  const result = updateManagedFieldsSchema.safeParse(input)
  if (!result.success) throw new AppError(result.error.issues[0]?.message ?? 'Requête invalide', 400)

  const existing = await investissementRepository.findByNumeroOperation(numeroOperation)
  if (!existing) throw new AppError('Opération introuvable', 404)

  await assertManagesServiceOrHasRoleCb(matricule, existing.id_service)

  return investissementRepository.updateManagedFields(numeroOperation, result.data)
}
