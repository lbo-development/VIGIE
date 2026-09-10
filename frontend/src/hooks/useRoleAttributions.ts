import { useCallback, useEffect, useState } from 'react'
import { api } from '../services/api'

export type TypeRole = 'RC' | 'CDS' | 'DS' | 'CB' | 'ADMIN_SERVICE' | 'ADMIN_APP'

export interface RoleAttribution {
  idRole: number
  matricule: string
  nom: string | null
  prenom: string | null
  typeRole: TypeRole
  perimeterLabel: string | null
  idCellule: number | null
  idService: number | null
  idDirection: number | null
  dateDebut: string
}

/**
 * Attributions de rôle actives (GET /api/role-attributions), scopées côté
 * backend selon l'appelant — ADMIN_APP voit tout, ADMIN_SERVICE seulement
 * son propre service (voir roleAttribution.service.ts#listAttributions).
 * Alimente pages/RolesUtilisateurs.tsx.
 */
export function useRoleAttributions() {
  const [attributions, setAttributions] = useState<RoleAttribution[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const refetch = useCallback(() => {
    setLoading(true)
    setError(null)
    return api
      .get<RoleAttribution[]>('/role-attributions')
      .then((data) => setAttributions(data))
      .catch(() => setError('Impossible de charger les attributions de rôle.'))
      .finally(() => setLoading(false))
  }, [])

  useEffect(() => {
    void refetch()
  }, [refetch])

  return { attributions, loading, error, refetch }
}
