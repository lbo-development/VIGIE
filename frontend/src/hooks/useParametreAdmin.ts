import { useCallback, useEffect, useState } from 'react'
import { api } from '../services/api'

export interface ParametreKey {
  cle: string
  libelle: string
  defaut: unknown
}

export interface ParametreRow {
  id_parametre: number
  cle: string
  valeur: unknown
  id_direction: number | null
  id_service: number | null
  description: string | null
  date_maj: string
  matricule_maj: string | null
}

/** Registre des paramètres applicatifs connus (métadonnées, pas les valeurs). */
export function useParametreKeys() {
  const [keys, setKeys] = useState<ParametreKey[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false
    api
      .get<ParametreKey[]>('/parametres')
      .then((data) => {
        if (!cancelled) setKeys(data)
      })
      .catch(() => {
        if (!cancelled) setKeys([])
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [])

  return { keys, loading }
}

/** Toutes les lignes (une par portée) d'un paramètre donné — réservé ADMIN_APP côté backend. */
export function useParametreRows(cle: string | null) {
  const [rows, setRows] = useState<ParametreRow[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const refetch = useCallback(() => {
    if (!cle) {
      setRows([])
      return Promise.resolve()
    }
    setLoading(true)
    setError(null)
    return api
      .get<ParametreRow[]>(`/parametres/${encodeURIComponent(cle)}/rows`)
      .then((data) => setRows(data))
      .catch(() => setError('Impossible de charger les valeurs de ce paramètre.'))
      .finally(() => setLoading(false))
  }, [cle])

  useEffect(() => {
    void refetch()
  }, [refetch])

  return { rows, loading, error, refetch }
}
