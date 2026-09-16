import { useEffect, useState } from 'react'
import { getHistoriqueStatuts, type HistoriqueStatutView } from '../../hooks/useDemandeAchat'
import { STATUT_BADGE_CLASS } from './constants'

interface HistoriqueStatutsModalProps {
  idDemandeAchat: number
  numero: string
  onClose: () => void
}

/**
 * Icône calendrier (tous les onglets de l'écran d'accueil) — simple liste
 * chronologique des transitions de statut d'une DA/FAD (GET
 * /demandes-achat/:id/historique, voir demandeAchat.service.ts#getHistoriqueStatuts),
 * aucune action possible dessus (historique_statut est immuable en base).
 */
export function HistoriqueStatutsModal({ idDemandeAchat, numero, onClose }: HistoriqueStatutsModalProps) {
  const [loading, setLoading] = useState(true)
  const [rows, setRows] = useState<HistoriqueStatutView[]>([])
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    getHistoriqueStatuts(idDemandeAchat)
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
  }, [idDemandeAchat])

  return (
    <div className="gp-overlay is-open">
      <div className="gp-modal" role="dialog" aria-modal="true" aria-labelledby="historiqueStatutsModalTitle" style={{ maxWidth: 640 }}>
        <div className="gp-modal__hd">
          <h3 className="gp-modal__title" id="historiqueStatutsModalTitle">
            Historique des statuts — {numero}
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
          {!loading && !error && rows.length === 0 && <p>Aucun historique pour cette demande.</p>}
          {!loading && !error && rows.length > 0 && (
            <div className="gp-table-wrap gp-scroll" style={{ maxHeight: 420 }}>
              <table className="gp-table">
                <colgroup>
                  <col style={{ width: 130 }} />
                  <col style={{ width: 170 }} />
                  <col style={{ width: 150 }} />
                  <col />
                </colgroup>
                <thead>
                  <tr>
                    <th>Date/heure</th>
                    <th>Statut</th>
                    <th>Acteur</th>
                    <th>Commentaire</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((row) => (
                    <tr key={row.idHisto}>
                      <td className="mono">{new Date(row.dateHeure).toLocaleString('fr-FR', { dateStyle: 'short', timeStyle: 'short' })}</td>
                      <td>
                        <span className={`gp-badge ${STATUT_BADGE_CLASS[row.codeStatut] ?? ''}`}>{row.libelleStatut}</span>
                      </td>
                      <td>
                        {row.acteurNomPrenom ?? row.matriculeActeur}
                        {row.suppleanceLabel && (
                          <>
                            <br />
                            <span className="gp-help">{row.suppleanceLabel}</span>
                          </>
                        )}
                      </td>
                      <td>{row.commentaireStatut ?? '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
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
