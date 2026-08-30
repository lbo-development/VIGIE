import { describe, it, expect } from 'vitest'
import request from 'supertest'
import { app } from '../app.js'
import routes from '../routes/index.js'

describe('trust proxy', () => {
  it("est réglé sur 1 saut (nécessaire derrière le reverse-proxy Railway pour un req.ip correct)", () => {
    expect(app.get('trust proxy')).toBe(1)
  })

  it('req.ip reflète le premier hop de X-Forwarded-For plutôt que le socket brut', async () => {
    // Ajoutée sur le routeur /api (monté avant le fallback SPA catch-all
    // dans app.ts) plutôt que sur `app` directement : en présence d'un build
    // frontend (frontend/dist), le catch-all `app.get('*', ...)` intercepterait
    // toute route ajoutée après coup directement sur `app`.
    routes.get('/__test-ip', (req, res) => res.json({ ip: req.ip }))

    const res = await request(app).get('/api/__test-ip').set('X-Forwarded-For', '203.0.113.42')

    expect(res.body.ip).toBe('203.0.113.42')
  })
})
