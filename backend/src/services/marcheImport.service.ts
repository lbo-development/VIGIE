import ExcelJS from 'exceljs'
import * as marcheRepository from '../repositories/marche.repository.js'
import * as cugRepository from '../repositories/cug.repository.js'
import * as fournisseurRepository from '../repositories/fournisseur.repository.js'
import * as parametresRepository from '../repositories/parametres.repository.js'
import { assertManagesServiceOrHasRoleCb } from './authorization.service.js'
import { AppError } from '../middlewares/errorHandler.js'
import type { Marche } from '../repositories/marche.repository.js'

/**
 * Import PGI des marchés — voir ForClaude/Importation-marches/import-marches-pgi.md
 * pour la spécification complète (structure du fichier vérifiée par
 * inspection XML directe, pas supposée). Décision du 30/08/2026 : une vraie
 * pause de confirmation (preview() ne touche jamais la base ; confirm()
 * revalide tout depuis zéro puis écrit réellement) — pas d'état serveur
 * entre les deux, le même fichier est renvoyé par le frontend à la
 * confirmation.
 */

const REFERENCE_HEADERS = [
  'Numéro de marché',
  'Libellé de marché',
  'Nom du Fournisseur',
  'Numéro du fournisseur',
  'CUG responsable',
  'Description du CUG Responsable',
  'Date de début',
  'Date de fin',
  'Date de notification',
  'Date de validation',
  'Montant validé du marché',
  'Cumul des engagements',
  'Réalisé',
] as const
const HEADER_ROW = 12
const HEADER_COLUMNS = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J', 'K', 'L', 'M'] as const
const DATE_PREFIX = 'Edité le :'
// Champs par défaut à la création uniquement — voir import-marches-pgi.md §3.
const MTMINI_DEFAUT = 0
// ALERTEMT (numeric) = seuil sur le montant, en ratio (ex. 0,8) ; ALERTEDATE (integer) = seuil
// sur la date, en nombre de jours — vérifié sur le schéma réel (colonnes DB, PostgREST) le
// 30/08/2026, à l'origine d'un échec d'insertion (0.8 dans une colonne integer).
const ALERTEMT_DEFAUT = 0.8
const ALERTEDATE_DEFAUT = 120

export interface Anomalie {
  /** Numéro de ligne Excel concerné, ou `null` pour une anomalie non rattachée à une ligne précise. */
  ligne: number | null
  message: string
}

export interface ImportReport {
  dateFichier: string
  aCreer: { nummarche: string; libelle: string }[]
  aArchiver: { nummarche: string; libelle: string | null }[]
  anomalies: Anomalie[]
}

export interface ConfirmReport extends ImportReport {
  fournisseursAjoutes: { numpgi: string; raisonSociale: string }[]
}

interface RawRow {
  ligne: number
  nummarche: string
  libpgi: string
  titulaire: string
  numTitulaire: string
  codeCug: string
  dtedebut: string | null
  dtefinmax: string | null
  dtenotif: string | null
  dtevalid: string | null
  mtmaxi: number | null
  lastmtengage: number | null
  lastmtrealise: number | null
}

/**
 * Les exports PGI insèrent une espace insécable (U+00A0) avant certains ":"
 * (typographie française) — on la normalise en espace classique pour que les
 * comparaisons structurelles (préfixe D1, en-têtes) restent fiables.
 */
function normalizeSpaces(text: string): string {
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

function cellNumber(worksheet: ExcelJS.Worksheet, address: string): number | null {
  const value = worksheet.getCell(address).value
  if (value === null || value === undefined || value === '') return null
  if (typeof value === 'number') return value
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : null
}

/** Étape 1, points 1/2/4 — structure fixe du fichier. Lève AppError (bloquant) au premier échec. */
function validateFixedCells(worksheet: ExcelJS.Worksheet): void {
  const a1 = cellText(worksheet, 'A1')
  if (a1 !== 'Grand Port Maritime de Marseille') {
    throw new AppError(`La cellule A1 doit contenir "Grand Port Maritime de Marseille" (trouvé "${a1}").`, 400)
  }
  const a3 = cellText(worksheet, 'A3')
  if (a3 !== "Récapitulatif d'un marché") {
    throw new AppError(`La cellule A3 doit contenir "Récapitulatif d'un marché" (trouvé "${a3}").`, 400)
  }
  for (let i = 0; i < HEADER_COLUMNS.length; i++) {
    const actual = cellText(worksheet, `${HEADER_COLUMNS[i]}${HEADER_ROW}`)
    if (actual !== REFERENCE_HEADERS[i]) {
      throw new AppError(
        `La ligne d'en-têtes (ligne 12) ne correspond pas au modèle attendu (colonne ${HEADER_COLUMNS[i]} : attendu "${REFERENCE_HEADERS[i]}", trouvé "${actual}").`,
        400,
      )
    }
  }
}

/** Étape 1, point 3 — lève AppError (bloquant) si absent/invalide. Retourne la date au format YYYY-MM-DD. */
function parseDateFichier(worksheet: ExcelJS.Worksheet): string {
  const raw = cellText(worksheet, 'D1')
  if (!raw.startsWith(DATE_PREFIX)) {
    throw new AppError(`La cellule D1 doit commencer par "${DATE_PREFIX}" (trouvé "${raw}").`, 400)
  }
  const rest = raw.slice(DATE_PREFIX.length).trim()
  const match = /^(\d{2})-(\d{2})-(\d{4})$/.exec(rest)
  if (!match) {
    throw new AppError(`La date en D1 doit être au format JJ-MM-AAAA (trouvé "${rest}").`, 400)
  }
  const day = Number(match[1])
  const month = Number(match[2])
  const year = Number(match[3])
  const date = new Date(Date.UTC(year, month - 1, day))
  if (date.getUTCFullYear() !== year || date.getUTCMonth() !== month - 1 || date.getUTCDate() !== day) {
    throw new AppError(`La date en D1 n'est pas une date calendaire valide ("${rest}").`, 400)
  }
  return date.toISOString().slice(0, 10)
}

function readDataRows(worksheet: ExcelJS.Worksheet): RawRow[] {
  const rows: RawRow[] = []
  let ligne = 13
  for (;;) {
    const nummarche = cellText(worksheet, `A${ligne}`)
    if (!nummarche) break
    rows.push({
      ligne,
      nummarche,
      libpgi: cellText(worksheet, `B${ligne}`),
      titulaire: cellText(worksheet, `C${ligne}`),
      numTitulaire: cellText(worksheet, `D${ligne}`),
      codeCug: cellText(worksheet, `E${ligne}`),
      dtedebut: cellDate(worksheet, `G${ligne}`),
      dtefinmax: cellDate(worksheet, `H${ligne}`),
      dtenotif: cellDate(worksheet, `I${ligne}`),
      dtevalid: cellDate(worksheet, `J${ligne}`),
      mtmaxi: cellNumber(worksheet, `K${ligne}`),
      lastmtengage: cellNumber(worksheet, `L${ligne}`),
      lastmtrealise: cellNumber(worksheet, `M${ligne}`),
    })
    ligne += 1
  }
  return rows
}

/** Préfixe P → MAPA, M/S → MARCHE — voir import-marches-pgi.md §3. `null` = préfixe non reconnu (anomalie). */
function deriveTypeProc(nummarche: string): string | null {
  if (nummarche.startsWith('P')) return 'MAPA'
  if (nummarche.startsWith('M') || nummarche.startsWith('S')) return 'MARCHE'
  return null
}

/** Doublons de NUMMARCHE : dernier gagne, anomalie listée pour chaque doublon rencontré. */
function dedupeRows(rows: RawRow[], anomalies: Anomalie[]): RawRow[] {
  const byNummarche = new Map<string, RawRow>()
  for (const row of rows) {
    if (byNummarche.has(row.nummarche)) {
      anomalies.push({
        ligne: row.ligne,
        message: `Numéro de marché "${row.nummarche}" en double dans le fichier — dernière occurrence retenue.`,
      })
    }
    byNummarche.set(row.nummarche, row)
  }
  return [...byNummarche.values()]
}

export interface LastImportInfo {
  /** `false` si la ligne n'existe pas encore pour ce service — import bloqué, cf. §7. */
  exists: boolean
  valeur: string | null
}

/**
 * Lit le paramètre last.import.marche.pgi pour un service donné, portée
 * SERVICE strictement (pas d'héritage direction/global, contrairement à
 * finances.parametre_effectif) : on cherche explicitement une ligne
 * id_service = idService, distinguant son absence (`exists: false`) d'une
 * valeur vide (`exists: true, valeur: null`, JSON `null` — voir §7).
 */
async function findLastImportRow(idService: number): Promise<LastImportInfo> {
  const rows = await parametresRepository.findAllRows('last.import.marche.pgi')
  const row = rows.find((r) => r.id_service === idService)
  if (!row) return { exists: false, valeur: null }
  return { exists: true, valeur: typeof row.valeur === 'string' ? row.valeur : null }
}

/** Étape 2, point 1 (voir findLastImportRow ci-dessus pour le détail de la lecture). */
async function checkLastImportParametre(idService: number, dateFichier: string): Promise<string | null> {
  const { exists, valeur } = await findLastImportRow(idService)
  if (!exists) {
    return 'Le paramètre "last.import.marche.pgi" n\'existe pas pour ce service — un ADMIN_APP doit le créer (écran Réglages) avant le premier import.'
  }
  if (valeur !== null && dateFichier < valeur) {
    return `Le fichier (généré le ${dateFichier}) est antérieur à la dernière importation enregistrée pour ce service (${valeur}).`
  }
  return null
}

/** Affiché à l'écran à côté du sélecteur de service (voir ImportMarches.tsx) — même autorisation que preview/confirm. */
export async function getLastImportInfo(matricule: string | null, idService: number): Promise<LastImportInfo> {
  await assertManagesServiceOrHasRoleCb(matricule, idService)
  return findLastImportRow(idService)
}

interface ValidatedRow extends RawRow {
  typeProc: string
}

/**
 * Étape 2, point 2 (CUG par ligne) + rejet des préfixes NUMMARCHE non reconnus + date de fin
 * postérieure ou égale à la date du fichier — lignes exclues de l'intégration.
 * Le contrôle sur DTEFINMAX exclut silencieusement la ligne (pas d'entrée dans `anomalies` —
 * décision utilisateur du 30/08/2026 : ne pas l'afficher dans le compte-rendu), contrairement
 * aux deux autres contrôles ci-dessous qui restent signalés.
 */
async function validateRows(
  idService: number,
  rows: RawRow[],
  dateFichier: string,
  anomalies: Anomalie[],
): Promise<ValidatedRow[]> {
  const cugs = await cugRepository.findAll(idService)
  const validCugCodes = new Set(cugs.map((c) => c.code_cug))

  const validated: ValidatedRow[] = []
  for (const row of rows) {
    if (!row.nummarche) {
      anomalies.push({ ligne: row.ligne, message: 'Ligne sans numéro de marché — ignorée.' })
      continue
    }
    const typeProc = deriveTypeProc(row.nummarche)
    if (!typeProc) {
      anomalies.push({
        ligne: row.ligne,
        message: `Numéro de marché "${row.nummarche}" : préfixe non reconnu (attendu "P" ou "M").`,
      })
      continue
    }
    if (!validCugCodes.has(row.codeCug)) {
      anomalies.push({
        ligne: row.ligne,
        message: `Le CUG "${row.codeCug}" (marché "${row.nummarche}") n'est pas affecté au service cible de l'import.`,
      })
      continue
    }
    if (!row.dtefinmax || row.dtefinmax < dateFichier) {
      continue
    }
    validated.push({ ...row, typeProc })
  }
  return validated
}

async function computeDiff(idService: number, rows: ValidatedRow[]) {
  const cugs = await cugRepository.findAll(idService)
  const cugCodes = cugs.map((c) => c.code_cug)
  const existing = await marcheRepository.findByCugCodes(cugCodes)
  const existingByNummarche = new Map(existing.map((m) => [m.nummarche, m]))

  const fileNummarches = new Set(rows.map((r) => r.nummarche))
  const aCreer = rows
    .filter((r) => !existingByNummarche.has(r.nummarche))
    .map((r) => ({ nummarche: r.nummarche, libelle: r.libpgi }))
  const aArchiver = existing
    .filter((m) => m.actif && m.type_creation === 'PGI' && !fileNummarches.has(m.nummarche))
    .map((m) => ({ nummarche: m.nummarche, libelle: m.libpgi }))

  return { aCreer, aArchiver, existingByNummarche }
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
  const rawRows = dedupeRows(readDataRows(worksheet), anomalies)
  const validRows = await validateRows(idService, rawRows, dateFichier, anomalies)

  const { aCreer, aArchiver, existingByNummarche } = await computeDiff(idService, validRows)

  return { dateFichier, validRows, aCreer, aArchiver, existingByNummarche, anomalies }
}

export async function preview(matricule: string | null, idService: number, buffer: Buffer): Promise<ImportReport> {
  const { dateFichier, aCreer, aArchiver, anomalies } = await parseAndValidate(matricule, idService, buffer)
  return { dateFichier, aCreer, aArchiver, anomalies }
}

export async function confirm(matricule: string | null, idService: number, buffer: Buffer): Promise<ConfirmReport> {
  const { dateFichier, validRows, aCreer, aArchiver, existingByNummarche, anomalies } = await parseAndValidate(
    matricule,
    idService,
    buffer,
  )

  const fournisseurCache = new Map<string, number>()
  const fournisseursAjoutes: { numpgi: string; raisonSociale: string }[] = []

  async function resolveIdFournisseur(numTitulaire: string, titulaire: string): Promise<number | null> {
    if (!numTitulaire) return null
    const cached = fournisseurCache.get(numTitulaire)
    if (cached !== undefined) return cached

    const existing = await fournisseurRepository.findByNumpgi(idService, numTitulaire)
    if (existing) {
      fournisseurCache.set(numTitulaire, existing.id_fournisseur)
      return existing.id_fournisseur
    }

    const created = await fournisseurRepository.create({
      id_service: idService,
      etatfournisseur: 'Actif',
      raison_sociale_pgi: titulaire || null,
      raison_sociale_service: titulaire || numTitulaire,
      siren: null,
      numpgi: numTitulaire,
      adr1: null,
      adr2: null,
      cp: null,
      ville: null,
      cedex: null,
      type_creation: 'PGI',
    })
    fournisseurCache.set(numTitulaire, created.id_fournisseur)
    fournisseursAjoutes.push({ numpgi: numTitulaire, raisonSociale: created.raison_sociale_service })
    return created.id_fournisseur
  }

  for (const row of validRows) {
    const idFournisseur = await resolveIdFournisseur(row.numTitulaire, row.titulaire)
    const existing = existingByNummarche.get(row.nummarche)

    if (existing) {
      await marcheRepository.update(row.nummarche, {
        libpgi: row.libpgi,
        titulaire: row.titulaire,
        num_titulaire: row.numTitulaire,
        code_cug: row.codeCug,
        dtedebut: row.dtedebut,
        dtefinmax: row.dtefinmax,
        dtenotif: row.dtenotif,
        dtevalid: row.dtevalid,
        mtmaxi: row.mtmaxi,
        lastmtengage: row.lastmtengage,
        lastmtrealise: row.lastmtrealise,
        dtelastimport: dateFichier,
        id_fournisseur: idFournisseur,
        actif: true,
      })
    } else {
      const nouveauMarche: Omit<Marche, 'completude' | 'mt_solde' | 'utilisable'> = {
        nummarche: row.nummarche,
        actif: true,
        type_creation: 'PGI',
        typeproc: row.typeProc,
        typedecompoprix: null,
        naturepresta: null,
        libpgi: row.libpgi,
        libelle_service: row.libpgi,
        titulaire: row.titulaire,
        num_titulaire: row.numTitulaire,
        titulaire_service: row.titulaire,
        agentgestion: null,
        code_cug: row.codeCug,
        dtenotif: row.dtenotif,
        dtevalid: row.dtevalid,
        dtedebut: row.dtedebut,
        dtefinmax: row.dtefinmax,
        mtmini: MTMINI_DEFAUT,
        mtmaxi: row.mtmaxi,
        alertemt: ALERTEMT_DEFAUT,
        alertedate: ALERTEDATE_DEFAUT,
        lastmtrealise: row.lastmtrealise,
        lastmtengage: row.lastmtengage,
        dtelastsolde: null,
        dtelastimport: dateFichier,
        planpreventionactif: null,
        id_fournisseur: idFournisseur,
      }
      await marcheRepository.create(nouveauMarche)
    }
  }

  await marcheRepository.archiveMany(aArchiver.map((m) => m.nummarche))

  await parametresRepository.upsert({
    cle: 'last.import.marche.pgi',
    valeur: dateFichier,
    idDirection: null,
    idService,
    matriculeMaj: matricule ?? '',
  })

  return { dateFichier, aCreer, aArchiver, anomalies, fournisseursAjoutes }
}
