-- Pièces documentaires d'un marché (CCAP, CCTP, AE, AVENANT, BPU, AUTRE), rattachées à leur
-- numéro d'avenant — utile plus tard à la création d'une demande d'achat. Table neuve,
-- indépendante de finances.piece_jointe (celle-ci reste exclusivement polymorphe
-- DEMANDE_ACHAT/CERTIFICAT_SERVICE_FAIT, cf. ForClaude/CDC/mld-phases-1-2.md §2.4/§4 — un
-- rattachement MARCHE romprait son CHECK déjà figé au CDC).
--
-- Portée : finances.marche (service, clé naturelle NUMMARCHE) ou finances.marche_tiers (tiers,
-- clé technique ID_MARCHE_TIERS, NUMMARCHE non unique globalement côté tiers) — TYPE_MARCHE
-- discrimine laquelle des deux références (NUMMARCHE / ID_MARCHE_TIERS) est renseignée,
-- exactement une des deux (CHECK ci-dessous), décision explicite de l'utilisateur (une seule
-- table plutôt que deux, 02/09/2026).
create table finances.marche_piece (
  id_marche_piece   bigint generated always as identity primary key,
  type_marche       text not null check (type_marche in ('SERVICE', 'TIERS')),
  nummarche         text references finances.marche(nummarche),
  id_marche_tiers   bigint references finances.marche_tiers(id_marche_tiers),
  check (
    (type_marche = 'SERVICE' and nummarche is not null and id_marche_tiers is null)
    or (type_marche = 'TIERS' and id_marche_tiers is not null and nummarche is null)
  ),
  type_piece        text not null check (type_piece in ('CCAP', 'CCTP', 'AE', 'AVENANT', 'BPU', 'AUTRE')),
  -- Saisi manuellement au dépôt, modifiable ensuite indépendamment du fichier (décision du
  -- 02/09/2026) — pas de contrainte d'unicité (type_piece, numero_avenant) : plusieurs pièces
  -- peuvent légitimement partager le même couple (ex. AE corrigé après coup, conservé à côté du
  -- premier).
  numero_avenant    integer not null check (numero_avenant >= 0),
  -- Jamais utilisé comme nom de stockage (SECURITY.md §10) — conservé uniquement pour
  -- affichage/téléchargement.
  nom_fichier_original text not null,
  -- Chemin dans le bucket marche-pieces, nom neutre généré côté serveur
  -- (service/<nummarche>/<uuid>.pdf ou tiers/<id_marche_tiers>/<uuid>.pdf).
  storage_path      text not null unique,
  taille_octets     integer not null check (taille_octets > 0 and taille_octets <= 10485760),
  matricule_depot   text not null references finances.acteur(matricule),
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);

comment on table finances.marche_piece is
  'Pièces documentaires (CCAP/CCTP/AE/AVENANT/BPU/AUTRE) d''un marché service ou tiers, rattachées à un numéro d''avenant — fichier stocké dans le bucket Supabase Storage marche-pieces.';

grant select, insert, update, delete on finances.marche_piece to authenticated;

alter table finances.marche_piece enable row level security;

-- Lecture ouverte à tout utilisateur rattaché à un ACTEUR — le scoping fin par service (même
-- périmètre que la lecture du marché lui-même) est appliqué côté Express
-- (marchePiece.service.ts#listPieces), pas ici, comme partout ailleurs dans ce backend.
create policy "marche_piece_select_authenticated"
  on finances.marche_piece
  for select
  to authenticated
  using (public.current_user_matricule() is not null);

-- Écriture (dépôt/modification métadonnées/suppression) réservée ADMIN_APP/ADMIN_SERVICE/CB —
-- traduction RLS de assertManagesServiceOrHasRoleCb (authorization.service.ts), même triplet que
-- finances.marche_tiers.
create policy "marche_piece_insert_admin"
  on finances.marche_piece
  for insert
  to authenticated
  with check (
    finances.current_user_has_role('ADMIN_APP')
    or finances.current_user_has_role('ADMIN_SERVICE')
    or finances.current_user_has_role('CB')
  );

create policy "marche_piece_update_admin"
  on finances.marche_piece
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

-- Suppression physique (décision du 02/09/2026 : pas de trace résiduelle après suppression,
-- contrairement à marche_tiers où ACTIF sert d'archivage — une pièce supprimée n'a pas de sens à
-- conserver).
create policy "marche_piece_delete_admin"
  on finances.marche_piece
  for delete
  to authenticated
  using (
    finances.current_user_has_role('ADMIN_APP')
    or finances.current_user_has_role('ADMIN_SERVICE')
    or finances.current_user_has_role('CB')
  );

-- finances.set_updated_at() existe déjà (voir 20260901140000_marche_tiers_add_timestamps.sql),
-- réutilisée telle quelle.
create trigger marche_piece_set_updated_at
  before update on finances.marche_piece
  for each row execute function finances.set_updated_at();

-- Bucket dédié, privé (pas d'accès public direct) — PDF uniquement, 10 Mo max en plus du plafond
-- du plan Supabase lui-même (SECURITY.md §10 : valider MIME réel et taille avant tout
-- traitement, appliqué aussi côté Express dans marchePiece.service.ts).
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('marche-pieces', 'marche-pieces', false, 10485760, array['application/pdf'])
on conflict (id) do nothing;

-- Policies sur le bucket, au même titre que sur la table (SECURITY.md §10). Filet de sécurité
-- pour un appel direct via l'API Storage avec le JWT d'un utilisateur : le backend utilise
-- service_role et les contourne de toute façon, le vrai périmètre (service du marché visé) est
-- imposé côté Express, comme pour la table ci-dessus.
create policy "marche_pieces_bucket_select_authenticated"
  on storage.objects
  for select
  to authenticated
  using (bucket_id = 'marche-pieces');

create policy "marche_pieces_bucket_insert_admin"
  on storage.objects
  for insert
  to authenticated
  with check (
    bucket_id = 'marche-pieces'
    and (
      finances.current_user_has_role('ADMIN_APP')
      or finances.current_user_has_role('ADMIN_SERVICE')
      or finances.current_user_has_role('CB')
    )
  );

create policy "marche_pieces_bucket_delete_admin"
  on storage.objects
  for delete
  to authenticated
  using (
    bucket_id = 'marche-pieces'
    and (
      finances.current_user_has_role('ADMIN_APP')
      or finances.current_user_has_role('ADMIN_SERVICE')
      or finances.current_user_has_role('CB')
    )
  );
