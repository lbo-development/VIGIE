import type { NextFunction, Request, Response } from 'express'
import * as secteurService from '../services/secteur.service.js'
import * as sousSecteurService from '../services/sousSecteur.service.js'

export async function getSecteurs(req: Request, res: Response, next: NextFunction) {
  try {
    const raw = req.query.idService
    const idService = typeof raw === 'string' && raw.trim() !== '' ? Number(raw) : undefined
    const secteurs = await secteurService.listSecteurs(
      idService !== undefined && Number.isFinite(idService) ? idService : undefined,
    )
    res.json(secteurs)
  } catch (err) {
    next(err)
  }
}

export async function postSecteur(req: Request, res: Response, next: NextFunction) {
  try {
    const secteur = await secteurService.createSecteur(req.matricule ?? null, req.body)
    res.status(201).json(secteur)
  } catch (err) {
    next(err)
  }
}

export async function putSecteur(req: Request, res: Response, next: NextFunction) {
  try {
    const secteur = await secteurService.updateSecteur(req.matricule ?? null, req.params.codeSecteur, req.body)
    res.json(secteur)
  } catch (err) {
    next(err)
  }
}

export async function putSecteursReorder(req: Request, res: Response, next: NextFunction) {
  try {
    await secteurService.reorderSecteurs(req.matricule ?? null, req.body)
    res.status(204).end()
  } catch (err) {
    next(err)
  }
}

export async function postSousSecteur(req: Request, res: Response, next: NextFunction) {
  try {
    const sousSecteur = await sousSecteurService.createSousSecteur(
      req.matricule ?? null,
      req.params.codeSecteur,
      req.body,
    )
    res.status(201).json(sousSecteur)
  } catch (err) {
    next(err)
  }
}

export async function putSousSecteur(req: Request, res: Response, next: NextFunction) {
  try {
    const sousSecteur = await sousSecteurService.updateSousSecteur(
      req.matricule ?? null,
      req.params.codeSecteur,
      req.params.codeSousSecteur,
      req.body,
    )
    res.json(sousSecteur)
  } catch (err) {
    next(err)
  }
}

export async function putSousSecteursReorder(req: Request, res: Response, next: NextFunction) {
  try {
    await sousSecteurService.reorderSousSecteurs(req.matricule ?? null, req.params.codeSecteur, req.body)
    res.status(204).end()
  } catch (err) {
    next(err)
  }
}
