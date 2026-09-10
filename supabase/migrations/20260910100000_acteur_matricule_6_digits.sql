-- ACTEUR.MATRICULE : format imposé à exactement 6 chiffres, complété par des
-- zéros à gauche (ex. 600 -> 000600) — décision du 10/09/2026. Vérifié en
-- lecture seule (rôle claude_readonly) : finances.acteur et public.profiles
-- sont vides en production à ce jour, aucune donnée existante à corriger —
-- la contrainte est donc ajoutée directement, sans backfill ni gestion de
-- cascade sur les FK qui référencent ACTEUR.MATRICULE (role_attribution,
-- suppleance, demande_achat, certificat_service_fait, historique_statut,
-- historique_statut_csf, marche_piece, investissement_piece,
-- parametre_application).
--
-- La complétion par des zéros (padStart) est appliquée côté application à la
-- création d'un acteur (voir backend/src/services/acteur.service.ts) — cette
-- contrainte est un filet de sécurité base, pas le mécanisme de complétion
-- lui-même.
alter table finances.acteur
  add constraint acteur_matricule_format_check
  check (matricule ~ '^[0-9]{6}$');
