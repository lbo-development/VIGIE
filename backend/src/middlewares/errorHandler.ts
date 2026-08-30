import type { NextFunction, Request, Response } from 'express'

export class AppError extends Error {
  status: number

  constructor(message: string, status = 500) {
    super(message)
    this.name = 'AppError'
    this.status = status
  }
}

/**
 * Middleware d'erreur global, monté en dernier dans app.ts.
 * Les controllers doivent passer leurs erreurs via next(err) plutôt que
 * de répondre eux-mêmes en cas d'échec.
 */
// eslint-disable-next-line @typescript-eslint/no-unused-vars
export function errorHandler(err: unknown, _req: Request, res: Response, _next: NextFunction) {
  const status = err instanceof AppError ? err.status : 500
  // SECURITY.md §8 : ne jamais renvoyer au client le message brut d'une erreur
  // technique (Postgres/Supabase, TypeError, etc.) — seules les AppError sont
  // des erreurs métier délibérées, avec un message déjà contrôlé pour être
  // montré tel quel. Toute autre erreur reçoit un message générique ; le
  // détail réel reste dans le log serveur ci-dessous.
  const message = err instanceof AppError ? err.message : 'Erreur interne du serveur'

  if (status >= 500) {
    console.error('[error]', err)
  }

  res.status(status).json({ message })
}
