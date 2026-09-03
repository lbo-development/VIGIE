import { useState, type FormEvent } from 'react'
import { usePiecesMarche, type MarcheRef, type TypePiece } from '../hooks/usePiecesMarche'
import { Combobox } from './Combobox'
import { SpinButton } from './SpinButton'
import { FileDropzone } from './FileDropzone'

const TYPE_PIECE_OPTIONS: { value: TypePiece; label: string }[] = [
  { value: 'CCAP', label: 'CCAP' },
  { value: 'CCTP', label: 'CCTP' },
  { value: 'AE', label: 'AE' },
  { value: 'AVENANT', label: 'AVENANT' },
  { value: 'BPU', label: 'BPU' },
  { value: 'AUTRE', label: 'Autre' },
]

const MAX_TAILLE_OCTETS = 10 * 1024 * 1024

interface AddPieceMarcheModalProps {
  marcheRef: MarcheRef
  label: string
  onClose: () => void
  onSaved: () => void
}

/**
 * Dépôt d'une pièce (icône « Ajouter une pièce » des cartes, réservée
 * `canManage` — contrôlé par l'appelant, MarchesPGI.tsx/MarchesTiers.tsx).
 * Type de pièce et numéro d'avenant demandés avant l'intégration du fichier
 * (décision du 02/09/2026), modifiables ensuite indépendamment via
 * PiecesMarcheModal.
 */
export function AddPieceMarcheModal({ marcheRef, label, onClose, onSaved }: AddPieceMarcheModalProps) {
  const { uploadPiece, mutation } = usePiecesMarche(marcheRef)
  const [typePiece, setTypePiece] = useState<TypePiece>('CCAP')
  const [numeroAvenant, setNumeroAvenant] = useState('0')
  const [file, setFile] = useState<File | null>(null)
  const [formError, setFormError] = useState<string | null>(null)

  async function handleSubmit(event: FormEvent) {
    event.preventDefault()
    setFormError(null)
    if (!file) {
      setFormError('Un fichier est requis.')
      return
    }
    const ok = await uploadPiece(file, typePiece, Number(numeroAvenant))
    if (ok) onSaved()
  }

  return (
    <div className="gp-overlay is-open">
      <div className="gp-modal" role="dialog" aria-modal="true" aria-labelledby="addPieceModalTitle" style={{ maxWidth: 640 }}>
        <div className="gp-modal__hd">
          <h3 className="gp-modal__title" id="addPieceModalTitle">
            Ajouter une pièce — {label}
          </h3>
          <button className="gp-modal__close" aria-label="Fermer" onClick={onClose}>
            <svg className="ti">
              <use href="#i-x" />
            </svg>
          </button>
        </div>
        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', minHeight: 0, overflow: 'hidden' }}>
          <div className="gp-modal__bd gp-scroll stack">
            <div className="row">
              <div className="gp-field" style={{ flex: 1 }}>
                <label className="gp-label">Type de pièce</label>
                <Combobox
                  options={TYPE_PIECE_OPTIONS}
                  value={typePiece}
                  onChange={(v) => {
                    if (v) setTypePiece(v as TypePiece)
                  }}
                  placeholder="Type de pièce"
                  ariaLabel="Type de pièce"
                  style={{ maxWidth: 'none' }}
                />
              </div>
              <div className="gp-field" style={{ flex: 1 }}>
                <label className="gp-label" htmlFor="piece-numero-avenant">
                  Numéro d'avenant
                </label>
                <SpinButton
                  id="piece-numero-avenant"
                  ariaLabel="Numéro d'avenant"
                  min={0}
                  step={1}
                  value={numeroAvenant}
                  onChange={setNumeroAvenant}
                />
              </div>
            </div>
            <div className="gp-field">
              <label className="gp-label">Fichier (PDF, 10 Mo max)</label>
              <FileDropzone
                accept="application/pdf"
                maxSizeOctets={MAX_TAILLE_OCTETS}
                file={file}
                onFileSelected={setFile}
                disabled={mutation.step === 'busy'}
              />
            </div>
            {(formError || mutation.step === 'error') && (
              <p className="gp-errmsg">
                <svg className="ti">
                  <use href="#i-alert-circle" />
                </svg>
                {formError ?? (mutation.step === 'error' ? mutation.message : '')}
              </p>
            )}
          </div>
          <div className="gp-modal__ft">
            <button type="button" className="gp-btn gp-btn--secondary" onClick={onClose}>
              Annuler
            </button>
            <button type="submit" className="gp-btn gp-btn--primary" disabled={mutation.step === 'busy'}>
              {mutation.step === 'busy' ? 'Envoi…' : 'Ajouter'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
