-- Décision du 07/09/2026 (correction, plus tard le même jour) : le devis
-- (finances.devis_consulte.fichier_pdf) est une pièce à part, sans rapport
-- avec les pièces complémentaires — le rattachement PIECE_JOINTE.ID_DEVIS
-- introduit par la migration 20260907090000 était une fausse piste. Ce que
-- l'utilisateur doit pouvoir faire : retrouver les devis et les pièces
-- complémentaires d'une DA, et accéder aux pièces jointes par fournisseur
-- de la DA (y compris pour un marché sans aucun devis déposé, où le
-- titulaire est connu indépendamment de l'existence d'un devis).
--
-- ID_DEMANDE_ACHAT reste la clé de rattachement à la DA (déjà en place,
-- migration 20260907130000). ID_FOURNISSEUR remplace ID_DEVIS : FK directe
-- vers FOURNISSEUR (pas via DEVIS_CONSULTE), nullable — renseigné quand la
-- pièce concerne un fournisseur précis (le titulaire en MARCHE, un des
-- candidats en HORS_MARCHE), vide pour une pièce générale de la DA (ex. la
-- fiche récapitulative système). Aucune contrainte ne garantit que ce
-- fournisseur est réellement associé à la DA (candidat consulté ou
-- titulaire du marché) — vérification applicative, comme pour la plupart
-- des règles de ce backend.
alter table finances.piece_jointe
  drop column id_devis;

alter table finances.piece_jointe
  add column id_fournisseur bigint references finances.fournisseur(id_fournisseur);

comment on column finances.piece_jointe.id_fournisseur is
  'Fournisseur concerné par la pièce (titulaire du marché ou candidat consulté) — nullable, une pièce générale de la DA (ex. fiche récapitulative système) n''en a pas. Pas de contrainte base garantissant que ce fournisseur est réellement associé à la DA.';

create index ix_pj_fournisseur on finances.piece_jointe (id_fournisseur);

-- Rattachement exclusif : une pièce est soit liée à une DA (ID_FOURNISSEUR
-- éventuellement renseigné en plus), soit à un CSF (Phase 2) — jamais les
-- deux. ID_FOURNISSEUR n'a de sens que dans le contexte DA.
alter table finances.piece_jointe
  add constraint chk_pj_rattachement_exclusif check (num_nonnulls(id_demande_achat, numero_csf) = 1);

alter table finances.piece_jointe
  add constraint chk_pj_fournisseur_contexte check (id_fournisseur is null or id_demande_achat is not null);
