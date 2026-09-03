import { useCallback, useEffect, useState } from 'react'
import { api, ApiError } from '../services/api'

export type TypeMarchePiece = 'SERVICE' | 'TIERS'
export type TypePiece = 'CCAP' | 'CCTP' | 'AE' | 'AVENANT' | 'BPU' | 'AUTRE'

export interface MarchePiece {
  id_marche_piece: number
  type_marche: TypeMarchePiece
  nummarche: string | null
  id_marche_tiers: number | null
  type_piece: TypePiece
  numero_avenant: number
  nom_fichier_original: string
  taille_octets: number
  matricule_depot: string
  created_at: string
  updated_at: string
}

export interface MarcheRef {
  typeMarche: TypeMarchePiece
  nummarche?: string
  idMarcheTiers?: number
}

function refToQuery(ref: MarcheRef): string {
  const params = new URLSearchParams({ typeMarche: ref.typeMarche })
  if (ref.nummarche) params.set('nummarche', ref.nummarche)
  if (ref.idMarcheTiers !== undefined) params.set('idMarcheTiers', String(ref.idMarcheTiers))
  return params.toString()
}

type MutationState = { step: 'idle' } | { step: 'busy' } | { step: 'error'; message: string }

/**
 * Pièces d'un marché (service ou tiers) — voir backend/src/services/marchePiece.service.ts.
 * Partie liste sur le modèle de useMarches.ts (`{ pieces, loading, error, refetch }`) ;
 * partie mutation (dépôt/métadonnées/suppression/téléchargement) en state-machine, sur le
 * modèle de useMarcheImport.ts.
 */
export function usePiecesMarche(ref: MarcheRef) {
  const { typeMarche, nummarche, idMarcheTiers } = ref
  const [pieces, setPieces] = useState<MarchePiece[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [mutation, setMutation] = useState<MutationState>({ step: 'idle' })

  const refetch = useCallback(() => {
    setLoading(true)
    setError(null)
    return api
      .get<MarchePiece[]>(`/marches/pieces?${refToQuery({ typeMarche, nummarche, idMarcheTiers })}`)
      .then((data) => setPieces(data))
      .catch(() => setError('Impossible de charger les pièces.'))
      .finally(() => setLoading(false))
  }, [typeMarche, nummarche, idMarcheTiers])

  useEffect(() => {
    void refetch()
  }, [refetch])

  const uploadPiece = useCallback(
    async (file: File, typePiece: TypePiece, numeroAvenant: number) => {
      setMutation({ step: 'busy' })
      try {
        const formData = new FormData()
        formData.append('fichier', file)
        formData.append('typeMarche', typeMarche)
        if (nummarche) formData.append('nummarche', nummarche)
        if (idMarcheTiers !== undefined) formData.append('idMarcheTiers', String(idMarcheTiers))
        formData.append('typePiece', typePiece)
        formData.append('numeroAvenant', String(numeroAvenant))
        await api.postForm<MarchePiece>('/marches/pieces', formData)
        setMutation({ step: 'idle' })
        await refetch()
        return true
      } catch (err) {
        setMutation({ step: 'error', message: err instanceof ApiError ? err.message : 'Une erreur est survenue.' })
        return false
      }
    },
    [typeMarche, nummarche, idMarcheTiers, refetch],
  )

  const updatePieceMetadata = useCallback(
    async (idMarchePiece: number, typePiece: TypePiece, numeroAvenant: number) => {
      setMutation({ step: 'busy' })
      try {
        await api.put(`/marches/pieces/${idMarchePiece}`, { typePiece, numeroAvenant })
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
    async (idMarchePiece: number) => {
      setMutation({ step: 'busy' })
      try {
        await api.delete(`/marches/pieces/${idMarchePiece}`)
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

  const downloadPiece = useCallback(async (piece: MarchePiece) => {
    try {
      const blob = await api.getBlob(`/marches/pieces/${piece.id_marche_piece}/download`)
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
