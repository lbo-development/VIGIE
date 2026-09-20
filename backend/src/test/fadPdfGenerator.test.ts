import { describe, it, expect } from 'vitest'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import ExcelJS from 'exceljs'
import { fillFadWorkbook, type FadPdfData } from '../pdf/fadPdfGenerator.js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const TEMPLATE_PATH = path.resolve(__dirname, '../assets/modele-fad.xlsx')

const SIGNATURE_PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=',
  'base64',
)

/** PNG minimal (signature + en-tête IHDR uniquement, sans IDAT/CRC) — suffisant pour getPngDimensions, qui ne lit que les octets 16-23. */
function buildPngWithSize(width: number, height: number): Buffer {
  const buffer = Buffer.alloc(24)
  buffer.write('\x89PNG\r\n\x1a\n', 0, 'binary')
  buffer.writeUInt32BE(13, 8)
  buffer.write('IHDR', 12, 'ascii')
  buffer.writeUInt32BE(width, 16)
  buffer.writeUInt32BE(height, 20)
  return buffer
}

function buildData(overrides: Partial<FadPdfData> = {}): FadPdfData {
  return {
    direction: "Direction des Services de l'Exploitation et des réseaux",
    service: 'Service Voyageurs',
    cellule: 'Administration',
    numero: 'FAD-2026-07-15-01',
    demandeur: { nomPrenom: 'Cédric LAMOISE', date: '15/07/2026', signatureBuffer: SIGNATURE_PNG, signatureExtension: 'png' },
    fonctionDemandeur: 'Chef de groupe',
    objet: 'Remplacement de batterie SCES TDP',
    description: 'Description détaillée',
    typeAchat: 'TRAVAUX',
    emplacement: 'TDP Embarcadères',
    secteurTechnique: 'SSI-Alimentation de secours',
    imputationComptable: 'FONCTIONNEMENT',
    numeroOperation: null,
    montant: 2563.93,
    cug: '271',
    procedureAchat: 'HORS_MARCHE',
    nummarche: null,
    entrepriseRetenue: 'INEO',
    motifChoix: 'Prix',
    libelleAutreMotif: null,
    entreprisesConsultees: [{ nom: 'INEO', codePostal: '13100', ville: 'Aix-en-Provence', montantHt: 2563.93, delai: '31/12/2026' }],
    responsableSection: { nomPrenom: 'Laurent BOHBOT', date: '15/07/2026', signatureBuffer: SIGNATURE_PNG, signatureExtension: 'png' },
    seuilBasLabel: 'de 0 à 90 000€ H.T.',
    seuilHautLabel: '> à 90 000€ H.T.',
    chefService: { nomPrenom: 'Matthieu HINCHLIFFE', date: '15/07/2026', signatureBuffer: SIGNATURE_PNG, signatureExtension: 'png' },
    ...overrides,
  }
}

async function loadTemplate(): Promise<ExcelJS.Workbook> {
  const workbook = new ExcelJS.Workbook()
  await workbook.xlsx.readFile(TEMPLATE_PATH)
  return workbook
}

describe('fillFadWorkbook', () => {
  it('remplit les champs de base aux bonnes cellules', async () => {
    const workbook = await loadTemplate()
    fillFadWorkbook(workbook, buildData())
    const sheet = workbook.getWorksheet('Modèle FAD')!

    expect(sheet.getCell('B3').value).toBe("Direction des Services de l'Exploitation et des réseaux")
    expect(sheet.getCell('B5').value).toBe('Service Voyageurs')
    expect(sheet.getCell('G6').value).toBe('Administration')
    expect(sheet.getCell('S36').value).toBe('Administration')
    expect(sheet.getCell('Y6').value).toBe('FAD-2026-07-15-01')
    expect(sheet.getCell('G7').value).toBe('Cédric LAMOISE')
    expect(sheet.getCell('T7').value).toBe('Chef de groupe')
    expect(sheet.getCell('D8').value).toBe('Remplacement de batterie SCES TDP')
    expect(sheet.getCell('B9').value).toBe('Description détaillée')
    expect(sheet.getCell('S15').value).toBe('2563.93 €')
    expect(sheet.getCell('AC15').value).toBe('271')
  })

  it('coche uniquement la case correspondant à typeAchat', async () => {
    const workbook = await loadTemplate()
    fillFadWorkbook(workbook, buildData({ typeAchat: 'SERVICES' }))
    const sheet = workbook.getWorksheet('Modèle FAD')!

    expect(sheet.getCell('E11').value).toBeNull()
    expect(sheet.getCell('E12').value).toBeNull()
    expect(sheet.getCell('E13').value).toBe('X')
  })

  it('procédure MARCHE : coche la case Marché, affiche nummarche/titulaire en N19, et laisse E23/N23 vides', async () => {
    const workbook = await loadTemplate()
    fillFadWorkbook(workbook, buildData({ procedureAchat: 'MARCHE', nummarche: 'P2503329', entrepriseRetenue: 'INEO' }))
    const sheet = workbook.getWorksheet('Modèle FAD')!

    expect(sheet.getCell('E19').value).toBe('X')
    expect(sheet.getCell('H19').value).toBe('P2503329')
    expect(sheet.getCell('N19').value).toBe('INEO')
    expect(sheet.getCell('E23').value).toBeNull()
    expect(sheet.getCell('N23').value).toBeNull()
  })

  it('procédure MARCHE : n\'affiche jamais le motif du choix, même si motifChoix est renseigné (résidu d\'une saisie antérieure)', async () => {
    const workbook = await loadTemplate()
    fillFadWorkbook(workbook, buildData({ procedureAchat: 'MARCHE', nummarche: 'P2503329', entrepriseRetenue: 'INEO', motifChoix: 'Prix' }))
    const sheet = workbook.getWorksheet('Modèle FAD')!

    expect(sheet.getCell('K25').value).toBeNull()
    expect(sheet.getCell('O25').value).toBeNull()
    expect(sheet.getCell('S25').value).toBeNull()
    expect(sheet.getCell('Z25').value).toBeNull()
    expect(sheet.getCell('K26').value).toBeNull()
  })

  it('procédure HORS_MARCHE : coche la case Hors marché, remplit N23, et laisse E19/N19 vides', async () => {
    const workbook = await loadTemplate()
    fillFadWorkbook(workbook, buildData({ procedureAchat: 'HORS_MARCHE', entrepriseRetenue: 'INEO' }))
    const sheet = workbook.getWorksheet('Modèle FAD')!

    expect(sheet.getCell('E23').value).toBe('X')
    expect(sheet.getCell('N23').value).toBe('INEO')
    expect(sheet.getCell('E19').value).toBeNull()
    expect(sheet.getCell('N19').value).toBeNull()
  })

  it('affiche le libellé du motif "Autre" uniquement quand motifChoix=Autre', async () => {
    const workbook = await loadTemplate()
    fillFadWorkbook(workbook, buildData({ motifChoix: 'Autre', libelleAutreMotif: 'Urgence sécurité' }))
    const sheet = workbook.getWorksheet('Modèle FAD')!

    expect(sheet.getCell('Z25').value).toBe('X')
    expect(sheet.getCell('K25').value).toBeNull()
    expect(sheet.getCell('K26').value).toBe('Urgence sécurité')
  })

  it('numéro d\'opération affiché seulement si imputation=INVESTISSEMENT', async () => {
    const workbook = await loadTemplate()
    fillFadWorkbook(workbook, buildData({ imputationComptable: 'INVESTISSEMENT', numeroOperation: 'OP-123' }))
    const sheet = workbook.getWorksheet('Modèle FAD')!

    expect(sheet.getCell('AB11').value).toBeNull()
    expect(sheet.getCell('AB12').value).toBe('X')
    expect(sheet.getCell('AB13').value).toBe('OP-123')
  })

  it('remplit jusqu\'à 5 lignes d\'entreprises consultées (nom/CP/ville/montant/délai séparés)', async () => {
    const workbook = await loadTemplate()
    fillFadWorkbook(
      workbook,
      buildData({
        entreprisesConsultees: [
          { nom: 'INEO', codePostal: '13100', ville: 'Aix-en-Provence', montantHt: 2563.93, delai: '31/12/2026' },
          { nom: 'ACME', codePostal: '13001', ville: 'Marseille', montantHt: 3000, delai: '15/01/2027' },
        ],
      }),
    )
    const sheet = workbook.getWorksheet('Modèle FAD')!

    expect(sheet.getCell('B28').value).toBe('INEO')
    expect(sheet.getCell('S28').value).toBe('13100')
    expect(sheet.getCell('U28').value).toBe('Aix-en-Provence')
    expect(sheet.getCell('AA28').value).toBe('2563.93 €')
    expect(sheet.getCell('AE28').value).toBe('31/12/2026')
    expect(sheet.getCell('B29').value).toBe('ACME')
    expect(sheet.getCell('B30').value).toBeNull()
  })

  it('seuils B41/S41 affichent le libellé déjà construit tel quel', async () => {
    const workbook = await loadTemplate()
    fillFadWorkbook(workbook, buildData({ seuilBasLabel: 'de 0 à 45 000€ H.T.', seuilHautLabel: '> à 45 000€ H.T.' }))
    const sheet = workbook.getWorksheet('Modèle FAD')!

    expect(sheet.getCell('B41').value).toBe('de 0 à 45 000€ H.T.')
    expect(sheet.getCell('S41').value).toBe('> à 45 000€ H.T.')
  })

  it('la case directeur (nom/date) n\'est jamais renseignée', async () => {
    const workbook = await loadTemplate()
    fillFadWorkbook(workbook, buildData())
    const sheet = workbook.getWorksheet('Modèle FAD')!

    expect(sheet.getCell('U46').value).toBeNull()
    expect(sheet.getCell('U47').value).toBeNull()
  })

  it('ancre une image de signature pour demandeur/RC/CDS uniquement (+3 images par rapport au gabarit de départ)', async () => {
    const before = await loadTemplate()
    const baselineCount = before.getWorksheet('Modèle FAD')!.getImages().length

    const workbook = await loadTemplate()
    fillFadWorkbook(workbook, buildData())
    const sheet = workbook.getWorksheet('Modèle FAD')!

    // Le gabarit réel peut déjà contenir des images statiques (ex. logo GPMM) — on ne compare
    // pas un total absolu, fragile à chaque évolution du fichier, seulement le delta introduit
    // par les 3 signatures.
    expect(sheet.getImages()).toHaveLength(baselineCount + 3)
  })

  it('préserve une image posée ailleurs sur le gabarit (ex. logo en B1), ne retire que les 3 zones de signature', async () => {
    const before = await loadTemplate()
    const baselineCount = before.getWorksheet('Modèle FAD')!.getImages().length

    const workbook = await loadTemplate()
    const sheet = workbook.getWorksheet('Modèle FAD')!
    const logoImageId = workbook.addImage({ buffer: SIGNATURE_PNG as never, extension: 'png' })
    sheet.addImage(logoImageId, 'B1:M2')

    fillFadWorkbook(workbook, buildData())

    const images = sheet.getImages()
    // Gabarit de départ, + l'image ajoutée par ce test, + les 3 signatures.
    expect(images).toHaveLength(baselineCount + 1 + 3)
    const logoStillPresent = images.some((img) => img.range.tl.nativeCol === 1 && img.range.tl.nativeRow === 0)
    expect(logoStillPresent).toBe(true)
  })

  it('n\'ajoute aucune image si la signature est absente (le gabarit de départ reste inchangé)', async () => {
    const before = await loadTemplate()
    const baselineCount = before.getWorksheet('Modèle FAD')!.getImages().length

    const workbook = await loadTemplate()
    fillFadWorkbook(
      workbook,
      buildData({
        demandeur: { nomPrenom: 'Cédric LAMOISE', date: '15/07/2026', signatureBuffer: null, signatureExtension: null },
        responsableSection: { nomPrenom: 'Laurent BOHBOT', date: '15/07/2026', signatureBuffer: null, signatureExtension: null },
        chefService: { nomPrenom: 'Matthieu HINCHLIFFE', date: '15/07/2026', signatureBuffer: null, signatureExtension: null },
      }),
    )
    const sheet = workbook.getWorksheet('Modèle FAD')!

    expect(sheet.getImages()).toHaveLength(baselineCount)
  })

  it.each([
    ['paysage large', 400, 100],
    ['portrait étroit', 60, 300],
  ])('conserve les proportions de la signature (%s) sans la déformer', async (_label, width, height) => {
    const workbook = await loadTemplate()
    const signatureBuffer = buildPngWithSize(width, height)
    fillFadWorkbook(
      workbook,
      buildData({
        demandeur: { nomPrenom: 'Cédric LAMOISE', date: '15/07/2026', signatureBuffer, signatureExtension: 'png' },
      }),
    )
    const sheet = workbook.getWorksheet('Modèle FAD')!
    const image = sheet.getImages().find((img) => img.range.tl.nativeRow === 36) // B37:P37 → ligne 0-based 36
    expect(image).toBeDefined()
    const ext = (image!.range as unknown as { ext: { width: number; height: number } }).ext
    expect(ext.width).toBeGreaterThan(0)
    expect(ext.height).toBeGreaterThan(0)
    // Le ratio largeur/hauteur de l'image posée doit correspondre à celui du fichier source
    // (à la précision flottante près) — un étirement pour remplir la cellule le briserait.
    expect(ext.width / ext.height).toBeCloseTo(width / height, 1)
  })

  it('lève une erreur explicite si la feuille "Modèle FAD" est absente du gabarit', async () => {
    const workbook = new ExcelJS.Workbook()
    workbook.addWorksheet('Autre feuille')
    expect(() => fillFadWorkbook(workbook, buildData())).toThrow(/Modèle FAD/)
  })
})
