import { Router } from 'express'
import { requireAuth } from '../middlewares/requireAuth.js'
import { getInvestissements, getInvestissementLastImport, putInvestissementManagedFields } from '../controllers/investissement.controller.js'

const router = Router()

router.use(requireAuth)

router.get('/last-import', getInvestissementLastImport)
router.get('/', getInvestissements)
router.put('/:numeroOperation', putInvestissementManagedFields)

export default router
