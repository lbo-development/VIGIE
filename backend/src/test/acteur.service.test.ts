import { describe, it, expect, vi, beforeEach } from 'vitest'

const findByMatricule = vi.fn()
const findAll = vi.fn()
const create = vi.fn()
const update = vi.fn()
const remove = vi.fn()
const findIdServiceByMatricule = vi.fn()
const findAllByCellule = vi.fn()
const findAllByService = vi.fn()

vi.mock('../repositories/acteur.repository.js', () => ({
  findByMatricule: (...args: unknown[]) => findByMatricule(...args),
  findAll: (...args: unknown[]) => findAll(...args),
  create: (...args: unknown[]) => create(...args),
  update: (...args: unknown[]) => update(...args),
  remove: (...args: unknown[]) => remove(...args),
  findIdServiceByMatricule: (...args: unknown[]) => findIdServiceByMatricule(...args),
  findAllByCellule: (...args: unknown[]) => findAllByCellule(...args),
  findAllByService: (...args: unknown[]) => findAllByService(...args),
}))

const findCelluleById = vi.fn()
vi.mock('../repositories/cellule.repository.js', () => ({
  findById: (...args: unknown[]) => findCelluleById(...args),
}))

const hasActiveRole = vi.fn()
const findUserIdByMatricule = vi.fn()
const linkProfile = vi.fn()
const deleteProfile = vi.fn()
vi.mock('../repositories/auth.repository.js', () => ({
  hasActiveRole: (...args: unknown[]) => hasActiveRole(...args),
  findUserIdByMatricule: (...args: unknown[]) => findUserIdByMatricule(...args),
  linkProfile: (...args: unknown[]) => linkProfile(...args),
  deleteProfile: (...args: unknown[]) => deleteProfile(...args),
}))

const createAuthUser = vi.fn()
const banAuthUser = vi.fn()
const unbanAuthUser = vi.fn()
const deleteAuthUser = vi.fn()
vi.mock('../repositories/authAdmin.repository.js', () => ({
  createAuthUser: (...args: unknown[]) => createAuthUser(...args),
  banAuthUser: (...args: unknown[]) => banAuthUser(...args),
  unbanAuthUser: (...args: unknown[]) => unbanAuthUser(...args),
  deleteAuthUser: (...args: unknown[]) => deleteAuthUser(...args),
}))

const findActiveByMatricule = vi.fn()
const existsForMatricule = vi.fn()
vi.mock('../repositories/roleAttribution.repository.js', () => ({
  findActiveByMatricule: (...args: unknown[]) => findActiveByMatricule(...args),
  existsForMatricule: (...args: unknown[]) => existsForMatricule(...args),
}))

const existsForMatriculeSuppleant = vi.fn()
vi.mock('../repositories/suppleance.repository.js', () => ({
  existsForMatriculeSuppleant: (...args: unknown[]) => existsForMatriculeSuppleant(...args),
}))

const existsForMatriculeDemandeur = vi.fn()
vi.mock('../repositories/demandeAchat.repository.js', () => ({
  existsForMatriculeDemandeur: (...args: unknown[]) => existsForMatriculeDemandeur(...args),
}))

const existsForMatriculeActeur = vi.fn()
vi.mock('../repositories/historiqueStatut.repository.js', () => ({
  existsForMatriculeActeur: (...args: unknown[]) => existsForMatriculeActeur(...args),
}))

const { listActeurs, createActeur, updateActeur, deleteActeur } = await import('../services/acteur.service.js')

const MATRICULE = '000600'
const ID_CELLULE = 7
const ID_SERVICE = 1
const ACTEUR = { matricule: MATRICULE, nom: 'DUPONT', prenom: 'Jean', fonction: 'Agent', id_cellule: ID_CELLULE, actif: true }

beforeEach(() => {
  findByMatricule.mockReset()
  findAll.mockReset()
  create.mockReset()
  update.mockReset()
  remove.mockReset()
  findIdServiceByMatricule.mockReset()
  findAllByCellule.mockReset()
  findAllByService.mockReset()
  findCelluleById.mockReset()
  hasActiveRole.mockReset()
  findUserIdByMatricule.mockReset()
  linkProfile.mockReset()
  deleteProfile.mockReset()
  createAuthUser.mockReset()
  banAuthUser.mockReset()
  unbanAuthUser.mockReset()
  deleteAuthUser.mockReset()
  findActiveByMatricule.mockReset()
  existsForMatricule.mockReset()
  existsForMatriculeSuppleant.mockReset()
  existsForMatriculeDemandeur.mockReset()
  existsForMatriculeActeur.mockReset()
})

describe('listActeurs — ADMIN_APP sans filtre', () => {
  it('renvoie la liste complète (écran Utilisateurs), au lieu de rejeter en 400 comme avant le 10/09/2026', async () => {
    hasActiveRole.mockResolvedValue(true)
    findAll.mockResolvedValue([ACTEUR])

    const result = await listActeurs(MATRICULE, {})

    expect(findAll).toHaveBeenCalled()
    expect(result).toEqual([ACTEUR])
  })
})

describe('createActeur', () => {
  const INPUT = {
    matricule: MATRICULE,
    nom: 'Dupont',
    prenom: 'Jean',
    fonction: 'Agent',
    idCellule: ID_CELLULE,
    email: 'jean.dupont@example.fr',
  }

  it('rejette une entrée invalide (400)', async () => {
    await expect(createActeur({ ...INPUT, email: 'pas-un-email' })).rejects.toMatchObject({ status: 400 })
    expect(createAuthUser).not.toHaveBeenCalled()
  })

  it('rejette un matricule non numérique ou trop long (400)', async () => {
    await expect(createActeur({ ...INPUT, matricule: 'ABC123' })).rejects.toMatchObject({ status: 400 })
    await expect(createActeur({ ...INPUT, matricule: '1234567' })).rejects.toMatchObject({ status: 400 })
    expect(createAuthUser).not.toHaveBeenCalled()
  })

  it('complète le matricule à 6 chiffres avec des zéros à gauche (600 -> 000600)', async () => {
    findByMatricule.mockResolvedValue(null)
    findCelluleById.mockResolvedValue({ id_cellule: ID_CELLULE, id_service: ID_SERVICE })
    createAuthUser.mockResolvedValue('auth-user-1')
    create.mockResolvedValue({ ...ACTEUR, matricule: '000600' })

    await createActeur({ ...INPUT, matricule: '600' })

    expect(findByMatricule).toHaveBeenCalledWith('000600')
    expect(linkProfile).toHaveBeenCalledWith('auth-user-1', '000600')
    expect(create).toHaveBeenCalledWith(expect.objectContaining({ matricule: '000600' }))
  })

  it('rejette un matricule déjà existant (409)', async () => {
    findByMatricule.mockResolvedValue(ACTEUR)

    await expect(createActeur(INPUT)).rejects.toMatchObject({ status: 409 })
    expect(createAuthUser).not.toHaveBeenCalled()
  })

  it('rejette si la cellule est introuvable (404)', async () => {
    findByMatricule.mockResolvedValue(null)
    findCelluleById.mockResolvedValue(null)

    await expect(createActeur(INPUT)).rejects.toMatchObject({ status: 404 })
    expect(createAuthUser).not.toHaveBeenCalled()
  })

  it("rejette (409, message clair) si un compte Auth existe déjà pour cet email", async () => {
    findByMatricule.mockResolvedValue(null)
    findCelluleById.mockResolvedValue({ id_cellule: ID_CELLULE, id_service: ID_SERVICE })
    createAuthUser.mockRejectedValue(Object.assign(new Error('...'), { code: 'email_exists', status: 422 }))

    await expect(createActeur(INPUT)).rejects.toMatchObject({ status: 409 })
    expect(linkProfile).not.toHaveBeenCalled()
    expect(create).not.toHaveBeenCalled()
  })

  it('crée le compte Auth, lie le profil, crée la fiche acteur et renvoie le mot de passe une seule fois', async () => {
    findByMatricule.mockResolvedValue(null)
    findCelluleById.mockResolvedValue({ id_cellule: ID_CELLULE, id_service: ID_SERVICE })
    createAuthUser.mockResolvedValue('auth-user-1')
    create.mockResolvedValue(ACTEUR)

    const result = await createActeur(INPUT)

    expect(createAuthUser).toHaveBeenCalledWith(INPUT.email, expect.any(String))
    expect(linkProfile).toHaveBeenCalledWith('auth-user-1', MATRICULE)
    expect(create).toHaveBeenCalledWith(expect.objectContaining({ matricule: MATRICULE, id_cellule: ID_CELLULE, actif: true }))
    expect(result.acteur).toEqual(ACTEUR)
    expect(typeof result.temporaryPassword).toBe('string')
    expect(result.temporaryPassword.length).toBeGreaterThan(10)
  })
})

describe('updateActeur', () => {
  it('rejette si l\'acteur est introuvable (404)', async () => {
    findByMatricule.mockResolvedValue(null)

    await expect(updateActeur(MATRICULE, { nom: 'X' })).rejects.toMatchObject({ status: 404 })
    expect(update).not.toHaveBeenCalled()
  })

  it('bannit le compte Auth quand ACTIF passe à false', async () => {
    findByMatricule.mockResolvedValue(ACTEUR)
    findUserIdByMatricule.mockResolvedValue('auth-user-1')
    update.mockResolvedValue({ ...ACTEUR, actif: false })

    await updateActeur(MATRICULE, { actif: false })

    expect(banAuthUser).toHaveBeenCalledWith('auth-user-1')
    expect(unbanAuthUser).not.toHaveBeenCalled()
    expect(update).toHaveBeenCalledWith(MATRICULE, expect.objectContaining({ actif: false }))
  })

  it('débannit le compte Auth quand ACTIF repasse à true', async () => {
    findByMatricule.mockResolvedValue({ ...ACTEUR, actif: false })
    findUserIdByMatricule.mockResolvedValue('auth-user-1')
    update.mockResolvedValue({ ...ACTEUR, actif: true })

    await updateActeur(MATRICULE, { actif: true })

    expect(unbanAuthUser).toHaveBeenCalledWith('auth-user-1')
    expect(banAuthUser).not.toHaveBeenCalled()
  })

  it("ne touche pas au compte Auth si ACTIF n'est pas modifié", async () => {
    findByMatricule.mockResolvedValue(ACTEUR)
    update.mockResolvedValue(ACTEUR)

    await updateActeur(MATRICULE, { nom: 'Nouveau nom' })

    expect(banAuthUser).not.toHaveBeenCalled()
    expect(unbanAuthUser).not.toHaveBeenCalled()
    expect(findUserIdByMatricule).not.toHaveBeenCalled()
  })
})

describe('deleteActeur', () => {
  it('rejette si l\'acteur est introuvable (404)', async () => {
    findByMatricule.mockResolvedValue(null)

    await expect(deleteActeur(MATRICULE)).rejects.toMatchObject({ status: 404 })
  })

  it('rejette (409) si une référence existe encore, sans rien supprimer', async () => {
    findByMatricule.mockResolvedValue(ACTEUR)
    existsForMatricule.mockResolvedValue(true)
    existsForMatriculeSuppleant.mockResolvedValue(false)
    existsForMatriculeDemandeur.mockResolvedValue(false)
    existsForMatriculeActeur.mockResolvedValue(false)

    await expect(deleteActeur(MATRICULE)).rejects.toMatchObject({ status: 409 })
    expect(remove).not.toHaveBeenCalled()
    expect(deleteAuthUser).not.toHaveBeenCalled()
  })

  it('supprime la fiche, le profil puis le compte Auth quand aucune référence n\'existe', async () => {
    findByMatricule.mockResolvedValue(ACTEUR)
    existsForMatricule.mockResolvedValue(false)
    existsForMatriculeSuppleant.mockResolvedValue(false)
    existsForMatriculeDemandeur.mockResolvedValue(false)
    existsForMatriculeActeur.mockResolvedValue(false)
    findUserIdByMatricule.mockResolvedValue('auth-user-1')

    await deleteActeur(MATRICULE)

    expect(remove).toHaveBeenCalledWith(MATRICULE)
    expect(deleteProfile).toHaveBeenCalledWith('auth-user-1')
    expect(deleteAuthUser).toHaveBeenCalledWith('auth-user-1')
  })
})
