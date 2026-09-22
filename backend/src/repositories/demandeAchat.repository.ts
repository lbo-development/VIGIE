import { supabase } from '../config/supabaseClient.js'

/**
 * finances.demande_achat — cœur du module DA/FAD (ForClaude/CDC/mcd-phases-1-2.md,
 * mld-phases-1-2.md §2.4). ID_DEMANDE_ACHAT est la clé technique (décision du
 * 07/09/2026, migration 20260907130000) ; NUMERO n'est unique que par
 * ID_SERVICE (UNIQUE(ID_SERVICE, NUMERO)), plus globalement.
 *
 * Création progressive (décision du 07/09/2026, migration 20260907160000/
 * 20260907170000) : le brouillon est créé immédiatement via la fonction
 * Postgres `creer_demande_achat_brouillon` (alloue NUMERO sans collision,
 * pose le premier HISTORIQUE_STATUT) — pas de logique métier ici, voir
 * demandeAchat.service.ts pour la résolution du demandeur cible/ID_SERVICE
 * et les règles d'autorisation.
 */

export type ProcedureAchat = 'MARCHE' | 'HORS_MARCHE'
export type ImputationComptable = 'FONCTIONNEMENT' | 'INVESTISSEMENT'
export type TypeAchat = 'TRAVAUX' | 'FOURNITURES' | 'SERVICES'
export type TypeFad = 'CONTRAT' | 'OUVERTE' | 'FERMEE'
export type MotifChoix = 'Prix' | 'Délai' | 'Technique' | 'Autre'

export interface DemandeAchat {
  id_demande_achat: number
  numero: string
  id_service: number
  /** Formulation d'origine du demandeur (OP1.1) — jamais modifiée après transmission au RC (décision du 15/09/2026). */
  objet_demandeur: string
  description_demandeur: string | null
  /** Reformulation du RC (OP1.2b) — synchronisée sur *_demandeur tant que la DA reste éditable par le demandeur (STATUTS_MODIFIABLES), fait foi ensuite partout ailleurs dans l'application. */
  objet_rc: string
  description_rc: string | null
  montant_demande: number
  imputation_comptable: ImputationComptable | null
  procedure_achat: ProcedureAchat
  type_achat: TypeAchat | null
  type_fad: TypeFad | null
  motif_choix: MotifChoix | null
  libelle_motif_choix: string | null
  montant_retenu: number | null
  montant_commande: number | null
  /** Posée une seule fois par demandeAchat.service.ts#transmettreDsOuSeuil (exemption automatique sous le seuil de validation DS, décision du 18/09/2026) — jamais réinitialisée ensuite. */
  validee_sur_seuil_ds: boolean
  date_creation: string
  matricule_demandeur: string
  code_site: string | null
  code_sous_site: string | null
  code_secteur: string | null
  code_sous_secteur: string | null
  code_cug: string | null
  numero_operation: string | null
  nummarche: string | null
  id_marche_tiers: number | null
  id_fournisseur_retenu: number | null
  code_statut: string
  created_at: string
  updated_at: string
}

const SELECT_COLUMNS =
  'id_demande_achat, numero, id_service, objet_demandeur, description_demandeur, objet_rc, description_rc, montant_demande, imputation_comptable, procedure_achat, type_achat, type_fad, motif_choix, libelle_motif_choix, montant_retenu, montant_commande, validee_sur_seuil_ds, date_creation, matricule_demandeur, code_site, code_sous_site, code_secteur, code_sous_secteur, code_cug, numero_operation, nummarche, id_marche_tiers, id_fournisseur_retenu, code_statut, created_at, updated_at'

/** Crée le brouillon (NUMERO alloué, DA_EN_PREPARATION, historique posé) — voir la fonction Postgres pour le détail. */
export async function createBrouillon(idService: number, matriculeDemandeur: string): Promise<DemandeAchat> {
  const { data, error } = await supabase
    .schema('finances')
    .rpc('creer_demande_achat_brouillon', { p_id_service: idService, p_matricule_demandeur: matriculeDemandeur })
    .single()
  if (error) throw error
  return data as DemandeAchat
}

export async function findById(idDemandeAchat: number): Promise<DemandeAchat | null> {
  const { data, error } = await supabase
    .schema('finances')
    .from('demande_achat')
    .select(SELECT_COLUMNS)
    .eq('id_demande_achat', idDemandeAchat)
    .maybeSingle()
  if (error) throw error
  return data as DemandeAchat | null
}

export interface ListFilters {
  idService?: number
  /** Liste de services (écran de suivi DS, décision du 22/09/2026) — périmètre DS = une direction, potentiellement plusieurs services, contrairement à `idService` (RC/CDS/CB/ADMIN_SERVICE, un seul service). Voir demandeAchat.service.ts#listDemandeAchat. */
  idServiceIn?: number[]
  matriculeDemandeurIn?: string[]
  statuts?: string[]
  search?: string
  /** Résultat de fournisseur.repository.ts#findIdsByRaisonSociale pour `search` — voir demandeAchat.service.ts#listDemandeAchat. */
  idFournisseurIn?: number[]
  /** Filtre "Fournisseurs" de l'écran d'accueil (onglets 2/3/4, chantier du 15/09/2026) — correspondance exacte, distinct de la recherche texte idFournisseurIn ci-dessus. */
  idFournisseurRetenu?: number
}

export async function findAll(filters: ListFilters): Promise<DemandeAchat[]> {
  let query = supabase.schema('finances').from('demande_achat').select(SELECT_COLUMNS).order('created_at', { ascending: false })

  if (filters.idService !== undefined) query = query.eq('id_service', filters.idService)
  if (filters.idServiceIn) query = query.in('id_service', filters.idServiceIn)
  if (filters.matriculeDemandeurIn) query = query.in('matricule_demandeur', filters.matriculeDemandeurIn)
  if (filters.statuts && filters.statuts.length > 0) query = query.in('code_statut', filters.statuts)
  if (filters.idFournisseurRetenu !== undefined) query = query.eq('id_fournisseur_retenu', filters.idFournisseurRetenu)
  if (filters.search) {
    // OBJET_DEMANDEUR/OBJET_RC (colonne OBJET renommée/scindée par la migration
    // 20260915120000_demande_achat_double_objet_description.sql) — cette clause référençait
    // encore l'ancien nom de colonne (OBJET, inexistant depuis), faisant échouer toute recherche
    // texte non vide (PostgREST renvoie une erreur, "Impossible de charger les demandes d'achat."
    // côté frontend). Cherche sur les deux formulations : la reformulation RC fait foi une fois la
    // FAD constituée, mais la formulation d'origine du demandeur reste recherchable aussi.
    const orClauses = [
      `numero.ilike.%${filters.search}%`,
      `objet_demandeur.ilike.%${filters.search}%`,
      `objet_rc.ilike.%${filters.search}%`,
    ]
    if (filters.idFournisseurIn && filters.idFournisseurIn.length > 0) {
      orClauses.push(`id_fournisseur_retenu.in.(${filters.idFournisseurIn.join(',')})`)
    }
    query = query.or(orClauses.join(','))
  }

  const { data, error } = await query
  if (error) throw error
  return (data ?? []) as DemandeAchat[]
}

export interface DemandeAchatUpdate {
  objet_demandeur?: string
  description_demandeur?: string | null
  objet_rc?: string
  description_rc?: string | null
  montant_demande?: number
  procedure_achat?: ProcedureAchat
  imputation_comptable?: ImputationComptable | null
  type_achat?: TypeAchat | null
  numero_operation?: string | null
  code_site?: string | null
  code_sous_site?: string | null
  code_secteur?: string | null
  code_sous_secteur?: string | null
  code_cug?: string | null
  nummarche?: string | null
  id_marche_tiers?: number | null
  id_fournisseur_retenu?: number | null
  motif_choix?: MotifChoix | null
  libelle_motif_choix?: string | null
  type_fad?: TypeFad | null
  montant_commande?: number
  validee_sur_seuil_ds?: boolean
}

export async function update(idDemandeAchat: number, input: DemandeAchatUpdate): Promise<DemandeAchat> {
  const { data, error } = await supabase
    .schema('finances')
    .from('demande_achat')
    .update(input)
    .eq('id_demande_achat', idDemandeAchat)
    .select(SELECT_COLUMNS)
    .single()
  if (error) throw error
  return data as DemandeAchat
}

/**
 * Suppression physique de la seule ligne DEMANDE_ACHAT — l'appelant
 * (demandeAchat.service.ts#deleteDemandeAchat) doit avoir déjà supprimé
 * PIECE_JOINTE, DEVIS_CONSULTE et HISTORIQUE_STATUT au préalable (cascade
 * applicative, décision du 07/09/2026 — les FK restent ON DELETE RESTRICT,
 * voir ForClaude/CDC/mld-phases-1-2.md §4).
 */
export async function remove(idDemandeAchat: number): Promise<void> {
  const { error, data } = await supabase
    .schema('finances')
    .from('demande_achat')
    .delete()
    .eq('id_demande_achat', idDemandeAchat)
    .select('id_demande_achat')
  if (error) throw error
  if ((data?.length ?? 0) === 0) throw new Error('Demande d\'achat introuvable.')
}

/**
 * finances.demande_achat — pas de CRUD complet pour FOURNISSEUR/MARCHE_TIERS
 * dans ce backend (phase FAD/workflow). Garde-fous de suppression d'autres
 * entités référencées par une DA — voir fournisseur.service.ts#deleteFournisseur,
 * marcheTiers.service.ts#deleteMarcheTiers et ForClaude/CDC/mld-phases-1-2.md §2.2/§2.4.
 */
export async function existsForFournisseurRetenu(idFournisseur: number): Promise<boolean> {
  const { data, error } = await supabase
    .schema('finances')
    .from('demande_achat')
    .select('id_demande_achat')
    .eq('id_fournisseur_retenu', idFournisseur)
    .limit(1)
  if (error) throw error
  return (data?.length ?? 0) > 0
}

export async function existsForMarcheTiers(idMarcheTiers: number): Promise<boolean> {
  const { data, error } = await supabase
    .schema('finances')
    .from('demande_achat')
    .select('id_demande_achat')
    .eq('id_marche_tiers', idMarcheTiers)
    .limit(1)
  if (error) throw error
  return (data?.length ?? 0) > 0
}

/** Garde-fou de suppression d'un ACTEUR — voir acteur.service.ts#deleteActeur. */
export async function existsForMatriculeDemandeur(matricule: string): Promise<boolean> {
  const { data, error } = await supabase
    .schema('finances')
    .from('demande_achat')
    .select('id_demande_achat')
    .eq('matricule_demandeur', matricule)
    .limit(1)
  if (error) throw error
  return (data?.length ?? 0) > 0
}
