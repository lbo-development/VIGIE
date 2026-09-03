import { z } from 'zod'
import * as marcheTiersRepository from '../repositories/marcheTiers.repository.js'
import * as fournisseurRepository from '../repositories/fournisseur.repository.js'
import * as acteurRepository from '../repositories/acteur.repository.js'
import * as roleAttributionRepository from '../repositories/roleAttribution.repository.js'
import * as demandeAchatRepository from '../repositories/demandeAchat.repository.js'
import { assertManagesServiceOrHasRoleCb } from './authorization.service.js'
import { deriveTypeProc } from './marcheImport.service.js'
import { AppError } from '../middlewares/errorHandler.js'
import type { MarcheTiers } from '../repositories/marcheTiers.repository.js'

const NUMMARCHE_REGEX = /^[PMS]\d{7}[A-Za-z0-9]*$/
const TYPEDECOMPOPRIX_VALUES = ['FORFAIT', 'BPU'] as const
const ALERTEDATE_DEFAUT = 120
const LIBELLE_MIN_LENGTH = 15

/**
 * ACTIF forcé à `false` si DTEFINMAX est déjà dépassée (décision du
 * 02/09/2026, recalculé à chaque création/modification — jamais une
 * contrainte DB, voir migration 20260902100000_marche_tiers_champs_obligatoires.sql).
 * Comparaison de chaînes ISO 'YYYY-MM-DD', même principe que
 * MarchesPGI.tsx#enregistres (`DTEFINMAX >= aujourd'hui`).
 */
function isMarcheTiersExpire(dtefinmax: string): boolean {
  const today = new Date().toISOString().slice(0, 10)
  return dtefinmax < today
}

/**
 * Lecture ouverte à tout utilisateur authentifié pour son propre service —
 * ADMIN_APP (transverse) choisit librement le service consulté. Même
 * principe que marche.service.ts#resolveReadScope, **pas** le
 * resolveReadScope fermé de cug.service.ts (qui rejette en 403 sans
 * ADMIN_APP/ADMIN_SERVICE) : décision du 01/09/2026, ces marchés servent à
 * tout agent créant une demande d'achat, pas seulement aux admins.
 */
async function resolveReadScope(matricule: string | null): Promise<{ isAdminApp: boolean; ownIdService: number | null }> {
  if (!matricule) throw new AppError('Authentification requise', 401)

  const roles = await roleAttributionRepository.findActiveByMatricule(matricule)
  if (roles.some((r) => r.type_role === 'ADMIN_APP')) return { isAdminApp: true, ownIdService: null }

  const ownIdService = await acteurRepository.findIdServiceByMatricule(matricule)
  return { isAdminApp: false, ownIdService }
}

/**
 * Marchés d'un service tiers (/marches/tiers, voir MarchesTiers.tsx) —
 * jamais mélangés avec finances.marche (décision explicite du 01/09/2026).
 */
export async function listMarcheTiers(matricule: string | null, idService?: number): Promise<MarcheTiers[]> {
  const { isAdminApp, ownIdService } = await resolveReadScope(matricule)
  const effectiveIdService = isAdminApp ? idService : (ownIdService ?? undefined)
  if (effectiveIdService === undefined) return []
  return marcheTiersRepository.findAll(effectiveIdService)
}

const createMarcheTiersSchema = z.object({
  idService: z.number().int(),
  nummarche: z
    .string()
    .trim()
    .toUpperCase()
    .regex(
      NUMMARCHE_REGEX,
      'Le numéro de marché doit commencer par P, M ou S, suivi de 7 chiffres (un suffixe alphanumérique est autorisé ensuite).',
    ),
  libelleService: z
    .string()
    .trim()
    .min(LIBELLE_MIN_LENGTH, `Le libellé doit contenir au moins ${LIBELLE_MIN_LENGTH} caractères.`)
    .max(500),
  idFournisseur: z.number().int(),
  mtmaxi: z.number().nonnegative(),
  dtedebut: z.string().trim().min(1, 'La date de début est obligatoire.'),
  dtefinmax: z.string().trim().min(1, 'La date de fin maximum est obligatoire.'),
  typedecompoprix: z.enum(TYPEDECOMPOPRIX_VALUES, { message: 'La décomposition du prix est obligatoire.' }),
  agentgestion: z.string().trim().min(1, "L'agent gestionnaire est obligatoire.").max(200),
  alertedate: z.number().int().nonnegative().default(ALERTEDATE_DEFAUT),
  commentaire: z.string().trim().max(2000).nullable().optional(),
})

/**
 * Création d'un marché tiers — réservée ADMIN_APP/ADMIN_SERVICE/CB
 * (`assertManagesServiceOrHasRoleCb`, même règle que l'import PGI). TYPEPROC
 * n'est jamais saisi : déduit du préfixe de NUMMARCHE via `deriveTypeProc`
 * (marcheImport.service.ts), comme à l'import — contrairement à
 * CreateMarcheModal (marche.service.ts#createMarche) où c'est un choix
 * explicite. Unicité par (ID_SERVICE, NUMMARCHE) seulement : un autre
 * service peut légitimement enregistrer le même numéro tiers indépendamment.
 *
 * Décision du 02/09/2026 : titulaire, libellé (≥ 15 caractères), décomposition
 * du prix, agent gestionnaire, montant maximum, date de début et date de fin
 * maximum sont désormais obligatoires (schéma Zod ci-dessus) — contrôlés
 * aussi en base (voir migrations 20260902100000_marche_tiers_champs_obligatoires.sql
 * et 20260902110000_marche_tiers_dtedebut_obligatoire.sql). `ACTIF` forcé à
 * `false` si DTEFINMAX est déjà dépassée à la création (voir
 * `isMarcheTiersExpire`), sinon `true` comme avant.
 */
export async function createMarcheTiers(matricule: string | null, input: unknown): Promise<MarcheTiers> {
  const result = createMarcheTiersSchema.safeParse(input)
  if (!result.success) throw new AppError(result.error.issues[0]?.message ?? 'Requête invalide', 400)
  const data = result.data

  await assertManagesServiceOrHasRoleCb(matricule, data.idService)

  const typeproc = deriveTypeProc(data.nummarche)
  if (!typeproc) {
    throw new AppError('Le numéro de marché doit commencer par P, M ou S.', 400)
  }

  const fournisseur = await fournisseurRepository.findById(data.idFournisseur)
  if (!fournisseur || fournisseur.id_service !== data.idService) {
    throw new AppError("Le fournisseur sélectionné n'appartient pas au service cible.", 400)
  }

  const existing = await marcheTiersRepository.findByNummarche(data.idService, data.nummarche)
  if (existing) throw new AppError(`Le marché tiers "${data.nummarche}" existe déjà pour ce service.`, 409)

  return marcheTiersRepository.create({
    id_service: data.idService,
    nummarche: data.nummarche,
    libelle_service: data.libelleService,
    id_fournisseur: data.idFournisseur,
    mtmaxi: data.mtmaxi,
    dtedebut: data.dtedebut,
    dtefinmax: data.dtefinmax,
    typeproc,
    typedecompoprix: data.typedecompoprix,
    agentgestion: data.agentgestion,
    alertedate: data.alertedate,
    actif: !isMarcheTiersExpire(data.dtefinmax),
    commentaire: data.commentaire ?? null,
  })
}

const updateMarcheTiersSchema = z.object({
  libelleService: z
    .string()
    .trim()
    .min(LIBELLE_MIN_LENGTH, `Le libellé doit contenir au moins ${LIBELLE_MIN_LENGTH} caractères.`)
    .max(500),
  idFournisseur: z.number().int(),
  mtmaxi: z.number().nonnegative(),
  dtedebut: z.string().trim().min(1, 'La date de début est obligatoire.'),
  dtefinmax: z.string().trim().min(1, 'La date de fin maximum est obligatoire.'),
  typedecompoprix: z.enum(TYPEDECOMPOPRIX_VALUES, { message: 'La décomposition du prix est obligatoire.' }),
  agentgestion: z.string().trim().min(1, "L'agent gestionnaire est obligatoire.").max(200),
  alertedate: z.number().int().nonnegative().optional(),
  actif: z.boolean().optional(),
  commentaire: z.string().trim().max(2000).nullable().optional(),
})

/**
 * Décision du 02/09/2026 (étendue le même jour à DTEDEBUT) : mêmes champs
 * obligatoires qu'à la création (voir
 * `createMarcheTiers`) — le formulaire de modification (`MarchesTiers.tsx`)
 * renvoie de toute façon l'intégralité de ces champs à chaque soumission,
 * jamais un sous-ensemble partiel. `ACTIF` recalculé de la même façon : forcé
 * à `false` si DTEFINMAX est dépassée, quel que soit le choix fait via
 * l'interrupteur "Actif" de la modale ; sinon la valeur soumise (ou l'existante
 * si `actif` absent du payload) est conservée.
 */
export async function updateMarcheTiers(matricule: string | null, idMarcheTiers: number, input: unknown): Promise<MarcheTiers> {
  const result = updateMarcheTiersSchema.safeParse(input)
  if (!result.success) throw new AppError(result.error.issues[0]?.message ?? 'Requête invalide', 400)
  const data = result.data

  const existing = await marcheTiersRepository.findById(idMarcheTiers)
  if (!existing) throw new AppError('Marché tiers introuvable', 404)

  await assertManagesServiceOrHasRoleCb(matricule, existing.id_service)

  const fournisseur = await fournisseurRepository.findById(data.idFournisseur)
  if (!fournisseur || fournisseur.id_service !== existing.id_service) {
    throw new AppError("Le fournisseur sélectionné n'appartient pas au service cible.", 400)
  }

  const actif = isMarcheTiersExpire(data.dtefinmax) ? false : (data.actif ?? existing.actif)

  return marcheTiersRepository.update(idMarcheTiers, {
    libelle_service: data.libelleService,
    id_fournisseur: data.idFournisseur,
    mtmaxi: data.mtmaxi,
    dtedebut: data.dtedebut,
    dtefinmax: data.dtefinmax,
    typedecompoprix: data.typedecompoprix,
    agentgestion: data.agentgestion,
    alertedate: data.alertedate,
    actif,
    commentaire: data.commentaire,
  })
}

/**
 * Suppression physique (icône corbeille, MarchesTiers.tsx, décision du
 * 02/09/2026) — réservée ADMIN_APP/ADMIN_SERVICE/CB
 * (`assertManagesServiceOrHasRoleCb`, même règle que création/modification),
 * et seulement si aucune DEMANDE_ACHAT ne référence encore ce marché tiers
 * (`demandeAchatRepository.existsForMarcheTiers`, possible depuis l'ajout de
 * DEMANDE_ACHAT.ID_MARCHE_TIERS — voir migration
 * 20260902090000_demande_achat_add_marche_tiers_ref.sql). Filet de sécurité :
 * la FK correspondante n'a pas de ON DELETE CASCADE, Postgres refuserait de
 * toute façon la suppression en cas de bug ici (même principe que
 * fournisseur.service.ts#deleteFournisseur).
 */
export async function deleteMarcheTiers(matricule: string | null, idMarcheTiers: number): Promise<void> {
  const existing = await marcheTiersRepository.findById(idMarcheTiers)
  if (!existing) throw new AppError('Marché tiers introuvable', 404)

  await assertManagesServiceOrHasRoleCb(matricule, existing.id_service)

  const usedByDemandeAchat = await demandeAchatRepository.existsForMarcheTiers(idMarcheTiers)
  if (usedByDemandeAchat) {
    throw new AppError(
      "Ce marché tiers est encore référencé par une demande d'achat — impossible de le supprimer. Passez-le en Inactif à la place.",
      409,
    )
  }

  await marcheTiersRepository.remove(idMarcheTiers)
}
