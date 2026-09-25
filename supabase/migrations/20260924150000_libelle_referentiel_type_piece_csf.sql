-- Référentiel des types de justificatif CSF (décision du 24/09/2026) —
-- domaine dédié TYPE_PIECE_CSF, distinct de TYPE_PIECE_FAD (pièces
-- complémentaires de la DA/FAD, migration 20260907150000) : les justificatifs
-- attendus par le circuit CSF sont d'une autre nature (constat de service
-- fait), pas les documents commerciaux/techniques d'une consultation de
-- marché. Valeurs citées par le MCT (OP2.1) : PV de réception, bon de
-- livraison, plus une valeur libre.
--
-- Même mécanisme que TYPE_PIECE_FAD : finances.piece_jointe.type_piece est
-- contraint par la FK composite (domaine_type_piece, type_piece) →
-- libelle_referentiel(domaine, code), déjà en place (migration 20260907150000)
-- — aucune nouvelle contrainte à ajouter, seulement de nouvelles lignes de
-- référentiel. Le backend (certificatServiceFait.service.ts) devra passer
-- domaine_type_piece='TYPE_PIECE_CSF' explicitement à la création d'une
-- pièce CSF (le DEFAULT de la colonne reste 'TYPE_PIECE_FAD', pour ne pas
-- changer le comportement des pièces DA existantes).

insert into finances.libelle_referentiel (domaine, code, libelle, ordre, actif) values
  ('TYPE_PIECE_CSF', 'PV_RECEPTION', 'PV de réception', 1, true),
  ('TYPE_PIECE_CSF', 'BON_LIVRAISON', 'Bon de livraison', 2, true),
  ('TYPE_PIECE_CSF', 'AUTRE', 'Autre', 3, true)
on conflict (domaine, code) do nothing;
