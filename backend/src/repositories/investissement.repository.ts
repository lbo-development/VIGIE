import { supabase } from '../config/supabaseClient.js'

/**
 * finances.operation_investissement — opérations d'investissement PGI, voir
 * investissementImport.service.ts et
 * ForClaude/importation-investissementsPGI/import-investissements-pgi.md.
 * Contrairement à finances.commande_pgi (annule et remplace), chaque import est un upsert par
 * NUMERO_OPERATION : une opération jamais réimportée reste en base — jamais de suppression
 * physique, ni de flag automatique : ACTIF est un champ manuel (décision du 04/09/2026, voir
 * `OperationInvestissementUpsert`), l'import n'a plus aucun moyen de le modifier après création.
 */

export interface OperationInvestissement {
  numero_operation: string
  libelle: string
  /** Libellé propre au service, distinct de `libelle` (PGI) — voir `OperationInvestissementUpsert`. */
  libelle_service: string
  id_service: number
  code_cug: string
  statut: 'A' | 'F'
  /** Champ manuel (décision du 04/09/2026) — l'import ne le fixe qu'à la création (défaut de colonne `true`), jamais réécrit ensuite. Voir `OperationInvestissementUpsert`. */
  actif: boolean
  /** Champ manuel, distinct d'`actif` — pas de second critère documenté (pas de COMPLETUDE comme finances.marche), voir `OperationInvestissementUpsert`. */
  utilisable: boolean
  mt_initial: number
  mt_travaux: number
  /** Colonne générée Postgres (`mt_initial - mt_travaux`) — voir `OperationInvestissementUpsert`. */
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
 * Charge upsertée par l'import — exclut délibérément :
 * - `libelle_service` : à la création, un trigger BEFORE INSERT (migration
 *   20260904120000_operation_investissement_libelle_service.sql) la calcule depuis `libelle`
 *   amputé du préfixe `numero_operation` s'il y figure (sinon `libelle` tel quel) ; à la mise à
 *   jour, l'absence de `libelle_service` dans la charge fait que la clause
 *   `ON CONFLICT ... DO UPDATE SET` générée par PostgREST ne la touche jamais — modifiable par
 *   ailleurs (hors import), jamais écrasée par un import suivant.
 * - `mt_fesi` : colonne générée Postgres (`mt_initial - mt_travaux`, migration
 *   20260904100000_operation_investissement_mt_travaux_fesi.sql) — Postgres refuse toute valeur
 *   explicite sur une colonne générée, à l'INSERT comme à l'UPDATE.
 * - `utilisable` : champ manuel (migration 20260904110000_operation_investissement_utilisable.sql),
 *   même raisonnement que `libelle_service` — prend le défaut de colonne (`true`) à la création,
 *   jamais réécrit par un import suivant.
 * - `actif` : rendu manuel le 04/09/2026 (même raisonnement, défaut de colonne `true` à la
 *   création) — avant cette date, l'import le pilotait entièrement (`true` sur les opérations
 *   éligibles, `false` sur celles qui en sortaient, voir historique de
 *   investissementImport.service.ts) ; ce mécanisme d'inactivation automatique est abandonné,
 *   seule une modification manuelle (icône « Modifier ») change désormais ce champ.
 */
export type OperationInvestissementUpsert = Omit<OperationInvestissement, 'libelle_service' | 'mt_fesi' | 'utilisable' | 'actif'>

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

export async function upsertMany(rows: OperationInvestissementUpsert[]): Promise<void> {
  if (rows.length === 0) return
  const { error } = await supabase
    .schema('finances')
    .from('operation_investissement')
    .upsert(rows, { onConflict: 'numero_operation' })
  if (error) throw error
}
