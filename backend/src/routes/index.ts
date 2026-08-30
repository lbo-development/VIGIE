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
import seuilValidationDsRoutes from './seuilValidationDs.routes.js'
import fournisseursRoutes from './fournisseur.routes.js'
import cugRoutes from './cug.routes.js'

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
router.use('/seuils-validation-ds', seuilValidationDsRoutes)
router.use('/fournisseurs', fournisseursRoutes)
router.use('/cug', cugRoutes)

export default router
