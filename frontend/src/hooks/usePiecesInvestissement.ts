import { useCallback, useEffect, useState } from 'react'
import { api, ApiError } from '../services/api'

export type TypePiece =
  | 'RAPPORT_CODIR'
  | 'RAPPORT_CODIR_VALIDE'
  | 'RAPPORT_CODIR_ANNEXES'
  | 'RAPPORT_CODIR_PLANS'
  | 'DECISION_DIRECTOIRE'
  | 'DECISION_DIRECTOIRE_ANNEXES'
  | 'DECISION_DIRECTOIRE_PLANS'
  | 'RAPPORT_CS'
  | 'RAPPORT_CS_VALIDE'
  | 'RAPPORT_CS_DOE'
  | 'RAPPORT_CS_ANNEXES'
  | 'RAPPORT_CS_PLANS'
  | 'DECISION_CS'
  | 'FICHE_OUVERTURE_HO_VALIDEE'
  | 'PROJET_TECHNIQUE'
  | 'AUTRE'

export interface InvestissementPiece {
  id_investissement_piece: number
  numero_operation: string
  id_service: number
  type_piece: TypePiece
  numero_reevaluation: number
  nom_fichier_original: string
  taille_octets: number
  matricule_depot: string
  created_at: string
  updated_at: string
}

type MutationState = { step: 'idle' } | { step: 'busy' } | { step: 'error'; message: string }

/**
 * Pièces d'une opération d'investissement — même principe que
 * usePiecesMarche.ts, simplifié (une seule clé, numero_operation, pas de
 * dualité service/tiers).
 */
export function usePiecesInvestissement(numeroOperation: string) {
  const [pieces, setPieces] = useState<InvestissementPiece[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [mutation, setMutation] = useState<MutationState>({ step: 'idle' })

  const refetch = useCallback(() => {
    setLoading(true)
    setError(null)
    return api
      .get<InvestissementPiece[]>(`/investissements/pieces?numeroOperation=${encodeURIComponent(numeroOperation)}`)
      .then((data) => setPieces(data))
      .catch(() => setError('Impossible de charger les pièces.'))
      .finally(() => setLoading(false))
  }, [numeroOperation])

  useEffect(() => {
    void refetch()
  }, [refetch])

  const uploadPiece = useCallback(
    async (file: File, typePiece: TypePiece, numeroReevaluation: number) => {
      setMutation({ step: 'busy' })
      try {
        const formData = new FormData()
        formData.append('fichier', file)
        formData.append('numeroOperation', numeroOperation)
        formData.append('typePiece', typePiece)
        formData.append('numeroReevaluation', String(numeroReevaluation))
        await api.postForm<InvestissementPiece>('/investissements/pieces', formData)
        setMutation({ step: 'idle' })
        await refetch()
        return true
      } catch (err) {
        setMutation({ step: 'error', message: err instanceof ApiError ? err.message : 'Une erreur est survenue.' })
        return false
      }
    },
    [numeroOperation, refetch],
  )

  const updatePieceMetadata = useCallback(
    async (idInvestissementPiece: number, typePiece: TypePiece, numeroReevaluation: number) => {
      setMutation({ step: 'busy' })
      try {
        await api.put(`/investissements/pieces/${idInvestissementPiece}`, { typePiece, numeroReevaluation })
        setMutation({ step: 'idle' })
        await refetch()
        return true
      } catch (err) {
        setMutation({ step: 'error', message: err instanceof ApiError ? err.message : 'Une erreur est survenue.' })
        return false
      }
    },
    [refetch],
  )

  const deletePiece = useCallback(
    async (idInvestissementPiece: number) => {
      setMutation({ step: 'busy' })
      try {
        await api.delete(`/investissements/pieces/${idInvestissementPiece}`)
        setMutation({ step: 'idle' })
        await refetch()
        return true
      } catch (err) {
        setMutation({ step: 'error', message: err instanceof ApiError ? err.message : 'Une erreur est survenue.' })
        return false
      }
    },
    [refetch],
  )

  const downloadPiece = useCallback(async (piece: InvestissementPiece) => {
    try {
      const blob = await api.getBlob(`/investissements/pieces/${piece.id_investissement_piece}/download`)
      const url = URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url
      link.download = piece.nom_fichier_original
      link.click()
      URL.revokeObjectURL(url)
    } catch {
      setError('Impossible de télécharger la pièce.')
    }
  }, [])

  return { pieces, loading, error, refetch, mutation, uploadPiece, updatePieceMetadata, deletePiece, downloadPiece }
}
