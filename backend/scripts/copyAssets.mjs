// tsc ne compile que les fichiers .ts — les assets statiques (ex. backend/src/assets/modele-fad.xlsx,
// gabarit de la fiche FAD papier, voir pdf/fadPdfGenerator.ts) doivent être copiés séparément vers
// dist/ après la compilation, sinon ils sont absents en production (constaté au déploiement du
// 19/09/2026 : ENOENT sur dist/assets/modele-fad.xlsx, la fiche FAD renvoyait une erreur 500 générique).
import { cpSync } from 'node:fs'

cpSync('src/assets', 'dist/assets', { recursive: true })
