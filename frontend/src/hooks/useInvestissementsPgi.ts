import { useCallback, useEffect, useState } from 'react'
import { api } from '../services/api'

export interface OperationInvestissement {
  numero_operation: string
  libelle: string
  /** Libellé propre au service — calculé à la création (LIBELLE amputé du préfixe NUMERO_OPERATION s'il y figure), modifiable ensuite. */
  libelle_service?: string | null
  id_service: number
  code_cug: string
  statut: string
  actif: boolean
  /** Champ manuel, distinct d'`actif` — pas de second critère documenté (pas de COMPLETUDE comme pour un marché). */
  utilisable: boolean
  mt_initial: number
  mt_travaux: number
  /** Colonne générée Postgres (`mt_initial - mt_travaux`). */
  mt_fesi: number
  mt_budget_ap1: number
  mt_engage_ap1: number
  mt_liquide_ap1: number
  mt_solde_ap1: number
  mt_budget_ap8: number
  mt_engage_ap8: number
  mt_liquide_ap8: number
  mt_solde_ap8: number
  mt_budget_cp1: number
  mt_engage_cp1: number
  mt_liquide_cp1: number
  mt_solde_cp1: number
  mt_budget_cp8: number
  mt_engage_cp8: number
  mt_liquide_cp8: number
  mt_solde_cp8: number
}

/**
 * Liste des opérations d'investissement d'un service — lecture seule (alimentée uniquement par
 * l'import, voir useInvestissementImport.ts). Contrairement à finances.commande_pgi, une
 * opération flaguée inactive (`actif: false`) reste dans la liste — jamais supprimée, voir
 * ForClaude/importation-investissementsPGI/. Le périmètre réel (ADMIN_APP transverse, tout le
 * monde d'autre scopé à son service) est appliqué côté backend, pas ici — voir
 * backend/src/services/investissement.service.ts.
 */
export function useInvestissementsPgi(idService: number | null) {
  const [investissements, setInvestissements] = useState<OperationInvestissement[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const refetch = useCallback(() => {
    setLoading(true)
    setError(null)
    const query = idService !== null ? `?idService=${idService}` : ''
    return api
      .get<OperationInvestissement[]>(`/investissements${query}`)
      .then((data) => setInvestissements(data))
      .catch(() => setError('Impossible de charger les investissements.'))
      .finally(() => setLoading(false))
  }, [idService])

  useEffect(() => {
    void refetch()
  }, [refetch])

  return { investissements, loading, error, refetch }
}
