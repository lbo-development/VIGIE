import { randomUUID } from 'node:crypto'
import { supabase } from '../config/supabaseClient.js'

/**
 * finances.signature_acteur — image de signature déposée une fois par acteur, réutilisée sur
 * chaque fiche FAD papier générée par la CB (décision du 19/09/2026, voir
 * demandeAchat.service.ts#genererFadPdf). Une ligne par acteur (MATRICULE en clé primaire) : un
 * nouveau dépôt remplace le précédent. Fichier stocké dans le bucket Storage
 * `signatures-acteurs` (migration 20260919100000_create_signature_acteur.sql). Calqué sur
 * pieceJointe.repository.ts pour les conventions de stockage.
 */

const BUCKET = 'signatures-acteurs'

export interface SignatureActeur {
  matricule: string
  chemin_stockage: string
  nom_fichier_original: string
  taille_octets: number
  matricule_depose_par: string
}

const SELECT_COLUMNS = 'matricule, chemin_stockage, nom_fichier_original, taille_octets, matricule_depose_par'

export async function findByMatricule(matricule: string): Promise<SignatureActeur | null> {
  const { data, error } = await supabase
    .schema('finances')
    .from('signature_acteur')
    .select(SELECT_COLUMNS)
    .eq('matricule', matricule)
    .maybeSingle()
  if (error) throw error
  return data as SignatureActeur | null
}

export interface SignatureActeurUpsertInput {
  matricule: string
  chemin_stockage: string
  nom_fichier_original: string
  taille_octets: number
  matricule_depose_par: string
}

export async function upsert(input: SignatureActeurUpsertInput): Promise<SignatureActeur> {
  const { data, error } = await supabase
    .schema('finances')
    .from('signature_acteur')
    .upsert(input, { onConflict: 'matricule' })
    .select(SELECT_COLUMNS)
    .single()
  if (error) throw error
  return data as SignatureActeur
}

export async function remove(matricule: string): Promise<void> {
  const { error } = await supabase.schema('finances').from('signature_acteur').delete().eq('matricule', matricule)
  if (error) throw error
}

/** Chemin neutre côté serveur (jamais le nom fourni par l'utilisateur — SECURITY.md §10). */
export function buildStoragePath(matricule: string, extension: string): string {
  return `${matricule}/${randomUUID()}.${extension}`
}

export async function uploadFile(path: string, buffer: Buffer, contentType: string): Promise<void> {
  const { error } = await supabase.storage.from(BUCKET).upload(path, buffer, { contentType })
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
