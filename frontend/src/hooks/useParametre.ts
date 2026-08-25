import { useEffect, useState } from 'react'
import { api } from '../services/api'

interface ParametreResponse {
  cle: string
  valeur: unknown
}

/**
 * Lit la valeur effective d'un paramètre applicatif (portée service > direction
 * > global, résolue côté backend — voir docs/ARCHITECTURE.md "Paramétrage
 * applicatif"). Retourne `defaut` tant que la requête est en cours ou en échec :
 * un paramètre non lisible ne doit jamais laisser l'appelant sans valeur
 * exploitable (voir ForClaude/SECURITY.md §1.1 pour le cas de l'inactivité).
 */
export function useParametre<T>(cle: string, defaut: T, enabled = true): T {
  const [valeur, setValeur] = useState<T>(defaut)

  useEffect(() => {
    if (!enabled) return
    let cancelled = false

    api
      .get<ParametreResponse>(`/parametres/${encodeURIComponent(cle)}`)
      .then((res) => {
        if (!cancelled) setValeur(res.valeur as T)
      })
      .catch(() => {
        // Erreur réseau/API : on garde `defaut`, déjà en place via useState.
      })

    return () => {
      cancelled = true
    }
  }, [cle, defaut, enabled])

  return valeur
}
