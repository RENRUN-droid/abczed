import { useEffect, useRef } from 'react';
import { prefersReducedMotion } from './motionPrefs';

// Mécanique commune à toutes les feuilles modales de l'app (Mon profil, Créer événement,
// Ajouter anniversaire, Ajouter/modifier un partage, sélecteur "Lier à un événement") —
// brief pt 6/45 : Escape ferme, un clic sur le fond hors modale ferme, Tab/Shift+Tab restent
// emprisonnés dans la modale tant qu'elle est ouverte, et le focus (+ un repère visuel bref,
// cohérent avec le reste de l'app) revient sur l'élément qui avait ouvert la modale à la
// fermeture — y compris quand cet élément change à chaque ouverture (le déclencheur réel,
// `document.activeElement` au moment du montage, est mémorisé une seule fois ici plutôt que
// réclamé en prop par chaque appelant : un seul mécanisme générique, pas cinq refs séparées
// à tenir à jour dans App.jsx).
//
// Corrige aussi, en passant, "La Bande → Vous → Mon profil → fermeture" (brief, retour
// d'usage) : cette ouverture ne change jamais `view` (c'est une simple superposition), donc
// La Bande ne se démonte/remonte jamais et `useScrollRestore` ne s'y déclenche pas — le focus
// (et le repère visuel) doivent donc être restitués ICI, à la fermeture de la modale
// elle-même, pas par le mécanisme de retour de page.
//
// `containerRef` : ref posée sur le PANNEAU de la modale (pas le fond semi-transparent) — sert
// au piège de focus. `onClose` : appelé sur Escape ou clic sur le fond.
export function useModalA11y(containerRef, onClose) {
  const triggerRef = useRef(null);

  useEffect(() => {
    triggerRef.current = document.activeElement;

    function focusables() {
      const container = containerRef.current;
      if (!container) return [];
      return Array.from(
        container.querySelectorAll('button, a[href], input, select, textarea, [tabindex]:not([tabindex="-1"])')
      ).filter((el) => !el.disabled && el.getClientRects().length > 0);
    }

    // Focus initial dans la modale — le premier élément focusable (souvent le bouton fermer),
    // pour que le piège de focus ci-dessous ait un point de départ cohérent.
    const first = focusables()[0];
    if (first) first.focus({ preventScroll: true });

    function onKeyDown(e) {
      if (e.key === 'Escape') { e.preventDefault(); onClose(); return; }
      if (e.key !== 'Tab') return;
      const els = focusables();
      if (els.length === 0) return;
      const firstEl = els[0];
      const lastEl = els[els.length - 1];
      if (e.shiftKey && document.activeElement === firstEl) { e.preventDefault(); lastEl.focus(); }
      else if (!e.shiftKey && document.activeElement === lastEl) { e.preventDefault(); firstEl.focus(); }
    }
    document.addEventListener('keydown', onKeyDown);

    return () => {
      document.removeEventListener('keydown', onKeyDown);
      const trigger = triggerRef.current;
      if (trigger && document.contains(trigger)) {
        trigger.focus({ preventScroll: true });
        if (!prefersReducedMotion()) {
          trigger.classList.add('nav-restore-highlight');
          setTimeout(() => trigger.classList.remove('nav-restore-highlight'), 1800);
        }
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Clic sur le fond (backdrop) : à poser sur l'onClick du conteneur plein-écran ; vérifie que
  // la cible du clic EST le fond lui-même (pas un enfant qui aurait laissé l'événement
  // remonter), pour ne pas fermer la modale par un clic à l'intérieur du panneau.
  function onBackdropClick(e) {
    if (e.target === e.currentTarget) onClose();
  }

  return { onBackdropClick };
}
