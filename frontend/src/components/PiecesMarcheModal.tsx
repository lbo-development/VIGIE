import { useState } from 'react'
import { usePiecesMarche, type MarchePiece, type MarcheRef, type TypePiece } from '../hooks/usePiecesMarche'
import { Combobox } from './Combobox'
import { SpinButton } from './SpinButton'

const TYPE_PIECE_OPTIONS: { value: TypePiece; label: string }[] = [
  { value: 'CCAP', label: 'CCAP' },
  { value: 'CCTP', label: 'CCTP' },
  { value: 'AE', label: 'AE' },
  { value: 'AVENANT', label: 'AVENANT' },
  { value: 'BPU', label: 'BPU' },
  { value: 'AUTRE', label: 'Autre' },
]

function formatTaille(octets: number): string {
  if (octets < 1024) return `${octets} o`
  if (octets < 1024 * 1024) return `${Math.round(octets / 1024)} Ko`
  return `${(octets / (1024 * 1024)).toFixed(1)} Mo`
}

function formatDateHeureFr(iso: string): string {
  return new Date(iso).toLocaleString('fr-FR', { dateStyle: 'short', timeStyle: 'short' })
}

interface PiecesMarcheModalProps {
  marcheRef: MarcheRef
  label: string
  canManage: boolean
  onClose: () => void
}

/**
 * Consultation des pièces d'un marché (icône « Visualiser les pièces » des
 * cartes, ouverte à tout le monde) — téléchargement toujours possible ;
 * modification du couple type/numéro d'avenant et suppression réservées
 * `canManage` (ADMIN_APP/ADMIN_SERVICE/CB), même périmètre que le dépôt
 * (AddPieceMarcheModal). Liste triée par numéro d'avenant puis type de pièce
 * côté backend (marchePiece.repository.ts).
 */
export function PiecesMarcheModal({ marcheRef, label, canManage, onClose }: PiecesMarcheModalProps) {
  const { pieces, loading, error, mutation, updatePieceMetadata, deletePiece, downloadPiece } = usePiecesMarche(marcheRef)
  const [editingId, setEditingId] = useState<number | null>(null)
  const [editTypePiece, setEditTypePiece] = useState<TypePiece>('AUTRE')
  const [editNumeroAvenant, setEditNumeroAvenant] = useState('0')
  const [pieceToDelete, setPieceToDelete] = useState<MarchePiece | null>(null)

  function startEdit(piece: MarchePiece) {
    setEditingId(piece.id_marche_piece)
    setEditTypePiece(piece.type_piece)
    setEditNumeroAvenant(String(piece.numero_avenant))
  }

  async function saveEdit(idMarchePiece: number) {
    const ok = await updatePieceMetadata(idMarchePiece, editTypePiece, Number(editNumeroAvenant))
    if (ok) setEditingId(null)
  }

  async function confirmDelete() {
    if (!pieceToDelete) return
    const ok = await deletePiece(pieceToDelete.id_marche_piece)
    if (ok) setPieceToDelete(null)
  }

  return (
    <div className="gp-overlay is-open">
      <div className="gp-modal" role="dialog" aria-modal="true" aria-labelledby="piecesMarcheModalTitle" style={{ maxWidth: 860 }}>
        <div className="gp-modal__hd">
          <h3 className="gp-modal__title" id="piecesMarcheModalTitle">
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
          {!loading && pieces.length === 0 && <p>Aucune pièce déposée pour ce marché.</p>}
          {!loading && pieces.length > 0 && (
            <div className="stack" style={{ gap: 10 }}>
              {pieces.map((piece) => (
                <div key={piece.id_marche_piece} className="marche-piece-row">
                  {editingId === piece.id_marche_piece ? (
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
                      <SpinButton value={editNumeroAvenant} onChange={setEditNumeroAvenant} min={0} ariaLabel="Numéro d'avenant" />
                      <button
                        type="button"
                        className="gp-btn gp-btn--primary"
                        onClick={() => saveEdit(piece.id_marche_piece)}
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
                      <div className="marche-piece-row__info">
                        <span className="gp-badge">{piece.type_piece}</span>
                        <span>Avenant {piece.numero_avenant}</span>
                        <span className="marche-piece-row__filename">{piece.nom_fichier_original}</span>
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
          <div className="gp-modal" role="dialog" aria-modal="true" aria-labelledby="deletePieceModalTitle">
            <div className="gp-modal__hd">
              <h3 className="gp-modal__title" id="deletePieceModalTitle">
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
