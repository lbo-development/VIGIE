import { Router } from 'express'
import { requireAuth } from '../middlewares/requireAuth.js'
import { requireRole } from '../middlewares/requireRole.js'
import { getDirections, postDirection, putDirection } from '../controllers/organisation.controller.js'

const router = Router()

router.use(requireAuth)
router.get('/', getDirections)
router.post('/', requireRole('ADMIN_APP'), postDirection)
router.put('/:idDirection', requireRole('ADMIN_APP'), putDirection)

export default router
