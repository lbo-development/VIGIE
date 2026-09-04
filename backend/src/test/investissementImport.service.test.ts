import { describe, it, expect, vi, beforeEach } from 'vitest'
import ExcelJS from 'exceljs'

const assertManagesServiceOrHasRoleCb = vi.fn()
const findAllCug = vi.fn()
const upsertMany = vi.fn()
const findAllRowsParametre = vi.fn()
const upsertParametre = vi.fn()

vi.mock('../services/authorization.service.js', () => ({
  assertManagesServiceOrHasRoleCb: (...args: unknown[]) => assertManagesServiceOrHasRoleCb(...args),
}))
vi.mock('../repositories/cug.repository.js', () => ({
  findAll: (...args: unknown[]) => findAllCug(...args),
}))
vi.mock('../repositories/investissement.repository.js', () => ({
  upsertMany: (...args: unknown[]) => upsertMany(...args),
}))
vi.mock('../repositories/parametres.repository.js', () => ({
  findAllRows: (...args: unknown[]) => findAllRowsParametre(...args),
  upsert: (...args: unknown[]) => upsertParametre(...args),
}))

const { preview, confirm, getLastImportInfo } = await import('../services/investissementImport.service.js')

const MATRICULE = '12520'
const ID_SERVICE = 1

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
]

const REFERENCE_HEADERS_AP_CP = [
  'Fonds disponibles EUR ): Compte',
  'Fonds disponibles EUR ): Budget',
  'Fonds disponibles EUR ): Engagement',
  'Fonds disponibles EUR ): Réel',
  'Fonds disponibles EUR ):  Disponible',
]

interface OpRowSpec {
  code: string
  libelle?: string
  cug?: string
  statut?: string
  montantFc?: number
  montantTravaux?: number
}

interface KeyRowSpec {
  numop: string
  indice: string
  budget?: number
  engage?: number
  liquide?: number
  solde?: number
}

function buildKey(numop: string, indice: string): string {
  return ['T', 'T', 'T', 'T', 'T', 'T', 'T', 'T', `P${numop}.${indice}`].join('-')
}

function setHeaderRow(ws: ExcelJS.Worksheet, headers: string[]): void {
  headers.forEach((h, i) => {
    ws.getRow(1).getCell(i + 1).value = h
  })
}

async function buildWorkbookBuffer(options: {
  skipOp?: boolean
  skipAp?: boolean
  skipCp?: boolean
  headersOp?: string[]
  headersApCp?: string[]
  opRows?: OpRowSpec[]
  apRows?: KeyRowSpec[]
  cpRows?: KeyRowSpec[]
}): Promise<Buffer> {
  const workbook = new ExcelJS.Workbook()

  if (!options.skipOp) {
    const opWs = workbook.addWorksheet('OP')
    setHeaderRow(opWs, options.headersOp ?? REFERENCE_HEADERS_OP)
    const opRows = options.opRows ?? [{ code: 'VN000203' }]
    opRows.forEach((row, i) => {
      const ligne = 2 + i
      const r = opWs.getRow(ligne)
      r.getCell(8).value = row.code
      r.getCell(9).value = row.libelle ?? 'Opération test'
      r.getCell(11).value = row.cug ?? '268'
      r.getCell(12).value = row.statut ?? 'A'
      r.getCell(17).value = row.montantFc ?? 1000
      r.getCell(18).value = row.montantTravaux ?? 0
    })
  }

  if (!options.skipAp) {
    const apWs = workbook.addWorksheet('AP')
    setHeaderRow(apWs, options.headersApCp ?? REFERENCE_HEADERS_AP_CP)
    const apRows = options.apRows ?? []
    apRows.forEach((row, i) => {
      const ligne = 2 + i
      const r = apWs.getRow(ligne)
      r.getCell(1).value = buildKey(row.numop, row.indice)
      r.getCell(2).value = row.budget ?? 0
      r.getCell(3).value = row.engage ?? 0
      r.getCell(4).value = row.liquide ?? 0
      r.getCell(5).value = row.solde ?? 0
    })
  }

  if (!options.skipCp) {
    const cpWs = workbook.addWorksheet('CP')
    setHeaderRow(cpWs, options.headersApCp ?? REFERENCE_HEADERS_AP_CP)
    const cpRows = options.cpRows ?? []
    cpRows.forEach((row, i) => {
      const ligne = 2 + i
      const r = cpWs.getRow(ligne)
      r.getCell(1).value = buildKey(row.numop, row.indice)
      r.getCell(2).value = row.budget ?? 0
      r.getCell(3).value = row.engage ?? 0
      r.getCell(4).value = row.liquide ?? 0
      r.getCell(5).value = row.solde ?? 0
    })
  }

  const arrayBuffer = await workbook.xlsx.writeBuffer()
  return Buffer.from(arrayBuffer)
}

beforeEach(() => {
  assertManagesServiceOrHasRoleCb.mockReset().mockResolvedValue(undefined)
  findAllCug.mockReset().mockResolvedValue([{ code_cug: '268', libelle_cug: 'Fournitures', id_service: ID_SERVICE, actif: true }])
  upsertMany.mockReset().mockResolvedValue(undefined)
  findAllRowsParametre.mockReset().mockResolvedValue([])
  upsertParametre.mockReset().mockResolvedValue({})
})

describe('preview — étape 1 (structure)', () => {
  it('rejette si la feuille OP est absente', async () => {
    const buffer = await buildWorkbookBuffer({ skipOp: true })
    await expect(preview(MATRICULE, ID_SERVICE, buffer)).rejects.toMatchObject({ status: 400 })
  })

  it('rejette si la feuille AP est absente', async () => {
    const buffer = await buildWorkbookBuffer({ skipAp: true })
    await expect(preview(MATRICULE, ID_SERVICE, buffer)).rejects.toMatchObject({ status: 400 })
  })

  it('rejette si la feuille CP est absente', async () => {
    const buffer = await buildWorkbookBuffer({ skipCp: true })
    await expect(preview(MATRICULE, ID_SERVICE, buffer)).rejects.toMatchObject({ status: 400 })
  })

  it("rejette si la ligne d'en-têtes de OP ne correspond pas au modèle", async () => {
    const headers = [...REFERENCE_HEADERS_OP]
    headers[5] = 'Numero operation modifié'
    const buffer = await buildWorkbookBuffer({ headersOp: headers })
    await expect(preview(MATRICULE, ID_SERVICE, buffer)).rejects.toMatchObject({ status: 400 })
  })

  it("rejette si la ligne d'en-têtes de AP/CP ne correspond pas au modèle", async () => {
    const headers = [...REFERENCE_HEADERS_AP_CP]
    headers[4] = 'Fonds disponibles EUR ): Solde'
    const buffer = await buildWorkbookBuffer({ headersApCp: headers })
    await expect(preview(MATRICULE, ID_SERVICE, buffer)).rejects.toMatchObject({ status: 400 })
  })

  it('accepte un fichier structurellement conforme', async () => {
    const buffer = await buildWorkbookBuffer({})
    await expect(preview(MATRICULE, ID_SERVICE, buffer)).resolves.toBeDefined()
  })
})

describe('preview — éligibilité (statut et CUG)', () => {
  it('inclut une opération au statut A', async () => {
    const buffer = await buildWorkbookBuffer({ opRows: [{ code: 'VN000203', statut: 'A' }] })
    const result = await preview(MATRICULE, ID_SERVICE, buffer)
    expect(result.lignes.map((l) => l.numeroOperation)).toEqual(['VN000203'])
  })

  it('inclut une opération au statut F', async () => {
    const buffer = await buildWorkbookBuffer({ opRows: [{ code: 'VN000203', statut: 'F' }] })
    const result = await preview(MATRICULE, ID_SERVICE, buffer)
    expect(result.lignes.map((l) => l.numeroOperation)).toEqual(['VN000203'])
  })

  it.each(['T', 'S', 'C', 'I'])('exclut silencieusement une opération au statut %s (pas d\'anomalie)', async (statut) => {
    const buffer = await buildWorkbookBuffer({ opRows: [{ code: 'VN000203', statut }] })
    const result = await preview(MATRICULE, ID_SERVICE, buffer)
    expect(result.lignes).toEqual([])
    expect(result.anomalies).toEqual([])
  })

  it("liste une anomalie si le CUG n'est pas affecté au service cible, et exclut l'opération", async () => {
    const buffer = await buildWorkbookBuffer({
      opRows: [
        { code: 'VN000203', cug: '268' },
        { code: 'VN000204', cug: '999' },
      ],
    })
    const result = await preview(MATRICULE, ID_SERVICE, buffer)
    expect(result.anomalies).toEqual(expect.arrayContaining([expect.objectContaining({ message: expect.stringContaining('999') })]))
    expect(result.lignes.map((l) => l.numeroOperation)).toEqual(['VN000203'])
  })
})

describe('preview — agrégation AP/CP', () => {
  it('affecte AP.1, AP.8, CP.1 et CP.8 indépendamment (4 tranches)', async () => {
    const buffer = await buildWorkbookBuffer({
      opRows: [{ code: 'VN000203' }],
      apRows: [
        { numop: 'VN000203', indice: '1', solde: 10 },
        { numop: 'VN000203', indice: '8', solde: 20 },
      ],
      cpRows: [
        { numop: 'VN000203', indice: '1', solde: 30 },
        { numop: 'VN000203', indice: '8', solde: 40 },
      ],
    })
    const result = await preview(MATRICULE, ID_SERVICE, buffer)
    expect(result.lignes).toEqual([
      expect.objectContaining({ numeroOperation: 'VN000203', mtSoldeAp1: 10, mtSoldeAp8: 20, mtSoldeCp1: 30, mtSoldeCp8: 40 }),
    ])
  })

  it('somme les montants de plusieurs lignes partageant le même (numéro opération, indice)', async () => {
    const buffer = await buildWorkbookBuffer({
      opRows: [{ code: 'VN000203' }],
      apRows: [
        { numop: 'VN000203', indice: '1', solde: 10, budget: 100 },
        { numop: 'VN000203', indice: '1', solde: 5, budget: 50 },
      ],
    })
    const result = await preview(MATRICULE, ID_SERVICE, buffer)
    expect(result.lignes).toEqual([expect.objectContaining({ numeroOperation: 'VN000203', mtSoldeAp1: 15 })])
  })

  it('ignore les indices hors {1, 8} (jamais comptés, ni agrégés ni exclus)', async () => {
    const buffer = await buildWorkbookBuffer({
      opRows: [{ code: 'VN000203' }],
      apRows: [{ numop: 'VN000203', indice: '9', solde: 999 }],
    })
    const result = await preview(MATRICULE, ID_SERVICE, buffer)
    expect(result.lignes).toEqual([expect.objectContaining({ numeroOperation: 'VN000203', mtSoldeAp1: 0, mtSoldeAp8: 0 })])
    expect(result.nbExclues).toBe(0)
  })

  it("exclut silencieusement une ligne AP/CP dont le numéro d'opération ne correspond à aucune opération éligible", async () => {
    const buffer = await buildWorkbookBuffer({
      opRows: [{ code: 'VN000203' }],
      apRows: [{ numop: 'INCONNU1', indice: '1', solde: 10 }],
    })
    const result = await preview(MATRICULE, ID_SERVICE, buffer)
    expect(result.anomalies).toEqual([])
    expect(result.nbExclues).toBe(1)
  })
})

describe('confirm', () => {
  it('upserte les opérations éligibles avec les 16 montants (actif non inclus — champ manuel depuis le 04/09/2026)', async () => {
    const buffer = await buildWorkbookBuffer({
      opRows: [{ code: 'VN000203', cug: '268', statut: 'A', montantFc: 1000 }],
      apRows: [{ numop: 'VN000203', indice: '1', budget: 5, engage: 4, liquide: 3, solde: 2 }],
    })

    await confirm(MATRICULE, ID_SERVICE, buffer)

    expect(upsertMany).toHaveBeenCalledWith([
      expect.objectContaining({
        numero_operation: 'VN000203',
        id_service: ID_SERVICE,
        code_cug: '268',
        statut: 'A',
        mt_initial: 1000,
        mt_budget_ap1: 5,
        mt_engage_ap1: 4,
        mt_liquide_ap1: 3,
        mt_solde_ap1: 2,
        mt_budget_ap8: 0,
        mt_budget_cp1: 0,
        mt_budget_cp8: 0,
      }),
    ])
    const [rows] = upsertMany.mock.calls[0] as [Record<string, unknown>[]]
    expect(rows[0]).not.toHaveProperty('actif')
  })

  it('alimente mt_travaux depuis la colonne "Montant travaux" de la feuille OP', async () => {
    const buffer = await buildWorkbookBuffer({
      opRows: [{ code: 'VN000203', montantFc: 1000, montantTravaux: 700 }],
    })

    await confirm(MATRICULE, ID_SERVICE, buffer)

    expect(upsertMany).toHaveBeenCalledWith([expect.objectContaining({ mt_initial: 1000, mt_travaux: 700 })])
  })

  it("n'inclut jamais libelle_service, actif, utilisable ni mt_fesi dans la charge de l'upsert (champs manuels ou générés, jamais réécrits par un import — voir migrations 20260904100000/20260904110000/20260904120000)", async () => {
    const buffer = await buildWorkbookBuffer({ opRows: [{ code: 'VN000203' }] })

    await confirm(MATRICULE, ID_SERVICE, buffer)

    const [rows] = upsertMany.mock.calls[0] as [Record<string, unknown>[]]
    expect(rows[0]).not.toHaveProperty('libelle_service')
    expect(rows[0]).not.toHaveProperty('mt_fesi')
    expect(rows[0]).not.toHaveProperty('actif')
    expect(rows[0]).not.toHaveProperty('utilisable')
  })

  it("met à jour last.import.investissement.pgi avec la date du jour au format YYYY-MM-DD (horodatage serveur, pas une date du fichier)", async () => {
    const buffer = await buildWorkbookBuffer({ opRows: [{ code: 'VN000203' }] })

    await confirm(MATRICULE, ID_SERVICE, buffer)

    expect(upsertParametre).toHaveBeenCalledWith(
      expect.objectContaining({
        cle: 'last.import.investissement.pgi',
        valeur: expect.stringMatching(/^\d{4}-\d{2}-\d{2}$/),
        idService: ID_SERVICE,
      }),
    )
  })

  it("vérifie l'autorisation (ADMIN_APP/ADMIN_SERVICE/CB) avant tout traitement", async () => {
    assertManagesServiceOrHasRoleCb.mockRejectedValue(Object.assign(new Error('Droits insuffisants'), { status: 403 }))
    const buffer = await buildWorkbookBuffer({})

    await expect(preview(MATRICULE, ID_SERVICE, buffer)).rejects.toMatchObject({ status: 403 })
    expect(findAllCug).not.toHaveBeenCalled()
  })
})

describe('getLastImportInfo', () => {
  it("indique l'absence de ligne pour ce service (exists: false)", async () => {
    findAllRowsParametre.mockResolvedValue([])
    const info = await getLastImportInfo(MATRICULE, ID_SERVICE)
    expect(info).toEqual({ exists: false, valeur: null })
  })

  it('retourne la valeur existante pour ce service', async () => {
    findAllRowsParametre.mockResolvedValue([
      { id_parametre: 1, cle: 'last.import.investissement.pgi', valeur: '2026-09-01', id_direction: null, id_service: ID_SERVICE, description: null, date_maj: '', matricule_maj: null },
    ])
    const info = await getLastImportInfo(MATRICULE, ID_SERVICE)
    expect(info).toEqual({ exists: true, valeur: '2026-09-01' })
  })
})
