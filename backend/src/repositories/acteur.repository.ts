import { supabase } from '../config/supabaseClient.js'

/**
 * finances.acteur — référentiel organisationnel VIGIE (schéma dédié, projet
 * Supabase partagé entre applications GPMM — voir ForClaude/SECURITY.md).
 *
 * ACTIF ajouté le 10/09/2026 (chantier CRUD gestion des utilisateurs) —
 * désactivation par flag, même principe que DIRECTION/SERVICE/CELLULE/CUG.
 * Voir ForClaude/CDC/mcd-phases-1-2.md §7 et mld-phases-1-2.md §2.1.
 */

export interface Acteur {
  matricule: string
  nom: string
  prenom: string
  fonction: string
  id_cellule: number
  actif: boolean
}

const SELECT_COLUMNS = 'matricule, nom, prenom, fonction, id_cellule, actif'

export async function findByMatricule(matricule: string): Promise<Acteur | null> {
  const { data, error } = await supabase
    .schema('finances')
    .from('acteur')
    .select(SELECT_COLUMNS)
    .eq('matricule', matricule)
    .maybeSingle()
  if (error) throw error
  return data
}

export async function findByMatricules(matricules: string[]): Promise<Acteur[]> {
  if (matricules.length === 0) return []
  const { data, error } = await supabase.schema('finances').from('acteur').select(SELECT_COLUMNS).in('matricule', matricules)
  if (error) throw error
  return data ?? []
}

/**
 * Liste complète — sert l'écran d'administration ADMIN_APP « Utilisateurs »
 * (acteur.service.ts#listAllActeurs). Statut (actif/inactif) filtré côté
 * écran, même convention que Directions.tsx/Services.tsx/Cellules.tsx.
 */
export async function findAll(): Promise<Acteur[]> {
  const { data, error } = await supabase.schema('finances').from('acteur').select(SELECT_COLUMNS).order('nom', { ascending: true })
  if (error) throw error
  return data ?? []
}

export async function create(input: Acteur): Promise<Acteur> {
  const { data, error } = await supabase.schema('finances').from('acteur').insert(input).select(SELECT_COLUMNS).single()
  if (error) throw error
  return data
}

export async function update(
  matricule: string,
  input: Partial<Pick<Acteur, 'nom' | 'prenom' | 'fonction' | 'id_cellule' | 'actif'>>,
): Promise<Acteur> {
  const { data, error } = await supabase
    .schema('finances')
    .from('acteur')
    .update(input)
    .eq('matricule', matricule)
    .select(SELECT_COLUMNS)
    .single()
  if (error) throw error
  return data
}

/**
 * Suppression physique — réservée au cas résiduel d'un acteur créé par
 * erreur, jamais utilisé (voir acteur.service.ts#deleteActeur, qui vérifie
 * au préalable l'absence de toute référence). Décision du 10/09/2026.
 */
export async function remove(matricule: string): Promise<void> {
  const { error } = await supabase.schema('finances').from('acteur').delete().eq('matricule', matricule)
  if (error) throw error
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
/**
 * Acteurs rattachés directement à une cellule donnée — utilisé pour la vue
 * par défaut du RC sur la page DemandeAchat (« accès à toutes les DA de sa
 * cellule ») et pour le tiroir demandeur d'ADMIN_SERVICE une fois une
 * cellule choisie (voir demandeAchat.service.ts).
 */
export async function findAllByCellule(idCellule: number): Promise<Acteur[]> {
  const { data, error } = await supabase
    .schema('finances')
    .from('acteur')
    .select(SELECT_COLUMNS)
    .eq('id_cellule', idCellule)
    .order('nom', { ascending: true })
  if (error) throw error
  return data ?? []
}

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
    .select(SELECT_COLUMNS)
    .in('id_cellule', celluleIds)
    .order('nom', { ascending: true })
  if (error) throw error
  return data ?? []
}
