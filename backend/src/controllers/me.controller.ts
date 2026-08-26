import type { NextFunction, Request, Response } from 'express'
import * as meService from '../services/me.service.js'

export async function getMe(req: Request, res: Response, next: NextFunction) {
  try {
    // req.matricule est renseigné par requireAuth (peut être null — voir me.service.ts).
    const me = await meService.getCurrentUser(req.matricule ?? null)
    res.json(me)
  } catch (err) {
    next(err)
  }
}
