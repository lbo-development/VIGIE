import type { NextFunction, Request, Response } from 'express'
import * as marchePieceService from '../services/marchePiece.service.js'
import { AppError } from '../middlewares/errorHandler.js'
import type { ListPiecesQuery } from '../services/marchePiece.service.js'

function parseListQuery(req: Request): ListPiecesQuery {
  const typeMarche = req.query.typeMarche
  if (typeMarche !== 'SERVICE' && typeMarche !== 'TIERS') {
    throw new AppError('typeMarche doit valoir SERVICE ou TIERS.', 400)
  }
  const nummarche = typeof req.query.nummarche === 'string' ? req.query.nummarche : undefined
  const rawIdMarcheTiers = req.query.idMarcheTiers
  const idMarcheTiers = typeof rawIdMarcheTiers === 'string' && rawIdMarcheTiers.trim() !== '' ? Number(rawIdMarcheTiers) : undefined
  return { typeMarche, nummarche, idMarcheTiers }
}

export async function getPieces(req: Request, res: Response, next: NextFunction) {
  try {
    const pieces = await marchePieceService.listPieces(req.matricule ?? null, parseListQuery(req))
    res.json(pieces)
  } catch (err) {
    next(err)
  }
}

export async function postPiece(req: Request, res: Response, next: NextFunction) {
  try {
    const file = req.file ? { buffer: req.file.buffer, size: req.file.size, originalname: req.file.originalname } : undefined
    const piece = await marchePieceService.uploadPiece(req.matricule ?? null, req.body, file)
    res.status(201).json(piece)
  } catch (err) {
    next(err)
  }
}

export async function putPieceMetadata(req: Request, res: Response, next: NextFunction) {
  try {
    const piece = await marchePieceService.updatePieceMetadata(req.matricule ?? null, Number(req.params.id), req.body)
    res.json(piece)
  } catch (err) {
    next(err)
  }
}

export async function getPieceDownload(req: Request, res: Response, next: NextFunction) {
  try {
    const { buffer, nomFichier } = await marchePieceService.downloadPiece(req.matricule ?? null, Number(req.params.id))
    res.setHeader('Content-Type', 'application/pdf')
    res.setHeader('Content-Disposition', `attachment; filename="${encodeURIComponent(nomFichier)}"`)
    res.send(buffer)
  } catch (err) {
    next(err)
  }
}

export async function deletePieceHandler(req: Request, res: Response, next: NextFunction) {
  try {
    await marchePieceService.deletePiece(req.matricule ?? null, Number(req.params.id))
    res.status(204).end()
  } catch (err) {
    next(err)
  }
}
