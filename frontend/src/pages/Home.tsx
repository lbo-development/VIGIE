import { useHealthCheck } from '../hooks/useHealthCheck'
import { StatusBadge } from '../components/StatusBadge'

/**
 * Page d'exemple, montée sur la route "/" (voir App.tsx).
 * Convention : un fichier par route dans pages/, qui compose des components/.
 */
export function Home() {
  const status = useHealthCheck()

  return (
    <div>
      <h1>VIGIE</h1>
      <p>Frontend React + TypeScript (Vite)</p>
      <p>
        Statut API backend : <StatusBadge status={status} />
      </p>
    </div>
  )
}
