-- Refonte de la suppléance — décisions du 20/09/2026 (voir ForClaude/CDC/mcd-phases-1-2.md
-- entité SUPPLEANCE, mot-phases-1-2.md « Suppléance » et mld-phases-1-2.md §2.3/§4) :
--
--   1. Retrait logique par le titulaire (colonne date_retrait) : une suppléance retirée cesse
--      immédiatement d'être active, mais la ligne est conservée (HISTORIQUE_STATUT.ID_SUPPLEANCE
--      la référence, FK ON DELETE RESTRICT). Une suppléance n'est jamais modifiable, seulement
--      retirable.
--   2. Fin de suppléance INCLUSIVE : le suppléant garde ses droits toute la journée de DATE_FIN
--      (l'ancienne fonction comparait now() à des dates, donc à minuit : dernier jour exclu).
--      « Aujourd'hui » est calculé à l'heure de Paris (finances.aujourdhui()), pas en UTC.
--   3. Le suppléant n'a plus besoin de détenir un rôle de même type (règle du 14/09/2026
--      supprimée). Il doit être un acteur ACTIF du périmètre du titulaire :
--        RC  → un acteur du service de la cellule du RC
--        CDS → un acteur du service du CDS
--        DS  → un acteur de la direction du DS
--      Le titulaire ne peut pas être son propre suppléant. Vérifié ici en base, pas seulement
--      dans le service Express (le backend utilise service_role, qui contourne la RLS mais pas
--      les triggers).
--   4. Pas de rétroactivité : DATE_DEBUT >= aujourd'hui à la création.
--   5. Une seule suppléance non retirée à la fois par rôle (chevauchement interdit) — la
--      contrainte d'exclusion exclut désormais les lignes retirées, sans quoi un retrait ne
--      libérerait pas la période.
--   6. Piste d'audit finances.suppleance_audit (création, retrait), alimentée par trigger et
--      immuable (aucun UPDATE/DELETE possible, même par service_role).
--   7. Policies SELECT de finances.suppleance et suppleance_audit (titulaire, suppléant pour sa
--      propre ligne, ADMIN_SERVICE/ADMIN_APP en lecture seule). Aucune policy d'écriture : toute
--      écriture passe par le backend Express (service_role) après contrôle « seul le titulaire
--      du rôle », comme finances.demande_achat (20260915110000).
--
-- Idempotente : peut être exécutée que 20260914170000_suppleance_verrou_role_et_chevauchement.sql
-- ait été appliquée ou non (au 20/09/2026, la contrainte excl_suppleance_role_periode et le
-- trigger d'éligibilité de cette migration ne sont PAS présents en base). Les deux sont
-- remplacés ici ; ne pas exécuter l'ancienne après celle-ci.

create extension if not exists btree_gist;

-- 1. Date du jour à l'heure de Paris -----------------------------------------------------------
create or replace function finances.aujourdhui()
returns date
language sql
stable
set search_path = ''
as $$
  select (now() at time zone 'Europe/Paris')::date
$$;

-- 2. Retrait logique + contrainte de chevauchement ----------------------------------------------
alter table finances.suppleance
  add column if not exists date_retrait timestamptz;

comment on column finances.suppleance.date_retrait is
  'Retrait par le titulaire du rôle : non null = suppléance sans effet, conservée pour l''historique (ID_SUPPLEANCE référencé par HISTORIQUE_STATUT).';

alter table finances.suppleance
  drop constraint if exists excl_suppleance_role_periode;

alter table finances.suppleance
  add constraint excl_suppleance_role_periode
  exclude using gist (id_role with =, daterange(date_debut, date_fin, '[]') with &&)
  where (date_retrait is null);

-- 3. Garde-fous d'écriture (remplace check_suppleance_role_eligible) ----------------------------
drop trigger if exists trg_check_suppleance_role_eligible on finances.suppleance;
drop function if exists finances.check_suppleance_role_eligible();

create or replace function finances.check_suppleance()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_role                finances.role_attribution%rowtype;
  v_service_titulaire   bigint;
  v_actif_suppleant     boolean;
  v_service_suppleant   bigint;
  v_direction_suppleant bigint;
begin
  if tg_op = 'UPDATE' then
    -- Une suppléance n'est jamais modifiée : seul le retrait (date_retrait null → non null) est permis.
    if new.id_role is distinct from old.id_role
       or new.matricule_suppleant is distinct from old.matricule_suppleant
       or new.date_debut is distinct from old.date_debut
       or new.date_fin is distinct from old.date_fin then
      raise exception 'Une suppléance ne peut pas être modifiée, seulement retirée';
    end if;
    if old.date_retrait is not null and new.date_retrait is distinct from old.date_retrait then
      raise exception 'Cette suppléance est déjà retirée';
    end if;
    if new.date_retrait is not null and old.date_retrait is null and new.date_fin < finances.aujourdhui() then
      raise exception 'Cette suppléance est terminée, elle ne peut plus être retirée';
    end if;
    return new;
  end if;

  -- INSERT
  if new.date_retrait is not null then
    raise exception 'Une suppléance ne peut pas être créée déjà retirée';
  end if;
  if new.date_debut < finances.aujourdhui() then
    raise exception 'Une suppléance ne peut pas commencer dans le passé (début : %)', new.date_debut;
  end if;

  select * into v_role from finances.role_attribution where id_role = new.id_role;
  if not found then
    raise exception 'Rôle % introuvable', new.id_role;
  end if;
  if v_role.type_role not in ('RC', 'CDS', 'DS') then
    raise exception 'La suppléance n''est possible que pour les rôles RC, CDS ou DS (rôle % non éligible)', v_role.type_role;
  end if;
  if not v_role.actif then
    raise exception 'Ce rôle n''est plus actif';
  end if;
  if new.matricule_suppleant = v_role.matricule then
    raise exception 'Un titulaire ne peut pas être son propre suppléant';
  end if;

  select a.actif, c.id_service, s.id_direction
    into v_actif_suppleant, v_service_suppleant, v_direction_suppleant
  from finances.acteur a
  left join finances.cellule c on c.id_cellule = a.id_cellule
  left join finances.service s on s.id_service = c.id_service
  where a.matricule = new.matricule_suppleant;
  if not found then
    raise exception 'Acteur suppléant introuvable';
  end if;
  if not v_actif_suppleant then
    raise exception 'Le suppléant doit être un acteur actif';
  end if;

  -- Périmètre du suppléant : service (RC, CDS) ou direction (DS) du titulaire. Un acteur sans
  -- rattachement (NULL) échoue fermé : NULL is distinct from <id> est vrai.
  if v_role.type_role = 'RC' then
    select id_service into v_service_titulaire from finances.cellule where id_cellule = v_role.id_cellule;
    if v_service_suppleant is distinct from v_service_titulaire then
      raise exception 'Le suppléant d''un RC doit appartenir au service de sa cellule';
    end if;
  elsif v_role.type_role = 'CDS' then
    if v_service_suppleant is distinct from v_role.id_service then
      raise exception 'Le suppléant d''un CDS doit appartenir à son service';
    end if;
  else
    if v_direction_suppleant is distinct from v_role.id_direction then
      raise exception 'Le suppléant d''un DS doit appartenir à sa direction';
    end if;
  end if;

  return new;
end;
$$;

create trigger trg_check_suppleance
before insert or update on finances.suppleance
for each row
execute function finances.check_suppleance();

-- 4. Piste d'audit ------------------------------------------------------------------------------
create table if not exists finances.suppleance_audit (
  id_audit            bigint generated always as identity primary key,
  id_suppleance       bigint      not null references finances.suppleance(id_suppleance) on delete restrict,
  action              text        not null check (action in ('CREATION', 'RETRAIT')),
  -- Le titulaire du rôle : seul habilité à créer ou retirer (règle applicative, service Express).
  matricule_acteur    text        not null references finances.acteur(matricule),
  id_role             bigint      not null references finances.role_attribution(id_role),
  matricule_suppleant text        not null references finances.acteur(matricule),
  date_debut          date        not null,
  date_fin            date        not null,
  date_heure          timestamptz not null default now()
);

comment on table finances.suppleance_audit is
  'Piste d''audit des suppléances (création, retrait), alimentée par trigger, immuable. matricule_acteur = titulaire du rôle (seul habilité à agir), pas une identité observée : un retrait fait à la main depuis le dashboard serait aussi attribué au titulaire.';

create index if not exists idx_suppleance_audit_role on finances.suppleance_audit (id_role);
create index if not exists idx_suppleance_audit_suppleance on finances.suppleance_audit (id_suppleance);

create or replace function finances.audit_suppleance()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_action text;
  v_titulaire text;
begin
  if tg_op = 'INSERT' then
    v_action := 'CREATION';
  elsif old.date_retrait is null and new.date_retrait is not null then
    v_action := 'RETRAIT';
  else
    return new;
  end if;

  select matricule into v_titulaire from finances.role_attribution where id_role = new.id_role;

  insert into finances.suppleance_audit
    (id_suppleance, action, matricule_acteur, id_role, matricule_suppleant, date_debut, date_fin)
  values
    (new.id_suppleance, v_action, v_titulaire, new.id_role, new.matricule_suppleant, new.date_debut, new.date_fin);

  return new;
end;
$$;

drop trigger if exists trg_audit_suppleance on finances.suppleance;
create trigger trg_audit_suppleance
after insert or update on finances.suppleance
for each row
execute function finances.audit_suppleance();

-- Immuabilité (même principe que 20260914160000 pour historique_statut) : service_role contourne
-- la RLS mais pas les GRANT. Le trigger security definer s'exécute avec les droits du propriétaire
-- de la table, il n'a donc pas besoin d'INSERT pour service_role.
revoke all on finances.suppleance_audit from anon, authenticated, service_role;
grant select on finances.suppleance_audit to authenticated, service_role;

alter table finances.suppleance_audit enable row level security;

-- 5. Fonction d'autorisation « qui voit cette suppléance » ---------------------------------------
-- Lecture seule, security definer (pas de sous-requête RLS récursive — SECURITY.md §2.1) :
--   - ADMIN_APP : tout ;
--   - titulaire du rôle ;
--   - ADMIN_SERVICE : suppléances des rôles RC (cellule du service), CDS (service) et DS (direction
--     du service) qui relèvent de son service.
-- Matricule NULL (compte non rattaché) : chaque prédicat est NULL ou faux → refus.
create or replace function finances.can_view_suppleance(p_id_role bigint)
returns boolean
language sql
security definer
stable
set search_path = ''
as $$
  select exists (
    select 1
    from finances.role_attribution r
    left join finances.cellule c on c.id_cellule = r.id_cellule
    where r.id_role = p_id_role
      and (
        finances.current_user_has_role('ADMIN_APP')
        or r.matricule = public.current_user_matricule()
        or (r.type_role = 'RC'  and finances.current_user_has_role('ADMIN_SERVICE', c.id_service::integer))
        or (r.type_role = 'CDS' and finances.current_user_has_role('ADMIN_SERVICE', r.id_service::integer))
        or (r.type_role = 'DS'  and exists (
              select 1 from finances.service s
              where s.id_direction = r.id_direction
                and finances.current_user_has_role('ADMIN_SERVICE', s.id_service::integer)
            ))
      )
  )
$$;

-- 6. Fonction RLS : fin inclusive + suppléances retirées ignorées ---------------------------------
-- Inchangé pour le reste (voir ForClaude/SECURITY.md §2.1). Le titulaire suppléé garde ici sa
-- lecture (r.matricule = current_user_matricule()) : la mise en lecture seule du titulaire pendant
-- la suppléance (décision du 20/09/2026) est appliquée dans le backend Express, qui porte toutes
-- les écritures métier (service_role) — aucune policy RLS d'écriture sur RC/CDS/DS n'existe.
create or replace function finances.current_user_has_role(p_type_role text, p_perimeter_id integer default null)
returns boolean
language sql
security definer
stable
set search_path = ''
as $$
  select exists (
    select 1 from finances.role_attribution r
    where r.type_role = p_type_role
      and r.actif = true
      and (
        (p_type_role = 'ADMIN_APP' and p_perimeter_id is null)
        or r.id_cellule = p_perimeter_id
        or r.id_service = p_perimeter_id
        or r.id_direction = p_perimeter_id
      )
      and (
        r.matricule = public.current_user_matricule()
        or exists (
          select 1 from finances.suppleance s
          where s.id_role = r.id_role
            and s.matricule_suppleant = public.current_user_matricule()
            and s.date_retrait is null
            and finances.aujourdhui() between s.date_debut and s.date_fin
        )
      )
  )
$$;

-- 7. RLS de finances.suppleance et finances.suppleance_audit --------------------------------------
grant usage on schema finances to authenticated;
grant select on finances.suppleance to authenticated;

alter table finances.suppleance enable row level security;

-- Lecture : le titulaire du rôle, le suppléant (sa propre ligne), ADMIN_SERVICE sur son service,
-- ADMIN_APP partout. Les demandeurs, la CB et les autres rôles ne s'intéressent qu'au rôle, pas à
-- qui l'exerce (décision du 20/09/2026) : aucune visibilité.
drop policy if exists "suppleance_select" on finances.suppleance;
create policy "suppleance_select"
  on finances.suppleance
  for select
  to authenticated
  using (
    finances.can_view_suppleance(id_role)
    or matricule_suppleant = public.current_user_matricule()
  );

-- Aucune policy insert/update/delete pour authenticated (et aucun GRANT d'écriture) : création et
-- retrait passent exclusivement par le backend Express (suppleance.service.ts), qui vérifie que
-- l'appelant est le titulaire du rôle ; le trigger check_suppleance garantit le reste.

drop policy if exists "suppleance_audit_select" on finances.suppleance_audit;
create policy "suppleance_audit_select"
  on finances.suppleance_audit
  for select
  to authenticated
  using (finances.can_view_suppleance(id_role));
