import { useCallback, useEffect, useState } from 'react'
import { api } from '../services/api'

export type ProcedureAchat = 'MARCHE' | 'HORS_MARCHE'
export type MotifChoix = 'Prix' | 'Délai' | 'Technique' | 'Autre'

export interface DemandeAchat {
  id_demande_achat: number
  numero: string
  id_service: number
  objet: string
  description: string | null
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

export interface DemandeAchatListParams {
  idCellule?: number | null
  matriculeDemandeur?: string | null
  statut?: string | null
  search?: string
}

/** Filtres de la page DemandeAchat — voir demandeAchat.service.ts#listDemandeAchat pour la portée exacte appliquée côté backend selon le rôle. */
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
    if (params.search) query.set('search', params.search)
    const qs = query.toString()

    return api
      .get<DemandeAchat[]>(`/demandes-achat${qs ? `?${qs}` : ''}`)
      .then((data) => setDemandesAchat(data))
      .catch(() => setError('Impossible de charger les demandes d\'achat.'))
      .finally(() => setLoading(false))
  }, [params.idCellule, params.matriculeDemandeur, params.statut, params.search])

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
