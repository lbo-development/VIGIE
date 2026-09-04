import { useEffect, useRef, useState, type DragEvent } from 'react'
import { useCurrentUser } from '../hooks/useCurrentUser'
import { useDirections } from '../hooks/useDirections'
import { useServices } from '../hooks/useServices'
import { useMarcheImport } from '../hooks/useMarcheImport'
import { useLastImportMarchePgi } from '../hooks/useLastImportMarchePgi'
import { Combobox } from '../components/Combobox'

/** 'YYYY-MM-DD' (format des paramètres/dates stockées) -> 'JJ/MM/AAAA' (affichage). */
function formatDateFr(iso: string): string {
  const [y, m, d] = iso.split('-')
  return `${d}/${m}/${y}`
}

function daysBetween(from: Date, to: Date): number {
  return Math.round((to.getTime() - from.getTime()) / 86_400_000)
}

/** Même seuil que MarchesPGI.tsx#IMPORT_STALE_JOURS — les conditions d'alerte sont partagées. */
const IMPORT_STALE_JOURS = 15

/** Même texte que backend/src/services/marcheImport.service.ts#PARAMETRE_NON_INITIALISE. */
const PARAMETRE_NON_INITIALISE = 'Paramètre "last.import.marche.pgi" non initialisé.'

/**
 * Importation des marchés PGI, montée sur /marches/import (voir
 * config/navigation.ts, MARCHES_SIDEBAR_ITEMS). Réservée à ADMIN_APP/
 * ADMIN_SERVICE/CB (décision du 30/08/2026, voir import-marches-pgi.md §4) —
 * la sidebar masque déjà le lien pour les autres utilisateurs, ce contrôle
 * ici est une redondance pour un accès direct par URL.
 *
 * Filtre Direction → Service : même mécanisme que Fournisseurs.tsx (décision
 * du 30/08/2026, remplace un précédent système à deux branches "ADMIN_APP :
 * comboboxes / autres : texte figé"). Les deux comboboxes sont TOUJOURS
 * affichées, pour tout le monde ; ADMIN_SERVICE/CB voient leur liste de
 * services réduite à leur seul service propre (`visibleServices`) et les deux
 * filtres se positionnent automatiquement dessus (effet fusionné, comme
 * Fournisseurs.tsx — cf. son commentaire sur la course entre effets si séparé).
 * ADMIN_APP (transverse, aucun service propre) garde le sélecteur complet.
 *
 * Flux en deux temps (décision du 30/08/2026, revirement sur la décision du
 * 29/08 qui écartait toute confirmation intermédiaire — voir
 * import-marches-pgi.md §5) : dépôt du fichier → aperçu des conséquences
 * (créés/archivés) → clic sur "Confirmer l'import" pour écrire réellement.
 */
export function ImportMarches() {
  const { data: currentUser } = useCurrentUser()
  const { directions } = useDirections()
  const { services } = useServices()

  const isAdminApp = currentUser?.roles.some((r) => r.typeRole === 'ADMIN_APP') ?? false
  const adminServiceRole = currentUser?.roles.find((r) => r.typeRole === 'ADMIN_SERVICE' && r.idService !== null)
  const cbRole = currentUser?.roles.find((r) => r.typeRole === 'CB' && r.idService !== null)
  const hasAccess = isAdminApp || adminServiceRole !== undefined || cbRole !== undefined

  // Service propre (ADMIN_SERVICE ou CB) — les filtres s'y positionnent automatiquement.
  const ownIdService = adminServiceRole?.idService ?? cbRole?.idService ?? null
  const isRestrictedToOwnService = !isAdminApp && ownIdService != null
  const visibleServices = isRestrictedToOwnService
    ? services.filter((s) => s.id_service === ownIdService)
    : services

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

  const lastImportInfo = useLastImportMarchePgi(idService)
  const isParametreNonInitialise = lastImportInfo !== null && !lastImportInfo.exists
  const isImportStale =
    lastImportInfo !== null &&
    lastImportInfo.exists &&
    (lastImportInfo.valeur === null || daysBetween(new Date(lastImportInfo.valeur), new Date()) >= IMPORT_STALE_JOURS)

  const { state, preview, confirm, reset } = useMarcheImport(idService)
  const [dragActive, setDragActive] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  if (!hasAccess) {
    return (
      <div className="stack">
        <div className="page-heading">
          <div>
            <h1>Importation marchés PGI</h1>
            <p>Import du référentiel des marchés depuis un export Excel du PGI.</p>
          </div>
        </div>
        <div className="gp-errmsg">
          <svg className="ti">
            <use href="#i-alert-circle" />
          </svg>
          Droits insuffisants pour accéder à cette page.
        </div>
      </div>
    )
  }

  function handleFile(file: File | undefined) {
    if (!file || idService === null) return
    if (!file.name.toLowerCase().endsWith('.xlsx')) return
    void preview(file)
  }

  function handleDrop(event: DragEvent<HTMLDivElement>) {
    event.preventDefault()
    setDragActive(false)
    handleFile(event.dataTransfer.files[0])
  }

  function downloadCompteRendu() {
    if (state.step !== 'done') return
    const lines = [
      `Import marchés PGI — fichier généré le ${state.report.dateFichier}`,
      '',
      `Marchés créés (${state.report.aCreer.length}) :`,
      ...state.report.aCreer.map((m) => `  - ${m.nummarche}${m.libelle ? ` — ${m.libelle}` : ''}`),
      '',
      `Marchés archivés (${state.report.aArchiver.length}) :`,
      ...state.report.aArchiver.map((m) => `  - ${m.nummarche}${m.libelle ? ` — ${m.libelle}` : ''}`),
      '',
      `Fournisseurs ajoutés (${state.report.fournisseursAjoutes.length}) :`,
      ...state.report.fournisseursAjoutes.map((f) => `  - ${f.numpgi} — ${f.raisonSociale}`),
      '',
      `Anomalies (${state.report.anomalies.length}) :`,
      ...state.report.anomalies.map((a) => `  - ${a.ligne !== null ? `Ligne ${a.ligne} : ` : ''}${a.message}`),
    ]
    const blob = new Blob([lines.join('\n')], { type: 'text/plain;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = `compte-rendu-import-marches-${state.report.dateFichier}.txt`
    link.click()
    URL.revokeObjectURL(url)
  }

  return (
    <div className="stack">
      <div className="page-heading">
        <div>
          <h1>Importation marchés PGI</h1>
          {idService === null ? (
            <p>Import du référentiel des marchés depuis un export Excel du PGI.</p>
          ) : isParametreNonInitialise ? (
            <p className="gp-errmsg" style={{ color: 'var(--gp-warning-text)' }}>
              <svg className="ti">
                <use href="#i-alert-triangle" />
              </svg>
              {PARAMETRE_NON_INITIALISE}
            </p>
          ) : (
            lastImportInfo?.exists && (
              <div className="row" style={{ gap: 16 }}>
                <p className="gp-help">
                  {lastImportInfo.valeur
                    ? `Dernière importation le ${formatDateFr(lastImportInfo.valeur)}`
                    : 'Dernière importation — aucun import effectué'}
                </p>
                {isImportStale && (
                  <p className="gp-errmsg" style={{ color: 'var(--gp-warning-text)' }}>
                    <svg className="ti">
                      <use href="#i-alert-triangle" />
                    </svg>
                    Pensez à importer les marchés récents
                  </p>
                )}
              </div>
            )
          )}
        </div>
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

      {(filterIdDirection === null || filterIdService === null) && (
        <p>Sélectionne une direction et un service pour pouvoir importer un fichier.</p>
      )}

      {idService !== null && state.step !== 'done' && (
        <div
          className="gp-panel"
          style={{
            border: dragActive ? '2px dashed var(--gp-accent, #4a90d9)' : '2px dashed var(--gp-border, #444)',
            textAlign: 'center',
            padding: '2.5rem',
            cursor: 'pointer',
          }}
          onDragOver={(e) => {
            e.preventDefault()
            setDragActive(true)
          }}
          onDragLeave={() => setDragActive(false)}
          onDrop={handleDrop}
          onClick={() => fileInputRef.current?.click()}
        >
          <svg className="ti" style={{ width: 32, height: 32 }}>
            <use href="#i-cloud" />
          </svg>
          <p>Glisse-dépose le fichier Excel du PGI ici, ou clique pour le choisir.</p>
          <input
            ref={fileInputRef}
            type="file"
            accept=".xlsx"
            hidden
            onChange={(e) => handleFile(e.target.files?.[0])}
          />
        </div>
      )}

      {state.step === 'previewing' && <p>Vérification du fichier…</p>}

      {state.step === 'error' && (
        <p className="gp-errmsg">
          <svg className="ti">
            <use href="#i-alert-circle" />
          </svg>
          {state.message}
        </p>
      )}

      {(state.step === 'ready' || state.step === 'confirming') && (
        <div className="stack">
          {state.report.anomalies.length > 0 && (
            <div className="gp-errmsg">
              <svg className="ti">
                <use href="#i-alert-circle" />
              </svg>
              <div>
                {state.report.anomalies.length} anomalie(s) — ces lignes seront ignorées :
                <ul>
                  {state.report.anomalies.map((a, i) => (
                    <li key={i}>
                      {a.ligne !== null ? `Ligne ${a.ligne} : ` : ''}
                      {a.message}
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          )}

          <p>Fichier généré le {state.report.dateFichier}. Voici les conséquences de cet import :</p>

          <div className="gp-table-wrap gp-scroll">
            <table className="gp-table">
              <thead>
                <tr>
                  <th>Marchés à créer ({state.report.aCreer.length})</th>
                </tr>
              </thead>
              <tbody>
                {state.report.aCreer.length === 0 ? (
                  <tr>
                    <td>Aucun</td>
                  </tr>
                ) : (
                  state.report.aCreer.map((m) => (
                    <tr key={m.nummarche}>
                      <td>
                        {m.nummarche}
                        {m.libelle ? ` — ${m.libelle}` : ''}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          <div className="gp-table-wrap gp-scroll">
            <table className="gp-table">
              <thead>
                <tr>
                  <th>Marchés à archiver ({state.report.aArchiver.length})</th>
                </tr>
              </thead>
              <tbody>
                {state.report.aArchiver.length === 0 ? (
                  <tr>
                    <td>Aucun</td>
                  </tr>
                ) : (
                  state.report.aArchiver.map((m) => (
                    <tr key={m.nummarche}>
                      <td>
                        {m.nummarche}
                        {m.libelle ? ` — ${m.libelle}` : ''}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {state.step === 'confirming' && (
            <div>
              <p className="gp-help" style={{ marginBottom: 6 }}>
                Import en cours…
              </p>
              <div className="gp-progress gp-progress--indeterminate">
                <div className="gp-progress__bar" />
              </div>
            </div>
          )}

          <div className="page-actions">
            <button className="gp-btn gp-btn--secondary" onClick={reset} disabled={state.step === 'confirming'}>
              Annuler
            </button>
            <button className="gp-btn gp-btn--primary" onClick={() => void confirm()} disabled={state.step === 'confirming'}>
              {state.step === 'confirming' ? 'Import en cours…' : "Confirmer l'import"}
            </button>
          </div>
        </div>
      )}

      {state.step === 'done' && (
        <div className="stack">
          <p className="gp-badge gp-badge--success">Import terminé</p>
          <p>
            {state.report.aCreer.length} marché(s) créé(s), {state.report.aArchiver.length} archivé(s),{' '}
            {state.report.fournisseursAjoutes.length} fournisseur(s) ajouté(s), {state.report.anomalies.length} anomalie(s).
          </p>
          <div className="page-actions">
            <button className="gp-btn gp-btn--secondary" onClick={downloadCompteRendu}>
              <svg className="ti">
                <use href="#i-download" />
              </svg>
              Télécharger le compte-rendu
            </button>
            <button className="gp-btn gp-btn--primary" onClick={reset}>
              Nouvel import
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
