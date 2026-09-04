import { Router } from 'express'
import multer from 'multer'
import { requireAuth } from '../middlewares/requireAuth.js'
import { postPreview, postConfirm, getLastImport } from '../controllers/investissementImport.controller.js'

// memoryStorage : le fichier ne touche jamais le disque (SECURITY.md §10) — il n'est utile
// que le temps du parsing, jamais persisté. Même limite que les imports marchés/commandes.
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 10 * 1024 * 1024 } })

const router = Router()

router.use(requireAuth)

router.get('/last-import', getLastImport)
router.post('/preview', upload.single('fichier'), postPreview)
router.post('/confirm', upload.single('fichier'), postConfirm)

export default router
