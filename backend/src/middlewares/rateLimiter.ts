import rateLimit from 'express-rate-limit'
import { env } from '../config/env.js'

/**
 * Limite générique anti-brute-force / anti-abus, appliquée à toute l'API
 * sauf /health (utilisée par les sondes de disponibilité). Ajuster les
 * seuils par route si un endpoint sensible (login, reset password...) a
 * besoin d'une limite plus stricte — voir ForClaude/SECURITY.md.
 *
 * Hors production, le seuil est relevé : la clé du limiteur est l'IP
 * (`req.ip`), donc plusieurs sessions de recette simulées depuis le même
 * poste (fichier hosts, un hostname par profil — cf. multi-session locale)
 * partagent la même IP et épuisaient les 300 req/15 min en quelques
 * rechargements (429 sur /me et /demandes-achat, 17/09/2026). Le seuil de
 * production reste strictement 300, inchangé.
 */
export const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: env.nodeEnv === 'production' ? 300 : 3000,
  standardHeaders: true,
  legacyHeaders: false,
  skip: (req) => req.path === '/health',
})
