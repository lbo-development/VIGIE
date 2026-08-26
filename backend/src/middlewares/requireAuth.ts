import type { NextFunction, Request, Response } from 'express'
import { supabase } from '../config/supabaseClient.js'
import * as authRepository from '../repositories/auth.repository.js'
import { AppError } from './errorHandler.js'

/**
 * Vérifie le JWT Supabase (header Authorization: Bearer <token>) et résout le
 * matricule ACTEUR lié au compte (voir ForClaude/SECURITY.md §2.1). Rejette en
 * 401 si le token est absent/invalide, en 403 si le compte n'est pas encore
 * rattaché à un ACTEUR (matricule null — état durable, pas transitoire).
 * Renseigne req.matricule (voir types/express.d.ts) pour les handlers en aval.
 */
export async function requireAuth(req: Request, _res: Response, next: NextFunction) {
  try {
    const authHeader = req.headers.authorization
    const token = authHeader?.startsWith('Bearer ') ? authHeader.slice('Bearer '.length) : null
    if (!token) throw new AppError('Authentification requise', 401)

    const { data, error } = await supabase.auth.getUser(token)
    if (error || !data.user) throw new AppError('Session invalide ou expirée', 401)

    const matricule = await authRepository.findMatriculeByUserId(data.user.id)
    if (!matricule) throw new AppError('Compte non rattaché à un acteur', 403)

    req.matricule = matricule
    next()
  } catch (err) {
    next(err)
  }
}
