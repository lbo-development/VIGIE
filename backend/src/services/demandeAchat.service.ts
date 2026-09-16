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
import * as serviceRepository from '../repositories/service.repository.js'
import * as seuilValidationDsRepository from '../repositories/seuilValidationDs.repository.js'
import * as statutRepository from '../repositories/statut.repository.js'
import * as suppleanceRepository from '../repositories/suppleance.repository.js'
import { resolveMarcheIdService } from './marche.service.js'
import * as libelleReferentielService from './libelleReferentiel.service.js'
import * as roleEffectifService from './roleEffectif.service.js'
import { AppError } from '../middlewares/errorHandler.js'
import type { DemandeAchat, DemandeAchatUpdate } from '../repositories/demandeAchat.repository.js'
import type { PieceJointe } from '../repositories/pieceJointe.repository.js'

/**
 * Statuts pour lesquels la page DemandeAchat reste pertinente (décision du
 * 07/09/2026) : le Demandeur/RC/ADMIN_SERVICE n'agit plus sur la DA une fois
 * transmise — voir ForClaude/CDC/mot-phases-1-2.md OP1.1.
 *
 * Correction du 15/09/2026 (chantier écran d'accueil/workflow FAD) :
 * 'DA_A_COMPLETER_RC' est le code réel du référentiel finances.statut
 * (25 codes, migration 20260914100000_rebuild_statut_depuis_code_statut_pdf.sql)
 * — 'DA_A_COMPLETER' (sans suffixe) n'a jamais existé en base depuis cette
 * refonte, bug resté dormant tant qu'OP1.2 (seule opération capable de
 * produire cette transition) n'était pas implémentée.
 */
const STATUTS_PAGE_DEMANDE_ACHAT = ['DA_EN_PREPARATION', 'DA_A_COMPLETER_RC']

/** Seul ce statut autorise la suppression physique (décision du 07/09/2026). */
const STATUT_SUPPRESSIBLE = 'DA_EN_PREPARATION'

/**
 * Statuts encore éditables par le Demandeur/RC (Modifier une DA) — la
 * reprise DA_A_COMPLETER_RC est un retour en place, pas un statut figé.
 */
const STATUTS_MODIFIABLES = ['DA_EN_PREPARATION', 'DA_A_COMPLETER_RC']

export type AccueilScope =
  | 'A_FINALISER'
  | 'SUIVI_FAD'
  | 'A_TRAITER'
  | 'EN_COURS'
  | 'FAD_COMMANDEES'
  | 'REJETEES_ANNULEES'

/** Tous les statuts terminaux "rejeté"/"annulé" (DA et FAD mélangés) — onglet "Rejetées / Annulées" de l'écran d'accueil (décision du 15/09/2026). */
const STATUTS_REJETEES_ANNULEES = [
  'DA_REJETEE_RC',
  'DA_ANNULEE_RC',
  'FAD_REJETEE_CDS',
  'FAD_ANNULEE_CDS',
  'FAD_REJETEE_CB',
  'FAD_REJETEE_DS',
  'FAD_ANNULEE_DS',
]

const STATUTS_FAD_COMMANDEES = ['FAD_COMMANDEE']

/**
 * Onglet "À traiter" de l'écran de suivi RC (décision du 15/09/2026) — les
 * statuts où le RC est « pour action » : statuer sur l'opportunité d'une DA
 * fraîchement transmise, ou compléter/transmettre une FAD (première
 * complétion ou reprise après demande de modification de la CB).
 */
const STATUTS_A_TRAITER_RC = ['DA_TRANSMISE_DEM_RC', 'DA_VALIDEE_RC', 'FAD_A_COMPLETER_CDS', 'FAD_A_MODIFIER_CB']

/**
 * Onglet "En cours" de l'écran de suivi RC — tout le reste du cycle non
 * terminal, hors "À traiter". `DA_EN_PREPARATION` en est volontairement
 * exclu (bug corrigé le 15/09/2026, signalé par l'utilisateur) : ce
 * brouillon reste entre les mains du demandeur, jamais transmis — le RC n'a
 * encore rien à en faire, contrairement à `DA_A_COMPLETER_RC` (le RC a déjà
 * statué « Compléter », la DA lui revient donc légitimement en « en cours »
 * de son point de vue). Cette DA n'apparaît alors dans aucun onglet RC —
 * comportement voulu, pas un trou de couverture (voir le test de couverture,
 * qui exclut spécifiquement ce code pour le regroupement RC).
 */
const STATUTS_EN_COURS_RC = [
  'DA_A_COMPLETER_RC',
  'FAD_TRANSMISE_RC_CDS',
  'FAD_MODIFIEE_TRANSMISE_RC_CB',
  'FAD_VALIDEE_CDS',
  'FAD_TRANSMISE_CDS_CB',
  'FAD_VALIDEE_CB',
  'FAD_TRANSMISE_CB_DS',
  'FAD_VALIDEE_DS',
  'FAD_VALIDEE_DS_SEUIL',
  'FAD_A_COMPLETER_CB',
  'FAD_TRANSMISE_DS_CB',
  'FAD_A_COMMANDER',
]

/**
 * Onglet "Suivre & gérer les FAD" — tous les statuts non terminaux entre
 * DA_VALIDEE_RC et FAD_COMMANDEE exclus (le demandeur n'est jamais "pour
 * action" à ce stade, cf. matrice EN_TRANSIT/POUR_ACTION de finances.statut).
 * Complémentaire exacte de STATUTS_PAGE_DEMANDE_ACHAT ∪ STATUTS_FAD_COMMANDEES
 * ∪ STATUTS_REJETEES_ANNULEES sur les 25 codes du référentiel — voir le test
 * de couverture demandeAchat.service.test.ts (garde-fou anti-dérive).
 */
const STATUTS_SUIVI_FAD = [
  'DA_TRANSMISE_DEM_RC',
  'DA_VALIDEE_RC',
  'FAD_TRANSMISE_RC_CDS',
  'FAD_MODIFIEE_TRANSMISE_RC_CB',
  'FAD_VALIDEE_CDS',
  'FAD_A_COMPLETER_CDS',
  'FAD_TRANSMISE_CDS_CB',
  'FAD_VALIDEE_CB',
  'FAD_A_MODIFIER_CB',
  'FAD_TRANSMISE_CB_DS',
  'FAD_VALIDEE_DS',
  'FAD_VALIDEE_DS_SEUIL',
  'FAD_A_COMPLETER_CB',
  'FAD_TRANSMISE_DS_CB',
  'FAD_A_COMMANDER',
]

/** Exporté pour le test de couverture (garde-fou anti-dérive) — voir demandeAchat.service.test.ts. */
export const ACCUEIL_SCOPE_STATUTS: Record<AccueilScope, string[]> = {
  A_FINALISER: STATUTS_PAGE_DEMANDE_ACHAT,
  SUIVI_FAD: STATUTS_SUIVI_FAD,
  A_TRAITER: STATUTS_A_TRAITER_RC,
  EN_COURS: STATUTS_EN_COURS_RC,
  FAD_COMMANDEES: STATUTS_FAD_COMMANDEES,
  REJETEES_ANNULEES: STATUTS_REJETEES_ANNULEES,
}

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
 *
 * Correction du 15/09/2026 (écran de suivi RC) : source des rôles basculée
 * sur roleEffectifService.findEffectiveRoles (titulaire + suppléance RC/CDS/
 * DS) — roleAttributionRepository.findActiveByMatricule seul ne voyait
 * jamais un suppléant pur (aucune ligne role_attribution à son nom), qui
 * retombait donc à tort en DEMANDEUR et ne voyait jamais la cellule qu'il
 * supplée. Même correctif que les actions (decisionRc/transmettreFad/
 * retransmettreCb), qui utilisaient déjà findEffectiveRoles.
 */
async function resolveAccessContext(matricule: string): Promise<AccessContext> {
  if (await authRepository.hasActiveRole(matricule, 'ADMIN_APP')) {
    return { role: 'ADMIN_APP', ownIdService: null, ownIdCellule: null }
  }

  const roles = await roleEffectifService.findEffectiveRoles(matricule)

  const adminService = roles.find((r) => r.typeRole === 'ADMIN_SERVICE' && r.idService !== null)
  if (adminService) {
    return { role: 'ADMIN_SERVICE', ownIdService: adminService.idService, ownIdCellule: null }
  }

  const rc = roles.find((r) => r.typeRole === 'RC' && r.idCellule !== null)
  if (rc) {
    const cellule = await celluleRepository.findById(rc.idCellule as number)
    return { role: 'RC', ownIdService: cellule?.id_service ?? null, ownIdCellule: rc.idCellule }
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

/** Vue frontend d'une ligne d'historique (modale « Historique des statuts », écran d'accueil). */
export interface HistoriqueStatutView {
  idHisto: number
  codeStatut: string
  libelleStatut: string
  dateHeure: string
  matriculeActeur: string
  acteurNomPrenom: string | null
  /** ex. "en suppléance de Jean Dupont" — `null` si l'acteur a agi en tant que titulaire. */
  suppleanceLabel: string | null
  commentaireStatut: string | null
}

/**
 * Historique des transitions de statut d'une DA/FAD (icône calendrier, écran
 * d'accueil) — même règle d'accès que getDemandeAchat. Simple liste
 * chronologique, aucune action possible dessus (historique_statut est
 * immuable en base, voir historiqueStatut.repository.ts).
 */
export async function getHistoriqueStatuts(matricule: string | null, idDemandeAchat: number): Promise<HistoriqueStatutView[]> {
  if (!matricule) throw new AppError('Authentification requise', 401)

  const existing = await demandeAchatRepository.findById(idDemandeAchat)
  if (!existing) throw new AppError('Demande d\'achat introuvable', 404)
  await assertCanActFor(matricule, existing.matricule_demandeur)

  const rows = await historiqueStatutRepository.findAllByDemandeAchat(idDemandeAchat)
  if (rows.length === 0) return []

  const acteurs = await acteurRepository.findByMatricules([...new Set(rows.map((r) => r.matricule_acteur))])
  const acteurByMatricule = new Map(acteurs.map((a) => [a.matricule, a]))

  const statuts = await statutRepository.findAll()
  const statutByCode = new Map(statuts.map((s) => [s.code_statut, s]))

  const idsSuppleance = [...new Set(rows.map((r) => r.id_suppleance).filter((id): id is number => id !== null))]
  const suppleanceLabels = new Map<number, string>()
  for (const idSuppleance of idsSuppleance) {
    const suppleance = await suppleanceRepository.findById(idSuppleance)
    if (!suppleance) continue
    const role = await roleAttributionRepository.findById(suppleance.id_role)
    if (!role) continue
    const titulaire = await acteurRepository.findByMatricule(role.matricule)
    if (titulaire) suppleanceLabels.set(idSuppleance, `en suppléance de ${titulaire.prenom} ${titulaire.nom}`)
  }

  return rows.map((row) => {
    const acteur = acteurByMatricule.get(row.matricule_acteur)
    return {
      idHisto: row.id_histo,
      codeStatut: row.code_statut,
      libelleStatut: statutByCode.get(row.code_statut)?.libelle ?? row.code_statut,
      dateHeure: row.date_heure,
      matriculeActeur: row.matricule_acteur,
      acteurNomPrenom: acteur ? `${acteur.prenom} ${acteur.nom}` : null,
      suppleanceLabel: row.id_suppleance !== null ? (suppleanceLabels.get(row.id_suppleance) ?? null) : null,
      commentaireStatut: row.commentaire_statut,
    }
  })
}

export interface ListQuery {
  idCellule?: number
  matriculeDemandeur?: string
  statut?: string
  /** Onglet de l'écran d'accueil (décision du 15/09/2026) — prioritaire sur `statut` si fourni, voir ACCUEIL_SCOPE_STATUTS. */
  scope?: AccueilScope
  search?: string
  /** Filtre "Fournisseurs" des onglets de l'écran d'accueil — correspondance exacte sur ID_FOURNISSEUR_RETENU. */
  idFournisseurRetenu?: number
}

/**
 * Liste filtrée de la page DemandeAchat / des onglets de l'écran d'accueil —
 * portée par rôle (voir resolveAccessContext) : Demandeur = uniquement
 * lui-même ; RC = sa cellule par défaut, ou le demandeur choisi (n'importe
 * lequel du service) si précisé ; ADMIN_SERVICE = tout son service par
 * défaut, ou une cellule/un demandeur choisi ; ADMIN_APP = sans restriction
 * (filtres appliqués tels quels s'ils sont fournis).
 */
export async function listDemandeAchat(matricule: string | null, query: ListQuery): Promise<DemandeAchat[]> {
  if (!matricule) throw new AppError('Authentification requise', 401)

  const context = await resolveAccessContext(matricule)
  // Bug corrigé le 15/09/2026 : `statut` (choix précis de l'utilisateur dans le filtre Statut d'un
  // onglet) doit l'emporter sur `scope` (la liste complète des statuts de l'onglet) — sinon le
  // filtre Statut de l'écran d'accueil n'avait aucun effet, `scope` étant toujours fourni par
  // Home.tsx. Le frontend ne propose de toute façon que des codes appartenant au scope actif
  // (voir ACCUEIL_SCOPE_STATUTS côté frontend), donc `statut` reste cohérent avec `scope` ici.
  const statuts = query.statut ? [query.statut] : query.scope ? ACCUEIL_SCOPE_STATUTS[query.scope] : STATUTS_PAGE_DEMANDE_ACHAT
  // Résolu une seule fois (décision du 09/09/2026) : la recherche texte porte aussi sur le
  // fournisseur retenu (ID_FOURNISSEUR_RETENU), pas seulement NUMERO/OBJET — voir
  // fournisseur.repository.ts#findIdsByRaisonSociale et demandeAchat.repository.ts#findAll.
  const idFournisseurIn = query.search ? await fournisseurRepository.findIdsByRaisonSociale(query.search) : undefined
  const idFournisseurRetenu = query.idFournisseurRetenu

  if (context.role === 'DEMANDEUR') {
    return demandeAchatRepository.findAll({
      matriculeDemandeurIn: [matricule],
      statuts,
      search: query.search,
      idFournisseurIn,
      idFournisseurRetenu,
    })
  }

  if (query.matriculeDemandeur) {
    // Vérifie que le demandeur ciblé appartient bien au service géré par l'appelant (RC/ADMIN_SERVICE) — ADMIN_APP non concerné (transverse).
    if (context.role !== 'ADMIN_APP') await assertCanActFor(matricule, query.matriculeDemandeur)
    return demandeAchatRepository.findAll({
      matriculeDemandeurIn: [query.matriculeDemandeur],
      statuts,
      search: query.search,
      idFournisseurIn,
      idFournisseurRetenu,
    })
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
      idFournisseurRetenu,
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
      idFournisseurRetenu,
    })
  }

  if (context.role === 'ADMIN_SERVICE') {
    return demandeAchatRepository.findAll({
      idService: context.ownIdService ?? undefined,
      statuts,
      search: query.search,
      idFournisseurIn,
      idFournisseurRetenu,
    })
  }

  // ADMIN_APP sans filtre : transverse, aucune restriction.
  return demandeAchatRepository.findAll({ statuts, search: query.search, idFournisseurIn, idFournisseurRetenu })
}

export interface SyntheseBucket {
  nombre: number
  montant: number
}

export interface AccueilSynthese {
  enTransit: Record<'RC' | 'CDS' | 'DS' | 'CB', SyntheseBucket>
  mesDemandes: { enCours: SyntheseBucket; commande: SyntheseBucket }
}

function nouvelleSyntheseBucket(): SyntheseBucket {
  return { nombre: 0, montant: 0 }
}

/**
 * Tuiles de synthèse de l'écran d'accueil (décision du 15/09/2026) et de
 * l'écran de suivi RC (décision du 15/09/2026, second chantier) — deux vues
 * du même calcul, distinguées par le rôle effectif de l'appelant :
 *
 * - **Demandeur** (par défaut, y compris tout rôle sans branche dédiée
 *   ci-dessous) : DA/FAD du connecté lui-même (jamais un tiers). "En
 *   transit" : 4 compartiments RC/CDS/DS/CB (colonne EN_TRANSIT de
 *   finances.statut). "Mes demandes" : En cours / Commande (FAD_COMMANDEE
 *   uniquement).
 * - **RC** (titulaire ou suppléant) : DA/FAD de sa cellule. "En transit" ne
 *   porte alors que 3 compartiments (CDS/DS/CB) — le compartiment RC reste à
 *   zéro : une DA encore chez le RC lui-même n'est pas "en transit" de son
 *   point de vue, déjà visible dans ses propres onglets "À traiter"/"En
 *   cours" (le champ existe toujours dans la réponse pour garder un type de
 *   retour unique, simplement jamais alimenté ni affiché côté RC). "Mes
 *   demandes" devient "Demandes de la cellule" côté frontend (même champ
 *   `mesDemandes`, seul le libellé change).
 *
 * **DA_EN_PREPARATION exclue de "En cours" dans les deux vues** (bug corrigé
 * le 15/09/2026, signalé par l'utilisateur pour la vue RC puis étendu à la
 * vue Demandeur par cohérence) : un brouillon jamais transmis reste la
 * propriété du demandeur, pas encore engagé dans le circuit d'approbation —
 * il ne doit compter ni dans "Mes demandes : En cours" (Demandeur) ni dans
 * "Demandes de la cellule : En cours" (RC), même si le champ EN_TRANSIT de
 * finances.statut ne le concerne de toute façon jamais (DEM, pas RC/CDS/DS/CB).
 */
export async function getSynthese(matricule: string | null): Promise<AccueilSynthese> {
  if (!matricule) throw new AppError('Authentification requise', 401)

  const context = await resolveAccessContext(matricule)
  const isRc = context.role === 'RC'

  const [acteurs, statuts] = await Promise.all([
    isRc
      ? context.ownIdCellule !== null
        ? acteurRepository.findAllByCellule(context.ownIdCellule)
        : Promise.resolve([])
      : Promise.resolve(null),
    statutRepository.findAll(),
  ])
  const rows = await demandeAchatRepository.findAll({
    matriculeDemandeurIn: isRc ? acteurs!.map((a) => a.matricule) : [matricule],
  })
  const enTransitByCode = new Map(statuts.map((s) => [s.code_statut, s.en_transit]))

  const enTransit: AccueilSynthese['enTransit'] = { RC: nouvelleSyntheseBucket(), CDS: nouvelleSyntheseBucket(), DS: nouvelleSyntheseBucket(), CB: nouvelleSyntheseBucket() }
  const mesDemandes: AccueilSynthese['mesDemandes'] = { enCours: nouvelleSyntheseBucket(), commande: nouvelleSyntheseBucket() }

  for (const row of rows) {
    if (row.code_statut === 'DA_EN_PREPARATION') continue

    const role = enTransitByCode.get(row.code_statut)
    const roleCompteRc = role === 'CDS' || role === 'DS' || role === 'CB'
    const roleCompteDemandeur = role === 'RC' || role === 'CDS' || role === 'DS' || role === 'CB'
    if ((isRc && roleCompteRc) || (!isRc && roleCompteDemandeur)) {
      enTransit[role as 'RC' | 'CDS' | 'DS' | 'CB'].nombre += 1
      enTransit[role as 'RC' | 'CDS' | 'DS' | 'CB'].montant += row.montant_demande
    }

    if (row.code_statut === 'FAD_COMMANDEE') {
      mesDemandes.commande.nombre += 1
      mesDemandes.commande.montant += row.montant_demande
    } else if (!STATUTS_REJETEES_ANNULEES.includes(row.code_statut)) {
      mesDemandes.enCours.nombre += 1
      mesDemandes.enCours.montant += row.montant_demande
    }
  }

  return { enTransit, mesDemandes }
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
 * DA_A_COMPLETER_RC restent modifiables (décision du 07/09/2026). Ne
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
    // Décision du 15/09/2026 (double objet/description) : tant que la DA reste éditable par le
    // demandeur (ce guard STATUTS_MODIFIABLES ci-dessus), OBJET_RC/DESCRIPTION_RC restent
    // synchronisés sur OBJET_DEMANDEUR/DESCRIPTION_DEMANDEUR — la divergence ne commence qu'à
    // OP1.2b (transmettreFad), qui écrit *_rc seul.
    objet_demandeur: data.objet,
    objet_rc: data.objet,
    description_demandeur: data.description,
    description_rc: data.description,
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

/**
 * OP1.1 (résultat final) — transmission de la DA au RC (croquis DA.pdf, bouton
 * « Transmettre au RC »). Règles d'émission (ForClaude/CDC/mct-phases-1-2.md
 * OP1.1) : demande complète — objet/description/montant renseignés, un
 * fournisseur retenu désigné (marché sélectionné ou candidat retenu en Hors
 * marché), un numéro de marché identifié en procédure MARCHE, et en
 * HORS_MARCHE au moins une entreprise consultée dont **toutes** ont un devis
 * déposé (fichier PDF, décision du 15/09/2026 — le devis reste facultatif en
 * procédure MARCHE, cf. décision du 07/09/2026, inchangée). Même règle
 * d'accès que la création (assertCanActFor) — un Demandeur transmet pour
 * lui-même, RC/ADMIN_SERVICE/ADMIN_APP peuvent transmettre pour un tiers
 * (même principe qu'OP1.1 création). Le Demandeur n'a pas de rôle dédié
 * (ROLE_ATTRIBUTION) : jamais de suppléance à tracer ici (ID_SUPPLEANCE=null).
 */
export async function transmettreRc(matricule: string | null, idDemandeAchat: number): Promise<DemandeAchat> {
  if (!matricule) throw new AppError('Authentification requise', 401)

  const existing = await demandeAchatRepository.findById(idDemandeAchat)
  if (!existing) throw new AppError('Demande d\'achat introuvable', 404)

  await assertCanActFor(matricule, existing.matricule_demandeur)
  if (!['DA_EN_PREPARATION', 'DA_A_COMPLETER_RC'].includes(existing.code_statut)) {
    throw new AppError('Cette demande ne peut pas être transmise au RC à ce stade.', 409)
  }

  if (existing.objet_demandeur.trim().length < 15) throw new AppError('L\'objet est obligatoire (15 caractères minimum).', 409)
  if (!existing.description_demandeur?.trim()) throw new AppError('La description est obligatoire.', 409)
  if (!(existing.montant_demande > 0)) throw new AppError('Le montant de la demande doit être renseigné.', 409)
  if (existing.id_fournisseur_retenu === null) {
    throw new AppError('Sélectionnez un marché ou consultez des fournisseurs avant de transmettre.', 409)
  }
  if (existing.procedure_achat === 'MARCHE' && existing.nummarche === null && existing.id_marche_tiers === null) {
    throw new AppError('Le numéro de marché est obligatoire en procédure Marché.', 409)
  }
  if (existing.procedure_achat === 'HORS_MARCHE') {
    const candidats = await devisConsulteRepository.findAllByDemandeAchat(idDemandeAchat)
    if (candidats.length === 0) throw new AppError('Au moins une entreprise consultée est requise.', 409)
    if (candidats.some((c) => c.nom_fichier_original === null)) {
      throw new AppError('Chaque entreprise consultée doit avoir un devis déposé.', 409)
    }
  }

  await historiqueStatutRepository.create({
    id_demande_achat: idDemandeAchat,
    code_statut: 'DA_TRANSMISE_DEM_RC',
    matricule_acteur: matricule,
    id_suppleance: null,
    commentaire_statut: null,
  })
  return (await demandeAchatRepository.findById(idDemandeAchat)) as DemandeAchat
}

const decisionSchema = z
  .object({
    decision: z.enum(['VALIDER', 'REJETER', 'ANNULER', 'COMPLEMENT']),
    commentaireStatut: z.string().trim().min(1).max(500).optional(),
  })
  .refine((d) => d.decision === 'VALIDER' || !!d.commentaireStatut, {
    message: 'Un commentaire est requis pour justifier ce choix.',
  })

const DECISION_RC_CODES: Record<string, string> = {
  VALIDER: 'DA_VALIDEE_RC',
  REJETER: 'DA_REJETEE_RC',
  ANNULER: 'DA_ANNULEE_RC',
  COMPLEMENT: 'DA_A_COMPLETER_RC',
}

/**
 * OP1.2 — Statuer sur l'opportunité d'achat (RC, ou son suppléant) — file RC
 * de la cellule du demandeur. Un commentaire est obligatoire pour toute
 * décision autre que VALIDER (motif de rejet/annulation/complément,
 * consultable ensuite via l'historique des statuts).
 */
export async function decisionRc(matricule: string | null, idDemandeAchat: number, input: unknown): Promise<DemandeAchat> {
  if (!matricule) throw new AppError('Authentification requise', 401)

  const result = decisionSchema.safeParse(input)
  if (!result.success) throw new AppError(result.error.issues[0]?.message ?? 'Requête invalide', 400)

  const existing = await demandeAchatRepository.findById(idDemandeAchat)
  if (!existing) throw new AppError('Demande d\'achat introuvable', 404)
  if (existing.code_statut !== 'DA_TRANSMISE_DEM_RC') {
    throw new AppError('Cette demande n\'est plus au statut attendu.', 409)
  }

  const demandeur = await acteurRepository.findByMatricule(existing.matricule_demandeur)
  if (!demandeur) throw new AppError('Demandeur introuvable.', 404)
  const role = await roleEffectifService.assertHasEffectiveRole(matricule, 'RC', demandeur.id_cellule)

  await historiqueStatutRepository.create({
    id_demande_achat: idDemandeAchat,
    code_statut: DECISION_RC_CODES[result.data.decision],
    matricule_acteur: matricule,
    id_suppleance: role.idSuppleance,
    commentaire_statut: result.data.commentaireStatut ?? null,
  })
  return (await demandeAchatRepository.findById(idDemandeAchat)) as DemandeAchat
}

const transmettreFadSchema = z
  .object({
    objet: z.string().trim().min(15).max(75).optional(),
    description: z.string().trim().min(1).max(256).optional(),
    codeSite: z.string().trim().min(1),
    codeSousSite: z.string().trim().min(1).nullable().optional(),
    codeSecteur: z.string().trim().min(1),
    codeSousSecteur: z.string().trim().min(1).nullable().optional(),
    codeCug: z.string().trim().min(1),
    typeAchat: z.enum(['TRAVAUX', 'FOURNITURES', 'SERVICES']),
    imputationComptable: z.enum(['FONCTIONNEMENT', 'INVESTISSEMENT']),
    numeroOperation: z.string().trim().min(1).nullable().optional(),
  })
  .refine((d) => d.imputationComptable !== 'INVESTISSEMENT' || !!d.numeroOperation, {
    message: 'Le numéro d\'opération est obligatoire pour une imputation en investissement.',
  })

/**
 * OP1.2b — Finaliser et transmettre la FAD au CDS (RC, ou son suppléant) —
 * bascule DA → FAD (ForClaude/CDC/mct-phases-1-2.md). Écrit la localisation
 * et l'imputation (jamais saisies par le Demandeur à OP1.1, décision du
 * 07/09/2026), transmet ensuite systématiquement au CDS — pas de nouvelle
 * décision à cette étape (enchaînement RC : mise en forme puis envoi, même
 * acteur). Réutilisée aussi bien pour la transmission initiale
 * (DA_VALIDEE_RC) que pour la retransmission après complément demandé par le
 * CDS (FAD_A_COMPLETER_CDS) — même code de résultat dans les deux cas.
 */
export async function transmettreFad(matricule: string | null, idDemandeAchat: number, input: unknown): Promise<DemandeAchat> {
  if (!matricule) throw new AppError('Authentification requise', 401)

  const result = transmettreFadSchema.safeParse(input)
  if (!result.success) throw new AppError(result.error.issues[0]?.message ?? 'Requête invalide', 400)

  const existing = await demandeAchatRepository.findById(idDemandeAchat)
  if (!existing) throw new AppError('Demande d\'achat introuvable', 404)
  if (!['DA_VALIDEE_RC', 'FAD_A_COMPLETER_CDS'].includes(existing.code_statut)) {
    throw new AppError('Cette FAD ne peut pas être transmise au CDS à ce stade.', 409)
  }

  const demandeur = await acteurRepository.findByMatricule(existing.matricule_demandeur)
  if (!demandeur) throw new AppError('Demandeur introuvable.', 404)
  const role = await roleEffectifService.assertHasEffectiveRole(matricule, 'RC', demandeur.id_cellule)

  const data = result.data
  await demandeAchatRepository.update(idDemandeAchat, {
    // OBJET_RC/DESCRIPTION_RC seuls — OBJET_DEMANDEUR/DESCRIPTION_DEMANDEUR ne sont plus jamais
    // réécrits à partir d'ici (décision du 15/09/2026), la reformulation du RC diverge du texte
    // d'origine du demandeur.
    objet_rc: data.objet,
    description_rc: data.description,
    code_site: data.codeSite,
    code_sous_site: data.codeSousSite ?? null,
    code_secteur: data.codeSecteur,
    code_sous_secteur: data.codeSousSecteur ?? null,
    code_cug: data.codeCug,
    type_achat: data.typeAchat,
    imputation_comptable: data.imputationComptable,
    numero_operation: data.imputationComptable === 'INVESTISSEMENT' ? data.numeroOperation : null,
  })

  await historiqueStatutRepository.create({
    id_demande_achat: idDemandeAchat,
    code_statut: 'FAD_TRANSMISE_RC_CDS',
    matricule_acteur: matricule,
    id_suppleance: role.idSuppleance,
    commentaire_statut: null,
  })
  return (await demandeAchatRepository.findById(idDemandeAchat)) as DemandeAchat
}

const DECISION_CDS_CODES: Record<string, string> = {
  VALIDER: 'FAD_VALIDEE_CDS',
  REJETER: 'FAD_REJETEE_CDS',
  ANNULER: 'FAD_ANNULEE_CDS',
  COMPLEMENT: 'FAD_A_COMPLETER_CDS',
}

/**
 * OP1.3 — Statuer sur la FAD (CDS, ou son suppléant) — file CDS du service de
 * la FAD. Même schéma de décision qu'OP1.2 (decisionRc) — commentaire
 * obligatoire hors VALIDER. Périmètre CDS = ID_SERVICE de la FAD directement
 * (contrairement à RC, scopé sur la cellule du demandeur).
 */
export async function decisionCds(matricule: string | null, idDemandeAchat: number, input: unknown): Promise<DemandeAchat> {
  if (!matricule) throw new AppError('Authentification requise', 401)

  const result = decisionSchema.safeParse(input)
  if (!result.success) throw new AppError(result.error.issues[0]?.message ?? 'Requête invalide', 400)

  const existing = await demandeAchatRepository.findById(idDemandeAchat)
  if (!existing) throw new AppError('Demande d\'achat introuvable', 404)
  if (existing.code_statut !== 'FAD_TRANSMISE_RC_CDS') {
    throw new AppError('Cette FAD n\'est plus au statut attendu.', 409)
  }

  const role = await roleEffectifService.assertHasEffectiveRole(matricule, 'CDS', existing.id_service)

  await historiqueStatutRepository.create({
    id_demande_achat: idDemandeAchat,
    code_statut: DECISION_CDS_CODES[result.data.decision],
    matricule_acteur: matricule,
    id_suppleance: role.idSuppleance,
    commentaire_statut: result.data.commentaireStatut ?? null,
  })
  return (await demandeAchatRepository.findById(idDemandeAchat)) as DemandeAchat
}

/**
 * OP1.3b — Transmettre la FAD à la CB (CDS, ou son suppléant) — enchaînée
 * sans coupure après OP1.3 dans le geste métier, mais un appel HTTP distinct
 * (décision du 14/09/2026 : la validation n'entraîne plus la transmission
 * garantie-atomique, le CDS peut décliner et retrouver la FAD dans sa propre
 * file). Transmission systématique une fois déclenchée — pas de nouvelle
 * décision, aucun champ à écrire.
 */
export async function transmettreCb(matricule: string | null, idDemandeAchat: number): Promise<DemandeAchat> {
  if (!matricule) throw new AppError('Authentification requise', 401)

  const existing = await demandeAchatRepository.findById(idDemandeAchat)
  if (!existing) throw new AppError('Demande d\'achat introuvable', 404)
  if (existing.code_statut !== 'FAD_VALIDEE_CDS') {
    throw new AppError('Cette FAD ne peut pas être transmise à la CB à ce stade.', 409)
  }

  const role = await roleEffectifService.assertHasEffectiveRole(matricule, 'CDS', existing.id_service)

  await historiqueStatutRepository.create({
    id_demande_achat: idDemandeAchat,
    code_statut: 'FAD_TRANSMISE_CDS_CB',
    matricule_acteur: matricule,
    id_suppleance: role.idSuppleance,
    commentaire_statut: null,
  })
  return (await demandeAchatRepository.findById(idDemandeAchat)) as DemandeAchat
}

const decisionCbSchema = z
  .object({
    decision: z.enum(['VALIDER', 'REJETER', 'MODIFIER']),
    commentaireStatut: z.string().trim().min(1).max(500).optional(),
    // Décision validée le 15/09/2026 : la CB peut aussi corriger les champs budgétaires/
    // comptables en plus de sa décision (contrairement à OP1.3/OP1.5, purement décisionnelles).
    codeCug: z.string().trim().min(1).optional(),
    typeAchat: z.enum(['TRAVAUX', 'FOURNITURES', 'SERVICES']).optional(),
    imputationComptable: z.enum(['FONCTIONNEMENT', 'INVESTISSEMENT']).optional(),
    numeroOperation: z.string().trim().min(1).nullable().optional(),
  })
  .refine((d) => d.decision === 'VALIDER' || !!d.commentaireStatut, {
    message: 'Un commentaire est requis pour justifier ce choix.',
  })
  .refine((d) => d.imputationComptable !== 'INVESTISSEMENT' || !!d.numeroOperation, {
    message: 'Le numéro d\'opération est obligatoire pour une imputation en investissement.',
  })

const DECISION_CB_CODES: Record<string, string> = {
  VALIDER: 'FAD_VALIDEE_CB',
  REJETER: 'FAD_REJETEE_CB',
  MODIFIER: 'FAD_A_MODIFIER_CB',
}

/**
 * OP1.4 — Contrôle financier et budgétaire (CB, collectif service — jamais de
 * suppléance, exclue en base). File CB du service de la FAD. Contrairement à
 * OP1.2/OP1.3/OP1.5 (purement décisionnelles), la CB peut aussi corriger les
 * champs budgétaires/comptables (CUG, type d'achat, imputation, numéro
 * d'opération) au même geste que sa décision — décision validée le
 * 15/09/2026. Pas d'issue « annulé » (la CB ne juge jamais l'opportunité de
 * l'achat, seulement crédits/marché/plafond, ForClaude/CDC/code_statut.pdf).
 * Accepte les deux statuts d'entrée nominal (FAD_TRANSMISE_CDS_CB) et reprise
 * directe du RC (FAD_MODIFIEE_TRANSMISE_RC_CB, sans repasser par le CDS).
 */
export async function decisionCb(matricule: string | null, idDemandeAchat: number, input: unknown): Promise<DemandeAchat> {
  if (!matricule) throw new AppError('Authentification requise', 401)

  const result = decisionCbSchema.safeParse(input)
  if (!result.success) throw new AppError(result.error.issues[0]?.message ?? 'Requête invalide', 400)

  const existing = await demandeAchatRepository.findById(idDemandeAchat)
  if (!existing) throw new AppError('Demande d\'achat introuvable', 404)
  if (!['FAD_TRANSMISE_CDS_CB', 'FAD_MODIFIEE_TRANSMISE_RC_CB'].includes(existing.code_statut)) {
    throw new AppError('Cette FAD n\'est plus au statut attendu.', 409)
  }

  const role = await roleEffectifService.assertHasEffectiveRole(matricule, 'CB', existing.id_service)

  const data = result.data
  if (data.codeCug !== undefined || data.typeAchat !== undefined || data.imputationComptable !== undefined) {
    await demandeAchatRepository.update(idDemandeAchat, {
      code_cug: data.codeCug,
      type_achat: data.typeAchat,
      imputation_comptable: data.imputationComptable,
      numero_operation: data.imputationComptable === undefined ? undefined : data.imputationComptable === 'INVESTISSEMENT' ? data.numeroOperation : null,
    })
  }

  await historiqueStatutRepository.create({
    id_demande_achat: idDemandeAchat,
    code_statut: DECISION_CB_CODES[data.decision],
    matricule_acteur: matricule,
    id_suppleance: role.idSuppleance,
    commentaire_statut: data.commentaireStatut ?? null,
  })
  return (await demandeAchatRepository.findById(idDemandeAchat)) as DemandeAchat
}

const retransmettreCbSchema = z
  .object({
    objet: z.string().trim().min(15).max(75).optional(),
    description: z.string().trim().min(1).max(256).optional(),
    codeSite: z.string().trim().min(1).optional(),
    codeSousSite: z.string().trim().min(1).nullable().optional(),
    codeSecteur: z.string().trim().min(1).optional(),
    codeSousSecteur: z.string().trim().min(1).nullable().optional(),
    codeCug: z.string().trim().min(1).optional(),
    typeAchat: z.enum(['TRAVAUX', 'FOURNITURES', 'SERVICES']).optional(),
    imputationComptable: z.enum(['FONCTIONNEMENT', 'INVESTISSEMENT']).optional(),
    numeroOperation: z.string().trim().min(1).nullable().optional(),
  })
  .refine((d) => d.imputationComptable !== 'INVESTISSEMENT' || !!d.numeroOperation, {
    message: 'Le numéro d\'opération est obligatoire pour une imputation en investissement.',
  })

/**
 * Reprise OP1.4 — FAD à modifier (RC, ou son suppléant) : le RC apporte les
 * modifications demandées par la CB et retransmet **directement à la CB**
 * (FAD_MODIFIEE_TRANSMISE_RC_CB), sans repasser par le CDS
 * (ForClaude/CDC/mct-phases-1-2.md). Tous les champs sont optionnels
 * (contrairement à transmettreFad/OP1.2b) : le RC ne corrige que ce que la
 * CB a demandé, le reste reste inchangé.
 */
export async function retransmettreCb(matricule: string | null, idDemandeAchat: number, input: unknown): Promise<DemandeAchat> {
  if (!matricule) throw new AppError('Authentification requise', 401)

  const result = retransmettreCbSchema.safeParse(input)
  if (!result.success) throw new AppError(result.error.issues[0]?.message ?? 'Requête invalide', 400)

  const existing = await demandeAchatRepository.findById(idDemandeAchat)
  if (!existing) throw new AppError('Demande d\'achat introuvable', 404)
  if (existing.code_statut !== 'FAD_A_MODIFIER_CB') {
    throw new AppError('Cette FAD ne peut pas être retransmise à la CB à ce stade.', 409)
  }

  const demandeur = await acteurRepository.findByMatricule(existing.matricule_demandeur)
  if (!demandeur) throw new AppError('Demandeur introuvable.', 404)
  const role = await roleEffectifService.assertHasEffectiveRole(matricule, 'RC', demandeur.id_cellule)

  const data = result.data
  if (Object.values(data).some((v) => v !== undefined)) {
    await demandeAchatRepository.update(idDemandeAchat, {
      objet_rc: data.objet,
      description_rc: data.description,
      code_site: data.codeSite,
      code_sous_site: data.codeSousSite,
      code_secteur: data.codeSecteur,
      code_sous_secteur: data.codeSousSecteur,
      code_cug: data.codeCug,
      type_achat: data.typeAchat,
      imputation_comptable: data.imputationComptable,
      numero_operation: data.imputationComptable === undefined ? undefined : data.imputationComptable === 'INVESTISSEMENT' ? data.numeroOperation : null,
    })
  }

  await historiqueStatutRepository.create({
    id_demande_achat: idDemandeAchat,
    code_statut: 'FAD_MODIFIEE_TRANSMISE_RC_CB',
    matricule_acteur: matricule,
    id_suppleance: role.idSuppleance,
    commentaire_statut: null,
  })
  return (await demandeAchatRepository.findById(idDemandeAchat)) as DemandeAchat
}

/**
 * Insère une ligne FAD_A_COMMANDER immédiatement après une transition qui y
 * mène automatiquement (OP1.4b sous seuil, OP1.5b) — « simple indicateur de
 * tâche pour la CB, sans impact sur le reste du workflow »
 * (ForClaude/CDC/mct-phases-1-2.md OP1.5c/OP1.6, décision du 15/09/2026 sur
 * le chaînage automatique). Tracée sous l'identité de l'acteur qui a
 * déclenché la transition parente (CB ou DS), jamais de suppléance : ce
 * n'est pas une décision de sa part sur ce statut précis, une simple
 * conséquence système.
 */
async function chainerFadACommander(idDemandeAchat: number, matricule: string): Promise<void> {
  await historiqueStatutRepository.create({
    id_demande_achat: idDemandeAchat,
    code_statut: 'FAD_A_COMMANDER',
    matricule_acteur: matricule,
    id_suppleance: null,
    commentaire_statut: null,
  })
}

/**
 * OP1.4b — Router selon le seuil (déclenché par la CB, automatique et
 * synchrone dans le même appel — ForClaude/CDC/mct-phases-1-2.md : « sans
 * intervention humaine [...] instantanée »). Compare MONTANT_DEMANDE au
 * seuil du service pour l'imputation de la FAD (absence de ligne
 * SEUIL_VALIDATION_DS = seuils à 0, voir seuilValidationDs.repository.ts) :
 * seuil atteint → transmission humaine au DS (FAD_TRANSMISE_CB_DS) ; sinon
 * exemption automatique (FAD_VALIDEE_DS_SEUIL) qui enchaîne aussitôt sur
 * FAD_A_COMMANDER (décision du 15/09/2026).
 */
export async function transmettreDsOuSeuil(matricule: string | null, idDemandeAchat: number): Promise<DemandeAchat> {
  if (!matricule) throw new AppError('Authentification requise', 401)

  const existing = await demandeAchatRepository.findById(idDemandeAchat)
  if (!existing) throw new AppError('Demande d\'achat introuvable', 404)
  if (existing.code_statut !== 'FAD_VALIDEE_CB') {
    throw new AppError('Cette FAD ne peut pas être routée à ce stade.', 409)
  }

  const role = await roleEffectifService.assertHasEffectiveRole(matricule, 'CB', existing.id_service)

  const seuils = await seuilValidationDsRepository.findByService(existing.id_service)
  const seuil =
    existing.imputation_comptable === 'INVESTISSEMENT' ? (seuils?.seuil_investissement ?? 0) : (seuils?.seuil_fonctionnement ?? 0)

  if (existing.montant_demande >= seuil) {
    await historiqueStatutRepository.create({
      id_demande_achat: idDemandeAchat,
      code_statut: 'FAD_TRANSMISE_CB_DS',
      matricule_acteur: matricule,
      id_suppleance: role.idSuppleance,
      commentaire_statut: null,
    })
  } else {
    await historiqueStatutRepository.create({
      id_demande_achat: idDemandeAchat,
      code_statut: 'FAD_VALIDEE_DS_SEUIL',
      matricule_acteur: matricule,
      id_suppleance: role.idSuppleance,
      commentaire_statut: null,
    })
    await chainerFadACommander(idDemandeAchat, matricule)
  }

  return (await demandeAchatRepository.findById(idDemandeAchat)) as DemandeAchat
}

const DECISION_DS_CODES: Record<string, string> = {
  VALIDER: 'FAD_VALIDEE_DS',
  REJETER: 'FAD_REJETEE_DS',
  ANNULER: 'FAD_ANNULEE_DS',
  // Reprise par la CB (pas le RC) — seule boucle qui ne remonte pas jusqu'au RC (décision du 14/09/2026).
  COMPLEMENT: 'FAD_A_COMPLETER_CB',
}

/**
 * OP1.5 — Statuer sur la FAD (DS, ou son suppléant), uniquement si
 * FAD_TRANSMISE_CB_DS. File DS de la direction du service de la FAD. Même
 * schéma de décision qu'OP1.2/OP1.3 — commentaire obligatoire hors VALIDER.
 * La reprise « complément demandé » diffère des autres boucles : elle
 * revient à la CB, pas au RC (ForClaude/CDC/mct-phases-1-2.md).
 */
export async function decisionDs(matricule: string | null, idDemandeAchat: number, input: unknown): Promise<DemandeAchat> {
  if (!matricule) throw new AppError('Authentification requise', 401)

  const result = decisionSchema.safeParse(input)
  if (!result.success) throw new AppError(result.error.issues[0]?.message ?? 'Requête invalide', 400)

  const existing = await demandeAchatRepository.findById(idDemandeAchat)
  if (!existing) throw new AppError('Demande d\'achat introuvable', 404)
  if (existing.code_statut !== 'FAD_TRANSMISE_CB_DS') {
    throw new AppError('Cette FAD n\'est plus au statut attendu.', 409)
  }

  const service = await serviceRepository.findById(existing.id_service)
  if (!service) throw new AppError('Service introuvable.', 404)
  const role = await roleEffectifService.assertHasEffectiveRole(matricule, 'DS', service.id_direction)

  await historiqueStatutRepository.create({
    id_demande_achat: idDemandeAchat,
    code_statut: DECISION_DS_CODES[result.data.decision],
    matricule_acteur: matricule,
    id_suppleance: role.idSuppleance,
    commentaire_statut: result.data.commentaireStatut ?? null,
  })
  return (await demandeAchatRepository.findById(idDemandeAchat)) as DemandeAchat
}

/**
 * OP1.5b — Donner l'ordre de commande à la CB (DS, ou son suppléant),
 * uniquement si FAD_VALIDEE_DS. Symétrique d'OP1.2b/OP1.3b : le DS enchaîne
 * validation puis transmission de l'ordre, comme RC et CDS avant lui.
 * Transmission systématique (FAD_TRANSMISE_DS_CB) qui enchaîne aussitôt sur
 * FAD_A_COMMANDER (décision du 15/09/2026, même principe que la branche sous
 * seuil d'OP1.4b — convergence des deux chemins vers le même indicateur de
 * tâche pour la CB).
 */
export async function transmettreOrdreCb(matricule: string | null, idDemandeAchat: number): Promise<DemandeAchat> {
  if (!matricule) throw new AppError('Authentification requise', 401)

  const existing = await demandeAchatRepository.findById(idDemandeAchat)
  if (!existing) throw new AppError('Demande d\'achat introuvable', 404)
  if (existing.code_statut !== 'FAD_VALIDEE_DS') {
    throw new AppError('Cette FAD ne peut pas être transmise à ce stade.', 409)
  }

  const service = await serviceRepository.findById(existing.id_service)
  if (!service) throw new AppError('Service introuvable.', 404)
  const role = await roleEffectifService.assertHasEffectiveRole(matricule, 'DS', service.id_direction)

  await historiqueStatutRepository.create({
    id_demande_achat: idDemandeAchat,
    code_statut: 'FAD_TRANSMISE_DS_CB',
    matricule_acteur: matricule,
    id_suppleance: role.idSuppleance,
    commentaire_statut: null,
  })
  await chainerFadACommander(idDemandeAchat, matricule)

  return (await demandeAchatRepository.findById(idDemandeAchat)) as DemandeAchat
}

const completerCbSchema = z
  .object({
    codeCug: z.string().trim().min(1).optional(),
    typeAchat: z.enum(['TRAVAUX', 'FOURNITURES', 'SERVICES']).optional(),
    imputationComptable: z.enum(['FONCTIONNEMENT', 'INVESTISSEMENT']).optional(),
    numeroOperation: z.string().trim().min(1).nullable().optional(),
  })
  .refine((d) => d.imputationComptable !== 'INVESTISSEMENT' || !!d.numeroOperation, {
    message: 'Le numéro d\'opération est obligatoire pour une imputation en investissement.',
  })

/**
 * Reprise OP1.5 — FAD à compléter par la CB (CB, uniquement si
 * FAD_A_COMPLETER_CB) : seule boucle de reprise qui ne remonte pas jusqu'au
 * RC — la CB apporte elle-même le complément sur la nature de l'achat ou les
 * aspects budgétaires/comptables et retransmet **directement au DS**, en
 * réutilisant le statut nominal FAD_TRANSMISE_CB_DS (pas de duplication).
 */
export async function completerCb(matricule: string | null, idDemandeAchat: number, input: unknown): Promise<DemandeAchat> {
  if (!matricule) throw new AppError('Authentification requise', 401)

  const result = completerCbSchema.safeParse(input)
  if (!result.success) throw new AppError(result.error.issues[0]?.message ?? 'Requête invalide', 400)

  const existing = await demandeAchatRepository.findById(idDemandeAchat)
  if (!existing) throw new AppError('Demande d\'achat introuvable', 404)
  if (existing.code_statut !== 'FAD_A_COMPLETER_CB') {
    throw new AppError('Cette FAD ne peut pas être complétée à ce stade.', 409)
  }

  const role = await roleEffectifService.assertHasEffectiveRole(matricule, 'CB', existing.id_service)

  const data = result.data
  if (data.codeCug !== undefined || data.typeAchat !== undefined || data.imputationComptable !== undefined) {
    await demandeAchatRepository.update(idDemandeAchat, {
      code_cug: data.codeCug,
      type_achat: data.typeAchat,
      imputation_comptable: data.imputationComptable,
      numero_operation: data.imputationComptable === undefined ? undefined : data.imputationComptable === 'INVESTISSEMENT' ? data.numeroOperation : null,
    })
  }

  await historiqueStatutRepository.create({
    id_demande_achat: idDemandeAchat,
    code_statut: 'FAD_TRANSMISE_CB_DS',
    matricule_acteur: matricule,
    id_suppleance: role.idSuppleance,
    commentaire_statut: null,
  })
  return (await demandeAchatRepository.findById(idDemandeAchat)) as DemandeAchat
}

const commanderSchema = z.object({
  montantCommande: z.number().nonnegative(),
})

/**
 * OP1.6 — Élaborer et constater la commande (CB), uniquement si
 * FAD_A_COMMANDER. La saisie du BON dans le PGI est une tâche manuelle hors
 * application (TM, ForClaude/CDC/mot-phases-1-2.md) — cette fonction
 * n'enregistre que le constat côté VIGIE : MONTANT_COMMANDE puis
 * FAD_COMMANDEE.
 */
export async function commander(matricule: string | null, idDemandeAchat: number, input: unknown): Promise<DemandeAchat> {
  if (!matricule) throw new AppError('Authentification requise', 401)

  const result = commanderSchema.safeParse(input)
  if (!result.success) throw new AppError(result.error.issues[0]?.message ?? 'Requête invalide', 400)

  const existing = await demandeAchatRepository.findById(idDemandeAchat)
  if (!existing) throw new AppError('Demande d\'achat introuvable', 404)
  if (existing.code_statut !== 'FAD_A_COMMANDER') {
    throw new AppError('Cette FAD ne peut pas être commandée à ce stade.', 409)
  }

  const role = await roleEffectifService.assertHasEffectiveRole(matricule, 'CB', existing.id_service)

  await demandeAchatRepository.update(idDemandeAchat, { montant_commande: result.data.montantCommande })
  await historiqueStatutRepository.create({
    id_demande_achat: idDemandeAchat,
    code_statut: 'FAD_COMMANDEE',
    matricule_acteur: matricule,
    id_suppleance: role.idSuppleance,
    commentaire_statut: null,
  })
  return (await demandeAchatRepository.findById(idDemandeAchat)) as DemandeAchat
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
 * DA_A_COMPLETER_RC, déjà transmise une première fois — décision du
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
