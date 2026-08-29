import { useCallback, useEffect, useState } from 'react'
import { api } from '../services/api'

export interface OrgCellule {
  id_cellule: number
  code_cellule: string
  libelle_cellule: string
  id_service: number
  actif: boolean
}

/** Référentiel organisationnel CELLULE, pour peupler filtres et sélecteurs. */
export function useCellules() {
  const [cellules, setCellules] = useState<OrgCellule[]>([])
  const [loading, setLoading] = useState(true)

  const refetch = useCallback(() => {
    setLoading(true)
    return api
      .get<OrgCellule[]>('/cellules')
      .then((data) => setCellules(data))
      .catch(() => setCellules([]))
      .finally(() => setLoading(false))
  }, [])

  useEffect(() => {
    void refetch()
  }, [refetch])

  return { cellules, loading, refetch }
}
