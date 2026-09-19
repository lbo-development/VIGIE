import { Link, useParams } from 'react-router-dom'
import { MANUEL_SIDEBAR_ITEMS } from '../config/navigation'
import '../styles/manuel.css'

/**
 * Contenu de chaque module (assets/manuel/<slug>.html, texte HTML rédigé à
 * la main — pas une saisie utilisateur) chargé une fois au build par Vite.
 * Ajouter un module : déposer assets/manuel/<slug>.html puis ajouter la
 * même entrée dans MANUEL_SIDEBAR_ITEMS (config/navigation.ts).
 */
const MODULES_RAW = import.meta.glob('../assets/manuel/*.html', { query: '?raw', import: 'default', eager: true }) as Record<
  string,
  string
>
const MANUEL_CONTENT: Record<string, string> = Object.fromEntries(
  Object.entries(MODULES_RAW).map(([path, html]) => [path.replace(/^.*\/([^/]+)\.html$/, '$1'), html]),
)

/**
 * Manuel d'utilisation de VIGIE (16/09/2026) — page générique : un slug
 * d'URL (/manuel/<slug>) sélectionne le fichier HTML correspondant. Sans
 * slug, affiche le sommaire des modules déjà documentés. Contenu rédigé au
 * fil du développement, un module à la fois — voir MANUEL_SIDEBAR_ITEMS
 * pour la liste des modules disponibles.
 */
export function Manuel() {
  const { module } = useParams<{ module?: string }>()
  const currentItem = MANUEL_SIDEBAR_ITEMS.find((item) => item.to === `/manuel/${module}`)
  const html = module ? MANUEL_CONTENT[module] : undefined

  return (
    <div className="stack">
      <div className="page-heading">
        <div>
          <h1>Manuel d'utilisation</h1>
          <p>{currentItem ? currentItem.label : "Documentation fonctionnelle de VIGIE, complétée au fil du développement."}</p>
        </div>
      </div>

      {!module && (
        <div className="gp-panel">
          <ul className="manuel-sommaire-list">
            {MANUEL_SIDEBAR_ITEMS.map((item) => (
              <li key={item.to}>
                <Link to={item.to}>{item.label}</Link>
              </li>
            ))}
          </ul>
        </div>
      )}

      {module && html && <div className="manuel-content" dangerouslySetInnerHTML={{ __html: html }} />}

      {module && !html && <p className="gp-help">Ce module n'est pas encore documenté.</p>}
    </div>
  )
}
