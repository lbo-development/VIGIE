/**
 * Importation des marchés PGI, montée sur /marches/import (voir
 * config/navigation.ts, MARCHES_SIDEBAR_ITEMS). Coquille pour l'instant : le
 * backend (validation du fichier, intégration OP3.1) n'est pas encore
 * construit, voir `ForClaude/Importation-marches/import-marches-pgi.md` pour
 * la spécification complète.
 */
export function ImportMarches() {
  return (
    <div className="stack">
      <div className="page-heading">
        <div>
          <h1>Importation marchés PGI</h1>
          <p>Import du référentiel des marchés depuis un export Excel du PGI.</p>
        </div>
      </div>

      <div className="gp-panel">
        <p>Cet écran est en construction — l'import PGI des marchés n'est pas encore disponible.</p>
      </div>
    </div>
  )
}
