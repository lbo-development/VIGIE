import { useEffect, useRef, useState, type DragEvent } from 'react'
import { useCurrentUser } from '../hooks/useCurrentUser'
import { useDirections } from '../hooks/useDirections'
import { useServices } from '../hooks/useServices'
import { useInvestissementImport, type Anomalie, type AnomalieType } from '../hooks/useInvestissementImport'
import { useLastImportInvestissement } from '../hooks/useLastImportInvestissement'
import { Combobox } from '../components/Combobox'

const ANOMALIE_TYPE_LABELS: Record<AnomalieType, string> = {
  cug_hors_service: 'CUG hors service',
}

/** Cumul du nombre d'anomalies par type — utile quand le nombre de lignes est élevé (ex. mauvais service sélectionné à l'import), voir investissementImport.service.ts#AnomalieType. */
function countAnomaliesByType(anomalies: Anomalie[]): { type: AnomalieType; label: string; count: number }[] {
  const counts = new Map<AnomalieType, number>()
  for (const anomalie of anomalies) {
    counts.set(anomalie.type, (counts.get(anomalie.type) ?? 0) + 1)
  }
  return [...counts.entries()]
    .map(([type, count]) => ({ type, label: ANOMALIE_TYPE_LABELS[type], count }))
    .sort((a, b) => b.count - a.count)
}

/** 'YYYY-MM-DD' (format des paramètres/dates stockées) -> 'JJ/MM/AAAA' (affichage). */
function formatDateFr(iso: string): string {
  const [y, m, d] = iso.split('-')
  return `${d}/${m}/${y}`
}

function daysBetween(from: Date, to: Date): number {
  return Math.round((to.getTime() - from.getTime()) / 86_400_000)
}

const CURRENCY_FORMAT = new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 })

/** Mêmes conditions d'alerte que les imports marchés/commandes — voir ImportCommandes.tsx#IMPORT_STALE_JOURS. */
const IMPORT_STALE_JOURS = 15

/** Même texte que backend/src/services/parametres.service.ts (clé last.import.investissement.pgi). */
const PARAMETRE_NON_INITIALISE = 'Paramètre "last.import.investissement.pgi" non initialisé.'

/**
 * Importation des opérations d'investissement PGI, montée sur /investissements/import (voir
 * config/navigation.ts, INVESTISSEMENTS_SIDEBAR_ITEMS). Réservée à ADMIN_APP/ADMIN_SERVICE/CB,
 * même patron que ImportCommandes.tsx (filtre Direction → Service, aperçu bloquant avant
 * confirmation).
 *
 * Contrairement aux commandes ("annule et remplace" par service), chaque import est un upsert
 * par opération — une opération déjà en base et non réimportée n'est jamais supprimée ni
 * automatiquement désactivée : `actif` est un champ manuel (décision du 04/09/2026), modifiable
 * uniquement via l'icône « Modifier » d'InvestissementsPGI.tsx. Voir
 * ForClaude/importation-investissementsPGI/.
 */
export function ImportInvestissements() {
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

  const lastImportInfo = useLastImportInvestissement(idService)
  const isParametreNonInitialise = lastImportInfo !== null && !lastImportInfo.exists
  const isImportStale =
    lastImportInfo !== null &&
    lastImportInfo.exists &&
    (lastImportInfo.valeur === null || daysBetween(new Date(lastImportInfo.valeur), new Date()) >= IMPORT_STALE_JOURS)

  const { state, preview, confirm, reset } = useInvestissementImport(idService)
  const [dragActive, setDragActive] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  if (!hasAccess) {
    return (
      <div className="stack">
        <div className="page-heading">
          <div>
            <h1>Importation investissements PGI</h1>
            <p>Import des opérations d'investissement depuis un export Excel du PGI.</p>
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
      'Import investissements PGI',
      '',
      `Opérations intégrées (${state.report.lignes.length}) :`,
      ...state.report.lignes.map(
        (l) => `  - ${l.numeroOperation} — ${l.libelle} (initial ${l.mtInitial}, disponible AP.1 ${l.mtSoldeAp1}, AP.8 ${l.mtSoldeAp8}, CP.1 ${l.mtSoldeCp1}, CP.8 ${l.mtSoldeCp8})`,
      ),
      '',
      `Lignes AP/CP exclues (${state.report.nbExclues}) : numéro d'opération non éligible pour ce service.`,
      '',
      `Anomalies (${state.report.anomalies.length}) :`,
      ...countAnomaliesByType(state.report.anomalies).map(({ label, count }) => `  - ${label} : ${count}`),
    ]
    const blob = new Blob([lines.join('\n')], { type: 'text/plain;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = `compte-rendu-import-investissements-${new Date().toISOString().slice(0, 10)}.txt`
    link.click()
    URL.revokeObjectURL(url)
  }

  return (
    <div className="stack">
      <div className="page-heading">
        <div>
          <h1>Importation investissements PGI</h1>
          {idService === null ? (
            <p>Import des opérations d'investissement depuis un export Excel du PGI.</p>
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
                    Pensez à importer les investissements récents
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
                {state.report.anomalies.length} anomalie(s) — ces opérations seront ignorées :
                <ul>
                  {countAnomaliesByType(state.report.anomalies).map(({ type, label, count }) => (
                    <li key={type}>{`${label} : ${count}`}</li>
                  ))}
                </ul>
              </div>
            </div>
          )}

          <p>
            {state.report.lignes.length} opération(s) seront créées ou mises à jour pour ce service
            ({state.report.nbExclues} ligne(s) AP/CP exclue(s) : numéro d'opération non éligible pour ce service).
          </p>

          <div className="gp-table-wrap gp-scroll">
            <table className="gp-table">
              <thead>
                <tr>
                  <th>Opération</th>
                  <th>Libellé</th>
                  <th>Statut</th>
                  <th>Montant initial</th>
                  <th>Disponible AP.1</th>
                  <th>Disponible AP.8</th>
                  <th>Disponible CP.1</th>
                  <th>Disponible CP.8</th>
                </tr>
              </thead>
              <tbody>
                {state.report.lignes.length === 0 ? (
                  <tr>
                    <td colSpan={8}>Aucune</td>
                  </tr>
                ) : (
                  state.report.lignes.map((l) => (
                    <tr key={l.numeroOperation}>
                      <td className="mono">{l.numeroOperation}</td>
                      <td>{l.libelle}</td>
                      <td>{l.statut}</td>
                      <td>{CURRENCY_FORMAT.format(l.mtInitial)}</td>
                      <td>{CURRENCY_FORMAT.format(l.mtSoldeAp1)}</td>
                      <td>{CURRENCY_FORMAT.format(l.mtSoldeAp8)}</td>
                      <td>{CURRENCY_FORMAT.format(l.mtSoldeCp1)}</td>
                      <td>{CURRENCY_FORMAT.format(l.mtSoldeCp8)}</td>
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
            {state.report.lignes.length} opération(s) intégrée(s), {state.report.nbExclues} ligne(s) AP/CP
            exclue(s), {state.report.anomalies.length} anomalie(s).
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
