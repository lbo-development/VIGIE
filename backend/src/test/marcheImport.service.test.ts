import { describe, it, expect, vi, beforeEach } from 'vitest'
import ExcelJS from 'exceljs'

const assertManagesServiceOrHasRoleCb = vi.fn()
const findAllCug = vi.fn()
const findByCugCodes = vi.fn()
const findByNummarche = vi.fn()
const createMarche = vi.fn()
const updateMarche = vi.fn()
const archiveMany = vi.fn()
const findByNumpgi = vi.fn()
const createFournisseur = vi.fn()
const findAllRowsParametre = vi.fn()
const upsertParametre = vi.fn()

vi.mock('../services/authorization.service.js', () => ({
  assertManagesServiceOrHasRoleCb: (...args: unknown[]) => assertManagesServiceOrHasRoleCb(...args),
}))
vi.mock('../repositories/cug.repository.js', () => ({
  findAll: (...args: unknown[]) => findAllCug(...args),
}))
vi.mock('../repositories/marche.repository.js', () => ({
  findByCugCodes: (...args: unknown[]) => findByCugCodes(...args),
  findByNummarche: (...args: unknown[]) => findByNummarche(...args),
  create: (...args: unknown[]) => createMarche(...args),
  update: (...args: unknown[]) => updateMarche(...args),
  archiveMany: (...args: unknown[]) => archiveMany(...args),
}))
vi.mock('../repositories/fournisseur.repository.js', () => ({
  findByNumpgi: (...args: unknown[]) => findByNumpgi(...args),
  create: (...args: unknown[]) => createFournisseur(...args),
}))
vi.mock('../repositories/parametres.repository.js', () => ({
  findAllRows: (...args: unknown[]) => findAllRowsParametre(...args),
  upsert: (...args: unknown[]) => upsertParametre(...args),
}))

const { preview, confirm, getLastImportInfo } = await import('../services/marcheImport.service.js')

const MATRICULE = '12520'
const ID_SERVICE = 1

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
]

interface RowSpec {
  nummarche: string
  libpgi?: string
  titulaire?: string
  numTitulaire?: string
  codeCug?: string
  mtmaxi?: number
  dtefinmax?: string | null
}

async function buildWorkbookBuffer(options: {
  a1?: string
  a3?: string
  d1?: string
  headers?: string[]
  rows?: RowSpec[]
}): Promise<Buffer> {
  const workbook = new ExcelJS.Workbook()
  const ws = workbook.addWorksheet('Feuil1')

  ws.getCell('A1').value = options.a1 ?? 'Grand Port Maritime de Marseille'
  ws.getCell('D1').value = options.d1 ?? 'Edité le : 10-08-2026'
  ws.getCell('A3').value = options.a3 ?? "Récapitulatif d'un marché"

  const headers = options.headers ?? REFERENCE_HEADERS
  const headerCols = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J', 'K', 'L', 'M']
  headers.forEach((h, i) => {
    ws.getCell(`${headerCols[i]}12`).value = h
  })

  const rows = options.rows ?? [{ nummarche: 'M0909311', libpgi: 'NETTOYAGE', titulaire: 'NAID', numTitulaire: '301791', codeCug: '268' }]
  rows.forEach((row, i) => {
    const ligne = 13 + i
    ws.getCell(`A${ligne}`).value = row.nummarche
    ws.getCell(`B${ligne}`).value = row.libpgi ?? 'Libellé'
    ws.getCell(`C${ligne}`).value = row.titulaire ?? 'Titulaire'
    ws.getCell(`D${ligne}`).value = row.numTitulaire ?? '301791'
    ws.getCell(`E${ligne}`).value = row.codeCug ?? '268'
    ws.getCell(`F${ligne}`).value = 'Description CUG'
    if (row.dtefinmax !== null) {
      ws.getCell(`H${ligne}`).value = new Date(row.dtefinmax ?? '2030-01-01')
    }
    ws.getCell(`K${ligne}`).value = row.mtmaxi ?? 1000
    ws.getCell(`L${ligne}`).value = 0
    ws.getCell(`M${ligne}`).value = 500
  })

  const arrayBuffer = await workbook.xlsx.writeBuffer()
  return Buffer.from(arrayBuffer)
}

beforeEach(() => {
  assertManagesServiceOrHasRoleCb.mockReset().mockResolvedValue(undefined)
  findAllCug.mockReset().mockResolvedValue([{ code_cug: '268', libelle_cug: 'Fournitures', id_service: ID_SERVICE, actif: true }])
  findByCugCodes.mockReset().mockResolvedValue([])
  findByNummarche.mockReset().mockResolvedValue(null)
  createMarche.mockReset().mockResolvedValue({})
  updateMarche.mockReset().mockResolvedValue({})
  archiveMany.mockReset().mockResolvedValue(undefined)
  findByNumpgi.mockReset().mockResolvedValue(null)
  createFournisseur.mockReset().mockResolvedValue({ id_fournisseur: 99, raison_sociale_service: 'NAID' })
  findAllRowsParametre.mockReset().mockResolvedValue([{ id_parametre: 1, cle: 'last.import.marche.pgi', valeur: null, id_direction: null, id_service: ID_SERVICE, description: null, date_maj: '', matricule_maj: null }])
  upsertParametre.mockReset().mockResolvedValue({})
})

describe('preview — étape 1 (structure)', () => {
  it('rejette si A1 est incorrect', async () => {
    const buffer = await buildWorkbookBuffer({ a1: 'Autre organisation' })
    await expect(preview(MATRICULE, ID_SERVICE, buffer)).rejects.toMatchObject({ status: 400 })
  })

  it('rejette si A3 est incorrect', async () => {
    const buffer = await buildWorkbookBuffer({ a3: 'Autre titre' })
    await expect(preview(MATRICULE, ID_SERVICE, buffer)).rejects.toMatchObject({ status: 400 })
  })

  it("rejette si D1 ne commence pas par \"Edité le :\"", async () => {
    const buffer = await buildWorkbookBuffer({ d1: 'Généré le 10-08-2026' })
    await expect(preview(MATRICULE, ID_SERVICE, buffer)).rejects.toMatchObject({ status: 400 })
  })

  it('rejette si la date en D1 est mal formée (pas JJ-MM-AAAA)', async () => {
    const buffer = await buildWorkbookBuffer({ d1: 'Edité le : 2026-08-10' })
    await expect(preview(MATRICULE, ID_SERVICE, buffer)).rejects.toMatchObject({ status: 400 })
  })

  it("rejette si la date en D1 n'est pas une date calendaire valide", async () => {
    const buffer = await buildWorkbookBuffer({ d1: 'Edité le : 31-02-2026' })
    await expect(preview(MATRICULE, ID_SERVICE, buffer)).rejects.toMatchObject({ status: 400 })
  })

  it("rejette si la ligne d'en-têtes (ligne 12) ne correspond pas au modèle", async () => {
    const headers = [...REFERENCE_HEADERS]
    headers[0] = 'Numéro de marché modifié'
    const buffer = await buildWorkbookBuffer({ headers })
    await expect(preview(MATRICULE, ID_SERVICE, buffer)).rejects.toMatchObject({ status: 400 })
  })

  it('accepte un fichier structurellement conforme', async () => {
    const buffer = await buildWorkbookBuffer({})
    await expect(preview(MATRICULE, ID_SERVICE, buffer)).resolves.toBeDefined()
  })
})

describe('preview — étape 2 (éligibilité)', () => {
  it("rejette si le paramètre last.import.marche.pgi n'existe pas pour ce service", async () => {
    findAllRowsParametre.mockResolvedValue([])
    const buffer = await buildWorkbookBuffer({})
    await expect(preview(MATRICULE, ID_SERVICE, buffer)).rejects.toMatchObject({ status: 400 })
  })

  it('rejette si le fichier est antérieur à la dernière importation enregistrée', async () => {
    findAllRowsParametre.mockResolvedValue([
      { id_parametre: 1, cle: 'last.import.marche.pgi', valeur: '2026-08-15', id_direction: null, id_service: ID_SERVICE, description: null, date_maj: '', matricule_maj: null },
    ])
    const buffer = await buildWorkbookBuffer({ d1: 'Edité le : 10-08-2026' })
    await expect(preview(MATRICULE, ID_SERVICE, buffer)).rejects.toMatchObject({ status: 400 })
  })

  it('accepte si le fichier est postérieur ou égal à la dernière importation enregistrée', async () => {
    findAllRowsParametre.mockResolvedValue([
      { id_parametre: 1, cle: 'last.import.marche.pgi', valeur: '2026-08-10', id_direction: null, id_service: ID_SERVICE, description: null, date_maj: '', matricule_maj: null },
    ])
    const buffer = await buildWorkbookBuffer({ d1: 'Edité le : 10-08-2026' })
    await expect(preview(MATRICULE, ID_SERVICE, buffer)).resolves.toBeDefined()
  })

  it('accepte la cellule D1 même quand le PGI insère une espace insécable avant les ":"', async () => {
    // Constaté sur un export réel : "Edité le : 10-08-2026" (typographie française).
    findAllRowsParametre.mockResolvedValue([
      { id_parametre: 1, cle: 'last.import.marche.pgi', valeur: '2026-08-10', id_direction: null, id_service: ID_SERVICE, description: null, date_maj: '', matricule_maj: null },
    ])
    const buffer = await buildWorkbookBuffer({ d1: 'Edité le : 10-08-2026' })
    await expect(preview(MATRICULE, ID_SERVICE, buffer)).resolves.toBeDefined()
  })

  it("liste une anomalie par ligne si le CUG n'est pas affecté au service cible, sans bloquer les autres lignes", async () => {
    findAllCug.mockResolvedValue([{ code_cug: '268', libelle_cug: 'Fournitures', id_service: ID_SERVICE, actif: true }])
    const buffer = await buildWorkbookBuffer({
      rows: [
        { nummarche: 'M0909311', codeCug: '268' },
        { nummarche: 'M0909312', codeCug: '999' },
      ],
    })

    const result = await preview(MATRICULE, ID_SERVICE, buffer)

    expect(result.anomalies).toEqual(
      expect.arrayContaining([expect.objectContaining({ message: expect.stringContaining('999') })]),
    )
    expect(result.aCreer.map((m) => m.nummarche)).toEqual(['M0909311'])
  })

  it("exclut silencieusement (sans anomalie) une ligne dont la date de fin est antérieure à la date du fichier ou absente", async () => {
    const buffer = await buildWorkbookBuffer({
      d1: 'Edité le : 10-08-2026',
      rows: [
        { nummarche: 'M0909311', dtefinmax: '2012-04-30' },
        { nummarche: 'M0909312', dtefinmax: null },
        { nummarche: 'M0909313', dtefinmax: '2027-01-01' },
      ],
    })

    const result = await preview(MATRICULE, ID_SERVICE, buffer)

    expect(result.anomalies).toEqual([])
    expect(result.aCreer.map((m) => m.nummarche)).toEqual(['M0909313'])
  })

  it('accepte la ligne si la date de fin est égale à la date de génération du fichier', async () => {
    const buffer = await buildWorkbookBuffer({
      d1: 'Edité le : 10-08-2026',
      rows: [{ nummarche: 'M0909311', dtefinmax: '2026-08-10' }],
    })

    const result = await preview(MATRICULE, ID_SERVICE, buffer)

    expect(result.anomalies).toEqual([])
    expect(result.aCreer.map((m) => m.nummarche)).toEqual(['M0909311'])
  })

  it('liste une anomalie pour un préfixe de numéro de marché non reconnu (ni P, M ni S)', async () => {
    const buffer = await buildWorkbookBuffer({ rows: [{ nummarche: 'X2109325', codeCug: '268' }] })

    const result = await preview(MATRICULE, ID_SERVICE, buffer)

    expect(result.anomalies).toEqual(
      expect.arrayContaining([expect.objectContaining({ message: expect.stringContaining('préfixe non reconnu') })]),
    )
    expect(result.aCreer).toEqual([])
  })

  it('accepte le préfixe S (dérive TYPEPROC = MARCHE, comme M)', async () => {
    const buffer = await buildWorkbookBuffer({ rows: [{ nummarche: 'S2109325', codeCug: '268' }] })

    const result = await preview(MATRICULE, ID_SERVICE, buffer)

    expect(result.anomalies).toEqual([])
    expect(result.aCreer).toEqual([{ nummarche: 'S2109325', libelle: 'Libellé' }])
  })

  it('signale un doublon de numéro de marché (dernier gagne)', async () => {
    const buffer = await buildWorkbookBuffer({
      rows: [
        { nummarche: 'M0909311', libpgi: 'Première version' },
        { nummarche: 'M0909311', libpgi: 'Seconde version' },
      ],
    })

    const result = await preview(MATRICULE, ID_SERVICE, buffer)

    expect(result.anomalies).toEqual(expect.arrayContaining([expect.objectContaining({ message: expect.stringContaining('double') })]))
    expect(result.aCreer).toEqual([{ nummarche: 'M0909311', libelle: 'Seconde version' }])
  })
})

describe('preview — étape 3 (diff)', () => {
  it('liste en "à créer" un marché absent de la base', async () => {
    findByCugCodes.mockResolvedValue([])
    const buffer = await buildWorkbookBuffer({ rows: [{ nummarche: 'M0909311', libpgi: 'Nouveau' }] })

    const result = await preview(MATRICULE, ID_SERVICE, buffer)

    expect(result.aCreer).toEqual([{ nummarche: 'M0909311', libelle: 'Nouveau' }])
    expect(result.aArchiver).toEqual([])
  })

  it('liste en "à archiver" un marché PGI actif présent en base mais absent du fichier', async () => {
    findByCugCodes.mockResolvedValue([
      { nummarche: 'M_ANCIEN', actif: true, type_creation: 'PGI', libpgi: 'Ancien marché' },
    ])
    const buffer = await buildWorkbookBuffer({ rows: [{ nummarche: 'M0909311' }] })

    const result = await preview(MATRICULE, ID_SERVICE, buffer)

    expect(result.aArchiver).toEqual([{ nummarche: 'M_ANCIEN', libelle: 'Ancien marché' }])
  })

  it("n'archive jamais un marché créé manuellement (TYPE_CREATION != 'PGI'), même absent du fichier", async () => {
    findByCugCodes.mockResolvedValue([
      { nummarche: 'M_MANUEL', actif: true, type_creation: 'SERVICE', libpgi: 'Marché manuel' },
    ])
    const buffer = await buildWorkbookBuffer({ rows: [{ nummarche: 'M0909311' }] })

    const result = await preview(MATRICULE, ID_SERVICE, buffer)

    expect(result.aArchiver).toEqual([])
  })
})

describe('confirm — étape 4 (intégration)', () => {
  it('crée un nouveau marché avec les valeurs par défaut décidées (ACTIF=true, MTMINI=0, ALERTEMT=0.8, ALERTEDATE=120)', async () => {
    findByCugCodes.mockResolvedValue([])
    findByNumpgi.mockResolvedValue({ id_fournisseur: 5 })
    const buffer = await buildWorkbookBuffer({ rows: [{ nummarche: 'M0909311', numTitulaire: '301791' }] })

    await confirm(MATRICULE, ID_SERVICE, buffer)

    expect(createMarche).toHaveBeenCalledWith(
      expect.objectContaining({
        nummarche: 'M0909311',
        actif: true,
        type_creation: 'PGI',
        typeproc: 'MARCHE',
        mtmini: 0,
        alertemt: 0.8,
        alertedate: 120,
        id_fournisseur: 5,
      }),
    )
  })

  it('initialise LIBELLE_SERVICE avec le LIBPGI du fichier à la création', async () => {
    findByCugCodes.mockResolvedValue([])
    findByNumpgi.mockResolvedValue({ id_fournisseur: 5 })
    const buffer = await buildWorkbookBuffer({ rows: [{ nummarche: 'M0909311', libpgi: 'NETTOYAGE DES INSTALLATIONS' }] })

    await confirm(MATRICULE, ID_SERVICE, buffer)

    expect(createMarche).toHaveBeenCalledWith(
      expect.objectContaining({ libpgi: 'NETTOYAGE DES INSTALLATIONS', libelle_service: 'NETTOYAGE DES INSTALLATIONS' }),
    )
  })

  it('initialise TITULAIRE_SERVICE avec le TITULAIRE du fichier à la création', async () => {
    findByCugCodes.mockResolvedValue([])
    findByNumpgi.mockResolvedValue({ id_fournisseur: 5 })
    const buffer = await buildWorkbookBuffer({ rows: [{ nummarche: 'M0909311', titulaire: 'GSF PHOCEA' }] })

    await confirm(MATRICULE, ID_SERVICE, buffer)

    expect(createMarche).toHaveBeenCalledWith(
      expect.objectContaining({ titulaire: 'GSF PHOCEA', titulaire_service: 'GSF PHOCEA' }),
    )
  })

  it("ne réécrit que les champs A-M + DTELASTIMPORT à la modification d'un marché existant", async () => {
    findByCugCodes.mockResolvedValue([{ nummarche: 'M0909311', actif: true, type_creation: 'PGI' }])
    findByNummarche.mockResolvedValue({ nummarche: 'M0909311' })
    findByNumpgi.mockResolvedValue({ id_fournisseur: 5 })
    const buffer = await buildWorkbookBuffer({ d1: 'Edité le : 10-08-2026', rows: [{ nummarche: 'M0909311' }] })

    await confirm(MATRICULE, ID_SERVICE, buffer)

    expect(updateMarche).toHaveBeenCalledWith(
      'M0909311',
      expect.objectContaining({ actif: true, dtelastimport: '2026-08-10' }),
    )
    const updatePayload = updateMarche.mock.calls[0][1]
    expect(updatePayload).not.toHaveProperty('typeproc')
    expect(updatePayload).not.toHaveProperty('mtmini')
    expect(updatePayload).not.toHaveProperty('alertemt')
    expect(updatePayload).not.toHaveProperty('libelle_service')
    expect(updatePayload).not.toHaveProperty('titulaire_service')
  })

  it('auto-crée un FOURNISSEUR (SIREN null, TYPE_CREATION=PGI) si NUM_TITULAIRE est inconnu du service', async () => {
    findByCugCodes.mockResolvedValue([])
    findByNumpgi.mockResolvedValue(null)
    const buffer = await buildWorkbookBuffer({ rows: [{ nummarche: 'M0909311', numTitulaire: '999999', titulaire: 'NOUVEAU FOURNISSEUR' }] })

    const result = await confirm(MATRICULE, ID_SERVICE, buffer)

    expect(createFournisseur).toHaveBeenCalledWith(
      expect.objectContaining({
        numpgi: '999999',
        siren: null,
        type_creation: 'PGI',
        id_service: ID_SERVICE,
        raison_sociale_pgi: 'NOUVEAU FOURNISSEUR',
        raison_sociale_service: 'NOUVEAU FOURNISSEUR',
      }),
    )
    expect(result.fournisseursAjoutes).toEqual([{ numpgi: '999999', raisonSociale: 'NAID' }])
  })

  it('archive les marchés PGI absents du fichier et met à jour last.import.marche.pgi', async () => {
    findByCugCodes.mockResolvedValue([{ nummarche: 'M_ANCIEN', actif: true, type_creation: 'PGI', libpgi: 'Ancien' }])
    const buffer = await buildWorkbookBuffer({ d1: 'Edité le : 10-08-2026', rows: [{ nummarche: 'M0909311' }] })

    await confirm(MATRICULE, ID_SERVICE, buffer)

    expect(archiveMany).toHaveBeenCalledWith(['M_ANCIEN'])
    expect(upsertParametre).toHaveBeenCalledWith(
      expect.objectContaining({ cle: 'last.import.marche.pgi', valeur: '2026-08-10', idService: ID_SERVICE }),
    )
  })

  it("vérifie l'autorisation (ADMIN_APP/ADMIN_SERVICE/CB) avant tout traitement", async () => {
    assertManagesServiceOrHasRoleCb.mockRejectedValue(Object.assign(new Error('Droits insuffisants'), { status: 403 }))
    const buffer = await buildWorkbookBuffer({})

    await expect(preview(MATRICULE, ID_SERVICE, buffer)).rejects.toMatchObject({ status: 403 })
    expect(findAllRowsParametre).not.toHaveBeenCalled()
  })
})

describe('getLastImportInfo', () => {
  it("indique l'absence de ligne pour ce service (exists: false)", async () => {
    findAllRowsParametre.mockResolvedValue([])

    const info = await getLastImportInfo(MATRICULE, ID_SERVICE)

    expect(info).toEqual({ exists: false, valeur: null })
  })

  it('retourne la date enregistrée pour ce service', async () => {
    findAllRowsParametre.mockResolvedValue([
      { id_parametre: 1, cle: 'last.import.marche.pgi', valeur: '2026-08-10', id_direction: null, id_service: ID_SERVICE, description: null, date_maj: '', matricule_maj: null },
    ])

    const info = await getLastImportInfo(MATRICULE, ID_SERVICE)

    expect(info).toEqual({ exists: true, valeur: '2026-08-10' })
  })

  it('retourne exists: true, valeur: null si la ligne existe mais est vide', async () => {
    findAllRowsParametre.mockResolvedValue([
      { id_parametre: 1, cle: 'last.import.marche.pgi', valeur: null, id_direction: null, id_service: ID_SERVICE, description: null, date_maj: '', matricule_maj: null },
    ])

    const info = await getLastImportInfo(MATRICULE, ID_SERVICE)

    expect(info).toEqual({ exists: true, valeur: null })
  })

  it("vérifie l'autorisation avant de lire le paramètre", async () => {
    assertManagesServiceOrHasRoleCb.mockRejectedValue(Object.assign(new Error('Droits insuffisants'), { status: 403 }))

    await expect(getLastImportInfo(MATRICULE, ID_SERVICE)).rejects.toMatchObject({ status: 403 })
    expect(findAllRowsParametre).not.toHaveBeenCalled()
  })
})
