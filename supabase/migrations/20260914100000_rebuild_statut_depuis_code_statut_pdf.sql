-- Reconstruction complète de finances.statut à partir du tableau de
-- ForClaude/CDC/code_statut.pdf (version mise à jour du 14/09/2026 : 25 statuts,
-- colonnes CODE_STATUT/LIBELLE/EMMETTEUR/POUR ACTION/DIFFUSION/EN TRANSIT/
-- TYPE_STATUT/COMMENTAIRE). Remplace la migration 20260914090000, qui ne faisait
-- qu'ajouter 3 colonnes sur la table existante — ici on repart de zéro (DROP TABLE
-- puis CREATE TABLE), à la demande explicite de l'utilisateur.
--
-- Écarts assumés par rapport au contenu strict du PDF, à valider :
--   - pas de colonne `indice` : conformément au tableau source, qui ne la porte
--     plus. ForClaude/CDC/cycle-da-fad.html continue de citer les indices (A010,
--     B030, ...) mais uniquement comme repère documentaire dans le HTML — plus
--     aucune colonne en base ne les porte à partir de cette migration ;
--   - `recepteur`, `ordre`, `comment2` ne sont pas recréées : colonnes héritées d'un
--     ajout manuel antérieur, non lues par le backend, superflues depuis la scission
--     Pour action / Diffusion.
--
-- finances.demande_achat.code_statut et finances.historique_statut.code_statut
-- référencent finances.statut(code_statut) par FK (contraintes
-- demande_achat_code_statut_fkey et historique_statut_code_statut_fkey) ; les deux
-- tables sont vides à ce jour (vérifié en lecture seule via claude_readonly), donc
-- le DROP TABLE ... CASCADE ci-dessous ne supprime aucune donnée — seulement ces
-- deux contraintes, recréées à l'identique après la reconstruction de la table.

drop table if exists finances.statut cascade;

create table finances.statut (
  code_statut  text not null,
  libelle      text not null,
  emmeteur     text null,
  pour_action  text null,
  diffusion    text null,
  en_transit   text null,
  type_statut  text null,
  commentaire  text null,
  created_at   timestamp with time zone not null default now(),
  updated_at   timestamp with time zone not null default now(),
  constraint statut_pkey primary key (code_statut)
);

create trigger trg_set_updated_at before
update on finances.statut for each row
execute function finances.set_updated_at();

-- Les 25 statuts doivent exister AVANT de raccrocher les FK entrantes : si
-- demande_achat ou historique_statut portent encore la moindre ligne (test
-- applicatif antérieur), l'ALTER TABLE ADD CONSTRAINT valide immédiatement leur
-- contenu contre finances.statut — qui vient d'être recréée vide à cet instant.
-- Ordre inversé par rapport à la version précédente de cette migration, qui
-- échouait pour cette raison (23503 sur demande_achat_code_statut_fkey).
insert into finances.statut
  (code_statut, libelle, emmeteur, pour_action, diffusion, en_transit, type_statut, commentaire)
values
  ('DA_EN_PREPARATION', 'DA en préparation', 'DEM', null, null, 'DEM', null,
   'Le demandeur prépare sa commande. Il rassemble tous les éléments constitutifs de la demande d''achat.'),

  ('DA_TRANSMISE_DEM_RC', 'DA transmise au N+1', 'DEM', 'RC', null, 'RC', 'TRANSMISION',
   'Tous les éléments constitutifs de demande d''achat sont valides et cohérents. Le demandeur la transmet au N+1.'),

  ('DA_VALIDEE_RC', 'DA validée par N+1', 'RC', null, 'DEM', 'RC', 'VALIDEE',
   'Le N+1 a étudié la demande d''achat. La demande est opportune, compléte et conforme.'),

  ('DA_A_COMPLETER_RC', 'DA à compléter par le demandeur', 'RC', 'DEM', null, 'DEM', 'COMPLEMENT',
   'Le N+1 a étudié la demande d''achat. Il demande des compléments d''informations au demandeur.'),

  ('DA_REJETEE_RC', 'DA rejetée par N+1', 'RC', null, 'DEM', 'RC', 'REJETEE',
   'Le N+1 a étudié la demande d''achat. il conteste l''opportunité de l''achat ou les conditions de mise en concurrence. Il rejette la demande.'),

  ('DA_ANNULEE_RC', 'DA annulée par N+1', 'RC', null, 'DEM', 'RC', 'ANNULEE',
   'Le N+1 a étudié la demande d''achat. Le besoin n''est pas ou plus d''actualité. Il annule la demande.'),

  ('FAD_TRANSMISE_RC_CDS', 'FAD transmise par le N+1 au N+2', 'RC', 'CDS', 'DEM', 'CDS', 'TRANSMISION',
   'Le N+1 transformer la demande d''achat validée en FAD. Il la transmet à N+2.'),

  ('FAD_MODIFIEE_TRANSMISE_RC_CB', 'FAD modifiée transmise de RC à la CB', 'RC', 'CB', 'DEM', 'CB', 'TRANSMISION',
   'Le RC a apporté les modifications demandées par la cellule budget(CB). Il transmet à la cellule budget(CB).'),

  ('FAD_VALIDEE_CDS', 'FAD validée par N+2', 'CDS', null, 'DEM/RC', 'CDS', 'VALIDEE',
   'Le N+2 a étudié la FAD transmise par N+1. La FAD est oppportune, compléte et conforme.'),

  ('FAD_A_COMPLETER_CDS', 'FAD à compléter par le N+1', 'CDS', 'RC', 'DEM', 'RC', 'COMPLEMENT',
   'Le N+2 a étudié la FAD. Il demande des compléments d''informations au N+1.'),

  ('FAD_REJETEE_CDS', 'FAD rejetée par N+2', 'CDS', null, 'DEM/RC', 'CDS', 'REJETEE',
   'Le N+2 a étudié la FAD. il conteste l''opportunité de l''achat ou les conditions de mise en concurrence. Il rejette la FAD.'),

  ('FAD_ANNULEE_CDS', 'FAD annulée par N+2', 'CDS', null, 'DEM/RC', 'CDS', 'ANNULEE',
   'Le N+2 a étudié la FAD. Le besoin n''est pas ou plus d''actualité. Il annule la FAD.'),

  ('FAD_TRANSMISE_CDS_CB', 'FAD transmise par le N+2 à la CB', 'CDS', 'CB', 'DEM/RC', 'CB', 'TRANSMISION',
   'Le N+2 transmet à FAD validée à la cellule budget (CB).'),

  ('FAD_VALIDEE_CB', 'FAD validée par la CB', 'CB', null, 'DEM/RC/CDS', 'CB', 'VALIDEE',
   'La cellule budget (CB) a étudié la FAD transmise par N+2. La FAD est compléte et conforme sur le plan bugétaire et comptable.'),

  ('FAD_A_MODIFIER_CB', 'FAD à modifier par N+1', 'CB', 'RC', 'DEM/RC/CDS', 'RC', 'COMPLEMENT',
   'La cellule budget (CB) a étudié la FAD transmise par N+2. La FAD nécessite des modifications sur les aspects budgétaires et comptables. (Opérations/fonctionnement, Nature des travaux, CUG...)'),

  ('FAD_REJETEE_CB', 'FAD rejetée par la CB', 'CB', null, 'DEM/RC/CDS', 'CB', 'REJETEE',
   'La cellule budget (CB) a étudié  la FAD transmise par N+2. Elle n''a pas les crédits disponibles pour finaliser cette FAD. Elle rejette la demande.'),

  ('FAD_TRANSMISE_CB_DS', 'FAD transmise par CB à N+3', 'CB', 'DS', 'DEM/RC/CDS', 'DS', 'TRANSMISION',
   'La cellule budget (CB) a étudié la FAD transmise par N+2. La FAD est compléte et conforme sur le plan bugétaire et comptable. Elle transmet la FAD à N+3'),

  ('FAD_VALIDEE_DS', 'FAD validée par N+3', 'DS', null, 'DEM/RC/CDS/CB', 'DS', 'VALIDEE',
   'Le N+3 a étudié la FAD transmise par la cellule budget(CB). La FAD est oppportune, compléte et conforme.'),

  ('FAD_VALIDEE_DS_SEUIL', 'FAD validée automatiquement par N+3', 'DS', 'CB', 'DEM/RC/CDS', 'CB', 'VALIDEE',
   'Si le montant de la FAD est inférieur au seuil de délagation. La FAD  jugée par N+3 comme oppportune, compléte et conforme. Elle est validée et transmise  automatiquement à la cellule budget(CB).'),

  ('FAD_A_COMPLETER_CB', 'FAD à compléter par le CB', 'DS', 'CB', 'DEM/RC/CDS', 'CB', 'COMPLEMENT',
   'Le N+3 a étudier la FAD transmise par la CB.  La FAD nécessite des compléments d''information sur la nature de l''achat ou sur les aspects budgétaires et comptables. (Porcédure d''achat, Opérations/fonctionnement, Nature des travaux, CUG...)'),

  ('FAD_REJETEE_DS', 'FAD rejetée par N+3', 'DS', null, 'DEM/RC/CDS/CB', 'DS', 'REJETEE',
   'Le N+3 a étudié la FAD. il conteste l''opportunité de l''achat ou les conditions de mise en concurrence. Il rejette la FAD.'),

  ('FAD_ANNULEE_DS', 'FAD annulée par N+3', 'DS', null, 'DEM/RC/CDS/CB', 'DS', 'ANNULEE',
   'Le N+3 a étudié la FAD. Le besoin n''est pas ou plus d''actualité. Il annule la FAD.'),

  ('FAD_TRANSMISE_DS_CB', 'FAD transmise par le N+3 à la CB', 'DS', 'CB', 'DEM/RC/CDS', 'CB', 'TRANSMISION',
   'Le N+3 a étudié la FAD transmise par la cellule budget(CB). La FAD est oppportune, compléte et conforme. Il donne l''ordre de commande à la cellule budget(CB)'),

  ('FAD_A_COMMANDER', 'FAD à commander par CB', 'CB', 'CB', 'DEM/RC/CDS/DS', 'CB', null,
   'La FAD a reçu l''autorisation de commande par le N+3'),

  ('FAD_COMMANDEE', 'FAD commandée par CB', 'CB', null, 'DEM/RC/CDS/DS', null, null,
   'Le bon de commande PGI associée à la FAD est édité.');

alter table finances.demande_achat
  add constraint demande_achat_code_statut_fkey
  foreign key (code_statut) references finances.statut(code_statut) on delete restrict;

alter table finances.historique_statut
  add constraint historique_statut_code_statut_fkey
  foreign key (code_statut) references finances.statut(code_statut) on delete restrict;
