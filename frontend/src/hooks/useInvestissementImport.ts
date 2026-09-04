import { useCallback, useState } from 'react'
import { api, ApiError } from '../services/api'

export interface LigneInvestissement {
  numeroOperation: string
  libelle: string
  statut: string
  mtInitial: number
  mtSoldeAp1: number
  mtSoldeAp8: number
  mtSoldeCp1: number
  mtSoldeCp8: number
}

/** Une seule à ce jour côté backend (CUG hors service) — voir investissementImport.service.ts#AnomalieType. */
export type AnomalieType = 'cug_hors_service'

export interface Anomalie {
  ligne: number | null
  type: AnomalieType
  message: string
}

export interface ImportReport {
  lignes: LigneInvestissement[]
  nbExclues: number
  anomalies: Anomalie[]
}

type State =
  | { step: 'idle' }
  | { step: 'previewing' }
  | { step: 'ready'; file: File; report: ImportReport }
  | { step: 'confirming'; file: File; report: ImportReport }
  | { step: 'done'; report: ImportReport }
  | { step: 'error'; message: string }

/**
 * Import PGI des opérations d'investissement — même flux en deux appels sans état serveur entre
 * les deux que useCommandePgiImport.ts : le même fichier, conservé ici en state, est ré-envoyé à
 * la confirmation, qui revalide tout depuis zéro côté backend avant d'écrire réellement.
 *
 * Contrairement aux commandes ("annule et remplace" par service), chaque confirm() est un upsert
 * par opération : une opération jamais réimportée reste en base, jamais de suppression. `actif`
 * est un champ manuel (décision du 04/09/2026) — l'import ne le pilote plus du tout après
 * création, voir InvestissementsPGI.tsx (icône « Modifier »).
 */
export function useInvestissementImport(idService: number | null) {
  const [state, setState] = useState<State>({ step: 'idle' })

  const preview = useCallback(
    async (file: File) => {
      if (idService === null) return
      setState({ step: 'previewing' })
      try {
        const formData = new FormData()
        formData.append('fichier', file)
        formData.append('idService', String(idService))
        const report = await api.postForm<ImportReport>('/investissements/import/preview', formData)
        setState({ step: 'ready', file, report })
      } catch (err) {
        setState({ step: 'error', message: err instanceof ApiError ? err.message : 'Une erreur est survenue.' })
      }
    },
    [idService],
  )

  const confirm = useCallback(async () => {
    if (idService === null || state.step !== 'ready') return
    const { file, report } = state
    setState({ step: 'confirming', file, report })
    try {
      const formData = new FormData()
      formData.append('fichier', file)
      formData.append('idService', String(idService))
      const finalReport = await api.postForm<ImportReport>('/investissements/import/confirm', formData)
      setState({ step: 'done', report: finalReport })
    } catch (err) {
      setState({ step: 'error', message: err instanceof ApiError ? err.message : 'Une erreur est survenue.' })
    }
  }, [idService, state])

  const reset = useCallback(() => setState({ step: 'idle' }), [])

  return { state, preview, confirm, reset }
}
