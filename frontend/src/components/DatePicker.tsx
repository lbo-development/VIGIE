import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { useFloatingPosition } from '../hooks/useFloatingPosition'

export interface DatePickerProps {
  /** Date au format ISO 'YYYY-MM-DD', ou `null` si vide. */
  value: string | null
  onChange: (value: string | null) => void
  ariaLabel?: string
  id?: string
}

const DOW_LABELS = ['Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam', 'Dim']
const MONTH_LABELS = [
  'Janvier',
  'Février',
  'Mars',
  'Avril',
  'Mai',
  'Juin',
  'Juillet',
  'Août',
  'Septembre',
  'Octobre',
  'Novembre',
  'Décembre',
]

function isoToFr(iso: string | null): string {
  if (!iso) return ''
  const [y, m, d] = iso.split('-')
  return `${d}/${m}/${y}`
}

/** 'JJ/MM/AAAA' -> ISO, avec contrôle de calendrier réel (31/02 rejeté) — null si vide ou invalide. */
function parseFr(text: string): string | null {
  const match = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(text.trim())
  if (!match) return null
  const day = Number(match[1])
  const month = Number(match[2])
  const year = Number(match[3])
  const date = new Date(Date.UTC(year, month - 1, day))
  if (date.getUTCFullYear() !== year || date.getUTCMonth() !== month - 1 || date.getUTCDate() !== day) return null
  return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`
}

function pad2(n: number): string {
  return String(n).padStart(2, '0')
}

function daysInMonth(year: number, month: number): number {
  return new Date(Date.UTC(year, month + 1, 0)).getUTCDate()
}

/** Index du jour de semaine, lundi=0 … dimanche=6 (colonnes week-end en bande continue, cf. gpmm.css .gp-dp__dow.we). */
function mondayIndex(date: Date): number {
  return (date.getUTCDay() + 6) % 7
}

interface DayCell {
  day: number
  iso: string
  otherMonth: boolean
  weekend: boolean
}

function buildGrid(viewYear: number, viewMonth: number): DayCell[] {
  const leading = mondayIndex(new Date(Date.UTC(viewYear, viewMonth, 1)))
  const totalDays = daysInMonth(viewYear, viewMonth)
  const prevMonth = viewMonth === 0 ? 11 : viewMonth - 1
  const prevYear = viewMonth === 0 ? viewYear - 1 : viewYear
  const prevMonthDays = daysInMonth(prevYear, prevMonth)
  const nextMonth = viewMonth === 11 ? 0 : viewMonth + 1
  const nextYear = viewMonth === 11 ? viewYear + 1 : viewYear

  const cells: DayCell[] = []
  for (let i = 0; i < leading; i++) {
    const day = prevMonthDays - leading + i + 1
    cells.push({ day, iso: `${prevYear}-${pad2(prevMonth + 1)}-${pad2(day)}`, otherMonth: true, weekend: false })
  }
  for (let day = 1; day <= totalDays; day++) {
    cells.push({ day, iso: `${viewYear}-${pad2(viewMonth + 1)}-${pad2(day)}`, otherMonth: false, weekend: false })
  }
  let nextDay = 1
  while (cells.length < 42) {
    cells.push({ day: nextDay, iso: `${nextYear}-${pad2(nextMonth + 1)}-${pad2(nextDay)}`, otherMonth: true, weekend: false })
    nextDay += 1
  }
  cells.forEach((cell, i) => {
    cell.weekend = i % 7 >= 5
  })
  return cells
}

/**
 * Réimplémentation React du composant `.gp-dp` du template GPMM (voir
 * `ForClaude/Template UX/GUIDELINES.md` — `app.js`/`initDatepicker` pilote ce
 * composant dans le template statique, non chargé dans cette SPA ; même
 * principe que `Combobox.tsx` pour `.gp-combobox`).
 *
 * Simplification assumée par rapport au gabarit : la saisie directe se fait
 * dans le champ texte principal (JJ/MM/AAAA), pas via le triptyque
 * `.gp-dp__direct` à 3 segments auto-avançants du gabarit — capacité de
 * saisie directe équivalente pour l'utilisateur, implémentation plus simple.
 * Le sélecteur rapide mois/année (`.gp-dp__nav-sel`) reste un libellé
 * d'affichage, pas un menu déroulant — navigation uniquement via les flèches
 * précédent/suivant.
 *
 * Le panneau (`.gp-dp__panel`) est rendu via un portail dans `document.body`
 * plutôt qu'en position absolue dans `.gp-dp` : un ancêtre en `overflow` non
 * visible (ex. le corps scrollable d'une modale) le rognerait sinon dès qu'il
 * dépasse — voir `useFloatingPosition` et `ForClaude/INSTRUCTIONS_UX.md`.
 */
export function DatePicker({ value, onChange, ariaLabel, id }: DatePickerProps) {
  const [open, setOpen] = useState(false)
  const [text, setText] = useState(isoToFr(value))
  const rootRef = useRef<HTMLDivElement>(null)
  const panelRef = useRef<HTMLDivElement>(null)
  const position = useFloatingPosition(open, rootRef)
  const today = new Date()
  const todayIso = today.toISOString().slice(0, 10)

  const initialView = value ? new Date(`${value}T00:00:00Z`) : today
  const [viewYear, setViewYear] = useState(initialView.getUTCFullYear())
  const [viewMonth, setViewMonth] = useState(initialView.getUTCMonth())

  useEffect(() => {
    setText(isoToFr(value))
  }, [value])

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      const target = event.target as Node
      if (rootRef.current?.contains(target)) return
      if (panelRef.current?.contains(target)) return
      setOpen(false)
    }
    document.addEventListener('click', handleClickOutside)
    return () => document.removeEventListener('click', handleClickOutside)
  }, [])

  function syncViewTo(iso: string) {
    const d = new Date(`${iso}T00:00:00Z`)
    setViewYear(d.getUTCFullYear())
    setViewMonth(d.getUTCMonth())
  }

  function toggleOpen() {
    if (!open) syncViewTo(value ?? todayIso)
    setOpen((current) => !current)
  }

  function selectIso(iso: string) {
    onChange(iso)
    setText(isoToFr(iso))
    syncViewTo(iso)
    setOpen(false)
  }

  function commitText(raw: string) {
    if (!raw.trim()) {
      onChange(null)
      return
    }
    const iso = parseFr(raw)
    if (iso) {
      onChange(iso)
      syncViewTo(iso)
    }
    // Texte non reconnu : laissé tel quel dans le champ — la validation finale reste côté formulaire (submit).
  }

  function shiftMonth(delta: number) {
    let m = viewMonth + delta
    let y = viewYear
    if (m < 0) {
      m = 11
      y -= 1
    } else if (m > 11) {
      m = 0
      y += 1
    }
    setViewMonth(m)
    setViewYear(y)
  }

  const cells = buildGrid(viewYear, viewMonth)

  return (
    <div className="gp-dp" ref={rootRef}>
      <div className="gp-dp__input" onClick={toggleOpen}>
        <span className="gp-dp__ico">
          <svg className="ti">
            <use href="#i-calendar" />
          </svg>
        </span>
        <input
          id={id}
          type="text"
          placeholder="JJ/MM/AAAA"
          maxLength={10}
          value={text}
          aria-label={ariaLabel}
          autoComplete="off"
          onClick={(e) => e.stopPropagation()}
          onChange={(e) => setText(e.target.value)}
          onBlur={() => commitText(text)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              commitText(text)
              setOpen(false)
            }
          }}
        />
      </div>
      {open &&
        position &&
        createPortal(
          <div
            className="gp-dp__panel is-open"
            ref={panelRef}
            onClick={(e) => e.stopPropagation()}
            style={{ position: 'fixed', top: position.top, left: position.left, zIndex: 100 }}
          >
            <div className="gp-dp__nav">
              <button type="button" className="gp-dp__nav-btn" aria-label="Mois précédent" onClick={() => shiftMonth(-1)}>
                <svg className="ti">
                  <use href="#i-chevron-left" />
                </svg>
              </button>
              <div className="gp-dp__nav-sels">
                <span className="gp-dp__nav-sel">{MONTH_LABELS[viewMonth]}</span>
                <span className="gp-dp__nav-sel">{viewYear}</span>
              </div>
              <button type="button" className="gp-dp__nav-btn" aria-label="Mois suivant" onClick={() => shiftMonth(1)}>
                <svg className="ti">
                  <use href="#i-chevron-right" />
                </svg>
              </button>
            </div>
            <div className="gp-dp__body">
              <div className="gp-dp__grid">
                {DOW_LABELS.map((label, i) => (
                  <div key={label} className={`gp-dp__dow${i >= 5 ? ' we' : ''}`}>
                    {label}
                  </div>
                ))}
                {cells.map((cell) => (
                  <div
                    key={cell.iso}
                    className={[
                      'gp-dp__day',
                      cell.weekend ? 'we' : '',
                      cell.otherMonth ? 'other' : '',
                      cell.iso === todayIso ? 'today' : '',
                      cell.iso === value ? 'sel' : '',
                    ]
                      .filter(Boolean)
                      .join(' ')}
                    onClick={() => selectIso(cell.iso)}
                  >
                    {cell.day}
                  </div>
                ))}
              </div>
            </div>
            <div className="gp-dp__foot">
              <button type="button" className="gp-btn gp-btn--ghost gp-btn--sm" onClick={() => selectIso(todayIso)}>
                Aujourd'hui
              </button>
              <button type="button" className="gp-btn gp-btn--primary gp-btn--sm" onClick={() => setOpen(false)}>
                OK
              </button>
            </div>
          </div>,
          document.body,
        )}
    </div>
  )
}
