import type { NextFunction, Request, Response } from 'express'
import * as acteurService from '../services/acteur.service.js'
import * as signatureActeurService from '../services/signatureActeur.service.js'

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

export async function getActeurSignature(req: Request, res: Response, next: NextFunction) {
  try {
    const signature = await signatureActeurService.getSignature(req.matricule ?? null, req.params.matricule)
    res.json(signature)
  } catch (err) {
    next(err)
  }
}

export async function getActeurSignatureFichier(req: Request, res: Response, next: NextFunction) {
  try {
    const { buffer, nomFichier } = await signatureActeurService.downloadSignature(req.matricule ?? null, req.params.matricule)
    res.setHeader('Content-Type', nomFichier.toLowerCase().endsWith('.png') ? 'image/png' : 'image/jpeg')
    res.setHeader('Content-Disposition', `inline; filename="${encodeURIComponent(nomFichier)}"`)
    res.send(buffer)
  } catch (err) {
    next(err)
  }
}

export async function putActeurSignature(req: Request, res: Response, next: NextFunction) {
  try {
    const signature = await signatureActeurService.uploadSignature(req.matricule ?? null, req.params.matricule, req.file)
    res.json(signature)
  } catch (err) {
    next(err)
  }
}

export async function deleteActeurSignature(req: Request, res: Response, next: NextFunction) {
  try {
    await signatureActeurService.deleteSignature(req.matricule ?? null, req.params.matricule)
    res.status(204).send()
  } catch (err) {
    next(err)
  }
}
