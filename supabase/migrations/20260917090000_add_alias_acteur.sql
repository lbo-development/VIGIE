-- ACTEUR : ajout de la colonne ALIAS (décision du 17/09/2026) — dérivée de
-- NOM/PRENOM (initiale(s) du/des prénom(s) + 2 premières lettres du premier
-- mot du NOM, ex. "Jean Marc BRISSON DE LAROCHE" -> "JMBr"), calculée côté
-- backend (acteur.service.ts, à venir), jamais en colonne générée SQL — la
-- résolution des collisions (deux acteurs pouvant produire le même alias)
-- doit pouvoir interroger les autres lignes, ce qu'une colonne générée ne
-- permet pas.
--
-- Nullable et sans contrainte UNIQUE pour l'instant : les acteurs déjà en
-- base n'ont pas encore d'alias (voir database/seeds/backfillAliasActeurs.ts,
-- à lancer une fois cette migration appliquée). Une migration ultérieure
-- ajoutera `not null` + `unique` une fois le rétro-remplissage effectué.
alter table finances.acteur add column if not exists alias text;

-- Pas de GRANT ni de policy RLS ajoutés ici : finances.acteur n'en a
-- volontairement aucun (audit du 30/08/2026, voir ForClaude/SECURITY.md §2.7)
-- — la table reste inaccessible à anon/authenticated via PostgREST, seul le
-- backend (service_role, qui contourne le RLS) y accède.
