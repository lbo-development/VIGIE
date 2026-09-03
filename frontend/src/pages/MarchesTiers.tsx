import { useEffect, useState, type CSSProperties, type FormEvent } from 'react'
import { useCurrentUser } from '../hooks/useCurrentUser'
import { useDirections } from '../hooks/useDirections'
import { useServices } from '../hooks/useServices'
import { useMarcheTiers, type MarcheTiers } from '../hooks/useMarcheTiers'
import { useFournisseurs } from '../hooks/useFournisseurs'
import { useMarcheOptions } from '../hooks/useMarcheOptions'
import { Combobox } from '../components/Combobox'
import { DatePicker } from '../components/DatePicker'
import { SpinButton } from '../components/SpinButton'
import { PiecesMarcheModal } from '../components/PiecesMarcheModal'
import { AddPieceMarcheModal } from '../components/AddPieceMarcheModal'
import { api, ApiError } from '../services/api'
import '../styles/marche.css'

const TYPEDECOMPOPRIX_OPTIONS = [
  { value: 'FORFAIT', label: 'Forfait' },
  { value: 'BPU', label: 'BPU' },
]
const ALERTEDATE_DEFAUT_JOURS = '120'
/** Même seuil que backend/src/services/marcheTiers.service.ts#LIBELLE_MIN_LENGTH (décision du 02/09/2026). */
const LIBELLE_MIN_LENGTH = 15

/** Même principe que MarchesPGI.tsx#sanitizeInteger : jamais de type="number" natif ni de spin button pour un montant. */
function sanitizeInteger(raw: string): string {
  return raw.replace(/[^0-9]/g, '')
}

const CURRENCY_FORMAT = new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 })

/** ISO 'YYYY-MM-DD' -> 'JJ/MM/AAAA' — même principe que MarchesPGI.tsx#formatDateFr. */
function formatDateFr(iso: string): string {
  const [y, m, d] = iso.split('-')
  return `${d}/${m}/${y}`
}

/** '—' si non renseigné, sinon la date au format JJ/MM/AAAA — même principe que MarchesPGI.tsx#formatDateOrDash. */
function formatDateOrDash(iso: string | null): string {
  return iso ? formatDateFr(iso) : '—'
}

function daysBetween(from: Date, to: Date): number {
  return Math.round((to.getTime() - from.getTime()) / 86_400_000)
}

interface DureeInfo {
  totalJours: number
  joursRestants: number
  fraction: number
  isAlerte: boolean
}

/**
 * Durée = DTEDEBUT → DTEFINMAX ; alerte (rouge) si les jours restants passent
 * sous ALERTEDATE — même calcul que MarchesPGI.tsx#computeDuree (pas de barre
 * "Montant" ici : un marché tiers n'a pas de suivi de consommation, voir
 * MarcheTiersCard ci-dessous).
 */
function computeDuree(dtedebut: string | null, dtefinmax: string | null, alertedate: number): DureeInfo | null {
  if (!dtedebut || !dtefinmax) return null
  const debut = new Date(dtedebut)
  const fin = new Date(dtefinmax)
  const totalJours = daysBetween(debut, fin)
  if (totalJours <= 0) return null
  const joursRestants = daysBetween(new Date(), fin)
  const fraction = Math.min(1, Math.max(0, (totalJours - joursRestants) / totalJours))
  return { totalJours, joursRestants, fraction, isAlerte: joursRestants < alertedate }
}

/**
 * Marchés d'un service tiers (/marches/tiers) — registre de référence pour
 * les marchés appartenant à un AUTRE service du port (qui n'utilise pas
 * forcément VIGIE), ressaisis manuellement pour être cités plus tard dans
 * une demande d'achat. **Jamais mélangé** avec « États des marchés du
 * service » (MarchesPGI.tsx, décision explicite du 01/09/2026) : ni la même
 * table (finances.marche_tiers, pas finances.marche), ni de complétude ni de
 * suivi de consommation (pas de barre "Montant", pas de MT_SOLDE — on ne gère
 * pas ce marché, seule la durée a un sens).
 *
 * **Liste en cards (croquis utilisateur du 02/09/2026, remplace le tableau
 * initial du 01/09/2026)** : `MarcheTiersCard` réutilise le même patron visuel
 * que `MarcheCard` de MarchesPGI.tsx (classes `.marche-*` de `styles/marche.css`,
 * communes aux deux pages) — une seule barre de progression (Durée,
 * DTEDEBUT→DTEFINMAX, alerte sous ALERTEDATE jours restants) et une seule
 * pastille de statut (ACTIF — pas de seconde pastille COMPLETUDE, qui n'existe
 * pas pour cette entité). Icône Visualiser (`ViewMarcheTiersModal`, lecture
 * seule) ouverte à tout le monde ; icônes Modifier et Supprimer réservées
 * `canManage` (ADMIN_APP/ADMIN_SERVICE/CB).
 *
 * **Suppression physique (icône corbeille, décision du 02/09/2026)** —
 * initialement reportée le même jour faute de lien en base entre une DA et un
 * marché tiers (`finances.demande_achat.nummarche` ne référençait alors que
 * `finances.marche`) : devenue possible après ajout de la colonne
 * `finances.demande_achat.id_marche_tiers` (migration
 * 20260902090000_demande_achat_add_marche_tiers_ref.sql). `DeleteMarcheTiersModal`
 * (même patron que Fournisseurs.tsx#DeleteFournisseurModal) — le backend
 * refuse en 409 si une demande d'achat référence encore ce marché tiers
 * (`marcheTiers.service.ts#deleteMarcheTiers`), l'écran affiche alors le
 * message renvoyé par l'API.
 *
 * Lecture ouverte à tout utilisateur authentifié pour son propre service
 * (ADMIN_APP libre du service consulté) — ces marchés servent à tout agent
 * créant une demande d'achat. Écriture (création/modification) réservée
 * ADMIN_APP/ADMIN_SERVICE/CB (`canManage`), même règle que la création
 * manuelle de marché dans MarchesPGI.tsx — voir
 * backend/src/services/marcheTiers.service.ts.
 *
 * Filtre Direction → Service et verrouillage au service propre pour un
 * acteur non ADMIN_APP : copie exacte du même mécanisme dans MarchesPGI.tsx.
 */
export function MarchesTiers() {
  const { data: currentUser } = useCurrentUser()
  const { directions } = useDirections()
  const { services } = useServices()

  const isAdminApp = currentUser?.roles.some((r) => r.typeRole === 'ADMIN_APP') ?? false
  const canManage = currentUser?.roles.some((r) => r.typeRole === 'ADMIN_APP' || r.typeRole === 'ADMIN_SERVICE' || r.typeRole === 'CB') ?? false

  const ownIdService = currentUser?.idService ?? null
  const isRestrictedToOwnService = !isAdminApp && ownIdService != null
  const visibleServices = isRestrictedToOwnService ? services.filter((s) => s.id_service === ownIdService) : services

  const [filterIdDirection, setFilterIdDirection] = useState<string | null>(null)
  const [filterIdService, setFilterIdService] = useState<string | null>(null)

  const directionOptions = directions.map((d) => ({ value: String(d.id_direction), label: d.libelle_direction }))
  const servicesForFilter =
    filterIdDirection === null ? [] : visibleServices.filter((s) => s.id_direction === Number(filterIdDirection))

  useEffect(() => {
    if (isRestrictedToOwnService && filterIdDirection === null) {
      const ownService = services.find((s) => s.id_service === ownIdService)
      if (ownService) {
        setFilterIdDirection(String(ownService.id_direction))
        setFilterIdService(String(ownIdService))
      }
      return
    }
    if (filterIdDirection === null) {
      if (filterIdService !== null) setFilterIdService(null)
      return
    }
    if (filterIdService === null) return
    const stillValid = servicesForFilter.some((s) => s.id_service === Number(filterIdService))
    if (!stillValid) setFilterIdService(null)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isRestrictedToOwnService, ownIdService, services, filterIdDirection])

  const serviceOptions = servicesForFilter.map((s) => ({ value: String(s.id_service), label: s.libelle_service }))

  const idService = filterIdService !== null ? Number(filterIdService) : null

  const { marcheTiers, loading, refetch } = useMarcheTiers(idService)
  const { fournisseurs } = useFournisseurs(idService)

  const [modal, setModal] = useState<{ mode: 'create' | 'edit'; marcheTiers: MarcheTiers | null } | null>(null)
  const [viewMarcheTiers, setViewMarcheTiers] = useState<MarcheTiers | null>(null)
  const [marcheTiersToDelete, setMarcheTiersToDelete] = useState<MarcheTiers | null>(null)
  const [piecesModalMarcheTiers, setPiecesModalMarcheTiers] = useState<MarcheTiers | null>(null)
  const [addPieceModalMarcheTiers, setAddPieceModalMarcheTiers] = useState<MarcheTiers | null>(null)

  const titulaireLabel = (idFournisseur: number) =>
    fournisseurs.find((f) => f.id_fournisseur === idFournisseur)?.raison_sociale_service ?? '—'

  return (
    <div className="stack">
      <div className="page-heading">
        <div>
          <h1>Marchés d'un service tiers</h1>
          <p>Marchés gérés par un autre service du port, référencés ici pour vos demandes d'achat.</p>
        </div>
        {idService !== null && canManage && (
          <div className="page-actions">
            <button className="gp-btn gp-btn--primary" onClick={() => setModal({ mode: 'create', marcheTiers: null })}>
              <svg className="ti">
                <use href="#i-plus" />
              </svg>
              Nouveau marché tiers
            </button>
          </div>
        )}
      </div>

      <div className="row">
        <div className="gp-field" style={{ width: 404 }}>
          <label className="gp-label">Direction</label>
          <Combobox
            options={directionOptions}
            value={filterIdDirection}
            onChange={(value) => {
              setFilterIdDirection(value)
              setFilterIdService(null)
            }}
            placeholder="Choisir une direction…"
            ariaLabel="Direction"
            style={{ maxWidth: 'none' }}
          />
        </div>
        {filterIdDirection !== null && (
          <div className="gp-field" style={{ width: 404 }}>
            <label className="gp-label">Service</label>
            <Combobox
              options={serviceOptions}
              value={filterIdService}
              onChange={setFilterIdService}
              placeholder="Choisir un service…"
              ariaLabel="Service"
              style={{ maxWidth: 'none' }}
            />
          </div>
        )}
      </div>

      {idService === null && <p>Sélectionne une direction et un service pour afficher les marchés tiers.</p>}

      {idService !== null && loading && <p>Chargement…</p>}

      {idService !== null && !loading && marcheTiers.length === 0 && <p>Aucun marché tiers pour ce service.</p>}

      {idService !== null && !loading && marcheTiers.length > 0 && (
        <div className="marche-list gp-scroll">
          {marcheTiers.map((m) => (
            <MarcheTiersCard
              key={m.id_marche_tiers}
              marcheTiers={m}
              titulaire={titulaireLabel(m.id_fournisseur)}
              canManage={canManage}
              onView={() => setViewMarcheTiers(m)}
              onEdit={() => setModal({ mode: 'edit', marcheTiers: m })}
              onDelete={() => setMarcheTiersToDelete(m)}
              onPieces={() => setPiecesModalMarcheTiers(m)}
              onAddPiece={() => setAddPieceModalMarcheTiers(m)}
            />
          ))}
        </div>
      )}

      {modal && idService !== null && (
        <MarcheTiersFormModal
          mode={modal.mode}
          marcheTiers={modal.marcheTiers}
          idService={idService}
          onClose={() => setModal(null)}
          onSaved={() => {
            setModal(null)
            void refetch()
          }}
        />
      )}

      {viewMarcheTiers && (
        <ViewMarcheTiersModal
          marcheTiers={viewMarcheTiers}
          titulaire={titulaireLabel(viewMarcheTiers.id_fournisseur)}
          onClose={() => setViewMarcheTiers(null)}
        />
      )}

      {marcheTiersToDelete && (
        <DeleteMarcheTiersModal
          marcheTiers={marcheTiersToDelete}
          onClose={() => setMarcheTiersToDelete(null)}
          onDeleted={() => {
            setMarcheTiersToDelete(null)
            void refetch()
          }}
        />
      )}

      {piecesModalMarcheTiers && (
        <PiecesMarcheModal
          marcheRef={{ typeMarche: 'TIERS', idMarcheTiers: piecesModalMarcheTiers.id_marche_tiers }}
          label={piecesModalMarcheTiers.nummarche}
          canManage={canManage}
          onClose={() => setPiecesModalMarcheTiers(null)}
        />
      )}

      {addPieceModalMarcheTiers && (
        <AddPieceMarcheModal
          marcheRef={{ typeMarche: 'TIERS', idMarcheTiers: addPieceModalMarcheTiers.id_marche_tiers }}
          label={addPieceModalMarcheTiers.nummarche}
          onClose={() => setAddPieceModalMarcheTiers(null)}
          onSaved={() => setAddPieceModalMarcheTiers(null)}
        />
      )}
    </div>
  )
}

/** Une ligne de la modale de visualisation : libellé + valeur en lecture seule — même principe que MarchesPGI.tsx#ViewField. */
function ViewField({ label, value, style }: { label: string; value: string; style?: CSSProperties }) {
  const id = `marche-tiers-view-${label.toLowerCase().replace(/\s+/g, '-')}`
  return (
    <div className="gp-field" style={style}>
      <label className="gp-label" htmlFor={id}>
        {label}
      </label>
      <input id={id} className="gp-input" value={value} readOnly />
    </div>
  )
}

function MarcheTiersCard({
  marcheTiers,
  titulaire,
  canManage,
  onView,
  onEdit,
  onDelete,
  onPieces,
  onAddPiece,
}: {
  marcheTiers: MarcheTiers
  titulaire: string
  canManage: boolean
  onView: () => void
  onEdit: () => void
  onDelete: () => void
  onPieces: () => void
  onAddPiece: () => void
}) {
  const duree = computeDuree(marcheTiers.dtedebut, marcheTiers.dtefinmax, marcheTiers.alertedate)

  const actions = (
    <div className="gp-rowacts marche-card__actions">
      <span className="gp-tip" data-tip="Visualiser">
        <button aria-label="Visualiser" onClick={onView}>
          <svg className="ti">
            <use href="#i-eye" />
          </svg>
        </button>
      </span>
      {canManage && (
        <span className="gp-tip" data-tip="Modifier">
          <button aria-label="Modifier" onClick={onEdit}>
            <svg className="ti">
              <use href="#i-pencil" />
            </svg>
          </button>
        </span>
      )}
      {canManage && (
        <span className="gp-tip" data-tip="Supprimer">
          <button className="del" aria-label="Supprimer" onClick={onDelete}>
            <svg className="ti">
              <use href="#i-trash" />
            </svg>
          </button>
        </span>
      )}
      <span className="gp-tip" data-tip="Visualiser les pièces">
        <button aria-label="Visualiser les pièces" onClick={onPieces}>
          <svg className="ti">
            <use href="#i-folder" />
          </svg>
        </button>
      </span>
      {canManage && (
        <span className="gp-tip" data-tip="Ajouter une pièce">
          <button aria-label="Ajouter une pièce" onClick={onAddPiece}>
            <svg className="ti">
              <use href="#i-cloud" />
            </svg>
          </button>
        </span>
      )}
    </div>
  )

  return (
    <div className="marche-card">
      <div className="marche-card__header">
        <div className="marche-card__heading">
          <div className="marche-card__title">
            {marcheTiers.nummarche} — {titulaire}
          </div>
          <div className="marche-card__subtitle">{marcheTiers.libelle_service}</div>
        </div>
        <div className="marche-card__dots">
          <span
            className={`marche-dot ${marcheTiers.actif ? 'marche-dot--on' : 'marche-dot--off'}`}
            title={marcheTiers.actif ? 'Actif' : 'Inactif'}
          />
        </div>
      </div>

      {duree && (
        <div className="marche-metric">
          <div className="marche-metric__bar gp-progress">
            <div
              className="gp-progress__bar"
              style={{ width: `${duree.fraction * 100}%`, backgroundColor: duree.isAlerte ? 'var(--gp-danger)' : 'var(--gp-success)' }}
            />
          </div>
          <span className="marche-metric__label">
            {duree.totalJours} j / {duree.joursRestants >= 0 ? `${duree.joursRestants} j restants` : 'échu'}
          </span>
          {actions}
        </div>
      )}

      {!duree && <div className="marche-metric marche-metric--actions-only">{actions}</div>}
    </div>
  )
}

interface DeleteMarcheTiersModalProps {
  marcheTiers: MarcheTiers
  onClose: () => void
  onDeleted: () => void
}

/**
 * Suppression conditionnelle (icône corbeille, décision du 02/09/2026) —
 * réservée ADMIN_APP/ADMIN_SERVICE/CB (`canManage`, même patron que
 * Fournisseurs.tsx#DeleteFournisseurModal) : le backend refuse en 409 si une
 * demande d'achat référence encore ce marché tiers — l'écran affiche alors le
 * message renvoyé par l'API (qui oriente vers l'état Inactif) plutôt qu'une
 * erreur générique.
 */
function DeleteMarcheTiersModal({ marcheTiers, onClose, onDeleted }: DeleteMarcheTiersModalProps) {
  const [deleting, setDeleting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleDelete() {
    setDeleting(true)
    setError(null)
    try {
      await api.delete(`/marches/tiers/${marcheTiers.id_marche_tiers}`)
      onDeleted()
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Une erreur est survenue.')
    } finally {
      setDeleting(false)
    }
  }

  return (
    <div className="gp-overlay is-open">
      <div className="gp-modal" role="dialog" aria-modal="true" aria-labelledby="deleteMarcheTiersModalTitle">
        <div className="gp-modal__hd">
          <h3 className="gp-modal__title" id="deleteMarcheTiersModalTitle">
            Supprimer le marché tiers
          </h3>
          <button className="gp-modal__close" aria-label="Fermer" onClick={onClose}>
            <svg className="ti">
              <use href="#i-x" />
            </svg>
          </button>
        </div>
        <div className="gp-modal__bd gp-scroll stack">
          <p>
            Supprimer définitivement le marché tiers {marcheTiers.nummarche} ? Cette action est irréversible.
          </p>
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
          <button type="button" className="gp-btn gp-btn--danger" onClick={handleDelete} disabled={deleting}>
            {deleting ? 'Suppression…' : 'Supprimer'}
          </button>
        </div>
      </div>
    </div>
  )
}

/**
 * Visualisation d'un marché tiers (icône « Visualiser » des cards, lecture
 * seule, ouverte à tout le monde) — même principe que
 * MarchesPGI.tsx#ViewMarcheModal, adapté aux champs réels de
 * finances.marche_tiers (pas de Validation/Notification/CUG/Solde restant,
 * qui n'existent pas pour cette entité).
 */
function ViewMarcheTiersModal({
  marcheTiers,
  titulaire,
  onClose,
}: {
  marcheTiers: MarcheTiers
  titulaire: string
  onClose: () => void
}) {
  return (
    <div className="gp-overlay is-open">
      <div className="gp-modal" role="dialog" aria-modal="true" aria-labelledby="viewMarcheTiersModalTitle" style={{ maxWidth: 640 }}>
        <div className="gp-modal__hd">
          <h3 className="gp-modal__title" id="viewMarcheTiersModalTitle">
            Marché tiers {marcheTiers.nummarche}
          </h3>
          <button className="gp-modal__close" aria-label="Fermer" onClick={onClose}>
            <svg className="ti">
              <use href="#i-x" />
            </svg>
          </button>
        </div>
        <div className="gp-modal__bd gp-scroll stack">
          <div className="row">
            <ViewField label="Numéro du marché" value={marcheTiers.nummarche} style={{ flex: 1 }} />
            <ViewField label="Titulaire" value={titulaire} style={{ flex: 1 }} />
          </div>
          <ViewField label="Libellé" value={marcheTiers.libelle_service} />
          <div className="row">
            <ViewField label="Type de procédure" value={marcheTiers.typeproc} style={{ flex: 1 }} />
            <ViewField
              label="Décomposition du prix"
              value={TYPEDECOMPOPRIX_OPTIONS.find((o) => o.value === marcheTiers.typedecompoprix)?.label ?? '—'}
              style={{ flex: 1 }}
            />
          </div>
          <div className="row">
            <ViewField label="Début" value={formatDateOrDash(marcheTiers.dtedebut)} style={{ flex: 1 }} />
            <ViewField label="Fin max" value={formatDateOrDash(marcheTiers.dtefinmax)} style={{ flex: 1 }} />
          </div>
          <div className="row">
            <ViewField
              label="Montant maximum"
              value={marcheTiers.mtmaxi !== null ? CURRENCY_FORMAT.format(marcheTiers.mtmaxi) : '—'}
              style={{ flex: 1 }}
            />
            <ViewField label="Alerte sur date" value={`${marcheTiers.alertedate} j`} style={{ flex: 1 }} />
          </div>
          <div className="row">
            <ViewField label="Agent gestionnaire" value={marcheTiers.agentgestion ?? '—'} style={{ flex: 1 }} />
            <ViewField label="Statut" value={marcheTiers.actif ? 'Actif' : 'Inactif'} style={{ flex: 1 }} />
          </div>
          <ViewField label="Commentaire" value={marcheTiers.commentaire ?? '—'} />
        </div>
        <div className="gp-modal__ft">
          <button type="button" className="gp-btn gp-btn--secondary" onClick={onClose}>
            Retour
          </button>
        </div>
      </div>
    </div>
  )
}

interface MarcheTiersFormModalProps {
  mode: 'create' | 'edit'
  marcheTiers: MarcheTiers | null
  idService: number
  onClose: () => void
  onSaved: () => void
}

/**
 * Champs obligatoires à la création comme à la modification (décision du
 * 02/09/2026, voir backend/src/services/marcheTiers.service.ts) : titulaire,
 * libellé (≥ `LIBELLE_MIN_LENGTH` caractères), décomposition du prix, agent
 * gestionnaire, montant maximum, date de fin maximum. `ACTIF` n'est plus
 * librement modifiable si DTEFINMAX est dépassée : l'interrupteur est
 * désactivé et forcé à false (le backend applique la même règle de toute
 * façon, voir `isMarcheTiersExpire` côté service — ce comportement frontend
 * n'est qu'un reflet, pas la source de vérité).
 */
function MarcheTiersFormModal({ mode, marcheTiers, idService, onClose, onSaved }: MarcheTiersFormModalProps) {
  const { fournisseurs } = useFournisseurs(idService)
  const { options } = useMarcheOptions(idService)
  const fournisseursActifs = fournisseurs.filter((f) => f.actif)
  const agentOptions = (options?.acteurs ?? []).map((a) => ({ value: a.matricule, label: `${a.nom} ${a.prenom}` }))
  const fournisseurOptions = fournisseursActifs.map((f) => ({ value: String(f.id_fournisseur), label: f.raison_sociale_service }))

  const [nummarche, setNummarche] = useState(marcheTiers?.nummarche ?? '')
  const [idFournisseur, setIdFournisseur] = useState<string | null>(
    marcheTiers ? String(marcheTiers.id_fournisseur) : null,
  )
  const [libelleService, setLibelleService] = useState(marcheTiers?.libelle_service ?? '')
  const [typedecompoprix, setTypedecompoprix] = useState<string | null>(marcheTiers?.typedecompoprix ?? null)
  const [agentMatricule, setAgentMatricule] = useState<string | null>(null)
  const [mtmaxi, setMtmaxi] = useState(marcheTiers?.mtmaxi != null ? String(marcheTiers.mtmaxi) : '')
  const [dtedebut, setDtedebut] = useState<string | null>(marcheTiers?.dtedebut ?? null)
  const [dtefinmax, setDtefinmax] = useState<string | null>(marcheTiers?.dtefinmax ?? null)
  const [alertedateJours, setAlertedateJours] = useState(
    marcheTiers ? String(marcheTiers.alertedate) : ALERTEDATE_DEFAUT_JOURS,
  )
  const [actif, setActif] = useState(marcheTiers?.actif ?? true)
  const [commentaire, setCommentaire] = useState(marcheTiers?.commentaire ?? '')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (agentMatricule !== null) return
    const match = agentOptions.find((a) => a.label === marcheTiers?.agentgestion)
    if (match) setAgentMatricule(match.value)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [options])

  const today = new Date().toISOString().slice(0, 10)
  const dtefinmaxExpire = dtefinmax !== null && dtefinmax < today

  async function handleSubmit(event: FormEvent) {
    event.preventDefault()
    setError(null)

    const requiredFieldsMissing =
      (mode === 'create' && !nummarche.trim()) ||
      !idFournisseur ||
      !typedecompoprix ||
      !agentMatricule ||
      !mtmaxi.trim() ||
      !dtedebut ||
      !dtefinmax
    if (requiredFieldsMissing) {
      setError(
        mode === 'create'
          ? 'Numéro de marché, titulaire, décomposition du prix, agent gestionnaire, montant maximum, date de début et date de fin maximum sont obligatoires.'
          : 'Titulaire, décomposition du prix, agent gestionnaire, montant maximum, date de début et date de fin maximum sont obligatoires.',
      )
      return
    }
    if (libelleService.trim().length < LIBELLE_MIN_LENGTH) {
      setError(`Le libellé doit contenir au moins ${LIBELLE_MIN_LENGTH} caractères.`)
      return
    }

    const agent = agentOptions.find((a) => a.value === agentMatricule)

    setSubmitting(true)
    try {
      const payload = {
        libelleService: libelleService.trim(),
        idFournisseur: Number(idFournisseur),
        mtmaxi: Number(mtmaxi),
        dtedebut,
        dtefinmax,
        typedecompoprix,
        agentgestion: agent?.label ?? null,
        alertedate: alertedateJours.trim() ? Number(alertedateJours) : undefined,
        commentaire: commentaire.trim() ? commentaire.trim() : null,
      }
      if (mode === 'create') {
        await api.post('/marches/tiers', { idService, nummarche: nummarche.trim().toUpperCase(), ...payload })
      } else if (marcheTiers) {
        await api.put(`/marches/tiers/${marcheTiers.id_marche_tiers}`, { ...payload, actif: dtefinmaxExpire ? false : actif })
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
      <div className="gp-modal" role="dialog" aria-modal="true" aria-labelledby="marcheTiersModalTitle" style={{ maxWidth: 640 }}>
        <div className="gp-modal__hd">
          <h3 className="gp-modal__title" id="marcheTiersModalTitle">
            {mode === 'create' ? 'Nouveau marché tiers' : 'Modifier le marché tiers'}
          </h3>
          <button className="gp-modal__close" aria-label="Fermer" onClick={onClose}>
            <svg className="ti">
              <use href="#i-x" />
            </svg>
          </button>
        </div>
        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', minHeight: 0, overflow: 'hidden' }}>
          <div className="gp-modal__bd gp-scroll stack">
            {mode === 'edit' && marcheTiers && (
              <p className="gp-help">
                Numéro : {marcheTiers.nummarche} — Type de procédure : {marcheTiers.typeproc}
              </p>
            )}
            {mode === 'create' && (
              <div className="gp-field">
                <label className="gp-label" htmlFor="marche-tiers-nummarche">
                  Numéro du marché
                </label>
                <input
                  id="marche-tiers-nummarche"
                  className="gp-input"
                  value={nummarche}
                  onChange={(e) => setNummarche(e.target.value.toUpperCase())}
                  placeholder="P/M/S + 7 chiffres"
                  maxLength={20}
                />
              </div>
            )}
            <div className="gp-field">
              <label className="gp-label">Titulaire</label>
              <Combobox
                options={fournisseurOptions}
                value={idFournisseur}
                onChange={setIdFournisseur}
                placeholder="Choisir un fournisseur…"
                ariaLabel="Titulaire"
                style={{ maxWidth: 'none' }}
              />
            </div>
            <div className="gp-field">
              <label className="gp-label" htmlFor="marche-tiers-libelle">
                Libellé ({LIBELLE_MIN_LENGTH} caractères minimum)
              </label>
              <input
                id="marche-tiers-libelle"
                className="gp-input"
                value={libelleService}
                onChange={(e) => setLibelleService(e.target.value)}
                maxLength={500}
              />
            </div>
            <div className="row">
              <div className="gp-field" style={{ flex: 1 }}>
                <label className="gp-label">Décomposition du prix</label>
                <Combobox
                  options={TYPEDECOMPOPRIX_OPTIONS}
                  value={typedecompoprix}
                  onChange={setTypedecompoprix}
                  placeholder="Non renseigné"
                  clearLabel="Non renseigné"
                  ariaLabel="Décomposition du prix"
                  style={{ maxWidth: 'none' }}
                />
              </div>
              <div className="gp-field" style={{ flex: 1 }}>
                <label className="gp-label">Agent gestionnaire</label>
                <Combobox
                  options={agentOptions}
                  value={agentMatricule}
                  onChange={setAgentMatricule}
                  placeholder="Non renseigné"
                  clearLabel="Non renseigné"
                  ariaLabel="Agent gestionnaire"
                  style={{ maxWidth: 'none' }}
                />
              </div>
            </div>
            <div className="row">
              <div className="gp-field" style={{ flex: 1 }}>
                <label className="gp-label" htmlFor="marche-tiers-mtmaxi">
                  Montant maximum (€)
                </label>
                <input
                  id="marche-tiers-mtmaxi"
                  className="gp-input"
                  type="text"
                  inputMode="numeric"
                  pattern="[0-9]*"
                  value={mtmaxi}
                  onChange={(e) => setMtmaxi(sanitizeInteger(e.target.value))}
                />
              </div>
              <div className="gp-field" style={{ flex: 1 }}>
                <label className="gp-label" htmlFor="marche-tiers-alertedate">
                  Alerte sur date (jours)
                </label>
                <SpinButton
                  id="marche-tiers-alertedate"
                  ariaLabel="Alerte sur date"
                  min={0}
                  step={1}
                  value={alertedateJours}
                  onChange={setAlertedateJours}
                />
              </div>
            </div>
            <div className="row">
              <div className="gp-field" style={{ flex: 1 }}>
                <label className="gp-label" htmlFor="marche-tiers-dtedebut">
                  Début
                </label>
                <DatePicker id="marche-tiers-dtedebut" value={dtedebut} onChange={setDtedebut} ariaLabel="Date de début" />
              </div>
              <div className="gp-field" style={{ flex: 1 }}>
                <label className="gp-label" htmlFor="marche-tiers-dtefinmax">
                  Fin max
                </label>
                <DatePicker id="marche-tiers-dtefinmax" value={dtefinmax} onChange={setDtefinmax} ariaLabel="Date de fin maximum" />
              </div>
            </div>
            <div className="gp-field">
              <label className="gp-label" htmlFor="marche-tiers-commentaire">
                Commentaire
              </label>
              <textarea
                id="marche-tiers-commentaire"
                className="gp-textarea"
                value={commentaire}
                onChange={(e) => setCommentaire(e.target.value)}
                maxLength={2000}
              />
            </div>
            {mode === 'edit' && (
              <div className="stack" style={{ gap: 4 }}>
                <label className="gp-choice" style={{ justifyContent: 'space-between' }}>
                  <span>Actif</span>
                  <span className="gp-switch">
                    <input
                      type="checkbox"
                      checked={dtefinmaxExpire ? false : actif}
                      disabled={dtefinmaxExpire}
                      onChange={(e) => setActif(e.target.checked)}
                    />
                    <span className="track" />
                  </span>
                </label>
                {dtefinmaxExpire && (
                  <p className="gp-help">La date de fin maximum est dépassée : ce marché tiers sera automatiquement inactif.</p>
                )}
              </div>
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
