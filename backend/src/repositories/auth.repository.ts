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
