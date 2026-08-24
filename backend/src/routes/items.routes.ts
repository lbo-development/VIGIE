import { Router } from 'express'
import { getItems, postItem } from '../controllers/items.controller.js'

const router = Router()

router.get('/', getItems)
router.post('/', postItem)

export default router
