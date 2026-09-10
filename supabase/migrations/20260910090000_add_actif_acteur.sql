-- ACTEUR : ajout du flag ACTIF (décision du 10/09/2026, chantier CRUD de
-- gestion des utilisateurs — voir ForClaude/CDC/mcd-phases-1-2.md §1/§7 et
-- mld-phases-1-2.md §2.1) — même principe que DIRECTION/SERVICE/CELLULE/CUG :
-- désactivation par flag, jamais de suppression physique en pratique (sauf
-- cas résiduel d'un acteur sans aucune relation en base, voir
-- acteur.service.ts#deleteActeur).
alter table finances.acteur add column if not exists actif boolean not null default true;

-- Pas de GRANT ni de policy RLS ajoutés ici : finances.acteur n'en a
-- volontairement aucun (audit du 30/08/2026, voir ForClaude/SECURITY.md §2.7)
-- — la table reste inaccessible à anon/authenticated via PostgREST, seul le
-- backend (service_role, qui contourne le RLS) y accède. Le CRUD ajouté au
-- backend ce même jour ne change pas ce modèle.
