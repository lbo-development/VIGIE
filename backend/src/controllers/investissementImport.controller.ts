import type { NextFunction, Request, Response } from 'express'
import * as investissementImportService from '../services/investissementImport.service.js'
import { AppError } from '../middlewares/errorHandler.js'

/**
 * Couche HTTP : traduit requête <-> réponse. Le fichier arrive en multipart/form-data (champ
 * "fichier", voir routes/investissementImport.routes.ts — multer en memoryStorage, jamais
 * persisté sur disque).
 */

function parseIdService(req: Request): number {
  const raw = req.body.idService
  const idService = Number(raw)
  if (!raw || !Number.isFinite(idService)) {
    throw new AppError('Le service cible est obligatoire.', 400)
  }
  return idService
}

export async function postPreview(req: Request, res: Response, next: NextFunction) {
  try {
    if (!req.file) throw new AppError('Aucun fichier reçu.', 400)
    const idService = parseIdService(req)
    const report = await investissementImportService.preview(req.matricule ?? null, idService, req.file.buffer)
    res.json(report)
  } catch (err) {
    next(err)
  }
}

export async function postConfirm(req: Request, res: Response, next: NextFunction) {
  try {
    if (!req.file) throw new AppError('Aucun fichier reçu.', 400)
    const idService = parseIdService(req)
    const report = await investissementImportService.confirm(req.matricule ?? null, idService, req.file.buffer)
    res.json(report)
  } catch (err) {
    next(err)
  }
}

export async function getLastImport(req: Request, res: Response, next: NextFunction) {
  try {
    const raw = req.query.idService
    const idService = Number(raw)
    if (!raw || !Number.isFinite(idService)) {
      throw new AppError('Le service cible est obligatoire.', 400)
    }
    const info = await investissementImportService.getLastImportInfo(req.matricule ?? null, idService)
    res.json(info)
  } catch (err) {
    next(err)
  }
}
