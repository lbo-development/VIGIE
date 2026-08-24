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

async function main() {
  const sampleItems = [{ name: 'Premier élément' }, { name: 'Deuxième élément' }, { name: 'Troisième élément' }]

  const { error } = await supabase.from('items').insert(sampleItems)

  if (error) {
    console.error('❌ Erreur lors du seed :', error.message)
    console.error('   Vérifie que la table "items" existe (voir database/migrations/README.md).')
    process.exit(1)
  }

  console.log(`✅ ${sampleItems.length} lignes insérées dans "items".`)
}

main()
