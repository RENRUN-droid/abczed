// V7.14 (phase 3, item 11) — validation réelle du champ "Lien" d'AddShareSheet.jsx (avant
// cette passe : aucune validation, un texte vide au clic n'ouvrait qu'un bouton désactivé sans
// jamais expliquer pourquoi). Fonction pure, testable indépendamment de React — même principe
// que src/sharesStorage.js.
//
// "Valide" veut dire ici : une URL ABSOLUE (protocole explicite), http(s) uniquement — jamais
// `javascript:`/`data:`/`file:` (un lien de partage saisi par un membre de la communauté ne
// doit jamais pouvoir devenir un vecteur d'exécution de script au clic d'un autre membre sur
// "Ouvrir"). `new URL(...)` lève une exception pour un texte qui n'est même pas syntaxiquement
// une URL — capturée, jamais laissée remonter jusqu'à l'appelant.
export function isValidAbsoluteUrl(value) {
  const trimmed = (value || '').trim();
  if (!trimmed) return false;
  let parsed;
  try {
    parsed = new URL(trimmed);
  } catch {
    return false;
  }
  return parsed.protocol === 'http:' || parsed.protocol === 'https:';
}
