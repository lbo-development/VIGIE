import { useCallback, useEffect, useState } from 'react'
import { api } from '../services/api'

export type DomaineReferentiel = 'TYPE_PIECE_MARCHE' | 'TYPE_PIECE_INVESTISSEMENT' | 'TYPE_PIECE_FAD' | 'TYPE_PIECE_CSF'

export interface LibelleReferentiel {
  domaine: string
  code: string
  libelle: string
  ordre: number
  actif: boolean
}

/**
 * Référentiel générique de listes de valeurs administrables par ADMIN_APP
 * (finances.libelle_referentiel) — sert à peupler les sélecteurs "type de
 * pièce" des modales marché/investissement, en remplacement des listes
 * autrefois codées en dur ici. Voir backend/src/services/libelleReferentiel.service.ts.
 * Renvoie toutes les lignes du domaine (actives et désactivées) triées par
 * ORDRE : à l'appelant de ne proposer que les actives dans un sélecteur tout
 * en gardant le libellé résoluble pour une pièce existante déjà taguée d'un
 * code désactivé depuis.
 */
export function useLibelleReferentiel(domaine: DomaineReferentiel) {
  const [items, setItems] = useState<LibelleReferentiel[]>([])
  const [loading, setLoading] = useState(true)

  const refetch = useCallback(() => {
    setLoading(true)
    return api
      .get<LibelleReferentiel[]>(`/libelles-referentiel?domaine=${domaine}`)
      .then((data) => setItems(data))
      .catch(() => setItems([]))
      .finally(() => setLoading(false))
  }, [domaine])

  useEffect(() => {
    void refetch()
  }, [refetch])

  return { items, loading, refetch }
}
