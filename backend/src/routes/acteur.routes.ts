import { Router } from 'express'
import { requireAuth } from '../middlewares/requireAuth.js'
import { requireRole } from '../middlewares/requireRole.js'
import { getActeurs, postActeur, putActeur, deleteActeur } from '../controllers/acteur.controller.js'

const router = Router()

router.use(requireAuth)

router.get('/', getActeurs)
// Écriture (fiche acteur + compte + rattachement cellule) réservée ADMIN_APP
// — décision du 10/09/2026, voir ForClaude/CDC/mot-phases-1-2.md.
router.post('/', requireRole('ADMIN_APP'), postActeur)
router.put('/:matricule', requireRole('ADMIN_APP'), putActeur)
router.delete('/:matricule', requireRole('ADMIN_APP'), deleteActeur)

export default router
