import { useCallback, useEffect, useState } from 'react'
import { api } from '../services/api'

export interface OrgService {
  id_service: number
  code_service: string
  libelle_service: string
  id_direction: number
}

/** Référentiel organisationnel SERVICE, pour peupler filtres et sélecteurs. */
export function useServices() {
  const [services, setServices] = useState<OrgService[]>([])
  const [loading, setLoading] = useState(true)

  const refetch = useCallback(() => {
    setLoading(true)
    return api
      .get<OrgService[]>('/services')
      .then((data) => setServices(data))
      .catch(() => setServices([]))
      .finally(() => setLoading(false))
  }, [])

  useEffect(() => {
    void refetch()
  }, [refetch])

  return { services, loading, refetch }
}
