-- finances.statut n'a jamais été mis à jour avec les valeurs de la refonte
-- du 06/09/2026 (voir ForClaude/CDC/mld-phases-1-2.md §134) : la table vient
-- du schéma initial (hors migrations) et contenait encore l'ancienne liste
-- de statuts. Conséquence : finances.creer_demande_achat_brouillon() échoue
-- avec "insert or update on table demande_achat violates foreign key
-- constraint demande_achat_code_statut_fkey" — DA_EN_PREPARATION n'existe
-- pas dans finances.statut. `on conflict do nothing` pour rester idempotent
-- quel que soit le contenu déjà présent (anciens codes non supprimés, cette
-- migration ne fait qu'ajouter ce qui manque).
insert into finances.statut (code_statut, libelle) values
  ('DA_EN_PREPARATION',   'En préparation'),
  ('DA_TRANSMISE_RC',     'Transmise au RC'),
  ('DA_A_COMPLETER',      'À compléter'),
  ('DA_VALIDEE_RC',       'Validée par le RC'),
  ('DA_REJETEE_RC',       'Rejetée par le RC'),
  ('DA_ANNULEE_RC',       'Annulée par le RC'),
  ('FAD_TRANSMISE_CDS',   'Transmise au CDS'),
  ('FAD_A_COMPLETER',     'FAD à compléter'),
  ('FAD_VALIDEE_CDS',     'Validée par le CDS'),
  ('FAD_REJETEE_CDS',     'Rejetée par le CDS'),
  ('FAD_ANNULEE_CDS',     'Annulée par le CDS'),
  ('FAD_TRANSMISE_CB',    'Transmise au CB'),
  ('FAD_A_MODIFIER',      'À modifier'),
  ('FAD_VALIDEE_CB',      'Validée par le CB'),
  ('FAD_REJETEE_CB',      'Rejetée par le CB'),
  ('FAD_TRANSMISE_DS',    'Transmise au DS'),
  ('FAD_VALIDEE_DS_SEUIL','Validée par le DS (sous seuil)'),
  ('FAD_VALIDEE_DS',      'Validée par le DS'),
  ('FAD_REJETEE_DS',      'Rejetée par le DS'),
  ('FAD_ANNULEE_DS',      'Annulée par le DS'),
  ('FAD_COMMANDEE',       'Commandée'),
  ('FAD_CLOTUREE',        'Clôturée')
on conflict (code_statut) do nothing;
