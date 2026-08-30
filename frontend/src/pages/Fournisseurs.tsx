import { useEffect, useState, type FormEvent } from 'react'
import { useFournisseurs, type Fournisseur, type Contact, type NatureFonction } from '../hooks/useFournisseurs'
import { useServices } from '../hooks/useServices'
import { useDirections } from '../hooks/useDirections'
import { useCurrentUser } from '../hooks/useCurrentUser'
import { Combobox } from '../components/Combobox'
import { api, ApiError } from '../services/api'

const STATUS_OPTIONS = [
  { value: 'active', label: 'Actifs' },
  { value: 'inactive', label: 'Inactifs' },
]

/**
 * Valeurs alignées sur la contrainte CHECK de la table physique
 * finances.contact (schéma préexistant, pas une liste inventée). Libellés
 * mis en forme pour l'affichage (la casse d'origine, en base, est ALL CAPS).
 */
const NATUREFONCTION_LABELS: Record<NatureFonction, string> = {
  DIRIGEANT: 'Dirigeant',
  JURIDIQUE: 'Juridique',
  COMMERCIAL: 'Commercial',
  "RESPONSABLE D'AFFAIRE": "Responsable d'affaire",
  'RESPONSABLE TECHNIQUE': 'Responsable technique',
  TECHNICIEN: 'Technicien',
  'RESPONSABLE FINANCIER/COMPTABILITE': 'Responsable financier/comptabilité',
}
const NATUREFONCTION_OPTIONS = (Object.keys(NATUREFONCTION_LABELS) as NatureFonction[]).map((value) => ({
  value,
  label: NATUREFONCTION_LABELS[value],
}))

/**
 * Structure d'un numéro de téléphone — même règle que le backend
 * (contact.service.ts) : format local français (0 + 9 chiffres) ou
 * international (+ suivi de 8 à 15 chiffres). Espaces/points/tirets
 * tolérés en saisie, retirés avant validation. Contrôle client redondant
 * avec le backend, qui reste seul à faire foi (jamais une garantie de
 * sécurité, voir ForClaude/SECURITY.md §3).
 */
const PHONE_REGEX = /^(?:0\d{9}|\+\d{8,15})$/
function isValidPhone(value: string): boolean {
  return PHONE_REGEX.test(value.replace(/[\s.-]/g, ''))
}

/** Contrôle de structure simple (pas de validation exhaustive RFC 5322) — homogène avec isValidPhone. */
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
function isValidEmail(value: string): boolean {
  return EMAIL_REGEX.test(value)
}

/**
 * Clé de contrôle du SIREN (algorithme de Luhn sur 9 chiffres, INSEE) —
 * même règle que le backend (fournisseur.service.ts). Espaces tolérés en
 * saisie. Exception connue, non couverte ici : quelques SIREN historiques
 * (ex. La Poste, 356000000) ne respectent pas cette règle mais restent
 * valides administrativement. Contrôle client redondant avec le backend,
 * qui reste seul à faire foi.
 */
function isValidSiren(value: string): boolean {
  const numero = value.replace(/\s/g, '')
  if (!/^\d{9}$/.test(numero)) return false

  let somme = 0
  for (let i = 0; i < 9; i++) {
    let chiffre = Number(numero[i])
    if (i % 2 === 1) {
      chiffre *= 2
      if (chiffre > 9) chiffre -= 9
    }
    somme += chiffre
  }
  return somme % 10 === 0
}

function matchesStatusFilter(actif: boolean, filter: string | null): boolean {
  if (filter === null) return true
  return filter === 'active' ? actif : !actif
}

/**
 * Administration de finances.fournisseur/finances.contact, montée sur
 * /fournisseurs (renommé depuis /parametres/fournisseurs le 30/08/2026 —
 * cette page n'est plus dans la section "Paramètres" mais reste tout de
 * même à sidebar vide, voir config/navigation.ts). Écriture ouverte à
 * ADMIN_APP (transverse) ou
 * ADMIN_SERVICE scopé à son propre service — même règle que SITE/SOUS_SITE,
 * SECTEUR/SOUS_SECTEUR et SEUIL_VALIDATION_DS (décision du 29/08/2026, voir
 * ForClaude/CDC/mot-phases-1-2.md l.68 et ForClaude/SECURITY.md §2.5).
 * Lecture scopée au service de l'acteur pour tout le monde sauf ADMIN_APP —
 * y compris un Demandeur sans rôle dédié — appliquée côté backend (voir
 * backend/src/services/fournisseur.service.ts), pas ici.
 *
 * Filtre Direction → Service en cascade, tous deux obligatoires pour afficher
 * la liste (même système que Cellules.tsx) : pas d'option "Toutes les
 * directions" ni "Tous les services". ADMIN_SERVICE : les deux filtres se
 * positionnent automatiquement sur son propre périmètre (comme Gisement
 * géographique/technique et Seuils de validation DS).
 *
 * Création (29/08/2026) : un Demandeur (sans rôle dédié) peut aussi créer un
 * fournisseur — seule la CRÉATION est ouverte au-delà d'ADMIN_APP/ADMIN_SERVICE
 * (la modification reste réservée à ces deux rôles). Pour ADMIN_SERVICE
 * *et* Demandeur, la modale de création n'affiche ni Direction ni Service :
 * le fournisseur hérite directement du service de l'agent connecté (voir
 * FournisseurFormModal, `defaultIdService`/`lockedToOwnService`). ADMIN_APP
 * garde le sélecteur Direction → Service complet, sans changement.
 *
 * FOURNISSEUR : pas de suppression physique (ETATFOURNISSEUR Actif/Inactif,
 * référencé par DEMANDE_ACHAT/DEVIS_CONSULTE/MARCHE). CONTACT : suppression
 * physique autorisée (pas de champ d'état, aucune autre table ne le
 * référence) — seule action destructive de l'application à ce jour, d'où la
 * confirmation avant suppression dans ContactsModal.
 */
export function Fournisseurs() {
  const { directions } = useDirections()
  const { services } = useServices()
  const { data: currentUser } = useCurrentUser()

  const isAdminApp = currentUser?.roles.some((r) => r.typeRole === 'ADMIN_APP') ?? false
  const adminServiceIds = (currentUser?.roles ?? [])
    .filter((r) => r.typeRole === 'ADMIN_SERVICE' && r.idService !== null)
    .map((r) => r.idService as number)
  const isRestrictedToOwnService = !isAdminApp && adminServiceIds.length > 0
  const visibleServices = isRestrictedToOwnService
    ? services.filter((s) => adminServiceIds.includes(s.id_service))
    : services

  // Demandeur : connecté, mais sans rôle ADMIN_APP/ADMIN_SERVICE — peut tout
  // de même créer un fournisseur pour son propre service (décision du
  // 29/08/2026, voir assertManagesServiceOrIsOwnActor côté backend). Son
  // service propre vient de /api/me (ACTEUR.ID_CELLULE → SERVICE), pas d'un
  // rôle : voir useCurrentUser.ts.
  const isPlainActor = !isAdminApp && !isRestrictedToOwnService
  // Service sur lequel verrouiller la création (ADMIN_SERVICE ou Demandeur) —
  // null pour ADMIN_APP, qui garde le sélecteur Direction → Service complet.
  const ownIdServiceForCreate = isRestrictedToOwnService
    ? (adminServiceIds[0] ?? null)
    : isPlainActor
      ? (currentUser?.idService ?? null)
      : null

  const [filterIdDirection, setFilterIdDirection] = useState<string | null>(null)
  const [filterIdService, setFilterIdService] = useState<string | null>(null)
  const idServiceFilter = filterIdService !== null ? Number(filterIdService) : null
  const { fournisseurs, loading, refetch } = useFournisseurs(idServiceFilter)

  const directionOptions = directions.map((d) => ({ value: String(d.id_direction), label: d.libelle_direction }))
  const servicesForFilter =
    filterIdDirection === null ? [] : visibleServices.filter((s) => s.id_direction === Number(filterIdDirection))

  useEffect(() => {
    // ADMIN_SERVICE : verrouille les deux filtres sur son propre périmètre.
    // Fusionné avec la logique de cascade ci-dessous dans le MÊME effet (voir
    // GisementGeographique.tsx pour le pourquoi : les séparer cause une
    // régression où l'effet de cascade efface le service qui vient d'être
    // verrouillé, car il s'exécute avec le filterIdDirection encore null de
    // ce même rendu).
    if (isRestrictedToOwnService && filterIdDirection === null) {
      const ownService = services.find((s) => s.id_service === adminServiceIds[0])
      if (ownService) {
        setFilterIdDirection(String(ownService.id_direction))
        setFilterIdService(String(adminServiceIds[0]))
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
  }, [isRestrictedToOwnService, adminServiceIds.join(','), services, filterIdDirection])

  const serviceOptions = servicesForFilter.map((s) => ({ value: String(s.id_service), label: s.libelle_service }))
  const serviceLabel = (idService: number) => services.find((s) => s.id_service === idService)?.libelle_service ?? '—'

  const [statusFilter, setStatusFilter] = useState<string | null>(null)
  const displayedFournisseurs =
    filterIdDirection === null || filterIdService === null
      ? []
      : fournisseurs.filter((f) => matchesStatusFilter(f.actif, statusFilter))

  const [fournisseurModal, setFournisseurModal] = useState<{ mode: 'create' | 'edit'; fournisseur: Fournisseur | null } | null>(
    null,
  )
  const [contactsModalId, setContactsModalId] = useState<number | null>(null)
  const contactsModalFournisseur = fournisseurs.find((f) => f.id_fournisseur === contactsModalId) ?? null
  const [fournisseurToDelete, setFournisseurToDelete] = useState<Fournisseur | null>(null)

  return (
    <div className="stack">
      <div className="page-heading">
        <div>
          <h1>Fournisseurs</h1>
          <p>Référentiel fournisseurs et leurs contacts, rattachés à un service.</p>
        </div>
        <div className="page-actions">
          <button
            className="gp-btn gp-btn--primary"
            onClick={() => setFournisseurModal({ mode: 'create', fournisseur: null })}
          >
            <svg className="ti">
              <use href="#i-plus" />
            </svg>
            Nouveau fournisseur
          </button>
        </div>
      </div>

      <div className="row">
        <div className="gp-field" style={{ width: 404 }}>
          <label className="gp-label">Direction</label>
          <Combobox
            options={directionOptions}
            value={filterIdDirection}
            onChange={setFilterIdDirection}
            placeholder="Choisir une direction…"
            ariaLabel="Filtrer par direction"
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
              ariaLabel="Filtrer par service"
              style={{ maxWidth: 'none' }}
            />
          </div>
        )}
        <div className="gp-field" style={{ maxWidth: 200 }}>
          <label className="gp-label">Statut</label>
          <Combobox
            options={STATUS_OPTIONS}
            value={statusFilter}
            onChange={setStatusFilter}
            placeholder="Tous"
            clearLabel="Tous"
            ariaLabel="Filtrer les fournisseurs par statut"
          />
        </div>
      </div>

      <div className="gp-table-wrap gp-scroll">
        <table className="gp-table">
          <thead>
            <tr>
              <th>Raison sociale</th>
              <th>SIREN</th>
              <th>Ville</th>
              <th>Service</th>
              <th>Statut</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {loading && (
              <tr>
                <td colSpan={6}>Chargement…</td>
              </tr>
            )}
            {!loading && displayedFournisseurs.length === 0 && (
              <tr>
                <td colSpan={6}>
                  {filterIdDirection === null || filterIdService === null
                    ? 'Sélectionne une direction et un service pour afficher les fournisseurs.'
                    : 'Aucun fournisseur pour ce filtre.'}
                </td>
              </tr>
            )}
            {displayedFournisseurs.map((fournisseur) => (
              <tr key={fournisseur.id_fournisseur}>
                <td>{fournisseur.raison_sociale_service}</td>
                <td className="mono">{fournisseur.siren}</td>
                <td>{fournisseur.ville ?? '—'}</td>
                <td>{serviceLabel(fournisseur.id_service)}</td>
                <td>
                  {fournisseur.actif ? (
                    <span className="gp-badge gp-badge--success">Actif</span>
                  ) : (
                    <span className="gp-badge gp-badge--danger">Inactif</span>
                  )}
                </td>
                <td>
                  <div className="gp-rowacts">
                    <span className="gp-tip" data-tip="Voir les contacts">
                      <button aria-label="Voir les contacts" onClick={() => setContactsModalId(fournisseur.id_fournisseur)}>
                        <svg className="ti">
                          <use href="#i-users" />
                        </svg>
                      </button>
                    </span>
                    <span className="gp-tip" data-tip="Modifier le fournisseur">
                      <button
                        aria-label="Modifier le fournisseur"
                        onClick={() => setFournisseurModal({ mode: 'edit', fournisseur })}
                      >
                        <svg className="ti">
                          <use href="#i-pencil" />
                        </svg>
                      </button>
                    </span>
                    <span className="gp-tip" data-tip="Supprimer le fournisseur">
                      <button
                        className="del"
                        aria-label="Supprimer le fournisseur"
                        onClick={() => setFournisseurToDelete(fournisseur)}
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

      {fournisseurModal && (
        <FournisseurFormModal
          mode={fournisseurModal.mode}
          fournisseur={fournisseurModal.fournisseur}
          services={visibleServices}
          directions={directions}
          defaultIdService={ownIdServiceForCreate}
          lockedToOwnService={!isAdminApp}
          onClose={() => setFournisseurModal(null)}
          onSaved={() => {
            setFournisseurModal(null)
            void refetch()
          }}
        />
      )}

      {contactsModalFournisseur && (
        <ContactsModal
          fournisseur={contactsModalFournisseur}
          onClose={() => setContactsModalId(null)}
          onChanged={refetch}
        />
      )}

      {fournisseurToDelete && (
        <DeleteFournisseurModal
          fournisseur={fournisseurToDelete}
          onClose={() => setFournisseurToDelete(null)}
          onDeleted={() => {
            setFournisseurToDelete(null)
            void refetch()
          }}
        />
      )}
    </div>
  )
}

interface DeleteFournisseurModalProps {
  fournisseur: Fournisseur
  onClose: () => void
  onDeleted: () => void
}

/**
 * Suppression conditionnelle (décision du 29/08/2026) : le backend refuse en
 * 409 si un marché, une demande d'achat ou un devis référence encore ce
 * fournisseur — l'écran affiche alors le message renvoyé par l'API (qui
 * oriente vers l'état Inactif) plutôt qu'une erreur générique.
 */
function DeleteFournisseurModal({ fournisseur, onClose, onDeleted }: DeleteFournisseurModalProps) {
  const [deleting, setDeleting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleDelete() {
    setDeleting(true)
    setError(null)
    try {
      await api.delete(`/fournisseurs/${fournisseur.id_fournisseur}`)
      onDeleted()
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Une erreur est survenue.')
    } finally {
      setDeleting(false)
    }
  }

  return (
    <div className="gp-overlay is-open">
      <div className="gp-modal" role="dialog" aria-modal="true" aria-labelledby="deleteFournisseurModalTitle">
        <div className="gp-modal__hd">
          <h3 className="gp-modal__title" id="deleteFournisseurModalTitle">
            Supprimer le fournisseur
          </h3>
          <button className="gp-modal__close" aria-label="Fermer" onClick={onClose}>
            <svg className="ti">
              <use href="#i-x" />
            </svg>
          </button>
        </div>
        <div className="gp-modal__bd gp-scroll stack">
          <p>
            Supprimer définitivement {fournisseur.raison_sociale_service} et tous ses contacts ? Cette action est
            irréversible.
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

interface FournisseurFormModalProps {
  mode: 'create' | 'edit'
  fournisseur: Fournisseur | null
  services: { id_service: number; libelle_service: string; id_direction: number }[]
  directions: { id_direction: number; libelle_direction: string }[]
  defaultIdService: number | null
  /** ADMIN_SERVICE ou Demandeur (pas ADMIN_APP) : pas de sélecteur en création, le fournisseur hérite du service de l'agent connecté (decision du 29/08/2026). */
  lockedToOwnService: boolean
  onClose: () => void
  onSaved: () => void
}

/**
 * Création (coordonnées + Actif, Direction → Service en cascade pour
 * ADMIN_APP uniquement) ou modification (coordonnées + Actif uniquement — le
 * service d'un fournisseur ne se réassigne pas depuis l'UI, décision
 * utilisateur comme SITE/SECTEUR). RAISON_SOCIALE_PGI et NUMPGI ne sont
 * jamais saisis ici : ils ne sont renseignés que par l'import PGI
 * (TYPE_CREATION=PGI, pas encore implémenté — voir OP3.1 du MCT), toujours
 * null pour un fournisseur créé côté service (TYPE_CREATION=SERVICE, valeur
 * imposée par le backend à la création).
 *
 * `lockedToOwnService` (ADMIN_SERVICE ou Demandeur) : la création n'affiche
 * ni Direction ni Service — le fournisseur hérite directement du service de
 * l'agent connecté (`defaultIdService`), rappelé en lecture seule comme en
 * modification. Seul ADMIN_APP garde le sélecteur Direction → Service
 * complet (décision du 29/08/2026 : Demandeur, sans rôle dédié, peut créer un
 * fournisseur pour son propre service — voir assertManagesServiceOrIsOwnActor
 * côté backend).
 *
 * SIREN obligatoire et validé par sa clé de contrôle (Luhn, voir
 * isValidSiren) — même règle qu'en backend (fournisseur.service.ts), qui
 * reste seul à faire foi.
 */
function FournisseurFormModal({
  mode,
  fournisseur,
  services,
  directions,
  defaultIdService,
  lockedToOwnService,
  onClose,
  onSaved,
}: FournisseurFormModalProps) {
  const [idDirection, setIdDirection] = useState<string | null>(null)
  const [idService, setIdService] = useState<string | null>(
    fournisseur?.id_service != null
      ? String(fournisseur.id_service)
      : defaultIdService != null
        ? String(defaultIdService)
        : null,
  )
  const [raisonSocialeService, setRaisonSocialeService] = useState(fournisseur?.raison_sociale_service ?? '')
  const [siren, setSiren] = useState(fournisseur?.siren ?? '')
  const [adr1, setAdr1] = useState(fournisseur?.adr1 ?? '')
  const [adr2, setAdr2] = useState(fournisseur?.adr2 ?? '')
  const [cp, setCp] = useState(fournisseur?.cp ?? '')
  const [ville, setVille] = useState(fournisseur?.ville ?? '')
  const [cedex, setCedex] = useState(fournisseur?.cedex ?? '')
  const [actif, setActif] = useState(fournisseur?.actif ?? true)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const directionOptions = directions.map((d) => ({ value: String(d.id_direction), label: d.libelle_direction }))
  const servicesForDirection = idDirection === null ? [] : services.filter((s) => s.id_direction === Number(idDirection))
  const serviceOptions = (mode === 'create' ? servicesForDirection : services).map((s) => ({
    value: String(s.id_service),
    label: s.libelle_service,
  }))
  const selectedService = idService !== null ? services.find((s) => s.id_service === Number(idService)) : undefined
  const selectedDirection = selectedService
    ? directions.find((d) => d.id_direction === selectedService.id_direction)
    : undefined

  useEffect(() => {
    // lockedToOwnService : idDirection n'est jamais renseigné (pas de combo
    // Direction) — idService reste fixé à defaultIdService pour toute la vie
    // de la modale, cet effet ne doit pas y toucher (sinon il l'efface dès le
    // montage : servicesForDirection vaut [] tant qu'idDirection est null).
    if (mode !== 'create' || lockedToOwnService || idService === null) return
    if (!servicesForDirection.some((s) => s.id_service === Number(idService))) setIdService(null)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [idDirection])

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault()
    setError(null)

    if (mode === 'create' && !lockedToOwnService && !idDirection) {
      setError('La direction est obligatoire.')
      return
    }
    if (!idService) {
      setError('Le service est obligatoire.')
      return
    }
    if (!siren) {
      setError('Le SIREN est obligatoire.')
      return
    }
    if (!isValidSiren(siren)) {
      setError('SIREN invalide (clé de contrôle incorrecte).')
      return
    }

    setSubmitting(true)
    try {
      const payload = {
        raisonSocialeService,
        siren,
        adr1: adr1 || null,
        adr2: adr2 || null,
        cp: cp || null,
        ville: ville || null,
        cedex: cedex || null,
        actif,
      }
      if (mode === 'create') {
        await api.post('/fournisseurs', { ...payload, idService: Number(idService) })
      } else if (fournisseur) {
        await api.put(`/fournisseurs/${fournisseur.id_fournisseur}`, payload)
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
      <div className="gp-modal" role="dialog" aria-modal="true" aria-labelledby="fournisseurModalTitle">
        <div className="gp-modal__hd">
          <h3 className="gp-modal__title" id="fournisseurModalTitle">
            {mode === 'create' ? 'Nouveau fournisseur' : 'Modifier le fournisseur'}
          </h3>
          <button className="gp-modal__close" aria-label="Fermer" onClick={onClose}>
            <svg className="ti">
              <use href="#i-x" />
            </svg>
          </button>
        </div>
        <form onSubmit={handleSubmit}>
          <div className="gp-modal__bd gp-scroll stack">
            {(mode === 'edit' || (mode === 'create' && lockedToOwnService)) && (
              <p className="gp-help">
                Direction : {selectedDirection?.libelle_direction ?? '—'}
                <br />
                Service : {selectedService?.libelle_service ?? '—'}
              </p>
            )}
            {mode === 'create' && !lockedToOwnService && (
              <div className="gp-field">
                <label className="gp-label">Direction</label>
                <Combobox
                  options={directionOptions}
                  value={idDirection}
                  onChange={setIdDirection}
                  placeholder="Choisir une direction…"
                  ariaLabel="Direction"
                  style={{ maxWidth: 'none' }}
                />
              </div>
            )}
            {mode === 'create' && !lockedToOwnService && idDirection !== null && (
              <div className="gp-field">
                <label className="gp-label">Service</label>
                <Combobox
                  options={serviceOptions}
                  value={idService}
                  onChange={setIdService}
                  placeholder="Choisir un service…"
                  ariaLabel="Service"
                  style={{ maxWidth: 'none' }}
                />
              </div>
            )}
            <div className="gp-field">
              <label className="gp-label" htmlFor="fournisseur-raison-sociale">
                Raison sociale
              </label>
              <input
                id="fournisseur-raison-sociale"
                className="gp-input"
                value={raisonSocialeService}
                onChange={(e) => setRaisonSocialeService(e.target.value)}
                required
                maxLength={200}
              />
            </div>
            <div className="gp-field">
              <label className="gp-label" htmlFor="fournisseur-siren">
                SIREN
              </label>
              <input
                id="fournisseur-siren"
                className="gp-input"
                value={siren}
                onChange={(e) => setSiren(e.target.value)}
                required
                maxLength={20}
              />
            </div>
            <div className="gp-field">
              <label className="gp-label" htmlFor="fournisseur-adr1">
                Adresse
              </label>
              <input
                id="fournisseur-adr1"
                className="gp-input"
                value={adr1}
                onChange={(e) => setAdr1(e.target.value)}
                maxLength={200}
              />
            </div>
            <div className="gp-field">
              <label className="gp-label" htmlFor="fournisseur-adr2">
                Complément d'adresse
              </label>
              <input
                id="fournisseur-adr2"
                className="gp-input"
                value={adr2}
                onChange={(e) => setAdr2(e.target.value)}
                maxLength={200}
              />
            </div>
            <div className="row">
              <div className="gp-field" style={{ maxWidth: 140 }}>
                <label className="gp-label" htmlFor="fournisseur-cp">
                  Code postal
                </label>
                <input
                  id="fournisseur-cp"
                  className="gp-input"
                  value={cp}
                  onChange={(e) => setCp(e.target.value)}
                  maxLength={10}
                />
              </div>
              <div className="gp-field" style={{ flex: 1 }}>
                <label className="gp-label" htmlFor="fournisseur-ville">
                  Ville
                </label>
                <input
                  id="fournisseur-ville"
                  className="gp-input"
                  value={ville}
                  onChange={(e) => setVille(e.target.value)}
                  maxLength={100}
                />
              </div>
            </div>
            <div className="gp-field">
              <label className="gp-label" htmlFor="fournisseur-cedex">
                Cedex
              </label>
              <input
                id="fournisseur-cedex"
                className="gp-input"
                value={cedex}
                onChange={(e) => setCedex(e.target.value)}
                maxLength={100}
              />
            </div>
            <label className="gp-choice" style={{ justifyContent: 'space-between' }}>
              <span>Actif</span>
              <span className="gp-switch">
                <input type="checkbox" checked={actif} onChange={(e) => setActif(e.target.checked)} />
                <span className="track" />
              </span>
            </label>
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

interface ContactsModalProps {
  fournisseur: Fournisseur
  onClose: () => void
  onChanged: () => void
}

/**
 * Liste des contacts d'un fournisseur — création/modification/suppression,
 * pas de réordonnancement (pas de champ ordre documenté au MCD pour CONTACT).
 *
 * Ergonomie (décision du 29/08/2026) : deux colonnes seulement (Contact,
 * Actions) — la première empile Nom Prénom puis, en dessous, Nature de
 * fonction et Fonction. `.gp-modal` est explicitement élargi à 720px (défaut
 * du gabarit : 440px) : `.gp-table` impose `min-width:680px` (gpmm.css,
 * partagé — jamais modifié), qui forçait un défilement horizontal dans la
 * largeur par défaut, quel que soit le nombre de colonnes. Élargir `.gp-modal`
 * via `style` inline reprend le pattern déjà utilisé par le gabarit lui-même
 * (`gpmm-style-guide.html`, modale de confirmation en `max-width:400px`), pas
 * une entorse. `.gp-table-wrap` reçoit une `minHeight` pour garder au moins 3
 * lignes visibles même quand il y a peu de contacts (sinon la modale se
 * contracte au contenu réel).
 */
function ContactsModal({ fournisseur, onClose, onChanged }: ContactsModalProps) {
  const [formModal, setFormModal] = useState<{ mode: 'create' | 'edit'; contact: Contact | null } | null>(null)
  const [contactToDelete, setContactToDelete] = useState<Contact | null>(null)
  const [deleting, setDeleting] = useState(false)
  const [deleteError, setDeleteError] = useState<string | null>(null)

  async function handleDelete() {
    if (!contactToDelete) return
    setDeleting(true)
    setDeleteError(null)
    try {
      await api.delete(`/fournisseurs/${fournisseur.id_fournisseur}/contacts/${contactToDelete.id_contact}`)
      setContactToDelete(null)
      onChanged()
    } catch (err) {
      setDeleteError(err instanceof ApiError ? err.message : 'Une erreur est survenue.')
    } finally {
      setDeleting(false)
    }
  }

  return (
    <>
      <div className="gp-overlay is-open">
        <div
          className="gp-modal"
          role="dialog"
          aria-modal="true"
          aria-labelledby="contactsModalTitle"
          style={{ maxWidth: 720 }}
        >
          <div className="gp-modal__hd">
            <h3 className="gp-modal__title" id="contactsModalTitle">
              Contacts — {fournisseur.raison_sociale_service}
            </h3>
            <button className="gp-modal__close" aria-label="Fermer" onClick={onClose}>
              <svg className="ti">
                <use href="#i-x" />
              </svg>
            </button>
          </div>
          <div className="gp-modal__bd gp-scroll stack">
            <div className="row" style={{ justifyContent: 'flex-end' }}>
              <button
                type="button"
                className="gp-btn gp-btn--ghost gp-btn--sm"
                onClick={() => setFormModal({ mode: 'create', contact: null })}
              >
                <svg className="ti">
                  <use href="#i-plus" />
                </svg>
                Nouveau contact
              </button>
            </div>
            {fournisseur.contacts.length === 0 ? (
              <p>Aucun contact.</p>
            ) : (
              <div className="gp-table-wrap gp-scroll" style={{ minHeight: 210 }}>
                <table className="gp-table">
                  <thead>
                    <tr>
                      <th>Contact</th>
                      <th>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {fournisseur.contacts.map((contact) => (
                      <tr key={contact.id_contact}>
                        <td>
                          <div>
                            {contact.nom}
                            {contact.prenom ? ` ${contact.prenom}` : ''}
                          </div>
                          <div className="gp-help">
                            {contact.naturefonction ? NATUREFONCTION_LABELS[contact.naturefonction] : '—'}
                            {contact.fonction ? ` — ${contact.fonction}` : ''}
                          </div>
                        </td>
                        <td>
                          <div className="gp-rowacts">
                            <span className="gp-tip" data-tip="Modifier le contact">
                              <button
                                aria-label="Modifier le contact"
                                onClick={() => setFormModal({ mode: 'edit', contact })}
                              >
                                <svg className="ti">
                                  <use href="#i-pencil" />
                                </svg>
                              </button>
                            </span>
                            <span className="gp-tip" data-tip="Supprimer le contact">
                              <button
                                className="del"
                                aria-label="Supprimer le contact"
                                onClick={() => setContactToDelete(contact)}
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
            )}
          </div>
          <div className="gp-modal__ft">
            <button type="button" className="gp-btn gp-btn--secondary" onClick={onClose}>
              Fermer
            </button>
          </div>
        </div>
      </div>

      {formModal && (
        <ContactFormModal
          mode={formModal.mode}
          idFournisseur={fournisseur.id_fournisseur}
          contact={formModal.contact}
          onClose={() => setFormModal(null)}
          onSaved={() => {
            setFormModal(null)
            onChanged()
          }}
        />
      )}

      {contactToDelete && (
        <div className="gp-overlay is-open">
          <div className="gp-modal" role="dialog" aria-modal="true" aria-labelledby="deleteContactModalTitle">
            <div className="gp-modal__hd">
              <h3 className="gp-modal__title" id="deleteContactModalTitle">
                Supprimer le contact
              </h3>
              <button className="gp-modal__close" aria-label="Fermer" onClick={() => setContactToDelete(null)}>
                <svg className="ti">
                  <use href="#i-x" />
                </svg>
              </button>
            </div>
            <div className="gp-modal__bd gp-scroll stack">
              <p>
                Supprimer définitivement {contactToDelete.nom}
                {contactToDelete.prenom ? ` ${contactToDelete.prenom}` : ''} ? Cette action est irréversible.
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
              <button type="button" className="gp-btn gp-btn--secondary" onClick={() => setContactToDelete(null)}>
                Annuler
              </button>
              <button type="button" className="gp-btn gp-btn--danger" onClick={handleDelete} disabled={deleting}>
                {deleting ? 'Suppression…' : 'Supprimer'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}

interface ContactFormModalProps {
  mode: 'create' | 'edit'
  idFournisseur: number
  contact: Contact | null
  onClose: () => void
  onSaved: () => void
}

/**
 * Nom, prénom et nature de fonction obligatoires ; au moins un des deux
 * numéros de téléphone (fixe ou mobile) doit être renseigné, avec une
 * structure valide (locale 0XXXXXXXXX ou internationale +CC..., voir
 * isValidPhone) ; le mail, s'il est renseigné, doit avoir une structure
 * valide (isValidEmail) — décision utilisateur du 29/08/2026, appliquée en
 * création ET en modification (même règle des deux côtés, pour ne pas
 * laisser un contact redevenir incomplet après une modification). Le NOM
 * est saisi et stocké en MAJUSCULES (mis en forme à la frappe ici,
 * re-normalisé défensivement côté backend).
 *
 * Anomalies homogènes (décision du 29/08/2026) : tous les contrôles (nom,
 * prénom, mail, téléphones, nature de fonction) passent par `setError` et
 * s'affichent de la même façon, dans le même `<p className="gp-errmsg">` —
 * aucun champ ne s'appuie sur la validation native du navigateur
 * (`required`/`type="email"`), qui affichait une bulle d'erreur différente
 * et incohérente avec les autres contrôles (téléphones, nature de
 * fonction). Tout est revalidé côté backend (contact.service.ts) — cette
 * validation client est un confort, jamais la garantie.
 */
function ContactFormModal({ mode, idFournisseur, contact, onClose, onSaved }: ContactFormModalProps) {
  const [nom, setNom] = useState(contact?.nom ?? '')
  const [prenom, setPrenom] = useState(contact?.prenom ?? '')
  const [mail, setMail] = useState(contact?.mail ?? '')
  const [telfixe, setTelfixe] = useState(contact?.telfixe ?? '')
  const [telmobile, setTelmobile] = useState(contact?.telmobile ?? '')
  const [fonction, setFonction] = useState(contact?.fonction ?? '')
  const [naturefonction, setNaturefonction] = useState<string | null>(contact?.naturefonction ?? null)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault()
    setError(null)

    if (!nom.trim()) {
      setError('Le nom est obligatoire.')
      return
    }
    if (!prenom.trim()) {
      setError('Le prénom est obligatoire.')
      return
    }
    if (mail && !isValidEmail(mail)) {
      setError('Adresse mail invalide.')
      return
    }
    if (!telfixe && !telmobile) {
      setError('Renseignez au moins un numéro de téléphone (fixe ou mobile).')
      return
    }
    if ((telfixe && !isValidPhone(telfixe)) || (telmobile && !isValidPhone(telmobile))) {
      setError('Numéro de téléphone invalide (ex. 06 83 09 58 81 ou +33 6 83 09 58 81).')
      return
    }
    if (!naturefonction) {
      setError('La nature de fonction est obligatoire.')
      return
    }

    setSubmitting(true)
    try {
      const payload = {
        nom,
        prenom: prenom || null,
        mail: mail || null,
        telfixe: telfixe || null,
        telmobile: telmobile || null,
        fonction: fonction || null,
        naturefonction: naturefonction || null,
      }
      if (mode === 'create') {
        await api.post(`/fournisseurs/${idFournisseur}/contacts`, payload)
      } else if (contact) {
        await api.put(`/fournisseurs/${idFournisseur}/contacts/${contact.id_contact}`, payload)
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
      <div className="gp-modal" role="dialog" aria-modal="true" aria-labelledby="contactModalTitle">
        <div className="gp-modal__hd">
          <h3 className="gp-modal__title" id="contactModalTitle">
            {mode === 'create' ? 'Nouveau contact' : 'Modifier le contact'}
          </h3>
          <button className="gp-modal__close" aria-label="Fermer" onClick={onClose}>
            <svg className="ti">
              <use href="#i-x" />
            </svg>
          </button>
        </div>
        <form onSubmit={handleSubmit}>
          <div className="gp-modal__bd gp-scroll stack">
            <div className="gp-field">
              <label className="gp-label" htmlFor="contact-nom">
                Nom
              </label>
              <input
                id="contact-nom"
                className="gp-input"
                value={nom}
                onChange={(e) => setNom(e.target.value.toUpperCase())}
                maxLength={200}
              />
            </div>
            <div className="gp-field">
              <label className="gp-label" htmlFor="contact-prenom">
                Prénom
              </label>
              <input
                id="contact-prenom"
                className="gp-input"
                value={prenom}
                onChange={(e) => setPrenom(e.target.value)}
                maxLength={200}
              />
            </div>
            <div className="gp-field">
              <label className="gp-label" htmlFor="contact-mail">
                Mail
              </label>
              <input
                id="contact-mail"
                className="gp-input"
                type="text"
                value={mail}
                onChange={(e) => setMail(e.target.value)}
                maxLength={200}
              />
            </div>
            <div className="row">
              <div className="gp-field" style={{ flex: 1 }}>
                <label className="gp-label" htmlFor="contact-telfixe">
                  Téléphone fixe
                </label>
                <input
                  id="contact-telfixe"
                  className="gp-input"
                  value={telfixe}
                  onChange={(e) => setTelfixe(e.target.value)}
                  placeholder="06 83 09 58 81"
                  maxLength={20}
                />
              </div>
              <div className="gp-field" style={{ flex: 1 }}>
                <label className="gp-label" htmlFor="contact-telmobile">
                  Téléphone mobile
                </label>
                <input
                  id="contact-telmobile"
                  className="gp-input"
                  value={telmobile}
                  onChange={(e) => setTelmobile(e.target.value)}
                  placeholder="+33 6 83 09 58 81"
                  maxLength={20}
                />
              </div>
            </div>
            <div className="gp-field">
              <label className="gp-label" htmlFor="contact-fonction">
                Fonction
              </label>
              <input
                id="contact-fonction"
                className="gp-input"
                value={fonction}
                onChange={(e) => setFonction(e.target.value)}
                maxLength={200}
              />
            </div>
            <div className="gp-field">
              <label className="gp-label">Nature de fonction</label>
              <Combobox
                options={NATUREFONCTION_OPTIONS}
                value={naturefonction}
                onChange={setNaturefonction}
                placeholder="Choisir…"
                ariaLabel="Nature de fonction"
                style={{ maxWidth: 'none' }}
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
