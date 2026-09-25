import { useEffect, useState, type FormEvent } from 'react'
import { useAuth } from '../hooks/useAuth'
import { useDirections } from '../hooks/useDirections'
import { useServices, type OrgService } from '../hooks/useServices'
import { getCountDaFadService, purgerDaFadService } from '../hooks/usePurgeDaFad'
import { Combobox } from '../components/Combobox'
import { supabase } from '../lib/supabaseClient'
import { ApiError } from '../services/api'

/**
 * Suppression en masse des DA/FAD d'un service, montée sur
 * /parametres/purge-da-fad-service (décision du 25/09/2026, demande client).
 * Réservée ADMIN_APP — contrôle réel côté backend
 * (purgeDaFad.service.ts#assertAdminApp), entrée de menu déjà réservée
 * ADMIN_APP (voir config/navigation.ts, ADMIN_APP_ONLY_LABELS) : pas de
 * vérification de rôle côté écran, même convention que pages/Utilisateurs.tsx.
 *
 * Fonctionnalité destructive la plus large de l'application : supprime
 * TOUTES les DEMANDE_ACHAT du service choisi, sans exception de statut (y
 * compris FAD_COMMANDEE et leurs CSF même liquidés), avec leurs dépendances
 * — aucune trace conservée après coup (décision explicite du client).
 * Double confirmation, exactement 2 étapes, rien de plus :
 *   1. Question de confirmation, affichant le nombre réel de DA/FAD du service.
 *   2. Ré-authentification par mot de passe (supabase.auth.signInWithPassword,
 *      voir ForClaude/SECURITY.md §1 « route sensible » — même mécanique que
 *      ChangePasswordModal.tsx) : le mot de passe n'est jamais transmis au
 *      backend Express, seul Supabase Auth le vérifie.
 */
export function PurgeDaFad() {
  const { session } = useAuth()
  const { directions } = useDirections()
  const { services } = useServices()

  const [idDirection, setIdDirection] = useState<string | null>(null)
  const [idService, setIdService] = useState<string | null>(null)
  const [count, setCount] = useState<number | null>(null)
  const [countLoading, setCountLoading] = useState(false)
  const [countError, setCountError] = useState<string | null>(null)

  const directionOptions = directions.map((d) => ({ value: String(d.id_direction), label: d.libelle_direction }))
  const serviceOptions = services
    .filter((s) => idDirection === null || s.id_direction === Number(idDirection))
    .map((s) => ({ value: String(s.id_service), label: s.libelle_service }))
  const selectedService: OrgService | undefined = services.find((s) => String(s.id_service) === idService)

  useEffect(() => {
    setIdService(null)
    setCount(null)
    setCountError(null)
  }, [idDirection])

  useEffect(() => {
    if (idService === null) {
      setCount(null)
      return
    }
    let cancelled = false
    setCountLoading(true)
    setCountError(null)
    getCountDaFadService(Number(idService))
      .then((nombre) => {
        if (!cancelled) setCount(nombre)
      })
      .catch(() => {
        if (!cancelled) setCountError('Impossible de charger le nombre de demandes d\'achat de ce service.')
      })
      .finally(() => {
        if (!cancelled) setCountLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [idService])

  const [confirmStep, setConfirmStep] = useState<'QUESTION' | 'PASSWORD' | null>(null)
  const [success, setSuccess] = useState<number | null>(null)

  function handleOuvrirConfirmation() {
    setSuccess(null)
    setConfirmStep('QUESTION')
  }

  return (
    <div className="stack">
      <div className="page-heading">
        <div>
          <h1>Suppression massive des DA/FAD</h1>
          <p>Supprime toutes les demandes d'achat d'un service, avec leurs pièces jointes, devis, historiques et CSF. Action irréversible.</p>
        </div>
      </div>

      <div className="gp-panel stack">
        <p className="gp-errmsg" style={{ background: 'var(--gp-danger-bg)', color: 'var(--gp-danger)' }}>
          <svg className="ti">
            <use href="#i-alert-triangle" />
          </svg>
          Cette action supprime définitivement toutes les demandes d'achat du service choisi, quel que soit leur statut — y compris les FAD déjà
          commandées et leurs certificats de service fait déjà liquidés. Aucune trace n'est conservée après suppression.
        </p>

        <div className="row" style={{ flexWrap: 'wrap' }}>
          <div className="gp-field" style={{ flex: 1, minWidth: 260 }}>
            <label className="gp-label">Direction</label>
            <Combobox
              options={directionOptions}
              value={idDirection}
              onChange={setIdDirection}
              placeholder="Choisir une direction…"
              ariaLabel="Direction"
              style={{ maxWidth: 'none' }}
            />
          </div>
          <div className="gp-field" style={{ flex: 1, minWidth: 260 }}>
            <label className="gp-label">Service</label>
            <Combobox
              options={serviceOptions}
              value={idService}
              onChange={setIdService}
              placeholder={idDirection === null ? 'Choisir une direction d\'abord…' : 'Choisir un service…'}
              ariaLabel="Service"
              style={{ maxWidth: 'none' }}
            />
          </div>
        </div>

        {countError && <p className="gp-errmsg">{countError}</p>}

        {idService !== null && !countLoading && count !== null && (
          <p className="gp-help">
            {count === 0
              ? `Aucune demande d'achat pour ${selectedService?.libelle_service ?? 'ce service'}.`
              : `${count} demande${count > 1 ? 's' : ''} d'achat trouvée${count > 1 ? 's' : ''} pour ${selectedService?.libelle_service ?? 'ce service'}.`}
          </p>
        )}

        {success !== null && (
          <p className="gp-errmsg" style={{ background: 'var(--gp-success-bg)', color: 'var(--gp-success-text)' }}>
            <svg className="ti">
              <use href="#i-circle-check" />
            </svg>
            {success} demande{success > 1 ? 's' : ''} d'achat supprimée{success > 1 ? 's' : ''} définitivement.
          </p>
        )}

        <div className="row">
          <button
            type="button"
            className="gp-btn gp-btn--danger"
            disabled={idService === null || countLoading || count === 0}
            onClick={handleOuvrirConfirmation}
          >
            <svg className="ti">
              <use href="#i-trash" />
            </svg>
            Supprimer toutes les DA/FAD du service
          </button>
        </div>
      </div>

      {confirmStep === 'QUESTION' && selectedService && count !== null && (
        <ConfirmationQuestionModal
          count={count}
          libelleService={selectedService.libelle_service}
          onClose={() => setConfirmStep(null)}
          onConfirmed={() => setConfirmStep('PASSWORD')}
        />
      )}

      {confirmStep === 'PASSWORD' && selectedService && count !== null && (
        <ConfirmationMotDePasseModal
          email={session?.user.email}
          idService={selectedService.id_service}
          onClose={() => setConfirmStep(null)}
          onDeleted={(nombre) => {
            setConfirmStep(null)
            setSuccess(nombre)
            setIdService(null)
            setCount(null)
          }}
        />
      )}
    </div>
  )
}

interface ConfirmationQuestionModalProps {
  count: number
  libelleService: string
  onClose: () => void
  onConfirmed: () => void
}

/** Étape 1 — simple question, aucune saisie. */
function ConfirmationQuestionModal({ count, libelleService, onClose, onConfirmed }: ConfirmationQuestionModalProps) {
  return (
    <div className="gp-overlay is-open">
      <div className="gp-modal" role="dialog" aria-modal="true" aria-labelledby="purgeQuestionModalTitle">
        <div className="gp-modal__hd">
          <h3 className="gp-modal__title" id="purgeQuestionModalTitle">
            Confirmer la suppression
          </h3>
          <button className="gp-modal__close" aria-label="Fermer" onClick={onClose}>
            <svg className="ti">
              <use href="#i-x" />
            </svg>
          </button>
        </div>
        <div className="gp-modal__bd gp-scroll stack">
          <p>
            Êtes-vous sûr de vouloir supprimer les {count} demande{count > 1 ? 's' : ''} du service <strong>{libelleService}</strong> ? Cette
            action est irréversible.
          </p>
        </div>
        <div className="gp-modal__ft">
          <button type="button" className="gp-btn gp-btn--secondary" onClick={onClose}>
            Annuler
          </button>
          <button type="button" className="gp-btn gp-btn--danger" onClick={onConfirmed}>
            Continuer
          </button>
        </div>
      </div>
    </div>
  )
}

interface ConfirmationMotDePasseModalProps {
  email: string | undefined
  idService: number
  onClose: () => void
  onDeleted: (nombre: number) => void
}

/** Étape 2 — ré-authentification par mot de passe (même mécanique que ChangePasswordModal.tsx) puis appel de la suppression réelle. */
function ConfirmationMotDePasseModal({ email, idService, onClose, onDeleted }: ConfirmationMotDePasseModalProps) {
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  async function handleSubmit(event: FormEvent) {
    event.preventDefault()
    setError(null)

    if (!email) {
      setError('Session invalide — reconnectez-vous puis réessayez.')
      return
    }

    setSubmitting(true)
    try {
      const { error: signInError } = await supabase.auth.signInWithPassword({ email, password })
      if (signInError) {
        setError('Mot de passe incorrect.')
        return
      }

      const nombre = await purgerDaFadService(idService)
      onDeleted(nombre)
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Une erreur est survenue.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="gp-overlay is-open">
      <div className="gp-modal" role="dialog" aria-modal="true" aria-labelledby="purgePasswordModalTitle">
        <div className="gp-modal__hd">
          <h3 className="gp-modal__title" id="purgePasswordModalTitle">
            Confirmez votre mot de passe
          </h3>
          <button className="gp-modal__close" aria-label="Fermer" onClick={onClose} disabled={submitting}>
            <svg className="ti">
              <use href="#i-x" />
            </svg>
          </button>
        </div>
        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', minHeight: 0, overflow: 'hidden' }}>
          <div className="gp-modal__bd gp-scroll stack">
            <p className="gp-help">Ressaisissez votre mot de passe pour confirmer définitivement la suppression.</p>
            <div className="gp-field">
              <label className="gp-label" htmlFor="purge-password">
                Mot de passe
              </label>
              <input
                id="purge-password"
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
          </div>
          <div className="gp-modal__ft">
            <button type="button" className="gp-btn gp-btn--secondary" onClick={onClose} disabled={submitting}>
              Annuler
            </button>
            <button type="submit" className="gp-btn gp-btn--danger" disabled={submitting}>
              {submitting ? 'Suppression…' : 'Confirmer la suppression'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
