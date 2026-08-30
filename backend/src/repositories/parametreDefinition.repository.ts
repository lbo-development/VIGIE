import { supabase } from '../config/supabaseClient.js'

/**
 * Catalogue des paramètres applicatifs connus (finances.parametre_definition)
 * — libellé/description/valeur par défaut, une ligne par clé. Distinct de
 * finances.parametre_application (repositories/parametres.repository.ts),
 * qui porte les valeurs scopées (global/direction/service). Voir
 * docs/ARCHITECTURE.md ("Paramétrage applicatif").
 */

export interface ParametreDefinition {
  cle: string
  libelle: string
  description: string | null
  valeur_defaut: unknown
}

export async function findAll(): Promise<ParametreDefinition[]> {
  const { data, error } = await supabase
    .schema('finances')
    .from('parametre_definition')
    .select('*')
    .order('cle', { ascending: true })
  if (error) throw error
  return data ?? []
}

export async function findByCle(cle: string): Promise<ParametreDefinition | null> {
  const { data, error } = await supabase
    .schema('finances')
    .from('parametre_definition')
    .select('*')
    .eq('cle', cle)
    .maybeSingle()
  if (error) throw error
  return data
}
