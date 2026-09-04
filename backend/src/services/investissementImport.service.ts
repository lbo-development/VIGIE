import ExcelJS from 'exceljs'
import * as investissementRepository from '../repositories/investissement.repository.js'
import * as cugRepository from '../repositories/cug.repository.js'
import * as parametresRepository from '../repositories/parametres.repository.js'
import { assertManagesServiceOrHasRoleCb } from './authorization.service.js'
import { AppError } from '../middlewares/errorHandler.js'
import type { OperationInvestissementUpsert } from '../repositories/investissement.repository.js'

/**
 * Import PGI des opérations d'investissement — voir
 * ForClaude/importation-investissementsPGI/import-investissements-pgi.md. Fichier à 3 feuilles
 * (OP/AP/CP), sans commune mesure structurelle avec l'import marchés/commandes (pas de titre ni
 * de date de génération à vérifier — §1/§9 de la spec) :
 *   - OP (77 colonnes) : une ligne par opération, clé = colonne "Code" (PAS "Numero operation",
 *     purement numérique et sans rapport avec le format des clés AP/CP — voir §2.1/§4 de la spec).
 *   - AP/CP (5 colonnes) : une ligne par mouvement budgétaire, colonne A = clé à tirets à décoder
 *     (§3 de la spec) ; seules les tranches à indice 1 et 8 sont dans le périmètre (AP.1, AP.8,
 *     CP.1, CP.8 — les 4 colonnes du schéma CDC initial, chacune détaillée en 4 sous-montants).
 *
 * Contrairement à commandePgiImport.service.ts ("annule et remplace" par service), chaque
 * confirm() est un upsert par NUMERO_OPERATION : une opération jamais réimportée reste en base,
 * jamais de suppression physique. ACTIF est un champ manuel (décision du 04/09/2026,
 * investissement.service.ts#updateManagedFields) : ce module ne le fixe qu'à la création (défaut
 * de colonne `true`, jamais inclus dans la charge de l'upsert) — il n'y a donc plus de mécanisme
 * d'inactivation automatique quand une opération sort du lot éligible (absente du fichier,
 * statut hors {A, F}, ou CUG hors service) : elle reste simplement inchangée en base.
 */

const OP_SHEET = 'OP'
const AP_SHEET = 'AP'
const CP_SHEET = 'CP'

const REFERENCE_HEADERS_OP = [
  'Numero projet', 'Code Projet', 'Intitule Projet', 'Type', 'Description Type', 'Numero operation',
  'Categorie', 'Code', 'Intitule', 'Description', 'CUG coordinateur', 'Statut', 'Commentaire',
  'Eligible financement', 'Taux theorique', 'Taux effectif', 'Montant FC', 'Montant travaux',
  'Realise avant 2012', 'Travaux avant 2012', 'Date debut', 'Date fin', 'Date MD1', 'Date MD2',
  'Date MD3', 'Date MD4', 'Date MD5', 'Date validation 1', 'Date validation 2', 'Date validation 3',
  'Date validation 4', 'Date validation 5', 'Actif', 'Location', 'Activite', 'Metier', 'Famille',
  'UF', 'Type avarie', 'Code classement', 'Assureur', 'Pour compte de', 'Tier', 'Date sinistre',
  'Date reception', 'Date fin', 'Date Fin Travaux1', 'Date Fin Travaux2', 'Date Fin estime',
  'Rentabilite', 'Ind. date fin travaux', 'Dest budgetaire', 'Budget destination', 'Orientation',
  'Programme', 'Projet', 'Phasage', 'Risque', 'Sous op 1', 'Ctrl AP 1', 'Sous op 2', 'Ctrl AP 2',
  'Sous op 3', 'Ctrl AP 3', 'Sous op 4', 'Ctrl AP 4', 'Sous op 5', 'Ctrl AP 5', 'Sous op 6',
  'Ctrl AP 6', 'Sous op 7', 'Ctrl AP 7', 'Sous op 8', 'Ctrl AP 8', 'Sous op 9', 'Ctrl AP 9',
] as const

const REFERENCE_HEADERS_AP_CP = [
  'Fonds disponibles EUR ): Compte',
  'Fonds disponibles EUR ): Budget',
  'Fonds disponibles EUR ): Engagement',
  'Fonds disponibles EUR ): Réel',
  'Fonds disponibles EUR ):  Disponible',
] as const

const COL_CODE = 8
const COL_INTITULE = 9
const COL_CUG = 11
const COL_STATUT = 12
const COL_MONTANT_FC = 17
const COL_MONTANT_TRAVAUX = 18

const STATUTS_ELIGIBLES = new Set(['A', 'F'])
const TRANCHES = ['1', '8'] as const
type Tranche = (typeof TRANCHES)[number]

/**
 * `type` identifie la nature de l'anomalie (une seule à ce jour : CUG hors service, §7.2 de la
 * spec) — sert au frontend à afficher un cumul par type en plus de la liste détaillée, utile
 * quand le nombre d'anomalies est élevé (ex. mauvais service sélectionné à l'import : toutes les
 * lignes remontent la même anomalie).
 */
export type AnomalieType = 'cug_hors_service'

export interface Anomalie {
  ligne: number | null
  type: AnomalieType
  message: string
}

export interface LigneInvestissement {
  numeroOperation: string
  libelle: string
  statut: string
  mtInitial: number
  mtSoldeAp1: number
  mtSoldeAp8: number
  mtSoldeCp1: number
  mtSoldeCp8: number
}

export interface ImportReport {
  lignes: LigneInvestissement[]
  nbExclues: number
  anomalies: Anomalie[]
}

interface RawOpRow {
  ligne: number
  code: string
  libelle: string
  cug: string
  statut: string
  montantFc: number
  montantTravaux: number
}

interface Montants {
  budget: number
  engage: number
  liquide: number
  solde: number
}

function zeroMontants(): Montants {
  return { budget: 0, engage: 0, liquide: 0, solde: 0 }
}

function cellText(value: ExcelJS.CellValue): string {
  if (value === null || value === undefined) return ''
  if (typeof value === 'object' && 'richText' in (value as { richText?: unknown })) {
    return (value as { richText: { text: string }[] }).richText.map((r) => r.text).join('').trim()
  }
  return String(value).trim()
}

function cellNumber(value: ExcelJS.CellValue): number {
  if (value === null || value === undefined || value === '') return 0
  if (typeof value === 'number') return value
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : 0
}

function getWorksheet(workbook: ExcelJS.Workbook, name: string): ExcelJS.Worksheet {
  const worksheet = workbook.getWorksheet(name)
  if (!worksheet) throw new AppError(`Feuille "${name}" absente du fichier.`, 400)
  return worksheet
}

/** Étape 1 — ligne d'en-têtes (ligne 1) strictement identique à la référence. Lève AppError (bloquant) au premier écart. */
function validateHeaderRow(worksheet: ExcelJS.Worksheet, reference: readonly string[]): void {
  const row = worksheet.getRow(1)
  for (let col = 1; col <= reference.length; col++) {
    const actual = cellText(row.getCell(col).value)
    if (actual !== reference[col - 1]) {
      throw new AppError(
        `La ligne d'en-têtes de la feuille "${worksheet.name}" ne correspond pas au modèle attendu (colonne ${col} : attendu "${reference[col - 1]}", trouvé "${actual}").`,
        400,
      )
    }
  }
}

function readOpRows(worksheet: ExcelJS.Worksheet): RawOpRow[] {
  const rows: RawOpRow[] = []
  for (let ligne = 2; ; ligne++) {
    const row = worksheet.getRow(ligne)
    const code = cellText(row.getCell(COL_CODE).value)
    if (!code) break
    rows.push({
      ligne,
      code,
      libelle: cellText(row.getCell(COL_INTITULE).value),
      cug: cellText(row.getCell(COL_CUG).value),
      statut: cellText(row.getCell(COL_STATUT).value),
      montantFc: cellNumber(row.getCell(COL_MONTANT_FC).value),
      montantTravaux: cellNumber(row.getCell(COL_MONTANT_TRAVAUX).value),
    })
  }
  return rows
}

/**
 * Décode la clé à tirets des feuilles AP/CP (§3 de la spec) : seul le 9ᵉ segment (ex.
 * "PSU025493.8") est utilisé — "P" retiré, ce qui précède le "." = numéro d'opération complet
 * (correspond exactement à OP.Code), ce qui suit = l'indice ("1" à "9", ou "R"/"A").
 */
function decodeKey(key: string): { numeroOperation: string; indice: string } | null {
  const parts = key.split('-')
  const segment = parts[8]
  if (!segment) return null
  const match = /^P(.{8})(?:\.(.+))?$/.exec(segment)
  if (!match) return null
  return { numeroOperation: match[1], indice: match[2] ?? '' }
}

/**
 * Agrège une feuille AP ou CP : ne conserve que les tranches 1 et 8 (§3/§4 de la spec), somme les
 * 4 montants par (numéro d'opération, tranche) — plusieurs sous-projets/CHAP peuvent alimenter la
 * même tranche (non-unicité vérifiée sur le fichier réel). Retourne aussi le nombre de lignes à
 * tranche 1/8 dont le numéro ne correspond à aucune opération éligible (exclusion silencieuse,
 * §8 de la spec).
 */
function aggregateSheet(
  worksheet: ExcelJS.Worksheet,
  eligibleCodes: Set<string>,
): { parTranche: Map<string, Montants>; nbExclues: number } {
  const parTranche = new Map<string, Montants>()
  let nbExclues = 0

  for (let ligne = 2; ligne <= worksheet.rowCount; ligne++) {
    const row = worksheet.getRow(ligne)
    const key = cellText(row.getCell(1).value)
    if (!key) continue
    const decoded = decodeKey(key)
    if (!decoded || !TRANCHES.includes(decoded.indice as Tranche)) continue

    if (!eligibleCodes.has(decoded.numeroOperation)) {
      nbExclues++
      continue
    }

    const mapKey = `${decoded.numeroOperation}|${decoded.indice}`
    const montants = parTranche.get(mapKey) ?? zeroMontants()
    montants.budget += cellNumber(row.getCell(2).value)
    montants.engage += cellNumber(row.getCell(3).value)
    montants.liquide += cellNumber(row.getCell(4).value)
    montants.solde += cellNumber(row.getCell(5).value)
    parTranche.set(mapKey, montants)
  }

  return { parTranche, nbExclues }
}

async function parseAndValidate(
  matricule: string | null,
  idService: number,
  buffer: Buffer,
): Promise<{ operations: OperationInvestissementUpsert[]; nbExclues: number; anomalies: Anomalie[] }> {
  await assertManagesServiceOrHasRoleCb(matricule, idService)

  const workbook = new ExcelJS.Workbook()
  await workbook.xlsx.load(buffer as unknown as ExcelJS.Buffer)

  const opWorksheet = getWorksheet(workbook, OP_SHEET)
  const apWorksheet = getWorksheet(workbook, AP_SHEET)
  const cpWorksheet = getWorksheet(workbook, CP_SHEET)

  validateHeaderRow(opWorksheet, REFERENCE_HEADERS_OP)
  validateHeaderRow(apWorksheet, REFERENCE_HEADERS_AP_CP)
  validateHeaderRow(cpWorksheet, REFERENCE_HEADERS_AP_CP)

  const opRows = readOpRows(opWorksheet)

  const cugs = await cugRepository.findAll(idService)
  const validCugCodes = new Set(cugs.map((c) => c.code_cug))

  const anomalies: Anomalie[] = []
  const eligibleOpRows: RawOpRow[] = []
  for (const row of opRows) {
    if (!STATUTS_ELIGIBLES.has(row.statut)) continue
    if (!validCugCodes.has(row.cug)) {
      anomalies.push({
        ligne: row.ligne,
        type: 'cug_hors_service',
        message: `Le CUG "${row.cug}" (opération "${row.code}") n'est pas affecté au service cible de l'import.`,
      })
      continue
    }
    eligibleOpRows.push(row)
  }

  const eligibleCodes = new Set(eligibleOpRows.map((row) => row.code))

  const ap = aggregateSheet(apWorksheet, eligibleCodes)
  const cp = aggregateSheet(cpWorksheet, eligibleCodes)
  const nbExclues = ap.nbExclues + cp.nbExclues

  const operations: OperationInvestissementUpsert[] = eligibleOpRows.map((row) => {
    const ap1 = ap.parTranche.get(`${row.code}|1`) ?? zeroMontants()
    const ap8 = ap.parTranche.get(`${row.code}|8`) ?? zeroMontants()
    const cp1 = cp.parTranche.get(`${row.code}|1`) ?? zeroMontants()
    const cp8 = cp.parTranche.get(`${row.code}|8`) ?? zeroMontants()
    return {
      numero_operation: row.code,
      libelle: row.libelle,
      id_service: idService,
      code_cug: row.cug,
      statut: row.statut as 'A' | 'F',
      mt_initial: row.montantFc,
      mt_travaux: row.montantTravaux,
      mt_budget_ap1: ap1.budget,
      mt_engage_ap1: ap1.engage,
      mt_liquide_ap1: ap1.liquide,
      mt_solde_ap1: ap1.solde,
      mt_budget_ap8: ap8.budget,
      mt_engage_ap8: ap8.engage,
      mt_liquide_ap8: ap8.liquide,
      mt_solde_ap8: ap8.solde,
      mt_budget_cp1: cp1.budget,
      mt_engage_cp1: cp1.engage,
      mt_liquide_cp1: cp1.liquide,
      mt_solde_cp1: cp1.solde,
      mt_budget_cp8: cp8.budget,
      mt_engage_cp8: cp8.engage,
      mt_liquide_cp8: cp8.liquide,
      mt_solde_cp8: cp8.solde,
    }
  })

  return { operations, nbExclues, anomalies }
}

function toReport(result: Awaited<ReturnType<typeof parseAndValidate>>): ImportReport {
  return {
    nbExclues: result.nbExclues,
    anomalies: result.anomalies,
    lignes: result.operations.map((o) => ({
      numeroOperation: o.numero_operation,
      libelle: o.libelle,
      statut: o.statut,
      mtInitial: o.mt_initial,
      mtSoldeAp1: o.mt_solde_ap1,
      mtSoldeAp8: o.mt_solde_ap8,
      mtSoldeCp1: o.mt_solde_cp1,
      mtSoldeCp8: o.mt_solde_cp8,
    })),
  }
}

export interface LastImportInfo {
  /** `false` si la ligne n'existe pas encore pour ce service. Purement informatif ici (bandeau
   * écran, §7.1/§10 de la spec) : contrairement aux imports marchés/commandes, cette valeur ne
   * bloque jamais un import (le fichier PGI ne porte aucune date de génération fiable, §1). */
  exists: boolean
  valeur: string | null
}

/** Lit le paramètre last.import.investissement.pgi pour un service donné, portée SERVICE strictement — même principe que commandePgiImport.service.ts#findLastImportRow. */
export async function findLastImportRow(idService: number): Promise<LastImportInfo> {
  const rows = await parametresRepository.findAllRows('last.import.investissement.pgi')
  const row = rows.find((r) => r.id_service === idService)
  if (!row) return { exists: false, valeur: null }
  return { exists: true, valeur: typeof row.valeur === 'string' ? row.valeur : null }
}

export async function getLastImportInfo(matricule: string | null, idService: number): Promise<LastImportInfo> {
  await assertManagesServiceOrHasRoleCb(matricule, idService)
  return findLastImportRow(idService)
}

export async function preview(matricule: string | null, idService: number, buffer: Buffer): Promise<ImportReport> {
  const result = await parseAndValidate(matricule, idService, buffer)
  return toReport(result)
}

export async function confirm(matricule: string | null, idService: number, buffer: Buffer): Promise<ImportReport> {
  const result = await parseAndValidate(matricule, idService, buffer)

  await investissementRepository.upsertMany(result.operations)

  await parametresRepository.upsert({
    cle: 'last.import.investissement.pgi',
    valeur: new Date().toISOString().slice(0, 10),
    idDirection: null,
    idService,
    matriculeMaj: matricule ?? '',
  })

  return toReport(result)
}
