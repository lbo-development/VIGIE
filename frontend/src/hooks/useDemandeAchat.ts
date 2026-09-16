import { useCallback, useEffect, useState } from 'react'
import { api } from '../services/api'

export type ProcedureAchat = 'MARCHE' | 'HORS_MARCHE'
export type MotifChoix = 'Prix' | 'Délai' | 'Technique' | 'Autre'

export interface DemandeAchat {
  id_demande_achat: number
  numero: string
  id_service: number
  /** Formulation d'origine du demandeur (OP1.1) — jamais modifiée après transmission au RC (décision du 15/09/2026). */
  objet_demandeur: string
  description_demandeur: string | null
  /** Reformulation du RC (OP1.2b) — synchronisée sur *_demandeur tant que la DA reste éditable par le demandeur, fait foi ensuite. */
  objet_rc: string
  description_rc: string | null
  montant_demande: number
  imputation_comptable: 'FONCTIONNEMENT' | 'INVESTISSEMENT' | null
  procedure_achat: ProcedureAchat
  type_achat: 'TRAVAUX' | 'FOURNITURES' | 'SERVICES' | null
  type_fad: 'CONTRAT' | 'OUVERTE' | 'FERMEE' | null
  motif_choix: MotifChoix | null
  libelle_motif_choix: string | null
  montant_retenu: number | null
  montant_commande: number | null
  date_creation: string
  matricule_demandeur: string
  code_site: string | null
  code_sous_site: string | null
  code_secteur: string | null
  code_sous_secteur: string | null
  code_cug: string | null
  numero_operation: string | null
  nummarche: string | null
  id_marche_tiers: number | null
  id_fournisseur_retenu: number | null
  code_statut: string
  created_at: string
  updated_at: string
}

/**
 * Onglet de l'écran d'accueil (décision du 15/09/2026) — traduit côté backend en une liste
 * fixe de statuts (voir demandeAchat.service.ts#ACCUEIL_SCOPE_STATUTS), prioritaire sur `statut`.
 */
export type AccueilScope = 'A_FINALISER' | 'SUIVI_FAD' | 'A_TRAITER' | 'EN_COURS' | 'FAD_COMMANDEES' | 'REJETEES_ANNULEES'

export interface DemandeAchatListParams {
  idCellule?: number | null
  matriculeDemandeur?: string | null
  statut?: string | null
  scope?: AccueilScope
  search?: string
  /** Filtre "Fournisseurs" des onglets de l'écran d'accueil — correspondance exacte. */
  idFournisseurRetenu?: number | null
}

/** Filtres de la page DemandeAchat / des onglets de l'accueil — voir demandeAchat.service.ts#listDemandeAchat pour la portée exacte appliquée côté backend selon le rôle. */
export function useDemandeAchatList(params: DemandeAchatListParams) {
  const [demandesAchat, setDemandesAchat] = useState<DemandeAchat[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const refetch = useCallback(() => {
    setLoading(true)
    setError(null)
    const query = new URLSearchParams()
    if (params.idCellule != null) query.set('idCellule', String(params.idCellule))
    if (params.matriculeDemandeur) query.set('matriculeDemandeur', params.matriculeDemandeur)
    if (params.statut) query.set('statut', params.statut)
    if (params.scope) query.set('scope', params.scope)
    if (params.search) query.set('search', params.search)
    if (params.idFournisseurRetenu != null) query.set('idFournisseurRetenu', String(params.idFournisseurRetenu))
    const qs = query.toString()

    return api
      .get<DemandeAchat[]>(`/demandes-achat${qs ? `?${qs}` : ''}`)
      .then((data) => setDemandesAchat(data))
      .catch(() => setError('Impossible de charger les demandes d\'achat.'))
      .finally(() => setLoading(false))
  }, [params.idCellule, params.matriculeDemandeur, params.statut, params.scope, params.search, params.idFournisseurRetenu])

  useEffect(() => {
    void refetch()
  }, [refetch])

  return { demandesAchat, loading, error, refetch }
}

/** Crée le brouillon DA_EN_PREPARATION — voir demandeAchat.service.ts#createDemandeAchat (création progressive, décision du 07/09/2026). */
export async function createDemandeAchat(matriculeDemandeurCible?: string): Promise<DemandeAchat> {
  return api.post<DemandeAchat>('/demandes-achat', matriculeDemandeurCible ? { matriculeDemandeurCible } : {})
}

export interface DemandeAchatUpdateInput {
  objet?: string
  description?: string | null
  procedureAchat?: ProcedureAchat
}

export async function updateDemandeAchat(idDemandeAchat: number, input: DemandeAchatUpdateInput): Promise<DemandeAchat> {
  return api.put<DemandeAchat>(`/demandes-achat/${idDemandeAchat}`, input)
}

export interface SelectMarcheInput {
  nummarche: string | null
  idMarcheTiers: number | null
  /** Obligatoire à l'écran MarcheDA (croquis DA.pdf : « la saisie du montant est obligatoire avant l'enregistrement ») — imposé côté frontend, optionnel ici (voir demandeAchat.service.ts#selectMarcheSchema). */
  montantDemande?: number
}

/**
 * Écran MarcheDA (bouton « Marché concerné ») — route dédiée, jamais le PUT
 * générique ci-dessus : ID_FOURNISSEUR_RETENU/MOTIF_CHOIX sont dérivés côté
 * serveur (demandeAchat.service.ts#selectMarcheDemandeAchat), jamais transmis
 * ici. `{ nummarche: null, idMarcheTiers: null }` retire la sélection.
 */
export async function selectMarcheDemandeAchat(idDemandeAchat: number, input: SelectMarcheInput): Promise<DemandeAchat> {
  return api.put<DemandeAchat>(`/demandes-achat/${idDemandeAchat}/marche`, input)
}

export interface ConsultationCandidat {
  idDevis: number
  idFournisseur: number
  montantDevis: number | null
  ordre: number
  retenu: boolean
  nomFichierOriginal: string | null
  tailleOctets: number | null
}

/** Écran FournisseurDA (bouton « Éléments de consultation »), à l'ouverture. */
export async function getConsultationDemandeAchat(idDemandeAchat: number): Promise<ConsultationCandidat[]> {
  return api.get<ConsultationCandidat[]>(`/demandes-achat/${idDemandeAchat}/consultation`)
}

/**
 * Écran FournisseurDA — ajoute un candidat, écrit immédiatement en base
 * (décision du 09/09/2026, PiecesDevisDA) : la ligne DEVIS_CONSULTE doit
 * exister dès l'ajout pour que le bouton « Devis » du candidat fonctionne
 * avant même le premier « Enregistrer » de la liste.
 */
export async function addConsultationCandidat(idDemandeAchat: number, idFournisseur: number): Promise<ConsultationCandidat> {
  return api.post<ConsultationCandidat>(`/demandes-achat/${idDemandeAchat}/consultation/candidats`, { idFournisseur })
}

/** Retire un candidat consulté (et son devis éventuel) — écrit immédiatement en base. */
export async function removeConsultationCandidat(idDemandeAchat: number, idDevis: number): Promise<void> {
  return api.delete(`/demandes-achat/${idDemandeAchat}/consultation/candidats/${idDevis}`)
}

export interface SaveConsultationInput {
  candidats: { idDevis: number; montantDevis: number }[]
  motifChoix: MotifChoix
  libelleMotifChoix?: string | null
}

/**
 * Écran FournisseurDA — fixe l'ordre final et le montant des candidats déjà
 * ajoutés (voir demandeAchat.service.ts#saveConsultationDemandeAchat) ;
 * ID_FOURNISSEUR_RETENU/MOTIF_CHOIX/MONTANT_DEMANDE dérivés côté serveur du
 * premier candidat. Ne crée ni ne supprime plus de ligne (voir
 * addConsultationCandidat/removeConsultationCandidat).
 */
export async function saveConsultationDemandeAchat(idDemandeAchat: number, input: SaveConsultationInput): Promise<DemandeAchat> {
  return api.put<DemandeAchat>(`/demandes-achat/${idDemandeAchat}/consultation`, input)
}

/**
 * Écran MarcheDA (bouton « Ajouter Devis ») — récupère l'unique ligne
 * DEVIS_CONSULTE facultative du marché sélectionné, la crée si elle n'existe
 * pas encore (voir demandeAchat.service.ts#getOrCreateMarcheDevis).
 */
export async function getOrCreateMarcheDevis(idDemandeAchat: number): Promise<ConsultationCandidat> {
  return api.post<ConsultationCandidat>(`/demandes-achat/${idDemandeAchat}/marche/devis`, {})
}

/** Écran PiecesDevisDA — dépose/remplace le PDF d'un devis (voir demandeAchat.service.ts#uploadDevisFile). */
export async function uploadDevisFile(idDemandeAchat: number, idDevis: number, file: File): Promise<ConsultationCandidat> {
  const formData = new FormData()
  formData.append('fichier', file)
  return api.postForm<ConsultationCandidat>(`/demandes-achat/${idDemandeAchat}/devis/${idDevis}/fichier`, formData)
}

/** Écran de gestion documentaire — télécharge le PDF déposé pour un devis. */
export async function downloadDevisFileBlob(idDemandeAchat: number, idDevis: number): Promise<Blob> {
  return api.getBlob(`/demandes-achat/${idDemandeAchat}/devis/${idDevis}/fichier`)
}

/**
 * Écran de gestion documentaire (icône « Supprimer le devis », croquis
 * DA2.pdf) — retire uniquement le fichier, jamais la ligne (le fournisseur
 * reste consulté/retenu). Voir removeConsultationCandidat pour retirer le
 * fournisseur tout entier.
 */
export async function deleteDevisFile(idDemandeAchat: number, idDevis: number): Promise<ConsultationCandidat> {
  return api.delete<ConsultationCandidat>(`/demandes-achat/${idDemandeAchat}/devis/${idDevis}/fichier`)
}

export interface PieceJointe {
  idPiece: number
  idFournisseur: number
  typePiece: string
  nomFichierOriginal: string
  tailleOctets: number
}

/** Écran de gestion documentaire — pièces complémentaires d'un fournisseur de la DA (voir demandeAchat.service.ts#listPiecesDemandeAchat). */
export async function getPiecesDemandeAchat(idDemandeAchat: number, idFournisseur: number): Promise<PieceJointe[]> {
  return api.get<PieceJointe[]>(`/demandes-achat/${idDemandeAchat}/pieces?idFournisseur=${idFournisseur}`)
}

/** Dépôt d'une pièce complémentaire — une pièce n'existe qu'avec son fichier (voir demandeAchat.service.ts#addPieceDemandeAchat). */
export async function addPieceDemandeAchat(idDemandeAchat: number, idFournisseur: number, typePiece: string, file: File): Promise<PieceJointe> {
  const formData = new FormData()
  formData.append('fichier', file)
  formData.append('idFournisseur', String(idFournisseur))
  formData.append('typePiece', typePiece)
  return api.postForm<PieceJointe>(`/demandes-achat/${idDemandeAchat}/pieces`, formData)
}

export async function removePieceDemandeAchat(idDemandeAchat: number, idPiece: number): Promise<void> {
  return api.delete(`/demandes-achat/${idDemandeAchat}/pieces/${idPiece}`)
}

export async function downloadPieceDemandeAchatBlob(idDemandeAchat: number, idPiece: number): Promise<Blob> {
  return api.getBlob(`/demandes-achat/${idDemandeAchat}/pieces/${idPiece}/fichier`)
}

export async function deleteDemandeAchat(idDemandeAchat: number): Promise<void> {
  return api.delete(`/demandes-achat/${idDemandeAchat}`)
}

// ─── Transitions de statut OP1.1 à OP1.6 (chantier du 15/09/2026, voir
// backend/src/services/demandeAchat.service.ts et ForClaude/CDC/mct-phases-1-2.md) ───

export type DemandeAchatDecision = 'VALIDER' | 'REJETER' | 'ANNULER' | 'COMPLEMENT'

export interface DecisionInput {
  decision: DemandeAchatDecision
  /** Obligatoire pour toute décision autre que VALIDER (motif de rejet/annulation/complément). */
  commentaireStatut?: string
}

/** OP1.1 (résultat final) — bouton « Transmettre au RC » de l'onglet "A finaliser". */
export async function transmettreRc(idDemandeAchat: number): Promise<DemandeAchat> {
  return api.post<DemandeAchat>(`/demandes-achat/${idDemandeAchat}/transmettre-rc`, {})
}

/** OP1.2 — file RC. */
export async function decisionRc(idDemandeAchat: number, input: DecisionInput): Promise<DemandeAchat> {
  return api.post<DemandeAchat>(`/demandes-achat/${idDemandeAchat}/decision-rc`, input)
}

export interface TransmettreFadInput {
  objet?: string
  description?: string
  codeSite: string
  codeSousSite?: string | null
  codeSecteur: string
  codeSousSecteur?: string | null
  codeCug: string
  typeAchat: 'TRAVAUX' | 'FOURNITURES' | 'SERVICES'
  imputationComptable: 'FONCTIONNEMENT' | 'INVESTISSEMENT'
  numeroOperation?: string | null
}

/** OP1.2b — bascule DA → FAD, transmission au CDS (et reprise depuis FAD_A_COMPLETER_CDS). */
export async function transmettreFad(idDemandeAchat: number, input: TransmettreFadInput): Promise<DemandeAchat> {
  return api.post<DemandeAchat>(`/demandes-achat/${idDemandeAchat}/transmettre-fad`, input)
}

/** OP1.3 — file CDS. */
export async function decisionCds(idDemandeAchat: number, input: DecisionInput): Promise<DemandeAchat> {
  return api.post<DemandeAchat>(`/demandes-achat/${idDemandeAchat}/decision-cds`, input)
}

/** OP1.3b — transmission à la CB. */
export async function transmettreCb(idDemandeAchat: number): Promise<DemandeAchat> {
  return api.post<DemandeAchat>(`/demandes-achat/${idDemandeAchat}/transmettre-cb`, {})
}

export interface DecisionCbInput {
  decision: 'VALIDER' | 'REJETER' | 'MODIFIER'
  commentaireStatut?: string
  /** La CB peut corriger les champs budgétaires/comptables au même appel que sa décision (décision du 15/09/2026). */
  codeCug?: string
  typeAchat?: 'TRAVAUX' | 'FOURNITURES' | 'SERVICES'
  imputationComptable?: 'FONCTIONNEMENT' | 'INVESTISSEMENT'
  numeroOperation?: string | null
}

/** OP1.4 — file CB (pas d'issue "annulé"). */
export async function decisionCb(idDemandeAchat: number, input: DecisionCbInput): Promise<DemandeAchat> {
  return api.post<DemandeAchat>(`/demandes-achat/${idDemandeAchat}/decision-cb`, input)
}

export interface RetransmettreCbInput {
  objet?: string
  description?: string
  codeSite?: string
  codeSousSite?: string | null
  codeSecteur?: string
  codeSousSecteur?: string | null
  codeCug?: string
  typeAchat?: 'TRAVAUX' | 'FOURNITURES' | 'SERVICES'
  imputationComptable?: 'FONCTIONNEMENT' | 'INVESTISSEMENT'
  numeroOperation?: string | null
}

/** Reprise OP1.4 — le RC corrige (partiellement) et retransmet directement à la CB, sans repasser par le CDS. */
export async function retransmettreCb(idDemandeAchat: number, input: RetransmettreCbInput): Promise<DemandeAchat> {
  return api.post<DemandeAchat>(`/demandes-achat/${idDemandeAchat}/retransmettre-cb`, input)
}

/** OP1.4b — routage automatique selon le seuil du service (déclenché par la CB), aucune saisie. */
export async function transmettreDsOuSeuil(idDemandeAchat: number): Promise<DemandeAchat> {
  return api.post<DemandeAchat>(`/demandes-achat/${idDemandeAchat}/transmettre-ds-ou-seuil`, {})
}

/** OP1.5 — file DS ; le complément revient à la CB (pas au RC). */
export async function decisionDs(idDemandeAchat: number, input: DecisionInput): Promise<DemandeAchat> {
  return api.post<DemandeAchat>(`/demandes-achat/${idDemandeAchat}/decision-ds`, input)
}

/** OP1.5b — ordre de commande à la CB. */
export async function transmettreOrdreCb(idDemandeAchat: number): Promise<DemandeAchat> {
  return api.post<DemandeAchat>(`/demandes-achat/${idDemandeAchat}/transmettre-ordre-cb`, {})
}

export interface CompleterCbInput {
  codeCug?: string
  typeAchat?: 'TRAVAUX' | 'FOURNITURES' | 'SERVICES'
  imputationComptable?: 'FONCTIONNEMENT' | 'INVESTISSEMENT'
  numeroOperation?: string | null
}

/** Reprise OP1.5 — la CB complète et retransmet directement au DS (réutilise le statut nominal). */
export async function completerCb(idDemandeAchat: number, input: CompleterCbInput): Promise<DemandeAchat> {
  return api.post<DemandeAchat>(`/demandes-achat/${idDemandeAchat}/completer-cb`, input)
}

/** OP1.6 — constat de la commande (saisie du BON dans le PGI = tâche manuelle hors application). */
export async function commander(idDemandeAchat: number, montantCommande: number): Promise<DemandeAchat> {
  return api.post<DemandeAchat>(`/demandes-achat/${idDemandeAchat}/commander`, { montantCommande })
}

/** Vue d'une ligne d'historique (modale « Historique des statuts », icône calendrier — écran d'accueil). */
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

export async function getHistoriqueStatuts(idDemandeAchat: number): Promise<HistoriqueStatutView[]> {
  return api.get<HistoriqueStatutView[]>(`/demandes-achat/${idDemandeAchat}/historique`)
}

export interface SyntheseBucket {
  nombre: number
  montant: number
}

export interface AccueilSynthese {
  enTransit: Record<'RC' | 'CDS' | 'DS' | 'CB', SyntheseBucket>
  mesDemandes: { enCours: SyntheseBucket; commande: SyntheseBucket }
}

/**
 * Tuiles de synthèse — GET /demandes-achat/synthese, dont la portée dépend du rôle effectif du
 * connecté côté serveur (voir demandeAchat.service.ts#getSynthese) : vue Demandeur (ses propres
 * DA/FAD) sur pages/Home.tsx, vue RC (DA/FAD de sa cellule, hors DA_EN_PREPARATION) sur
 * pages/SuiviRc.tsx — même hook, même endpoint, réutilisé tel quel (décision du 15/09/2026, second
 * chantier RC). Renommé depuis useAccueilDemandeurSynthese, qui ne décrivait plus que la moitié des
 * appelants.
 */
export function useAccueilSynthese() {
  const [data, setData] = useState<AccueilSynthese | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const refetch = useCallback(() => {
    setLoading(true)
    setError(null)
    return api
      .get<AccueilSynthese>('/demandes-achat/synthese')
      .then((result) => setData(result))
      .catch(() => setError('Impossible de charger la synthèse.'))
      .finally(() => setLoading(false))
  }, [])

  useEffect(() => {
    void refetch()
  }, [refetch])

  return { data, loading, error, refetch }
}
