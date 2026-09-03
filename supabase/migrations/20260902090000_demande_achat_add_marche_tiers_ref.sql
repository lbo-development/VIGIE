-- Permet à une demande d'achat de référencer soit un marché service
-- (finances.marche, déjà en place via NUMMARCHE), soit un marché tiers
-- (finances.marche_tiers) — décision du 02/09/2026 : lors de la création
-- d'une demande d'achat, le demandeur choisit l'un ou l'autre.
--
-- Deux colonnes plutôt qu'une seule "référence polymorphe" : NUMMARCHE (texte,
-- unique globalement) et ID_MARCHE_TIERS (bigint, clé technique de
-- finances.marche_tiers, PAS unique globalement sur NUMMARCHE seul) sont de
-- types et de garanties d'unicité différents — les fusionner ferait perdre une
-- vraie contrainte FK d'un côté ou de l'autre. Le type de marché retenu par une
-- DA se déduit simplement de la colonne renseignée (voir demandeAchat.service.ts
-- à venir), pas besoin d'une colonne discriminante supplémentaire.
alter table finances.demande_achat
  add column if not exists id_marche_tiers bigint references finances.marche_tiers(id_marche_tiers);

comment on column finances.demande_achat.id_marche_tiers is
  'Marché tiers référencé (finances.marche_tiers) — exclusif avec NUMMARCHE, voir demande_achat_marche_exclusif_check.';

-- Exclusion : jamais les deux renseignés en même temps. Les deux peuvent rester
-- NULL tant que la DA n'a pas atteint le stade où le marché est obligatoire —
-- même principe que MONTANT_RETENU/ID_FOURNISSEUR_RETENU sur cette table :
-- nullable en base, obligatoire par règle applicative à un stade donné (pas de
-- CRUD demande_achat dans ce backend pour l'instant, voir
-- demandeAchat.repository.ts).
alter table finances.demande_achat
  add constraint demande_achat_marche_exclusif_check
    check (nummarche is null or id_marche_tiers is null);
