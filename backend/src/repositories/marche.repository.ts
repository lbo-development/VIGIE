import { supabase } from '../config/supabaseClient.js'

/**
 * finances.marche — voir ForClaude/CDC/mld-phases-1-2.md §2.2 et
 * ForClaude/Importation-marches/import-marches-pgi.md. Pas de colonne
 * id_service directe : le service d'un marché se résout via son CUG
 * (CODE_CUG → CUG.ID_SERVICE) — les requêtes « pour un service » passent donc
 * par une liste de codes CUG (voir marcheImport.service.ts), jamais par un
 * filtre direct ici.
 */

export interface Marche {
  nummarche: string
  actif: boolean
  type_creation: string
  typeproc: string
  typedecompoprix: string | null
  naturepresta: string | null
  libpgi: string | null
  libelle_service: string | null
  titulaire: string | null
  num_titulaire: string | null
  titulaire_service: string | null
  agentgestion: string | null
  code_cug: string
  dtenotif: string | null
  dtevalid: string | null
  dtedebut: string | null
  dtefinmax: string | null
  mtmini: number
  mtmaxi: number | null
  alertemt: number
  alertedate: number
  lastmtrealise: number | null
  lastmtengage: number | null
  dtelastsolde: string | null
  dtelastimport: string | null
  planpreventionactif: string | null
  completude: boolean
  id_fournisseur: number | null
  /** Colonne générée Postgres — MTMAXI − (LASTMTREALISE + LASTMTENGAGE), jamais écrite. */
  mt_solde: number | null
  /** Colonne générée Postgres — ACTIF ET COMPLETUDE, jamais écrite. */
  utilisable: boolean
}

/** Colonnes réécrites à la modification (correspondance directe A-M du fichier, + DTELASTIMPORT) — voir import-marches-pgi.md §3. */
export type MarcheUpdateInput = Pick<
  Marche,
  | 'libpgi'
  | 'titulaire'
  | 'num_titulaire'
  | 'code_cug'
  | 'dtedebut'
  | 'dtefinmax'
  | 'dtenotif'
  | 'dtevalid'
  | 'mtmaxi'
  | 'lastmtengage'
  | 'lastmtrealise'
  | 'dtelastimport'
  | 'id_fournisseur'
> & { actif: true }

const SELECT_COLUMNS =
  'nummarche, actif, type_creation, typeproc, typedecompoprix, naturepresta, libpgi, libelle_service, titulaire, num_titulaire, titulaire_service, agentgestion, code_cug, dtenotif, dtevalid, dtedebut, dtefinmax, mtmini, mtmaxi, alertemt, alertedate, lastmtrealise, lastmtengage, dtelastsolde, dtelastimport, planpreventionactif, completude, id_fournisseur, mt_solde, utilisable'

/** Utilisé avant suppression d'un FOURNISSEUR — voir fournisseur.service.ts#deleteFournisseur. */
export async function existsForFournisseur(idFournisseur: number): Promise<boolean> {
  const { data, error } = await supabase
    .schema('finances')
    .from('marche')
    .select('nummarche')
    .eq('id_fournisseur', idFournisseur)
    .limit(1)
  if (error) throw error
  return (data?.length ?? 0) > 0
}

export async function findByNummarche(nummarche: string): Promise<Marche | null> {
  const { data, error } = await supabase
    .schema('finances')
    .from('marche')
    .select(SELECT_COLUMNS)
    .eq('nummarche', nummarche)
    .maybeSingle()
  if (error) throw error
  return data
}

/** Tous les marchés (actifs ou non) dont le CUG appartient à l'un des codes donnés — voir marcheImport.service.ts pour la résolution des CUG d'un service. */
export async function findByCugCodes(cugCodes: string[]): Promise<Marche[]> {
  if (cugCodes.length === 0) return []
  const { data, error } = await supabase.schema('finances').from('marche').select(SELECT_COLUMNS).in('code_cug', cugCodes)
  if (error) throw error
  return data ?? []
}

export async function create(input: Omit<Marche, 'completude' | 'mt_solde' | 'utilisable'>): Promise<Marche> {
  const { data, error } = await supabase
    .schema('finances')
    .from('marche')
    .insert({ ...input, completude: false })
    .select(SELECT_COLUMNS)
    .single()
  if (error) throw error
  return data
}

export async function update(nummarche: string, input: MarcheUpdateInput): Promise<Marche> {
  const { data, error } = await supabase
    .schema('finances')
    .from('marche')
    .update(input)
    .eq('nummarche', nummarche)
    .select(SELECT_COLUMNS)
    .single()
  if (error) throw error
  return data
}

/**
 * Archivage (jamais de suppression physique) : ACTIF=false pour les
 * NUMMARCHE donnés, restreint à TYPE_CREATION='PGI' — un marché créé
 * manuellement n'est jamais désactivé par un import (voir
 * import-marches-pgi.md §5 point 3).
 */
export async function archiveMany(nummarches: string[]): Promise<void> {
  if (nummarches.length === 0) return
  const { error } = await supabase
    .schema('finances')
    .from('marche')
    .update({ actif: false })
    .in('nummarche', nummarches)
    .eq('type_creation', 'PGI')
  if (error) throw error
}
