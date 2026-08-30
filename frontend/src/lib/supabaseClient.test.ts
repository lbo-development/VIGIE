import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'

/**
 * Vérifie le comportement "fail fast en production" ajouté le 30/08/2026
 * (audit de sécurité) : une clé Supabase manquante ne doit plus dégénérer en
 * repli silencieux une fois en production. Le module exécute sa validation au
 * chargement (code de haut niveau) — chaque cas réinitialise le registre de
 * modules et réimporte dynamiquement avec des variables stubées.
 *
 * `.env.local` n'interfère pas ici : Vite ignore délibérément ce fichier en
 * mode test (comportement documenté), contrairement au `dotenv/config` du
 * backend — voir `backend/src/test/env.test.ts` pour l'équivalent serveur.
 */
describe('lib/supabaseClient', () => {
  beforeEach(() => {
    vi.resetModules()
  })

  afterEach(() => {
    vi.unstubAllEnvs()
  })

  it('lève une exception au chargement en production si des clés manquent', async () => {
    vi.stubEnv('VITE_SUPABASE_URL', '')
    vi.stubEnv('VITE_SUPABASE_ANON_KEY', '')
    vi.stubEnv('PROD', true)

    await expect(import('./supabaseClient')).rejects.toThrow(/VITE_SUPABASE_URL/)
  })

  it("ne lève rien hors production (avertit seulement) même si des clés manquent", async () => {
    vi.stubEnv('VITE_SUPABASE_URL', '')
    vi.stubEnv('VITE_SUPABASE_ANON_KEY', '')
    vi.stubEnv('PROD', false)
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})

    await expect(import('./supabaseClient')).resolves.toBeDefined()
    expect(warnSpy).toHaveBeenCalled()
  })

  it('ne lève rien en production quand les clés sont renseignées', async () => {
    vi.stubEnv('VITE_SUPABASE_URL', 'https://example.supabase.co')
    vi.stubEnv('VITE_SUPABASE_ANON_KEY', 'test-anon-key')
    vi.stubEnv('PROD', true)

    await expect(import('./supabaseClient')).resolves.toBeDefined()
  })
})
