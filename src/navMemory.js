// Mémoire de navigation par page (delta §2.2/§14/§26) : deux fonctions pures et testables
// indépendamment de React, utilisées par App.jsx comme des mutateurs d'état immuables
// (setNavMemory(captureNavState(prev, page, scrollY, focusId))) — pas de logique dupliquée
// entre le code de production et scripts/test-nav-memory.mjs.
//
// Le principe : quand une page (Accueil/Agenda/Messages/Partages/La Bande) est quittée pour
// ouvrir une fiche événement ou une fiche membre, on retient sa position de défilement et
// l'identifiant DOM de l'élément qui a déclenché l'ouverture, pour tout restaurer au retour
// (brief §2.2 : "Retour = page d'origine + état logique + position de lecture + focus/élément
// déclencheur" — le filtre/la recherche eux-mêmes sont déjà gérés séparément, dans App.jsx,
// par des états levés qui survivent au démontage des pages).

export function captureNavState(prev, page, scrollY, focusId) {
  return { ...prev, [page]: { scrollY, focusId: focusId || null } };
}

export function clearNavState(prev, page) {
  if (!(page in prev)) return prev;
  const next = { ...prev };
  delete next[page];
  return next;
}
