import { describe, it, expect, vi, beforeEach } from 'vitest'

const findValeurEffective = vi.fn()
const upsert = vi.fn()
const findAllRows = vi.fn()
const findIdServiceByMatricule = vi.fn()
const findAllDefinitions = vi.fn()
const findDefinitionByCle = vi.fn()

vi.mock('../repositories/parametres.repository.js', () => ({
  findValeurEffective: (...args: unknown[]) => findValeurEffective(...args),
  upsert: (...args: unknown[]) => upsert(...args),
  findAllRows: (...args: unknown[]) => findAllRows(...args),
}))
vi.mock('../repositories/parametreDefinition.repository.js', () => ({
  findAll: (...args: unknown[]) => findAllDefinitions(...args),
  findByCle: (...args: unknown[]) => findDefinitionByCle(...args),
}))
vi.mock('../repositories/acteur.repository.js', () => ({
  findIdServiceByMatricule: (...args: unknown[]) => findIdServiceByMatricule(...args),
}))

const { getParametreEffectif, setParametre, listParametreKeys, listRows } = await import(
  '../services/parametres.service.js'
)

const DEFINITION = {
  cle: 'auth.inactivite_delai_minutes',
  libelle: "Délai d'inactivité avant déconnexion automatique (minutes)",
  description: null,
  valeur_defaut: 30,
}

beforeEach(() => {
  findValeurEffective.mockReset()
  findIdServiceByMatricule.mockReset()
  upsert.mockReset()
  findAllRows.mockReset()
  findAllDefinitions.mockReset()
  findDefinitionByCle.mockReset()
})

describe('listParametreKeys', () => {
  it('expose le registre des paramètres connus, depuis finances.parametre_definition', async () => {
    findAllDefinitions.mockResolvedValue([DEFINITION])

    await expect(listParametreKeys()).resolves.toEqual([
      {
        cle: 'auth.inactivite_delai_minutes',
        libelle: DEFINITION.libelle,
        defaut: 30,
      },
    ])
  })
})

describe('listRows', () => {
  it('rejette une clé inconnue (404)', async () => {
    findDefinitionByCle.mockResolvedValue(null)

    await expect(listRows('clef.inconnue')).rejects.toMatchObject({ status: 404 })
  })

  it('délègue au repository pour une clé connue', async () => {
    findDefinitionByCle.mockResolvedValue(DEFINITION)
    findAllRows.mockResolvedValue([{ id_parametre: 1, cle: 'auth.inactivite_delai_minutes' }])

    const rows = await listRows('auth.inactivite_delai_minutes')

    expect(findAllRows).toHaveBeenCalledWith('auth.inactivite_delai_minutes')
    expect(rows).toEqual([{ id_parametre: 1, cle: 'auth.inactivite_delai_minutes' }])
  })
})

describe('getParametreEffectif', () => {
  it('rejette une clé inconnue (404)', async () => {
    findDefinitionByCle.mockResolvedValue(null)

    await expect(getParametreEffectif('12345', 'clef.inconnue')).rejects.toMatchObject({ status: 404 })
  })

  it("retourne la valeur par défaut (issue de parametre_definition) quand aucune ligne n'existe en base", async () => {
    findDefinitionByCle.mockResolvedValue(DEFINITION)
    findIdServiceByMatricule.mockResolvedValue(42)
    findValeurEffective.mockResolvedValue(null)

    const result = await getParametreEffectif('12345', 'auth.inactivite_delai_minutes')

    expect(result).toEqual({ cle: 'auth.inactivite_delai_minutes', valeur: 30 })
    expect(findValeurEffective).toHaveBeenCalledWith('auth.inactivite_delai_minutes', 42)
  })

  it('retourne la valeur résolue en base quand elle existe', async () => {
    findDefinitionByCle.mockResolvedValue(DEFINITION)
    findIdServiceByMatricule.mockResolvedValue(42)
    findValeurEffective.mockResolvedValue(20)

    const result = await getParametreEffectif('12345', 'auth.inactivite_delai_minutes')

    expect(result).toEqual({ cle: 'auth.inactivite_delai_minutes', valeur: 20 })
  })
})

describe('setParametre', () => {
  it('rejette une clé inconnue (404)', async () => {
    findDefinitionByCle.mockResolvedValue(null)

    await expect(setParametre('12345', 'clef.inconnue', { valeur: 10 })).rejects.toMatchObject({ status: 404 })
  })

  it('rejette idDirection et idService renseignés simultanément (400)', async () => {
    findDefinitionByCle.mockResolvedValue(DEFINITION)

    await expect(
      setParametre('12345', 'auth.inactivite_delai_minutes', { valeur: 10, idDirection: 1, idService: 2 }),
    ).rejects.toMatchObject({ status: 400 })
    expect(upsert).not.toHaveBeenCalled()
  })

  it('rejette une valeur hors du schéma du paramètre (400)', async () => {
    findDefinitionByCle.mockResolvedValue(DEFINITION)

    await expect(
      setParametre('12345', 'auth.inactivite_delai_minutes', { valeur: 'pas un nombre' }),
    ).rejects.toMatchObject({ status: 400 })
    expect(upsert).not.toHaveBeenCalled()
  })

  it('accepte une portée service seule et délègue au repository', async () => {
    findDefinitionByCle.mockResolvedValue(DEFINITION)
    upsert.mockResolvedValue({ id_parametre: 1 })

    await setParametre('12345', 'auth.inactivite_delai_minutes', { valeur: 20, idService: 42 })

    expect(upsert).toHaveBeenCalledWith({
      cle: 'auth.inactivite_delai_minutes',
      valeur: 20,
      idDirection: null,
      idService: 42,
      matriculeMaj: '12345',
      description: undefined,
    })
  })
})
