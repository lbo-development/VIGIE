-- Champs obligatoires du marché tiers (décision du 02/09/2026, à la création comme à la
-- modification) : titulaire (ID_FOURNISSEUR, déjà NOT NULL depuis la création de la table,
-- inchangé ici), libellé (au moins 15 caractères), décomposition du prix, agent gestionnaire,
-- montant maximum et date de fin maximum. Contrôlés d'abord côté service
-- (marcheTiers.service.ts, schémas Zod createMarcheTiersSchema/updateMarcheTiersSchema) ; les
-- contraintes ci-dessous sont le dernier filet de sécurité en base.
--
-- Pas de contrainte CHECK basée sur CURRENT_DATE pour la règle "ACTIF=false si DTEFINMAX est
-- déjà dépassée" (voir marcheTiers.service.ts#isMarcheTiersExpire) : un CHECK Postgres n'est
-- évalué qu'à l'écriture, jamais en continu — une ligne valide au moment de sa création
-- deviendrait silencieusement non conforme le lendemain sans qu'aucune écriture ne le
-- déclenche. Cette règle reste donc uniquement applicative (recalculée à chaque
-- création/modification), jamais une contrainte DB.
alter table finances.marche_tiers
  alter column mtmaxi set not null,
  alter column dtefinmax set not null,
  alter column typedecompoprix set not null,
  alter column agentgestion set not null,
  add constraint marche_tiers_libelle_service_min_length check (char_length(libelle_service) >= 15);
