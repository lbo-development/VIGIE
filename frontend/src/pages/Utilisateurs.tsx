import { useRef, useState, type FormEvent } from 'react'
import { useAllActeurs, type AdminActeur } from '../hooks/useAllActeurs'
import { useCellules, type OrgCellule } from '../hooks/useCellules'
import { useServices, type OrgService } from '../hooks/useServices'
import { useDirections } from '../hooks/useDirections'
import { Combobox } from '../components/Combobox'
import { api, ApiError } from '../services/api'

const STATUS_OPTIONS = [
  { value: 'active', label: 'Actif' },
  { value: 'inactive', label: 'Inactif' },
]

/** Matricule : identifiant numérique sur 6 chiffres (complété par le backend avec des zéros à gauche, ex. 600 -> 000600) — même principe que `sanitizeInteger` ailleurs dans l'app, jamais `type="number"` natif. */
function sanitizeMatricule(raw: string): string {
  return raw.replace(/[^0-9]/g, '').slice(0, 6)
}

function matchesStatusFilter(actif: boolean, filter: string | null): boolean {
  if (filter === null) return true
  return filter === 'active' ? actif : !actif
}

/**
 * Filtre organisationnel en cascade — au niveau le plus précis renseigné
 * (Cellule > Service > Direction), les autres sont ignorés. Contrairement au
 * même filtre sur Fournisseurs.tsx/MarchesPGI.tsx (qui verrouille l'affichage
 * tant que Direction+Service ne sont pas choisis, car l'API sous-jacente
 * exige un périmètre), ici la liste complète est déjà chargée par
 * useAllActeurs — chaque niveau est une simple narrowing optionnelle, pas un
 * verrou d'accès.
 */
function matchesOrgFilter(
  acteur: AdminActeur,
  filters: { idDirection: string | null; idService: string | null; idCellule: string | null },
  cellules: OrgCellule[],
  services: OrgService[],
): boolean {
  if (filters.idCellule !== null) return acteur.id_cellule === Number(filters.idCellule)

  const cellule = cellules.find((c) => c.id_cellule === acteur.id_cellule)
  if (filters.idService !== null) return cellule?.id_service === Number(filters.idService)

  if (filters.idDirection !== null) {
    const service = cellule ? services.find((s) => s.id_service === cellule.id_service) : undefined
    return service?.id_direction === Number(filters.idDirection)
  }

  return true
}

function matchesSearch(acteur: AdminActeur, search: string): boolean {
  if (!search.trim()) return true
  const needle = search.trim().toLowerCase()
  return (
    acteur.nom.toLowerCase().includes(needle) ||
    acteur.prenom.toLowerCase().includes(needle) ||
    acteur.matricule.toLowerCase().includes(needle)
  )
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
  const { services } = useServices()
  const { directions } = useDirections()
  const [statusFilter, setStatusFilter] = useState<string | null>(null)
  const [filterIdDirection, setFilterIdDirection] = useState<string | null>(null)
  const [filterIdService, setFilterIdService] = useState<string | null>(null)
  const [filterIdCellule, setFilterIdCellule] = useState<string | null>(null)
  const [search, setSearch] = useState('')
  const [modal, setModal] = useState<{ mode: 'create' | 'edit'; acteur: AdminActeur | null } | null>(null)
  const [acteurToDelete, setActeurToDelete] = useState<AdminActeur | null>(null)
  const [deleteError, setDeleteError] = useState<string | null>(null)
  const [deleting, setDeleting] = useState(false)

  const celluleLabel = (idCellule: number) => cellules.find((c) => c.id_cellule === idCellule)?.libelle_cellule ?? String(idCellule)

  const directionOptions = directions.map((d) => ({ value: String(d.id_direction), label: d.libelle_direction }))
  const serviceOptions =
    filterIdDirection === null
      ? []
      : services.filter((s) => s.id_direction === Number(filterIdDirection)).map((s) => ({ value: String(s.id_service), label: s.libelle_service }))
  const celluleOptions =
    filterIdService === null
      ? []
      : cellules.filter((c) => c.id_service === Number(filterIdService)).map((c) => ({ value: String(c.id_cellule), label: c.libelle_cellule }))

  const filtered = acteurs
    .filter((a) => matchesStatusFilter(a.actif, statusFilter))
    .filter((a) => matchesOrgFilter(a, { idDirection: filterIdDirection, idService: filterIdService, idCellule: filterIdCellule }, cellules, services))
    .filter((a) => matchesSearch(a, search))

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

      <div className="row" style={{ flexWrap: 'wrap' }}>
        <div className="gp-field" style={{ flex: '1 1 260px' }}>
          <label className="gp-label">Direction</label>
          <Combobox
            options={directionOptions}
            value={filterIdDirection}
            onChange={(value) => {
              setFilterIdDirection(value)
              setFilterIdService(null)
              setFilterIdCellule(null)
            }}
            placeholder="Choisir une direction…"
            clearLabel="Toutes"
            ariaLabel="Direction"
            style={{ maxWidth: 'none' }}
          />
        </div>

        <div className="gp-field" style={{ flex: '1 1 260px' }}>
          <label className="gp-label">Service</label>
          <Combobox
            options={serviceOptions}
            value={filterIdService}
            onChange={(value) => {
              setFilterIdService(value)
              setFilterIdCellule(null)
            }}
            placeholder="Choisir un service…"
            clearLabel="Tous"
            ariaLabel="Service"
            style={{ maxWidth: 'none' }}
          />
        </div>

        <div className="gp-field" style={{ flex: '0 0 234px' }}>
          <label className="gp-label">Cellule</label>
          <Combobox
            options={celluleOptions}
            value={filterIdCellule}
            onChange={setFilterIdCellule}
            placeholder="Choisir une cellule…"
            clearLabel="Toutes"
            ariaLabel="Cellule"
            style={{ maxWidth: 'none' }}
          />
        </div>
      </div>

      <div className="row" style={{ flexWrap: 'wrap' }}>
        <div className="gp-field" style={{ width: 200 }}>
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

        <div className="gp-field" style={{ width: 260 }}>
          <label className="gp-label" htmlFor="utilisateurs-search">
            Recherche
          </label>
          <div className="gp-inputgroup">
            <svg className="ti">
              <use href="#i-search" />
            </svg>
            <input
              id="utilisateurs-search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Nom, prénom, matricule…"
              aria-label="Rechercher un utilisateur"
            />
          </div>
        </div>
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
  // Verrou synchrone contre la double soumission (double-clic, ou Entrée puis
  // clic sur le bouton) — `submitting` (état React) ne suffit pas : son
  // re-rendu n'est pas garanti avant qu'un second événement de soumission
  // n'arrive, ce qui a déjà provoqué la création d'un compte Auth orphelin
  // (voir acteur.service.ts#createActeur, incident du 10/09/2026).
  const submittingRef = useRef(false)

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault()
    if (submittingRef.current) return
    setError(null)
    if (!idCellule) {
      setError('Choisissez une cellule.')
      return
    }
    submittingRef.current = true
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
      submittingRef.current = false
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
                inputMode="numeric"
                pattern="[0-9]*"
                value={matricule}
                onChange={(e) => setMatricule(sanitizeMatricule(e.target.value))}
                required
                maxLength={6}
                disabled={mode === 'edit'}
              />
              {mode === 'create' && (
                <p className="gp-help">Complété automatiquement à 6 chiffres avec des zéros à gauche (ex. 600 → 000600).</p>
              )}
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
