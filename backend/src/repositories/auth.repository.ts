import { supabase } from '../config/supabaseClient.js'
import { todayParis } from '../utils/dates.js'

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
 * Rattache un compte Supabase Auth déjà créé (Admin API) à un ACTEUR.
 *
 * Correction du 10/09/2026 (incident constaté) : un trigger `on_auth_user_created`
 * (fonction `public.handle_new_user`) existe bien sur `auth.users` dans ce
 * projet Supabase partagé — absent de nos migrations suivies (mis en place
 * au niveau du projet, probablement pour une autre application GPMM), donc
 * invisible lors de l'audit initial (`supabase/migrations/`). Ce trigger crée
 * déjà une ligne `profiles` (id seul, matricule NULL) au moment même de
 * `createAuthUser` — un simple `insert` échoue alors systématiquement
 * (23505, `profiles_pkey`). `upsert` gère les deux cas (trigger présent ou
 * non) sans dépendre de son existence.
 */
export async function linkProfile(userId: string, matricule: string): Promise<void> {
  const { error } = await supabase.from('profiles').upsert({ id: userId, matricule })
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

// Couvre la suppléance depuis le 14/09/2026 (point 7 de la conception
// statuts) : d'après le MCD (ForClaude/CDC/mcd-phases-1-2.md), la SUPPLEANCE
// ne s'applique qu'aux rôles RC/CDS/DS ("titulaire absent"), jamais à CB
// (collective, sans titulaire unique — verrouillé en base, migration
// 20260914170000) ni à ADMIN_SERVICE/ADMIN_APP (transverses, sans notion
// d'absence). Le suppléant se substitue entièrement au titulaire pendant sa
// période active — sans que le titulaire ne perde quoi que ce soit
// techniquement au niveau de ces contrôles de rôle génériques ; la lecture seule du
// titulaire suppléé (décision du 20/09/2026) est appliquée par roleEffectif.service.ts,
// qui porte les écritures métier DA/FAD.
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
  if ((data?.length ?? 0) > 0) return true

  return hasActiveSuppleanceRole(matricule, typeRole)
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
  if ((data?.length ?? 0) > 0) return true

  return hasActiveSuppleanceRole(matricule, typeRole, idService)
}

/**
 * Un suppléant actif (fenêtre date_debut/date_fin couvrant aujourd'hui) sur
 * un role_attribution actif de type_role donné — CB étant exclue du
 * dispositif de suppléance (trigger en base), cette jointure ne renverra
 * jamais de résultat pour typeRole='CB', pas besoin de l'exclure ici.
 */
async function hasActiveSuppleanceRole(matriculeSuppleant: string, typeRole: string, idService?: number): Promise<boolean> {
  const today = todayParis()
  let query = supabase
    .schema('finances')
    .from('suppleance')
    .select('id_suppleance, role_attribution!inner(type_role, id_service, actif)')
    .eq('matricule_suppleant', matriculeSuppleant)
    .is('date_retrait', null)
    .lte('date_debut', today)
    .gte('date_fin', today)
    .eq('role_attribution.type_role', typeRole)
    .eq('role_attribution.actif', true)
  if (idService !== undefined) query = query.eq('role_attribution.id_service', idService)
  const { data, error } = await query.limit(1)
  if (error) throw error
  return (data?.length ?? 0) > 0
}
