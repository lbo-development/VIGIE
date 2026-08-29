import { supabase } from '../config/supabaseClient.js'

/**
 * finances.sous_secteur — déclinaison d'un SECTEUR, clé composite
 * (code_secteur, code_sous_secteur). Voir ForClaude/CDC/mld-phases-1-2.md §2.2.
 */

export interface SousSecteur {
  code_secteur: string
  code_sous_secteur: string
  lib_sous_secteur: string
  ordre_sous_secteur: number
  actif: boolean
}

export async function findBySecteurs(codeSecteurs: string[]): Promise<SousSecteur[]> {
  if (codeSecteurs.length === 0) return []
  const { data, error } = await supabase
    .schema('finances')
    .from('sous_secteur')
    .select('*')
    .in('code_secteur', codeSecteurs)
    .order('ordre_sous_secteur', { ascending: true })
  if (error) throw error
  return data ?? []
}

export async function create(input: SousSecteur): Promise<SousSecteur> {
  const { data, error } = await supabase.schema('finances').from('sous_secteur').insert(input).select().single()
  if (error) throw error
  return data
}

export async function update(
  codeSecteur: string,
  codeSousSecteur: string,
  input: Partial<Pick<SousSecteur, 'lib_sous_secteur' | 'ordre_sous_secteur' | 'actif'>>,
): Promise<SousSecteur> {
  const { data, error } = await supabase
    .schema('finances')
    .from('sous_secteur')
    .update(input)
    .eq('code_secteur', codeSecteur)
    .eq('code_sous_secteur', codeSousSecteur)
    .select()
    .single()
  if (error) throw error
  return data
}

/** Renumérote ordre_sous_secteur = position (1-based) dans codeSousSecteurs, pour un secteur donné. */
export async function reorder(codeSecteur: string, codeSousSecteurs: string[]): Promise<void> {
  const results = await Promise.all(
    codeSousSecteurs.map((codeSousSecteur, index) =>
      supabase
        .schema('finances')
        .from('sous_secteur')
        .update({ ordre_sous_secteur: index + 1 })
        .eq('code_secteur', codeSecteur)
        .eq('code_sous_secteur', codeSousSecteur)
        .select('code_sous_secteur'),
    ),
  )
  const failed = results.find((r) => r.error || (r.data?.length ?? 0) === 0)
  if (failed) throw failed.error ?? new Error('Sous-secteur introuvable pendant la réorganisation.')
}
