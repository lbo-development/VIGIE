import { describe, it, expect, vi } from 'vitest'
import type { Response } from 'express'
import { AppError, errorHandler } from '../middlewares/errorHandler.js'

function mockResponse() {
  const res = {
    status: vi.fn(),
    json: vi.fn(),
  } as unknown as Response
  vi.mocked(res.status).mockReturnValue(res)
  return res
}

describe('errorHandler', () => {
  it('renvoie le message et le statut propres à une AppError (erreur métier délibérée)', () => {
    const res = mockResponse()

    errorHandler(new AppError('Le SIREN est invalide', 400), {} as never, res, vi.fn())

    expect(res.status).toHaveBeenCalledWith(400)
    expect(res.json).toHaveBeenCalledWith({ message: 'Le SIREN est invalide' })
  })

  it("masque le message brut d'une erreur technique (ex. Postgrest) derrière un message générique (SECURITY.md §8)", () => {
    const res = mockResponse()
    const rawDbError = new Error('column "actif" of relation "cug" does not exist')

    errorHandler(rawDbError, {} as never, res, vi.fn())

    expect(res.status).toHaveBeenCalledWith(500)
    expect(res.json).toHaveBeenCalledWith({ message: 'Erreur interne du serveur' })
  })

  it('masque également une valeur non-Error (ex. rejet avec une chaîne ou un objet brut)', () => {
    const res = mockResponse()

    errorHandler('boom', {} as never, res, vi.fn())

    expect(res.status).toHaveBeenCalledWith(500)
    expect(res.json).toHaveBeenCalledWith({ message: 'Erreur interne du serveur' })
  })
})
