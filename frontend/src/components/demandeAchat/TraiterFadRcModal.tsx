import { useEffect, useState, type FormEvent } from 'react'
import { useFournisseurs } from '../../hooks/useFournisseurs'
import { useSites } from '../../hooks/useSites'
import { useSecteurs } from '../../hooks/useSecteurs'
import { useCug } from '../../hooks/useCug'
import { useInvestissementsPgi } from '../../hooks/useInvestissementsPgi'
import {
  decisionRc,
  transmettreFad,
  retransmettreCb,
  getHistoriqueStatuts,
  type DemandeAchat as DemandeAchatRow,
  type DemandeAchatDecision,
} from '../../hooks/useDemandeAchat'
import { Combobox } from '../Combobox'
import { ApiError } from '../../services/api'
import { CURRENCY_FORMAT } from './constants'

export interface TraiterFadRcModalProps {
  demandeAchat: DemandeAchatRow
  onClose: () => void
  onSaved: () => void
}

/**
 * Modale adaptative « Traiter » de l'écran de suivi RC (décision du
 * 15/09/2026), sélectionnée selon `demandeAchat.code_statut` : statuer sur
 * l'opportunité d'une DA fraîchement transmise (OP1.2, `DA_TRANSMISE_DEM_RC`),
 * ou compléter/transmettre une FAD (OP1.2b, `DA_VALIDEE_RC`/
 * `FAD_A_COMPLETER_CDS`/`FAD_A_MODIFIER_CB` — reprise directe à la CB, sans
 * repasser par le CDS, pour ce dernier statut). N'affiche jamais
 * OBJET_DEMANDEUR/DESCRIPTION_DEMANDEUR (décision explicite : uniquement les
 * champs RC éditables).
 */
export function TraiterFadRcModal({ demandeAchat, onClose, onSaved }: TraiterFadRcModalProps) {
  if (demandeAchat.code_statut === 'DA_TRANSMISE_DEM_RC') {
    return <DecisionRcSection demandeAchat={demandeAchat} onClose={onClose} onSaved={onSaved} />
  }
  return <CompletionFadSection demandeAchat={demandeAchat} onClose={onClose} onSaved={onSaved} />
}

const DECISION_BUTTONS: { decision: DemandeAchatDecision; label: string; className: string }[] = [
  { decision: 'VALIDER', label: 'Valider', className: 'gp-btn--primary' },
  { decision: 'COMPLEMENT', label: 'Demander un complément', className: 'gp-btn--secondary' },
  { decision: 'REJETER', label: 'Rejeter', className: 'gp-btn--danger' },
  { decision: 'ANNULER', label: 'Annuler', className: 'gp-btn--danger' },
]

/** Libellé procédure — même logique que la carte DA/FAD de l'écran d'accueil (pages/Home.tsx). */
function procedureLabel(demandeAchat: DemandeAchatRow): string {
  if (demandeAchat.procedure_achat !== 'MARCHE') return 'Hors marché'
  return demandeAchat.nummarche ?? (demandeAchat.id_marche_tiers !== null ? `Marché tiers #${demandeAchat.id_marche_tiers}` : 'Marché')
}

function DecisionRcSection({ demandeAchat, onClose, onSaved }: TraiterFadRcModalProps) {
  const [commentaire, setCommentaire] = useState('')
  const [submittingDecision, setSubmittingDecision] = useState<DemandeAchatDecision | null>(null)
  const [error, setError] = useState<string | null>(null)

  const { fournisseurs } = useFournisseurs(demandeAchat.id_service)
  const fournisseurLabel = fournisseurs.find((f) => f.id_fournisseur === demandeAchat.id_fournisseur_retenu)?.raison_sociale_service ?? '—'

  async function handleDecision(decision: DemandeAchatDecision) {
    setError(null)
    if (decision !== 'VALIDER' && !commentaire.trim()) {
      setError('Un commentaire est requis pour justifier ce choix.')
      return
    }
    setSubmittingDecision(decision)
    try {
      await decisionRc(demandeAchat.id_demande_achat, { decision, commentaireStatut: commentaire.trim() || undefined })
      onSaved()
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Une erreur est survenue.')
    } finally {
      setSubmittingDecision(null)
    }
  }

  return (
    <div className="gp-overlay is-open">
      <div className="gp-modal" role="dialog" aria-modal="true" aria-labelledby="traiterFadRcModalTitle" style={{ maxWidth: 640 }}>
        <div className="gp-modal__hd">
          <h3 className="gp-modal__title" id="traiterFadRcModalTitle">
            {demandeAchat.numero} — Statuer sur l'opportunité
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
              <div className="gp-field" style={{ flex: 1 }}>
                <label className="gp-label">Procédure</label>
                <input className="gp-input" value={procedureLabel(demandeAchat)} readOnly />
              </div>
              <div className="gp-field" style={{ flex: 1 }}>
                <label className="gp-label">Fournisseur</label>
                <input className="gp-input" value={fournisseurLabel} readOnly />
              </div>
            </div>
          </div>

          <div className="gp-field">
            <label className="gp-label" htmlFor="decisionrc-commentaire">
              Commentaire (obligatoire sauf pour Valider)
            </label>
            <textarea
              id="decisionrc-commentaire"
              className="gp-textarea"
              value={commentaire}
              onChange={(e) => setCommentaire(e.target.value)}
              maxLength={500}
              rows={3}
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
        <div className="gp-modal__ft" style={{ flexWrap: 'wrap' }}>
          <button type="button" className="gp-btn gp-btn--secondary" onClick={onClose} disabled={submittingDecision !== null}>
            Retour
          </button>
          {DECISION_BUTTONS.map(({ decision, label, className }) => (
            <button
              key={decision}
              type="button"
              className={`gp-btn ${className}`}
              disabled={submittingDecision !== null}
              onClick={() => void handleDecision(decision)}
            >
              {submittingDecision === decision ? 'Envoi…' : label}
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}

const TYPE_ACHAT_OPTIONS = [
  { value: 'TRAVAUX', label: 'Travaux' },
  { value: 'FOURNITURES', label: 'Fournitures' },
  { value: 'SERVICES', label: 'Services' },
]

const IMPUTATION_OPTIONS = [
  { value: 'FONCTIONNEMENT', label: 'Fonctionnement' },
  { value: 'INVESTISSEMENT', label: 'Investissement' },
]

function CompletionFadSection({ demandeAchat, onClose, onSaved }: TraiterFadRcModalProps) {
  // FAD_A_MODIFIER_CB (reprise OP1.4→RC) : tous les champs restent optionnels côté serveur (le RC
  // ne corrige que ce que la CB a demandé) — voir retransmettreCbSchema. Sinon (première
  // complétion/reprise CDS), site/secteur/CUG/type achat/imputation sont obligatoires — voir
  // transmettreFadSchema.
  const isReprisesCb = demandeAchat.code_statut === 'FAD_A_MODIFIER_CB'

  const [objet, setObjet] = useState(demandeAchat.objet_rc)
  const [description, setDescription] = useState(demandeAchat.description_rc ?? '')
  const [codeSite, setCodeSite] = useState<string | null>(demandeAchat.code_site)
  const [codeSousSite, setCodeSousSite] = useState<string | null>(demandeAchat.code_sous_site)
  const [codeSecteur, setCodeSecteur] = useState<string | null>(demandeAchat.code_secteur)
  const [codeSousSecteur, setCodeSousSecteur] = useState<string | null>(demandeAchat.code_sous_secteur)
  const [codeCug, setCodeCug] = useState<string | null>(demandeAchat.code_cug)
  const [typeAchat, setTypeAchat] = useState<string | null>(demandeAchat.type_achat)
  const [imputationComptable, setImputationComptable] = useState<string | null>(demandeAchat.imputation_comptable)
  const [numeroOperation, setNumeroOperation] = useState<string | null>(demandeAchat.numero_operation)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const [motifCb, setMotifCb] = useState<string | null>(null)

  useEffect(() => {
    if (!isReprisesCb) return
    let cancelled = false
    getHistoriqueStatuts(demandeAchat.id_demande_achat)
      .then((rows) => {
        if (cancelled) return
        const dernierRetour = [...rows].reverse().find((r) => r.codeStatut === 'FAD_A_MODIFIER_CB')
        setMotifCb(dernierRetour?.commentaireStatut ?? null)
      })
      .catch(() => {
        // Best effort — la modale reste utilisable sans le motif affiché.
      })
    return () => {
      cancelled = true
    }
  }, [isReprisesCb, demandeAchat.id_demande_achat])

  const { sites } = useSites(demandeAchat.id_service)
  const { secteurs } = useSecteurs(demandeAchat.id_service)
  const { cug } = useCug()
  const { investissements } = useInvestissementsPgi(demandeAchat.id_service)

  const siteOptions = sites.map((s) => ({ value: s.code_site, label: s.lib_site }))
  const sousSitesDisponibles = sites.find((s) => s.code_site === codeSite)?.sous_sites ?? []
  const sousSiteOptions = sousSitesDisponibles.map((s) => ({ value: s.code_sous_site, label: s.lib_sous_site }))

  const secteurOptions = secteurs.map((s) => ({ value: s.code_secteur, label: s.lib_secteur }))
  const sousSecteursDisponibles = secteurs.find((s) => s.code_secteur === codeSecteur)?.sous_secteurs ?? []
  const sousSecteurOptions = sousSecteursDisponibles.map((s) => ({ value: s.code_sous_secteur, label: s.lib_sous_secteur }))

  const cugOptions = cug.map((c) => ({ value: c.code_cug, label: c.libelle_cug }))
  const investissementOptions = investissements.map((i) => ({ value: i.numero_operation, label: `${i.numero_operation} — ${i.libelle_service ?? i.libelle}` }))

  function handleSiteChange(v: string | null) {
    setCodeSite(v)
    if (!sites.find((s) => s.code_site === v)?.sous_sites.some((s) => s.code_sous_site === codeSousSite)) {
      setCodeSousSite(null)
    }
  }

  function handleSecteurChange(v: string | null) {
    setCodeSecteur(v)
    if (!secteurs.find((s) => s.code_secteur === v)?.sous_secteurs.some((s) => s.code_sous_secteur === codeSousSecteur)) {
      setCodeSousSecteur(null)
    }
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault()
    setError(null)

    if (!isReprisesCb) {
      if (!codeSite || !codeSecteur || !codeCug || !typeAchat || !imputationComptable) {
        setError('Site, secteur, CUG, type d\'achat et imputation comptable sont obligatoires.')
        return
      }
    }
    if (imputationComptable === 'INVESTISSEMENT' && !numeroOperation) {
      setError('Le numéro d\'opération est obligatoire pour une imputation en investissement.')
      return
    }

    const input = {
      objet: objet.trim() || undefined,
      description: description.trim() || undefined,
      codeSite: codeSite ?? undefined,
      codeSousSite,
      codeSecteur: codeSecteur ?? undefined,
      codeSousSecteur,
      codeCug: codeCug ?? undefined,
      typeAchat: (typeAchat ?? undefined) as 'TRAVAUX' | 'FOURNITURES' | 'SERVICES' | undefined,
      imputationComptable: (imputationComptable ?? undefined) as 'FONCTIONNEMENT' | 'INVESTISSEMENT' | undefined,
      numeroOperation: imputationComptable === 'INVESTISSEMENT' ? numeroOperation : null,
    }

    setSubmitting(true)
    try {
      if (isReprisesCb) {
        await retransmettreCb(demandeAchat.id_demande_achat, input)
      } else {
        // Champs requis validés ci-dessus — cast sûr vers TransmettreFadInput.
        await transmettreFad(demandeAchat.id_demande_achat, input as Parameters<typeof transmettreFad>[1])
      }
      onSaved()
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Une erreur est survenue.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="gp-overlay is-open">
      <div className="gp-modal" role="dialog" aria-modal="true" aria-labelledby="traiterFadRcModalTitle" style={{ maxWidth: 760 }}>
        <div className="gp-modal__hd">
          <h3 className="gp-modal__title" id="traiterFadRcModalTitle">
            {demandeAchat.numero} — {isReprisesCb ? 'Retransmettre à la CB' : 'Compléter et transmettre au CDS'}
          </h3>
          <button className="gp-modal__close" aria-label="Fermer" onClick={onClose}>
            <svg className="ti">
              <use href="#i-x" />
            </svg>
          </button>
        </div>
        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', minHeight: 0, overflow: 'hidden' }}>
          <div className="gp-modal__bd gp-scroll stack">
            {isReprisesCb && motifCb && (
              <p className="gp-errmsg" style={{ background: 'var(--gp-warning-bg)', color: 'var(--gp-warning-text)' }}>
                <svg className="ti">
                  <use href="#i-alert-circle" />
                </svg>
                Motif de la CB : {motifCb}
              </p>
            )}

            <div className="gp-field">
              <label className="gp-label" htmlFor="traiterfad-objet">
                Objet de la DA
              </label>
              <input id="traiterfad-objet" className="gp-input" value={objet} onChange={(e) => setObjet(e.target.value)} maxLength={75} />
            </div>
            <div className="gp-field">
              <label className="gp-label" htmlFor="traiterfad-description">
                Description de la DA
              </label>
              <textarea
                id="traiterfad-description"
                className="gp-textarea"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                maxLength={256}
                rows={3}
              />
            </div>

            <div className="row" style={{ flexWrap: 'wrap' }}>
              <div className="gp-field" style={{ flex: 1 }}>
                <label className="gp-label">Site</label>
                <Combobox options={siteOptions} value={codeSite} onChange={handleSiteChange} placeholder="Choisir…" ariaLabel="Site" style={{ maxWidth: 'none' }} />
              </div>
              <div className="gp-field" style={{ flex: 1 }}>
                <label className="gp-label">Sous-site</label>
                <Combobox
                  options={sousSiteOptions}
                  value={codeSousSite}
                  onChange={setCodeSousSite}
                  placeholder="Aucun"
                  clearLabel="Aucun"
                  ariaLabel="Sous-site"
                  style={{ maxWidth: 'none' }}
                />
              </div>
            </div>

            <div className="row" style={{ flexWrap: 'wrap' }}>
              <div className="gp-field" style={{ flex: 1 }}>
                <label className="gp-label">Secteur</label>
                <Combobox
                  options={secteurOptions}
                  value={codeSecteur}
                  onChange={handleSecteurChange}
                  placeholder="Choisir…"
                  ariaLabel="Secteur"
                  style={{ maxWidth: 'none' }}
                />
              </div>
              <div className="gp-field" style={{ flex: 1 }}>
                <label className="gp-label">Sous-secteur</label>
                <Combobox
                  options={sousSecteurOptions}
                  value={codeSousSecteur}
                  onChange={setCodeSousSecteur}
                  placeholder="Aucun"
                  clearLabel="Aucun"
                  ariaLabel="Sous-secteur"
                  style={{ maxWidth: 'none' }}
                />
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
                  options={TYPE_ACHAT_OPTIONS}
                  value={typeAchat}
                  onChange={setTypeAchat}
                  placeholder="Choisir…"
                  ariaLabel="Type d'achat"
                  style={{ maxWidth: 'none' }}
                />
              </div>
              <div className="gp-field" style={{ flex: 1 }}>
                <label className="gp-label">Imputation comptable</label>
                <Combobox
                  options={IMPUTATION_OPTIONS}
                  value={imputationComptable}
                  onChange={setImputationComptable}
                  placeholder="Choisir…"
                  ariaLabel="Imputation comptable"
                  style={{ maxWidth: 'none' }}
                />
              </div>
            </div>

            {imputationComptable === 'INVESTISSEMENT' && (
              <div className="gp-field">
                <label className="gp-label">Numéro d'opération</label>
                <Combobox
                  options={investissementOptions}
                  value={numeroOperation}
                  onChange={setNumeroOperation}
                  placeholder="Choisir…"
                  ariaLabel="Numéro d'opération"
                  style={{ maxWidth: 'none' }}
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
          <div className="gp-modal__ft">
            <button type="button" className="gp-btn gp-btn--secondary" onClick={onClose}>
              Retour
            </button>
            <button type="submit" className="gp-btn gp-btn--primary" disabled={submitting}>
              {submitting ? 'Envoi…' : isReprisesCb ? 'Retransmettre à la CB' : 'Transmettre au CDS'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
