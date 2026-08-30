/**
 * États des marchés, montée sur /marches — page par défaut de la section
 * "Marchés" (voir config/navigation.ts, MARCHES_SIDEBAR_ITEMS). Coquille pour
 * l'instant : le backend (repository/service/routes CRUD MARCHE) n'est pas
 * encore construit, voir `ForClaude/Importation-marches/import-marches-pgi.md`
 * pour la spécification complète (ACTIF/COMPLETUDE/UTILISABLE notamment).
 */
export function Marches() {
  return (
    <div className="stack">
      <div className="page-heading">
        <div>
          <h1>États des marchés</h1>
          <p>Référentiel des marchés publics, alimenté par l'import PGI.</p>
        </div>
      </div>

      <div className="gp-panel">
        <p>Cet écran est en construction — la gestion des marchés n'est pas encore disponible.</p>
      </div>
    </div>
  )
}
