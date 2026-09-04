import ExcelJS from 'exceljs'
import * as commandePgiRepository from '../repositories/commandePgi.repository.js'
import * as cugRepository from '../repositories/cug.repository.js'
import * as parametresRepository from '../repositories/parametres.repository.js'
import { assertManagesServiceOrHasRoleCb } from './authorization.service.js'
import { AppError } from '../middlewares/errorHandler.js'
import type { CommandePgi } from '../repositories/commandePgi.repository.js'

/**
 * Import PGI des commandes — voir ForClaude/importation-commandePGI/ (fichier modèle +
 * consignes). Même squelette que marcheImport.service.ts (structure fichier vérifiée,
 * preview()/confirm() sans état serveur entre les deux), mais NUMCMD n'est PAS une clé
 * unique dans le fichier PGI (contrairement à NUMMARCHE) : des lignes dupliquées avec des
 * quantités différentes existent pour un même (Commande, Ligne de commande), sans qu'aucune
 * autre colonne ne les distingue. Décision utilisateur : les lignes valides sont regroupées
 * par NUMCMD, MTACTUEL/MTENGAGE/MTLIQUIDE sommés, les autres champs pris sur la ligne au
 * MTACTUEL le plus élevé (généralisé à tous les champs non cumulés — en pratique seul le
 * Compte Budgétaire varie entre les lignes d'une même commande, vérifié sur le fichier réel).
 *
 * Chaque confirm() est un "annule et remplace" complet pour le service cible : pas de
 * diff créer/modifier/archiver comme pour les marchés.
 */

const REFERENCE_HEADERS = [
  'Exercice Budgétaire',
  'Direction',
  'Département',
  'Activité',
  'CUG Emetteur',
  'Acheteur',
  'Commande',
  'Ligne de commande',
  'Report',
  'Commande Annulée  ?',
  'Ligne Annulée ?',
  'Libellé',
  'Qualification',
  'Date de commande',
  "Statut d'approbation",
  'Date GL',
  "Demande d'achat",
  'Date DA',
  'CUG Destinataire',
  'Compte Budgétaire',
  'Compte',
  'CPV',
  'Catégorie Opération',
  'Sous-opération',
  'Fournisseur',
  'Marché',
  'Quantité commandée',
  'Prix Unitaire',
  'Montant HT Initial',
  'Montant HT actuel',
  'Quantité recue',
  'Quantité facturée',
  'Engagé commande',
  'Total Liquidé HT',
  'Dont CHAP',
  'Dont CHAP Liquidée',
  'Surfacturation De CHAP',
  'CHAP annulées',
] as const
const HEADER_ROW = 13
const FIRST_DATA_ROW = 14
const HEADER_COLUMNS = [
  'A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J', 'K', 'L', 'M', 'N', 'O', 'P', 'Q', 'R', 'S', 'T',
  'U', 'V', 'W', 'X', 'Y', 'Z', 'AA', 'AB', 'AC', 'AD', 'AE', 'AF', 'AG', 'AH', 'AI', 'AJ', 'AK', 'AL',
] as const
const TITRE_ATTENDU = 'Liste des lignes de commandes par ligne budgétaire'
const DATE_PREFIX = 'Edité le'

/** Valeur retenue quand la colonne Marché est vide dans le fichier — décision utilisateur (Hors Marché). */
const MARCHE_HORS_MARCHE = 'HM'

export interface Anomalie {
  ligne: number | null
  message: string
}

export interface LigneCommandePgi {
  numcmd: string
  libfournisseur: string
  mtactuel: number
  mtengage: number
  mtliquide: number
}

export interface ImportReport {
  dateFichier: string
  lignes: LigneCommandePgi[]
  nbExclues: number
  anomalies: Anomalie[]
}

interface RawRow {
  ligne: number
  numcmd: string
  codeCug: string
  commandeAnnulee: string
  ligneAnnulee: string
  libelle: string
  acheteur: string
  dtecmd: string | null
  compteBudgetaire: number | null
  catop: string | null
  libfournisseur: string
  /** Jamais null : "HM" (Hors Marché) quand la colonne est vide — voir MARCHE_HORS_MARCHE. */
  marche: string
  mtactuel: number
  mtengage: number
  mtliquide: number
}

/**
 * Les exports PGI insèrent une espace insécable (U+00A0) avant certains ":" (typographie
 * française) — normalisée en espace classique, même principe que marcheImport.service.ts.
 */
function normalizeSpaces(text: string): string {
  // eslint-disable-next-line no-irregular-whitespace -- U+00A0 volontaire, voir commentaire ci-dessus
  return text.replace(/ /g, ' ')
}

function cellText(worksheet: ExcelJS.Worksheet, address: string): string {
  const value = worksheet.getCell(address).value
  if (value === null || value === undefined) return ''
  if (typeof value === 'object' && 'richText' in (value as { richText?: unknown })) {
    const runs = (value as { richText: { text: string }[] }).richText
    return normalizeSpaces(runs.map((r) => r.text).join('')).trim()
  }
  return normalizeSpaces(String(value)).trim()
}

/** Le fichier PGI utilise parfois la valeur numérique 0 comme marqueur "vide" (Catégorie Opération, Marché). */
function cellTextOrNull(worksheet: ExcelJS.Worksheet, address: string): string | null {
  if (worksheet.getCell(address).value === 0) return null
  const text = cellText(worksheet, address)
  return text === '' ? null : text
}

function cellDate(worksheet: ExcelJS.Worksheet, address: string): string | null {
  const value = worksheet.getCell(address).value
  if (value === null || value === undefined || value === '') return null
  if (value instanceof Date) return value.toISOString().slice(0, 10)
  if (typeof value === 'number') {
    const ms = Math.round((value - 25569) * 86400 * 1000)
    return new Date(ms).toISOString().slice(0, 10)
  }
  return null
}

function cellNumber(worksheet: ExcelJS.Worksheet, address: string): number {
  const value = worksheet.getCell(address).value
  if (value === null || value === undefined || value === '') return 0
  if (typeof value === 'number') return value
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : 0
}

/** Le fichier PGI utilise parfois la valeur numérique 0 comme marqueur "vide" (voir cellTextOrNull ci-dessus) — même normalisation pour le Compte Budgétaire. */
function cellNumberOrNull(worksheet: ExcelJS.Worksheet, address: string): number | null {
  const value = worksheet.getCell(address).value
  if (value === null || value === undefined || value === '' || value === 0) return null
  return cellNumber(worksheet, address)
}

/** Étape 1 — structure fixe du fichier (titre A3, en-têtes A13:AL13). Lève AppError (bloquant) au premier échec. */
function validateFixedCells(worksheet: ExcelJS.Worksheet): void {
  const a3 = cellText(worksheet, 'A3')
  if (a3 !== TITRE_ATTENDU) {
    throw new AppError(`La cellule A3 doit contenir "${TITRE_ATTENDU}" (trouvé "${a3}").`, 400)
  }
  for (let i = 0; i < HEADER_COLUMNS.length; i++) {
    const actual = cellText(worksheet, `${HEADER_COLUMNS[i]}${HEADER_ROW}`)
    if (actual !== REFERENCE_HEADERS[i]) {
      throw new AppError(
        `La ligne d'en-têtes (ligne ${HEADER_ROW}) ne correspond pas au modèle attendu (colonne ${HEADER_COLUMNS[i]} : attendu "${REFERENCE_HEADERS[i]}", trouvé "${actual}").`,
        400,
      )
    }
  }
}

/** Étape 1 — Z1/AA1 ("Edité le " + date). Lève AppError (bloquant) si absent/invalide. Retourne la date au format YYYY-MM-DD. */
function parseDateFichier(worksheet: ExcelJS.Worksheet): string {
  const z1 = cellText(worksheet, 'Z1')
  if (z1 !== DATE_PREFIX) {
    throw new AppError(`La cellule Z1 doit contenir "${DATE_PREFIX}" (trouvé "${z1}").`, 400)
  }
  const aa1 = cellText(worksheet, 'AA1')
  const rest = aa1.slice(-10)
  const match = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(rest)
  if (!match) {
    throw new AppError(`La date en AA1 doit se terminer par une date au format JJ/MM/AAAA (trouvé "${aa1}").`, 400)
  }
  const day = Number(match[1])
  const month = Number(match[2])
  const year = Number(match[3])
  const date = new Date(Date.UTC(year, month - 1, day))
  if (date.getUTCFullYear() !== year || date.getUTCMonth() !== month - 1 || date.getUTCDate() !== day) {
    throw new AppError(`La date en AA1 n'est pas une date calendaire valide ("${rest}").`, 400)
  }
  return date.toISOString().slice(0, 10)
}

function readDataRows(worksheet: ExcelJS.Worksheet): RawRow[] {
  const rows: RawRow[] = []
  let ligne = FIRST_DATA_ROW
  for (;;) {
    const numcmd = cellText(worksheet, `G${ligne}`)
    if (!numcmd) break
    rows.push({
      ligne,
      numcmd,
      codeCug: cellText(worksheet, `E${ligne}`),
      acheteur: cellText(worksheet, `F${ligne}`),
      commandeAnnulee: cellText(worksheet, `J${ligne}`),
      ligneAnnulee: cellText(worksheet, `K${ligne}`),
      libelle: cellText(worksheet, `L${ligne}`),
      dtecmd: cellDate(worksheet, `N${ligne}`),
      compteBudgetaire: cellNumberOrNull(worksheet, `T${ligne}`),
      catop: cellTextOrNull(worksheet, `W${ligne}`),
      libfournisseur: cellText(worksheet, `Y${ligne}`),
      marche: cellTextOrNull(worksheet, `Z${ligne}`) ?? MARCHE_HORS_MARCHE,
      mtactuel: cellNumber(worksheet, `AD${ligne}`),
      mtengage: cellNumber(worksheet, `AG${ligne}`),
      mtliquide: cellNumber(worksheet, `AH${ligne}`),
    })
    ligne += 1
  }
  return rows
}

/** Exclusion silencieuse (Commande/Ligne Annulée ≠ N, libellé FACTURER/ESTIMATION/REVISION) — décision utilisateur, ne figure jamais dans les anomalies. */
function isLigneExclue(row: RawRow): boolean {
  if (row.commandeAnnulee !== 'N') return true
  if (row.ligneAnnulee !== 'N') return true
  const libelleMaj = row.libelle.toUpperCase()
  return libelleMaj.includes('FACTURER') || libelleMaj.includes('ESTIMATION') || libelleMaj.includes('REVISION')
}

type ValidatedRow = RawRow

/** Contrôle CUG par ligne — signalé en anomalie (contrairement aux exclusions silencieuses ci-dessus), ligne exclue du regroupement. */
async function validateRows(idService: number, rows: RawRow[], anomalies: Anomalie[]): Promise<ValidatedRow[]> {
  const cugs = await cugRepository.findAll(idService)
  const validCugCodes = new Set(cugs.map((c) => c.code_cug))

  const validated: ValidatedRow[] = []
  for (const row of rows) {
    if (!validCugCodes.has(row.codeCug)) {
      anomalies.push({
        ligne: row.ligne,
        message: `Le CUG "${row.codeCug}" (commande "${row.numcmd}") n'est pas affecté au service cible de l'import.`,
      })
      continue
    }
    validated.push(row)
  }
  return validated
}

/** Regroupe les lignes valides par NUMCMD — montants sommés, autres champs pris sur la ligne au MTACTUEL le plus élevé (voir en-tête du fichier). */
function groupByNumcmd(rows: ValidatedRow[], idService: number, dateFichier: string): CommandePgi[] {
  const byNumcmd = new Map<string, ValidatedRow[]>()
  for (const row of rows) {
    const group = byNumcmd.get(row.numcmd)
    if (group) group.push(row)
    else byNumcmd.set(row.numcmd, [row])
  }

  const result: CommandePgi[] = []
  for (const [numcmd, group] of byNumcmd) {
    const representative = group.reduce((max, row) => (row.mtactuel > max.mtactuel ? row : max))
    result.push({
      numcmd,
      code_cug: representative.codeCug,
      id_service: idService,
      acheteur: representative.acheteur,
      dtecmd: representative.dtecmd ?? dateFichier,
      compte_budgetaire: representative.compteBudgetaire,
      catop: representative.catop,
      libfournisseur: representative.libfournisseur,
      marche: representative.marche,
      mtactuel: group.reduce((sum, row) => sum + row.mtactuel, 0),
      mtengage: group.reduce((sum, row) => sum + row.mtengage, 0),
      mtliquide: group.reduce((sum, row) => sum + row.mtliquide, 0),
      dtelastimport: dateFichier,
    })
  }
  return result
}

export interface LastImportInfo {
  /** `false` si la ligne n'existe pas encore pour ce service — import bloqué. */
  exists: boolean
  valeur: string | null
}

export const PARAMETRE_NON_INITIALISE = 'Paramètre "last.import.commande.pgi" non initialisé.'

/** Lit le paramètre last.import.commande.pgi pour un service donné, portée SERVICE strictement (pas d'héritage direction/global) — même principe que marcheImport.service.ts#findLastImportRow. */
export async function findLastImportRow(idService: number): Promise<LastImportInfo> {
  const rows = await parametresRepository.findAllRows('last.import.commande.pgi')
  const row = rows.find((r) => r.id_service === idService)
  if (!row) return { exists: false, valeur: null }
  return { exists: true, valeur: typeof row.valeur === 'string' ? row.valeur : null }
}

async function checkLastImportParametre(idService: number, dateFichier: string): Promise<string | null> {
  const { exists, valeur } = await findLastImportRow(idService)
  if (!exists) return PARAMETRE_NON_INITIALISE
  if (valeur !== null && dateFichier < valeur) {
    return `Le fichier (généré le ${dateFichier}) est antérieur à la dernière importation enregistrée pour ce service (${valeur}).`
  }
  return null
}

export async function getLastImportInfo(matricule: string | null, idService: number): Promise<LastImportInfo> {
  await assertManagesServiceOrHasRoleCb(matricule, idService)
  return findLastImportRow(idService)
}

async function parseAndValidate(matricule: string | null, idService: number, buffer: Buffer) {
  await assertManagesServiceOrHasRoleCb(matricule, idService)

  const workbook = new ExcelJS.Workbook()
  await workbook.xlsx.load(buffer as unknown as ExcelJS.Buffer)
  const worksheet = workbook.worksheets[0]
  if (!worksheet) throw new AppError('Fichier illisible ou vide.', 400)

  validateFixedCells(worksheet)
  const dateFichier = parseDateFichier(worksheet)

  const parametreError = await checkLastImportParametre(idService, dateFichier)
  if (parametreError) throw new AppError(parametreError, 400)

  const anomalies: Anomalie[] = []
  const rawRows = readDataRows(worksheet)
  const nonExclues = rawRows.filter((row) => !isLigneExclue(row))
  const nbExclues = rawRows.length - nonExclues.length
  const validRows = await validateRows(idService, nonExclues, anomalies)

  const commandes = groupByNumcmd(validRows, idService, dateFichier)

  return { dateFichier, nbExclues, anomalies, commandes }
}

function toReport(result: Awaited<ReturnType<typeof parseAndValidate>>): ImportReport {
  return {
    dateFichier: result.dateFichier,
    nbExclues: result.nbExclues,
    anomalies: result.anomalies,
    lignes: result.commandes.map((c) => ({
      numcmd: c.numcmd,
      libfournisseur: c.libfournisseur,
      mtactuel: c.mtactuel,
      mtengage: c.mtengage,
      mtliquide: c.mtliquide,
    })),
  }
}

export async function preview(matricule: string | null, idService: number, buffer: Buffer): Promise<ImportReport> {
  const result = await parseAndValidate(matricule, idService, buffer)
  return toReport(result)
}

export async function confirm(matricule: string | null, idService: number, buffer: Buffer): Promise<ImportReport> {
  const result = await parseAndValidate(matricule, idService, buffer)

  await commandePgiRepository.deleteByService(idService)
  await commandePgiRepository.insertMany(result.commandes)

  await parametresRepository.upsert({
    cle: 'last.import.commande.pgi',
    valeur: result.dateFichier,
    idDirection: null,
    idService,
    matriculeMaj: matricule ?? '',
  })

  return toReport(result)
}
