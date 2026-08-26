import { Router } from 'express'
import { requireAuth } from '../middlewares/requireAuth.js'
import {
  getSites,
  postSite,
  putSite,
  putSitesReorder,
  postSousSite,
  putSousSite,
  putSousSitesReorder,
} from '../controllers/site.controller.js'

const router = Router()

router.use(requireAuth)

router.get('/', getSites)
router.post('/', postSite)
// /reorder avant /:codeSite : sinon Express matcherait "reorder" comme une
// valeur de codeSite (route dynamique enregistrée en premier = shadowing).
router.put('/reorder', putSitesReorder)
router.put('/:codeSite', putSite)

router.post('/:codeSite/sous-sites', postSousSite)
router.put('/:codeSite/sous-sites/reorder', putSousSitesReorder)
router.put('/:codeSite/sous-sites/:codeSousSite', putSousSite)

export default router
