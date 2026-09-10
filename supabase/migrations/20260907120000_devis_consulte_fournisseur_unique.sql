-- Décision du 07/09/2026 : un même fournisseur ne peut pas apparaître deux
-- fois comme candidat consulté sur une même DA (règle affichée dans
-- FournisseurDA : « Il ne peut pas y avoir de doublons dans la liste des
-- entreprises consultées »). Jusqu'ici purement applicative (vérifiée à
-- l'ajout dans la liste "Consultés"), sans filet de sécurité côté base.
-- Table vide en production à ce jour, contrainte ajoutable directement.
alter table finances.devis_consulte
  add constraint uq_devis_fournisseur_par_da unique (numero, id_fournisseur);
