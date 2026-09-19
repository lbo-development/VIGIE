import { useEffect, useState } from 'react'
import { useFournisseurs } from '../../hooks/useFournisseurs'
import { useMarches } from '../../hooks/useMarches'
import { useMarcheTiers } from '../../hooks/useMarcheTiers'
import { useCug } from '../../hooks/useCug'
import { useInvestissementsPgi } from '../../hooks/useInvestissementsPgi'
import {
  decisionCb,
  transmettreDsOuSeuil,
  getConsultationDemandeAchat,
  type DemandeAchat as DemandeAchatRow,
  type DecisionCbInput,
  type ConsultationCandidat,
} from '../../hooks/useDemandeAchat'
import { Combobox } from '../Combobox'
import { GestionDocumentaireModal, InvestissementDaModal } from './modals'
import { ApiError } from '../../services/api'
import { CURRENCY_FORMAT } from './constants'

export interface ValiderCommandeCbModalProps {
  demandeAchat: DemandeAchatRow
  onClose: () => void
  onSaved: () => void
}

const DECISION_BUTTONS: { decision: DecisionCbInput['decision']; label: string; className: string }[] = [
  { decision: 'VALIDER', label: 'Valider', className: 'gp-btn--primary' },
  { decision: 'MODIFIER', label: 'Modifier', className: 'gp-btn--secondary' },
  { decision: 'REJETER', label: 'Rejeter', className: 'gp-btn--danger' },
]

/**
 * Modale « Valider les éléments de la commande » de l'écran de suivi CB
 * (décision du 18/09/2026, calquée sur ValiderCommandeCdsModal) — statuer
 * sur une FAD fraîchement transmise par le CDS ou reprise directe du RC
 * (OP1.4, `FAD_TRANSMISE_CDS_CB`/`FAD_MODIFIEE_TRANSMISE_RC_CB` :
 * Valider/Modifier/Rejeter — pas d'« Annuler », absent des actions demandées
 * par l'utilisateur pour ce rôle) ou transmettre au DS/exemption de seuil une
 * FAD déjà validée mais pas encore transmise (OP1.4b, `FAD_VALIDEE_CB` : la
 * CB peut différer la transmission, même principe que CDS/RC). **Contrairement
 * au CDS, la CB peut corriger les champs budgétaires/comptables au même appel
 * que sa décision** (CUG, type d'achat, imputation comptable, numéro
 * d'opération — decisionCb côté service) : ces champs restent éditables tant
 * que la décision n'est pas prise, affichés en lecture seule à l'étape de
 * transmission. Le devis reste verrouillé pour la CB en toute circonstance
 * (GestionDocumentaireModal avec devisReadOnly) ; aucune mention du seuil de
 * validation DS dans cette modale (décision du 18/09/2026, pas d'affichage de
 * sa valeur côté CB).
 */
export function ValiderCommandeCbModal({ demandeAchat, onClose, onSaved }: ValiderCommandeCbModalProps) {
  const isTransmission = demandeAchat.code_statut === 'FAD_VALIDEE_CB'

  const [codeCug, setCodeCug] = useState<string | null>(demandeAchat.code_cug)
  const [typeAchat, setTypeAchat] = useState<string | null>(demandeAchat.type_achat)
  const [imputationComptable, setImputationComptable] = useState<string | null>(demandeAchat.imputation_comptable)
  const [numeroOperation, setNumeroOperation] = useState<string | null>(demandeAchat.numero_operation)
  const [investissementModalOpen, setInvestissementModalOpen] = useState(false)

  const [commentaire, setCommentaire] = useState('')
  const [gestionDocumentaireOpen, setGestionDocumentaireOpen] = useState(false)
  const [submitting, setSubmitting] = useState<DecisionCbInput['decision'] | 'TRANSMETTRE' | null>(null)
  const [error, setError] = useState<string | null>(null)

  const [candidats, setCandidats] = useState<ConsultationCandidat[]>([])
  const [candidatsLoading, setCandidatsLoading] = useState(demandeAchat.procedure_achat === 'HORS_MARCHE')

  const { fournisseurs } = useFournisseurs(demandeAchat.id_service)
  const fournisseurLabel = (idFournisseur: number) => fournisseurs.find((f) => f.id_fournisseur === idFournisseur)?.raison_sociale_service ?? '—'

  const { marches } = useMarches(demandeAchat.id_service)
  const { marcheTiers } = useMarcheTiers(demandeAchat.id_service)
  const marcheLabel = demandeAchat.nummarche
    ? (marches.find((m) => m.nummarche === demandeAchat.nummarche)?.libelle_service ?? '—')
    : demandeAchat.id_marche_tiers !== null
      ? (marcheTiers.find((m) => m.id_marche_tiers === demandeAchat.id_marche_tiers)?.libelle_service ?? '—')
      : '—'
  const marcheNumero = demandeAchat.nummarche ?? (demandeAchat.id_marche_tiers !== null ? `Marché tiers #${demandeAchat.id_marche_tiers}` : '—')

  const { cug } = useCug()
  const cugOptions = cug.map((c) => ({ value: c.code_cug, label: `${c.code_cug} — ${c.libelle_cug}` }))

  const { investissements } = useInvestissementsPgi(demandeAchat.id_service)
  const investissementSelectionne = investissements.find((i) => i.numero_operation === numeroOperation)
  const investissementLabel = investissementSelectionne
    ? `${investissementSelectionne.numero_operation} — ${investissementSelectionne.libelle_service ?? investissementSelectionne.libelle}`
    : numeroOperation

  useEffect(() => {
    if (demandeAchat.procedure_achat !== 'HORS_MARCHE') return
    let cancelled = false
    setCandidatsLoading(true)
    getConsultationDemandeAchat(demandeAchat.id_demande_achat, 'CB')
      .then((rows) => {
        if (!cancelled) setCandidats([...rows].sort((a, b) => a.ordre - b.ordre))
      })
      .catch(() => {
        if (!cancelled) setError('Impossible de charger les entreprises consultées.')
      })
      .finally(() => {
        if (!cancelled) setCandidatsLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [demandeAchat.procedure_achat, demandeAchat.id_demande_achat])

  async function handleDecision(decision: DecisionCbInput['decision']) {
    setError(null)
    if (decision !== 'VALIDER' && !commentaire.trim()) {
      setError('Un commentaire est requis pour justifier ce choix.')
      return
    }
    if (imputationComptable === 'INVESTISSEMENT' && !numeroOperation) {
      setError('Le numéro d\'opération est obligatoire pour une imputation en investissement.')
      return
    }
    setSubmitting(decision)
    try {
      await decisionCb(demandeAchat.id_demande_achat, {
        decision,
        commentaireStatut: commentaire.trim() || undefined,
        codeCug: codeCug ?? undefined,
        typeAchat: (typeAchat ?? undefined) as 'TRAVAUX' | 'FOURNITURES' | 'SERVICES' | undefined,
        imputationComptable: (imputationComptable ?? undefined) as 'FONCTIONNEMENT' | 'INVESTISSEMENT' | undefined,
        numeroOperation: imputationComptable === 'INVESTISSEMENT' ? numeroOperation : null,
      })
      onSaved()
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Une erreur est survenue.')
    } finally {
      setSubmitting(null)
    }
  }

  async function handleTransmettre() {
    setError(null)
    setSubmitting('TRANSMETTRE')
    try {
      await transmettreDsOuSeuil(demandeAchat.id_demande_achat)
      onSaved()
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Une erreur est survenue.')
    } finally {
      setSubmitting(null)
    }
  }

  const disabled = submitting !== null

  return (
    <div className="gp-overlay is-open">
      <div className="gp-modal" role="dialog" aria-modal="true" aria-labelledby="validerCommandeCbModalTitle" style={{ maxWidth: 720 }}>
        <div className="gp-modal__hd">
          <h3 className="gp-modal__title" id="validerCommandeCbModalTitle">
            {demandeAchat.numero} — Valider les éléments de la commande
          </h3>
          <button className="gp-modal__close" aria-label="Fermer" onClick={onClose}>
            <svg className="ti">
              <use href="#i-x" />
            </svg>
          </button>
        </div>
        <div className="gp-modal__bd gp-scroll stack">
          <div className="stack" style={{ gap: 8 }}>
            <div className="gp-field">
              <label className="gp-label">Objet de la DA</label>
              <input className="gp-input" value={demandeAchat.objet_rc} readOnly />
            </div>
            {demandeAchat.description_rc && (
              <div className="gp-field">
                <label className="gp-label">Description de la DA</label>
                <textarea className="gp-textarea" value={demandeAchat.description_rc} readOnly rows={3} />
              </div>
            )}
            <div className="row">
              <div className="gp-field" style={{ flex: '0 0 21.25%' }}>
                <label className="gp-label">Montant</label>
                <input className="gp-input" value={CURRENCY_FORMAT.format(demandeAchat.montant_demande)} readOnly />
              </div>
              <div className="gp-field" style={{ flex: '0 0 auto', alignSelf: 'flex-end' }}>
                <span
                  className="gp-tip"
                  data-tip={demandeAchat.id_fournisseur_retenu === null ? "Identifiez d'abord un fournisseur" : 'Consulter les documents liés à la demande'}
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
          </div>

          {demandeAchat.procedure_achat === 'MARCHE' ? (
            <div className="row">
              <div className="gp-field" style={{ flex: '0 0 21.25%' }}>
                <label className="gp-label">Numéro de marché</label>
                <input className="gp-input" value={marcheNumero} readOnly />
              </div>
              <div className="gp-field" style={{ flex: 1 }}>
                <label className="gp-label">Libellé du marché</label>
                <p style={{ margin: 0, minHeight: 'var(--gp-control-h)', display: 'flex', alignItems: 'center', fontSize: 12 }}>{marcheLabel}</p>
              </div>
            </div>
          ) : (
            <div className="gp-field">
              <span className="gp-label">Entreprises consultées</span>
              <div className="gp-table-wrap gp-scroll" style={{ maxHeight: 180 }}>
                <table className="gp-table">
                  <thead>
                    <tr>
                      <th>Fournisseur</th>
                      <th>Montant du devis</th>
                    </tr>
                  </thead>
                  <tbody>
                    {candidatsLoading && (
                      <tr>
                        <td colSpan={2}>Chargement…</td>
                      </tr>
                    )}
                    {!candidatsLoading &&
                      candidats.map((c, index) => (
                        <tr key={c.idDevis}>
                          <td>
                            {fournisseurLabel(c.idFournisseur)}
                            {index === 0 && <span className="gp-badge gp-badge--success" style={{ marginLeft: 6 }}>Retenu</span>}
                          </td>
                          <td>{c.montantDevis !== null ? CURRENCY_FORMAT.format(c.montantDevis) : '—'}</td>
                        </tr>
                      ))}
                    {!candidatsLoading && candidats.length === 0 && (
                      <tr>
                        <td colSpan={2}>Aucune entreprise consultée.</td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {isTransmission ? (
            <div className="row" style={{ flexWrap: 'wrap' }}>
              <div className="gp-field" style={{ flex: 1 }}>
                <label className="gp-label">CUG</label>
                <input className="gp-input" value={codeCug ?? '—'} readOnly />
              </div>
              <div className="gp-field" style={{ flex: 1 }}>
                <label className="gp-label">Type d'achat</label>
                <input className="gp-input" value={typeAchat ?? '—'} readOnly />
              </div>
              <div className="gp-field" style={{ flex: 1 }}>
                <label className="gp-label">Imputation comptable</label>
                <input className="gp-input" value={imputationComptable ?? '—'} readOnly />
              </div>
              {imputationComptable === 'INVESTISSEMENT' && (
                <div className="gp-field" style={{ flex: 1 }}>
                  <label className="gp-label">Numéro d'opération</label>
                  <input className="gp-input" value={investissementLabel ?? '—'} readOnly />
                </div>
              )}
            </div>
          ) : (
            <>
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
            </>
          )}

          {!isTransmission && (
            <div className="gp-field">
              <label className="gp-label" htmlFor="validercommandecb-commentaire">
                Commentaire (obligatoire sauf pour Valider)
              </label>
              <textarea
                id="validercommandecb-commentaire"
                className="gp-textarea"
                value={commentaire}
                onChange={(e) => setCommentaire(e.target.value)}
                maxLength={500}
                rows={3}
                disabled={disabled}
              />
            </div>
          )}

          {error && (
            <p className="gp-errmsg">
              <svg className="ti">
                <use href="#i-alert-circle" />
              </svg>
              {error}
            </p>
          )}
        </div>
        <div className="gp-modal__ft" style={{ flexWrap: 'wrap' }}>
          <button type="button" className="gp-btn gp-btn--secondary" onClick={onClose} disabled={disabled}>
            Retour
          </button>
          {isTransmission ? (
            <button type="button" className="gp-btn gp-btn--primary" disabled={disabled} onClick={() => void handleTransmettre()}>
              {submitting === 'TRANSMETTRE' ? 'Envoi…' : 'Transmettre'}
            </button>
          ) : (
            DECISION_BUTTONS.map(({ decision, label, className }) => (
              <button
                key={decision}
                type="button"
                className={`gp-btn ${className}`}
                disabled={disabled}
                onClick={() => void handleDecision(decision)}
              >
                {submitting === decision ? 'Envoi…' : label}
              </button>
            ))
          )}
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
