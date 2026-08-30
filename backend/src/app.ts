import path from 'node:path'
import fs from 'node:fs'
import { fileURLToPath } from 'node:url'
import express from 'express'
import cors from 'cors'
import helmet from 'helmet'
import { env } from './config/env.js'
import routes from './routes/index.js'
import { apiLimiter } from './middlewares/rateLimiter.js'
import { notFound } from './middlewares/notFound.js'
import { errorHandler } from './middlewares/errorHandler.js'

/**
 * Assemble l'application Express sans démarrer de serveur HTTP.
 * Séparé de server.ts pour pouvoir importer `app` dans les tests
 * (Supertest) sans ouvrir de port réseau.
 */
export const app = express()

// Railway place un reverse-proxy devant l'application : sans ce réglage,
// req.ip vaut l'adresse du proxy (identique pour tout le monde), pas celle
// du visiteur réel — casse le rate limiting par IP (apiLimiter ci-dessous)
// en le faisant retomber sur un seul bucket partagé par toute l'application
// (30/08/2026, audit de sécurité). "1" = un seul saut de proxy fait
// confiance (l'edge Railway), pas "true" : évite qu'un client falsifie
// X-Forwarded-For pour usurper une autre IP au-delà de ce premier saut.
// Sans effet en local/tests (Supertest appelle l'app directement, en
// process, sans en-tête X-Forwarded-For).
app.set('trust proxy', 1)

// Déploiement à service unique (Railway) : ce même processus Express sert à
// la fois l'API (sous /api) et le build statique du frontend (frontend/dist),
// d'où VITE_API_URL=/api en production. En développement, frontend/dist
// n'existe pas (le frontend tourne sur son propre serveur Vite) : ce bloc est
// alors ignoré et seule l'API répond, sur son port habituel.
const __dirname = path.dirname(fileURLToPath(import.meta.url))
const frontendDistPath = path.resolve(__dirname, '../../frontend/dist')
const frontendIndexPath = path.join(frontendDistPath, 'index.html')
const hasFrontendBuild = fs.existsSync(frontendIndexPath)

app.use(
  helmet({
    contentSecurityPolicy: {
      directives: {
        ...helmet.contentSecurityPolicy.getDefaultDirectives(),
        // Le frontend appelle Supabase Auth/REST directement depuis le
        // navigateur : sans ça, connect-src retombe sur 'self' et le
        // navigateur bloque silencieusement ces requêtes (ex: le login
        // échoue avec une erreur réseau générique, jamais envoyée).
        connectSrc: ["'self'", env.supabaseUrl],
      },
    },
  }),
)
app.use(cors({ origin: env.corsOrigins }))
app.use(express.json({ limit: '100kb' }))
app.use(apiLimiter)

app.use('/api', routes)
// Route /api inconnue : 404 JSON explicite, avant que le fallback SPA
// ci-dessous n'ait la chance de répondre avec index.html à sa place.
app.use('/api', notFound)

if (hasFrontendBuild) {
  app.use(express.static(frontendDistPath))
  // Routage côté client (React Router) : toute route non-API renvoie
  // index.html, qui décide lui-même de l'écran à afficher.
  app.get('*', (_req, res) => {
    res.sendFile(frontendIndexPath)
  })
} else {
  app.get('/', (_req, res) => {
    res.json({ message: 'VIGIE API' })
  })
}

app.use(notFound)
app.use(errorHandler)
