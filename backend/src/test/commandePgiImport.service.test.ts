import { describe, it, expect, vi, beforeEach } from 'vitest'
import ExcelJS from 'exceljs'

const assertManagesServiceOrHasRoleCb = vi.fn()
const findAllCug = vi.fn()
const deleteByService = vi.fn()
const insertMany = vi.fn()
const findAllRowsParametre = vi.fn()
const upsertParametre = vi.fn()

vi.mock('../services/authorization.service.js', () => ({
  assertManagesServiceOrHasRoleCb: (...args: unknown[]) => assertManagesServiceOrHasRoleCb(...args),
}))
vi.mock('../repositories/cug.repository.js', () => ({
  findAll: (...args: unknown[]) => findAllCug(...args),
}))
vi.mock('../repositories/commandePgi.repository.js', () => ({
  deleteByService: (...args: unknown[]) => deleteByService(...args),
  insertMany: (...args: unknown[]) => insertMany(...args),
}))
vi.mock('../repositories/parametres.repository.js', () => ({
  findAllRows: (...args: unknown[]) => findAllRowsParametre(...args),
  upsert: (...args: unknown[]) => upsertParametre(...args),
}))

const { preview, confirm, getLastImportInfo } = await import('../services/commandePgiImport.service.js')

const MATRICULE = '12520'
const ID_SERVICE = 1

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
]
const HEADER_COLUMNS = [
  'A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J', 'K', 'L', 'M', 'N', 'O', 'P', 'Q', 'R', 'S', 'T',
  'U', 'V', 'W', 'X', 'Y', 'Z', 'AA', 'AB', 'AC', 'AD', 'AE', 'AF', 'AG', 'AH', 'AI', 'AJ', 'AK', 'AL',
]

interface RowSpec {
  numcmd: string
  codeCug?: string
  acheteur?: string
  commandeAnnulee?: string
  ligneAnnulee?: string
  libelle?: string
  dtecmd?: Date
  compteBudgetaire?: number
  catop?: string
  libfournisseur?: string
  marche?: string
  mtactuel?: number
  mtengage?: number
  mtliquide?: number
}

async function buildWorkbookBuffer(options: {
  a3?: string
  z1?: string
  aa1?: string
  headers?: string[]
  rows?: RowSpec[]
}): Promise<Buffer> {
  const workbook = new ExcelJS.Workbook()
  const ws = workbook.addWorksheet('Feuil1')

  ws.getCell('A3').value = options.a3 ?? 'Liste des lignes de commandes par ligne budgétaire'
  ws.getCell('Z1').value = options.z1 ?? 'Edité le '
  ws.getCell('AA1').value = options.aa1 ?? ': 03/09/2026'

  const headers = options.headers ?? REFERENCE_HEADERS
  headers.forEach((h, i) => {
    ws.getCell(`${HEADER_COLUMNS[i]}13`).value = h
  })

  const rows = options.rows ?? [{ numcmd: 'P2500929-21' }]
  rows.forEach((row, i) => {
    const ligne = 14 + i
    ws.getCell(`E${ligne}`).value = row.codeCug ?? '268'
    ws.getCell(`F${ligne}`).value = row.acheteur ?? 'ACHETEUR TEST'
    ws.getCell(`G${ligne}`).value = row.numcmd
    ws.getCell(`J${ligne}`).value = row.commandeAnnulee ?? 'N'
    ws.getCell(`K${ligne}`).value = row.ligneAnnulee ?? 'N'
    ws.getCell(`L${ligne}`).value = row.libelle ?? 'Libellé test'
    ws.getCell(`N${ligne}`).value = row.dtecmd ?? new Date('2026-01-01')
    ws.getCell(`T${ligne}`).value = row.compteBudgetaire ?? 231
    ws.getCell(`W${ligne}`).value = row.catop ?? 'SU'
    ws.getCell(`Y${ligne}`).value = row.libfournisseur ?? 'FOURNISSEUR TEST'
    ws.getCell(`Z${ligne}`).value = row.marche ?? 'M0000001'
    ws.getCell(`AD${ligne}`).value = row.mtactuel ?? 100
    ws.getCell(`AG${ligne}`).value = row.mtengage ?? 100
    ws.getCell(`AH${ligne}`).value = row.mtliquide ?? 0
  })

  const arrayBuffer = await workbook.xlsx.writeBuffer()
  return Buffer.from(arrayBuffer)
}

beforeEach(() => {
  assertManagesServiceOrHasRoleCb.mockReset().mockResolvedValue(undefined)
  findAllCug.mockReset().mockResolvedValue([{ code_cug: '268', libelle_cug: 'Fournitures', id_service: ID_SERVICE, actif: true }])
  deleteByService.mockReset().mockResolvedValue(undefined)
  insertMany.mockReset().mockResolvedValue(undefined)
  findAllRowsParametre.mockReset().mockResolvedValue([
    { id_parametre: 1, cle: 'last.import.commande.pgi', valeur: null, id_direction: null, id_service: ID_SERVICE, description: null, date_maj: '', matricule_maj: null },
  ])
  upsertParametre.mockReset().mockResolvedValue({})
})

describe('preview — étape 1 (structure)', () => {
  it('rejette si A3 est incorrect', async () => {
    const buffer = await buildWorkbookBuffer({ a3: 'Autre titre' })
    await expect(preview(MATRICULE, ID_SERVICE, buffer)).rejects.toMatchObject({ status: 400 })
  })

  it('rejette si Z1 est incorrect', async () => {
    const buffer = await buildWorkbookBuffer({ z1: 'Généré le' })
    await expect(preview(MATRICULE, ID_SERVICE, buffer)).rejects.toMatchObject({ status: 400 })
  })

  it("rejette si la date en AA1 n'est pas au format JJ/MM/AAAA", async () => {
    const buffer = await buildWorkbookBuffer({ aa1: ': 2026-09-03' })
    await expect(preview(MATRICULE, ID_SERVICE, buffer)).rejects.toMatchObject({ status: 400 })
  })

  it("rejette si la date en AA1 n'est pas une date calendaire valide", async () => {
    const buffer = await buildWorkbookBuffer({ aa1: ': 31/02/2026' })
    await expect(preview(MATRICULE, ID_SERVICE, buffer)).rejects.toMatchObject({ status: 400 })
  })

  it("rejette si la ligne d'en-têtes (ligne 13) ne correspond pas au modèle", async () => {
    const headers = [...REFERENCE_HEADERS]
    headers[0] = 'Exercice Budgétaire modifié'
    const buffer = await buildWorkbookBuffer({ headers })
    await expect(preview(MATRICULE, ID_SERVICE, buffer)).rejects.toMatchObject({ status: 400 })
  })

  it('accepte un fichier structurellement conforme', async () => {
    const buffer = await buildWorkbookBuffer({})
    await expect(preview(MATRICULE, ID_SERVICE, buffer)).resolves.toBeDefined()
  })
})

describe('preview — étape 2 (éligibilité)', () => {
  it("rejette si le paramètre last.import.commande.pgi n'existe pas pour ce service", async () => {
    findAllRowsParametre.mockResolvedValue([])
    const buffer = await buildWorkbookBuffer({})
    await expect(preview(MATRICULE, ID_SERVICE, buffer)).rejects.toMatchObject({ status: 400 })
  })

  it('rejette si le fichier est antérieur à la dernière importation enregistrée', async () => {
    findAllRowsParametre.mockResolvedValue([
      { id_parametre: 1, cle: 'last.import.commande.pgi', valeur: '2026-09-10', id_direction: null, id_service: ID_SERVICE, description: null, date_maj: '', matricule_maj: null },
    ])
    const buffer = await buildWorkbookBuffer({ aa1: ': 03/09/2026' })
    await expect(preview(MATRICULE, ID_SERVICE, buffer)).rejects.toMatchObject({ status: 400 })
  })

  it('accepte si le fichier est postérieur ou égal à la dernière importation enregistrée', async () => {
    findAllRowsParametre.mockResolvedValue([
      { id_parametre: 1, cle: 'last.import.commande.pgi', valeur: '2026-09-03', id_direction: null, id_service: ID_SERVICE, description: null, date_maj: '', matricule_maj: null },
    ])
    const buffer = await buildWorkbookBuffer({ aa1: ': 03/09/2026' })
    await expect(preview(MATRICULE, ID_SERVICE, buffer)).resolves.toBeDefined()
  })
})

describe('preview — contrôle CUG et exclusions', () => {
  it("liste une anomalie par ligne si le CUG n'est pas affecté au service cible, sans bloquer les autres lignes", async () => {
    const buffer = await buildWorkbookBuffer({
      rows: [
        { numcmd: 'P100', codeCug: '268' },
        { numcmd: 'P101', codeCug: '999' },
      ],
    })

    const result = await preview(MATRICULE, ID_SERVICE, buffer)

    expect(result.anomalies).toEqual(expect.arrayContaining([expect.objectContaining({ message: expect.stringContaining('999') })]))
    expect(result.lignes.map((l) => l.numcmd)).toEqual(['P100'])
  })

  it('exclut silencieusement (sans anomalie) une commande annulée', async () => {
    const buffer = await buildWorkbookBuffer({ rows: [{ numcmd: 'P100', commandeAnnulee: 'O' }] })
    const result = await preview(MATRICULE, ID_SERVICE, buffer)
    expect(result.anomalies).toEqual([])
    expect(result.lignes).toEqual([])
    expect(result.nbExclues).toBe(1)
  })

  it('exclut silencieusement une ligne annulée', async () => {
    const buffer = await buildWorkbookBuffer({ rows: [{ numcmd: 'P100', ligneAnnulee: 'O' }] })
    const result = await preview(MATRICULE, ID_SERVICE, buffer)
    expect(result.anomalies).toEqual([])
    expect(result.lignes).toEqual([])
    expect(result.nbExclues).toBe(1)
  })

  it.each(['ESTIMATION REVISION DE PRIX', 'facturer le client', 'Devis en revision'])(
    'exclut silencieusement un libellé contenant FACTURER/ESTIMATION/REVISION (%s)',
    async (libelle) => {
      const buffer = await buildWorkbookBuffer({ rows: [{ numcmd: 'P100', libelle }] })
      const result = await preview(MATRICULE, ID_SERVICE, buffer)
      expect(result.anomalies).toEqual([])
      expect(result.lignes).toEqual([])
      expect(result.nbExclues).toBe(1)
    },
  )
})

describe('preview — agrégation par NUMCMD', () => {
  it('somme MTACTUEL/MTENGAGE/MTLIQUIDE des lignes valides partageant le même NUMCMD', async () => {
    const buffer = await buildWorkbookBuffer({
      rows: [
        { numcmd: 'P100', mtactuel: 30, mtengage: 30, mtliquide: 0 },
        { numcmd: 'P100', mtactuel: 22, mtengage: 22, mtliquide: 22 },
      ],
    })

    const result = await preview(MATRICULE, ID_SERVICE, buffer)

    expect(result.lignes).toEqual([{ numcmd: 'P100', libfournisseur: 'FOURNISSEUR TEST', mtactuel: 52, mtengage: 52, mtliquide: 22 }])
  })

  it('prend les champs non cumulés sur la ligne au MTACTUEL le plus élevé (cas Compte Budgétaire divergent)', async () => {
    const buffer = await buildWorkbookBuffer({
      rows: [
        { numcmd: 'P100', mtactuel: 500, compteBudgetaire: 613, libfournisseur: 'LOCATION' },
        { numcmd: 'P100', mtactuel: 1200, compteBudgetaire: 615, libfournisseur: 'MAINTENANCE' },
      ],
    })

    const result = await preview(MATRICULE, ID_SERVICE, buffer)

    expect(result.lignes).toEqual([{ numcmd: 'P100', libfournisseur: 'MAINTENANCE', mtactuel: 1700, mtengage: 200, mtliquide: 0 }])
  })
})

describe('preview — colonne Marché', () => {
  it('remplace un Marché vide par "HM" (Hors Marché)', async () => {
    const buffer = await buildWorkbookBuffer({ rows: [{ numcmd: 'P100', marche: '' }] })

    await confirm(MATRICULE, ID_SERVICE, buffer)

    expect(insertMany).toHaveBeenCalledWith([expect.objectContaining({ numcmd: 'P100', marche: 'HM' })])
  })

  it('conserve la valeur du fichier quand le Marché est renseigné', async () => {
    const buffer = await buildWorkbookBuffer({ rows: [{ numcmd: 'P100', marche: 'P2500929' }] })

    await confirm(MATRICULE, ID_SERVICE, buffer)

    expect(insertMany).toHaveBeenCalledWith([expect.objectContaining({ numcmd: 'P100', marche: 'P2500929' })])
  })
})

describe('confirm — annule et remplace', () => {
  it('supprime les lignes existantes du service puis réinsère les commandes agrégées', async () => {
    const buffer = await buildWorkbookBuffer({
      aa1: ': 03/09/2026',
      rows: [{ numcmd: 'P100', codeCug: '268', mtactuel: 100, mtengage: 100, mtliquide: 0 }],
    })

    await confirm(MATRICULE, ID_SERVICE, buffer)

    expect(deleteByService).toHaveBeenCalledWith(ID_SERVICE)
    expect(insertMany).toHaveBeenCalledWith([
      expect.objectContaining({
        numcmd: 'P100',
        code_cug: '268',
        id_service: ID_SERVICE,
        mtactuel: 100,
        mtengage: 100,
        mtliquide: 0,
        dtelastimport: '2026-09-03',
      }),
    ])
  })

  it('met à jour last.import.commande.pgi avec la date du fichier', async () => {
    const buffer = await buildWorkbookBuffer({ aa1: ': 03/09/2026', rows: [{ numcmd: 'P100' }] })

    await confirm(MATRICULE, ID_SERVICE, buffer)

    expect(upsertParametre).toHaveBeenCalledWith(
      expect.objectContaining({ cle: 'last.import.commande.pgi', valeur: '2026-09-03', idService: ID_SERVICE }),
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
      { id_parametre: 1, cle: 'last.import.commande.pgi', valeur: '2026-09-03', id_direction: null, id_service: ID_SERVICE, description: null, date_maj: '', matricule_maj: null },
    ])
    const info = await getLastImportInfo(MATRICULE, ID_SERVICE)
    expect(info).toEqual({ exists: true, valeur: '2026-09-03' })
  })

  it("vérifie l'autorisation avant de lire le paramètre", async () => {
    assertManagesServiceOrHasRoleCb.mockRejectedValue(Object.assign(new Error('Droits insuffisants'), { status: 403 }))
    await expect(getLastImportInfo(MATRICULE, ID_SERVICE)).rejects.toMatchObject({ status: 403 })
    expect(findAllRowsParametre).not.toHaveBeenCalled()
  })
})
