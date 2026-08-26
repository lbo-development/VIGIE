import { config } from 'dotenv'
import { createClient } from '@supabase/supabase-js'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
// Réutilise les clés Supabase définies dans backend/.env (service_role, côté serveur uniquement)
config({ path: path.join(__dirname, '..', '..', 'backend', '.env') })

const supabaseUrl = process.env.SUPABASE_URL
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!supabaseUrl || !supabaseServiceRoleKey) {
  console.error(
    '❌ SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY manquants dans backend/.env — copie backend/.env.example et renseigne tes clés.',
  )
  process.exit(1)
}

const supabase = createClient(supabaseUrl, supabaseServiceRoleKey)

async function seedItems() {
  const sampleItems = [{ name: 'Premier élément' }, { name: 'Deuxième élément' }, { name: 'Troisième élément' }]

  const { error } = await supabase.from('items').insert(sampleItems)

  if (error) {
    console.error('❌ Erreur lors du seed "items" :', error.message)
    console.error('   Vérifie que la table "items" existe (voir database/migrations/README.md).')
    process.exit(1)
  }

  console.log(`✅ ${sampleItems.length} lignes insérées dans "items".`)
}

async function seedParametresApplication() {
  // Valeur globale par défaut, alignée sur la constante actuellement en dur
  // dans frontend/src/components/shell/AppShell.tsx (INACTIVITY_TIMEOUT_MS =
  // 30 min) — remplacée à terme par un appel à GET /api/parametres/... (voir
  // docs/ARCHITECTURE.md, "Paramétrage applicatif"). id_direction/id_service
  // à null = portée globale, aucune donnée organisationnelle requise.
  const { error } = await supabase.schema('finances').rpc('upsert_parametre_application', {
    p_cle: 'auth.inactivite_delai_minutes',
    p_valeur: 30,
    p_id_direction: null,
    p_id_service: null,
    p_matricule_maj: null,
    p_description: "Délai d'inactivité avant déconnexion automatique, en minutes (ForClaude/SECURITY.md §1.1).",
  })

  if (error) {
    console.error('❌ Erreur lors du seed "parametre_application" :', error.message)
    console.error(
      '   Vérifie que les migrations supabase/migrations/2026082511*.sql ont bien été appliquées (supabase db push).',
    )
    process.exit(1)
  }

  console.log('✅ Valeur globale par défaut insérée pour "auth.inactivite_delai_minutes" (30 min).')
}

async function main() {
  await seedItems()
  await seedParametresApplication()
}

main()
