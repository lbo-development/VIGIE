import { Router } from 'express'
import { requireAuth } from '../middlewares/requireAuth.js'
import { getCug, postCug, putCug } from '../controllers/cug.controller.js'

const router = Router()

router.use(requireAuth)

router.get('/', getCug)
router.post('/', postCug)
router.put('/:codeCug', putCug)

export default router
