import { useCallback, useEffect, useState } from 'react'
import { api } from '../services/api'

export type ProcedureAchat = 'MARCHE' | 'HORS_MARCHE'
export type MotifChoix = 'Prix' | 'Délai' | 'Technique' | 'Autre'
export type TypeFad = 'CONTRAT' | 'OUVERTE' | 'FERMEE'

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
  /** Posée une seule fois à l'exemption du seuil de validation DS (décision du 18/09/2026) — voir DemandeAchatCard.tsx (badge « Seuil DS »). */
  validee_sur_seuil_ds: boolean
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
export type AccueilScope =
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
  | 'REJETEES_ANNULEES'

export interface DemandeAchatListParams {
  idCellule?: number | null
  matriculeDemandeur?: string | null
  statut?: string | null
  scope?: AccueilScope
  search?: string
  /** Filtre "Fournisseurs" des onglets de l'écran d'accueil — correspondance exacte. */
  idFournisseurRetenu?: number | null
  /**
   * Écrans de suivi CDS/CB/DS (décisions du 16/09/2026, 18/09/2026 puis 22/09/2026) — indique
   * explicitement au backend quel rôle scoper (voir demandeAchat.service.ts#resolveAccessContext) :
   * un acteur peut cumuler RC/CDS/CB/DS, la résolution par défaut ne suffit pas à distinguer les
   * écrans (pages/SuiviRc.tsx ne le fournit jamais, pages/SuiviCds.tsx/SuiviCb.tsx/SuiviDs.tsx le
   * fournissent toujours).
   */
  role?: 'CDS' | 'CB' | 'DS'
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
    if (params.role) query.set('role', params.role)
    const qs = query.toString()

    return api
      .get<DemandeAchat[]>(`/demandes-achat${qs ? `?${qs}` : ''}`)
      .then((data) => setDemandesAchat(data))
      .catch(() => setError('Impossible de charger les demandes d\'achat.'))
      .finally(() => setLoading(false))
  }, [params.idCellule, params.matriculeDemandeur, params.statut, params.scope, params.search, params.idFournisseurRetenu, params.role])

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
  /** Délai annoncé par l'entreprise consultée (format ISO YYYY-MM-DD) — affiché sur la fiche FAD papier (SuiviCb, bouton « Générer la fiche FAD »). */
  delaiLivraison: string | null
  ordre: number
  retenu: boolean
  nomFichierOriginal: string | null
  tailleOctets: number | null
}

/** Écran FournisseurDA (bouton « Éléments de consultation »), à l'ouverture. */
/** `role: 'CB'` (décision du 18/09/2026) — GestionDocumentaireModal en a besoin pour construire sa liste de fournisseurs sur une FAD qui n'est pas celle de la CB. */
export async function getConsultationDemandeAchat(idDemandeAchat: number, role?: 'CDS' | 'CB' | 'DS'): Promise<ConsultationCandidat[]> {
  return api.get<ConsultationCandidat[]>(`/demandes-achat/${idDemandeAchat}/consultation${role ? `?role=${role}` : ''}`)
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
  candidats: { idDevis: number; montantDevis: number; delaiLivraison?: string | null }[]
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

/** Écran de gestion documentaire — télécharge le PDF déposé pour un devis. `role: 'CB'` (décision du 18/09/2026) : le devis reste verrouillé pour la CB, mais le téléchargement doit rester accessible sur une FAD qui n'est pas la sienne. */
export async function downloadDevisFileBlob(idDemandeAchat: number, idDevis: number, role?: 'CDS' | 'CB' | 'DS'): Promise<Blob> {
  return api.getBlob(`/demandes-achat/${idDemandeAchat}/devis/${idDevis}/fichier${role ? `?role=${role}` : ''}`)
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

/** Écran de gestion documentaire — pièces complémentaires d'un fournisseur de la DA (voir demandeAchat.service.ts#listPiecesDemandeAchat). `role: 'CB'` (décision du 18/09/2026), voir addPieceDemandeAchat ci-dessous. */
export async function getPiecesDemandeAchat(idDemandeAchat: number, idFournisseur: number, role?: 'CDS' | 'CB' | 'DS'): Promise<PieceJointe[]> {
  return api.get<PieceJointe[]>(`/demandes-achat/${idDemandeAchat}/pieces?idFournisseur=${idFournisseur}${role ? `&role=${role}` : ''}`)
}

/**
 * Dépôt d'une pièce complémentaire — une pièce n'existe qu'avec son fichier (voir
 * demandeAchat.service.ts#addPieceDemandeAchat). `role: 'CB'` (décision du 18/09/2026, écran de
 * suivi CB) : contrairement au RC (résolu par défaut, sans hint), la CB n'est reconnue que via ce
 * paramètre explicite — les pièces complémentaires restent modifiables tant qu'elle est « pour
 * action » (STATUTS_PIECES_MODIFIABLES côté backend), contrairement au devis.
 */
export async function addPieceDemandeAchat(idDemandeAchat: number, idFournisseur: number, typePiece: string, file: File, role?: 'CDS' | 'CB' | 'DS'): Promise<PieceJointe> {
  const formData = new FormData()
  formData.append('fichier', file)
  formData.append('idFournisseur', String(idFournisseur))
  formData.append('typePiece', typePiece)
  return api.postForm<PieceJointe>(`/demandes-achat/${idDemandeAchat}/pieces${role ? `?role=${role}` : ''}`, formData)
}

export async function removePieceDemandeAchat(idDemandeAchat: number, idPiece: number, role?: 'CDS' | 'CB' | 'DS'): Promise<void> {
  return api.delete(`/demandes-achat/${idDemandeAchat}/pieces/${idPiece}${role ? `?role=${role}` : ''}`)
}

export async function downloadPieceDemandeAchatBlob(idDemandeAchat: number, idPiece: number, role?: 'CDS' | 'CB' | 'DS'): Promise<Blob> {
  return api.getBlob(`/demandes-achat/${idDemandeAchat}/pieces/${idPiece}/fichier${role ? `?role=${role}` : ''}`)
}

/**
 * Écran de suivi CB — fiche FAD papier (PDF), bouton réservé au rôle CB, actif uniquement sur
 * FAD_TRANSMISE_CB_DS ou FAD_A_COMMANDER avec validee_sur_seuil_ds (voir SuiviCb.tsx et
 * demandeAchat.service.ts#genererFadPdf). Jamais stockée, régénérée à chaque appel.
 */
export async function downloadFadPdfBlob(idDemandeAchat: number): Promise<Blob> {
  return api.getBlob(`/demandes-achat/${idDemandeAchat}/fad-pdf`)
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

/**
 * OP1.2 — file RC. Purement décisionnelle (décision du 16/09/2026, revient sur la fusion
 * décision+complétion du 15/09/2026) — appelée depuis la modale « Valider les éléments de la
 * commande » (visualisation seule), sans aucun champ de complétion OP1.2b (déplacés dans
 * transmettreFad, modale « Traiter »).
 */
export async function decisionRc(idDemandeAchat: number, input: DecisionInput): Promise<DemandeAchat> {
  return api.post<DemandeAchat>(`/demandes-achat/${idDemandeAchat}/decision-rc`, input)
}

/**
 * Reprise OP1.2 (décision du 16/09/2026, écran de suivi RC) — « Dévalider » une DA_VALIDEE_RC :
 * retour à DA_TRANSMISE_DEM_RC, aucun commentaire (simple correction de sa propre décision,
 * distinct d'un rejet/d'une annulation, tous deux terminaux et jamais réversibles).
 */
export async function devaliderRc(idDemandeAchat: number): Promise<DemandeAchat> {
  return api.post<DemandeAchat>(`/demandes-achat/${idDemandeAchat}/devalider-rc`, {})
}

export interface TransmettreFadInput {
  objet?: string
  description?: string
  motifChoix?: MotifChoix
  libelleMotifChoix?: string | null
  codeSite: string
  codeSousSite?: string | null
  codeSecteur: string
  codeSousSecteur?: string | null
  codeCug: string
  typeAchat: 'TRAVAUX' | 'FOURNITURES' | 'SERVICES'
  /** Définition métier du 16/09/2026 (jamais documentée avant ce chantier) — obligatoire. */
  typeFad: TypeFad
  imputationComptable: 'FONCTIONNEMENT' | 'INVESTISSEMENT'
  numeroOperation?: string | null
  /** Réponse libre au motif de complément du CDS (décision du 23/09/2026) — nouvelle ligne d'historique, affichée après le commentaire d'origine (HISTORIQUE_STATUT immuable). */
  commentaireStatut?: string
}

/** OP1.2b — bascule DA → FAD, transmission au CDS (et reprise depuis FAD_A_COMPLETER_CDS). */
export async function transmettreFad(idDemandeAchat: number, input: TransmettreFadInput): Promise<DemandeAchat> {
  return api.post<DemandeAchat>(`/demandes-achat/${idDemandeAchat}/transmettre-fad`, input)
}

export interface EnregistrerFadInput {
  objet?: string
  description?: string
  motifChoix?: MotifChoix
  libelleMotifChoix?: string | null
  codeSite?: string
  codeSousSite?: string | null
  codeSecteur?: string
  codeSousSecteur?: string | null
  codeCug?: string
  typeAchat?: 'TRAVAUX' | 'FOURNITURES' | 'SERVICES'
  typeFad?: TypeFad
  imputationComptable?: 'FONCTIONNEMENT' | 'INVESTISSEMENT'
  numeroOperation?: string | null
}

/**
 * Enregistrement intermédiaire (décision du 16/09/2026, modale « Traiter ») — sauvegarde la
 * saisie en cours du formulaire de complétion FAD sans transmettre ni changer de statut, pour
 * permettre une saisie en plusieurs fois. Tous les champs sont optionnels — contrairement à
 * transmettreFad.
 */
export async function enregistrerFad(idDemandeAchat: number, input: EnregistrerFadInput): Promise<DemandeAchat> {
  return api.put<DemandeAchat>(`/demandes-achat/${idDemandeAchat}/fad`, input)
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
  motifChoix?: MotifChoix
  libelleMotifChoix?: string | null
  codeSite?: string
  codeSousSite?: string | null
  codeSecteur?: string
  codeSousSecteur?: string | null
  codeCug?: string
  typeAchat?: 'TRAVAUX' | 'FOURNITURES' | 'SERVICES'
  typeFad?: TypeFad
  imputationComptable?: 'FONCTIONNEMENT' | 'INVESTISSEMENT'
  numeroOperation?: string | null
  /** Réponse libre au motif de modification de la CB (décision du 23/09/2026) — voir TransmettreFadInput#commentaireStatut. */
  commentaireStatut?: string
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
  /** Réponse libre au motif de complément du DS (décision du 23/09/2026) — voir TransmettreFadInput#commentaireStatut. */
  commentaireStatut?: string
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

/** `role: 'CDS' | 'CB' | 'DS'` — même raison que DemandeAchatListParams.role : pages/SuiviCds.tsx/SuiviCb.tsx doivent le fournir pour rester consultables sur une FAD qui n'est pas la leur. */
export async function getHistoriqueStatuts(idDemandeAchat: number, role?: 'CDS' | 'CB' | 'DS'): Promise<HistoriqueStatutView[]> {
  return api.get<HistoriqueStatutView[]>(`/demandes-achat/${idDemandeAchat}/historique${role ? `?role=${role}` : ''}`)
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
 * appelants. Vue CDS (DA/FAD du service, décision du 16/09/2026, pages/SuiviCds.tsx) : passer
 * `role: 'CDS'` — même raison que DemandeAchatListParams.role, un acteur peut cumuler RC/CDS/CB/DS.
 * Vue CB (décision du 18/09/2026, pages/SuiviCb.tsx) : `role: 'CB'`, FAD du service, "En transit"
 * porte 3 compartiments (RC/CDS/DS), "Mes demandes" devient "FAD du service" comme pour CDS. Vue DS
 * (décision du 22/09/2026, pages/SuiviDs.tsx) : `role: 'DS'`, FAD de tous les services de la
 * direction, "En transit" porte 3 compartiments (RC/CDS/CB), "Mes demandes" devient "FAD de la
 * direction".
 */
export function useAccueilSynthese(role?: 'CDS' | 'CB' | 'DS') {
  const [data, setData] = useState<AccueilSynthese | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const refetch = useCallback(() => {
    setLoading(true)
    setError(null)
    return api
      .get<AccueilSynthese>(`/demandes-achat/synthese${role ? `?role=${role}` : ''}`)
      .then((result) => setData(result))
      .catch(() => setError('Impossible de charger la synthèse.'))
      .finally(() => setLoading(false))
  }, [role])

  useEffect(() => {
    void refetch()
  }, [refetch])

  return { data, loading, error, refetch }
}
