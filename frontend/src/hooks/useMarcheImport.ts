import { useCallback, useState } from 'react'
import { api, ApiError } from '../services/api'

export interface ImportItem {
  nummarche: string
  libelle: string | null
}

export interface Anomalie {
  ligne: number | null
  message: string
}

export interface ImportReport {
  dateFichier: string
  aCreer: ImportItem[]
  aArchiver: ImportItem[]
  anomalies: Anomalie[]
}

export interface ConfirmReport extends ImportReport {
  fournisseursAjoutes: { numpgi: string; raisonSociale: string }[]
}

type State =
  | { step: 'idle' }
  | { step: 'previewing' }
  | { step: 'ready'; file: File; report: ImportReport }
  | { step: 'confirming'; file: File; report: ImportReport }
  | { step: 'done'; report: ConfirmReport }
  | { step: 'error'; message: string }

/**
 * Import PGI des marchés — flux en deux appels sans état serveur entre les
 * deux (voir ForClaude/Importation-marches/import-marches-pgi.md §5) : le
 * même fichier, conservé ici en state, est ré-envoyé à la confirmation, qui
 * revalide tout depuis zéro côté backend avant d'écrire réellement.
 */
export function useMarcheImport(idService: number | null) {
  const [state, setState] = useState<State>({ step: 'idle' })

  const preview = useCallback(
    async (file: File) => {
      if (idService === null) return
      setState({ step: 'previewing' })
      try {
        const formData = new FormData()
        formData.append('fichier', file)
        formData.append('idService', String(idService))
        const report = await api.postForm<ImportReport>('/marches/import/preview', formData)
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
      const finalReport = await api.postForm<ConfirmReport>('/marches/import/confirm', formData)
      setState({ step: 'done', report: finalReport })
    } catch (err) {
      setState({ step: 'error', message: err instanceof ApiError ? err.message : 'Une erreur est survenue.' })
    }
  }, [idService, state])

  const reset = useCallback(() => setState({ step: 'idle' }), [])

  return { state, preview, confirm, reset }
}
