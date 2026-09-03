import { supabase } from '../config/supabaseClient.js'

/**
 * finances.marche_tiers — registre de référence des marchés appartenant à un
 * autre service du port, ressaisis manuellement (voir migration
 * 20260901130000_create_marche_tiers.sql). Table entièrement nouvelle, pas
 * de schéma PGI préexistant — PK technique, pas de clé naturelle.
 */

export interface MarcheTiers {
  id_marche_tiers: number
  id_service: number
  nummarche: string
  /** NOT NULL, au moins 15 caractères (décision du 02/09/2026, voir migration 20260902100000_marche_tiers_champs_obligatoires.sql). */
  libelle_service: string
  id_fournisseur: number
  /** NOT NULL depuis le 02/09/2026 (idem migration ci-dessus). */
  mtmaxi: number
  /** NOT NULL depuis le 02/09/2026 (migration 20260902110000_marche_tiers_dtedebut_obligatoire.sql). */
  dtedebut: string
  /** NOT NULL depuis le 02/09/2026 — voir marcheTiers.service.ts#isMarcheTiersExpire pour la règle ACTIF associée. */
  dtefinmax: string
  typeproc: string
  /** NOT NULL depuis le 02/09/2026. */
  typedecompoprix: string
  /** NOT NULL depuis le 02/09/2026. */
  agentgestion: string
  alertedate: number
  actif: boolean
  commentaire: string | null
  /** Colonne DEFAULT, jamais réécrite après l'insertion. */
  created_at: string
  /** Maintenue par le trigger marche_tiers_set_updated_at (finances.set_updated_at), jamais écrite depuis le code. */
  updated_at: string
}

export async function findAll(idService?: number): Promise<MarcheTiers[]> {
  let query = supabase.schema('finances').from('marche_tiers').select('*').order('nummarche', { ascending: true })
  if (idService !== undefined) query = query.eq('id_service', idService)
  const { data, error } = await query
  if (error) throw error
  return data ?? []
}

export async function findById(idMarcheTiers: number): Promise<MarcheTiers | null> {
  const { data, error } = await supabase
    .schema('finances')
    .from('marche_tiers')
    .select('*')
    .eq('id_marche_tiers', idMarcheTiers)
    .maybeSingle()
  if (error) throw error
  return data
}

export async function findByNummarche(idService: number, nummarche: string): Promise<MarcheTiers | null> {
  const { data, error } = await supabase
    .schema('finances')
    .from('marche_tiers')
    .select('*')
    .eq('id_service', idService)
    .eq('nummarche', nummarche)
    .maybeSingle()
  if (error) throw error
  return data
}

export async function create(input: Omit<MarcheTiers, 'id_marche_tiers' | 'created_at' | 'updated_at'>): Promise<MarcheTiers> {
  const { data, error } = await supabase.schema('finances').from('marche_tiers').insert(input).select().single()
  if (error) throw error
  return data
}

export async function update(
  idMarcheTiers: number,
  input: Partial<Omit<MarcheTiers, 'id_marche_tiers' | 'id_service' | 'nummarche' | 'created_at' | 'updated_at'>>,
): Promise<MarcheTiers> {
  const { data, error } = await supabase
    .schema('finances')
    .from('marche_tiers')
    .update(input)
    .eq('id_marche_tiers', idMarcheTiers)
    .select()
    .single()
  if (error) throw error
  return data
}

/**
 * Suppression physique (icône corbeille, MarchesTiers.tsx, décision du
 * 02/09/2026) — contrôle d'absence de référence par une demande d'achat fait
 * en amont, voir marcheTiers.service.ts#deleteMarcheTiers. Voir migration
 * 20260902091000_marche_tiers_delete_policy.sql pour le grant/policy DELETE.
 */
export async function remove(idMarcheTiers: number): Promise<void> {
  const { error, data } = await supabase
    .schema('finances')
    .from('marche_tiers')
    .delete()
    .eq('id_marche_tiers', idMarcheTiers)
    .select('id_marche_tiers')
  if (error) throw error
  if ((data?.length ?? 0) === 0) throw new Error('Marché tiers introuvable.')
}
