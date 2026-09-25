-- Verrouille l'immuabilité de finances.historique_statut_csf, même principe
-- que le verrou posé sur finances.historique_statut (migration
-- 20260914160000) : la table doit servir de piste d'audit fiable, une ligne
-- une fois écrite ne doit jamais être modifiée.
--
-- RLS ne protège pas ici : service_role (utilisé par tout le backend
-- Express) a rolbypassrls=true et contourne RLS/les policies par nature.
-- Seul un retrait de privilège au niveau GRANT empêche réellement
-- service_role de réécrire l'historique.
--
-- DELETE reste autorisé (même choix que côté FAD, option (b) de
-- 20260914160000) : la suppression physique d'un CSF (R7 — rédacteur depuis
-- CSF_EN_PREPARATION/CSF_A_COMPLETER_RC, RC depuis CSF_A_TRAITER/CSF_A_COMPLETER_RC)
-- cascade applicativement sur PIECE_JOINTE puis HISTORIQUE_STATUT_CSF avant
-- CERTIFICAT_SERVICE_FAIT (voir ForClaude/CDC/mld-phases-1-2.md §4) — un cas
-- légitime et déjà borné, pas une réécriture d'audit.

revoke update on finances.historique_statut_csf from service_role;
