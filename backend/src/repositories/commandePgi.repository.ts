import { supabase } from '../config/supabaseClient.js'

/**
 * finances.commande_pgi — commandes PGI agrégées par NUMCMD, voir
 * commandePgiImport.service.ts et ForClaude/importation-commandePGI/. Import
 * "annule et remplace" par service : pas d'update/archive comme
 * marche.repository.ts, seulement suppression puis réinsertion complète.
 * `findAll` sert à la consultation (commandePgi.service.ts#listCommandesPgi,
 * CommandesPGI.tsx).
 */

export interface CommandePgi {
  numcmd: string
  code_cug: string
  id_service: number
  acheteur: string
  dtecmd: string
  compte_budgetaire: number | null
  catop: string | null
  libfournisseur: string
  /** Jamais null en base : "HM" (Hors Marché) quand la commande n'est rattachée à aucun marché. */
  marche: string
  mtactuel: number
  mtengage: number
  mtliquide: number
  dtelastimport: string
}

export async function findAll(idService: number): Promise<CommandePgi[]> {
  const { data, error } = await supabase
    .schema('finances')
    .from('commande_pgi')
    .select('*')
    .eq('id_service', idService)
    .order('numcmd', { ascending: true })
  if (error) throw error
  return data ?? []
}

export async function deleteByService(idService: number): Promise<void> {
  const { error } = await supabase.schema('finances').from('commande_pgi').delete().eq('id_service', idService)
  if (error) throw error
}

export async function insertMany(rows: CommandePgi[]): Promise<void> {
  if (rows.length === 0) return
  const { error } = await supabase.schema('finances').from('commande_pgi').insert(rows)
  if (error) throw error
}
