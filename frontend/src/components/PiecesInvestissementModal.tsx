import { useState } from 'react'
import { usePiecesInvestissement, type InvestissementPiece, type TypePiece } from '../hooks/usePiecesInvestissement'
import { Combobox } from './Combobox'
import { SpinButton } from './SpinButton'

const TYPE_PIECE_OPTIONS: { value: TypePiece; label: string }[] = [
  { value: 'RAPPORT_CODIR', label: 'Rapport CODIR' },
  { value: 'RAPPORT_CODIR_VALIDE', label: 'Rapport CODIR validé' },
  { value: 'RAPPORT_CODIR_ANNEXES', label: 'Rapport CODIR — Annexes' },
  { value: 'RAPPORT_CODIR_PLANS', label: 'Rapport CODIR — Plans' },
  { value: 'DECISION_DIRECTOIRE', label: 'Décision Directoire' },
  { value: 'DECISION_DIRECTOIRE_ANNEXES', label: 'Décision Directoire — Annexes' },
  { value: 'DECISION_DIRECTOIRE_PLANS', label: 'Décision Directoire — Plans' },
  { value: 'RAPPORT_CS', label: 'Rapport CS' },
  { value: 'RAPPORT_CS_VALIDE', label: 'Rapport CS validé' },
  { value: 'RAPPORT_CS_DOE', label: 'Rapport CS — DOE' },
  { value: 'RAPPORT_CS_ANNEXES', label: 'Rapport CS — Annexes' },
  { value: 'RAPPORT_CS_PLANS', label: 'Rapport CS — Plans' },
  { value: 'DECISION_CS', label: 'Décision CS' },
  { value: 'FICHE_OUVERTURE_HO_VALIDEE', label: "Fiche d'ouverture HO validée" },
  { value: 'PROJET_TECHNIQUE', label: 'Projet technique' },
  { value: 'AUTRE', label: 'Autre' },
]

function libelleTypePiece(type: TypePiece): string {
  return TYPE_PIECE_OPTIONS.find((o) => o.value === type)?.label ?? type
}

function formatTaille(octets: number): string {
  if (octets < 1024) return `${octets} o`
  if (octets < 1024 * 1024) return `${Math.round(octets / 1024)} Ko`
  return `${(octets / (1024 * 1024)).toFixed(1)} Mo`
}

function formatDateHeureFr(iso: string): string {
  return new Date(iso).toLocaleString('fr-FR', { dateStyle: 'short', timeStyle: 'short' })
}

interface PiecesInvestissementModalProps {
  numeroOperation: string
  label: string
  canManage: boolean
  onClose: () => void
}

/**
 * Consultation des pièces d'une opération d'investissement (icône « Visualiser
 * les pièces » des cartes, ouverte à tout le monde) — téléchargement toujours
 * possible ; modification du couple type/numéro de réévaluation et
 * suppression réservées `canManage` (ADMIN_APP/ADMIN_SERVICE/CB), même
 * périmètre que le dépôt (AddPieceInvestissementModal). Mirroir de
 * PiecesMarcheModal.tsx, simplifié (une seule référence numero_operation).
 */
export function PiecesInvestissementModal({ numeroOperation, label, canManage, onClose }: PiecesInvestissementModalProps) {
  const { pieces, loading, error, mutation, updatePieceMetadata, deletePiece, downloadPiece } =
    usePiecesInvestissement(numeroOperation)
  const [editingId, setEditingId] = useState<number | null>(null)
  const [editTypePiece, setEditTypePiece] = useState<TypePiece>('AUTRE')
  const [editNumeroReevaluation, setEditNumeroReevaluation] = useState('0')
  const [pieceToDelete, setPieceToDelete] = useState<InvestissementPiece | null>(null)

  function startEdit(piece: InvestissementPiece) {
    setEditingId(piece.id_investissement_piece)
    setEditTypePiece(piece.type_piece)
    setEditNumeroReevaluation(String(piece.numero_reevaluation))
  }

  async function saveEdit(idInvestissementPiece: number) {
    const ok = await updatePieceMetadata(idInvestissementPiece, editTypePiece, Number(editNumeroReevaluation))
    if (ok) setEditingId(null)
  }

  async function confirmDelete() {
    if (!pieceToDelete) return
    const ok = await deletePiece(pieceToDelete.id_investissement_piece)
    if (ok) setPieceToDelete(null)
  }

  return (
    <div className="gp-overlay is-open">
      <div className="gp-modal" role="dialog" aria-modal="true" aria-labelledby="piecesInvestissementModalTitle" style={{ maxWidth: 860 }}>
        <div className="gp-modal__hd">
          <h3 className="gp-modal__title" id="piecesInvestissementModalTitle">
            Pièces — {label}
          </h3>
          <button className="gp-modal__close" aria-label="Fermer" onClick={onClose}>
            <svg className="ti">
              <use href="#i-x" />
            </svg>
          </button>
        </div>
        <div className="gp-modal__bd gp-scroll stack">
          {loading && <p>Chargement…</p>}
          {!loading && pieces.length === 0 && <p>Aucune pièce déposée pour cette opération.</p>}
          {!loading && pieces.length > 0 && (
            <div className="stack" style={{ gap: 10 }}>
              {pieces.map((piece) => (
                <div key={piece.id_investissement_piece} className="investissement-piece-row">
                  {editingId === piece.id_investissement_piece ? (
                    <div className="row" style={{ gap: 10, flex: 1, flexWrap: 'wrap' }}>
                      <Combobox
                        options={TYPE_PIECE_OPTIONS}
                        value={editTypePiece}
                        onChange={(v) => {
                          if (v) setEditTypePiece(v as TypePiece)
                        }}
                        placeholder="Type de pièce"
                        ariaLabel="Type de pièce"
                      />
                      <SpinButton
                        value={editNumeroReevaluation}
                        onChange={setEditNumeroReevaluation}
                        min={0}
                        ariaLabel="Numéro de réévaluation"
                      />
                      <button
                        type="button"
                        className="gp-btn gp-btn--primary"
                        onClick={() => saveEdit(piece.id_investissement_piece)}
                        disabled={mutation.step === 'busy'}
                      >
                        Enregistrer
                      </button>
                      <button type="button" className="gp-btn gp-btn--secondary" onClick={() => setEditingId(null)}>
                        Annuler
                      </button>
                    </div>
                  ) : (
                    <>
                      <div className="investissement-piece-row__info">
                        <span className="gp-badge">{libelleTypePiece(piece.type_piece)}</span>
                        <span>Réévaluation {piece.numero_reevaluation}</span>
                        <span className="investissement-piece-row__filename">{piece.nom_fichier_original}</span>
                        <span className="gp-help">
                          {formatTaille(piece.taille_octets)} — {formatDateHeureFr(piece.created_at)}
                        </span>
                      </div>
                      <div className="gp-rowacts">
                        <span className="gp-tip" data-tip="Télécharger">
                          <button aria-label="Télécharger" onClick={() => downloadPiece(piece)}>
                            <svg className="ti">
                              <use href="#i-download" />
                            </svg>
                          </button>
                        </span>
                        {canManage && (
                          <span className="gp-tip" data-tip="Modifier">
                            <button aria-label="Modifier" onClick={() => startEdit(piece)}>
                              <svg className="ti">
                                <use href="#i-pencil" />
                              </svg>
                            </button>
                          </span>
                        )}
                        {canManage && (
                          <span className="gp-tip" data-tip="Supprimer">
                            <button className="del" aria-label="Supprimer" onClick={() => setPieceToDelete(piece)}>
                              <svg className="ti">
                                <use href="#i-trash" />
                              </svg>
                            </button>
                          </span>
                        )}
                      </div>
                    </>
                  )}
                </div>
              ))}
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
        </div>
      </div>

      {pieceToDelete && (
        <div className="gp-overlay is-open">
          <div className="gp-modal" role="dialog" aria-modal="true" aria-labelledby="deleteInvestissementPieceModalTitle">
            <div className="gp-modal__hd">
              <h3 className="gp-modal__title" id="deleteInvestissementPieceModalTitle">
                Supprimer la pièce
              </h3>
              <button className="gp-modal__close" aria-label="Fermer" onClick={() => setPieceToDelete(null)}>
                <svg className="ti">
                  <use href="#i-x" />
                </svg>
              </button>
            </div>
            <div className="gp-modal__bd gp-scroll stack">
              <p>Supprimer définitivement « {pieceToDelete.nom_fichier_original} » ? Cette action est irréversible.</p>
            </div>
            <div className="gp-modal__ft">
              <button type="button" className="gp-btn gp-btn--secondary" onClick={() => setPieceToDelete(null)}>
                Annuler
              </button>
              <button type="button" className="gp-btn gp-btn--danger" onClick={confirmDelete} disabled={mutation.step === 'busy'}>
                {mutation.step === 'busy' ? 'Suppression…' : 'Supprimer'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
