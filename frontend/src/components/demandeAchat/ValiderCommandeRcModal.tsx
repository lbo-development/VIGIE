import { useEffect, useState } from 'react'
import { useFournisseurs } from '../../hooks/useFournisseurs'
import { useMarches } from '../../hooks/useMarches'
import { useMarcheTiers } from '../../hooks/useMarcheTiers'
import {
  decisionRc,
  devaliderRc,
  getConsultationDemandeAchat,
  type DemandeAchat as DemandeAchatRow,
  type DemandeAchatDecision,
  type ConsultationCandidat,
} from '../../hooks/useDemandeAchat'
import { GestionDocumentaireModal } from './modals'
import { ApiError } from '../../services/api'
import { CURRENCY_FORMAT } from './constants'

export interface ValiderCommandeRcModalProps {
  demandeAchat: DemandeAchatRow
  onClose: () => void
  onSaved: () => void
}

const DECISION_BUTTONS: { decision: DemandeAchatDecision; label: string; className: string }[] = [
  { decision: 'VALIDER', label: 'Valider', className: 'gp-btn--primary' },
  { decision: 'COMPLEMENT', label: 'Demander un complément', className: 'gp-btn--secondary' },
  { decision: 'REJETER', label: 'Rejeter', className: 'gp-btn--danger' },
  { decision: 'ANNULER', label: 'Annuler', className: 'gp-btn--danger' },
]

/**
 * Modale « Valider les éléments de la commande » de l'écran de suivi RC
 * (décision du 16/09/2026, renomme et remplace l'ancien « Voir les éléments
 * de la demande » pour ce cas précis) — statuer sur une DA fraîchement
 * transmise (OP1.2, `DA_TRANSMISE_DEM_RC` : Valider/Compléter/Rejeter/
 * Annuler) ou revenir sur une validation déjà posée avant toute transmission
 * (`DA_VALIDEE_RC` : « Dévalider », retour à `DA_TRANSMISE_DEM_RC` — jamais
 * pour un rejet/une annulation, tous deux terminaux et irréversibles).
 * Purement visualisation + décision, sans édition d'aucun champ (les champs
 * de complétion OP1.2b restent dans la modale « Traiter », une fois
 * DA_VALIDEE_RC) : objet/description/montant, et selon la procédure —
 * Hors Marché : chaque entreprise consultée avec le montant de son devis ;
 * Marché : numéro et libellé du marché (ou marché tiers). Gestion
 * documentaire éditable sur les pièces complémentaires (décision du
 * 17/09/2026 — le RC doit pouvoir compléter la base documentaire des DA
 * qu'il traite, mêmes droits que le Demandeur sur DemandeAchatModal), mais
 * devis verrouillé (`devisReadOnly` — Télécharger seul reste actif) tant que
 * la FAD n'a pas été transmise au CDS, pour ne pas altérer le devis retenu
 * après consultation ; avant le 17/09/2026, gestion documentaire entière en
 * consultation seule.
 */
export function ValiderCommandeRcModal({ demandeAchat, onClose, onSaved }: ValiderCommandeRcModalProps) {
  const isDevalider = demandeAchat.code_statut === 'DA_VALIDEE_RC'

  const [commentaire, setCommentaire] = useState('')
  const [gestionDocumentaireOpen, setGestionDocumentaireOpen] = useState(false)
  const [submitting, setSubmitting] = useState<DemandeAchatDecision | 'DEVALIDER' | null>(null)
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

  useEffect(() => {
    if (demandeAchat.procedure_achat !== 'HORS_MARCHE') return
    let cancelled = false
    setCandidatsLoading(true)
    getConsultationDemandeAchat(demandeAchat.id_demande_achat)
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

  async function handleDecision(decision: DemandeAchatDecision) {
    setError(null)
    if (decision !== 'VALIDER' && !commentaire.trim()) {
      setError('Un commentaire est requis pour justifier ce choix.')
      return
    }
    setSubmitting(decision)
    try {
      await decisionRc(demandeAchat.id_demande_achat, { decision, commentaireStatut: commentaire.trim() || undefined })
      onSaved()
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Une erreur est survenue.')
    } finally {
      setSubmitting(null)
    }
  }

  async function handleDevalider() {
    setError(null)
    setSubmitting('DEVALIDER')
    try {
      await devaliderRc(demandeAchat.id_demande_achat)
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
      <div className="gp-modal" role="dialog" aria-modal="true" aria-labelledby="validerCommandeRcModalTitle" style={{ maxWidth: 680 }}>
        <div className="gp-modal__hd">
          <h3 className="gp-modal__title" id="validerCommandeRcModalTitle">
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

          {!isDevalider && (
            <div className="gp-field">
              <label className="gp-label" htmlFor="validercommande-commentaire">
                Commentaire (obligatoire sauf pour Valider)
              </label>
              <textarea
                id="validercommande-commentaire"
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
          {isDevalider ? (
            <button type="button" className="gp-btn gp-btn--secondary" disabled={disabled} onClick={() => void handleDevalider()}>
              {submitting === 'DEVALIDER' ? 'Envoi…' : 'Dévalider'}
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
          idDemandeAchat={demandeAchat.id_demande_achat}
          idService={demandeAchat.id_service}
          procedureAchat={demandeAchat.procedure_achat}
          objetDa={demandeAchat.objet_rc}
          idFournisseurRetenu={demandeAchat.id_fournisseur_retenu}
          montantDemande={demandeAchat.montant_demande}
          devisReadOnly
          onClose={() => setGestionDocumentaireOpen(false)}
        />
      )}
    </div>
  )
}
