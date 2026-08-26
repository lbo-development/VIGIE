import '@testing-library/jest-dom/vitest'
import { afterEach } from 'vitest'
import { cleanup } from '@testing-library/react'

// Sans ceci, les rendus de plusieurs tests s'accumulent dans le même DOM
// (pas de nettoyage implicite : "globals" n'est pas activé dans vite.config.ts) —
// des requêtes par rôle qui devraient être uniques deviennent alors ambiguës
// d'un test à l'autre au sein d'un même fichier.
afterEach(cleanup)
