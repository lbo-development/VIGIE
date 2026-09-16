-- Point 7 (suppléance) — deux garanties décidées le 14/09/2026 :
--
-- 1. La suppléance ne s'applique qu'aux rôles RC/CDS/DS (conforme au MCD,
--    ForClaude/CDC/mcd-phases-1-2.md §"Rôles applicatifs" : "relie un ROLE,
--    titulaire absent, RC/CDS/DS"). La CB, collective, n'a pas de titulaire
--    unique à remplacer — en cas de besoin, ADMIN_SERVICE attribue directement
--    un rôle CB temporaire via finances.role_attribution, sans passer par ce
--    dispositif. ADMIN_SERVICE/ADMIN_APP exclus pour la même raison que CB
--    (pas de notion de titulaire unique absent). Un CHECK simple ne peut pas
--    voir le type_role du role_attribution référencé (il ne voit que les
--    colonnes de sa propre ligne) — d'où un trigger.
--
-- 2. Une seule suppléance active à la fois par rôle (MCD : "une suppléance
--    active à la fois") — non garanti jusqu'ici (aucune contrainte
--    n'empêchait deux suppléances aux dates chevauchantes sur le même
--    id_role). Contrainte d'exclusion plutôt qu'une vérification applicative :
--    garantie atomique, insensible aux accès concurrents.

create extension if not exists btree_gist;

create or replace function finances.check_suppleance_role_eligible()
returns trigger
language plpgsql
security definer
set search_path = finances, pg_catalog
as $$
declare
  v_type_role text;
begin
  select type_role into v_type_role from finances.role_attribution where id_role = new.id_role;
  if v_type_role is null then
    raise exception 'Rôle % introuvable', new.id_role;
  end if;
  if v_type_role not in ('RC', 'CDS', 'DS') then
    raise exception 'La suppléance n''est possible que pour les rôles RC, CDS ou DS (rôle % non éligible)', v_type_role;
  end if;
  return new;
end;
$$;

create trigger trg_check_suppleance_role_eligible
before insert or update on finances.suppleance
for each row
execute function finances.check_suppleance_role_eligible();

alter table finances.suppleance
  add constraint excl_suppleance_role_periode
  exclude using gist (id_role with =, daterange(date_debut, date_fin, '[]') with &&);
