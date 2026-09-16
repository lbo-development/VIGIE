import { Router } from 'express'
import { requireAuth } from '../middlewares/requireAuth.js'
import { getSuppleances, postSuppleance } from '../controllers/suppleance.controller.js'

const router = Router()

router.use(requireAuth)

// Permission vérifiée dans le service (titulaire du rôle uniquement — dispositif
// "auto-déclaré", pas d'accès ADMIN_SERVICE/ADMIN_APP), pas requireRole ici —
// même principe que cug.routes.ts / roleAttribution.routes.ts.
router.get('/', getSuppleances)
router.post('/', postSuppleance)

export default router
