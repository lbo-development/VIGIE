import { Router } from 'express'
import { requireAuth } from '../middlewares/requireAuth.js'
import { getCommandesPgi, getCommandeLastImport } from '../controllers/commandePgi.controller.js'

const router = Router()

router.use(requireAuth)

router.get('/last-import', getCommandeLastImport)
router.get('/', getCommandesPgi)

export default router
