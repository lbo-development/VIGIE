import { describe, it, expect, vi, beforeEach } from 'vitest'

const findAllByDomaine = vi.fn()
const findOne = vi.fn()
const create = vi.fn()
const update = vi.fn()
const remove = vi.fn()
const reorder = vi.fn()

vi.mock('../repositories/libelleReferentiel.repository.js', () => ({
  findAllByDomaine: (...args: unknown[]) => findAllByDomaine(...args),
  findOne: (...args: unknown[]) => findOne(...args),
  create: (...args: unknown[]) => create(...args),
  update: (...args: unknown[]) => update(...args),
  remove: (...args: unknown[]) => remove(...args),
  reorder: (...args: unknown[]) => reorder(...args),
}))

const hasActiveRole = vi.fn()
vi.mock('../repositories/auth.repository.js', () => ({
  hasActiveRole: (...args: unknown[]) => hasActiveRole(...args),
}))

const { listByDomaine, assertCodeActif, createLibelle, updateLibelle, deleteLibelle, reorderLibelles } = await import(
  '../services/libelleReferentiel.service.js'
)

const MATRICULE = '12520'

const ROWS = [
  { domaine: 'TYPE_PIECE_MARCHE', code: 'CCAP', libelle: 'CCAP', ordre: 1, actif: true },
  { domaine: 'TYPE_PIECE_MARCHE', code: 'AUTRE', libelle: 'Autre', ordre: 6, actif: false },
]

beforeEach(() => {
  findAllByDomaine.mockReset().mockResolvedValue(ROWS)
  findOne.mockReset().mockResolvedValue(null)
  create.mockReset()
  update.mockReset()
  remove.mockReset().mockResolvedValue(undefined)
  reorder.mockReset().mockResolvedValue(undefined)
  hasActiveRole.mockReset().mockResolvedValue(true)
})

describe('listByDomaine', () => {
  it('rejette sans matricule', async () => {
    await expect(listByDomaine(null, { domaine: 'TYPE_PIECE_MARCHE' })).rejects.toMatchObject({ status: 401 })
  })

  it('rejette un domaine hors nomenclature', async () => {
    await expect(listByDomaine(MATRICULE, { domaine: 'INCONNU' })).rejects.toMatchObject({ status: 400 })
  })

  it('renvoie les lignes du référentiel pour le domaine demandé', async () => {
    const result = await listByDomaine(MATRICULE, { domaine: 'TYPE_PIECE_MARCHE' })
    expect(findAllByDomaine).toHaveBeenCalledWith('TYPE_PIECE_MARCHE')
    expect(result).toEqual(ROWS)
  })
})

describe('assertCodeActif', () => {
  it('accepte un code actif du domaine', async () => {
    await expect(assertCodeActif('TYPE_PIECE_MARCHE', 'CCAP')).resolves.toBeUndefined()
  })

  it('rejette un code désactivé', async () => {
    await expect(assertCodeActif('TYPE_PIECE_MARCHE', 'AUTRE')).rejects.toMatchObject({ status: 400 })
  })

  it('rejette un code inconnu du domaine', async () => {
    await expect(assertCodeActif('TYPE_PIECE_MARCHE', 'INCONNU')).rejects.toMatchObject({ status: 400 })
  })
})

describe('createLibelle', () => {
  const input = { domaine: 'TYPE_PIECE_MARCHE', code: 'DEVIS', libelle: 'Devis', ordre: 7, actif: true }

  it('rejette sans matricule', async () => {
    await expect(createLibelle(null, input)).rejects.toMatchObject({ status: 401 })
  })

  it('rejette un acteur sans le rôle ADMIN_APP', async () => {
    hasActiveRole.mockResolvedValue(false)
    await expect(createLibelle(MATRICULE, input)).rejects.toMatchObject({ status: 403 })
  })

  it('rejette un code déjà existant pour ce domaine (409)', async () => {
    findOne.mockResolvedValue(ROWS[0])
    await expect(createLibelle(MATRICULE, input)).rejects.toMatchObject({ status: 409 })
    expect(create).not.toHaveBeenCalled()
  })

  it('crée la ligne', async () => {
    create.mockResolvedValue({ ...input })
    const result = await createLibelle(MATRICULE, input)
    expect(create).toHaveBeenCalledWith(input)
    expect(result).toEqual(input)
  })

  it('ordre par défaut à 0 quand omis (repositionné ensuite par glisser-déposer)', async () => {
    const withoutOrdre = { domaine: input.domaine, code: input.code, libelle: input.libelle, actif: input.actif }
    create.mockResolvedValue({ ...withoutOrdre, ordre: 0 })
    await createLibelle(MATRICULE, withoutOrdre)
    expect(create).toHaveBeenCalledWith({ ...withoutOrdre, ordre: 0 })
  })
})

describe('updateLibelle', () => {
  const patch = { libelle: 'Devis fournisseur', ordre: 8, actif: false }

  it('rejette sans matricule', async () => {
    await expect(updateLibelle(null, 'TYPE_PIECE_MARCHE', 'CCAP', patch)).rejects.toMatchObject({ status: 401 })
  })

  it('rejette un domaine hors nomenclature', async () => {
    await expect(updateLibelle(MATRICULE, 'INCONNU', 'CCAP', patch)).rejects.toMatchObject({ status: 400 })
  })

  it('valeur introuvable -> 404', async () => {
    findOne.mockResolvedValue(null)
    await expect(updateLibelle(MATRICULE, 'TYPE_PIECE_MARCHE', 'CCAP', patch)).rejects.toMatchObject({ status: 404 })
  })

  it('met à jour la ligne', async () => {
    findOne.mockResolvedValue(ROWS[0])
    update.mockResolvedValue({ ...ROWS[0], ...patch })
    const result = await updateLibelle(MATRICULE, 'TYPE_PIECE_MARCHE', 'CCAP', patch)
    expect(update).toHaveBeenCalledWith('TYPE_PIECE_MARCHE', 'CCAP', patch)
    expect(result).toEqual({ ...ROWS[0], ...patch })
  })
})

describe('deleteLibelle', () => {
  it('rejette sans matricule', async () => {
    await expect(deleteLibelle(null, 'TYPE_PIECE_MARCHE', 'CCAP')).rejects.toMatchObject({ status: 401 })
  })

  it('valeur introuvable -> 404', async () => {
    findOne.mockResolvedValue(null)
    await expect(deleteLibelle(MATRICULE, 'TYPE_PIECE_MARCHE', 'CCAP')).rejects.toMatchObject({ status: 404 })
  })

  it('supprime la ligne', async () => {
    findOne.mockResolvedValue(ROWS[0])
    await deleteLibelle(MATRICULE, 'TYPE_PIECE_MARCHE', 'CCAP')
    expect(remove).toHaveBeenCalledWith('TYPE_PIECE_MARCHE', 'CCAP')
  })

  it('traduit une violation de FK (23503) en 409 métier plutôt que de la laisser remonter', async () => {
    findOne.mockResolvedValue(ROWS[0])
    remove.mockRejectedValue(Object.assign(new Error('update or delete violates foreign key constraint'), { code: '23503' }))
    await expect(deleteLibelle(MATRICULE, 'TYPE_PIECE_MARCHE', 'CCAP')).rejects.toMatchObject({ status: 409 })
  })

  it('laisse remonter toute autre erreur inattendue', async () => {
    findOne.mockResolvedValue(ROWS[0])
    remove.mockRejectedValue(new Error('storage down'))
    await expect(deleteLibelle(MATRICULE, 'TYPE_PIECE_MARCHE', 'CCAP')).rejects.toThrow('storage down')
  })
})

describe('reorderLibelles', () => {
  const input = { domaine: 'TYPE_PIECE_MARCHE', codes: ['AUTRE', 'CCAP'] }

  it('rejette sans matricule', async () => {
    await expect(reorderLibelles(null, input)).rejects.toMatchObject({ status: 401 })
  })

  it('rejette un acteur sans le rôle ADMIN_APP', async () => {
    hasActiveRole.mockResolvedValue(false)
    await expect(reorderLibelles(MATRICULE, input)).rejects.toMatchObject({ status: 403 })
  })

  it('rejette une requête invalide (domaine hors nomenclature)', async () => {
    await expect(reorderLibelles(MATRICULE, { domaine: 'INCONNU', codes: ['CCAP'] })).rejects.toMatchObject({ status: 400 })
    expect(reorder).not.toHaveBeenCalled()
  })

  it("rejette un code qui n'appartient pas au domaine annoncé, sans faire confiance au payload", async () => {
    await expect(reorderLibelles(MATRICULE, { domaine: 'TYPE_PIECE_MARCHE', codes: ['CCAP', 'INCONNU'] })).rejects.toMatchObject({
      status: 400,
    })
    expect(reorder).not.toHaveBeenCalled()
  })

  it('réordonne les codes du domaine', async () => {
    await reorderLibelles(MATRICULE, input)
    expect(reorder).toHaveBeenCalledWith('TYPE_PIECE_MARCHE', ['AUTRE', 'CCAP'])
  })
})
