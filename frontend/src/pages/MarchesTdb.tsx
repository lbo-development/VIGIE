import { useEffect, useState, type ReactNode } from 'react'
import { useCurrentUser } from '../hooks/useCurrentUser'
import { useDirections } from '../hooks/useDirections'
import { useServices } from '../hooks/useServices'
import { useMarches } from '../hooks/useMarches'
import { useMarcheTiers } from '../hooks/useMarcheTiers'
import { useMarcheLastImport } from '../hooks/useMarcheLastImport'
import { Combobox } from '../components/Combobox'
import '../styles/tableauDeBord.css'

function daysBetween(from: Date, to: Date): number {
  return Math.round((to.getTime() - from.getTime()) / 86_400_000)
}

/** ISO 'YYYY-MM-DD' -> 'JJ/MM/AAAA' — même principe que MarchesPGI.tsx#formatDateFr. */
function formatDateFr(iso: string): string {
  const [y, m, d] = iso.split('-')
  return `${d}/${m}/${y}`
}

/** Même formule que MarchesPGI.tsx#computeDuree/MarchesTiers.tsx#computeDuree, réduite au seul booléen `isAlerte` (le tableau de bord n'a pas besoin de la barre de progression). */
function isAlerteDuree(dtedebut: string | null, dtefinmax: string | null, alertedate: number): boolean {
  if (!dtedebut || !dtefinmax) return false
  const totalJours = daysBetween(new Date(dtedebut), new Date(dtefinmax))
  if (totalJours <= 0) return false
  const joursRestants = daysBetween(new Date(), new Date(dtefinmax))
  return joursRestants < alertedate
}

/** Même formule que MarchesPGI.tsx#computeMontant, réduite au seul booléen `isAlerte`. */
function isAlerteMontant(mtmaxi: number | null, solde: number | null, alertemt: number): boolean {
  if (mtmaxi === null || solde === null || mtmaxi <= 0) return false
  return solde <= (1 - alertemt) * mtmaxi
}

/** Seuil d'alerte "import PGI obsolète" — même valeur que MarchesPGI.tsx#IMPORT_STALE_JOURS. */
const IMPORT_STALE_JOURS = 15

/** Même texte que backend/src/services/marcheImport.service.ts#PARAMETRE_NON_INITIALISE — un seul message à faire évoluer des deux côtés. */
const PARAMETRE_NON_INITIALISE = 'Paramètre "last.import.marche.pgi" non initialisé.'

type MetricTone = 'info' | 'success' | 'warning' | 'danger'

/**
 * Une carte indicateur (`.metric-card` de gpmm.css) — le chiffre n'est teinté
 * que pour `warning`/`danger` (un compteur "normal" reste en texte neutre,
 * même logique que `.metric-meta.success/.warning` du gabarit, qui ne teinte
 * jamais le cas "neutre"). Pas d'icône (retirée le 02/09/2026 sur retour
 * utilisateur — pas adaptée à une simple étiquette chiffrée).
 */
function MetricCard({ label, value, tone = 'info' }: { label: string; value: number; tone?: MetricTone }) {
  return (
    <article className="metric-card">
      <span className="metric-label">{label}</span>
      <strong className={tone === 'warning' || tone === 'danger' ? `metric-value ${tone}` : 'metric-value'}>{value}</strong>
    </article>
  )
}

/** Sous-groupe de cartes au sein d'un `.gp-panel` — `.metrics-grid` (4 colonnes fixes, gpmm.css) pour la rangée principale, `.grid` (auto-adaptatif, gpmm.css) pour les rangées plus courtes, afin d'éviter les colonnes vides d'une grille à 4 colonnes sous-remplie. */
function MetricSubgroup({
  title,
  gridClassName = 'metrics-grid',
  children,
}: {
  title: string
  gridClassName?: 'metrics-grid' | 'grid'
  children: ReactNode
}) {
  return (
    <div className="tdb-subgroup">
      <span className="eyebrow">{title}</span>
      <div className={gridClassName} aria-label={`Indicateurs — ${title}`}>
        {children}
      </div>
    </div>
  )
}

/**
 * Tableau de bord des marchés (/marches/tdb) — indicateurs chiffrés du
 * service (décision du 02/09/2026), sur le modèle `.metrics-grid`/
 * `.metric-card` du gabarit GPMM. Lecture ouverte à tout utilisateur
 * authentifié pour son propre service (ADMIN_APP libre du service consulté)
 * — même principe que MarchesPGI.tsx/MarchesTiers.tsx, réutilise directement
 * `useMarches`/`useMarcheTiers` (le périmètre réel est déjà appliqué côté
 * backend par ces deux hooks, aucun nouvel endpoint n'est nécessaire pour ce
 * tableau de bord).
 *
 * Filtre Direction → Service et verrouillage au service propre pour un
 * acteur non ADMIN_APP : copie exacte du même mécanisme dans MarchesPGI.tsx.
 * Bandeau « État des marchés au [date] » / alerte import obsolète sous le
 * titre de la colonne de gauche : copie exacte de MarchesPGI.tsx
 * (`useMarcheLastImport`, mêmes constantes `IMPORT_STALE_JOURS`/
 * `PARAMETRE_NON_INITIALISE`, dupliquées ici comme partout ailleurs dans ce
 * module de pages).
 *
 * Présentation en deux colonnes (`.demo-grid`, gpmm.css — collapse à une
 * colonne sous 1100px) : « États des marchés du service » à gauche (trois
 * sous-groupes — Vue d'ensemble / Type de procédure / Alertes — pour éviter
 * une grille de neuf cartes peu lisible), « Marchés d'un service tiers » à
 * droite (finances.marche_tiers, pas de suivi de consommation donc pas
 * d'alerte sur montant pour cette section) — jamais mélangées, même principe
 * que MarchesPGI.tsx/MarchesTiers.tsx.
 */
export function MarchesTdb() {
  const { data: currentUser } = useCurrentUser()
  const { directions } = useDirections()
  const { services } = useServices()

  const isAdminApp = currentUser?.roles.some((r) => r.typeRole === 'ADMIN_APP') ?? false

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

  const { marches, loading: loadingMarches } = useMarches(idService)
  const { marcheTiers, loading: loadingMarcheTiers } = useMarcheTiers(idService)
  const loading = loadingMarches || loadingMarcheTiers

  const lastImportInfo = useMarcheLastImport(idService)
  const isParametreNonInitialise = lastImportInfo !== null && !lastImportInfo.exists
  const isImportStale =
    lastImportInfo !== null &&
    lastImportInfo.exists &&
    (lastImportInfo.valeur === null || daysBetween(new Date(lastImportInfo.valeur), new Date()) >= IMPORT_STALE_JOURS)

  const nbMarches = marches.length
  const nbActifs = marches.filter((m) => m.actif).length
  const nbComplets = marches.filter((m) => m.completude).length
  const nbUtilisables = marches.filter((m) => m.utilisable).length
  const nbMapa = marches.filter((m) => m.typeproc === 'MAPA').length
  const nbMarche = marches.filter((m) => m.typeproc === 'MARCHE').length
  const alerteDate = marches.filter((m) => isAlerteDuree(m.dtedebut, m.dtefinmax, m.alertedate))
  const alerteMontant = marches.filter((m) => isAlerteMontant(m.mtmaxi, m.mt_solde, m.alertemt))
  const nbEnAlerte = marches.filter(
    (m) => isAlerteDuree(m.dtedebut, m.dtefinmax, m.alertedate) || isAlerteMontant(m.mtmaxi, m.mt_solde, m.alertemt),
  ).length

  const nbMarcheTiers = marcheTiers.length
  const nbMarcheTiersActifs = marcheTiers.filter((m) => m.actif).length
  const nbMarcheTiersAlerteDate = marcheTiers.filter((m) => isAlerteDuree(m.dtedebut, m.dtefinmax, m.alertedate)).length

  return (
    <div className="stack">
      <div className="page-heading">
        <div>
          <h1>Tableau de bord des marchés</h1>
          <p>Indicateurs clés des marchés et marchés tiers du service.</p>
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

      {idService === null && <p>Sélectionne une direction et un service pour afficher le tableau de bord.</p>}

      {idService !== null && loading && <p>Chargement…</p>}

      {idService !== null && !loading && (
        <div className="demo-grid">
          <div className="gp-panel">
            <div className="panel-header">
              <div>
                <span className="eyebrow">Finances</span>
                <h2>États des marchés du service</h2>
                {isParametreNonInitialise ? (
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
                          ? `État des marchés au ${formatDateFr(lastImportInfo.valeur)}`
                          : 'État des marchés — aucun import PGI effectué'}
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
            <div className="stack" style={{ gap: 20 }}>
              <MetricSubgroup title="Vue d'ensemble">
                <MetricCard label="Marchés" value={nbMarches} />
                <MetricCard label="Actifs" value={nbActifs} />
                <MetricCard label="Complets" value={nbComplets} />
                <MetricCard label="Utilisables" value={nbUtilisables} />
              </MetricSubgroup>
              <MetricSubgroup title="Type de procédure" gridClassName="grid">
                <MetricCard label="MAPA" value={nbMapa} />
                <MetricCard label="Marché" value={nbMarche} />
              </MetricSubgroup>
              <MetricSubgroup title="Alertes" gridClassName="grid">
                <MetricCard label="En alerte" value={nbEnAlerte} tone="danger" />
                <MetricCard label="Alerte sur date" value={alerteDate.length} tone="warning" />
                <MetricCard label="Alerte sur montant" value={alerteMontant.length} tone="warning" />
              </MetricSubgroup>
            </div>
          </div>

          <div className="gp-panel">
            <div className="panel-header">
              <div>
                <span className="eyebrow">Finances</span>
                <h2>Marchés d'un service tiers</h2>
              </div>
            </div>
            <div className="grid" aria-label="Indicateurs — Marchés d'un service tiers">
              <MetricCard label="Marchés tiers" value={nbMarcheTiers} />
              <MetricCard label="Actifs" value={nbMarcheTiersActifs} />
              <MetricCard label="Alerte sur date" value={nbMarcheTiersAlerteDate} tone="danger" />
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
