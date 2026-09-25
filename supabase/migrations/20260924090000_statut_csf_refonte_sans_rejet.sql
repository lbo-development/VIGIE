-- Refonte du circuit CSF (24/09/2026, demande client) : plus aucun rejet ni
-- annulation — seulement transmission, demande de complément (toujours non
-- terminale) et suppression physique. Voir ForClaude/CDC/mcd-phases-1-2.md
-- §3-§6 (Historique 24/09/2026) et mld-phases-1-2.md §3.
--
-- finances.statut_csf était déjà semée le 24/08/2026 avec les 6 valeurs D9
-- (CSF_A_TRAITER, CSF_REJETE_RC, CSF_TRANSMIS_BUDGET, CSF_VALIDE_BUDGET,
-- CSF_REJETE_BUDGET, CSF_LIQUIDE), jamais exploitées par le code applicatif
-- (module CSF non implémenté jusqu'à ce chantier). Vérifié en lecture seule
-- (résultat collé par l'utilisateur, connexion directe impossible depuis cet
-- environnement) : finances.certificat_service_fait et
-- finances.historique_statut_csf sont vides (0 ligne) — aucune ligne ne
-- référence donc encore ces 6 codes, un DELETE + INSERT complet est sans
-- risque de violation de FK.
--
-- Remplace CSF_REJETE_RC/CSF_REJETE_BUDGET (dont le nom suggérait à tort un
-- caractère terminal) par CSF_A_COMPLETER_RC/CSF_A_COMPLETER_BUDGET, et
-- ajoute CSF_EN_PREPARATION (brouillon avant transmission, symétrique de
-- DA_EN_PREPARATION — même contrainte d'upload Storage non transactionnel).

delete from finances.statut_csf;

insert into finances.statut_csf (code_statut_csf, libelle, commentaire) values
  ('CSF_EN_PREPARATION', 'CSF en préparation',
   'Brouillon composé par le rédacteur (demandeur initial ou RC) — dépôt du justificatif, saisie du montant certifié, avant transmission au RC.'),
  ('CSF_A_TRAITER', 'CSF à traiter par le RC',
   'Transmis par le rédacteur — transmission initiale ou resoumission après un complément demandé (même code réutilisé dans les deux cas).'),
  ('CSF_A_COMPLETER_RC', 'CSF à compléter — complément demandé par le RC',
   'Non terminal : reprise par le rédacteur, qui peut aussi supprimer physiquement le CSF à ce stade. Retransmission → repasse CSF_A_TRAITER.'),
  ('CSF_TRANSMIS_BUDGET', 'CSF transmis au contrôle budgétaire',
   'Transmis par le RC — transmission initiale ou retransmission après un complément demandé par la CB (même code réutilisé dans les deux cas).'),
  ('CSF_A_COMPLETER_BUDGET', 'CSF à compléter — complément demandé par la CB',
   'Non terminal : reprise par le RC (jamais le rédacteur directement). Retransmission → repasse CSF_TRANSMIS_BUDGET. Aucune suppression possible à ce palier.'),
  ('CSF_VALIDE_BUDGET', 'CSF validé par le contrôle budgétaire',
   'Déclenche le paiement dans le PGI (message sortant). Alerte non bloquante si le cumul des CSF validés dépasse MONTANT_COMMANDE de la FAD.'),
  ('CSF_LIQUIDE', 'CSF liquidé',
   'Terminal — positionné manuellement par la CB après constat de la liquidation de la facture dans le PGI. Verrouille définitivement le CSF.');

comment on table finances.statut_csf is
  'Référentiel des statuts du circuit CSF (Phase 2) — 7 valeurs depuis la refonte du 24/09/2026, aucun rejet ni annulation (à la différence de finances.statut, circuit DA/FAD). Voir ForClaude/CDC/mcd-phases-1-2.md §3.';
