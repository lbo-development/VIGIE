import { supabase } from '../config/supabaseClient.js'

/**
 * finances.devis_consulte — pas de CRUD dans ce backend (phase FAD/workflow
 * pas encore implémentée). Ce fichier n'existe que pour vérifier, avant
 * suppression d'un FOURNISSEUR, qu'aucun devis consulté ne le référence
 * encore — même un devis non retenu (RETENU=false) bloque la suppression,
 * pas seulement le fournisseur retenu de la DA. Voir
 * fournisseur.service.ts#deleteFournisseur et
 * ForClaude/CDC/mld-phases-1-2.md §2.2/§2.4.
 */
export async function existsForFournisseur(idFournisseur: number): Promise<boolean> {
  const { data, error } = await supabase
    .schema('finances')
    .from('devis_consulte')
    .select('id_devis')
    .eq('id_fournisseur', idFournisseur)
    .limit(1)
  if (error) throw error
  return (data?.length ?? 0) > 0
}
