import { supabase } from '../config/supabaseClient.js'

/**
 * finances.certificat_service_fait — cœur du module CSF (Phase 2, voir
 * ForClaude/CDC/mcd-phases-1-2.md §3-§6, mld-phases-1-2.md §3). ID_CSF est la
 * clé technique (décision du 24/09/2026, migration 20260924100000) ;
 * NUMERO_CSF (NUMERO de la FAD + suffixe -Cnn) n'est unique que par
 * ID_DEMANDE_ACHAT, plus globalement.
 *
 * Création progressive (décision du 24/09/2026, même modèle que la DA) : le
 * brouillon (CSF_EN_PREPARATION) est créé immédiatement via la fonction
 * Postgres `creer_csf_brouillon` (alloue NUMERO_CSF sans collision, pose le
 * premier HISTORIQUE_STATUT_CSF) — aucune règle métier ici, voir
 * certificatServiceFait.service.ts pour R1 (FAD_COMMANDEE) et l'éligibilité
 * du rédacteur.
 */

export interface CertificatServiceFait {
  id_csf: number
  numero_csf: string
  id_demande_achat: number
  matricule_redacteur: string
  date_creation: string
  date_service_fait: string | null
  montant_csf: number | null
  description: string | null
  code_statut_csf: string
  created_at: string
  updated_at: string
}

const SELECT_COLUMNS =
  'id_csf, numero_csf, id_demande_achat, matricule_redacteur, date_creation, date_service_fait, montant_csf, description, code_statut_csf, created_at, updated_at'

/** Crée le brouillon (NUMERO_CSF alloué, CSF_EN_PREPARATION, historique posé) — voir la fonction Postgres pour le détail. */
export async function createBrouillon(idDemandeAchat: number, matriculeRedacteur: string): Promise<CertificatServiceFait> {
  const { data, error } = await supabase
    .schema('finances')
    .rpc('creer_csf_brouillon', { p_id_demande_achat: idDemandeAchat, p_matricule_redacteur: matriculeRedacteur })
    .single()
  if (error) throw error
  return data as CertificatServiceFait
}

export async function findById(idCsf: number): Promise<CertificatServiceFait | null> {
  const { data, error } = await supabase.schema('finances').from('certificat_service_fait').select(SELECT_COLUMNS).eq('id_csf', idCsf).maybeSingle()
  if (error) throw error
  return data as CertificatServiceFait | null
}

/** Tous les CSF d'une FAD, du plus récent au plus ancien — liste affichée sous la FAD. */
export async function findAllByDemandeAchat(idDemandeAchat: number): Promise<CertificatServiceFait[]> {
  const { data, error } = await supabase
    .schema('finances')
    .from('certificat_service_fait')
    .select(SELECT_COLUMNS)
    .eq('id_demande_achat', idDemandeAchat)
    .order('created_at', { ascending: false })
  if (error) throw error
  return (data ?? []) as CertificatServiceFait[]
}

export interface ListFilters {
  matriculeRedacteur?: string
  statuts?: string[]
}

/** Files RC/CB (écran de suivi CSF) — pas de filtre par service/cellule ici : le périmètre est déjà appliqué par le service (résolution des FAD accessibles avant appel). */
export async function findAllByDemandeAchatIn(idDemandeAchatIn: number[], filters: ListFilters = {}): Promise<CertificatServiceFait[]> {
  if (idDemandeAchatIn.length === 0) return []
  let query = supabase
    .schema('finances')
    .from('certificat_service_fait')
    .select(SELECT_COLUMNS)
    .in('id_demande_achat', idDemandeAchatIn)
    .order('created_at', { ascending: false })
  if (filters.matriculeRedacteur) query = query.eq('matricule_redacteur', filters.matriculeRedacteur)
  if (filters.statuts && filters.statuts.length > 0) query = query.in('code_statut_csf', filters.statuts)
  const { data, error } = await query
  if (error) throw error
  return (data ?? []) as CertificatServiceFait[]
}

export interface CertificatServiceFaitUpdate {
  date_service_fait?: string | null
  montant_csf?: number | null
  description?: string | null
}

/** Édition des champs de contenu — jamais code_statut_csf ici (révoqué en base pour service_role, seul un INSERT dans historique_statut_csf le fait évoluer via le trigger). */
export async function update(idCsf: number, input: CertificatServiceFaitUpdate): Promise<CertificatServiceFait> {
  const { data, error } = await supabase
    .schema('finances')
    .from('certificat_service_fait')
    .update(input)
    .eq('id_csf', idCsf)
    .select(SELECT_COLUMNS)
    .single()
  if (error) throw error
  return data as CertificatServiceFait
}

/**
 * Suppression physique de la seule ligne CERTIFICAT_SERVICE_FAIT (R7) —
 * l'appelant (certificatServiceFait.service.ts#supprimer) doit avoir déjà
 * supprimé PIECE_JOINTE et HISTORIQUE_STATUT_CSF au préalable (cascade
 * applicative, les FK restent ON DELETE RESTRICT — voir
 * ForClaude/CDC/mld-phases-1-2.md §4).
 */
export async function remove(idCsf: number): Promise<void> {
  const { error, data } = await supabase.schema('finances').from('certificat_service_fait').delete().eq('id_csf', idCsf).select('id_csf')
  if (error) throw error
  if ((data?.length ?? 0) === 0) throw new Error('Certificat de service fait introuvable.')
}
