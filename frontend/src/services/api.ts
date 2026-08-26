/**
 * Client HTTP minimal pour appeler l'API backend.
 * Centralise l'URL de base et la gestion des erreurs afin que les hooks
 * et les pages n'aient jamais besoin d'appeler fetch() directement.
 */

import { supabase } from '../lib/supabaseClient'

const API_URL = import.meta.env.VITE_API_URL ?? 'http://localhost:3001/api'

export class ApiError extends Error {
  status: number

  constructor(message: string, status: number) {
    super(message)
    this.name = 'ApiError'
    this.status = status
  }
}

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  // Le token est relu à chaque appel (plutôt que mis en cache) : supabase-js
  // le rafraîchit automatiquement en arrière-plan, getSession() renvoie
  // toujours la valeur courante sans requête réseau superflue.
  const {
    data: { session },
  } = await supabase.auth.getSession()

  const res = await fetch(`${API_URL}${path}`, {
    headers: {
      'Content-Type': 'application/json',
      ...(session ? { Authorization: `Bearer ${session.access_token}` } : {}),
      ...options.headers,
    },
    ...options,
  })

  if (!res.ok) {
    const body = await res.json().catch(() => ({}))
    throw new ApiError(body.message ?? `Erreur API (${res.status})`, res.status)
  }

  return res.json() as Promise<T>
}

export const api = {
  get: <T>(path: string) => request<T>(path, { method: 'GET' }),
  post: <T>(path: string, data: unknown) =>
    request<T>(path, { method: 'POST', body: JSON.stringify(data) }),
  put: <T>(path: string, data: unknown) =>
    request<T>(path, { method: 'PUT', body: JSON.stringify(data) }),
  delete: <T>(path: string) => request<T>(path, { method: 'DELETE' }),
}
