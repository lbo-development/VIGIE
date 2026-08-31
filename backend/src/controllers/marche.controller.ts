import type { NextFunction, Request, Response } from 'express'
import * as marcheService from '../services/marche.service.js'

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
