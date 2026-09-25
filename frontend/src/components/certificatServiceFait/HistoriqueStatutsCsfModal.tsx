import { useEffect, useState } from 'react'
import { getHistoriqueStatutsCsf, type HistoriqueStatutCsfView } from '../../hooks/useCertificatServiceFait'
import { STATUT_CSF_BADGE_CLASS } from './constants'

interface HistoriqueStatutsCsfModalProps {
  idCsf: number
  numeroCsf: string
  onClose: () => void
}

/** Même tonalité que STATUT_BADGE_CLASS côté FAD — jamais une seconde source de vérité sur la couleur d'un statut. */
const TONE_VARS: Record<string, { bg: string; text: string; solid: string }> = {
  'gp-badge--info': { bg: 'var(--gp-info-bg)', text: 'var(--gp-info-text)', solid: 'var(--gp-info)' },
  'gp-badge--success': { bg: 'var(--gp-success-bg)', text: 'var(--gp-success-text)', solid: 'var(--gp-success)' },
  'gp-badge--warning': { bg: 'var(--gp-warning-bg)', text: 'var(--gp-warning-text)', solid: 'var(--gp-warning)' },
  'gp-badge--danger': { bg: 'var(--gp-danger-bg)', text: 'var(--gp-danger-text)', solid: 'var(--gp-danger)' },
}
const DEFAULT_TONE = TONE_VARS['gp-badge--info']

/**
 * Fil chronologique des transitions de statut d'un CSF — même écart assumé
 * et déjà validé côté FAD (HistoriqueStatutsModal.tsx, décision du
 * 23/09/2026) : le design system GPMM ne propose aucun composant de type
 * "fil"/timeline, voir ForClaude/INSTRUCTIONS_UX.md. Toutes les valeurs
 * visuelles restent des variables --gp-* existantes.
 */
export function HistoriqueStatutsCsfModal({ idCsf, numeroCsf, onClose }: HistoriqueStatutsCsfModalProps) {
  const [loading, setLoading] = useState(true)
  const [rows, setRows] = useState<HistoriqueStatutCsfView[]>([])
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    getHistoriqueStatutsCsf(idCsf)
      .then((data) => {
        if (!cancelled) setRows(data)
      })
      .catch(() => {
        if (!cancelled) setError('Impossible de charger l\'historique des statuts.')
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [idCsf])

  const rowsTriees = [...rows].sort((a, b) => b.dateHeure.localeCompare(a.dateHeure))

  return (
    <div className="gp-overlay is-open">
      <div className="gp-modal" role="dialog" aria-modal="true" aria-labelledby="historiqueStatutsCsfModalTitle" style={{ maxWidth: 640 }}>
        <div className="gp-modal__hd">
          <h3 className="gp-modal__title" id="historiqueStatutsCsfModalTitle">
            Historique des statuts — {numeroCsf}
          </h3>
          <button className="gp-modal__close" aria-label="Fermer" onClick={onClose}>
            <svg className="ti">
              <use href="#i-x" />
            </svg>
          </button>
        </div>
        <div className="gp-modal__bd gp-scroll stack">
          {loading && <p>Chargement…</p>}
          {!loading && error && (
            <p className="gp-errmsg">
              <svg className="ti">
                <use href="#i-alert-circle" />
              </svg>
              {error}
            </p>
          )}
          {!loading && !error && rows.length === 0 && <p>Aucun historique pour ce certificat.</p>}
          {!loading && !error && rows.length > 0 && (
            <div className="gp-scroll" style={{ maxHeight: 420, overflowY: 'auto' }}>
              <div style={{ position: 'relative', paddingLeft: 28 }}>
                <div style={{ position: 'absolute', left: 7, top: 6, bottom: 6, width: 2, background: 'var(--gp-border)' }} />
                {rowsTriees.map((row, index) => {
                  const tone = TONE_VARS[STATUT_CSF_BADGE_CLASS[row.codeStatutCsf] ?? ''] ?? DEFAULT_TONE
                  return (
                    <div key={row.idHistoCsf} style={{ position: 'relative', paddingBottom: index === rowsTriees.length - 1 ? 0 : 14 }}>
                      <div
                        style={{
                          position: 'absolute',
                          left: -28,
                          top: 4,
                          width: 16,
                          height: 16,
                          borderRadius: '50%',
                          background: tone.bg,
                          border: `2px solid ${tone.solid}`,
                        }}
                      />
                      <div style={{ display: 'flex', alignItems: 'baseline', gap: 10, flexWrap: 'wrap' }}>
                        <span className="mono" style={{ fontSize: 12, color: 'var(--gp-text-muted)' }}>
                          {new Date(row.dateHeure).toLocaleString('fr-FR', { dateStyle: 'short', timeStyle: 'short' })}
                        </span>
                        <span className={`gp-badge ${STATUT_CSF_BADGE_CLASS[row.codeStatutCsf] ?? ''}`}>{row.libelleStatut}</span>
                        <span style={{ fontSize: 13, color: 'var(--gp-text-secondary)' }}>{row.acteurNomPrenom ?? row.matriculeActeur}</span>
                      </div>
                      {row.commentaireStatut && (
                        <div style={{ marginTop: 8, background: tone.bg, borderRadius: 'var(--gp-radius)', padding: '10px 12px' }}>
                          <p style={{ margin: 0, fontSize: 13, lineHeight: 1.5, color: tone.text, whiteSpace: 'pre-wrap' }}>{row.commentaireStatut}</p>
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            </div>
          )}
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
