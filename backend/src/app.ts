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

app.use(helmet())
app.use(cors({ origin: env.corsOrigins }))
app.use(express.json({ limit: '100kb' }))
app.use(apiLimiter)

app.get('/', (_req, res) => {
  res.json({ message: 'VIGIE API' })
})

app.use('/', routes)

app.use(notFound)
app.use(errorHandler)
