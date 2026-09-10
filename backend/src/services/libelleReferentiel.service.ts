import { z } from 'zod'
import * as libelleReferentielRepository from '../repositories/libelleReferentiel.repository.js'
import * as authRepository from '../repositories/auth.repository.js'
import { AppError } from '../middlewares/errorHandler.js'
import type { LibelleReferentiel } from '../repositories/libelleReferentiel.repository.js'

/** Domaines couverts par le référentiel — étendre ici lors de l'ajout d'une nouvelle liste. */
export const DOMAINES = ['TYPE_PIECE_MARCHE', 'TYPE_PIECE_INVESTISSEMENT', 'TYPE_PIECE_FAD'] as const
export type Domaine = (typeof DOMAINES)[number]

const domaineSchema = z.enum(DOMAINES)
const listSchema = z.object({ domaine: domaineSchema })

const createSchema = z.object({
  domaine: domaineSchema,
  code: z.string().trim().min(1, 'Code requis.').max(50, 'Code trop long (50 caractères max).'),
  libelle: z.string().trim().min(1, 'Libellé requis.').max(200, 'Libellé trop long (200 caractères max).'),
  // Pas de champ "ordre" côté écran (même principe que sousSecteur.service.ts#createSousSecteurSchema) : une
  // nouvelle valeur atterrit à 0, l'ADMIN_APP la repositionne ensuite par glisser-déposer (voir reorderLibelles).
  ordre: z.number().int().min(0).default(0),
  actif: z.boolean().default(true),
})

const updateSchema = z.object({
  libelle: z.string().trim().min(1, 'Libellé requis.').max(200).optional(),
  ordre: z.number().int().min(0).optional(),
  actif: z.boolean().optional(),
})

const reorderSchema = z.object({
  domaine: domaineSchema,
  codes: z.array(z.string().min(1)).min(1),
})

/** Écriture (création/modification/suppression) réservée ADMIN_APP — référentiel transverse, pas de scoping par service (voir migration 20260905090000_create_libelle_referentiel.sql). */
async function assertAdminApp(matricule: string | null): Promise<void> {
  if (!matricule) throw new AppError('Authentification requise', 401)
  const isAdminApp = await authRepository.hasActiveRole(matricule, 'ADMIN_APP')
  if (!isAdminApp) throw new AppError('Droits insuffisants', 403)
}

/** Erreur Postgres 23503 (foreign_key_violation) — code encore référencé par au moins une pièce. */
function isForeignKeyViolation(err: unknown): boolean {
  return typeof err === 'object' && err !== null && 'code' in err && (err as { code: unknown }).code === '23503'
}

/**
 * Lecture ouverte à tout utilisateur authentifié (RLS libelle_referentiel_select_authenticated)
 * — sert à peupler les listes déroulantes de dépôt/édition de pièce marché/investissement.
 */
export async function listByDomaine(matricule: string | null, query: unknown): Promise<LibelleReferentiel[]> {
  if (!matricule) throw new AppError('Authentification requise', 401)

  const result = listSchema.safeParse(query)
  if (!result.success) throw new AppError(result.error.issues[0]?.message ?? 'Requête invalide', 400)

  return libelleReferentielRepository.findAllByDomaine(result.data.domaine)
}

/**
 * Valide qu'un code est actif pour le domaine donné — utilisé par marchePiece.service.ts et
 * investissementPiece.service.ts avant tout dépôt/modification de pièce, en remplacement du CHECK
 * SQL figé supprimé par la migration 20260905090000 (désormais une FK composite vers ce
 * référentiel, qui ne bloque que les codes inconnus, pas les codes désactivés).
 */
export async function assertCodeActif(domaine: Domaine, code: string): Promise<void> {
  const rows = await libelleReferentielRepository.findAllByDomaine(domaine)
  const found = rows.find((row) => row.code === code)
  if (!found || !found.actif) throw new AppError(`Type de pièce "${code}" invalide.`, 400)
}

/** Création réservée ADMIN_APP — voir Reglages.tsx/Cug.tsx pour le même patron d'écran d'administration. */
export async function createLibelle(matricule: string | null, input: unknown): Promise<LibelleReferentiel> {
  await assertAdminApp(matricule)

  const result = createSchema.safeParse(input)
  if (!result.success) throw new AppError(result.error.issues[0]?.message ?? 'Requête invalide', 400)

  const existing = await libelleReferentielRepository.findOne(result.data.domaine, result.data.code)
  if (existing) throw new AppError(`Le code "${result.data.code}" existe déjà pour ce domaine.`, 409)

  return libelleReferentielRepository.create(result.data)
}

/** CODE et DOMAINE ne sont jamais modifiables après création (clé naturelle composite, comme CODE_CUG). */
export async function updateLibelle(matricule: string | null, domaine: unknown, code: string, input: unknown): Promise<LibelleReferentiel> {
  await assertAdminApp(matricule)

  const domaineResult = domaineSchema.safeParse(domaine)
  if (!domaineResult.success) throw new AppError('Domaine invalide.', 400)

  const existing = await libelleReferentielRepository.findOne(domaineResult.data, code)
  if (!existing) throw new AppError('Valeur du référentiel introuvable.', 404)

  const result = updateSchema.safeParse(input)
  if (!result.success) throw new AppError(result.error.issues[0]?.message ?? 'Requête invalide', 400)

  return libelleReferentielRepository.update(domaineResult.data, code, result.data)
}

/**
 * Suppression physique réservée ADMIN_APP — bloquée par la FK des tables clientes (marche_piece,
 * investissement_piece) tant qu'un code est utilisé : la violation Postgres est traduite ici en
 * message métier plutôt que de remonter au client (SECURITY.md §8), ACTIF reste le moyen normal de
 * retirer un code des formulaires de saisie sans en perdre l'historique.
 */
export async function deleteLibelle(matricule: string | null, domaine: unknown, code: string): Promise<void> {
  await assertAdminApp(matricule)

  const domaineResult = domaineSchema.safeParse(domaine)
  if (!domaineResult.success) throw new AppError('Domaine invalide.', 400)

  const existing = await libelleReferentielRepository.findOne(domaineResult.data, code)
  if (!existing) throw new AppError('Valeur du référentiel introuvable.', 404)

  try {
    await libelleReferentielRepository.remove(domaineResult.data, code)
  } catch (err) {
    if (isForeignKeyViolation(err)) {
      throw new AppError('Ce code est utilisé par au moins une pièce existante — désactivez-le au lieu de le supprimer.', 409)
    }
    throw err
  }
}

/**
 * Réordonne les codes d'un même domaine (glisser-déposer côté écran — voir
 * frontend/src/hooks/useDragReorder.ts), même principe que
 * secteur.service.ts#reorderSecteurs : refuse explicitement tout code qui n'appartient pas au
 * domaine annoncé plutôt que de faire confiance à l'ordre reçu.
 */
export async function reorderLibelles(matricule: string | null, input: unknown): Promise<void> {
  await assertAdminApp(matricule)

  const result = reorderSchema.safeParse(input)
  if (!result.success) throw new AppError(result.error.issues[0]?.message ?? 'Requête invalide', 400)

  const rows = await libelleReferentielRepository.findAllByDomaine(result.data.domaine)
  const allBelongToDomaine = result.data.codes.every((code) => rows.some((row) => row.code === code))
  if (!allBelongToDomaine) throw new AppError('Un des codes ne correspond pas au domaine indiqué.', 400)

  await libelleReferentielRepository.reorder(result.data.domaine, result.data.codes)
}
