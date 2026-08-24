import type { NextFunction, Request, Response } from 'express'
import * as itemsService from '../services/items.service.js'

/**
 * Couche HTTP : traduit requête <-> réponse. Aucune logique métier ici,
 * uniquement de l'orchestration et la gestion des erreurs via next(err).
 */

export async function getItems(_req: Request, res: Response, next: NextFunction) {
  try {
    const items = await itemsService.listItems()
    res.json(items)
  } catch (err) {
    next(err)
  }
}

export async function postItem(req: Request, res: Response, next: NextFunction) {
  try {
    const item = await itemsService.createItem(req.body)
    res.status(201).json(item)
  } catch (err) {
    next(err)
  }
}
