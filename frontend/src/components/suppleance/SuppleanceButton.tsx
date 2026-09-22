import { useState } from 'react'
import { useMesSuppleances } from '../../hooks/useSuppleance'
import { SuppleanceModal } from './SuppleanceModal'

/**
 * Bouton « Suppléance » de l'en-tête des écrans d'accueil (décision du 20/09/2026), à poser dans
 * `<div className="page-actions">` du `.page-heading`. N'apparaît que pour un titulaire d'un rôle
 * RC/CDS/DS : le serveur ne renvoie de rôles suppléables qu'à l'appelant titulaire (jamais un
 * suppléant seul, ni la CB, ni un admin) — pas de bouton tant que la liste est vide, en cours de
 * chargement ou en erreur. Masquer un bouton n'est pas un contrôle d'accès : chaque route
 * /suppleances revérifie que l'appelant est le titulaire du rôle (SECURITY.md §2.10).
 */
export function SuppleanceButton() {
  const { data, refetch } = useMesSuppleances()
  const [open, setOpen] = useState(false)

  if (!data || data.roles.length === 0) return null

  return (
    <>
      <button type="button" className="gp-btn gp-btn--secondary" onClick={() => setOpen(true)}>
        <svg className="ti">
          <use href="#i-users" />
        </svg>
        Suppléance
      </button>
      {open && <SuppleanceModal data={data} onChanged={refetch} onClose={() => setOpen(false)} />}
    </>
  )
}
