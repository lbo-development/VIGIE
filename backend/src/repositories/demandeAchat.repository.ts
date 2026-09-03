import { supabase } from '../config/supabaseClient.js'

/**
 * finances.demande_achat — pas de CRUD dans ce backend (phase FAD/workflow pas
 * encore implémentée). Ce fichier n'existe que pour les garde-fous de
 * suppression d'autres entités référencées par une DA : FOURNISSEUR (retenu)
 * et MARCHE_TIERS — voir fournisseur.service.ts#deleteFournisseur,
 * marcheTiers.service.ts#deleteMarcheTiers et
 * ForClaude/CDC/mld-phases-1-2.md §2.2/§2.4.
 */
export async function existsForFournisseurRetenu(idFournisseur: number): Promise<boolean> {
  const { data, error } = await supabase
    .schema('finances')
    .from('demande_achat')
    .select('numero')
    .eq('id_fournisseur_retenu', idFournisseur)
    .limit(1)
  if (error) throw error
  return (data?.length ?? 0) > 0
}

/**
 * Utilisé avant suppression d'un MARCHE_TIERS — voir
 * marcheTiers.service.ts#deleteMarcheTiers et migration
 * 20260902090000_demande_achat_add_marche_tiers_ref.sql (colonne
 * ID_MARCHE_TIERS, exclusive avec NUMMARCHE sur cette table).
 */
export async function existsForMarcheTiers(idMarcheTiers: number): Promise<boolean> {
  const { data, error } = await supabase
    .schema('finances')
    .from('demande_achat')
    .select('numero')
    .eq('id_marche_tiers', idMarcheTiers)
    .limit(1)
  if (error) throw error
  return (data?.length ?? 0) > 0
}
