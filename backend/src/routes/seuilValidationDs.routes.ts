import { Router } from 'express'
import { requireAuth } from '../middlewares/requireAuth.js'
import { getSeuils, putSeuil } from '../controllers/seuilValidationDs.controller.js'

const router = Router()

router.use(requireAuth)
router.get('/', getSeuils)
// Droits (ADMIN_APP ou ADMIN_SERVICE scopé au service visé) vérifiés dans
// seuilValidationDs.service.ts via assertManagesService — pas de requireRole
// ici, même pattern que site.routes.ts / secteur.routes.ts.
router.put('/:idService', putSeuil)

export default router
