import { Router } from 'express'
import { requireAuth } from '../middlewares/requireAuth.js'
import { getMe } from '../controllers/me.controller.js'

const router = Router()

router.get('/', requireAuth, getMe)

export default router
