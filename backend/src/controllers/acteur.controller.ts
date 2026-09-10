import type { NextFunction, Request, Response } from 'express'
import * as acteurService from '../services/acteur.service.js'

function parseOptionalNumber(raw: unknown): number | undefined {
  if (typeof raw !== 'string' || raw.trim() === '') return undefined
  const n = Number(raw)
  return Number.isFinite(n) ? n : undefined
}

export async function getActeurs(req: Request, res: Response, next: NextFunction) {
  try {
    const acteurs = await acteurService.listActeurs(req.matricule ?? null, {
      idService: parseOptionalNumber(req.query.idService),
      idCellule: parseOptionalNumber(req.query.idCellule),
    })
    res.json(acteurs)
  } catch (err) {
    next(err)
  }
}

export async function postActeur(req: Request, res: Response, next: NextFunction) {
  try {
    const created = await acteurService.createActeur(req.body)
    res.status(201).json(created)
  } catch (err) {
    next(err)
  }
}

export async function putActeur(req: Request, res: Response, next: NextFunction) {
  try {
    const acteur = await acteurService.updateActeur(req.params.matricule, req.body)
    res.json(acteur)
  } catch (err) {
    next(err)
  }
}

export async function deleteActeur(req: Request, res: Response, next: NextFunction) {
  try {
    await acteurService.deleteActeur(req.params.matricule)
    res.status(204).send()
  } catch (err) {
    next(err)
  }
}
