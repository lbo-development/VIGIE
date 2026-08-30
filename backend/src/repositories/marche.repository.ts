import { supabase } from '../config/supabaseClient.js'

/**
 * finances.marche — pas de CRUD dans ce backend (phase Import PGI / MARCHE
 * pas encore implémentée). Ce fichier n'existe que pour vérifier, avant
 * suppression d'un FOURNISSEUR, qu'aucun marché ne le référence encore — voir
 * fournisseur.service.ts#deleteFournisseur et
 * ForClaude/CDC/mld-phases-1-2.md §2.2/§2.4.
 */
export async function existsForFournisseur(idFournisseur: number): Promise<boolean> {
  const { data, error } = await supabase
    .schema('finances')
    .from('marche')
    .select('nummarche')
    .eq('id_fournisseur', idFournisseur)
    .limit(1)
  if (error) throw error
  return (data?.length ?? 0) > 0
}
