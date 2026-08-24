import rateLimit from 'express-rate-limit'

/**
 * Limite générique anti-brute-force / anti-abus, appliquée à toute l'API
 * sauf /health (utilisée par les sondes de disponibilité). Ajuster les
 * seuils par route si un endpoint sensible (login, reset password...) a
 * besoin d'une limite plus stricte — voir ForClaude/SECURITY.md.
 */
export const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 300,
  standardHeaders: true,
  legacyHeaders: false,
  skip: (req) => req.path === '/health',
})
