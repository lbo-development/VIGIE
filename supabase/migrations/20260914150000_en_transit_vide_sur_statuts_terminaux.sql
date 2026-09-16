-- Point 2/analyse "en_transit" : un statut terminal (rejet ou annulation) ne
-- doit plus indiquer que quiconque "détient" le dossier — en_transit doit être
-- vide, exactement comme FAD_COMMANDEE (seul statut terminal déjà correct sur
-- ce point). Sans ce correctif, un futur écran listant "mes dossiers en cours"
-- par acteur (indépendamment de la file "à traiter", qui filtre déjà sur
-- pour_action) afficherait indéfiniment des dossiers clos comme s'ils étaient
-- encore entre les mains de l'acteur ayant prononcé le rejet/l'annulation.
--
-- Après cette migration, `en_transit is null` devient à lui seul le critère
-- "ce cycle est définitivement clos" (8 statuts : les 7 ci-dessous + FAD_COMMANDEE
-- déjà correct), sans avoir besoin de connaître la liste des statuts terminaux
-- ni de regarder type_statut.
--
-- Pas de valeur sentinelle type 'TERMINE' : en_transit ne contient que des
-- codes d'acteur (DEM/RC/CDS/CB/DS) — mélanger "quel acteur" et "où en est le
-- cycle" dans la même colonne compliquerait toute requête sans bénéfice, alors
-- que NULL exprime déjà cette idée de façon cohérente avec FAD_COMMANDEE.

update finances.statut
set en_transit = null
where code_statut in (
  'DA_REJETEE_RC',
  'DA_ANNULEE_RC',
  'FAD_REJETEE_CDS',
  'FAD_ANNULEE_CDS',
  'FAD_REJETEE_CB',
  'FAD_REJETEE_DS',
  'FAD_ANNULEE_DS'
);
