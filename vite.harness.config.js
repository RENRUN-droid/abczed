// Configuration Vite du harnais de test local (Playwright) — fichier séparé de vite.config.js,
// PAS utilisé par `npm run build`/`npm run dev`, PAS livré dans le ZIP de production. Sert
// uniquement à vérifier en navigateur réel le comportement de navigation déjà relu dans le
// code, sans toucher au vrai projet Supabase (auth/AuthProvider.jsx et agendaApi.js sont
// remplacés par des doublures locales via alias — le reste de l'app, y compris App.jsx et
// toutes les pages, tourne tel quel, inchangé).
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  plugins: [react()],
  root: path.resolve(__dirname, 'test-harness'),
  // Le logo V7.13 prélève le mot-symbole dans le master public validé. Le harnais a une
  // racine dédiée, donc on lui indique explicitement le même dossier public que le build réel.
  publicDir: path.resolve(__dirname, 'public'),
  resolve: {
    // Bug de harnais corrigé (7e passe) : un alias sur la chaîne relative EXACTE utilisée par
    // App.jsx (`./auth/AuthProvider`) ne matche QUE les imports écrits avec ce préfixe précis.
    // src/components/MyProfileSheet.jsx importe le même module via `../auth/AuthProvider`
    // (un niveau de dossier plus profond) — chaîne différente, donc jamais interceptée par
    // l'ancien alias : ce composant chargeait le VRAI AuthProvider dans le harnais (qui n'en
    // fournit pas), et `useAuth()` y levait une exception à chaque montage, cassant
    // silencieusement tout scénario "La Bande → Vous → Mon profil" — jamais détecté avant
    // cette passe faute d'avoir déjà exercé ce chemin en Playwright. Un alias en expression
    // régulière prend le relais — mais DOIT matcher la chaîne ENTIÈRE (`^...$`), pas seulement
    // sa fin : `find`/`replacement` sur un alias regex fonctionnent comme `specifier.replace(find,
    // replacement)`, donc un motif qui ne matche qu'un SUFFIXE (ex. `/\/agendaApi$/`) ne
    // remplace que ce suffixe et laisse le préfixe relatif (`.`/`..`) collé devant le chemin
    // absolu de remplacement — un chemin invalide, jamais résolu (repéré en relançant la
    // recette juste après ce correctif : import cassé pour TOUTE la page, pas seulement Mon
    // profil — un bug en aurait remplacé un autre sans ce test immédiat).
    alias: [
      { find: /^\.\.?\/(?:.*\/)?auth\/AuthProvider$/, replacement: path.resolve(__dirname, 'test-harness/mockAuth.jsx') },
      { find: /^\.\.?\/(?:.*\/)?agendaApi$/, replacement: path.resolve(__dirname, 'test-harness/mockAgendaApi.js') },
      // V7.7 : même mécanisme, pour src/messagesApi.js — voir test-harness/mockMessagesApi.js.
      // La chaîne EXACTE importée par App.jsx est `./messagesApi` ; ce motif regex matche aussi
      // toute profondeur relative (`../messagesApi`, etc.), même précaution que les deux alias
      // ci-dessus (voir le commentaire du bug de harnais corrigé, 7e passe).
      { find: /^\.\.?\/(?:.*\/)?messagesApi$/, replacement: path.resolve(__dirname, 'test-harness/mockMessagesApi.js') },
    ],
  },
  server: { port: 5183, strictPort: true },
});
