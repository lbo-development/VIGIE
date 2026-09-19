-- Signature (image) d'un acteur, déposée une seule fois et réutilisée sur chaque fiche FAD
-- papier générée par la CB (décision du 19/09/2026 — génération PDF réservée au rôle CB,
-- voir demandeAchat.service.ts#genererFadPdf). Dépôt/remplacement réservé à ADMIN_APP
-- (transverse) et ADMIN_SERVICE (scopé à son service) — jamais l'acteur lui-même, jamais CB
-- (assertManagesService, authorization.service.ts — pas assertManagesServiceOrHasRoleCb).
-- Une ligne par acteur (MATRICULE en clé primaire) : un nouveau dépôt remplace le
-- précédent, pas d'historique des anciennes signatures.
create table finances.signature_acteur (
  matricule             text primary key references finances.acteur(matricule),
  -- Chemin neutre côté serveur (jamais le nom fourni par l'utilisateur — SECURITY.md §10).
  chemin_stockage       text not null unique,
  nom_fichier_original  text not null,
  taille_octets         integer not null check (taille_octets > 0 and taille_octets <= 2097152),
  matricule_depose_par  text not null references finances.acteur(matricule),
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now()
);

comment on table finances.signature_acteur is
  'Image de signature d''un acteur (PNG/JPEG), déposée par ADMIN_APP/ADMIN_SERVICE, réutilisée sur chaque fiche FAD papier générée par la CB — fichier stocké dans le bucket Supabase Storage signatures-acteurs.';

grant select, insert, update, delete on finances.signature_acteur to authenticated;

alter table finances.signature_acteur enable row level security;

-- Lecture réservée ADMIN_APP/ADMIN_SERVICE (écran d'administration des signatures) — pas
-- ouverte à tout authenticated comme piece_jointe/marche_piece : une signature manuscrite est
-- plus sensible qu'un document métier partagé. Le flux de génération du PDF FAD (backend,
-- service_role) contourne cette policy de toute façon, comme partout ailleurs dans ce backend
-- (SECURITY.md §2) ; le scoping fin par service reste vérifié côté Express
-- (authorization.service.ts#assertManagesService), cette policy n'est qu'un filet de sécurité.
create policy "signature_acteur_select_admin"
  on finances.signature_acteur
  for select
  to authenticated
  using (
    finances.current_user_has_role('ADMIN_APP')
    or finances.current_user_has_role('ADMIN_SERVICE')
  );

create policy "signature_acteur_insert_admin"
  on finances.signature_acteur
  for insert
  to authenticated
  with check (
    finances.current_user_has_role('ADMIN_APP')
    or finances.current_user_has_role('ADMIN_SERVICE')
  );

create policy "signature_acteur_update_admin"
  on finances.signature_acteur
  for update
  to authenticated
  using (
    finances.current_user_has_role('ADMIN_APP')
    or finances.current_user_has_role('ADMIN_SERVICE')
  )
  with check (
    finances.current_user_has_role('ADMIN_APP')
    or finances.current_user_has_role('ADMIN_SERVICE')
  );

create policy "signature_acteur_delete_admin"
  on finances.signature_acteur
  for delete
  to authenticated
  using (
    finances.current_user_has_role('ADMIN_APP')
    or finances.current_user_has_role('ADMIN_SERVICE')
  );

-- finances.set_updated_at() existe déjà (voir 20260901140000_marche_tiers_add_timestamps.sql).
create trigger signature_acteur_set_updated_at
  before update on finances.signature_acteur
  for each row execute function finances.set_updated_at();

-- Bucket dédié, privé, images uniquement, 2 Mo max (taille cohérente avec une signature
-- scannée, pas un document — SECURITY.md §10 : MIME réel et taille revalidés côté Express
-- dans signatureActeur.service.ts, ce plafond bucket n'est qu'une seconde ligne de défense).
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('signatures-acteurs', 'signatures-acteurs', false, 2097152, array['image/png', 'image/jpeg'])
on conflict (id) do nothing;

create policy "signatures_acteurs_bucket_select_admin"
  on storage.objects
  for select
  to authenticated
  using (
    bucket_id = 'signatures-acteurs'
    and (
      finances.current_user_has_role('ADMIN_APP')
      or finances.current_user_has_role('ADMIN_SERVICE')
    )
  );

create policy "signatures_acteurs_bucket_insert_admin"
  on storage.objects
  for insert
  to authenticated
  with check (
    bucket_id = 'signatures-acteurs'
    and (
      finances.current_user_has_role('ADMIN_APP')
      or finances.current_user_has_role('ADMIN_SERVICE')
    )
  );

create policy "signatures_acteurs_bucket_delete_admin"
  on storage.objects
  for delete
  to authenticated
  using (
    bucket_id = 'signatures-acteurs'
    and (
      finances.current_user_has_role('ADMIN_APP')
      or finances.current_user_has_role('ADMIN_SERVICE')
    )
  );
