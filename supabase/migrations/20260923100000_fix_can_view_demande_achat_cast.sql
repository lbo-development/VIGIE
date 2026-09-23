-- Correctif de finances.can_view_demande_achat (créée par la migration
-- 20260915110000_rls_demande_achat_historique_select.sql) : appelait
-- finances.current_user_has_role('ADMIN_SERVICE', da.id_service) — et de même pour
-- id_direction/id_cellule — sans caster ces colonnes bigint vers integer.
--
-- finances.current_user_has_role(p_type_role text, p_perimeter_id integer default null)
-- (définie par 20260920090000_suppleance_refonte_retrait_audit_perimetre.sql, postérieure)
-- attend un integer ; Postgres ne caste jamais implicitement bigint → integer
-- (rétrécissement). Découvert le 23/09/2026 en tentant de rejouer manuellement
-- 20260915110000 dans l'éditeur SQL (jamais appliquée avec succès jusqu'ici — aucune
-- migration de ce dépôt n'a jamais été poussée via `supabase db push`, voir
-- ForClaude/SECURITY.md et l'historique de la conversation) :
-- "ERROR: 42883: function finances.current_user_has_role(unknown, bigint) does not exist".
--
-- Même correctif déjà appliqué ailleurs pour la même raison, voir
-- 20260920090000_suppleance_refonte_retrait_audit_perimetre.sql (c.id_service::integer).

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
        or finances.current_user_has_role('ADMIN_SERVICE', da.id_service::integer)
        or finances.current_user_has_role('CDS', da.id_service::integer)
        or finances.current_user_has_role('CB', da.id_service::integer)
        or finances.current_user_has_role('DS', s.id_direction::integer)
        or (a.id_cellule is not null and finances.current_user_has_role('RC', a.id_cellule::integer))
      )
  )
$$;

comment on function finances.can_view_demande_achat(bigint) is
  'Visibilité RLS demande_achat/historique_statut — demandeur propriétaire ou rôle dont le périmètre couvre la DA/FAD (RC cellule, CDS/CB/ADMIN_SERVICE service, DS direction, ADMIN_APP transverse). Voir migrations 20260915110000 et 20260923100000 (cast bigint -> integer).';
