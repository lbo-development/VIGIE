import { Router } from 'express'
import healthRoutes from './health.routes.js'
import itemsRoutes from './items.routes.js'
import meRoutes from './me.routes.js'
import parametresRoutes from './parametres.routes.js'
import siteRoutes from './site.routes.js'
import secteurRoutes from './secteur.routes.js'
import servicesRoutes from './services.routes.js'
import directionsRoutes from './directions.routes.js'
import cellulesRoutes from './cellules.routes.js'

/**
 * Point d'entrée unique des routes : toute nouvelle ressource se déclare ici.
 * Convention : préfixe pluriel en kebab-case (ex: /order-items).
 */
const router = Router()

router.use('/health', healthRoutes)
router.use('/items', itemsRoutes)
router.use('/me', meRoutes)
router.use('/parametres', parametresRoutes)
router.use('/sites', siteRoutes)
router.use('/secteurs', secteurRoutes)
router.use('/services', servicesRoutes)
router.use('/directions', directionsRoutes)
router.use('/cellules', cellulesRoutes)

export default router
