import type { NextFunction, Request, Response } from 'express'
import * as investissementPieceService from '../services/investissementPiece.service.js'
import { AppError } from '../middlewares/errorHandler.js'

export async function getPieces(req: Request, res: Response, next: NextFunction) {
  try {
    const numeroOperation = typeof req.query.numeroOperation === 'string' ? req.query.numeroOperation : undefined
    if (!numeroOperation) throw new AppError("Le numéro d'opération est obligatoire.", 400)
    const pieces = await investissementPieceService.listPieces(req.matricule ?? null, numeroOperation)
    res.json(pieces)
  } catch (err) {
    next(err)
  }
}

export async function postPiece(req: Request, res: Response, next: NextFunction) {
  try {
    const file = req.file ? { buffer: req.file.buffer, size: req.file.size, originalname: req.file.originalname } : undefined
    const piece = await investissementPieceService.uploadPiece(req.matricule ?? null, req.body, file)
    res.status(201).json(piece)
  } catch (err) {
    next(err)
  }
}

export async function putPieceMetadata(req: Request, res: Response, next: NextFunction) {
  try {
    const piece = await investissementPieceService.updatePieceMetadata(req.matricule ?? null, Number(req.params.id), req.body)
    res.json(piece)
  } catch (err) {
    next(err)
  }
}

export async function getPieceDownload(req: Request, res: Response, next: NextFunction) {
  try {
    const { buffer, nomFichier } = await investissementPieceService.downloadPiece(req.matricule ?? null, Number(req.params.id))
    res.setHeader('Content-Type', 'application/pdf')
    res.setHeader('Content-Disposition', `attachment; filename="${encodeURIComponent(nomFichier)}"`)
    res.send(buffer)
  } catch (err) {
    next(err)
  }
}

export async function deletePieceHandler(req: Request, res: Response, next: NextFunction) {
  try {
    await investissementPieceService.deletePiece(req.matricule ?? null, Number(req.params.id))
    res.status(204).end()
  } catch (err) {
    next(err)
  }
}
