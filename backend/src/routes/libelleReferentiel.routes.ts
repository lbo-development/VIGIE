import { Router } from 'express'
import { requireAuth } from '../middlewares/requireAuth.js'
import {
  getLibelleReferentiel,
  postLibelleReferentiel,
  putLibelleReferentiel,
  putLibelleReferentielReorder,
  deleteLibelleReferentielHandler,
} from '../controllers/libelleReferentiel.controller.js'

const router = Router()

router.use(requireAuth)

router.get('/', getLibelleReferentiel)
router.post('/', postLibelleReferentiel)
// /reorder avant /:domaine/:code : sinon Express matcherait "reorder" comme :domaine (voir secteur.routes.ts).
router.put('/reorder', putLibelleReferentielReorder)
router.put('/:domaine/:code', putLibelleReferentiel)
router.delete('/:domaine/:code', deleteLibelleReferentielHandler)

export default router
