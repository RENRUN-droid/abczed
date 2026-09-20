import { useEffect } from 'react';
import { prefersReducedMotion, afterPaint } from './motionPrefs';

// Restaure la position de défilement et le focus clavier au montage d'une page qui a été
// quittée pour ouvrir un détail (delta §2.2/§14/§26). Même schéma que Messages.jsx utilisait
// déjà pour restaurer un lien profond (highlightMessageId) — effet au montage, consommé une
// seule fois — généralisé aux pages qui peuvent perdre leur scroll/focus en ouvrant une fiche
// événement ou une fiche membre : Accueil, Agenda, Messages, Partages, La Bande sont toutes
// démontées/remontées par App.jsx à chaque changement de vue, donc un effet au montage
// ([] en dépendances) s'exécute exactement au bon moment, une fois par retour.
//
// Lot consolidé UX/navigation (point 6) : la recette manuelle a montré que "retrouver la bonne
// page + le bon filtre/scroll" ne suffit pas — sans repère visuel, l'utilisateur ne voit pas
// TOUJOURS que c'est bien l'élément qu'il vient de quitter. `scrollIntoView` + un bref anneau
// visuel (`.nav-restore-highlight`, défini dans App.jsx) rendent la cible identifiable, pas
// seulement techniquement présente dans le viewport. `focus({ preventScroll: true })` évite
// que le focus déclenche un second scroll natif du navigateur qui annulerait le premier.
//
// 7e passe : `setTimeout(0)` remplacé par `afterPaint` (double rAF, src/motionPrefs.js) — voir
// le commentaire de ce module pour l'hypothèse retenue ("retour en haut de page" observé en
// usage réel mais jamais reproduit dans le harnais Playwright, plus rapide/plus chaud qu'un
// premier chargement réel). Respect de `prefers-reduced-motion` (brief pt 1, explicite) :
// scroll instantané au lieu de `smooth`, pas de pulsation visuelle — seul un focus net (déjà
// accessible via `:focus-visible`) signale alors la cible.
//
// `restoreState` : { scrollY, focusId } | null | undefined — vient de App.jsx (navMemory[page]).
// `onConsumed` : appelé une fois la restauration appliquée, pour effacer l'entrée et éviter
// de la ré-appliquer si la page est démontée/remontée pour une autre raison ensuite.
export function useScrollRestore(restoreState, onConsumed) {
  useEffect(() => {
    if (!restoreState) return;
    const reduced = prefersReducedMotion();
    const cancel = afterPaint(() => {
      window.scrollTo(0, restoreState.scrollY || 0);
      const el = restoreState.focusId ? document.getElementById(restoreState.focusId) : null;
      if (el) {
        // scrollIntoView en complément du scrollTo brut ci-dessus : corrige toute dérive
        // (liste légèrement différente) et garantit que l'élément précis est bien visible,
        // pas seulement "à peu près à la bonne hauteur de page".
        el.scrollIntoView({ behavior: reduced ? 'auto' : 'smooth', block: 'center' });
        el.focus({ preventScroll: true });
        if (!reduced) {
          el.classList.add('nav-restore-highlight');
          setTimeout(() => el.classList.remove('nav-restore-highlight'), 1800);
        }
      }
      onConsumed();
    });
    return cancel;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
}
