import { useCallback, useEffect, useState } from 'react'
import { api } from '../services/api'

export interface SeuilValidationDs {
  id_service: number
  seuil_fonctionnement: number
  seuil_investissement: number
}

/**
 * Seuils de dispense de validation DS (finances.seuil_validation_ds), un par
 * service — pas d'historisation (décision du 28/08/2026). Un service absent
 * de cette liste n'a pas de seuil défini : à traiter comme 0 côté affichage.
 */
export function useSeuilsValidationDs() {
  const [seuils, setSeuils] = useState<SeuilValidationDs[]>([])
  const [loading, setLoading] = useState(true)

  const refetch = useCallback(() => {
    setLoading(true)
    return api
      .get<SeuilValidationDs[]>('/seuils-validation-ds')
      .then((data) => setSeuils(data))
      .catch(() => setSeuils([]))
      .finally(() => setLoading(false))
  }, [])

  useEffect(() => {
    void refetch()
  }, [refetch])

  return { seuils, loading, refetch }
}
