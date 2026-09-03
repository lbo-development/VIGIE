import type { CSSProperties } from 'react'

export interface SpinButtonProps {
  /** Valeur brute du champ (texte, pas number) — laisse l'appelant décider de la conversion/validation, comme les autres champs texte de l'application. */
  value: string
  onChange: (value: string) => void
  id?: string
  ariaLabel?: string
  min?: number
  max?: number
  step?: number
  style?: CSSProperties
}

/**
 * Réimplémentation React du composant `.gp-spin` du template GPMM (variante
 * desktop, chevrons haut/bas — voir `ForClaude/INSTRUCTIONS_UX.md`, section
 * « Spécificité VIGIE » : `app.js`/`initSpinButtons` n'est pas chargé dans
 * cette SPA, même principe que `Combobox.tsx`/`DatePicker.tsx`).
 */
export function SpinButton({ value, onChange, id, ariaLabel, min, max, step = 1, style }: SpinButtonProps) {
  function nudge(direction: 1 | -1) {
    const current = Number(value)
    const base = Number.isFinite(current) ? current : (min ?? 0)
    let next = base + direction * step
    if (min !== undefined) next = Math.max(min, next)
    if (max !== undefined) next = Math.min(max, next)
    onChange(String(next))
  }

  const atMax = max !== undefined && Number(value) >= max
  const atMin = min !== undefined && Number(value) <= min

  return (
    <div className="gp-spin" style={style}>
      <input
        id={id}
        className="gp-spin__input"
        type="number"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        min={min}
        max={max}
        step={step}
        aria-label={ariaLabel}
      />
      <span className="gp-spin__steps">
        <button
          type="button"
          className="gp-spin__step"
          aria-label={ariaLabel ? `Augmenter ${ariaLabel}` : 'Augmenter'}
          onClick={() => nudge(1)}
          disabled={atMax}
        >
          <span className="gp-chev gp-chev--up" />
        </button>
        <button
          type="button"
          className="gp-spin__step"
          aria-label={ariaLabel ? `Diminuer ${ariaLabel}` : 'Diminuer'}
          onClick={() => nudge(-1)}
          disabled={atMin}
        >
          <span className="gp-chev gp-chev--down" />
        </button>
      </span>
    </div>
  )
}
