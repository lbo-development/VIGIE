import type { NextFunction, Request, Response } from 'express'
import * as purgeDaFadService from '../services/purgeDaFad.service.js'
import { AppError } from '../middlewares/errorHandler.js'

function parseIdService(raw: unknown): number {
  const id = Number(raw)
  return Number.isFinite(id) ? id : NaN
}

export async function getCountDaFadService(req: Request, res: Response, next: NextFunction) {
  try {
    const idService = parseIdService(req.query.idService)
    if (!Number.isFinite(idService)) throw new AppError('idService requis.', 400)
    const nombre = await purgeDaFadService.countDaFadService(req.matricule ?? null, idService)
    res.json({ nombre })
  } catch (err) {
    next(err)
  }
}

export async function postPurgeDaFadService(req: Request, res: Response, next: NextFunction) {
  try {
    const idService = parseIdService(req.body?.idService)
    if (!Number.isFinite(idService)) throw new AppError('idService requis.', 400)
    const nombre = await purgeDaFadService.purgerDaFadService(req.matricule ?? null, idService)
    res.json({ nombre })
  } catch (err) {
    next(err)
  }
}
