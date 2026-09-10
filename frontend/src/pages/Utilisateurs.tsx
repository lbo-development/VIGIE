import { useState, type FormEvent } from 'react'
import { useAllActeurs, type AdminActeur } from '../hooks/useAllActeurs'
import { useCellules } from '../hooks/useCellules'
import { Combobox } from '../components/Combobox'
import { api, ApiError } from '../services/api'

const STATUS_OPTIONS = [
  { value: 'active', label: 'Actif' },
  { value: 'inactive', label: 'Inactif' },
]

function matchesStatusFilter(actif: boolean, filter: string | null): boolean {
  if (filter === null) return true
  return filter === 'active' ? actif : !actif
}

/**
 * Administration des ACTEUR (fiche + compte Supabase Auth + rattachement
 * CELLULE), montée sur /parametres/utilisateurs. Réservée ADMIN_APP
 * (contrôle réel côté backend, requireRole('ADMIN_APP') sur POST/PUT/DELETE
 * /api/acteurs — voir acteur.service.ts) : décision du 10/09/2026,
 * ForClaude/CDC/mot-phases-1-2.md (« Gérer les comptes utilisateurs »).
 * L'attribution des rôles applicatifs (RC/CDS/DS/CB/ADMIN_SERVICE/ADMIN_APP)
 * est un écran distinct, RolesUtilisateurs.tsx (accessible aussi à
 * ADMIN_SERVICE, scopé à son service).
 *
 * Pas de vérification de rôle côté écran (comme Directions.tsx) : seul le
 * backend fait foi, l'entrée de menu qui mène ici est déjà réservée ADMIN_APP
 * (voir config/navigation.ts).
 */
export function Utilisateurs() {
  const { acteurs, loading, refetch } = useAllActeurs()
  const { cellules } = useCellules()
  const [statusFilter, setStatusFilter] = useState<string | null>(null)
  const [modal, setModal] = useState<{ mode: 'create' | 'edit'; acteur: AdminActeur | null } | null>(null)
  const [acteurToDelete, setActeurToDelete] = useState<AdminActeur | null>(null)
  const [deleteError, setDeleteError] = useState<string | null>(null)
  const [deleting, setDeleting] = useState(false)

  const celluleLabel = (idCellule: number) => cellules.find((c) => c.id_cellule === idCellule)?.libelle_cellule ?? String(idCellule)

  const filtered = acteurs.filter((a) => matchesStatusFilter(a.actif, statusFilter))

  async function confirmDelete() {
    if (!acteurToDelete) return
    setDeleteError(null)
    setDeleting(true)
    try {
      await api.delete(`/acteurs/${acteurToDelete.matricule}`)
      setActeurToDelete(null)
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
          <h1>Utilisateurs</h1>
          <p>Fiches acteur, comptes et rattachement à une cellule.</p>
        </div>
        <div className="page-actions">
          <button className="gp-btn gp-btn--primary" onClick={() => setModal({ mode: 'create', acteur: null })}>
            <svg className="ti">
              <use href="#i-plus" />
            </svg>
            Nouvel utilisateur
          </button>
        </div>
      </div>

      <div className="gp-field" style={{ maxWidth: 200 }}>
        <label className="gp-label">Statut</label>
        <Combobox
          options={STATUS_OPTIONS}
          value={statusFilter}
          onChange={setStatusFilter}
          placeholder="Tous"
          clearLabel="Tous"
          ariaLabel="Filtrer les utilisateurs par statut"
        />
      </div>

      {!loading && (
        <p className="gp-help">
          {filtered.length} utilisateurs sélectionnés sur {acteurs.length} enregistrés.
        </p>
      )}

      <div className="gp-table-wrap gp-scroll">
        <table className="gp-table">
          <thead>
            <tr>
              <th>Matricule</th>
              <th>Nom</th>
              <th>Prénom</th>
              <th>Fonction</th>
              <th>Cellule</th>
              <th>Statut</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {loading && (
              <tr>
                <td colSpan={7}>Chargement…</td>
              </tr>
            )}
            {!loading && filtered.length === 0 && (
              <tr>
                <td colSpan={7}>{acteurs.length === 0 ? 'Aucun utilisateur.' : 'Aucun utilisateur pour ce statut.'}</td>
              </tr>
            )}
            {filtered.map((acteur) => (
              <tr key={acteur.matricule}>
                <td className="mono">{acteur.matricule}</td>
                <td>{acteur.nom}</td>
                <td>{acteur.prenom}</td>
                <td>{acteur.fonction}</td>
                <td>{celluleLabel(acteur.id_cellule)}</td>
                <td>
                  {acteur.actif ? (
                    <span className="gp-badge gp-badge--success">Actif</span>
                  ) : (
                    <span className="gp-badge gp-badge--danger">Inactif</span>
                  )}
                </td>
                <td>
                  <div className="gp-rowacts">
                    <span className="gp-tip" data-tip="Modifier l'utilisateur">
                      <button aria-label="Modifier l'utilisateur" onClick={() => setModal({ mode: 'edit', acteur })}>
                        <svg className="ti">
                          <use href="#i-pencil" />
                        </svg>
                      </button>
                    </span>
                    <span className="gp-tip" data-tip="Supprimer l'utilisateur">
                      <button aria-label="Supprimer l'utilisateur" onClick={() => setActeurToDelete(acteur)}>
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
        <UtilisateurFormModal
          mode={modal.mode}
          acteur={modal.acteur}
          onClose={() => setModal(null)}
          onSaved={() => {
            void refetch()
          }}
        />
      )}

      {acteurToDelete && (
        <div className="gp-overlay is-open">
          <div className="gp-modal" role="dialog" aria-modal="true" aria-labelledby="deleteUtilisateurModalTitle">
            <div className="gp-modal__hd">
              <h3 className="gp-modal__title" id="deleteUtilisateurModalTitle">
                Supprimer l'utilisateur
              </h3>
              <button className="gp-modal__close" aria-label="Fermer" onClick={() => setActeurToDelete(null)}>
                <svg className="ti">
                  <use href="#i-x" />
                </svg>
              </button>
            </div>
            <div className="gp-modal__bd gp-scroll stack">
              <p>
                Supprimer définitivement « {acteurToDelete.prenom} {acteurToDelete.nom} » ({acteurToDelete.matricule}) ? Cette action
                est irréversible.
              </p>
              <p className="gp-help">
                Refusé si cet utilisateur est encore référencé (rôle, demande d'achat, historique) — désactivez-le dans ce cas plutôt
                que de le supprimer.
              </p>
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
              <button type="button" className="gp-btn gp-btn--secondary" onClick={() => setActeurToDelete(null)}>
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

interface UtilisateurFormModalProps {
  mode: 'create' | 'edit'
  acteur: AdminActeur | null
  onClose: () => void
  onSaved: () => void
}

/**
 * Modale de création/modification. En création, une fois le compte créé,
 * bascule sur un second écran affichant le mot de passe temporaire généré
 * par le backend (renvoyé une seule fois, jamais réexposé — voir
 * acteur.service.ts#createActeur) : à communiquer à l'utilisateur hors
 * application, changement obligatoire à sa première connexion.
 */
function UtilisateurFormModal({ mode, acteur, onClose, onSaved }: UtilisateurFormModalProps) {
  const { cellules } = useCellules()
  const [matricule, setMatricule] = useState(acteur?.matricule ?? '')
  const [nom, setNom] = useState(acteur?.nom ?? '')
  const [prenom, setPrenom] = useState(acteur?.prenom ?? '')
  const [fonction, setFonction] = useState(acteur?.fonction ?? '')
  const [idCellule, setIdCellule] = useState<string | null>(acteur ? String(acteur.id_cellule) : null)
  const [email, setEmail] = useState('')
  const [actif, setActif] = useState(acteur?.actif ?? true)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [temporaryPassword, setTemporaryPassword] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault()
    setError(null)
    if (!idCellule) {
      setError('Choisissez une cellule.')
      return
    }
    setSubmitting(true)
    try {
      if (mode === 'create') {
        const created = await api.post<{ temporaryPassword: string }>('/acteurs', {
          matricule,
          nom,
          prenom,
          fonction,
          idCellule: Number(idCellule),
          email,
        })
        setTemporaryPassword(created.temporaryPassword)
      } else if (acteur) {
        await api.put(`/acteurs/${acteur.matricule}`, { nom, prenom, fonction, idCellule: Number(idCellule), actif })
        onSaved()
        onClose()
      }
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Une erreur est survenue.')
    } finally {
      setSubmitting(false)
    }
  }

  async function copyPassword() {
    if (!temporaryPassword) return
    try {
      await navigator.clipboard.writeText(temporaryPassword)
      setCopied(true)
    } catch {
      setCopied(false)
    }
  }

  if (temporaryPassword) {
    return (
      <div className="gp-overlay is-open">
        <div className="gp-modal" role="dialog" aria-modal="true" aria-labelledby="utilisateurPasswordTitle">
          <div className="gp-modal__hd">
            <h3 className="gp-modal__title" id="utilisateurPasswordTitle">
              Utilisateur créé
            </h3>
          </div>
          <div className="gp-modal__bd gp-scroll stack">
            <p>Mot de passe temporaire — à communiquer à l'utilisateur hors application. Il ne sera plus jamais affiché.</p>
            <div className="gp-field">
              <label className="gp-label" htmlFor="utilisateur-mdp-temp">
                Mot de passe temporaire
              </label>
              <input id="utilisateur-mdp-temp" className="gp-input mono" value={temporaryPassword} readOnly />
            </div>
            <button type="button" className="gp-btn gp-btn--secondary" onClick={copyPassword}>
              {copied ? 'Copié' : 'Copier'}
            </button>
            <p className="gp-help">Un changement de mot de passe sera exigé à la première connexion de cet utilisateur.</p>
          </div>
          <div className="gp-modal__ft">
            <button
              type="button"
              className="gp-btn gp-btn--primary"
              onClick={() => {
                onSaved()
                onClose()
              }}
            >
              Terminé
            </button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="gp-overlay is-open">
      <div className="gp-modal" role="dialog" aria-modal="true" aria-labelledby="utilisateurModalTitle">
        <div className="gp-modal__hd">
          <h3 className="gp-modal__title" id="utilisateurModalTitle">
            {mode === 'create' ? 'Nouvel utilisateur' : 'Modifier l\'utilisateur'}
          </h3>
          <button className="gp-modal__close" aria-label="Fermer" onClick={onClose}>
            <svg className="ti">
              <use href="#i-x" />
            </svg>
          </button>
        </div>
        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', minHeight: 0, overflow: 'hidden' }}>
          <div className="gp-modal__bd gp-scroll stack">
            <div className="gp-field">
              <label className="gp-label" htmlFor="utilisateur-matricule">
                Matricule
              </label>
              <input
                id="utilisateur-matricule"
                className="gp-input"
                value={matricule}
                onChange={(e) => setMatricule(e.target.value)}
                required
                maxLength={20}
                disabled={mode === 'edit'}
              />
            </div>
            <div className="gp-field">
              <label className="gp-label" htmlFor="utilisateur-nom">
                Nom
              </label>
              <input id="utilisateur-nom" className="gp-input" value={nom} onChange={(e) => setNom(e.target.value)} required maxLength={200} />
            </div>
            <div className="gp-field">
              <label className="gp-label" htmlFor="utilisateur-prenom">
                Prénom
              </label>
              <input
                id="utilisateur-prenom"
                className="gp-input"
                value={prenom}
                onChange={(e) => setPrenom(e.target.value)}
                required
                maxLength={200}
              />
            </div>
            <div className="gp-field">
              <label className="gp-label" htmlFor="utilisateur-fonction">
                Fonction
              </label>
              <input
                id="utilisateur-fonction"
                className="gp-input"
                value={fonction}
                onChange={(e) => setFonction(e.target.value)}
                required
                maxLength={200}
              />
            </div>
            <div className="gp-field">
              <label className="gp-label">Cellule</label>
              <Combobox
                options={cellules.map((c) => ({ value: String(c.id_cellule), label: c.libelle_cellule }))}
                value={idCellule}
                onChange={setIdCellule}
                placeholder="Choisir une cellule…"
                ariaLabel="Cellule"
                style={{ maxWidth: 'none' }}
              />
            </div>
            {mode === 'create' && (
              <div className="gp-field">
                <label className="gp-label" htmlFor="utilisateur-email">
                  Adresse e-mail (compte)
                </label>
                <input
                  id="utilisateur-email"
                  type="email"
                  className="gp-input"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  maxLength={320}
                />
              </div>
            )}
            {mode === 'edit' && (
              <label className="gp-choice" style={{ justifyContent: 'space-between' }}>
                <span>Actif</span>
                <span className="gp-switch">
                  <input type="checkbox" checked={actif} onChange={(e) => setActif(e.target.checked)} />
                  <span className="track" />
                </span>
              </label>
            )}
            {mode === 'edit' && (
              <p className="gp-help">Désactiver révoque immédiatement l'accès de cet utilisateur, sans supprimer sa fiche.</p>
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
