-- Référentiel générique de listes de valeurs fixes, administrable par ADMIN_APP sans
-- déploiement (décision du 05/09/2026, suite à la duplication du CHECK sur TYPE_PIECE dans
-- marche_piece/investissement_piece + les constantes TS backend/frontend correspondantes).
-- Une ligne = une valeur possible pour un DOMAINE donné (ex. TYPE_PIECE_MARCHE, code CCAP).
-- Domaines couverts par cette migration : TYPE_PIECE_MARCHE, TYPE_PIECE_INVESTISSEMENT —
-- extensible plus tard à d'autres énumérations fixes sans nouvelle table.
--
-- Les tables qui référencent ce code (marche_piece.type_piece, investissement_piece.type_piece)
-- stockent directement le CODE en texte (ex. 'CCAP'), pas un identifiant de substitution — choix
-- explicite de l'utilisateur pour rester lisible en base/export et ne nécessiter aucune migration
-- des données existantes.
--
-- Suppression physique volontairement possible ici (contrairement à direction/service/cellule/
-- cug/site/secteur, qui n'utilisent que ACTIF) : chaque table cliente porte une colonne générée
-- fixant son DOMAINE et une FK composite (domaine, code) vers ce référentiel, SANS clause ON
-- DELETE — Postgres refuse donc nativement de supprimer un code encore utilisé par au moins une
-- pièce (RESTRICT, comportement par défaut). ACTIF reste le moyen normal de retirer un code des
-- formulaires de saisie ; la suppression physique ne s'applique en pratique qu'à un code jamais
-- utilisé (ex. erreur de saisie corrigée immédiatement par l'admin).
create table finances.libelle_referentiel (
  domaine     text not null,
  code        text not null,
  libelle     text not null,
  ordre       integer not null,
  actif       boolean not null default true,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  constraint libelle_referentiel_pkey primary key (domaine, code)
);

comment on table finances.libelle_referentiel is
  'Référentiel générique des listes de valeurs fixes administrables par ADMIN_APP (domaine, code, libellé, ordre d''affichage) — TYPE_PIECE_MARCHE et TYPE_PIECE_INVESTISSEMENT initialement.';

-- Import des codes existants (ordre = ordre de déclaration dans l'ancien CHECK). LIBELLE est
-- initialisé au CODE lui-même (placeholder) : à corriger ensuite via l'écran d'administration
-- ADMIN_APP avec le libellé long réel de chaque pièce.
insert into finances.libelle_referentiel (domaine, code, libelle, ordre) values
  ('TYPE_PIECE_MARCHE', 'CCAP',    'CCAP',    1),
  ('TYPE_PIECE_MARCHE', 'CCTP',    'CCTP',    2),
  ('TYPE_PIECE_MARCHE', 'AE',      'AE',      3),
  ('TYPE_PIECE_MARCHE', 'AVENANT', 'AVENANT', 4),
  ('TYPE_PIECE_MARCHE', 'BPU',     'BPU',     5),
  ('TYPE_PIECE_MARCHE', 'AUTRE',   'AUTRE',   6);

insert into finances.libelle_referentiel (domaine, code, libelle, ordre) values
  ('TYPE_PIECE_INVESTISSEMENT', 'RAPPORT_CODIR',              'RAPPORT_CODIR',              1),
  ('TYPE_PIECE_INVESTISSEMENT', 'RAPPORT_CODIR_VALIDE',        'RAPPORT_CODIR_VALIDE',        2),
  ('TYPE_PIECE_INVESTISSEMENT', 'RAPPORT_CODIR_ANNEXES',       'RAPPORT_CODIR_ANNEXES',       3),
  ('TYPE_PIECE_INVESTISSEMENT', 'RAPPORT_CODIR_PLANS',         'RAPPORT_CODIR_PLANS',         4),
  ('TYPE_PIECE_INVESTISSEMENT', 'DECISION_DIRECTOIRE',         'DECISION_DIRECTOIRE',         5),
  ('TYPE_PIECE_INVESTISSEMENT', 'DECISION_DIRECTOIRE_ANNEXES', 'DECISION_DIRECTOIRE_ANNEXES', 6),
  ('TYPE_PIECE_INVESTISSEMENT', 'DECISION_DIRECTOIRE_PLANS',   'DECISION_DIRECTOIRE_PLANS',   7),
  ('TYPE_PIECE_INVESTISSEMENT', 'RAPPORT_CS',                  'RAPPORT_CS',                  8),
  ('TYPE_PIECE_INVESTISSEMENT', 'RAPPORT_CS_VALIDE',           'RAPPORT_CS_VALIDE',           9),
  ('TYPE_PIECE_INVESTISSEMENT', 'RAPPORT_CS_DOE',              'RAPPORT_CS_DOE',             10),
  ('TYPE_PIECE_INVESTISSEMENT', 'RAPPORT_CS_ANNEXES',          'RAPPORT_CS_ANNEXES',         11),
  ('TYPE_PIECE_INVESTISSEMENT', 'RAPPORT_CS_PLANS',            'RAPPORT_CS_PLANS',           12),
  ('TYPE_PIECE_INVESTISSEMENT', 'DECISION_CS',                 'DECISION_CS',                13),
  ('TYPE_PIECE_INVESTISSEMENT', 'FICHE_OUVERTURE_HO_VALIDEE',  'FICHE_OUVERTURE_HO_VALIDEE', 14),
  ('TYPE_PIECE_INVESTISSEMENT', 'PROJET_TECHNIQUE',            'PROJET_TECHNIQUE',           15),
  ('TYPE_PIECE_INVESTISSEMENT', 'AUTRE',                       'AUTRE',                      16);

grant usage on schema finances to authenticated;
grant select, insert, update, delete on finances.libelle_referentiel to authenticated;

alter table finances.libelle_referentiel enable row level security;

-- Lecture ouverte à tout utilisateur authentifié — nécessaire pour peupler les listes
-- déroulantes de dépôt de pièce (marché/investissement), comme marche_piece_select_authenticated.
create policy "libelle_referentiel_select_authenticated"
  on finances.libelle_referentiel
  for select
  to authenticated
  using (public.current_user_matricule() is not null);

-- Écriture (création/modification/suppression) réservée ADMIN_APP — référentiel transverse à
-- toute l'application, pas de scoping par service (contrairement à cug/ADMIN_SERVICE).
create policy "libelle_referentiel_insert_admin_app"
  on finances.libelle_referentiel
  for insert
  to authenticated
  with check (finances.current_user_has_role('ADMIN_APP'));

create policy "libelle_referentiel_update_admin_app"
  on finances.libelle_referentiel
  for update
  to authenticated
  using (finances.current_user_has_role('ADMIN_APP'))
  with check (finances.current_user_has_role('ADMIN_APP'));

-- Suppression restreinte à ADMIN_APP ; bloquée nativement par la FK (domaine, code) des tables
-- clientes tant qu'au moins une pièce utilise le code (voir commentaire de tête de fichier).
create policy "libelle_referentiel_delete_admin_app"
  on finances.libelle_referentiel
  for delete
  to authenticated
  using (finances.current_user_has_role('ADMIN_APP'));

create trigger libelle_referentiel_set_updated_at
  before update on finances.libelle_referentiel
  for each row execute function finances.set_updated_at();

-- marche_piece : remplacement du CHECK figé par une FK composite vers le référentiel. La colonne
-- générée fixe le domaine à interroger, seule façon d'exprimer une FK vers une table générique
-- (domaine, code) depuis une colonne qui ne porte que le code.
alter table finances.marche_piece
  add column domaine_type_piece text generated always as ('TYPE_PIECE_MARCHE') stored;

alter table finances.marche_piece
  drop constraint marche_piece_type_piece_check;

alter table finances.marche_piece
  add constraint marche_piece_type_piece_fkey
  foreign key (domaine_type_piece, type_piece)
  references finances.libelle_referentiel (domaine, code);

-- investissement_piece : même principe, domaine TYPE_PIECE_INVESTISSEMENT.
alter table finances.investissement_piece
  add column domaine_type_piece text generated always as ('TYPE_PIECE_INVESTISSEMENT') stored;

alter table finances.investissement_piece
  drop constraint investissement_piece_type_piece_check;

alter table finances.investissement_piece
  add constraint investissement_piece_type_piece_fkey
  foreign key (domaine_type_piece, type_piece)
  references finances.libelle_referentiel (domaine, code);
