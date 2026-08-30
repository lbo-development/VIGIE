import { useCallback, useEffect, useState } from 'react'
import { api } from '../services/api'

/** Alignées sur la contrainte CHECK de la table physique finances.contact (schéma préexistant). */
export type NatureFonction =
  | 'DIRIGEANT'
  | 'JURIDIQUE'
  | 'COMMERCIAL'
  | "RESPONSABLE D'AFFAIRE"
  | 'RESPONSABLE TECHNIQUE'
  | 'TECHNICIEN'
  | 'RESPONSABLE FINANCIER/COMPTABILITE'

export interface Contact {
  id_contact: number
  id_fournisseur: number
  nom: string
  prenom: string | null
  mail: string | null
  telfixe: string | null
  telmobile: string | null
  fonction: string | null
  naturefonction: NatureFonction | null
}

export interface Fournisseur {
  id_fournisseur: number
  id_service: number
  raison_sociale_pgi: string | null
  raison_sociale_service: string
  siren: string
  numpgi: string | null
  adr1: string | null
  adr2: string | null
  cp: string | null
  ville: string | null
  cedex: string | null
  type_creation: 'PGI' | 'SERVICE'
  actif: boolean
  contacts: Contact[]
}

/**
 * Liste des fournisseurs (avec leurs contacts imbriqués), filtrable par
 * service. Le périmètre réel (ADMIN_APP transverse, ADMIN_SERVICE/Demandeur
 * scopés à leur service) est appliqué côté backend, pas ici — voir
 * backend/src/services/fournisseur.service.ts.
 */
export function useFournisseurs(idService: number | null) {
  const [fournisseurs, setFournisseurs] = useState<Fournisseur[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const refetch = useCallback(() => {
    setLoading(true)
    setError(null)
    const query = idService !== null ? `?idService=${idService}` : ''
    return api
      .get<Fournisseur[]>(`/fournisseurs${query}`)
      .then((data) => setFournisseurs(data))
      .catch(() => setError('Impossible de charger les fournisseurs.'))
      .finally(() => setLoading(false))
  }, [idService])

  useEffect(() => {
    void refetch()
  }, [refetch])

  return { fournisseurs, loading, error, refetch }
}
