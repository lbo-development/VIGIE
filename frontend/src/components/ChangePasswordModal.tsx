import { useRef, useState, type FormEvent } from 'react'
import { supabase } from '../lib/supabaseClient'
import { useAuth } from '../hooks/useAuth'

interface ChangePasswordModalProps {
  onClose: () => void
}

/**
 * Changement volontaire de mot de passe, accessible à tout moment depuis la
 * barre de statut (icône cadenas à côté de « Se déconnecter » — voir
 * StatusBar.tsx). Distinct de ForcePasswordChange.tsx (changement obligatoire
 * à la première connexion, déclenché par `must_change_password`) : ici
 * l'utilisateur est déjà pleinement authentifié et agit de sa propre
 * initiative.
 *
 * Re-vérifie le mot de passe actuel via `signInWithPassword` avant d'appeler
 * `updateUser` — exigence explicite de `ForClaude/SECURITY.md` §1 : « pour
 * toute route sensible (changement de mot de passe...), prévoir une
 * re-vérification plutôt que de se fier uniquement à la session active ».
 * 100% frontend (comme Login.tsx/ForcePasswordChange.tsx) : aucun appel au
 * backend Express, seul `supabase.auth.*` est sollicité.
 */
export function ChangePasswordModal({ onClose }: ChangePasswordModalProps) {
  const { session } = useAuth()
  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmation, setConfirmation] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [success, setSuccess] = useState(false)
  // Verrou synchrone contre la double soumission (voir Utilisateurs.tsx —
  // `submitting` seul ne suffit pas, son re-rendu n'est pas garanti avant un
  // second évènement de soumission).
  const submittingRef = useRef(false)

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault()
    if (submittingRef.current) return
    setError(null)

    if (newPassword.length < 8) {
      setError('Le nouveau mot de passe doit contenir au moins 8 caractères.')
      return
    }
    if (newPassword !== confirmation) {
      setError('Les deux mots de passe ne correspondent pas.')
      return
    }

    const email = session?.user.email
    if (!email) {
      setError('Session invalide — reconnectez-vous puis réessayez.')
      return
    }

    submittingRef.current = true
    setSubmitting(true)
    try {
      const { error: signInError } = await supabase.auth.signInWithPassword({ email, password: currentPassword })
      if (signInError) {
        setError('Mot de passe actuel incorrect.')
        return
      }

      const { error: updateError } = await supabase.auth.updateUser({ password: newPassword })
      if (updateError) {
        setError(updateError.message)
        return
      }

      setSuccess(true)
    } catch {
      setError('Une erreur est survenue.')
    } finally {
      setSubmitting(false)
      submittingRef.current = false
    }
  }

  if (success) {
    return (
      <div className="gp-overlay is-open">
        <div className="gp-modal" role="dialog" aria-modal="true" aria-labelledby="changePasswordSuccessTitle">
          <div className="gp-modal__hd">
            <h3 className="gp-modal__title" id="changePasswordSuccessTitle">
              Mot de passe changé
            </h3>
          </div>
          <div className="gp-modal__bd gp-scroll stack">
            <p>Votre mot de passe a été mis à jour avec succès.</p>
          </div>
          <div className="gp-modal__ft">
            <button type="button" className="gp-btn gp-btn--primary" onClick={onClose}>
              Fermer
            </button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="gp-overlay is-open">
      <div className="gp-modal" role="dialog" aria-modal="true" aria-labelledby="changePasswordModalTitle">
        <div className="gp-modal__hd">
          <h3 className="gp-modal__title" id="changePasswordModalTitle">
            Changer mon mot de passe
          </h3>
          <button className="gp-modal__close" aria-label="Fermer" onClick={onClose}>
            <svg className="ti">
              <use href="#i-x" />
            </svg>
          </button>
        </div>
        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', minHeight: 0, overflow: 'hidden' }}>
          <div className="gp-modal__bd gp-scroll stack">
            <div className="gp-field">
              <label className="gp-label" htmlFor="change-password-current">
                Mot de passe actuel
              </label>
              <input
                id="change-password-current"
                type="password"
                className="gp-input"
                autoComplete="current-password"
                required
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
              />
            </div>
            <div className="gp-field">
              <label className="gp-label" htmlFor="change-password-new">
                Nouveau mot de passe
              </label>
              <input
                id="change-password-new"
                type="password"
                className="gp-input"
                autoComplete="new-password"
                required
                minLength={8}
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
              />
            </div>
            <div className="gp-field">
              <label className="gp-label" htmlFor="change-password-confirm">
                Confirmer le nouveau mot de passe
              </label>
              <input
                id="change-password-confirm"
                type="password"
                className="gp-input"
                autoComplete="new-password"
                required
                minLength={8}
                value={confirmation}
                onChange={(e) => setConfirmation(e.target.value)}
              />
            </div>
            {error && (
              <p className="gp-errmsg">
                <svg className="ti">
                  <use href="#i-alert-circle" />
                </svg>
                {error}
              </p>
            )}
          </div>
          <div className="gp-modal__ft">
            <button type="button" className="gp-btn gp-btn--secondary" onClick={onClose}>
              Annuler
            </button>
            <button type="submit" className="gp-btn gp-btn--primary" disabled={submitting}>
              {submitting ? 'Enregistrement…' : 'Changer le mot de passe'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
