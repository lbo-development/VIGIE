import { useEffect, useState } from 'react'
import {
  createCertificatServiceFait,
  updateCertificatServiceFait,
  editerEnPlaceRc,
  transmettreRc,
  transmettreBudget,
  demanderComplementRc,
  retransmettreBudget,
  validerBudget,
  demanderComplementBudget,
  constaterLiquidation,
  supprimerCertificatServiceFait,
  getPiecesCertificatServiceFait,
  addPieceCertificatServiceFait,
  removePieceCertificatServiceFait,
  downloadPieceCertificatServiceFaitBlob,
  getHistoriqueStatutsCsf,
  useCertificatsServiceFaitByDemandeAchat,
  type CertificatServiceFait,
  type PieceJointeCsf,
} from '../../hooks/useCertificatServiceFait'
import { useLibelleReferentiel } from '../../hooks/useLibelleReferentiel'
import { Combobox } from '../Combobox'
import { DatePicker } from '../DatePicker'
import { FileDropzone } from '../FileDropzone'
import { CertificatServiceFaitCard } from './CertificatServiceFaitCard'
import { HistoriqueStatutsCsfModal } from './HistoriqueStatutsCsfModal'
import { STATUTS_CSF_REDACTEUR, STATUT_CSF_A_TRAITER_RC, STATUT_CSF_A_COMPLETER_BUDGET, STATUT_CSF_A_TRAITER_BUDGET, STATUT_CSF_VALIDE_BUDGET } from './constants'
import { sanitizeDecimal, formatMontantDecimal, MAX_FICHIER_TAILLE_OCTETS, triggerBlobDownload } from '../demandeAchat/constants'
import { ApiError } from '../../services/api'

// ─────────────────────────────────────────────────────────────────────────
// Pièces justificatives — liste + dépôt, réutilisée par les 3 modales
// ci-dessous. TYPE_PIECE_CSF (migration 20260924150000) : PV_RECEPTION,
// BON_LIVRAISON, AUTRE — distinct de TYPE_PIECE_FAD.
// ─────────────────────────────────────────────────────────────────────────

interface PiecesCsfProps {
  idCsf: number
  editable: boolean
}

function PiecesCsf({ idCsf, editable }: PiecesCsfProps) {
  const [pieces, setPieces] = useState<PieceJointeCsf[]>([])
  const [loading, setLoading] = useState(true)
  const [file, setFile] = useState<File | null>(null)
  const [typePiece, setTypePiece] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const { items: typesPiece } = useLibelleReferentiel('TYPE_PIECE_CSF')
  const typePieceOptions = typesPiece.filter((t) => t.actif).map((t) => ({ value: t.code, label: t.libelle }))

  useEffect(() => {
    if (!typePiece && typePieceOptions.length > 0) setTypePiece(typePieceOptions[0].value)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [typePieceOptions])

  function refetchPieces() {
    setLoading(true)
    return getPiecesCertificatServiceFait(idCsf)
      .then((data) => setPieces(data))
      .catch(() => setError('Impossible de charger les justificatifs.'))
      .finally(() => setLoading(false))
  }

  useEffect(() => {
    void refetchPieces()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [idCsf])

  async function handleUpload() {
    setError(null)
    if (!file) {
      setError('Un fichier est requis.')
      return
    }
    if (!typePiece) {
      setError('Type de pièce requis.')
      return
    }
    setSubmitting(true)
    try {
      await addPieceCertificatServiceFait(idCsf, typePiece, file)
      setFile(null)
      await refetchPieces()
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Une erreur est survenue.')
    } finally {
      setSubmitting(false)
    }
  }

  async function handleRemove(idPiece: number) {
    setError(null)
    try {
      await removePieceCertificatServiceFait(idCsf, idPiece)
      await refetchPieces()
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Une erreur est survenue.')
    }
  }

  async function handleDownload(piece: PieceJointeCsf) {
    try {
      const blob = await downloadPieceCertificatServiceFaitBlob(idCsf, piece.idPiece)
      triggerBlobDownload(blob, piece.nomFichierOriginal)
    } catch {
      setError('Impossible de télécharger le justificatif.')
    }
  }

  return (
    <div className="gp-field">
      <label className="gp-label">Justificatifs</label>
      {loading && <p className="gp-help">Chargement…</p>}
      {!loading && pieces.length === 0 && <p className="gp-help">Aucun justificatif déposé.</p>}
      {!loading &&
        pieces.map((piece) => (
          <div key={piece.idPiece} className="row" style={{ alignItems: 'center', gap: 8, marginBottom: 6 }}>
            <input className="gp-input" style={{ flex: 1 }} value={piece.nomFichierOriginal} readOnly />
            <div className="gp-rowacts">
              <button type="button" title="Télécharger" aria-label="Télécharger" onClick={() => void handleDownload(piece)}>
                <svg className="ti">
                  <use href="#i-download" />
                </svg>
              </button>
              {editable && (
                <button type="button" className="del" title="Supprimer" aria-label="Supprimer" onClick={() => void handleRemove(piece.idPiece)}>
                  <svg className="ti">
                    <use href="#i-trash" />
                  </svg>
                </button>
              )}
            </div>
          </div>
        ))}

      {editable && (
        <div className="stack" style={{ gap: 8, marginTop: pieces.length > 0 ? 10 : 0 }}>
          <Combobox
            options={typePieceOptions}
            value={typePiece}
            onChange={(v) => {
              if (v) setTypePiece(v)
            }}
            placeholder="Type de pièce"
            ariaLabel="Type de pièce"
            style={{ maxWidth: 'none' }}
          />
          <FileDropzone accept="application/pdf" maxSizeOctets={MAX_FICHIER_TAILLE_OCTETS} file={file} onFileSelected={setFile} disabled={submitting} />
          {file && (
            <button type="button" className="gp-btn gp-btn--secondary gp-btn--sm" disabled={submitting} onClick={() => void handleUpload()}>
              {submitting ? 'Ajout…' : 'Ajouter le justificatif'}
            </button>
          )}
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
  )
}

// ─────────────────────────────────────────────────────────────────────────
// CertificatServiceFaitFormModal — rédacteur (demandeur initial ou RC ayant
// élaboré le CSF), CSF_EN_PREPARATION ou CSF_A_COMPLETER_RC (OP2.1).
// ─────────────────────────────────────────────────────────────────────────

interface CertificatServiceFaitFormModalProps {
  certificat: CertificatServiceFait
  onClose: () => void
  onSaved: () => void
  onDeleted: () => void
}

export function CertificatServiceFaitFormModal({ certificat, onClose, onSaved, onDeleted }: CertificatServiceFaitFormModalProps) {
  const [montant, setMontant] = useState(certificat.montant_csf !== null ? String(certificat.montant_csf) : '')
  const [montantFocus, setMontantFocus] = useState(false)
  const [dateServiceFait, setDateServiceFait] = useState<string | null>(certificat.date_service_fait)
  const [description, setDescription] = useState(certificat.description ?? '')
  const [saving, setSaving] = useState(false)
  const [transmitting, setTransmitting] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [confirmDeleteOpen, setConfirmDeleteOpen] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleSave() {
    setError(null)
    setSaving(true)
    try {
      await updateCertificatServiceFait(certificat.id_csf, {
        montantCsf: montant.trim() ? Number(montant) : null,
        dateServiceFait,
        description: description.trim() || null,
      })
      onSaved()
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Une erreur est survenue.')
    } finally {
      setSaving(false)
    }
  }

  async function handleTransmettre() {
    setError(null)
    setTransmitting(true)
    try {
      await updateCertificatServiceFait(certificat.id_csf, {
        montantCsf: montant.trim() ? Number(montant) : null,
        dateServiceFait,
        description: description.trim() || null,
      })
      await transmettreRc(certificat.id_csf)
      onSaved()
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Une erreur est survenue.')
    } finally {
      setTransmitting(false)
    }
  }

  async function confirmDelete() {
    setError(null)
    setDeleting(true)
    try {
      await supprimerCertificatServiceFait(certificat.id_csf)
      onDeleted()
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Une erreur est survenue.')
      setDeleting(false)
    }
  }

  return (
    <div className="gp-overlay is-open">
      <div className="gp-modal" role="dialog" aria-modal="true" aria-labelledby="csfFormModalTitle" style={{ maxWidth: 640 }}>
        <div className="gp-modal__hd">
          <h3 className="gp-modal__title" id="csfFormModalTitle">
            {certificat.numero_csf} — Certificat de service fait
          </h3>
          <button className="gp-modal__close" aria-label="Fermer" onClick={onClose}>
            <svg className="ti">
              <use href="#i-x" />
            </svg>
          </button>
        </div>
        <div className="gp-modal__bd gp-scroll stack">
          <div className="row" style={{ flexWrap: 'wrap' }}>
            <div className="gp-field" style={{ flex: 1 }}>
              <label className="gp-label">Montant certifié</label>
              <input
                className="gp-input"
                value={montantFocus ? montant : formatMontantDecimal(montant)}
                onFocus={() => setMontantFocus(true)}
                onBlur={() => setMontantFocus(false)}
                onChange={(e) => setMontant(sanitizeDecimal(e.target.value))}
                placeholder="0,00 €"
                inputMode="decimal"
              />
            </div>
            <div className="gp-field" style={{ flex: 1 }}>
              <label className="gp-label">Date de service fait</label>
              <DatePicker value={dateServiceFait} onChange={setDateServiceFait} ariaLabel="Date de service fait" id="csf-date-service-fait" />
            </div>
          </div>

          <div className="gp-field">
            <label className="gp-label">Description</label>
            <textarea className="gp-textarea" value={description} onChange={(e) => setDescription(e.target.value)} rows={3} maxLength={500} />
          </div>

          <PiecesCsf idCsf={certificat.id_csf} editable />

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
          <button type="button" className="gp-btn gp-btn--danger" disabled={saving || transmitting} onClick={() => setConfirmDeleteOpen(true)}>
            Supprimer
          </button>
          <div style={{ flex: 1 }} />
          <button type="button" className="gp-btn gp-btn--secondary" disabled={saving || transmitting} onClick={() => void handleSave()}>
            {saving ? 'Enregistrement…' : 'Enregistrer'}
          </button>
          <button type="button" className="gp-btn gp-btn--primary" disabled={saving || transmitting} onClick={() => void handleTransmettre()}>
            {transmitting ? 'Envoi…' : 'Transmettre au RC'}
          </button>
        </div>
      </div>

      {confirmDeleteOpen && (
        <div className="gp-overlay is-open">
          <div className="gp-modal" role="dialog" aria-modal="true" aria-labelledby="deleteCsfModalTitle">
            <div className="gp-modal__hd">
              <h3 className="gp-modal__title" id="deleteCsfModalTitle">
                Supprimer le certificat de service fait
              </h3>
              <button className="gp-modal__close" aria-label="Fermer" onClick={() => setConfirmDeleteOpen(false)}>
                <svg className="ti">
                  <use href="#i-x" />
                </svg>
              </button>
            </div>
            <div className="gp-modal__bd gp-scroll stack">
              <p>Supprimer définitivement « {certificat.numero_csf} » ? Cette action est irréversible.</p>
            </div>
            <div className="gp-modal__ft">
              <button type="button" className="gp-btn gp-btn--secondary" onClick={() => setConfirmDeleteOpen(false)}>
                Annuler
              </button>
              <button type="button" className="gp-btn gp-btn--danger" disabled={deleting} onClick={() => void confirmDelete()}>
                {deleting ? 'Suppression…' : 'Supprimer'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────
// CertificatServiceFaitReadOnlyModal — consultation simple (statuts où
// l'acteur connecté n'a aucune action possible, ex. rédacteur consultant un
// CSF déjà transmis).
// ─────────────────────────────────────────────────────────────────────────

interface CertificatServiceFaitReadOnlyModalProps {
  certificat: CertificatServiceFait
  onClose: () => void
}

export function CertificatServiceFaitReadOnlyModal({ certificat, onClose }: CertificatServiceFaitReadOnlyModalProps) {
  return (
    <div className="gp-overlay is-open">
      <div className="gp-modal" role="dialog" aria-modal="true" aria-labelledby="csfReadOnlyModalTitle" style={{ maxWidth: 640 }}>
        <div className="gp-modal__hd">
          <h3 className="gp-modal__title" id="csfReadOnlyModalTitle">
            {certificat.numero_csf} — Certificat de service fait
          </h3>
          <button className="gp-modal__close" aria-label="Fermer" onClick={onClose}>
            <svg className="ti">
              <use href="#i-x" />
            </svg>
          </button>
        </div>
        <div className="gp-modal__bd gp-scroll stack">
          <div className="row" style={{ flexWrap: 'wrap' }}>
            <div className="gp-field" style={{ flex: 1 }}>
              <label className="gp-label">Montant certifié</label>
              <input className="gp-input" value={certificat.montant_csf !== null ? formatMontantDecimal(String(certificat.montant_csf)) : '—'} readOnly />
            </div>
            <div className="gp-field" style={{ flex: 1 }}>
              <label className="gp-label">Date de service fait</label>
              <input
                className="gp-input"
                value={certificat.date_service_fait ? new Date(certificat.date_service_fait).toLocaleDateString('fr-FR') : '—'}
                readOnly
              />
            </div>
          </div>
          <div className="gp-field">
            <label className="gp-label">Description</label>
            <textarea className="gp-textarea" value={certificat.description ?? ''} readOnly rows={3} />
          </div>
          <PiecesCsf idCsf={certificat.id_csf} editable={false} />
        </div>
        <div className="gp-modal__ft">
          <button type="button" className="gp-btn gp-btn--secondary" onClick={onClose}>
            Fermer
          </button>
        </div>
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────
// CertificatsServiceFaitModal — liste des CSF d'une FAD commandée (bouton
// sur la carte FAD, écran d'accueil Demandeur). Entrée « Nouveau CSF » (R1 :
// n'apparaît que sur une FAD_COMMANDEE, déjà garanti par l'appelant).
// ─────────────────────────────────────────────────────────────────────────

interface CertificatsServiceFaitModalProps {
  idDemandeAchat: number
  numeroFad: string
  onClose: () => void
}

export function CertificatsServiceFaitModal({ idDemandeAchat, numeroFad, onClose }: CertificatsServiceFaitModalProps) {
  const { data: certificats, loading, error, refetch } = useCertificatsServiceFaitByDemandeAchat(idDemandeAchat)
  const [formCsf, setFormCsf] = useState<CertificatServiceFait | null>(null)
  const [readOnlyCsf, setReadOnlyCsf] = useState<CertificatServiceFait | null>(null)
  const [historiqueCsf, setHistoriqueCsf] = useState<CertificatServiceFait | null>(null)
  const [creating, setCreating] = useState(false)
  const [creationError, setCreationError] = useState<string | null>(null)

  async function handleCreate() {
    setCreationError(null)
    setCreating(true)
    try {
      const csf = await createCertificatServiceFait(idDemandeAchat)
      await refetch()
      setFormCsf(csf)
    } catch (err) {
      setCreationError(err instanceof ApiError ? err.message : 'Une erreur est survenue.')
    } finally {
      setCreating(false)
    }
  }

  return (
    <div className="gp-overlay is-open">
      <div className="gp-modal" role="dialog" aria-modal="true" aria-labelledby="csfListModalTitle" style={{ maxWidth: 760 }}>
        <div className="gp-modal__hd">
          <h3 className="gp-modal__title" id="csfListModalTitle">
            {numeroFad} — Certificats de service fait
          </h3>
          <button className="gp-modal__close" aria-label="Fermer" onClick={onClose}>
            <svg className="ti">
              <use href="#i-x" />
            </svg>
          </button>
        </div>
        <div className="gp-modal__bd gp-scroll stack">
          <div className="row" style={{ justifyContent: 'flex-end' }}>
            <button type="button" className="gp-btn gp-btn--primary" disabled={creating} onClick={() => void handleCreate()}>
              <svg className="ti">
                <use href="#i-plus" />
              </svg>
              {creating ? 'Création…' : 'Nouveau CSF'}
            </button>
          </div>

          {creationError && <p className="gp-errmsg">{creationError}</p>}
          {error && <p className="gp-errmsg">{error}</p>}
          {loading && <p className="gp-help">Chargement…</p>}
          {!loading && certificats.length === 0 && <p className="gp-help">Aucun certificat de service fait pour cette FAD.</p>}

          <div className="stack" style={{ gap: 10 }}>
            {certificats.map((csf) => {
              const editable = STATUTS_CSF_REDACTEUR.includes(csf.code_statut_csf)
              return (
                <CertificatServiceFaitCard
                  key={csf.id_csf}
                  certificat={csf}
                  actions={
                    <>
                      <span className="gp-tip" data-tip={editable ? 'Compléter et transmettre' : 'Voir'}>
                        <button
                          aria-label={editable ? 'Compléter et transmettre' : 'Voir'}
                          onClick={() => (editable ? setFormCsf(csf) : setReadOnlyCsf(csf))}
                        >
                          <svg className="ti">
                            <use href={editable ? '#i-pencil' : '#i-eye'} />
                          </svg>
                        </button>
                      </span>
                      <span className="gp-tip" data-tip="Historique des statuts">
                        <button aria-label="Historique des statuts" onClick={() => setHistoriqueCsf(csf)}>
                          <svg className="ti">
                            <use href="#i-calendar" />
                          </svg>
                        </button>
                      </span>
                    </>
                  }
                />
              )
            })}
          </div>
        </div>
        <div className="gp-modal__ft">
          <button type="button" className="gp-btn gp-btn--secondary" onClick={onClose}>
            Fermer
          </button>
        </div>
      </div>

      {formCsf && (
        <CertificatServiceFaitFormModal
          certificat={formCsf}
          onClose={() => setFormCsf(null)}
          onSaved={() => {
            setFormCsf(null)
            void refetch()
          }}
          onDeleted={() => {
            setFormCsf(null)
            void refetch()
          }}
        />
      )}

      {readOnlyCsf && <CertificatServiceFaitReadOnlyModal certificat={readOnlyCsf} onClose={() => setReadOnlyCsf(null)} />}

      {historiqueCsf && (
        <HistoriqueStatutsCsfModal idCsf={historiqueCsf.id_csf} numeroCsf={historiqueCsf.numero_csf} onClose={() => setHistoriqueCsf(null)} />
      )}
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────
// TraiterCsfRcModal — écran de suivi RC (OP2.2). CSF_A_TRAITER : édition en
// place (justificatif/montant, sans changement de statut) puis transmettre /
// demander un complément / supprimer. CSF_A_COMPLETER_BUDGET : reprise
// directe après un complément de la CB, sans passage par le rédacteur —
// lecture seule du contenu, réponse libre facultative, retransmission.
// ─────────────────────────────────────────────────────────────────────────

interface TraiterCsfRcModalProps {
  certificat: CertificatServiceFait
  onClose: () => void
  onSaved: () => void
}

export function TraiterCsfRcModal({ certificat, onClose, onSaved }: TraiterCsfRcModalProps) {
  const enControle = certificat.code_statut_csf === STATUT_CSF_A_TRAITER_RC
  const enRepriseBudget = certificat.code_statut_csf === STATUT_CSF_A_COMPLETER_BUDGET

  const [montant, setMontant] = useState(certificat.montant_csf !== null ? String(certificat.montant_csf) : '')
  const [montantFocus, setMontantFocus] = useState(false)
  const [dateServiceFait, setDateServiceFait] = useState<string | null>(certificat.date_service_fait)
  const [description, setDescription] = useState(certificat.description ?? '')
  const [commentaireComplement, setCommentaireComplement] = useState('')
  const [complementOpen, setComplementOpen] = useState(false)
  const [commentaireReponse, setCommentaireReponse] = useState('')
  const [motifBudget, setMotifBudget] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [confirmDeleteOpen, setConfirmDeleteOpen] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!enRepriseBudget) return
    let cancelled = false
    getHistoriqueStatutsCsf(certificat.id_csf)
      .then((rows) => {
        if (cancelled) return
        const dernier = [...rows].reverse().find((r) => r.codeStatutCsf === 'CSF_A_COMPLETER_BUDGET')
        setMotifBudget(dernier?.commentaireStatut ?? null)
      })
      .catch(() => {
        // Best effort — la modale reste utilisable sans le motif affiché.
      })
    return () => {
      cancelled = true
    }
  }, [enRepriseBudget, certificat.id_csf])

  async function handleEnregistrer() {
    setError(null)
    setSubmitting(true)
    try {
      await editerEnPlaceRc(certificat.id_csf, {
        montantCsf: montant.trim() ? Number(montant) : null,
        dateServiceFait,
        description: description.trim() || null,
      })
      onSaved()
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Une erreur est survenue.')
    } finally {
      setSubmitting(false)
    }
  }

  async function handleTransmettreBudget() {
    setError(null)
    setSubmitting(true)
    try {
      await editerEnPlaceRc(certificat.id_csf, {
        montantCsf: montant.trim() ? Number(montant) : null,
        dateServiceFait,
        description: description.trim() || null,
      })
      await transmettreBudget(certificat.id_csf)
      onSaved()
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Une erreur est survenue.')
    } finally {
      setSubmitting(false)
    }
  }

  async function handleDemanderComplement() {
    setError(null)
    if (!commentaireComplement.trim()) {
      setError('Le motif du complément est requis.')
      return
    }
    setSubmitting(true)
    try {
      await demanderComplementRc(certificat.id_csf, commentaireComplement.trim())
      onSaved()
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Une erreur est survenue.')
    } finally {
      setSubmitting(false)
    }
  }

  async function handleRetransmettreBudget() {
    setError(null)
    setSubmitting(true)
    try {
      await retransmettreBudget(certificat.id_csf, commentaireReponse.trim() || undefined)
      onSaved()
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Une erreur est survenue.')
    } finally {
      setSubmitting(false)
    }
  }

  async function confirmDelete() {
    setError(null)
    setDeleting(true)
    try {
      await supprimerCertificatServiceFait(certificat.id_csf)
      onSaved()
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Une erreur est survenue.')
      setDeleting(false)
    }
  }

  return (
    <div className="gp-overlay is-open">
      <div className="gp-modal" role="dialog" aria-modal="true" aria-labelledby="traiterCsfRcModalTitle" style={{ maxWidth: 680 }}>
        <div className="gp-modal__hd">
          <h3 className="gp-modal__title" id="traiterCsfRcModalTitle">
            {certificat.numero_csf} — Traiter le certificat de service fait
          </h3>
          <button className="gp-modal__close" aria-label="Fermer" onClick={onClose}>
            <svg className="ti">
              <use href="#i-x" />
            </svg>
          </button>
        </div>
        <div className="gp-modal__bd gp-scroll stack">
          {enRepriseBudget && (
            <div className="stack" style={{ gap: 8 }}>
              {motifBudget && (
                <div style={{ background: 'var(--gp-warning-bg)', borderRadius: 'var(--gp-radius)', padding: '10px 12px' }}>
                  <p className="gp-label" style={{ color: 'var(--gp-warning-text)', margin: '0 0 4px' }}>
                    CB
                  </p>
                  <p style={{ margin: 0, color: 'var(--gp-warning-text)' }}>{motifBudget}</p>
                </div>
              )}
              <div style={{ background: 'var(--gp-info-bg)', borderRadius: 'var(--gp-radius)', padding: '10px 12px' }}>
                <label className="gp-label" htmlFor="traitercsf-commentaire-reponse" style={{ color: 'var(--gp-info-text)' }}>
                  Vous (facultatif)
                </label>
                <textarea
                  id="traitercsf-commentaire-reponse"
                  className="gp-textarea"
                  value={commentaireReponse}
                  onChange={(e) => setCommentaireReponse(e.target.value)}
                  placeholder="Votre réponse…"
                  maxLength={500}
                  rows={3}
                />
              </div>
            </div>
          )}

          <div className="row" style={{ flexWrap: 'wrap' }}>
            <div className="gp-field" style={{ flex: 1 }}>
              <label className="gp-label">Montant certifié</label>
              {enControle ? (
                <input
                  className="gp-input"
                  value={montantFocus ? montant : formatMontantDecimal(montant)}
                  onFocus={() => setMontantFocus(true)}
                  onBlur={() => setMontantFocus(false)}
                  onChange={(e) => setMontant(sanitizeDecimal(e.target.value))}
                  placeholder="0,00 €"
                  inputMode="decimal"
                />
              ) : (
                <input className="gp-input" value={certificat.montant_csf !== null ? formatMontantDecimal(String(certificat.montant_csf)) : '—'} readOnly />
              )}
            </div>
            <div className="gp-field" style={{ flex: 1 }}>
              <label className="gp-label">Date de service fait</label>
              {enControle ? (
                <DatePicker value={dateServiceFait} onChange={setDateServiceFait} ariaLabel="Date de service fait" id="traitercsf-date-service-fait" />
              ) : (
                <input
                  className="gp-input"
                  value={certificat.date_service_fait ? new Date(certificat.date_service_fait).toLocaleDateString('fr-FR') : '—'}
                  readOnly
                />
              )}
            </div>
          </div>

          <div className="gp-field">
            <label className="gp-label">Description</label>
            {enControle ? (
              <textarea className="gp-textarea" value={description} onChange={(e) => setDescription(e.target.value)} rows={3} maxLength={500} />
            ) : (
              <textarea className="gp-textarea" value={certificat.description ?? ''} readOnly rows={3} />
            )}
          </div>

          <PiecesCsf idCsf={certificat.id_csf} editable={enControle} />

          {enControle && complementOpen && (
            <div className="gp-field">
              <label className="gp-label" htmlFor="traitercsf-motif-complement">
                Motif du complément demandé au rédacteur
              </label>
              <textarea
                id="traitercsf-motif-complement"
                className="gp-textarea"
                value={commentaireComplement}
                onChange={(e) => setCommentaireComplement(e.target.value)}
                rows={3}
                maxLength={500}
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
          {enControle && (
            <button type="button" className="gp-btn gp-btn--danger" disabled={submitting} onClick={() => setConfirmDeleteOpen(true)}>
              Supprimer
            </button>
          )}
          <div style={{ flex: 1 }} />
          {enControle && !complementOpen && (
            <>
              <button type="button" className="gp-btn gp-btn--secondary" disabled={submitting} onClick={() => setComplementOpen(true)}>
                Demander un complément
              </button>
              <button type="button" className="gp-btn gp-btn--secondary" disabled={submitting} onClick={() => void handleEnregistrer()}>
                {submitting ? 'Enregistrement…' : 'Enregistrer'}
              </button>
              <button type="button" className="gp-btn gp-btn--primary" disabled={submitting} onClick={() => void handleTransmettreBudget()}>
                {submitting ? 'Envoi…' : 'Transmettre à la CB'}
              </button>
            </>
          )}
          {enControle && complementOpen && (
            <>
              <button type="button" className="gp-btn gp-btn--secondary" disabled={submitting} onClick={() => setComplementOpen(false)}>
                Retour
              </button>
              <button type="button" className="gp-btn gp-btn--primary" disabled={submitting} onClick={() => void handleDemanderComplement()}>
                {submitting ? 'Envoi…' : 'Envoyer le complément'}
              </button>
            </>
          )}
          {enRepriseBudget && (
            <button type="button" className="gp-btn gp-btn--primary" disabled={submitting} onClick={() => void handleRetransmettreBudget()}>
              {submitting ? 'Envoi…' : 'Retransmettre à la CB'}
            </button>
          )}
        </div>
      </div>

      {confirmDeleteOpen && (
        <div className="gp-overlay is-open">
          <div className="gp-modal" role="dialog" aria-modal="true" aria-labelledby="deleteCsfRcModalTitle">
            <div className="gp-modal__hd">
              <h3 className="gp-modal__title" id="deleteCsfRcModalTitle">
                Supprimer le certificat de service fait
              </h3>
              <button className="gp-modal__close" aria-label="Fermer" onClick={() => setConfirmDeleteOpen(false)}>
                <svg className="ti">
                  <use href="#i-x" />
                </svg>
              </button>
            </div>
            <div className="gp-modal__bd gp-scroll stack">
              <p>Supprimer définitivement « {certificat.numero_csf} » ? Cette action est irréversible.</p>
            </div>
            <div className="gp-modal__ft">
              <button type="button" className="gp-btn gp-btn--secondary" onClick={() => setConfirmDeleteOpen(false)}>
                Annuler
              </button>
              <button type="button" className="gp-btn gp-btn--danger" disabled={deleting} onClick={() => void confirmDelete()}>
                {deleting ? 'Suppression…' : 'Supprimer'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────
// TraiterCsfBudgetModal — écran de suivi CB (OP2.3/OP2.4). CSF_TRANSMIS_BUDGET :
// valider (déclenche le paiement PGI, alerte R2 non bloquante) ou demander un
// complément au RC. CSF_VALIDE_BUDGET : constater la liquidation (OP2.4,
// retour PGI). La CB ne modifie jamais le justificatif ni le montant (MCD §5-§6).
// ─────────────────────────────────────────────────────────────────────────

interface TraiterCsfBudgetModalProps {
  certificat: CertificatServiceFait
  onClose: () => void
  onSaved: () => void
}

export function TraiterCsfBudgetModal({ certificat, onClose, onSaved }: TraiterCsfBudgetModalProps) {
  const enControle = certificat.code_statut_csf === STATUT_CSF_A_TRAITER_BUDGET
  const valide = certificat.code_statut_csf === STATUT_CSF_VALIDE_BUDGET

  const [complementOpen, setComplementOpen] = useState(false)
  const [commentaireComplement, setCommentaireComplement] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [alerteDepassement, setAlerteDepassement] = useState(false)

  async function handleValider() {
    setError(null)
    setSubmitting(true)
    try {
      const result = await validerBudget(certificat.id_csf)
      if (result.alerteDepassement) {
        setAlerteDepassement(true)
        setSubmitting(false)
        return
      }
      onSaved()
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Une erreur est survenue.')
      setSubmitting(false)
    }
  }

  async function handleDemanderComplement() {
    setError(null)
    if (!commentaireComplement.trim()) {
      setError('Le motif du complément est requis.')
      return
    }
    setSubmitting(true)
    try {
      await demanderComplementBudget(certificat.id_csf, commentaireComplement.trim())
      onSaved()
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Une erreur est survenue.')
    } finally {
      setSubmitting(false)
    }
  }

  async function handleConstaterLiquidation() {
    setError(null)
    setSubmitting(true)
    try {
      await constaterLiquidation(certificat.id_csf)
      onSaved()
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Une erreur est survenue.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="gp-overlay is-open">
      <div className="gp-modal" role="dialog" aria-modal="true" aria-labelledby="traiterCsfBudgetModalTitle" style={{ maxWidth: 680 }}>
        <div className="gp-modal__hd">
          <h3 className="gp-modal__title" id="traiterCsfBudgetModalTitle">
            {certificat.numero_csf} — Contrôle budgétaire
          </h3>
          <button className="gp-modal__close" aria-label="Fermer" onClick={onClose}>
            <svg className="ti">
              <use href="#i-x" />
            </svg>
          </button>
        </div>
        <div className="gp-modal__bd gp-scroll stack">
          {alerteDepassement && (
            <p className="gp-errmsg" style={{ background: 'var(--gp-warning-bg)', color: 'var(--gp-warning-text)' }}>
              <svg className="ti">
                <use href="#i-alert-triangle" />
              </svg>
              Le cumul des certificats validés dépasse le montant commandé de la FAD (alerte non bloquante).
            </p>
          )}

          <div className="row" style={{ flexWrap: 'wrap' }}>
            <div className="gp-field" style={{ flex: 1 }}>
              <label className="gp-label">Montant certifié</label>
              <input className="gp-input" value={certificat.montant_csf !== null ? formatMontantDecimal(String(certificat.montant_csf)) : '—'} readOnly />
            </div>
            <div className="gp-field" style={{ flex: 1 }}>
              <label className="gp-label">Date de service fait</label>
              <input
                className="gp-input"
                value={certificat.date_service_fait ? new Date(certificat.date_service_fait).toLocaleDateString('fr-FR') : '—'}
                readOnly
              />
            </div>
          </div>
          <div className="gp-field">
            <label className="gp-label">Description</label>
            <textarea className="gp-textarea" value={certificat.description ?? ''} readOnly rows={3} />
          </div>

          <PiecesCsf idCsf={certificat.id_csf} editable={false} />

          {enControle && complementOpen && (
            <div className="gp-field">
              <label className="gp-label" htmlFor="traitercsfbudget-motif-complement">
                Motif du complément demandé au RC
              </label>
              <textarea
                id="traitercsfbudget-motif-complement"
                className="gp-textarea"
                value={commentaireComplement}
                onChange={(e) => setCommentaireComplement(e.target.value)}
                rows={3}
                maxLength={500}
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
          {alerteDepassement && (
            <button type="button" className="gp-btn gp-btn--primary" onClick={() => onSaved()}>
              Fermer
            </button>
          )}
          {!alerteDepassement && enControle && !complementOpen && (
            <>
              <button type="button" className="gp-btn gp-btn--secondary" disabled={submitting} onClick={() => setComplementOpen(true)}>
                Demander un complément
              </button>
              <button type="button" className="gp-btn gp-btn--primary" disabled={submitting} onClick={() => void handleValider()}>
                {submitting ? 'Envoi…' : 'Valider'}
              </button>
            </>
          )}
          {!alerteDepassement && enControle && complementOpen && (
            <>
              <button type="button" className="gp-btn gp-btn--secondary" disabled={submitting} onClick={() => setComplementOpen(false)}>
                Retour
              </button>
              <button type="button" className="gp-btn gp-btn--primary" disabled={submitting} onClick={() => void handleDemanderComplement()}>
                {submitting ? 'Envoi…' : 'Envoyer le complément'}
              </button>
            </>
          )}
          {!alerteDepassement && valide && (
            <button type="button" className="gp-btn gp-btn--primary" disabled={submitting} onClick={() => void handleConstaterLiquidation()}>
              {submitting ? 'Envoi…' : 'Constater la liquidation'}
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
