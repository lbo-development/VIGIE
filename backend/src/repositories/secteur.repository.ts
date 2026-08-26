import { supabase } from '../config/supabaseClient.js'

/**
 * finances.secteur — référentiel technique (gisement BI), rattaché à un
 * service. Voir ForClaude/CDC/mld-phases-1-2.md §2.2.
 */

export interface Secteur {
  code_secteur: string
  lib_secteur: string
  ordre_secteur: number
  id_service: number | null
  actif: boolean
}

export async function findAll(idService?: number): Promise<Secteur[]> {
  let query = supabase.schema('finances').from('secteur').select('*').order('ordre_secteur', { ascending: true })
  if (idService !== undefined) query = query.eq('id_service', idService)
  const { data, error } = await query
  if (error) throw error
  return data ?? []
}

export async function findByCode(codeSecteur: string): Promise<Secteur | null> {
  const { data, error } = await supabase
    .schema('finances')
    .from('secteur')
    .select('*')
    .eq('code_secteur', codeSecteur)
    .maybeSingle()
  if (error) throw error
  return data
}

export async function create(input: Secteur): Promise<Secteur> {
  const { data, error } = await supabase.schema('finances').from('secteur').insert(input).select().single()
  if (error) throw error
  return data
}

export async function update(codeSecteur: string, input: Partial<Omit<Secteur, 'code_secteur'>>): Promise<Secteur> {
  const { data, error } = await supabase
    .schema('finances')
    .from('secteur')
    .update(input)
    .eq('code_secteur', codeSecteur)
    .select()
    .single()
  if (error) throw error
  return data
}

/**
 * Renumérote ordre_secteur = position (1-based) dans codeSecteurs, dans cet
 * ordre. Une mise à jour par ligne (pas de transaction multi-instructions
 * exposée par supabase-js) : voir ForClaude/SECURITY.md §2.2, toujours
 * vérifier le tableau retourné par .select() plutôt que l'absence
 * d'exception — un .eq(code_secteur) qui ne matche aucune ligne réussit
 * silencieusement à 0 ligne.
 */
export async function reorder(codeSecteurs: string[]): Promise<void> {
  const results = await Promise.all(
    codeSecteurs.map((codeSecteur, index) =>
      supabase
        .schema('finances')
        .from('secteur')
        .update({ ordre_secteur: index + 1 })
        .eq('code_secteur', codeSecteur)
        .select('code_secteur'),
    ),
  )
  const failed = results.find((r) => r.error || (r.data?.length ?? 0) === 0)
  if (failed) throw failed.error ?? new Error('Secteur introuvable pendant la réorganisation.')
}
