import { useEffect, useState } from 'react'
import { api } from '../services/api'
import { useAuth } from './useAuth'

export interface MeRole {
  typeRole: string
  perimeterLabel: string | null
  idService: number | null
  /** ID_CELLULE du rôle (RC) — ajouté le 15/09/2026 (écran de suivi RC) pour construire l'entrée de sidebar "FAD — <cellule>" sans dépendre du libellé texte. */
  idCellule: number | null
}

export interface MeResponse {
  matricule: string | null
  nom: string | null
  prenom: string | null
  /** Rattachement propre de l'acteur (ACTEUR.ID_CELLULE → CELLULE.ID_SERVICE), indépendant des rôles — permet à un Demandeur (sans rôle dédié) de connaître son propre service. */
  idService: number | null
  /** ACTEUR.ID_CELLULE directement — ajouté le 08/09/2026 pour la page DemandeAchat (verrouillage Direction/Service/Cellule sur les siens, y compris pour RC dont le rôle ne porte que ID_CELLULE). */
  idCellule: number | null
  roles: MeRole[]
}

/**
 * Identité et rôles actifs de l'utilisateur connecté (GET /api/me).
 * Distinct de useAuth() : useAuth() ne connaît que la session Supabase,
 * ce hook connaît le rattachement métier (matricule, ACTEUR, rôles).
 */
export function useCurrentUser() {
  const { session } = useAuth()
  const [data, setData] = useState<MeResponse | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!session) {
      setData(null)
      setLoading(false)
      return
    }

    let cancelled = false
    setLoading(true)

    api
      .get<MeResponse>('/me')
      .then((res) => {
        if (!cancelled) setData(res)
      })
      .catch(() => {
        if (!cancelled) setData(null)
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })

    return () => {
      cancelled = true
    }
  }, [session])

  return { data, loading }
}
