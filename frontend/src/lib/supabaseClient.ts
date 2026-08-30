import { createClient } from '@supabase/supabase-js'

// .trim() : une valeur collée dans un dashboard (Railway, etc.) peut embarquer
// un retour à la ligne invisible en fin/début de chaîne — silencieusement fatal
// ici car la clé anon part ensuite comme header HTTP `apikey` sur chaque appel.
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL?.trim()
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY?.trim()

if (!supabaseUrl || !supabaseAnonKey) {
  const message =
    '[supabase] VITE_SUPABASE_URL ou VITE_SUPABASE_ANON_KEY manquant(e) — copie .env.example vers .env.local et renseigne tes clés Supabase.'
  // En production, une clé manquante ne doit jamais dégénérer en une cascade
  // d'échecs réseau opaques (audit de sécurité du 30/08/2026, voir
  // ForClaude/SECURITY.md) — on préfère un écran blanc + erreur console
  // immédiate et explicite au chargement. En dev/test (import.meta.env.PROD
  // vaut alors false), on garde le repli tolérant ci-dessous.
  if (import.meta.env.PROD) {
    throw new Error(message)
  }
  console.warn(message)
}

// Valeurs de repli syntaxiquement valides pour éviter que le client ne lève
// une exception au chargement du module quand les variables d'environnement
// sont absentes (les vrais appels échoueront proprement à l'exécution).
export const supabase = createClient(
  supabaseUrl || 'http://localhost:54321',
  supabaseAnonKey || 'placeholder-anon-key',
)
