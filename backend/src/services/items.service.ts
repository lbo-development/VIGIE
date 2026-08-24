import { z } from 'zod'
import * as itemsRepository from '../repositories/items.repository.js'
import { AppError } from '../middlewares/errorHandler.js'

/**
 * Couche métier : validation, règles de gestion, orchestration.
 * Ne contient aucun appel direct à Supabase — délègue toujours au repository.
 *
 * Toute donnée entrante est validée par un schéma explicite avant traitement
 * (fail closed : rejet en 400 plutôt que de "corriger" silencieusement
 * l'entrée) — voir ForClaude/SECURITY.md. Ce fichier sert de modèle pour les
 * futures ressources : un schéma zod par opération d'écriture, appelé en
 * tout début de fonction de service.
 */

const createItemSchema = z.object({
  name: z
    .string({ required_error: 'Le champ "name" est requis' })
    .trim()
    .min(1, 'Le champ "name" est requis')
    .max(200),
})

export function listItems() {
  return itemsRepository.findAll()
}

export function createItem(input: unknown) {
  const result = createItemSchema.safeParse(input)
  if (!result.success) {
    throw new AppError(result.error.issues[0]?.message ?? 'Requête invalide', 400)
  }
  return itemsRepository.create(result.data.name)
}
