import { useEffect, useState } from 'react'
import { commander, type DemandeAchat as DemandeAchatRow } from '../../hooks/useDemandeAchat'
import { useMarcheTiers } from '../../hooks/useMarcheTiers'
import { ApiError } from '../../services/api'
import { CURRENCY_FORMAT, sanitizeDecimal, formatMontantDecimal } from './constants'

export interface CommanderCbModalProps {
  demandeAchat: DemandeAchatRow
  onClose: () => void
  onSaved: () => void
}

/**
 * Modale « Commander » de l'écran de suivi CB (décision du 18/09/2026) —
 * OP1.6, uniquement `FAD_A_COMMANDER` : constat de la commande (la saisie du
 * BON dans le PGI est une tâche manuelle hors application, ForClaude/CDC/
 * mot-phases-1-2.md) — saisie de MONTANT_COMMANDE (décision du 25/09/2026 :
 * pré-rempli avec MONTANT_DEMANDE, cas courant où ils sont identiques) et
 * NUMERO_COMMANDE (nouveau, décision du 25/09/2026 — numéro de commande PGI,
 * obligatoire ; pré-rempli avec le numéro de marché en procédure Marché, y
 * compris marché tiers, vide en Hors marché), puis `FAD_COMMANDEE`.
 */
export function CommanderCbModal({ demandeAchat, onClose, onSaved }: CommanderCbModalProps) {
  const { marcheTiers } = useMarcheTiers(demandeAchat.procedure_achat === 'MARCHE' ? demandeAchat.id_service : null)
  const nummarcheTiers = marcheTiers.find((m) => m.id_marche_tiers === demandeAchat.id_marche_tiers)?.nummarche ?? ''

  const [montant, setMontant] = useState(String(demandeAchat.montant_demande || ''))
  const [montantFocused, setMontantFocused] = useState(false)
  const [numeroCommande, setNumeroCommande] = useState(demandeAchat.nummarche ?? nummarcheTiers)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Marché tiers (nummarche absent sur la DA elle-même, son propre numéro n'est connu qu'une fois
  // useMarcheTiers chargé) — pré-remplissage différé, sans écraser une éventuelle saisie déjà en cours.
  useEffect(() => {
    if (nummarcheTiers && !numeroCommande) setNumeroCommande(nummarcheTiers)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [nummarcheTiers])

  async function handleSubmit() {
    setError(null)
    const value = Number(montant)
    if (!montant.trim() || Number.isNaN(value) || value < 0) {
      setError('Le montant de la commande est obligatoire.')
      return
    }
    if (!numeroCommande.trim()) {
      setError('Le numéro de commande est obligatoire.')
      return
    }
    setSubmitting(true)
    try {
      await commander(demandeAchat.id_demande_achat, value, numeroCommande.trim())
      onSaved()
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Une erreur est survenue.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="gp-overlay is-open">
      <div className="gp-modal" role="dialog" aria-modal="true" aria-labelledby="commanderCbModalTitle" style={{ maxWidth: 480 }}>
        <div className="gp-modal__hd">
          <h3 className="gp-modal__title" id="commanderCbModalTitle">
            {demandeAchat.numero} — Commander
          </h3>
          <button className="gp-modal__close" aria-label="Fermer" onClick={onClose}>
            <svg className="ti">
              <use href="#i-x" />
            </svg>
          </button>
        </div>
        <div className="gp-modal__bd gp-scroll stack">
          <div className="gp-field">
            <label className="gp-label">Objet de la DA</label>
            <input className="gp-input" value={demandeAchat.objet_rc} readOnly />
          </div>
          <div className="gp-field">
            <label className="gp-label">Montant de la demande</label>
            <input className="gp-input" value={CURRENCY_FORMAT.format(demandeAchat.montant_demande)} readOnly />
          </div>
          <div className="gp-field" style={{ width: 220 }}>
            <label className="gp-label" htmlFor="commandercb-montant">
              Montant de la commande
            </label>
            <input
              id="commandercb-montant"
              className="gp-input"
              value={montantFocused ? montant : formatMontantDecimal(montant)}
              onChange={(e) => setMontant(sanitizeDecimal(e.target.value))}
              onFocus={() => setMontantFocused(true)}
              onBlur={() => setMontantFocused(false)}
              inputMode="decimal"
              placeholder="Saisie du Montant"
            />
          </div>
          <div className="gp-field">
            <label className="gp-label" htmlFor="commandercb-numero">
              Numéro de commande
            </label>
            <input
              id="commandercb-numero"
              className="gp-input"
              value={numeroCommande}
              onChange={(e) => setNumeroCommande(e.target.value)}
              maxLength={80}
              placeholder="Numéro de commande PGI"
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
            Retour
          </button>
          <button type="button" className="gp-btn gp-btn--primary" disabled={submitting} onClick={() => void handleSubmit()}>
            {submitting ? 'Enregistrement…' : 'Enregistrer'}
          </button>
        </div>
      </div>
    </div>
  )
}
