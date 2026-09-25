import { Router } from 'express'
import multer from 'multer'
import { requireAuth } from '../middlewares/requireAuth.js'
import {
  postCertificatServiceFait,
  getCertificatsServiceFait,
  getSyntheseFacturation,
  getCertificatServiceFaitById,
  putCertificatServiceFait,
  putCertificatServiceFaitRc,
  postCertificatServiceFaitTransmettreRc,
  postCertificatServiceFaitTransmettreBudget,
  postCertificatServiceFaitComplementRc,
  postCertificatServiceFaitRetransmettreBudget,
  postCertificatServiceFaitValiderBudget,
  postCertificatServiceFaitComplementBudget,
  postCertificatServiceFaitLiquidation,
  deleteCertificatServiceFait,
  getCertificatServiceFaitHistorique,
  getCertificatServiceFaitPieces,
  postCertificatServiceFaitPiece,
  deleteCertificatServiceFaitPiece,
  getCertificatServiceFaitPieceFichier,
} from '../controllers/certificatServiceFait.controller.js'

// memoryStorage : le fichier ne touche jamais le disque avant l'envoi au bucket Supabase
// Storage (SECURITY.md §10) — même limite applicative que demandeAchat.routes.ts.
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 10 * 1024 * 1024 } })

const router = Router()

router.use(requireAuth)

router.get('/', getCertificatsServiceFait)
router.post('/', postCertificatServiceFait)
// Doit précéder '/:id' — sinon Express matche "synthese-facturation" comme :id.
router.get('/synthese-facturation', getSyntheseFacturation)
router.get('/:id', getCertificatServiceFaitById)
router.get('/:id/historique', getCertificatServiceFaitHistorique)
router.put('/:id', putCertificatServiceFait)
router.put('/:id/rc', putCertificatServiceFaitRc)
router.post('/:id/transmettre-rc', postCertificatServiceFaitTransmettreRc)
router.post('/:id/transmettre-budget', postCertificatServiceFaitTransmettreBudget)
router.post('/:id/complement-rc', postCertificatServiceFaitComplementRc)
router.post('/:id/retransmettre-budget', postCertificatServiceFaitRetransmettreBudget)
router.post('/:id/valider-budget', postCertificatServiceFaitValiderBudget)
router.post('/:id/complement-budget', postCertificatServiceFaitComplementBudget)
router.post('/:id/liquidation', postCertificatServiceFaitLiquidation)
router.get('/:id/pieces', getCertificatServiceFaitPieces)
router.post('/:id/pieces', upload.single('fichier'), postCertificatServiceFaitPiece)
router.delete('/:id/pieces/:idPiece', deleteCertificatServiceFaitPiece)
router.get('/:id/pieces/:idPiece/fichier', getCertificatServiceFaitPieceFichier)
router.delete('/:id', deleteCertificatServiceFait)

export default router
