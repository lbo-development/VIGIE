import type { NextFunction, Request, Response } from 'express'
import * as marcheTiersService from '../services/marcheTiers.service.js'

export async function getMarcheTiers(req: Request, res: Response, next: NextFunction) {
  try {
    const raw = req.query.idService
    const idService = raw !== undefined ? Number(raw) : undefined
    const marcheTiers = await marcheTiersService.listMarcheTiers(req.matricule ?? null, idService)
    res.json(marcheTiers)
  } catch (err) {
    next(err)
  }
}

export async function postMarcheTiers(req: Request, res: Response, next: NextFunction) {
  try {
    const marcheTiers = await marcheTiersService.createMarcheTiers(req.matricule ?? null, req.body)
    res.status(201).json(marcheTiers)
  } catch (err) {
    next(err)
  }
}

export async function putMarcheTiers(req: Request, res: Response, next: NextFunction) {
  try {
    const idMarcheTiers = Number(req.params.id)
    const marcheTiers = await marcheTiersService.updateMarcheTiers(req.matricule ?? null, idMarcheTiers, req.body)
    res.json(marcheTiers)
  } catch (err) {
    next(err)
  }
}

export async function deleteMarcheTiers(req: Request, res: Response, next: NextFunction) {
  try {
    await marcheTiersService.deleteMarcheTiers(req.matricule ?? null, Number(req.params.id))
    res.status(204).end()
  } catch (err) {
    next(err)
  }
}
