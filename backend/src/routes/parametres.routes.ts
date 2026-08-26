import { Router } from 'express'
import { requireAuth } from '../middlewares/requireAuth.js'
import { requireRole } from '../middlewares/requireRole.js'
import { getParametre, putParametre } from '../controllers/parametres.controller.js'

const router = Router()

router.use(requireAuth)

router.get('/:cle', getParametre)
router.put('/:cle', requireRole('ADMIN_APP'), putParametre)

export default router
