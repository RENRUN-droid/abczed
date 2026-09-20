// Harnais de test local (Playwright) — livré dans le ZIP (test-harness/ entier, depuis la V7.6 —
// corrigé V7.8, ce fichier affirmait auparavant à tort "PAS livré dans le ZIP", signalé par
// contre-vérification indépendante). Monte App.jsx directement (sans Root.jsx/Login/AuthProvider
// réels) pour vérifier en navigateur réel le comportement de navigation déjà relu dans le code,
// sans dépendre du vrai projet Supabase (aucune donnée réelle, aucun identifiant, rien écrit
// nulle part côté serveur).
import React from 'react';
import ReactDOM from 'react-dom/client';
import '@fontsource-variable/nunito-sans';
import App from '../src/App.jsx';

// Miroir exact de src/main.jsx (item 2, phase 3) — ce harnais est un point d'entrée SÉPARÉ
// (vite.harness.config.js, root: test-harness/), donc n'hérite pas de ce qui est posé dans
// src/main.jsx : sans cette même ligne ici, aucun scénario Playwright ne pourrait vérifier le
// comportement réel de `history.scrollRestoration` en navigateur.
if (typeof window !== 'undefined' && 'scrollRestoration' in window.history) {
  window.history.scrollRestoration = 'manual';
}

// V7.7 (P4) : `role` pilote isAdmin côté App.jsx ('activeCommunity?.role === "admin"') — lu
// UNE FOIS ici au chargement du module, depuis un levier de test posé par recette.mjs AVANT
// navigation (page.addInitScript), puisque ce prop est figé au montage et ne peut pas être
// changé en cours de session comme les drapeaux lus "à chaque appel" de mockAgendaApi.js/
// mockMessagesApi.js. Par défaut 'admin' (le cas le plus permissif) si le levier n'est pas posé
// — un scénario dédié le passe explicitement à autre chose pour vérifier le repli "membre".
function harnessRole() {
  try {
    return (typeof sessionStorage !== 'undefined' && sessionStorage.getItem('__abczed_harness_role__')) || 'admin';
  } catch {
    return 'admin';
  }
}

// V7.11 (P1) — même principe que harnessRole() ci-dessus : lu UNE FOIS ici au chargement du
// module, depuis un levier posé AVANT navigation (page.addInitScript), puisque `activeCommunity`
// est figé au montage. `display_name` alimente l'avatar connecté dynamique
// (src/components/ConnectedAvatar.jsx) exactement comme le ferait `members.display_name` en
// production (AuthProvider.jsx, V7.11) — jamais lu depuis `mockAuth.jsx` (qui n'est PAS ce
// qu'App.jsx utilise pour cette prop, voir son commentaire en tête).
// Repli par défaut délibérément DIFFÉRENT de "Vous" (la valeur utilisée par
// mockMessagesApi.js pour résoudre l'auteur des messages de l'utilisateur courant) — un nom
// bien distinct prouve, sans ambiguïté, que l'avatar affiché est réellement dérivé de cette
// valeur et non une coïncidence avec l'ancien "V" figé en dur qu'il remplace.
// La chaîne vide explicitement posée (pas seulement l'absence du levier) simule "le profil
// n'est pas encore chargé" — sessionStorage.getItem() renvoie `null` quand la clé n'existe pas
// DU TOUT, ce qui est bien distinct d'une clé existante valant '' : seul ce second cas doit
// déclencher le repli neutre dans les scénarios dédiés (voir test-harness/recette-v711.mjs).
function harnessDisplayName() {
  try {
    if (typeof sessionStorage === 'undefined') return 'Amélie Dupont';
    const raw = sessionStorage.getItem('__abczed_harness_display_name__');
    return raw === null ? 'Amélie Dupont' : raw;
  } catch {
    return 'Amélie Dupont';
  }
}

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App
      activeCommunity={{ community_id: 'test-community-1', role: harnessRole(), display_name: harnessDisplayName() }}
      memberships={[]}
    />
  </React.StrictMode>,
);
