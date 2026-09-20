// Utilitaires partagés pour tout ce qui scrolle/anime après un retour de navigation ou une
// fermeture de modale — 6e/7e passe. Deux problèmes distincts, un seul module :
//
// 1) `prefersReducedMotion()` : brief pt 1, explicite — aucun scroll fluide ni pulsation
//    visuelle ne doit être imposé à un utilisateur qui a demandé moins de mouvement au niveau
//    système. Lu à chaque appel (pas mis en cache) : un utilisateur peut changer ce réglage
//    pendant que l'app est ouverte.
//
// 2) `afterPaint(fn)` : remplace un `setTimeout(fn, 0)` par un double
//    requestAnimationFrame. Hypothèse retenue pour expliquer "le retour atterrit en haut de
//    page au lieu de l'élément précis" observé en usage réel (7e passe) alors que le même
//    scénario passait dans le harnais Playwright : setTimeout(0) peut s'exécuter avant que le
//    navigateur ait fini de peindre la page qui vient de se monter (polices, hauteur réelle
//    du contenu) — un scroll calculé à ce moment-là peut atterrir à une position qui n'est
//    plus la bonne une fois la mise en page stabilisée. Un environnement de test headless,
//    déjà "chaud" (polices en cache, pas de latence réseau), peut ne jamais exposer ce
//    décalage alors qu'un premier chargement réel, si. Double rAF est la technique standard
//    pour garantir qu'un cycle de peinture complet s'est écoulé avant de mesurer/scroller.
export function prefersReducedMotion() {
  return (
    typeof window !== 'undefined'
    && typeof window.matchMedia === 'function'
    && window.matchMedia('(prefers-reduced-motion: reduce)').matches
  );
}

// 3) `supportsHoverPointer()` : brief pts 7-9 — le survol desktop de "À venir" qui met en
//    évidence la date correspondante dans le calendrier ne doit exister que pour un pointeur
//    fin qui survole réellement (souris/trackpad), jamais sur tactile. `(hover: hover) and
//    (pointer: fine)` est la paire de media features standard pour ça — contrairement à une
//    simple largeur d'écran, elle reste vraie sur un usage clavier/souris en fenêtre étroite et
//    fausse sur une tablette tactile large, ce qui correspond à l'intention réelle du brief.
export function supportsHoverPointer() {
  return (
    typeof window !== 'undefined'
    && typeof window.matchMedia === 'function'
    && window.matchMedia('(hover: hover) and (pointer: fine)').matches
  );
}

export function afterPaint(fn) {
  if (typeof requestAnimationFrame !== 'function') {
    fn();
    return () => {};
  }
  let raf2 = null;
  const raf1 = requestAnimationFrame(() => {
    raf2 = requestAnimationFrame(fn);
  });
  return () => {
    cancelAnimationFrame(raf1);
    if (raf2 != null) cancelAnimationFrame(raf2);
  };
}
