import { supabase } from '../config/supabaseClient.js'

/**
 * finances.suppleance — dispositif de suppléance (RC/CDS/DS uniquement ; CB
 * exclue — verrouillé en base par un trigger, voir migration
 * 20260914170000). Décision du 14/09/2026 (point 7 de la conception statuts) :
 * seul le titulaire du rôle peut désigner un suppléant (authorization dans
 * suppleance.service.ts), le suppléant se substitue entièrement à lui, sans
 * qu'une action technique ne retire ses droits au titulaire (simple
 * présomption d'absence).
 */

export interface Suppleance {
  id_suppleance: number
  id_role: number
  matricule_suppleant: string
  date_debut: string
  date_fin: string
}

export interface CreateSuppleanceInput {
  id_role: number
  matricule_suppleant: string
  date_debut: string
  date_fin: string
}

const SELECT_COLUMNS = 'id_suppleance, id_role, matricule_suppleant, date_debut, date_fin'

export async function findById(idSuppleance: number): Promise<Suppleance | null> {
  const { data, error } = await supabase
    .schema('finances')
    .from('suppleance')
    .select(SELECT_COLUMNS)
    .eq('id_suppleance', idSuppleance)
    .maybeSingle()
  if (error) throw error
  return data
}

export async function findByRole(idRole: number): Promise<Suppleance[]> {
  const { data, error } = await supabase
    .schema('finances')
    .from('suppleance')
    .select(SELECT_COLUMNS)
    .eq('id_role', idRole)
    .order('date_debut', { ascending: false })
  if (error) throw error
  return data ?? []
}

/**
 * Chevauchement de dates sur le même rôle — vérifié ici pour renvoyer un
 * message métier 409 clair ; la contrainte d'exclusion en base
 * (excl_suppleance_role_periode) reste le filet de sécurité final contre les
 * accès concurrents.
 */
export async function findOverlapping(idRole: number, dateDebut: string, dateFin: string): Promise<Suppleance | null> {
  const { data, error } = await supabase
    .schema('finances')
    .from('suppleance')
    .select(SELECT_COLUMNS)
    .eq('id_role', idRole)
    .lte('date_debut', dateFin)
    .gte('date_fin', dateDebut)
    .limit(1)
    .maybeSingle()
  if (error) throw error
  return data
}

export async function create(input: CreateSuppleanceInput): Promise<Suppleance> {
  const { data, error } = await supabase.schema('finances').from('suppleance').insert(input).select(SELECT_COLUMNS).single()
  if (error) throw error
  return data
}

export interface SuppleanceActiveRole {
  id_suppleance: number
  id_role: number
  type_role: 'RC' | 'CDS' | 'DS'
  id_cellule: number | null
  id_service: number | null
  id_direction: number | null
}

/**
 * Suppléances actives (fenêtre date_debut/date_fin couvrant aujourd'hui) où
 * `matriculeSuppleant` supplée un titulaire — même jointure que
 * auth.repository.ts#hasActiveSuppleanceRole, mais renvoie les lignes
 * complètes (périmètre du rôle supplée) plutôt qu'un booléen. Utilisé par
 * roleEffectif.service.ts#findEffectiveRoles pour résoudre le périmètre et
 * l'ID_SUPPLEANCE à tracer dans HISTORIQUE_STATUT.
 */
export async function findActiveForSuppleant(matriculeSuppleant: string): Promise<SuppleanceActiveRole[]> {
  const today = new Date().toISOString().slice(0, 10)
  const { data, error } = await supabase
    .schema('finances')
    .from('suppleance')
    .select('id_suppleance, role_attribution!inner(id_role, type_role, id_cellule, id_service, id_direction, actif)')
    .eq('matricule_suppleant', matriculeSuppleant)
    .lte('date_debut', today)
    .gte('date_fin', today)
    .eq('role_attribution.actif', true)
  if (error) throw error
  return (data ?? []).map((row) => {
    const role = row.role_attribution as unknown as {
      id_role: number
      type_role: 'RC' | 'CDS' | 'DS'
      id_cellule: number | null
      id_service: number | null
      id_direction: number | null
    }
    return {
      id_suppleance: row.id_suppleance,
      id_role: role.id_role,
      type_role: role.type_role,
      id_cellule: role.id_cellule,
      id_service: role.id_service,
      id_direction: role.id_direction,
    }
  })
}

/** Garde-fou de suppression d'un ACTEUR — voir acteur.service.ts#deleteActeur. */
export async function existsForMatriculeSuppleant(matricule: string): Promise<boolean> {
  const { data, error } = await supabase
    .schema('finances')
    .from('suppleance')
    .select('id_suppleance')
    .eq('matricule_suppleant', matricule)
    .limit(1)
  if (error) throw error
  return (data?.length ?? 0) > 0
}
