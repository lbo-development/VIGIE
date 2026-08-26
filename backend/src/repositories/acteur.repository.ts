import { supabase } from '../config/supabaseClient.js'

/**
 * finances.acteur — référentiel organisationnel VIGIE (schéma dédié, projet
 * Supabase partagé entre applications GPMM — voir ForClaude/SECURITY.md).
 */

export interface Acteur {
  matricule: string
  nom: string
  prenom: string
  fonction: string
  id_cellule: number
}

export async function findByMatricule(matricule: string): Promise<Acteur | null> {
  const { data, error } = await supabase
    .schema('finances')
    .from('acteur')
    .select('matricule, nom, prenom, fonction, id_cellule')
    .eq('matricule', matricule)
    .maybeSingle()
  if (error) throw error
  return data
}
