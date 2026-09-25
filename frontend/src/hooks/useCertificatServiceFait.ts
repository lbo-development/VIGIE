import { useCallback, useEffect, useState } from 'react'
import { api } from '../services/api'

/**
 * Circuit CSF (Phase 2, refonte du 24/09/2026 — voir ForClaude/CDC/mcd-phases-1-2.md
 * §3-§6, mct-phases-1-2.md Processus 2, backend/src/services/certificatServiceFait.service.ts).
 * Aucun rejet ni annulation : seulement transmission, demande de complément
 * (toujours non terminale) et suppression physique (R7).
 */

export interface CertificatServiceFait {
  id_csf: number
  numero_csf: string
  id_demande_achat: number
  matricule_redacteur: string
  date_creation: string
  date_service_fait: string | null
  montant_csf: number | null
  description: string | null
  code_statut_csf: string
  created_at: string
  updated_at: string
}

/** Liste des CSF d'une FAD précise (modale « Certificats de service fait » sur une carte FAD commandée). */
export function useCertificatsServiceFaitByDemandeAchat(idDemandeAchat: number | null) {
  const [data, setData] = useState<CertificatServiceFait[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const refetch = useCallback(() => {
    if (idDemandeAchat === null) return Promise.resolve()
    setLoading(true)
    setError(null)
    return api
      .get<CertificatServiceFait[]>(`/certificats-service-fait?idDemandeAchat=${idDemandeAchat}`)
      .then((result) => setData(result))
      .catch(() => setError('Impossible de charger les certificats de service fait.'))
      .finally(() => setLoading(false))
  }, [idDemandeAchat])

  useEffect(() => {
    void refetch()
  }, [refetch])

  return { data, loading, error, refetch }
}

/** File RC ou CB (écran de suivi) — tous les CSF du périmètre, non groupés par FAD. */
export function useCertificatsServiceFaitPourRole(role: 'RC' | 'CB') {
  const [data, setData] = useState<CertificatServiceFait[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const refetch = useCallback(() => {
    setLoading(true)
    setError(null)
    return api
      .get<CertificatServiceFait[]>(`/certificats-service-fait?scope=${role}`)
      .then((result) => setData(result))
      .catch(() => setError('Impossible de charger les certificats de service fait.'))
      .finally(() => setLoading(false))
  }, [role])

  useEffect(() => {
    void refetch()
  }, [refetch])

  return { data, loading, error, refetch }
}

/** OP2.1 — crée immédiatement le brouillon CSF_EN_PREPARATION (création progressive, même modèle que la DA). */
export async function createCertificatServiceFait(idDemandeAchat: number): Promise<CertificatServiceFait> {
  return api.post<CertificatServiceFait>('/certificats-service-fait', { idDemandeAchat })
}

export async function getCertificatServiceFait(idCsf: number): Promise<CertificatServiceFait> {
  return api.get<CertificatServiceFait>(`/certificats-service-fait/${idCsf}`)
}

export interface CertificatServiceFaitUpdateInput {
  dateServiceFait?: string | null
  montantCsf?: number | null
  description?: string | null
}

/** Édition par le rédacteur (CSF_EN_PREPARATION ou CSF_A_COMPLETER_RC). */
export async function updateCertificatServiceFait(idCsf: number, input: CertificatServiceFaitUpdateInput): Promise<CertificatServiceFait> {
  return api.put<CertificatServiceFait>(`/certificats-service-fait/${idCsf}`, input)
}

/** Édition en place par le RC (justificatif/montant sur CSF_A_TRAITER), sans changement de statut. */
export async function editerEnPlaceRc(idCsf: number, input: CertificatServiceFaitUpdateInput): Promise<CertificatServiceFait> {
  return api.put<CertificatServiceFait>(`/certificats-service-fait/${idCsf}/rc`, input)
}

/** Transmission au RC (R5) — soumission initiale ou resoumission après complément (CSF_A_COMPLETER_RC). */
export async function transmettreRc(idCsf: number): Promise<CertificatServiceFait> {
  return api.post<CertificatServiceFait>(`/certificats-service-fait/${idCsf}/transmettre-rc`, {})
}

/** RC transmet à la CB — depuis CSF_A_TRAITER. */
export async function transmettreBudget(idCsf: number): Promise<CertificatServiceFait> {
  return api.post<CertificatServiceFait>(`/certificats-service-fait/${idCsf}/transmettre-budget`, {})
}

/** RC demande un complément au rédacteur — jamais de rejet, boucle non terminale. */
export async function demanderComplementRc(idCsf: number, commentaire: string): Promise<CertificatServiceFait> {
  return api.post<CertificatServiceFait>(`/certificats-service-fait/${idCsf}/complement-rc`, { commentaire })
}

/** RC reprend et retransmet directement à la CB après un complément budgétaire — sans repasser par le rédacteur. */
export async function retransmettreBudget(idCsf: number, commentaire?: string): Promise<CertificatServiceFait> {
  return api.post<CertificatServiceFait>(`/certificats-service-fait/${idCsf}/retransmettre-budget`, { commentaire: commentaire || undefined })
}

export interface ValiderBudgetResult {
  csf: CertificatServiceFait
  /** R2 : alerte non bloquante si le cumul des CSF validés dépasse MONTANT_COMMANDE de la FAD. */
  alerteDepassement: boolean
}

/** CB valide — déclenche le paiement dans le PGI (hors application). Jamais de rejet ni d'annulation côté CB. */
export async function validerBudget(idCsf: number): Promise<ValiderBudgetResult> {
  return api.post<ValiderBudgetResult>(`/certificats-service-fait/${idCsf}/valider-budget`, {})
}

/** CB demande un complément au RC — jamais de rejet, boucle non terminale. */
export async function demanderComplementBudget(idCsf: number, commentaire: string): Promise<CertificatServiceFait> {
  return api.post<CertificatServiceFait>(`/certificats-service-fait/${idCsf}/complement-budget`, { commentaire })
}

/** OP2.4 — CB constate la liquidation de la facture dans le PGI (hors application). Terminal. */
export async function constaterLiquidation(idCsf: number): Promise<CertificatServiceFait> {
  return api.post<CertificatServiceFait>(`/certificats-service-fait/${idCsf}/liquidation`, {})
}

/** R7 — rédacteur (CSF_EN_PREPARATION/CSF_A_COMPLETER_RC) ou RC (CSF_A_TRAITER/CSF_A_COMPLETER_RC), jamais au-delà. */
export async function supprimerCertificatServiceFait(idCsf: number): Promise<void> {
  return api.delete(`/certificats-service-fait/${idCsf}`)
}

export interface PieceJointeCsf {
  idPiece: number
  typePiece: string
  nomFichierOriginal: string
  tailleOctets: number
}

export async function getPiecesCertificatServiceFait(idCsf: number): Promise<PieceJointeCsf[]> {
  return api.get<PieceJointeCsf[]>(`/certificats-service-fait/${idCsf}/pieces`)
}

export async function addPieceCertificatServiceFait(idCsf: number, typePiece: string, file: File): Promise<PieceJointeCsf> {
  const formData = new FormData()
  formData.append('fichier', file)
  formData.append('typePiece', typePiece)
  return api.postForm<PieceJointeCsf>(`/certificats-service-fait/${idCsf}/pieces`, formData)
}

export async function removePieceCertificatServiceFait(idCsf: number, idPiece: number): Promise<void> {
  return api.delete(`/certificats-service-fait/${idCsf}/pieces/${idPiece}`)
}

export async function downloadPieceCertificatServiceFaitBlob(idCsf: number, idPiece: number): Promise<Blob> {
  return api.getBlob(`/certificats-service-fait/${idCsf}/pieces/${idPiece}/fichier`)
}

/** Vue d'une ligne d'historique (fil chronologique, même composant que HistoriqueStatutsModal côté FAD). */
export interface HistoriqueStatutCsfView {
  idHistoCsf: number
  codeStatutCsf: string
  libelleStatut: string
  dateHeure: string
  matriculeActeur: string
  acteurNomPrenom: string | null
  commentaireStatut: string | null
}

export async function getHistoriqueStatutsCsf(idCsf: number): Promise<HistoriqueStatutCsfView[]> {
  return api.get<HistoriqueStatutCsfView[]>(`/certificats-service-fait/${idCsf}/historique`)
}

// ─────────────────────────────────────────────────────────────────────────
// Suivi de la facturation (tuiles de synthèse, décision du 24/09/2026) —
// pages/Home.tsx (vue Demandeur), pages/SuiviCsfRc.tsx (?scope=RC),
// pages/SuiviCsfCb.tsx (?scope=CB).
// ─────────────────────────────────────────────────────────────────────────

export interface SyntheseFacturationBucket {
  nombre: number
  montant: number
}

export interface SyntheseFacturation {
  /** CSF au statut CSF_VALIDE_BUDGET ou CSF_LIQUIDE uniquement. */
  csf: SyntheseFacturationBucket
  /** FAD au statut FAD_COMMANDEE, dans le périmètre. */
  commandes: SyntheseFacturationBucket
  /** Commandes ci-dessus n'ayant strictement aucun CSF (tous statuts confondus). */
  commandesSansCsf: SyntheseFacturationBucket
}

export function useSyntheseFacturation(scope?: 'RC' | 'CB') {
  const [data, setData] = useState<SyntheseFacturation | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const refetch = useCallback(() => {
    setLoading(true)
    setError(null)
    return api
      .get<SyntheseFacturation>(`/certificats-service-fait/synthese-facturation${scope ? `?scope=${scope}` : ''}`)
      .then((result) => setData(result))
      .catch(() => setError('Impossible de charger le suivi de la facturation.'))
      .finally(() => setLoading(false))
  }, [scope])

  useEffect(() => {
    void refetch()
  }, [refetch])

  return { data, loading, error, refetch }
}
