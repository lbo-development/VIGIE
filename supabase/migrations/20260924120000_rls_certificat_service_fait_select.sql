-- RLS finances.certificat_service_fait / finances.historique_statut_csf /
-- finances.statut_csf (lecture) — chantier module CSF (voir
-- ForClaude/CDC/mct-phases-1-2.md Processus 2). Les 3 tables font partie de
-- la liste révoquée à `authenticated` par 20260830100000_harden_finances_grants.sql
-- (RLS activée, sans policy = accès refusé par défaut, vérifié en lecture
-- seule : aucune policy existante à ce jour) : aucun accès direct
-- frontend/Supabase n'est utilisé pour ces tables (tout passe par le backend
-- Express, service_role) — ces policies sont ajoutées par défense en
-- profondeur, même principe que 20260915110000 pour demande_achat/historique_statut.
--
-- Visibilité voulue pour certificat_service_fait/historique_statut_csf : le
-- rédacteur (demandeur initial de la FAD, ou RC qui a lui-même élaboré le
-- CSF — R3), le RC de la cellule du demandeur de la FAD, la CB du service de
-- la FAD, ou ADMIN_APP (transverse). Périmètre volontairement plus étroit
-- que can_view_demande_achat (§2.11 SECURITY.md) : le MCD Phase 2 (§3) ne
-- réutilise explicitement que ROLE (RC, CB) pour le circuit CSF — ni CDS, ni
-- DS, ni ADMIN_SERVICE n'y figurent comme acteurs. À corriger si ce
-- périmètre s'avère trop restrictif à l'usage.
--
-- Aucune policy insert/update/delete pour authenticated : toute écriture
-- métier (OP2.1 à OP2.4, y compris l'édition en place du RC et les
-- suppressions physiques R7) passe exclusivement par le backend Express
-- (service_role) — les règles de garde (statut courant, qui peut supprimer
-- depuis quel statut, etc.) sont trop complexes pour être reproduites
-- fidèlement en RLS. Absence de policy = refus, volontaire.

create or replace function finances.can_view_certificat_service_fait(p_id_csf bigint)
returns boolean
language sql
security definer
stable
set search_path = finances, pg_temp
as $$
  select exists (
    select 1
    from finances.certificat_service_fait csf
    join finances.demande_achat da on da.id_demande_achat = csf.id_demande_achat
    left join finances.acteur a on a.matricule = da.matricule_demandeur
    where csf.id_csf = p_id_csf
      and (
        finances.current_user_has_role('ADMIN_APP')
        or csf.matricule_redacteur = public.current_user_matricule()
        or da.matricule_demandeur = public.current_user_matricule()
        or finances.current_user_has_role('CB', da.id_service::integer)
        or (a.id_cellule is not null and finances.current_user_has_role('RC', a.id_cellule::integer))
      )
  )
$$;

comment on function finances.can_view_certificat_service_fait(bigint) is
  'Visibilité RLS certificat_service_fait/historique_statut_csf — rédacteur (matricule_redacteur ou demandeur de la FAD), RC de la cellule du demandeur, CB du service, ADMIN_APP transverse. Voir migration 20260924120000.';

grant usage on schema finances to authenticated;
grant select on finances.certificat_service_fait to authenticated;
grant select on finances.historique_statut_csf to authenticated;
grant select on finances.statut_csf to authenticated;

alter table finances.certificat_service_fait enable row level security;
alter table finances.historique_statut_csf enable row level security;
alter table finances.statut_csf enable row level security;

drop policy if exists "certificat_service_fait_select_scoped" on finances.certificat_service_fait;
create policy "certificat_service_fait_select_scoped"
  on finances.certificat_service_fait
  for select
  to authenticated
  using (finances.can_view_certificat_service_fait(id_csf));

drop policy if exists "historique_statut_csf_select_scoped" on finances.historique_statut_csf;
create policy "historique_statut_csf_select_scoped"
  on finances.historique_statut_csf
  for select
  to authenticated
  using (finances.can_view_certificat_service_fait(id_csf));

-- Référentiel transverse, aucune notion de périmètre — même traitement que
-- finances.statut (§2.11 SECURITY.md).
drop policy if exists "statut_csf_select_authenticated" on finances.statut_csf;
create policy "statut_csf_select_authenticated"
  on finances.statut_csf
  for select
  to authenticated
  using (public.current_user_matricule() is not null);
