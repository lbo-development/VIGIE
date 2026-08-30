import * as authRepository from '../repositories/auth.repository.js'
import * as acteurRepository from '../repositories/acteur.repository.js'
import { AppError } from '../middlewares/errorHandler.js'

/**
 * Autorise ADMIN_APP (transverse) ou ADMIN_SERVICE scopé au service donné —
 * même règle que les policies RLS de finances.site/sous_site. Vérification
 * manuelle indispensable : le backend utilise service_role, qui contourne le
 * RLS (voir ForClaude/SECURITY.md §2, « appliquer la vérification des droits
 * manuellement dans le code Express »).
 */
export async function assertManagesService(matricule: string | null, idService: number | null): Promise<void> {
  if (!matricule) throw new AppError('Authentification requise', 401)

  if (await authRepository.hasActiveRole(matricule, 'ADMIN_APP')) return

  if (idService !== null && (await authRepository.hasActiveRoleForService(matricule, 'ADMIN_SERVICE', idService))) {
    return
  }

  throw new AppError('Droits insuffisants pour ce service', 403)
}

/**
 * Variante d'assertManagesService qui autorise en plus tout acteur rattaché
 * au service visé (ACTEUR.ID_CELLULE → SERVICE), même sans rôle
 * ADMIN_SERVICE/ADMIN_APP — c'est-à-dire un Demandeur, qui n'a pas de rôle
 * dédié (voir ForClaude/CDC/mot-phases-1-2.md l.15). Décision du 29/08/2026,
 * réservée à la CRÉATION de FOURNISSEUR (voir fournisseur.service.ts) : ne
 * pas réutiliser ailleurs sans revalider ce périmètre, assertManagesService
 * reste la règle par défaut (SITE/SECTEUR/SEUIL_VALIDATION_DS, et la
 * modification d'un FOURNISSEUR existant).
 */
export async function assertManagesServiceOrIsOwnActor(matricule: string | null, idService: number): Promise<void> {
  if (!matricule) throw new AppError('Authentification requise', 401)

  if (await authRepository.hasActiveRole(matricule, 'ADMIN_APP')) return
  if (await authRepository.hasActiveRoleForService(matricule, 'ADMIN_SERVICE', idService)) return

  const ownIdService = await acteurRepository.findIdServiceByMatricule(matricule)
  if (ownIdService === idService) return

  throw new AppError('Droits insuffisants pour ce service', 403)
}
