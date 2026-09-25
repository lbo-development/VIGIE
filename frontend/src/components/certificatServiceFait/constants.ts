/**
 * Constantes partagées entre les modales CSF et les écrans qui les affichent
 * (pages/Home.tsx, pages/SuiviRc.tsx, pages/SuiviCb.tsx) — même principe que
 * components/demandeAchat/constants.ts. 7 statuts (refonte du 24/09/2026,
 * voir ForClaude/CDC/mcd-phases-1-2.md §3) : aucun rejet ni annulation dans
 * ce circuit, contrairement à finances.statut (DA/FAD).
 */

export const STATUT_CSF_LABELS: Record<string, string> = {
  CSF_EN_PREPARATION: 'En préparation',
  CSF_A_TRAITER: 'À traiter par le RC',
  CSF_A_COMPLETER_RC: 'À compléter',
  CSF_TRANSMIS_BUDGET: 'Transmis à la CB',
  CSF_A_COMPLETER_BUDGET: 'À compléter',
  CSF_VALIDE_BUDGET: 'Validé par la CB',
  CSF_LIQUIDE: 'Liquidé',
}

export const STATUT_CSF_BADGE_CLASS: Record<string, string> = {
  CSF_EN_PREPARATION: 'gp-badge--info',
  CSF_A_TRAITER: 'gp-badge--info',
  CSF_A_COMPLETER_RC: 'gp-badge--warning',
  CSF_TRANSMIS_BUDGET: 'gp-badge--info',
  CSF_A_COMPLETER_BUDGET: 'gp-badge--warning',
  CSF_VALIDE_BUDGET: 'gp-badge--success',
  CSF_LIQUIDE: 'gp-badge--success',
}

/** Statuts où le rédacteur (demandeur initial ou RC ayant élaboré le CSF) peut éditer/transmettre/supprimer. */
export const STATUTS_CSF_REDACTEUR = ['CSF_EN_PREPARATION', 'CSF_A_COMPLETER_RC']
/** Statut où le RC contrôle/édite en place/décide (OP2.2). */
export const STATUT_CSF_A_TRAITER_RC = 'CSF_A_TRAITER'
/** Statut où le RC reprend directement après une demande de complément de la CB (pas de passage par le rédacteur). */
export const STATUT_CSF_A_COMPLETER_BUDGET = 'CSF_A_COMPLETER_BUDGET'
/** Statut où la CB contrôle/décide (OP2.3). */
export const STATUT_CSF_A_TRAITER_BUDGET = 'CSF_TRANSMIS_BUDGET'
/** Statut où la CB peut constater la liquidation (OP2.4). */
export const STATUT_CSF_VALIDE_BUDGET = 'CSF_VALIDE_BUDGET'

/** Onglet « À traiter » de la section CSF de l'écran de suivi RC. */
export const STATUTS_CSF_A_TRAITER_RC_TAB = ['CSF_A_TRAITER']
/** Onglet « En cours » — le RC a déjà agi ou attend un tiers, hors brouillon encore chez le rédacteur. CSF_LIQUIDE en est exclu (décision du 24/09/2026) : isolé dans son propre onglet « Liquidé ». */
export const STATUTS_CSF_EN_COURS_RC_TAB = ['CSF_A_COMPLETER_RC', 'CSF_TRANSMIS_BUDGET', 'CSF_A_COMPLETER_BUDGET', 'CSF_VALIDE_BUDGET']

/** Onglet « À traiter » de la section CSF de l'écran de suivi CB. */
export const STATUTS_CSF_A_TRAITER_CB_TAB = ['CSF_TRANSMIS_BUDGET']
/** Onglet « En cours » — la CB a déjà statué ou attend le RC. CSF_LIQUIDE en est exclu (décision du 24/09/2026) : isolé dans son propre onglet « Liquidé ». */
export const STATUTS_CSF_EN_COURS_CB_TAB = ['CSF_A_COMPLETER_BUDGET', 'CSF_VALIDE_BUDGET']

/** Onglet « Liquidé » (décision du 24/09/2026, demande utilisateur) — isole les CSF dont le traitement est terminé (R6, terminal), partagé RC et CB. */
export const STATUTS_CSF_LIQUIDE_TAB = ['CSF_LIQUIDE']
