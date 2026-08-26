import * as authRepository from '../repositories/auth.repository.js'
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
