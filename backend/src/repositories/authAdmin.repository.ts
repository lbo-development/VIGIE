import { supabase } from '../config/supabaseClient.js'

/**
 * Wrapper autour de l'Admin API Supabase Auth (`supabase.auth.admin.*`) —
 * première utilisation dans ce backend (vérifié absent avant le 10/09/2026,
 * voir ForClaude/SECURITY.md §1.2). Réservé à acteur.service.ts, pour la
 * création/désactivation/suppression d'un compte, décision « Gestion des
 * comptes utilisateurs réservée à ADMIN_APP » (ForClaude/CDC/mot-phases-1-2.md).
 *
 * Utilise le même client `supabase` que le reste du backend (clé
 * service_role, jamais exposée côté frontend) — l'Admin API n'exige pas de
 * client dédié, seulement cette même clé.
 */

/**
 * Crée un compte Supabase Auth sans envoyer d'email d'invitation
 * (`email_confirm: true` — décision du 10/09/2026). `must_change_password`
 * dans `user_metadata` force l'écran de changement de mot de passe à la
 * première connexion (voir components/RequireAuth.tsx côté frontend).
 */
export async function createAuthUser(email: string, password: string): Promise<string> {
  const { data, error } = await supabase.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { must_change_password: true },
  })
  if (error) throw error
  return data.user.id
}

/**
 * Bannit/débannit un compte — bloque une NOUVELLE connexion immédiatement.
 * Complète, sans remplacer, la vérification ACTEUR.ACTIF dans requireAuth.ts
 * (qui coupe une session déjà active) : défense en profondeur, décision du
 * 10/09/2026.
 */
export async function banAuthUser(userId: string): Promise<void> {
  const { error } = await supabase.auth.admin.updateUserById(userId, { ban_duration: '87600h' })
  if (error) throw error
}

export async function unbanAuthUser(userId: string): Promise<void> {
  const { error } = await supabase.auth.admin.updateUserById(userId, { ban_duration: 'none' })
  if (error) throw error
}

/** Suppression physique du compte — réservée au cas résiduel d'un acteur sans aucune relation en base (voir acteur.service.ts#deleteActeur). */
export async function deleteAuthUser(userId: string): Promise<void> {
  const { error } = await supabase.auth.admin.deleteUser(userId)
  if (error) throw error
}
