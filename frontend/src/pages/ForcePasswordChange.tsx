import { useState, type FormEvent } from 'react'
import { supabase } from '../lib/supabaseClient'
import logo from '../assets/logo-app.png'
import './Login.css'

/**
 * Écran de changement de mot de passe obligatoire, affiché par
 * components/RequireAuth.tsx à la place du reste de l'application tant que
 * `session.user.user_metadata.must_change_password` est vrai (compte créé
 * par ADMIN_APP avec un mot de passe temporaire — voir
 * acteur.service.ts#createActeur et ForClaude/CDC/mot-phases-1-2.md).
 *
 * `supabase.auth.updateUser` déclenche un évènement USER_UPDATED capté par
 * AuthContext (onAuthStateChange) : la session se met à jour d'elle-même
 * dès la réussite, RequireAuth affiche alors le reste de l'application sans
 * action supplémentaire ici.
 */
export function ForcePasswordChange() {
  const [password, setPassword] = useState('')
  const [confirmation, setConfirmation] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault()
    setError(null)

    if (password.length < 8) {
      setError('Le mot de passe doit contenir au moins 8 caractères.')
      return
    }
    if (password !== confirmation) {
      setError('Les deux mots de passe ne correspondent pas.')
      return
    }

    setSubmitting(true)
    const { error: updateError } = await supabase.auth.updateUser({
      password,
      data: { must_change_password: false },
    })
    setSubmitting(false)
    if (updateError) {
      setError(updateError.message)
    }
  }

  return (
    <div className="login-screen">
      <div className="gp-panel login-panel">
        <div className="login-brand">
          <img src={logo} alt="Marseille Fos" />
          <h1>VIGIE</h1>
        </div>

        <p className="gp-help">
          Pour des raisons de sécurité, vous devez définir un nouveau mot de passe avant de continuer.
        </p>

        <form className="login-form" onSubmit={handleSubmit}>
          <div className="gp-field">
            <label className="gp-label" htmlFor="force-password-new">
              Nouveau mot de passe
            </label>
            <input
              id="force-password-new"
              type="password"
              className="gp-input"
              autoComplete="new-password"
              required
              minLength={8}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </div>

          <div className="gp-field">
            <label className="gp-label" htmlFor="force-password-confirm">
              Confirmer le mot de passe
            </label>
            <input
              id="force-password-confirm"
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

          <button type="submit" className="gp-btn gp-btn--primary gp-btn--lg" disabled={submitting}>
            {submitting ? 'Enregistrement…' : 'Changer le mot de passe'}
          </button>
        </form>
      </div>
    </div>
  )
}
