import { config } from 'dotenv'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { createClient } from '@supabase/supabase-js'

/**
 * Réinitialisation en masse du mot de passe de tous les comptes Supabase Auth
 * (auth.users) — demande explicite du 16/09/2026 : un mot de passe unique
 * pour tout le monde sauf `laurent.bohbot@marseille-port.fr`.
 *
 * ⚠️ Script volontairement NON exécuté par Claude Code (règle CLAUDE.md :
 * jamais d'écriture directe sur Supabase, ni via SDK, ni via API REST, ni via
 * commande shell). À lancer toi-même.
 *
 * ⚠️ Risque sécurité à connaître avant de lancer ce script : un mot de passe
 * unique, partagé par tous les comptes, et de faible entropie (une date)
 * est trivialement devinable/brute-forçable et, si un seul compte est
 * compromis, compromet tous les autres simultanément (le projet vise un
 * niveau de sécurité ≥ 9/10, voir ForClaude/SECURITY.md). Pour limiter la
 * fenêtre d'exposition, ce script force `must_change_password` (comme pour
 * tout compte créé via l'écran Utilisateurs ou les autres scripts de ce
 * dossier) : la personne devra choisir un mot de passe personnel dès sa
 * prochaine connexion. Pense à communiquer ce mot de passe temporaire hors
 * application (jamais par email en clair sans canal sécurisé, voir
 * ForClaude/SECURITY.md §7).
 *
 * Usage :
 *   npx tsx database/seeds/resetAllPasswords.ts
 *   (ajoute --dry-run pour lister les comptes qui seraient modifiés, sans rien changer)
 *
 * Nécessite RESET_PASSWORD_VALUE dans backend/.env (jamais commité — voir backend/.env.example).
 */

const __dirname = path.dirname(fileURLToPath(import.meta.url))
config({ path: path.join(__dirname, '..', '..', 'backend', '.env') })

const supabaseUrl = process.env.SUPABASE_URL
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY
// Jamais en dur dans le code source (historique git permanent, même en dépôt privé) — voir
// backend/.env.example. Décision du 19/09/2026.
const nouveauMotDePasse = process.env.RESET_PASSWORD_VALUE

if (!supabaseUrl || !supabaseServiceRoleKey || !nouveauMotDePasse) {
  console.error(
    '❌ SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY / RESET_PASSWORD_VALUE manquants dans backend/.env — copie backend/.env.example et renseigne tes valeurs.',
  )
  process.exit(1)
}

const supabase = createClient(supabaseUrl, supabaseServiceRoleKey)
const EMAILS_EXCLUS = new Set(['laurent.bohbot@marseille-port.fr'])
const DRY_RUN = process.argv.includes('--dry-run')

async function listAllUsers() {
  const users: { id: string; email?: string; user_metadata?: Record<string, unknown> }[] = []
  let page = 1
  const perPage = 200

  while (true) {
    const { data, error } = await supabase.auth.admin.listUsers({ page, perPage })
    if (error) throw error
    users.push(...data.users)
    if (data.users.length < perPage) break
    page += 1
  }

  return users
}

async function main() {
  const users = await listAllUsers()
  const cibles = users.filter((u) => u.email && !EMAILS_EXCLUS.has(u.email.toLowerCase()))
  const exclus = users.filter((u) => u.email && EMAILS_EXCLUS.has(u.email.toLowerCase()))

  console.log(`${users.length} compte(s) trouvé(s) — ${cibles.length} à modifier, ${exclus.length} exclu(s).\n`)
  for (const u of exclus) console.log(`  exclu : ${u.email}`)
  console.log('')

  if (DRY_RUN) {
    console.log('=== --dry-run : aucun mot de passe modifié ===')
    for (const u of cibles) console.log(`  à modifier : ${u.email}`)
    return
  }

  const ok: string[] = []
  const echecs: { email: string; reason: string }[] = []

  for (const u of cibles) {
    const { error } = await supabase.auth.admin.updateUserById(u.id, {
      password: nouveauMotDePasse,
      user_metadata: { ...(u.user_metadata ?? {}), must_change_password: true },
    })
    if (error) {
      echecs.push({ email: u.email ?? u.id, reason: error.message })
      continue
    }
    ok.push(u.email ?? u.id)
  }

  console.log(`=== ${ok.length} compte(s) modifié(s) avec succès ===`)
  for (const email of ok) console.log(`  ${email}`)

  if (echecs.length > 0) {
    console.log(`\n=== ${echecs.length} échec(s) ===`)
    for (const { email, reason } of echecs) console.log(`  ${email}\t${reason}`)
  }

  console.log(
    '\n⚠️  Chaque compte devra changer ce mot de passe à sa prochaine connexion (must_change_password). ' +
      'Communique le mot de passe temporaire hors application, sur un canal sécurisé.',
  )
}

main()
