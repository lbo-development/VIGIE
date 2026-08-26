import { describe, it, expect, vi, beforeEach } from 'vitest'

const findValeurEffective = vi.fn()
const upsert = vi.fn()
const findAllRows = vi.fn()
const findIdServiceByMatricule = vi.fn()

vi.mock('../repositories/parametres.repository.js', () => ({
  findValeurEffective: (...args: unknown[]) => findValeurEffective(...args),
  upsert: (...args: unknown[]) => upsert(...args),
  findAllRows: (...args: unknown[]) => findAllRows(...args),
}))
vi.mock('../repositories/acteur.repository.js', () => ({
  findIdServiceByMatricule: (...args: unknown[]) => findIdServiceByMatricule(...args),
}))

const { getParametreEffectif, setParametre, listParametreKeys, listRows } = await import(
  '../services/parametres.service.js'
)

describe('listParametreKeys', () => {
  it('expose le registre des paramètres connus', () => {
    expect(listParametreKeys()).toEqual([
      {
        cle: 'auth.inactivite_delai_minutes',
        libelle: expect.any(String),
        defaut: 30,
      },
    ])
  })
})

describe('listRows', () => {
  it('rejette une clé inconnue (404)', async () => {
    await expect(listRows('clef.inconnue')).rejects.toMatchObject({ status: 404 })
  })

  it('délègue au repository pour une clé connue', async () => {
    findAllRows.mockResolvedValue([{ id_parametre: 1, cle: 'auth.inactivite_delai_minutes' }])

    const rows = await listRows('auth.inactivite_delai_minutes')

    expect(findAllRows).toHaveBeenCalledWith('auth.inactivite_delai_minutes')
    expect(rows).toEqual([{ id_parametre: 1, cle: 'auth.inactivite_delai_minutes' }])
  })
})

describe('getParametreEffectif', () => {
  beforeEach(() => {
    findValeurEffective.mockReset()
    findIdServiceByMatricule.mockReset()
  })

  it('rejette une clé inconnue (404)', async () => {
    await expect(getParametreEffectif('12345', 'clef.inconnue')).rejects.toMatchObject({ status: 404 })
  })

  it("retourne la valeur par défaut quand aucune ligne n'existe en base", async () => {
    findIdServiceByMatricule.mockResolvedValue(42)
    findValeurEffective.mockResolvedValue(null)

    const result = await getParametreEffectif('12345', 'auth.inactivite_delai_minutes')

    expect(result).toEqual({ cle: 'auth.inactivite_delai_minutes', valeur: 30 })
    expect(findValeurEffective).toHaveBeenCalledWith('auth.inactivite_delai_minutes', 42)
  })

  it('retourne la valeur résolue en base quand elle existe', async () => {
    findIdServiceByMatricule.mockResolvedValue(42)
    findValeurEffective.mockResolvedValue(20)

    const result = await getParametreEffectif('12345', 'auth.inactivite_delai_minutes')

    expect(result).toEqual({ cle: 'auth.inactivite_delai_minutes', valeur: 20 })
  })
})

describe('setParametre', () => {
  beforeEach(() => {
    upsert.mockReset()
  })

  it('rejette une clé inconnue (404)', async () => {
    await expect(setParametre('12345', 'clef.inconnue', { valeur: 10 })).rejects.toMatchObject({ status: 404 })
  })

  it('rejette idDirection et idService renseignés simultanément (400)', async () => {
    await expect(
      setParametre('12345', 'auth.inactivite_delai_minutes', { valeur: 10, idDirection: 1, idService: 2 }),
    ).rejects.toMatchObject({ status: 400 })
    expect(upsert).not.toHaveBeenCalled()
  })

  it('rejette une valeur hors du schéma du paramètre (400)', async () => {
    await expect(
      setParametre('12345', 'auth.inactivite_delai_minutes', { valeur: 'pas un nombre' }),
    ).rejects.toMatchObject({ status: 400 })
    expect(upsert).not.toHaveBeenCalled()
  })

  it('accepte une portée service seule et délègue au repository', async () => {
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
