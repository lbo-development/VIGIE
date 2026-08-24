import { Router } from 'express'
import healthRoutes from './health.routes.js'
import itemsRoutes from './items.routes.js'

/**
 * Point d'entrée unique des routes : toute nouvelle ressource se déclare ici.
 * Convention : préfixe pluriel en kebab-case (ex: /order-items).
 */
const router = Router()

router.use('/health', healthRoutes)
router.use('/items', itemsRoutes)

export default router
