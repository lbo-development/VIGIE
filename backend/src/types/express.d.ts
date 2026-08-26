export {}

declare global {
  namespace Express {
    interface Request {
      /** Renseigné par requireAuth (backend/src/middlewares/requireAuth.ts). */
      matricule?: string | null
      /** Identité Supabase Auth brute (id, email), renseignée par requireAuth. */
      user?: { id: string; email?: string }
    }
  }
}
