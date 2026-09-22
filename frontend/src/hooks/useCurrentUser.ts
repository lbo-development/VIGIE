import { useEffect, useState } from 'react'
import { api } from '../services/api'
import { useAuth } from './useAuth'

export interface MeRole {
  typeRole: string
  perimeterLabel: string | null
  idService: number | null
  /** ID_CELLULE du rôle (RC) — ajouté le 15/09/2026 (écran de suivi RC) pour construire l'entrée de sidebar "FAD — <cellule>" sans dépendre du libellé texte. */
  idCellule: number | null
  // ID_DIRECTION est toujours envoyé par /api/me pour un rôle DS (me.service.ts) ; optionnel ici
  // uniquement pour ne pas imposer sa saisie dans chaque fixture de test qui fabrique un rôle
  // RC/CDS/CB (même raison que les 4 champs de suppléance ci-dessous).
  /** ID_DIRECTION du rôle (DS) — ajouté le 22/09/2026 (écran de suivi DS) pour construire l'entrée de sidebar "FAD (N+3) — <direction>" et résoudre le périmètre multi-services du DS. */
  idDirection?: number | null
  // Les 4 champs de suppléance sont toujours envoyés par /api/me (me.service.ts) ; optionnels ici uniquement pour ne pas
  // imposer leur saisie dans chaque fixture de test qui fabrique un rôle sans suppléance.
  /** `true` = titulaire actuellement suppléé : consultation conservée, aucune écriture (décision du 20/09/2026). */
  lectureSeule?: boolean
  /** Fin (AAAA-MM-JJ, incluse) de la suppléance active qui concerne ce rôle, côté titulaire suppléé comme côté suppléant. */
  suppleanceDateFin?: string | null
  /** Titulaire suppléé : « Prénom NOM » de son suppléant. */
  suppleantNomPrenom?: string | null
  /** Suppléant : « Prénom NOM » du titulaire qu'il supplée. */
  enSuppleanceDe?: string | null
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
