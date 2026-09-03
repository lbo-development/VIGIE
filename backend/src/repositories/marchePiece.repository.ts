import { supabase } from '../config/supabaseClient.js'

/**
 * finances.marche_piece — pièces documentaires (CCAP/CCTP/AE/AVENANT/BPU/AUTRE)
 * d'un marché service ou tiers, voir migration 20260902120000_create_marche_piece.sql.
 * TYPE_MARCHE discrimine laquelle de NUMMARCHE (SERVICE) / ID_MARCHE_TIERS (TIERS)
 * est renseignée — exactement une des deux, imposé par un CHECK en base.
 *
 * ID_SERVICE (migration 20260902130000) est stampé une seule fois à l'insertion
 * (jamais réécrit) : le service d'un marché/marché tiers est immuable après création
 * (voir marche.service.ts#updateMarcheManagedFields, marcheTiers.service.ts#updateMarcheTiers)
 * — sert uniquement au scoping RLS (marche_piece_select_scoped), pas relu applicativement.
 */

export type TypeMarchePiece = 'SERVICE' | 'TIERS'
export type TypePiece = 'CCAP' | 'CCTP' | 'AE' | 'AVENANT' | 'BPU' | 'AUTRE'

const BUCKET = 'marche-pieces'

export interface MarchePiece {
  id_marche_piece: number
  type_marche: TypeMarchePiece
  nummarche: string | null
  id_marche_tiers: number | null
  id_service: number
  type_piece: TypePiece
  numero_avenant: number
  nom_fichier_original: string
  storage_path: string
  taille_octets: number
  matricule_depot: string
  created_at: string
  updated_at: string
}

const SELECT_COLUMNS =
  'id_marche_piece, type_marche, nummarche, id_marche_tiers, id_service, type_piece, numero_avenant, nom_fichier_original, storage_path, taille_octets, matricule_depot, created_at, updated_at'

export async function findAllByService(nummarche: string): Promise<MarchePiece[]> {
  const { data, error } = await supabase
    .schema('finances')
    .from('marche_piece')
    .select(SELECT_COLUMNS)
    .eq('type_marche', 'SERVICE')
    .eq('nummarche', nummarche)
    .order('numero_avenant', { ascending: true })
    .order('type_piece', { ascending: true })
  if (error) throw error
  return data ?? []
}

export async function findAllByTiers(idMarcheTiers: number): Promise<MarchePiece[]> {
  const { data, error } = await supabase
    .schema('finances')
    .from('marche_piece')
    .select(SELECT_COLUMNS)
    .eq('type_marche', 'TIERS')
    .eq('id_marche_tiers', idMarcheTiers)
    .order('numero_avenant', { ascending: true })
    .order('type_piece', { ascending: true })
  if (error) throw error
  return data ?? []
}

export async function findById(idMarchePiece: number): Promise<MarchePiece | null> {
  const { data, error } = await supabase
    .schema('finances')
    .from('marche_piece')
    .select(SELECT_COLUMNS)
    .eq('id_marche_piece', idMarchePiece)
    .maybeSingle()
  if (error) throw error
  return data
}

export async function create(
  input: Omit<MarchePiece, 'id_marche_piece' | 'created_at' | 'updated_at'>,
): Promise<MarchePiece> {
  const { data, error } = await supabase.schema('finances').from('marche_piece').insert(input).select(SELECT_COLUMNS).single()
  if (error) throw error
  return data
}

export async function updateMetadata(
  idMarchePiece: number,
  input: Partial<Pick<MarchePiece, 'type_piece' | 'numero_avenant'>>,
): Promise<MarchePiece> {
  const { data, error } = await supabase
    .schema('finances')
    .from('marche_piece')
    .update(input)
    .eq('id_marche_piece', idMarchePiece)
    .select(SELECT_COLUMNS)
    .single()
  if (error) throw error
  return data
}

/** Suppression physique — filet de sécurité si aucune ligne ne correspond (même principe que marcheTiers.repository.ts#remove). */
export async function remove(idMarchePiece: number): Promise<void> {
  const { error, data } = await supabase
    .schema('finances')
    .from('marche_piece')
    .delete()
    .eq('id_marche_piece', idMarchePiece)
    .select('id_marche_piece')
  if (error) throw error
  if ((data?.length ?? 0) === 0) throw new Error('Pièce de marché introuvable.')
}

/** I/O brute vers le bucket marche-pieces — aucune logique métier ici, voir marchePiece.service.ts. */
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
