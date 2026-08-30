-- Catalogue des paramètres applicatifs connus (métadonnées : libellé,
-- description, valeur par défaut) — une ligne par clé, indépendante de la
-- portée. Jusqu'ici le libellé vivait uniquement en dur dans le registre
-- backend (services/parametres.service.ts) ; décision du 29/08/2026 : il doit
-- être stocké en base. Le schéma de validation (type Zod, bornes) reste en
-- revanche codé en dur (voir docs/ARCHITECTURE.md "Paramétrage applicatif").
--
-- Table séparée de finances.parametre_application plutôt qu'une colonne
-- libelle directement dessus : une même clé a jusqu'à 3 lignes dans
-- parametre_application (global/direction/service) — dupliquer le libellé sur
-- chacune risquerait une divergence entre deux lignes de la même clé.

create table finances.parametre_definition (
  cle           text primary key,
  libelle       text not null,
  description   text,
  valeur_defaut jsonb not null
);

comment on table finances.parametre_definition is
  'Catalogue des paramètres applicatifs connus (libellé, description, valeur par défaut), une ligne par clé. Les valeurs scopées (global/direction/service) vivent dans finances.parametre_application, qui référence cette table par cle.';

insert into finances.parametre_definition (cle, libelle, description, valeur_defaut) values
  ('auth.inactivite_delai_minutes', 'Délai d''inactivité avant déconnexion automatique (minutes)', null, '30'::jsonb);

-- Toute ligne de parametre_application doit désormais correspondre à une clé
-- répertoriée ici (pas de RESTRICT explicite nécessaire : comportement par
-- défaut de la FK, cohérent avec le reste du backend — pas d'ON DELETE
-- CASCADE improvisé).
alter table finances.parametre_application
  add constraint parametre_application_cle_fkey
  foreign key (cle) references finances.parametre_definition (cle);

grant usage on schema finances to authenticated;
grant select, insert, update, delete on finances.parametre_definition to authenticated;

alter table finances.parametre_definition enable row level security;

-- Même modèle que finances.parametre_application (§2.3 SECURITY.md) : lecture
-- ouverte à tout authenticated rattaché à un ACTEUR, écriture réservée ADMIN_APP.
create policy "parametre_definition_select_authenticated"
  on finances.parametre_definition
  for select
  to authenticated
  using (public.current_user_matricule() is not null);

create policy "parametre_definition_insert_admin_app"
  on finances.parametre_definition
  for insert
  to authenticated
  with check (finances.current_user_has_role('ADMIN_APP'));

create policy "parametre_definition_update_admin_app"
  on finances.parametre_definition
  for update
  to authenticated
  using (finances.current_user_has_role('ADMIN_APP'))
  with check (finances.current_user_has_role('ADMIN_APP'));

create policy "parametre_definition_delete_admin_app"
  on finances.parametre_definition
  for delete
  to authenticated
  using (finances.current_user_has_role('ADMIN_APP'));
