-- Resynchronise finances.statut avec l'onglet code_statut de
-- ForClaude/CDC/code_statut.xlsx (25 statuts, cf. ForClaude/CDC/cycle-da-fad.html).
--
-- Constat avant migration (vérifié en lecture seule via le rôle claude_readonly,
-- cf. ForClaude/SECURITY.md §7) : la table finances.statut porte déjà, hors de
-- toute migration versionnée, les colonnes emmeteur, recepteur, ordre, comment2
-- et indice — probablement ajoutées à la main dans l'éditeur Supabase. Aucun code
-- backend ne les référence. Cette migration ne touche pas recepteur/ordre/comment2
-- (non demandés, laissés en l'état) ; elle ajoute uniquement les 3 colonnes qui
-- manquent pour porter le nouveau modèle à 3 axes (Pour action / Diffusion / En
-- transit, cf. cycle-da-fad.html section "Lecture du référentiel").
--
-- La table et ses tables filles (demande_achat, historique_statut) sont vides à ce
-- jour (vérifié) : les 25 lignes sont insérées sans risque de collision avec des
-- données déjà en production. `on conflict ... do update` la rend idempotente pour
-- une exécution ultérieure.

alter table finances.statut
  add column if not exists pour_action text,
  add column if not exists diffusion text,
  add column if not exists en_transit text;

insert into finances.statut
  (code_statut, libelle, emmeteur, pour_action, diffusion, en_transit, indice, commentaire)
values
  ('DA_EN_PREPARATION', 'DA en préparation', 'DEM', null, null, 'DEM', 'A010',
   'Le demandeur prépare sa commande. Il rassemble tous les éléments constitutifs de la demande d''achat.'),

  ('DA_TRANSMISE_DEM_RC', 'DA transmise au N+1', 'DEM', 'RC', null, 'RC', 'A020',
   'Tous les éléments constitutifs de demande d''achat sont valides et cohérents. Le demandeur la transmet au N+1.'),

  ('DA_VALIDEE_RC', 'DA validée par N+1', 'RC', null, 'DEM', 'RC', 'B010',
   'Le N+1 a étudié la demande d''achat. La demande est opportune, compléte et conforme.'),

  ('DA_A_COMPLETER_RC', 'DA à compléter par le demandeur', 'RC', 'DEM', null, 'DEM', 'B020',
   'Le N+1 a étudié la demande d''achat. Il demande des compléments d''informations au demandeur.'),

  ('DA_REJETEE_RC', 'DA rejetée par N+1', 'RC', null, 'DEM', 'RC', 'B021',
   'Le N+1 a étudié la demande d''achat. il conteste l''opportunité de l''achat ou les conditions de mise en concurrence. Il rejette la demande.'),

  ('DA_ANNULEE_RC', 'DA annulée par N+1', 'RC', null, 'DEM', 'RC', 'B022',
   'Le N+1 a étudié la demande d''achat. Le besoin n''est pas ou plus d''actualité. Il annule la demande.'),

  ('FAD_TRANSMISE_RC_CDS', 'FAD transmise par le N+1 au N+2', 'RC', 'CDS', 'DEM', 'CDS', 'B030',
   'Le N+1 transformer la demande d''achat validée en FAD. Il la transmet à N+2.'),

  ('FAD_MODIFIEE_TRANSMISE_RC_CB', 'FAD modifiée transmise de RC à la CB', 'RC', 'CB', 'DEM', 'CB', 'B040',
   'Le RC a apporté les modifications demandées par la cellule budget(CB). Il transmet à la cellule budget(CB).'),

  ('FAD_VALIDEE_CDS', 'FAD validée par N+2', 'CDS', null, 'DEM/RC', 'CDS', 'C010',
   'Le N+2 a étudié la FAD transmise par N+1. La FAD est oppportune, compléte et conforme.'),

  ('FAD_A_COMPLETER_CDS', 'FAD à compléter par le N+1', 'CDS', 'RC', 'DEM', 'RC', 'C020',
   'Le N+2 a étudié la FAD. Il demande des compléments d''informations au N+1.'),

  ('FAD_REJETEE_CDS', 'FAD rejetée par N+2', 'CDS', null, 'DEM/RC', 'CDS', 'C021',
   'Le N+2 a étudié la FAD. il conteste l''opportunité de l''achat ou les conditions de mise en concurrence. Il rejette la FAD.'),

  ('FAD_ANNULEE_CDS', 'FAD annulée par N+2', 'CDS', null, 'DEM/RC', 'CDS', 'C022',
   'Le N+2 a étudié la FAD. Le besoin n''est pas ou plus d''actualité. Il annule la FAD.'),

  ('FAD_TRANSMISE_CDS_CB', 'FAD transmise par le N+2 à la CB', 'CDS', 'CB', 'DEM/RC', 'CB', 'C030',
   'Le N+2 transmet à FAD validée à la cellule budget (CB).'),

  ('FAD_VALIDEE_CB', 'FAD validée par la CB', 'CB', null, 'DEM/RC/CDS', 'CB', 'D010',
   'La cellule budget (CB) a étudié la FAD transmise par N+2. La FAD est compléte et conforme sur le plan bugétaire et comptable.'),

  ('FAD_A_MODIFIER_CB', 'FAD à modifier par N+1', 'CB', 'RC', 'DEM/RC/CDS', 'RC', 'D020',
   'La cellule budget (CB) a étudié la FAD transmise par N+2. La FAD nécessite des modifications sur les aspects budgétaires et comptables. (Opérations/fonctionnement, Nature des travaux, CUG...)'),

  ('FAD_REJETEE_CB', 'FAD rejetée par la CB', 'CB', null, 'DEM/RC/CDS', 'CB', 'D021',
   'La cellule budget (CB) a étudié  la FAD transmise par N+2. Elle n''a pas les crédits disponibles pour finaliser cette FAD. Elle rejette la demande.'),

  ('FAD_TRANSMISE_CB_DS', 'FAD transmise par CB à N+3', 'CB', 'DS', 'DEM/RC/CDS', 'DS', 'D030',
   'La cellule budget (CB) a étudié la FAD transmise par N+2. La FAD est compléte et conforme sur le plan bugétaire et comptable. Elle transmet la FAD à N+3'),

  ('FAD_VALIDEE_DS', 'FAD validée par N+3', 'DS', null, 'DEM/RC/CDS/CB', 'DS', 'E010',
   'Le N+3 a étudié la FAD transmise par la cellule budget(CB). La FAD est oppportune, compléte et conforme.'),

  ('FAD_VALIDEE_DS_SEUIL', 'FAD validée automatiquement par N+3', 'DS', 'CB', 'DEM/RC/CDS', 'CB', 'E011',
   'Si le montant de la FAD est inférieur au seuil de délagation. La FAD  jugée par N+3 comme oppportune, compléte et conforme. Elle est validée et transmise  automatiquement à la cellule budget(CB).'),

  ('FAD_A_COMPLETER_CB', 'FAD à compléter par le CB', 'DS', 'CB', 'DEM/RC/CDS', 'CB', 'E020',
   'Le N+3 a étudier la FAD transmise par la CB.  La FAD nécessite des compléments d''information sur la nature de l''achat ou sur les aspects budgétaires et comptables. (Porcédure d''achat, Opérations/fonctionnement, Nature des travaux, CUG...)'),

  ('FAD_REJETEE_DS', 'FAD rejetée par N+3', 'DS', null, 'DEM/RC/CDS/CB', 'DS', 'E021',
   'Le N+3 a étudié la FAD. il conteste l''opportunité de l''achat ou les conditions de mise en concurrence. Il rejette la FAD.'),

  ('FAD_ANNULEE_DS', 'FAD annulée par N+3', 'DS', null, 'DEM/RC/CDS/CB', 'DS', 'E022',
   'Le N+3 a étudié la FAD. Le besoin n''est pas ou plus d''actualité. Il annule la FAD.'),

  ('FAD_TRANSMISE_DS_CB', 'FAD transmise par le N+3 à la CB', 'DS', 'CB', 'DEM/RC/CDS', 'CB', 'E030',
   'Le N+3 a étudié la FAD transmise par la cellule budget(CB). La FAD est oppportune, compléte et conforme. Il donne l''ordre de commande à la cellule budget(CB)'),

  ('FAD_A_COMMANDER', 'FAD à commander par CB', 'CB', 'CB', 'DEM/RC/CDS/DS', 'CB', 'F010',
   'La FAD a reçu l''autorisation de commande par le N+3'),

  ('FAD_COMMANDEE', 'FAD commandée par CB', 'CB', null, 'DEM/RC/CDS/DS', null, 'F011',
   'Le bon de commande PGI associée à la FAD est édité.')

on conflict (code_statut) do update set
  libelle      = excluded.libelle,
  emmeteur     = excluded.emmeteur,
  pour_action  = excluded.pour_action,
  diffusion    = excluded.diffusion,
  en_transit   = excluded.en_transit,
  indice       = excluded.indice,
  commentaire  = excluded.commentaire;
