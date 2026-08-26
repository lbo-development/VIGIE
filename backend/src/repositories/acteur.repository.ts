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

/**
 * Rattachement organisationnel d'un ACTEUR (acteur.id_cellule -> CELLULE ->
 * SERVICE), indépendant des rôles applicatifs (role_attribution). Voir MLD
 * ForClaude/CDC/mld-phases-1-2.md §2.2.
 */
export async function findIdServiceByMatricule(matricule: string): Promise<number | null> {
  const { data: acteur, error: acteurError } = await supabase
    .schema('finances')
    .from('acteur')
    .select('id_cellule')
    .eq('matricule', matricule)
    .maybeSingle()
  if (acteurError) throw acteurError
  if (!acteur?.id_cellule) return null

  const { data: cellule, error: celluleError } = await supabase
    .schema('finances')
    .from('cellule')
    .select('id_service')
    .eq('id_cellule', acteur.id_cellule)
    .maybeSingle()
  if (celluleError) throw celluleError
  return cellule?.id_service ?? null
}
