import { supabase } from '../config/supabaseClient.js'

/**
 * finances.fournisseur — référentiel fournisseurs, rattaché à un SERVICE.
 * Voir ForClaude/CDC/mld-phases-1-2.md §2.2.
 */

export interface Fournisseur {
  id_fournisseur: number
  id_service: number
  etatfournisseur: 'Actif' | 'Inactif'
  raison_sociale_pgi: string | null
  raison_sociale_service: string
  // Nullable depuis le 30/08/2026 (migration 20260830120000) — uniquement
  // pour TYPE_CREATION='PGI' (contrainte CHECK fournisseur_siren_pgi_check) :
  // le fichier d'import des marchés ne fournit aucun SIREN pour un
  // fournisseur auto-créé (variante OP3.1). Reste obligatoire pour une
  // création manuelle (TYPE_CREATION='SERVICE'), imposé applicativement
  // par createFournisseurSchema, pas ici.
  siren: string | null
  numpgi: string | null
  adr1: string | null
  adr2: string | null
  cp: string | null
  ville: string | null
  cedex: string | null
  type_creation: 'PGI' | 'SERVICE'
}

const SELECT_COLUMNS =
  'id_fournisseur, id_service, etatfournisseur, raison_sociale_pgi, raison_sociale_service, siren, numpgi, adr1, adr2, cp, ville, cedex, type_creation'

export async function findAll(idService?: number): Promise<Fournisseur[]> {
  let query = supabase
    .schema('finances')
    .from('fournisseur')
    .select(SELECT_COLUMNS)
    .order('raison_sociale_service', { ascending: true })
  if (idService !== undefined) query = query.eq('id_service', idService)
  const { data, error } = await query
  if (error) throw error
  return data ?? []
}

export async function findById(idFournisseur: number): Promise<Fournisseur | null> {
  const { data, error } = await supabase
    .schema('finances')
    .from('fournisseur')
    .select(SELECT_COLUMNS)
    .eq('id_fournisseur', idFournisseur)
    .maybeSingle()
  if (error) throw error
  return data
}

/** Résout le fournisseur PGI (NUMPGI = NUM_TITULAIRE) d'un service — voir OP3.1, « variante import marchés ». */
export async function findByNumpgi(idService: number, numpgi: string): Promise<Fournisseur | null> {
  const { data, error } = await supabase
    .schema('finances')
    .from('fournisseur')
    .select(SELECT_COLUMNS)
    .eq('id_service', idService)
    .eq('numpgi', numpgi)
    .maybeSingle()
  if (error) throw error
  return data
}

export async function create(input: Omit<Fournisseur, 'id_fournisseur'>): Promise<Fournisseur> {
  const { data, error } = await supabase.schema('finances').from('fournisseur').insert(input).select().single()
  if (error) throw error
  return data
}

export async function update(
  idFournisseur: number,
  input: Partial<Omit<Fournisseur, 'id_fournisseur' | 'id_service' | 'type_creation'>>,
): Promise<Fournisseur> {
  const { data, error } = await supabase
    .schema('finances')
    .from('fournisseur')
    .update(input)
    .eq('id_fournisseur', idFournisseur)
    .select()
    .single()
  if (error) throw error
  return data
}

/**
 * Suppression physique — exception au principe général de ce référentiel
 * (ETATFOURNISSEUR sert normalement d'archivage). Autorisée uniquement si
 * aucun MARCHE/DEMANDE_ACHAT/DEVIS_CONSULTE ne référence ce fournisseur,
 * vérifié en amont par fournisseur.service.ts#deleteFournisseur — cette
 * fonction ne fait que l'opération, pas la vérification.
 */
export async function remove(idFournisseur: number): Promise<void> {
  const { error, data } = await supabase
    .schema('finances')
    .from('fournisseur')
    .delete()
    .eq('id_fournisseur', idFournisseur)
    .select('id_fournisseur')
  if (error) throw error
  if ((data?.length ?? 0) === 0) throw new Error('Fournisseur introuvable.')
}
