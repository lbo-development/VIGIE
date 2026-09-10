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
vi.mock('../repositories/historiqueStatut.repository.js', () => ({
  deleteAllByDemandeAchat: (...args: unknown[]) => deleteAllHistorique(...args),
}))
vi.mock('../repositories/acteur.repository.js', () => ({
  findIdServiceByMatricule: (...args: unknown[]) => findIdServiceByMatricule(...args),
  findAllByCellule: (...args: unknown[]) => findAllByCellule(...args),
}))
vi.mock('../repositories/cellule.repository.js', () => ({
  findById: (...args: unknown[]) => celluleFindById(...args),
}))
vi.mock('../repositories/roleAttribution.repository.js', () => ({
  findActiveByMatricule: (...args: unknown[]) => findActiveByMatricule(...args),
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

  // Par défaut : personne n'a de rôle applicatif (Demandeur simple).
  hasActiveRole.mockResolvedValue(false)
  findActiveByMatricule.mockResolvedValue([])
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
      expect.objectContaining({ matriculeDemandeurIn: [DEMANDEUR], statuts: ['DA_EN_PREPARATION', 'DA_A_COMPLETER'] }),
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
    update.mockResolvedValue({ ...DA, objet: 'Achat de fournitures' })

    await updateDemandeAchat(DEMANDEUR, 1, { objet: 'Achat de fournitures' })

    expect(update).toHaveBeenCalledWith(1, expect.objectContaining({ objet: 'Achat de fournitures' }))
  })

  it('autorise pour DA_A_COMPLETER (reprise en place)', async () => {
    findById.mockResolvedValue({ ...DA, code_statut: 'DA_A_COMPLETER' })
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

  it('rejette si la DA a quitté DA_EN_PREPARATION (409) — ex. DA_A_COMPLETER', async () => {
    findById.mockResolvedValue({ ...DA, code_statut: 'DA_A_COMPLETER' })

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
