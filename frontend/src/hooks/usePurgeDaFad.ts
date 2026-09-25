import { api } from '../services/api'

/**
 * Suppression en masse des DA/FAD d'un service (Paramètres, ADMIN_APP
 * uniquement, décision du 25/09/2026) — voir
 * backend/src/services/purgeDaFad.service.ts. Irréversible, aucune
 * exception de statut, aucune trace conservée après coup.
 */

export async function getCountDaFadService(idService: number): Promise<number> {
  const result = await api.get<{ nombre: number }>(`/purge-da-fad-service/compte?idService=${idService}`)
  return result.nombre
}

/** N'appeler qu'après la double confirmation (question + ré-authentification par mot de passe, voir pages/PurgeDaFad.tsx). */
export async function purgerDaFadService(idService: number): Promise<number> {
  const result = await api.post<{ nombre: number }>('/purge-da-fad-service', { idService })
  return result.nombre
}
