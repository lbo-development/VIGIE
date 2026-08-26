import { Router } from 'express'
import { requireAuth } from '../middlewares/requireAuth.js'
import {
  getSecteurs,
  postSecteur,
  putSecteur,
  putSecteursReorder,
  postSousSecteur,
  putSousSecteur,
  putSousSecteursReorder,
} from '../controllers/secteur.controller.js'

const router = Router()

router.use(requireAuth)

router.get('/', getSecteurs)
router.post('/', postSecteur)
// /reorder avant /:codeSecteur : sinon Express matcherait "reorder" comme une
// valeur de codeSecteur (route dynamique enregistrée en premier = shadowing).
router.put('/reorder', putSecteursReorder)
router.put('/:codeSecteur', putSecteur)

router.post('/:codeSecteur/sous-secteurs', postSousSecteur)
router.put('/:codeSecteur/sous-secteurs/reorder', putSousSecteursReorder)
router.put('/:codeSecteur/sous-secteurs/:codeSousSecteur', putSousSecteur)

export default router
