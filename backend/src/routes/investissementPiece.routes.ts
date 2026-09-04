import { Router } from 'express'
import multer from 'multer'
import { requireAuth } from '../middlewares/requireAuth.js'
import { getPieces, postPiece, putPieceMetadata, getPieceDownload, deletePieceHandler } from '../controllers/investissementPiece.controller.js'

// memoryStorage : le fichier ne touche jamais le disque avant l'envoi au bucket Supabase Storage
// (SECURITY.md §10). Limite alignée sur le plafond applicatif (10 Mo) — voir
// investissementPiece.service.ts pour la validation réelle (MIME + taille).
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 10 * 1024 * 1024 } })

const router = Router()

router.use(requireAuth)

router.get('/', getPieces)
router.post('/', upload.single('fichier'), postPiece)
router.put('/:id', putPieceMetadata)
router.get('/:id/download', getPieceDownload)
router.delete('/:id', deletePieceHandler)

export default router
