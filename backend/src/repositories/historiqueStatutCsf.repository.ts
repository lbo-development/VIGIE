import { supabase } from '../config/supabaseClient.js'

/**
 * finances.historique_statut_csf — traçabilité des changements de statut d'un
 * CERTIFICAT_SERVICE_FAIT (ForClaude/CDC/mld-phases-1-2.md §3). La toute
 * première ligne (CSF_EN_PREPARATION) est posée par la fonction Postgres
 * `creer_csf_brouillon` elle-même (migration 20260924130000), pas par ce
 * repository. Toutes les transitions suivantes (OP2.1 à OP2.4) passent par
 * `create()` ci-dessous — jamais par un `UPDATE certificat_service_fait.code_statut_csf`
 * direct, révoqué en base pour `service_role` (migration 20260924110000) :
 * le trigger `trg_sync_statut_courant_csf` recopie automatiquement
 * `code_statut_csf` depuis la ligne insérée ici. `historique_statut_csf`
 * lui-même est immuable en écriture (`UPDATE` révoqué, migration
 * 20260924140000) — seul `DELETE` reste possible, réservé à la cascade de
 * suppression physique d'un CSF (R7).
 */

export interface HistoriqueStatutCsf {
  id_histo_csf: number
  id_csf: number
  code_statut_csf: string
  matricule_acteur: string
  id_suppleance: number | null
  date_heure: string
  commentaire_statut: string | null
}

export interface CreateHistoriqueStatutCsfInput {
  id_csf: number
  code_statut_csf: string
  matricule_acteur: string
  id_suppleance: number | null
  commentaire_statut: string | null
}

const SELECT_COLUMNS = 'id_histo_csf, id_csf, code_statut_csf, matricule_acteur, id_suppleance, date_heure, commentaire_statut'

/** Seul point d'écriture d'un changement de statut CSF — voir le commentaire d'en-tête. DATE_HEURE n'a aucun défaut en base, fourni explicitement ici (même piège que historique_statut, corrigé le 15/09/2026 côté FAD — anticipé dès l'origine ici). */
export async function create(input: CreateHistoriqueStatutCsfInput): Promise<HistoriqueStatutCsf> {
  const { data, error } = await supabase
    .schema('finances')
    .from('historique_statut_csf')
    .insert({ ...input, date_heure: new Date().toISOString() })
    .select(SELECT_COLUMNS)
    .single()
  if (error) throw error
  return data as HistoriqueStatutCsf
}

/** Chronologique croissant — modale « Historique des statuts » du CSF. */
export async function findAllByCsf(idCsf: number): Promise<HistoriqueStatutCsf[]> {
  const { data, error } = await supabase
    .schema('finances')
    .from('historique_statut_csf')
    .select(SELECT_COLUMNS)
    .eq('id_csf', idCsf)
    .order('date_heure', { ascending: true })
  if (error) throw error
  return (data ?? []) as HistoriqueStatutCsf[]
}

/** Suppression en cascade applicative depuis certificatServiceFait.service.ts#supprimer (R7) — dernière étape avant la suppression du CSF lui-même. */
export async function deleteAllByCsf(idCsf: number): Promise<void> {
  const { error } = await supabase.schema('finances').from('historique_statut_csf').delete().eq('id_csf', idCsf)
  if (error) throw error
}

/** Garde-fou de suppression d'un ACTEUR — voir acteur.service.ts#deleteActeur. */
export async function existsForMatriculeActeur(matricule: string): Promise<boolean> {
  const { data, error } = await supabase
    .schema('finances')
    .from('historique_statut_csf')
    .select('id_histo_csf')
    .eq('matricule_acteur', matricule)
    .limit(1)
  if (error) throw error
  return (data?.length ?? 0) > 0
}
