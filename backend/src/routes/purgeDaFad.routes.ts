import { Router } from 'express'
import { requireAuth } from '../middlewares/requireAuth.js'
import { getCountDaFadService, postPurgeDaFadService } from '../controllers/purgeDaFad.controller.js'

const router = Router()

router.use(requireAuth)

router.get('/compte', getCountDaFadService)
router.post('/', postPurgeDaFadService)

export default router
