-- finances.marche.planpreventionactif : booléen → texte, défaut NULL.
-- Décision du 29/08/2026 (voir ForClaude/CDC/mld-phases-1-2.md §2.2 et
-- ForClaude/Importation-marches/import-marches-pgi.md §3) : ce champ n'est plus
-- un simple indicateur oui/non, mais une valeur à renseigner manuellement après
-- l'import PGI des marchés (l'import le laisse à NULL). Table préexistante,
-- pas de création ici — uniquement le changement de type.
--
-- ATTENTION — conversion des valeurs existantes : la ligne ci-dessous réinitialise
-- toute valeur déjà présente à NULL (cohérent avec « à renseigner ultérieurement »,
-- un ancien true/false n'a plus de sens une fois le champ texte). Si des valeurs
-- existantes doivent au contraire être conservées (converties en 'true'/'false'
-- texte), remplacer `using null` par `using planpreventionactif::text` avant
-- d'exécuter.

alter table finances.marche
  alter column planpreventionactif drop default,
  alter column planpreventionactif drop not null,
  alter column planpreventionactif type text using null,
  alter column planpreventionactif set default null;
