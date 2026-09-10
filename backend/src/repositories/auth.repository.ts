import { supabase } from '../config/supabaseClient.js'

/**
 * Résolution identité (Supabase Auth) <-> métier (finances.acteur), et
 * vérification de rôle applicatif. Voir ForClaude/SECURITY.md §2.1.
 */

export async function findMatriculeByUserId(userId: string): Promise<string | null> {
  const { data, error } = await supabase.from('profiles').select('matricule').eq('id', userId).single()
  if (error) {
    if (error.code === 'PGRST116') return null // aucune ligne (compte pas encore lié)
    throw error
  }
  return data?.matricule ?? null
}

/**
 * Lookup inverse — résout l'utilisateur Supabase Auth lié à un ACTEUR, pour
 * le bannir/débannir/supprimer (voir acteur.service.ts). `public.profiles`
 * est partagée entre applications GPMM (ForClaude/SECURITY.md) : ne cible
 * jamais que sa propre ligne par id/matricule, jamais une requête large.
 */
export async function findUserIdByMatricule(matricule: string): Promise<string | null> {
  const { data, error } = await supabase.from('profiles').select('id').eq('matricule', matricule).maybeSingle()
  if (error) throw error
  return data?.id ?? null
}

/**
 * Rattache un compte Supabase Auth déjà créé (Admin API) à un ACTEUR — pas
 * de trigger `handle_new_user` sur `auth.users` dans ce projet (vérifié dans
 * supabase/migrations/), l'insertion est donc explicite ici. Décision du
 * 10/09/2026 : réservé à acteur.service.ts#createActeur (ADMIN_APP).
 */
export async function linkProfile(userId: string, matricule: string): Promise<void> {
  const { error } = await supabase.from('profiles').insert({ id: userId, matricule })
  if (error) throw error
}

/**
 * Supprime explicitement la ligne `profiles` avant de supprimer le compte
 * Auth correspondant (acteur.service.ts#deleteActeur) — la relation de
 * cascade `profiles.id → auth.users.id` n'est pas garantie documentée pour
 * ce projet partagé (ForClaude/SECURITY.md), mieux vaut ne jamais en
 * dépendre : supprimer la ligne soi-même rend l'ordre d'appel sûr, avec ou
 * sans ON DELETE CASCADE réel en base.
 */
export async function deleteProfile(userId: string): Promise<void> {
  const { error } = await supabase.from('profiles').delete().eq('id', userId)
  if (error) throw error
}

// Ne couvre pas la suppléance : d'après le MCD (ForClaude/CDC/mcd-phases-1-2.md),
// la SUPPLEANCE ne s'applique qu'aux rôles RC/CDS/DS ("titulaire absent"), jamais à
// ADMIN_APP (transverse, plusieurs titulaires possibles sans notion d'absence).
export async function hasActiveRole(matricule: string, typeRole: string): Promise<boolean> {
  const { data, error } = await supabase
    .schema('finances')
    .from('role_attribution')
    .select('id_role')
    .eq('matricule', matricule)
    .eq('type_role', typeRole)
    .eq('actif', true)
    .limit(1)
  if (error) throw error
  return (data?.length ?? 0) > 0
}

/**
 * Variante scopée à un périmètre service — pour ADMIN_SERVICE, dont le rôle
 * n'autorise que le service sur lequel il est attribué (jamais transverse,
 * contrairement à ADMIN_APP). Voir ForClaude/SECURITY.md §2.1.
 */
export async function hasActiveRoleForService(
  matricule: string,
  typeRole: string,
  idService: number,
): Promise<boolean> {
  const { data, error } = await supabase
    .schema('finances')
    .from('role_attribution')
    .select('id_role')
    .eq('matricule', matricule)
    .eq('type_role', typeRole)
    .eq('id_service', idService)
    .eq('actif', true)
    .limit(1)
  if (error) throw error
  return (data?.length ?? 0) > 0
}
