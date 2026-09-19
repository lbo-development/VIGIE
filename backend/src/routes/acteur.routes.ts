import { Router } from 'express'
import multer from 'multer'
import { requireAuth } from '../middlewares/requireAuth.js'
import { requireRole } from '../middlewares/requireRole.js'
import {
  getActeurs,
  postActeur,
  putActeur,
  deleteActeur,
  getActeurSignature,
  getActeurSignatureFichier,
  putActeurSignature,
  deleteActeurSignature,
} from '../controllers/acteur.controller.js'

// memoryStorage : le fichier ne touche jamais le disque avant l'envoi au bucket Supabase
// Storage (SECURITY.md §10). Limite alignée sur le plafond applicatif (2 Mo) — voir
// signatureActeur.service.ts#uploadSignature pour la validation réelle (magic bytes + taille).
const uploadSignature = multer({ storage: multer.memoryStorage(), limits: { fileSize: 2 * 1024 * 1024 } })

const router = Router()

router.use(requireAuth)

router.get('/', getActeurs)
// Écriture (fiche acteur + compte + rattachement cellule) réservée ADMIN_APP
// — décision du 10/09/2026, voir ForClaude/CDC/mot-phases-1-2.md.
router.post('/', requireRole('ADMIN_APP'), postActeur)
router.put('/:matricule', requireRole('ADMIN_APP'), putActeur)
router.delete('/:matricule', requireRole('ADMIN_APP'), deleteActeur)

// Signature (image) d'un acteur — droits ADMIN_APP/ADMIN_SERVICE scopé service vérifiés dans
// signatureActeur.service.ts (assertManagesService), pas ici : contrairement au CRUD ACTEUR
// ci-dessus (transverse, requireRole suffit), ADMIN_SERVICE doit pouvoir gérer les signatures
// des acteurs de son propre service — décision du 19/09/2026.
router.get('/:matricule/signature', getActeurSignature)
router.get('/:matricule/signature/fichier', getActeurSignatureFichier)
router.put('/:matricule/signature', uploadSignature.single('fichier'), putActeurSignature)
router.delete('/:matricule/signature', deleteActeurSignature)

export default router
