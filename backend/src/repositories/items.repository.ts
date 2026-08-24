import { supabase } from '../config/supabaseClient.js'

/**
 * Couche d'accès aux données : seule couche autorisée à parler directement
 * à Supabase. Les services ne doivent jamais importer supabaseClient
 * directement, uniquement passer par un repository.
 *
 * Exemple basé sur une table "items" (id, name, created_at) — à adapter ou
 * supprimer selon les besoins réels du projet. Sers-t'en de modèle pour
 * créer d'autres repositories (un fichier par ressource/table).
 */

export interface Item {
  id: string
  name: string
  created_at: string
}

export async function findAll(): Promise<Item[]> {
  const { data, error } = await supabase.from('items').select('*').order('created_at', { ascending: false })
  if (error) throw error
  return data ?? []
}

export async function create(name: string): Promise<Item> {
  const { data, error } = await supabase.from('items').insert({ name }).select().single()
  if (error) throw error
  return data
}
