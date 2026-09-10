-- Bucket Storage pour les fichiers de finances.devis_consulte (écran
-- PiecesDevisDA, décision du 09/09/2026) — même principe que marche-pieces/
-- investissement-pieces (20260902120000/20260904130000) : bucket privé, PDF
-- uniquement, 10 Mo max. Contrairement à ces deux tables, DEVIS_CONSULTE
-- porte directement le triplet fichier sur la ligne (pas de table enfant à
-- créer, elle existe déjà — voir 20260907150000_devis_piece_jointe_pattern_
-- fichier.sql) : un devis, c'est un fichier attaché à une ligne existante,
-- remplacé en place au dépôt suivant (jamais une liste où on ajoute des
-- entrées).
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('devis-consulte-pieces', 'devis-consulte-pieces', false, 10485760, array['application/pdf'])
on conflict (id) do nothing;

-- Policies sur le bucket, filet de sécurité si le JWT d'un utilisateur appelait
-- directement l'API Storage — le backend utilise service_role et les
-- contourne de toute façon (le vrai périmètre est appliqué côté Express,
-- demandeAchat.service.ts).
create policy "devis_consulte_pieces_bucket_select_authenticated"
  on storage.objects
  for select
  to authenticated
  using (bucket_id = 'devis-consulte-pieces');

create policy "devis_consulte_pieces_bucket_insert_authenticated"
  on storage.objects
  for insert
  to authenticated
  with check (bucket_id = 'devis-consulte-pieces');

create policy "devis_consulte_pieces_bucket_delete_authenticated"
  on storage.objects
  for delete
  to authenticated
  using (bucket_id = 'devis-consulte-pieces');
