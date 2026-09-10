import type { NextFunction, Request, Response } from 'express'
import * as demandeAchatService from '../services/demandeAchat.service.js'
import { AppError } from '../middlewares/errorHandler.js'

function parseId(raw: string): number {
  const id = Number(raw)
  return Number.isFinite(id) ? id : NaN
}

export async function postDemandeAchat(req: Request, res: Response, next: NextFunction) {
  try {
    const demandeAchat = await demandeAchatService.createDemandeAchat(req.matricule ?? null, req.body)
    res.status(201).json(demandeAchat)
  } catch (err) {
    next(err)
  }
}

export async function getDemandeAchat(req: Request, res: Response, next: NextFunction) {
  try {
    const idCelluleRaw = req.query.idCellule
    const idCellule = typeof idCelluleRaw === 'string' && idCelluleRaw.trim() !== '' ? Number(idCelluleRaw) : undefined

    const demandesAchat = await demandeAchatService.listDemandeAchat(req.matricule ?? null, {
      idCellule: idCellule !== undefined && Number.isFinite(idCellule) ? idCellule : undefined,
      matriculeDemandeur: typeof req.query.matriculeDemandeur === 'string' ? req.query.matriculeDemandeur : undefined,
      statut: typeof req.query.statut === 'string' ? req.query.statut : undefined,
      search: typeof req.query.search === 'string' ? req.query.search : undefined,
    })
    res.json(demandesAchat)
  } catch (err) {
    next(err)
  }
}

export async function getDemandeAchatById(req: Request, res: Response, next: NextFunction) {
  try {
    const id = parseId(req.params.id)
    const demandeAchat = await demandeAchatService.getDemandeAchat(req.matricule ?? null, id)
    res.json(demandeAchat)
  } catch (err) {
    next(err)
  }
}

export async function putDemandeAchat(req: Request, res: Response, next: NextFunction) {
  try {
    const id = parseId(req.params.id)
    const demandeAchat = await demandeAchatService.updateDemandeAchat(req.matricule ?? null, id, req.body)
    res.json(demandeAchat)
  } catch (err) {
    next(err)
  }
}

export async function putDemandeAchatMarche(req: Request, res: Response, next: NextFunction) {
  try {
    const id = parseId(req.params.id)
    const demandeAchat = await demandeAchatService.selectMarcheDemandeAchat(req.matricule ?? null, id, req.body)
    res.json(demandeAchat)
  } catch (err) {
    next(err)
  }
}

export async function getDemandeAchatConsultation(req: Request, res: Response, next: NextFunction) {
  try {
    const id = parseId(req.params.id)
    const candidats = await demandeAchatService.listConsultationDemandeAchat(req.matricule ?? null, id)
    res.json(candidats)
  } catch (err) {
    next(err)
  }
}

export async function putDemandeAchatConsultation(req: Request, res: Response, next: NextFunction) {
  try {
    const id = parseId(req.params.id)
    const demandeAchat = await demandeAchatService.saveConsultationDemandeAchat(req.matricule ?? null, id, req.body)
    res.json(demandeAchat)
  } catch (err) {
    next(err)
  }
}

export async function deleteDemandeAchat(req: Request, res: Response, next: NextFunction) {
  try {
    const id = parseId(req.params.id)
    await demandeAchatService.deleteDemandeAchat(req.matricule ?? null, id)
    res.status(204).end()
  } catch (err) {
    next(err)
  }
}

export async function postConsultationCandidat(req: Request, res: Response, next: NextFunction) {
  try {
    const id = parseId(req.params.id)
    const candidat = await demandeAchatService.addConsultationCandidat(req.matricule ?? null, id, req.body)
    res.status(201).json(candidat)
  } catch (err) {
    next(err)
  }
}

export async function deleteConsultationCandidat(req: Request, res: Response, next: NextFunction) {
  try {
    const id = parseId(req.params.id)
    const idDevis = parseId(req.params.idDevis)
    await demandeAchatService.removeConsultationCandidat(req.matricule ?? null, id, idDevis)
    res.status(204).end()
  } catch (err) {
    next(err)
  }
}

export async function postMarcheDevis(req: Request, res: Response, next: NextFunction) {
  try {
    const id = parseId(req.params.id)
    const candidat = await demandeAchatService.getOrCreateMarcheDevis(req.matricule ?? null, id)
    res.json(candidat)
  } catch (err) {
    next(err)
  }
}

export async function postDevisFichier(req: Request, res: Response, next: NextFunction) {
  try {
    const id = parseId(req.params.id)
    const idDevis = parseId(req.params.idDevis)
    if (!req.file) throw new AppError('Aucun fichier reçu.', 400)
    const file = { buffer: req.file.buffer, size: req.file.size, originalname: req.file.originalname }
    const candidat = await demandeAchatService.uploadDevisFile(req.matricule ?? null, id, idDevis, file)
    res.json(candidat)
  } catch (err) {
    next(err)
  }
}

export async function getDevisFichier(req: Request, res: Response, next: NextFunction) {
  try {
    const id = parseId(req.params.id)
    const idDevis = parseId(req.params.idDevis)
    const { buffer, nomFichier } = await demandeAchatService.downloadDevisFile(req.matricule ?? null, id, idDevis)
    res.setHeader('Content-Type', 'application/pdf')
    res.setHeader('Content-Disposition', `attachment; filename="${encodeURIComponent(nomFichier)}"`)
    res.send(buffer)
  } catch (err) {
    next(err)
  }
}

export async function deleteDevisFichier(req: Request, res: Response, next: NextFunction) {
  try {
    const id = parseId(req.params.id)
    const idDevis = parseId(req.params.idDevis)
    const candidat = await demandeAchatService.deleteDevisFile(req.matricule ?? null, id, idDevis)
    res.json(candidat)
  } catch (err) {
    next(err)
  }
}

export async function getDemandeAchatPieces(req: Request, res: Response, next: NextFunction) {
  try {
    const id = parseId(req.params.id)
    const idFournisseurRaw = req.query.idFournisseur
    const idFournisseur = typeof idFournisseurRaw === 'string' ? Number(idFournisseurRaw) : NaN
    if (!Number.isFinite(idFournisseur)) throw new AppError('idFournisseur requis.', 400)
    const pieces = await demandeAchatService.listPiecesDemandeAchat(req.matricule ?? null, id, idFournisseur)
    res.json(pieces)
  } catch (err) {
    next(err)
  }
}

export async function postDemandeAchatPiece(req: Request, res: Response, next: NextFunction) {
  try {
    const id = parseId(req.params.id)
    const file = req.file ? { buffer: req.file.buffer, size: req.file.size, originalname: req.file.originalname } : undefined
    const piece = await demandeAchatService.addPieceDemandeAchat(req.matricule ?? null, id, req.body, file)
    res.status(201).json(piece)
  } catch (err) {
    next(err)
  }
}

export async function deleteDemandeAchatPiece(req: Request, res: Response, next: NextFunction) {
  try {
    const id = parseId(req.params.id)
    const idPiece = parseId(req.params.idPiece)
    await demandeAchatService.removePieceDemandeAchat(req.matricule ?? null, id, idPiece)
    res.status(204).end()
  } catch (err) {
    next(err)
  }
}

export async function getDemandeAchatPieceFichier(req: Request, res: Response, next: NextFunction) {
  try {
    const id = parseId(req.params.id)
    const idPiece = parseId(req.params.idPiece)
    const { buffer, nomFichier } = await demandeAchatService.downloadPieceDemandeAchat(req.matricule ?? null, id, idPiece)
    res.setHeader('Content-Type', 'application/pdf')
    res.setHeader('Content-Disposition', `attachment; filename="${encodeURIComponent(nomFichier)}"`)
    res.send(buffer)
  } catch (err) {
    next(err)
  }
}
