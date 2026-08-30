import { Router } from 'express'
import { requireAuth } from '../middlewares/requireAuth.js'
import {
  getFournisseurs,
  postFournisseur,
  putFournisseur,
  deleteFournisseur,
} from '../controllers/fournisseur.controller.js'
import { postContact, putContact, deleteContact } from '../controllers/contact.controller.js'

const router = Router()

router.use(requireAuth)

router.get('/', getFournisseurs)
router.post('/', postFournisseur)
router.put('/:idFournisseur', putFournisseur)
router.delete('/:idFournisseur', deleteFournisseur)

router.post('/:idFournisseur/contacts', postContact)
router.put('/:idFournisseur/contacts/:idContact', putContact)
router.delete('/:idFournisseur/contacts/:idContact', deleteContact)

export default router
