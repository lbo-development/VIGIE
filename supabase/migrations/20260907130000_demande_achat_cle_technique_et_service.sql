-- Décision du 07/09/2026 : numérotation des DA/FAD distincte par service —
-- deux services différents peuvent porter la même référence visible
-- (ex. 2026-01-02-001 pour la Voirie ET pour les Espaces Verts). NUMERO ne
-- peut donc plus être la clé primaire globale de finances.demande_achat
-- (elle l'était jusqu'ici, référencée par 4 tables filles). Voir
-- ForClaude/CDC/mcd-phases-1-2.md et mld-phases-1-2.md §2.4/§4 pour le
-- détail de la décision (option B retenue : clé technique de substitution,
-- plutôt qu'une clé composite (ID_SERVICE, NUMERO) propagée dans les 4
-- tables filles — les tables sont vides en production à ce jour, aucune
-- donnée à migrer).
--
-- ID_SERVICE est dérivé du demandeur cible de la DA (celui pour qui elle
-- est créée — soi-même, ou un tiers choisi par un RC/ADMIN_SERVICE créant
-- pour son compte) via ACTEUR.ID_CELLULE → CELLULE.ID_SERVICE, recopié et
-- figé à la création (protection contre une réorganisation ultérieure du
-- service — tranche au passage le point ouvert noté au MCD depuis le
-- 28/08/2026).

-- 1) DEMANDE_ACHAT gagne ID_SERVICE et une clé technique ID_DEMANDE_ACHAT.
alter table finances.demande_achat
  add column id_service bigint not null references finances.service(id_service);

comment on column finances.demande_achat.id_service is
  'Service du demandeur cible de la DA, figé à la création (ACTEUR.ID_CELLULE → SERVICE) — jamais recalculé si le service est réorganisé ultérieurement.';

alter table finances.demande_achat
  add column id_demande_achat bigint generated always as identity;

comment on column finances.demande_achat.id_demande_achat is
  'Clé technique de substitution (décision du 07/09/2026) — remplace NUMERO comme clé primaire, NUMERO n''étant unique que par service, pas globalement. Référencée par certificat_service_fait, devis_consulte, piece_jointe, historique_statut.';

-- 2) Tables filles : on retire l'ancienne colonne NUMERO — Postgres
-- supprime automatiquement avec elle la FK vers demande_achat(numero) et
-- tout index/contrainte du même tableau qui la référençait (comportement
-- standard DROP COLUMN, pas besoin de CASCADE explicite).
alter table finances.certificat_service_fait drop column numero;
alter table finances.devis_consulte drop column numero;
alter table finances.piece_jointe drop column numero;
alter table finances.historique_statut drop column numero;

-- 3) DEMANDE_ACHAT : bascule de la clé primaire, plus rien ne référence
-- l'ancienne (numero) à ce stade.
alter table finances.demande_achat drop constraint demande_achat_pkey;
alter table finances.demande_achat add constraint demande_achat_pkey primary key (id_demande_achat);

-- Règle métier : NUMERO unique par service, plus globalement.
alter table finances.demande_achat
  add constraint uq_demande_achat_service_numero unique (id_service, numero);

create index ix_da_numero on finances.demande_achat (numero);
create index ix_da_service on finances.demande_achat (id_service);

-- 4) Tables filles : nouvelle colonne de rattachement + FK + reconstruction
-- des index/contraintes qui portaient auparavant sur NUMERO.
alter table finances.certificat_service_fait
  add column id_demande_achat bigint not null references finances.demande_achat(id_demande_achat) on delete restrict;
create index ix_csf_da on finances.certificat_service_fait (id_demande_achat);

alter table finances.devis_consulte
  add column id_demande_achat bigint not null references finances.demande_achat(id_demande_achat) on delete restrict;
create index ix_devis_da on finances.devis_consulte (id_demande_achat);
create unique index uq_devis_retenu_par_da on finances.devis_consulte (id_demande_achat) where retenu = true;
alter table finances.devis_consulte add constraint uq_devis_ordre_par_da unique (id_demande_achat, ordre);
alter table finances.devis_consulte add constraint uq_devis_fournisseur_par_da unique (id_demande_achat, id_fournisseur);

alter table finances.piece_jointe
  add column id_demande_achat bigint references finances.demande_achat(id_demande_achat) on delete restrict;
create index ix_pj_da on finances.piece_jointe (id_demande_achat);
alter table finances.piece_jointe
  add constraint chk_pj_rattachement_exclusif check (num_nonnulls(id_demande_achat, id_devis, numero_csf) = 1);

alter table finances.historique_statut
  add column id_demande_achat bigint not null references finances.demande_achat(id_demande_achat) on delete restrict;
create index ix_hs_da on finances.historique_statut (id_demande_achat);
