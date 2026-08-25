import { supabase } from '../config/supabaseClient.js'

/**
 * Rattachement organisationnel d'un ACTEUR (finances.acteur.id_cellule -> CELLULE ->
 * SERVICE), indépendant des rôles applicatifs (ROLE_ATTRIBUTION). Voir MLD
 * ForClaude/CDC/mld-phases-1-2.md §31.
 */

export async function findIdServiceByMatricule(matricule: string): Promise<number | null> {
  const { data: acteur, error: acteurError } = await supabase
    .schema('finances')
    .from('acteur')
    .select('id_cellule')
    .eq('matricule', matricule)
    .single()
  if (acteurError) throw acteurError
  if (!acteur?.id_cellule) return null

  const { data: cellule, error: celluleError } = await supabase
    .schema('finances')
    .from('cellule')
    .select('id_service')
    .eq('id_cellule', acteur.id_cellule)
    .single()
  if (celluleError) throw celluleError
  return cellule?.id_service ?? null
}
