-- Bucket Storage pour les fichiers de finances.piece_jointe en contexte DA
-- (écran de gestion documentaire unifié dans CreationDA, décision du
-- 09/09/2026 — remplace l'idée initiale de dépôt depuis MarcheDA/
-- FournisseurDA) — même principe que devis-consulte-pieces
-- (20260909100000) : bucket privé, PDF uniquement, 10 Mo max.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('piece-jointe-fad', 'piece-jointe-fad', false, 10485760, array['application/pdf'])
on conflict (id) do nothing;

-- Policies sur le bucket, filet de sécurité si le JWT d'un utilisateur appelait
-- directement l'API Storage — le backend utilise service_role et les
-- contourne de toute façon (le vrai périmètre est appliqué côté Express,
-- demandeAchat.service.ts).
create policy "piece_jointe_fad_bucket_select_authenticated"
  on storage.objects
  for select
  to authenticated
  using (bucket_id = 'piece-jointe-fad');

create policy "piece_jointe_fad_bucket_insert_authenticated"
  on storage.objects
  for insert
  to authenticated
  with check (bucket_id = 'piece-jointe-fad');

create policy "piece_jointe_fad_bucket_delete_authenticated"
  on storage.objects
  for delete
  to authenticated
  using (bucket_id = 'piece-jointe-fad');
