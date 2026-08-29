import { useEffect, useRef, useState, type CSSProperties } from 'react'

export interface ComboboxOption {
  value: string
  label: string
}

interface ComboboxProps {
  options: ComboboxOption[]
  value: string | null
  onChange: (value: string | null) => void
  placeholder: string
  /** Libellé de l'option "aucun filtre" en tête de liste (ex: "Tous les services"). Omis = pas d'option de retrait. */
  clearLabel?: string
  /** Nom accessible du déclencheur — le trigger n'est pas un <label>-able natif. */
  ariaLabel?: string
  /**
   * Applique sur la racine .gp-combobox — sert notamment à lever le
   * max-width:340px par défaut (gpmm.css) quand la combo doit occuper toute
   * la largeur d'un champ de formulaire, comme les .gp-input voisins.
   */
  style?: CSSProperties
}

/**
 * Sélecteur simple (une seule valeur), réimplémentation React du composant
 * .gp-combobox du template GPMM (app.js gère normalement ce toggle, non
 * chargé ici — voir la mémoire projet "UX React integration").
 */
export function Combobox({ options, value, onChange, placeholder, clearLabel, ariaLabel, style }: ComboboxProps) {
  const [open, setOpen] = useState(false)
  const rootRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (rootRef.current && !rootRef.current.contains(event.target as Node)) setOpen(false)
    }
    document.addEventListener('click', handleClickOutside)
    return () => document.removeEventListener('click', handleClickOutside)
  }, [])

  const selected = options.find((option) => option.value === value)

  const select = (next: string | null) => {
    onChange(next)
    setOpen(false)
  }

  return (
    <div className={`gp-combobox${open ? ' is-open' : ''}`} style={style} ref={rootRef}>
      <div
        className="gp-inputgroup"
        data-cb-trigger
        role="button"
        tabIndex={0}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label={ariaLabel}
        onClick={() => setOpen((current) => !current)}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault()
            setOpen((current) => !current)
          }
        }}
      >
        <span style={{ flex: 1, color: selected ? undefined : 'var(--gp-text-muted)' }}>
          {selected ? selected.label : placeholder}
        </span>
        <svg className="ti chevron">
          <use href="#i-chevron-down" />
        </svg>
      </div>
      {open && (
        <div className="gp-menu">
          {clearLabel && (
            <div className="gp-opt" onClick={() => select(null)}>
              {clearLabel}
            </div>
          )}
          {options.map((option) => (
            <div key={option.value} className="gp-opt" onClick={() => select(option.value)}>
              {option.label}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
