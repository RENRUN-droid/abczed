// Lot consolidé UX/navigation — point 9 : généralise messagesCameFromAccueil/
// sharesCameFromAccueil (deux booléens ad hoc, un par page, qui ne couvraient que le cas
// "Accueil") en un seul mécanisme extensible : { [page]: originPage | null }. Un nouvel écran
// qui aurait un jour besoin du même comportement ("entré en douceur depuis X, donc flèche de
// retour vers X") réutilise ces deux fonctions sans ajouter de booléen dédié. Fonctions pures,
// même principe que navMemory.js — testées indépendamment de React.
export function setSectionOrigin(prev, page, origin) {
  return { ...prev, [page]: origin };
}

export function clearSectionOrigin(prev, page) {
  if (prev[page] == null) return prev;
  return { ...prev, [page]: null };
}
