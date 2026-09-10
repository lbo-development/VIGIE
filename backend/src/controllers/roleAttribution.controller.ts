import type { NextFunction, Request, Response } from 'express'
import * as roleAttributionService from '../services/roleAttribution.service.js'

export async function getRoleAttributions(req: Request, res: Response, next: NextFunction) {
  try {
    const rows = await roleAttributionService.listAttributions(req.matricule ?? null)
    res.json(rows)
  } catch (err) {
    next(err)
  }
}

export async function postRoleAttribution(req: Request, res: Response, next: NextFunction) {
  try {
    const created = await roleAttributionService.createAttribution(req.matricule ?? null, req.body)
    res.status(201).json(created)
  } catch (err) {
    next(err)
  }
}

export async function putDesactiverRoleAttribution(req: Request, res: Response, next: NextFunction) {
  try {
    const idRole = Number(req.params.idRole)
    const updated = await roleAttributionService.deactivateAttribution(req.matricule ?? null, idRole)
    res.json(updated)
  } catch (err) {
    next(err)
  }
}
