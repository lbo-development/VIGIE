import { supabase } from '../config/supabaseClient.js'

/**
 * finances.demande_achat — pas de CRUD dans ce backend (phase FAD/workflow
 * pas encore implémentée). Ce fichier n'existe que pour vérifier, avant
 * suppression d'un FOURNISSEUR, qu'aucune demande d'achat ne le retient
 * encore comme fournisseur retenu — voir
 * fournisseur.service.ts#deleteFournisseur et
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
