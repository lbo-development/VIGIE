export {}

declare global {
  namespace Express {
    interface Request {
      /** Renseigné par requireAuth (backend/src/middlewares/requireAuth.ts). */
      matricule?: string
    }
  }
}
