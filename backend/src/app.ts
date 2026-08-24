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

// Déploiement à service unique (Railway) : ce même processus Express sert à
// la fois l'API (sous /api) et le build statique du frontend (frontend/dist),
// d'où VITE_API_URL=/api en production. En développement, frontend/dist
// n'existe pas (le frontend tourne sur son propre serveur Vite) : ce bloc est
// alors ignoré et seule l'API répond, sur son port habituel.
const __dirname = path.dirname(fileURLToPath(import.meta.url))
const frontendDistPath = path.resolve(__dirname, '../../frontend/dist')
const frontendIndexPath = path.join(frontendDistPath, 'index.html')
const hasFrontendBuild = fs.existsSync(frontendIndexPath)

app.use(helmet())
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
