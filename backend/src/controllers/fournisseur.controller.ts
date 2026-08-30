import type { NextFunction, Request, Response } from 'express'
import * as fournisseurService from '../services/fournisseur.service.js'

export async function getFournisseurs(req: Request, res: Response, next: NextFunction) {
  try {
    const raw = req.query.idService
    const idService = typeof raw === 'string' && raw.trim() !== '' ? Number(raw) : undefined
    const fournisseurs = await fournisseurService.listFournisseurs(
      req.matricule ?? null,
      idService !== undefined && Number.isFinite(idService) ? idService : undefined,
    )
    res.json(fournisseurs)
  } catch (err) {
    next(err)
  }
}

export async function postFournisseur(req: Request, res: Response, next: NextFunction) {
  try {
    const fournisseur = await fournisseurService.createFournisseur(req.matricule ?? null, req.body)
    res.status(201).json(fournisseur)
  } catch (err) {
    next(err)
  }
}

export async function putFournisseur(req: Request, res: Response, next: NextFunction) {
  try {
    const fournisseur = await fournisseurService.updateFournisseur(
      req.matricule ?? null,
      Number(req.params.idFournisseur),
      req.body,
    )
    res.json(fournisseur)
  } catch (err) {
    next(err)
  }
}

export async function deleteFournisseur(req: Request, res: Response, next: NextFunction) {
  try {
    await fournisseurService.deleteFournisseur(req.matricule ?? null, Number(req.params.idFournisseur))
    res.status(204).end()
  } catch (err) {
    next(err)
  }
}
