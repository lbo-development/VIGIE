import { useEffect, useState } from 'react'
import { api } from '../services/api'
import { useAuth } from '../context/AuthContext'

export interface MeRole {
  typeRole: string
  perimeterLabel: string | null
  idService: number | null
}

export interface MeResponse {
  matricule: string | null
  nom: string | null
  prenom: string | null
  /** Rattachement propre de l'acteur (ACTEUR.ID_CELLULE → CELLULE.ID_SERVICE), indépendant des rôles — permet à un Demandeur (sans rôle dédié) de connaître son propre service. */
  idService: number | null
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
