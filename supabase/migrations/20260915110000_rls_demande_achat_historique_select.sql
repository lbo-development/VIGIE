-- RLS finances.demande_achat / finances.historique_statut (lecture) — chantier écran
-- d'accueil/workflow FAD (OP1.2 à OP1.6, voir ForClaude/CDC/mct-phases-1-2.md). Ces deux tables
-- font partie de la liste révoquée à `authenticated` par 20260830100000_harden_finances_grants.sql
-- (RLS activée, sans policy = accès refusé par défaut) : aucun accès direct frontend/Supabase
-- n'est utilisé aujourd'hui (tout passe par le backend Express, service_role) — ces policies sont
-- ajoutées par défense en profondeur, même principe que la policy select scopée de
-- 20260903110000_operation_investissement_import.sql.
--
-- Visibilité voulue : le demandeur propriétaire de la DA/FAD, ou tout rôle dont le périmètre
-- couvre l'objet (RC de la cellule du demandeur, CDS/CB/ADMIN_SERVICE du service, DS de la
-- direction, ADMIN_APP transverse) — la suppléance est déjà couverte nativement par
-- finances.current_user_has_role (voir ForClaude/SECURITY.md §2.1). Factorisée dans une
-- fonction unique réutilisée par les deux policies SELECT, pour ne jamais faire diverger leur
-- définition.
--
-- Aucune policy insert/update/delete pour authenticated sur ces deux tables : toute écriture
-- métier (création, transitions de statut OP1.1 à OP1.6) passe exclusivement par le backend
-- Express (service_role) — les règles de garde (statut actuel, périmètre exact, champs à écrire
-- en plus du statut) sont trop complexes pour être reproduites fidèlement en RLS. Absence de
-- policy = refus, volontaire.

create or replace function finances.can_view_demande_achat(p_id_demande_achat bigint)
returns boolean
language sql
security definer
stable
set search_path = finances, pg_temp
as $$
  select exists (
    select 1
    from finances.demande_achat da
    join finances.service s on s.id_service = da.id_service
    left join finances.acteur a on a.matricule = da.matricule_demandeur
    where da.id_demande_achat = p_id_demande_achat
      and (
        finances.current_user_has_role('ADMIN_APP')
        or da.matricule_demandeur = public.current_user_matricule()
        or finances.current_user_has_role('ADMIN_SERVICE', da.id_service)
        or finances.current_user_has_role('CDS', da.id_service)
        or finances.current_user_has_role('CB', da.id_service)
        or finances.current_user_has_role('DS', s.id_direction)
        or (a.id_cellule is not null and finances.current_user_has_role('RC', a.id_cellule))
      )
  )
$$;

comment on function finances.can_view_demande_achat(bigint) is
  'Visibilité RLS demande_achat/historique_statut — demandeur propriétaire ou rôle dont le périmètre couvre la DA/FAD (RC cellule, CDS/CB/ADMIN_SERVICE service, DS direction, ADMIN_APP transverse). Voir migration 20260915110000.';

grant usage on schema finances to authenticated;
grant select on finances.demande_achat to authenticated;
grant select on finances.historique_statut to authenticated;

alter table finances.demande_achat enable row level security;
alter table finances.historique_statut enable row level security;

drop policy if exists "demande_achat_select_scoped" on finances.demande_achat;
create policy "demande_achat_select_scoped"
  on finances.demande_achat
  for select
  to authenticated
  using (finances.can_view_demande_achat(id_demande_achat));

drop policy if exists "historique_statut_select_scoped" on finances.historique_statut;
create policy "historique_statut_select_scoped"
  on finances.historique_statut
  for select
  to authenticated
  using (finances.can_view_demande_achat(id_demande_achat));
