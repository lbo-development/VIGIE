import { supabase } from '../config/supabaseClient.js'

/**
 * Accès à finances.parametre_application. La résolution en cascade
 * (service > direction > global) et l'upsert sur portée mutuellement
 * exclusive vivent en SQL (fonctions finances.parametre_effectif /
 * finances.upsert_parametre_application) plutôt qu'ici : voir
 * supabase/migrations/20260825110000_add_parametre_application_functions.sql
 * et docs/ARCHITECTURE.md ("Paramétrage applicatif").
 */

export interface ParametreApplication {
  id_parametre: number
  cle: string
  valeur: unknown
  id_direction: number | null
  id_service: number | null
  description: string | null
  date_maj: string
  matricule_maj: string | null
}

/** Toutes les lignes existantes pour une clé (une par portée : global/direction/service). */
export async function findAllRows(cle: string): Promise<ParametreApplication[]> {
  const { data, error } = await supabase
    .schema('finances')
    .from('parametre_application')
    .select('*')
    .eq('cle', cle)
    .order('id_parametre', { ascending: true })
  if (error) throw error
  return data ?? []
}

export async function findValeurEffective(cle: string, idService: number | null): Promise<unknown | null> {
  const { data, error } = await supabase
    .schema('finances')
    .rpc('parametre_effectif', { p_cle: cle, p_id_service: idService })
  if (error) throw error
  return data ?? null
}

export async function upsert(input: {
  cle: string
  valeur: unknown
  idDirection: number | null
  idService: number | null
  matriculeMaj: string
  description?: string
}): Promise<ParametreApplication> {
  const { data, error } = await supabase
    .schema('finances')
    .rpc('upsert_parametre_application', {
      p_cle: input.cle,
      p_valeur: input.valeur,
      p_id_direction: input.idDirection,
      p_id_service: input.idService,
      p_matricule_maj: input.matriculeMaj,
      p_description: input.description ?? null,
    })
    .single()
  if (error) throw error
  return data as ParametreApplication
}
