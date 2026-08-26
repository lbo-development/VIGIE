import { Router } from 'express'
import { requireAuth } from '../middlewares/requireAuth.js'
import { requireRole } from '../middlewares/requireRole.js'
import { getCellules, postCellule, putCellule } from '../controllers/organisation.controller.js'

const router = Router()

router.use(requireAuth)
router.get('/', getCellules)
router.post('/', requireRole('ADMIN_APP'), postCellule)
router.put('/:idCellule', requireRole('ADMIN_APP'), putCellule)

export default router
