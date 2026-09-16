import { describe, it, expect, vi, beforeEach } from 'vitest'

const createBrouillon = vi.fn()
const findById = vi.fn()
const findAll = vi.fn()
const update = vi.fn()
const remove = vi.fn()

const deleteAllDevis = vi.fn()
const deleteAllHistorique = vi.fn()

const findIdServiceByMatricule = vi.fn()
const findAllByCellule = vi.fn()
const celluleFindById = vi.fn()
const findActiveByMatricule = vi.fn()
const hasActiveRole = vi.fn()

const marcheFindByNummarche = vi.fn()
const marcheTiersFindById = vi.fn()
const resolveMarcheIdService = vi.fn()
const fournisseurFindIdsByRaisonSociale = vi.fn()
const fournisseurFindAll = vi.fn()
const devisFindAllByDemandeAchat = vi.fn()
const devisCreate = vi.fn()
const devisFindById = vi.fn()
const devisUpdate = vi.fn()
const devisRemove = vi.fn()
const devisUploadFile = vi.fn()
const devisDownloadFile = vi.fn()
const devisRemoveFile = vi.fn()
const devisBuildStoragePath = vi.fn()
const pieceFindAllByDemandeAchat = vi.fn()
const pieceFindAllByDemandeAchatAndFournisseur = vi.fn()
const pieceFindById = vi.fn()
const pieceCreate = vi.fn()
const pieceRemove = vi.fn()
const pieceUploadFile = vi.fn()
const pieceDownloadFile = vi.fn()
const pieceRemoveFile = vi.fn()
const pieceBuildStoragePath = vi.fn()
const assertCodeActif = vi.fn()

vi.mock('../repositories/demandeAchat.repository.js', () => ({
  createBrouillon: (...args: unknown[]) => createBrouillon(...args),
  findById: (...args: unknown[]) => findById(...args),
  findAll: (...args: unknown[]) => findAll(...args),
  update: (...args: unknown[]) => update(...args),
  remove: (...args: unknown[]) => remove(...args),
}))
vi.mock('../repositories/devisConsulte.repository.js', () => ({
  deleteAllByDemandeAchat: (...args: unknown[]) => deleteAllDevis(...args),
  findAllByDemandeAchat: (...args: unknown[]) => devisFindAllByDemandeAchat(...args),
  create: (...args: unknown[]) => devisCreate(...args),
  findById: (...args: unknown[]) => devisFindById(...args),
  update: (...args: unknown[]) => devisUpdate(...args),
  remove: (...args: unknown[]) => devisRemove(...args),
  uploadFile: (...args: unknown[]) => devisUploadFile(...args),
  downloadFile: (...args: unknown[]) => devisDownloadFile(...args),
  removeFile: (...args: unknown[]) => devisRemoveFile(...args),
  buildStoragePath: (...args: unknown[]) => devisBuildStoragePath(...args),
}))
vi.mock('../repositories/pieceJointe.repository.js', () => ({
  findAllByDemandeAchat: (...args: unknown[]) => pieceFindAllByDemandeAchat(...args),
  findAllByDemandeAchatAndFournisseur: (...args: unknown[]) => pieceFindAllByDemandeAchatAndFournisseur(...args),
  findById: (...args: unknown[]) => pieceFindById(...args),
  create: (...args: unknown[]) => pieceCreate(...args),
  remove: (...args: unknown[]) => pieceRemove(...args),
  uploadFile: (...args: unknown[]) => pieceUploadFile(...args),
  downloadFile: (...args: unknown[]) => pieceDownloadFile(...args),
  removeFile: (...args: unknown[]) => pieceRemoveFile(...args),
  buildStoragePath: (...args: unknown[]) => pieceBuildStoragePath(...args),
}))
const historiqueFindAllByDemandeAchat = vi.fn()
vi.mock('../repositories/historiqueStatut.repository.js', () => ({
  deleteAllByDemandeAchat: (...args: unknown[]) => deleteAllHistorique(...args),
  create: (...args: unknown[]) => historiqueCreate(...args),
  findAllByDemandeAchat: (...args: unknown[]) => historiqueFindAllByDemandeAchat(...args),
}))
const findByMatricule = vi.fn()
const findByMatricules = vi.fn()
vi.mock('../repositories/acteur.repository.js', () => ({
  findIdServiceByMatricule: (...args: unknown[]) => findIdServiceByMatricule(...args),
  findAllByCellule: (...args: unknown[]) => findAllByCellule(...args),
  findByMatricule: (...args: unknown[]) => findByMatricule(...args),
  findByMatricules: (...args: unknown[]) => findByMatricules(...args),
}))
const assertHasEffectiveRole = vi.fn()
const findEffectiveRolesMock = vi.fn()
vi.mock('../services/roleEffectif.service.js', () => ({
  assertHasEffectiveRole: (...args: unknown[]) => assertHasEffectiveRole(...args),
  findEffectiveRoles: (...args: unknown[]) => findEffectiveRolesMock(...args),
}))
const historiqueCreate = vi.fn()
const serviceFindById = vi.fn()
vi.mock('../repositories/service.repository.js', () => ({
  findById: (...args: unknown[]) => serviceFindById(...args),
}))
const seuilFindByService = vi.fn()
vi.mock('../repositories/seuilValidationDs.repository.js', () => ({
  findByService: (...args: unknown[]) => seuilFindByService(...args),
}))
const statutFindAll = vi.fn()
vi.mock('../repositories/statut.repository.js', () => ({
  findAll: (...args: unknown[]) => statutFindAll(...args),
}))
const suppleanceFindById = vi.fn()
vi.mock('../repositories/suppleance.repository.js', () => ({
  findById: (...args: unknown[]) => suppleanceFindById(...args),
}))
vi.mock('../repositories/cellule.repository.js', () => ({
  findById: (...args: unknown[]) => celluleFindById(...args),
}))
const roleFindById = vi.fn()
vi.mock('../repositories/roleAttribution.repository.js', () => ({
  findActiveByMatricule: (...args: unknown[]) => findActiveByMatricule(...args),
  findById: (...args: unknown[]) => roleFindById(...args),
}))
vi.mock('../repositories/auth.repository.js', () => ({
  hasActiveRole: (...args: unknown[]) => hasActiveRole(...args),
}))
vi.mock('../repositories/marche.repository.js', () => ({
  findByNummarche: (...args: unknown[]) => marcheFindByNummarche(...args),
}))
vi.mock('../repositories/marcheTiers.repository.js', () => ({
  findById: (...args: unknown[]) => marcheTiersFindById(...args),
}))
vi.mock('../services/marche.service.js', () => ({
  resolveMarcheIdService: (...args: unknown[]) => resolveMarcheIdService(...args),
}))
vi.mock('../repositories/fournisseur.repository.js', () => ({
  findIdsByRaisonSociale: (...args: unknown[]) => fournisseurFindIdsByRaisonSociale(...args),
  findAll: (...args: unknown[]) => fournisseurFindAll(...args),
}))
vi.mock('../services/libelleReferentiel.service.js', () => ({
  assertCodeActif: (...args: unknown[]) => assertCodeActif(...args),
}))

const {
  createDemandeAchat,
  listDemandeAchat,
  updateDemandeAchat,
  deleteDemandeAchat,
  transmettreRc,
  decisionRc,
  transmettreFad,
  decisionCds,
  transmettreCb,
  decisionCb,
  retransmettreCb,
  transmettreDsOuSeuil,
  decisionDs,
  transmettreOrdreCb,
  completerCb,
  commander,
  getHistoriqueStatuts,
  getSynthese,
  ACCUEIL_SCOPE_STATUTS,
  selectMarcheDemandeAchat,
  listConsultationDemandeAchat,
  saveConsultationDemandeAchat,
  addConsultationCandidat,
  removeConsultationCandidat,
  getOrCreateMarcheDevis,
  uploadDevisFile,
  downloadDevisFile,
  deleteDevisFile,
  listPiecesDemandeAchat,
  addPieceDemandeAchat,
  removePieceDemandeAchat,
  downloadPieceDemandeAchat,
} = await import('../services/demandeAchat.service.js')

const DEMANDEUR = '10001'
const RC = '20001'
const CB = '25001'
const ADMIN_SERVICE = '30001'
const AUTRE_DEMANDEUR = '10002'
const ID_SERVICE = 1
const ID_SERVICE_AUTRE = 2
const ID_CELLULE_RC = 5

const DA = {
  id_demande_achat: 1,
  numero: '2026-09-08-001',
  id_service: ID_SERVICE,
  matricule_demandeur: DEMANDEUR,
  code_statut: 'DA_EN_PREPARATION',
  procedure_achat: 'MARCHE',
}

beforeEach(() => {
  createBrouillon.mockReset()
  findById.mockReset()
  findAll.mockReset()
  update.mockReset()
  remove.mockReset()
  deleteAllDevis.mockReset()
  deleteAllHistorique.mockReset()
  findIdServiceByMatricule.mockReset()
  findAllByCellule.mockReset()
  celluleFindById.mockReset()
  findActiveByMatricule.mockReset()
  hasActiveRole.mockReset()
  marcheFindByNummarche.mockReset()
  marcheTiersFindById.mockReset()
  resolveMarcheIdService.mockReset()
  fournisseurFindIdsByRaisonSociale.mockReset()
  fournisseurFindAll.mockReset()
  devisFindAllByDemandeAchat.mockReset()
  devisCreate.mockReset()
  devisFindById.mockReset()
  devisUpdate.mockReset()
  devisRemove.mockReset()
  devisUploadFile.mockReset()
  devisDownloadFile.mockReset()
  devisRemoveFile.mockReset()
  devisBuildStoragePath.mockReset()
  pieceFindAllByDemandeAchat.mockReset()
  pieceFindAllByDemandeAchatAndFournisseur.mockReset()
  pieceFindById.mockReset()
  pieceCreate.mockReset()
  pieceRemove.mockReset()
  pieceUploadFile.mockReset()
  pieceDownloadFile.mockReset()
  pieceRemoveFile.mockReset()
  pieceBuildStoragePath.mockReset()
  assertCodeActif.mockReset()
  findByMatricule.mockReset()
  assertHasEffectiveRole.mockReset()
  findEffectiveRolesMock.mockReset()
  historiqueCreate.mockReset()
  serviceFindById.mockReset()
  seuilFindByService.mockReset().mockResolvedValue(null)
  findByMatricules.mockReset().mockResolvedValue([])
  roleFindById.mockReset()
  statutFindAll.mockReset().mockResolvedValue([])
  suppleanceFindById.mockReset()
  historiqueFindAllByDemandeAchat.mockReset().mockResolvedValue([])

  // Par défaut : personne n'a de rôle applicatif (Demandeur simple).
  hasActiveRole.mockResolvedValue(false)
  findActiveByMatricule.mockResolvedValue([])
  // resolveAccessContext (createDemandeAchat/listDemandeAchat/updateDemandeAchat/...) est basculé
  // sur roleEffectifService.findEffectiveRoles depuis le 15/09/2026 (correctif suppléance RC) —
  // ce module étant mocké dans son ensemble, on reconstruit ici la même liste de rôles que
  // findActiveByMatricule (titulaire seul, pas de suppléance simulée par défaut) pour que tous
  // les tests existants qui configurent findActiveByMatricule.mockResolvedValue(...) continuent
  // de fonctionner sans modification — un test dédié à la suppléance surcharge
  // findEffectiveRolesMock directement si besoin.
  findEffectiveRolesMock.mockImplementation(async (matricule: string) => {
    const direct = await findActiveByMatricule(matricule)
    return (direct ?? []).map((r: { id_role: number; type_role: string; id_cellule: number | null; id_service: number | null; id_direction: number | null }) => ({
      idRole: r.id_role,
      typeRole: r.type_role,
      idCellule: r.id_cellule,
      idService: r.id_service,
      idDirection: r.id_direction,
      idSuppleance: null,
    }))
  })
  // Par défaut : suppression Storage best-effort réussie (le .catch() sur
  // le résultat exige une Promise, jamais `undefined`).
  devisRemoveFile.mockResolvedValue(undefined)
  pieceRemoveFile.mockResolvedValue(undefined)
  // Par défaut : aucune ligne existante — évite "rows is not iterable" dans
  // purgeDevisConsulte/purgePieceJointe pour les tests qui ne les concernent pas.
  devisFindAllByDemandeAchat.mockResolvedValue([])
  pieceFindAllByDemandeAchat.mockResolvedValue([])
  pieceFindAllByDemandeAchatAndFournisseur.mockResolvedValue([])
  assertCodeActif.mockResolvedValue(undefined)
})

describe('createDemandeAchat', () => {
  it('rejette sans authentification (401)', async () => {
    await expect(createDemandeAchat(null, {})).rejects.toMatchObject({ status: 401 })
  })

  it('rejette une entrée invalide (400)', async () => {
    await expect(createDemandeAchat(DEMANDEUR, { matriculeDemandeurCible: 123 })).rejects.toMatchObject({ status: 400 })
    expect(createBrouillon).not.toHaveBeenCalled()
  })

  it('un Demandeur simple crée pour lui-même sans sélecteur (matriculeDemandeurCible absent)', async () => {
    findIdServiceByMatricule.mockResolvedValue(ID_SERVICE)
    createBrouillon.mockResolvedValue(DA)

    await createDemandeAchat(DEMANDEUR, {})

    expect(createBrouillon).toHaveBeenCalledWith(ID_SERVICE, DEMANDEUR)
  })

  it('un Demandeur simple ne peut pas créer pour un tiers (403)', async () => {
    findIdServiceByMatricule.mockResolvedValue(ID_SERVICE)

    await expect(createDemandeAchat(DEMANDEUR, { matriculeDemandeurCible: AUTRE_DEMANDEUR })).rejects.toMatchObject({
      status: 403,
    })
    expect(createBrouillon).not.toHaveBeenCalled()
  })

  it('rejette si le demandeur cible est introuvable (404)', async () => {
    findIdServiceByMatricule.mockResolvedValue(null)

    await expect(createDemandeAchat(DEMANDEUR, { matriculeDemandeurCible: 'INCONNU' })).rejects.toMatchObject({
      status: 404,
    })
  })

  it('RC crée pour un demandeur de son propre service (même hors de sa cellule)', async () => {
    findActiveByMatricule.mockResolvedValue([
      { id_role: 1, type_role: 'RC', id_cellule: ID_CELLULE_RC, id_service: null, id_direction: null },
    ])
    celluleFindById.mockResolvedValue({ id_cellule: ID_CELLULE_RC, id_service: ID_SERVICE, code_cellule: 'C1', libelle_cellule: 'C1', actif: true })
    findIdServiceByMatricule.mockResolvedValue(ID_SERVICE)
    createBrouillon.mockResolvedValue(DA)

    await createDemandeAchat(RC, { matriculeDemandeurCible: AUTRE_DEMANDEUR })

    expect(createBrouillon).toHaveBeenCalledWith(ID_SERVICE, AUTRE_DEMANDEUR)
  })

  it("RC ne peut pas créer pour un demandeur d'un autre service (403)", async () => {
    findActiveByMatricule.mockResolvedValue([
      { id_role: 1, type_role: 'RC', id_cellule: ID_CELLULE_RC, id_service: null, id_direction: null },
    ])
    celluleFindById.mockResolvedValue({ id_cellule: ID_CELLULE_RC, id_service: ID_SERVICE, code_cellule: 'C1', libelle_cellule: 'C1', actif: true })
    findIdServiceByMatricule.mockResolvedValue(ID_SERVICE_AUTRE)

    await expect(createDemandeAchat(RC, { matriculeDemandeurCible: AUTRE_DEMANDEUR })).rejects.toMatchObject({ status: 403 })
    expect(createBrouillon).not.toHaveBeenCalled()
  })

  it('ADMIN_SERVICE crée pour tout demandeur de son service', async () => {
    findActiveByMatricule.mockResolvedValue([
      { id_role: 1, type_role: 'ADMIN_SERVICE', id_cellule: null, id_service: ID_SERVICE, id_direction: null },
    ])
    findIdServiceByMatricule.mockResolvedValue(ID_SERVICE)
    createBrouillon.mockResolvedValue(DA)

    await createDemandeAchat(ADMIN_SERVICE, { matriculeDemandeurCible: AUTRE_DEMANDEUR })

    expect(createBrouillon).toHaveBeenCalledWith(ID_SERVICE, AUTRE_DEMANDEUR)
  })

  it('ADMIN_APP crée pour tout demandeur, quel que soit le service', async () => {
    hasActiveRole.mockResolvedValue(true)
    findIdServiceByMatricule.mockResolvedValue(ID_SERVICE_AUTRE)
    createBrouillon.mockResolvedValue(DA)

    await createDemandeAchat('40001', { matriculeDemandeurCible: AUTRE_DEMANDEUR })

    expect(createBrouillon).toHaveBeenCalledWith(ID_SERVICE_AUTRE, AUTRE_DEMANDEUR)
  })
})

describe('listDemandeAchat', () => {
  it('rejette sans authentification (401)', async () => {
    await expect(listDemandeAchat(null, {})).rejects.toMatchObject({ status: 401 })
  })

  it('un Demandeur simple ne voit que ses propres DA, quels que soient les filtres fournis', async () => {
    findIdServiceByMatricule.mockResolvedValue(ID_SERVICE)
    findAll.mockResolvedValue([DA])

    await listDemandeAchat(DEMANDEUR, { matriculeDemandeur: AUTRE_DEMANDEUR })

    expect(findAll).toHaveBeenCalledWith(
      expect.objectContaining({ matriculeDemandeurIn: [DEMANDEUR], statuts: ['DA_EN_PREPARATION', 'DA_A_COMPLETER_RC'] }),
    )
  })

  it('résout les fournisseurs correspondant à la recherche et les transmet au repository (décision du 09/09/2026)', async () => {
    findIdServiceByMatricule.mockResolvedValue(ID_SERVICE)
    fournisseurFindIdsByRaisonSociale.mockResolvedValue([42, 43])
    findAll.mockResolvedValue([DA])

    await listDemandeAchat(DEMANDEUR, { search: 'climat' })

    expect(fournisseurFindIdsByRaisonSociale).toHaveBeenCalledWith('climat')
    expect(findAll).toHaveBeenCalledWith(expect.objectContaining({ search: 'climat', idFournisseurIn: [42, 43] }))
  })

  it('ne résout aucun fournisseur si la recherche est vide (pas d\'appel superflu)', async () => {
    findIdServiceByMatricule.mockResolvedValue(ID_SERVICE)
    findAll.mockResolvedValue([DA])

    await listDemandeAchat(DEMANDEUR, {})

    expect(fournisseurFindIdsByRaisonSociale).not.toHaveBeenCalled()
    expect(findAll).toHaveBeenCalledWith(expect.objectContaining({ idFournisseurIn: undefined }))
  })

  it('RC sans filtre voit sa propre cellule par défaut', async () => {
    findActiveByMatricule.mockResolvedValue([
      { id_role: 1, type_role: 'RC', id_cellule: ID_CELLULE_RC, id_service: null, id_direction: null },
    ])
    celluleFindById.mockResolvedValue({ id_cellule: ID_CELLULE_RC, id_service: ID_SERVICE, code_cellule: 'C1', libelle_cellule: 'C1', actif: true })
    findAllByCellule.mockResolvedValue([{ matricule: DEMANDEUR, nom: 'X', prenom: 'Y', fonction: '', id_cellule: ID_CELLULE_RC }])
    findAll.mockResolvedValue([DA])

    await listDemandeAchat(RC, {})

    expect(findAllByCellule).toHaveBeenCalledWith(ID_CELLULE_RC)
    expect(findAll).toHaveBeenCalledWith(expect.objectContaining({ matriculeDemandeurIn: [DEMANDEUR] }))
  })

  it('bug corrigé le 15/09/2026 : un suppléant RC pur (aucune role_attribution directe) voit la cellule qu\'il supplée', async () => {
    // Aucune ligne role_attribution directe (findActiveByMatricule reste []) — seule
    // findEffectiveRolesMock est surchargée pour simuler le rôle hérité par suppléance
    // (id_suppleance non null), exactement ce que produirait roleEffectifService.findEffectiveRoles
    // en combinant role_attribution (titulaire) + suppleance.
    findEffectiveRolesMock.mockResolvedValue([
      { idRole: 1, typeRole: 'RC', idCellule: ID_CELLULE_RC, idService: null, idDirection: null, idSuppleance: 99 },
    ])
    celluleFindById.mockResolvedValue({ id_cellule: ID_CELLULE_RC, id_service: ID_SERVICE, code_cellule: 'C1', libelle_cellule: 'C1', actif: true })
    findAllByCellule.mockResolvedValue([{ matricule: DEMANDEUR, nom: 'X', prenom: 'Y', fonction: '', id_cellule: ID_CELLULE_RC }])
    findAll.mockResolvedValue([DA])

    await listDemandeAchat(RC, {})

    expect(findAllByCellule).toHaveBeenCalledWith(ID_CELLULE_RC)
    expect(findAll).toHaveBeenCalledWith(expect.objectContaining({ matriculeDemandeurIn: [DEMANDEUR] }))
  })

  it('RC avec un demandeur choisi hors de sa cellule mais dans son service : autorisé', async () => {
    findActiveByMatricule.mockResolvedValue([
      { id_role: 1, type_role: 'RC', id_cellule: ID_CELLULE_RC, id_service: null, id_direction: null },
    ])
    celluleFindById.mockResolvedValue({ id_cellule: ID_CELLULE_RC, id_service: ID_SERVICE, code_cellule: 'C1', libelle_cellule: 'C1', actif: true })
    findIdServiceByMatricule.mockResolvedValue(ID_SERVICE)
    findAll.mockResolvedValue([DA])

    await listDemandeAchat(RC, { matriculeDemandeur: AUTRE_DEMANDEUR })

    expect(findAll).toHaveBeenCalledWith(expect.objectContaining({ matriculeDemandeurIn: [AUTRE_DEMANDEUR] }))
  })

  it("RC avec un demandeur d'un autre service : rejeté (403)", async () => {
    findActiveByMatricule.mockResolvedValue([
      { id_role: 1, type_role: 'RC', id_cellule: ID_CELLULE_RC, id_service: null, id_direction: null },
    ])
    celluleFindById.mockResolvedValue({ id_cellule: ID_CELLULE_RC, id_service: ID_SERVICE, code_cellule: 'C1', libelle_cellule: 'C1', actif: true })
    findIdServiceByMatricule.mockResolvedValue(ID_SERVICE_AUTRE)

    await expect(listDemandeAchat(RC, { matriculeDemandeur: AUTRE_DEMANDEUR })).rejects.toMatchObject({ status: 403 })
  })

  it('ADMIN_SERVICE sans filtre voit tout son service (sans passer par les cellules)', async () => {
    findActiveByMatricule.mockResolvedValue([
      { id_role: 1, type_role: 'ADMIN_SERVICE', id_cellule: null, id_service: ID_SERVICE, id_direction: null },
    ])
    findAll.mockResolvedValue([DA])

    await listDemandeAchat(ADMIN_SERVICE, {})

    expect(findAll).toHaveBeenCalledWith(expect.objectContaining({ idService: ID_SERVICE }))
    expect(findAllByCellule).not.toHaveBeenCalled()
  })

  it("ADMIN_SERVICE avec une cellule d'un autre service : rejeté (403)", async () => {
    findActiveByMatricule.mockResolvedValue([
      { id_role: 1, type_role: 'ADMIN_SERVICE', id_cellule: null, id_service: ID_SERVICE, id_direction: null },
    ])
    celluleFindById.mockResolvedValue({ id_cellule: 99, id_service: ID_SERVICE_AUTRE, code_cellule: 'C9', libelle_cellule: 'C9', actif: true })

    await expect(listDemandeAchat(ADMIN_SERVICE, { idCellule: 99 })).rejects.toMatchObject({ status: 403 })
  })

  it('ADMIN_APP sans filtre ne restreint rien (transverse)', async () => {
    hasActiveRole.mockResolvedValue(true)
    findAll.mockResolvedValue([DA])

    await listDemandeAchat('40001', {})

    expect(findAll).toHaveBeenCalledWith(expect.objectContaining({}))
    const callArg = findAll.mock.calls[0][0]
    expect(callArg.idService).toBeUndefined()
    expect(callArg.matriculeDemandeurIn).toBeUndefined()
  })
})

describe('listDemandeAchat — scope et filtre fournisseur (écran d\'accueil)', () => {
  it('traduit query.scope en liste de statuts fixe quand aucun statut précis n\'est choisi', async () => {
    findIdServiceByMatricule.mockResolvedValue(ID_SERVICE)
    findAll.mockResolvedValue([])

    await listDemandeAchat(DEMANDEUR, { scope: 'FAD_COMMANDEES' })

    expect(findAll).toHaveBeenCalledWith(expect.objectContaining({ statuts: ['FAD_COMMANDEE'] }))
  })

  it('bug corrigé le 15/09/2026 : query.statut (filtre Statut d\'un onglet) l\'emporte sur query.scope, jamais ignoré', async () => {
    findIdServiceByMatricule.mockResolvedValue(ID_SERVICE)
    findAll.mockResolvedValue([])

    await listDemandeAchat(DEMANDEUR, { scope: 'SUIVI_FAD', statut: 'FAD_VALIDEE_CDS' })

    expect(findAll).toHaveBeenCalledWith(expect.objectContaining({ statuts: ['FAD_VALIDEE_CDS'] }))
  })

  it('transmet idFournisseurRetenu tel quel au repository', async () => {
    findIdServiceByMatricule.mockResolvedValue(ID_SERVICE)
    findAll.mockResolvedValue([])

    await listDemandeAchat(DEMANDEUR, { scope: 'SUIVI_FAD', idFournisseurRetenu: 42 })

    expect(findAll).toHaveBeenCalledWith(expect.objectContaining({ idFournisseurRetenu: 42 }))
  })
})

describe('couverture ACCUEIL_SCOPE_STATUTS (garde-fou anti-dérive)', () => {
  // Les 25 codes du référentiel finances.statut (ForClaude/CDC/code_statut.pdf,
  // migration 20260914100000_rebuild_statut_depuis_code_statut_pdf.sql).
  const TOUS_LES_CODES_STATUT = [
    'DA_EN_PREPARATION',
    'DA_TRANSMISE_DEM_RC',
    'DA_VALIDEE_RC',
    'DA_A_COMPLETER_RC',
    'DA_REJETEE_RC',
    'DA_ANNULEE_RC',
    'FAD_TRANSMISE_RC_CDS',
    'FAD_MODIFIEE_TRANSMISE_RC_CB',
    'FAD_VALIDEE_CDS',
    'FAD_A_COMPLETER_CDS',
    'FAD_REJETEE_CDS',
    'FAD_ANNULEE_CDS',
    'FAD_TRANSMISE_CDS_CB',
    'FAD_VALIDEE_CB',
    'FAD_A_MODIFIER_CB',
    'FAD_REJETEE_CB',
    'FAD_TRANSMISE_CB_DS',
    'FAD_VALIDEE_DS',
    'FAD_VALIDEE_DS_SEUIL',
    'FAD_A_COMPLETER_CB',
    'FAD_REJETEE_DS',
    'FAD_ANNULEE_DS',
    'FAD_TRANSMISE_DS_CB',
    'FAD_A_COMMANDER',
    'FAD_COMMANDEE',
  ]

  it('les 4 onglets Demandeur (A_FINALISER/SUIVI_FAD/FAD_COMMANDEES/REJETEES_ANNULEES) couvrent exactement les 25 codes, sans trou ni recouvrement', () => {
    const scopes = [
      ACCUEIL_SCOPE_STATUTS.A_FINALISER,
      ACCUEIL_SCOPE_STATUTS.SUIVI_FAD,
      ACCUEIL_SCOPE_STATUTS.FAD_COMMANDEES,
      ACCUEIL_SCOPE_STATUTS.REJETEES_ANNULEES,
    ]
    const union = scopes.flat()

    expect(union.length).toBe(TOUS_LES_CODES_STATUT.length) // pas de recouvrement (sinon union.length > 25)
    expect(new Set(union)).toEqual(new Set(TOUS_LES_CODES_STATUT)) // pas de trou ni de code inconnu
  })

  // Écran de suivi RC (15/09/2026) : A_TRAITER/EN_COURS partagent FAD_COMMANDEES/REJETEES_ANNULEES
  // avec les onglets Demandeur — regroupement alternatif des mêmes codes, pas additif au-dessus.
  // DA_EN_PREPARATION en est exclu (bug corrigé le 15/09/2026) : ce brouillon reste entre les mains
  // du demandeur, jamais transmis — le RC n'a encore rien à en faire, il n'apparaît donc dans aucun
  // onglet RC (contrairement à DA_A_COMPLETER_RC, où le RC a déjà statué). D'où 24 codes, pas 25.
  it('les 4 onglets RC (A_TRAITER/EN_COURS/FAD_COMMANDEES/REJETEES_ANNULEES) couvrent exactement les 24 codes hors DA_EN_PREPARATION, sans trou ni recouvrement', () => {
    const scopes = [
      ACCUEIL_SCOPE_STATUTS.A_TRAITER,
      ACCUEIL_SCOPE_STATUTS.EN_COURS,
      ACCUEIL_SCOPE_STATUTS.FAD_COMMANDEES,
      ACCUEIL_SCOPE_STATUTS.REJETEES_ANNULEES,
    ]
    const union = scopes.flat()
    const codesAttendus = TOUS_LES_CODES_STATUT.filter((code) => code !== 'DA_EN_PREPARATION')

    expect(union).not.toContain('DA_EN_PREPARATION')
    expect(union.length).toBe(codesAttendus.length)
    expect(new Set(union)).toEqual(new Set(codesAttendus))
  })
})

describe('getSynthese', () => {
  const STATUT_ROWS = [
    { code_statut: 'DA_TRANSMISE_DEM_RC', libelle: '', emmeteur: 'DEM', pour_action: 'RC', diffusion: null, en_transit: 'RC', type_statut: '', commentaire: null },
    { code_statut: 'FAD_TRANSMISE_RC_CDS', libelle: '', emmeteur: 'RC', pour_action: 'CDS', diffusion: null, en_transit: 'CDS', type_statut: '', commentaire: null },
    { code_statut: 'FAD_TRANSMISE_CB_DS', libelle: '', emmeteur: 'CB', pour_action: 'DS', diffusion: null, en_transit: 'DS', type_statut: '', commentaire: null },
    { code_statut: 'FAD_A_COMMANDER', libelle: '', emmeteur: 'CB', pour_action: 'CB', diffusion: null, en_transit: 'CB', type_statut: '', commentaire: null },
    { code_statut: 'DA_EN_PREPARATION', libelle: '', emmeteur: 'DEM', pour_action: null, diffusion: null, en_transit: 'DEM', type_statut: '', commentaire: null },
    { code_statut: 'FAD_COMMANDEE', libelle: '', emmeteur: 'CB', pour_action: null, diffusion: null, en_transit: null, type_statut: '', commentaire: null },
    { code_statut: 'DA_REJETEE_RC', libelle: '', emmeteur: 'RC', pour_action: null, diffusion: null, en_transit: null, type_statut: 'REJETEE', commentaire: null },
  ]

  beforeEach(() => {
    statutFindAll.mockResolvedValue(STATUT_ROWS)
  })

  it('rejette sans authentification (401)', async () => {
    await expect(getSynthese(null)).rejects.toMatchObject({ status: 401 })
  })

  it('agrège Nombre/Montant "En transit" par rôle (RC/CDS/DS/CB) depuis EN_TRANSIT', async () => {
    findAll.mockResolvedValue([
      { code_statut: 'DA_TRANSMISE_DEM_RC', montant_demande: 100 },
      { code_statut: 'FAD_TRANSMISE_RC_CDS', montant_demande: 200 },
      { code_statut: 'FAD_TRANSMISE_CB_DS', montant_demande: 300 },
      { code_statut: 'FAD_A_COMMANDER', montant_demande: 400 },
    ])

    const result = await getSynthese(DEMANDEUR)

    expect(result.enTransit).toEqual({
      RC: { nombre: 1, montant: 100 },
      CDS: { nombre: 1, montant: 200 },
      DS: { nombre: 1, montant: 300 },
      CB: { nombre: 1, montant: 400 },
    })
  })

  it('ignore les statuts sans EN_TRANSIT (DEM ou terminal) dans la tuile "En transit"', async () => {
    findAll.mockResolvedValue([
      { code_statut: 'DA_EN_PREPARATION', montant_demande: 50 },
      { code_statut: 'FAD_COMMANDEE', montant_demande: 60 },
      { code_statut: 'DA_REJETEE_RC', montant_demande: 70 },
    ])

    const result = await getSynthese(DEMANDEUR)

    expect(result.enTransit).toEqual({
      RC: { nombre: 0, montant: 0 },
      CDS: { nombre: 0, montant: 0 },
      DS: { nombre: 0, montant: 0 },
      CB: { nombre: 0, montant: 0 },
    })
  })

  it('FAD_COMMANDEE compte dans "Commande", jamais dans "En cours"', async () => {
    findAll.mockResolvedValue([{ code_statut: 'FAD_COMMANDEE', montant_demande: 1000 }])
    const result = await getSynthese(DEMANDEUR)
    expect(result.mesDemandes).toEqual({ enCours: { nombre: 0, montant: 0 }, commande: { nombre: 1, montant: 1000 } })
  })

  it('un statut rejeté/annulé ne compte ni dans "En cours" ni dans "Commande"', async () => {
    findAll.mockResolvedValue([{ code_statut: 'DA_REJETEE_RC', montant_demande: 500 }])
    const result = await getSynthese(DEMANDEUR)
    expect(result.mesDemandes).toEqual({ enCours: { nombre: 0, montant: 0 }, commande: { nombre: 0, montant: 0 } })
  })

  it('tout le reste (non terminal, hors FAD_COMMANDEE, hors DA_EN_PREPARATION) compte dans "En cours"', async () => {
    findAll.mockResolvedValue([
      { code_statut: 'DA_TRANSMISE_DEM_RC', montant_demande: 15 },
      { code_statut: 'FAD_TRANSMISE_RC_CDS', montant_demande: 20 },
    ])
    const result = await getSynthese(DEMANDEUR)
    expect(result.mesDemandes.enCours).toEqual({ nombre: 2, montant: 35 })
  })

  // Bug corrigé le 15/09/2026 (signalé par l'utilisateur, étendu depuis la vue RC) : un brouillon
  // jamais transmis reste la propriété du demandeur — ne compte pas dans "Mes demandes : En cours".
  it('DA_EN_PREPARATION est exclue de "Mes demandes : En cours" (brouillon jamais transmis)', async () => {
    findAll.mockResolvedValue([
      { code_statut: 'DA_EN_PREPARATION', montant_demande: 999 },
      { code_statut: 'FAD_TRANSMISE_RC_CDS', montant_demande: 20 },
    ])
    const result = await getSynthese(DEMANDEUR)
    expect(result.mesDemandes.enCours).toEqual({ nombre: 1, montant: 20 })
  })

  it('interroge uniquement les DA/FAD du demandeur appelant', async () => {
    findAll.mockResolvedValue([])
    await getSynthese(DEMANDEUR)
    expect(findAll).toHaveBeenCalledWith(expect.objectContaining({ matriculeDemandeurIn: [DEMANDEUR] }))
  })

  // Écran de suivi RC (15/09/2026, second chantier) : mêmes tuiles, scopées sur la cellule du RC.
  describe('vue RC (écran de suivi RC)', () => {
    beforeEach(() => {
      findActiveByMatricule.mockResolvedValue([{ id_role: 1, type_role: 'RC', id_cellule: ID_CELLULE_RC, id_service: null, id_direction: null }])
      celluleFindById.mockResolvedValue({ id_cellule: ID_CELLULE_RC, id_service: ID_SERVICE, code_cellule: 'C1', libelle_cellule: 'C1', actif: true })
      findAllByCellule.mockResolvedValue([{ matricule: DEMANDEUR, nom: 'DUPONT', prenom: 'Jean', fonction: 'Agent', id_cellule: ID_CELLULE_RC, actif: true }])
    })

    it('interroge les DA/FAD des demandeurs de la cellule, pas celles du RC lui-même', async () => {
      findAll.mockResolvedValue([])
      await getSynthese(RC)
      expect(findAllByCellule).toHaveBeenCalledWith(ID_CELLULE_RC)
      expect(findAll).toHaveBeenCalledWith(expect.objectContaining({ matriculeDemandeurIn: [DEMANDEUR] }))
    })

    it('"En transit" ne compte que CDS/DS/CB — jamais RC, même sur un statut EN_TRANSIT=RC', async () => {
      findAll.mockResolvedValue([
        { code_statut: 'DA_TRANSMISE_DEM_RC', montant_demande: 100 },
        { code_statut: 'FAD_TRANSMISE_RC_CDS', montant_demande: 200 },
        { code_statut: 'FAD_TRANSMISE_CB_DS', montant_demande: 300 },
        { code_statut: 'FAD_A_COMMANDER', montant_demande: 400 },
      ])

      const result = await getSynthese(RC)

      expect(result.enTransit).toEqual({
        RC: { nombre: 0, montant: 0 },
        CDS: { nombre: 1, montant: 200 },
        DS: { nombre: 1, montant: 300 },
        CB: { nombre: 1, montant: 400 },
      })
    })

    // Bug corrigé le 15/09/2026 (même correctif que l'onglet "En cours" du suivi RC) : un brouillon
    // encore chez le demandeur, jamais transmis, ne doit apparaître dans aucune tuile RC.
    it('DA_EN_PREPARATION est exclue de "Demandes de la cellule" (mesDemandes)', async () => {
      findAll.mockResolvedValue([
        { code_statut: 'DA_EN_PREPARATION', montant_demande: 999 },
        { code_statut: 'FAD_TRANSMISE_RC_CDS', montant_demande: 50 },
      ])

      const result = await getSynthese(RC)

      expect(result.mesDemandes.enCours).toEqual({ nombre: 1, montant: 50 })
    })
  })
})

const DA_PRETE = {
  ...DA,
  objet_demandeur: 'Achat de fournitures diverses',
  description_demandeur: 'Description suffisante',
  montant_demande: 1000,
  id_fournisseur_retenu: 77,
}

const ACTEUR_DEMANDEUR = { matricule: DEMANDEUR, nom: 'DUPONT', prenom: 'Jean', fonction: 'Agent', id_cellule: ID_CELLULE_RC, actif: true }
const ROLE_RC_EFFECTIF = { idRole: 1, typeRole: 'RC', idCellule: ID_CELLULE_RC, idService: null, idDirection: null, idSuppleance: null }

describe('transmettreRc', () => {
  it('rejette sans authentification (401)', async () => {
    await expect(transmettreRc(null, 1)).rejects.toMatchObject({ status: 401 })
  })

  it('rejette si la DA est introuvable (404)', async () => {
    findById.mockResolvedValue(null)
    await expect(transmettreRc(DEMANDEUR, 1)).rejects.toMatchObject({ status: 404 })
  })

  it('rejette si le statut ne permet pas la transmission (409)', async () => {
    findIdServiceByMatricule.mockResolvedValue(ID_SERVICE)
    findById.mockResolvedValue({ ...DA_PRETE, code_statut: 'DA_TRANSMISE_DEM_RC' })
    await expect(transmettreRc(DEMANDEUR, 1)).rejects.toMatchObject({ status: 409 })
  })

  it('rejette une DA incomplète — objet trop court (409)', async () => {
    findIdServiceByMatricule.mockResolvedValue(ID_SERVICE)
    findById.mockResolvedValue({ ...DA_PRETE, objet_demandeur: 'trop court' })
    await expect(transmettreRc(DEMANDEUR, 1)).rejects.toMatchObject({ status: 409 })
  })

  it('rejette une DA sans fournisseur retenu (409)', async () => {
    findIdServiceByMatricule.mockResolvedValue(ID_SERVICE)
    findById.mockResolvedValue({ ...DA_PRETE, id_fournisseur_retenu: null })
    await expect(transmettreRc(DEMANDEUR, 1)).rejects.toMatchObject({ status: 409 })
  })

  it('rejette une DA Hors marché sans aucune entreprise consultée (409)', async () => {
    findIdServiceByMatricule.mockResolvedValue(ID_SERVICE)
    findById.mockResolvedValue({ ...DA_PRETE, procedure_achat: 'HORS_MARCHE' })
    devisFindAllByDemandeAchat.mockResolvedValue([])
    await expect(transmettreRc(DEMANDEUR, 1)).rejects.toMatchObject({ status: 409 })
  })

  // Bug corrigé le 15/09/2026 (signalé par l'utilisateur) : au moins une entreprise consultée ne
  // suffit pas, chacune doit avoir son devis (PDF) déposé — pas seulement être ajoutée à la liste.
  it('rejette une DA Hors marché si une entreprise consultée n\'a pas de devis déposé (409)', async () => {
    findIdServiceByMatricule.mockResolvedValue(ID_SERVICE)
    findById.mockResolvedValue({ ...DA_PRETE, procedure_achat: 'HORS_MARCHE' })
    devisFindAllByDemandeAchat.mockResolvedValue([
      { id_devis: 1, nom_fichier_original: 'devis1.pdf' },
      { id_devis: 2, nom_fichier_original: null },
    ])
    await expect(transmettreRc(DEMANDEUR, 1)).rejects.toMatchObject({ status: 409 })
  })

  // Le devis reste facultatif en procédure Marché (décision du 07/09/2026, inchangée) — seul le
  // numéro de marché (NUMMARCHE ou ID_MARCHE_TIERS) est exigé, vérifié séparément ci-dessous.
  it('rejette une DA Marché sans numéro de marché identifié, même avec un fournisseur retenu (409)', async () => {
    findIdServiceByMatricule.mockResolvedValue(ID_SERVICE)
    findById.mockResolvedValue({ ...DA_PRETE, nummarche: null, id_marche_tiers: null })
    await expect(transmettreRc(DEMANDEUR, 1)).rejects.toMatchObject({ status: 409 })
  })

  it('transmet une DA Marché complète (marché du service) — DA_TRANSMISE_DEM_RC, sans suppléance', async () => {
    findIdServiceByMatricule.mockResolvedValue(ID_SERVICE)
    findById.mockResolvedValue({ ...DA_PRETE, nummarche: 'M2026001', id_marche_tiers: null })
    historiqueCreate.mockResolvedValue({})

    await transmettreRc(DEMANDEUR, 1)

    expect(historiqueCreate).toHaveBeenCalledWith(
      expect.objectContaining({ id_demande_achat: 1, code_statut: 'DA_TRANSMISE_DEM_RC', matricule_acteur: DEMANDEUR, id_suppleance: null }),
    )
  })

  it('transmet une DA Marché complète (marché tiers, NUMMARCHE null mais ID_MARCHE_TIERS renseigné)', async () => {
    findIdServiceByMatricule.mockResolvedValue(ID_SERVICE)
    findById.mockResolvedValue({ ...DA_PRETE, nummarche: null, id_marche_tiers: 42 })
    historiqueCreate.mockResolvedValue({})

    await transmettreRc(DEMANDEUR, 1)

    expect(historiqueCreate).toHaveBeenCalledWith(expect.objectContaining({ code_statut: 'DA_TRANSMISE_DEM_RC' }))
  })

  it('transmet une DA Hors marché quand toutes les entreprises consultées ont un devis déposé', async () => {
    findIdServiceByMatricule.mockResolvedValue(ID_SERVICE)
    findById.mockResolvedValue({ ...DA_PRETE, procedure_achat: 'HORS_MARCHE' })
    devisFindAllByDemandeAchat.mockResolvedValue([
      { id_devis: 1, nom_fichier_original: 'devis1.pdf' },
      { id_devis: 2, nom_fichier_original: 'devis2.pdf' },
    ])
    historiqueCreate.mockResolvedValue({})

    await transmettreRc(DEMANDEUR, 1)

    expect(historiqueCreate).toHaveBeenCalledWith(expect.objectContaining({ code_statut: 'DA_TRANSMISE_DEM_RC' }))
  })
})

describe('decisionRc', () => {
  const DA_TRANSMISE = { ...DA, code_statut: 'DA_TRANSMISE_DEM_RC' }

  beforeEach(() => {
    findById.mockResolvedValue(DA_TRANSMISE)
    findByMatricule.mockResolvedValue(ACTEUR_DEMANDEUR)
    assertHasEffectiveRole.mockResolvedValue(ROLE_RC_EFFECTIF)
    historiqueCreate.mockResolvedValue({})
  })

  it('rejette sans authentification (401)', async () => {
    await expect(decisionRc(null, 1, { decision: 'VALIDER' })).rejects.toMatchObject({ status: 401 })
  })

  it('rejette une entrée invalide (400)', async () => {
    await expect(decisionRc(RC, 1, { decision: 'AUTRE_CHOSE' })).rejects.toMatchObject({ status: 400 })
  })

  it('exige un commentaire pour toute décision autre que VALIDER (400)', async () => {
    await expect(decisionRc(RC, 1, { decision: 'REJETER' })).rejects.toMatchObject({ status: 400 })
  })

  it('rejette si la DA est introuvable (404)', async () => {
    findById.mockResolvedValue(null)
    await expect(decisionRc(RC, 1, { decision: 'VALIDER' })).rejects.toMatchObject({ status: 404 })
  })

  it('rejette si la DA n\'est plus au statut attendu (409)', async () => {
    findById.mockResolvedValue({ ...DA_TRANSMISE, code_statut: 'DA_EN_PREPARATION' })
    await expect(decisionRc(RC, 1, { decision: 'VALIDER' })).rejects.toMatchObject({ status: 409 })
  })

  it('rejette (403) si l\'appelant n\'est pas RC sur la cellule du demandeur — propagé par assertHasEffectiveRole', async () => {
    assertHasEffectiveRole.mockRejectedValue(Object.assign(new Error('Droits insuffisants'), { status: 403 }))
    await expect(decisionRc(RC, 1, { decision: 'VALIDER' })).rejects.toMatchObject({ status: 403 })
  })

  it('valider produit DA_VALIDEE_RC sans exiger de commentaire', async () => {
    await decisionRc(RC, 1, { decision: 'VALIDER' })
    expect(historiqueCreate).toHaveBeenCalledWith(
      expect.objectContaining({ code_statut: 'DA_VALIDEE_RC', matricule_acteur: RC, commentaire_statut: null }),
    )
  })

  it('rejeter produit DA_REJETEE_RC avec le commentaire fourni', async () => {
    await decisionRc(RC, 1, { decision: 'REJETER', commentaireStatut: 'Achat non pertinent' })
    expect(historiqueCreate).toHaveBeenCalledWith(
      expect.objectContaining({ code_statut: 'DA_REJETEE_RC', commentaire_statut: 'Achat non pertinent' }),
    )
  })

  it('annuler produit DA_ANNULEE_RC', async () => {
    await decisionRc(RC, 1, { decision: 'ANNULER', commentaireStatut: 'Besoin caduc' })
    expect(historiqueCreate).toHaveBeenCalledWith(expect.objectContaining({ code_statut: 'DA_ANNULEE_RC' }))
  })

  it('demander un complément produit DA_A_COMPLETER_RC', async () => {
    await decisionRc(RC, 1, { decision: 'COMPLEMENT', commentaireStatut: 'Pièce manquante' })
    expect(historiqueCreate).toHaveBeenCalledWith(expect.objectContaining({ code_statut: 'DA_A_COMPLETER_RC' }))
  })

  it('trace l\'ID_SUPPLEANCE quand l\'appelant agit en tant que suppléant', async () => {
    assertHasEffectiveRole.mockResolvedValue({ ...ROLE_RC_EFFECTIF, idSuppleance: 42 })
    await decisionRc(RC, 1, { decision: 'VALIDER' })
    expect(historiqueCreate).toHaveBeenCalledWith(expect.objectContaining({ id_suppleance: 42 }))
  })
})

describe('transmettreFad', () => {
  const FAD_INPUT = {
    codeSite: 'S1',
    codeSecteur: 'SEC1',
    codeCug: 'CUG1',
    typeAchat: 'FOURNITURES',
    imputationComptable: 'FONCTIONNEMENT',
  }
  const DA_VALIDEE = { ...DA, code_statut: 'DA_VALIDEE_RC' }

  beforeEach(() => {
    findById.mockResolvedValue(DA_VALIDEE)
    findByMatricule.mockResolvedValue(ACTEUR_DEMANDEUR)
    assertHasEffectiveRole.mockResolvedValue(ROLE_RC_EFFECTIF)
    update.mockResolvedValue(DA_VALIDEE)
    historiqueCreate.mockResolvedValue({})
  })

  it('rejette sans authentification (401)', async () => {
    await expect(transmettreFad(null, 1, FAD_INPUT)).rejects.toMatchObject({ status: 401 })
  })

  it('rejette une entrée invalide (400)', async () => {
    await expect(transmettreFad(RC, 1, { ...FAD_INPUT, codeSite: '' })).rejects.toMatchObject({ status: 400 })
  })

  it('exige numeroOperation en investissement (400)', async () => {
    await expect(
      transmettreFad(RC, 1, { ...FAD_INPUT, imputationComptable: 'INVESTISSEMENT' }),
    ).rejects.toMatchObject({ status: 400 })
  })

  it('rejette si la DA n\'est ni DA_VALIDEE_RC ni FAD_A_COMPLETER_CDS (409)', async () => {
    findById.mockResolvedValue({ ...DA_VALIDEE, code_statut: 'DA_EN_PREPARATION' })
    await expect(transmettreFad(RC, 1, FAD_INPUT)).rejects.toMatchObject({ status: 409 })
  })

  it('accepte la reprise depuis FAD_A_COMPLETER_CDS', async () => {
    findById.mockResolvedValue({ ...DA_VALIDEE, code_statut: 'FAD_A_COMPLETER_CDS' })
    await transmettreFad(RC, 1, FAD_INPUT)
    expect(historiqueCreate).toHaveBeenCalledWith(expect.objectContaining({ code_statut: 'FAD_TRANSMISE_RC_CDS' }))
  })

  it('écrit la localisation/imputation puis transmet — FAD_TRANSMISE_RC_CDS', async () => {
    await transmettreFad(RC, 1, { ...FAD_INPUT, imputationComptable: 'INVESTISSEMENT', numeroOperation: 'OP123' })

    expect(update).toHaveBeenCalledWith(
      1,
      expect.objectContaining({
        code_site: 'S1',
        code_secteur: 'SEC1',
        code_cug: 'CUG1',
        type_achat: 'FOURNITURES',
        imputation_comptable: 'INVESTISSEMENT',
        numero_operation: 'OP123',
      }),
    )
    expect(historiqueCreate).toHaveBeenCalledWith(
      expect.objectContaining({ id_demande_achat: 1, code_statut: 'FAD_TRANSMISE_RC_CDS', matricule_acteur: RC }),
    )
  })

  it('la reformulation RC écrit OBJET_RC/DESCRIPTION_RC seuls, jamais OBJET_DEMANDEUR/DESCRIPTION_DEMANDEUR (décision du 15/09/2026)', async () => {
    await transmettreFad(RC, 1, { ...FAD_INPUT, objet: 'Objet reformulé par le RC pour le CDS', description: 'Description reformulée' })

    const patch = update.mock.calls[0][1]
    expect(patch.objet_rc).toBe('Objet reformulé par le RC pour le CDS')
    expect(patch.description_rc).toBe('Description reformulée')
    expect(patch.objet_demandeur).toBeUndefined()
    expect(patch.description_demandeur).toBeUndefined()
  })

  it('force numero_operation à null en fonctionnement, même si fourni', async () => {
    await transmettreFad(RC, 1, { ...FAD_INPUT, numeroOperation: 'OP999' })
    expect(update).toHaveBeenCalledWith(1, expect.objectContaining({ numero_operation: null }))
  })
})

const ROLE_CDS_EFFECTIF = { idRole: 2, typeRole: 'CDS', idCellule: null, idService: ID_SERVICE, idDirection: null, idSuppleance: null }

describe('decisionCds', () => {
  const FAD_TRANSMISE_CDS = { ...DA, code_statut: 'FAD_TRANSMISE_RC_CDS' }

  beforeEach(() => {
    findById.mockResolvedValue(FAD_TRANSMISE_CDS)
    assertHasEffectiveRole.mockResolvedValue(ROLE_CDS_EFFECTIF)
    historiqueCreate.mockResolvedValue({})
  })

  it('rejette sans authentification (401)', async () => {
    await expect(decisionCds(null, 1, { decision: 'VALIDER' })).rejects.toMatchObject({ status: 401 })
  })

  it('rejette une entrée invalide (400)', async () => {
    await expect(decisionCds(RC, 1, { decision: 'AUTRE_CHOSE' })).rejects.toMatchObject({ status: 400 })
  })

  it('exige un commentaire pour toute décision autre que VALIDER (400)', async () => {
    await expect(decisionCds(RC, 1, { decision: 'ANNULER' })).rejects.toMatchObject({ status: 400 })
  })

  it('rejette si la FAD est introuvable (404)', async () => {
    findById.mockResolvedValue(null)
    await expect(decisionCds(RC, 1, { decision: 'VALIDER' })).rejects.toMatchObject({ status: 404 })
  })

  it('rejette si la FAD n\'est plus au statut attendu (409)', async () => {
    findById.mockResolvedValue({ ...FAD_TRANSMISE_CDS, code_statut: 'DA_VALIDEE_RC' })
    await expect(decisionCds(RC, 1, { decision: 'VALIDER' })).rejects.toMatchObject({ status: 409 })
  })

  it('propage le 403 d\'assertHasEffectiveRole (mauvais périmètre/rôle)', async () => {
    assertHasEffectiveRole.mockRejectedValue(Object.assign(new Error('Droits insuffisants'), { status: 403 }))
    await expect(decisionCds(RC, 1, { decision: 'VALIDER' })).rejects.toMatchObject({ status: 403 })
  })

  it('scope l\'autorisation sur ID_SERVICE de la FAD, pas la cellule', async () => {
    await decisionCds(RC, 1, { decision: 'VALIDER' })
    expect(assertHasEffectiveRole).toHaveBeenCalledWith(RC, 'CDS', ID_SERVICE)
  })

  it('valider produit FAD_VALIDEE_CDS', async () => {
    await decisionCds(RC, 1, { decision: 'VALIDER' })
    expect(historiqueCreate).toHaveBeenCalledWith(expect.objectContaining({ code_statut: 'FAD_VALIDEE_CDS', commentaire_statut: null }))
  })

  it('rejeter produit FAD_REJETEE_CDS avec le commentaire fourni', async () => {
    await decisionCds(RC, 1, { decision: 'REJETER', commentaireStatut: 'Non conforme' })
    expect(historiqueCreate).toHaveBeenCalledWith(expect.objectContaining({ code_statut: 'FAD_REJETEE_CDS', commentaire_statut: 'Non conforme' }))
  })

  it('annuler produit FAD_ANNULEE_CDS', async () => {
    await decisionCds(RC, 1, { decision: 'ANNULER', commentaireStatut: 'Besoin caduc' })
    expect(historiqueCreate).toHaveBeenCalledWith(expect.objectContaining({ code_statut: 'FAD_ANNULEE_CDS' }))
  })

  it('demander un complément produit FAD_A_COMPLETER_CDS', async () => {
    await decisionCds(RC, 1, { decision: 'COMPLEMENT', commentaireStatut: 'Pièce manquante' })
    expect(historiqueCreate).toHaveBeenCalledWith(expect.objectContaining({ code_statut: 'FAD_A_COMPLETER_CDS' }))
  })

  it('trace l\'ID_SUPPLEANCE quand l\'appelant agit en tant que suppléant', async () => {
    assertHasEffectiveRole.mockResolvedValue({ ...ROLE_CDS_EFFECTIF, idSuppleance: 55 })
    await decisionCds(RC, 1, { decision: 'VALIDER' })
    expect(historiqueCreate).toHaveBeenCalledWith(expect.objectContaining({ id_suppleance: 55 }))
  })
})

describe('transmettreCb', () => {
  const FAD_VALIDEE_CDS = { ...DA, code_statut: 'FAD_VALIDEE_CDS' }

  beforeEach(() => {
    findById.mockResolvedValue(FAD_VALIDEE_CDS)
    assertHasEffectiveRole.mockResolvedValue(ROLE_CDS_EFFECTIF)
    historiqueCreate.mockResolvedValue({})
  })

  it('rejette sans authentification (401)', async () => {
    await expect(transmettreCb(null, 1)).rejects.toMatchObject({ status: 401 })
  })

  it('rejette si la FAD est introuvable (404)', async () => {
    findById.mockResolvedValue(null)
    await expect(transmettreCb(RC, 1)).rejects.toMatchObject({ status: 404 })
  })

  it('rejette si la FAD n\'est pas FAD_VALIDEE_CDS (409)', async () => {
    findById.mockResolvedValue({ ...FAD_VALIDEE_CDS, code_statut: 'FAD_TRANSMISE_RC_CDS' })
    await expect(transmettreCb(RC, 1)).rejects.toMatchObject({ status: 409 })
  })

  it('propage le 403 d\'assertHasEffectiveRole', async () => {
    assertHasEffectiveRole.mockRejectedValue(Object.assign(new Error('Droits insuffisants'), { status: 403 }))
    await expect(transmettreCb(RC, 1)).rejects.toMatchObject({ status: 403 })
  })

  it('transmet à la CB — FAD_TRANSMISE_CDS_CB', async () => {
    await transmettreCb(RC, 1)
    expect(historiqueCreate).toHaveBeenCalledWith(
      expect.objectContaining({ id_demande_achat: 1, code_statut: 'FAD_TRANSMISE_CDS_CB', matricule_acteur: RC, commentaire_statut: null }),
    )
  })
})

const ROLE_CB_EFFECTIF = { idRole: 3, typeRole: 'CB', idCellule: null, idService: ID_SERVICE, idDirection: null, idSuppleance: null }

describe('decisionCb', () => {
  const FAD_TRANSMISE_CB = { ...DA, code_statut: 'FAD_TRANSMISE_CDS_CB' }

  beforeEach(() => {
    findById.mockResolvedValue(FAD_TRANSMISE_CB)
    assertHasEffectiveRole.mockResolvedValue(ROLE_CB_EFFECTIF)
    update.mockResolvedValue(FAD_TRANSMISE_CB)
    historiqueCreate.mockResolvedValue({})
  })

  it('rejette sans authentification (401)', async () => {
    await expect(decisionCb(null, 1, { decision: 'VALIDER' })).rejects.toMatchObject({ status: 401 })
  })

  it('rejette une entrée invalide — décision inconnue (400)', async () => {
    await expect(decisionCb(CB, 1, { decision: 'ANNULER' })).rejects.toMatchObject({ status: 400 })
  })

  it('exige un commentaire pour toute décision autre que VALIDER (400)', async () => {
    await expect(decisionCb(CB, 1, { decision: 'REJETER' })).rejects.toMatchObject({ status: 400 })
  })

  it('exige numeroOperation si imputationComptable=INVESTISSEMENT (400)', async () => {
    await expect(decisionCb(CB, 1, { decision: 'VALIDER', imputationComptable: 'INVESTISSEMENT' })).rejects.toMatchObject({ status: 400 })
  })

  it('rejette si la FAD est introuvable (404)', async () => {
    findById.mockResolvedValue(null)
    await expect(decisionCb(CB, 1, { decision: 'VALIDER' })).rejects.toMatchObject({ status: 404 })
  })

  it('rejette si la FAD n\'est ni FAD_TRANSMISE_CDS_CB ni FAD_MODIFIEE_TRANSMISE_RC_CB (409)', async () => {
    findById.mockResolvedValue({ ...FAD_TRANSMISE_CB, code_statut: 'FAD_VALIDEE_CDS' })
    await expect(decisionCb(CB, 1, { decision: 'VALIDER' })).rejects.toMatchObject({ status: 409 })
  })

  it('accepte la reprise depuis FAD_MODIFIEE_TRANSMISE_RC_CB', async () => {
    findById.mockResolvedValue({ ...FAD_TRANSMISE_CB, code_statut: 'FAD_MODIFIEE_TRANSMISE_RC_CB' })
    await decisionCb(CB, 1, { decision: 'VALIDER' })
    expect(historiqueCreate).toHaveBeenCalledWith(expect.objectContaining({ code_statut: 'FAD_VALIDEE_CB' }))
  })

  it('propage le 403 d\'assertHasEffectiveRole', async () => {
    assertHasEffectiveRole.mockRejectedValue(Object.assign(new Error('Droits insuffisants'), { status: 403 }))
    await expect(decisionCb(CB, 1, { decision: 'VALIDER' })).rejects.toMatchObject({ status: 403 })
  })

  it('valider sans champ budgétaire produit FAD_VALIDEE_CB sans appeler update()', async () => {
    await decisionCb(CB, 1, { decision: 'VALIDER' })
    expect(update).not.toHaveBeenCalled()
    expect(historiqueCreate).toHaveBeenCalledWith(expect.objectContaining({ code_statut: 'FAD_VALIDEE_CB', commentaire_statut: null }))
  })

  it('rejeter produit FAD_REJETEE_CB avec le commentaire fourni', async () => {
    await decisionCb(CB, 1, { decision: 'REJETER', commentaireStatut: 'Crédits indisponibles' })
    expect(historiqueCreate).toHaveBeenCalledWith(expect.objectContaining({ code_statut: 'FAD_REJETEE_CB', commentaire_statut: 'Crédits indisponibles' }))
  })

  it('modifier produit FAD_A_MODIFIER_CB', async () => {
    await decisionCb(CB, 1, { decision: 'MODIFIER', commentaireStatut: 'Imputation incorrecte' })
    expect(historiqueCreate).toHaveBeenCalledWith(expect.objectContaining({ code_statut: 'FAD_A_MODIFIER_CB' }))
  })

  it('la CB peut corriger les champs budgétaires/comptables au même appel que sa décision', async () => {
    await decisionCb(CB, 1, { decision: 'VALIDER', codeCug: 'CUG9', typeAchat: 'TRAVAUX', imputationComptable: 'INVESTISSEMENT', numeroOperation: 'OP42' })
    expect(update).toHaveBeenCalledWith(
      1,
      expect.objectContaining({ code_cug: 'CUG9', type_achat: 'TRAVAUX', imputation_comptable: 'INVESTISSEMENT', numero_operation: 'OP42' }),
    )
  })

  it('bascule en FONCTIONNEMENT efface numero_operation', async () => {
    await decisionCb(CB, 1, { decision: 'VALIDER', imputationComptable: 'FONCTIONNEMENT' })
    expect(update).toHaveBeenCalledWith(1, expect.objectContaining({ numero_operation: null }))
  })

  it('jamais de suppléance tracée pour CB — dispositif exclu en base', async () => {
    await decisionCb(CB, 1, { decision: 'VALIDER' })
    expect(historiqueCreate).toHaveBeenCalledWith(expect.objectContaining({ id_suppleance: null }))
  })
})

describe('retransmettreCb', () => {
  const FAD_A_MODIFIER = { ...DA, code_statut: 'FAD_A_MODIFIER_CB' }

  beforeEach(() => {
    findById.mockResolvedValue(FAD_A_MODIFIER)
    findByMatricule.mockResolvedValue(ACTEUR_DEMANDEUR)
    assertHasEffectiveRole.mockResolvedValue(ROLE_RC_EFFECTIF)
    update.mockResolvedValue(FAD_A_MODIFIER)
    historiqueCreate.mockResolvedValue({})
  })

  it('rejette sans authentification (401)', async () => {
    await expect(retransmettreCb(null, 1, {})).rejects.toMatchObject({ status: 401 })
  })

  it('rejette si la FAD n\'est pas FAD_A_MODIFIER_CB (409)', async () => {
    findById.mockResolvedValue({ ...FAD_A_MODIFIER, code_statut: 'FAD_VALIDEE_CB' })
    await expect(retransmettreCb(RC, 1, {})).rejects.toMatchObject({ status: 409 })
  })

  it('propage le 403 d\'assertHasEffectiveRole', async () => {
    assertHasEffectiveRole.mockRejectedValue(Object.assign(new Error('Droits insuffisants'), { status: 403 }))
    await expect(retransmettreCb(RC, 1, {})).rejects.toMatchObject({ status: 403 })
  })

  it('retransmet sans aucun champ fourni — aucun appel à update()', async () => {
    await retransmettreCb(RC, 1, {})
    expect(update).not.toHaveBeenCalled()
    expect(historiqueCreate).toHaveBeenCalledWith(
      expect.objectContaining({ id_demande_achat: 1, code_statut: 'FAD_MODIFIEE_TRANSMISE_RC_CB', matricule_acteur: RC }),
    )
  })

  it('ne corrige que les champs fournis (partiel)', async () => {
    await retransmettreCb(RC, 1, { codeCug: 'CUG-CORRIGE' })
    expect(update).toHaveBeenCalledWith(1, expect.objectContaining({ code_cug: 'CUG-CORRIGE' }))
    const patch = update.mock.calls[0][1]
    expect(patch.code_site).toBeUndefined()
  })

  it('la reformulation RC écrit OBJET_RC/DESCRIPTION_RC seuls (décision du 15/09/2026)', async () => {
    await retransmettreCb(RC, 1, { objet: 'Objet corrigé après demande de la CB', description: 'Description corrigée' })
    const patch = update.mock.calls[0][1]
    expect(patch.objet_rc).toBe('Objet corrigé après demande de la CB')
    expect(patch.description_rc).toBe('Description corrigée')
    expect(patch.objet_demandeur).toBeUndefined()
    expect(patch.description_demandeur).toBeUndefined()
  })

  it('retransmet directement à la CB, sans repasser par le CDS', async () => {
    await retransmettreCb(RC, 1, { codeSite: 'S2' })
    expect(historiqueCreate).toHaveBeenCalledWith(expect.objectContaining({ code_statut: 'FAD_MODIFIEE_TRANSMISE_RC_CB' }))
  })
})

const ROLE_DS_EFFECTIF = { idRole: 4, typeRole: 'DS', idCellule: null, idService: null, idDirection: 9, idSuppleance: null }
const SERVICE_ROW = { id_service: ID_SERVICE, code_service: 'S1', libelle_service: 'Service 1', id_direction: 9, actif: true }

describe('transmettreDsOuSeuil', () => {
  const FAD_VALIDEE_CB = { ...DA, code_statut: 'FAD_VALIDEE_CB', montant_demande: 1000, imputation_comptable: 'FONCTIONNEMENT' }

  beforeEach(() => {
    findById.mockResolvedValue(FAD_VALIDEE_CB)
    assertHasEffectiveRole.mockResolvedValue(ROLE_CB_EFFECTIF)
    historiqueCreate.mockResolvedValue({})
  })

  it('rejette sans authentification (401)', async () => {
    await expect(transmettreDsOuSeuil(null, 1)).rejects.toMatchObject({ status: 401 })
  })

  it('rejette si la FAD n\'est pas FAD_VALIDEE_CB (409)', async () => {
    findById.mockResolvedValue({ ...FAD_VALIDEE_CB, code_statut: 'FAD_TRANSMISE_CDS_CB' })
    await expect(transmettreDsOuSeuil(CB, 1)).rejects.toMatchObject({ status: 409 })
  })

  it('propage le 403 d\'assertHasEffectiveRole', async () => {
    assertHasEffectiveRole.mockRejectedValue(Object.assign(new Error('Droits insuffisants'), { status: 403 }))
    await expect(transmettreDsOuSeuil(CB, 1)).rejects.toMatchObject({ status: 403 })
  })

  it('absence de ligne de seuil = seuil à 0 → transmission systématique au DS', async () => {
    seuilFindByService.mockResolvedValue(null)
    await transmettreDsOuSeuil(CB, 1)
    expect(historiqueCreate).toHaveBeenCalledWith(expect.objectContaining({ code_statut: 'FAD_TRANSMISE_CB_DS' }))
    expect(historiqueCreate).toHaveBeenCalledTimes(1)
  })

  it('montant >= seuil (fonctionnement) → FAD_TRANSMISE_CB_DS', async () => {
    seuilFindByService.mockResolvedValue({ id_service: ID_SERVICE, seuil_fonctionnement: 500, seuil_investissement: 0 })
    await transmettreDsOuSeuil(CB, 1)
    expect(historiqueCreate).toHaveBeenCalledWith(expect.objectContaining({ code_statut: 'FAD_TRANSMISE_CB_DS' }))
    expect(historiqueCreate).toHaveBeenCalledTimes(1)
  })

  it('montant < seuil (fonctionnement) → FAD_VALIDEE_DS_SEUIL puis chaîne FAD_A_COMMANDER', async () => {
    seuilFindByService.mockResolvedValue({ id_service: ID_SERVICE, seuil_fonctionnement: 5000, seuil_investissement: 0 })
    await transmettreDsOuSeuil(CB, 1)
    expect(historiqueCreate).toHaveBeenNthCalledWith(1, expect.objectContaining({ code_statut: 'FAD_VALIDEE_DS_SEUIL' }))
    expect(historiqueCreate).toHaveBeenNthCalledWith(2, expect.objectContaining({ code_statut: 'FAD_A_COMMANDER', id_suppleance: null }))
  })

  it('utilise seuil_investissement quand IMPUTATION_COMPTABLE=INVESTISSEMENT', async () => {
    findById.mockResolvedValue({ ...FAD_VALIDEE_CB, imputation_comptable: 'INVESTISSEMENT', montant_demande: 100 })
    seuilFindByService.mockResolvedValue({ id_service: ID_SERVICE, seuil_fonctionnement: 99999, seuil_investissement: 50 })
    await transmettreDsOuSeuil(CB, 1)
    expect(historiqueCreate).toHaveBeenCalledWith(expect.objectContaining({ code_statut: 'FAD_TRANSMISE_CB_DS' }))
  })
})

describe('decisionDs', () => {
  const FAD_TRANSMISE_DS = { ...DA, code_statut: 'FAD_TRANSMISE_CB_DS' }

  beforeEach(() => {
    findById.mockResolvedValue(FAD_TRANSMISE_DS)
    serviceFindById.mockResolvedValue(SERVICE_ROW)
    assertHasEffectiveRole.mockResolvedValue(ROLE_DS_EFFECTIF)
    historiqueCreate.mockResolvedValue({})
  })

  it('rejette sans authentification (401)', async () => {
    await expect(decisionDs(null, 1, { decision: 'VALIDER' })).rejects.toMatchObject({ status: 401 })
  })

  it('exige un commentaire pour toute décision autre que VALIDER (400)', async () => {
    await expect(decisionDs(DEMANDEUR, 1, { decision: 'COMPLEMENT' })).rejects.toMatchObject({ status: 400 })
  })

  it('rejette si la FAD n\'est pas FAD_TRANSMISE_CB_DS (409)', async () => {
    findById.mockResolvedValue({ ...FAD_TRANSMISE_DS, code_statut: 'FAD_VALIDEE_CB' })
    await expect(decisionDs(DEMANDEUR, 1, { decision: 'VALIDER' })).rejects.toMatchObject({ status: 409 })
  })

  it('scope l\'autorisation sur ID_DIRECTION du service, pas ID_SERVICE', async () => {
    await decisionDs(DEMANDEUR, 1, { decision: 'VALIDER' })
    expect(assertHasEffectiveRole).toHaveBeenCalledWith(DEMANDEUR, 'DS', 9)
  })

  it('valider produit FAD_VALIDEE_DS', async () => {
    await decisionDs(DEMANDEUR, 1, { decision: 'VALIDER' })
    expect(historiqueCreate).toHaveBeenCalledWith(expect.objectContaining({ code_statut: 'FAD_VALIDEE_DS' }))
  })

  it('rejeter produit FAD_REJETEE_DS', async () => {
    await decisionDs(DEMANDEUR, 1, { decision: 'REJETER', commentaireStatut: 'Non conforme' })
    expect(historiqueCreate).toHaveBeenCalledWith(expect.objectContaining({ code_statut: 'FAD_REJETEE_DS' }))
  })

  it('annuler produit FAD_ANNULEE_DS', async () => {
    await decisionDs(DEMANDEUR, 1, { decision: 'ANNULER', commentaireStatut: 'Besoin caduc' })
    expect(historiqueCreate).toHaveBeenCalledWith(expect.objectContaining({ code_statut: 'FAD_ANNULEE_DS' }))
  })

  it('demander un complément produit FAD_A_COMPLETER_CB (reprise par la CB, pas le RC)', async () => {
    await decisionDs(DEMANDEUR, 1, { decision: 'COMPLEMENT', commentaireStatut: 'Précisions budgétaires' })
    expect(historiqueCreate).toHaveBeenCalledWith(expect.objectContaining({ code_statut: 'FAD_A_COMPLETER_CB' }))
  })
})

describe('transmettreOrdreCb', () => {
  const FAD_VALIDEE_DS = { ...DA, code_statut: 'FAD_VALIDEE_DS' }

  beforeEach(() => {
    findById.mockResolvedValue(FAD_VALIDEE_DS)
    serviceFindById.mockResolvedValue(SERVICE_ROW)
    assertHasEffectiveRole.mockResolvedValue(ROLE_DS_EFFECTIF)
    historiqueCreate.mockResolvedValue({})
  })

  it('rejette sans authentification (401)', async () => {
    await expect(transmettreOrdreCb(null, 1)).rejects.toMatchObject({ status: 401 })
  })

  it('rejette si la FAD n\'est pas FAD_VALIDEE_DS (409)', async () => {
    findById.mockResolvedValue({ ...FAD_VALIDEE_DS, code_statut: 'FAD_TRANSMISE_CB_DS' })
    await expect(transmettreOrdreCb(DEMANDEUR, 1)).rejects.toMatchObject({ status: 409 })
  })

  it('transmet l\'ordre puis chaîne automatiquement sur FAD_A_COMMANDER', async () => {
    await transmettreOrdreCb(DEMANDEUR, 1)
    expect(historiqueCreate).toHaveBeenNthCalledWith(1, expect.objectContaining({ code_statut: 'FAD_TRANSMISE_DS_CB' }))
    expect(historiqueCreate).toHaveBeenNthCalledWith(2, expect.objectContaining({ code_statut: 'FAD_A_COMMANDER', id_suppleance: null }))
  })
})

describe('completerCb', () => {
  const FAD_A_COMPLETER = { ...DA, code_statut: 'FAD_A_COMPLETER_CB' }

  beforeEach(() => {
    findById.mockResolvedValue(FAD_A_COMPLETER)
    assertHasEffectiveRole.mockResolvedValue(ROLE_CB_EFFECTIF)
    update.mockResolvedValue(FAD_A_COMPLETER)
    historiqueCreate.mockResolvedValue({})
  })

  it('rejette sans authentification (401)', async () => {
    await expect(completerCb(null, 1, {})).rejects.toMatchObject({ status: 401 })
  })

  it('rejette si la FAD n\'est pas FAD_A_COMPLETER_CB (409)', async () => {
    findById.mockResolvedValue({ ...FAD_A_COMPLETER, code_statut: 'FAD_TRANSMISE_CB_DS' })
    await expect(completerCb(CB, 1, {})).rejects.toMatchObject({ status: 409 })
  })

  it('exige numeroOperation en investissement (400)', async () => {
    await expect(completerCb(CB, 1, { imputationComptable: 'INVESTISSEMENT' })).rejects.toMatchObject({ status: 400 })
  })

  it('retransmet directement au DS — réutilise FAD_TRANSMISE_CB_DS (pas de duplication)', async () => {
    await completerCb(CB, 1, { codeCug: 'CUG-CORRIGE' })
    expect(update).toHaveBeenCalledWith(1, expect.objectContaining({ code_cug: 'CUG-CORRIGE' }))
    expect(historiqueCreate).toHaveBeenCalledWith(expect.objectContaining({ code_statut: 'FAD_TRANSMISE_CB_DS' }))
  })

  it('sans aucun champ fourni — aucun appel à update()', async () => {
    await completerCb(CB, 1, {})
    expect(update).not.toHaveBeenCalled()
  })
})

describe('commander', () => {
  const FAD_A_COMMANDER = { ...DA, code_statut: 'FAD_A_COMMANDER' }

  beforeEach(() => {
    findById.mockResolvedValue(FAD_A_COMMANDER)
    assertHasEffectiveRole.mockResolvedValue(ROLE_CB_EFFECTIF)
    update.mockResolvedValue(FAD_A_COMMANDER)
    historiqueCreate.mockResolvedValue({})
  })

  it('rejette sans authentification (401)', async () => {
    await expect(commander(null, 1, { montantCommande: 100 })).rejects.toMatchObject({ status: 401 })
  })

  it('rejette une entrée invalide — montant manquant (400)', async () => {
    await expect(commander(CB, 1, {})).rejects.toMatchObject({ status: 400 })
  })

  it('rejette si la FAD n\'est pas FAD_A_COMMANDER (409)', async () => {
    findById.mockResolvedValue({ ...FAD_A_COMMANDER, code_statut: 'FAD_VALIDEE_DS_SEUIL' })
    await expect(commander(CB, 1, { montantCommande: 100 })).rejects.toMatchObject({ status: 409 })
  })

  it('enregistre MONTANT_COMMANDE puis FAD_COMMANDEE', async () => {
    await commander(CB, 1, { montantCommande: 1234.5 })
    expect(update).toHaveBeenCalledWith(1, { montant_commande: 1234.5 })
    expect(historiqueCreate).toHaveBeenCalledWith(expect.objectContaining({ code_statut: 'FAD_COMMANDEE' }))
  })
})

describe('getHistoriqueStatuts', () => {
  const ROW1 = { id_histo: 1, id_demande_achat: 1, code_statut: 'DA_EN_PREPARATION', matricule_acteur: DEMANDEUR, id_suppleance: null, date_heure: '2026-09-08T09:00:00Z', commentaire_statut: null }
  const ROW2 = {
    id_histo: 2,
    id_demande_achat: 1,
    code_statut: 'DA_VALIDEE_RC',
    matricule_acteur: '20002',
    id_suppleance: 77,
    date_heure: '2026-09-09T10:00:00Z',
    commentaire_statut: null,
  }

  beforeEach(() => {
    findById.mockResolvedValue(DA)
    findIdServiceByMatricule.mockResolvedValue(ID_SERVICE)
  })

  it('rejette sans authentification (401)', async () => {
    await expect(getHistoriqueStatuts(null, 1)).rejects.toMatchObject({ status: 401 })
  })

  it('rejette si la DA est introuvable (404)', async () => {
    findById.mockResolvedValue(null)
    await expect(getHistoriqueStatuts(DEMANDEUR, 1)).rejects.toMatchObject({ status: 404 })
  })

  it('même règle d\'accès que getDemandeAchat — un tiers non habilité est rejeté (403)', async () => {
    await expect(getHistoriqueStatuts(AUTRE_DEMANDEUR, 1)).rejects.toMatchObject({ status: 403 })
  })

  it('renvoie une liste vide si aucun historique', async () => {
    historiqueFindAllByDemandeAchat.mockResolvedValue([])
    expect(await getHistoriqueStatuts(DEMANDEUR, 1)).toEqual([])
  })

  it('résout le libellé du statut, le nom de l\'acteur et le commentaire', async () => {
    historiqueFindAllByDemandeAchat.mockResolvedValue([{ ...ROW1, commentaire_statut: 'Achat non pertinent' }])
    findByMatricules.mockResolvedValue([{ matricule: DEMANDEUR, nom: 'DUPONT', prenom: 'Jean', fonction: 'Agent', id_cellule: 1, actif: true }])
    statutFindAll.mockResolvedValue([{ code_statut: 'DA_EN_PREPARATION', libelle: 'DA en préparation', emmeteur: 'DEM', pour_action: null, diffusion: null, en_transit: 'DEM', type_statut: '', commentaire: null }])

    const result = await getHistoriqueStatuts(DEMANDEUR, 1)

    expect(result).toEqual([
      {
        idHisto: 1,
        codeStatut: 'DA_EN_PREPARATION',
        libelleStatut: 'DA en préparation',
        dateHeure: '2026-09-08T09:00:00Z',
        matriculeActeur: DEMANDEUR,
        acteurNomPrenom: 'Jean DUPONT',
        suppleanceLabel: null,
        commentaireStatut: 'Achat non pertinent',
      },
    ])
  })

  it('retombe sur le code brut si le libellé du statut est introuvable', async () => {
    historiqueFindAllByDemandeAchat.mockResolvedValue([ROW1])
    statutFindAll.mockResolvedValue([])

    const [result] = await getHistoriqueStatuts(DEMANDEUR, 1)
    expect(result.libelleStatut).toBe('DA_EN_PREPARATION')
  })

  it('construit le libellé de suppléance à partir du rôle et de l\'acteur titulaire', async () => {
    historiqueFindAllByDemandeAchat.mockResolvedValue([ROW2])
    suppleanceFindById.mockResolvedValue({ id_suppleance: 77, id_role: 5, matricule_suppleant: '20002', date_debut: '2026-09-01', date_fin: '2026-09-15' })
    roleFindById.mockResolvedValue({ id_role: 5, matricule: '20003', type_role: 'RC', id_cellule: 1, id_service: null, id_direction: null, date_debut: '2026-01-01', date_fin: null, actif: true })
    findByMatricules.mockResolvedValue([])
    // Titulaire résolu par matricule unique (findByMatricule, pas findByMatricules).
    findByMatricule.mockResolvedValue({ matricule: '20003', nom: 'MARTIN', prenom: 'Alice', fonction: 'RC', id_cellule: 1, actif: true })

    const [result] = await getHistoriqueStatuts(DEMANDEUR, 1)
    expect(result.suppleanceLabel).toBe('en suppléance de Alice MARTIN')
  })

  it('suppleanceLabel reste null si la suppléance ou le rôle titulaire est introuvable', async () => {
    historiqueFindAllByDemandeAchat.mockResolvedValue([ROW2])
    suppleanceFindById.mockResolvedValue(null)

    const [result] = await getHistoriqueStatuts(DEMANDEUR, 1)
    expect(result.suppleanceLabel).toBeNull()
  })
})

describe('updateDemandeAchat', () => {
  it('rejette si la DA est introuvable (404)', async () => {
    findById.mockResolvedValue(null)

    await expect(updateDemandeAchat(DEMANDEUR, 1, { objet: 'Achat de fournitures' })).rejects.toMatchObject({ status: 404 })
    expect(update).not.toHaveBeenCalled()
  })

  it("rejette si l'appelant n'a pas accès au service de la DA (403)", async () => {
    findById.mockResolvedValue(DA)

    await expect(updateDemandeAchat(AUTRE_DEMANDEUR, 1, { objet: 'Achat de fournitures' })).rejects.toMatchObject({ status: 403 })
    expect(update).not.toHaveBeenCalled()
  })

  it('rejette si la DA a dépassé les statuts modifiables (409)', async () => {
    findById.mockResolvedValue({ ...DA, code_statut: 'FAD_COMMANDEE' })

    await expect(updateDemandeAchat(DEMANDEUR, 1, { objet: 'Achat de fournitures' })).rejects.toMatchObject({ status: 409 })
    expect(update).not.toHaveBeenCalled()
  })

  it('autorise et délègue au repository pour DA_EN_PREPARATION', async () => {
    findById.mockResolvedValue(DA)
    update.mockResolvedValue({ ...DA, objet_demandeur: 'Achat de fournitures', objet_rc: 'Achat de fournitures' })

    await updateDemandeAchat(DEMANDEUR, 1, { objet: 'Achat de fournitures' })

    expect(update).toHaveBeenCalledWith(1, expect.objectContaining({ objet_demandeur: 'Achat de fournitures' }))
  })

  it('synchronise OBJET_RC/DESCRIPTION_RC sur OBJET_DEMANDEUR/DESCRIPTION_DEMANDEUR tant que la DA est éditable par le demandeur (décision du 15/09/2026)', async () => {
    findById.mockResolvedValue(DA)
    update.mockResolvedValue(DA)

    await updateDemandeAchat(DEMANDEUR, 1, { objet: 'Achat de fournitures', description: 'Description mise à jour' })

    expect(update).toHaveBeenCalledWith(
      1,
      expect.objectContaining({
        objet_demandeur: 'Achat de fournitures',
        objet_rc: 'Achat de fournitures',
        description_demandeur: 'Description mise à jour',
        description_rc: 'Description mise à jour',
      }),
    )
  })

  it('autorise pour DA_A_COMPLETER_RC (reprise en place)', async () => {
    findById.mockResolvedValue({ ...DA, code_statut: 'DA_A_COMPLETER_RC' })
    update.mockResolvedValue(DA)

    await updateDemandeAchat(DEMANDEUR, 1, { objet: 'Achat corrigé de fournitures' })

    expect(update).toHaveBeenCalled()
  })

  it('purge les DEVIS_CONSULTE quand la procédure change — décision du 09/09/2026 (devis orphelin)', async () => {
    findById.mockResolvedValue(DA) // procedure_achat: 'MARCHE'
    update.mockResolvedValue({ ...DA, procedure_achat: 'HORS_MARCHE' })

    await updateDemandeAchat(DEMANDEUR, 1, { procedureAchat: 'HORS_MARCHE' })

    expect(deleteAllDevis).toHaveBeenCalledWith(1)
  })

  it('purge aussi les pièces complémentaires (toute la DA) quand la procédure change — décision du 09/09/2026, croquis DA2.pdf', async () => {
    findById.mockResolvedValue(DA) // procedure_achat: 'MARCHE'
    update.mockResolvedValue({ ...DA, procedure_achat: 'HORS_MARCHE' })
    pieceFindAllByDemandeAchat.mockResolvedValue([{ id_piece: 3, storage_path: '1/42/piece.pdf' }])

    await updateDemandeAchat(DEMANDEUR, 1, { procedureAchat: 'HORS_MARCHE' })

    expect(pieceFindAllByDemandeAchat).toHaveBeenCalledWith(1)
    expect(pieceRemove).toHaveBeenCalledWith(3)
    expect(pieceRemoveFile).toHaveBeenCalledWith('1/42/piece.pdf')
  })

  it('ne purge pas les pièces complémentaires quand la procédure ne change pas', async () => {
    findById.mockResolvedValue(DA)
    update.mockResolvedValue(DA)

    await updateDemandeAchat(DEMANDEUR, 1, { objet: 'Achat de fournitures', procedureAchat: 'MARCHE' })

    expect(pieceRemove).not.toHaveBeenCalled()
  })

  it('efface NUMMARCHE/ID_MARCHE_TIERS/ID_FOURNISSEUR_RETENU/MOTIF_CHOIX/LIBELLE_MOTIF_CHOIX/MONTANT_DEMANDE quand la procédure change — bug corrigé le 09/09/2026 (résumé de l\'ancienne procédure restait affiché)', async () => {
    findById.mockResolvedValue({
      ...DA,
      nummarche: 'M2026001',
      id_marche_tiers: null,
      id_fournisseur_retenu: 42,
      motif_choix: 'Prix',
      libelle_motif_choix: null,
      montant_demande: 12500,
    })
    update.mockResolvedValue({ ...DA, procedure_achat: 'HORS_MARCHE' })

    await updateDemandeAchat(DEMANDEUR, 1, { procedureAchat: 'HORS_MARCHE' })

    expect(update).toHaveBeenCalledWith(
      1,
      expect.objectContaining({
        nummarche: null,
        id_marche_tiers: null,
        id_fournisseur_retenu: null,
        motif_choix: null,
        libelle_motif_choix: null,
        montant_demande: 0,
      }),
    )
  })

  it('ne purge pas les DEVIS_CONSULTE quand la procédure ne change pas', async () => {
    findById.mockResolvedValue(DA) // procedure_achat: 'MARCHE'
    update.mockResolvedValue(DA)

    await updateDemandeAchat(DEMANDEUR, 1, { objet: 'Achat de fournitures', procedureAchat: 'MARCHE' })

    expect(deleteAllDevis).not.toHaveBeenCalled()
  })

  it('ne purge pas les DEVIS_CONSULTE quand procedureAchat est omis (autre champ modifié)', async () => {
    findById.mockResolvedValue(DA)
    update.mockResolvedValue(DA)

    await updateDemandeAchat(DEMANDEUR, 1, { objet: 'Achat de fournitures' })

    expect(deleteAllDevis).not.toHaveBeenCalled()
  })
})

describe('selectMarcheDemandeAchat', () => {
  const MARCHE = { nummarche: 'M2026001', utilisable: true, id_fournisseur: 42 }
  const MARCHE_TIERS = { id_marche_tiers: 7, id_service: ID_SERVICE, actif: true, id_fournisseur: 99 }

  it('rejette si les deux champs sont fournis (400)', async () => {
    await expect(selectMarcheDemandeAchat(DEMANDEUR, 1, { nummarche: 'M1', idMarcheTiers: 7 })).rejects.toMatchObject({ status: 400 })
    expect(update).not.toHaveBeenCalled()
  })

  it('rejette si la DA est en procédure hors marché (409)', async () => {
    findById.mockResolvedValue({ ...DA, procedure_achat: 'HORS_MARCHE' })

    await expect(selectMarcheDemandeAchat(DEMANDEUR, 1, { nummarche: 'M2026001', idMarcheTiers: null })).rejects.toMatchObject({
      status: 409,
    })
    expect(update).not.toHaveBeenCalled()
  })

  it('rejette un marché introuvable (404)', async () => {
    findById.mockResolvedValue(DA)
    marcheFindByNummarche.mockResolvedValue(null)

    await expect(selectMarcheDemandeAchat(DEMANDEUR, 1, { nummarche: 'M2026001', idMarcheTiers: null })).rejects.toMatchObject({
      status: 404,
    })
  })

  it('rejette un marché non utilisable (409)', async () => {
    findById.mockResolvedValue(DA)
    marcheFindByNummarche.mockResolvedValue({ ...MARCHE, utilisable: false })

    await expect(selectMarcheDemandeAchat(DEMANDEUR, 1, { nummarche: 'M2026001', idMarcheTiers: null })).rejects.toMatchObject({
      status: 409,
    })
  })

  it("rejette un marché d'un autre service (403)", async () => {
    findById.mockResolvedValue(DA)
    marcheFindByNummarche.mockResolvedValue(MARCHE)
    resolveMarcheIdService.mockResolvedValue(ID_SERVICE_AUTRE)

    await expect(selectMarcheDemandeAchat(DEMANDEUR, 1, { nummarche: 'M2026001', idMarcheTiers: null })).rejects.toMatchObject({
      status: 403,
    })
  })

  it('sélectionne un marché du service et dérive ID_FOURNISSEUR_RETENU/MOTIF_CHOIX', async () => {
    findById.mockResolvedValue(DA)
    marcheFindByNummarche.mockResolvedValue(MARCHE)
    resolveMarcheIdService.mockResolvedValue(ID_SERVICE)
    update.mockResolvedValue(DA)

    await selectMarcheDemandeAchat(DEMANDEUR, 1, { nummarche: 'M2026001', idMarcheTiers: null })

    expect(update).toHaveBeenCalledWith(1, {
      nummarche: 'M2026001',
      id_marche_tiers: null,
      id_fournisseur_retenu: 42,
      motif_choix: 'Prix',
    })
  })

  it("rejette un marché tiers d'un autre service (403)", async () => {
    findById.mockResolvedValue(DA)
    marcheTiersFindById.mockResolvedValue({ ...MARCHE_TIERS, id_service: ID_SERVICE_AUTRE })

    await expect(selectMarcheDemandeAchat(DEMANDEUR, 1, { nummarche: null, idMarcheTiers: 7 })).rejects.toMatchObject({ status: 403 })
  })

  it('sélectionne un marché tiers et dérive ID_FOURNISSEUR_RETENU/MOTIF_CHOIX', async () => {
    findById.mockResolvedValue(DA)
    marcheTiersFindById.mockResolvedValue(MARCHE_TIERS)
    update.mockResolvedValue(DA)

    await selectMarcheDemandeAchat(DEMANDEUR, 1, { nummarche: null, idMarcheTiers: 7 })

    expect(update).toHaveBeenCalledWith(1, {
      nummarche: null,
      id_marche_tiers: 7,
      id_fournisseur_retenu: 99,
      motif_choix: 'Prix',
    })
  })

  it('retire la sélection quand les deux champs sont null', async () => {
    findById.mockResolvedValue({ ...DA, nummarche: 'M2026001', id_fournisseur_retenu: 42, motif_choix: 'Prix' })
    update.mockResolvedValue(DA)

    await selectMarcheDemandeAchat(DEMANDEUR, 1, { nummarche: null, idMarcheTiers: null })

    expect(update).toHaveBeenCalledWith(1, {
      nummarche: null,
      id_marche_tiers: null,
      id_fournisseur_retenu: null,
      motif_choix: null,
      montant_demande: undefined,
    })
  })

  it('transmet montantDemande au repository quand il est fourni (croquis DA.pdf : saisie obligatoire à l\'écran)', async () => {
    findById.mockResolvedValue(DA)
    marcheFindByNummarche.mockResolvedValue(MARCHE)
    resolveMarcheIdService.mockResolvedValue(ID_SERVICE)
    update.mockResolvedValue(DA)

    await selectMarcheDemandeAchat(DEMANDEUR, 1, { nummarche: 'M2026001', idMarcheTiers: null, montantDemande: 12500 })

    expect(update).toHaveBeenCalledWith(1, expect.objectContaining({ montant_demande: 12500 }))
  })

  it('purge les DEVIS_CONSULTE orphelins d\'un précédent essai Hors marché — bug corrigé le 09/09/2026', async () => {
    findById.mockResolvedValue(DA)
    marcheFindByNummarche.mockResolvedValue(MARCHE)
    resolveMarcheIdService.mockResolvedValue(ID_SERVICE)
    update.mockResolvedValue(DA)

    await selectMarcheDemandeAchat(DEMANDEUR, 1, { nummarche: 'M2026001', idMarcheTiers: null })

    expect(deleteAllDevis).toHaveBeenCalledWith(1)
  })

  it('purge aussi les pièces complémentaires du titulaire précédent quand le marché sélectionné change — décision du 09/09/2026', async () => {
    findById.mockResolvedValue(DA)
    marcheFindByNummarche.mockResolvedValue(MARCHE)
    resolveMarcheIdService.mockResolvedValue(ID_SERVICE)
    update.mockResolvedValue(DA)
    pieceFindAllByDemandeAchat.mockResolvedValue([{ id_piece: 4, storage_path: '1/99/piece.pdf' }])

    await selectMarcheDemandeAchat(DEMANDEUR, 1, { nummarche: 'M2026001', idMarcheTiers: null })

    expect(pieceRemove).toHaveBeenCalledWith(4)
    expect(pieceRemoveFile).toHaveBeenCalledWith('1/99/piece.pdf')
  })

  it('ne purge pas les DEVIS_CONSULTE si le marché est invalide (échec avant écriture)', async () => {
    findById.mockResolvedValue(DA)
    marcheFindByNummarche.mockResolvedValue(null)

    await expect(selectMarcheDemandeAchat(DEMANDEUR, 1, { nummarche: 'M2026001', idMarcheTiers: null })).rejects.toMatchObject({
      status: 404,
    })
    expect(deleteAllDevis).not.toHaveBeenCalled()
  })

  it('ne purge pas les DEVIS_CONSULTE ni les pièces complémentaires si le marché resélectionné est identique — préserve un devis/une pièce déjà déposé(e) (PiecesDevisDA, 09/09/2026)', async () => {
    findById.mockResolvedValue({ ...DA, nummarche: 'M2026001', id_marche_tiers: null })
    marcheFindByNummarche.mockResolvedValue(MARCHE)
    resolveMarcheIdService.mockResolvedValue(ID_SERVICE)
    update.mockResolvedValue(DA)

    await selectMarcheDemandeAchat(DEMANDEUR, 1, { nummarche: 'M2026001', idMarcheTiers: null })

    expect(deleteAllDevis).not.toHaveBeenCalled()
    expect(pieceRemove).not.toHaveBeenCalled()
  })
})

describe('listConsultationDemandeAchat', () => {
  it('rejette sans authentification (401)', async () => {
    await expect(listConsultationDemandeAchat(null, 1)).rejects.toMatchObject({ status: 401 })
  })

  it('retourne la liste des candidats mappée', async () => {
    findById.mockResolvedValue({ ...DA, procedure_achat: 'HORS_MARCHE' })
    devisFindAllByDemandeAchat.mockResolvedValue([
      { id_devis: 1, id_demande_achat: 1, id_fournisseur: 42, montant_devis: 1000, nom_fichier_original: 'devis.pdf', storage_path: '1/42/x.pdf', taille_octets: 2048, retenu: true, ordre: 1 },
    ])

    const result = await listConsultationDemandeAchat(DEMANDEUR, 1)

    expect(result).toEqual([
      { idDevis: 1, idFournisseur: 42, montantDevis: 1000, ordre: 1, retenu: true, nomFichierOriginal: 'devis.pdf', tailleOctets: 2048 },
    ])
  })
})

describe('addConsultationCandidat', () => {
  const HORS_MARCHE_DA = { ...DA, procedure_achat: 'HORS_MARCHE' }
  const FOURNISSEURS_DU_SERVICE = [{ id_fournisseur: 42 }, { id_fournisseur: 43 }]

  it('rejette si la DA est en procédure marché (409)', async () => {
    findById.mockResolvedValue(DA)

    await expect(addConsultationCandidat(DEMANDEUR, 1, { idFournisseur: 42 })).rejects.toMatchObject({ status: 409 })
    expect(devisCreate).not.toHaveBeenCalled()
  })

  it("rejette un fournisseur hors du service de la demande (403)", async () => {
    findById.mockResolvedValue(HORS_MARCHE_DA)
    fournisseurFindAll.mockResolvedValue(FOURNISSEURS_DU_SERVICE)

    await expect(addConsultationCandidat(DEMANDEUR, 1, { idFournisseur: 999 })).rejects.toMatchObject({ status: 403 })
    expect(devisCreate).not.toHaveBeenCalled()
  })

  it('rejette au-delà de 5 candidats (409)', async () => {
    findById.mockResolvedValue(HORS_MARCHE_DA)
    fournisseurFindAll.mockResolvedValue(FOURNISSEURS_DU_SERVICE)
    devisFindAllByDemandeAchat.mockResolvedValue(Array.from({ length: 5 }, (_, i) => ({ id_devis: i + 1, id_fournisseur: i + 1 })))

    await expect(addConsultationCandidat(DEMANDEUR, 1, { idFournisseur: 42 })).rejects.toMatchObject({ status: 409 })
    expect(devisCreate).not.toHaveBeenCalled()
  })

  it('rejette un fournisseur déjà consulté (409)', async () => {
    findById.mockResolvedValue(HORS_MARCHE_DA)
    fournisseurFindAll.mockResolvedValue(FOURNISSEURS_DU_SERVICE)
    devisFindAllByDemandeAchat.mockResolvedValue([{ id_devis: 1, id_fournisseur: 42 }])

    await expect(addConsultationCandidat(DEMANDEUR, 1, { idFournisseur: 42 })).rejects.toMatchObject({ status: 409 })
    expect(devisCreate).not.toHaveBeenCalled()
  })

  it('crée immédiatement la ligne DEVIS_CONSULTE (avant tout "Enregistrer" — décision du 09/09/2026)', async () => {
    findById.mockResolvedValue(HORS_MARCHE_DA)
    fournisseurFindAll.mockResolvedValue(FOURNISSEURS_DU_SERVICE)
    devisFindAllByDemandeAchat.mockResolvedValue([])
    devisCreate.mockResolvedValue({
      id_devis: 5,
      id_demande_achat: 1,
      id_fournisseur: 42,
      montant_devis: null,
      nom_fichier_original: null,
      storage_path: null,
      taille_octets: null,
      retenu: true,
      ordre: 1,
    })

    const result = await addConsultationCandidat(DEMANDEUR, 1, { idFournisseur: 42 })

    expect(devisCreate).toHaveBeenCalledWith({ id_demande_achat: 1, id_fournisseur: 42, montant_devis: null, ordre: 1, retenu: true })
    expect(result).toEqual({ idDevis: 5, idFournisseur: 42, montantDevis: null, ordre: 1, retenu: true, nomFichierOriginal: null, tailleOctets: null })
  })
})

describe('removeConsultationCandidat', () => {
  const HORS_MARCHE_DA = { ...DA, procedure_achat: 'HORS_MARCHE' }

  it('rejette un devis introuvable ou hors de la demande (404)', async () => {
    findById.mockResolvedValue(HORS_MARCHE_DA)
    devisFindById.mockResolvedValue(null)

    await expect(removeConsultationCandidat(DEMANDEUR, 1, 5)).rejects.toMatchObject({ status: 404 })
    expect(devisRemove).not.toHaveBeenCalled()
  })

  it('supprime la ligne, le fichier associé (best-effort) et réordonne les candidats restants', async () => {
    findById.mockResolvedValue(HORS_MARCHE_DA)
    devisFindById.mockResolvedValue({ id_devis: 5, id_demande_achat: 1, id_fournisseur: 42, storage_path: '1/42/x.pdf' })
    devisFindAllByDemandeAchat.mockResolvedValue([{ id_devis: 7, id_fournisseur: 43, ordre: 2, retenu: false }])

    await removeConsultationCandidat(DEMANDEUR, 1, 5)

    expect(devisRemove).toHaveBeenCalledWith(5)
    expect(devisRemoveFile).toHaveBeenCalledWith('1/42/x.pdf')
    expect(devisUpdate).toHaveBeenNthCalledWith(1, 7, { ordre: -7, retenu: false })
    expect(devisUpdate).toHaveBeenNthCalledWith(2, 7, { ordre: 1, retenu: true })
  })

  it("purge aussi les pièces complémentaires du fournisseur retiré — décision du 09/09/2026 (croquis DA2.pdf)", async () => {
    findById.mockResolvedValue(HORS_MARCHE_DA)
    devisFindById.mockResolvedValue({ id_devis: 5, id_demande_achat: 1, id_fournisseur: 42, storage_path: null })
    devisFindAllByDemandeAchat.mockResolvedValue([])
    pieceFindAllByDemandeAchatAndFournisseur.mockResolvedValue([{ id_piece: 3, storage_path: '1/42/piece.pdf' }])

    await removeConsultationCandidat(DEMANDEUR, 1, 5)

    expect(pieceFindAllByDemandeAchatAndFournisseur).toHaveBeenCalledWith(1, 42)
    expect(pieceRemove).toHaveBeenCalledWith(3)
    expect(pieceRemoveFile).toHaveBeenCalledWith('1/42/piece.pdf')
  })

  it("n'échoue pas si la suppression du fichier Storage échoue (best-effort)", async () => {
    findById.mockResolvedValue(HORS_MARCHE_DA)
    devisFindById.mockResolvedValue({ id_devis: 5, id_demande_achat: 1, id_fournisseur: 42, storage_path: '1/42/x.pdf' })
    devisFindAllByDemandeAchat.mockResolvedValue([])
    devisRemoveFile.mockRejectedValue(new Error('boom'))

    await expect(removeConsultationCandidat(DEMANDEUR, 1, 5)).resolves.toBeUndefined()
  })
})

describe('saveConsultationDemandeAchat', () => {
  const HORS_MARCHE_DA = { ...DA, procedure_achat: 'HORS_MARCHE' }
  const ROW_43 = { id_devis: 10, id_demande_achat: 1, id_fournisseur: 43 }
  const ROW_42 = { id_devis: 11, id_demande_achat: 1, id_fournisseur: 42 }

  it('rejette une entrée sans candidat (400)', async () => {
    await expect(saveConsultationDemandeAchat(DEMANDEUR, 1, { candidats: [], motifChoix: 'Prix' })).rejects.toMatchObject({ status: 400 })
    expect(devisUpdate).not.toHaveBeenCalled()
  })

  it('rejette plus de 5 candidats (400)', async () => {
    const candidats = Array.from({ length: 6 }, (_, i) => ({ idDevis: i + 1, montantDevis: 100 }))
    await expect(saveConsultationDemandeAchat(DEMANDEUR, 1, { candidats, motifChoix: 'Prix' })).rejects.toMatchObject({ status: 400 })
  })

  it('rejette des doublons de candidat (400)', async () => {
    const candidats = [
      { idDevis: 10, montantDevis: 100 },
      { idDevis: 10, montantDevis: 200 },
    ]
    await expect(saveConsultationDemandeAchat(DEMANDEUR, 1, { candidats, motifChoix: 'Prix' })).rejects.toMatchObject({ status: 400 })
  })

  it('rejette motif "Autre" sans libellé (400)', async () => {
    const candidats = [{ idDevis: 10, montantDevis: 100 }]
    await expect(saveConsultationDemandeAchat(DEMANDEUR, 1, { candidats, motifChoix: 'Autre' })).rejects.toMatchObject({ status: 400 })
  })

  it('rejette si la DA est en procédure marché (409)', async () => {
    findById.mockResolvedValue(DA) // procedure_achat: 'MARCHE' par défaut
    const candidats = [{ idDevis: 10, montantDevis: 100 }]

    await expect(saveConsultationDemandeAchat(DEMANDEUR, 1, { candidats, motifChoix: 'Prix' })).rejects.toMatchObject({ status: 409 })
    expect(devisUpdate).not.toHaveBeenCalled()
  })

  it("rejette un idDevis qui n'appartient pas à cette demande (404)", async () => {
    findById.mockResolvedValue(HORS_MARCHE_DA)
    devisFindAllByDemandeAchat.mockResolvedValue([ROW_42])
    const candidats = [{ idDevis: 999, montantDevis: 100 }]

    await expect(saveConsultationDemandeAchat(DEMANDEUR, 1, { candidats, motifChoix: 'Prix' })).rejects.toMatchObject({ status: 404 })
    expect(devisUpdate).not.toHaveBeenCalled()
  })

  it('réordonne les candidats déjà existants et dérive ID_FOURNISSEUR_RETENU/MOTIF_CHOIX/MONTANT_DEMANDE (préserve les lignes — plus de delete-then-recreate, PiecesDevisDA 09/09/2026)', async () => {
    findById.mockResolvedValue(HORS_MARCHE_DA)
    devisFindAllByDemandeAchat.mockResolvedValue([ROW_43, ROW_42])
    update.mockResolvedValue(HORS_MARCHE_DA)
    const candidats = [
      { idDevis: 10, montantDevis: 2000 },
      { idDevis: 11, montantDevis: 1000 },
    ]

    await saveConsultationDemandeAchat(DEMANDEUR, 1, { candidats, motifChoix: 'Prix' })

    expect(deleteAllDevis).not.toHaveBeenCalled()
    expect(devisCreate).not.toHaveBeenCalled()
    expect(devisUpdate).toHaveBeenNthCalledWith(1, 10, { montant_devis: 2000 })
    expect(devisUpdate).toHaveBeenNthCalledWith(2, 11, { montant_devis: 1000 })
    expect(devisUpdate).toHaveBeenNthCalledWith(3, 10, { ordre: -10, retenu: false })
    expect(devisUpdate).toHaveBeenNthCalledWith(4, 11, { ordre: -11, retenu: false })
    expect(devisUpdate).toHaveBeenNthCalledWith(5, 10, { ordre: 1, retenu: true })
    expect(devisUpdate).toHaveBeenNthCalledWith(6, 11, { ordre: 2, retenu: false })
    expect(update).toHaveBeenCalledWith(1, {
      nummarche: null,
      id_marche_tiers: null,
      motif_choix: 'Prix',
      libelle_motif_choix: null,
      id_fournisseur_retenu: 43,
      montant_demande: 2000,
    })
  })

  it('motif "Autre" avec libellé : transmet le libellé trimé', async () => {
    findById.mockResolvedValue(HORS_MARCHE_DA)
    devisFindAllByDemandeAchat.mockResolvedValue([ROW_42])
    update.mockResolvedValue(HORS_MARCHE_DA)
    const candidats = [{ idDevis: 11, montantDevis: 100 }]

    await saveConsultationDemandeAchat(DEMANDEUR, 1, { candidats, motifChoix: 'Autre', libelleMotifChoix: '  Raison particulière  ' })

    expect(update).toHaveBeenCalledWith(1, {
      nummarche: null,
      id_marche_tiers: null,
      motif_choix: 'Autre',
      libelle_motif_choix: 'Raison particulière',
      id_fournisseur_retenu: 42,
      montant_demande: 100,
    })
  })
})

describe('getOrCreateMarcheDevis', () => {
  it('rejette si la DA est en procédure hors marché (409)', async () => {
    findById.mockResolvedValue({ ...DA, procedure_achat: 'HORS_MARCHE' })

    await expect(getOrCreateMarcheDevis(DEMANDEUR, 1)).rejects.toMatchObject({ status: 409 })
  })

  it("rejette si aucun marché n'est encore sélectionné (409)", async () => {
    findById.mockResolvedValue({ ...DA, id_fournisseur_retenu: null })

    await expect(getOrCreateMarcheDevis(DEMANDEUR, 1)).rejects.toMatchObject({ status: 409 })
  })

  it('retourne la ligne existante sans en recréer une', async () => {
    findById.mockResolvedValue({ ...DA, id_fournisseur_retenu: 42 })
    devisFindAllByDemandeAchat.mockResolvedValue([
      { id_devis: 1, id_demande_achat: 1, id_fournisseur: 42, montant_devis: null, nom_fichier_original: null, storage_path: null, taille_octets: null, retenu: true, ordre: 1 },
    ])

    const result = await getOrCreateMarcheDevis(DEMANDEUR, 1)

    expect(devisCreate).not.toHaveBeenCalled()
    expect(result.idDevis).toBe(1)
  })

  it("crée la ligne si elle n'existe pas encore", async () => {
    findById.mockResolvedValue({ ...DA, id_fournisseur_retenu: 42 })
    devisFindAllByDemandeAchat.mockResolvedValue([])
    devisCreate.mockResolvedValue({
      id_devis: 9,
      id_demande_achat: 1,
      id_fournisseur: 42,
      montant_devis: null,
      nom_fichier_original: null,
      storage_path: null,
      taille_octets: null,
      retenu: true,
      ordre: 1,
    })

    const result = await getOrCreateMarcheDevis(DEMANDEUR, 1)

    expect(devisCreate).toHaveBeenCalledWith({ id_demande_achat: 1, id_fournisseur: 42, montant_devis: null, ordre: 1, retenu: true })
    expect(result.idDevis).toBe(9)
  })
})

describe('uploadDevisFile', () => {
  const PDF_BUFFER = Buffer.concat([Buffer.from('%PDF-1.4'), Buffer.alloc(10)])
  const ROW = { id_devis: 5, id_demande_achat: 1, id_fournisseur: 42, storage_path: null }

  it('rejette un fichier qui ne commence pas par la signature PDF (400)', async () => {
    findById.mockResolvedValue(DA)
    devisFindById.mockResolvedValue(ROW)

    await expect(
      uploadDevisFile(DEMANDEUR, 1, 5, { buffer: Buffer.from('not a pdf'), originalname: 'devis.pdf', size: 9 }),
    ).rejects.toMatchObject({ status: 400 })
    expect(devisUploadFile).not.toHaveBeenCalled()
  })

  it('rejette un fichier trop volumineux (400)', async () => {
    findById.mockResolvedValue(DA)
    devisFindById.mockResolvedValue(ROW)

    await expect(
      uploadDevisFile(DEMANDEUR, 1, 5, { buffer: PDF_BUFFER, originalname: 'devis.pdf', size: 11 * 1024 * 1024 }),
    ).rejects.toMatchObject({ status: 400 })
    expect(devisUploadFile).not.toHaveBeenCalled()
  })

  it('dépose le fichier, met à jour la ligne et ne supprime aucun ancien fichier au premier dépôt', async () => {
    findById.mockResolvedValue(DA)
    devisFindById.mockResolvedValue(ROW)
    devisBuildStoragePath.mockReturnValue('1/42/uuid.pdf')
    devisUpdate.mockResolvedValue({ ...ROW, nom_fichier_original: 'devis.pdf', storage_path: '1/42/uuid.pdf', taille_octets: 18, montant_devis: null, retenu: true, ordre: 1 })

    await uploadDevisFile(DEMANDEUR, 1, 5, { buffer: PDF_BUFFER, originalname: 'devis.pdf', size: 18 })

    expect(devisUploadFile).toHaveBeenCalledWith('1/42/uuid.pdf', PDF_BUFFER)
    expect(devisUpdate).toHaveBeenCalledWith(5, { nom_fichier_original: 'devis.pdf', storage_path: '1/42/uuid.pdf', taille_octets: 18 })
    expect(devisRemoveFile).not.toHaveBeenCalled()
  })

  it('remplace un fichier déjà déposé et supprime l\'ancien fichier Storage (best-effort, après confirmation du nouveau)', async () => {
    findById.mockResolvedValue(DA)
    devisFindById.mockResolvedValue({ ...ROW, storage_path: '1/42/ancien.pdf' })
    devisBuildStoragePath.mockReturnValue('1/42/nouveau.pdf')
    devisUpdate.mockResolvedValue({ ...ROW, storage_path: '1/42/nouveau.pdf' })

    await uploadDevisFile(DEMANDEUR, 1, 5, { buffer: PDF_BUFFER, originalname: 'devis.pdf', size: 18 })

    expect(devisRemoveFile).toHaveBeenCalledWith('1/42/ancien.pdf')
  })
})

describe('downloadDevisFile', () => {
  it("rejette si aucun fichier n'a été déposé (404)", async () => {
    findById.mockResolvedValue(DA)
    devisFindById.mockResolvedValue({ id_devis: 5, id_demande_achat: 1, storage_path: null, nom_fichier_original: null })

    await expect(downloadDevisFile(DEMANDEUR, 1, 5)).rejects.toMatchObject({ status: 404 })
  })

  it('retourne le buffer et le nom de fichier original', async () => {
    findById.mockResolvedValue(DA)
    devisFindById.mockResolvedValue({ id_devis: 5, id_demande_achat: 1, storage_path: '1/42/x.pdf', nom_fichier_original: 'devis.pdf' })
    devisDownloadFile.mockResolvedValue(Buffer.from('%PDF'))

    const result = await downloadDevisFile(DEMANDEUR, 1, 5)

    expect(result).toEqual({ buffer: Buffer.from('%PDF'), nomFichier: 'devis.pdf' })
  })
})

describe('deleteDevisFile', () => {
  it("rejette si aucun fichier n'est déposé (404)", async () => {
    findById.mockResolvedValue(DA)
    devisFindById.mockResolvedValue({ id_devis: 5, id_demande_achat: 1, storage_path: null })

    await expect(deleteDevisFile(DEMANDEUR, 1, 5)).rejects.toMatchObject({ status: 404 })
    expect(devisUpdate).not.toHaveBeenCalled()
  })

  it('retire le fichier (best-effort) sans supprimer la ligne', async () => {
    findById.mockResolvedValue(DA)
    devisFindById.mockResolvedValue({ id_devis: 5, id_demande_achat: 1, id_fournisseur: 42, storage_path: '1/42/x.pdf' })
    devisUpdate.mockResolvedValue({
      id_devis: 5,
      id_demande_achat: 1,
      id_fournisseur: 42,
      montant_devis: null,
      nom_fichier_original: null,
      storage_path: null,
      taille_octets: null,
      retenu: true,
      ordre: 1,
    })

    const result = await deleteDevisFile(DEMANDEUR, 1, 5)

    expect(devisUpdate).toHaveBeenCalledWith(5, { nom_fichier_original: null, storage_path: null, taille_octets: null })
    expect(devisRemoveFile).toHaveBeenCalledWith('1/42/x.pdf')
    expect(devisRemove).not.toHaveBeenCalled()
    expect(result.nomFichierOriginal).toBeNull()
  })
})

describe('listPiecesDemandeAchat', () => {
  it('rejette sans authentification (401)', async () => {
    await expect(listPiecesDemandeAchat(null, 1, 42)).rejects.toMatchObject({ status: 401 })
  })

  it('retourne la liste des pièces mappée pour ce fournisseur', async () => {
    findById.mockResolvedValue(DA)
    pieceFindAllByDemandeAchatAndFournisseur.mockResolvedValue([
      { id_piece: 3, id_demande_achat: 1, id_fournisseur: 42, type_piece: 'PLAN', origine: 'UTILISATEUR', nom_fichier_original: 'plan.pdf', storage_path: '1/42/x.pdf', taille_octets: 2048 },
    ])

    const result = await listPiecesDemandeAchat(DEMANDEUR, 1, 42)

    expect(pieceFindAllByDemandeAchatAndFournisseur).toHaveBeenCalledWith(1, 42)
    expect(result).toEqual([{ idPiece: 3, idFournisseur: 42, typePiece: 'PLAN', nomFichierOriginal: 'plan.pdf', tailleOctets: 2048 }])
  })
})

describe('addPieceDemandeAchat', () => {
  const PDF_BUFFER = Buffer.concat([Buffer.from('%PDF-1.4'), Buffer.alloc(10)])
  const MARCHE_DA = { ...DA, id_fournisseur_retenu: 42 }
  const HORS_MARCHE_DA = { ...DA, procedure_achat: 'HORS_MARCHE' }

  it('rejette sans fichier (400)', async () => {
    findById.mockResolvedValue(MARCHE_DA)

    await expect(addPieceDemandeAchat(DEMANDEUR, 1, { idFournisseur: 42, typePiece: 'PLAN' }, undefined)).rejects.toMatchObject({ status: 400 })
    expect(pieceCreate).not.toHaveBeenCalled()
  })

  it('rejette le type système FICHE_FAD (400)', async () => {
    await expect(
      addPieceDemandeAchat(DEMANDEUR, 1, { idFournisseur: 42, typePiece: 'FICHE_FAD' }, { buffer: PDF_BUFFER, originalname: 'x.pdf', size: 18 }),
    ).rejects.toMatchObject({ status: 400 })
    expect(pieceCreate).not.toHaveBeenCalled()
  })

  it("rejette un fournisseur qui n'est pas le titulaire retenu en procédure Marché (403)", async () => {
    findById.mockResolvedValue(MARCHE_DA)

    await expect(
      addPieceDemandeAchat(DEMANDEUR, 1, { idFournisseur: 999, typePiece: 'PLAN' }, { buffer: PDF_BUFFER, originalname: 'x.pdf', size: 18 }),
    ).rejects.toMatchObject({ status: 403 })
    expect(pieceCreate).not.toHaveBeenCalled()
  })

  it("rejette un fournisseur non consulté en procédure Hors marché (403)", async () => {
    findById.mockResolvedValue(HORS_MARCHE_DA)
    devisFindAllByDemandeAchat.mockResolvedValue([{ id_fournisseur: 42 }])

    await expect(
      addPieceDemandeAchat(DEMANDEUR, 1, { idFournisseur: 999, typePiece: 'PLAN' }, { buffer: PDF_BUFFER, originalname: 'x.pdf', size: 18 }),
    ).rejects.toMatchObject({ status: 403 })
    expect(pieceCreate).not.toHaveBeenCalled()
  })

  it('rejette un fichier qui ne commence pas par la signature PDF (400)', async () => {
    findById.mockResolvedValue(MARCHE_DA)

    await expect(
      addPieceDemandeAchat(DEMANDEUR, 1, { idFournisseur: 42, typePiece: 'PLAN' }, { buffer: Buffer.from('not a pdf'), originalname: 'x.pdf', size: 9 }),
    ).rejects.toMatchObject({ status: 400 })
    expect(pieceUploadFile).not.toHaveBeenCalled()
  })

  it('dépose la pièce (procédure Marché, fournisseur = titulaire retenu)', async () => {
    findById.mockResolvedValue(MARCHE_DA)
    pieceBuildStoragePath.mockReturnValue('1/42/uuid.pdf')
    pieceCreate.mockResolvedValue({
      id_piece: 3,
      id_demande_achat: 1,
      id_fournisseur: 42,
      type_piece: 'PLAN',
      origine: 'UTILISATEUR',
      nom_fichier_original: 'plan.pdf',
      storage_path: '1/42/uuid.pdf',
      taille_octets: 18,
    })

    const result = await addPieceDemandeAchat(DEMANDEUR, 1, { idFournisseur: 42, typePiece: 'PLAN' }, { buffer: PDF_BUFFER, originalname: 'plan.pdf', size: 18 })

    expect(assertCodeActif).toHaveBeenCalledWith('TYPE_PIECE_FAD', 'PLAN')
    expect(pieceUploadFile).toHaveBeenCalledWith('1/42/uuid.pdf', PDF_BUFFER)
    expect(pieceCreate).toHaveBeenCalledWith({
      id_demande_achat: 1,
      id_fournisseur: 42,
      type_piece: 'PLAN',
      origine: 'UTILISATEUR',
      nom_fichier_original: 'plan.pdf',
      storage_path: '1/42/uuid.pdf',
      taille_octets: 18,
    })
    expect(result).toEqual({ idPiece: 3, idFournisseur: 42, typePiece: 'PLAN', nomFichierOriginal: 'plan.pdf', tailleOctets: 18 })
  })

  it("dépose la pièce (procédure Hors marché, fournisseur parmi les candidats consultés)", async () => {
    findById.mockResolvedValue(HORS_MARCHE_DA)
    devisFindAllByDemandeAchat.mockResolvedValue([{ id_fournisseur: 43 }])
    pieceBuildStoragePath.mockReturnValue('1/43/uuid.pdf')
    pieceCreate.mockResolvedValue({
      id_piece: 4,
      id_demande_achat: 1,
      id_fournisseur: 43,
      type_piece: 'AUTRE',
      origine: 'UTILISATEUR',
      nom_fichier_original: 'doc.pdf',
      storage_path: '1/43/uuid.pdf',
      taille_octets: 18,
    })

    await addPieceDemandeAchat(DEMANDEUR, 1, { idFournisseur: 43, typePiece: 'AUTRE' }, { buffer: PDF_BUFFER, originalname: 'doc.pdf', size: 18 })

    expect(pieceCreate).toHaveBeenCalledWith(expect.objectContaining({ id_fournisseur: 43 }))
  })

  it("nettoie le fichier déposé si l'insertion de la ligne échoue", async () => {
    findById.mockResolvedValue(MARCHE_DA)
    pieceBuildStoragePath.mockReturnValue('1/42/uuid.pdf')
    pieceCreate.mockRejectedValue(new Error('insert failed'))

    await expect(
      addPieceDemandeAchat(DEMANDEUR, 1, { idFournisseur: 42, typePiece: 'PLAN' }, { buffer: PDF_BUFFER, originalname: 'plan.pdf', size: 18 }),
    ).rejects.toThrow('insert failed')
    expect(pieceRemoveFile).toHaveBeenCalledWith('1/42/uuid.pdf')
  })
})

describe('removePieceDemandeAchat', () => {
  it('rejette une pièce introuvable ou hors de la demande (404)', async () => {
    findById.mockResolvedValue(DA)
    pieceFindById.mockResolvedValue(null)

    await expect(removePieceDemandeAchat(DEMANDEUR, 1, 3)).rejects.toMatchObject({ status: 404 })
    expect(pieceRemove).not.toHaveBeenCalled()
  })

  it('rejette la suppression d\'une pièce système (403)', async () => {
    findById.mockResolvedValue(DA)
    pieceFindById.mockResolvedValue({ id_piece: 3, id_demande_achat: 1, origine: 'SYSTEME', storage_path: '1/42/x.pdf' })

    await expect(removePieceDemandeAchat(DEMANDEUR, 1, 3)).rejects.toMatchObject({ status: 403 })
    expect(pieceRemove).not.toHaveBeenCalled()
  })

  it('supprime la ligne et le fichier associé (best-effort)', async () => {
    findById.mockResolvedValue(DA)
    pieceFindById.mockResolvedValue({ id_piece: 3, id_demande_achat: 1, origine: 'UTILISATEUR', storage_path: '1/42/x.pdf' })

    await removePieceDemandeAchat(DEMANDEUR, 1, 3)

    expect(pieceRemove).toHaveBeenCalledWith(3)
    expect(pieceRemoveFile).toHaveBeenCalledWith('1/42/x.pdf')
  })
})

describe('downloadPieceDemandeAchat', () => {
  it('rejette une pièce introuvable (404)', async () => {
    findById.mockResolvedValue(DA)
    pieceFindById.mockResolvedValue(null)

    await expect(downloadPieceDemandeAchat(DEMANDEUR, 1, 3)).rejects.toMatchObject({ status: 404 })
  })

  it('retourne le buffer et le nom de fichier original', async () => {
    findById.mockResolvedValue(DA)
    pieceFindById.mockResolvedValue({ id_piece: 3, id_demande_achat: 1, storage_path: '1/42/x.pdf', nom_fichier_original: 'plan.pdf' })
    pieceDownloadFile.mockResolvedValue(Buffer.from('%PDF'))

    const result = await downloadPieceDemandeAchat(DEMANDEUR, 1, 3)

    expect(result).toEqual({ buffer: Buffer.from('%PDF'), nomFichier: 'plan.pdf' })
  })
})

describe('deleteDemandeAchat', () => {
  it('rejette si la DA est introuvable (404)', async () => {
    findById.mockResolvedValue(null)

    await expect(deleteDemandeAchat(DEMANDEUR, 1)).rejects.toMatchObject({ status: 404 })
  })

  it("rejette si l'appelant n'a pas accès (403)", async () => {
    findById.mockResolvedValue(DA)

    await expect(deleteDemandeAchat(AUTRE_DEMANDEUR, 1)).rejects.toMatchObject({ status: 403 })
    expect(remove).not.toHaveBeenCalled()
  })

  it('rejette si la DA a quitté DA_EN_PREPARATION (409) — ex. DA_A_COMPLETER_RC', async () => {
    findById.mockResolvedValue({ ...DA, code_statut: 'DA_A_COMPLETER_RC' })

    await expect(deleteDemandeAchat(DEMANDEUR, 1)).rejects.toMatchObject({ status: 409 })
    expect(remove).not.toHaveBeenCalled()
  })

  it('supprime en cascade dans le bon ordre pour DA_EN_PREPARATION, fichiers Storage compris', async () => {
    findById.mockResolvedValue(DA)
    pieceFindAllByDemandeAchat.mockResolvedValue([{ id_piece: 9, storage_path: '1/42/piece.pdf' }])
    devisFindAllByDemandeAchat.mockResolvedValue([{ id_devis: 7, storage_path: '1/42/devis.pdf' }])

    await deleteDemandeAchat(DEMANDEUR, 1)

    expect(pieceRemove).toHaveBeenCalledWith(9)
    expect(pieceRemoveFile).toHaveBeenCalledWith('1/42/piece.pdf')
    expect(devisRemoveFile).toHaveBeenCalledWith('1/42/devis.pdf')
    expect(deleteAllDevis).toHaveBeenCalledWith(1)
    expect(deleteAllHistorique).toHaveBeenCalledWith(1)
    expect(remove).toHaveBeenCalledWith(1)

    const piecesOrder = pieceFindAllByDemandeAchat.mock.invocationCallOrder[0]
    const devisOrder = deleteAllDevis.mock.invocationCallOrder[0]
    const histoOrder = deleteAllHistorique.mock.invocationCallOrder[0]
    const removeOrder = remove.mock.invocationCallOrder[0]
    expect(piecesOrder).toBeLessThan(devisOrder)
    expect(devisOrder).toBeLessThan(histoOrder)
    expect(histoOrder).toBeLessThan(removeOrder)
  })
})
