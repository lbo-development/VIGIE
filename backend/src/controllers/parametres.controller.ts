import type { NextFunction, Request, Response } from 'express'
import * as parametresService from '../services/parametres.service.js'
import { AppError } from '../middlewares/errorHandler.js'

/**
 * Couche HTTP : traduit requête <-> réponse. Aucune logique métier ici,
 * uniquement de l'orchestration et la gestion des erreurs via next(err).
 * req.matricule est renseigné par requireAuth (monté sur ce routeur).
 */

export async function getParametreKeys(_req: Request, res: Response, next: NextFunction) {
  try {
    res.json(parametresService.listParametreKeys())
  } catch (err) {
    next(err)
  }
}

export async function getParametreRows(req: Request, res: Response, next: NextFunction) {
  try {
    const rows = await parametresService.listRows(req.params.cle)
    res.json(rows)
  } catch (err) {
    next(err)
  }
}

export async function getParametre(req: Request, res: Response, next: NextFunction) {
  try {
    if (!req.matricule) throw new AppError('Authentification requise', 401)
    const parametre = await parametresService.getParametreEffectif(req.matricule, req.params.cle)
    res.json(parametre)
  } catch (err) {
    next(err)
  }
}

export async function putParametre(req: Request, res: Response, next: NextFunction) {
  try {
    if (!req.matricule) throw new AppError('Authentification requise', 401)
    const parametre = await parametresService.setParametre(req.matricule, req.params.cle, req.body)
    res.json(parametre)
  } catch (err) {
    next(err)
  }
}
