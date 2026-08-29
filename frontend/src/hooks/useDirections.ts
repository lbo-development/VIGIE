import { useCallback, useEffect, useState } from 'react'
import { api } from '../services/api'

export interface OrgDirection {
  id_direction: number
  code_direction: string
  libelle_direction: string
  actif: boolean
}

/** Référentiel organisationnel DIRECTION, pour peupler filtres et sélecteurs. */
export function useDirections() {
  const [directions, setDirections] = useState<OrgDirection[]>([])
  const [loading, setLoading] = useState(true)

  const refetch = useCallback(() => {
    setLoading(true)
    return api
      .get<OrgDirection[]>('/directions')
      .then((data) => setDirections(data))
      .catch(() => setDirections([]))
      .finally(() => setLoading(false))
  }, [])

  useEffect(() => {
    void refetch()
  }, [refetch])

  return { directions, loading, refetch }
}
