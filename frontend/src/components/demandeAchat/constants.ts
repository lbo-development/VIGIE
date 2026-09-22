/**
 * Constantes partagées entre les modales DA/FAD (components/demandeAchat/modals.tsx,
 * HistoriqueStatutsModal.tsx) et l'écran d'accueil (pages/Home.tsx) — extrait de l'ancien
 * pages/DemandeAchat.tsx (page retirée le 15/09/2026, contenu absorbé par l'onglet
 * "A finaliser" de l'accueil).
 *
 * STATUT_LABELS/STATUT_BADGE_CLASS couvrent les 25 codes du référentiel finances.statut
 * (ForClaude/CDC/code_statut.pdf, migration 20260914100000_rebuild_statut_depuis_code_statut_pdf.sql) —
 * avant le 15/09/2026, seuls DA_EN_PREPARATION/DA_A_COMPLETER_RC étaient connus du frontend
 * (seul OP1.1 existait côté backend).
 */

export const STATUT_LABELS: Record<string, string> = {
  DA_EN_PREPARATION: 'En préparation',
  DA_TRANSMISE_DEM_RC: 'Transmise au N+1',
  DA_VALIDEE_RC: 'Validée par N+1',
  DA_A_COMPLETER_RC: 'À compléter',
  DA_REJETEE_RC: 'Rejetée par N+1',
  DA_ANNULEE_RC: 'Annulée par N+1',
  FAD_TRANSMISE_RC_CDS: 'Transmise au N+2',
  FAD_MODIFIEE_TRANSMISE_RC_CB: 'Modifiée, transmise à la CB',
  FAD_VALIDEE_CDS: 'Validée par N+2',
  FAD_A_COMPLETER_CDS: 'À compléter',
  FAD_REJETEE_CDS: 'Rejetée par N+2',
  FAD_ANNULEE_CDS: 'Annulée par N+2',
  FAD_TRANSMISE_CDS_CB: 'Transmise à la CB',
  FAD_VALIDEE_CB: 'Validée par la CB',
  FAD_A_MODIFIER_CB: 'À modifier',
  FAD_REJETEE_CB: 'Rejetée par la CB',
  FAD_TRANSMISE_CB_DS: 'Transmise au N+3',
  FAD_VALIDEE_DS: 'Validée par N+3',
  FAD_VALIDEE_DS_SEUIL: 'Validée automatiquement (seuil)',
  FAD_A_COMPLETER_CB: 'À compléter',
  FAD_REJETEE_DS: 'Rejetée par N+3',
  FAD_ANNULEE_DS: 'Annulée par N+3',
  FAD_TRANSMISE_DS_CB: 'Ordre de commande transmis',
  FAD_A_COMMANDER: 'À commander',
  FAD_COMMANDEE: 'Commandée',
}

export const STATUT_BADGE_CLASS: Record<string, string> = {
  DA_EN_PREPARATION: 'gp-badge--info',
  DA_TRANSMISE_DEM_RC: 'gp-badge--info',
  DA_VALIDEE_RC: 'gp-badge--success',
  DA_A_COMPLETER_RC: 'gp-badge--warning',
  DA_REJETEE_RC: 'gp-badge--danger',
  DA_ANNULEE_RC: 'gp-badge--danger',
  FAD_TRANSMISE_RC_CDS: 'gp-badge--info',
  FAD_MODIFIEE_TRANSMISE_RC_CB: 'gp-badge--info',
  FAD_VALIDEE_CDS: 'gp-badge--success',
  FAD_A_COMPLETER_CDS: 'gp-badge--warning',
  FAD_REJETEE_CDS: 'gp-badge--danger',
  FAD_ANNULEE_CDS: 'gp-badge--danger',
  FAD_TRANSMISE_CDS_CB: 'gp-badge--info',
  FAD_VALIDEE_CB: 'gp-badge--success',
  FAD_A_MODIFIER_CB: 'gp-badge--warning',
  FAD_REJETEE_CB: 'gp-badge--danger',
  FAD_TRANSMISE_CB_DS: 'gp-badge--info',
  FAD_VALIDEE_DS: 'gp-badge--success',
  FAD_VALIDEE_DS_SEUIL: 'gp-badge--success',
  FAD_A_COMPLETER_CB: 'gp-badge--warning',
  FAD_REJETEE_DS: 'gp-badge--danger',
  FAD_ANNULEE_DS: 'gp-badge--danger',
  FAD_TRANSMISE_DS_CB: 'gp-badge--info',
  FAD_A_COMMANDER: 'gp-badge--info',
  FAD_COMMANDEE: 'gp-badge--success',
}

/** Statuts terminaux (rejet/annulation), voir l'onglet "Rejetées / Annulées" de l'accueil. */
export const STATUTS_REJETEES_ANNULEES = [
  'DA_REJETEE_RC',
  'DA_ANNULEE_RC',
  'FAD_REJETEE_CDS',
  'FAD_ANNULEE_CDS',
  'FAD_REJETEE_CB',
  'FAD_REJETEE_DS',
  'FAD_ANNULEE_DS',
]

/**
 * Statuts par onglet de l'écran d'accueil — miroir client de
 * backend/src/services/demandeAchat.service.ts#ACCUEIL_SCOPE_STATUTS
 * (uniquement pour construire les options du filtre Statut de chaque onglet ;
 * le filtrage réel est appliqué côté serveur via `scope`).
 */
export const ACCUEIL_SCOPE_STATUTS: Record<
  | 'A_FINALISER'
  | 'SUIVI_FAD'
  | 'A_TRAITER'
  | 'EN_COURS'
  | 'A_TRAITER_CDS'
  | 'EN_COURS_CDS'
  | 'A_TRAITER_CB'
  | 'EN_COURS_CB'
  | 'A_TRAITER_DS'
  | 'EN_COURS_DS'
  | 'FAD_COMMANDEES'
  | 'REJETEES_ANNULEES',
  string[]
> = {
  A_FINALISER: ['DA_EN_PREPARATION', 'DA_A_COMPLETER_RC'],
  SUIVI_FAD: [
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
  ],
  // Écran de suivi RC (15/09/2026) : A_TRAITER/EN_COURS regroupent différemment les mêmes codes
  // que A_FINALISER/SUIVI_FAD (persona RC plutôt que Demandeur), en partageant
  // FAD_COMMANDEES/REJETEES_ANNULEES — voir demandeAchat.service.ts#ACCUEIL_SCOPE_STATUTS.
  // DA_EN_PREPARATION en est exclu (bug corrigé le 15/09/2026) : ce brouillon reste entre les mains
  // du demandeur, jamais transmis — le RC n'a encore rien à en faire, contrairement à
  // DA_A_COMPLETER_RC (le RC a déjà statué « Compléter »).
  A_TRAITER: ['DA_TRANSMISE_DEM_RC', 'DA_VALIDEE_RC', 'FAD_A_COMPLETER_CDS', 'FAD_A_MODIFIER_CB'],
  EN_COURS: [
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
  ],
  // Écran de suivi CDS (16/09/2026) : A_TRAITER_CDS/EN_COURS_CDS regroupent différemment les mêmes
  // codes (persona CDS), en partageant FAD_COMMANDEES/REJETEES_ANNULEES avec les personas
  // Demandeur/RC — voir demandeAchat.service.ts#ACCUEIL_SCOPE_STATUTS. Aucun code DA_* : le CDS
  // n'intervient qu'une fois l'objet devenu FAD (FAD_TRANSMISE_RC_CDS), jamais sur une DA.
  A_TRAITER_CDS: ['FAD_TRANSMISE_RC_CDS', 'FAD_VALIDEE_CDS'],
  EN_COURS_CDS: [
    'FAD_A_COMPLETER_CDS',
    'FAD_MODIFIEE_TRANSMISE_RC_CB',
    'FAD_TRANSMISE_CDS_CB',
    'FAD_VALIDEE_CB',
    'FAD_A_MODIFIER_CB',
    'FAD_TRANSMISE_CB_DS',
    'FAD_VALIDEE_DS',
    'FAD_VALIDEE_DS_SEUIL',
    'FAD_A_COMPLETER_CB',
    'FAD_TRANSMISE_DS_CB',
    'FAD_A_COMMANDER',
  ],
  // Écran de suivi CB (18/09/2026) : A_TRAITER_CB/EN_COURS_CB regroupent différemment les mêmes
  // codes (persona CB), en partageant FAD_COMMANDEES/REJETEES_ANNULEES avec les autres personas —
  // voir demandeAchat.service.ts#ACCUEIL_SCOPE_STATUTS. Contrairement à RC/CDS, la CB ne voit
  // jamais une FAD avant FAD_TRANSMISE_CDS_CB (pas de visibilité amont sur le circuit CDS).
  A_TRAITER_CB: ['FAD_TRANSMISE_CDS_CB', 'FAD_MODIFIEE_TRANSMISE_RC_CB', 'FAD_VALIDEE_CB', 'FAD_A_COMPLETER_CB', 'FAD_A_COMMANDER'],
  EN_COURS_CB: ['FAD_A_MODIFIER_CB', 'FAD_TRANSMISE_CB_DS', 'FAD_VALIDEE_DS', 'FAD_VALIDEE_DS_SEUIL', 'FAD_TRANSMISE_DS_CB'],
  // Écran de suivi DS (22/09/2026) : A_TRAITER_DS/EN_COURS_DS regroupent différemment les mêmes
  // codes (persona DS), en partageant FAD_COMMANDEES/REJETEES_ANNULEES avec les autres personas —
  // voir demandeAchat.service.ts#ACCUEIL_SCOPE_STATUTS. Comme la CB, le DS ne voit jamais une FAD
  // avant FAD_TRANSMISE_CB_DS. FAD_A_COMMANDER (dans EN_COURS_DS) porte à la fois les FAD validées
  // par le DS et les FAD exemptées de seuil — le badge "Seuil DS" de DemandeAchatCard.tsx les
  // distingue automatiquement.
  A_TRAITER_DS: ['FAD_TRANSMISE_CB_DS', 'FAD_VALIDEE_DS'],
  EN_COURS_DS: ['FAD_VALIDEE_DS_SEUIL', 'FAD_A_COMPLETER_CB', 'FAD_TRANSMISE_DS_CB', 'FAD_A_COMMANDER'],
  FAD_COMMANDEES: ['FAD_COMMANDEE'],
  REJETEES_ANNULEES: STATUTS_REJETEES_ANNULEES,
}

export const CURRENCY_FORMAT = new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR' })
/** Alerte MT (MarcheDA) — arrondi à l'euro, contrairement à CURRENCY_FORMAT (2 décimales) utilisé ailleurs. */
export const CURRENCY_FORMAT_ROUND = new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 })

export const MAX_FICHIER_TAILLE_OCTETS = 10 * 1024 * 1024

/** Autorise les chiffres et un seul séparateur décimal (. ou ,), limité à 2 décimales — tous les champs Montant DA/FAD. */
export function sanitizeDecimal(raw: string): string {
  const normalized = raw.replace(/[^0-9.,]/g, '').replace(',', '.')
  const firstDot = normalized.indexOf('.')
  if (firstDot === -1) return normalized
  const integerPart = normalized.slice(0, firstDot)
  const decimalPart = normalized.slice(firstDot + 1).replace(/\./g, '').slice(0, 2)
  return `${integerPart}.${decimalPart}`
}

/** Affichage hors saisie (champ non focus) — CURRENCY_FORMAT (fr-FR), cohérent avec le reste de l'écran (liste des DA/FAD, Alerte MT). */
export function formatMontantDecimal(raw: string): string {
  if (!raw.trim()) return ''
  const value = Number(raw)
  return Number.isNaN(value) ? raw : CURRENCY_FORMAT.format(value)
}

/** Déclenche le téléchargement d'un Blob côté navigateur — même principe que usePiecesMarche.ts#downloadPiece. */
export function triggerBlobDownload(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  link.click()
  URL.revokeObjectURL(url)
}
