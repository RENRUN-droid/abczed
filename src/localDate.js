// Bug corrigé (contre-vérification indépendante du ZIP V7, spécifique à La Réunion) :
// `new Date().toISOString().slice(0, 10)` retourne la date calendaire UTC, pas la date locale.
// À La Réunion (UTC+4), entre 00h00 et 03h59 heure locale, l'heure UTC correspondante est
// encore la VEILLE — ex. 14/09/2026 00:30 (heure de La Réunion) correspond à 13/09/2026 20:30
// UTC, donc `.toISOString()` renvoyait "2026-09-13" au lieu de "2026-09-14". Cela pouvait
// fausser le libellé "Aujourd'hui/Hier" des séparateurs de messages, la date attribuée à un
// nouveau message/partage, et la recherche par date ("aujourd'hui"/"hier").
//
// `localIso` utilise les accesseurs LOCAUX (getFullYear/getMonth/getDate — qui lisent la
// date/heure dans le fuseau du navigateur de l'utilisateur, jamais en UTC) pour que la date
// calendaire calculée corresponde toujours à ce que l'utilisateur voit sur son horloge, quel
// que soit son fuseau. Point d'entrée UNIQUE pour ce calcul — remplace tous les appels
// `new Date().toISOString().slice(0, 10)` du projet (data.js, App.jsx, dateSearch.js,
// Messages.jsx) pour qu'un futur correctif se fasse à un seul endroit.
export function localIso(date = new Date()) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}
