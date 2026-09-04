import { supabase } from '../config/supabaseClient.js'

/**
 * finances.investissement_piece — pièces documentaires d'une opération d'investissement, voir
 * migration 20260904130000_create_investissement_piece.sql. Simplifié par rapport à
 * finances.marche_piece : une seule référence NUMERO_OPERATION (pas de discriminant de type
 * SERVICE/TIERS, une opération d'investissement n'a qu'une seule forme).
 *
 * ID_SERVICE est stampé une seule fois à l'insertion (jamais réécrit) : le service d'une
 * opération d'investissement est immuable après création (voir investissement.service.ts) — sert
 * uniquement au scoping RLS (investissement_piece_select_scoped), pas relu applicativement.
 */

export type TypePiece =
  | 'RAPPORT_CODIR'
  | 'RAPPORT_CODIR_VALIDE'
  | 'RAPPORT_CODIR_ANNEXES'
  | 'RAPPORT_CODIR_PLANS'
  | 'DECISION_DIRECTOIRE'
  | 'DECISION_DIRECTOIRE_ANNEXES'
  | 'DECISION_DIRECTOIRE_PLANS'
  | 'RAPPORT_CS'
  | 'RAPPORT_CS_VALIDE'
  | 'RAPPORT_CS_DOE'
  | 'RAPPORT_CS_ANNEXES'
  | 'RAPPORT_CS_PLANS'
  | 'DECISION_CS'
  | 'FICHE_OUVERTURE_HO_VALIDEE'
  | 'PROJET_TECHNIQUE'
  | 'AUTRE'

const BUCKET = 'investissement-pieces'

export interface InvestissementPiece {
  id_investissement_piece: number
  numero_operation: string
  id_service: number
  type_piece: TypePiece
  numero_reevaluation: number
  nom_fichier_original: string
  storage_path: string
  taille_octets: number
  matricule_depot: string
  created_at: string
  updated_at: string
}

const SELECT_COLUMNS =
  'id_investissement_piece, numero_operation, id_service, type_piece, numero_reevaluation, nom_fichier_original, storage_path, taille_octets, matricule_depot, created_at, updated_at'

export async function findAllByOperation(numeroOperation: string): Promise<InvestissementPiece[]> {
  const { data, error } = await supabase
    .schema('finances')
    .from('investissement_piece')
    .select(SELECT_COLUMNS)
    .eq('numero_operation', numeroOperation)
    .order('numero_reevaluation', { ascending: true })
    .order('type_piece', { ascending: true })
  if (error) throw error
  return data ?? []
}

export async function findById(idInvestissementPiece: number): Promise<InvestissementPiece | null> {
  const { data, error } = await supabase
    .schema('finances')
    .from('investissement_piece')
    .select(SELECT_COLUMNS)
    .eq('id_investissement_piece', idInvestissementPiece)
    .maybeSingle()
  if (error) throw error
  return data
}

export async function create(
  input: Omit<InvestissementPiece, 'id_investissement_piece' | 'created_at' | 'updated_at'>,
): Promise<InvestissementPiece> {
  const { data, error } = await supabase
    .schema('finances')
    .from('investissement_piece')
    .insert(input)
    .select(SELECT_COLUMNS)
    .single()
  if (error) throw error
  return data
}

export async function updateMetadata(
  idInvestissementPiece: number,
  input: Partial<Pick<InvestissementPiece, 'type_piece' | 'numero_reevaluation'>>,
): Promise<InvestissementPiece> {
  const { data, error } = await supabase
    .schema('finances')
    .from('investissement_piece')
    .update(input)
    .eq('id_investissement_piece', idInvestissementPiece)
    .select(SELECT_COLUMNS)
    .single()
  if (error) throw error
  return data
}

/** Suppression physique — filet de sécurité si aucune ligne ne correspond (même principe que marchePiece.repository.ts#remove). */
export async function remove(idInvestissementPiece: number): Promise<void> {
  const { error, data } = await supabase
    .schema('finances')
    .from('investissement_piece')
    .delete()
    .eq('id_investissement_piece', idInvestissementPiece)
    .select('id_investissement_piece')
  if (error) throw error
  if ((data?.length ?? 0) === 0) throw new Error("Pièce d'investissement introuvable.")
}

/** I/O brute vers le bucket investissement-pieces — aucune logique métier ici, voir investissementPiece.service.ts. */
export async function uploadFile(path: string, buffer: Buffer): Promise<void> {
  const { error } = await supabase.storage.from(BUCKET).upload(path, buffer, { contentType: 'application/pdf' })
  if (error) throw error
}

export async function downloadFile(path: string): Promise<Buffer> {
  const { data, error } = await supabase.storage.from(BUCKET).download(path)
  if (error) throw error
  return Buffer.from(await data.arrayBuffer())
}

export async function removeFile(path: string): Promise<void> {
  const { error } = await supabase.storage.from(BUCKET).remove([path])
  if (error) throw error
}
