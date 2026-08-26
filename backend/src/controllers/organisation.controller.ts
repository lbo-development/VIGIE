import type { NextFunction, Request, Response } from 'express'
import * as organisationService from '../services/organisation.service.js'

export async function getDirections(_req: Request, res: Response, next: NextFunction) {
  try {
    res.json(await organisationService.listDirections())
  } catch (err) {
    next(err)
  }
}

export async function postDirection(req: Request, res: Response, next: NextFunction) {
  try {
    res.status(201).json(await organisationService.createDirection(req.body))
  } catch (err) {
    next(err)
  }
}

export async function putDirection(req: Request, res: Response, next: NextFunction) {
  try {
    res.json(await organisationService.updateDirection(Number(req.params.idDirection), req.body))
  } catch (err) {
    next(err)
  }
}

export async function getServices(_req: Request, res: Response, next: NextFunction) {
  try {
    res.json(await organisationService.listServices())
  } catch (err) {
    next(err)
  }
}

export async function postService(req: Request, res: Response, next: NextFunction) {
  try {
    res.status(201).json(await organisationService.createService(req.body))
  } catch (err) {
    next(err)
  }
}

export async function putService(req: Request, res: Response, next: NextFunction) {
  try {
    res.json(await organisationService.updateService(Number(req.params.idService), req.body))
  } catch (err) {
    next(err)
  }
}

export async function getCellules(_req: Request, res: Response, next: NextFunction) {
  try {
    res.json(await organisationService.listCellules())
  } catch (err) {
    next(err)
  }
}

export async function postCellule(req: Request, res: Response, next: NextFunction) {
  try {
    res.status(201).json(await organisationService.createCellule(req.body))
  } catch (err) {
    next(err)
  }
}

export async function putCellule(req: Request, res: Response, next: NextFunction) {
  try {
    res.json(await organisationService.updateCellule(Number(req.params.idCellule), req.body))
  } catch (err) {
    next(err)
  }
}
