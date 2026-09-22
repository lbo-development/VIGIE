import { supabase } from '../config/supabaseClient.js'
import { todayParis } from '../utils/dates.js'

/**
 * finances.suppleance — dispositif de suppléance (RC/CDS/DS uniquement ; CB
 * exclue). Refonte du 20/09/2026 (voir ForClaude/CDC/mcd-phases-1-2.md,
 * entité SUPPLEANCE, et migration 20260920090000) : seul le titulaire du rôle
 * peut désigner puis retirer un suppléant (autorisation dans
 * suppleance.service.ts) ; le suppléant se substitue entièrement à lui et le
 * titulaire passe en lecture seule pendant la période. Une suppléance n'est
 * jamais modifiée ni supprimée : le retrait renseigne `date_retrait`.
 * Les règles de périmètre, de non-rétroactivité et de chevauchement sont aussi
 * garanties en base (trigger check_suppleance, contrainte d'exclusion).
 */

export interface Suppleance {
  id_suppleance: number
  id_role: number
  matricule_suppleant: string
  date_debut: string
  date_fin: string
  date_retrait: string | null
}

export interface CreateSuppleanceInput {
  id_role: number
  matricule_suppleant: string
  date_debut: string
  date_fin: string
}

const SELECT_COLUMNS = 'id_suppleance, id_role, matricule_suppleant, date_debut, date_fin, date_retrait'

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

/** Toutes les suppléances (passées, en cours, à venir, retirées) des rôles donnés, les plus récentes d'abord. */
export async function findByRoles(idRoles: number[]): Promise<Suppleance[]> {
  if (idRoles.length === 0) return []
  const { data, error } = await supabase
    .schema('finances')
    .from('suppleance')
    .select(SELECT_COLUMNS)
    .in('id_role', idRoles)
    .order('date_debut', { ascending: false })
  if (error) throw error
  return data ?? []
}

/**
 * Chevauchement de dates sur le même rôle, hors suppléances retirées — vérifié
 * ici pour renvoyer un message métier 409 clair ; la contrainte d'exclusion en
 * base (excl_suppleance_role_periode) reste le filet de sécurité final contre
 * les accès concurrents.
 */
export async function findOverlapping(idRole: number, dateDebut: string, dateFin: string): Promise<Suppleance | null> {
  const { data, error } = await supabase
    .schema('finances')
    .from('suppleance')
    .select(SELECT_COLUMNS)
    .eq('id_role', idRole)
    .is('date_retrait', null)
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

/** Retrait logique — seule mise à jour autorisée par le trigger check_suppleance. */
export async function retire(idSuppleance: number): Promise<Suppleance> {
  const { data, error } = await supabase
    .schema('finances')
    .from('suppleance')
    .update({ date_retrait: new Date().toISOString() })
    .eq('id_suppleance', idSuppleance)
    .is('date_retrait', null)
    .select(SELECT_COLUMNS)
    .single()
  if (error) throw error
  return data
}

/** Suppléance active (non retirée, fenêtre couvrant aujourd'hui, fin incluse) sur un rôle donné. */
export interface SuppleanceActiveOnRole {
  id_suppleance: number
  id_role: number
  matricule_suppleant: string
  date_fin: string
}

/**
 * Suppléances actives sur les rôles donnés — sert à repérer un titulaire
 * suppléé (lecture seule, voir roleEffectif.service.ts).
 */
export async function findActiveByRoles(idRoles: number[]): Promise<SuppleanceActiveOnRole[]> {
  if (idRoles.length === 0) return []
  const today = todayParis()
  const { data, error } = await supabase
    .schema('finances')
    .from('suppleance')
    .select('id_suppleance, id_role, matricule_suppleant, date_fin')
    .in('id_role', idRoles)
    .is('date_retrait', null)
    .lte('date_debut', today)
    .gte('date_fin', today)
  if (error) throw error
  return data ?? []
}

export interface SuppleanceActiveRole {
  id_suppleance: number
  id_role: number
  type_role: 'RC' | 'CDS' | 'DS'
  id_cellule: number | null
  id_service: number | null
  id_direction: number | null
  date_fin: string
  /** Titulaire suppléé (ROLE_ATTRIBUTION.MATRICULE). */
  matricule_titulaire: string
}

/**
 * Suppléances actives (non retirées, fenêtre date_debut/date_fin couvrant
 * aujourd'hui, fin incluse) où `matriculeSuppleant` supplée un titulaire —
 * même jointure que auth.repository.ts#hasActiveSuppleanceRole, mais renvoie
 * les lignes complètes (périmètre du rôle suppléé) plutôt qu'un booléen.
 * Utilisé par roleEffectif.service.ts#findEffectiveRoles pour résoudre le
 * périmètre et l'ID_SUPPLEANCE à tracer dans HISTORIQUE_STATUT.
 */
export async function findActiveForSuppleant(matriculeSuppleant: string): Promise<SuppleanceActiveRole[]> {
  const today = todayParis()
  const { data, error } = await supabase
    .schema('finances')
    .from('suppleance')
    .select('id_suppleance, date_fin, role_attribution!inner(id_role, matricule, type_role, id_cellule, id_service, id_direction, actif)')
    .eq('matricule_suppleant', matriculeSuppleant)
    .is('date_retrait', null)
    .lte('date_debut', today)
    .gte('date_fin', today)
    .eq('role_attribution.actif', true)
  if (error) throw error
  return (data ?? []).map((row) => {
    const role = row.role_attribution as unknown as {
      id_role: number
      matricule: string
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
      date_fin: row.date_fin,
      matricule_titulaire: role.matricule,
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
