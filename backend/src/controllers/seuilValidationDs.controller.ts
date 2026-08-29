import type { NextFunction, Request, Response } from 'express'
import * as seuilService from '../services/seuilValidationDs.service.js'

export async function getSeuils(_req: Request, res: Response, next: NextFunction) {
  try {
    res.json(await seuilService.listSeuils())
  } catch (err) {
    next(err)
  }
}

export async function putSeuil(req: Request, res: Response, next: NextFunction) {
  try {
    res.json(await seuilService.upsertSeuil(req.matricule ?? null, Number(req.params.idService), req.body))
  } catch (err) {
    next(err)
  }
}
