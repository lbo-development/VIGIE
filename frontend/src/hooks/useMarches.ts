import { useCallback, useEffect, useState } from 'react'
import { api } from '../services/api'

export interface Marche {
  nummarche: string
  actif: boolean
  completude: boolean
  utilisable: boolean
  typeproc: string
  typedecompoprix: string | null
  naturepresta: string | null
  libpgi: string | null
  libelle_service: string | null
  titulaire: string | null
  /** FOURNISSEUR.RAISON_SOCIALE_SERVICE via MARCHE.ID_FOURNISSEUR, résolu côté backend — pas MARCHE.TITULAIRE_SERVICE (figé à la création). */
  fournisseur_raison_sociale: string | null
  agentgestion: string | null
  planpreventionactif: string | null
  code_cug: string | null
  dtevalid: string | null
  dtenotif: string | null
  dtedebut: string | null
  dtefinmax: string | null
  mtmaxi: number | null
  mt_solde: number | null
  alertemt: number
  alertedate: number
}

/**
 * Liste des marchés (États des marchés, voir MarchesPGI.tsx), filtrable par
 * service. Le périmètre réel (ADMIN_APP transverse, tout autre acteur scopé à
 * sa propre cellule) est appliqué côté backend, pas ici — voir
 * backend/src/services/marche.service.ts. Statut (actif/archivé) et
 * recherche texte restent des filtres client, comme Fournisseurs.tsx.
 */
export function useMarches(idService: number | null) {
  const [marches, setMarches] = useState<Marche[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const refetch = useCallback(() => {
    if (idService === null) {
      setMarches([])
      setLoading(false)
      return Promise.resolve()
    }
    setLoading(true)
    setError(null)
    return api
      .get<Marche[]>(`/marches?idService=${idService}`)
      .then((data) => setMarches(data))
      .catch(() => setError('Impossible de charger les marchés.'))
      .finally(() => setLoading(false))
  }, [idService])

  useEffect(() => {
    void refetch()
  }, [refetch])

  return { marches, loading, error, refetch }
}
