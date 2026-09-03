import { Router } from 'express'
import { requireAuth } from '../middlewares/requireAuth.js'
import { getMarcheTiers, postMarcheTiers, putMarcheTiers, deleteMarcheTiers } from '../controllers/marcheTiers.controller.js'

const router = Router()

router.use(requireAuth)

router.get('/', getMarcheTiers)
router.post('/', postMarcheTiers)
router.put('/:id', putMarcheTiers)
router.delete('/:id', deleteMarcheTiers)

export default router
