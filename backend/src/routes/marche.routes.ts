import { Router } from 'express'
import { requireAuth } from '../middlewares/requireAuth.js'
import { getMarches } from '../controllers/marche.controller.js'

const router = Router()

router.use(requireAuth)

router.get('/', getMarches)

export default router
