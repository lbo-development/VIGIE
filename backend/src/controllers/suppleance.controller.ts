import type { NextFunction, Request, Response } from 'express'
import * as suppleanceService from '../services/suppleance.service.js'
import { AppError } from '../middlewares/errorHandler.js'

function parseId(raw: unknown, label: string): number {
  const value = typeof raw === 'string' ? Number(raw) : NaN
  if (!Number.isInteger(value)) throw new AppError(`${label} invalide`, 400)
  return value
}

export async function getMesSuppleances(req: Request, res: Response, next: NextFunction) {
  try {
    res.json(await suppleanceService.listMesSuppleances(req.matricule ?? null))
  } catch (err) {
    next(err)
  }
}

export async function getCandidats(req: Request, res: Response, next: NextFunction) {
  try {
    const idRole = parseId(req.query.idRole, 'idRole')
    res.json(await suppleanceService.listCandidats(req.matricule ?? null, idRole))
  } catch (err) {
    next(err)
  }
}

export async function getSupervision(req: Request, res: Response, next: NextFunction) {
  try {
    const idService = req.query.idService === undefined ? undefined : parseId(req.query.idService, 'idService')
    res.json(await suppleanceService.listSupervision(req.matricule ?? null, idService))
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

export async function postRetraitSuppleance(req: Request, res: Response, next: NextFunction) {
  try {
    const idSuppleance = parseId(req.params.idSuppleance, 'idSuppleance')
    res.json(await suppleanceService.retireSuppleance(req.matricule ?? null, idSuppleance))
  } catch (err) {
    next(err)
  }
}
