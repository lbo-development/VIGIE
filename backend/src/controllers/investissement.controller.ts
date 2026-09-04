import type { NextFunction, Request, Response } from 'express'
import * as investissementService from '../services/investissement.service.js'

export async function getInvestissements(req: Request, res: Response, next: NextFunction) {
  try {
    const raw = req.query.idService
    const idService = raw !== undefined ? Number(raw) : undefined
    const investissements = await investissementService.listInvestissements(req.matricule ?? null, idService)
    res.json(investissements)
  } catch (err) {
    next(err)
  }
}

export async function getInvestissementLastImport(req: Request, res: Response, next: NextFunction) {
  try {
    const raw = req.query.idService
    const idService = raw !== undefined ? Number(raw) : undefined
    const info = await investissementService.getLastImportStatus(req.matricule ?? null, idService)
    res.json(info)
  } catch (err) {
    next(err)
  }
}

export async function putInvestissementManagedFields(req: Request, res: Response, next: NextFunction) {
  try {
    const operation = await investissementService.updateManagedFields(req.matricule ?? null, req.params.numeroOperation, req.body)
    res.json(operation)
  } catch (err) {
    next(err)
  }
}
