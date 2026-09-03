import { Router } from 'express'
import { requireAuth } from '../middlewares/requireAuth.js'
import { getMarches, getMarcheOptions, getMarcheLastImport, putMarche } from '../controllers/marche.controller.js'

const router = Router()

router.use(requireAuth)

router.get('/options', getMarcheOptions)
router.get('/last-import', getMarcheLastImport)
router.get('/', getMarches)
router.put('/:nummarche', putMarche)

export default router
