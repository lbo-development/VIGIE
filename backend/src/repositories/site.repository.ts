import { supabase } from '../config/supabaseClient.js'

/**
 * finances.site — référentiel géographique (gisement BI), rattaché à un
 * service. Voir ForClaude/CDC/mld-phases-1-2.md §2.2.
 */

export interface Site {
  code_site: string
  lib_site: string
  ordre_site: number
  id_service: number | null
  actif: boolean
}

export async function findAll(idService?: number): Promise<Site[]> {
  let query = supabase.schema('finances').from('site').select('*').order('ordre_site', { ascending: true })
  if (idService !== undefined) query = query.eq('id_service', idService)
  const { data, error } = await query
  if (error) throw error
  return data ?? []
}

export async function findByCode(codeSite: string): Promise<Site | null> {
  const { data, error } = await supabase
    .schema('finances')
    .from('site')
    .select('*')
    .eq('code_site', codeSite)
    .maybeSingle()
  if (error) throw error
  return data
}

export async function create(input: Site): Promise<Site> {
  const { data, error } = await supabase.schema('finances').from('site').insert(input).select().single()
  if (error) throw error
  return data
}

export async function update(codeSite: string, input: Partial<Omit<Site, 'code_site'>>): Promise<Site> {
  const { data, error } = await supabase
    .schema('finances')
    .from('site')
    .update(input)
    .eq('code_site', codeSite)
    .select()
    .single()
  if (error) throw error
  return data
}

/**
 * Renumérote ordre_site = position (1-based) dans codeSites, dans cet ordre.
 * Une mise à jour par ligne (pas de transaction multi-instructions exposée
 * par supabase-js) : voir ForClaude/SECURITY.md §2.2, toujours vérifier le
 * tableau retourné par .select() plutôt que l'absence d'exception — un
 * .eq(code_site) qui ne matche aucune ligne réussit silencieusement à 0 ligne.
 */
export async function reorder(codeSites: string[]): Promise<void> {
  const results = await Promise.all(
    codeSites.map((codeSite, index) =>
      supabase.schema('finances').from('site').update({ ordre_site: index + 1 }).eq('code_site', codeSite).select('code_site'),
    ),
  )
  const failed = results.find((r) => r.error || (r.data?.length ?? 0) === 0)
  if (failed) throw failed.error ?? new Error('Site introuvable pendant la réorganisation.')
}
