import { useCallback, useEffect, useState } from 'react'
import { api } from '../services/api'

export interface AdminActeur {
  matricule: string
  nom: string
  prenom: string
  fonction: string
  id_cellule: number
  actif: boolean
}

/**
 * Vue complète des ACTEUR — alimente l'écran d'administration ADMIN_APP
 * « Utilisateurs » (GET /api/acteurs sans filtre, réservé transverse à
 * ADMIN_APP côté backend, voir acteur.service.ts#listActeurs). Distinct de
 * useActeurs.ts, qui alimente le combo « Demandeur » de DemandeAchat et
 * n'appelle jamais l'API sans idService/idCellule.
 */
export function useAllActeurs() {
  const [acteurs, setActeurs] = useState<AdminActeur[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const refetch = useCallback(() => {
    setLoading(true)
    setError(null)
    return api
      .get<AdminActeur[]>('/acteurs')
      .then((data) => setActeurs(data))
      .catch(() => setError('Impossible de charger les utilisateurs.'))
      .finally(() => setLoading(false))
  }, [])

  useEffect(() => {
    void refetch()
  }, [refetch])

  return { acteurs, loading, error, refetch }
}
