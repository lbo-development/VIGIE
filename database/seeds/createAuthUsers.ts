import { config } from 'dotenv'
import { randomBytes } from 'node:crypto'
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { createClient } from '@supabase/supabase-js'

/**
 * Création en masse de comptes Supabase Auth à partir d'une liste d'emails
 * (un par ligne) — décision du 10/09/2026, demande d'import ponctuel.
 *
 * ⚠️ Ne crée QUE le compte d'authentification, jamais la fiche ACTEUR ni le
 * lien `public.profiles.matricule` — ces comptes resteront « non rattachés »
 * (même symptôme que Matthieu Hinchliffe, cf. session du 10/09/2026) tant
 * qu'un ADMIN_APP ne complète pas le lien manuellement (SQL direct, ou en
 * attendant une future évolution de l'écran Utilisateurs pour rattacher un
 * compte Auth déjà existant à une fiche acteur). Si vous disposez du
 * matricule/nom/prénom/fonction/cellule de chaque personne, préférez la
 * création via Paramètres → Utilisateurs dans l'application : elle crée
 * fiche + compte + lien en une seule opération, sans ce problème.
 *
 * Usage :
 *   1. Créer database/seeds/auth-users-emails.txt (gitignoré), un email par
 *      ligne (lignes vides et commençant par # ignorées).
 *   2. npx tsx database/seeds/createAuthUsers.ts
 *      (ou : npx tsx database/seeds/createAuthUsers.ts chemin/vers/fichier.txt)
 *
 * Les mots de passe temporaires générés sont affichés une seule fois en fin
 * d'exécution (jamais écrits dans un fichier ni loggués ailleurs) — à
 * communiquer immédiatement à chaque personne, hors application (voir
 * ForClaude/SECURITY.md §7 sur la gestion des secrets). `must_change_password`
 * (user_metadata) force le changement de mot de passe à la première connexion,
 * comme pour un compte créé via l'écran Utilisateurs.
 */

const __dirname = path.dirname(fileURLToPath(import.meta.url))
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

function generateTemporaryPassword(): string {
  return randomBytes(20).toString('base64url')
}

/** Dérive un nom d'affichage depuis une adresse type prenom.nom@domaine — approximatif, à corriger ensuite si besoin (User Metadata dans le dashboard, ou fiche acteur une fois créée). */
function guessFullNameFromEmail(email: string): string {
  const local = email.split('@')[0] ?? email
  return local
    .split(/[._-]/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1).toLowerCase())
    .join(' ')
}

function readEmails(filePath: string): string[] {
  const content = readFileSync(filePath, 'utf-8')
  return content
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line.length > 0 && !line.startsWith('#'))
}

async function main() {
  const filePath = process.argv[2] ?? path.join(__dirname, 'auth-users-emails.txt')

  let emails: string[]
  try {
    emails = readEmails(filePath)
  } catch {
    console.error(`❌ Fichier introuvable : ${filePath}`)
    console.error('   Crée ce fichier (un email par ligne) ou passe un chemin en argument.')
    process.exit(1)
  }

  if (emails.length === 0) {
    console.error('❌ Aucun email trouvé dans le fichier.')
    process.exit(1)
  }

  console.log(`${emails.length} email(s) à traiter depuis ${filePath}\n`)

  const created: { email: string; temporaryPassword: string }[] = []
  const skipped: { email: string; reason: string }[] = []

  for (const email of emails) {
    const temporaryPassword = generateTemporaryPassword()
    const { error } = await supabase.auth.admin.createUser({
      email,
      password: temporaryPassword,
      email_confirm: true,
      user_metadata: { must_change_password: true, full_name: guessFullNameFromEmail(email) },
    })

    if (error) {
      skipped.push({ email, reason: error.message })
      continue
    }

    created.push({ email, temporaryPassword })
  }

  console.log('\n=== Comptes créés — mots de passe temporaires (à communiquer immédiatement, ne seront plus jamais affichés) ===')
  for (const { email, temporaryPassword } of created) {
    console.log(`${email}\t${temporaryPassword}`)
  }

  if (skipped.length > 0) {
    console.log('\n=== Ignorés ===')
    for (const { email, reason } of skipped) {
      console.log(`${email}\t${reason}`)
    }
  }

  console.log(
    `\n⚠️  Ces ${created.length} compte(s) ne sont PAS encore rattachés à une fiche ACTEUR (public.profiles reste vide pour eux) — ` +
      "tant qu'un ADMIN_APP n'a pas complété le lien (matricule + cellule), l'application affichera « Ce compte n'est pas encore rattaché à un ACTEUR ».",
  )
}

main()
