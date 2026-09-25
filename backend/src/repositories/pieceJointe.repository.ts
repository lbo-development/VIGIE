import { randomUUID } from 'node:crypto'
import { supabase } from '../config/supabaseClient.js'

/**
 * finances.piece_jointe — écran unifié de gestion documentaire (bouton
 * « Gestion documentaire », CreationDA — décision du 09/09/2026, croquis
 * DA2.pdf) : devis (voir devisConsulte.repository.ts, table séparée, « le
 * devis est une pièce particulière qui n'a pas de rapport avec les pièces
 * complémentaires ») et pièces complémentaires par fournisseur de la DA. Voir
 * ForClaude/CDC/mld-phases-1-2.md §2.4 : ID_PIECE, ID_DEMANDE_ACHAT
 * (systématique en contexte DA), ID_FOURNISSEUR (obligatoire en contexte DA
 * pour ce backend — décision du 09/09/2026, « une DA sans fournisseur n'a
 * aucune pièce attachée » — reste nullable en base pour NUMERO_CSF/Phase 2),
 * TYPE_PIECE (FK composite vers LIBELLE_REFERENTIEL, DOMAINE_TYPE_PIECE=
 * 'TYPE_PIECE_FAD'), ORIGINE, triplet fichier (NOM_FICHIER_ORIGINAL/
 * STORAGE_PATH/TAILLE_OCTETS, tous NOT NULL — une pièce n'existe qu'avec son
 * fichier, contrairement à DEVIS_CONSULTE). Fichier stocké dans le bucket
 * Storage `piece-jointe-fad` (migration 20260909110000_piece_jointe_fad_bucket.sql).
 */

const BUCKET = 'piece-jointe-fad'

export type OriginePiece = 'UTILISATEUR' | 'SYSTEME'

export interface PieceJointe {
  id_piece: number
  id_demande_achat: number
  id_fournisseur: number
  type_piece: string
  origine: OriginePiece
  nom_fichier_original: string
  storage_path: string
  taille_octets: number
}

const SELECT_COLUMNS = 'id_piece, id_demande_achat, id_fournisseur, type_piece, origine, nom_fichier_original, storage_path, taille_octets'

/** Toutes les pièces de la DA, tous fournisseurs confondus — purge globale (changement de procédure, changement de marché sélectionné). */
export async function findAllByDemandeAchat(idDemandeAchat: number): Promise<PieceJointe[]> {
  const { data, error } = await supabase
    .schema('finances')
    .from('piece_jointe')
    .select(SELECT_COLUMNS)
    .eq('id_demande_achat', idDemandeAchat)
    .order('id_piece', { ascending: true })
  if (error) throw error
  return (data ?? []) as PieceJointe[]
}

export async function findAllByDemandeAchatAndFournisseur(idDemandeAchat: number, idFournisseur: number): Promise<PieceJointe[]> {
  const { data, error } = await supabase
    .schema('finances')
    .from('piece_jointe')
    .select(SELECT_COLUMNS)
    .eq('id_demande_achat', idDemandeAchat)
    .eq('id_fournisseur', idFournisseur)
    .order('id_piece', { ascending: true })
  if (error) throw error
  return (data ?? []) as PieceJointe[]
}

export async function findById(idPiece: number): Promise<PieceJointe | null> {
  const { data, error } = await supabase.schema('finances').from('piece_jointe').select(SELECT_COLUMNS).eq('id_piece', idPiece).maybeSingle()
  if (error) throw error
  return data as PieceJointe | null
}

export interface PieceJointeCreateInput {
  id_demande_achat: number
  id_fournisseur: number
  type_piece: string
  origine: OriginePiece
  nom_fichier_original: string
  storage_path: string
  taille_octets: number
}

/** Une PIECE_JOINTE n'existe qu'avec son fichier déjà déposé — pas de create() sans triplet fichier, contrairement à devisConsulteRepository.create. */
export async function create(input: PieceJointeCreateInput): Promise<PieceJointe> {
  const { data, error } = await supabase
    .schema('finances')
    .from('piece_jointe')
    .insert({ ...input, domaine_type_piece: 'TYPE_PIECE_FAD' })
    .select(SELECT_COLUMNS)
    .single()
  if (error) throw error
  return data as PieceJointe
}

export async function remove(idPiece: number): Promise<void> {
  const { error } = await supabase.schema('finances').from('piece_jointe').delete().eq('id_piece', idPiece)
  if (error) throw error
}

/** Chemin neutre côté serveur (jamais le nom fourni par l'utilisateur — SECURITY.md §10). */
export function buildStoragePath(idDemandeAchat: number, idFournisseur: number): string {
  return `${idDemandeAchat}/${idFournisseur}/${randomUUID()}.pdf`
}

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

/**
 * Justificatifs CSF (Phase 2, décision du 24/09/2026) — même table, même
 * bucket, rattachement exclusif via ID_CSF plutôt que ID_DEMANDE_ACHAT (voir
 * migration 20260924100000, CHECK chk_pj_rattachement_exclusif). Pas de
 * ID_FOURNISSEUR en contexte CSF (n'a de sens qu'en contexte DA). TYPE_PIECE
 * contraint par le domaine dédié TYPE_PIECE_CSF (migration 20260924150000),
 * PV_RECEPTION | BON_LIVRAISON | AUTRE — distinct de TYPE_PIECE_FAD.
 */
export interface PieceJointeCsf {
  id_piece: number
  id_csf: number
  type_piece: string
  origine: OriginePiece
  nom_fichier_original: string
  storage_path: string
  taille_octets: number
}

const SELECT_COLUMNS_CSF = 'id_piece, id_csf, type_piece, origine, nom_fichier_original, storage_path, taille_octets'

export async function findAllByCsf(idCsf: number): Promise<PieceJointeCsf[]> {
  const { data, error } = await supabase
    .schema('finances')
    .from('piece_jointe')
    .select(SELECT_COLUMNS_CSF)
    .eq('id_csf', idCsf)
    .order('id_piece', { ascending: true })
  if (error) throw error
  return (data ?? []) as PieceJointeCsf[]
}

export interface PieceJointeCsfCreateInput {
  id_csf: number
  type_piece: string
  origine: OriginePiece
  nom_fichier_original: string
  storage_path: string
  taille_octets: number
}

export async function findByIdCsf(idPiece: number): Promise<PieceJointeCsf | null> {
  const { data, error } = await supabase.schema('finances').from('piece_jointe').select(SELECT_COLUMNS_CSF).eq('id_piece', idPiece).maybeSingle()
  if (error) throw error
  return data as PieceJointeCsf | null
}

export async function createForCsf(input: PieceJointeCsfCreateInput): Promise<PieceJointeCsf> {
  const { data, error } = await supabase
    .schema('finances')
    .from('piece_jointe')
    .insert({ ...input, domaine_type_piece: 'TYPE_PIECE_CSF' })
    .select(SELECT_COLUMNS_CSF)
    .single()
  if (error) throw error
  return data as PieceJointeCsf
}

/** Chemin neutre côté serveur (jamais le nom fourni par l'utilisateur — SECURITY.md §10). */
export function buildStoragePathCsf(idCsf: number): string {
  return `csf/${idCsf}/${randomUUID()}.pdf`
}
