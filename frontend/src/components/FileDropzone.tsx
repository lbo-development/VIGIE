import { useRef, useState } from 'react'

export interface FileDropzoneProps {
  /** Valeur d'attribut `accept` standard (ex. "application/pdf") — aussi utilisée pour rejeter un dépôt du mauvais type. */
  accept: string
  maxSizeOctets: number
  file: File | null
  onFileSelected: (file: File) => void
  disabled?: boolean
}

function formatTaille(octets: number): string {
  if (octets < 1024) return `${octets} o`
  if (octets < 1024 * 1024) return `${Math.round(octets / 1024)} Ko`
  return `${(octets / (1024 * 1024)).toFixed(1)} Mo`
}

/**
 * Zone de dépôt de fichier (drag & drop + clic), composant dédié requis par
 * ForClaude/INSTRUCTIONS_UX.md (aucun composant équivalent dans
 * gpmm-style-guide.html — motif nouveau, à valider visuellement). Toutes les
 * valeurs visuelles passent par les variables --gp-* (styles/gpmm.css,
 * classes .gp-dropzone* — composant partagé entre plusieurs pages),
 * contrairement au précédent ad-hoc de ImportMarches.tsx qui codait des
 * couleurs de repli en dur.
 */
export function FileDropzone({ accept, maxSizeOctets, file, onFileSelected, disabled }: FileDropzoneProps) {
  const [dragActive, setDragActive] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  function validateAndSelect(candidate: File | null | undefined) {
    if (!candidate) return
    const acceptedTypes = accept.split(',').map((t) => t.trim())
    if (!acceptedTypes.includes(candidate.type)) {
      setError('Format de fichier non accepté.')
      return
    }
    if (candidate.size > maxSizeOctets) {
      setError(`Le fichier dépasse la taille maximale autorisée (${formatTaille(maxSizeOctets)}).`)
      return
    }
    setError(null)
    onFileSelected(candidate)
  }

  return (
    <div className="stack" style={{ gap: 8 }}>
      <div
        className={`gp-dropzone${dragActive ? ' is-dragging' : ''}${disabled ? ' is-disabled' : ''}`}
        role="button"
        tabIndex={disabled ? -1 : 0}
        aria-disabled={disabled}
        onDragOver={(e) => {
          e.preventDefault()
          if (!disabled) setDragActive(true)
        }}
        onDragLeave={() => setDragActive(false)}
        onDrop={(e) => {
          e.preventDefault()
          setDragActive(false)
          if (!disabled) validateAndSelect(e.dataTransfer.files?.[0])
        }}
        onClick={() => !disabled && inputRef.current?.click()}
        onKeyDown={(e) => {
          if (!disabled && (e.key === 'Enter' || e.key === ' ')) {
            e.preventDefault()
            inputRef.current?.click()
          }
        }}
      >
        <svg className="ti gp-dropzone__icon">
          <use href="#i-cloud" />
        </svg>
        {file ? (
          <p className="gp-dropzone__file">
            {file.name} <span className="gp-help">({formatTaille(file.size)})</span>
          </p>
        ) : (
          <p>Glisse-dépose un fichier ici, ou clique pour le choisir.</p>
        )}
        <input
          ref={inputRef}
          type="file"
          accept={accept}
          hidden
          disabled={disabled}
          onChange={(e) => validateAndSelect(e.target.files?.[0])}
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
  )
}
