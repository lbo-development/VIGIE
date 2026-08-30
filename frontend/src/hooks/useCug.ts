import { useCallback, useEffect, useState } from 'react'
import { api } from '../services/api'

export interface Cug {
  code_cug: string
  libelle_cug: string
  id_service: number
  actif: boolean
}

/**
 * Référentiel CUG (Compte Unitaire de Gestion), pour peupler filtres et
 * sélecteurs. Le périmètre réel (ADMIN_APP transverse, ADMIN_SERVICE scopé à
 * son service — pas de périmètre Demandeur pour CUG) est appliqué côté
 * backend, pas ici — voir backend/src/services/cug.service.ts.
 */
export function useCug() {
  const [cug, setCug] = useState<Cug[]>([])
  const [loading, setLoading] = useState(true)

  const refetch = useCallback(() => {
    setLoading(true)
    return api
      .get<Cug[]>('/cug')
      .then((data) => setCug(data))
      .catch(() => setCug([]))
      .finally(() => setLoading(false))
  }, [])

  useEffect(() => {
    void refetch()
  }, [refetch])

  return { cug, loading, refetch }
}
