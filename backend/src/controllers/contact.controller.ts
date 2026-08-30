import type { NextFunction, Request, Response } from 'express'
import * as contactService from '../services/contact.service.js'

export async function postContact(req: Request, res: Response, next: NextFunction) {
  try {
    const contact = await contactService.createContact(req.matricule ?? null, Number(req.params.idFournisseur), req.body)
    res.status(201).json(contact)
  } catch (err) {
    next(err)
  }
}

export async function putContact(req: Request, res: Response, next: NextFunction) {
  try {
    const contact = await contactService.updateContact(req.matricule ?? null, Number(req.params.idContact), req.body)
    res.json(contact)
  } catch (err) {
    next(err)
  }
}

export async function deleteContact(req: Request, res: Response, next: NextFunction) {
  try {
    await contactService.deleteContact(req.matricule ?? null, Number(req.params.idContact))
    res.status(204).end()
  } catch (err) {
    next(err)
  }
}
