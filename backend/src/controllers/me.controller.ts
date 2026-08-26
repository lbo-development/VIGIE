import type { NextFunction, Response } from 'express'
import type { AuthenticatedRequest } from '../middlewares/auth.js'
import * as meService from '../services/me.service.js'

export async function getMe(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  try {
    // req.user est garanti par le middleware requireAuth monté sur cette route.
    const me = await meService.getCurrentUser(req.user!.id)
    res.json(me)
  } catch (err) {
    next(err)
  }
}
