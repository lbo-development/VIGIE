import { supabase } from '../config/supabaseClient.js'

/**
 * finances.sous_site — déclinaison d'un SITE (ex. poste, quai), clé composite
 * (code_site, code_sous_site). Voir ForClaude/CDC/mld-phases-1-2.md §2.2.
 */

export interface SousSite {
  code_site: string
  code_sous_site: string
  lib_sous_site: string
  ordre_sous_site: number
  actif: boolean
}

export async function findBySites(codeSites: string[]): Promise<SousSite[]> {
  if (codeSites.length === 0) return []
  const { data, error } = await supabase
    .schema('finances')
    .from('sous_site')
    .select('*')
    .in('code_site', codeSites)
    .order('ordre_sous_site', { ascending: true })
  if (error) throw error
  return data ?? []
}

export async function create(input: SousSite): Promise<SousSite> {
  const { data, error } = await supabase.schema('finances').from('sous_site').insert(input).select().single()
  if (error) throw error
  return data
}

export async function update(
  codeSite: string,
  codeSousSite: string,
  input: Partial<Pick<SousSite, 'lib_sous_site' | 'ordre_sous_site' | 'actif'>>,
): Promise<SousSite> {
  const { data, error } = await supabase
    .schema('finances')
    .from('sous_site')
    .update(input)
    .eq('code_site', codeSite)
    .eq('code_sous_site', codeSousSite)
    .select()
    .single()
  if (error) throw error
  return data
}

/** Renumérote ordre_sous_site = position (1-based) dans codeSousSites, pour un site donné. */
export async function reorder(codeSite: string, codeSousSites: string[]): Promise<void> {
  const results = await Promise.all(
    codeSousSites.map((codeSousSite, index) =>
      supabase
        .schema('finances')
        .from('sous_site')
        .update({ ordre_sous_site: index + 1 })
        .eq('code_site', codeSite)
        .eq('code_sous_site', codeSousSite)
        .select('code_sous_site'),
    ),
  )
  const failed = results.find((r) => r.error || (r.data?.length ?? 0) === 0)
  if (failed) throw failed.error ?? new Error('Sous-site introuvable pendant la réorganisation.')
}
