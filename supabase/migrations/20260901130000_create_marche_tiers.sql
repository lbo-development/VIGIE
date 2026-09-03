-- Registre "Marchés d'un service tiers" (décision du 01/09/2026) : un marché qui appartient
-- réellement à un AUTRE service du port (qui n'utilise pas forcément VIGIE), que le service
-- courant est autorisé à utiliser et ressaisit donc manuellement pour pouvoir le citer dans une
-- demande d'achat. Volontairement séparé de finances.marche : ni géré ni consommé par ce
-- service (pas de CODE_CUG, pas de suivi ALERTEMT/LASTMTREALISE/LASTMTENGAGE/COMPLETUDE) —
-- simple fiche de référence, sur le modèle de finances.cug dans sa forme, pas de finances.marche.
--
-- Vraie création de table (pas de schéma PGI préexistant à respecter ici, contrairement à
-- cug/fournisseur/marche). Pas de clé naturelle sur NUMMARCHE seul : deux services différents
-- peuvent légitimement enregistrer indépendamment le même numéro tiers (chacun sa propre
-- autorisation d'usage) — unicité seulement par (ID_SERVICE, NUMMARCHE).
create table finances.marche_tiers (
  id_marche_tiers   bigint generated always as identity primary key,
  id_service        bigint not null references finances.service(id_service),
  nummarche         text not null,
  libelle_service   text not null,
  id_fournisseur    bigint not null references finances.fournisseur(id_fournisseur),
  mtmaxi            numeric,
  dtedebut          date,
  dtefinmax         date,
  typeproc          text not null check (typeproc in ('MAPA', 'MARCHE')),
  typedecompoprix   text check (typedecompoprix in ('FORFAIT', 'BPU')),
  agentgestion      text,
  alertedate        integer not null default 120,
  actif             boolean not null default true,
  unique (id_service, nummarche)
);

comment on table finances.marche_tiers is
  'Marchés appartenant à un autre service du port, ressaisis manuellement par le service courant pour être cités dans une demande d''achat — registre de référence, aucun suivi de consommation.';

grant usage on schema finances to authenticated;
grant select, insert, update on finances.marche_tiers to authenticated;

alter table finances.marche_tiers enable row level security;

-- Lecture ouverte à tout utilisateur rattaché à un ACTEUR (décision du 01/09/2026 : ces
-- marchés servent à tout agent créant une demande d'achat, pas seulement aux admins) — le
-- scoping fin par service est appliqué côté Express (marcheTiers.service.ts#listMarcheTiers),
-- pas ici, comme partout ailleurs dans ce backend.
create policy "marche_tiers_select_authenticated"
  on finances.marche_tiers
  for select
  to authenticated
  using (public.current_user_matricule() is not null);

-- Écriture réservée ADMIN_APP/ADMIN_SERVICE/CB — traduction RLS de
-- assertManagesServiceOrHasRoleCb (authorization.service.ts), première policy de ce projet à
-- combiner ces trois rôles (les policies CUG/SITE/SECTEUR existantes n'en connaissent que deux).
create policy "marche_tiers_insert_admin"
  on finances.marche_tiers
  for insert
  to authenticated
  with check (
    finances.current_user_has_role('ADMIN_APP')
    or finances.current_user_has_role('ADMIN_SERVICE')
    or finances.current_user_has_role('CB')
  );

create policy "marche_tiers_update_admin"
  on finances.marche_tiers
  for update
  to authenticated
  using (
    finances.current_user_has_role('ADMIN_APP')
    or finances.current_user_has_role('ADMIN_SERVICE')
    or finances.current_user_has_role('CB')
  )
  with check (
    finances.current_user_has_role('ADMIN_APP')
    or finances.current_user_has_role('ADMIN_SERVICE')
    or finances.current_user_has_role('CB')
  );
-- Pas de policy DELETE : pas de suppression physique (ACTIF sert d'archivage).
