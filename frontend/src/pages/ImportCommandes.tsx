import { useEffect, useRef, useState, type DragEvent } from 'react'
import { useCurrentUser } from '../hooks/useCurrentUser'
import { useDirections } from '../hooks/useDirections'
import { useServices } from '../hooks/useServices'
import { useCommandePgiImport } from '../hooks/useCommandePgiImport'
import { useLastImportCommandePgi } from '../hooks/useLastImportCommandePgi'
import { Combobox } from '../components/Combobox'

/** 'YYYY-MM-DD' (format des paramètres/dates stockées) -> 'JJ/MM/AAAA' (affichage). */
function formatDateFr(iso: string): string {
  const [y, m, d] = iso.split('-')
  return `${d}/${m}/${y}`
}

function daysBetween(from: Date, to: Date): number {
  return Math.round((to.getTime() - from.getTime()) / 86_400_000)
}

/** Mêmes conditions d'alerte que l'import marchés — voir ImportMarches.tsx#IMPORT_STALE_JOURS. */
const IMPORT_STALE_JOURS = 15

/** Même texte que backend/src/services/commandePgiImport.service.ts#PARAMETRE_NON_INITIALISE. */
const PARAMETRE_NON_INITIALISE = 'Paramètre "last.import.commande.pgi" non initialisé.'

/**
 * Importation des commandes PGI, montée sur /commandes/import (voir
 * config/navigation.ts, COMMANDES_SIDEBAR_ITEMS). Réservée à ADMIN_APP/
 * ADMIN_SERVICE/CB, même patron que ImportMarches.tsx (filtre
 * Direction → Service, aperçu bloquant avant confirmation).
 *
 * Contrairement aux marchés, chaque import est un "annule et remplace"
 * complet pour le service — pas de distinction créer/archiver, une seule
 * liste "Commandes à intégrer" (voir ForClaude/importation-commandePGI/).
 */
export function ImportCommandes() {
  const { data: currentUser } = useCurrentUser()
  const { directions } = useDirections()
  const { services } = useServices()

  const isAdminApp = currentUser?.roles.some((r) => r.typeRole === 'ADMIN_APP') ?? false
  const adminServiceRole = currentUser?.roles.find((r) => r.typeRole === 'ADMIN_SERVICE' && r.idService !== null)
  const cbRole = currentUser?.roles.find((r) => r.typeRole === 'CB' && r.idService !== null)
  const hasAccess = isAdminApp || adminServiceRole !== undefined || cbRole !== undefined

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

  const lastImportInfo = useLastImportCommandePgi(idService)
  const isParametreNonInitialise = lastImportInfo !== null && !lastImportInfo.exists
  const isImportStale =
    lastImportInfo !== null &&
    lastImportInfo.exists &&
    (lastImportInfo.valeur === null || daysBetween(new Date(lastImportInfo.valeur), new Date()) >= IMPORT_STALE_JOURS)

  const { state, preview, confirm, reset } = useCommandePgiImport(idService)
  const [dragActive, setDragActive] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  if (!hasAccess) {
    return (
      <div className="stack">
        <div className="page-heading">
          <div>
            <h1>Importation commandes PGI</h1>
            <p>Import des commandes depuis un export Excel du PGI.</p>
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
      `Import commandes PGI — fichier généré le ${state.report.dateFichier}`,
      '',
      `Commandes intégrées (${state.report.lignes.length}) :`,
      ...state.report.lignes.map((l) => `  - ${l.numcmd} — ${l.libfournisseur} (engagé ${l.mtengage}, liquidé ${l.mtliquide})`),
      '',
      `Lignes exclues (${state.report.nbExclues}) : commandes/lignes annulées ou libellé de révision de prix.`,
      '',
      `Anomalies (${state.report.anomalies.length}) :`,
      ...state.report.anomalies.map((a) => `  - ${a.ligne !== null ? `Ligne ${a.ligne} : ` : ''}${a.message}`),
    ]
    const blob = new Blob([lines.join('\n')], { type: 'text/plain;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = `compte-rendu-import-commandes-${state.report.dateFichier}.txt`
    link.click()
    URL.revokeObjectURL(url)
  }

  return (
    <div className="stack">
      <div className="page-heading">
        <div>
          <h1>Importation commandes PGI</h1>
          {idService === null ? (
            <p>Import des commandes depuis un export Excel du PGI.</p>
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
                    Pensez à importer les commandes récentes
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

          <p>
            Fichier généré le {state.report.dateFichier}. Cet import remplacera l'ensemble des commandes déjà
            enregistrées pour ce service ({state.report.nbExclues} ligne(s) exclue(s) : commande/ligne annulée ou
            libellé de révision de prix).
          </p>

          <div className="gp-table-wrap gp-scroll">
            <table className="gp-table">
              <thead>
                <tr>
                  <th>Commande</th>
                  <th>Fournisseur</th>
                  <th>Engagé</th>
                  <th>Liquidé</th>
                </tr>
              </thead>
              <tbody>
                {state.report.lignes.length === 0 ? (
                  <tr>
                    <td colSpan={4}>Aucune</td>
                  </tr>
                ) : (
                  state.report.lignes.map((l) => (
                    <tr key={l.numcmd}>
                      <td>{l.numcmd}</td>
                      <td>{l.libfournisseur}</td>
                      <td>{l.mtengage}</td>
                      <td>{l.mtliquide}</td>
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
            {state.report.lignes.length} commande(s) intégrée(s), {state.report.nbExclues} ligne(s) exclue(s),{' '}
            {state.report.anomalies.length} anomalie(s).
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
