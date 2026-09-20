// Harnais de test local (Playwright) — livré dans le ZIP (corrigé V7.8, affirmait auparavant à
// tort "PAS livré dans le ZIP", signalé par contre-vérification indépendante). Remplace
// uniquement src/agendaApi.js via un alias Vite pour éviter tout appel réseau vers Supabase pendant la
// vérification en navigateur réel : renvoie les mêmes événements de démonstration que celles
// utilisées par le reste de l'app quand AGENDA_FROM_SUPABASE valait false, pour avoir des
// données réalistes (dates, catégories, lieux) à faire naviguer sans dépendre du vrai projet.
//
// 6e passe — correctif du harnais lui-même : exclut délibérément 'evt-piscine' de la réponse.
// En le laissant, la 1ère version de ce harnais masquait le bug réel signalé par l'utilisateur
// (filteredEvent sans repli MOCK_EVENTS) : `events` (agenda "live") contenait alors TOUJOURS cet
// événement, donc la recherche directe suffisait et ne passait jamais par le repli — 28/28
// scénarios verts sans jamais avoir exercé le chemin en défaut. En pratique (AGENDA_FROM_SUPABASE
// = true), l'agenda réel ne contient pas les événements de démonstration référencés par les
// messages/partages mockés (BUSINESS_DATA_FROM_SUPABASE = false pour ces données) — ce filtre
// reproduit fidèlement ce décalage.
import { EVENTS } from '../src/data.js';

// V7.1 — état mutable, pas un simple retour statique : signalé en contre-vérification
// indépendante (ChatGPT) que le scénario RSVP de cette passe ne prouvait la réussite du
// message honnête que sur un événement mock-only (evt-piscine), jamais qu'une inscription
// RÉELLE sur un événement effectivement présent dans l'agenda "live" (evt-zoo) fonctionne
// toujours après le correctif — parce que joinAgendaEvent()/leaveAgendaEvent() étaient de
// purs no-op ici : même en cas de RÉGRESSION dans App.jsx (ex. la branche isLiveEvent bloque
// aussi les vrais événements), l'UI n'aurait jamais pu le montrer, cet état ne bougeant jamais.
// `structuredClone` isole cet état de `EVENTS` (jamais muté directement, pour ne pas faire
// fuiter l'état d'un test vers un autre module qui importerait `EVENTS`).
//
// 6e passe — correctif conservé : exclut délibérément 'evt-piscine' de la réponse. En le
// laissant, la 1ère version de ce harnais masquait le bug réel signalé par l'utilisateur
// (filteredEvent sans repli MOCK_EVENTS) : `events` (agenda "live") contenait alors TOUJOURS cet
// événement, donc la recherche directe suffisait et ne passait jamais par le repli — 28/28
// scénarios verts sans jamais avoir exercé le chemin en défaut. En pratique (AGENDA_FROM_SUPABASE
// = true), l'agenda réel ne contient pas les événements de démonstration référencés par les
// messages/partages mockés (BUSINESS_DATA_FROM_SUPABASE = false pour ces données) — ce filtre
// reproduit fidèlement ce décalage.
// Point 2 (recette réelle sur PC) : ce fichier tourne dans le NAVIGATEUR (il remplace
// src/agendaApi.js dans le bundle client via l'alias Vite du harnais — l'exécution reste
// côté navigateur, jamais côté serveur Node). `liveEvents` vivait donc uniquement en mémoire
// JS de la page : un `page.reload()` réexécute tous les modules depuis zéro et effaçait tout
// l'état, y compris les inscriptions déjà confirmées — pas seulement les prénoms. Ce n'était
// pas un problème avant cette passe car aucun scénario ne testait un vrai rechargement complet
// de page (le scénario 23 vérifie join/leave dans la MÊME session, jamais après reload). Le
// brief exige explicitement une preuve de persistance "après rechargement" pour les prénoms —
// sessionStorage simule ici, honnêtement, ce qu'un vrai backend (Supabase) ferait de toute
// façon : survivre à un rechargement de page. Ça ne teste PAS le code réel de persistance
// Supabase (src/agendaApi.js, jamais chargé dans ce harnais) — seulement que App.jsx/
// EventDetail.jsx redemandent et réaffichent correctement l'état "serveur" après un
// rechargement, ce qui est la partie que ce harnais PEUT légitimement vérifier.
const STORAGE_KEY = '__abczed_harness_agenda_state__';
// V7.11 (P0) — utilisateur/communauté courants du harnais, mêmes valeurs que
// test-harness/mockMessagesApi.js (CURRENT_USER_ID/COMMUNITY_ID) : nécessaire pour simuler
// honnêtement, côté harnais, le même refus que la policy RLS réelle
// `delete_own_event_or_admin` (sql/02_rls.sql, non modifiée) opposerait à un membre qui n'est
// ni le créateur de l'événement ni admin — voir `deleteAgendaEvent` plus bas.
const CURRENT_USER_ID = 'test-user-1';
// V7.11 (P0) : `createdBy` ajouté ici, PAS dans src/data.js (dépôt commun à Agenda/Messages/
// Partages, dont ce champ n'a jamais eu besoin ailleurs) — deux événements de démonstration
// reçoivent un créateur distinct pour rendre testable, dans le harnais, à la fois le cas
// "propriétaire non-admin peut supprimer" (evt-piquenique, créé par l'utilisateur courant du
// harnais) et le cas "non-propriétaire/non-admin ne peut PAS supprimer" (evt-zoo, créé par
// quelqu'un d'autre) — tous les autres événements reçoivent aussi un créateur (`user-marie`,
// jamais l'utilisateur courant) pour ne jamais laisser `createdBy` indéfini par accident.
function withCreatedBy(events) {
  return events.map((e) => ({
    ...e,
    createdBy: e.id === 'evt-piquenique' ? CURRENT_USER_ID : 'user-marie',
  }));
}
function loadInitialLiveEvents() {
  try {
    const raw = typeof sessionStorage !== 'undefined' ? sessionStorage.getItem(STORAGE_KEY) : null;
    if (raw) return JSON.parse(raw);
  } catch {
    // sessionStorage indisponible (mode privé, etc.) -> repli sur l'état initial, pas de crash.
  }
  return withCreatedBy(structuredClone(EVENTS).filter((e) => e.id !== 'evt-piscine'));
}
function persistLiveEvents() {
  try {
    if (typeof sessionStorage !== 'undefined') sessionStorage.setItem(STORAGE_KEY, JSON.stringify(liveEvents));
  } catch {
    // Persistance best-effort : une écriture ratée ne doit jamais faire échouer l'action RSVP
    // elle-même, seulement dégrader la preuve de rechargement à la prochaine navigation.
  }
}
let liveEvents = loadInitialLiveEvents();

// P5 (exercice de correction V7.5) : deux leviers de test, lus depuis sessionStorage À CHAQUE
// appel (jamais mis en cache au chargement du module) pour que recette.mjs puisse les activer
// juste avant l'étape concernée, sans recharger tout le harnais :
//   - `__abczed_harness_names_unsupported__` = 'true' -> simule l'état "migration sql/05 pas
//     encore appliquée" : fetchAgendaEvents se comporte comme le repli réel de
//     src/agendaApi.js (attendeeNamesUnsupported: true), pour vérifier que le formulaire
//     d'inscription affiche bien l'avertissement PROACTIF attendu (App.jsx/EventDetail.jsx),
//     jamais l'erreur générique "Impossible de charger l'agenda" corrigée par ce point.
//   - `__abczed_harness_force_join_error__` = 'constraint' -> simule une VRAIE violation de
//     contrainte (23514, forme réelle d'une donnée malformée sur `event_participants`), pour
//     vérifier que joinEvent (App.jsx) l'affiche bien comme une vraie erreur, jamais avalée en
//     silence comme s'il s'agissait d'une colonne absente — exactement la distinction que
//     src/undefinedColumnError.js doit faire correctement côté code réel.
//   - `__abczed_harness_force_agenda_fetch_error__` = 'true' (V7.11.1) -> fetchAgendaEvents
//     échoue, pour vérifier qu'un rechargement agenda en échec APRÈS une mutation déjà réussie
//     n'est jamais traité comme un succès silencieux (voir son commentaire sur
//     fetchAgendaEvents ci-dessous, et MATRICE_LIVRAISON.md, correctif V7.11.1).
function harnessFlag(key) {
  try {
    return typeof sessionStorage !== 'undefined' ? sessionStorage.getItem(key) : null;
  } catch {
    return null;
  }
}

// V7.11 (P1) : délai artificiel partagé par toutes les mutations RSVP/suppression de ce module
// — nécessaire pour qu'un scénario Playwright puisse observer de façon fiable l'état "pending"
// (contrôle désactivé) avant sa résolution, et déclencher un événement concurrent (écho
// Realtime simulé, double clic) PENDANT que la mutation est encore en vol.
function harnessAgendaMutationDelayMs() {
  const raw = harnessFlag('__abczed_harness_delay_agenda_mutation_ms__');
  const n = raw ? parseInt(raw, 10) : 0;
  return Number.isFinite(n) && n > 0 ? n : 0;
}
async function applyAgendaMutationDelay() {
  const delay = harnessAgendaMutationDelayMs();
  if (delay) await new Promise((resolve) => setTimeout(resolve, delay));
}

// V7.11.1 — levier ajouté pour le correctif du bug 2 (rechargements avalant leur propre échec,
// voir MATRICE_LIVRAISON.md) : `__abczed_harness_force_agenda_fetch_error__` = 'true' ->
// fetchAgendaEvents échoue, pour vérifier qu'un rechargement agenda qui échoue APRÈS une
// mutation déjà réussie (ex. suppression d'événement) n'est jamais traité comme un succès
// silencieux par App.jsx — même principe et même convention que
// `__abczed_harness_force_messages_fetch_error__` déjà existant dans mockMessagesApi.js.
export async function fetchAgendaEvents() {
  if (harnessFlag('__abczed_harness_force_agenda_fetch_error__') === 'true') {
    throw new Error('Erreur réseau simulée (harnais) — fetchAgendaEvents');
  }
  const namesUnsupported = harnessFlag('__abczed_harness_names_unsupported__') === 'true';
  return { events: liveEvents, attendeeNamesUnsupported: namesUnsupported };
}

// Les participants existants d'un événement mock (ex. evt-zoo : "Parent 1".."Parent 23") sont
// de simples chaînes (voir `participantId`/`participantLabel` dans EventDetail.jsx, qui gèrent
// les deux formes) — on les laisse telles quelles pour ne pas casser le scénario 18 existant
// (tap-reveal), et on n'ajoute qu'un objet `{userId, label, adultsCount, childrenCount}` pour
// l'utilisateur courant du harnais, cohérent avec ce que ces deux fonctions attendent.
export async function joinAgendaEvent(eventId, communityId, userId, counts) {
  await applyAgendaMutationDelay();
  if (harnessFlag('__abczed_harness_force_join_error__') === 'constraint') {
    // Forme réelle d'une violation de la contrainte de forme ajoutée par
    // sql/05_participant_names.sql (voir src/undefinedColumnError.js) — PAS une colonne
    // absente : isUndefinedColumnError() doit renvoyer false ici, donc App.jsx doit remonter
    // cette erreur telle quelle (setDataError générique), jamais la traiter comme un repli
    // "sans prénoms" légitime.
    const err = new Error(
      'new row for relation "event_participants" violates check constraint "event_participants_attendee_names_shape"',
    );
    err.code = '23514';
    throw err;
  }
  const event = liveEvents.find((e) => e.id === eventId);
  if (!event) return;
  const already = event.participants.some((p) => typeof p !== 'string' && p.userId === userId);
  if (!already) {
    event.participants = [
      ...event.participants,
      // Point 2 (recette réelle sur PC) : `attendeeNames` est désormais inclus dès
      // l'inscription initiale, pas seulement lors d'une modification — sinon les prénoms
      // saisis à l'inscription (pas seulement en "Modifier") auraient été silencieusement
      // perdus par ce harnais, faussant la preuve de persistance attendue par le brief.
      { userId, label: 'Vous', adultsCount: counts?.adultsCount ?? 1, childrenCount: counts?.childrenCount ?? 0, attendeeNames: counts?.attendeeNames ?? null },
    ];
    persistLiveEvents();
  }
}
export async function leaveAgendaEvent(eventId, userId) {
  await applyAgendaMutationDelay();
  const event = liveEvents.find((e) => e.id === eventId);
  if (!event) return;
  event.participants = event.participants.filter((p) => typeof p === 'string' || p.userId !== userId);
  persistLiveEvents();
}
export async function modifyAgendaParticipation(eventId, communityId, userId, oldCounts, newCounts) {
  await applyAgendaMutationDelay();
  const event = liveEvents.find((e) => e.id === eventId);
  if (!event) return;
  // Point 2 : `newCounts.attendeeNames` (null si aucun prénom saisi) remplace bien l'ancienne
  // valeur via ce spread — une modification qui vide tous les champs prénoms doit effacer les
  // anciens, pas les conserver silencieusement.
  event.participants = event.participants.map((p) =>
    typeof p !== 'string' && p.userId === userId ? { ...p, ...newCounts } : p,
  );
  persistLiveEvents();
}
// V7.11.2 (correctif doublon de création) — avant ce correctif, ces deux fonctions étaient de
// purs no-op (`return true` sans jamais toucher `liveEvents`) : aucun scénario Playwright ne
// pouvait donc compter les lignes réellement créées, ce qui masquait le bug corrigé par cette
// passe (voir MATRICE_LIVRAISON.md, V7.11.2 et le scénario 26 ci-dessous dans
// test-harness/recette-v711.mjs). Elles insèrent désormais réellement dans `liveEvents`,
// persisté comme le reste de ce harnais, avec la même forme mappée que celle produite par
// fetchAgendaEvents ci-dessus (et par src/agendaApi.js côté réel) — pour qu'un scénario puisse
// à la fois compter les lignes créées et les voir s'afficher normalement dans l'Agenda après un
// rechargement réussi.
//   - `__abczed_harness_force_create_event_error__` = 'true' -> createAgendaEvent échoue (l'INSERT
//     lui-même, PAS le rechargement qui suit — distinct de
//     `__abczed_harness_force_agenda_fetch_error__` ci-dessus) : permet de vérifier séparément le
//     cas "rien n'a été créé" (le formulaire doit rester ouvert) du cas visé par ce correctif
//     ("créé mais rechargement en échec", le formulaire doit se fermer).
//   - `__abczed_harness_force_create_birthday_error__` = 'true' -> même chose pour
//     createAgendaBirthday.
// V7.14 (correctif UAT point 14) : renvoie désormais `{ id }` du nouvel événement — miroir
// exact de l'ajout fait côté réel (src/agendaApi.js, `.select('id').single()`), nécessaire pour
// que les scénarios Playwright de ce lot puissent vérifier la navigation vers la fiche du
// nouvel événement après création, exactement comme App.jsx le fait en production.
export async function createAgendaEvent(communityId, userId, payload) {
  await applyAgendaMutationDelay();
  if (harnessFlag('__abczed_harness_force_create_event_error__') === 'true') {
    throw new Error('Erreur réseau simulée (harnais) — createAgendaEvent');
  }
  const newId = 'evt-harness-created-' + Date.now() + '-' + Math.random().toString(36).slice(2, 8);
  liveEvents = [
    ...liveEvents,
    {
      id: newId,
      createdBy: CURRENT_USER_ID,
      category: payload?.category,
      subtype: payload?.subtype || null,
      title: payload?.title,
      description: payload?.description || '',
      date: payload?.date,
      startTime: payload?.startTime || '',
      endTime: '',
      location: payload?.location || '',
      attachments: [],
      participants: [],
      hasLinkedThread: false,
    },
  ];
  persistLiveEvents();
  return { id: newId };
}
export async function createAgendaBirthday(communityId, userId, payload) {
  await applyAgendaMutationDelay();
  if (harnessFlag('__abczed_harness_force_create_birthday_error__') === 'true') {
    throw new Error('Erreur réseau simulée (harnais) — createAgendaBirthday');
  }
  const newId = 'evt-harness-birthday-' + Date.now() + '-' + Math.random().toString(36).slice(2, 8);
  liveEvents = [
    ...liveEvents,
    {
      id: newId,
      createdBy: CURRENT_USER_ID,
      category: 'anniversaire',
      subtype: null,
      title: payload?.title,
      description: '',
      date: '',
      startTime: '',
      endTime: '',
      location: '',
      attachments: [],
      participants: [],
      hasLinkedThread: false,
      day: payload?.day,
      month: payload?.month,
    },
  ];
  persistLiveEvents();
  return { id: newId };
}

export async function updateAgendaBirthday(eventId, payload) {
  await applyAgendaMutationDelay();
  if (harnessFlag('__abczed_harness_force_birthday_update_error__') === 'true') {
    throw new Error('Erreur réseau simulée (harnais) — updateAgendaBirthday');
  }
  const event = liveEvents.find((e) => e.id === eventId && e.category === 'anniversaire');
  const isAdmin = harnessRole() === 'admin';
  if (!event || (event.createdBy !== CURRENT_USER_ID && !isAdmin)) {
    const err = new Error("La modification n'a pas été appliquée.");
    err.code = 'UPDATE_NOT_APPLIED';
    throw err;
  }
  event.title = payload?.title;
  event.day = payload?.day;
  event.month = payload?.month;
  persistLiveEvents();
}

// V7.11 (P0) — Suppression réelle, harnais : simule à la fois (a) le refus RLS réel opposé à un
// membre ni créateur ni admin (`delete_own_event_or_admin`, sql/02_rls.sql — même code d'erreur
// `DELETE_NOT_APPLIED` que le comportement réel décrit dans src/agendaApi.js, pas une exception
// réseau générique qui masquerait la distinction), et (b) l'effet de bord
// `on delete set null` du schéma réel sur `messages.linked_event_id` (sql/02_rls.sql, ligne
// ~86) — indispensable pour que les scénarios Playwright de suppression puissent prouver
// honnêtement les points 2/3/4 du brief P0 (le message lié reste présent, `linkedEventId`
// devient `null`, le badge disparaît), sans quoi cet effet de bord resterait invérifié dans le
// harnais (il l'est indépendamment, au niveau SQL, par scripts/sql-tests/ — voir
// MATRICE_LIVRAISON.md, section V7.11 — cette simulation ne remplace pas cette preuve-là, elle
// prouve seulement que l'INTERFACE réagit correctement une fois l'effet survenu).
// `__abczed_harness_force_delete_error__` = 'true' -> simule un VRAI échec réseau (distinct du
// refus RLS ci-dessus), pour vérifier qu'App.jsx affiche une erreur honnête sans naviguer.
function harnessRole() {
  return harnessFlag('__abczed_harness_role__') || 'admin';
}
export async function deleteAgendaEvent(eventId) {
  await applyAgendaMutationDelay();
  if (harnessFlag('__abczed_harness_force_delete_error__') === 'true') {
    throw new Error('Erreur réseau simulée (harnais) — deleteAgendaEvent');
  }
  const event = liveEvents.find((e) => e.id === eventId);
  if (!event) {
    const err = new Error("La suppression n'a pas pu être effectuée — droits insuffisants ou événement déjà supprimé.");
    err.code = 'DELETE_NOT_APPLIED';
    throw err;
  }
  const isOwner = event.createdBy === CURRENT_USER_ID;
  const isAdmin = harnessRole() === 'admin';
  if (!isOwner && !isAdmin) {
    // Même refus, même code, que ce que src/agendaApi.js lève réellement quand RLS filtre le
    // DELETE à zéro ligne (voir son commentaire) — jamais une exception réseau générique qui
    // masquerait cette distinction dans les scénarios Playwright dédiés (P0, point 6).
    const err = new Error("La suppression n'a pas pu être effectuée — droits insuffisants ou événement déjà supprimé.");
    err.code = 'DELETE_NOT_APPLIED';
    throw err;
  }
  liveEvents = liveEvents.filter((e) => e.id !== eventId);
  persistLiveEvents();
  // Simule `on delete set null` (sql/02_rls.sql) sur les messages du harnais liés à cet
  // événement — module séparé (test-harness/mockMessagesApi.js), touché ici directement via
  // sessionStorage : ce fichier de harnais n'importe délibérément pas mockMessagesApi.js (les
  // deux modules restent indépendants, exactement comme agendaApi.js/messagesApi.js le sont en
  // production), donc c'est la seule façon honnête de reproduire, côté harnais, un effet qui
  // seraît un simple trigger de base de données coté serveur réel.
  try {
    if (typeof sessionStorage !== 'undefined') {
      const raw = sessionStorage.getItem('__abczed_harness_messages_state__');
      if (raw) {
        const rows = JSON.parse(raw).map((m) => (m.linkedEventId === eventId ? { ...m, linkedEventId: null } : m));
        sessionStorage.setItem('__abczed_harness_messages_state__', JSON.stringify(rows));
      }
    }
  } catch {
    // Best-effort, comme le reste de la persistance de ce harnais — une écriture ratée ici ne
    // doit jamais faire échouer la suppression elle-même (déjà réussie à ce stade).
  }
}

// V7.11 (P0, point 6 de validation) — point d'ancrage de test UNIQUEMENT : expose la fonction
// réelle de ce module sur `window`, pour qu'un scénario Playwright puisse prouver que le refus
// ci-dessus est bien appliqué INDÉPENDAMMENT de l'interface (App.jsx/EventDetail.jsx ne proposent
// déjà pas le bouton à un non-propriétaire/non-admin — voir `canDeleteEvent`, App.jsx) — en
// appelant CETTE fonction directement, en contournant complètement le bouton et sa condition
// d'affichage, exactement comme le ferait un appel réseau forgé côté vrai Supabase, que seule la
// policy RLS `delete_own_event_or_admin` (sql/02_rls.sql, non modifiée) bloquerait alors. Même
// principe déjà établi par `window.__abczedHarnessTriggerMessagesRealtime`
// (test-harness/mockMessagesApi.js) : un pont de test, jamais présent dans le bundle de
// production (ce fichier entier n'est chargé que via l'alias Vite du harnais).
if (typeof window !== 'undefined') {
  window.__abczedHarnessDeleteAgendaEventDirect = deleteAgendaEvent;
}
