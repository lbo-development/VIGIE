import { Router } from 'express'
import multer from 'multer'
import { requireAuth } from '../middlewares/requireAuth.js'
import {
  postDemandeAchat,
  getDemandeAchat,
  getDemandeAchatById,
  putDemandeAchat,
  putDemandeAchatMarche,
  getDemandeAchatConsultation,
  putDemandeAchatConsultation,
  postConsultationCandidat,
  deleteConsultationCandidat,
  postMarcheDevis,
  postDevisFichier,
  getDevisFichier,
  deleteDevisFichier,
  getDemandeAchatPieces,
  postDemandeAchatPiece,
  deleteDemandeAchatPiece,
  getDemandeAchatPieceFichier,
  deleteDemandeAchat,
} from '../controllers/demandeAchat.controller.js'

// memoryStorage : le fichier ne touche jamais le disque avant l'envoi au bucket Supabase
// Storage (SECURITY.md §10). Limite alignée sur le plafond applicatif (10 Mo) — voir
// demandeAchat.service.ts#uploadDevisFile pour la validation réelle (magic bytes + taille).
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 10 * 1024 * 1024 } })

const router = Router()

router.use(requireAuth)

router.get('/', getDemandeAchat)
router.post('/', postDemandeAchat)
router.get('/:id', getDemandeAchatById)
router.put('/:id', putDemandeAchat)
router.put('/:id/marche', putDemandeAchatMarche)
router.get('/:id/consultation', getDemandeAchatConsultation)
router.put('/:id/consultation', putDemandeAchatConsultation)
router.post('/:id/consultation/candidats', postConsultationCandidat)
router.delete('/:id/consultation/candidats/:idDevis', deleteConsultationCandidat)
router.post('/:id/marche/devis', postMarcheDevis)
router.post('/:id/devis/:idDevis/fichier', upload.single('fichier'), postDevisFichier)
router.get('/:id/devis/:idDevis/fichier', getDevisFichier)
router.delete('/:id/devis/:idDevis/fichier', deleteDevisFichier)
router.get('/:id/pieces', getDemandeAchatPieces)
router.post('/:id/pieces', upload.single('fichier'), postDemandeAchatPiece)
router.delete('/:id/pieces/:idPiece', deleteDemandeAchatPiece)
router.get('/:id/pieces/:idPiece/fichier', getDemandeAchatPieceFichier)
router.delete('/:id', deleteDemandeAchat)

export default router
