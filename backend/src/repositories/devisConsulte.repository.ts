import { randomUUID } from 'node:crypto'
import { supabase } from '../config/supabaseClient.js'

/**
 * finances.devis_consulte — écran FournisseurDA (bouton « Éléments de
 * consultation », CreationDA — procédure HORS_MARCHE, décision du
 * 09/09/2026) et MarcheDA (devis BPU facultatif du titulaire, procédure
 * MARCHE). Voir ForClaude/CDC/mld-phases-1-2.md §2.4 : ID_DEVIS,
 * ID_DEMANDE_ACHAT, ID_FOURNISSEUR, MONTANT_DEVIS (nullable), triplet
 * fichier (NOM_FICHIER_ORIGINAL/STORAGE_PATH/TAILLE_OCTETS, nullables —
 * dépôt différé, écran PiecesDevisDA), RETENU, ORDRE. Contraintes :
 * UNIQUE(ID_DEMANDE_ACHAT) WHERE RETENU, UNIQUE(ID_DEMANDE_ACHAT, ORDRE),
 * UNIQUE(ID_DEMANDE_ACHAT, ID_FOURNISSEUR).
 *
 * Chaque ligne est un enregistrement persistant géré individuellement
 * (create/update/remove), pas une liste rechargée en bloc — un devis, c'est
 * un fichier attaché à une ligne existante, remplacé en place au dépôt
 * suivant (décision du 09/09/2026, PiecesDevisDA). Fichier stocké dans le
 * bucket Storage `devis-consulte-pieces` (migration
 * 20260909100000_devis_consulte_pieces_bucket.sql).
 */

const BUCKET = 'devis-consulte-pieces'

export interface DevisConsulte {
  id_devis: number
  id_demande_achat: number
  id_fournisseur: number
  montant_devis: number | null
  nom_fichier_original: string | null
  storage_path: string | null
  taille_octets: number | null
  retenu: boolean
  ordre: number
}

const SELECT_COLUMNS = 'id_devis, id_demande_achat, id_fournisseur, montant_devis, nom_fichier_original, storage_path, taille_octets, retenu, ordre'

export async function existsForFournisseur(idFournisseur: number): Promise<boolean> {
  const { data, error } = await supabase
    .schema('finances')
    .from('devis_consulte')
    .select('id_devis')
    .eq('id_fournisseur', idFournisseur)
    .limit(1)
  if (error) throw error
  return (data?.length ?? 0) > 0
}

export async function findAllByDemandeAchat(idDemandeAchat: number): Promise<DevisConsulte[]> {
  const { data, error } = await supabase
    .schema('finances')
    .from('devis_consulte')
    .select(SELECT_COLUMNS)
    .eq('id_demande_achat', idDemandeAchat)
    .order('ordre', { ascending: true })
  if (error) throw error
  return (data ?? []) as DevisConsulte[]
}

export async function findById(idDevis: number): Promise<DevisConsulte | null> {
  const { data, error } = await supabase.schema('finances').from('devis_consulte').select(SELECT_COLUMNS).eq('id_devis', idDevis).maybeSingle()
  if (error) throw error
  return data as DevisConsulte | null
}

export interface DevisConsulteCreateInput {
  id_demande_achat: number
  id_fournisseur: number
  montant_devis: number | null
  ordre: number
  retenu: boolean
}

export async function create(input: DevisConsulteCreateInput): Promise<DevisConsulte> {
  const { data, error } = await supabase.schema('finances').from('devis_consulte').insert(input).select(SELECT_COLUMNS).single()
  if (error) throw error
  return data as DevisConsulte
}

export interface DevisConsulteUpdate {
  montant_devis?: number | null
  ordre?: number
  retenu?: boolean
  nom_fichier_original?: string | null
  storage_path?: string | null
  taille_octets?: number | null
}

export async function update(idDevis: number, input: DevisConsulteUpdate): Promise<DevisConsulte> {
  const { data, error } = await supabase.schema('finances').from('devis_consulte').update(input).eq('id_devis', idDevis).select(SELECT_COLUMNS).single()
  if (error) throw error
  return data as DevisConsulte
}

export async function remove(idDevis: number): Promise<void> {
  const { error } = await supabase.schema('finances').from('devis_consulte').delete().eq('id_devis', idDevis)
  if (error) throw error
}

/**
 * Suppression en cascade applicative depuis demandeAchat.service.ts#deleteDemandeAchat
 * (DA_EN_PREPARATION uniquement) — à appeler après avoir supprimé les
 * PIECE_JOINTE de la DA (voir ForClaude/CDC/mld-phases-1-2.md §4 pour
 * l'ordre PIECE_JOINTE → DEVIS_CONSULTE → HISTORIQUE_STATUT → DEMANDE_ACHAT).
 * Ne supprime pas les fichiers Storage associés (best-effort, à la charge de
 * l'appelant s'il veut les nettoyer — deleteDemandeAchat ne le fait pas
 * aujourd'hui, cohérent avec le fait qu'une DA_EN_PREPARATION n'a en pratique
 * jamais eu le temps de recevoir de devis).
 */
export async function deleteAllByDemandeAchat(idDemandeAchat: number): Promise<void> {
  const { error } = await supabase.schema('finances').from('devis_consulte').delete().eq('id_demande_achat', idDemandeAchat)
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
