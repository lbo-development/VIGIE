import { useState, type FormEvent } from 'react'
import {
  useLibelleReferentiel,
  type LibelleReferentiel as LibelleReferentielRow,
  type DomaineReferentiel,
} from '../hooks/useLibelleReferentiel'
import { useDragReorder } from '../hooks/useDragReorder'
import { Combobox } from '../components/Combobox'
import { api, ApiError } from '../services/api'

const DOMAINE_OPTIONS: { value: DomaineReferentiel; label: string }[] = [
  { value: 'TYPE_PIECE_MARCHE', label: 'Types de pièce — Marché' },
  { value: 'TYPE_PIECE_INVESTISSEMENT', label: 'Types de pièce — Investissement' },
]

/**
 * Administration du référentiel générique de listes de valeurs fixes
 * (finances.libelle_referentiel), montée sur /parametres/libelle-referentiel
 * — réservée ADMIN_APP (menu ET backend, voir libelleReferentiel.service.ts,
 * décision du 05/09/2026 : contrairement à CUG/Seuils DS, pas de périmètre
 * ADMIN_SERVICE ici, référentiel transverse à toute l'application).
 * Domaines couverts actuellement : type de pièce marché/investissement — un
 * sélecteur en tête d'écran choisit lequel administrer, sur le modèle du
 * sélecteur "Paramètre" de Reglages.tsx.
 * CODE et DOMAINE ne sont jamais modifiables après création (clé naturelle
 * composite, même principe que CODE_CUG dans Cug.tsx) ; suppression physique
 * possible (bloquée côté backend par la FK des tables clientes tant que le
 * code est utilisé — voir libelleReferentiel.service.ts#deleteLibelle) : ACTIF
 * reste le moyen normal de retirer une valeur des formulaires de dépôt sans
 * perdre l'historique des pièces déjà déposées sous ce code.
 *
 * Réordonnancement par glisser-déposer identique à GisementTechnique.tsx
 * (useDragReorder, poignée #i-grip-vertical, ligne en cours de glisser à
 * 50% d'opacité) — appliqué directement sur le tableau principal, pas via
 * une modale séparée : contrairement aux secteurs (mélangés entre services
 * dans une même vue), ce tableau est déjà scopé à un seul domaine à la fois,
 * donc sur le même modèle que SousSecteursModal (scope unique). Pas de
 * colonne "Ordre" ni de champ dans le formulaire (même principe que
 * sousSecteur.service.ts) : la position dans le tableau fait foi.
 */
export function LibelleReferentiel() {
  const [domaine, setDomaine] = useState<DomaineReferentiel>('TYPE_PIECE_MARCHE')
  const { items, loading, refetch } = useLibelleReferentiel(domaine)
  const [modal, setModal] = useState<{ mode: 'create' | 'edit'; row: LibelleReferentielRow | null } | null>(null)
  const [rowToDelete, setRowToDelete] = useState<LibelleReferentielRow | null>(null)
  const [deleteError, setDeleteError] = useState<string | null>(null)
  const [deleting, setDeleting] = useState(false)
  const [optimisticOrder, setOptimisticOrder] = useState<string[] | null>(null)
  const [reorderError, setReorderError] = useState<string | null>(null)

  const sorted = [...items].sort((a, b) => a.ordre - b.ordre)
  const displayed = optimisticOrder
    ? optimisticOrder.map((code) => sorted.find((row) => row.code === code)).filter((row): row is LibelleReferentielRow => Boolean(row))
    : sorted

  async function handleReorder(newOrder: string[]) {
    setOptimisticOrder(newOrder)
    setReorderError(null)
    try {
      await api.put('/libelles-referentiel/reorder', { domaine, codes: newOrder })
      await refetch()
    } catch (err) {
      setReorderError(err instanceof ApiError ? err.message : "Impossible d'enregistrer le nouvel ordre.")
    } finally {
      setOptimisticOrder(null)
    }
  }

  const reorder = useDragReorder(
    displayed.map((row) => row.code),
    handleReorder,
  )

  async function confirmDelete() {
    if (!rowToDelete) return
    setDeleteError(null)
    setDeleting(true)
    try {
      await api.delete(`/libelles-referentiel/${rowToDelete.domaine}/${rowToDelete.code}`)
      setRowToDelete(null)
      await refetch()
    } catch (err) {
      setDeleteError(err instanceof ApiError ? err.message : 'Une erreur est survenue.')
    } finally {
      setDeleting(false)
    }
  }

  return (
    <div className="stack">
      <div className="page-heading">
        <div>
          <h1>Référentiel libellé</h1>
          <p>Listes de valeurs fixes administrables sans déploiement (type de pièce marché/investissement).</p>
        </div>
        <div className="page-actions">
          <button className="gp-btn gp-btn--primary" onClick={() => setModal({ mode: 'create', row: null })}>
            <svg className="ti">
              <use href="#i-plus" />
            </svg>
            Nouvelle valeur
          </button>
        </div>
      </div>

      <div className="gp-field" style={{ maxWidth: 404 }}>
        <label className="gp-label">Domaine</label>
        <Combobox
          options={DOMAINE_OPTIONS}
          value={domaine}
          onChange={(v) => {
            if (v) setDomaine(v as DomaineReferentiel)
          }}
          placeholder="Choisir un domaine…"
          ariaLabel="Domaine"
          style={{ maxWidth: 'none' }}
        />
      </div>

      {reorderError && (
        <p className="gp-errmsg">
          <svg className="ti">
            <use href="#i-alert-circle" />
          </svg>
          {reorderError}
        </p>
      )}

      <div className="gp-table-wrap gp-scroll">
        <table className="gp-table" style={{ tableLayout: 'fixed', width: '100%' }}>
          <thead>
            <tr>
              <th aria-label="Réordonner" style={{ width: 32 }} />
              <th style={{ width: '30%' }}>Code</th>
              <th style={{ width: '70%' }}>Libellé</th>
              <th style={{ width: 90 }}>Statut</th>
              <th style={{ width: 90 }}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {loading && (
              <tr>
                <td colSpan={5}>Chargement…</td>
              </tr>
            )}
            {!loading && displayed.length === 0 && (
              <tr>
                <td colSpan={5}>Aucune valeur pour ce domaine.</td>
              </tr>
            )}
            {displayed.map((row) => (
              <tr key={row.code} {...reorder.dragProps(row.code)} style={{ opacity: reorder.draggedKey === row.code ? 0.5 : undefined }}>
                <td className="mono" style={{ cursor: 'grab' }} aria-label="Glisser pour réordonner">
                  <svg className="ti">
                    <use href="#i-grip-vertical" />
                  </svg>
                </td>
                <td className="mono" style={{ whiteSpace: 'normal', wordBreak: 'break-word' }}>
                  {row.code}
                </td>
                <td style={{ whiteSpace: 'normal', wordBreak: 'break-word' }}>{row.libelle}</td>
                <td>
                  {row.actif ? (
                    <span className="gp-badge gp-badge--success">Actif</span>
                  ) : (
                    <span className="gp-badge gp-badge--danger">Inactif</span>
                  )}
                </td>
                <td>
                  <div className="gp-rowacts">
                    <span className="gp-tip" data-tip="Modifier">
                      <button aria-label="Modifier" onClick={() => setModal({ mode: 'edit', row })}>
                        <svg className="ti">
                          <use href="#i-pencil" />
                        </svg>
                      </button>
                    </span>
                    <span className="gp-tip" data-tip="Supprimer">
                      <button
                        className="del"
                        aria-label="Supprimer"
                        onClick={() => {
                          setDeleteError(null)
                          setRowToDelete(row)
                        }}
                      >
                        <svg className="ti">
                          <use href="#i-trash" />
                        </svg>
                      </button>
                    </span>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {modal && (
        <LibelleReferentielFormModal
          mode={modal.mode}
          domaine={domaine}
          row={modal.row}
          onClose={() => setModal(null)}
          onSaved={() => {
            setModal(null)
            void refetch()
          }}
        />
      )}

      {rowToDelete && (
        <div className="gp-overlay is-open">
          <div className="gp-modal" role="dialog" aria-modal="true" aria-labelledby="deleteLibelleReferentielModalTitle">
            <div className="gp-modal__hd">
              <h3 className="gp-modal__title" id="deleteLibelleReferentielModalTitle">
                Supprimer la valeur
              </h3>
              <button className="gp-modal__close" aria-label="Fermer" onClick={() => setRowToDelete(null)}>
                <svg className="ti">
                  <use href="#i-x" />
                </svg>
              </button>
            </div>
            <div className="gp-modal__bd gp-scroll stack">
              <p>Supprimer définitivement le code « {rowToDelete.code} » ? Cette action est irréversible.</p>
              {deleteError && (
                <p className="gp-errmsg">
                  <svg className="ti">
                    <use href="#i-alert-circle" />
                  </svg>
                  {deleteError}
                </p>
              )}
            </div>
            <div className="gp-modal__ft">
              <button type="button" className="gp-btn gp-btn--secondary" onClick={() => setRowToDelete(null)}>
                Annuler
              </button>
              <button type="button" className="gp-btn gp-btn--danger" onClick={confirmDelete} disabled={deleting}>
                {deleting ? 'Suppression…' : 'Supprimer'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

interface LibelleReferentielFormModalProps {
  mode: 'create' | 'edit'
  domaine: DomaineReferentiel
  row: LibelleReferentielRow | null
  onClose: () => void
  onSaved: () => void
}

/**
 * Création (Code + Libellé + Actif) ou modification (Libellé + Actif uniquement — CODE et DOMAINE
 * ne sont jamais éditables). Pas de champ "Ordre" — une nouvelle valeur atterrit en position 0
 * (backend), à repositionner ensuite par glisser-déposer dans le tableau (même principe que
 * SousSecteurFormModal dans GisementTechnique.tsx).
 */
function LibelleReferentielFormModal({ mode, domaine, row, onClose, onSaved }: LibelleReferentielFormModalProps) {
  const [code, setCode] = useState(row?.code ?? '')
  const [libelle, setLibelle] = useState(row?.libelle ?? '')
  const [actif, setActif] = useState(row?.actif ?? true)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleSubmit(event: FormEvent) {
    event.preventDefault()
    setError(null)
    setSubmitting(true)
    try {
      if (mode === 'create') {
        await api.post('/libelles-referentiel', { domaine, code, libelle, actif })
      } else if (row) {
        await api.put(`/libelles-referentiel/${row.domaine}/${row.code}`, { libelle, actif })
      }
      onSaved()
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Une erreur est survenue.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="gp-overlay is-open">
      <div className="gp-modal" role="dialog" aria-modal="true" aria-labelledby="libelleReferentielModalTitle">
        <div className="gp-modal__hd">
          <h3 className="gp-modal__title" id="libelleReferentielModalTitle">
            {mode === 'create' ? 'Nouvelle valeur' : 'Modifier la valeur'}
          </h3>
          <button className="gp-modal__close" aria-label="Fermer" onClick={onClose}>
            <svg className="ti">
              <use href="#i-x" />
            </svg>
          </button>
        </div>
        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', minHeight: 0, overflow: 'hidden' }}>
          <div className="gp-modal__bd gp-scroll stack">
            {mode === 'create' ? (
              <div className="gp-field">
                <label className="gp-label" htmlFor="libelle-ref-code">
                  Code
                </label>
                <input
                  id="libelle-ref-code"
                  className="gp-input"
                  value={code}
                  onChange={(e) => setCode(e.target.value)}
                  required
                  maxLength={50}
                />
              </div>
            ) : (
              <p className="gp-help">Code : {row?.code}</p>
            )}
            <div className="gp-field">
              <label className="gp-label" htmlFor="libelle-ref-libelle">
                Libellé
              </label>
              <input
                id="libelle-ref-libelle"
                className="gp-input"
                value={libelle}
                onChange={(e) => setLibelle(e.target.value)}
                required
                maxLength={200}
              />
            </div>
            <label className="gp-choice" style={{ justifyContent: 'space-between' }}>
              <span>Actif</span>
              <span className="gp-switch">
                <input type="checkbox" checked={actif} onChange={(e) => setActif(e.target.checked)} />
                <span className="track" />
              </span>
            </label>
            <p className="gp-help">Décoché, cet élément disparaît des listes de sélection ; les données déjà liées ne sont pas supprimées.</p>
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
              Annuler
            </button>
            <button type="submit" className="gp-btn gp-btn--primary" disabled={submitting}>
              {submitting ? 'Enregistrement…' : 'Enregistrer'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
