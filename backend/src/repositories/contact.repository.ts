import { supabase } from '../config/supabaseClient.js'

/**
 * finances.contact — contacts rattachés à un FOURNISSEUR (0..N par
 * fournisseur), pas de champ d'état (voir ForClaude/CDC/mcd-phases-1-2.md
 * l.41) : contrairement à FOURNISSEUR, la suppression physique est autorisée
 * ici (aucune autre table ne référence CONTACT).
 */

/** Alignées sur la contrainte CHECK de la table physique finances.contact (schéma préexistant). */
export type NatureFonction =
  | 'DIRIGEANT'
  | 'JURIDIQUE'
  | 'COMMERCIAL'
  | "RESPONSABLE D'AFFAIRE"
  | 'RESPONSABLE TECHNIQUE'
  | 'TECHNICIEN'
  | 'RESPONSABLE FINANCIER/COMPTABILITE'

export interface Contact {
  id_contact: number
  id_fournisseur: number
  nom: string
  prenom: string | null
  mail: string | null
  telfixe: string | null
  telmobile: string | null
  fonction: string | null
  naturefonction: NatureFonction | null
}

const SELECT_COLUMNS = 'id_contact, id_fournisseur, nom, prenom, mail, telfixe, telmobile, fonction, naturefonction'

export async function findByFournisseurs(idFournisseurs: number[]): Promise<Contact[]> {
  if (idFournisseurs.length === 0) return []
  const { data, error } = await supabase
    .schema('finances')
    .from('contact')
    .select(SELECT_COLUMNS)
    .in('id_fournisseur', idFournisseurs)
    .order('nom', { ascending: true })
  if (error) throw error
  return data ?? []
}

export async function findById(idContact: number): Promise<Contact | null> {
  const { data, error } = await supabase
    .schema('finances')
    .from('contact')
    .select(SELECT_COLUMNS)
    .eq('id_contact', idContact)
    .maybeSingle()
  if (error) throw error
  return data
}

export async function create(input: Omit<Contact, 'id_contact'>): Promise<Contact> {
  const { data, error } = await supabase.schema('finances').from('contact').insert(input).select().single()
  if (error) throw error
  return data
}

export async function update(
  idContact: number,
  input: Partial<Omit<Contact, 'id_contact' | 'id_fournisseur'>>,
): Promise<Contact> {
  const { data, error } = await supabase
    .schema('finances')
    .from('contact')
    .update(input)
    .eq('id_contact', idContact)
    .select()
    .single()
  if (error) throw error
  return data
}

export async function remove(idContact: number): Promise<void> {
  const { error, data } = await supabase.schema('finances').from('contact').delete().eq('id_contact', idContact).select('id_contact')
  if (error) throw error
  if ((data?.length ?? 0) === 0) throw new Error('Contact introuvable.')
}

/** Supprime tous les contacts d'un fournisseur (préalable à la suppression du fournisseur lui-même) — 0 contact est un cas normal, pas une erreur. */
export async function removeByFournisseur(idFournisseur: number): Promise<void> {
  const { error } = await supabase.schema('finances').from('contact').delete().eq('id_fournisseur', idFournisseur)
  if (error) throw error
}
