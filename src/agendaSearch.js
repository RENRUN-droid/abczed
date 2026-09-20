// Logique de filtrage/recherche Agenda, extraite d'Agenda.jsx pour être testable
// directement : la fonction que le composant utilise en production est exactement celle
// que scripts/test-agenda-search.mjs importe et exécute — pas une reproduction séparée.

import { normalize } from './searchUtils.js';
import { CATEGORIES } from './theme.js';
import { localIso } from './localDate.js';

export function pad(n) { return String(n).padStart(2, '0'); }

// Réexporté pour compatibilité : normalize vit désormais dans searchUtils.js (partagé avec
// Messages/Partages/La Bande, brief §3), mais tout code ou test qui importait normalize
// depuis agendaSearch.js continue de fonctionner sans changement.
export { normalize };

// Combine filtre de catégorie et recherche textuelle (titre + lieu).
export function computeFilteredEvents(events, filter, searchQuery) {
  const byCategory = filter === 'tous' ? events : events.filter((e) => e.category === filter);
  const q = normalize((searchQuery || '').trim());
  return q
    ? byCategory.filter((e) => normalize(e.title).includes(q) || normalize(e.location).includes(q))
    : byCategory;
}

// Événements d'un jour donné, à partir d'une collection déjà filtrée.
export function eventsOnDate(filteredEvents, d) {
  const dateStr = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  return filteredEvents.filter((e) => {
    if (e.category === 'anniversaire') return e.day === d.getDate() && e.month === d.getMonth() + 1;
    return e.date === dateStr;
  });
}

// "À venir" sans répéter ce qui est déjà affiché dans le panneau du jour sélectionné.
export function upcomingExcludingSelected(filteredEvents, selectedDateEvents) {
  if (!selectedDateEvents || selectedDateEvents.length === 0) return filteredEvents;
  const selectedIds = new Set(selectedDateEvents.map((e) => e.id));
  return filteredEvents.filter((e) => !selectedIds.has(e.id));
}

// Brief §14 : à chaque changement de catégorie ou de recherche, la date sélectionnée ne
// doit rester sélectionnée que si elle contient encore au moins un événement dans
// l'ensemble filtré courant — sinon elle doit être effacée (jamais effacée "juste parce
// qu'on a changé de filtre", seulement quand elle est devenue invalide).
export function isSelectedDateStillValid(filteredEvents, selectedDate) {
  if (!selectedDate) return true;
  const d = new Date(selectedDate + 'T00:00:00');
  return eventsOnDate(filteredEvents, d).length > 0;
}

// Prochaine occurrence d'un jour+mois récurrent (anniversaire) à partir d'une date de
// référence — extrait de Agenda.jsx (où il servait déjà à trier "À venir") pour être
// réutilisé par Accueil.jsx (brief, 2e passe §5) sans dupliquer la même règle de calcul à
// deux endroits : mois/jour dans l'année de référence si pas encore passés, sinon année
// suivante.
export function nextOccurrence(month, day, reference = new Date()) {
  const year = reference.getFullYear();
  const todayMidnight = new Date(reference.getFullYear(), reference.getMonth(), reference.getDate());
  const candidate = new Date(year, month - 1, day);
  return candidate < todayMidnight ? new Date(year + 1, month - 1, day) : candidate;
}

// Correctif UAT V7.14 (point 15) : "À venir" (Agenda.jsx) et "Prochain événement" (Accueil.jsx)
// se contentaient jusqu'ici de TRIER chronologiquement les événements datés (`e.date`), sans
// jamais exclure ceux dont la date — et l'heure, quand elle est renseignée — sont déjà passées.
// Un jeu de données entièrement au passé affichait donc quand même "le plus ancien du lot" comme
// "prochain événement". Extrait ici en fonction pure, testable indépendamment (voir
// scripts/test-upcoming-events.mjs) et réutilisée À L'IDENTIQUE par les deux écrans — jamais
// réimplémentée deux fois avec un risque de diverger.
//
// Périmètre volontairement limité aux événements DATÉS (`e.date`) : un anniversaire n'a pas de
// `date` (jour/mois récurrent, sans année) et n'a pas à passer par cette fonction — sa "sécurité
// future" vient déjà de `nextOccurrence` ci-dessus, qui fait toujours avancer à l'année suivante
// un jour/mois déjà passé cette année. Un événement sans `date` du tout (cas inattendu) reste
// `true` par défaut : cette fonction ne doit jamais masquer silencieusement un événement dont
// elle ne sait pas déterminer la date.
//
// Règle explicite du brief : un événement avec une `date` mais SANS `startTime` reste "à venir"
// jusqu'à la fin de son jour calendaire (comparaison de dates seules) — jamais exclu à 00h01 le
// jour même simplement parce que "l'instant présent" a dépassé minuit. Comparaison de chaînes
// AAAA-MM-JJ (ordre lexicographique = ordre chronologique pour ce format), via `localIso`
// (../localDate.js) sur la référence — jamais `new Date(dateStr).toISOString()`, déjà signalé
// comme buggé en fuseau UTC+ ailleurs dans ce projet (voir le commentaire de tête de
// localDate.js). Un événement avec `startTime` compare en revanche la date ET l'heure exactes :
// passé son horaire de début, il n'est plus "à venir". `new Date(\`${date}T${startTime}\`)` est
// une forme datetime (pas une date seule) — le moteur JS l'interprète en heure LOCALE, pas en
// UTC (contrairement à la forme "date seule", `new Date('AAAA-MM-JJ')`) : aucun repli localIso
// n'est donc nécessaire pour cette branche, la comparaison est déjà correcte dans le fuseau de
// l'utilisateur.
export function isUpcomingEvent(event, reference = new Date()) {
  if (!event || !event.date) return true;
  if (event.startTime) {
    const eventDateTime = new Date(`${event.date}T${event.startTime}`);
    return eventDateTime.getTime() >= reference.getTime();
  }
  return event.date >= localIso(reference);
}

// Brief §12 : les pastilles sous une date représentent les CATÉGORIES présentes ce jour-là,
// pas un point par événement — plusieurs sorties le même jour ne doivent pas produire trois
// points verts identiques. Ordre stable = ordre de déclaration dans CATEGORIES (theme.js),
// pas l'ordre d'arrivée des événements, pour que deux jours avec les mêmes catégories
// affichent les pastilles dans le même ordre.
export function distinctCategoriesOf(dayEvents) {
  const present = new Set(dayEvents.map((e) => e.category));
  return Object.keys(CATEGORIES).filter((key) => present.has(key));
}

// Correctif (recette réelle sur PC, point 1) : une date sélectionnée dont tous les événements
// partagent une seule catégorie n'activait visuellement rien (filtre resté sur "Tous", rond de
// sélection bleu neutre) — extrait ici en fonction pure testable, appelée par Agenda.jsx.
// Ne renvoie une catégorie implicite QUE si le filtre réel est "tous" : si l'utilisateur a déjà
// choisi une catégorie précise comme filtre, celle-ci EST déjà la catégorie affichée, aucune
// ambiguïté à résoudre. Comportement multi-catégories explicite (pas de masquage silencieux,
// brief) : `null` quand plusieurs catégories coexistent ce jour-là — DayDots reste la source de
// vérité visuelle pour "quelles catégories sont présentes" dans ce cas, rien n'est retiré du
// panneau du jour lui-même.
export function impliedCategoryOf(filter, dayEvents) {
  if (filter !== 'tous') return null;
  const categories = distinctCategoriesOf(dayEvents);
  return categories.length === 1 ? categories[0] : null;
}

// Bug préexistant découvert pendant le point 2 (recette réelle sur PC, prénoms des
// participants) : `peopleCount`/`familiesCount` ne sont calculés que dans src/agendaApi.js,
// pour des événements réellement lus depuis Supabase. Un événement "entre familles" affiché
// via MOCK_EVENTS (repli Messages/Partages, brief §… source de démonstration) ou via le
// harnais de test n'a jamais ces deux champs — Agenda.jsx (badge de la liste) et
// EventDetail.jsx (en-tête "Qui vient ?") affichaient donc littéralement "undefined" au lieu
// d'un décompte. Ces fonctions dérivent les mêmes agrégats directement depuis
// `participants`, quelle que soit la source des données, avec la même règle de repli déjà
// utilisée ligne par ligne dans EventDetail.jsx : un participant "chaîne simple" (ancien
// format de démonstration) compte pour 1 adulte, 0 enfant. Pour un événement réellement issu
// de Supabase, où adults_count/children_count sont toujours des nombres, le résultat est
// strictement identique à ce que calcule déjà agendaApi.js — aucun changement de
// comportement pour les événements réels, uniquement une correction pour les événements de
// démonstration.
export function participantAdultsCount(p) {
  return typeof p === 'string' ? 1 : (p.adultsCount ?? 1);
}
export function participantChildrenCount(p) {
  return typeof p === 'string' ? 0 : (p.childrenCount ?? 0);
}
export function peopleCountOf(participants) {
  return (participants || []).reduce((sum, p) => sum + participantAdultsCount(p) + participantChildrenCount(p), 0);
}
export function familiesCountOf(participants) {
  return (participants || []).length;
}

// P2 (exercice de correction V7.5) : extrait ici depuis EventDetail.jsx (où il était déjà
// calculé en ligne, jamais exposé) pour être réutilisé tel quel par Agenda.jsx — la carte
// Agenda et la fiche événement doivent classer un événement de la MÊME façon, pas via deux
// copies de cette règle qui pourraient un jour diverger. Comportement strictement inchangé
// pour EventDetail.jsx (même expression, juste déplacée).
export function eventModeOf(event) {
  return event.category !== 'sortie' ? 'simple' : (event.subtype === 'sortie_ecole' ? 'accompaniment' : 'family');
}

export function totalAdultsOf(participants) {
  return (participants || []).reduce((sum, p) => sum + participantAdultsCount(p), 0);
}
export function totalChildrenOf(participants) {
  return (participants || []).reduce((sum, p) => sum + participantChildrenCount(p), 0);
}

// P2 (exercice de correction V7.5) : défaut observé — après une inscription, la carte Agenda
// d'un événement "entre familles" n'affichait qu'une icône + le total brut de personnes (ex.
// "3"), sans dire combien d'adultes et d'enfants — la répartition utile n'apparaissait qu'après
// ouverture de la fiche. Ce résumé donne cette répartition directement sur la carte, au format
// "N participant(s) · X adulte(s) · Y enfant(s)".
// Règles (brief) : accords singulier/pluriel corrects ; la catégorie "enfants" (ou "adultes")
// est omise entièrement si elle vaut zéro — elle n'apporterait aucune information — jamais
// "0 enfant" affiché ; chaîne vide (donc aucun résumé affiché du tout) si personne n'est
// inscrit ; AUCUN prénom ici (la carte Agenda reste volontairement moins détaillée que la fiche,
// pour limiter la surcharge visuelle et l'exposition de données personnelles — seule la fiche
// événement, ouverte explicitement, affiche les prénoms saisis).
export function participantsSummaryLabel(participants) {
  const people = peopleCountOf(participants);
  if (people === 0) return '';
  const adults = totalAdultsOf(participants);
  const children = totalChildrenOf(participants);
  const parts = [`${people} participant${people > 1 ? 's' : ''}`];
  if (adults > 0) parts.push(`${adults} adulte${adults > 1 ? 's' : ''}`);
  if (children > 0) parts.push(`${children} enfant${children > 1 ? 's' : ''}`);
  return parts.join(' · ');
}
