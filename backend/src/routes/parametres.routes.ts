import { Router } from 'express'
import { requireAuth } from '../middlewares/requireAuth.js'
import { requireRole } from '../middlewares/requireRole.js'
import { getParametre, putParametre, getParametreKeys, getParametreRows } from '../controllers/parametres.controller.js'

const router = Router()

router.use(requireAuth)

router.get('/', getParametreKeys)
router.get('/:cle/rows', requireRole('ADMIN_APP'), getParametreRows)
router.get('/:cle', getParametre)
router.put('/:cle', requireRole('ADMIN_APP'), putParametre)

export default router
