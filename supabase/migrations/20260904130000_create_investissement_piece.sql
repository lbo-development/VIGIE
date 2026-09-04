-- Pièces documentaires d'une opération d'investissement — même principe que
-- finances.marche_piece (20260902120000_create_marche_piece.sql), simplifié : une opération
-- d'investissement n'a qu'une seule forme (contrairement à un marché SERVICE/TIERS), donc une
-- seule référence NUMERO_OPERATION, pas de discriminant TYPE_MARCHE. Table neuve, indépendante de
-- finances.piece_jointe (polymorphe DEMANDE_ACHAT/CERTIFICAT_SERVICE_FAIT uniquement, cf.
-- ForClaude/CDC/mld-phases-1-2.md §2.4/§4).
--
-- Nomenclature TYPE_PIECE et NUMERO_REEVALUATION (équivalent du NUMERO_AVENANT d'un marché, mais
-- ici le numéro de la campagne de réévaluation budgétaire de l'opération à laquelle la pièce se
-- rattache) fournis par l'utilisateur le 04/09/2026.
create table finances.investissement_piece (
  id_investissement_piece bigint generated always as identity primary key,
  numero_operation      text not null references finances.operation_investissement(numero_operation),
  -- Stampé depuis le service cible au dépôt, pas dérivé de numero_operation à la lecture — même
  -- choix que finances.marche_piece/marche_tiers (RLS scoping simple et fiable). Sans risque de
  -- divergence : ID_SERVICE de finances.operation_investissement est immuable après création
  -- (jamais modifié par l'import ni par la modale « Modifier », voir investissement.service.ts).
  id_service            bigint not null references finances.service(id_service),
  type_piece            text not null check (type_piece in (
    'RAPPORT_CODIR', 'RAPPORT_CODIR_VALIDE', 'RAPPORT_CODIR_ANNEXES', 'RAPPORT_CODIR_PLANS',
    'DECISION_DIRECTOIRE', 'DECISION_DIRECTOIRE_ANNEXES', 'DECISION_DIRECTOIRE_PLANS',
    'RAPPORT_CS', 'RAPPORT_CS_VALIDE', 'RAPPORT_CS_DOE', 'RAPPORT_CS_ANNEXES', 'RAPPORT_CS_PLANS',
    'DECISION_CS', 'FICHE_OUVERTURE_HO_VALIDEE', 'PROJET_TECHNIQUE', 'AUTRE'
  )),
  -- Saisi manuellement au dépôt, modifiable ensuite indépendamment du fichier — même principe que
  -- marche_piece.numero_avenant (0 = version initiale, pas de contrainte d'unicité avec
  -- type_piece : plusieurs pièces peuvent partager le même couple, ex. rapport corrigé après coup
  -- conservé à côté du premier).
  numero_reevaluation   integer not null check (numero_reevaluation >= 0),
  -- Jamais utilisé comme nom de stockage (SECURITY.md §10) — conservé uniquement pour
  -- affichage/téléchargement.
  nom_fichier_original  text not null,
  -- Chemin dans le bucket investissement-pieces, nom neutre généré côté serveur
  -- (<numero_operation>/<uuid>.pdf).
  storage_path          text not null unique,
  taille_octets         integer not null check (taille_octets > 0 and taille_octets <= 10485760),
  matricule_depot       text not null references finances.acteur(matricule),
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now()
);

comment on table finances.investissement_piece is
  'Pièces documentaires d''une opération d''investissement (rapports CODIR/CS, décisions, fiches d''ouverture, projet technique...), rattachées à un numéro de réévaluation — fichier stocké dans le bucket Supabase Storage investissement-pieces.';

grant select, insert, update, delete on finances.investissement_piece to authenticated;

alter table finances.investissement_piece enable row level security;

-- Lecture scopée service (finances.current_user_id_service()) + ADMIN_APP libre — même patron
-- que operation_investissement_select_scoped (20260903110000_operation_investissement_
-- import.sql), directement (pas de version "select_authenticated" intermédiaire comme
-- marche_piece à sa création, corrigée seulement le 02/09/2026 : ID_SERVICE est de toute façon
-- déjà disponible ici dès la création de la table).
create policy "investissement_piece_select_scoped"
  on finances.investissement_piece
  for select
  to authenticated
  using (
    finances.current_user_has_role('ADMIN_APP')
    or id_service = finances.current_user_id_service()
  );

-- Écriture (dépôt/modification métadonnées/suppression) réservée ADMIN_APP/ADMIN_SERVICE/CB —
-- traduction RLS de assertManagesServiceOrHasRoleCb (authorization.service.ts), même triplet que
-- l'import et la modale « Modifier » de finances.operation_investissement.
create policy "investissement_piece_insert_admin"
  on finances.investissement_piece
  for insert
  to authenticated
  with check (
    finances.current_user_has_role('ADMIN_APP')
    or finances.current_user_has_role('ADMIN_SERVICE')
    or finances.current_user_has_role('CB')
  );

create policy "investissement_piece_update_admin"
  on finances.investissement_piece
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

-- Suppression physique (même choix que marche_piece : pas de trace résiduelle après suppression).
create policy "investissement_piece_delete_admin"
  on finances.investissement_piece
  for delete
  to authenticated
  using (
    finances.current_user_has_role('ADMIN_APP')
    or finances.current_user_has_role('ADMIN_SERVICE')
    or finances.current_user_has_role('CB')
  );

create trigger investissement_piece_set_updated_at
  before update on finances.investissement_piece
  for each row execute function finances.set_updated_at();

-- Bucket dédié, privé (pas d'accès public direct) — PDF uniquement, 10 Mo max en plus du plafond
-- du plan Supabase lui-même (SECURITY.md §10 : valider MIME réel et taille avant tout traitement,
-- à appliquer aussi côté Express dans investissementPiece.service.ts).
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('investissement-pieces', 'investissement-pieces', false, 10485760, array['application/pdf'])
on conflict (id) do nothing;

-- Policies sur le bucket, au même titre que sur la table (SECURITY.md §10). Filet de sécurité
-- pour un appel direct via l'API Storage avec le JWT d'un utilisateur : le backend utilise
-- service_role et les contourne de toute façon, le vrai périmètre (service de l'opération visée)
-- est imposé côté Express, comme pour la table ci-dessus.
create policy "investissement_pieces_bucket_select_authenticated"
  on storage.objects
  for select
  to authenticated
  using (bucket_id = 'investissement-pieces');

create policy "investissement_pieces_bucket_insert_admin"
  on storage.objects
  for insert
  to authenticated
  with check (
    bucket_id = 'investissement-pieces'
    and (
      finances.current_user_has_role('ADMIN_APP')
      or finances.current_user_has_role('ADMIN_SERVICE')
      or finances.current_user_has_role('CB')
    )
  );

create policy "investissement_pieces_bucket_delete_admin"
  on storage.objects
  for delete
  to authenticated
  using (
    bucket_id = 'investissement-pieces'
    and (
      finances.current_user_has_role('ADMIN_APP')
      or finances.current_user_has_role('ADMIN_SERVICE')
      or finances.current_user_has_role('CB')
    )
  );
