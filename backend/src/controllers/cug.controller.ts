import type { NextFunction, Request, Response } from 'express'
import * as cugService from '../services/cug.service.js'

export async function getCug(req: Request, res: Response, next: NextFunction) {
  try {
    const raw = req.query.idService
    const idService = typeof raw === 'string' && raw.trim() !== '' ? Number(raw) : undefined
    const cug = await cugService.listCug(
      req.matricule ?? null,
      idService !== undefined && Number.isFinite(idService) ? idService : undefined,
    )
    res.json(cug)
  } catch (err) {
    next(err)
  }
}

export async function postCug(req: Request, res: Response, next: NextFunction) {
  try {
    const cug = await cugService.createCug(req.matricule ?? null, req.body)
    res.status(201).json(cug)
  } catch (err) {
    next(err)
  }
}

export async function putCug(req: Request, res: Response, next: NextFunction) {
  try {
    const cug = await cugService.updateCug(req.matricule ?? null, req.params.codeCug, req.body)
    res.json(cug)
  } catch (err) {
    next(err)
  }
}
