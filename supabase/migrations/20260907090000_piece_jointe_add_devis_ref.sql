-- Permet de rattacher une pièce jointe à un devis consulté (finances.devis_consulte),
-- en plus des deux rattachements déjà en place (demande d'achat / CSF) — décision
-- du 07/09/2026 : les documents complémentaires (doc techniques, plans) doivent
-- pouvoir être déposés par entreprise consultée (cas HORS_MARCHE, 1 à 5 devis) ou
-- pour le devis BPU du titulaire (cas MARCHE, devis désormais facultatif — 0 ou 1
-- ligne finances.devis_consulte, DEVIS_CONSULTE n'étant plus réservé au
-- HORS_MARCHE). Voir ForClaude/CDC/mcd-phases-1-2.md §1/§2/§8 et
-- ForClaude/CDC/mld-phases-1-2.md §2.4/§4/§7.
--
-- La cardinalité 1 à 5 devis pour le cas HORS_MARCHE reste une règle
-- applicative (non portée par contrainte base, cf. MLD §4) — pas de changement
-- structurel requis côté finances.devis_consulte pour l'ouvrir au cas MARCHE :
-- aucune contrainte existante ne liait déjà devis_consulte à
-- demande_achat.procedure_achat.
alter table finances.piece_jointe
  add column if not exists id_devis bigint references finances.devis_consulte(id_devis) on delete restrict;

comment on column finances.piece_jointe.id_devis is
  'Devis consulté référencé (finances.devis_consulte) — un des trois rattachements possibles avec NUMERO (DA) et NUMERO_CSF (CSF), voir chk_pj_rattachement_exclusif.';

create index if not exists ix_pj_devis on finances.piece_jointe (id_devis);

-- Rattachement exclusif : remplace le CHECK à deux branches (NUMERO / NUMERO_CSF)
-- par un CHECK à trois branches (NUMERO / ID_DEVIS / NUMERO_CSF), exactement une
-- des trois renseignée.
alter table finances.piece_jointe
  drop constraint if exists chk_pj_rattachement_exclusif;

alter table finances.piece_jointe
  add constraint chk_pj_rattachement_exclusif
    check (num_nonnulls(numero, id_devis, numero_csf) = 1);
