-- Ajoute ID_SERVICE directement sur finances.marche_piece (décision du 02/09/2026, en
-- réponse à un audit RLS) : la policy SELECT actuelle (marche_piece_select_authenticated)
-- n'exige que current_user_matricule() IS NOT NULL, sans scoping par service — n'importe
-- quel agent authentifié peut lire, via l'API REST Supabase directe (en contournant
-- Express), les pièces de TOUS les services. Le scoping fin n'existait jusqu'ici que côté
-- Express (marchePiece.service.ts#resolveReadScope).
--
-- Sans risque de dérive malgré la règle générale de ce projet contre la duplication d'un
-- attribut dérivable (cf. finances.parametre_application, id_direction jamais dupliqué
-- depuis id_service) : vérifié dans le code applicatif que le service d'un marché
-- (CODE_CUG/ID_FOURNISSEUR, marche.service.ts#updateMarcheManagedFields, commentaire
-- "jamais NUMMARCHE/le fournisseur/le CUG") et celui d'un marché tiers (ID_SERVICE,
-- marcheTiers.service.ts#updateMarcheTiers, qui impose que le nouveau fournisseur reste du
-- même service que l'existant) sont tous deux IMMUABLES après création. Une colonne
-- ID_SERVICE stampée une seule fois à l'insertion ne peut donc pas diverger de sa source.

alter table finances.marche_piece
  add column if not exists id_service bigint references finances.service(id_service);

-- Backfill défensif (no-op si la table est vide, ce qu'elle devrait être : créée le
-- 02/09/2026, aucun flux de dépôt de pièce déployé avant cette migration).
update finances.marche_piece p
set id_service = coalesce(
  (
    select cug.id_service
    from finances.marche m
    join finances.cug cug on cug.code_cug = m.code_cug
    where m.nummarche = p.nummarche
  ),
  (
    select f.id_service
    from finances.marche m
    join finances.fournisseur f on f.id_fournisseur = m.id_fournisseur
    where m.nummarche = p.nummarche
  ),
  (
    select mt.id_service
    from finances.marche_tiers mt
    where mt.id_marche_tiers = p.id_marche_tiers
  )
)
where p.id_service is null;

alter table finances.marche_piece
  alter column id_service set not null;

-- Résout le service de l'utilisateur courant (ACTEUR.ID_CELLULE -> CELLULE.ID_SERVICE) —
-- même résolution que acteur.repository.ts#findIdServiceByMatricule côté Express,
-- réutilisable par toute future policy RLS scopée par service (pas seulement
-- marche_piece).
create or replace function finances.current_user_id_service()
returns integer
language sql
security definer
stable
set search_path = ''
as $$
  select c.id_service
  from finances.acteur a
  join finances.cellule c on c.id_cellule = a.id_cellule
  where a.matricule = public.current_user_matricule()
$$;

drop policy if exists "marche_piece_select_authenticated" on finances.marche_piece;

create policy "marche_piece_select_scoped"
  on finances.marche_piece
  for select
  to authenticated
  using (
    finances.current_user_has_role('ADMIN_APP')
    or id_service = finances.current_user_id_service()
  );
