import { supabase } from '../config/supabaseClient.js'

/**
 * finances.seuil_validation_ds — seuils de dispense de validation DS, un par
 * service (FONCTIONNEMENT + INVESTISSEMENT en colonnes, plus d'historisation
 * — décision du 28/08/2026, voir ForClaude/CDC/mld-phases-1-2.md §2.6).
 * Absence de ligne pour un service = seuils considérés à 0, porté nativement
 * par les colonnes NOT NULL DEFAULT 0 : il n'existe donc jamais de valeur
 * NULL à interpréter côté application, seulement une ligne absente.
 */

export interface SeuilValidationDs {
  id_service: number
  seuil_fonctionnement: number
  seuil_investissement: number
}

export async function findAll(): Promise<SeuilValidationDs[]> {
  const { data, error } = await supabase
    .schema('finances')
    .from('seuil_validation_ds')
    .select('id_service, seuil_fonctionnement, seuil_investissement')
  if (error) throw error
  return data ?? []
}

/**
 * Crée ou remplace la ligne du service (clé primaire = id_service) — upsert
 * plutôt que create/update séparés : chaque service a au plus une ligne, la
 * distinction "elle existe déjà ou pas" n'a pas de sens métier ici.
 */
export async function upsert(input: SeuilValidationDs): Promise<SeuilValidationDs> {
  const { data, error } = await supabase
    .schema('finances')
    .from('seuil_validation_ds')
    .upsert(input, { onConflict: 'id_service' })
    .select()
    .single()
  if (error) throw error
  return data
}
