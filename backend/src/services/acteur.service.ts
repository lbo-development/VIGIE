import { randomBytes } from 'node:crypto'
import { z } from 'zod'
import * as acteurRepository from '../repositories/acteur.repository.js'
import * as celluleRepository from '../repositories/cellule.repository.js'
import * as authRepository from '../repositories/auth.repository.js'
import * as authAdminRepository from '../repositories/authAdmin.repository.js'
import * as roleAttributionRepository from '../repositories/roleAttribution.repository.js'
import * as suppleanceRepository from '../repositories/suppleance.repository.js'
import * as demandeAchatRepository from '../repositories/demandeAchat.repository.js'
import * as historiqueStatutRepository from '../repositories/historiqueStatut.repository.js'
import { AppError } from '../middlewares/errorHandler.js'
import type { Acteur } from '../repositories/acteur.repository.js'

/**
 * Listing des acteurs d'un service ou d'une cellule — sert exclusivement le
 * combo « Demandeur » de la page DemandeAchat (RC : tous les demandeurs de
 * son service ; ADMIN_SERVICE : ceux d'une cellule choisie de son service ;
 * ADMIN_APP : n'importe quelle cellule/service — voir la matrice validée le
 * 07/09/2026, ForClaude/CDC). Un Demandeur simple n'a aucun usage légitime de
 * cet endpoint (pas de sélecteur à son écran) : rejeté par construction, seul
 * RC/ADMIN_SERVICE/ADMIN_APP est autorisé.
 */

async function resolveOwnIdService(matricule: string): Promise<{ isAdminApp: boolean; ownIdService: number | null }> {
  if (await authRepository.hasActiveRole(matricule, 'ADMIN_APP')) return { isAdminApp: true, ownIdService: null }

  const roles = await roleAttributionRepository.findActiveByMatricule(matricule)

  const adminService = roles.find((r) => r.type_role === 'ADMIN_SERVICE' && r.id_service !== null)
  if (adminService) return { isAdminApp: false, ownIdService: adminService.id_service }

  const rc = roles.find((r) => r.type_role === 'RC' && r.id_cellule !== null)
  if (rc) {
    const cellule = await celluleRepository.findById(rc.id_cellule as number)
    return { isAdminApp: false, ownIdService: cellule?.id_service ?? null }
  }

  throw new AppError('Droits insuffisants.', 403)
}

export interface ListActeursQuery {
  idService?: number
  idCellule?: number
}

export async function listActeurs(matricule: string | null, query: ListActeursQuery): Promise<Acteur[]> {
  if (!matricule) throw new AppError('Authentification requise', 401)

  const { isAdminApp, ownIdService } = await resolveOwnIdService(matricule)

  if (query.idCellule !== undefined) {
    const cellule = await celluleRepository.findById(query.idCellule)
    if (!cellule) throw new AppError('Cellule introuvable', 404)
    if (!isAdminApp && ownIdService !== cellule.id_service) throw new AppError('Droits insuffisants pour cette cellule.', 403)
    return acteurRepository.findAllByCellule(query.idCellule)
  }

  if (query.idService !== undefined) {
    if (!isAdminApp && ownIdService !== query.idService) throw new AppError('Droits insuffisants pour ce service.', 403)
    return acteurRepository.findAllByService(query.idService)
  }

  // ADMIN_APP sans filtre : vue complète, transverse — sert aussi l'écran
  // d'administration « Utilisateurs » (ADMIN_APP seul), en plus du combo
  // Demandeur. Décision du 10/09/2026, voir ForClaude/CDC/mot-phases-1-2.md.
  if (isAdminApp) return acteurRepository.findAll()
  if (ownIdService === null) return []
  return acteurRepository.findAllByService(ownIdService)
}

/**
 * CRUD ACTEUR + compte Supabase Auth — réservé ADMIN_APP (requireRole côté
 * routes, comme organisation.service.ts pour DIRECTION/SERVICE/CELLULE :
 * pas de vérification de périmètre supplémentaire ici, la ressource est
 * transverse par nature). Décision du 10/09/2026 (ForClaude/CDC/mot-phases-1-2.md,
 * tâche « Gérer les comptes utilisateurs »).
 */

// Format imposé à exactement 6 chiffres (décision du 10/09/2026) : complété
// par des zéros à gauche si l'ADMIN_APP saisit moins de 6 chiffres (ex. 600
// -> 000600) — voir la contrainte CHECK acteur_matricule_format_check
// (supabase/migrations/20260910100000_acteur_matricule_6_digits.sql), qui
// n'est qu'un filet de sécurité base, ce transform est le mécanisme réel.
const matriculeField = z
  .string()
  .trim()
  .regex(/^[0-9]{1,6}$/, 'Le matricule doit être composé uniquement de chiffres (6 maximum).')
  .transform((v) => v.padStart(6, '0'))

const createActeurSchema = z.object({
  matricule: matriculeField,
  nom: z.string().trim().min(1).max(200),
  prenom: z.string().trim().min(1).max(200),
  fonction: z.string().trim().min(1).max(200),
  idCellule: z.number().int(),
  email: z.string().trim().email().max(320),
})

const updateActeurSchema = z.object({
  nom: z.string().trim().min(1).max(200).optional(),
  prenom: z.string().trim().min(1).max(200).optional(),
  fonction: z.string().trim().min(1).max(200).optional(),
  idCellule: z.number().int().optional(),
  actif: z.boolean().optional(),
})

/** Mot de passe temporaire lisible (26 caractères base64url) — jamais loggué, renvoyé une seule fois à l'appelant (voir createActeur). */
function generateTemporaryPassword(): string {
  return randomBytes(20).toString('base64url')
}

export interface CreatedActeur {
  acteur: Acteur
  temporaryPassword: string
}

/**
 * Création réservée à ADMIN_APP : fiche ACTEUR + compte Supabase Auth (sans
 * email d'invitation, mot de passe temporaire communiqué hors application) +
 * rattachement `profiles.matricule`. `must_change_password` (user_metadata)
 * force le changement à la première connexion — voir authAdmin.repository.ts
 * et components/RequireAuth.tsx côté frontend.
 */
export async function createActeur(input: unknown): Promise<CreatedActeur> {
  const result = createActeurSchema.safeParse(input)
  if (!result.success) throw new AppError(result.error.issues[0]?.message ?? 'Requête invalide', 400)

  const existing = await acteurRepository.findByMatricule(result.data.matricule)
  if (existing) throw new AppError(`Le matricule "${result.data.matricule}" existe déjà`, 409)

  const cellule = await celluleRepository.findById(result.data.idCellule)
  if (!cellule) throw new AppError('Cellule introuvable', 404)

  const temporaryPassword = generateTemporaryPassword()
  let userId: string
  try {
    userId = await authAdminRepository.createAuthUser(result.data.email, temporaryPassword)
  } catch (err) {
    // SECURITY.md §8 : ne jamais laisser une erreur technique (ici l'API Auth
    // Supabase) atteindre le client brute — cas prévisible (compte déjà
    // existant, ex. créé via database/seeds/createAuthUsers.ts ou directement
    // dans le dashboard) traduit en message métier 409, même principe que
    // libelleReferentiel.service.ts#deleteLibelle pour une contrainte Postgres.
    const code = (err as { code?: string })?.code
    if (code === 'email_exists') {
      throw new AppError(
        `Un compte existe déjà pour l'adresse "${result.data.email}" — supprimez-le dans Supabase (Authentication → Users) avant de réessayer, ou utilisez une autre adresse.`,
        409,
      )
    }
    throw err
  }
  // Compensation (décision du 10/09/2026, incident constaté : un compte Auth
  // orphelin — sans fiche ACTEUR ni lien profiles — a survécu à un échec
  // survenu après sa création, ex. double soumission du formulaire). Les 3
  // écritures (compte Auth, profiles, acteur) ne sont pas transactionnelles
  // (systèmes distincts), donc si l'une des deux étapes suivantes échoue, on
  // supprime nous-mêmes le compte Auth et la ligne profiles déjà créés plutôt
  // que de laisser un compte inutilisable derrière une erreur affichée.
  try {
    await authRepository.linkProfile(userId, result.data.matricule)

    const acteur = await acteurRepository.create({
      matricule: result.data.matricule,
      nom: result.data.nom,
      prenom: result.data.prenom,
      fonction: result.data.fonction,
      id_cellule: result.data.idCellule,
      actif: true,
    })

    return { acteur, temporaryPassword }
  } catch (err) {
    await authRepository.deleteProfile(userId).catch(() => undefined)
    await authAdminRepository.deleteAuthUser(userId).catch((cleanupErr) => {
      console.error('[acteur.service] Échec du nettoyage du compte Auth après une erreur de création :', cleanupErr)
    })
    throw err
  }
}

/**
 * Modification réservée à ADMIN_APP. Un passage ACTIF=true→false bannit
 * aussi le compte Auth (bloque une nouvelle connexion) ; ACTIF=false→true le
 * débannit — défense en profondeur avec la vérification ACTEUR.ACTIF dans
 * requireAuth.ts (coupe, elle, une session déjà active). Décision du
 * 10/09/2026.
 */
export async function updateActeur(matricule: string, input: unknown): Promise<Acteur> {
  const result = updateActeurSchema.safeParse(input)
  if (!result.success) throw new AppError(result.error.issues[0]?.message ?? 'Requête invalide', 400)

  const acteur = await acteurRepository.findByMatricule(matricule)
  if (!acteur) throw new AppError('Acteur introuvable', 404)

  if (result.data.idCellule !== undefined) {
    const cellule = await celluleRepository.findById(result.data.idCellule)
    if (!cellule) throw new AppError('Cellule introuvable', 404)
  }

  if (result.data.actif !== undefined && result.data.actif !== acteur.actif) {
    const userId = await authRepository.findUserIdByMatricule(matricule)
    if (userId) {
      if (result.data.actif) await authAdminRepository.unbanAuthUser(userId)
      else await authAdminRepository.banAuthUser(userId)
    }
  }

  return acteurRepository.update(matricule, {
    nom: result.data.nom,
    prenom: result.data.prenom,
    fonction: result.data.fonction,
    id_cellule: result.data.idCellule,
    actif: result.data.actif,
  })
}

/**
 * Suppression réservée à ADMIN_APP — cas résiduel d'un acteur créé par
 * erreur, jamais utilisé (décision du 10/09/2026, même principe que
 * fournisseur.service.ts#deleteFournisseur) : vérifie l'absence de toute
 * référence (ROLE_ATTRIBUTION, SUPPLEANCE, DEMANDE_ACHAT, HISTORIQUE_STATUT —
 * CERTIFICAT_SERVICE_FAIT non couvert, Phase 2 pas encore implémentée côté
 * backend) avant de supprimer la ligne ACTEUR, le compte Auth et la ligne
 * profiles. Sinon 409, invitant à désactiver l'acteur à la place.
 */
export async function deleteActeur(matricule: string): Promise<void> {
  const acteur = await acteurRepository.findByMatricule(matricule)
  if (!acteur) throw new AppError('Acteur introuvable', 404)

  const [usedByRole, usedBySuppleance, usedByDemandeAchat, usedByHistorique] = await Promise.all([
    roleAttributionRepository.existsForMatricule(matricule),
    suppleanceRepository.existsForMatriculeSuppleant(matricule),
    demandeAchatRepository.existsForMatriculeDemandeur(matricule),
    historiqueStatutRepository.existsForMatriculeActeur(matricule),
  ])
  if (usedByRole || usedBySuppleance || usedByDemandeAchat || usedByHistorique) {
    throw new AppError(
      'Cet acteur est référencé (rôle, suppléance, demande d\'achat ou historique) — impossible de le supprimer. Désactivez-le à la place.',
      409,
    )
  }

  const userId = await authRepository.findUserIdByMatricule(matricule)
  await acteurRepository.remove(matricule)
  if (userId) {
    await authRepository.deleteProfile(userId)
    await authAdminRepository.deleteAuthUser(userId)
  }
}
