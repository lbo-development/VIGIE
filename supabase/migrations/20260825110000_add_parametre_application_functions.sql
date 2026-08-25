-- Fonctions SQL pour finances.parametre_application (voir
-- 20260825100000_create_parametre_application.sql et docs/ARCHITECTURE.md).
--
-- Pas de security definer ici : ces fonctions ne sont appelées que par le
-- backend Express via le client service_role (backend/src/repositories/
-- parametres.repository.ts), qui a déjà accès complet à la table — donc pas
-- besoin d'élever les privilèges. Le frontend ne fait jamais d'appel Supabase
-- direct sur cette ressource (tout passe par l'API backend, voir CLAUDE.md).

-- Valeur effective de p_cle pour un acteur rattaché à p_id_service (portée la
-- plus spécifique gagne : service > direction du service > global). La
-- direction se résout par jointure sur finances.service, jamais par une
-- colonne id_direction dupliquée sur la ligne (cf. CHECK de portée exclusive).
create or replace function finances.parametre_effectif(p_cle text, p_id_service integer default null)
returns jsonb
language sql
stable
set search_path = ''
as $$
  select pa.valeur
  from finances.parametre_application pa
  where pa.cle = p_cle
    and (
      pa.id_service = p_id_service
      or (pa.id_service is null and pa.id_direction = (
        select s.id_direction from finances.service s where s.id_service = p_id_service
      ))
      or (pa.id_direction is null and pa.id_service is null)
    )
  order by
    (pa.id_service is not null) desc,
    (pa.id_direction is not null) desc
  limit 1
$$;

-- Upsert sur la portée mutuellement exclusive (global / direction / service).
-- Une contrainte UNIQUE classique ne peut pas servir de cible ON CONFLICT ici
-- (3 index partiels distincts, cf. migration de création) : la comparaison
-- "IS NOT DISTINCT FROM" gère explicitement le cas où id_direction/id_service
-- valent NULL (portée globale ou direction), qu'un simple "=" ne matcherait pas.
create or replace function finances.upsert_parametre_application(
  p_cle text,
  p_valeur jsonb,
  p_id_direction integer default null,
  p_id_service integer default null,
  p_matricule_maj text default null,
  p_description text default null
)
returns finances.parametre_application
language plpgsql
set search_path = ''
as $$
declare
  v_row finances.parametre_application;
begin
  update finances.parametre_application
  set valeur = p_valeur,
      description = coalesce(p_description, description),
      date_maj = now(),
      matricule_maj = p_matricule_maj
  where cle = p_cle
    and id_direction is not distinct from p_id_direction
    and id_service is not distinct from p_id_service
  returning * into v_row;

  if found then
    return v_row;
  end if;

  insert into finances.parametre_application (cle, valeur, id_direction, id_service, description, matricule_maj)
  values (p_cle, p_valeur, p_id_direction, p_id_service, p_description, p_matricule_maj)
  returning * into v_row;

  return v_row;
end;
$$;

grant execute on function finances.parametre_effectif(text, integer) to service_role;
grant execute on function finances.upsert_parametre_application(text, jsonb, integer, integer, text, text) to service_role;
