# Seeds

Scripts pour peupler la base avec des données de développement/démo.

## Utilisation

1. Renseigner `backend/.env` (copié depuis `backend/.env.example`) avec tes clés Supabase.
2. Depuis la racine du projet :

```bash
npm run seed
```

Le script `seed.ts` insère quelques lignes d'exemple dans la table `items` (voir la
migration d'exemple dans `database/migrations/README.md`). Duplique ce fichier pour créer
d'autres jeux de données de test (`seed-users.ts`, etc.), et ajoute un script npm
correspondant à la racine si besoin.
