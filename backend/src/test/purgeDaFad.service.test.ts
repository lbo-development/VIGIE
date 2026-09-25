import { describe, it, expect, vi, beforeEach } from 'vitest'

const countByService = vi.fn()
const findStoragePathsByService = vi.fn()
const purgerViaRpc = vi.fn()

vi.mock('../repositories/purgeDaFad.repository.js', () => ({
  countByService: (...args: unknown[]) => countByService(...args),
  findStoragePathsByService: (...args: unknown[]) => findStoragePathsByService(...args),
  purgerViaRpc: (...args: unknown[]) => purgerViaRpc(...args),
}))

const pieceRemoveFile = vi.fn()
vi.mock('../repositories/pieceJointe.repository.js', () => ({
  removeFile: (...args: unknown[]) => pieceRemoveFile(...args),
}))

const devisRemoveFile = vi.fn()
vi.mock('../repositories/devisConsulte.repository.js', () => ({
  removeFile: (...args: unknown[]) => devisRemoveFile(...args),
}))

const hasActiveRole = vi.fn()
vi.mock('../repositories/auth.repository.js', () => ({
  hasActiveRole: (...args: unknown[]) => hasActiveRole(...args),
}))

const { countDaFadService, purgerDaFadService } = await import('../services/purgeDaFad.service.js')

const ADMIN_APP = '000100'
const AUTRE = '000900'
const ID_SERVICE = 10

beforeEach(() => {
  countByService.mockReset()
  findStoragePathsByService.mockReset().mockResolvedValue({ pieceJointePaths: [], devisPaths: [] })
  purgerViaRpc.mockReset()
  pieceRemoveFile.mockReset().mockResolvedValue(undefined)
  devisRemoveFile.mockReset().mockResolvedValue(undefined)
  hasActiveRole.mockReset().mockResolvedValue(false)
})

describe('countDaFadService', () => {
  it('rejette sans authentification (401)', async () => {
    await expect(countDaFadService(null, ID_SERVICE)).rejects.toMatchObject({ status: 401 })
  })

  it('rejette un acteur qui n\'est pas ADMIN_APP (403)', async () => {
    hasActiveRole.mockResolvedValue(false)
    await expect(countDaFadService(AUTRE, ID_SERVICE)).rejects.toMatchObject({ status: 403 })
    expect(countByService).not.toHaveBeenCalled()
  })

  it('ADMIN_APP obtient le compte du service', async () => {
    hasActiveRole.mockResolvedValue(true)
    countByService.mockResolvedValue(42)
    const result = await countDaFadService(ADMIN_APP, ID_SERVICE)
    expect(result).toBe(42)
    expect(countByService).toHaveBeenCalledWith(ID_SERVICE)
  })
})

describe('purgerDaFadService', () => {
  it('rejette sans authentification (401)', async () => {
    await expect(purgerDaFadService(null, ID_SERVICE)).rejects.toMatchObject({ status: 401 })
  })

  it('rejette un acteur qui n\'est pas ADMIN_APP (403), sans jamais appeler le RPC destructeur', async () => {
    hasActiveRole.mockResolvedValue(false)
    await expect(purgerDaFadService(AUTRE, ID_SERVICE)).rejects.toMatchObject({ status: 403 })
    expect(purgerViaRpc).not.toHaveBeenCalled()
  })

  it('ADMIN_APP : liste les fichiers Storage AVANT d\'appeler le RPC, puis les nettoie', async () => {
    hasActiveRole.mockResolvedValue(true)
    findStoragePathsByService.mockResolvedValue({
      pieceJointePaths: ['csf/1/a.pdf', 'da/2/b.pdf'],
      devisPaths: ['devis/3/c.pdf'],
    })
    purgerViaRpc.mockResolvedValue(12)

    const callOrder: string[] = []
    findStoragePathsByService.mockImplementation(async () => {
      callOrder.push('findStoragePathsByService')
      return { pieceJointePaths: ['csf/1/a.pdf', 'da/2/b.pdf'], devisPaths: ['devis/3/c.pdf'] }
    })
    purgerViaRpc.mockImplementation(async () => {
      callOrder.push('purgerViaRpc')
      return 12
    })

    const result = await purgerDaFadService(ADMIN_APP, ID_SERVICE)

    expect(result).toBe(12)
    expect(callOrder).toEqual(['findStoragePathsByService', 'purgerViaRpc'])
    expect(pieceRemoveFile).toHaveBeenCalledWith('csf/1/a.pdf')
    expect(pieceRemoveFile).toHaveBeenCalledWith('da/2/b.pdf')
    expect(devisRemoveFile).toHaveBeenCalledWith('devis/3/c.pdf')
  })

  it('un échec de nettoyage Storage best-effort ne fait pas échouer la suppression (déjà actée en base)', async () => {
    hasActiveRole.mockResolvedValue(true)
    findStoragePathsByService.mockResolvedValue({ pieceJointePaths: ['csf/1/a.pdf'], devisPaths: [] })
    purgerViaRpc.mockResolvedValue(1)
    pieceRemoveFile.mockRejectedValue(new Error('storage down'))

    await expect(purgerDaFadService(ADMIN_APP, ID_SERVICE)).resolves.toBe(1)
  })

  it('service sans aucune DA/FAD : nombre à 0, aucun appel de nettoyage', async () => {
    hasActiveRole.mockResolvedValue(true)
    findStoragePathsByService.mockResolvedValue({ pieceJointePaths: [], devisPaths: [] })
    purgerViaRpc.mockResolvedValue(0)

    const result = await purgerDaFadService(ADMIN_APP, ID_SERVICE)
    expect(result).toBe(0)
    expect(pieceRemoveFile).not.toHaveBeenCalled()
    expect(devisRemoveFile).not.toHaveBeenCalled()
  })
})
