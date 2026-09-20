// Logique de visibilité/recherche Messages, extraite de Messages.jsx pour être testable
// directement (même principe que src/agendaSearch.js, brief §33).

import { anyFieldMatches } from './searchUtils.js';
import { messageMatchesDateQuery } from './dateSearch.js';
import { documentById } from './documents.js';

// Delta pts 31-32/61 : tri défensif sur l'horodatage réel (date + heure), jamais une simple
// confiance dans l'ordre d'arrivée du tableau — celui-ci vient de `thread`, qui peut être une
// donnée de démonstration statique (déjà chronologique par construction) OU, une fois
// Messages branché sur des données réelles, le résultat d'un appel réseau dont rien ne garantit
// l'ordre (arrivée concurrente, pagination, retry). Tri stable : à horodatage strictement égal,
// l'ordre d'origine est conservé (`i - j`), pour ne jamais réordonner arbitrairement deux
// messages simultanés. `messageTimestamp` retourne -Infinity pour une date/heure absente ou
// invalide plutôt que de lever une exception — un message mal formé s'affiche en premier
// (visible, donc détectable) plutôt que de faire planter tout le fil.
function messageTimestamp(m) {
  if (!m?.date) return -Infinity;
  const t = new Date(`${m.date}T${m.time || '00:00'}:00`).getTime();
  return Number.isFinite(t) ? t : -Infinity;
}

export function sortMessagesChronologically(messages) {
  return messages
    .map((m, i) => [m, i])
    .sort(([a, i], [b, j]) => messageTimestamp(a) - messageTimestamp(b) || i - j)
    .map(([m]) => m);
}

// `linkedEvent` : filtre "discussion liée" (vue thread) — n'a pas de recherche propre,
// volontairement (brief §21 : la recherche porte sur le fil complet, pas sur la vue déjà
// restreinte à un événement).
//
// `events` (delta §12) : nécessaire pour matcher aussi le TITRE de l'événement lié d'un
// message, pas seulement son contenu textuel — auparavant, "Sortie piscine — 24 mai" ne
// retrouvait un message que par coïncidence (parce que "24 mai" apparaissait aussi, en toutes
// lettres, dans le texte du message). Un message lié à un événement doit être retrouvable par
// le titre exact de cet événement, même si ce titre n'apparaît nulle part dans le texte.
//
// `todayIso` (delta §13) : nécessaire pour interpréter "aujourd'hui"/"hier" par rapport à la
// bonne date de référence — passé explicitement plutôt que recalculé ici, pour que les tests
// (scripts/test-date-search.mjs) contrôlent totalement la date de référence sans dépendre de
// la date système au moment de l'exécution.
export function computeVisibleMessages(thread, linkedEvent, query, events = [], todayIso) {
  // Tri chronologique appliqué AVANT le filtre par événement lié et par recherche — les deux
  // vues (fil complet et fil filtré) doivent afficher un ordre correct, pas seulement celle
  // qui passait par le chemin déjà testé.
  const sorted = sortMessagesChronologically(thread);
  const base = linkedEvent ? sorted.filter((m) => m.linkedEventId === linkedEvent.id) : sorted;
  if (linkedEvent) return base;
  const q = query || '';
  return base.filter((m) => {
    const linkedTitle = m.linkedEventId ? events.find((e) => e.id === m.linkedEventId)?.title : null;
    // Delta pts 29/30/39/42 (arbitrage D1) : `m.file?.name` n'existe plus depuis que les
    // pièces jointes de message référencent un id du catalogue — on résout le nom réel du
    // fichier pour ne pas perdre ce critère de recherche (brief §21).
    const doc = m.fileId ? documentById(m.fileId) : null;
    return (
      anyFieldMatches([m.text, m.author, doc?.displayName, doc?.filename, linkedTitle], q) ||
      messageMatchesDateQuery(m.date, q, todayIso)
    );
  });
}
