import type { NextFunction, Request, Response } from 'express'
import * as authRepository from '../repositories/auth.repository.js'
import { AppError } from './errorHandler.js'

/**
 * À monter après requireAuth. Vérifie que l'acteur courant détient un rôle
 * TYPE_ROLE actif (RC | CDS | DS | CB | ADMIN_SERVICE | ADMIN_APP) — voir
 * ForClaude/SECURITY.md §2.1.
 */
export function requireRole(typeRole: string) {
  return async (req: Request, _res: Response, next: NextFunction) => {
    try {
      if (!req.matricule) throw new AppError('Authentification requise', 401)
      const authorized = await authRepository.hasActiveRole(req.matricule, typeRole)
      if (!authorized) throw new AppError('Droits insuffisants', 403)
      next()
    } catch (err) {
      next(err)
    }
  }
}
