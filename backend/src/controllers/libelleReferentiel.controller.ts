import type { NextFunction, Request, Response } from 'express'
import * as libelleReferentielService from '../services/libelleReferentiel.service.js'

export async function getLibelleReferentiel(req: Request, res: Response, next: NextFunction) {
  try {
    const rows = await libelleReferentielService.listByDomaine(req.matricule ?? null, req.query)
    res.json(rows)
  } catch (err) {
    next(err)
  }
}

export async function postLibelleReferentiel(req: Request, res: Response, next: NextFunction) {
  try {
    const row = await libelleReferentielService.createLibelle(req.matricule ?? null, req.body)
    res.status(201).json(row)
  } catch (err) {
    next(err)
  }
}

export async function putLibelleReferentiel(req: Request, res: Response, next: NextFunction) {
  try {
    const row = await libelleReferentielService.updateLibelle(req.matricule ?? null, req.params.domaine, req.params.code, req.body)
    res.json(row)
  } catch (err) {
    next(err)
  }
}

export async function deleteLibelleReferentielHandler(req: Request, res: Response, next: NextFunction) {
  try {
    await libelleReferentielService.deleteLibelle(req.matricule ?? null, req.params.domaine, req.params.code)
    res.status(204).end()
  } catch (err) {
    next(err)
  }
}

export async function putLibelleReferentielReorder(req: Request, res: Response, next: NextFunction) {
  try {
    await libelleReferentielService.reorderLibelles(req.matricule ?? null, req.body)
    res.status(204).end()
  } catch (err) {
    next(err)
  }
}
