import { randomUUID } from 'node:crypto'
import { execFile } from 'node:child_process'
import { promisify } from 'node:util'
import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import ExcelJS from 'exceljs'

/**
 * Génère la fiche FAD papier (PDF) — bouton réservé au rôle CB (voir
 * demandeAchat.service.ts#genererFadPdf). Décision du 19/09/2026 (remplace l'approche
 * pdf-lib initiale) : on remplit directement le gabarit Excel
 * (`backend/src/assets/modele-fad.xlsx`, copie de ForClaude/CDC/Modèle-FAD-XLSX.xlsx) via
 * `exceljs`, puis on le convertit en PDF avec LibreOffice en mode headless (`soffice
 * --headless --convert-to pdf`). Excel reste ainsi la seule source de vérité pour la mise en
 * page (bordures, polices, retour à la ligne, largeurs de colonnes) — plus de calcul de
 * coordonnées à maintenir à la main, contrairement à la première version de ce module.
 *
 * Correspondance champ métier → cellule Excel : voir la feuille « Correspondance
 * Cellule-Valeur » du classeur source — ne jamais improviser une adresse de cellule sans y
 * revenir.
 *
 * Dépendance système : LibreOffice doit être installé sur la machine qui exécute ce code
 * (Railway : voir nixpacks.toml à la racine du repo ; en local, définir `SOFFICE_PATH` dans
 * backend/.env si `soffice` n'est pas sur le PATH).
 */

const execFileAsync = promisify(execFile)

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const TEMPLATE_PATH = path.resolve(__dirname, '../assets/modele-fad.xlsx')
const SHEET_NAME = 'Modèle FAD'

export interface FadPdfSignataire {
  nomPrenom: string
  date: string
  signatureBuffer: Buffer | null
  signatureExtension: 'png' | 'jpg' | null
}

export interface FadPdfEntrepriseConsultee {
  nom: string
  codePostal: string | null
  ville: string | null
  montantHt: number | null
  delai: string | null
}

export interface FadPdfData {
  direction: string
  service: string
  cellule: string
  numero: string
  demandeur: FadPdfSignataire
  fonctionDemandeur: string
  objet: string
  description: string | null
  typeAchat: 'TRAVAUX' | 'FOURNITURES' | 'SERVICES' | null
  emplacement: string
  secteurTechnique: string
  imputationComptable: 'FONCTIONNEMENT' | 'INVESTISSEMENT' | null
  numeroOperation: string | null
  montant: number
  cug: string | null
  procedureAchat: 'MARCHE' | 'HORS_MARCHE'
  nummarche: string | null
  /** Titulaire du marché (procédure MARCHE) ou fournisseur retenu (HORS_MARCHE) — même concept, position différente selon la procédure. */
  entrepriseRetenue: string | null
  motifChoix: 'Prix' | 'Délai' | 'Technique' | 'Autre' | null
  libelleAutreMotif: string | null
  /** Jusqu'à 5 lignes (HORS_MARCHE uniquement — vide en procédure MARCHE, voir genererFadPdf). */
  entreprisesConsultees: FadPdfEntrepriseConsultee[]
  responsableSection: FadPdfSignataire
  /** Déjà construit ("de 0 à 45 000 € H.T.") — voir genererFadPdf pour le calcul à partir de seuil_validation_ds. */
  seuilBasLabel: string
  /** Déjà construit ("> à 45 000 € H.T."). */
  seuilHautLabel: string
  chefService: FadPdfSignataire
}

// Adresse (coin haut-gauche de la plage fusionnée le cas échéant) de chaque champ — voir
// ForClaude/CDC/Modèle-FAD-XLSX.xlsx, feuille « Correspondance Cellule-Valeur ».
const CELLS = {
  direction: 'B3',
  service: 'B5',
  cellule: 'G6',
  celluleRc: 'S36',
  numero: 'Y6',
  demandeurNomHeader: 'G7',
  fonctionDemandeur: 'T7',
  objet: 'D8',
  description: 'B9',
  typeAchatTravaux: 'E11',
  typeAchatFournitures: 'E12',
  typeAchatServices: 'E13',
  emplacement: 'G12',
  secteurTechnique: 'G13',
  fonctionnement: 'AB11',
  investissement: 'AB12',
  numeroOperation: 'AB13',
  montant: 'S15',
  cug: 'AC15',
  marcheCheckbox: 'E19',
  nummarche: 'H19',
  titulaireMarche: 'N19',
  horsMarcheCheckbox: 'E23',
  fournisseurRetenu: 'N23',
  motifPrix: 'K25',
  motifDelai: 'O25',
  motifTechnique: 'S25',
  motifAutre: 'Z25',
  libelleAutreMotif: 'K26',
  ent1Nom: 'B28',
  ent2Nom: 'B29',
  ent3Nom: 'B30',
  ent4Nom: 'B31',
  ent5Nom: 'B32',
  ent1Cp: 'S28',
  ent2Cp: 'S29',
  ent3Cp: 'S30',
  ent4Cp: 'S31',
  ent5Cp: 'S32',
  ent1Ville: 'U28',
  ent2Ville: 'U29',
  ent3Ville: 'U30',
  ent4Ville: 'U31',
  ent5Ville: 'U32',
  ent1Montant: 'AA28',
  ent2Montant: 'AA29',
  ent3Montant: 'AA30',
  ent4Montant: 'AA31',
  ent5Montant: 'AA32',
  ent1Delai: 'AE28',
  ent2Delai: 'AE29',
  ent3Delai: 'AE30',
  ent4Delai: 'AE31',
  ent5Delai: 'AE32',
  demandeurNomSignature: 'D38',
  demandeurDate: 'D39',
  rcNom: 'U38',
  rcDate: 'U39',
  seuilBas: 'B41',
  serviceNomCds: 'B43',
  cdsNom: 'D46',
  cdsDate: 'D47',
  seuilHaut: 'S41',
  directionNomDs: 'S43',
} as const

// Plage fusionnée (image ancrée dessus, remplit exactement la boîte) par signataire.
const SIGNATURE_RANGES = {
  demandeur: 'B37:P37',
  rc: 'S37:AG37',
  cds: 'B44:P44',
} as const

function setCell(sheet: ExcelJS.Worksheet, address: string, value: string | number | null | undefined) {
  if (value === null || value === undefined || value === '') return
  sheet.getCell(address).value = value
}

function setCheckbox(sheet: ExcelJS.Worksheet, address: string, checked: boolean) {
  if (checked) sheet.getCell(address).value = 'X'
}

function formatMontant(montant: number): string {
  return `${montant.toFixed(2)} €`
}

// Fraction de la plage occupée par l'image de signature (le reste = marge, centrée) — évite
// qu'une signature scannée "colle" aux bords de sa case sur le document imprimé.
const SIGNATURE_FILL_RATIO = 0.85

/** "B37:P37" → colonne/ligne de départ (1-based, inclus) et de fin (1-based, inclus). */
function parseRangeBounds(range: string): { startCol: number; startRow: number; endCol: number; endRow: number } {
  const [start, end] = range.split(':')
  const parse = (address: string) => {
    const m = address.match(/^([A-Z]+)(\d+)$/)
    if (!m) throw new Error(`Adresse de cellule invalide : ${address}`)
    let col = 0
    for (const ch of m[1]) col = col * 26 + (ch.charCodeAt(0) - 64)
    return { col, row: Number(m[2]) }
  }
  const s = parse(start)
  const e = parse(end)
  return { startCol: s.col, startRow: s.row, endCol: e.col, endRow: e.row }
}

/**
 * Ancrage réduit à `SIGNATURE_FILL_RATIO` de la plage donnée, centré — voir Anchor#col/row
 * (node_modules/exceljs/lib/doc/anchor.js) : un `col`/`row` fractionnaire est interprété comme
 * une position continue dans le repère de la feuille (partie entière = colonne/ligne 0-based,
 * partie décimale = fraction de sa largeur/hauteur réelle), donc une simple interpolation
 * linéaire entre les coins de la plage donne une réduction proportionnelle correcte même si les
 * colonnes traversées ont des largeurs différentes.
 */
function shrinkRangeToFraction(range: string, fraction: number): { tl: { col: number; row: number }; br: { col: number; row: number } } {
  const { startCol, startRow, endCol, endRow } = parseRangeBounds(range)
  // Bornes 0-based du rectangle complet (même convention que Image#set model pour une plage
  // fournie sous forme de chaîne : tl = début de la première cellule, br = début de la cellule
  // suivant la dernière).
  const tl = { col: startCol - 1, row: startRow - 1 }
  const br = { col: endCol, row: endRow }
  const margin = (1 - fraction) / 2
  const width = br.col - tl.col
  const height = br.row - tl.row
  return {
    tl: { col: tl.col + margin * width, row: tl.row + margin * height },
    br: { col: br.col - margin * width, row: br.row - margin * height },
  }
}

function addSignatureImage(
  workbook: ExcelJS.Workbook,
  sheet: ExcelJS.Worksheet,
  signataire: FadPdfSignataire,
  range: string,
) {
  if (!signataire.signatureBuffer || !signataire.signatureExtension) return
  const image: ExcelJS.Image = {
    // Les types exceljs déclarent `buffer?: Buffer` avec une version de @types/node
    // différente de celle de ce workspace (Buffer générique) — cast nécessaire, la valeur
    // reste un vrai Buffer Node à l'exécution.
    buffer: signataire.signatureBuffer as never,
    extension: signataire.signatureExtension === 'jpg' ? 'jpeg' : 'png',
  }
  const imageId = workbook.addImage(image)
  // Les types exceljs exigent des instances de la classe `Anchor` pour tl/br, mais
  // l'implémentation réelle (lib/doc/image.js#set model) accepte tout objet {col, row} — cast
  // nécessaire, comportement voulu (voir shrinkRangeToFraction).
  sheet.addImage(imageId, shrinkRangeToFraction(range, SIGNATURE_FILL_RATIO) as unknown as ExcelJS.ImageRange)
}

// Bornes 0-based des 3 zones de signature (même convention que shrinkRangeToFraction) — sert à
// ne retirer que les images résiduelles à ces emplacements précis, jamais une image posée
// ailleurs sur le gabarit (ex. logo en B1, décision du 19/09/2026).
const MANAGED_SIGNATURE_BOUNDS = Object.values(SIGNATURE_RANGES).map((range) => {
  const { startCol, startRow, endCol, endRow } = parseRangeBounds(range)
  return { tlCol: startCol - 1, tlRow: startRow - 1, brCol: endCol, brRow: endRow }
})

interface LoadedImageMedia {
  type: string
  range?: { tl: { nativeCol: number; nativeRow: number } }
}

/**
 * Retire uniquement les images déjà présentes dans les 3 zones de signature (résidu d'une
 * précédente édition manuelle d'exemple dans Excel, jamais garanti "vide" par construction) —
 * toute autre image du gabarit (logo, illustrations) reste intacte. exceljs n'expose aucune API
 * publique de suppression d'image ; `_media` est le tableau interne réel (voir
 * node_modules/exceljs/lib/doc/worksheet.js), manipulé ici volontairement.
 */
function removeManagedSignatureImages(sheet: ExcelJS.Worksheet) {
  const media = (sheet as unknown as { _media: LoadedImageMedia[] })._media
  ;(sheet as unknown as { _media: LoadedImageMedia[] })._media = media.filter((item) => {
    if (item.type !== 'image' || !item.range) return true
    const { nativeCol, nativeRow } = item.range.tl
    const withinManagedZone = MANAGED_SIGNATURE_BOUNDS.some(
      (b) => nativeCol >= b.tlCol && nativeCol < b.brCol && nativeRow >= b.tlRow && nativeRow < b.brRow,
    )
    return !withinManagedZone
  })
}

/**
 * Repart d'une base propre avant de remplir : le gabarit peut contenir du contenu résiduel
 * (cases cochées, texte, ancienne signature d'exemple) laissé par une précédente édition
 * manuelle dans Excel — jamais garanti "vide" par construction. Plutôt que de dépendre d'un
 * nettoyage manuel parfait du fichier à chaque mise à jour du gabarit, on efface
 * systématiquement toutes les cellules gérées et les images des 3 zones de signature avant de
 * poser les vraies valeurs.
 */
function resetManagedContent(sheet: ExcelJS.Worksheet) {
  for (const address of Object.values(CELLS)) {
    sheet.getCell(address).value = null
  }
  removeManagedSignatureImages(sheet)
}

/** Remplit le gabarit (cellules + images de signature) — séparé de la conversion PDF pour rester testable sans LibreOffice. */
export function fillFadWorkbook(workbook: ExcelJS.Workbook, data: FadPdfData): void {
  const sheet = workbook.getWorksheet(SHEET_NAME)
  if (!sheet) throw new Error(`Feuille "${SHEET_NAME}" introuvable dans le gabarit modele-fad.xlsx.`)

  resetManagedContent(sheet)

  setCell(sheet, CELLS.direction, data.direction)
  setCell(sheet, CELLS.service, data.service)
  setCell(sheet, CELLS.cellule, data.cellule)
  setCell(sheet, CELLS.celluleRc, data.cellule)
  setCell(sheet, CELLS.numero, data.numero)
  setCell(sheet, CELLS.demandeurNomHeader, data.demandeur.nomPrenom)
  setCell(sheet, CELLS.fonctionDemandeur, data.fonctionDemandeur)
  setCell(sheet, CELLS.objet, data.objet)
  setCell(sheet, CELLS.description, data.description)

  setCheckbox(sheet, CELLS.typeAchatTravaux, data.typeAchat === 'TRAVAUX')
  setCheckbox(sheet, CELLS.typeAchatFournitures, data.typeAchat === 'FOURNITURES')
  setCheckbox(sheet, CELLS.typeAchatServices, data.typeAchat === 'SERVICES')
  setCell(sheet, CELLS.emplacement, data.emplacement)
  setCell(sheet, CELLS.secteurTechnique, data.secteurTechnique)

  setCheckbox(sheet, CELLS.fonctionnement, data.imputationComptable === 'FONCTIONNEMENT')
  setCheckbox(sheet, CELLS.investissement, data.imputationComptable === 'INVESTISSEMENT')
  if (data.imputationComptable === 'INVESTISSEMENT') setCell(sheet, CELLS.numeroOperation, data.numeroOperation)

  setCell(sheet, CELLS.montant, formatMontant(data.montant))
  setCell(sheet, CELLS.cug, data.cug)

  setCheckbox(sheet, CELLS.marcheCheckbox, data.procedureAchat === 'MARCHE')
  if (data.procedureAchat === 'MARCHE') {
    setCell(sheet, CELLS.nummarche, data.nummarche)
    setCell(sheet, CELLS.titulaireMarche, data.entrepriseRetenue)
  }
  setCheckbox(sheet, CELLS.horsMarcheCheckbox, data.procedureAchat === 'HORS_MARCHE')
  if (data.procedureAchat === 'HORS_MARCHE') {
    setCell(sheet, CELLS.fournisseurRetenu, data.entrepriseRetenue)
  }

  // Motif du choix affiché uniquement en procédure HORS_MARCHE (le choix entre plusieurs
  // entreprises consultées n'a pas de sens en MARCHE) — voir ForClaude/CDC/Modèle-FAD-XLSX.xlsx,
  // feuille Correspondance Cellule-Valeur (K25/O25/S25/Z25/K26).
  const affichierMotifChoix = data.procedureAchat === 'HORS_MARCHE'
  setCheckbox(sheet, CELLS.motifPrix, affichierMotifChoix && data.motifChoix === 'Prix')
  setCheckbox(sheet, CELLS.motifDelai, affichierMotifChoix && data.motifChoix === 'Délai')
  setCheckbox(sheet, CELLS.motifTechnique, affichierMotifChoix && data.motifChoix === 'Technique')
  setCheckbox(sheet, CELLS.motifAutre, affichierMotifChoix && data.motifChoix === 'Autre')
  if (affichierMotifChoix && data.motifChoix === 'Autre') setCell(sheet, CELLS.libelleAutreMotif, data.libelleAutreMotif)

  const entrepriseCells = [
    { nom: CELLS.ent1Nom, cp: CELLS.ent1Cp, ville: CELLS.ent1Ville, montant: CELLS.ent1Montant, delai: CELLS.ent1Delai },
    { nom: CELLS.ent2Nom, cp: CELLS.ent2Cp, ville: CELLS.ent2Ville, montant: CELLS.ent2Montant, delai: CELLS.ent2Delai },
    { nom: CELLS.ent3Nom, cp: CELLS.ent3Cp, ville: CELLS.ent3Ville, montant: CELLS.ent3Montant, delai: CELLS.ent3Delai },
    { nom: CELLS.ent4Nom, cp: CELLS.ent4Cp, ville: CELLS.ent4Ville, montant: CELLS.ent4Montant, delai: CELLS.ent4Delai },
    { nom: CELLS.ent5Nom, cp: CELLS.ent5Cp, ville: CELLS.ent5Ville, montant: CELLS.ent5Montant, delai: CELLS.ent5Delai },
  ]
  data.entreprisesConsultees.slice(0, 5).forEach((entreprise, index) => {
    const cells = entrepriseCells[index]
    setCell(sheet, cells.nom, entreprise.nom)
    setCell(sheet, cells.cp, entreprise.codePostal)
    setCell(sheet, cells.ville, entreprise.ville)
    if (entreprise.montantHt !== null) setCell(sheet, cells.montant, formatMontant(entreprise.montantHt))
    setCell(sheet, cells.delai, entreprise.delai)
  })

  setCell(sheet, CELLS.demandeurNomSignature, data.demandeur.nomPrenom)
  setCell(sheet, CELLS.demandeurDate, data.demandeur.date)
  setCell(sheet, CELLS.rcNom, data.responsableSection.nomPrenom)
  setCell(sheet, CELLS.rcDate, data.responsableSection.date)
  setCell(sheet, CELLS.seuilBas, data.seuilBasLabel)
  setCell(sheet, CELLS.serviceNomCds, data.service)
  setCell(sheet, CELLS.cdsNom, data.chefService.nomPrenom)
  setCell(sheet, CELLS.cdsDate, data.chefService.date)
  setCell(sheet, CELLS.seuilHaut, data.seuilHautLabel)
  setCell(sheet, CELLS.directionNomDs, data.direction)
  // Case directeur (au-delà du seuil) volontairement jamais renseignée : ce document est
  // généré par la CB au moment où elle transmet la FAD (ou l'exempte du seuil DS), avant toute
  // intervention du DS — décision du 19/09/2026.

  addSignatureImage(workbook, sheet, data.demandeur, SIGNATURE_RANGES.demandeur)
  addSignatureImage(workbook, sheet, data.responsableSection, SIGNATURE_RANGES.rc)
  addSignatureImage(workbook, sheet, data.chefService, SIGNATURE_RANGES.cds)
}

function getSofficePath(): string {
  return process.env.SOFFICE_PATH?.trim() || 'soffice'
}

/** Convertit un classeur déjà rempli en PDF via LibreOffice headless — étape non unitairement testable sans LibreOffice installé (voir smoke test manuel). */
async function convertWorkbookToPdf(workbook: ExcelJS.Workbook): Promise<Buffer> {
  const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'fad-pdf-'))
  const xlsxPath = path.join(tmpDir, `${randomUUID()}.xlsx`)
  try {
    await workbook.xlsx.writeFile(xlsxPath)
    await execFileAsync(getSofficePath(), ['--headless', '--convert-to', 'pdf', '--outdir', tmpDir, xlsxPath], { timeout: 30_000 })
    const pdfPath = xlsxPath.replace(/\.xlsx$/, '.pdf')
    return await fs.readFile(pdfPath)
  } finally {
    await fs.rm(tmpDir, { recursive: true, force: true }).catch(() => {})
  }
}

/** LibreOffice exporte toutes les feuilles du classeur en PDF — ne garder que le gabarit lui-même (la feuille « Correspondance Cellule-Valeur » n'a rien à faire dans le document final). */
function removeOtherWorksheets(workbook: ExcelJS.Workbook) {
  for (const sheet of [...workbook.worksheets]) {
    if (sheet.name !== SHEET_NAME) workbook.removeWorksheet(sheet.id)
  }
}

export async function genererFadPdfBuffer(data: FadPdfData): Promise<Buffer> {
  const workbook = new ExcelJS.Workbook()
  await workbook.xlsx.readFile(TEMPLATE_PATH)
  fillFadWorkbook(workbook, data)
  removeOtherWorksheets(workbook)
  return convertWorkbookToPdf(workbook)
}
