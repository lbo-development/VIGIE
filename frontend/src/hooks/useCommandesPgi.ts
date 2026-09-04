import { useCallback, useEffect, useState } from 'react'
import { api } from '../services/api'

export interface CommandePgi {
  numcmd: string
  code_cug: string
  id_service: number
  acheteur: string
  dtecmd: string
  compte_budgetaire: number | null
  catop: string | null
  libfournisseur: string
  /** Jamais null : "HM" (Hors Marché) quand la commande n'est rattachée à aucun marché. */
  marche: string
  mtactuel: number
  mtengage: number
  mtliquide: number
  dtelastimport: string
}

/**
 * Liste des commandes PGI d'un service — lecture seule (alimentée
 * uniquement par l'import, voir useCommandePgiImport.ts). Le périmètre réel
 * (ADMIN_APP transverse, tout le monde d'autre scopé à son service) est
 * appliqué côté backend, pas ici — voir backend/src/services/commandePgi.service.ts.
 */
export function useCommandesPgi(idService: number | null) {
  const [commandes, setCommandes] = useState<CommandePgi[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const refetch = useCallback(() => {
    setLoading(true)
    setError(null)
    const query = idService !== null ? `?idService=${idService}` : ''
    return api
      .get<CommandePgi[]>(`/commandes${query}`)
      .then((data) => setCommandes(data))
      .catch(() => setError('Impossible de charger les commandes.'))
      .finally(() => setLoading(false))
  }, [idService])

  useEffect(() => {
    void refetch()
  }, [refetch])

  return { commandes, loading, error, refetch }
}
