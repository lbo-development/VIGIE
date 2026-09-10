-- Alignement de DEVIS_CONSULTE et PIECE_JOINTE sur le pattern déjà établi
-- par MARCHE_PIECE et INVESTISSEMENT_PIECE pour tout fichier déposé :
-- NOM_FICHIER_ORIGINAL + STORAGE_PATH (UNIQUE) + TAILLE_OCTETS (CHECK
-- <= 10 Mo), et TYPE_PIECE contraint par une FK composite vers
-- LIBELLE_REFERENTIEL(DOMAINE, CODE) plutôt qu'un texte libre. Trois trous
-- constatés lors de la relecture du wireframe DemandeAchat (PiecesDevisDA,
-- PiecesComplementairesDA), non liés aux décisions du 07/09/2026 sur le
-- rattachement DA/fournisseur — indépendants, traités ensemble ici.
-- Tables vides en production, aucune donnée à migrer.

-- 1) DEVIS_CONSULTE.FICHIER_PDF → triplet fichier, mêmes nullités que
-- l'existant (FICHIER_PDF était nullable — dépôt différé — les trois
-- nouvelles colonnes le restent, remplies ensemble au dépôt réel).
alter table finances.devis_consulte
  drop column fichier_pdf;

alter table finances.devis_consulte
  add column nom_fichier_original text,
  add column storage_path text unique,
  add column taille_octets integer;

alter table finances.devis_consulte
  add constraint chk_devis_taille_octets
    check (taille_octets is null or (taille_octets > 0 and taille_octets <= 10485760));

comment on column finances.devis_consulte.storage_path is
  'Chemin du fichier dans le Storage Supabase — nullable, devis facultatif ou PDF pas encore déposé.';

-- 2) PIECE_JOINTE.FICHIER / NOM_FICHIER → renommés pour suivre le pattern
-- (STORAGE_PATH, NOM_FICHIER_ORIGINAL), + TAILLE_OCTETS. Une PIECE_JOINTE
-- n'existe que si son fichier existe déjà (contrairement à DEVIS_CONSULTE),
-- donc NOT NULL comme MARCHE_PIECE/INVESTISSEMENT_PIECE.
alter table finances.piece_jointe
  rename column fichier to storage_path;
alter table finances.piece_jointe
  add constraint piece_jointe_storage_path_key unique (storage_path);

alter table finances.piece_jointe
  rename column nom_fichier to nom_fichier_original;
alter table finances.piece_jointe
  alter column nom_fichier_original set not null;

alter table finances.piece_jointe
  add column taille_octets integer not null default 1
    constraint chk_pj_taille_octets check (taille_octets > 0 and taille_octets <= 10485760);
alter table finances.piece_jointe
  alter column taille_octets drop default;

-- 3) PIECE_JOINTE.TYPE_PIECE contraint par LIBELLE_REFERENTIEL, comme
-- MARCHE_PIECE (domaine_type_piece='TYPE_PIECE_MARCHE') et
-- INVESTISSEMENT_PIECE (domaine_type_piece='TYPE_PIECE_INVESTISSEMENT').
-- TYPE_PIECE passe de nullable à NOT NULL (toute pièce a désormais un type
-- réel, y compris FICHE_FAD) — confirmé le 07/09/2026.
alter table finances.piece_jointe
  add column domaine_type_piece text not null default 'TYPE_PIECE_FAD';

alter table finances.piece_jointe
  alter column type_piece set not null;

alter table finances.piece_jointe
  add constraint piece_jointe_type_piece_fkey
    foreign key (domaine_type_piece, type_piece)
    references finances.libelle_referentiel(domaine, code);

-- Valeurs affichées dans PiecesComplementairesDA + le type système déjà
-- documenté (FICHE_FAD, généré à l'autorisation de la FAD).
insert into finances.libelle_referentiel (domaine, code, libelle, ordre, actif) values
  ('TYPE_PIECE_FAD', 'PLAN', 'Plan', 1, true),
  ('TYPE_PIECE_FAD', 'DOC_TECHNIQUE', 'Documentation technique', 2, true),
  ('TYPE_PIECE_FAD', 'PLAQUETTE_COMMERCIALE', 'Plaquette commerciale', 3, true),
  ('TYPE_PIECE_FAD', 'ATTESTATION', 'Attestation', 4, true),
  ('TYPE_PIECE_FAD', 'AGREMENT', 'Agrément', 5, true),
  ('TYPE_PIECE_FAD', 'AUTRE', 'Autre', 6, true),
  ('TYPE_PIECE_FAD', 'FICHE_FAD', 'Fiche récapitulative FAD (générée automatiquement)', 7, true);
