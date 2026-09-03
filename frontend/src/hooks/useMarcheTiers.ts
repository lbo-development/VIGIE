import { useCallback, useEffect, useState } from 'react'
import { api } from '../services/api'

export interface MarcheTiers {
  id_marche_tiers: number
  id_service: number
  nummarche: string
  /** NOT NULL, au moins 15 caractères (décision du 02/09/2026). */
  libelle_service: string
  id_fournisseur: number
  /** NOT NULL depuis le 02/09/2026. */
  mtmaxi: number
  /** NOT NULL depuis le 02/09/2026. */
  dtedebut: string
  /** NOT NULL depuis le 02/09/2026. */
  dtefinmax: string
  typeproc: string
  /** NOT NULL depuis le 02/09/2026. */
  typedecompoprix: string
  /** NOT NULL depuis le 02/09/2026. */
  agentgestion: string
  alertedate: number
  actif: boolean
  commentaire: string | null
  created_at: string
  updated_at: string
}

/**
 * Marchés d'un service tiers (finances.marche_tiers) — registre de référence
 * séparé de finances.marche (voir MarchesTiers.tsx), jamais mélangé. Lecture
 * ouverte à tout utilisateur authentifié pour son propre service ; le
 * périmètre réel (ADMIN_APP transverse) est appliqué côté backend — voir
 * backend/src/services/marcheTiers.service.ts.
 */
export function useMarcheTiers(idService: number | null) {
  const [marcheTiers, setMarcheTiers] = useState<MarcheTiers[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const refetch = useCallback(() => {
    setLoading(true)
    setError(null)
    const query = idService !== null ? `?idService=${idService}` : ''
    return api
      .get<MarcheTiers[]>(`/marches/tiers${query}`)
      .then((data) => setMarcheTiers(data))
      .catch(() => setError('Impossible de charger les marchés tiers.'))
      .finally(() => setLoading(false))
  }, [idService])

  useEffect(() => {
    void refetch()
  }, [refetch])

  return { marcheTiers, loading, error, refetch }
}
