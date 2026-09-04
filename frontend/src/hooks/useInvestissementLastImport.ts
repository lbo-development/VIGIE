import { useEffect, useState } from 'react'
import { api } from '../services/api'
import type { LastImportInfo } from './useLastImportInvestissement'

/**
 * Comme `useLastImportInvestissement`, mais via `GET /investissements/last-import`, ouvert à
 * tout utilisateur authentifié (scopé à son propre service, ADMIN_APP pouvant consulter
 * n'importe quel service) — utilisé par InvestissementsPGI.tsx (« État des investissements au
 * [date] »), page de consultation ouverte à tous, contrairement à ImportInvestissements.tsx
 * (`/investissements/import/last-import`, réservé à ADMIN_APP/ADMIN_SERVICE/CB, cf.
 * useLastImportInvestissement). Les deux endpoints lisent la même ligne exacte du paramètre pour
 * le service — jamais l'héritage direction/global — voir
 * investissement.service.ts#getLastImportStatus.
 */
export function useInvestissementLastImport(idService: number | null): LastImportInfo | null {
  const [info, setInfo] = useState<LastImportInfo | null>(null)

  useEffect(() => {
    if (idService === null) {
      setInfo(null)
      return
    }
    let cancelled = false
    setInfo(null)

    api
      .get<LastImportInfo>(`/investissements/last-import?idService=${idService}`)
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
