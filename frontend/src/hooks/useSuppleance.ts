import { useCallback, useEffect, useState } from 'react'
import { api } from '../services/api'

/**
 * Suppléance (refonte du 20/09/2026, voir ForClaude/CDC/mcd-phases-1-2.md entité SUPPLEANCE et
 * backend/src/services/suppleance.service.ts) : auto-déclarée et retirable par le titulaire d'un
 * rôle RC/CDS/DS pour son propre rôle. Le suppléant est un acteur actif du service (RC, CDS) ou
 * de la direction (DS) — liste construite côté serveur, jamais côté client.
 */

export type SuppleanceStatut = 'A_VENIR' | 'EN_COURS' | 'TERMINEE' | 'RETIREE'

export interface SuppleanceRoleOption {
  idRole: number
  typeRole: 'RC' | 'CDS' | 'DS'
  perimeterLabel: string | null
}

export interface SuppleanceView {
  idSuppleance: number
  idRole: number
  typeRole: string | null
  perimeterLabel: string | null
  matriculeSuppleant: string
  suppleantNomPrenom: string | null
  dateDebut: string
  dateFin: string
  dateRetrait: string | null
  statut: SuppleanceStatut
}

export interface MesSuppleances {
  /** Rôles RC/CDS/DS actifs de l'appelant — vide = pas de bouton « Suppléance ». */
  roles: SuppleanceRoleOption[]
  suppleances: SuppleanceView[]
}

export interface SuppleantCandidat {
  matricule: string
  nom: string
  prenom: string
  fonction: string
}

export interface CreateSuppleanceInput {
  idRole: number
  matriculeSuppleant: string
  dateDebut: string
  dateFin: string
}

/** Rôles suppléables de l'appelant et toutes leurs suppléances (GET /api/suppleances). */
export function useMesSuppleances() {
  const [data, setData] = useState<MesSuppleances | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const refetch = useCallback(() => {
    setError(null)
    return api
      .get<MesSuppleances>('/suppleances')
      .then((res) => setData(res))
      .catch(() => setError('Impossible de charger les suppléances.'))
      .finally(() => setLoading(false))
  }, [])

  useEffect(() => {
    void refetch()
  }, [refetch])

  return { data, loading, error, refetch }
}

/** Suppléants possibles pour un rôle (GET /api/suppleances/candidats). `idRole` null = rien à charger. */
export function useSuppleantCandidats(idRole: number | null) {
  const [candidats, setCandidats] = useState<SuppleantCandidat[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (idRole === null) {
      setCandidats([])
      return
    }
    let cancelled = false
    setLoading(true)
    setError(null)
    api
      .get<SuppleantCandidat[]>(`/suppleances/candidats?idRole=${idRole}`)
      .then((res) => {
        if (!cancelled) setCandidats(res)
      })
      .catch(() => {
        if (!cancelled) setError('Impossible de charger la liste des suppléants.')
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [idRole])

  return { candidats, loading, error }
}

export function createSuppleance(input: CreateSuppleanceInput): Promise<SuppleanceView> {
  return api.post<SuppleanceView>('/suppleances', input)
}

/** Retrait logique (POST /api/suppleances/:id/retrait) — la ligne est conservée pour l'historique. */
export function retireSuppleance(idSuppleance: number): Promise<SuppleanceView> {
  return api.post<SuppleanceView>(`/suppleances/${idSuppleance}/retrait`, {})
}
