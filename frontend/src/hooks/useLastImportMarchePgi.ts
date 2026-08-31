import { useEffect, useState } from 'react'
import { api } from '../services/api'

export interface LastImportInfo {
  exists: boolean
  valeur: string | null
}

/**
 * Lit `last.import.marche.pgi` pour un service donné (GET
 * /marches/import/last-import?idService=X) — portée strictement par service,
 * distingue « paramètre pas encore créé pour ce service » (`exists: false`)
 * de « créé mais aucune importation encore enregistrée » (`exists: true,
 * valeur: null`). Affiché à côté du sélecteur de service dans
 * ImportMarches.tsx.
 */
export function useLastImportMarchePgi(idService: number | null): LastImportInfo | null {
  const [info, setInfo] = useState<LastImportInfo | null>(null)

  useEffect(() => {
    if (idService === null) {
      setInfo(null)
      return
    }
    let cancelled = false
    setInfo(null)

    api
      .get<LastImportInfo>(`/marches/import/last-import?idService=${idService}`)
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
