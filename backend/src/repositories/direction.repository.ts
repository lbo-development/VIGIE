import { supabase } from '../config/supabaseClient.js'

/**
 * finances.direction — référentiel organisationnel (DIRECTION → SERVICE →
 * CELLULE). Voir ForClaude/CDC/mld-phases-1-2.md §2.1.
 */

export interface Direction {
  id_direction: number
  code_direction: string
  libelle_direction: string
}

export async function findAll(): Promise<Direction[]> {
  const { data, error } = await supabase
    .schema('finances')
    .from('direction')
    .select('id_direction, code_direction, libelle_direction')
    .order('libelle_direction', { ascending: true })
  if (error) throw error
  return data ?? []
}

export async function findById(idDirection: number): Promise<Direction | null> {
  const { data, error } = await supabase
    .schema('finances')
    .from('direction')
    .select('id_direction, code_direction, libelle_direction')
    .eq('id_direction', idDirection)
    .maybeSingle()
  if (error) throw error
  return data
}

export async function findByCode(codeDirection: string): Promise<Direction | null> {
  const { data, error } = await supabase
    .schema('finances')
    .from('direction')
    .select('id_direction, code_direction, libelle_direction')
    .eq('code_direction', codeDirection)
    .maybeSingle()
  if (error) throw error
  return data
}

export async function create(input: Omit<Direction, 'id_direction'>): Promise<Direction> {
  const { data, error } = await supabase.schema('finances').from('direction').insert(input).select().single()
  if (error) throw error
  return data
}

export async function update(
  idDirection: number,
  input: Partial<Omit<Direction, 'id_direction'>>,
): Promise<Direction> {
  const { data, error } = await supabase
    .schema('finances')
    .from('direction')
    .update(input)
    .eq('id_direction', idDirection)
    .select()
    .single()
  if (error) throw error
  return data
}
