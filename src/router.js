// P1 (exercice de correction V7.5) : synchronisation minimale URL <-> état de navigation.
//
// Défaut signalé : actualiser le navigateur depuis n'importe quelle page renvoyait
// systématiquement vers Accueil — tout l'état de navigation (`view`, `selectedEventId`, ...)
// vivait uniquement en mémoire React (App.jsx), jamais dans l'URL.
//
// Choix technique (le brief laisse le choix libre) : l'History API native
// (pushState/replaceState + popstate), pas de nouvelle dépendance (aucun routeur n'existait
// dans le projet) — et volontairement pas un routeur générique à arborescence de routes : le
// besoin réel, tel que décrit par le brief, est limité à 5 sections principales et une fiche
// événement identifiée par son id. `member-detail` et `thread` (fil filtré) n'ont pas de
// représentation dédiée dans l'URL — hors de la liste explicite du brief ("une actualisation
// depuis Accueil, Agenda, Messages, Partages ou La Bande doit rouvrir la même section"), donc
// volontairement non couverts pour ne pas élargir le périmètre au-delà de ce qui est demandé.
//
// Ce module est délibérément pur (aucun accès à `window` ici) pour être testable directement en
// Node, comme agendaSearch.js/attendeeNames.js — voir scripts/test-router.mjs. C'est App.jsx qui
// lit/écrit `window.location`/`window.history` et appelle ces fonctions.

const SECTION_PATHS = {
  accueil: '/',
  agenda: '/agenda',
  messages: '/messages',
  partages: '/partages',
  labande: '/labande',
};
const PATH_TO_SECTION = Object.fromEntries(Object.entries(SECTION_PATHS).map(([k, v]) => [v, k]));

// Construit le chemin représentant l'état de navigation actuel.
// - Une des 5 sections ci-dessus -> son chemin fixe.
// - 'event-detail' (avec un `eventId`) -> `/evenement/<id>`, avec `?from=<origine>` quand
//   l'origine est elle-même une des 5 sections connues (sert à restaurer "d'où on vient" après
//   un rechargement ou un aller-retour précédent/suivant du navigateur — jamais pour 'thread'/
//   'member-detail', qui retombent silencieusement sur 'agenda' au moment de la lecture,
//   `stateForPath` ci-dessous).
// - Toute autre vue (pas de représentation dédiée) -> repli sur l'accueil, jamais un chemin vide
//   ou incohérent.
export function pathForState(view, eventId, eventOrigin) {
  if (view === 'event-detail' && eventId) {
    const from = eventOrigin && SECTION_PATHS[eventOrigin] ? `?from=${encodeURIComponent(eventOrigin)}` : '';
    return `/evenement/${encodeURIComponent(eventId)}${from}`;
  }
  return SECTION_PATHS[view] || SECTION_PATHS.accueil;
}

// Interprète une URL (pathname + search, tels que fournis par `window.location`) en état de
// navigation. Retourne soit `{ view: <section> }` soit
// `{ view: 'event-detail', eventId, eventOrigin }` (eventOrigin vaut toujours une des 5
// sections connues, jamais null/undefined — 'agenda' par défaut si absent/invalide, cohérent
// avec le repli demandé par le brief pour un événement introuvable). Un chemin non reconnu
// retombe sur 'accueil' — jamais une page blanche ou une erreur de routage.
export function stateForPath(pathname, search) {
  const m = (pathname || '').match(/^\/evenement\/([^/]+)\/?$/);
  if (m) {
    const eventId = decodeURIComponent(m[1]);
    const params = new URLSearchParams(search || '');
    const from = params.get('from');
    const eventOrigin = from && SECTION_PATHS[from] ? from : 'agenda';
    return { view: 'event-detail', eventId, eventOrigin };
  }
  const section = PATH_TO_SECTION[pathname];
  if (section) return { view: section };
  return { view: 'accueil' };
}

// Exposé pour les tests (liste des sections reconnues par l'URL) — évite de dupliquer cette
// liste dans scripts/test-router.mjs.
export const URL_SECTIONS = Object.keys(SECTION_PATHS);
