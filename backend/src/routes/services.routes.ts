import { Router } from 'express'
import { requireAuth } from '../middlewares/requireAuth.js'
import { requireRole } from '../middlewares/requireRole.js'
import { getServices, postService, putService } from '../controllers/organisation.controller.js'

const router = Router()

router.use(requireAuth)
router.get('/', getServices)
router.post('/', requireRole('ADMIN_APP'), postService)
router.put('/:idService', requireRole('ADMIN_APP'), putService)

export default router
