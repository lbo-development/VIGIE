import { supabase } from '../config/supabaseClient.js'

/**
 * Suppression en masse des DA/FAD d'un service (ADMIN_APP uniquement,
 * décision du 25/09/2026) — la suppression réelle est effectuée par la
 * fonction Postgres `finances.purger_da_fad_service` (migration
 * 20260925090000_purger_da_fad_service.sql), en une seule transaction. Ce
 * repository se limite à : compter les DA du service (aperçu avant
 * confirmation), lister les fichiers Storage à nettoyer AVANT l'appel RPC
 * (impossible de les retrouver après — la fonction aura déjà supprimé les
 * lignes), puis invoquer la fonction.
 */

export async function countByService(idService: number): Promise<number> {
  const { count, error } = await supabase
    .schema('finances')
    .from('demande_achat')
    .select('id_demande_achat', { count: 'exact', head: true })
    .eq('id_service', idService)
  if (error) throw error
  return count ?? 0
}

export interface StoragePaths {
  pieceJointePaths: string[]
  devisPaths: string[]
}

/** À appeler AVANT purgerViaRpc — voir le commentaire d'en-tête. */
export async function findStoragePathsByService(idService: number): Promise<StoragePaths> {
  const { data: das, error: dasError } = await supabase
    .schema('finances')
    .from('demande_achat')
    .select('id_demande_achat')
    .eq('id_service', idService)
  if (dasError) throw dasError
  const idsDemandeAchat = (das ?? []).map((d) => d.id_demande_achat as number)
  if (idsDemandeAchat.length === 0) return { pieceJointePaths: [], devisPaths: [] }

  const { data: csfRows, error: csfError } = await supabase
    .schema('finances')
    .from('certificat_service_fait')
    .select('id_csf')
    .in('id_demande_achat', idsDemandeAchat)
  if (csfError) throw csfError
  const idsCsf = (csfRows ?? []).map((c) => c.id_csf as number)

  // Pièces jointes rattachées directement à une DA, ou à un CSF de ces DA (jamais les deux —
  // voir CHECK chk_pj_rattachement_exclusif, ForClaude/CDC/mld-phases-1-2.md §4).
  const pieceJointeFilters = [`id_demande_achat.in.(${idsDemandeAchat.join(',')})`]
  if (idsCsf.length > 0) pieceJointeFilters.push(`id_csf.in.(${idsCsf.join(',')})`)
  const { data: pieces, error: piecesError } = await supabase
    .schema('finances')
    .from('piece_jointe')
    .select('storage_path')
    .or(pieceJointeFilters.join(','))
  if (piecesError) throw piecesError

  const { data: devis, error: devisError } = await supabase
    .schema('finances')
    .from('devis_consulte')
    .select('storage_path')
    .in('id_demande_achat', idsDemandeAchat)
    .not('storage_path', 'is', null)
  if (devisError) throw devisError

  return {
    pieceJointePaths: (pieces ?? []).map((p) => p.storage_path as string),
    devisPaths: (devis ?? []).map((d) => d.storage_path as string),
  }
}

/** Invoque finances.purger_da_fad_service — supprime réellement les lignes. Irréversible. */
export async function purgerViaRpc(idService: number): Promise<number> {
  const { data, error } = await supabase.schema('finances').rpc('purger_da_fad_service', { p_id_service: idService })
  if (error) throw error
  return data as number
}
