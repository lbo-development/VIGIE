import { supabase } from '../config/supabaseClient.js'

/**
 * finances.role_attribution — attributions de rôle actives d'un ACTEUR
 * (voir ForClaude/SECURITY.md §2.1 pour le renommage ROLE → role_attribution
 * et le détail des périmètres RC/CDS/DS/CB/ADMIN_SERVICE/ADMIN_APP).
 */

export interface RoleAttributionRow {
  id_role: number
  type_role: string
  id_cellule: number | null
  id_service: number | null
  id_direction: number | null
}

export async function findActiveByMatricule(matricule: string): Promise<RoleAttributionRow[]> {
  const { data, error } = await supabase
    .schema('finances')
    .from('role_attribution')
    .select('id_role, type_role, id_cellule, id_service, id_direction')
    .eq('matricule', matricule)
    .eq('actif', true)
  if (error) throw error
  return data ?? []
}

/**
 * Libellé du périmètre d'une attribution (nom de la cellule/service/direction
 * concernée), pour affichage — null pour ADMIN_APP (transverse, sans périmètre).
 */
export async function resolvePerimeterLabel(row: RoleAttributionRow): Promise<string | null> {
  if (row.id_cellule != null) {
    const { data } = await supabase
      .schema('finances')
      .from('cellule')
      .select('libelle_cellule')
      .eq('id_cellule', row.id_cellule)
      .maybeSingle()
    return data?.libelle_cellule ?? null
  }
  if (row.id_service != null) {
    const { data } = await supabase
      .schema('finances')
      .from('service')
      .select('libelle_service')
      .eq('id_service', row.id_service)
      .maybeSingle()
    return data?.libelle_service ?? null
  }
  if (row.id_direction != null) {
    const { data } = await supabase
      .schema('finances')
      .from('direction')
      .select('libelle_direction')
      .eq('id_direction', row.id_direction)
      .maybeSingle()
    return data?.libelle_direction ?? null
  }
  return null
}
