import { useEffect, useState } from 'react'
import { api } from '../services/api'

export interface MarcheOptions {
  acteurs: { matricule: string; nom: string; prenom: string }[]
}

/**
 * Données de la modale « Modifier » (icône carte, MarchesPGI.tsx) : acteurs
 * du service donné, pour la liste « Agent gestionnaire ». GET
 * /marches/options?idService=X, autorisé ADMIN_APP/ADMIN_SERVICE/CB (voir
 * marche.service.ts#listMarcheOptions, endpoint dédié plutôt que /cug,
 * réservé à ADMIN_APP/ADMIN_SERVICE seuls). Ne renvoie plus les CUG depuis le
 * 01/09/2026 (CODE_CUG n'est pas modifiable via « Modifier », et la création
 * manuelle, seule consommatrice de cette liste, a été retirée le même jour).
 */
export function useMarcheOptions(idService: number | null) {
  const [options, setOptions] = useState<MarcheOptions | null>(null)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (idService === null) {
      setOptions(null)
      return
    }
    let cancelled = false
    setLoading(true)

    api
      .get<MarcheOptions>(`/marches/options?idService=${idService}`)
      .then((res) => {
        if (!cancelled) setOptions(res)
      })
      .catch(() => {
        if (!cancelled) setOptions(null)
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })

    return () => {
      cancelled = true
    }
  }, [idService])

  return { options, loading }
}
