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

/**
 * Acteurs rattachés (via ID_CELLULE) à l'une des cellules du service donné —
 * utilisé pour la liste « Agent gestionnaire » de la création manuelle de
 * marché (voir marche.service.ts#listCreationOptions). Deux requêtes (pas de
 * jointure exposée par supabase-js) : cellules du service, puis acteurs de
 * ces cellules.
 */
export async function findAllByService(idService: number): Promise<Acteur[]> {
  const { data: cellules, error: celluleError } = await supabase
    .schema('finances')
    .from('cellule')
    .select('id_cellule')
    .eq('id_service', idService)
  if (celluleError) throw celluleError

  const celluleIds = (cellules ?? []).map((c) => c.id_cellule)
  if (celluleIds.length === 0) return []

  const { data, error } = await supabase
    .schema('finances')
    .from('acteur')
    .select('matricule, nom, prenom, fonction, id_cellule')
    .in('id_cellule', celluleIds)
    .order('nom', { ascending: true })
  if (error) throw error
  return data ?? []
}
