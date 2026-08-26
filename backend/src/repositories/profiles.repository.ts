import { supabase } from '../config/supabaseClient.js'

/**
 * public.profiles — lien identité Supabase Auth ↔ ACTEUR métier, partagée
 * entre applications GPMM (voir ForClaude/SECURITY.md §2.1). Ce repository
 * ne touche que cette table ; la résolution ACTEUR/rôles vit dans les
 * repositories du schéma finances.
 */

export async function findMatriculeByAuthId(authUserId: string): Promise<string | null> {
  const { data, error } = await supabase.from('profiles').select('matricule').eq('id', authUserId).maybeSingle()
  if (error) throw error
  return data?.matricule ?? null
}
