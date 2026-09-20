// Harnais de test local (Playwright) — livré dans le ZIP (corrigé V7.8, affirmait auparavant à
// tort "PAS livré dans le ZIP", signalé par contre-vérification indépendante), mais PAS une
// modification du code produit. Remplace uniquement src/messagesApi.js via un alias Vite (vite.harness.config.js)
// pour vérifier en navigateur réel le comportement de App.jsx/Messages.jsx branché sur
// MESSAGES_FROM_SUPABASE=true, sans dépendre du vrai projet Supabase — aucune donnée réelle,
// aucun identifiant, rien écrit nulle part côté serveur. Les garanties SERVEUR réelles (RLS,
// contrainte composite, trigger d'immuabilité) sont vérifiées séparément et discriminativement
// contre un PostgreSQL local jetable (voir MATRICE_LIVRAISON.md, section P8) — ce fichier ne les
// reproduit pas, il exerce uniquement le câblage React/App.jsx/Messages.jsx.
//
// `avatarColorFor`/`initialsOf` importés du VRAI module (src/avatarColor.js, pas une doublure) :
// ce sont des fonctions pures, déjà testées indépendamment (scripts/test-avatar-color.mjs) —
// aucune raison de les dupliquer ici, et ça garantit que le harnais exerce le même calcul que
// la production.
import { avatarColorFor, initialsOf } from '../src/avatarColor.js';
import { localIso } from '../src/localDate.js';

// Utilisateur courant du harnais — DOIT rester synchronisé avec `session.user.id` renvoyé par
// mockAuth.jsx (même alias Vite, même page) : c'est cette égalité qui fait fonctionner
// isMine/mine côté React exactement comme `author_id = auth.uid()` le ferait réellement.
const CURRENT_USER_ID = 'test-user-1';
const COMMUNITY_ID = 'test-community-1';

// Repli neutre volontairement identique à celui de messagesApi.js réel ("Membre") — jamais un
// fragment d'id, jamais une valeur inventée pour un authorId/userId inconnu de cette table.
const DISPLAY_NAMES = {
  'test-user-1': 'Vous',
  'user-marie': 'Marie',
  'user-sophie': 'Sophie',
  'user-thomas': 'Thomas',
  'user-sabrina': 'Sabrina',
  'user-lucas': 'Lucas',
};
function displayNameOf(userId) {
  return DISPLAY_NAMES[userId] || 'Membre';
}

function daysAgo(n) {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d;
}
const TODAY_ISO = localIso(new Date());
const YESTERDAY_ISO = localIso(daysAgo(1));
const LAST_WEEK_ISO = localIso(daysAgo(7));

// Reprend le CONTENU du jeu de données de démonstration historique (src/data.js,
// GENERAL_THREAD) — mêmes ids (m0/m1/m2/m3/m4/m6), mêmes textes, même événement lié
// ('evt-piscine') — pour que les scénarios Playwright déjà écrits contre ce fil (recherche
// "piscine", badge #msg-event-btn-m1, réactions sur #msg-row-m4...) continuent de vérifier
// exactement le même comportement, désormais via le vrai chemin réseau (messagesApi.js réel,
// remplacé ici uniquement au niveau transport). `reactions` ne stocke QUE {userId, emoji} —
// jamais displayName — exactement comme la vraie table message_reactions (sql/06) : le nom
// affiché est résolu à la lecture, jamais stocké en double.
// V7.7 (P2/P9) : l'ancien message m5 (pièce jointe, fileId='doc-autorisation-piscine') n'est
// PAS repris ici — brief explicite, "ne jamais exposer le PDF de démo dans le vrai fil" ;
// messagesApi.js réel ne renvoie de toute façon jamais de fileId (aucune colonne pièce jointe
// dans le schéma sql/02_rls.sql pour messages), ce fil de démonstration ne doit pas non plus le
// simuler.
function seedMessages() {
  return [
    { id: 'm0', communityId: COMMUNITY_ID, authorId: 'user-marie', text: 'Quelqu’un a des nouvelles du compte-rendu de la réunion de rentrée ?', date: LAST_WEEK_ISO, time: '18:42', reactions: [], linkedEventId: null },
    { id: 'm1', communityId: COMMUNITY_ID, authorId: 'user-sophie', text: 'Bonjour à tous ! Rappel : sortie piscine samedi 24 mai de 10h00 à 12h00 à Saint-Denis.', date: YESTERDAY_ISO, time: '09:15', reactions: [
      { userId: 'user-marie', emoji: '❤️' }, { userId: 'user-thomas', emoji: '❤️' }, { userId: 'user-sabrina', emoji: '❤️' }, { userId: CURRENT_USER_ID, emoji: '❤️' },
    ], linkedEventId: 'evt-piscine' },
    { id: 'm2', communityId: COMMUNITY_ID, authorId: 'user-thomas', text: 'Merci Sophie ! On arrive un peu avant 10h00.', date: YESTERDAY_ISO, time: '09:18', reactions: [
      { userId: 'user-sophie', emoji: '👍' }, { userId: 'user-marie', emoji: '👍' },
    ], linkedEventId: 'evt-piscine' },
    { id: 'm3', communityId: COMMUNITY_ID, authorId: 'user-marie', text: 'N’oubliez pas les maillots, serviettes, bonnets de bain et brassards pour les plus petits !', date: YESTERDAY_ISO, time: '09:21', reactions: [
      { userId: 'user-sophie', emoji: '❤️' }, { userId: 'user-thomas', emoji: '❤️' }, { userId: 'user-sabrina', emoji: '❤️' },
    ], linkedEventId: 'evt-piscine' },
    { id: 'm4', communityId: COMMUNITY_ID, authorId: 'user-lucas', text: 'Est-ce que quelqu’un a le compte-rendu de la réunion de mardi ?', date: TODAY_ISO, time: '10:12', reactions: [], linkedEventId: null },
    { id: 'm6', communityId: COMMUNITY_ID, authorId: 'user-sabrina', text: 'Qui peut covoiturer samedi ?', date: TODAY_ISO, time: '14:40', reactions: [], linkedEventId: null },
  ];
}

// Même méthode que mockAgendaApi.js (voir son commentaire en tête) : ce module tourne dans le
// NAVIGATEUR (alias Vite), sessionStorage simule honnêtement ce qu'un vrai backend ferait —
// survivre à un rechargement de page — sans prétendre tester le code Supabase réel lui-même
// (jamais chargé dans ce harnais).
const STORAGE_KEY = '__abczed_harness_messages_state__';
function loadInitialMessages() {
  try {
    const raw = typeof sessionStorage !== 'undefined' ? sessionStorage.getItem(STORAGE_KEY) : null;
    if (raw) return JSON.parse(raw);
  } catch {
    // sessionStorage indisponible (mode privé, etc.) -> repli sur l'état initial, pas de crash.
  }
  return seedMessages();
}
function persistMessages() {
  try {
    if (typeof sessionStorage !== 'undefined') sessionStorage.setItem(STORAGE_KEY, JSON.stringify(rows));
  } catch {
    // Persistance best-effort : une écriture ratée ne doit jamais faire échouer l'action
    // elle-même, seulement dégrader la preuve de rechargement à la prochaine navigation.
  }
}
let rows = loadInitialMessages();
// Persisté immédiatement (pas seulement après la première mutation) : recette.mjs peut ainsi
// lire/modifier sessionStorage dès le premier chargement pour simuler un changement "venu d'un
// autre client" (scénario Realtime, P6) sans dépendre de l'ordre des actions de test.
persistMessages();

// Resynchronise `rows` depuis sessionStorage avant CHAQUE lecture — jamais une simple confiance
// dans la copie déjà en mémoire. Nécessaire pour que le scénario Realtime (P6) puisse simuler
// "quelqu'un d'autre vient d'écrire" en modifiant directement sessionStorage puis en déclenchant
// `window.__abczedHarnessTriggerMessagesRealtime()` : un vrai backend (Supabase) ne servirait
// jamais une copie mémoire obsolète à un fetch qui suit une notification Realtime, ce module ne
// doit pas non plus le faire.
function syncFromStorage() {
  try {
    const raw = typeof sessionStorage !== 'undefined' ? sessionStorage.getItem(STORAGE_KEY) : null;
    if (raw) rows = JSON.parse(raw);
  } catch {
    // Lecture best-effort : en cas d'échec, on continue avec la dernière copie mémoire connue.
  }
}

// Deux leviers de test, lus depuis sessionStorage À CHAQUE appel (jamais mis en cache), même
// principe que harnessFlag() dans mockAgendaApi.js — recette.mjs peut les activer juste avant
// l'étape concernée, sans recharger tout le harnais :
//   - `__abczed_harness_force_messages_fetch_error__` = 'true' -> fetchMessages échoue, pour
//     vérifier que App.jsx affiche une VRAIE erreur (messagesError), jamais un repli silencieux
//     vers une donnée de démonstration (interdiction explicite du brief V7.7).
//   - `__abczed_harness_force_send_error__` = 'true' -> sendMessage échoue, pour vérifier que
//     Messages.jsx conserve le texte saisi (contrat de retour `false`, rien n'est vidé).
//   - `__abczed_harness_force_link_error__` = 'true' -> linkMessageToEvent échoue, pour
//     vérifier que App.jsx affiche une vraie erreur au lieu de faire disparaître silencieusement
//     le bouton "Lier à un événement".
//   - `__abczed_harness_delay_messages_fetch_ms__` = '<millisecondes>' (V7.8) -> fetchMessages
//     attend ce délai avant de répondre (succès ou échec simulé ci-dessus, le délai s'applique
//     dans tous les cas) — nécessaire pour qu'un scénario Playwright puisse observer l'état
//     `messagesLoading` réellement affiché (Messages.jsx ET, depuis V7.8, Accueil.jsx) avant sa
//     résolution, au lieu d'un état transitoire trop bref pour être vérifié de façon fiable.
function harnessFlag(key) {
  try {
    return typeof sessionStorage !== 'undefined' ? sessionStorage.getItem(key) : null;
  } catch {
    return null;
  }
}
function harnessDelayMs() {
  const raw = harnessFlag('__abczed_harness_delay_messages_fetch_ms__');
  const n = raw ? parseInt(raw, 10) : 0;
  return Number.isFinite(n) && n > 0 ? n : 0;
}

function toClientShape(row) {
  const created = new Date(`${row.date}T${row.time}:00`);
  return {
    id: row.id,
    authorId: row.authorId,
    author: displayNameOf(row.authorId),
    initials: initialsOf(displayNameOf(row.authorId)),
    color: avatarColorFor(row.authorId),
    text: row.text,
    date: row.date,
    time: row.time,
    reactions: row.reactions.map((r) => ({ userId: r.userId, displayName: displayNameOf(r.userId), emoji: r.emoji })),
    linkedEventId: row.linkedEventId,
    // Champ interne, jamais renvoyé par le vrai messagesApi.js — utilisé uniquement par ce
    // module pour re-trier après un ajout (voir sendMessage) ; retiré avant retour à l'appelant.
    _createdAtMs: created.getTime(),
  };
}

// Callback du dernier abonnement Realtime actif — exposé sur `window` pour que recette.mjs
// puisse simuler une notification serveur sans dépendre d'un vrai WebSocket (P6 : "recharge
// l'état qui fait foi", jamais une fusion locale du payload).
let activeOnChange = null;

export async function fetchMessages(communityId) {
  const delay = harnessDelayMs();
  if (delay) await new Promise((resolve) => setTimeout(resolve, delay));
  if (harnessFlag('__abczed_harness_force_messages_fetch_error__') === 'true') {
    throw new Error('Erreur réseau simulée (harnais) — fetchMessages');
  }
  syncFromStorage();
  return rows
    .filter((r) => r.communityId === communityId)
    .map(toClientShape)
    .sort((a, b) => a._createdAtMs - b._createdAtMs)
    .map(({ _createdAtMs, ...m }) => m);
}

export async function sendMessage(communityId, authorId, { text, linkedEventId }) {
  if (harnessFlag('__abczed_harness_force_send_error__') === 'true') {
    throw new Error('Erreur réseau simulée (harnais) — sendMessage');
  }
  // Repart de l'état le plus à jour (sessionStorage) avant d'écrire — pas d'une copie mémoire
  // potentiellement obsolète si un autre onglet/session a déjà écrit entre-temps (même principe
  // que fetchMessages ci-dessus).
  syncFromStorage();
  const now = new Date();
  rows.push({
    id: 'harness-msg-' + Date.now() + '-' + Math.random().toString(36).slice(2, 8),
    communityId,
    authorId,
    text: (text || '').trim(),
    date: localIso(now),
    time: now.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }),
    reactions: [],
    linkedEventId: linkedEventId || null,
  });
  persistMessages();
}

export async function updateMessageText(messageId, text) {
  if (harnessFlag('__abczed_harness_force_message_update_error__') === 'true') {
    throw new Error('Erreur réseau simulée (harnais) — updateMessageText');
  }
  syncFromStorage();
  const row = rows.find((r) => r.id === messageId);
  if (!row || row.authorId !== CURRENT_USER_ID) {
    const err = new Error("La modification n'a pas été appliquée.");
    err.code = 'UPDATE_NOT_APPLIED';
    throw err;
  }
  row.text = (text || '').trim();
  persistMessages();
}

export async function deleteMessage(messageId) {
  if (harnessFlag('__abczed_harness_force_message_delete_error__') === 'true') {
    throw new Error('Erreur réseau simulée (harnais) — deleteMessage');
  }
  syncFromStorage();
  const index = rows.findIndex((r) => r.id === messageId);
  const isAdmin = (harnessFlag('__abczed_harness_role__') || 'admin') === 'admin';
  if (index < 0 || (rows[index].authorId !== CURRENT_USER_ID && !isAdmin)) {
    const err = new Error("La suppression n'a pas été appliquée.");
    err.code = 'DELETE_NOT_APPLIED';
    throw err;
  }
  rows.splice(index, 1);
  persistMessages();
}

export async function linkMessageToEvent(messageId, eventId) {
  if (harnessFlag('__abczed_harness_force_link_error__') === 'true') {
    throw new Error('Erreur réseau simulée (harnais) — linkMessageToEvent');
  }
  syncFromStorage();
  const row = rows.find((r) => r.id === messageId);
  if (!row) throw new Error('Message introuvable (harnais)');
  row.linkedEventId = eventId;
  persistMessages();
}

// V7.11 (P1) — levier ajouté pour les scénarios de course/pessimiste : simule un VRAI échec
// réseau EN COURS de mutation d'une réaction, même principe que
// `__abczed_harness_force_send_error__` déjà existant pour l'envoi de message — nécessaire pour
// prouver que le contrôle de réaction concerné sort bien de son état "pending" (jamais bloqué
// durablement) et que l'état précédent est préservé (jamais une réaction fantôme affichée).
// V7.11 (P1) : délai artificiel dédié à CETTE mutation (distinct de
// `__abczed_harness_delay_messages_fetch_ms__`, qui ne retarde que la LECTURE) — nécessaire
// pour qu'un scénario Playwright puisse observer de façon fiable l'état "pending" d'une
// réaction (bouton désactivé) avant sa résolution, et pour pouvoir déclencher un écho Realtime
// PENDANT que la mutation est encore en vol (scénario de course nommé "mutation locale suivie
// de son propre écho").
function harnessReactionDelayMs() {
  const raw = harnessFlag('__abczed_harness_delay_reaction_ms__');
  const n = raw ? parseInt(raw, 10) : 0;
  return Number.isFinite(n) && n > 0 ? n : 0;
}
export async function toggleMessageReaction(messageId, communityId, userId, emoji) {
  if (harnessFlag('__abczed_harness_force_reaction_error__') === 'true') {
    throw new Error('Erreur réseau simulée (harnais) — toggleMessageReaction');
  }
  const delay = harnessReactionDelayMs();
  if (delay) await new Promise((resolve) => setTimeout(resolve, delay));
  syncFromStorage();
  const row = rows.find((r) => r.id === messageId);
  if (!row) throw new Error('Message introuvable (harnais)');
  const existing = row.reactions.find((r) => r.userId === userId);
  if (existing) {
    if (existing.emoji === emoji) {
      row.reactions = row.reactions.filter((r) => r.userId !== userId);
    } else {
      existing.emoji = emoji;
    }
  } else {
    row.reactions.push({ userId, emoji });
  }
  persistMessages();
}

export function subscribeToMessages(communityId, onChange) {
  activeOnChange = onChange;
  if (typeof window !== 'undefined') {
    // Hook de test uniquement (jamais présent en production, ce fichier n'est jamais chargé
    // hors du harnais) : recette.mjs déclenche `window.__abczedHarnessTriggerMessagesRealtime()`
    // pour simuler une notification serveur, sans dépendre d'un vrai canal Supabase Realtime.
    window.__abczedHarnessTriggerMessagesRealtime = () => activeOnChange && activeOnChange();
  }
  return () => {
    if (activeOnChange === onChange) activeOnChange = null;
    if (typeof window !== 'undefined' && window.__abczedHarnessTriggerMessagesRealtime) {
      delete window.__abczedHarnessTriggerMessagesRealtime;
    }
  };
}
