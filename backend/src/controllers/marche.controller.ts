import type { NextFunction, Request, Response } from 'express'
import * as marcheService from '../services/marche.service.js'
import { AppError } from '../middlewares/errorHandler.js'

export async function getMarches(req: Request, res: Response, next: NextFunction) {
  try {
    const raw = req.query.idService
    const idService = raw !== undefined ? Number(raw) : undefined
    const marches = await marcheService.listMarches(req.matricule ?? null, idService)
    res.json(marches)
  } catch (err) {
    next(err)
  }
}

export async function getMarcheOptions(req: Request, res: Response, next: NextFunction) {
  try {
    const raw = req.query.idService
    const idService = Number(raw)
    if (!raw || !Number.isFinite(idService)) throw new AppError('Le service cible est obligatoire.', 400)
    const options = await marcheService.listMarcheOptions(req.matricule ?? null, idService)
    res.json(options)
  } catch (err) {
    next(err)
  }
}

export async function getMarcheLastImport(req: Request, res: Response, next: NextFunction) {
  try {
    const raw = req.query.idService
    const idService = raw !== undefined ? Number(raw) : undefined
    const info = await marcheService.getLastImportStatus(req.matricule ?? null, idService)
    res.json(info)
  } catch (err) {
    next(err)
  }
}

export async function putMarche(req: Request, res: Response, next: NextFunction) {
  try {
    const marche = await marcheService.updateMarcheManagedFields(req.matricule ?? null, req.params.nummarche, req.body)
    res.json(marche)
  } catch (err) {
    next(err)
  }
}
