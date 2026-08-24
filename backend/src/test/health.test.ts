import { describe, it, expect } from 'vitest'
import request from 'supertest'
import { app } from '../app.js'

describe('GET /api/health', () => {
  it('répond 200 avec un statut ok', async () => {
    const res = await request(app).get('/api/health')
    expect(res.status).toBe(200)
    expect(res.body.status).toBe('ok')
    expect(res.body.timestamp).toBeDefined()
  })
})

describe('GET /api/unknown-route', () => {
  it('répond 404 sur une route API inconnue', async () => {
    // Testé sous /api plutôt qu'à la racine : une route non-API inconnue peut
    // légitimement renvoyer 200 (index.html, fallback SPA) quand le build du
    // frontend est présent — voir app.ts. Le 404 ne s'applique qu'à l'API.
    const res = await request(app).get('/api/unknown-route')
    expect(res.status).toBe(404)
  })
})
