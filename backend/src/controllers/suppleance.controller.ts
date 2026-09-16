import type { NextFunction, Request, Response } from 'express'
import * as suppleanceService from '../services/suppleance.service.js'
import { AppError } from '../middlewares/errorHandler.js'

export async function getSuppleances(req: Request, res: Response, next: NextFunction) {
  try {
    const raw = req.query.idRole
    const idRole = typeof raw === 'string' ? Number(raw) : NaN
    if (!Number.isFinite(idRole)) throw new AppError('idRole requis', 400)

    const suppleances = await suppleanceService.listSuppleancesByRole(req.matricule ?? null, idRole)
    res.json(suppleances)
  } catch (err) {
    next(err)
  }
}

export async function postSuppleance(req: Request, res: Response, next: NextFunction) {
  try {
    const suppleance = await suppleanceService.createSuppleance(req.matricule ?? null, req.body)
    res.status(201).json(suppleance)
  } catch (err) {
    next(err)
  }
}
