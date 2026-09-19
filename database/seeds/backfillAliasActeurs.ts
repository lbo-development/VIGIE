import { config } from 'dotenv'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { createClient } from '@supabase/supabase-js'

/**
 * Rétro-remplissage de finances.acteur.ALIAS pour les acteurs qui n'en ont
 * pas encore (décision du 17/09/2026) — à lancer une fois la migration
 * `supabase/migrations/20260917090000_add_alias_acteur.sql` appliquée.
 *
 * Règle de calcul (confirmée par l'utilisateur le 17/09/2026) :
 *   - Prénom : initiale de chaque prénom (découpé sur espace ET tiret,
 *     ex. "Jean-Marc" ou "Jean Marc" -> "JM"), en majuscule.
 *   - Nom : 2 premières lettres du tout premier mot du nom (avant le premier
 *     espace, ex. "BRISSON DE LAROCHE" -> "BRISSON"), 1ère en majuscule,
 *     2ème en minuscule.
 *   - Alias = initiales prénom + 2 lettres du nom (ex. "JMBr").
 *   - Collision (deux acteurs donnant le même alias) : suffixe numérique
 *     incrémental (JMBr, JMBr2, JMBr3…) — jamais de saisie manuelle.
 *   - Accents retirés avant calcul (é/è/ê -> e, etc.).
 *
 * ⚠️ Script volontairement NON exécuté par Claude Code (règle CLAUDE.md :
 * jamais d'écriture directe sur Supabase). À lancer toi-même.
 *
 * Usage :
 *   npx tsx database/seeds/backfillAliasActeurs.ts --dry-run   # aperçu, aucune écriture
 *   npx tsx database/seeds/backfillAliasActeurs.ts              # applique
 *
 * Idempotent : ne touche que les acteurs dont ALIAS est encore vide, donc
 * relançable sans risque (ex. après création de nouveaux acteurs avant que
 * le calcul automatique ne soit branché dans acteur.service.ts).
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

const DRY_RUN = process.argv.includes('--dry-run')

interface ActeurRow {
  matricule: string
  nom: string
  prenom: string
  alias: string | null
}

function stripAccents(s: string): string {
  return s.normalize('NFD').replace(/[̀-ͯ]/g, '')
}

/** Alias de base, avant résolution de collision — voir la règle en tête de fichier. */
function computeAliasBase(nom: string, prenom: string): string | null {
  const premierNom = stripAccents(nom).trim().split(/\s+/)[0] ?? ''
  const initiales = stripAccents(prenom)
    .trim()
    .split(/[\s-]+/)
    .filter(Boolean)
    .map((p) => p[0]?.toUpperCase() ?? '')
    .join('')

  if (!premierNom || !initiales) return null

  const nomPart = premierNom.length >= 2 ? premierNom[0].toUpperCase() + premierNom[1].toLowerCase() : premierNom.toUpperCase()

  return initiales + nomPart
}

/** Ajoute un suffixe numérique tant que l'alias est déjà pris (par un acteur existant ou déjà attribué dans ce run). */
function resolveCollision(base: string, taken: Set<string>): string {
  if (!taken.has(base)) return base
  let n = 2
  while (taken.has(`${base}${n}`)) n += 1
  return `${base}${n}`
}

async function main() {
  const { data, error } = await supabase.schema('finances').from('acteur').select('matricule, nom, prenom, alias').order('matricule', { ascending: true })
  if (error) throw error

  const acteurs = (data ?? []) as ActeurRow[]
  const taken = new Set(acteurs.filter((a) => a.alias).map((a) => a.alias as string))
  const aTraiter = acteurs.filter((a) => !a.alias)

  console.log(`${acteurs.length} acteur(s) en base — ${aTraiter.length} sans alias à traiter.\n`)

  const updates: { matricule: string; nom: string; prenom: string; alias: string }[] = []
  const ignores: { matricule: string; nom: string; prenom: string }[] = []

  for (const a of aTraiter) {
    const base = computeAliasBase(a.nom, a.prenom)
    if (!base) {
      ignores.push(a)
      continue
    }
    const alias = resolveCollision(base, taken)
    taken.add(alias)
    updates.push({ matricule: a.matricule, nom: a.nom, prenom: a.prenom, alias })
  }

  console.log('=== Alias calculés ===')
  for (const u of updates) console.log(`  ${u.matricule}\t${u.prenom} ${u.nom}\t-> ${u.alias}`)

  if (ignores.length > 0) {
    console.log('\n=== Ignorés (NOM ou PRENOM vide — à corriger manuellement) ===')
    for (const a of ignores) console.log(`  ${a.matricule}\t"${a.prenom}" "${a.nom}"`)
  }

  if (DRY_RUN) {
    console.log('\n=== --dry-run : aucune écriture effectuée ===')
    return
  }

  let ok = 0
  const echecs: { matricule: string; reason: string }[] = []
  for (const u of updates) {
    const { error: updateError } = await supabase.schema('finances').from('acteur').update({ alias: u.alias }).eq('matricule', u.matricule)
    if (updateError) {
      echecs.push({ matricule: u.matricule, reason: updateError.message })
      continue
    }
    ok += 1
  }

  console.log(`\n=== ${ok} acteur(s) mis à jour avec succès ===`)
  if (echecs.length > 0) {
    console.log(`\n=== ${echecs.length} échec(s) ===`)
    for (const { matricule, reason } of echecs) console.log(`  ${matricule}\t${reason}`)
  }
}

main()
