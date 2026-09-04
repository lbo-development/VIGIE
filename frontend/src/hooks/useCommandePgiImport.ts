import { useCallback, useState } from 'react'
import { api, ApiError } from '../services/api'

export interface LigneCommandePgi {
  numcmd: string
  libfournisseur: string
  mtactuel: number
  mtengage: number
  mtliquide: number
}

export interface Anomalie {
  ligne: number | null
  message: string
}

export interface ImportReport {
  dateFichier: string
  lignes: LigneCommandePgi[]
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
 * Import PGI des commandes — même flux en deux appels sans état serveur
 * entre les deux que useMarcheImport.ts : le même fichier, conservé ici en
 * state, est ré-envoyé à la confirmation, qui revalide tout depuis zéro côté
 * backend avant d'écrire réellement (« annule et remplace » complet pour le
 * service — pas de distinction créer/archiver comme pour les marchés).
 */
export function useCommandePgiImport(idService: number | null) {
  const [state, setState] = useState<State>({ step: 'idle' })

  const preview = useCallback(
    async (file: File) => {
      if (idService === null) return
      setState({ step: 'previewing' })
      try {
        const formData = new FormData()
        formData.append('fichier', file)
        formData.append('idService', String(idService))
        const report = await api.postForm<ImportReport>('/commandes/import/preview', formData)
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
      const finalReport = await api.postForm<ImportReport>('/commandes/import/confirm', formData)
      setState({ step: 'done', report: finalReport })
    } catch (err) {
      setState({ step: 'error', message: err instanceof ApiError ? err.message : 'Une erreur est survenue.' })
    }
  }, [idService, state])

  const reset = useCallback(() => setState({ step: 'idle' }), [])

  return { state, preview, confirm, reset }
}
