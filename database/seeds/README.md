# Seeds

Scripts pour peupler la base avec des données de développement/démo.

## Utilisation

1. Renseigner `backend/.env` (copié depuis `backend/.env.example`) avec tes clés Supabase.
2. Depuis la racine du projet :

```bash
npm run seed
```

Le script `seed.ts` insère la valeur globale par défaut du paramètre applicatif
`auth.inactivite_delai_minutes` (voir `docs/ARCHITECTURE.md`, "Paramétrage applicatif").
Duplique ce fichier pour créer d'autres jeux de données de test (`seed-users.ts`, etc.), et
ajoute un script npm correspondant à la racine si besoin.
