import { supabase } from '../config/supabaseClient.js'

/**
 * finances.operation_investissement — opérations d'investissement PGI, voir
 * investissementImport.service.ts et
 * ForClaude/importation-investissementsPGI/import-investissements-pgi.md.
 * Contrairement à finances.commande_pgi (annule et remplace), chaque import est un upsert par
 * NUMERO_OPERATION : une opération jamais réimportée reste en base — jamais de suppression
 * physique. ACTIF et UTILISABLE sont repilotés par STATUT à chaque import (décision du
 * 17/09/2026, revient sur celle du 04/09/2026 qui les rendait purement manuels) — voir le détail
 * des règles sur `OperationInvestissementUpsertComplet`/`OperationInvestissementUpsertActifSeul`
 * et investissementImport.service.ts#confirm.
 */

export interface OperationInvestissement {
  numero_operation: string
  libelle: string
  /** Libellé propre au service, distinct de `libelle` (PGI) — voir `OperationInvestissementUpsertBase`. */
  libelle_service: string
  id_service: number
  code_cug: string
  statut: 'A' | 'F'
  /** Repiloté par l'import selon STATUT (décision du 17/09/2026) — voir `OperationInvestissementUpsertComplet`/`OperationInvestissementUpsertActifSeul`. Reste modifiable manuellement (icône « Modifier »), mais un réimport ultérieur peut écraser cette valeur (statut F, ou statut A sur une opération nouvellement créée/sortant de F). */
  actif: boolean
  /** Distinct d'`actif` — pas de second critère documenté (pas de COMPLETUDE comme finances.marche). Forcé par l'import à FAUX sur statut F et à VRAI sur une création/sortie de F, mais **jamais retouché** par l'import tant que l'opération reste au statut A d'un import à l'autre (modification manuelle alors préservée) — voir `OperationInvestissementUpsertComplet`/`OperationInvestissementUpsertActifSeul`. */
  utilisable: boolean
  mt_initial: number
  mt_travaux: number
  /** Colonne générée Postgres (`mt_initial - mt_travaux`) — voir `OperationInvestissementUpsertBase`. */
  mt_fesi: number
  mt_budget_ap1: number
  mt_engage_ap1: number
  mt_liquide_ap1: number
  mt_solde_ap1: number
  mt_budget_ap8: number
  mt_engage_ap8: number
  mt_liquide_ap8: number
  mt_solde_ap8: number
  mt_budget_cp1: number
  mt_engage_cp1: number
  mt_liquide_cp1: number
  mt_solde_cp1: number
  mt_budget_cp8: number
  mt_engage_cp8: number
  mt_liquide_cp8: number
  mt_solde_cp8: number
}

/**
 * Charge de base upsertée par l'import — exclut toujours :
 * - `libelle_service` : à la création, un trigger BEFORE INSERT (migration
 *   20260904120000_operation_investissement_libelle_service.sql) la calcule depuis `libelle`
 *   amputé du préfixe `numero_operation` s'il y figure (sinon `libelle` tel quel) ; à la mise à
 *   jour, l'absence de `libelle_service` dans la charge fait que la clause
 *   `ON CONFLICT ... DO UPDATE SET` générée par PostgREST ne la touche jamais — modifiable par
 *   ailleurs (hors import), jamais écrasée par un import suivant.
 * - `mt_fesi` : colonne générée Postgres (`mt_initial - mt_travaux`, migration
 *   20260904100000_operation_investissement_mt_travaux_fesi.sql) — Postgres refuse toute valeur
 *   explicite sur une colonne générée, à l'INSERT comme à l'UPDATE.
 *
 * `actif`/`utilisable` sont ajoutés à cette base par l'un des deux types ci-dessous selon le cas
 * (voir investissementImport.service.ts#confirm pour la règle de choix, décision du 17/09/2026) —
 * jamais les deux formes dans un même lot passé à `upsertMany` : PostgREST dérive les colonnes de
 * la clause `ON CONFLICT ... DO UPDATE SET` de l'ensemble des clés présentes dans le lot, un lot
 * hétérogène écraserait `utilisable` à NULL sur les lignes qui ne le portent pas.
 */
export type OperationInvestissementUpsertBase = Omit<OperationInvestissement, 'libelle_service' | 'mt_fesi' | 'utilisable' | 'actif'>

/**
 * Statut F (toujours), ou statut A sur une opération inconnue en base ou dont le statut
 * précédent était F (création ou sortie de F) — `actif` et `utilisable` forcés ensemble
 * (respectivement `false`/`false` ou `true`/`true`).
 */
export type OperationInvestissementUpsertComplet = OperationInvestissementUpsertBase & { actif: boolean; utilisable: boolean }

/**
 * Statut A sur une opération déjà en base dont le statut précédent était déjà A — seul `actif`
 * est forcé à `true` ; `utilisable` est délibérément absent de la charge pour ne jamais écraser
 * une valeur modifiée manuellement (icône « Modifier ») tant que l'opération reste active d'un
 * import à l'autre.
 */
export type OperationInvestissementUpsertActifSeul = OperationInvestissementUpsertBase & { actif: boolean }

export async function findByNumeroOperation(numeroOperation: string): Promise<OperationInvestissement | null> {
  const { data, error } = await supabase
    .schema('finances')
    .from('operation_investissement')
    .select('*')
    .eq('numero_operation', numeroOperation)
    .maybeSingle()
  if (error) throw error
  return data
}

export interface ManagedFields {
  libelleService: string
  actif: boolean
  utilisable: boolean
}

/** Modification manuelle des seuls champs éditables hors import — icône « Modifier » des cartes d'InvestissementsPGI.tsx. */
export async function updateManagedFields(numeroOperation: string, fields: ManagedFields): Promise<OperationInvestissement> {
  const { data, error } = await supabase
    .schema('finances')
    .from('operation_investissement')
    .update({ libelle_service: fields.libelleService, actif: fields.actif, utilisable: fields.utilisable })
    .eq('numero_operation', numeroOperation)
    .select()
    .single()
  if (error) throw error
  return data
}

export async function findAll(idService: number): Promise<OperationInvestissement[]> {
  const { data, error } = await supabase
    .schema('finances')
    .from('operation_investissement')
    .select('*')
    .eq('id_service', idService)
    .order('numero_operation', { ascending: true })
  if (error) throw error
  return data ?? []
}

export async function upsertMany<T extends OperationInvestissementUpsertBase>(rows: T[]): Promise<void> {
  if (rows.length === 0) return
  const { error } = await supabase
    .schema('finances')
    .from('operation_investissement')
    .upsert(rows, { onConflict: 'numero_operation' })
  if (error) throw error
}
