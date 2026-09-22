import { supabase } from '../config/supabaseClient.js'

/**
 * finances.suppleance_audit — piste d'audit immuable des suppléances (création,
 * retrait), alimentée par trigger en base (migration 20260920090000). Lecture
 * seule ici : aucun INSERT/UPDATE/DELETE n'est accordé à service_role.
 */

export interface SuppleanceAudit {
  id_audit: number
  id_suppleance: number
  action: 'CREATION' | 'RETRAIT'
  matricule_acteur: string
  date_heure: string
}

export async function findBySuppleances(idSuppleances: number[]): Promise<SuppleanceAudit[]> {
  if (idSuppleances.length === 0) return []
  const { data, error } = await supabase
    .schema('finances')
    .from('suppleance_audit')
    .select('id_audit, id_suppleance, action, matricule_acteur, date_heure')
    .in('id_suppleance', idSuppleances)
    .order('date_heure', { ascending: true })
  if (error) throw error
  return data ?? []
}
