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
  getDemandeAchatFadPdf,
  deleteDemandeAchat,
  postDemandeAchatTransmettreRc,
  postDemandeAchatDecisionRc,
  postDemandeAchatDevaliderRc,
  postDemandeAchatTransmettreFad,
  putDemandeAchatFad,
  postDemandeAchatDecisionCds,
  postDemandeAchatTransmettreCb,
  postDemandeAchatDecisionCb,
  postDemandeAchatRetransmettreCb,
  postDemandeAchatTransmettreDsOuSeuil,
  postDemandeAchatDecisionDs,
  postDemandeAchatTransmettreOrdreCb,
  postDemandeAchatCompleterCb,
  postDemandeAchatDemanderModificationRc,
  postDemandeAchatCommander,
  putDemandeAchatNumeroCommande,
  getDemandeAchatHistorique,
  getDemandeAchatSynthese,
} from '../controllers/demandeAchat.controller.js'

// memoryStorage : le fichier ne touche jamais le disque avant l'envoi au bucket Supabase
// Storage (SECURITY.md §10). Limite alignée sur le plafond applicatif (10 Mo) — voir
// demandeAchat.service.ts#uploadDevisFile pour la validation réelle (magic bytes + taille).
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 10 * 1024 * 1024 } })

const router = Router()

router.use(requireAuth)

router.get('/', getDemandeAchat)
router.post('/', postDemandeAchat)
// Doit précéder '/:id' — sinon Express matche "synthese" comme :id.
router.get('/synthese', getDemandeAchatSynthese)
router.get('/:id', getDemandeAchatById)
router.get('/:id/historique', getDemandeAchatHistorique)
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
router.get('/:id/fad-pdf', getDemandeAchatFadPdf)
router.post('/:id/transmettre-rc', postDemandeAchatTransmettreRc)
router.post('/:id/decision-rc', postDemandeAchatDecisionRc)
router.post('/:id/devalider-rc', postDemandeAchatDevaliderRc)
router.post('/:id/transmettre-fad', postDemandeAchatTransmettreFad)
router.put('/:id/fad', putDemandeAchatFad)
router.post('/:id/decision-cds', postDemandeAchatDecisionCds)
router.post('/:id/transmettre-cb', postDemandeAchatTransmettreCb)
router.post('/:id/decision-cb', postDemandeAchatDecisionCb)
router.post('/:id/retransmettre-cb', postDemandeAchatRetransmettreCb)
router.post('/:id/transmettre-ds-ou-seuil', postDemandeAchatTransmettreDsOuSeuil)
router.post('/:id/decision-ds', postDemandeAchatDecisionDs)
router.post('/:id/transmettre-ordre-cb', postDemandeAchatTransmettreOrdreCb)
router.post('/:id/completer-cb', postDemandeAchatCompleterCb)
router.post('/:id/demander-modification-rc', postDemandeAchatDemanderModificationRc)
router.post('/:id/commander', postDemandeAchatCommander)
router.put('/:id/numero-commande', putDemandeAchatNumeroCommande)
router.delete('/:id', deleteDemandeAchat)

export default router
