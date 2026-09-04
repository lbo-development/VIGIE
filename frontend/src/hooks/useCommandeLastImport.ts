import { useEffect, useState } from 'react'
import { api } from '../services/api'
import type { LastImportInfo } from './useLastImportCommandePgi'

/**
 * Comme `useLastImportCommandePgi`, mais via `GET /commandes/last-import`, ouvert à tout
 * utilisateur authentifié (scopé à son propre service, ADMIN_APP pouvant consulter n'importe
 * quel service) — utilisé par CommandesPGI.tsx (« État des commandes au [date] »), page de
 * consultation ouverte à tous, contrairement à ImportCommandes.tsx
 * (`/commandes/import/last-import`, réservé à ADMIN_APP/ADMIN_SERVICE/CB, cf.
 * useLastImportCommandePgi). Les deux endpoints lisent la même ligne exacte du paramètre pour
 * le service — jamais l'héritage direction/global — voir commandePgi.service.ts#getLastImportStatus.
 */
export function useCommandeLastImport(idService: number | null): LastImportInfo | null {
  const [info, setInfo] = useState<LastImportInfo | null>(null)

  useEffect(() => {
    if (idService === null) {
      setInfo(null)
      return
    }
    let cancelled = false
    setInfo(null)

    api
      .get<LastImportInfo>(`/commandes/last-import?idService=${idService}`)
      .then((res) => {
        if (!cancelled) setInfo(res)
      })
      .catch(() => {
        // Erreur réseau/droits : on laisse `info` à null, l'UI n'affiche alors rien.
      })

    return () => {
      cancelled = true
    }
  }, [idService])

  return info
}
