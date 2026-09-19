/// <reference types="vitest/config" />
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    // IPv4 explicite : sans ça, Vite/Node se lient parfois uniquement sur le
    // loopback IPv6 (::1) selon la résolution DNS locale, alors que le fichier
    // hosts Windows mappe les hostnames de recette sur 127.0.0.1 (IPv4) —
    // provoque ERR_CONNECTION_REFUSED sur ces hostnames sans ce réglage.
    host: '127.0.0.1',
    // Autorise l'accès au serveur de dev via des hostnames locaux additionnels
    // (fichier hosts Windows) — nécessaire pour ouvrir plusieurs sessions
    // Supabase Auth en parallèle en local, une par origine (localStorage est
    // partagé par origine, donc par hostname). Étendre cette liste si
    // besoin en phase de recette ; ne concerne que le dev local (ce fichier
    // n'affecte pas le build de prod).
    allowedHosts: ['localhost', '.vigie.local'],
  },
  test: {
    environment: 'jsdom',
    setupFiles: './src/test/setup.ts',
  },
})
