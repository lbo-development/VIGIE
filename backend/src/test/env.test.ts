import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'

const ORIGINAL_ENV = { ...process.env }

/**
 * Vérifie le comportement "fail fast en production" ajouté le 30/08/2026
 * (audit de sécurité) : une clé Supabase manquante ne doit plus dégénérer en
 * repli silencieux une fois en production. `env.ts` exécute sa validation au
 * chargement du module (code de haut niveau) — chaque cas doit donc réinitialiser
 * le registre de modules et réimporter dynamiquement pour ré-exécuter cette
 * validation avec un `process.env` différent.
 *
 * Valeurs vides (`''`) plutôt que `delete` : `env.ts` importe `dotenv/config`,
 * qui ne réécrit jamais une clé déjà présente dans `process.env` (même vide) —
 * `delete` la laisserait absente, et un `backend/.env` réel présent en local
 * la re-remplirait, invalidant le scénario "clé manquante" du test.
 */
describe('config/env', () => {
  beforeEach(() => {
    vi.resetModules()
    process.env = { ...ORIGINAL_ENV }
  })

  afterEach(() => {
    process.env = { ...ORIGINAL_ENV }
  })

  it('lève une exception au chargement si des clés Supabase manquent en production', async () => {
    process.env.NODE_ENV = 'production'
    process.env.SUPABASE_URL = ''
    process.env.SUPABASE_SERVICE_ROLE_KEY = ''

    await expect(import('../config/env.js')).rejects.toThrow(/SUPABASE_URL/)
  })

  it("ne lève rien hors production (avertit seulement) même si des clés manquent", async () => {
    process.env.NODE_ENV = 'development'
    process.env.SUPABASE_URL = ''
    process.env.SUPABASE_SERVICE_ROLE_KEY = ''
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})

    await expect(import('../config/env.js')).resolves.toBeDefined()
    expect(warnSpy).toHaveBeenCalled()
  })

  it('ne lève rien en production quand les clés sont renseignées', async () => {
    process.env.NODE_ENV = 'production'
    process.env.SUPABASE_URL = 'https://example.supabase.co'
    process.env.SUPABASE_SERVICE_ROLE_KEY = 'test-service-role-key'

    await expect(import('../config/env.js')).resolves.toBeDefined()
  })
})
