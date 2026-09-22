import { Router } from 'express'
import { requireAuth } from '../middlewares/requireAuth.js'
import { getMesSuppleances, getCandidats, getSupervision, postSuppleance, postRetraitSuppleance } from '../controllers/suppleance.controller.js'

const router = Router()

router.use(requireAuth)

// Permission vérifiée dans le service (titulaire du rôle uniquement — dispositif
// "auto-déclaré", pas d'accès ADMIN_SERVICE/ADMIN_APP en écriture), pas requireRole ici —
// même principe que cug.routes.ts / roleAttribution.routes.ts. /supervision est la seule
// route de lecture ouverte aux admins (ADMIN_SERVICE son service, ADMIN_APP tout), vérifiée
// elle aussi dans le service.
router.get('/', getMesSuppleances)
router.get('/candidats', getCandidats)
router.get('/supervision', getSupervision)
router.post('/', postSuppleance)
router.post('/:idSuppleance/retrait', postRetraitSuppleance)

export default router
