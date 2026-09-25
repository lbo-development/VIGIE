import * as purgeDaFadRepository from '../repositories/purgeDaFad.repository.js'
import * as pieceJointeRepository from '../repositories/pieceJointe.repository.js'
import * as devisConsulteRepository from '../repositories/devisConsulte.repository.js'
import * as authRepository from '../repositories/auth.repository.js'
import { AppError } from '../middlewares/errorHandler.js'

/**
 * Suppression en masse des DA/FAD d'un service (Paramètres, ADMIN_APP
 * uniquement, décision du 25/09/2026) — la fonctionnalité destructive la
 * plus large de l'application : purge TOUTES les DEMANDE_ACHAT d'un service
 * (tous statuts, y compris FAD_COMMANDEE et leurs CSF même liquidés) avec
 * leurs dépendances, sans exception et sans piste d'audit conservée
 * (décision explicite du client). Double confirmation côté frontend (question
 * + ré-authentification par mot de passe via supabase.auth.signInWithPassword,
 * voir ForClaude/SECURITY.md §1 « route sensible ») — le mot de passe n'est
 * jamais transmis à ce backend, seule l'autorisation ADMIN_APP habituelle est
 * revérifiée ici.
 */

async function assertAdminApp(matricule: string | null): Promise<void> {
  if (!matricule) throw new AppError('Authentification requise', 401)
  if (!(await authRepository.hasActiveRole(matricule, 'ADMIN_APP'))) {
    throw new AppError('Réservé à ADMIN_APP.', 403)
  }
}

/** Aperçu avant confirmation (étape 1 de l'écran) — nombre de DA/FAD du service, tous statuts confondus. */
export async function countDaFadService(matricule: string | null, idService: number): Promise<number> {
  await assertAdminApp(matricule)
  return purgeDaFadRepository.countByService(idService)
}

/**
 * Supprime réellement les DA/FAD du service — irréversible. Liste les
 * fichiers Storage avant d'appeler la fonction Postgres (qui supprime les
 * lignes portant leur chemin), puis les nettoie en best-effort : un fichier
 * orphelin resterait sans conséquence pratique (bucket privé, jamais listé
 * par balayage), l'inverse (ligne supprimée pointant vers un fichier déjà
 * parti) ne présenterait aucun risque non plus puisque la ligne elle-même
 * disparaît — le sens choisi (RPC d'abord, nettoyage ensuite) privilégie la
 * garantie transactionnelle Postgres plutôt que l'ordre inverse.
 */
export async function purgerDaFadService(matricule: string | null, idService: number): Promise<number> {
  await assertAdminApp(matricule)

  const { pieceJointePaths, devisPaths } = await purgeDaFadRepository.findStoragePathsByService(idService)
  const nombre = await purgeDaFadRepository.purgerViaRpc(idService)

  await Promise.all([
    ...pieceJointePaths.map((path) =>
      pieceJointeRepository.removeFile(path).catch((err: unknown) => {
        console.error(`[purgeDaFad] échec de suppression du fichier piece_jointe ${path}`, err)
      }),
    ),
    ...devisPaths.map((path) =>
      devisConsulteRepository.removeFile(path).catch((err: unknown) => {
        console.error(`[purgeDaFad] échec de suppression du fichier devis_consulte ${path}`, err)
      }),
    ),
  ])

  return nombre
}
