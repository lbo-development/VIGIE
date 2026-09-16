import { supabase } from '../config/supabaseClient.js'

/**
 * finances.statut — référentiel des 25 statuts du cycle DA/FAD (voir
 * ForClaude/CDC/code_statut.pdf, table reconstruite par la migration
 * 20260914100000_rebuild_statut_depuis_code_statut_pdf.sql). `en_transit`
 * porte le rôle qui détient actuellement l'objet (NULL sur les 7 statuts
 * terminaux de rejet/annulation et sur FAD_COMMANDEE) — colonne pivot pour
 * les 4 onglets de l'écran d'accueil et la tuile « En transit ».
 */

export interface Statut {
  code_statut: string
  libelle: string
  emmeteur: string
  pour_action: string | null
  diffusion: string | null
  en_transit: string | null
  type_statut: string
  commentaire: string | null
}

const SELECT_COLUMNS = 'code_statut, libelle, emmeteur, pour_action, diffusion, en_transit, type_statut, commentaire'

export async function findAll(): Promise<Statut[]> {
  const { data, error } = await supabase.schema('finances').from('statut').select(SELECT_COLUMNS)
  if (error) throw error
  return data ?? []
}

export async function findByCode(codeStatut: string): Promise<Statut | null> {
  const { data, error } = await supabase.schema('finances').from('statut').select(SELECT_COLUMNS).eq('code_statut', codeStatut).maybeSingle()
  if (error) throw error
  return data
}
