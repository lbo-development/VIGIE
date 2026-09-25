import { describe, it, expect, vi, beforeEach } from 'vitest'

const createBrouillon = vi.fn()
const findById = vi.fn()
const findAllByDemandeAchat = vi.fn()
const findAllByDemandeAchatIn = vi.fn()
const update = vi.fn()
const remove = vi.fn()

vi.mock('../repositories/certificatServiceFait.repository.js', () => ({
  createBrouillon: (...args: unknown[]) => createBrouillon(...args),
  findById: (...args: unknown[]) => findById(...args),
  findAllByDemandeAchat: (...args: unknown[]) => findAllByDemandeAchat(...args),
  findAllByDemandeAchatIn: (...args: unknown[]) => findAllByDemandeAchatIn(...args),
  update: (...args: unknown[]) => update(...args),
  remove: (...args: unknown[]) => remove(...args),
}))

const historiqueCreate = vi.fn()
const historiqueFindAllByCsf = vi.fn()
const historiqueDeleteAllByCsf = vi.fn()

vi.mock('../repositories/historiqueStatutCsf.repository.js', () => ({
  create: (...args: unknown[]) => historiqueCreate(...args),
  findAllByCsf: (...args: unknown[]) => historiqueFindAllByCsf(...args),
  deleteAllByCsf: (...args: unknown[]) => historiqueDeleteAllByCsf(...args),
}))

const pieceFindAllByCsf = vi.fn()
const pieceFindByIdCsf = vi.fn()
const pieceCreateForCsf = vi.fn()
const pieceRemove = vi.fn()
const pieceUploadFile = vi.fn()
const pieceDownloadFile = vi.fn()
const pieceRemoveFile = vi.fn()
const pieceBuildStoragePathCsf = vi.fn()

vi.mock('../repositories/pieceJointe.repository.js', () => ({
  findAllByCsf: (...args: unknown[]) => pieceFindAllByCsf(...args),
  findByIdCsf: (...args: unknown[]) => pieceFindByIdCsf(...args),
  createForCsf: (...args: unknown[]) => pieceCreateForCsf(...args),
  remove: (...args: unknown[]) => pieceRemove(...args),
  uploadFile: (...args: unknown[]) => pieceUploadFile(...args),
  downloadFile: (...args: unknown[]) => pieceDownloadFile(...args),
  removeFile: (...args: unknown[]) => pieceRemoveFile(...args),
  buildStoragePathCsf: (...args: unknown[]) => pieceBuildStoragePathCsf(...args),
}))

const demandeAchatFindById = vi.fn()
const demandeAchatFindAll = vi.fn()

vi.mock('../repositories/demandeAchat.repository.js', () => ({
  findById: (...args: unknown[]) => demandeAchatFindById(...args),
  findAll: (...args: unknown[]) => demandeAchatFindAll(...args),
}))

const acteurFindByMatricule = vi.fn()
const acteurFindByMatricules = vi.fn()
const acteurFindAllByCellule = vi.fn()

vi.mock('../repositories/acteur.repository.js', () => ({
  findByMatricule: (...args: unknown[]) => acteurFindByMatricule(...args),
  findByMatricules: (...args: unknown[]) => acteurFindByMatricules(...args),
  findAllByCellule: (...args: unknown[]) => acteurFindAllByCellule(...args),
}))

const hasActiveRole = vi.fn()

vi.mock('../repositories/auth.repository.js', () => ({
  hasActiveRole: (...args: unknown[]) => hasActiveRole(...args),
}))

const assertHasEffectiveRole = vi.fn()
const findEffectiveRolesMock = vi.fn()

vi.mock('../services/roleEffectif.service.js', () => ({
  assertHasEffectiveRole: (...args: unknown[]) => assertHasEffectiveRole(...args),
  findEffectiveRoles: (...args: unknown[]) => findEffectiveRolesMock(...args),
  lectureSeuleMessage: (typeRole: string) => `Votre rôle ${typeRole} est en lecture seule`,
}))

const {
  createCertificatServiceFait,
  getCertificatServiceFait,
  listCertificatsServiceFait,
  updateBrouillon,
  transmettreRc,
  editerEnPlaceRc,
  transmettreBudget,
  demanderComplementRc,
  retransmettreBudget,
  validerBudget,
  demanderComplementBudget,
  constaterLiquidation,
  supprimer,
  listPieces,
  addPiece,
  removePiece,
  getSyntheseFacturationDemandeur,
  getSyntheseFacturationRc,
  getSyntheseFacturationCb,
} = await import('../services/certificatServiceFait.service.js')

const DEMANDEUR = '000100'
const RC = '000200'
const CB = '000300'
const AUTRE = '000900'
const ID_DEMANDE_ACHAT = 1
const ID_SERVICE = 10
const ID_CELLULE = 20
const ID_CSF = 42

const FAD_COMMANDEE = {
  id_demande_achat: ID_DEMANDE_ACHAT,
  matricule_demandeur: DEMANDEUR,
  id_service: ID_SERVICE,
  code_statut: 'FAD_COMMANDEE',
  montant_commande: 1000,
}

const DEMANDEUR_ACTEUR = { matricule: DEMANDEUR, id_cellule: ID_CELLULE }

const CSF_EN_PREPARATION = {
  id_csf: ID_CSF,
  numero_csf: '2026-09-24-001-C01',
  id_demande_achat: ID_DEMANDE_ACHAT,
  matricule_redacteur: DEMANDEUR,
  code_statut_csf: 'CSF_EN_PREPARATION',
  montant_csf: null,
  date_service_fait: null,
  description: null,
}

/** Rôle RC effectif (titulaire, non suppléé) sur ID_CELLULE. */
const ROLE_RC = { idRole: 1, typeRole: 'RC', idCellule: ID_CELLULE, idService: null, idDirection: null, idSuppleance: null, lectureSeule: false }
/** Rôle CB effectif (titulaire, non suppléé) sur ID_SERVICE. */
const ROLE_CB = { idRole: 2, typeRole: 'CB', idCellule: null, idService: ID_SERVICE, idDirection: null, idSuppleance: null, lectureSeule: false }

beforeEach(() => {
  createBrouillon.mockReset()
  findById.mockReset()
  findAllByDemandeAchat.mockReset().mockResolvedValue([])
  findAllByDemandeAchatIn.mockReset().mockResolvedValue([])
  update.mockReset()
  remove.mockReset()
  historiqueCreate.mockReset()
  historiqueFindAllByCsf.mockReset().mockResolvedValue([])
  historiqueDeleteAllByCsf.mockReset()
  pieceFindAllByCsf.mockReset().mockResolvedValue([])
  pieceFindByIdCsf.mockReset()
  pieceCreateForCsf.mockReset()
  pieceRemove.mockReset()
  pieceUploadFile.mockReset()
  pieceDownloadFile.mockReset()
  pieceRemoveFile.mockReset().mockResolvedValue(undefined)
  pieceBuildStoragePathCsf.mockReset().mockReturnValue('csf/42/uuid.pdf')
  demandeAchatFindById.mockReset()
  demandeAchatFindAll.mockReset().mockResolvedValue([])
  acteurFindByMatricule.mockReset()
  acteurFindByMatricules.mockReset().mockResolvedValue([])
  acteurFindAllByCellule.mockReset().mockResolvedValue([])
  hasActiveRole.mockReset().mockResolvedValue(false)
  assertHasEffectiveRole.mockReset()
  findEffectiveRolesMock.mockReset().mockResolvedValue([])

  demandeAchatFindById.mockResolvedValue(FAD_COMMANDEE)
  acteurFindByMatricule.mockResolvedValue(DEMANDEUR_ACTEUR)
  findById.mockResolvedValue(CSF_EN_PREPARATION)
})

describe('createCertificatServiceFait (OP2.1)', () => {
  it('rejette sans authentification (401)', async () => {
    await expect(createCertificatServiceFait(null, ID_DEMANDE_ACHAT)).rejects.toMatchObject({ status: 401 })
  })

  it('rejette si la FAD n\'est pas FAD_COMMANDEE (R1, 409)', async () => {
    demandeAchatFindById.mockResolvedValue({ ...FAD_COMMANDEE, code_statut: 'FAD_A_COMMANDER' })
    await expect(createCertificatServiceFait(DEMANDEUR, ID_DEMANDE_ACHAT)).rejects.toMatchObject({ status: 409 })
    expect(createBrouillon).not.toHaveBeenCalled()
  })

  it('le demandeur initial peut créer le CSF', async () => {
    createBrouillon.mockResolvedValue(CSF_EN_PREPARATION)
    const result = await createCertificatServiceFait(DEMANDEUR, ID_DEMANDE_ACHAT)
    expect(result).toBe(CSF_EN_PREPARATION)
    expect(createBrouillon).toHaveBeenCalledWith(ID_DEMANDE_ACHAT, DEMANDEUR)
  })

  it('un RC actif de la cellule du demandeur peut créer le CSF (R3/D4)', async () => {
    findEffectiveRolesMock.mockResolvedValue([ROLE_RC])
    createBrouillon.mockResolvedValue(CSF_EN_PREPARATION)
    await createCertificatServiceFait(RC, ID_DEMANDE_ACHAT)
    expect(createBrouillon).toHaveBeenCalledWith(ID_DEMANDE_ACHAT, RC)
  })

  it('un tiers sans rôle sur la cellule ne peut pas créer le CSF (403)', async () => {
    findEffectiveRolesMock.mockResolvedValue([])
    await expect(createCertificatServiceFait(AUTRE, ID_DEMANDE_ACHAT)).rejects.toMatchObject({ status: 403 })
    expect(createBrouillon).not.toHaveBeenCalled()
  })

  it('ADMIN_APP peut créer le CSF pour n\'importe quelle FAD commandée', async () => {
    hasActiveRole.mockResolvedValue(true)
    createBrouillon.mockResolvedValue(CSF_EN_PREPARATION)
    await createCertificatServiceFait(AUTRE, ID_DEMANDE_ACHAT)
    expect(createBrouillon).toHaveBeenCalled()
  })
})

describe('getCertificatServiceFait / listCertificatsServiceFait (lecture)', () => {
  it('rejette un tiers sans lien avec le CSF (403)', async () => {
    findEffectiveRolesMock.mockResolvedValue([])
    await expect(getCertificatServiceFait(AUTRE, ID_CSF)).rejects.toMatchObject({ status: 403 })
  })

  it('le rédacteur peut consulter son CSF', async () => {
    const result = await getCertificatServiceFait(DEMANDEUR, ID_CSF)
    expect(result).toBe(CSF_EN_PREPARATION)
  })

  it('un CB du service de la FAD peut consulter le CSF', async () => {
    findEffectiveRolesMock.mockResolvedValue([ROLE_CB])
    const result = await getCertificatServiceFait(CB, ID_CSF)
    expect(result).toBe(CSF_EN_PREPARATION)
  })

  it('liste les CSF d\'une FAD pour un acteur autorisé', async () => {
    findAllByDemandeAchat.mockResolvedValue([CSF_EN_PREPARATION])
    const result = await listCertificatsServiceFait(DEMANDEUR, ID_DEMANDE_ACHAT)
    expect(result).toEqual([CSF_EN_PREPARATION])
  })
})

describe('updateBrouillon (édition rédacteur)', () => {
  it('rejette une fois transmis (409)', async () => {
    findById.mockResolvedValue({ ...CSF_EN_PREPARATION, code_statut_csf: 'CSF_TRANSMIS_BUDGET' })
    await expect(updateBrouillon(DEMANDEUR, ID_CSF, { montantCsf: 100 })).rejects.toMatchObject({ status: 409 })
    expect(update).not.toHaveBeenCalled()
  })

  it('le rédacteur peut modifier le montant en CSF_EN_PREPARATION', async () => {
    update.mockResolvedValue({ ...CSF_EN_PREPARATION, montant_csf: 150 })
    await updateBrouillon(DEMANDEUR, ID_CSF, { montantCsf: 150 })
    expect(update).toHaveBeenCalledWith(ID_CSF, { date_service_fait: null, montant_csf: 150, description: null })
  })

  it('rejette un tiers qui n\'est ni le demandeur ni un RC de la cellule (403)', async () => {
    findEffectiveRolesMock.mockResolvedValue([])
    await expect(updateBrouillon(AUTRE, ID_CSF, { montantCsf: 150 })).rejects.toMatchObject({ status: 403 })
  })
})

describe('transmettreRc (R5 — justificatif requis)', () => {
  it('rejette sans aucun justificatif (400)', async () => {
    pieceFindAllByCsf.mockResolvedValue([])
    await expect(transmettreRc(DEMANDEUR, ID_CSF)).rejects.toMatchObject({ status: 400 })
    expect(historiqueCreate).not.toHaveBeenCalled()
  })

  it('transmet vers CSF_A_TRAITER avec au moins un justificatif', async () => {
    pieceFindAllByCsf.mockResolvedValue([{ id_piece: 1 }])
    historiqueCreate.mockResolvedValue({})
    await transmettreRc(DEMANDEUR, ID_CSF)
    expect(historiqueCreate).toHaveBeenCalledWith(
      expect.objectContaining({ id_csf: ID_CSF, code_statut_csf: 'CSF_A_TRAITER', matricule_acteur: DEMANDEUR }),
    )
  })

  it('fonctionne aussi en resoumission depuis CSF_A_COMPLETER_RC', async () => {
    findById.mockResolvedValue({ ...CSF_EN_PREPARATION, code_statut_csf: 'CSF_A_COMPLETER_RC' })
    pieceFindAllByCsf.mockResolvedValue([{ id_piece: 1 }])
    historiqueCreate.mockResolvedValue({})
    await transmettreRc(DEMANDEUR, ID_CSF)
    expect(historiqueCreate).toHaveBeenCalled()
  })

  it('rejette depuis CSF_A_TRAITER (déjà transmis, 409)', async () => {
    findById.mockResolvedValue({ ...CSF_EN_PREPARATION, code_statut_csf: 'CSF_A_TRAITER' })
    await expect(transmettreRc(DEMANDEUR, ID_CSF)).rejects.toMatchObject({ status: 409 })
  })

  it('reprise CSF_A_COMPLETER_RC — transmet la réponse libre au motif du RC dans COMMENTAIRE_STATUT', async () => {
    findById.mockResolvedValue({ ...CSF_EN_PREPARATION, code_statut_csf: 'CSF_A_COMPLETER_RC' })
    pieceFindAllByCsf.mockResolvedValue([{ id_piece: 1 }])
    historiqueCreate.mockResolvedValue({})
    await transmettreRc(DEMANDEUR, ID_CSF, { commentaire: 'Voici le complément demandé.' })
    expect(historiqueCreate).toHaveBeenCalledWith(expect.objectContaining({ commentaire_statut: 'Voici le complément demandé.' }))
  })

  it('sans réponse fournie, COMMENTAIRE_STATUT reste null (réponse facultative)', async () => {
    findById.mockResolvedValue({ ...CSF_EN_PREPARATION, code_statut_csf: 'CSF_A_COMPLETER_RC' })
    pieceFindAllByCsf.mockResolvedValue([{ id_piece: 1 }])
    historiqueCreate.mockResolvedValue({})
    await transmettreRc(DEMANDEUR, ID_CSF)
    expect(historiqueCreate).toHaveBeenCalledWith(expect.objectContaining({ commentaire_statut: null }))
  })
})

describe('editerEnPlaceRc (édition en place, sans changement de statut)', () => {
  it('rejette hors CSF_A_TRAITER (409)', async () => {
    await expect(editerEnPlaceRc(RC, ID_CSF, { montantCsf: 200 })).rejects.toMatchObject({ status: 409 })
  })

  it('le RC édite le montant sans écrire d\'historique', async () => {
    findById.mockResolvedValue({ ...CSF_EN_PREPARATION, code_statut_csf: 'CSF_A_TRAITER' })
    findEffectiveRolesMock.mockResolvedValue([ROLE_RC])
    assertHasEffectiveRole.mockResolvedValue(ROLE_RC)
    update.mockResolvedValue({})
    await editerEnPlaceRc(RC, ID_CSF, { montantCsf: 200 })
    expect(update).toHaveBeenCalledWith(ID_CSF, { date_service_fait: null, montant_csf: 200, description: null })
    expect(historiqueCreate).not.toHaveBeenCalled()
  })

  it('rejette le rédacteur (non-RC) qui tenterait d\'éditer à ce stade (403)', async () => {
    findById.mockResolvedValue({ ...CSF_EN_PREPARATION, code_statut_csf: 'CSF_A_TRAITER' })
    assertHasEffectiveRole.mockRejectedValue(Object.assign(new Error('Droits insuffisants'), { status: 403 }))
    await expect(editerEnPlaceRc(DEMANDEUR, ID_CSF, { montantCsf: 200 })).rejects.toMatchObject({ status: 403 })
  })
})

describe('transmettreBudget / demanderComplementRc (RC, depuis CSF_A_TRAITER)', () => {
  beforeEach(() => {
    findById.mockResolvedValue({ ...CSF_EN_PREPARATION, code_statut_csf: 'CSF_A_TRAITER' })
    assertHasEffectiveRole.mockResolvedValue(ROLE_RC)
  })

  it('transmet vers CSF_TRANSMIS_BUDGET', async () => {
    historiqueCreate.mockResolvedValue({})
    await transmettreBudget(RC, ID_CSF)
    expect(historiqueCreate).toHaveBeenCalledWith(expect.objectContaining({ code_statut_csf: 'CSF_TRANSMIS_BUDGET' }))
  })

  it('demande un complément avec motif obligatoire (400 si vide)', async () => {
    await expect(demanderComplementRc(RC, ID_CSF, { commentaire: '' })).rejects.toMatchObject({ status: 400 })
    expect(historiqueCreate).not.toHaveBeenCalled()
  })

  it('demande un complément vers CSF_A_COMPLETER_RC avec motif', async () => {
    historiqueCreate.mockResolvedValue({})
    await demanderComplementRc(RC, ID_CSF, { commentaire: 'Montant incohérent avec le devis.' })
    expect(historiqueCreate).toHaveBeenCalledWith(
      expect.objectContaining({ code_statut_csf: 'CSF_A_COMPLETER_RC', commentaire_statut: 'Montant incohérent avec le devis.' }),
    )
  })
})

describe('retransmettreBudget (RC, depuis CSF_A_COMPLETER_BUDGET — pas de passage par le rédacteur)', () => {
  it('rejette hors CSF_A_COMPLETER_BUDGET (409)', async () => {
    findById.mockResolvedValue({ ...CSF_EN_PREPARATION, code_statut_csf: 'CSF_A_TRAITER' })
    await expect(retransmettreBudget(RC, ID_CSF, {})).rejects.toMatchObject({ status: 409 })
  })

  it('repasse en CSF_TRANSMIS_BUDGET avec réponse libre facultative', async () => {
    findById.mockResolvedValue({ ...CSF_EN_PREPARATION, code_statut_csf: 'CSF_A_COMPLETER_BUDGET' })
    assertHasEffectiveRole.mockResolvedValue(ROLE_RC)
    historiqueCreate.mockResolvedValue({})
    await retransmettreBudget(RC, ID_CSF, { commentaire: 'Corrigé.' })
    expect(historiqueCreate).toHaveBeenCalledWith(
      expect.objectContaining({ code_statut_csf: 'CSF_TRANSMIS_BUDGET', commentaire_statut: 'Corrigé.' }),
    )
  })
})

describe('validerBudget / demanderComplementBudget (CB, depuis CSF_TRANSMIS_BUDGET — jamais de rejet)', () => {
  beforeEach(() => {
    findById.mockResolvedValue({ ...CSF_EN_PREPARATION, code_statut_csf: 'CSF_TRANSMIS_BUDGET', montant_csf: 1200 })
    assertHasEffectiveRole.mockResolvedValue(ROLE_CB)
  })

  it('valide et signale une alerte de dépassement (R2) quand le cumul dépasse MONTANT_COMMANDE', async () => {
    historiqueCreate.mockResolvedValue({})
    findAllByDemandeAchat.mockResolvedValue([{ code_statut_csf: 'CSF_VALIDE_BUDGET', montant_csf: 1200 }])
    const result = await validerBudget(CB, ID_CSF)
    expect(historiqueCreate).toHaveBeenCalledWith(expect.objectContaining({ code_statut_csf: 'CSF_VALIDE_BUDGET' }))
    expect(result.alerteDepassement).toBe(true)
  })

  it('valide sans alerte quand le cumul reste dans MONTANT_COMMANDE', async () => {
    historiqueCreate.mockResolvedValue({})
    findAllByDemandeAchat.mockResolvedValue([{ code_statut_csf: 'CSF_VALIDE_BUDGET', montant_csf: 500 }])
    const result = await validerBudget(CB, ID_CSF)
    expect(result.alerteDepassement).toBe(false)
  })

  it('demande un complément avec motif obligatoire, jamais de rejet possible', async () => {
    historiqueCreate.mockResolvedValue({})
    await demanderComplementBudget(CB, ID_CSF, { commentaire: 'Crédits à revérifier.' })
    expect(historiqueCreate).toHaveBeenCalledWith(
      expect.objectContaining({ code_statut_csf: 'CSF_A_COMPLETER_BUDGET', commentaire_statut: 'Crédits à revérifier.' }),
    )
  })

  it('rejette un RC qui tenterait d\'agir à la place de la CB (403)', async () => {
    assertHasEffectiveRole.mockRejectedValue(Object.assign(new Error('Droits insuffisants'), { status: 403 }))
    await expect(validerBudget(RC, ID_CSF)).rejects.toMatchObject({ status: 403 })
  })
})

describe('constaterLiquidation (OP2.4, terminal)', () => {
  it('rejette hors CSF_VALIDE_BUDGET (409)', async () => {
    findById.mockResolvedValue({ ...CSF_EN_PREPARATION, code_statut_csf: 'CSF_TRANSMIS_BUDGET' })
    await expect(constaterLiquidation(CB, ID_CSF)).rejects.toMatchObject({ status: 409 })
  })

  it('verrouille en CSF_LIQUIDE', async () => {
    findById.mockResolvedValue({ ...CSF_EN_PREPARATION, code_statut_csf: 'CSF_VALIDE_BUDGET' })
    assertHasEffectiveRole.mockResolvedValue(ROLE_CB)
    historiqueCreate.mockResolvedValue({})
    await constaterLiquidation(CB, ID_CSF)
    expect(historiqueCreate).toHaveBeenCalledWith(expect.objectContaining({ code_statut_csf: 'CSF_LIQUIDE' }))
  })
})

describe('supprimer (R7 — jamais au-delà de CSF_A_COMPLETER_RC)', () => {
  it('le rédacteur supprime depuis CSF_EN_PREPARATION', async () => {
    pieceFindAllByCsf.mockResolvedValue([])
    await supprimer(DEMANDEUR, ID_CSF)
    expect(historiqueDeleteAllByCsf).toHaveBeenCalledWith(ID_CSF)
    expect(remove).toHaveBeenCalledWith(ID_CSF)
  })

  it('le RC supprime depuis CSF_A_TRAITER', async () => {
    findById.mockResolvedValue({ ...CSF_EN_PREPARATION, code_statut_csf: 'CSF_A_TRAITER' })
    findEffectiveRolesMock.mockResolvedValue([ROLE_RC])
    pieceFindAllByCsf.mockResolvedValue([])
    await supprimer(RC, ID_CSF)
    expect(remove).toHaveBeenCalledWith(ID_CSF)
  })

  it('rejette le rédacteur qui tenterait de supprimer depuis CSF_A_TRAITER (pas son tour, 403)', async () => {
    findById.mockResolvedValue({ ...CSF_EN_PREPARATION, code_statut_csf: 'CSF_A_TRAITER' })
    findEffectiveRolesMock.mockResolvedValue([])
    await expect(supprimer(DEMANDEUR, ID_CSF)).rejects.toMatchObject({ status: 403 })
    expect(remove).not.toHaveBeenCalled()
  })

  it('rejette toute suppression depuis CSF_TRANSMIS_BUDGET (409/403, jamais au-delà de la reprise RC)', async () => {
    findById.mockResolvedValue({ ...CSF_EN_PREPARATION, code_statut_csf: 'CSF_TRANSMIS_BUDGET' })
    findEffectiveRolesMock.mockResolvedValue([ROLE_RC])
    await expect(supprimer(RC, ID_CSF)).rejects.toMatchObject({ status: 403 })
    expect(remove).not.toHaveBeenCalled()
  })

  it('supprime les justificatifs (base + Storage) avant le CSF lui-même', async () => {
    pieceFindAllByCsf.mockResolvedValue([{ id_piece: 1, storage_path: 'csf/42/a.pdf' }, { id_piece: 2, storage_path: 'csf/42/b.pdf' }])
    await supprimer(DEMANDEUR, ID_CSF)
    expect(pieceRemove).toHaveBeenCalledTimes(2)
    expect(pieceRemoveFile).toHaveBeenCalledTimes(2)
  })
})

describe('Justificatifs — addPiece / removePiece', () => {
  const pdfBuffer = Buffer.concat([Buffer.from('%PDF-1.4'), Buffer.alloc(10)])

  it('rejette un fichier qui n\'est pas un PDF réel (400, magic bytes)', async () => {
    await expect(
      addPiece(DEMANDEUR, ID_CSF, { typePiece: 'AUTRE' }, { buffer: Buffer.from('not a pdf'), size: 9, originalname: 'x.pdf' }),
    ).rejects.toMatchObject({ status: 400 })
    expect(pieceCreateForCsf).not.toHaveBeenCalled()
  })

  it('le rédacteur dépose un justificatif en CSF_EN_PREPARATION', async () => {
    pieceCreateForCsf.mockResolvedValue({ id_piece: 1 })
    await addPiece(DEMANDEUR, ID_CSF, { typePiece: 'PV_RECEPTION' }, { buffer: pdfBuffer, size: pdfBuffer.length, originalname: 'pv.pdf' })
    expect(pieceUploadFile).toHaveBeenCalled()
    expect(pieceCreateForCsf).toHaveBeenCalledWith(
      expect.objectContaining({ id_csf: ID_CSF, type_piece: 'PV_RECEPTION', origine: 'UTILISATEUR' }),
    )
  })

  it('la CB ne peut jamais déposer ni remplacer un justificatif (403)', async () => {
    findById.mockResolvedValue({ ...CSF_EN_PREPARATION, code_statut_csf: 'CSF_TRANSMIS_BUDGET' })
    findEffectiveRolesMock.mockResolvedValue([ROLE_CB])
    await expect(
      addPiece(CB, ID_CSF, { typePiece: 'AUTRE' }, { buffer: pdfBuffer, size: pdfBuffer.length, originalname: 'x.pdf' }),
    ).rejects.toMatchObject({ status: 403 })
  })

  it('removePiece nettoie la base puis le Storage', async () => {
    pieceFindByIdCsf.mockResolvedValue({ id_piece: 1, id_csf: ID_CSF, storage_path: 'csf/42/a.pdf' })
    await removePiece(DEMANDEUR, ID_CSF, 1)
    expect(pieceRemove).toHaveBeenCalledWith(1)
    expect(pieceRemoveFile).toHaveBeenCalledWith('csf/42/a.pdf')
  })

  // Bug corrigé le 25/09/2026 : listPieces/addPiece renvoyaient la ligne brute du repository
  // (snake_case, id_piece/nom_fichier_original) au lieu d'une vue camelCase (idPiece/
  // nomFichierOriginal) — le frontend (PieceJointeCsf) affichait alors des lignes de justificatif
  // vides et le téléchargement échouait (idPiece undefined → route /pieces/undefined/fichier).
  // Voir demandeAchat.service.ts#toPieceJointeView pour le même principe côté DA/FAD, qui n'avait
  // jamais cette régression.
  describe('camelCase de la vue (bug corrigé le 25/09/2026)', () => {
    it('listPieces renvoie idPiece/nomFichierOriginal/typePiece/tailleOctets, jamais les clés snake_case', async () => {
      pieceFindAllByCsf.mockResolvedValue([
        { id_piece: 7, id_csf: ID_CSF, type_piece: 'PV_RECEPTION', origine: 'UTILISATEUR', nom_fichier_original: 'pv.pdf', storage_path: 'csf/1/pv.pdf', taille_octets: 1234 },
      ])
      const result = await listPieces(DEMANDEUR, ID_CSF)
      expect(result).toEqual([{ idPiece: 7, typePiece: 'PV_RECEPTION', nomFichierOriginal: 'pv.pdf', tailleOctets: 1234 }])
    })

    it('addPiece renvoie la même vue camelCase pour la pièce tout juste créée', async () => {
      pieceCreateForCsf.mockResolvedValue({
        id_piece: 9,
        id_csf: ID_CSF,
        type_piece: 'PV_RECEPTION',
        origine: 'UTILISATEUR',
        nom_fichier_original: 'pv.pdf',
        storage_path: 'csf/1/pv.pdf',
        taille_octets: pdfBuffer.length,
      })
      const result = await addPiece(DEMANDEUR, ID_CSF, { typePiece: 'PV_RECEPTION' }, { buffer: pdfBuffer, size: pdfBuffer.length, originalname: 'pv.pdf' })
      expect(result).toEqual({ idPiece: 9, typePiece: 'PV_RECEPTION', nomFichierOriginal: 'pv.pdf', tailleOctets: pdfBuffer.length })
    })
  })
})

describe('Suivi de la facturation (décision du 24/09/2026)', () => {
  const COMMANDE_A = { id_demande_achat: 101, montant_commande: 1000 }
  const COMMANDE_B = { id_demande_achat: 102, montant_commande: 500 }

  it('rejette sans authentification (401)', async () => {
    await expect(getSyntheseFacturationDemandeur(null)).rejects.toMatchObject({ status: 401 })
    await expect(getSyntheseFacturationRc(null)).rejects.toMatchObject({ status: 401 })
    await expect(getSyntheseFacturationCb(null)).rejects.toMatchObject({ status: 401 })
  })

  // Décision du 25/09/2026 — redéfinition des tuiles : `csf` = tous les CSF existants (hors
  // CSF_EN_PREPARATION), `certifie` = CSF_VALIDE_BUDGET uniquement, `liquide` = CSF_LIQUIDE
  // uniquement (buckets désormais mutuellement exclusifs par statut courant, comme les tuiles).
  it('Demandeur : CSF = tous sauf EN_PREPARATION, certifie/liquide isolés par statut, isole les commandes sans aucun CSF', async () => {
    demandeAchatFindAll.mockResolvedValue([COMMANDE_A, COMMANDE_B])
    findAllByDemandeAchatIn.mockResolvedValue([
      { id_demande_achat: 101, code_statut_csf: 'CSF_VALIDE_BUDGET', montant_csf: 400 },
      { id_demande_achat: 101, code_statut_csf: 'CSF_LIQUIDE', montant_csf: 200 },
      { id_demande_achat: 101, code_statut_csf: 'CSF_A_TRAITER', montant_csf: 999 },
      { id_demande_achat: 101, code_statut_csf: 'CSF_EN_PREPARATION', montant_csf: 111 },
      // COMMANDE_B (102) n'a aucune ligne → doit apparaître dans commandesSansCsf.
    ])

    const result = await getSyntheseFacturationDemandeur(DEMANDEUR)

    expect(demandeAchatFindAll).toHaveBeenCalledWith({ matriculeDemandeurIn: [DEMANDEUR], statuts: ['FAD_COMMANDEE'] })
    expect(result).toEqual({
      csf: { nombre: 3, montant: 1599 }, // tous sauf EN_PREPARATION (400+200+999)
      commandes: { nombre: 2, montant: 1500 },
      certifie: { nombre: 1, montant: 400 },
      liquide: { nombre: 1, montant: 200 },
      commandesSansCsf: { nombre: 1, montant: 500 }, // COMMANDE_B seule, aucun CSF quel que soit son statut
    })
  })

  it('RC : périmètre vide (aucun rôle RC) renvoie une synthèse à zéro sans appeler demandeAchatRepository', async () => {
    findEffectiveRolesMock.mockResolvedValue([])
    const result = await getSyntheseFacturationRc(RC)
    expect(result).toEqual({
      csf: { nombre: 0, montant: 0 },
      commandes: { nombre: 0, montant: 0 },
      certifie: { nombre: 0, montant: 0 },
      liquide: { nombre: 0, montant: 0 },
      commandesSansCsf: { nombre: 0, montant: 0 },
    })
    expect(demandeAchatFindAll).not.toHaveBeenCalled()
  })

  it('RC : résout les commandes via les acteurs de la cellule', async () => {
    findEffectiveRolesMock.mockResolvedValue([ROLE_RC])
    acteurFindAllByCellule.mockResolvedValue([{ matricule: DEMANDEUR, id_cellule: ID_CELLULE }])
    demandeAchatFindAll.mockResolvedValue([COMMANDE_A])
    findAllByDemandeAchatIn.mockResolvedValue([])

    const result = await getSyntheseFacturationRc(RC)

    expect(acteurFindAllByCellule).toHaveBeenCalledWith(ID_CELLULE)
    expect(demandeAchatFindAll).toHaveBeenCalledWith({ matriculeDemandeurIn: [DEMANDEUR], statuts: ['FAD_COMMANDEE'] })
    expect(result.commandes).toEqual({ nombre: 1, montant: 1000 })
    expect(result.commandesSansCsf).toEqual({ nombre: 1, montant: 1000 })
  })

  it('CB : agrège sur tous les services où l\'acteur détient un rôle CB actif — CSF liquidés comptent dans `csf` et dans `liquide`', async () => {
    findEffectiveRolesMock.mockResolvedValue([ROLE_CB])
    demandeAchatFindAll.mockResolvedValue([COMMANDE_A, COMMANDE_B])
    findAllByDemandeAchatIn.mockResolvedValue([
      { id_demande_achat: 101, code_statut_csf: 'CSF_LIQUIDE', montant_csf: 1000 },
      { id_demande_achat: 102, code_statut_csf: 'CSF_LIQUIDE', montant_csf: 500 },
    ])

    const result = await getSyntheseFacturationCb(CB)

    expect(demandeAchatFindAll).toHaveBeenCalledWith({ idService: ID_SERVICE, statuts: ['FAD_COMMANDEE'] })
    expect(result).toEqual({
      csf: { nombre: 2, montant: 1500 },
      commandes: { nombre: 2, montant: 1500 },
      certifie: { nombre: 0, montant: 0 },
      liquide: { nombre: 2, montant: 1500 },
      commandesSansCsf: { nombre: 0, montant: 0 },
    })
  })
})
