import { Router } from 'express'
import { requireAuth } from '../middlewares/requireAuth.js'
import { getRoleAttributions, postRoleAttribution, putDesactiverRoleAttribution } from '../controllers/roleAttribution.controller.js'

const router = Router()

router.use(requireAuth)

// Permission vérifiée dans le service (variable selon TYPE_ROLE — ADMIN_SERVICE
// scopé à son service pour RC/CDS/CB/ADMIN_SERVICE, ADMIN_APP seul pour
// DS/ADMIN_APP), pas requireRole ici — même principe que cug.routes.ts.
router.get('/', getRoleAttributions)
router.post('/', postRoleAttribution)
router.put('/:idRole/desactiver', putDesactiverRoleAttribution)

export default router
