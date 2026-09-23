import { useEffect, useState } from 'react'
import { useCug } from '../../hooks/useCug'
import { useInvestissementsPgi } from '../../hooks/useInvestissementsPgi'
import {
  completerCb,
  getHistoriqueStatuts,
  type DemandeAchat as DemandeAchatRow,
} from '../../hooks/useDemandeAchat'
import { Combobox } from '../Combobox'
import { GestionDocumentaireModal, InvestissementDaModal } from './modals'
import { ApiError } from '../../services/api'
import { CURRENCY_FORMAT } from './constants'

export interface CompleterCbModalProps {
  demandeAchat: DemandeAchatRow
  onClose: () => void
  onSaved: () => void
}

/**
 * Modale « Répondre au DS » de l'écran de suivi CB (décision du 18/09/2026)
 * — reprise OP1.5, uniquement `FAD_A_COMPLETER_CB` : seule boucle de reprise
 * qui ne remonte pas jusqu'au RC (le DS demande un complément directement à
 * la CB sur la nature de l'achat ou les aspects budgétaires/comptables), qui
 * retransmet ensuite directement au DS (`completerCb` réutilise le statut
 * nominal `FAD_TRANSMISE_CB_DS`, pas de duplication côté service). Tous les
 * champs sont optionnels (même principe que la reprise `FAD_A_MODIFIER_CB`
 * de TraiterFadRcModal) : seule règle qui s'applique, le numéro d'opération
 * devient obligatoire si l'imputation comptable choisie est Investissement.
 */
export function CompleterCbModal({ demandeAchat, onClose, onSaved }: CompleterCbModalProps) {
  const [codeCug, setCodeCug] = useState<string | null>(demandeAchat.code_cug)
  const [typeAchat, setTypeAchat] = useState<string | null>(demandeAchat.type_achat)
  const [imputationComptable, setImputationComptable] = useState<string | null>(demandeAchat.imputation_comptable)
  const [numeroOperation, setNumeroOperation] = useState<string | null>(demandeAchat.numero_operation)
  const [investissementModalOpen, setInvestissementModalOpen] = useState(false)
  const [gestionDocumentaireOpen, setGestionDocumentaireOpen] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [motifDs, setMotifDs] = useState<string | null>(null)
  const [commentaireReponse, setCommentaireReponse] = useState('')

  const { cug } = useCug()
  const cugOptions = cug.map((c) => ({ value: c.code_cug, label: `${c.code_cug} — ${c.libelle_cug}` }))

  const { investissements } = useInvestissementsPgi(demandeAchat.id_service)
  const investissementSelectionne = investissements.find((i) => i.numero_operation === numeroOperation)
  const investissementLabel = investissementSelectionne
    ? `${investissementSelectionne.numero_operation} — ${investissementSelectionne.libelle_service ?? investissementSelectionne.libelle}`
    : numeroOperation

  useEffect(() => {
    let cancelled = false
    getHistoriqueStatuts(demandeAchat.id_demande_achat, 'CB')
      .then((rows) => {
        if (cancelled) return
        const dernierComplement = [...rows].reverse().find((r) => r.codeStatut === 'FAD_A_COMPLETER_CB')
        setMotifDs(dernierComplement?.commentaireStatut ?? null)
      })
      .catch(() => {
        // Best effort — la modale reste utilisable sans le motif affiché.
      })
    return () => {
      cancelled = true
    }
  }, [demandeAchat.id_demande_achat])

  async function handleSubmit() {
    setError(null)
    if (imputationComptable === 'INVESTISSEMENT' && !numeroOperation) {
      setError('Le numéro d\'opération est obligatoire pour une imputation en investissement.')
      return
    }
    setSubmitting(true)
    try {
      await completerCb(demandeAchat.id_demande_achat, {
        codeCug: codeCug ?? undefined,
        typeAchat: (typeAchat ?? undefined) as 'TRAVAUX' | 'FOURNITURES' | 'SERVICES' | undefined,
        imputationComptable: (imputationComptable ?? undefined) as 'FONCTIONNEMENT' | 'INVESTISSEMENT' | undefined,
        numeroOperation: imputationComptable === 'INVESTISSEMENT' ? numeroOperation : null,
        // Réponse au motif du DS (décision du 23/09/2026) — nouvelle ligne d'historique.
        commentaireStatut: commentaireReponse.trim() || undefined,
      })
      onSaved()
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Une erreur est survenue.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="gp-overlay is-open">
      <div className="gp-modal" role="dialog" aria-modal="true" aria-labelledby="completerCbModalTitle" style={{ maxWidth: 680 }}>
        <div className="gp-modal__hd">
          <h3 className="gp-modal__title" id="completerCbModalTitle">
            {demandeAchat.numero} — Répondre au DS
          </h3>
          <button className="gp-modal__close" aria-label="Fermer" onClick={onClose}>
            <svg className="ti">
              <use href="#i-x" />
            </svg>
          </button>
        </div>
        <div className="gp-modal__bd gp-scroll stack">
          {motifDs && (
            <p className="gp-errmsg" style={{ background: 'var(--gp-warning-bg)', color: 'var(--gp-warning-text)' }}>
              <svg className="ti">
                <use href="#i-alert-circle" />
              </svg>
              Motif du DS : {motifDs}
            </p>
          )}

          <div className="gp-field">
            <label className="gp-label" htmlFor="completercb-commentaire-reponse">
              Votre réponse (facultatif)
            </label>
            <textarea
              id="completercb-commentaire-reponse"
              className="gp-textarea"
              value={commentaireReponse}
              onChange={(e) => setCommentaireReponse(e.target.value)}
              maxLength={500}
              rows={3}
            />
          </div>

          <div className="row">
            <div className="gp-field" style={{ flex: '0 0 21.25%' }}>
              <label className="gp-label">Montant</label>
              <input className="gp-input" value={CURRENCY_FORMAT.format(demandeAchat.montant_demande)} readOnly />
            </div>
            <div className="gp-field" style={{ flex: '0 0 auto', alignSelf: 'flex-end' }}>
              <span
                className="gp-tip"
                data-tip={demandeAchat.id_fournisseur_retenu === null ? "Identifiez d'abord un fournisseur" : 'Gérer les pièces complémentaires et consulter le devis de la DA'}
              >
                <button
                  type="button"
                  className="gp-btn gp-btn--secondary"
                  disabled={demandeAchat.id_fournisseur_retenu === null}
                  onClick={() => setGestionDocumentaireOpen(true)}
                >
                  <svg className="ti">
                    <use href="#i-folder" />
                  </svg>
                  Gestion documentaire
                </button>
              </span>
            </div>
          </div>

          <div className="row" style={{ flexWrap: 'wrap' }}>
            <div className="gp-field" style={{ flex: 1 }}>
              <label className="gp-label">CUG</label>
              <Combobox options={cugOptions} value={codeCug} onChange={setCodeCug} placeholder="Choisir…" ariaLabel="CUG" style={{ maxWidth: 'none' }} />
            </div>
            <div className="gp-field" style={{ flex: 1 }}>
              <label className="gp-label">Type d'achat</label>
              <Combobox
                options={[
                  { value: 'TRAVAUX', label: 'Travaux' },
                  { value: 'FOURNITURES', label: 'Fournitures' },
                  { value: 'SERVICES', label: 'Services' },
                ]}
                value={typeAchat}
                onChange={setTypeAchat}
                placeholder="Choisir…"
                ariaLabel="Type d'achat"
                style={{ maxWidth: 'none' }}
              />
            </div>
          </div>

          <div className="row" style={{ flexWrap: 'wrap' }}>
            <div className="gp-field" style={{ flex: 1 }}>
              <label className="gp-label">Imputation comptable</label>
              <Combobox
                options={[
                  { value: 'FONCTIONNEMENT', label: 'Fonctionnement' },
                  { value: 'INVESTISSEMENT', label: 'Investissement' },
                ]}
                value={imputationComptable}
                onChange={setImputationComptable}
                placeholder="Choisir…"
                ariaLabel="Imputation comptable"
                style={{ maxWidth: 'none' }}
              />
            </div>
            {imputationComptable === 'INVESTISSEMENT' && (
              <div className="gp-field" style={{ flex: 1 }}>
                <label className="gp-label">Numéro d'opération</label>
                <button
                  type="button"
                  className="gp-btn gp-btn--secondary"
                  aria-label="Numéro d'opération"
                  title={investissementLabel ?? undefined}
                  style={{ width: '100%', justifyContent: 'flex-start', overflow: 'hidden' }}
                  onClick={() => setInvestissementModalOpen(true)}
                >
                  <span style={{ display: 'block', width: '100%', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', textAlign: 'left' }}>
                    {investissementLabel ?? 'Choisir…'}
                  </span>
                </button>
              </div>
            )}
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
            {submitting ? 'Envoi…' : 'Retransmettre au DS'}
          </button>
        </div>
      </div>

      {gestionDocumentaireOpen && demandeAchat.id_fournisseur_retenu !== null && (
        <GestionDocumentaireModal
          devisReadOnly
          roleHint="CB"
          idDemandeAchat={demandeAchat.id_demande_achat}
          idService={demandeAchat.id_service}
          procedureAchat={demandeAchat.procedure_achat}
          objetDa={demandeAchat.objet_rc}
          idFournisseurRetenu={demandeAchat.id_fournisseur_retenu}
          montantDemande={demandeAchat.montant_demande}
          onClose={() => setGestionDocumentaireOpen(false)}
        />
      )}

      {investissementModalOpen && (
        <InvestissementDaModal
          investissements={investissements}
          currentNumeroOperation={numeroOperation}
          onClose={() => setInvestissementModalOpen(false)}
          onSelected={setNumeroOperation}
        />
      )}
    </div>
  )
}
