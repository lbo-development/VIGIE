import { useEffect, useState, type FormEvent } from 'react'
import { useServices } from '../../hooks/useServices'
import { useFournisseurs } from '../../hooks/useFournisseurs'
import { useMarches } from '../../hooks/useMarches'
import { useMarcheTiers } from '../../hooks/useMarcheTiers'
import { useLibelleReferentiel } from '../../hooks/useLibelleReferentiel'
import {
  updateDemandeAchat,
  selectMarcheDemandeAchat,
  getConsultationDemandeAchat,
  addConsultationCandidat,
  removeConsultationCandidat,
  saveConsultationDemandeAchat,
  getOrCreateMarcheDevis,
  uploadDevisFile,
  downloadDevisFileBlob,
  deleteDevisFile,
  getPiecesDemandeAchat,
  addPieceDemandeAchat,
  removePieceDemandeAchat,
  downloadPieceDemandeAchatBlob,
  deleteDemandeAchat,
  type DemandeAchat as DemandeAchatRow,
  type ProcedureAchat,
  type MotifChoix,
  type ConsultationCandidat,
  type PieceJointe,
} from '../../hooks/useDemandeAchat'
import { Combobox } from '../Combobox'
import { FileDropzone } from '../FileDropzone'
import { SortableTh } from '../SortableTh'
import { useDragReorder } from '../../hooks/useDragReorder'
import { useColumnSort, sortRows } from '../../hooks/useColumnSort'
import { ApiError } from '../../services/api'
import { CURRENCY_FORMAT, CURRENCY_FORMAT_ROUND, MAX_FICHIER_TAILLE_OCTETS, sanitizeDecimal, formatMontantDecimal, triggerBlobDownload } from './constants'
import '../../styles/demandeachat.css'

const PROCEDURE_ACHAT_OPTIONS = [
  { value: 'MARCHE', label: 'Marché' },
  { value: 'HORS_MARCHE', label: 'Hors marché' },
]

export interface DemandeAchatModalProps {
  demandeAchat: DemandeAchatRow
  /** Faux dès la réouverture via « Modifier une DA » — décision du 09/09/2026 : la procédure d'achat ne se choisit qu'à la création, jamais ensuite. */
  procedureEditable: boolean
  /**
   * Mode consultation (icône loupe « Voir les éléments de la demande », onglets
   * 2/3/4 de l'écran d'accueil — décision du 15/09/2026) : champs figés en lecture
   * seule, pied de modale réduit à « Fermer », aucun accès aux sous-écrans
   * d'édition (Montant & marché / Éléments de consultation / Gestion
   * documentaire) — la DA/FAD n'est de toute façon plus éditable à ce stade.
   * Faux par défaut (comportement inchangé pour l'onglet « A finaliser »).
   */
  readOnly?: boolean
  onClose: () => void
  onSaved: () => void
}

/**
 * Modale CreationDA (croquis DA.pdf) — sert aussi bien à la finalisation
 * d'un brouillon tout juste créé qu'à la réouverture via « Modifier une
 * DA ». « Marché concerné » ouvre MarcheDaModal (procédure MARCHE
 * uniquement, décision du 08/09/2026) : NUMMARCHE/ID_MARCHE_TIERS et le
 * fournisseur retenu qui en découle sont tenus en état local (pas dans le
 * formulaire principal, mis à jour immédiatement par MarcheDaModal — pas de
 * « Enregistrer » à part pour ce choix, contrairement à Objet/Description/
 * Montant). « Fournisseurs consultés » reste désactivé : DEVIS_CONSULTE n'a
 * pas encore de backend.
 */
export function DemandeAchatModal({ demandeAchat, procedureEditable, readOnly = false, onClose, onSaved }: DemandeAchatModalProps) {
  // OBJET_RC/DESCRIPTION_RC (pas *_DEMANDEUR) : synchronisés tant que la DA est éditable par le
  // demandeur, font foi ensuite (décision du 15/09/2026 — voir MLD §2.4). updateDemandeAchat
  // (OP1.1) recopie la valeur saisie ici dans les deux colonnes côté serveur.
  const [objet, setObjet] = useState(demandeAchat.objet_rc)
  const [description, setDescription] = useState(demandeAchat.description_rc ?? '')
  const [montant, setMontant] = useState(String(demandeAchat.montant_demande || ''))
  const [procedureAchat, setProcedureAchat] = useState<ProcedureAchat>(demandeAchat.procedure_achat)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const [nummarche, setNummarche] = useState(demandeAchat.nummarche)
  const [idMarcheTiers, setIdMarcheTiers] = useState(demandeAchat.id_marche_tiers)
  const [idFournisseurRetenu, setIdFournisseurRetenu] = useState(demandeAchat.id_fournisseur_retenu)
  const [motifChoix, setMotifChoix] = useState(demandeAchat.motif_choix)
  const [libelleMotifChoix, setLibelleMotifChoix] = useState(demandeAchat.libelle_motif_choix)
  const [marcheModalOpen, setMarcheModalOpen] = useState(false)
  const [fournisseurModalOpen, setFournisseurModalOpen] = useState(false)
  const [gestionDocumentaireOpen, setGestionDocumentaireOpen] = useState(false)
  // Nombre d'entreprises consultées (résumé Hors marché, « Nom fournisseur — n entreprise(s) consultée(s) »
  // sur la même ligne) — connu immédiatement par FournisseurDaModal.onSaved (voir ci-dessous), mais
  // inconnu à l'ouverture d'une DA Hors marché déjà consultée lors d'une session précédente : chargé une
  // fois au montage dans ce cas (id_fournisseur_retenu déjà renseigné signifie qu'un « Enregistrer » a
  // déjà eu lieu, donc des candidats existent).
  const [candidatsCount, setCandidatsCount] = useState<number | null>(null)

  const { fournisseurs } = useFournisseurs(demandeAchat.id_service)
  const fournisseurRetenuLabel = fournisseurs.find((f) => f.id_fournisseur === idFournisseurRetenu)?.raison_sociale_service ?? null

  useEffect(() => {
    if (demandeAchat.procedure_achat !== 'HORS_MARCHE' || demandeAchat.id_fournisseur_retenu === null) return
    let cancelled = false
    getConsultationDemandeAchat(demandeAchat.id_demande_achat)
      .then((rows) => {
        if (!cancelled) setCandidatsCount(rows.length)
      })
      .catch(() => {
        // Best effort — le résumé se contente alors du nom du fournisseur, sans le compte.
      })
    return () => {
      cancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [demandeAchat.id_demande_achat])

  /**
   * Fermeture (✕/Retour) sans jamais être passé par « Enregistrer » : si le
   * brouillon est resté vierge (encore DA_EN_PREPARATION, objet toujours
   * vide en base — donc jamais sauvegardé, y compris pour un brouillon
   * fraîchement créé par « Nouvelle demande »), on le supprime pour éviter
   * qu'il ne traîne indéfiniment dans la liste. Best effort : un échec de
   * suppression ne bloque pas la fermeture.
   */
  async function handleClose() {
    if (readOnly) {
      onClose()
      return
    }
    if (demandeAchat.code_statut === 'DA_EN_PREPARATION' && !demandeAchat.objet_demandeur) {
      try {
        await deleteDemandeAchat(demandeAchat.id_demande_achat)
      } catch {
        // Best effort — le brouillon vide restera visible, sans conséquence bloquante.
      }
    }
    onClose()
  }

  /**
   * Persiste immédiatement le changement de procédure (au lieu d'attendre
   * « Enregistrer ») — bug corrigé le 09/09/2026 : « Sélectionner un
   * marché »/« Éléments de consultation » agissent sur PROCEDURE_ACHAT tel
   * qu'enregistré en base, pas sur l'état local de ce formulaire. Sans cette
   * sauvegarde immédiate, changer la procédure puis ouvrir aussitôt l'un de
   * ces sous-écrans échouait (409, la DA restait en base sur l'ancienne
   * procédure). Optimiste avec retour en arrière si l'appel échoue.
   */
  async function handleProcedureChange(v: ProcedureAchat) {
    const previous = procedureAchat
    setProcedureAchat(v)
    try {
      const da = await updateDemandeAchat(demandeAchat.id_demande_achat, { procedureAchat: v })
      // Bug corrigé le 09/09/2026 : le backend efface NUMMARCHE/ID_MARCHE_TIERS/
      // ID_FOURNISSEUR_RETENU/MOTIF_CHOIX/LIBELLE_MOTIF_CHOIX/MONTANT_DEMANDE au
      // changement de procédure — sans ce resync, le résumé (marché/fournisseur/
      // motif) affiché dans cette modale restait celui de l'ancienne procédure
      // tant qu'elle n'était pas rouverte.
      setNummarche(da.nummarche)
      setIdMarcheTiers(da.id_marche_tiers)
      setIdFournisseurRetenu(da.id_fournisseur_retenu)
      setMotifChoix(da.motif_choix)
      setLibelleMotifChoix(da.libelle_motif_choix)
      setMontant(String(da.montant_demande || ''))
      setCandidatsCount(null)
    } catch (err) {
      setProcedureAchat(previous)
      setError(err instanceof ApiError ? err.message : 'Impossible de changer la procédure.')
    }
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault()
    if (readOnly) return
    setError(null)

    if (objet.trim().length < 15) {
      setError("L'objet est obligatoire (15 caractères minimum).")
      return
    }
    if (!description.trim()) {
      setError('La description est obligatoire.')
      return
    }

    setSubmitting(true)
    try {
      await updateDemandeAchat(demandeAchat.id_demande_achat, {
        objet: objet.trim(),
        description: description.trim(),
        procedureAchat,
      })
      onSaved()
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Une erreur est survenue.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="gp-overlay is-open">
      {/* 760 (élargi depuis 640 le 09/09/2026) : la ligne Type procédure d'achat / Montant & marché / Gestion documentaire tient sur trois boutons/champs — 640px ne suffisait plus une fois "Gestion documentaire" ajouté (bascule à la ligne suivante, .row a flex-wrap:wrap et .gp-btn white-space:nowrap, gpmm.css). */}
      <div className="gp-modal" role="dialog" aria-modal="true" aria-labelledby="demandeAchatModalTitle" style={{ maxWidth: 760 }}>
        <div className="gp-modal__hd">
          <h3 className="gp-modal__title" id="demandeAchatModalTitle">
            {demandeAchat.numero}
          </h3>
          <button className="gp-modal__close" aria-label="Fermer" onClick={() => void handleClose()}>
            <svg className="ti">
              <use href="#i-x" />
            </svg>
          </button>
        </div>
        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', minHeight: 0, overflow: 'hidden' }}>
          <div className="gp-modal__bd gp-scroll stack">
            <div className="gp-field">
              <label className="gp-label" htmlFor="da-objet">
                Objet de la DA
              </label>
              <input
                id="da-objet"
                className="gp-input"
                value={objet}
                onChange={(e) => setObjet(e.target.value)}
                maxLength={75}
                readOnly={readOnly}
              />
            </div>

            <div className="gp-field">
              <label className="gp-label" htmlFor="da-description">
                Description de la DA
              </label>
              <textarea
                id="da-description"
                className="gp-textarea"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                maxLength={256}
                rows={4}
                readOnly={readOnly}
              />
            </div>

            {procedureAchat === 'MARCHE' && (nummarche !== null || idMarcheTiers !== null) && (
              <span
                className="gp-tip da-modal__resume"
                data-tip={fournisseurRetenuLabel ? `${nummarche ?? `Marché tiers #${idMarcheTiers}`} — ${fournisseurRetenuLabel}` : undefined}
                style={{ display: 'block', width: '100%' }}
              >
                <span style={{ display: 'block', width: '100%', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  <span className="mono">{nummarche ?? `Marché tiers #${idMarcheTiers}`}</span>
                  {fournisseurRetenuLabel && ` — ${fournisseurRetenuLabel}`}
                </span>
              </span>
            )}

            {procedureAchat === 'HORS_MARCHE' && idFournisseurRetenu !== null && (
              <span
                className="gp-tip da-modal__resume"
                data-tip={fournisseurRetenuLabel ?? undefined}
                style={{ display: 'block', width: '100%' }}
              >
                <span style={{ display: 'block', width: '100%', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {fournisseurRetenuLabel ?? '—'}
                  {candidatsCount !== null && ` — ${candidatsCount} entreprise(s) consultée(s)`}
                </span>
              </span>
            )}

            <div className="row" style={{ alignItems: 'flex-start' }}>
              <div className="gp-field" style={{ flex: 2 }}>
                <label className="gp-label">Type procédure d'achat</label>
                {procedureEditable && !readOnly ? (
                  <Combobox
                    options={PROCEDURE_ACHAT_OPTIONS}
                    value={procedureAchat}
                    onChange={(v) => {
                      if (v === 'MARCHE' || v === 'HORS_MARCHE') void handleProcedureChange(v)
                    }}
                    placeholder="Choisir…"
                    ariaLabel="Type procédure d'achat"
                    style={{ maxWidth: 'none' }}
                  />
                ) : (
                  <input
                    className="gp-input"
                    value={PROCEDURE_ACHAT_OPTIONS.find((o) => o.value === procedureAchat)?.label ?? procedureAchat}
                    readOnly
                    aria-label="Type procédure d'achat"
                  />
                )}
              </div>

              <div className="gp-field" style={{ flex: '1 1 auto' }}>
                <label className="gp-label" style={{ visibility: 'hidden' }} aria-hidden="true">
                  .
                </label>
                {/* title natif plutôt que .gp-tip (rogné par overflow:hidden de .gp-modal — bulle trop large pour ce texte). */}
                <span style={{ width: '100%' }}>
                  <button
                    type="button"
                    className="gp-btn gp-btn--secondary"
                    disabled={readOnly}
                    title={
                      procedureAchat === 'MARCHE'
                        ? 'Choisir le marché à utiliser et le montant de la DA'
                        : 'Lister les entreprises consultées et le montant de leur devis'
                    }
                    onClick={() => (procedureAchat === 'MARCHE' ? setMarcheModalOpen(true) : setFournisseurModalOpen(true))}
                    style={{ width: '100%', justifyContent: 'center' }}
                  >
                    {procedureAchat === 'MARCHE' ? 'Montant & marché' : 'Éléments de consultation'}
                  </button>
                </span>
              </div>

              <div className="gp-field" style={{ flex: '1 1 auto' }}>
                <label className="gp-label" style={{ visibility: 'hidden' }} aria-hidden="true">
                  .
                </label>
                <span
                  className="gp-tip"
                  data-tip={
                    idFournisseurRetenu === null
                      ? 'Identifiez d\'abord un fournisseur (marché ou éléments de consultation)'
                      : 'Gérer les devis et pièces complémentaires de la DA'
                  }
                >
                  <button
                    type="button"
                    className="gp-btn gp-btn--secondary"
                    disabled={idFournisseurRetenu === null || readOnly}
                    onClick={() => setGestionDocumentaireOpen(true)}
                    style={{ width: '100%', justifyContent: 'center' }}
                  >
                    <svg className="ti">
                      <use href="#i-folder" />
                    </svg>
                    Gestion documentaire
                  </button>
                </span>
              </div>
            </div>

            <div className="row">
              <div className="gp-field" style={{ flex: '0 0 21.25%' }}>
                <label className="gp-label" htmlFor="da-montant">
                  Montant DA
                </label>
                <input id="da-montant" className="gp-input" value={formatMontantDecimal(montant) || '—'} readOnly />
              </div>
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
            <button type="button" className="gp-btn gp-btn--secondary" onClick={() => void handleClose()}>
              {readOnly ? 'Fermer' : 'Retour'}
            </button>
            {!readOnly && (
              <button type="submit" className="gp-btn gp-btn--primary" disabled={submitting}>
                {submitting ? 'Enregistrement…' : 'Enregistrer'}
              </button>
            )}
          </div>
        </form>
      </div>

      {marcheModalOpen && (
        <MarcheDaModal
          idDemandeAchat={demandeAchat.id_demande_achat}
          idService={demandeAchat.id_service}
          currentNummarche={nummarche}
          currentIdMarcheTiers={idMarcheTiers}
          initialMontant={montant}
          onClose={() => setMarcheModalOpen(false)}
          onSelected={(da) => {
            setNummarche(da.nummarche)
            setIdMarcheTiers(da.id_marche_tiers)
            setIdFournisseurRetenu(da.id_fournisseur_retenu)
            setMontant(String(da.montant_demande || ''))
          }}
        />
      )}

      {fournisseurModalOpen && (
        <FournisseurDaModal
          idDemandeAchat={demandeAchat.id_demande_achat}
          idService={demandeAchat.id_service}
          initialMotifChoix={motifChoix}
          initialLibelleMotifChoix={libelleMotifChoix}
          onClose={() => setFournisseurModalOpen(false)}
          onSaved={(da, count) => {
            setIdFournisseurRetenu(da.id_fournisseur_retenu)
            setMotifChoix(da.motif_choix)
            setLibelleMotifChoix(da.libelle_motif_choix)
            // Nettoyage croisé (bug corrigé le 09/09/2026) : le backend efface NUMMARCHE/ID_MARCHE_TIERS au même appel.
            setNummarche(da.nummarche)
            setIdMarcheTiers(da.id_marche_tiers)
            // MONTANT_DEMANDE dérivé du candidat retenu (décision du 09/09/2026) — voir formatMontantDecimal, affichage seul dans CreationDA.
            setMontant(String(da.montant_demande || ''))
            setCandidatsCount(count)
          }}
        />
      )}

      {gestionDocumentaireOpen && idFournisseurRetenu !== null && (
        <GestionDocumentaireModal
          idDemandeAchat={demandeAchat.id_demande_achat}
          idService={demandeAchat.id_service}
          procedureAchat={procedureAchat}
          objetDa={objet}
          idFournisseurRetenu={idFournisseurRetenu}
          montantDemande={Number(montant) || 0}
          onClose={() => setGestionDocumentaireOpen(false)}
        />
      )}
    </div>
  )
}

export interface MarcheDaModalProps {
  idDemandeAchat: number
  idService: number
  currentNummarche: string | null
  currentIdMarcheTiers: number | null
  initialMontant: string
  onClose: () => void
  onSelected: (demandeAchat: DemandeAchatRow) => void
}

const FILTRE_MARCHE_OPTIONS = [
  { value: 'MARCHE', label: 'Marché service' },
  { value: 'MARCHE_TIERS', label: 'Marché tiers' },
  { value: 'TOUS', label: 'Tous' },
]

/** Jours restants avant DTEFINMAX (arrondi au jour), `null` si la date n'est pas renseignée. */
function joursRestants(dtefinmax: string | null): number | null {
  if (!dtefinmax) return null
  const diffMs = new Date(`${dtefinmax}T00:00:00`).getTime() - new Date().setHours(0, 0, 0, 0)
  return Math.round(diffMs / 86400000)
}

interface MarcheDaRow {
  key: string
  origin: 'MARCHE' | 'MARCHE_TIERS'
  numero: string
  fournisseur: string
  libelle: string
  jours: number | null
  alertedate: number
  /** `null` pour un marché tiers (pas d'alerte sur montant, croquis DA.pdf page 3). */
  montantRestant: number | null
  seuilMontant: number | null
  select: { nummarche: string | null; idMarcheTiers: number | null }
}

type MarcheDaColumn = 'numero' | 'fournisseur' | 'libelle' | 'alertedate' | 'alertemt'

/**
 * Écran MarcheDA (bouton « Marché concerné », CreationDA — procédure MARCHE
 * uniquement, croquis DA.pdf page 3) : liste combinée des marchés du service
 * (finances.marche, UTILISABLE = ACTIF ET COMPLETUDE) et des marchés tiers
 * (finances.marche_tiers, ACTIF), filtrable par « Filtre marché » (Marché
 * service/Marché tiers/Tous) et par recherche texte client (numéro,
 * fournisseur, libellé — aucun paramètre de recherche serveur, même principe
 * que MarchesPGI.tsx/MarchesTiers.tsx). Sélection par clic sur la ligne
 * (bascule), saisie du montant obligatoire, « Enregistrer » commet le tout en
 * un seul appel à PUT /demandes-achat/:id/marche (ID_FOURNISSEUR_RETENU/
 * MOTIF_CHOIX dérivés côté serveur, jamais ici).
 */
export function MarcheDaModal({
  idDemandeAchat,
  idService,
  currentNummarche,
  currentIdMarcheTiers,
  initialMontant,
  onClose,
  onSelected,
}: MarcheDaModalProps) {
  const [filtre, setFiltre] = useState<string | null>('TOUS')
  const [search, setSearch] = useState('')
  const [montant, setMontant] = useState(initialMontant)
  const [montantFocused, setMontantFocused] = useState(false)
  const [selection, setSelection] = useState<{ nummarche: string | null; idMarcheTiers: number | null }>({
    nummarche: currentNummarche,
    idMarcheTiers: currentIdMarcheTiers,
  })
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const { marches } = useMarches(idService)
  const { marcheTiers } = useMarcheTiers(idService)
  const { fournisseurs } = useFournisseurs(idService)
  const fournisseurLabel = (idFournisseur: number) => fournisseurs.find((f) => f.id_fournisseur === idFournisseur)?.raison_sociale_service ?? '—'

  const rowsMarche: MarcheDaRow[] = marches
    .filter((m) => m.utilisable)
    .map((m) => ({
      key: m.nummarche,
      origin: 'MARCHE',
      numero: m.nummarche,
      fournisseur: m.fournisseur_raison_sociale ?? '—',
      libelle: m.libelle_service ?? '—',
      jours: joursRestants(m.dtefinmax),
      alertedate: m.alertedate,
      montantRestant: m.mt_solde,
      seuilMontant: m.mtmaxi != null ? m.alertemt * m.mtmaxi : null,
      select: { nummarche: m.nummarche, idMarcheTiers: null },
    }))
  const rowsMarcheTiers: MarcheDaRow[] = marcheTiers
    .filter((m) => m.actif)
    .map((m) => ({
      key: String(m.id_marche_tiers),
      origin: 'MARCHE_TIERS',
      numero: m.nummarche,
      fournisseur: fournisseurLabel(m.id_fournisseur),
      libelle: m.libelle_service,
      jours: joursRestants(m.dtefinmax),
      alertedate: m.alertedate,
      montantRestant: null,
      seuilMontant: null,
      select: { nummarche: null, idMarcheTiers: m.id_marche_tiers },
    }))

  const searchLc = search.trim().toLowerCase()
  const rows = (filtre === 'MARCHE' ? rowsMarche : filtre === 'MARCHE_TIERS' ? rowsMarcheTiers : [...rowsMarche, ...rowsMarcheTiers]).filter(
    (r) => !searchLc || r.numero.toLowerCase().includes(searchLc) || r.fournisseur.toLowerCase().includes(searchLc) || r.libelle.toLowerCase().includes(searchLc),
  )

  const { sort, toggleSort } = useColumnSort<MarcheDaColumn>()
  const displayedRows = sortRows(rows, sort, (r, column) => {
    if (column === 'numero') return r.numero
    if (column === 'fournisseur') return r.fournisseur
    if (column === 'libelle') return r.libelle
    if (column === 'alertedate') return String(r.jours ?? -1)
    return String(r.montantRestant ?? -1)
  })

  const isSelected = (r: MarcheDaRow) => r.select.nummarche === selection.nummarche && r.select.idMarcheTiers === selection.idMarcheTiers

  function toggleSelect(r: MarcheDaRow) {
    setSelection(isSelected(r) ? { nummarche: null, idMarcheTiers: null } : r.select)
  }

  async function handleSubmit() {
    setError(null)
    if (!montant.trim()) {
      setError('Le montant est obligatoire.')
      return
    }
    setSubmitting(true)
    try {
      const da = await selectMarcheDemandeAchat(idDemandeAchat, { ...selection, montantDemande: Number(montant) })
      onSelected(da)
      onClose()
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Une erreur est survenue.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="gp-overlay is-open">
      <div className="gp-modal" role="dialog" aria-modal="true" aria-labelledby="marcheDaModalTitle" style={{ maxWidth: 1196 }}>
        <div className="gp-modal__hd">
          <h3 className="gp-modal__title" id="marcheDaModalTitle">
            Sélectionner un marché
          </h3>
          <button className="gp-modal__close" aria-label="Fermer" onClick={onClose}>
            <svg className="ti">
              <use href="#i-x" />
            </svg>
          </button>
        </div>
        <div className="gp-modal__bd gp-scroll stack">
          <div className="row" style={{ flexWrap: 'wrap' }}>
            <div className="gp-field" style={{ flex: 1 }}>
              <label className="gp-label" htmlFor="marcheda-recherche">
                Recherche
              </label>
              <div className="gp-inputgroup">
                <svg className="ti">
                  <use href="#i-search" />
                </svg>
                <input
                  id="marcheda-recherche"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Recherche sur numéro marché, fournisseur, libellé…"
                  aria-label="Recherche sur numéro marché, fournisseurs, libelle marche"
                />
              </div>
            </div>
            <div className="gp-field" style={{ width: 200 }}>
              <label className="gp-label">Filtre marché</label>
              <Combobox
                options={FILTRE_MARCHE_OPTIONS}
                value={filtre}
                onChange={setFiltre}
                placeholder="Tous"
                ariaLabel="Filtre marché"
                style={{ maxWidth: 'none' }}
              />
            </div>
          </div>

          <div className="gp-table-wrap gp-scroll" style={{ maxHeight: 320 }}>
            <table className="gp-table da-marche-table">
              <colgroup>
                <col style={{ width: 109 }} />
                <col style={{ width: 226 }} />
                <col style={{ width: 546 }} />
                <col style={{ width: 124 }} />
                <col style={{ width: 106 }} />
              </colgroup>
              <thead>
                <tr>
                  <SortableTh label="Numéro marche" column="numero" sort={sort} onSort={toggleSort} />
                  <SortableTh label="Fournisseur" column="fournisseur" sort={sort} onSort={toggleSort} />
                  <SortableTh label="Libelle" column="libelle" sort={sort} onSort={toggleSort} />
                  <SortableTh label="Alerte date" column="alertedate" sort={sort} onSort={toggleSort} />
                  <SortableTh label="Alerte MT" column="alertemt" sort={sort} onSort={toggleSort} />
                </tr>
              </thead>
              <tbody>
                {displayedRows.map((r) => (
                  <tr key={r.key} className={isSelected(r) ? 'is-sel' : undefined} onClick={() => toggleSelect(r)} style={{ cursor: 'pointer' }}>
                    <td className="mono">{r.numero}</td>
                    <td>{r.fournisseur}</td>
                    <td>{r.libelle}</td>
                    <td>
                      {r.jours !== null && (
                        <span className={`da-alert-dot ${r.jours >= r.alertedate ? 'da-alert-dot--ok' : 'da-alert-dot--warn'}`} />
                      )}
                      {r.jours !== null ? `${r.jours} jours` : '—'}
                    </td>
                    <td>
                      {r.origin === 'MARCHE_TIERS' ? (
                        <span className="da-alert-tiers" title="Marché tiers — pas d'alerte sur montant">
                          <svg className="ti">
                            <use href="#i-chevron-right" />
                          </svg>
                        </span>
                      ) : (
                        <>
                          {r.montantRestant !== null && r.seuilMontant !== null && (
                            <span className={`da-alert-dot ${r.montantRestant >= r.seuilMontant ? 'da-alert-dot--ok' : 'da-alert-dot--warn'}`} />
                          )}
                          {r.montantRestant !== null ? CURRENCY_FORMAT_ROUND.format(r.montantRestant) : '—'}
                        </>
                      )}
                    </td>
                  </tr>
                ))}
                {displayedRows.length === 0 && (
                  <tr>
                    <td colSpan={5}>Aucun résultat.</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          <div className="gp-field" style={{ width: 220 }}>
            <label className="gp-label" htmlFor="marcheda-montant">
              Montant de la demande d'achat
            </label>
            <input
              id="marcheda-montant"
              className="gp-input"
              value={montantFocused ? montant : formatMontantDecimal(montant)}
              onChange={(e) => setMontant(sanitizeDecimal(e.target.value))}
              onFocus={() => setMontantFocused(true)}
              onBlur={() => setMontantFocused(false)}
              inputMode="decimal"
              placeholder="Saisie du Montant"
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
            Retour
          </button>
          <button type="button" className="gp-btn gp-btn--primary" disabled={submitting} onClick={() => void handleSubmit()}>
            {submitting ? 'Enregistrement…' : 'Enregistrer'}
          </button>
        </div>
      </div>
    </div>
  )
}

const MAX_CANDIDATS = 5
const MOTIF_CHOIX_OPTIONS: MotifChoix[] = ['Prix', 'Délai', 'Technique', 'Autre']

interface FournisseurCandidat {
  idDevis: number
  idFournisseur: number
  montantDevis: string
  nomFichierOriginal: string | null
}

export interface FournisseurDaModalProps {
  idDemandeAchat: number
  idService: number
  initialMotifChoix: MotifChoix | null
  initialLibelleMotifChoix: string | null
  onClose: () => void
  /** `candidatsCount` : nombre d'entreprises consultées au moment de l'enregistrement — voir le résumé « Nom fournisseur — n entreprise(s) consultée(s) » de CreationDA. */
  onSaved: (demandeAchat: DemandeAchatRow, candidatsCount: number) => void
}

/**
 * Écran FournisseurDA (bouton « Éléments de consultation », CreationDA —
 * procédure HORS_MARCHE uniquement, croquis DA.pdf page 4) : liste des
 * entreprises consultées (1 à 5, sans doublon), ordonnée par glisser-déposer
 * (useDragReorder — le premier candidat est le retenu), montant du devis
 * pour chacune, motif du choix (libellé obligatoire si "Autre").
 * Adaptation du widget double-liste-avec-flèches du croquis en icônes
 * d'action par ligne (Ajouter/Retirer), pour rester cohérent avec le reste
 * de l'application (aucun composant "liste à transférer" ailleurs dans ce
 * codebase).
 *
 * Ajout/retrait d'un candidat écrit immédiatement en base (décision du
 * 09/09/2026 — addConsultationCandidat/removeConsultationCandidat) au lieu
 * d'être stocké seulement en état local jusqu'à « Enregistrer » : la ligne
 * DEVIS_CONSULTE doit exister dès l'ajout pour que le bouton « Gestion
 * documentaire » de CreationDA fonctionne avant même le premier
 * « Enregistrer » de la liste. « Enregistrer » ne fait plus que fixer
 * l'ordre/le montant/le motif (voir saveConsultationDemandeAchat) — il ne
 * crée ni ne supprime plus de ligne. La gestion documentaire (devis/pièces
 * complémentaires) a été retirée de cette modale le 09/09/2026 — elle
 * s'effectue désormais depuis CreationDA (bouton « Gestion documentaire »,
 * voir GestionDocumentaireModal).
 */
export function FournisseurDaModal({
  idDemandeAchat,
  idService,
  initialMotifChoix,
  initialLibelleMotifChoix,
  onClose,
  onSaved,
}: FournisseurDaModalProps) {
  const [loading, setLoading] = useState(true)
  const [candidats, setCandidats] = useState<FournisseurCandidat[]>([])
  const [search, setSearch] = useState('')
  const [motifChoix, setMotifChoixState] = useState<MotifChoix | null>(initialMotifChoix ?? 'Prix')
  const [libelleAutreMotif, setLibelleAutreMotif] = useState(initialLibelleMotifChoix ?? '')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [focusedMontantId, setFocusedMontantId] = useState<number | null>(null)
  const [pendingIdFournisseur, setPendingIdFournisseur] = useState<number | null>(null)

  const { fournisseurs } = useFournisseurs(idService)
  const { services } = useServices()
  const libelleService = services.find((s) => s.id_service === idService)?.libelle_service

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    getConsultationDemandeAchat(idDemandeAchat)
      .then((rows) => {
        if (cancelled) return
        setCandidats(
          [...rows]
            .sort((a, b) => a.ordre - b.ordre)
            .map((r) => ({
              idDevis: r.idDevis,
              idFournisseur: r.idFournisseur,
              montantDevis: r.montantDevis != null ? String(r.montantDevis) : '',
              nomFichierOriginal: r.nomFichierOriginal,
            })),
        )
      })
      .catch(() => {
        if (!cancelled) setError('Impossible de charger les entreprises déjà consultées.')
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [idDemandeAchat])

  const fournisseurLabel = (idFournisseur: number) => fournisseurs.find((f) => f.id_fournisseur === idFournisseur)?.raison_sociale_service ?? '—'

  const searchLc = search.trim().toLowerCase()
  const idsConsultes = new Set(candidats.map((c) => c.idFournisseur))
  const fournisseursDisponibles = fournisseurs
    .filter((f) => !idsConsultes.has(f.id_fournisseur))
    .filter((f) => !searchLc || f.raison_sociale_service.toLowerCase().includes(searchLc))

  async function ajouterCandidat(idFournisseur: number) {
    if (candidats.length >= MAX_CANDIDATS || pendingIdFournisseur !== null) return
    setError(null)
    setPendingIdFournisseur(idFournisseur)
    try {
      const candidat = await addConsultationCandidat(idDemandeAchat, idFournisseur)
      setCandidats((prev) => [
        ...prev,
        { idDevis: candidat.idDevis, idFournisseur: candidat.idFournisseur, montantDevis: '', nomFichierOriginal: candidat.nomFichierOriginal },
      ])
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Une erreur est survenue.')
    } finally {
      setPendingIdFournisseur(null)
    }
  }

  async function retirerCandidat(candidat: FournisseurCandidat) {
    if (pendingIdFournisseur !== null) return
    setError(null)
    setPendingIdFournisseur(candidat.idFournisseur)
    try {
      await removeConsultationCandidat(idDemandeAchat, candidat.idDevis)
      setCandidats((prev) => prev.filter((c) => c.idDevis !== candidat.idDevis))
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Une erreur est survenue.')
    } finally {
      setPendingIdFournisseur(null)
    }
  }

  function changerMontant(idDevis: number, value: string) {
    setCandidats((prev) => prev.map((c) => (c.idDevis === idDevis ? { ...c, montantDevis: sanitizeDecimal(value) } : c)))
  }

  const reorder = useDragReorder(
    candidats.map((c) => String(c.idDevis)),
    (newOrderKeys) => {
      const byId = new Map(candidats.map((c) => [String(c.idDevis), c]))
      setCandidats(newOrderKeys.map((key) => byId.get(key)!))
    },
  )

  async function handleSubmit() {
    setError(null)

    if (candidats.length === 0) {
      setError('Au moins une entreprise consultée est requise.')
      return
    }
    if (candidats.some((c) => !c.montantDevis.trim())) {
      setError('Le montant du devis est obligatoire pour chaque entreprise consultée.')
      return
    }
    if (!motifChoix) {
      setError('Le motif du choix est obligatoire.')
      return
    }
    if (motifChoix === 'Autre' && !libelleAutreMotif.trim()) {
      setError('Le libellé du motif est obligatoire quand le motif est "Autre".')
      return
    }

    setSubmitting(true)
    try {
      const da = await saveConsultationDemandeAchat(idDemandeAchat, {
        candidats: candidats.map((c) => ({ idDevis: c.idDevis, montantDevis: Number(c.montantDevis) })),
        motifChoix,
        libelleMotifChoix: motifChoix === 'Autre' ? libelleAutreMotif.trim() : undefined,
      })
      onSaved(da, candidats.length)
      onClose()
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Une erreur est survenue.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="gp-overlay is-open">
      <div className="gp-modal" role="dialog" aria-modal="true" aria-labelledby="fournisseurDaModalTitle" style={{ maxWidth: 900 }}>
        <div className="gp-modal__hd">
          <h3 className="gp-modal__title" id="fournisseurDaModalTitle">
            Éléments de consultation
          </h3>
          <button className="gp-modal__close" aria-label="Fermer" onClick={onClose}>
            <svg className="ti">
              <use href="#i-x" />
            </svg>
          </button>
        </div>
        <div className="gp-modal__bd gp-scroll stack">
          {loading ? (
            <p>Chargement…</p>
          ) : (
            <div className="stack" style={{ gap: 16 }}>
              <div className="stack" style={{ gap: 8 }}>
                <div className="row" style={{ alignItems: 'center', gap: 12 }}>
                  <label className="gp-label" htmlFor="fournisseurda-recherche">
                    Fournisseurs{libelleService ? ` : ${libelleService}` : ''}
                  </label>
                  <div className="gp-inputgroup" style={{ flex: 1 }}>
                    <svg className="ti">
                      <use href="#i-search" />
                    </svg>
                    <input
                      id="fournisseurda-recherche"
                      value={search}
                      onChange={(e) => setSearch(e.target.value)}
                      placeholder="Recherche libellé fournisseur…"
                      aria-label="Rechercher un fournisseur"
                    />
                  </div>
                </div>
                {/* Hauteur fixe = 5 lignes (25px/ligne, -30% des 36px par défaut de .gp-table — voir .da-fournisseurda-table), au-delà on scrolle. */}
                <div className="gp-table-wrap gp-scroll" style={{ height: 126 }}>
                  <table className="gp-table da-fournisseurda-table">
                    <tbody>
                      {fournisseursDisponibles.map((f) => (
                        <tr key={f.id_fournisseur}>
                          <td>{f.raison_sociale_service}</td>
                          <td style={{ width: 40 }}>
                            {/* title natif plutôt que .gp-tip (rogné par le scroll de la liste — voir commentaire sur la hauteur fixe ci-dessus). */}
                            <div className="gp-rowacts">
                              <button
                                type="button"
                                title={candidats.length >= MAX_CANDIDATS ? '5 entreprises consultées maximum' : 'Ajouter aux consultées'}
                                aria-label={`Ajouter ${f.raison_sociale_service} aux consultées`}
                                disabled={candidats.length >= MAX_CANDIDATS || pendingIdFournisseur !== null}
                                onClick={() => void ajouterCandidat(f.id_fournisseur)}
                              >
                                <svg className="ti" style={{ color: 'var(--gp-success)' }}>
                                  <use href="#i-circle-plus" />
                                </svg>
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                      {fournisseursDisponibles.length === 0 && (
                        <tr>
                          <td>Aucun fournisseur.</td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>

              <div className="stack" style={{ gap: 8 }}>
                <span className="gp-label">
                  {candidats.length} entreprise(s) consultée(s)
                </span>
                {/* Hauteur fixe = 3 lignes (41px/ligne — voir .da-consultees-table), au-delà on scrolle. */}
                <div className="gp-table-wrap gp-scroll" style={{ height: 123 }}>
                  <table className="gp-table da-consultees-table">
                    <tbody>
                      {candidats.map((c, index) => {
                        const key = String(c.idDevis)
                        return (
                          <tr key={key} {...reorder.dragProps(key)} style={{ opacity: reorder.draggedKey === key ? 0.5 : undefined }}>
                            <td className="mono" style={{ width: 24, cursor: 'grab' }} aria-label="Glisser pour réordonner">
                              <svg className="ti">
                                <use href="#i-grip-vertical" />
                              </svg>
                            </td>
                            <td>
                              {fournisseurLabel(c.idFournisseur)}
                              {index === 0 && <span className="gp-badge gp-badge--success" style={{ marginLeft: 6 }}>Retenu</span>}
                            </td>
                            <td style={{ width: 150 }}>
                              <input
                                className="gp-input gp-input--compact"
                                value={focusedMontantId === c.idDevis ? c.montantDevis : formatMontantDecimal(c.montantDevis)}
                                onChange={(e) => changerMontant(c.idDevis, e.target.value)}
                                onFocus={() => setFocusedMontantId(c.idDevis)}
                                onBlur={() => setFocusedMontantId(null)}
                                inputMode="decimal"
                                placeholder="Montant devis"
                                aria-label={`Montant du devis — ${fournisseurLabel(c.idFournisseur)}`}
                              />
                            </td>
                            <td style={{ width: 40 }}>
                              {/* title natif plutôt que .gp-tip (rogné par le scroll de la liste). */}
                              <div className="gp-rowacts">
                                <button
                                  className="del"
                                  title="Retirer des consultées"
                                  aria-label={`Retirer ${fournisseurLabel(c.idFournisseur)} des consultées`}
                                  disabled={pendingIdFournisseur !== null}
                                  onClick={() => void retirerCandidat(c)}
                                >
                                  <svg className="ti">
                                    <use href="#i-x" />
                                  </svg>
                                </button>
                              </div>
                            </td>
                          </tr>
                        )
                      })}
                      {candidats.length === 0 && (
                        <tr>
                          <td>Aucune entreprise consultée pour l'instant.</td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          <div className="gp-field">
            <span className="gp-label">Motif du choix</span>
            <div className="row" style={{ gap: 16, marginTop: 6, alignItems: 'center' }}>
              {MOTIF_CHOIX_OPTIONS.map((option) => (
                <label className="gp-choice da-motif-choice" key={option}>
                  <input
                    className="gp-radio"
                    type="radio"
                    name="fournisseurda-motif"
                    checked={motifChoix === option}
                    onChange={() => setMotifChoixState(option)}
                  />
                  {option}
                </label>
              ))}
              {motifChoix === 'Autre' && (
                <input
                  className="gp-input"
                  style={{ flex: 1, minWidth: 160 }}
                  value={libelleAutreMotif}
                  onChange={(e) => setLibelleAutreMotif(e.target.value)}
                  placeholder="Libellé autre motif"
                  aria-label="Libellé autre motif"
                />
              )}
            </div>
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
            Retour
          </button>
          <button type="button" className="gp-btn gp-btn--primary" disabled={submitting} onClick={() => void handleSubmit()}>
            {submitting ? 'Enregistrement…' : 'Enregistrer'}
          </button>
        </div>
      </div>
    </div>
  )
}

export interface GestionDocumentaireModalProps {
  idDemandeAchat: number
  idService: number
  procedureAchat: ProcedureAchat
  objetDa: string
  /** Fournisseur déjà identifié (marché retenu ou premier candidat consulté) — le bouton d'ouverture est désactivé tant qu'il vaut `null`. */
  idFournisseurRetenu: number
  /** DEMANDE_ACHAT.MONTANT_DEMANDE — montant affiché à côté du sélecteur Fournisseurs en procédure Marché (un seul fournisseur, DEVIS_CONSULTE.MONTANT_DEVIS non significatif pour cette procédure). En Hors marché, le montant affiché est celui du devis du fournisseur sélectionné (chacun le sien), ce prop n'est alors pas utilisé. */
  montantDemande: number
  onClose: () => void
}

/**
 * Écran unifié de gestion documentaire (bouton « Gestion documentaire »,
 * CreationDA — décision du 09/09/2026, croquis DA2.pdf page 1) : remplace le
 * dépôt de devis/pièces complémentaires depuis MarcheDA/FournisseurDA
 * (supprimé le même jour). Devis (DEVIS_CONSULTE) et pièces complémentaires
 * (PIECE_JOINTE) du fournisseur choisi dans le menu « Fournisseurs » — un
 * seul fournisseur possible en procédure Marché (le titulaire), la liste des
 * candidats consultés en Hors marché.
 */
export function GestionDocumentaireModal({
  idDemandeAchat,
  idService,
  procedureAchat,
  objetDa,
  idFournisseurRetenu,
  montantDemande,
  onClose,
}: GestionDocumentaireModalProps) {
  const [loading, setLoading] = useState(true)
  const [candidats, setCandidats] = useState<ConsultationCandidat[]>([])
  const [selectedIdFournisseur, setSelectedIdFournisseur] = useState<string | null>(null)
  const [pieces, setPieces] = useState<PieceJointe[]>([])
  const [piecesLoading, setPiecesLoading] = useState(false)
  const [devisLoading, setDevisLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [addPieceModalKind, setAddPieceModalKind] = useState<'DEVIS' | 'PIECE_COMPLEMENTAIRE' | null>(null)

  const { fournisseurs } = useFournisseurs(idService)
  const fournisseurLabel = (idFournisseur: number) => fournisseurs.find((f) => f.id_fournisseur === idFournisseur)?.raison_sociale_service ?? '—'
  const { items: typesPieceReferentiel } = useLibelleReferentiel('TYPE_PIECE_FAD')
  const typePieceLabel = (code: string) => typesPieceReferentiel.find((t) => t.code === code)?.libelle ?? code

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    getConsultationDemandeAchat(idDemandeAchat)
      .then((rows) => {
        if (cancelled) return
        setCandidats(rows)
        const initial = procedureAchat === 'MARCHE' ? idFournisseurRetenu : rows[0]?.idFournisseur ?? idFournisseurRetenu
        setSelectedIdFournisseur(String(initial))
      })
      .catch(() => {
        if (!cancelled) setError('Impossible de charger les éléments déjà déposés.')
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [idDemandeAchat, procedureAchat, idFournisseurRetenu])

  const fournisseurOptions =
    procedureAchat === 'MARCHE'
      ? [{ value: String(idFournisseurRetenu), label: fournisseurLabel(idFournisseurRetenu) }]
      : candidats.map((c) => ({ value: String(c.idFournisseur), label: fournisseurLabel(c.idFournisseur) }))

  const selectedIdFournisseurNum = selectedIdFournisseur !== null ? Number(selectedIdFournisseur) : null
  const devisSelected = candidats.find((c) => c.idFournisseur === selectedIdFournisseurNum) ?? null
  // Marché : un seul fournisseur, MONTANT_DEMANDE fait foi (DEVIS_CONSULTE.MONTANT_DEVIS non significatif — voir ForClaude/CDC/mld-phases-1-2.md).
  // Hors marché : chaque candidat a son propre devis, montant du fournisseur sélectionné.
  const montantAffiche = procedureAchat === 'MARCHE' ? montantDemande : devisSelected?.montantDevis ?? null

  useEffect(() => {
    if (selectedIdFournisseurNum === null) {
      setPieces([])
      return
    }
    let cancelled = false
    setPiecesLoading(true)
    getPiecesDemandeAchat(idDemandeAchat, selectedIdFournisseurNum)
      .then((rows) => {
        if (!cancelled) setPieces(rows)
      })
      .catch(() => {
        if (!cancelled) setError('Impossible de charger les pièces complémentaires.')
      })
      .finally(() => {
        if (!cancelled) setPiecesLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [idDemandeAchat, selectedIdFournisseurNum])

  /** MARCHE uniquement : la ligne DEVIS_CONSULTE peut ne pas encore exister (jamais ouverte via l'ancien bouton « Ajouter Devis » de MarcheDA) — créée à la volée. */
  async function handleOpenDevisModal() {
    if (devisSelected) {
      setAddPieceModalKind('DEVIS')
      return
    }
    setError(null)
    setDevisLoading(true)
    try {
      const candidat = await getOrCreateMarcheDevis(idDemandeAchat)
      setCandidats((prev) => [...prev, candidat])
      setAddPieceModalKind('DEVIS')
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Une erreur est survenue.')
    } finally {
      setDevisLoading(false)
    }
  }

  async function handleSupprimerDevis() {
    if (!devisSelected?.nomFichierOriginal) return
    setError(null)
    try {
      const candidat = await deleteDevisFile(idDemandeAchat, devisSelected.idDevis)
      setCandidats((prev) => prev.map((c) => (c.idDevis === candidat.idDevis ? candidat : c)))
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Une erreur est survenue.')
    }
  }

  async function handleTelechargerDevis() {
    if (!devisSelected?.nomFichierOriginal) return
    try {
      const blob = await downloadDevisFileBlob(idDemandeAchat, devisSelected.idDevis)
      triggerBlobDownload(blob, devisSelected.nomFichierOriginal)
    } catch {
      setError('Impossible de télécharger le devis.')
    }
  }

  async function handleSupprimerPiece(idPiece: number) {
    setError(null)
    try {
      await removePieceDemandeAchat(idDemandeAchat, idPiece)
      setPieces((prev) => prev.filter((p) => p.idPiece !== idPiece))
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Une erreur est survenue.')
    }
  }

  async function handleTelechargerPiece(piece: PieceJointe) {
    try {
      const blob = await downloadPieceDemandeAchatBlob(idDemandeAchat, piece.idPiece)
      triggerBlobDownload(blob, piece.nomFichierOriginal)
    } catch {
      setError('Impossible de télécharger la pièce.')
    }
  }

  return (
    <div className="gp-overlay is-open">
      <div className="gp-modal" role="dialog" aria-modal="true" aria-labelledby="gestionDocumentaireModalTitle" style={{ maxWidth: 640 }}>
        <div className="gp-modal__hd">
          <h3 className="gp-modal__title" id="gestionDocumentaireModalTitle">
            Gestion documentaire
          </h3>
          <button className="gp-modal__close" aria-label="Fermer" onClick={onClose}>
            <svg className="ti">
              <use href="#i-x" />
            </svg>
          </button>
        </div>
        <div className="gp-modal__bd gp-scroll stack">
          {loading ? (
            <p>Chargement…</p>
          ) : (
            <>
              <div className="row" style={{ alignItems: 'flex-start' }}>
                <div className="gp-field" style={{ flex: 2 }}>
                  <label className="gp-label">Fournisseurs</label>
                  <Combobox
                    options={fournisseurOptions}
                    value={selectedIdFournisseur}
                    onChange={setSelectedIdFournisseur}
                    placeholder="Choisir un fournisseur…"
                    ariaLabel="Fournisseur"
                    style={{ maxWidth: 'none' }}
                  />
                </div>
                <div className="gp-field" style={{ flex: '0 0 125px' }}>
                  <label className="gp-label" htmlFor="gestiondoc-montant">
                    Montant
                  </label>
                  <input
                    id="gestiondoc-montant"
                    className="gp-input"
                    value={montantAffiche !== null ? CURRENCY_FORMAT.format(montantAffiche) : '—'}
                    readOnly
                  />
                </div>
              </div>

              <div className="gp-field">
                <span className="gp-label">Devis</span>
                <div className="row" style={{ alignItems: 'center', gap: 8 }}>
                  <input className="gp-input" style={{ flex: 1 }} value={devisSelected?.nomFichierOriginal ?? 'Aucun devis déposé'} readOnly />
                  <div className="gp-rowacts">
                    <button
                      type="button"
                      title={devisSelected?.nomFichierOriginal ? 'Remplacer le devis' : 'Ajouter le devis'}
                      aria-label="Ajouter le devis"
                      disabled={devisLoading}
                      onClick={() => void handleOpenDevisModal()}
                    >
                      <svg className="ti" style={{ color: 'var(--gp-success)' }}>
                        <use href="#i-circle-plus" />
                      </svg>
                    </button>
                    <button
                      type="button"
                      title="Télécharger le devis"
                      aria-label="Télécharger le devis"
                      disabled={!devisSelected?.nomFichierOriginal}
                      onClick={() => void handleTelechargerDevis()}
                    >
                      <svg className="ti">
                        <use href="#i-download" />
                      </svg>
                    </button>
                    <button
                      type="button"
                      className="del"
                      title="Supprimer le devis"
                      aria-label="Supprimer le devis"
                      disabled={!devisSelected?.nomFichierOriginal}
                      onClick={() => void handleSupprimerDevis()}
                    >
                      <svg className="ti">
                        <use href="#i-trash" />
                      </svg>
                    </button>
                  </div>
                </div>
              </div>

              <div className="stack" style={{ gap: 8 }}>
                <div className="row" style={{ justifyContent: 'space-between', alignItems: 'center' }}>
                  <span className="gp-label">Pièces complémentaires</span>
                  <button
                    type="button"
                    className="gp-btn gp-btn--secondary"
                    disabled={selectedIdFournisseurNum === null}
                    onClick={() => setAddPieceModalKind('PIECE_COMPLEMENTAIRE')}
                  >
                    <svg className="ti">
                      <use href="#i-files" />
                    </svg>
                    Ajouter une pièce complémentaire
                  </button>
                </div>
                <div className="gp-table-wrap gp-scroll" style={{ maxHeight: 200, overflowY: 'auto', overflowX: 'hidden' }}>
                  {/*
                    table-layout:fixed — sans ça, .gp-table (white-space:nowrap partagé) laisse un nom
                    de fichier long élargir la colonne au lieu d'être tronqué par l'ellipsis.
                    minWidth:0 — .gp-table impose min-width:680px (pensé pour des tableaux à bien plus
                    de colonnes), toujours supérieur à la largeur utile de cette modale (maxWidth 640) :
                    sans cette surcharge, un défilement horizontal apparaissait même une fois les
                    colonnes réduites. Type pièce (colonne du milieu, sans largeur fixée) absorbe le
                    reste de la largeur disponible — tout tient sans défiler.
                  */}
                  <table className="gp-table" style={{ tableLayout: 'fixed', minWidth: 0, width: '100%' }}>
                    <colgroup>
                      <col style={{ width: 130 }} />
                      <col />
                      <col style={{ width: 80 }} />
                    </colgroup>
                    <thead>
                      <tr>
                        <th>Fichier PDF</th>
                        <th>Type pièce</th>
                        <th>Action</th>
                      </tr>
                    </thead>
                    <tbody>
                      {piecesLoading && (
                        <tr>
                          <td colSpan={3}>Chargement…</td>
                        </tr>
                      )}
                      {!piecesLoading &&
                        pieces.map((p) => (
                          <tr key={p.idPiece}>
                            <td
                              title={p.nomFichierOriginal}
                              style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}
                            >
                              {p.nomFichierOriginal}
                            </td>
                            <td style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{typePieceLabel(p.typePiece)}</td>
                            <td>
                              <div className="gp-rowacts">
                                <button title="Télécharger" aria-label={`Télécharger ${p.nomFichierOriginal}`} onClick={() => void handleTelechargerPiece(p)}>
                                  <svg className="ti">
                                    <use href="#i-download" />
                                  </svg>
                                </button>
                                <button
                                  className="del"
                                  title="Supprimer la pièce"
                                  aria-label={`Supprimer ${p.nomFichierOriginal}`}
                                  onClick={() => void handleSupprimerPiece(p.idPiece)}
                                >
                                  <svg className="ti">
                                    <use href="#i-trash" />
                                  </svg>
                                </button>
                              </div>
                            </td>
                          </tr>
                        ))}
                      {!piecesLoading && pieces.length === 0 && (
                        <tr>
                          <td colSpan={3}>Aucune pièce complémentaire.</td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </>
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
            Retour
          </button>
          <button type="button" className="gp-btn gp-btn--primary" onClick={onClose}>
            Enregistrer
          </button>
        </div>
      </div>

      {addPieceModalKind && selectedIdFournisseurNum !== null && (
        <AddPieceDaModal
          kind={addPieceModalKind}
          idDemandeAchat={idDemandeAchat}
          idDevis={addPieceModalKind === 'DEVIS' ? devisSelected?.idDevis : undefined}
          idFournisseur={selectedIdFournisseurNum}
          objetDa={objetDa}
          fournisseurLabel={fournisseurLabel(selectedIdFournisseurNum)}
          currentNomFichier={addPieceModalKind === 'DEVIS' ? (devisSelected?.nomFichierOriginal ?? null) : null}
          onClose={() => setAddPieceModalKind(null)}
          onUploadedDevis={(candidat) => setCandidats((prev) => prev.map((c) => (c.idDevis === candidat.idDevis ? candidat : c)))}
          onUploadedPiece={(piece) => setPieces((prev) => [...prev, piece])}
        />
      )}
    </div>
  )
}

export interface AddPieceDaModalProps {
  kind: 'DEVIS' | 'PIECE_COMPLEMENTAIRE'
  idDemandeAchat: number
  /** Requis quand `kind === 'DEVIS'`. */
  idDevis?: number
  idFournisseur: number
  objetDa: string
  fournisseurLabel: string
  currentNomFichier: string | null
  onClose: () => void
  onUploadedDevis: (candidat: ConsultationCandidat) => void
  onUploadedPiece: (piece: PieceJointe) => void
}

/** FICHE_FAD est généré par le système (fiche récapitulative de la FAD, Phase 2) — jamais proposé au dépôt manuel. */
const TYPE_PIECE_EXCLUS_SAISIE = new Set(['FICHE_FAD'])

/**
 * Modale AddPieces (croquis DA2.pdf page 2) : dépôt/remplacement d'un
 * fichier — devis (titre « Devis », remplace le fichier existant en place,
 * jamais de sélecteur de type) ou pièce complémentaire (titre « Pièce
 * complémentaire », type de pièce obligatoire, une nouvelle ligne
 * PIECE_JOINTE à chaque dépôt).
 */
export function AddPieceDaModal({
  kind,
  idDemandeAchat,
  idDevis,
  idFournisseur,
  objetDa,
  fournisseurLabel,
  currentNomFichier,
  onClose,
  onUploadedDevis,
  onUploadedPiece,
}: AddPieceDaModalProps) {
  const [file, setFile] = useState<File | null>(null)
  const [typePiece, setTypePiece] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const { items: typesPiece } = useLibelleReferentiel('TYPE_PIECE_FAD')
  const typePieceOptions = typesPiece.filter((t) => t.actif && !TYPE_PIECE_EXCLUS_SAISIE.has(t.code)).map((t) => ({ value: t.code, label: t.libelle }))

  useEffect(() => {
    if (kind === 'PIECE_COMPLEMENTAIRE' && !typePiece && typePieceOptions.length > 0) setTypePiece(typePieceOptions[0].value)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [typePieceOptions])

  async function handleSubmit() {
    setError(null)
    if (!file) {
      setError('Un fichier est requis.')
      return
    }
    if (kind === 'PIECE_COMPLEMENTAIRE' && !typePiece) {
      setError('Type de pièce requis.')
      return
    }
    setSubmitting(true)
    try {
      if (kind === 'DEVIS') {
        const candidat = await uploadDevisFile(idDemandeAchat, idDevis as number, file)
        onUploadedDevis(candidat)
      } else {
        const piece = await addPieceDemandeAchat(idDemandeAchat, idFournisseur, typePiece as string, file)
        onUploadedPiece(piece)
      }
      onClose()
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Une erreur est survenue.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="gp-overlay is-open">
      <div className="gp-modal" role="dialog" aria-modal="true" aria-labelledby="addPieceDaModalTitle" style={{ maxWidth: 560 }}>
        <div className="gp-modal__hd">
          <h3 className="gp-modal__title" id="addPieceDaModalTitle">
            {kind === 'DEVIS' ? 'Devis' : 'Pièce complémentaire'}
          </h3>
          <button className="gp-modal__close" aria-label="Fermer" onClick={onClose}>
            <svg className="ti">
              <use href="#i-x" />
            </svg>
          </button>
        </div>
        <div className="gp-modal__bd gp-scroll stack">
          <div className="stack" style={{ gap: 2 }}>
            <span className="gp-help">{objetDa || '—'}</span>
            <span className="gp-label">{fournisseurLabel}</span>
          </div>

          {kind === 'PIECE_COMPLEMENTAIRE' && (
            <div className="gp-field">
              <label className="gp-label">Type de pièce</label>
              <Combobox
                options={typePieceOptions}
                value={typePiece}
                onChange={(v) => {
                  if (v) setTypePiece(v)
                }}
                placeholder="Type de pièce"
                ariaLabel="Type de pièce"
                style={{ maxWidth: 'none' }}
              />
            </div>
          )}

          <div className="gp-field">
            <label className="gp-label">Fichier (PDF, 10 Mo max)</label>
            {!file && currentNomFichier && kind === 'DEVIS' && (
              <p className="gp-help">Devis actuel : {currentNomFichier} — déposer un fichier ci-dessous le remplace.</p>
            )}
            <FileDropzone accept="application/pdf" maxSizeOctets={MAX_FICHIER_TAILLE_OCTETS} file={file} onFileSelected={setFile} disabled={submitting} />
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
            Retour
          </button>
          <button type="button" className="gp-btn gp-btn--primary" disabled={submitting} onClick={() => void handleSubmit()}>
            {submitting ? 'Envoi…' : 'Enregistrer'}
          </button>
        </div>
      </div>
    </div>
  )
}

export function DeleteDemandeAchatModal({
  demandeAchat,
  onClose,
  onDeleted,
}: {
  demandeAchat: DemandeAchatRow
  onClose: () => void
  onDeleted: () => void
}) {
  const [deleting, setDeleting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleDelete() {
    setDeleting(true)
    setError(null)
    try {
      await deleteDemandeAchat(demandeAchat.id_demande_achat)
      onDeleted()
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Une erreur est survenue.')
    } finally {
      setDeleting(false)
    }
  }

  return (
    <div className="gp-overlay is-open">
      <div className="gp-modal" role="dialog" aria-modal="true" aria-labelledby="deleteDaModalTitle">
        <div className="gp-modal__hd">
          <h3 className="gp-modal__title" id="deleteDaModalTitle">
            Supprimer la demande d'achat
          </h3>
          <button className="gp-modal__close" aria-label="Fermer" onClick={onClose}>
            <svg className="ti">
              <use href="#i-x" />
            </svg>
          </button>
        </div>
        <div className="gp-modal__bd gp-scroll stack">
          <p>
            Supprimer définitivement la DA {demandeAchat.numero} ({demandeAchat.objet_rc || 'sans objet'}) ? Cette action
            est irréversible.
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
