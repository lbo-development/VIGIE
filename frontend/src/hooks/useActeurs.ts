import { useCallback, useEffect, useState } from 'react'
import { api } from '../services/api'

export interface Acteur {
  matricule: string
  nom: string
  prenom: string
  fonction: string | null
  id_cellule: number
}

export interface UseActeursParams {
  idService?: number | null
  idCellule?: number | null
}

/**
 * Acteurs d'un service ou d'une cellule — alimente le combo « Demandeur » de
 * la page DemandeAchat (GET /api/acteurs, réservé RC/ADMIN_SERVICE/ADMIN_APP
 * côté backend, voir acteur.service.ts#listActeurs). idCellule prime sur
 * idService si les deux sont fournis. Ni l'un ni l'autre : aucune requête
 * (cas du Demandeur simple, qui n'a pas de sélecteur).
 */
export function useActeurs({ idService, idCellule }: UseActeursParams) {
  const [acteurs, setActeurs] = useState<Acteur[]>([])
  const [loading, setLoading] = useState(false)

  const refetch = useCallback(() => {
    if (idCellule == null && idService == null) {
      setActeurs([])
      return Promise.resolve()
    }
    setLoading(true)
    const query = idCellule != null ? `?idCellule=${idCellule}` : `?idService=${idService}`
    return api
      .get<Acteur[]>(`/acteurs${query}`)
      .then((data) => setActeurs(data))
      .catch(() => setActeurs([]))
      .finally(() => setLoading(false))
  }, [idService, idCellule])

  useEffect(() => {
    void refetch()
  }, [refetch])

  return { acteurs, loading, refetch }
}
