import type { NextFunction, Request, Response } from 'express'
import * as commandePgiService from '../services/commandePgi.service.js'

export async function getCommandesPgi(req: Request, res: Response, next: NextFunction) {
  try {
    const raw = req.query.idService
    const idService = raw !== undefined ? Number(raw) : undefined
    const commandes = await commandePgiService.listCommandesPgi(req.matricule ?? null, idService)
    res.json(commandes)
  } catch (err) {
    next(err)
  }
}

export async function getCommandeLastImport(req: Request, res: Response, next: NextFunction) {
  try {
    const raw = req.query.idService
    const idService = raw !== undefined ? Number(raw) : undefined
    const info = await commandePgiService.getLastImportStatus(req.matricule ?? null, idService)
    res.json(info)
  } catch (err) {
    next(err)
  }
}
