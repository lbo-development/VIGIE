import { z } from 'zod'
import * as marcheRepository from '../repositories/marche.repository.js'
import * as cugRepository from '../repositories/cug.repository.js'
import * as fournisseurRepository from '../repositories/fournisseur.repository.js'
import * as acteurRepository from '../repositories/acteur.repository.js'
import * as roleAttributionRepository from '../repositories/roleAttribution.repository.js'
import { assertManagesServiceOrHasRoleCb } from './authorization.service.js'
import { findLastImportRow, type LastImportInfo } from './marcheImport.service.js'
import { AppError } from '../middlewares/errorHandler.js'
import type { Marche } from '../repositories/marche.repository.js'

export interface MarcheWithFournisseur extends Marche {
  /** FOURNISSEUR.RAISON_SOCIALE_SERVICE du titulaire (via MARCHE.ID_FOURNISSEUR), pas MARCHE.TITULAIRE_SERVICE (figé à la création, cf. import-marches-pgi.md §3). */
  fournisseur_raison_sociale: string | null
}

/**
 * États des marchés (/marches, voir Marches.tsx) — lecture ouverte à tout
 * utilisateur authentifié, scopée à son propre service (ACTEUR.ID_CELLULE →
 * CELLULE.ID_SERVICE) sauf ADMIN_APP, qui choisit librement le service cible.
 * Même principe que fournisseur.service.ts#resolveReadScope, en plus simple :
 * pas de priorité au rôle ADMIN_SERVICE ici (décision du 30/08/2026, voir
 * Marches.tsx — la page reste ouverte à tout acteur, pas seulement
 * ADMIN_SERVICE/CB comme l'import).
 */
async function resolveReadScope(matricule: string | null): Promise<{ isAdminApp: boolean; ownIdService: number | null }> {
  if (!matricule) throw new AppError('Authentification requise', 401)

  const roles = await roleAttributionRepository.findActiveByMatricule(matricule)
  if (roles.some((r) => r.type_role === 'ADMIN_APP')) return { isAdminApp: true, ownIdService: null }

  const ownIdService = await acteurRepository.findIdServiceByMatricule(matricule)
  return { isAdminApp: false, ownIdService }
}

/**
 * Tous les marchés (actifs et archivés confondus — le filtre Statut se fait
 * côté frontend, comme Fournisseurs.tsx) du service donné. `idService` n'a
 * d'effet que pour ADMIN_APP ; pour tout autre acteur, le service transmis
 * est ignoré au profit de son propre service (défense en profondeur, même
 * logique que fournisseur.service.ts).
 *
 * Chaque marché est enrichi de `fournisseur_raison_sociale`, résolu via
 * MARCHE.ID_FOURNISSEUR → FOURNISSEUR.RAISON_SOCIALE_SERVICE — décision du
 * 30/08/2026, affiché à côté de NUMMARCHE dans Marches.tsx. FOURNISSEUR est
 * scopé au même service (ID_SERVICE) que les marchés listés, donc un seul
 * `fournisseurRepository.findAll(effectiveIdService)` suffit à résoudre tous
 * les titulaires en une requête.
 *
 * Un marché est retrouvé soit par son CUG (CODE_CUG → CUG.ID_SERVICE, le cas
 * normal), soit par son fournisseur (ID_FOURNISSEUR → FOURNISSEUR.ID_SERVICE)
 * — secours nécessaire depuis le 01/09/2026 : la modale de création manuelle
 * n'a plus de champ CUG (CODE_CUG peut donc être `null`), et un tel marché
 * resterait invisible dans cette liste s'il n'était retrouvable que par CUG.
 * Les deux ensembles sont fusionnés et dédupliqués par NUMMARCHE.
 */
export async function listMarches(matricule: string | null, idService?: number): Promise<MarcheWithFournisseur[]> {
  const { isAdminApp, ownIdService } = await resolveReadScope(matricule)

  const effectiveIdService = isAdminApp ? idService : (ownIdService ?? undefined)
  if (effectiveIdService === undefined) return []

  const [cugs, fournisseurs] = await Promise.all([
    cugRepository.findAll(effectiveIdService),
    fournisseurRepository.findAll(effectiveIdService),
  ])
  const cugCodes = cugs.map((c) => c.code_cug)
  const fournisseurIds = fournisseurs.map((f) => f.id_fournisseur)
  const [marchesByCug, marchesByFournisseur] = await Promise.all([
    marcheRepository.findByCugCodes(cugCodes),
    marcheRepository.findByFournisseurIds(fournisseurIds),
  ])

  const marchesByNummarche = new Map([...marchesByCug, ...marchesByFournisseur].map((m) => [m.nummarche, m]))

  const raisonSocialeById = new Map(fournisseurs.map((f) => [f.id_fournisseur, f.raison_sociale_service]))
  return Array.from(marchesByNummarche.values()).map((m) => ({
    ...m,
    fournisseur_raison_sociale: m.id_fournisseur !== null ? (raisonSocialeById.get(m.id_fournisseur) ?? null) : null,
  }))
}

/**
 * « État des marchés au [date] » (MarchesPGI.tsx, décision du 01/09/2026) —
 * lecture ouverte à tout utilisateur authentifié pour son propre service,
 * ADMIN_APP pouvant consulter n'importe quel service (même règle d'accès que
 * `listMarches` ci-dessus). Réutilise `findLastImportRow`
 * (marcheImport.service.ts), qui lit la ligne exacte du paramètre pour CE
 * service — jamais l'héritage direction/global de `parametre_effectif` : une
 * inexactitude qui n'aurait aucun sens ici (le service consulté doit voir SA
 * propre date d'import, pas une valeur héritée). Ne PAS réutiliser
 * `getLastImportInfo` (marcheImport.service.ts) à la place : celle-ci réserve
 * la même lecture à ADMIN_APP/ADMIN_SERVICE/CB, adapté à l'écran d'import
 * mais pas à MarchesPGI.tsx, ouvert à tout acteur.
 */
export async function getLastImportStatus(matricule: string | null, idService?: number): Promise<LastImportInfo> {
  const { isAdminApp, ownIdService } = await resolveReadScope(matricule)
  const effectiveIdService = isAdminApp ? idService : (ownIdService ?? undefined)
  if (effectiveIdService === undefined) return { exists: false, valeur: null }
  return findLastImportRow(effectiveIdService)
}

export interface MarcheOptions {
  acteurs: { matricule: string; nom: string; prenom: string }[]
}

/**
 * Données de la modale « Modifier » (icône carte, MarchesPGI.tsx) : acteurs
 * du service donné, pour la liste « Agent gestionnaire ». Autorisation
 * `assertManagesServiceOrHasRoleCb` (ADMIN_APP/ADMIN_SERVICE/CB) — endpoint
 * dédié plutôt que de réutiliser `cug.service.ts#listCug` (réservé à
 * ADMIN_APP/ADMIN_SERVICE, CB explicitement exclu, décision du 29/08/2026
 * pour l'écran Réglages). Ne renvoie plus les CUG depuis le 01/09/2026
 * (`code_cug` ne fait pas partie des champs modifiables via « Modifier » —
 * voir `updateMarcheManagedFields` — et la création manuelle, seule
 * consommatrice de la liste CUG, a été retirée le même jour).
 */
export async function listMarcheOptions(matricule: string | null, idService: number): Promise<MarcheOptions> {
  await assertManagesServiceOrHasRoleCb(matricule, idService)

  const acteurs = await acteurRepository.findAllByService(idService)

  return {
    acteurs: acteurs.map((a) => ({ matricule: a.matricule, nom: a.nom, prenom: a.prenom })),
  }
}

const TYPEDECOMPOPRIX_VALUES = ['FORFAIT', 'BPU'] as const
const NATUREPRESTA_VALUES = ['TRAVAUX', 'FOURNITURES', 'SERVICES'] as const

const updateMarcheManagedFieldsSchema = z.object({
  typedecompoprix: z.enum(TYPEDECOMPOPRIX_VALUES).nullable().optional(),
  naturepresta: z.enum(NATUREPRESTA_VALUES).nullable().optional(),
  libelleService: z.string().trim().min(1, 'Le libellé est obligatoire.').max(500),
  agentgestion: z.string().trim().max(200).nullable().optional(),
  alertedate: z.number().int().nonnegative(),
  // Ratio (0.8), pas un pourcentage — la conversion depuis la saisie en % se fait côté frontend.
  alertemt: z.number().min(0).max(1),
  planpreventionactif: z.string().trim().max(500).nullable().optional(),
})

/**
 * Résout le service d'un marché existant — même double voie que `listMarches`
 * (CODE_CUG → CUG.ID_SERVICE, sinon ID_FOURNISSEUR → FOURNISSEUR.ID_SERVICE) :
 * nécessaire ici pour autoriser la modification (`assertManagesServiceOrHasRoleCb`
 * a besoin d'un idService), alors que `finances.marche` n'a pas de colonne
 * id_service directe.
 */
async function resolveMarcheIdService(marche: Marche): Promise<number | null> {
  if (marche.code_cug) {
    const cug = await cugRepository.findByCode(marche.code_cug)
    if (cug) return cug.id_service
  }
  if (marche.id_fournisseur !== null) {
    const fournisseur = await fournisseurRepository.findById(marche.id_fournisseur)
    if (fournisseur) return fournisseur.id_service
  }
  return null
}

/**
 * Modification d'un marché existant — réservée ADMIN_APP/ADMIN_SERVICE/CB
 * (`assertManagesServiceOrHasRoleCb`), icône « Modifier » des cartes de
 * MarchesPGI.tsx. Décision du 01/09/2026 : **aucune création manuelle** de
 * marché n'est possible dans cette application — seul l'import PGI crée des
 * lignes dans `finances.marche` (voir `marcheImport.service.ts`) — et aucune
 * suppression ni désactivation manuelle non plus (`ACTIF` n'est réécrit que
 * par l'archivage de l'import, `marche.repository.ts#archiveMany`). Seuls ces
 * sept champs sont modifiables, jamais NUMMARCHE/le fournisseur/le CUG ni les
 * dates/montants (réécrits uniquement par l'import) — **ni `TYPEPROC`**
 * (retiré le 01/09/2026, quelques heures après son ajout à cette liste :
 * renseigné à l'import, jamais modifiable ensuite, décision explicite de
 * l'utilisateur).
 *
 * `COMPLETUDE` recalculée à chaque modification (décision du 01/09/2026,
 * remplace le calcul figé à la création manuelle, désormais retirée) : `true`
 * si `TYPEPROC` (lu sur la ligne existante, jamais sur l'entrée puisqu'il
 * n'est plus modifiable — toujours renseigné en pratique, colonne NOT NULL),
 * `TYPEDECOMPOPRIX`, `NATUREPRESTA`, `LIBELLE_SERVICE`, `AGENTGESTION`,
 * `ALERTEDATE` et `ALERTEMT` sont tous renseignés — `PLANPREVENTIONACTIF`
 * n'en fait volontairement pas partie (décision explicite de l'utilisateur).
 */
export async function updateMarcheManagedFields(matricule: string | null, nummarche: string, input: unknown): Promise<Marche> {
  const result = updateMarcheManagedFieldsSchema.safeParse(input)
  if (!result.success) throw new AppError(result.error.issues[0]?.message ?? 'Requête invalide', 400)
  const data = result.data

  const existing = await marcheRepository.findByNummarche(nummarche)
  if (!existing) throw new AppError('Marché introuvable', 404)

  const idService = await resolveMarcheIdService(existing)
  await assertManagesServiceOrHasRoleCb(matricule, idService)

  const typedecompoprix = data.typedecompoprix ?? null
  const naturepresta = data.naturepresta ?? null
  const agentgestion = data.agentgestion ?? null
  const libelleService = data.libelleService.trim()

  const completude =
    existing.typeproc != null &&
    typedecompoprix != null &&
    naturepresta != null &&
    libelleService !== '' &&
    agentgestion != null &&
    data.alertedate != null &&
    data.alertemt != null

  return marcheRepository.updateManagedFields(nummarche, {
    typedecompoprix,
    naturepresta,
    libelle_service: libelleService,
    agentgestion,
    alertedate: data.alertedate,
    alertemt: data.alertemt,
    planpreventionactif: data.planpreventionactif ?? null,
    completude,
  })
}
