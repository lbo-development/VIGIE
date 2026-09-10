import type { NextFunction, Request, Response } from 'express'
import { supabase } from '../config/supabaseClient.js'
import * as authRepository from '../repositories/auth.repository.js'
import * as acteurRepository from '../repositories/acteur.repository.js'
import { AppError } from './errorHandler.js'

/**
 * Vérifie le JWT Supabase (header Authorization: Bearer <token>) et résout le
 * matricule ACTEUR lié au compte, si déjà rattaché (voir
 * ForClaude/SECURITY.md §2.1). Rejette en 401 si le token est absent/invalide.
 *
 * Ne rejette PAS si matricule est null : un compte authentifié mais pas
 * encore rattaché à un ACTEUR doit pouvoir atteindre les routes qui exposent
 * cet état (ex. GET /me, pour afficher "en attente de rattachement"). Les
 * routes qui exigent un rattachement vérifient req.matricule elles-mêmes
 * (ex. parametres.controller.ts), ou passent par requireRole — qui rejette
 * de toute façon naturellement : aucun rôle actif n'est possible sans
 * matricule.
 *
 * Renseigne req.matricule et req.user (voir types/express.d.ts) pour les
 * handlers en aval.
 *
 * ACTEUR.ACTIF (ajouté le 10/09/2026) est vérifié ici : un acteur désactivé
 * par ADMIN_APP (acteur.service.ts#updateActeur) retombe à matricule=null au
 * prochain appel, exactement comme un compte jamais rattaché — effet
 * immédiat sur une session déjà active, sans attendre l'expiration du JWT.
 * Complète, sans remplacer, le bannissement du compte Auth (bloque une
 * NOUVELLE connexion) — défense en profondeur, ForClaude/SECURITY.md.
 */
export async function requireAuth(req: Request, _res: Response, next: NextFunction) {
  try {
    const authHeader = req.headers.authorization
    const token = authHeader?.startsWith('Bearer ') ? authHeader.slice('Bearer '.length) : null
    if (!token) throw new AppError('Authentification requise', 401)

    const { data, error } = await supabase.auth.getUser(token)
    if (error || !data.user) throw new AppError('Session invalide ou expirée', 401)

    req.user = { id: data.user.id, email: data.user.email }
    const matricule = await authRepository.findMatriculeByUserId(data.user.id)

    if (matricule) {
      const acteur = await acteurRepository.findByMatricule(matricule)
      req.matricule = acteur?.actif ? matricule : null
    } else {
      req.matricule = null
    }

    next()
  } catch (err) {
    next(err)
  }
}
