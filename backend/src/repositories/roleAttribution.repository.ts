import { supabase } from '../config/supabaseClient.js'

/**
 * finances.role_attribution — attributions de rôle actives d'un ACTEUR
 * (voir ForClaude/SECURITY.md §2.1 pour le renommage ROLE → role_attribution
 * et le détail des périmètres RC/CDS/DS/CB/ADMIN_SERVICE/ADMIN_APP).
 */

export type TypeRole = 'RC' | 'CDS' | 'DS' | 'CB' | 'ADMIN_SERVICE' | 'ADMIN_APP'

export interface RoleAttributionRow {
  id_role: number
  matricule: string
  type_role: TypeRole
  id_cellule: number | null
  id_service: number | null
  id_direction: number | null
  date_debut: string
  date_fin: string | null
  actif: boolean
}

const SELECT_COLUMNS = 'id_role, matricule, type_role, id_cellule, id_service, id_direction, date_debut, date_fin, actif'

export async function findActiveByMatricule(matricule: string): Promise<RoleAttributionRow[]> {
  const { data, error } = await supabase
    .schema('finances')
    .from('role_attribution')
    .select(SELECT_COLUMNS)
    .eq('matricule', matricule)
    .eq('actif', true)
  if (error) throw error
  return data ?? []
}

/** Garde-fou de suppression d'un ACTEUR — voir acteur.service.ts#deleteActeur. */
export async function existsForMatricule(matricule: string): Promise<boolean> {
  const { data, error } = await supabase
    .schema('finances')
    .from('role_attribution')
    .select('id_role')
    .eq('matricule', matricule)
    .limit(1)
  if (error) throw error
  return (data?.length ?? 0) > 0
}

export async function findById(idRole: number): Promise<RoleAttributionRow | null> {
  const { data, error } = await supabase
    .schema('finances')
    .from('role_attribution')
    .select(SELECT_COLUMNS)
    .eq('id_role', idRole)
    .maybeSingle()
  if (error) throw error
  return data
}

/**
 * Ligne active existante pour un périmètre + type donné — utilisé avant
 * insertion pour RC/CDS/DS (un seul titulaire actif par périmètre, cf.
 * ForClaude/CDC/mld-phases-1-2.md §4) afin de renvoyer un message métier 409
 * explicite plutôt que de laisser remonter la violation de la contrainte
 * UNIQUE partielle en base (voir roleAttribution.service.ts#createAttribution).
 */
export async function findActiveForPerimeter(
  typeRole: TypeRole,
  perimeter: { id_cellule?: number; id_service?: number; id_direction?: number },
): Promise<RoleAttributionRow | null> {
  let query = supabase.schema('finances').from('role_attribution').select(SELECT_COLUMNS).eq('type_role', typeRole).eq('actif', true)
  if (perimeter.id_cellule !== undefined) query = query.eq('id_cellule', perimeter.id_cellule)
  if (perimeter.id_service !== undefined) query = query.eq('id_service', perimeter.id_service)
  if (perimeter.id_direction !== undefined) query = query.eq('id_direction', perimeter.id_direction)
  const { data, error } = await query.maybeSingle()
  if (error) throw error
  return data
}

/** Attributions actives dont le périmètre est directement ID_SERVICE (CDS/CB/ADMIN_SERVICE) — pas RC (cellule), voir findActiveByCellules. */
export async function findActiveByService(idService: number): Promise<RoleAttributionRow[]> {
  const { data, error } = await supabase
    .schema('finances')
    .from('role_attribution')
    .select(SELECT_COLUMNS)
    .eq('id_service', idService)
    .eq('actif', true)
  if (error) throw error
  return data ?? []
}

/** Attributions RC actives sur l'une des cellules données — complète findActiveByService pour la vue « Rôles » d'un ADMIN_SERVICE. */
export async function findActiveByCellules(celluleIds: number[]): Promise<RoleAttributionRow[]> {
  if (celluleIds.length === 0) return []
  const { data, error } = await supabase
    .schema('finances')
    .from('role_attribution')
    .select(SELECT_COLUMNS)
    .in('id_cellule', celluleIds)
    .eq('actif', true)
  if (error) throw error
  return data ?? []
}

/** Vue transverse ADMIN_APP — toutes les attributions actives, tous périmètres confondus. */
export async function findAllActive(): Promise<RoleAttributionRow[]> {
  const { data, error } = await supabase.schema('finances').from('role_attribution').select(SELECT_COLUMNS).eq('actif', true)
  if (error) throw error
  return data ?? []
}

export interface CreateRoleAttributionInput {
  matricule: string
  type_role: TypeRole
  id_cellule: number | null
  id_service: number | null
  id_direction: number | null
}

export async function create(input: CreateRoleAttributionInput): Promise<RoleAttributionRow> {
  const { data, error } = await supabase
    .schema('finances')
    .from('role_attribution')
    .insert({ ...input, date_debut: new Date().toISOString().slice(0, 10), actif: true })
    .select(SELECT_COLUMNS)
    .single()
  if (error) throw error
  return data
}

/** Clôture une attribution (ACTIF=false, DATE_FIN=aujourd'hui) — jamais de suppression physique, historisation (arbitrage 3, ForClaude/SECURITY.md §2.1). */
export async function deactivate(idRole: number): Promise<RoleAttributionRow> {
  const { data, error } = await supabase
    .schema('finances')
    .from('role_attribution')
    .update({ actif: false, date_fin: new Date().toISOString().slice(0, 10) })
    .eq('id_role', idRole)
    .select(SELECT_COLUMNS)
    .single()
  if (error) throw error
  return data
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
