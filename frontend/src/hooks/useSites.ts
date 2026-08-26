import { useCallback, useEffect, useState } from 'react'
import { api } from '../services/api'

export interface SousSite {
  code_site: string
  code_sous_site: string
  ordre_sous_site: number
  actif: boolean
}

export interface Site {
  code_site: string
  lib_site: string
  ordre_site: number
  id_service: number | null
  actif: boolean
  sous_sites: SousSite[]
}

/** Liste des sites (avec leurs sous-sites imbriqués), filtrable par service. */
export function useSites(idService: number | null) {
  const [sites, setSites] = useState<Site[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const refetch = useCallback(() => {
    setLoading(true)
    setError(null)
    const query = idService !== null ? `?idService=${idService}` : ''
    return api
      .get<Site[]>(`/sites${query}`)
      .then((data) => setSites(data))
      .catch(() => setError('Impossible de charger les sites.'))
      .finally(() => setLoading(false))
  }, [idService])

  useEffect(() => {
    void refetch()
  }, [refetch])

  return { sites, loading, error, refetch }
}
