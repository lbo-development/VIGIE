import { useState, type FormEvent } from 'react'
import { usePiecesInvestissement, type TypePiece } from '../hooks/usePiecesInvestissement'
import { Combobox } from './Combobox'
import { SpinButton } from './SpinButton'
import { FileDropzone } from './FileDropzone'

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

const MAX_TAILLE_OCTETS = 10 * 1024 * 1024

interface AddPieceInvestissementModalProps {
  numeroOperation: string
  label: string
  onClose: () => void
  onSaved: () => void
}

/**
 * Dépôt d'une pièce (icône « Ajouter une pièce » des cartes, réservée
 * `canManage` — contrôlé par l'appelant, InvestissementsPGI.tsx). Mirroir de
 * AddPieceMarcheModal.tsx : type de pièce et numéro de réévaluation demandés
 * avant l'intégration du fichier, modifiables ensuite indépendamment via
 * PiecesInvestissementModal.
 */
export function AddPieceInvestissementModal({ numeroOperation, label, onClose, onSaved }: AddPieceInvestissementModalProps) {
  const { uploadPiece, mutation } = usePiecesInvestissement(numeroOperation)
  const [typePiece, setTypePiece] = useState<TypePiece>('RAPPORT_CODIR')
  const [numeroReevaluation, setNumeroReevaluation] = useState('0')
  const [file, setFile] = useState<File | null>(null)
  const [formError, setFormError] = useState<string | null>(null)

  async function handleSubmit(event: FormEvent) {
    event.preventDefault()
    setFormError(null)
    if (!file) {
      setFormError('Un fichier est requis.')
      return
    }
    const ok = await uploadPiece(file, typePiece, Number(numeroReevaluation))
    if (ok) onSaved()
  }

  return (
    <div className="gp-overlay is-open">
      <div className="gp-modal" role="dialog" aria-modal="true" aria-labelledby="addPieceInvestissementModalTitle" style={{ maxWidth: 640 }}>
        <div className="gp-modal__hd">
          <h3 className="gp-modal__title" id="addPieceInvestissementModalTitle">
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
                <label className="gp-label" htmlFor="piece-numero-reevaluation">
                  Numéro de réévaluation
                </label>
                <SpinButton
                  id="piece-numero-reevaluation"
                  ariaLabel="Numéro de réévaluation"
                  min={0}
                  step={1}
                  value={numeroReevaluation}
                  onChange={setNumeroReevaluation}
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
