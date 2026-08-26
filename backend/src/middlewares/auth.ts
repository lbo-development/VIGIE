import type { NextFunction, Request, Response } from 'express'
import { supabase } from '../config/supabaseClient.js'
import { AppError } from './errorHandler.js'

export interface AuthenticatedUser {
  id: string
  email: string | undefined
}

export interface AuthenticatedRequest extends Request {
  user?: AuthenticatedUser
}

/**
 * Vérifie le JWT Supabase (header Authorization: Bearer <token>) auprès du
 * serveur Auth — jamais de décodage local sans vérification de signature
 * (voir ForClaude/SECURITY.md §1). Pose req.user si valide, sinon 401.
 */
export async function requireAuth(req: AuthenticatedRequest, _res: Response, next: NextFunction) {
  const header = req.headers.authorization
  const token = header?.startsWith('Bearer ') ? header.slice('Bearer '.length) : null

  if (!token) {
    next(new AppError('Authentification requise', 401))
    return
  }

  const { data, error } = await supabase.auth.getUser(token)
  if (error || !data.user) {
    next(new AppError('Authentification requise', 401))
    return
  }

  req.user = { id: data.user.id, email: data.user.email }
  next()
}
