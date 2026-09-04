import { useState, type FormEvent } from 'react'
import { Navigate } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'
import { supabase } from '../lib/supabaseClient'
import logo from '../assets/logo-gpmm.png'
import './Login.css'

/**
 * Écran de connexion Supabase (email + mot de passe), hors du shell GPMM
 * (pas de header/sidebar avant authentification) — voir App.tsx pour le
 * routage. Redirige automatiquement vers "/" dès qu'une session existe déjà.
 */
export function Login() {
  const { session, loading } = useAuth()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  if (loading) return null
  if (session) return <Navigate to="/" replace />

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault()
    setError(null)
    setSubmitting(true)
    const { error: signInError } = await supabase.auth.signInWithPassword({ email, password })
    setSubmitting(false)
    if (signInError) {
      setError('Identifiants incorrects.')
    }
  }

  return (
    <div className="login-screen">
      <div className="gp-panel login-panel">
        <div className="login-brand">
          <img src={logo} alt="Marseille Fos" />
          <h1>VIGIE</h1>
        </div>

        <form className="login-form" onSubmit={handleSubmit}>
          <div className="gp-field">
            <label className="gp-label" htmlFor="login-email">
              Adresse e-mail
            </label>
            <input
              id="login-email"
              type="email"
              className="gp-input"
              autoComplete="username"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </div>

          <div className="gp-field">
            <label className="gp-label" htmlFor="login-password">
              Mot de passe
            </label>
            <input
              id="login-password"
              type="password"
              className="gp-input"
              autoComplete="current-password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
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
            {submitting ? 'Connexion…' : 'Se connecter'}
          </button>
        </form>
      </div>
    </div>
  )
}
