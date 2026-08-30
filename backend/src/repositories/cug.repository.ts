import { supabase } from '../config/supabaseClient.js'

/**
 * finances.cug — Compte Unitaire de Gestion (analytique), rattaché à un
 * SERVICE. Voir ForClaude/CDC/mld-phases-1-2.md §2.2. CODE_CUG est
 * directement la clé primaire (clé naturelle, comme SITE/SECTEUR — pas de
 * clé technique comme CELLULE) : non modifiable après création.
 */

export interface Cug {
  code_cug: string
  libelle_cug: string
  id_service: number
  actif: boolean
}

export async function findAll(idService?: number): Promise<Cug[]> {
  let query = supabase.schema('finances').from('cug').select('*').order('libelle_cug', { ascending: true })
  if (idService !== undefined) query = query.eq('id_service', idService)
  const { data, error } = await query
  if (error) throw error
  return data ?? []
}

export async function findByCode(codeCug: string): Promise<Cug | null> {
  const { data, error } = await supabase
    .schema('finances')
    .from('cug')
    .select('*')
    .eq('code_cug', codeCug)
    .maybeSingle()
  if (error) throw error
  return data
}

export async function create(input: Cug): Promise<Cug> {
  const { data, error } = await supabase.schema('finances').from('cug').insert(input).select().single()
  if (error) throw error
  return data
}

export async function update(codeCug: string, input: Partial<Pick<Cug, 'libelle_cug' | 'actif'>>): Promise<Cug> {
  const { data, error } = await supabase
    .schema('finances')
    .from('cug')
    .update(input)
    .eq('code_cug', codeCug)
    .select()
    .single()
  if (error) throw error
  return data
}
