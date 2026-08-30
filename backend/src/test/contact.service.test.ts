import { describe, it, expect, vi, beforeEach } from 'vitest'

const findById = vi.fn()
const create = vi.fn()
const update = vi.fn()
const remove = vi.fn()

const assertManagesFournisseur = vi.fn()

vi.mock('../repositories/contact.repository.js', () => ({
  findById: (...args: unknown[]) => findById(...args),
  create: (...args: unknown[]) => create(...args),
  update: (...args: unknown[]) => update(...args),
  remove: (...args: unknown[]) => remove(...args),
}))
vi.mock('../services/fournisseur.service.js', () => ({
  assertManagesFournisseur: (...args: unknown[]) => assertManagesFournisseur(...args),
}))

const { createContact, updateContact, deleteContact } = await import('../services/contact.service.js')

const MATRICULE = '12520'
const ID_FOURNISSEUR = 1

const CONTACT = {
  id_contact: 1,
  id_fournisseur: ID_FOURNISSEUR,
  nom: 'Dupont',
  prenom: 'Jean',
  mail: 'jean.dupont@example.com',
  telfixe: null,
  telmobile: '0611223344',
  fonction: null,
  naturefonction: 'COMMERCIAL',
}

// Nom, prénom et nature de fonction obligatoires ; au moins un téléphone.
const VALID_PAYLOAD = { nom: 'Dupont', prenom: 'Jean', telmobile: '0611223344', naturefonction: 'COMMERCIAL' }

beforeEach(() => {
  findById.mockReset()
  create.mockReset()
  update.mockReset()
  remove.mockReset()
  assertManagesFournisseur.mockReset()
})

describe('createContact', () => {
  it('rejette une entrée invalide (400)', async () => {
    await expect(createContact(MATRICULE, ID_FOURNISSEUR, { nom: '' })).rejects.toMatchObject({ status: 400 })
    expect(create).not.toHaveBeenCalled()
  })

  it('rejette si le prénom est manquant (400)', async () => {
    await expect(
      createContact(MATRICULE, ID_FOURNISSEUR, { ...VALID_PAYLOAD, prenom: '' }),
    ).rejects.toMatchObject({ status: 400 })
    expect(create).not.toHaveBeenCalled()
  })

  it('rejette si la nature de fonction est manquante (400)', async () => {
    const { naturefonction: _naturefonction, ...payload } = VALID_PAYLOAD
    await expect(createContact(MATRICULE, ID_FOURNISSEUR, payload)).rejects.toMatchObject({ status: 400 })
    expect(create).not.toHaveBeenCalled()
  })

  it('rejette une naturefonction hors liste fermée (400)', async () => {
    await expect(
      createContact(MATRICULE, ID_FOURNISSEUR, { ...VALID_PAYLOAD, naturefonction: 'Inconnu' }),
    ).rejects.toMatchObject({ status: 400 })
    expect(create).not.toHaveBeenCalled()
  })

  it('rejette si aucun des deux numéros de téléphone n\'est renseigné (400)', async () => {
    await expect(
      createContact(MATRICULE, ID_FOURNISSEUR, { ...VALID_PAYLOAD, telmobile: undefined }),
    ).rejects.toMatchObject({ status: 400 })
    expect(create).not.toHaveBeenCalled()
  })

  it('rejette un numéro de téléphone de structure invalide (400)', async () => {
    await expect(
      createContact(MATRICULE, ID_FOURNISSEUR, { ...VALID_PAYLOAD, telmobile: 'pas un numéro' }),
    ).rejects.toMatchObject({ status: 400 })
    expect(create).not.toHaveBeenCalled()
  })

  it.each([
    ['06 83 09 58 81', '0683095881'],
    ['+33 6 75 48 74 14', '+33675487414'],
    ['+254 6 83 09 58 81', '+254683095881'],
  ])('accepte "%s" et le normalise en "%s" (espaces retirés)', async (input, normalized) => {
    assertManagesFournisseur.mockResolvedValue(undefined)
    create.mockResolvedValue(CONTACT)

    await createContact(MATRICULE, ID_FOURNISSEUR, { ...VALID_PAYLOAD, telmobile: input })

    expect(create).toHaveBeenCalledWith(expect.objectContaining({ telmobile: normalized }))
  })

  it('accepte le téléphone fixe seul (sans mobile)', async () => {
    assertManagesFournisseur.mockResolvedValue(undefined)
    create.mockResolvedValue(CONTACT)

    await createContact(MATRICULE, ID_FOURNISSEUR, { ...VALID_PAYLOAD, telmobile: undefined, telfixe: '0491000000' })

    expect(create).toHaveBeenCalled()
  })

  it("vérifie le droit de gestion sur le fournisseur avant création", async () => {
    assertManagesFournisseur.mockRejectedValue(Object.assign(new Error('Droits insuffisants'), { status: 403 }))

    await expect(createContact(MATRICULE, ID_FOURNISSEUR, VALID_PAYLOAD)).rejects.toMatchObject({ status: 403 })
    expect(create).not.toHaveBeenCalled()
  })

  it('délègue au repository quand valide et autorisé', async () => {
    assertManagesFournisseur.mockResolvedValue(undefined)
    create.mockResolvedValue(CONTACT)

    await createContact(MATRICULE, ID_FOURNISSEUR, VALID_PAYLOAD)

    expect(assertManagesFournisseur).toHaveBeenCalledWith(MATRICULE, ID_FOURNISSEUR)
    expect(create).toHaveBeenCalledWith(
      expect.objectContaining({
        id_fournisseur: ID_FOURNISSEUR,
        nom: 'DUPONT',
        prenom: 'Jean',
        naturefonction: 'COMMERCIAL',
      }),
    )
  })
})

describe('updateContact', () => {
  it('rejette une entrée invalide (400)', async () => {
    await expect(updateContact(MATRICULE, 1, { ...VALID_PAYLOAD, prenom: '' })).rejects.toMatchObject({
      status: 400,
    })
    expect(findById).not.toHaveBeenCalled()
    expect(update).not.toHaveBeenCalled()
  })

  it('rejette si le contact est introuvable (404)', async () => {
    findById.mockResolvedValue(null)

    await expect(updateContact(MATRICULE, 1, VALID_PAYLOAD)).rejects.toMatchObject({ status: 404 })
    expect(update).not.toHaveBeenCalled()
  })

  it('vérifie le droit de gestion sur le fournisseur du contact', async () => {
    findById.mockResolvedValue(CONTACT)
    assertManagesFournisseur.mockRejectedValue(Object.assign(new Error('Droits insuffisants'), { status: 403 }))

    await expect(updateContact(MATRICULE, 1, VALID_PAYLOAD)).rejects.toMatchObject({ status: 403 })
    expect(assertManagesFournisseur).toHaveBeenCalledWith(MATRICULE, ID_FOURNISSEUR)
    expect(update).not.toHaveBeenCalled()
  })

  it('délègue au repository quand valide et autorisé', async () => {
    findById.mockResolvedValue(CONTACT)
    assertManagesFournisseur.mockResolvedValue(undefined)
    update.mockResolvedValue({ ...CONTACT, nom: 'Nouveau' })

    await updateContact(MATRICULE, 1, { ...VALID_PAYLOAD, nom: 'Nouveau' })

    expect(update).toHaveBeenCalledWith(1, expect.objectContaining({ nom: 'NOUVEAU' }))
  })
})

describe('deleteContact', () => {
  it('rejette si le contact est introuvable (404)', async () => {
    findById.mockResolvedValue(null)

    await expect(deleteContact(MATRICULE, 1)).rejects.toMatchObject({ status: 404 })
    expect(remove).not.toHaveBeenCalled()
  })

  it('vérifie le droit de gestion avant suppression', async () => {
    findById.mockResolvedValue(CONTACT)
    assertManagesFournisseur.mockRejectedValue(Object.assign(new Error('Droits insuffisants'), { status: 403 }))

    await expect(deleteContact(MATRICULE, 1)).rejects.toMatchObject({ status: 403 })
    expect(remove).not.toHaveBeenCalled()
  })

  it('supprime physiquement le contact (pas de champ état)', async () => {
    findById.mockResolvedValue(CONTACT)
    assertManagesFournisseur.mockResolvedValue(undefined)
    remove.mockResolvedValue(undefined)

    await deleteContact(MATRICULE, 1)

    expect(remove).toHaveBeenCalledWith(1)
  })
})
