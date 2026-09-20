import { config } from 'dotenv'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { createClient } from '@supabase/supabase-js'
import ExcelJS from 'exceljs'

/**
 * Mise à jour en masse des adresses (ADR1/ADR2/CP/VILLE/CEDEX) et du SIREN
 * de finances.fournisseur à partir d'un export PGI — décision du 20/09/2026.
 * Jointure : RAISONSOCIALE (fichier) ↔ raison_sociale_pgi (base), en
 * correspondance exacte après TRIM. Une même raison sociale peut exister
 * plusieurs fois en base (une ligne FOURNISSEUR par SERVICE l'utilisant,
 * voir fournisseur.repository.ts) : toutes les lignes correspondantes sont
 * mises à jour, l'adresse/le SIREN étant un attribut de l'entreprise, pas du
 * service.
 *
 * Le fichier colonne "SIRET" contient en réalité des numéros à 9 chiffres
 * (SIREN, pas SIRET à 14 chiffres) — cohérent avec le renommage déjà fait en
 * base le 29/08/2026 (migration 20260829150000_rename_fournisseur_siret_to_siren.sql).
 * Les espaces de saisie sont retirés avant écriture, comme à la création
 * manuelle (fournisseur.service.ts#sirenField).
 *
 * Exclusions volontaires (voir le rapport imprimé en fin d'exécution) :
 * - lignes du fichier sans RAISONSOCIALE (impossible de les rattacher à une
 *   fiche existante par ce seul critère) ;
 * - RAISONSOCIALE dupliquée dans le fichier avec des valeurs différentes
 *   (ambiguïté à la source, ex. "APAVE CERTIFICATION" à deux adresses/SIREN
 *   différents) — à corriger dans le fichier source puis relancer.
 *
 * Usage :
 *   npx tsx database/seeds/updateFournisseursAdresses.ts --dry-run  (aperçu, aucune écriture)
 *   npx tsx database/seeds/updateFournisseursAdresses.ts            (écrit réellement)
 *   npx tsx database/seeds/updateFournisseursAdresses.ts [--dry-run] chemin/fournisseurs.xlsx
 *   (par défaut : ForClaude/CDC/fournisseurs.xlsx)
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

interface FournisseurRow {
  raisonSociale: string | null
  siren: string | null
  adr1: string | null
  adr2: string | null
  cp: string | null
  ville: string | null
  cedex: string | null
}

function normalizeText(value: unknown): string | null {
  if (typeof value !== 'string') return null
  const cleaned = value.replace(/[\t\n\r]+/g, ' ').trim()
  return cleaned.length > 0 ? cleaned : null
}

async function readFournisseursFile(filePath: string): Promise<FournisseurRow[]> {
  const workbook = new ExcelJS.Workbook()
  await workbook.xlsx.readFile(filePath)
  const sheet = workbook.worksheets[0]
  if (!sheet) throw new Error('Aucune feuille dans le fichier.')

  const rows: FournisseurRow[] = []
  sheet.eachRow((row, rowNumber) => {
    if (rowNumber === 1) return // en-têtes
    const values = row.values as unknown[]
    rows.push({
      raisonSociale: normalizeText(values[1]),
      siren: typeof values[2] === 'string' ? values[2].replace(/\s/g, '') : null,
      adr1: normalizeText(values[3]),
      adr2: normalizeText(values[4]),
      cp: normalizeText(values[5]),
      ville: normalizeText(values[6]),
      cedex: normalizeText(values[7]),
    })
  })
  return rows
}

async function main() {
  const args = process.argv.slice(2)
  const dryRun = args.includes('--dry-run')
  const filePath = args.find((a) => a !== '--dry-run') ?? path.join(__dirname, '..', '..', 'ForClaude', 'CDC', 'fournisseurs.xlsx')
  if (dryRun) console.log('🔎 Mode --dry-run : aucune écriture en base, aperçu uniquement.\n')

  let rows: FournisseurRow[]
  try {
    rows = await readFournisseursFile(filePath)
  } catch (err) {
    console.error(`❌ Fichier introuvable ou invalide : ${filePath}`, err)
    process.exit(1)
    return
  }

  const sansRaisonSociale = rows.filter((r) => !r.raisonSociale)
  const parRaisonSociale = new Map<string, FournisseurRow[]>()
  for (const r of rows) {
    if (!r.raisonSociale) continue
    const list = parRaisonSociale.get(r.raisonSociale) ?? []
    list.push(r)
    parRaisonSociale.set(r.raisonSociale, list)
  }

  const ambigues: [string, FournisseurRow[]][] = []
  const aTraiter: FournisseurRow[] = []
  for (const [raisonSociale, list] of parRaisonSociale) {
    if (list.length === 1) {
      aTraiter.push(list[0])
      continue
    }
    const distinctes = new Set(list.map((r) => JSON.stringify({ ...r, raisonSociale: undefined })))
    if (distinctes.size === 1) {
      aTraiter.push(list[0]) // doublon strict, sans conflit de valeur
    } else {
      ambigues.push([raisonSociale, list])
    }
  }

  console.log(`${rows.length} ligne(s) lues, ${aTraiter.length} à traiter, ${sansRaisonSociale.length} sans RAISONSOCIALE, ${ambigues.length} ambiguë(s).\n`)

  const results = { updated: 0, notFound: 0, invalidSiren: 0 }
  for (const row of aTraiter) {
    if (!row.siren || !/^\d{9}$/.test(row.siren)) {
      console.error(`❌ ${row.raisonSociale} : SIREN absent ou invalide ("${row.siren}") — ignoré.`)
      results.invalidSiren++
      continue
    }

    const { data, error } = dryRun
      ? await supabase
          .schema('finances')
          .from('fournisseur')
          .select('id_fournisseur, id_service, adr1, adr2, cp, ville, cedex, siren')
          .eq('raison_sociale_pgi', row.raisonSociale)
      : await supabase
          .schema('finances')
          .from('fournisseur')
          .update({ siren: row.siren, adr1: row.adr1, adr2: row.adr2, cp: row.cp, ville: row.ville, cedex: row.cedex })
          .eq('raison_sociale_pgi', row.raisonSociale)
          .select('id_fournisseur, id_service')
    if (error) {
      console.error(`❌ ${row.raisonSociale} : échec ${dryRun ? 'de la lecture' : 'de la mise à jour'} —`, error)
      continue
    }
    if (!data || data.length === 0) {
      console.log(`⏭️  ${row.raisonSociale} : aucune fiche fournisseur trouvée (raison_sociale_pgi) — ignoré.`)
      results.notFound++
      continue
    }
    if (dryRun) {
      console.log(`🔎 ${row.raisonSociale} : ${data.length} fiche(s) seraient mises à jour (id_fournisseur ${data.map((d) => d.id_fournisseur).join(', ')}) → SIREN ${row.siren}, ${row.adr1}, ${row.adr2 ?? '—'}, ${row.cp} ${row.ville}${row.cedex ? ' ' + row.cedex : ''}`)
    } else {
      console.log(`✅ ${row.raisonSociale} : ${data.length} fiche(s) mise(s) à jour (id_fournisseur ${data.map((d) => d.id_fournisseur).join(', ')}).`)
    }
    results.updated++
  }

  console.log(`\n${results.updated} raison(s) sociale(s) mise(s) à jour, ${results.notFound} introuvable(s) en base, ${results.invalidSiren} SIREN invalide(s).`)

  if (sansRaisonSociale.length > 0) {
    console.log('\n--- Lignes ignorées (RAISONSOCIALE absente dans le fichier) ---')
    for (const r of sansRaisonSociale) console.log(`  SIREN ${r.siren} — ${r.adr1}, ${r.cp} ${r.ville}`)
  }
  if (ambigues.length > 0) {
    console.log('\n--- Raisons sociales ambiguës dans le fichier (valeurs différentes pour le même nom, ignorées) ---')
    for (const [raisonSociale, list] of ambigues) {
      console.log(`  ${raisonSociale} :`)
      for (const r of list) console.log(`    SIREN ${r.siren} — ${r.adr1}, ${r.cp} ${r.ville}`)
    }
  }
}

main()
