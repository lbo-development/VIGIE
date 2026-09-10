import { z } from 'zod'
import * as demandeAchatRepository from '../repositories/demandeAchat.repository.js'
import * as devisConsulteRepository from '../repositories/devisConsulte.repository.js'
import * as pieceJointeRepository from '../repositories/pieceJointe.repository.js'
import * as historiqueStatutRepository from '../repositories/historiqueStatut.repository.js'
import * as acteurRepository from '../repositories/acteur.repository.js'
import * as celluleRepository from '../repositories/cellule.repository.js'
import * as roleAttributionRepository from '../repositories/roleAttribution.repository.js'
import * as authRepository from '../repositories/auth.repository.js'
import * as marcheRepository from '../repositories/marche.repository.js'
import * as marcheTiersRepository from '../repositories/marcheTiers.repository.js'
import * as fournisseurRepository from '../repositories/fournisseur.repository.js'
import { resolveMarcheIdService } from './marche.service.js'
import * as libelleReferentielService from './libelleReferentiel.service.js'
import { AppError } from '../middlewares/errorHandler.js'
import type { DemandeAchat, DemandeAchatUpdate } from '../repositories/demandeAchat.repository.js'
import type { PieceJointe } from '../repositories/pieceJointe.repository.js'

/**
 * Statuts pour lesquels la page DemandeAchat reste pertinente (décision du
 * 07/09/2026) : le Demandeur/RC/ADMIN_SERVICE n'agit plus sur la DA une fois
 * transmise — voir ForClaude/CDC/mot-phases-1-2.md OP1.1.
 */
const STATUTS_PAGE_DEMANDE_ACHAT = ['DA_EN_PREPARATION', 'DA_A_COMPLETER']

/** Seul ce statut autorise la suppression physique (décision du 07/09/2026). */
const STATUT_SUPPRESSIBLE = 'DA_EN_PREPARATION'

/**
 * Statuts encore éditables par le Demandeur/RC (Modifier une DA) — la
 * reprise DA_A_COMPLETER est un retour en place, pas un statut figé.
 */
const STATUTS_MODIFIABLES = ['DA_EN_PREPARATION', 'DA_A_COMPLETER']

type Role = 'ADMIN_APP' | 'ADMIN_SERVICE' | 'RC' | 'DEMANDEUR'

interface AccessContext {
  role: Role
  /** Service dans lequel l'acteur agit (celui de sa cellule pour RC, le sien pour ADMIN_SERVICE, celui de son propre rattachement pour un Demandeur). Null pour ADMIN_APP (transverse). */
  ownIdService: number | null
  /** Cellule d'appartenance du RC — sert de portée par défaut sur la liste (« accès à toutes les DA de sa cellule »), jamais utilisée pour la création. */
  ownIdCellule: number | null
}

/**
 * Résout le rôle effectif de l'acteur connecté pour ce module — priorité
 * ADMIN_APP > ADMIN_SERVICE > RC > Demandeur (sans rôle dédié), un acteur
 * pouvant cumuler plusieurs rôles (Phase 1, cf. MOT « Points d'attention »).
 * Voir la matrice validée le 07/09/2026 (conversation DA.pdf) : Direction/
 * Service/Cellule figés pour RC, Direction/Service figés + Cellule
 * sélectionnable pour ADMIN_SERVICE, tout sélectionnable pour ADMIN_APP.
 */
async function resolveAccessContext(matricule: string): Promise<AccessContext> {
  if (await authRepository.hasActiveRole(matricule, 'ADMIN_APP')) {
    return { role: 'ADMIN_APP', ownIdService: null, ownIdCellule: null }
  }

  const roles = await roleAttributionRepository.findActiveByMatricule(matricule)

  const adminService = roles.find((r) => r.type_role === 'ADMIN_SERVICE' && r.id_service !== null)
  if (adminService) {
    return { role: 'ADMIN_SERVICE', ownIdService: adminService.id_service, ownIdCellule: null }
  }

  const rc = roles.find((r) => r.type_role === 'RC' && r.id_cellule !== null)
  if (rc) {
    const cellule = await celluleRepository.findById(rc.id_cellule as number)
    return { role: 'RC', ownIdService: cellule?.id_service ?? null, ownIdCellule: rc.id_cellule }
  }

  const ownIdService = await acteurRepository.findIdServiceByMatricule(matricule)
  return { role: 'DEMANDEUR', ownIdService, ownIdCellule: null }
}

/**
 * Autorise la création/modification d'une DA pour le compte de
 * matriculeDemandeurCible — un Demandeur ne peut agir que pour lui-même ;
 * RC et ADMIN_SERVICE pour tout demandeur de leur propre service (même
 * règle pour les deux, seule la façon de le sélectionner à l'écran diffère
 * — filtre Demandeur direct pour RC, tiroir Cellule puis Demandeur pour
 * ADMIN_SERVICE) ; ADMIN_APP sans restriction. Retourne l'ID_SERVICE à
 * figer sur la DA (décision du 07/09/2026 : figé à la création, jamais
 * recalculé si le service du demandeur est réorganisé ensuite).
 */
async function assertCanActFor(matricule: string, matriculeDemandeurCible: string): Promise<number> {
  const targetIdService = await acteurRepository.findIdServiceByMatricule(matriculeDemandeurCible)
  if (targetIdService === null) throw new AppError('Demandeur introuvable ou non rattaché à un service.', 404)

  const context = await resolveAccessContext(matricule)

  if (context.role === 'ADMIN_APP') return targetIdService
  if (context.role === 'ADMIN_SERVICE' || context.role === 'RC') {
    if (context.ownIdService === targetIdService) return targetIdService
    throw new AppError('Droits insuffisants pour ce service.', 403)
  }
  // DEMANDEUR : uniquement pour lui-même.
  if (matricule === matriculeDemandeurCible) return targetIdService
  throw new AppError('Un demandeur ne peut créer une DA que pour lui-même.', 403)
}

const createSchema = z.object({
  matriculeDemandeurCible: z.string().trim().min(1).optional(),
})

/**
 * OP1.1 (création progressive, décision du 07/09/2026) : crée immédiatement
 * le brouillon DA_EN_PREPARATION — CreationDA n'est ensuite qu'un écran
 * d'édition. matriculeDemandeurCible absent = création pour soi-même
 * (cas Demandeur, pas de sélecteur à l'écran).
 */
export async function createDemandeAchat(matricule: string | null, input: unknown): Promise<DemandeAchat> {
  if (!matricule) throw new AppError('Authentification requise', 401)

  const result = createSchema.safeParse(input)
  if (!result.success) throw new AppError(result.error.issues[0]?.message ?? 'Requête invalide', 400)

  const cible = result.data.matriculeDemandeurCible ?? matricule
  const idService = await assertCanActFor(matricule, cible)

  return demandeAchatRepository.createBrouillon(idService, cible)
}

/** Consultation d'une DA précise (Modifier une DA, sous-écrans) — même règle d'accès que la création. */
export async function getDemandeAchat(matricule: string | null, idDemandeAchat: number): Promise<DemandeAchat> {
  if (!matricule) throw new AppError('Authentification requise', 401)

  const demandeAchat = await demandeAchatRepository.findById(idDemandeAchat)
  if (!demandeAchat) throw new AppError('Demande d\'achat introuvable', 404)

  await assertCanActFor(matricule, demandeAchat.matricule_demandeur)
  return demandeAchat
}

export interface ListQuery {
  idCellule?: number
  matriculeDemandeur?: string
  statut?: string
  search?: string
}

/**
 * Liste filtrée de la page DemandeAchat — portée par rôle (voir
 * resolveAccessContext) : Demandeur = uniquement lui-même ; RC = sa cellule
 * par défaut, ou le demandeur choisi (n'importe lequel du service) si
 * précisé ; ADMIN_SERVICE = tout son service par défaut, ou une cellule/un
 * demandeur choisi ; ADMIN_APP = sans restriction (filtres appliqués tels
 * quels s'ils sont fournis).
 */
export async function listDemandeAchat(matricule: string | null, query: ListQuery): Promise<DemandeAchat[]> {
  if (!matricule) throw new AppError('Authentification requise', 401)

  const context = await resolveAccessContext(matricule)
  const statuts = query.statut ? [query.statut] : STATUTS_PAGE_DEMANDE_ACHAT
  // Résolu une seule fois (décision du 09/09/2026) : la recherche texte porte aussi sur le
  // fournisseur retenu (ID_FOURNISSEUR_RETENU), pas seulement NUMERO/OBJET — voir
  // fournisseur.repository.ts#findIdsByRaisonSociale et demandeAchat.repository.ts#findAll.
  const idFournisseurIn = query.search ? await fournisseurRepository.findIdsByRaisonSociale(query.search) : undefined

  if (context.role === 'DEMANDEUR') {
    return demandeAchatRepository.findAll({
      matriculeDemandeurIn: [matricule],
      statuts,
      search: query.search,
      idFournisseurIn,
    })
  }

  if (query.matriculeDemandeur) {
    // Vérifie que le demandeur ciblé appartient bien au service géré par l'appelant (RC/ADMIN_SERVICE) — ADMIN_APP non concerné (transverse).
    if (context.role !== 'ADMIN_APP') await assertCanActFor(matricule, query.matriculeDemandeur)
    return demandeAchatRepository.findAll({ matriculeDemandeurIn: [query.matriculeDemandeur], statuts, search: query.search, idFournisseurIn })
  }

  if (query.idCellule !== undefined) {
    const cellule = await celluleRepository.findById(query.idCellule)
    if (!cellule) throw new AppError('Cellule introuvable', 404)
    if (context.role !== 'ADMIN_APP' && context.ownIdService !== cellule.id_service) {
      throw new AppError('Droits insuffisants pour cette cellule.', 403)
    }
    const acteurs = await acteurRepository.findAllByCellule(query.idCellule)
    return demandeAchatRepository.findAll({
      matriculeDemandeurIn: acteurs.map((a) => a.matricule),
      statuts,
      search: query.search,
      idFournisseurIn,
    })
  }

  if (context.role === 'RC') {
    // Vue par défaut : sa propre cellule (« accès à toutes les DA de sa cellule »).
    const acteurs = context.ownIdCellule !== null ? await acteurRepository.findAllByCellule(context.ownIdCellule) : []
    return demandeAchatRepository.findAll({
      matriculeDemandeurIn: acteurs.map((a) => a.matricule),
      statuts,
      search: query.search,
      idFournisseurIn,
    })
  }

  if (context.role === 'ADMIN_SERVICE') {
    return demandeAchatRepository.findAll({ idService: context.ownIdService ?? undefined, statuts, search: query.search, idFournisseurIn })
  }

  // ADMIN_APP sans filtre : transverse, aucune restriction.
  return demandeAchatRepository.findAll({ statuts, search: query.search, idFournisseurIn })
}

const updateSchema = z.object({
  objet: z.string().trim().min(15).max(75).optional(),
  description: z.string().trim().max(256).nullable().optional(),
  procedureAchat: z.enum(['MARCHE', 'HORS_MARCHE']).optional(),
  imputationComptable: z.enum(['FONCTIONNEMENT', 'INVESTISSEMENT']).nullable().optional(),
  typeAchat: z.enum(['TRAVAUX', 'FOURNITURES', 'SERVICES']).nullable().optional(),
  numeroOperation: z.string().trim().min(1).nullable().optional(),
  codeSite: z.string().trim().min(1).nullable().optional(),
  codeSousSite: z.string().trim().min(1).nullable().optional(),
  codeSecteur: z.string().trim().min(1).nullable().optional(),
  codeSousSecteur: z.string().trim().min(1).nullable().optional(),
  codeCug: z.string().trim().min(1).nullable().optional(),
})

/**
 * Édition d'un brouillon (CreationDA et sous-écrans) — accès identique à la
 * création, en plus gardé par le statut : seuls DA_EN_PREPARATION et
 * DA_A_COMPLETER restent modifiables (décision du 07/09/2026). Ne
 * différencie pas encore les champs propres au RC (OP1.2b, pas encore
 * implémenté) des champs du Demandeur — à affiner quand cet écran existera.
 */
export async function updateDemandeAchat(matricule: string | null, idDemandeAchat: number, input: unknown): Promise<DemandeAchat> {
  if (!matricule) throw new AppError('Authentification requise', 401)

  const result = updateSchema.safeParse(input)
  if (!result.success) throw new AppError(result.error.issues[0]?.message ?? 'Requête invalide', 400)

  const existing = await demandeAchatRepository.findById(idDemandeAchat)
  if (!existing) throw new AppError('Demande d\'achat introuvable', 404)

  await assertCanActFor(matricule, existing.matricule_demandeur)
  if (!STATUTS_MODIFIABLES.includes(existing.code_statut)) {
    throw new AppError('Cette demande d\'achat ne peut plus être modifiée à ce stade.', 409)
  }

  const data = result.data
  const procedureChanged = data.procedureAchat !== undefined && data.procedureAchat !== existing.procedure_achat

  // Nettoyage croisé (décision du 09/09/2026, étendu aux pièces complémentaires
  // le même jour lors de la refonte de la gestion documentaire) : un
  // changement de PROCEDURE_ACHAT rend toute la base documentaire de cette DA
  // orpheline (devis BPU du titulaire Marché sans plus aucun sens en Hors
  // marché, et vice versa ; pièces complémentaires rattachées à un fournisseur
  // qui n'a plus de raison d'être associé à la DA) — purgée immédiatement au
  // changement de procédure, pas seulement quand l'écran documentaire est
  // ensuite rouvert. Même principe que le nettoyage déjà en place dans
  // selectMarcheDemandeAchat.
  if (procedureChanged) {
    await purgeDevisConsulte(idDemandeAchat)
    await purgePieceJointe(idDemandeAchat)
  }

  const patch: DemandeAchatUpdate = {
    objet: data.objet,
    description: data.description,
    procedure_achat: data.procedureAchat,
    imputation_comptable: data.imputationComptable,
    type_achat: data.typeAchat,
    numero_operation: data.numeroOperation,
    code_site: data.codeSite,
    code_sous_site: data.codeSousSite,
    code_secteur: data.codeSecteur,
    code_sous_secteur: data.codeSousSecteur,
    code_cug: data.codeCug,
    // Bug corrigé le 09/09/2026 : la purge ci-dessus ne portait que sur
    // DEVIS_CONSULTE — NUMMARCHE/ID_MARCHE_TIERS/ID_FOURNISSEUR_RETENU/
    // MOTIF_CHOIX/LIBELLE_MOTIF_CHOIX restaient plantés sur DEMANDE_ACHAT
    // elle-même après un changement de procédure (un marché déjà sélectionné
    // restait affiché après bascule vers Hors marché, et inversement).
    // MONTANT_DEMANDE (NOT NULL) réinitialisé à 0, pas de saisie manuelle
    // possible dans CreationDA pour aucune des deux procédures (décision du
    // 09/09/2026) — sera reposé par MarcheDA/FournisseurDA.
    ...(procedureChanged && {
      nummarche: null,
      id_marche_tiers: null,
      id_fournisseur_retenu: null,
      motif_choix: null,
      libelle_motif_choix: null,
      montant_demande: 0,
    }),
  }
  // Ne transmet que les clés réellement fournies (un champ omis du body ne doit pas écraser sa valeur existante avec `undefined` — supabase-js ignore déjà les clés `undefined`, gardé explicite pour la lisibilité).
  return demandeAchatRepository.update(idDemandeAchat, patch)
}

const selectMarcheSchema = z
  .object({
    nummarche: z.string().trim().min(1).nullable(),
    idMarcheTiers: z.number().int().nullable(),
    // Saisie obligatoire à l'écran (croquis DA.pdf, Modale marcheDA — « La saisie du
    // montant est obligatoire avant l'enregistrement ») mais optionnel ici : c'est une
    // règle d'UX de cet écran, pas une contrainte de donnée (MONTANT_DEMANDE est déjà
    // NOT NULL en base, jamais réellement absent) — imposée côté frontend.
    montantDemande: z.number().nonnegative().optional(),
  })
  .refine((data) => !(data.nummarche !== null && data.idMarcheTiers !== null), {
    message: 'Un seul choix possible : un marché du service ou un marché tiers, jamais les deux.',
  })

/**
 * Écran MarcheDA (bouton « Marché concerné », CreationDA — procédure MARCHE
 * uniquement) : sélectionne (ou retire, si les deux champs sont `null`) le
 * marché du service ou le marché tiers rattaché à la DA, et ajuste au passage
 * MONTANT_DEMANDE (même champ que « Montant DA » de CreationDA — cf. croquis
 * DA.pdf page 3). Route dédiée plutôt que le PUT générique ci-dessus (décision
 * du 08/09/2026) : ID_FOURNISSEUR_RETENU et MOTIF_CHOIX en découlent
 * automatiquement (jamais saisis à la main, voir ForClaude/CDC/mld-phases-1-2.md)
 * et ne doivent jamais pouvoir être posés autrement que par cette dérivation —
 * d'où leur retrait de `updateSchema`.
 */
export async function selectMarcheDemandeAchat(matricule: string | null, idDemandeAchat: number, input: unknown): Promise<DemandeAchat> {
  if (!matricule) throw new AppError('Authentification requise', 401)

  const result = selectMarcheSchema.safeParse(input)
  if (!result.success) throw new AppError(result.error.issues[0]?.message ?? 'Requête invalide', 400)

  const existing = await demandeAchatRepository.findById(idDemandeAchat)
  if (!existing) throw new AppError('Demande d\'achat introuvable', 404)

  await assertCanActFor(matricule, existing.matricule_demandeur)
  if (!STATUTS_MODIFIABLES.includes(existing.code_statut)) {
    throw new AppError('Cette demande d\'achat ne peut plus être modifiée à ce stade.', 409)
  }
  if (existing.procedure_achat !== 'MARCHE') {
    throw new AppError('Cette demande d\'achat est en procédure hors marché.', 409)
  }

  const { nummarche, idMarcheTiers, montantDemande } = result.data

  // Nettoyage croisé (décision du 09/09/2026, étendue le même jour aux pièces
  // complémentaires lors de la refonte de la gestion documentaire) : purge
  // toute la base documentaire (devis + pièces complémentaires) uniquement si
  // la sélection change réellement (nummarche/idMarcheTiers différents de
  // l'existant) — jamais sur un simple ré-enregistrement du même marché (ex.
  // ajustement du montant), pour ne pas perdre un devis/une pièce déjà
  // déposé(e). Une DA Marché n'admet que 0 ou 1 ligne DEVIS_CONSULTE (voir
  // ForClaude/CDC/mld-phases-1-2.md, cardinalité par procédure) et un seul
  // fournisseur associé (le titulaire) : un changement de marché invalide le
  // devis et les pièces du titulaire précédent, jamais pertinents pour le
  // nouveau — purge globale de la DA suffisante (pas besoin de scoper par
  // fournisseur, il n'y en a qu'un à la fois en procédure Marché).
  const selectionChanged = existing.nummarche !== nummarche || existing.id_marche_tiers !== idMarcheTiers

  async function purgeDocumentationSiSelectionChangee(): Promise<void> {
    if (!selectionChanged) return
    await purgeDevisConsulte(idDemandeAchat)
    await purgePieceJointe(idDemandeAchat)
  }

  if (nummarche === null && idMarcheTiers === null) {
    await purgeDocumentationSiSelectionChangee()
    return demandeAchatRepository.update(idDemandeAchat, {
      nummarche: null,
      id_marche_tiers: null,
      id_fournisseur_retenu: null,
      motif_choix: null,
      montant_demande: montantDemande,
    })
  }

  let idFournisseurRetenu: number | null

  if (nummarche !== null) {
    const marche = await marcheRepository.findByNummarche(nummarche)
    if (!marche) throw new AppError('Marché introuvable.', 404)
    if (!marche.utilisable) throw new AppError('Ce marché n\'est pas utilisable (inactif ou incomplet).', 409)
    const marcheIdService = await resolveMarcheIdService(marche)
    if (marcheIdService !== existing.id_service) throw new AppError('Ce marché n\'appartient pas au service de la demande.', 403)
    idFournisseurRetenu = marche.id_fournisseur
  } else {
    const marcheTiers = await marcheTiersRepository.findById(idMarcheTiers as number)
    if (!marcheTiers) throw new AppError('Marché tiers introuvable.', 404)
    if (!marcheTiers.actif) throw new AppError('Ce marché tiers n\'est plus actif.', 409)
    if (marcheTiers.id_service !== existing.id_service) throw new AppError('Ce marché tiers n\'appartient pas au service de la demande.', 403)
    idFournisseurRetenu = marcheTiers.id_fournisseur
  }

  await purgeDocumentationSiSelectionChangee()
  return demandeAchatRepository.update(idDemandeAchat, {
    nummarche,
    id_marche_tiers: idMarcheTiers,
    id_fournisseur_retenu: idFournisseurRetenu,
    motif_choix: 'Prix',
    montant_demande: montantDemande,
  })
}

/** Consultation d'un candidat (écran FournisseurDA/MarcheDA) — vue frontend, distincte de la ligne brute DEVIS_CONSULTE. */
export interface ConsultationCandidat {
  idDevis: number
  idFournisseur: number
  montantDevis: number | null
  ordre: number
  retenu: boolean
  nomFichierOriginal: string | null
  tailleOctets: number | null
}

function toConsultationCandidat(row: import('../repositories/devisConsulte.repository.js').DevisConsulte): ConsultationCandidat {
  return {
    idDevis: row.id_devis,
    idFournisseur: row.id_fournisseur,
    montantDevis: row.montant_devis,
    ordre: row.ordre,
    retenu: row.retenu,
    nomFichierOriginal: row.nom_fichier_original,
    tailleOctets: row.taille_octets,
  }
}

/**
 * Réassigne ORDRE 1..N (RETENU = ordre 1) sur un ensemble de lignes déjà
 * existantes, dans l'ordre donné — en deux passes (valeurs négatives
 * temporaires, uniques par ID_DEVIS, puis valeurs finales) pour ne jamais
 * violer transitoirement UNIQUE(ID_DEMANDE_ACHAT, ORDRE) ni UNIQUE(ID_DEMANDE_ACHAT)
 * WHERE RETENU lors d'un réordonnancement.
 */
async function resequenceDevis(orderedIdsDevis: number[]): Promise<void> {
  for (const idDevis of orderedIdsDevis) {
    await devisConsulteRepository.update(idDevis, { ordre: -idDevis, retenu: false })
  }
  for (const [index, idDevis] of orderedIdsDevis.entries()) {
    await devisConsulteRepository.update(idDevis, { ordre: index + 1, retenu: index === 0 })
  }
}

/**
 * Purge de la base documentaire liée à une DA (décision du 09/09/2026,
 * refonte de la gestion documentaire — croquis DA2.pdf) : au changement de
 * procédure d'achat, au changement de marché sélectionné et au retrait d'un
 * fournisseur consulté, « toute la base documentaire » (devis ET pièces
 * complémentaires) doit disparaître, fichiers Storage compris — jamais
 * seulement les lignes. Fichier supprimé en best-effort avant la ligne
 * (l'inverse laisserait une ligne visible pointant vers un fichier déjà
 * absent, pire qu'un fichier orphelin invisible côté écran).
 */
async function purgeDevisConsulte(idDemandeAchat: number): Promise<void> {
  const rows = await devisConsulteRepository.findAllByDemandeAchat(idDemandeAchat)
  for (const row of rows) {
    if (row.storage_path) {
      await devisConsulteRepository.removeFile(row.storage_path).catch((err: unknown) => {
        console.error('[devis_consulte] échec de suppression du fichier', row.storage_path, err)
      })
    }
  }
  await devisConsulteRepository.deleteAllByDemandeAchat(idDemandeAchat)
}

/** Purge des pièces complémentaires — toutes celles de la DA si `idFournisseur` est omis, seulement celles de ce fournisseur sinon (retrait d'un candidat consulté). */
async function purgePieceJointe(idDemandeAchat: number, idFournisseur?: number): Promise<void> {
  const rows =
    idFournisseur !== undefined
      ? await pieceJointeRepository.findAllByDemandeAchatAndFournisseur(idDemandeAchat, idFournisseur)
      : await pieceJointeRepository.findAllByDemandeAchat(idDemandeAchat)
  for (const row of rows) {
    await pieceJointeRepository.remove(row.id_piece)
    await pieceJointeRepository.removeFile(row.storage_path).catch((err: unknown) => {
      console.error('[piece_jointe] échec de suppression du fichier', row.storage_path, err)
    })
  }
}

/**
 * Liste des candidats déjà consultés pour une DA (écran FournisseurDA/MarcheDA,
 * à l'ouverture) — même règle d'accès que getDemandeAchat.
 */
export async function listConsultationDemandeAchat(matricule: string | null, idDemandeAchat: number): Promise<ConsultationCandidat[]> {
  if (!matricule) throw new AppError('Authentification requise', 401)

  const existing = await demandeAchatRepository.findById(idDemandeAchat)
  if (!existing) throw new AppError('Demande d\'achat introuvable', 404)
  await assertCanActFor(matricule, existing.matricule_demandeur)

  const rows = await devisConsulteRepository.findAllByDemandeAchat(idDemandeAchat)
  return rows.map(toConsultationCandidat)
}

const addCandidatSchema = z.object({ idFournisseur: z.number().int() })

/**
 * Ajoute un candidat consulté (écran FournisseurDA, procédure HORS_MARCHE) —
 * écrit immédiatement en base (décision du 09/09/2026, PiecesDevisDA) : le
 * bouton « Devis » d'un candidat doit pouvoir fonctionner avant même le
 * premier « Enregistrer » de la liste, donc la ligne DEVIS_CONSULTE doit déjà
 * exister dès l'ajout — plus de liste seulement locale, remplacée en bloc à
 * l'enregistrement (ancien modèle, abandonné le même jour : il détruisait un
 * devis déjà déposé au moindre ré-enregistrement, ex. un simple ajustement de
 * montant).
 */
export async function addConsultationCandidat(matricule: string | null, idDemandeAchat: number, input: unknown): Promise<ConsultationCandidat> {
  if (!matricule) throw new AppError('Authentification requise', 401)

  const result = addCandidatSchema.safeParse(input)
  if (!result.success) throw new AppError(result.error.issues[0]?.message ?? 'Requête invalide', 400)

  const existing = await demandeAchatRepository.findById(idDemandeAchat)
  if (!existing) throw new AppError('Demande d\'achat introuvable', 404)

  await assertCanActFor(matricule, existing.matricule_demandeur)
  if (!STATUTS_MODIFIABLES.includes(existing.code_statut)) {
    throw new AppError('Cette demande d\'achat ne peut plus être modifiée à ce stade.', 409)
  }
  if (existing.procedure_achat !== 'HORS_MARCHE') {
    throw new AppError('Cette demande d\'achat est en procédure marché.', 409)
  }

  const fournisseursDuService = await fournisseurRepository.findAll(existing.id_service)
  if (!fournisseursDuService.some((f) => f.id_fournisseur === result.data.idFournisseur)) {
    throw new AppError('Ce fournisseur n\'appartient pas au service de la demande.', 403)
  }

  const current = await devisConsulteRepository.findAllByDemandeAchat(idDemandeAchat)
  if (current.length >= 5) throw new AppError('Cinq entreprises consultées maximum.', 409)
  if (current.some((r) => r.id_fournisseur === result.data.idFournisseur)) {
    throw new AppError('Ce fournisseur est déjà consulté pour cette demande.', 409)
  }

  const row = await devisConsulteRepository.create({
    id_demande_achat: idDemandeAchat,
    id_fournisseur: result.data.idFournisseur,
    montant_devis: null,
    ordre: current.length + 1,
    retenu: current.length === 0,
  })
  return toConsultationCandidat(row)
}

/**
 * Retire un candidat consulté — supprime le devis (fichier Storage compris,
 * best-effort) et réassigne ORDRE/RETENU des lignes restantes. Purge aussi
 * toute la base documentaire (pièces complémentaires) de ce fournisseur pour
 * cette DA (décision du 09/09/2026, croquis DA2.pdf : « si l'utilisateur
 * supprime un fournisseur, la base documentaire pour cette DA et ce
 * fournisseur est nettoyée ») — un fournisseur retiré des consultés n'a plus
 * aucune raison d'être associé à des pièces de cette DA.
 */
export async function removeConsultationCandidat(matricule: string | null, idDemandeAchat: number, idDevis: number): Promise<void> {
  if (!matricule) throw new AppError('Authentification requise', 401)

  const existing = await demandeAchatRepository.findById(idDemandeAchat)
  if (!existing) throw new AppError('Demande d\'achat introuvable', 404)

  await assertCanActFor(matricule, existing.matricule_demandeur)
  if (!STATUTS_MODIFIABLES.includes(existing.code_statut)) {
    throw new AppError('Cette demande d\'achat ne peut plus être modifiée à ce stade.', 409)
  }
  if (existing.procedure_achat !== 'HORS_MARCHE') {
    throw new AppError('Cette demande d\'achat est en procédure marché.', 409)
  }

  const row = await devisConsulteRepository.findById(idDevis)
  if (!row || row.id_demande_achat !== idDemandeAchat) throw new AppError('Candidat introuvable.', 404)

  await devisConsulteRepository.remove(idDevis)
  if (row.storage_path) {
    await devisConsulteRepository.removeFile(row.storage_path).catch((err: unknown) => {
      console.error('[devis_consulte] échec de suppression du fichier', row.storage_path, err)
    })
  }
  await purgePieceJointe(idDemandeAchat, row.id_fournisseur)

  const remaining = await devisConsulteRepository.findAllByDemandeAchat(idDemandeAchat)
  await resequenceDevis(remaining.map((r) => r.id_devis))
}

const consultationSchema = z
  .object({
    candidats: z
      .array(
        z.object({
          idDevis: z.number().int(),
          montantDevis: z.number().nonnegative(),
        }),
      )
      .min(1, 'Au moins une entreprise consultée est requise.')
      .max(5, 'Cinq entreprises consultées maximum.'),
    motifChoix: z.enum(['Prix', 'Délai', 'Technique', 'Autre']),
    libelleMotifChoix: z.string().trim().min(1).nullable().optional(),
  })
  .refine((data) => data.motifChoix !== 'Autre' || (data.libelleMotifChoix ?? '').trim() !== '', {
    message: 'Le libellé du motif est obligatoire quand le motif est "Autre".',
  })
  .refine((data) => new Set(data.candidats.map((c) => c.idDevis)).size === data.candidats.length, {
    message: 'Un même candidat ne peut pas apparaître deux fois.',
  })

/**
 * Écran FournisseurDA (bouton « Éléments de consultation », CreationDA —
 * procédure HORS_MARCHE uniquement, croquis DA.pdf page 4) : fixe l'ordre
 * final (ORDRE 1..N, RETENU = ordre 1) et le montant de chaque candidat déjà
 * existant (voir addConsultationCandidat — les lignes DEVIS_CONSULTE ne sont
 * plus créées/détruites ici, décision du 09/09/2026, PiecesDevisDA : un
 * devis déjà déposé ne doit jamais être perdu par ce seul appel). MOTIF_CHOIX/
 * LIBELLE_MOTIF_CHOIX/ID_FOURNISSEUR_RETENU/MONTANT_DEMANDE posés au même
 * appel — jamais saisis autrement, d'où leur retrait de `updateSchema`.
 */
export async function saveConsultationDemandeAchat(matricule: string | null, idDemandeAchat: number, input: unknown): Promise<DemandeAchat> {
  if (!matricule) throw new AppError('Authentification requise', 401)

  const result = consultationSchema.safeParse(input)
  if (!result.success) throw new AppError(result.error.issues[0]?.message ?? 'Requête invalide', 400)

  const existing = await demandeAchatRepository.findById(idDemandeAchat)
  if (!existing) throw new AppError('Demande d\'achat introuvable', 404)

  await assertCanActFor(matricule, existing.matricule_demandeur)
  if (!STATUTS_MODIFIABLES.includes(existing.code_statut)) {
    throw new AppError('Cette demande d\'achat ne peut plus être modifiée à ce stade.', 409)
  }
  if (existing.procedure_achat !== 'HORS_MARCHE') {
    throw new AppError('Cette demande d\'achat est en procédure marché.', 409)
  }

  const { candidats, motifChoix, libelleMotifChoix } = result.data

  const rows = await devisConsulteRepository.findAllByDemandeAchat(idDemandeAchat)
  const rowsById = new Map(rows.map((r) => [r.id_devis, r]))
  for (const candidat of candidats) {
    if (!rowsById.has(candidat.idDevis)) throw new AppError('Un des candidats sélectionnés n\'appartient pas à cette demande.', 404)
  }

  for (const candidat of candidats) {
    await devisConsulteRepository.update(candidat.idDevis, { montant_devis: candidat.montantDevis })
  }
  await resequenceDevis(candidats.map((c) => c.idDevis))

  const retenu = rowsById.get(candidats[0].idDevis)!

  // Nettoyage croisé (décision du 09/09/2026) : NUMMARCHE/ID_MARCHE_TIERS ne
  // doivent jamais rester renseignés sur une DA Hors marché. MONTANT_DEMANDE
  // dérivé du candidat retenu (renverse la décision du 07/09/2026 — voir
  // ForClaude/CDC/mld-phases-1-2.md) : « le montant demandé pour une
  // procédure hors marché, c'est le montant défini pour l'entreprise
  // retenue ». Plus aucune saisie de montant dans CreationDA.
  return demandeAchatRepository.update(idDemandeAchat, {
    nummarche: null,
    id_marche_tiers: null,
    motif_choix: motifChoix,
    libelle_motif_choix: motifChoix === 'Autre' ? (libelleMotifChoix as string).trim() : null,
    id_fournisseur_retenu: retenu.id_fournisseur,
    montant_demande: candidats[0].montantDevis,
  })
}

/**
 * Récupère (ou crée si absente) l'unique ligne DEVIS_CONSULTE facultative
 * d'une DA Marché — le devis BPU du titulaire (voir ForClaude/CDC/mld-phases-1-2.md,
 * cardinalité par procédure : 0 ou 1 ligne). Nécessite qu'un marché soit déjà
 * sélectionné (ID_FOURNISSEUR_RETENU renseigné, via selectMarcheDemandeAchat).
 */
export async function getOrCreateMarcheDevis(matricule: string | null, idDemandeAchat: number): Promise<ConsultationCandidat> {
  if (!matricule) throw new AppError('Authentification requise', 401)

  const existing = await demandeAchatRepository.findById(idDemandeAchat)
  if (!existing) throw new AppError('Demande d\'achat introuvable', 404)

  await assertCanActFor(matricule, existing.matricule_demandeur)
  if (!STATUTS_MODIFIABLES.includes(existing.code_statut)) {
    throw new AppError('Cette demande d\'achat ne peut plus être modifiée à ce stade.', 409)
  }
  if (existing.procedure_achat !== 'MARCHE') {
    throw new AppError('Cette demande d\'achat est en procédure hors marché.', 409)
  }
  if (existing.id_fournisseur_retenu === null) {
    throw new AppError('Sélectionnez d\'abord un marché.', 409)
  }

  const rows = await devisConsulteRepository.findAllByDemandeAchat(idDemandeAchat)
  const existingRow = rows.find((r) => r.id_fournisseur === existing.id_fournisseur_retenu)
  if (existingRow) return toConsultationCandidat(existingRow)

  const row = await devisConsulteRepository.create({
    id_demande_achat: idDemandeAchat,
    id_fournisseur: existing.id_fournisseur_retenu,
    montant_devis: null,
    ordre: 1,
    retenu: true,
  })
  return toConsultationCandidat(row)
}

const PDF_MAGIC_BYTES = Buffer.from('%PDF')
const MAX_FICHIER_TAILLE_OCTETS = 10 * 1024 * 1024

function isPdfBuffer(buffer: Buffer): boolean {
  return buffer.subarray(0, 4).equals(PDF_MAGIC_BYTES)
}

async function assertDevisAccessible(matricule: string | null, idDemandeAchat: number, idDevis: number) {
  if (!matricule) throw new AppError('Authentification requise', 401)
  const existing = await demandeAchatRepository.findById(idDemandeAchat)
  if (!existing) throw new AppError('Demande d\'achat introuvable', 404)
  await assertCanActFor(matricule, existing.matricule_demandeur)

  const row = await devisConsulteRepository.findById(idDevis)
  if (!row || row.id_demande_achat !== idDemandeAchat) throw new AppError('Devis introuvable.', 404)
  return { existing, row }
}

/**
 * Dépôt/remplacement du PDF d'un devis (écran PiecesDevisDA) — le glisser-
 * déposer remplace le fichier existant en place (croquis DA.pdf page 5),
 * jamais une nouvelle ligne. Ancien fichier Storage supprimé en best-effort
 * une fois le nouveau confirmé en base (ordre inverse du dépôt initial :
 * l'ancien fichier ne doit jamais disparaître avant que le remplaçant soit
 * effectivement rattaché, même principe que marchePiece.service.ts).
 */
export async function uploadDevisFile(
  matricule: string | null,
  idDemandeAchat: number,
  idDevis: number,
  file: { buffer: Buffer; originalname: string; size: number },
): Promise<ConsultationCandidat> {
  const { existing, row } = await assertDevisAccessible(matricule, idDemandeAchat, idDevis)
  if (!STATUTS_MODIFIABLES.includes(existing.code_statut)) {
    throw new AppError('Cette demande d\'achat ne peut plus être modifiée à ce stade.', 409)
  }
  if (!isPdfBuffer(file.buffer)) throw new AppError('Seuls les fichiers PDF sont acceptés.', 400)
  if (file.size > MAX_FICHIER_TAILLE_OCTETS) throw new AppError('Le fichier dépasse la taille maximale autorisée (10 Mo).', 400)

  const path = devisConsulteRepository.buildStoragePath(idDemandeAchat, row.id_fournisseur)
  await devisConsulteRepository.uploadFile(path, file.buffer)

  let updated
  try {
    updated = await devisConsulteRepository.update(idDevis, {
      nom_fichier_original: file.originalname,
      storage_path: path,
      taille_octets: file.size,
    })
  } catch (err) {
    await devisConsulteRepository.removeFile(path).catch(() => {})
    throw err
  }

  if (row.storage_path) {
    await devisConsulteRepository.removeFile(row.storage_path).catch((removeErr: unknown) => {
      console.error('[devis_consulte] échec de suppression de l\'ancien fichier', row.storage_path, removeErr)
    })
  }
  return toConsultationCandidat(updated)
}

export async function downloadDevisFile(matricule: string | null, idDemandeAchat: number, idDevis: number): Promise<{ buffer: Buffer; nomFichier: string }> {
  const { row } = await assertDevisAccessible(matricule, idDemandeAchat, idDevis)
  if (!row.storage_path || !row.nom_fichier_original) throw new AppError('Aucun fichier déposé pour ce devis.', 404)

  const buffer = await devisConsulteRepository.downloadFile(row.storage_path)
  return { buffer, nomFichier: row.nom_fichier_original }
}

/**
 * Retire uniquement le fichier d'un devis (écran de gestion documentaire,
 * icône « Supprimer le devis » — croquis DA2.pdf) — ne supprime jamais la
 * ligne DEVIS_CONSULTE elle-même (le fournisseur reste consulté/retenu,
 * seul son devis redevient « pas encore déposé »). Distinct de
 * removeConsultationCandidat, qui retire le fournisseur tout entier.
 */
export async function deleteDevisFile(matricule: string | null, idDemandeAchat: number, idDevis: number): Promise<ConsultationCandidat> {
  const { existing, row } = await assertDevisAccessible(matricule, idDemandeAchat, idDevis)
  if (!STATUTS_MODIFIABLES.includes(existing.code_statut)) {
    throw new AppError('Cette demande d\'achat ne peut plus être modifiée à ce stade.', 409)
  }
  if (!row.storage_path) throw new AppError('Aucun fichier déposé pour ce devis.', 404)

  const updated = await devisConsulteRepository.update(idDevis, {
    nom_fichier_original: null,
    storage_path: null,
    taille_octets: null,
  })
  await devisConsulteRepository.removeFile(row.storage_path).catch((err: unknown) => {
    console.error('[devis_consulte] échec de suppression du fichier', row.storage_path, err)
  })
  return toConsultationCandidat(updated)
}

/** Vue frontend d'une pièce complémentaire — distincte de la ligne brute PIECE_JOINTE. */
export interface PieceJointeView {
  idPiece: number
  idFournisseur: number
  typePiece: string
  nomFichierOriginal: string
  tailleOctets: number
}

function toPieceJointeView(row: PieceJointe): PieceJointeView {
  return {
    idPiece: row.id_piece,
    idFournisseur: row.id_fournisseur,
    typePiece: row.type_piece,
    nomFichierOriginal: row.nom_fichier_original,
    tailleOctets: row.taille_octets,
  }
}

/**
 * Vérifie que `idFournisseur` est réellement associé à cette DA — le
 * titulaire retenu en MARCHE, un des candidats consultés en HORS_MARCHE —
 * avant d'y rattacher une pièce complémentaire (aucune contrainte base ne le
 * garantit, voir ForClaude/CDC/mld-phases-1-2.md §2.4, note PIECE_JOINTE).
 */
async function assertFournisseurAssocieALaDemande(existing: DemandeAchat, idFournisseur: number): Promise<void> {
  if (existing.procedure_achat === 'MARCHE') {
    if (existing.id_fournisseur_retenu !== idFournisseur) {
      throw new AppError('Ce fournisseur n\'est pas associé à cette demande.', 403)
    }
    return
  }
  const rows = await devisConsulteRepository.findAllByDemandeAchat(existing.id_demande_achat)
  if (!rows.some((r) => r.id_fournisseur === idFournisseur)) {
    throw new AppError('Ce fournisseur n\'est pas associé à cette demande.', 403)
  }
}

/**
 * Liste les pièces complémentaires d'un fournisseur de la DA (écran unifié
 * de gestion documentaire, bouton « Gestion documentaire » de CreationDA —
 * décision du 09/09/2026, croquis DA2.pdf) — même règle d'accès que
 * getDemandeAchat. Ne renvoie jamais le devis (table séparée DEVIS_CONSULTE,
 * voir listConsultationDemandeAchat/getOrCreateMarcheDevis).
 */
export async function listPiecesDemandeAchat(matricule: string | null, idDemandeAchat: number, idFournisseur: number): Promise<PieceJointeView[]> {
  if (!matricule) throw new AppError('Authentification requise', 401)

  const existing = await demandeAchatRepository.findById(idDemandeAchat)
  if (!existing) throw new AppError('Demande d\'achat introuvable', 404)
  await assertCanActFor(matricule, existing.matricule_demandeur)

  const rows = await pieceJointeRepository.findAllByDemandeAchatAndFournisseur(idDemandeAchat, idFournisseur)
  return rows.map(toPieceJointeView)
}

// z.coerce : req.body arrive en multipart/form-data (dépôt de fichier), tous les champs sont
// des chaînes — même traitement que marchePiece.service.ts#uploadPieceSchema.
const addPieceSchema = z.object({
  idFournisseur: z.coerce.number().int(),
  typePiece: z.string().trim().min(1, 'Type de pièce requis.'),
})

/**
 * Dépôt d'une pièce complémentaire (écran de gestion documentaire, bouton
 * « Ajouter une pièce complémentaire ») — une pièce n'existe qu'avec son
 * fichier (contrairement au devis, jamais de ligne créée à l'avance).
 * FICHE_FAD (ORIGINE=SYSTEME, générée à l'autorisation de commande — Phase 2,
 * pas encore implémenté) n'est jamais sélectionnable ici.
 */
export async function addPieceDemandeAchat(
  matricule: string | null,
  idDemandeAchat: number,
  input: unknown,
  file: { buffer: Buffer; originalname: string; size: number } | undefined,
): Promise<PieceJointeView> {
  if (!matricule) throw new AppError('Authentification requise', 401)
  if (!file) throw new AppError('Fichier requis.', 400)

  const result = addPieceSchema.safeParse(input)
  if (!result.success) throw new AppError(result.error.issues[0]?.message ?? 'Requête invalide', 400)
  if (result.data.typePiece === 'FICHE_FAD') throw new AppError('Ce type de pièce est réservé au système.', 400)

  const existing = await demandeAchatRepository.findById(idDemandeAchat)
  if (!existing) throw new AppError('Demande d\'achat introuvable', 404)
  await assertCanActFor(matricule, existing.matricule_demandeur)
  if (!STATUTS_MODIFIABLES.includes(existing.code_statut)) {
    throw new AppError('Cette demande d\'achat ne peut plus être modifiée à ce stade.', 409)
  }
  await assertFournisseurAssocieALaDemande(existing, result.data.idFournisseur)
  await libelleReferentielService.assertCodeActif('TYPE_PIECE_FAD', result.data.typePiece)

  if (!isPdfBuffer(file.buffer)) throw new AppError('Seuls les fichiers PDF sont acceptés.', 400)
  if (file.size > MAX_FICHIER_TAILLE_OCTETS) throw new AppError('Le fichier dépasse la taille maximale autorisée (10 Mo).', 400)

  const path = pieceJointeRepository.buildStoragePath(idDemandeAchat, result.data.idFournisseur)
  await pieceJointeRepository.uploadFile(path, file.buffer)

  try {
    const row = await pieceJointeRepository.create({
      id_demande_achat: idDemandeAchat,
      id_fournisseur: result.data.idFournisseur,
      type_piece: result.data.typePiece,
      origine: 'UTILISATEUR',
      nom_fichier_original: file.originalname,
      storage_path: path,
      taille_octets: file.size,
    })
    return toPieceJointeView(row)
  } catch (err) {
    await pieceJointeRepository.removeFile(path).catch(() => {})
    throw err
  }
}

/** Suppression d'une pièce complémentaire — jamais une pièce ORIGINE=SYSTEME (fiche récapitulative, Phase 2). */
export async function removePieceDemandeAchat(matricule: string | null, idDemandeAchat: number, idPiece: number): Promise<void> {
  if (!matricule) throw new AppError('Authentification requise', 401)

  const existing = await demandeAchatRepository.findById(idDemandeAchat)
  if (!existing) throw new AppError('Demande d\'achat introuvable', 404)
  await assertCanActFor(matricule, existing.matricule_demandeur)
  if (!STATUTS_MODIFIABLES.includes(existing.code_statut)) {
    throw new AppError('Cette demande d\'achat ne peut plus être modifiée à ce stade.', 409)
  }

  const row = await pieceJointeRepository.findById(idPiece)
  if (!row || row.id_demande_achat !== idDemandeAchat) throw new AppError('Pièce introuvable.', 404)
  if (row.origine === 'SYSTEME') throw new AppError('Cette pièce est générée par le système et ne peut pas être supprimée.', 403)

  await pieceJointeRepository.remove(idPiece)
  await pieceJointeRepository.removeFile(row.storage_path).catch((err: unknown) => {
    console.error('[piece_jointe] échec de suppression du fichier', row.storage_path, err)
  })
}

export async function downloadPieceDemandeAchat(matricule: string | null, idDemandeAchat: number, idPiece: number): Promise<{ buffer: Buffer; nomFichier: string }> {
  if (!matricule) throw new AppError('Authentification requise', 401)

  const existing = await demandeAchatRepository.findById(idDemandeAchat)
  if (!existing) throw new AppError('Demande d\'achat introuvable', 404)
  await assertCanActFor(matricule, existing.matricule_demandeur)

  const row = await pieceJointeRepository.findById(idPiece)
  if (!row || row.id_demande_achat !== idDemandeAchat) throw new AppError('Pièce introuvable.', 404)

  const buffer = await pieceJointeRepository.downloadFile(row.storage_path)
  return { buffer, nomFichier: row.nom_fichier_original }
}

/**
 * Suppression physique — autorisée uniquement à DA_EN_PREPARATION (jamais
 * DA_A_COMPLETER, déjà transmise une première fois — décision du
 * 07/09/2026). Cascade applicative dans l'ordre documenté au MLD §4 :
 * PIECE_JOINTE → DEVIS_CONSULTE → HISTORIQUE_STATUT → DEMANDE_ACHAT (les FK
 * restent ON DELETE RESTRICT, pas de CASCADE en base) — fichiers Storage
 * supprimés en best-effort au passage (décision du 09/09/2026, plus jamais
 * de suppression de lignes sans nettoyage du fichier associé).
 */
export async function deleteDemandeAchat(matricule: string | null, idDemandeAchat: number): Promise<void> {
  if (!matricule) throw new AppError('Authentification requise', 401)

  const existing = await demandeAchatRepository.findById(idDemandeAchat)
  if (!existing) throw new AppError('Demande d\'achat introuvable', 404)

  await assertCanActFor(matricule, existing.matricule_demandeur)
  if (existing.code_statut !== STATUT_SUPPRESSIBLE) {
    throw new AppError('Seule une demande d\'achat en préparation peut être supprimée.', 409)
  }

  await purgePieceJointe(idDemandeAchat)
  await purgeDevisConsulte(idDemandeAchat)
  await historiqueStatutRepository.deleteAllByDemandeAchat(idDemandeAchat)
  await demandeAchatRepository.remove(idDemandeAchat)
}
