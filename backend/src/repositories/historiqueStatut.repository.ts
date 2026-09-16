import { supabase } from '../config/supabaseClient.js'

/**
 * finances.historique_statut — traçabilité des changements de statut d'une
 * DEMANDE_ACHAT (ForClaude/CDC/mld-phases-1-2.md §2.5). La toute première
 * ligne (DA_EN_PREPARATION) est posée par la fonction Postgres
 * `creer_demande_achat_brouillon` elle-même (migration 20260907170000), pas
 * par ce repository. Toutes les transitions suivantes (OP1.2 à OP1.6) passent
 * par `create()` ci-dessous — jamais par un `UPDATE demande_achat.code_statut`
 * direct, révoqué en base pour `service_role` (migration 20260914130000) :
 * le trigger `trg_sync_statut_courant` recopie automatiquement `code_statut`
 * depuis la ligne insérée ici. `historique_statut` lui-même est immuable en
 * écriture (`UPDATE` révoqué, migration 20260914160000) — seul `DELETE`
 * reste possible, réservé à la cascade de suppression d'un brouillon.
 */

export interface HistoriqueStatut {
  id_histo: number
  id_demande_achat: number
  code_statut: string
  matricule_acteur: string
  id_suppleance: number | null
  date_heure: string
  // Colonne renommée depuis commentaire_motif le 14/09/2026 (migration 20260914110000).
  commentaire_statut: string | null
}

export interface CreateHistoriqueStatutInput {
  id_demande_achat: number
  code_statut: string
  matricule_acteur: string
  id_suppleance: number | null
  commentaire_statut: string | null
}

const SELECT_COLUMNS = 'id_histo, id_demande_achat, code_statut, matricule_acteur, id_suppleance, date_heure, commentaire_statut'

/**
 * Seul point d'écriture d'un changement de statut — voir le commentaire d'en-tête.
 *
 * Bug corrigé le 15/09/2026 (signalé par l'utilisateur, erreur 500 à la
 * transmission d'une DA) : DATE_HEURE n'a **aucun défaut en base** (contrainte
 * NOT NULL sans DEFAULT) — la fonction Postgres `creer_demande_achat_brouillon`
 * le fournit explicitement (`now()`) pour la toute première ligne
 * (DA_EN_PREPARATION), mais ce repository ne l'a jamais fait pour toutes les
 * transitions suivantes (OP1.2 à OP1.6), jamais détecté car les tests backend
 * mockent entièrement ce repository (jamais de vraie requête SQL).
 */
export async function create(input: CreateHistoriqueStatutInput): Promise<HistoriqueStatut> {
  const { data, error } = await supabase
    .schema('finances')
    .from('historique_statut')
    .insert({ ...input, date_heure: new Date().toISOString() })
    .select(SELECT_COLUMNS)
    .single()
  if (error) throw error
  return data
}

/** Chronologique croissant — modale « Historique des statuts » (écran d'accueil). */
export async function findAllByDemandeAchat(idDemandeAchat: number): Promise<HistoriqueStatut[]> {
  const { data, error } = await supabase
    .schema('finances')
    .from('historique_statut')
    .select(SELECT_COLUMNS)
    .eq('id_demande_achat', idDemandeAchat)
    .order('date_heure', { ascending: true })
  if (error) throw error
  return data ?? []
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
