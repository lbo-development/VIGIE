import { supabase } from '../config/supabaseClient.js'

/**
 * finances.historique_statut — traçabilité des changements de statut d'une
 * DEMANDE_ACHAT (ForClaude/CDC/mld-phases-1-2.md §2.5). La toute première
 * ligne (DA_EN_PREPARATION) est posée par la fonction Postgres
 * `creer_demande_achat_brouillon` elle-même (migration 20260907170000), pas
 * par ce repository — pas de CRUD complet ici tant que les transitions de
 * statut (OP1.2 et suivants) ne sont pas implémentées.
 */

export interface HistoriqueStatut {
  id_histo: number
  id_demande_achat: number
  code_statut: string
  matricule_acteur: string
  id_suppleance: number | null
  date_heure: string
  commentaire_motif: string | null
}

/**
 * Suppression en cascade applicative depuis demandeAchat.service.ts#deleteDemandeAchat
 * (DA_EN_PREPARATION uniquement) — dernière étape avant la suppression de la
 * DEMANDE_ACHAT elle-même (voir MLD §4).
 */
export async function deleteAllByDemandeAchat(idDemandeAchat: number): Promise<void> {
  const { error } = await supabase.schema('finances').from('historique_statut').delete().eq('id_demande_achat', idDemandeAchat)
  if (error) throw error
}

/** Garde-fou de suppression d'un ACTEUR — voir acteur.service.ts#deleteActeur. */
export async function existsForMatriculeActeur(matricule: string): Promise<boolean> {
  const { data, error } = await supabase
    .schema('finances')
    .from('historique_statut')
    .select('id_histo')
    .eq('matricule_acteur', matricule)
    .limit(1)
  if (error) throw error
  return (data?.length ?? 0) > 0
}
