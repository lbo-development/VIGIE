import * as commandePgiRepository from '../repositories/commandePgi.repository.js'
import * as roleAttributionRepository from '../repositories/roleAttribution.repository.js'
import * as acteurRepository from '../repositories/acteur.repository.js'
import { findLastImportRow, type LastImportInfo } from './commandePgiImport.service.js'
import { AppError } from '../middlewares/errorHandler.js'
import type { CommandePgi } from '../repositories/commandePgi.repository.js'

/**
 * Lecture de finances.commande_pgi — même principe que
 * marche.service.ts#resolveReadScope : page de consultation ouverte à tout
 * acteur (pas seulement ADMIN_APP/ADMIN_SERVICE/CB comme l'import), ADMIN_APP
 * transverse, tout le monde d'autre scopé à son propre service.
 */
async function resolveReadScope(matricule: string | null): Promise<{ isAdminApp: boolean; ownIdService: number | null }> {
  if (!matricule) throw new AppError('Authentification requise', 401)

  const roles = await roleAttributionRepository.findActiveByMatricule(matricule)
  if (roles.some((r) => r.type_role === 'ADMIN_APP')) return { isAdminApp: true, ownIdService: null }

  const ownIdService = await acteurRepository.findIdServiceByMatricule(matricule)
  return { isAdminApp: false, ownIdService }
}

/**
 * Commandes PGI du service donné. `idService` n'a d'effet que pour ADMIN_APP ;
 * pour tout autre acteur, le service transmis est ignoré au profit de son
 * propre service (défense en profondeur, même logique que
 * fournisseur.service.ts/marche.service.ts).
 */
export async function listCommandesPgi(matricule: string | null, idService?: number): Promise<CommandePgi[]> {
  const { isAdminApp, ownIdService } = await resolveReadScope(matricule)

  const effectiveIdService = isAdminApp ? idService : (ownIdService ?? undefined)
  if (effectiveIdService === undefined) return []

  return commandePgiRepository.findAll(effectiveIdService)
}

/**
 * « État des commandes au [date] » (CommandesPGI.tsx, décision du 03/09/2026) — lecture
 * ouverte à tout utilisateur authentifié pour son propre service, ADMIN_APP pouvant
 * consulter n'importe quel service (même règle que `listCommandesPgi` ci-dessus). Réutilise
 * `findLastImportRow` (commandePgiImport.service.ts), qui lit la ligne exacte du paramètre
 * pour CE service — jamais l'héritage direction/global. Ne pas réutiliser `getLastImportInfo`
 * (commandePgiImport.service.ts) à la place : celle-ci réserve la lecture à ADMIN_APP/
 * ADMIN_SERVICE/CB, adapté à l'écran d'import mais pas à cette page de consultation, ouverte
 * à tout acteur — même distinction que marche.service.ts#getLastImportStatus.
 */
export async function getLastImportStatus(matricule: string | null, idService?: number): Promise<LastImportInfo> {
  const { isAdminApp, ownIdService } = await resolveReadScope(matricule)
  const effectiveIdService = isAdminApp ? idService : (ownIdService ?? undefined)
  if (effectiveIdService === undefined) return { exists: false, valeur: null }
  return findLastImportRow(effectiveIdService)
}
