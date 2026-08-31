-- Durcissement des GRANT sur finances.* (audit de sécurité du 30/08/2026,
-- voir ForClaude/SECURITY.md §2). Vérifié avant d'écrire cette migration :
-- ni le frontend ni le backend n'appellent jamais Supabase directement pour
-- lire/écrire une table finances.* — le frontend ne fait que de l'auth
-- (`supabase.auth.*`), tout le reste passe par le backend Express
-- (`service_role`, qui contourne RLS et GRANT). `anon` et `authenticated`
-- n'ont donc aucun usage légitime sur ces tables ; la RLS (activée partout,
-- vérifiée) neutralisait déjà l'essentiel, ce durcissement réduit en plus la
-- surface au niveau GRANT lui-même (défense en profondeur : si une policy
-- trop permissive était ajoutée par erreur demain, ou la RLS désactivée par
-- mégarde sur une table, ces GRANT ne redeviendraient pas actifs).

-- anon : aucun usage légitime, sur aucune table de finances.
revoke all on all tables in schema finances from anon;

-- TRUNCATE/REFERENCES/TRIGGER : jamais utilisés via PostgREST (aucun verbe
-- REST n'y correspond) — à révoquer pour authenticated aussi, quelle que
-- soit la présence d'une policy par ailleurs sur la table.
revoke truncate, references, trigger on all tables in schema finances from authenticated;

-- Tables sans aucune policy RLS (accès direct jamais voulu, réservé à
-- service_role uniquement) : authenticated perd aussi SELECT/INSERT/UPDATE/DELETE.
-- fournisseur/contact exclues de cette liste : elles ont désormais leurs
-- policies (migrations du 29/08/2026), traitées comme les tables couvertes.
revoke all on
  finances.acteur,
  finances.certificat_service_fait,
  finances.demande_achat,
  finances.devis_consulte,
  finances.historique_statut,
  finances.historique_statut_csf,
  finances.marche,
  finances.operation_investissement,
  finances.piece_jointe,
  finances.role_attribution,
  finances.statut,
  finances.statut_csf,
  finances.suppleance
from authenticated;

-- Toute future table du schéma finances n'hérite plus automatiquement d'un
-- GRANT large à anon — chaque nouvelle table devra l'accorder explicitement
-- si un jour un usage légitime apparaît (principe du moindre privilège).
alter default privileges in schema finances revoke all on tables from anon;
