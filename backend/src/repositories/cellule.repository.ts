import { supabase } from '../config/supabaseClient.js'

/**
 * finances.cellule — référentiel organisationnel (DIRECTION → SERVICE →
 * CELLULE). Voir ForClaude/CDC/mld-phases-1-2.md §2.1.
 */

export interface Cellule {
  id_cellule: number
  code_cellule: string
  libelle_cellule: string
  id_service: number
  actif: boolean
}

export async function findAll(): Promise<Cellule[]> {
  const { data, error } = await supabase
    .schema('finances')
    .from('cellule')
    .select('id_cellule, code_cellule, libelle_cellule, id_service, actif')
    .order('libelle_cellule', { ascending: true })
  if (error) throw error
  return data ?? []
}

export async function findById(idCellule: number): Promise<Cellule | null> {
  const { data, error } = await supabase
    .schema('finances')
    .from('cellule')
    .select('id_cellule, code_cellule, libelle_cellule, id_service, actif')
    .eq('id_cellule', idCellule)
    .maybeSingle()
  if (error) throw error
  return data
}

export async function findByCode(codeCellule: string): Promise<Cellule | null> {
  const { data, error } = await supabase
    .schema('finances')
    .from('cellule')
    .select('id_cellule, code_cellule, libelle_cellule, id_service, actif')
    .eq('code_cellule', codeCellule)
    .maybeSingle()
  if (error) throw error
  return data
}

export async function create(input: Omit<Cellule, 'id_cellule'>): Promise<Cellule> {
  const { data, error } = await supabase.schema('finances').from('cellule').insert(input).select().single()
  if (error) throw error
  return data
}

export async function update(idCellule: number, input: Partial<Omit<Cellule, 'id_cellule'>>): Promise<Cellule> {
  const { data, error } = await supabase
    .schema('finances')
    .from('cellule')
    .update(input)
    .eq('id_cellule', idCellule)
    .select()
    .single()
  if (error) throw error
  return data
}
