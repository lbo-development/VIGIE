import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

vi.mock('../lib/supabaseClient', () => ({
  supabase: { auth: { getSession: () => Promise.resolve({ data: { session: null } }) } },
}))

const { api, ApiError } = await import('./api')

describe('services/api', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn())
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('renvoie le JSON tel quel sur une réponse 2xx', async () => {
    vi.mocked(fetch).mockResolvedValue(new Response(JSON.stringify({ ok: true }), { status: 200 }))

    await expect(api.get('/test')).resolves.toEqual({ ok: true })
  })

  it("lève une ApiError avec le message du backend sur une réponse d'erreur HTTP", async () => {
    vi.mocked(fetch).mockResolvedValue(new Response(JSON.stringify({ message: 'Droits insuffisants' }), { status: 403 }))

    await expect(api.get('/test')).rejects.toMatchObject({ message: 'Droits insuffisants', status: 403 })
  })

  it("lève une ApiError distincte, statut 0, quand fetch() échoue (coupure réseau) — pas le message générique d'une erreur métier", async () => {
    vi.mocked(fetch).mockRejectedValue(new TypeError('Failed to fetch'))

    const error = await api.get('/test').catch((e: unknown) => e)
    expect(error).toBeInstanceOf(ApiError)
    expect((error as InstanceType<typeof ApiError>).status).toBe(0)
    expect((error as InstanceType<typeof ApiError>).message).toBe('Impossible de contacter le serveur — vérifiez votre connexion.')
  })
})
