import { useCallback, useEffect, useState } from 'react'
import { api } from '../services/api'

export interface SousSecteur {
  code_secteur: string
  code_sous_secteur: string
  ordre_sous_secteur: number
  actif: boolean
}

export interface Secteur {
  code_secteur: string
  lib_secteur: string
  ordre_secteur: number
  id_service: number | null
  actif: boolean
  sous_secteurs: SousSecteur[]
}

/** Liste des secteurs (avec leurs sous-secteurs imbriqués), filtrable par service. */
export function useSecteurs(idService: number | null) {
  const [secteurs, setSecteurs] = useState<Secteur[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const refetch = useCallback(() => {
    setLoading(true)
    setError(null)
    const query = idService !== null ? `?idService=${idService}` : ''
    return api
      .get<Secteur[]>(`/secteurs${query}`)
      .then((data) => setSecteurs(data))
      .catch(() => setError('Impossible de charger les secteurs.'))
      .finally(() => setLoading(false))
  }, [idService])

  useEffect(() => {
    void refetch()
  }, [refetch])

  return { secteurs, loading, error, refetch }
}
