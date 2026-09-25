import { z } from 'zod'
import * as certificatServiceFaitRepository from '../repositories/certificatServiceFait.repository.js'
import * as historiqueStatutCsfRepository from '../repositories/historiqueStatutCsf.repository.js'
import * as pieceJointeRepository from '../repositories/pieceJointe.repository.js'
import * as demandeAchatRepository from '../repositories/demandeAchat.repository.js'
import * as acteurRepository from '../repositories/acteur.repository.js'
import * as authRepository from '../repositories/auth.repository.js'
import * as roleEffectifService from './roleEffectif.service.js'
import { AppError } from '../middlewares/errorHandler.js'
import type { CertificatServiceFait } from '../repositories/certificatServiceFait.repository.js'
import type { PieceJointeCsf } from '../repositories/pieceJointe.repository.js'
import type { DemandeAchat } from '../repositories/demandeAchat.repository.js'

/**
 * Circuit CSF (Phase 2, refonte du 24/09/2026 — voir ForClaude/CDC/mcd-phases-1-2.md
 * §3-§6, mct-phases-1-2.md Processus 2). Aucun rejet ni annulation : le RC et
 * la CB ne disposent que de la transmission, de la demande de complément
 * (toujours non terminale) et — pour le rédacteur/RC uniquement — de la
 * suppression physique (R7). Rôles réutilisés de la Phase 1 : RC (cellule du
 * demandeur de la FAD), CB (service de la FAD) — ni CDS, ni DS, ni
 * ADMIN_SERVICE ne figurent dans ce circuit (MCD §3), à la différence du
 * périmètre plus large de demandeAchat.service.ts#assertCanActFor.
 */

const STATUTS_TRANSMISSIBLES_RC = ['CSF_EN_PREPARATION', 'CSF_A_COMPLETER_RC']
const STATUTS_SUPPRESSIBLES_REDACTEUR = ['CSF_EN_PREPARATION', 'CSF_A_COMPLETER_RC']
const STATUT_SUPPRESSIBLE_RC = 'CSF_A_TRAITER'
const STATUTS_PIECES_MODIFIABLES_REDACTEUR = ['CSF_EN_PREPARATION', 'CSF_A_COMPLETER_RC']
const STATUT_PIECES_MODIFIABLE_RC = 'CSF_A_TRAITER'

interface CsfContext {
  csf: CertificatServiceFait
  fad: DemandeAchat
  /** Cellule du demandeur de la FAD — périmètre RC (R3, MCD §3). `null` si le demandeur n'a pas de cellule résolue (ne devrait pas arriver en pratique). */
  idCelluleDemandeur: number | null
}

async function loadContext(idCsf: number): Promise<CsfContext> {
  const csf = await certificatServiceFaitRepository.findById(idCsf)
  if (!csf) throw new AppError('Certificat de service fait introuvable', 404)
  const fad = await demandeAchatRepository.findById(csf.id_demande_achat)
  if (!fad) throw new AppError('Demande d\'achat introuvable', 404)
  const demandeur = await acteurRepository.findByMatricule(fad.matricule_demandeur)
  return { csf, fad, idCelluleDemandeur: demandeur?.id_cellule ?? null }
}

async function loadFadContext(idDemandeAchat: number): Promise<{ fad: DemandeAchat; idCelluleDemandeur: number | null }> {
  const fad = await demandeAchatRepository.findById(idDemandeAchat)
  if (!fad) throw new AppError('Demande d\'achat introuvable', 404)
  const demandeur = await acteurRepository.findByMatricule(fad.matricule_demandeur)
  return { fad, idCelluleDemandeur: demandeur?.id_cellule ?? null }
}

/** Rédacteur (R3) : demandeur initial de la FAD, ou RC (rôle actif, hors lecture seule) de sa cellule — rôle, pas identité figée : tout RC actuel de la cellule peut reprendre un CSF, pas seulement celui qui l'a créé. */
async function isRedacteurEligible(matricule: string, ctx: { fad: DemandeAchat; idCelluleDemandeur: number | null }): Promise<boolean> {
  if (matricule === ctx.fad.matricule_demandeur) return true
  if (ctx.idCelluleDemandeur === null) return false
  const roles = await roleEffectifService.findEffectiveRoles(matricule)
  return roles.some((r) => r.typeRole === 'RC' && r.idCellule === ctx.idCelluleDemandeur && !r.lectureSeule)
}

async function isRcEligible(matricule: string, ctx: { idCelluleDemandeur: number | null }): Promise<boolean> {
  if (ctx.idCelluleDemandeur === null) return false
  const roles = await roleEffectifService.findEffectiveRoles(matricule)
  return roles.some((r) => r.typeRole === 'RC' && r.idCellule === ctx.idCelluleDemandeur && !r.lectureSeule)
}

/** Lève 403 si `matricule` n'est ni le demandeur de la FAD, ni un RC actif (non suppléé) de sa cellule, ni ADMIN_APP — retourne l'ID_SUPPLEANCE à tracer sur HISTORIQUE_STATUT_CSF (`null` pour le demandeur/ADMIN_APP, qui n'agissent jamais en suppléance). */
async function requireRedacteur(matricule: string, ctx: { fad: DemandeAchat; idCelluleDemandeur: number | null }): Promise<number | null> {
  if (await authRepository.hasActiveRole(matricule, 'ADMIN_APP')) return null
  if (matricule === ctx.fad.matricule_demandeur) return null
  if (ctx.idCelluleDemandeur !== null) {
    try {
      const role = await roleEffectifService.assertHasEffectiveRole(matricule, 'RC', ctx.idCelluleDemandeur)
      return role.idSuppleance
    } catch {
      // tombe sur le refus générique ci-dessous
    }
  }
  throw new AppError('Seul le rédacteur (demandeur initial ou RC) peut effectuer cette action.', 403)
}

async function requireRc(matricule: string, ctx: { idCelluleDemandeur: number | null }): Promise<number | null> {
  if (await authRepository.hasActiveRole(matricule, 'ADMIN_APP')) return null
  if (ctx.idCelluleDemandeur === null) throw new AppError('RC introuvable pour cette demande d\'achat.', 403)
  const role = await roleEffectifService.assertHasEffectiveRole(matricule, 'RC', ctx.idCelluleDemandeur)
  return role.idSuppleance
}

async function requireCb(matricule: string, ctx: { fad: DemandeAchat }): Promise<number | null> {
  if (await authRepository.hasActiveRole(matricule, 'ADMIN_APP')) return null
  const role = await roleEffectifService.assertHasEffectiveRole(matricule, 'CB', ctx.fad.id_service)
  return role.idSuppleance
}

/** Visibilité en lecture — même périmètre que la policy RLS finances.can_view_certificat_service_fait (migration 20260924120000) : rédacteur, demandeur de la FAD, RC de la cellule (y compris lecture seule/suppléant), CB du service, ADMIN_APP. */
async function assertCanView(matricule: string, ctx: CsfContext): Promise<void> {
  if (await authRepository.hasActiveRole(matricule, 'ADMIN_APP')) return
  if (matricule === ctx.csf.matricule_redacteur) return
  if (matricule === ctx.fad.matricule_demandeur) return
  const roles = await roleEffectifService.findEffectiveRoles(matricule)
  if (roles.some((r) => r.typeRole === 'CB' && r.idService === ctx.fad.id_service)) return
  if (ctx.idCelluleDemandeur !== null && roles.some((r) => r.typeRole === 'RC' && r.idCellule === ctx.idCelluleDemandeur)) return
  throw new AppError('Droits insuffisants pour ce certificat de service fait.', 403)
}

async function assertCanViewFad(matricule: string, ctx: { fad: DemandeAchat; idCelluleDemandeur: number | null }): Promise<void> {
  if (await authRepository.hasActiveRole(matricule, 'ADMIN_APP')) return
  if (matricule === ctx.fad.matricule_demandeur) return
  const roles = await roleEffectifService.findEffectiveRoles(matricule)
  if (roles.some((r) => r.typeRole === 'CB' && r.idService === ctx.fad.id_service)) return
  if (ctx.idCelluleDemandeur !== null && roles.some((r) => r.typeRole === 'RC' && r.idCellule === ctx.idCelluleDemandeur)) return
  throw new AppError('Droits insuffisants pour les CSF de cette demande d\'achat.', 403)
}

// ---------------------------------------------------------------------------
// OP2.1 — Élaborer et transmettre le CSF (rédacteur)
// ---------------------------------------------------------------------------

/**
 * Crée immédiatement le brouillon CSF_EN_PREPARATION (création progressive,
 * même modèle que la DA) — R1 : la FAD doit être FAD_COMMANDEE.
 */
export async function createCertificatServiceFait(matricule: string | null, idDemandeAchat: number): Promise<CertificatServiceFait> {
  if (!matricule) throw new AppError('Authentification requise', 401)
  const ctx = await loadFadContext(idDemandeAchat)
  if (ctx.fad.code_statut !== 'FAD_COMMANDEE') {
    throw new AppError('Un certificat de service fait ne peut être créé que pour une FAD commandée.', 409)
  }
  if (!(await isRedacteurEligible(matricule, ctx)) && !(await authRepository.hasActiveRole(matricule, 'ADMIN_APP'))) {
    throw new AppError('Seul le rédacteur (demandeur initial ou RC) peut élaborer un CSF.', 403)
  }
  return certificatServiceFaitRepository.createBrouillon(idDemandeAchat, matricule)
}

export async function getCertificatServiceFait(matricule: string | null, idCsf: number): Promise<CertificatServiceFait> {
  if (!matricule) throw new AppError('Authentification requise', 401)
  const ctx = await loadContext(idCsf)
  await assertCanView(matricule, ctx)
  return ctx.csf
}

/** Tous les CSF d'une FAD (bloc « Certificats de service fait » sous la FAD commandée). */
export async function listCertificatsServiceFait(matricule: string | null, idDemandeAchat: number): Promise<CertificatServiceFait[]> {
  if (!matricule) throw new AppError('Authentification requise', 401)
  const ctx = await loadFadContext(idDemandeAchat)
  await assertCanViewFad(matricule, ctx)
  return certificatServiceFaitRepository.findAllByDemandeAchat(idDemandeAchat)
}

/** File RC (écran de suivi CSF) — tous les CSF des FAD dont le demandeur relève d'une cellule où l'acteur détient un rôle RC actif (titulaire ou suppléant). */
export async function listPourRc(matricule: string | null): Promise<CertificatServiceFait[]> {
  if (!matricule) throw new AppError('Authentification requise', 401)
  const roles = await roleEffectifService.findEffectiveRoles(matricule)
  const cellules = [...new Set(roles.filter((r) => r.typeRole === 'RC' && r.idCellule !== null).map((r) => r.idCellule as number))]
  if (cellules.length === 0) return []
  const acteurs = (await Promise.all(cellules.map((idCellule) => acteurRepository.findAllByCellule(idCellule)))).flat()
  const matriculesDemandeurs = [...new Set(acteurs.map((a) => a.matricule))]
  if (matriculesDemandeurs.length === 0) return []
  const fads = await demandeAchatRepository.findAll({ matriculeDemandeurIn: matriculesDemandeurs })
  const idsFad = fads.map((f) => f.id_demande_achat)
  return certificatServiceFaitRepository.findAllByDemandeAchatIn(idsFad)
}

/** File CB (écran de suivi CSF) — tous les CSF des FAD des services où l'acteur détient un rôle CB actif. */
export async function listPourCb(matricule: string | null): Promise<CertificatServiceFait[]> {
  if (!matricule) throw new AppError('Authentification requise', 401)
  const roles = await roleEffectifService.findEffectiveRoles(matricule)
  const services = [...new Set(roles.filter((r) => r.typeRole === 'CB' && r.idService !== null).map((r) => r.idService as number))]
  if (services.length === 0) return []
  const fads = (await Promise.all(services.map((idService) => demandeAchatRepository.findAll({ idService })))).flat()
  const idsFad = fads.map((f) => f.id_demande_achat)
  return certificatServiceFaitRepository.findAllByDemandeAchatIn(idsFad)
}

const updateBrouillonSchema = z.object({
  dateServiceFait: z.string().trim().min(1).nullish(),
  montantCsf: z.number().nonnegative().nullish(),
  description: z.string().trim().nullish(),
})

/** Édition du contenu par le rédacteur, tant que le CSF lui appartient (CSF_EN_PREPARATION ou CSF_A_COMPLETER_RC) — aucun changement de statut. */
export async function updateBrouillon(matricule: string | null, idCsf: number, input: unknown): Promise<CertificatServiceFait> {
  if (!matricule) throw new AppError('Authentification requise', 401)
  const ctx = await loadContext(idCsf)
  if (!STATUTS_TRANSMISSIBLES_RC.includes(ctx.csf.code_statut_csf)) {
    throw new AppError('Ce certificat de service fait ne peut plus être modifié à ce stade.', 409)
  }
  await requireRedacteur(matricule, ctx)

  const result = updateBrouillonSchema.safeParse(input)
  if (!result.success) throw new AppError(result.error.issues[0]?.message ?? 'Requête invalide', 400)

  return certificatServiceFaitRepository.update(idCsf, {
    date_service_fait: result.data.dateServiceFait ?? null,
    montant_csf: result.data.montantCsf ?? null,
    description: result.data.description ?? null,
  })
}

/** Transmission au RC (R5 : au moins un justificatif) — soumission initiale depuis CSF_EN_PREPARATION, ou resoumission depuis CSF_A_COMPLETER_RC après un complément demandé. */
export async function transmettreRc(matricule: string | null, idCsf: number): Promise<CertificatServiceFait> {
  if (!matricule) throw new AppError('Authentification requise', 401)
  const ctx = await loadContext(idCsf)
  if (!STATUTS_TRANSMISSIBLES_RC.includes(ctx.csf.code_statut_csf)) {
    throw new AppError('Ce certificat de service fait ne peut pas être transmis depuis son statut actuel.', 409)
  }
  const idSuppleance = await requireRedacteur(matricule, ctx)

  const pieces = await pieceJointeRepository.findAllByCsf(idCsf)
  if (pieces.length === 0) throw new AppError('Au moins un justificatif est requis pour transmettre le certificat de service fait.', 400)

  await historiqueStatutCsfRepository.create({
    id_csf: idCsf,
    code_statut_csf: 'CSF_A_TRAITER',
    matricule_acteur: matricule,
    id_suppleance: idSuppleance,
    commentaire_statut: null,
  })
  return (await certificatServiceFaitRepository.findById(idCsf)) as CertificatServiceFait
}

// ---------------------------------------------------------------------------
// OP2.2 — Contrôler et statuer sur le CSF (RC)
// ---------------------------------------------------------------------------

/** Édition en place par le RC (justificatif/montant) sur CSF_A_TRAITER, sans changement de statut — aucune ligne HISTORIQUE_STATUT_CSF (comme l'enregistrement intermédiaire d'OP1.2b côté FAD). */
export async function editerEnPlaceRc(matricule: string | null, idCsf: number, input: unknown): Promise<CertificatServiceFait> {
  if (!matricule) throw new AppError('Authentification requise', 401)
  const ctx = await loadContext(idCsf)
  if (ctx.csf.code_statut_csf !== 'CSF_A_TRAITER') {
    throw new AppError('Le RC ne peut modifier ce certificat de service fait que pendant son contrôle.', 409)
  }
  await requireRc(matricule, ctx)

  const result = updateBrouillonSchema.safeParse(input)
  if (!result.success) throw new AppError(result.error.issues[0]?.message ?? 'Requête invalide', 400)

  return certificatServiceFaitRepository.update(idCsf, {
    date_service_fait: result.data.dateServiceFait ?? null,
    montant_csf: result.data.montantCsf ?? null,
    description: result.data.description ?? null,
  })
}

/** RC transmet le CSF à la CB — depuis CSF_A_TRAITER. */
export async function transmettreBudget(matricule: string | null, idCsf: number): Promise<CertificatServiceFait> {
  if (!matricule) throw new AppError('Authentification requise', 401)
  const ctx = await loadContext(idCsf)
  if (ctx.csf.code_statut_csf !== 'CSF_A_TRAITER') {
    throw new AppError('Ce certificat de service fait ne peut pas être transmis à la CB depuis son statut actuel.', 409)
  }
  const idSuppleance = await requireRc(matricule, ctx)

  await historiqueStatutCsfRepository.create({
    id_csf: idCsf,
    code_statut_csf: 'CSF_TRANSMIS_BUDGET',
    matricule_acteur: matricule,
    id_suppleance: idSuppleance,
    commentaire_statut: null,
  })
  return (await certificatServiceFaitRepository.findById(idCsf)) as CertificatServiceFait
}

const commentaireRequisSchema = z.object({ commentaire: z.string().trim().min(1, 'Le motif est requis.') })

/** RC demande un complément au rédacteur — depuis CSF_A_TRAITER. Aucun rejet : boucle non terminale, reprise par le rédacteur (transmettreRc). */
export async function demanderComplementRc(matricule: string | null, idCsf: number, input: unknown): Promise<CertificatServiceFait> {
  if (!matricule) throw new AppError('Authentification requise', 401)
  const ctx = await loadContext(idCsf)
  if (ctx.csf.code_statut_csf !== 'CSF_A_TRAITER') {
    throw new AppError('Un complément ne peut être demandé que pendant le contrôle du RC.', 409)
  }
  const idSuppleance = await requireRc(matricule, ctx)

  const result = commentaireRequisSchema.safeParse(input)
  if (!result.success) throw new AppError(result.error.issues[0]?.message ?? 'Requête invalide', 400)

  await historiqueStatutCsfRepository.create({
    id_csf: idCsf,
    code_statut_csf: 'CSF_A_COMPLETER_RC',
    matricule_acteur: matricule,
    id_suppleance: idSuppleance,
    commentaire_statut: result.data.commentaire,
  })
  return (await certificatServiceFaitRepository.findById(idCsf)) as CertificatServiceFait
}

/** RC reprend et retransmet directement à la CB après une demande de complément budgétaire (CSF_A_COMPLETER_BUDGET) — ne repasse jamais par le rédacteur (MCT OP2.3). Réponse libre facultative au motif de la CB (même mécanique que la FAD, décision du 23/09/2026). */
export async function retransmettreBudget(matricule: string | null, idCsf: number, input: unknown): Promise<CertificatServiceFait> {
  if (!matricule) throw new AppError('Authentification requise', 401)
  const ctx = await loadContext(idCsf)
  if (ctx.csf.code_statut_csf !== 'CSF_A_COMPLETER_BUDGET') {
    throw new AppError('Cette action n\'est possible qu\'après une demande de complément de la CB.', 409)
  }
  const idSuppleance = await requireRc(matricule, ctx)

  const result = z.object({ commentaire: z.string().trim().nullish() }).safeParse(input)
  if (!result.success) throw new AppError(result.error.issues[0]?.message ?? 'Requête invalide', 400)

  await historiqueStatutCsfRepository.create({
    id_csf: idCsf,
    code_statut_csf: 'CSF_TRANSMIS_BUDGET',
    matricule_acteur: matricule,
    id_suppleance: idSuppleance,
    commentaire_statut: result.data.commentaire ?? null,
  })
  return (await certificatServiceFaitRepository.findById(idCsf)) as CertificatServiceFait
}

// ---------------------------------------------------------------------------
// OP2.3 — Contrôler les éléments budgétaires (CB)
// ---------------------------------------------------------------------------

export interface DecisionCbResult {
  csf: CertificatServiceFait
  /** R2 : alerte non bloquante si le cumul des CSF validés dépasse MONTANT_COMMANDE de la FAD. */
  alerteDepassement: boolean
}

/** CB valide le CSF — déclenche le paiement dans le PGI (hors application, message sortant). Jamais de rejet ni d'annulation côté CB (MCD §5-§6). */
export async function validerBudget(matricule: string | null, idCsf: number): Promise<DecisionCbResult> {
  if (!matricule) throw new AppError('Authentification requise', 401)
  const ctx = await loadContext(idCsf)
  if (ctx.csf.code_statut_csf !== 'CSF_TRANSMIS_BUDGET') {
    throw new AppError('Ce certificat de service fait ne peut pas être validé depuis son statut actuel.', 409)
  }
  const idSuppleance = await requireCb(matricule, ctx)

  await historiqueStatutCsfRepository.create({
    id_csf: idCsf,
    code_statut_csf: 'CSF_VALIDE_BUDGET',
    matricule_acteur: matricule,
    id_suppleance: idSuppleance,
    commentaire_statut: null,
  })

  const autresCsf = await certificatServiceFaitRepository.findAllByDemandeAchat(ctx.fad.id_demande_achat)
  const cumulValide = autresCsf
    .filter((c) => c.code_statut_csf === 'CSF_VALIDE_BUDGET' || c.code_statut_csf === 'CSF_LIQUIDE')
    .reduce((somme, c) => somme + (c.montant_csf ?? 0), 0)
  const alerteDepassement = ctx.fad.montant_commande !== null && cumulValide > ctx.fad.montant_commande

  return { csf: (await certificatServiceFaitRepository.findById(idCsf)) as CertificatServiceFait, alerteDepassement }
}

/** CB demande un complément au RC — depuis CSF_TRANSMIS_BUDGET. Aucun rejet : boucle non terminale, reprise par le RC (retransmettreBudget). */
export async function demanderComplementBudget(matricule: string | null, idCsf: number, input: unknown): Promise<CertificatServiceFait> {
  if (!matricule) throw new AppError('Authentification requise', 401)
  const ctx = await loadContext(idCsf)
  if (ctx.csf.code_statut_csf !== 'CSF_TRANSMIS_BUDGET') {
    throw new AppError('Un complément ne peut être demandé que pendant le contrôle de la CB.', 409)
  }
  const idSuppleance = await requireCb(matricule, ctx)

  const result = commentaireRequisSchema.safeParse(input)
  if (!result.success) throw new AppError(result.error.issues[0]?.message ?? 'Requête invalide', 400)

  await historiqueStatutCsfRepository.create({
    id_csf: idCsf,
    code_statut_csf: 'CSF_A_COMPLETER_BUDGET',
    matricule_acteur: matricule,
    id_suppleance: idSuppleance,
    commentaire_statut: result.data.commentaire,
  })
  return (await certificatServiceFaitRepository.findById(idCsf)) as CertificatServiceFait
}

// ---------------------------------------------------------------------------
// OP2.4 — Constater la liquidation de la facture (retour PGI, CB)
// ---------------------------------------------------------------------------

/** CB constate la liquidation de la facture dans le PGI (hors application) — statut terminal, verrouille le CSF (R6). */
export async function constaterLiquidation(matricule: string | null, idCsf: number): Promise<CertificatServiceFait> {
  if (!matricule) throw new AppError('Authentification requise', 401)
  const ctx = await loadContext(idCsf)
  if (ctx.csf.code_statut_csf !== 'CSF_VALIDE_BUDGET') {
    throw new AppError('Seul un certificat validé par la CB peut être marqué liquidé.', 409)
  }
  const idSuppleance = await requireCb(matricule, ctx)

  await historiqueStatutCsfRepository.create({
    id_csf: idCsf,
    code_statut_csf: 'CSF_LIQUIDE',
    matricule_acteur: matricule,
    id_suppleance: idSuppleance,
    commentaire_statut: null,
  })
  return (await certificatServiceFaitRepository.findById(idCsf)) as CertificatServiceFait
}

// ---------------------------------------------------------------------------
// R7 — Suppression physique
// ---------------------------------------------------------------------------

/**
 * Suppression physique (R7, décision du 24/09/2026) : le rédacteur depuis
 * CSF_EN_PREPARATION ou CSF_A_COMPLETER_RC ; le RC depuis CSF_A_TRAITER ou
 * CSF_A_COMPLETER_RC — jamais au-delà (CSF_TRANSMIS_BUDGET, CSF_A_COMPLETER_BUDGET,
 * CSF_VALIDE_BUDGET, CSF_LIQUIDE). Cascade applicative PIECE_JOINTE →
 * HISTORIQUE_STATUT_CSF → CERTIFICAT_SERVICE_FAIT (FK restant ON DELETE
 * RESTRICT, voir ForClaude/CDC/mld-phases-1-2.md §4).
 */
export async function supprimer(matricule: string | null, idCsf: number): Promise<void> {
  if (!matricule) throw new AppError('Authentification requise', 401)
  const ctx = await loadContext(idCsf)
  const statut = ctx.csf.code_statut_csf

  const isAdmin = await authRepository.hasActiveRole(matricule, 'ADMIN_APP')
  let autorise = isAdmin
  if (!autorise && STATUTS_SUPPRESSIBLES_REDACTEUR.includes(statut)) {
    autorise = await isRedacteurEligible(matricule, ctx)
  }
  if (!autorise && (statut === STATUT_SUPPRESSIBLE_RC || statut === 'CSF_A_COMPLETER_RC')) {
    autorise = await isRcEligible(matricule, ctx)
  }
  if (!autorise) throw new AppError('Suppression impossible depuis ce statut, ou droits insuffisants.', 403)

  const pieces = await pieceJointeRepository.findAllByCsf(idCsf)
  for (const piece of pieces) {
    await pieceJointeRepository.remove(piece.id_piece)
    await pieceJointeRepository.removeFile(piece.storage_path).catch((err: unknown) => {
      console.error('Suppression du fichier Storage échouée (pièce déjà supprimée en base) :', err)
    })
  }
  await historiqueStatutCsfRepository.deleteAllByCsf(idCsf)
  await certificatServiceFaitRepository.remove(idCsf)
}

// ---------------------------------------------------------------------------
// Historique des statuts
// ---------------------------------------------------------------------------

export interface HistoriqueStatutCsfView {
  idHistoCsf: number
  codeStatutCsf: string
  libelleStatut: string
  dateHeure: string
  matriculeActeur: string
  acteurNomPrenom: string | null
  commentaireStatut: string | null
}

export async function getHistoriqueStatuts(matricule: string | null, idCsf: number): Promise<HistoriqueStatutCsfView[]> {
  if (!matricule) throw new AppError('Authentification requise', 401)
  const ctx = await loadContext(idCsf)
  await assertCanView(matricule, ctx)

  const rows = await historiqueStatutCsfRepository.findAllByCsf(idCsf)
  if (rows.length === 0) return []

  const acteurs = await acteurRepository.findByMatricules([...new Set(rows.map((r) => r.matricule_acteur))])
  const acteurByMatricule = new Map(acteurs.map((a) => [a.matricule, a]))

  return rows.map((r) => ({
    idHistoCsf: r.id_histo_csf,
    codeStatutCsf: r.code_statut_csf,
    libelleStatut: r.code_statut_csf,
    dateHeure: r.date_heure,
    matriculeActeur: r.matricule_acteur,
    acteurNomPrenom: acteurByMatricule.has(r.matricule_acteur)
      ? `${acteurByMatricule.get(r.matricule_acteur)!.prenom} ${acteurByMatricule.get(r.matricule_acteur)!.nom}`
      : null,
    commentaireStatut: r.commentaire_statut,
  }))
}

// ---------------------------------------------------------------------------
// Suivi de la facturation (tuiles de synthèse — décision du 24/09/2026)
// ---------------------------------------------------------------------------

export interface SyntheseFacturationBucket {
  nombre: number
  montant: number
}

export interface SyntheseFacturation {
  /** CSF au statut CSF_VALIDE_BUDGET ou CSF_LIQUIDE uniquement — un CSF encore en cours de circuit ne compte pas comme « certifié ». */
  csf: SyntheseFacturationBucket
  /** FAD au statut FAD_COMMANDEE, dans le périmètre. */
  commandes: SyntheseFacturationBucket
  /** Parmi les commandes ci-dessus, celles qui n'ont strictement aucun CSF (tous statuts confondus). */
  commandesSansCsf: SyntheseFacturationBucket
}

const STATUTS_CSF_CERTIFIES = ['CSF_VALIDE_BUDGET', 'CSF_LIQUIDE']

async function computeSyntheseFacturation(commandes: DemandeAchat[]): Promise<SyntheseFacturation> {
  const idsDemandeAchat = commandes.map((c) => c.id_demande_achat)
  const csfAll = await certificatServiceFaitRepository.findAllByDemandeAchatIn(idsDemandeAchat)
  const csfCertifies = csfAll.filter((c) => STATUTS_CSF_CERTIFIES.includes(c.code_statut_csf))
  const idsAvecCsf = new Set(csfAll.map((c) => c.id_demande_achat))
  const commandesSansCsf = commandes.filter((c) => !idsAvecCsf.has(c.id_demande_achat))

  return {
    csf: {
      nombre: csfCertifies.length,
      montant: csfCertifies.reduce((somme, c) => somme + (c.montant_csf ?? 0), 0),
    },
    commandes: {
      nombre: commandes.length,
      montant: commandes.reduce((somme, c) => somme + (c.montant_commande ?? 0), 0),
    },
    commandesSansCsf: {
      nombre: commandesSansCsf.length,
      montant: commandesSansCsf.reduce((somme, c) => somme + (c.montant_commande ?? 0), 0),
    },
  }
}

/** Vue Demandeur (pages/Home.tsx) — ses propres FAD commandées uniquement. */
export async function getSyntheseFacturationDemandeur(matricule: string | null): Promise<SyntheseFacturation> {
  if (!matricule) throw new AppError('Authentification requise', 401)
  const commandes = await demandeAchatRepository.findAll({ matriculeDemandeurIn: [matricule], statuts: ['FAD_COMMANDEE'] })
  return computeSyntheseFacturation(commandes)
}

/** Vue RC (pages/SuiviCsfRc.tsx) — FAD commandées dont le demandeur relève de la cellule du RC (même périmètre que listPourRc). */
export async function getSyntheseFacturationRc(matricule: string | null): Promise<SyntheseFacturation> {
  if (!matricule) throw new AppError('Authentification requise', 401)
  const roles = await roleEffectifService.findEffectiveRoles(matricule)
  const cellules = [...new Set(roles.filter((r) => r.typeRole === 'RC' && r.idCellule !== null).map((r) => r.idCellule as number))]
  if (cellules.length === 0) return computeSyntheseFacturation([])
  const acteurs = (await Promise.all(cellules.map((idCellule) => acteurRepository.findAllByCellule(idCellule)))).flat()
  const matriculesDemandeurs = [...new Set(acteurs.map((a) => a.matricule))]
  if (matriculesDemandeurs.length === 0) return computeSyntheseFacturation([])
  const commandes = await demandeAchatRepository.findAll({ matriculeDemandeurIn: matriculesDemandeurs, statuts: ['FAD_COMMANDEE'] })
  return computeSyntheseFacturation(commandes)
}

/** Vue CB (pages/SuiviCsfCb.tsx) — FAD commandées des services où l'acteur détient un rôle CB actif (même périmètre que listPourCb). */
export async function getSyntheseFacturationCb(matricule: string | null): Promise<SyntheseFacturation> {
  if (!matricule) throw new AppError('Authentification requise', 401)
  const roles = await roleEffectifService.findEffectiveRoles(matricule)
  const services = [...new Set(roles.filter((r) => r.typeRole === 'CB' && r.idService !== null).map((r) => r.idService as number))]
  if (services.length === 0) return computeSyntheseFacturation([])
  const commandes = (
    await Promise.all(services.map((idService) => demandeAchatRepository.findAll({ idService, statuts: ['FAD_COMMANDEE'] })))
  ).flat()
  return computeSyntheseFacturation(commandes)
}

// ---------------------------------------------------------------------------
// Justificatifs (PIECE_JOINTE, rattachement ID_CSF)
// ---------------------------------------------------------------------------

async function assertCanEditPieces(matricule: string, ctx: CsfContext): Promise<void> {
  if (await authRepository.hasActiveRole(matricule, 'ADMIN_APP')) return
  const statut = ctx.csf.code_statut_csf
  if (STATUTS_PIECES_MODIFIABLES_REDACTEUR.includes(statut) && (await isRedacteurEligible(matricule, ctx))) return
  if (statut === STATUT_PIECES_MODIFIABLE_RC && (await isRcEligible(matricule, ctx))) return
  throw new AppError('Modification des justificatifs impossible depuis ce statut, ou droits insuffisants.', 403)
}

export async function listPieces(matricule: string | null, idCsf: number): Promise<PieceJointeCsf[]> {
  if (!matricule) throw new AppError('Authentification requise', 401)
  const ctx = await loadContext(idCsf)
  await assertCanView(matricule, ctx)
  return pieceJointeRepository.findAllByCsf(idCsf)
}

export interface UploadedFile {
  buffer: Buffer
  size: number
  originalname: string
}

const PDF_MAGIC_BYTES = Buffer.from('%PDF')
const MAX_FICHIER_TAILLE_OCTETS = 10 * 1024 * 1024

function isPdfBuffer(buffer: Buffer): boolean {
  return buffer.subarray(0, 4).equals(PDF_MAGIC_BYTES)
}

const addPieceSchema = z.object({ typePiece: z.enum(['PV_RECEPTION', 'BON_LIVRAISON', 'AUTRE']) })

export async function addPiece(matricule: string | null, idCsf: number, input: unknown, file: UploadedFile | undefined): Promise<PieceJointeCsf> {
  if (!matricule) throw new AppError('Authentification requise', 401)
  if (!file) throw new AppError('Aucun fichier reçu.', 400)
  const ctx = await loadContext(idCsf)
  await assertCanEditPieces(matricule, ctx)

  const result = addPieceSchema.safeParse(input)
  if (!result.success) throw new AppError(result.error.issues[0]?.message ?? 'Requête invalide', 400)
  if (!isPdfBuffer(file.buffer)) throw new AppError('Seuls les fichiers PDF sont acceptés.', 400)
  if (file.size > MAX_FICHIER_TAILLE_OCTETS) throw new AppError('Le fichier dépasse la taille maximale autorisée (10 Mo).', 400)

  const path = pieceJointeRepository.buildStoragePathCsf(idCsf)
  await pieceJointeRepository.uploadFile(path, file.buffer)
  try {
    return await pieceJointeRepository.createForCsf({
      id_csf: idCsf,
      type_piece: result.data.typePiece,
      origine: 'UTILISATEUR',
      nom_fichier_original: file.originalname,
      storage_path: path,
      taille_octets: file.size,
    })
  } catch (err) {
    await pieceJointeRepository.removeFile(path).catch(() => {})
    throw err
  }
}

export async function removePiece(matricule: string | null, idCsf: number, idPiece: number): Promise<void> {
  if (!matricule) throw new AppError('Authentification requise', 401)
  const ctx = await loadContext(idCsf)
  await assertCanEditPieces(matricule, ctx)

  const piece = await pieceJointeRepository.findByIdCsf(idPiece)
  if (!piece || piece.id_csf !== idCsf) throw new AppError('Pièce introuvable.', 404)

  await pieceJointeRepository.remove(idPiece)
  await pieceJointeRepository.removeFile(piece.storage_path).catch((err: unknown) => {
    console.error('Suppression du fichier Storage échouée (pièce déjà supprimée en base) :', err)
  })
}

export async function downloadPiece(matricule: string | null, idCsf: number, idPiece: number): Promise<{ buffer: Buffer; nomFichier: string }> {
  if (!matricule) throw new AppError('Authentification requise', 401)
  const ctx = await loadContext(idCsf)
  await assertCanView(matricule, ctx)

  const piece = await pieceJointeRepository.findByIdCsf(idPiece)
  if (!piece || piece.id_csf !== idCsf) throw new AppError('Pièce introuvable.', 404)

  const buffer = await pieceJointeRepository.downloadFile(piece.storage_path)
  return { buffer, nomFichier: piece.nom_fichier_original }
}
