-- Ajoute le délai annoncé par chaque entreprise consultée (colonne « Délai » du modèle de
-- fiche FAD papier — génération PDF réservée au rôle CB, décision du 19/09/2026). Nullable :
-- aucune règle de complétude à la transmission de la DA (contrairement à MONTANT_DEVIS,
-- indirectement obligatoire via consultationSchema), uniquement contrôlé au moment de la
-- génération du PDF FAD (demandeAchat.service.ts#genererFadPdf), qui exige sa présence sur
-- chaque devis affiché — voir ForClaude/CDC pour le reste du schéma DEVIS_CONSULTE.
alter table finances.devis_consulte
  add column delai_livraison date;

comment on column finances.devis_consulte.delai_livraison is
  'Délai annoncé par l''entreprise consultée (date) — saisi au même écran que MONTANT_DEVIS (FournisseurDaModal), affiché sur la fiche FAD papier générée par la CB.';
