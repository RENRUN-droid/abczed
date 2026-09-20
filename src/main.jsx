import React from 'react'
import ReactDOM from 'react-dom/client'
// Nunito Sans variable, auto-hébergée : plus chaleureuse et plus ronde qu'Inter sans
// devenir enfantine. Un seul fichier variable couvre tous les niveaux de graisse de l'UI.
// Reste la police du TEXTE COURANT (body/small/tiny, src/theme.js) — inchangée par V7.16.
import '@fontsource-variable/nunito-sans'
// V7.16 — demande explicite de l'utilisateur (recette réelle post-V7.15) : une police pour les
// TITRES/BOUTONS/en-têtes de navigation qui se rapproche du lettrage rond et plein du logo
// (public/abczed-logo-master.png), choisie par l'utilisateur après comparatif visuel direct
// (voir FONT_DISPLAY, src/theme.js) — jamais utilisée pour le texte courant.
import '@fontsource-variable/baloo-2'
import { AuthProvider } from './auth/AuthProvider.jsx'
import Root from './Root.jsx'

// V7.14 (phase 3, item 2) : le navigateur restaure lui-même une position de défilement
// mémorisée (historique natif, `history.scrollRestoration`, défaut 'auto') indépendamment du
// mécanisme applicatif `navMemory`/`useScrollRestore.js` — sur un rechargement (F5) ou un
// retour/avance navigateur, cette restauration NATIVE peut réappliquer un ancien scroll AVANT
// même que React ne monte quoi que ce soit, ce qui entrait en conflit avec l'exigence "un
// rechargement franc doit toujours atterrir en haut de page". Posé UNE SEULE FOIS, au tout
// début, avant tout rendu — `navMemory` (App.jsx, un simple `useState({})` réinitialisé à
// chaque montage) reste la SEULE source de vérité pour restaurer une position, jamais le
// navigateur lui-même.
if (typeof window !== 'undefined' && 'scrollRestoration' in window.history) {
  window.history.scrollRestoration = 'manual';
}

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <AuthProvider>
      <Root />
    </AuthProvider>
  </React.StrictMode>,
)
