// Helper de normalisation partagé — extrait pour éviter cinq algorithmes de recherche
// divergents (brief §3). agendaSearch.js réexporte `normalize` depuis ici pour rester
// l'unique module que scripts/test-agenda-search.mjs importe (aucun test existant cassé).
//
// Normalisation minimale commune, appliquée partout où une recherche existe :
// - casse ;
// - accents (NFD + suppression des diacritiques) ;
// - apostrophe droite ' et apostrophe typographique ’ ‘ ` ´ ramenées à '.
export function normalize(s) {
  return (s || '')
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/[’‘`´]/g, "'")
    .toLowerCase();
}

// Vrai si `haystack` contient `query` une fois les deux normalisés. Chaîne vide -> toujours
// vrai (comportement "pas de filtre"), cohérent avec computeFilteredEvents.
export function textMatches(haystack, query) {
  const q = normalize((query || '').trim());
  if (!q) return true;
  return normalize(haystack).includes(q);
}

// Vrai si au moins un des champs fournis contient la requête normalisée. Évite de répéter
// normalize(query) à chaque champ testé dans chaque écran (Messages, Partages, La Bande).
export function anyFieldMatches(fields, query) {
  const q = normalize((query || '').trim());
  if (!q) return true;
  return fields.some((f) => normalize(f || '').includes(q));
}
