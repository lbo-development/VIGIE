import { config } from 'dotenv'
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { createClient } from '@supabase/supabase-js'

/**
 * Import en masse d'utilisateurs (fiche acteur + compte Supabase Auth +
 * rattachement profiles) à partir d'un fichier JSON local — décision du
 * 11/09/2026 (import initial de 11 agents du Service Voyageurs / Maintenance).
 *
 * Reproduit volontairement la même séquence que
 * `backend/src/services/acteur.service.ts#createActeur` (créer le compte
 * Auth, upsert `profiles` — un trigger `on_auth_user_created` crée déjà la
 * ligne, `insert` seul échouerait en 23505, voir `auth.repository.ts` —, puis
 * la fiche ACTEUR, avec la même compensation en cas d'échec d'une étape
 * suivante) plutôt que d'appeler l'API HTTP : ce script tourne hors session
 * utilisateur, sans jeton ADMIN_APP disponible. **Si la logique de création
 * dans acteur.service.ts évolue, reporter le changement ici aussi.**
 *
 * Contrairement à l'écran Utilisateurs (qui génère toujours un mot de passe
 * temporaire aléatoire, jamais un mot de passe fourni par l'appelant), ce
 * script accepte un mot de passe initial par personne, explicitement demandé
 * pour cet import — les comptes forcent quand même le changement de mot de
 * passe à la première connexion (`must_change_password`), qui reste la
 * véritable protection.
 *
 * Usage :
 *   1. Créer database/seeds/import-utilisateurs.json (gitignoré — données
 *      personnelles réelles, RGPD) avec la forme :
 *      { "direction": "...", "service": "...", "cellule": "...",
 *        "utilisateurs": [ { "matricule", "email", "nom", "prenom",
 *        "fonction", "motDePasse" }, ... ] }
 *      La Direction/Service/Cellule doivent déjà exister dans VIGIE.
 *   2. npx tsx database/seeds/importUtilisateurs.ts
 *      (ou : npx tsx database/seeds/importUtilisateurs.ts chemin/fichier.json)
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

interface UtilisateurInput {
  matricule: string
  email: string
  nom: string
  prenom: string
  fonction: string
  motDePasse: string
}

interface ImportFile {
  direction: string
  service: string
  cellule: string
  utilisateurs: UtilisateurInput[]
}

const MATRICULE_REGEX = /^[0-9]{6}$/
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

function readImportFile(filePath: string): ImportFile {
  const content = readFileSync(filePath, 'utf-8')
  return JSON.parse(content) as ImportFile
}

/** Résout l'ID_CELLULE cible par libellés — trois requêtes séquentielles, même principe que acteur.repository.ts (pas de jointure exposée par supabase-js). */
async function resolveIdCellule(direction: string, service: string, cellule: string): Promise<number> {
  const { data: dir, error: dirError } = await supabase
    .schema('finances')
    .from('direction')
    .select('id_direction')
    .eq('libelle_direction', direction)
    .maybeSingle()
  if (dirError) throw dirError
  if (!dir) throw new Error(`Direction introuvable : "${direction}"`)

  const { data: svc, error: svcError } = await supabase
    .schema('finances')
    .from('service')
    .select('id_service')
    .eq('libelle_service', service)
    .eq('id_direction', dir.id_direction)
    .maybeSingle()
  if (svcError) throw svcError
  if (!svc) throw new Error(`Service introuvable : "${service}" (direction "${direction}")`)

  const { data: cel, error: celError } = await supabase
    .schema('finances')
    .from('cellule')
    .select('id_cellule')
    .eq('libelle_cellule', cellule)
    .eq('id_service', svc.id_service)
    .maybeSingle()
  if (celError) throw celError
  if (!cel) throw new Error(`Cellule introuvable : "${cellule}" (service "${service}")`)

  return cel.id_cellule
}

async function importUtilisateur(input: UtilisateurInput, idCellule: number): Promise<'created' | 'skipped' | 'failed'> {
  if (!MATRICULE_REGEX.test(input.matricule)) {
    console.error(`❌ ${input.matricule} : matricule invalide (doit être exactement 6 chiffres) — ignoré.`)
    return 'failed'
  }
  if (!EMAIL_REGEX.test(input.email)) {
    console.error(`❌ ${input.matricule} (${input.nom}) : email invalide "${input.email}" — ignoré.`)
    return 'failed'
  }

  const { data: existing, error: existingError } = await supabase
    .schema('finances')
    .from('acteur')
    .select('matricule')
    .eq('matricule', input.matricule)
    .maybeSingle()
  if (existingError) throw existingError
  if (existing) {
    console.log(`⏭️  ${input.matricule} (${input.nom}) : acteur déjà existant — ignoré.`)
    return 'skipped'
  }

  const { data: created, error: createError } = await supabase.auth.admin.createUser({
    email: input.email,
    password: input.motDePasse,
    email_confirm: true,
    user_metadata: { must_change_password: true, full_name: `${input.prenom} ${input.nom}` },
  })
  if (createError) {
    if (createError.code === 'email_exists') {
      console.error(`❌ ${input.matricule} (${input.nom}) : un compte existe déjà pour "${input.email}" — ignoré.`)
      return 'failed'
    }
    throw createError
  }
  const userId = created.user.id

  try {
    const { error: profileError } = await supabase.from('profiles').upsert({ id: userId, matricule: input.matricule })
    if (profileError) throw profileError

    const { error: acteurError } = await supabase.schema('finances').from('acteur').insert({
      matricule: input.matricule,
      nom: input.nom,
      prenom: input.prenom,
      fonction: input.fonction,
      id_cellule: idCellule,
      actif: true,
    })
    if (acteurError) throw acteurError

    console.log(`✅ ${input.matricule} (${input.prenom} ${input.nom}) créé.`)
    return 'created'
  } catch (err) {
    // Compensation — même principe que acteur.service.ts#createActeur : ne
    // jamais laisser un compte Auth orphelin si une étape suivante échoue.
    await supabase.from('profiles').delete().eq('id', userId)
    await supabase.auth.admin.deleteUser(userId).catch(() => undefined)
    console.error(`❌ ${input.matricule} (${input.nom}) : échec après création du compte, compte annulé —`, err)
    return 'failed'
  }
}

async function main() {
  const filePath = process.argv[2] ?? path.join(__dirname, 'import-utilisateurs.json')

  let file: ImportFile
  try {
    file = readImportFile(filePath)
  } catch {
    console.error(`❌ Fichier introuvable ou invalide : ${filePath}`)
    process.exit(1)
  }

  const idCellule = await resolveIdCellule(file.direction, file.service, file.cellule)
  console.log(`Cellule cible : "${file.cellule}" (id_cellule=${idCellule}) — ${file.utilisateurs.length} utilisateur(s) à traiter.\n`)

  const results = { created: 0, skipped: 0, failed: 0 }
  for (const utilisateur of file.utilisateurs) {
    const result = await importUtilisateur(utilisateur, idCellule)
    results[result]++
  }

  console.log(`\n${results.created} créé(s), ${results.skipped} ignoré(s) (déjà existant), ${results.failed} échec(s).`)
  if (results.failed > 0) process.exitCode = 1
}

main()
