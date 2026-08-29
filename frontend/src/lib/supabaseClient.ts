import { createClient } from '@supabase/supabase-js'

// .trim() : une valeur collée dans un dashboard (Railway, etc.) peut embarquer
// un retour à la ligne invisible en fin/début de chaîne — silencieusement fatal
// ici car la clé anon part ensuite comme header HTTP `apikey` sur chaque appel.
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL?.trim()
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY?.trim()

if (!supabaseUrl || !supabaseAnonKey) {
  console.warn(
    '[supabase] VITE_SUPABASE_URL ou VITE_SUPABASE_ANON_KEY manquant(e) — copie .env.example vers .env.local et renseigne tes clés Supabase.',
  )
}

// Valeurs de repli syntaxiquement valides pour éviter que le client ne lève
// une exception au chargement du module quand les variables d'environnement
// sont absentes (les vrais appels échoueront proprement à l'exécution).
export const supabase = createClient(
  supabaseUrl || 'http://localhost:54321',
  supabaseAnonKey || 'placeholder-anon-key',
)
