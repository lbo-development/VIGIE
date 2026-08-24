import { useEffect, useState } from 'react'
import { api } from '../services/api'

export type HealthStatus = 'idle' | 'ok' | 'error'

interface HealthResponse {
  status: string
  timestamp: string
}

/**
 * Hook d'exemple : vérifie que l'API backend répond.
 * Sert de modèle pour écrire d'autres hooks de données dans hooks/.
 */
export function useHealthCheck() {
  const [status, setStatus] = useState<HealthStatus>('idle')

  useEffect(() => {
    let cancelled = false

    api
      .get<HealthResponse>('/health')
      .then(() => {
        if (!cancelled) setStatus('ok')
      })
      .catch(() => {
        if (!cancelled) setStatus('error')
      })

    return () => {
      cancelled = true
    }
  }, [])

  return status
}
