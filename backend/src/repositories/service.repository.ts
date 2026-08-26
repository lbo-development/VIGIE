import { supabase } from '../config/supabaseClient.js'

/**
 * finances.service — référentiel organisationnel (DIRECTION → SERVICE →
 * CELLULE). Voir ForClaude/CDC/mld-phases-1-2.md §2.1.
 */

export interface Service {
  id_service: number
  code_service: string
  libelle_service: string
  id_direction: number
}

export async function findAll(): Promise<Service[]> {
  const { data, error } = await supabase
    .schema('finances')
    .from('service')
    .select('id_service, code_service, libelle_service, id_direction')
    .order('libelle_service', { ascending: true })
  if (error) throw error
  return data ?? []
}

export async function findById(idService: number): Promise<Service | null> {
  const { data, error } = await supabase
    .schema('finances')
    .from('service')
    .select('id_service, code_service, libelle_service, id_direction')
    .eq('id_service', idService)
    .maybeSingle()
  if (error) throw error
  return data
}

export async function findByCode(codeService: string): Promise<Service | null> {
  const { data, error } = await supabase
    .schema('finances')
    .from('service')
    .select('id_service, code_service, libelle_service, id_direction')
    .eq('code_service', codeService)
    .maybeSingle()
  if (error) throw error
  return data
}

export async function create(input: Omit<Service, 'id_service'>): Promise<Service> {
  const { data, error } = await supabase.schema('finances').from('service').insert(input).select().single()
  if (error) throw error
  return data
}

export async function update(idService: number, input: Partial<Omit<Service, 'id_service'>>): Promise<Service> {
  const { data, error } = await supabase
    .schema('finances')
    .from('service')
    .update(input)
    .eq('id_service', idService)
    .select()
    .single()
  if (error) throw error
  return data
}
