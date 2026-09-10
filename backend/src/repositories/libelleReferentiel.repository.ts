import { supabase } from '../config/supabaseClient.js'

/**
 * finances.libelle_referentiel — référentiel générique de listes de valeurs fixes,
 * administrable par ADMIN_APP (voir migration 20260905090000_create_libelle_referentiel.sql).
 * Une ligne = une valeur possible (CODE) pour un DOMAINE donné (ex. TYPE_PIECE_MARCHE / CCAP).
 */

export interface LibelleReferentiel {
  domaine: string
  code: string
  libelle: string
  ordre: number
  actif: boolean
}

const SELECT_COLUMNS = 'domaine, code, libelle, ordre, actif'

export async function findAllByDomaine(domaine: string): Promise<LibelleReferentiel[]> {
  const { data, error } = await supabase
    .schema('finances')
    .from('libelle_referentiel')
    .select(SELECT_COLUMNS)
    .eq('domaine', domaine)
    .order('ordre', { ascending: true })
  if (error) throw error
  return data ?? []
}

export async function findOne(domaine: string, code: string): Promise<LibelleReferentiel | null> {
  const { data, error } = await supabase
    .schema('finances')
    .from('libelle_referentiel')
    .select(SELECT_COLUMNS)
    .eq('domaine', domaine)
    .eq('code', code)
    .maybeSingle()
  if (error) throw error
  return data
}

export async function create(input: LibelleReferentiel): Promise<LibelleReferentiel> {
  const { data, error } = await supabase.schema('finances').from('libelle_referentiel').insert(input).select(SELECT_COLUMNS).single()
  if (error) throw error
  return data
}

export async function update(
  domaine: string,
  code: string,
  input: Partial<Pick<LibelleReferentiel, 'libelle' | 'ordre' | 'actif'>>,
): Promise<LibelleReferentiel> {
  const { data, error } = await supabase
    .schema('finances')
    .from('libelle_referentiel')
    .update(input)
    .eq('domaine', domaine)
    .eq('code', code)
    .select(SELECT_COLUMNS)
    .single()
  if (error) throw error
  return data
}

/** Suppression physique — bloquée nativement par la FK des tables clientes tant qu'un code est utilisé (voir libelleReferentiel.service.ts#isForeignKeyViolation). */
export async function remove(domaine: string, code: string): Promise<void> {
  const { error, data } = await supabase
    .schema('finances')
    .from('libelle_referentiel')
    .delete()
    .eq('domaine', domaine)
    .eq('code', code)
    .select('code')
  if (error) throw error
  if ((data?.length ?? 0) === 0) throw new Error('Valeur du référentiel introuvable.')
}

/** Réordonne les codes d'un même domaine (glisser-déposer côté écran) — même principe que secteur.repository.ts#reorder. */
export async function reorder(domaine: string, codes: string[]): Promise<void> {
  const results = await Promise.all(
    codes.map((code, index) =>
      supabase
        .schema('finances')
        .from('libelle_referentiel')
        .update({ ordre: index + 1 })
        .eq('domaine', domaine)
        .eq('code', code)
        .select('code'),
    ),
  )
  const failed = results.find((r) => r.error || (r.data?.length ?? 0) === 0)
  if (failed) throw failed.error ?? new Error('Valeur du référentiel introuvable pendant la réorganisation.')
}
