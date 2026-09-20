// Module dédié Messages (V7.7) — délibérément séparé de src/api.js (qui reste la dette
// Partages/La Bande, non touchée dans ce lot : il lit/écrit encore author_name/avatar_color/
// member_name en texte libre, incompatibles avec le schéma sécurisé réel — voir le commentaire
// en tête de api.js) et de src/agendaApi.js (Agenda, non touché non plus). Même méthode que
// agendaApi.js : contrat vérifié contre sql/02_rls.sql et sql/06_message_reactions.sql avant
// d'écrire ce fichier, pas supposé.
//
// Point vérifié explicitement avant d'écrire fetchMessages : `messages.author_id` et
// `members.user_id` référencent chacun auth.users séparément, AUCUNE FK ne relie directement
// `messages` à `members` — PostgREST ne peut donc pas faire de jointure imbriquée en un seul
// select, exactement la même contrainte déjà rencontrée pour event_participants/members dans
// agendaApi.js. D'où les lectures séparées ci-dessous, fusionnées en mémoire côté client.

import { supabase } from './supabaseClient';
import { localIso } from './localDate.js';
import { avatarColorFor, initialsOf } from './avatarColor.js';

// ---------------------------------------------------------------------------
// P2 — Lecture réelle, auteurs résolus, réactions résolues (table normalisée
// message_reactions, jamais la colonne historique messages.reactions).
// ---------------------------------------------------------------------------
export async function fetchMessages(communityId) {
  const { data: rows, error } = await supabase
    .from('messages')
    .select('id, author_id, text, linked_event_id, created_at')
    .eq('community_id', communityId)
    .order('created_at', { ascending: true });
  if (error) throw error;

  const { data: reactionRows, error: reactionsErr } = await supabase
    .from('message_reactions')
    .select('message_id, user_id, emoji')
    .eq('community_id', communityId);
  if (reactionsErr) throw reactionsErr;

  // Une seule lecture `members` pour résoudre à la fois les auteurs de messages ET les
  // auteurs de réactions ("qui a réagi") — évite deux allers-retours réseau séparés pour la
  // même table.
  const authorIds = rows.map((m) => m.author_id);
  const reactorIds = reactionRows.map((r) => r.user_id);
  const allUserIds = [...new Set([...authorIds, ...reactorIds])];
  let namesByUserId = {};
  if (allUserIds.length > 0) {
    const { data: members, error: membersErr } = await supabase
      .from('members')
      .select('user_id, display_name')
      .eq('community_id', communityId)
      .in('user_id', allUserIds);
    if (membersErr) throw membersErr;
    namesByUserId = Object.fromEntries(members.map((m) => [m.user_id, m.display_name]));
  }
  // Repli défensif volontaire (même garde-fou que agendaApi.js) : jamais de fragment d'UUID,
  // jamais d'email, jamais de donnée issue de auth.users — uniquement members.display_name ou
  // le libellé neutre "Membre" si le profil est incomplet (display_name NULL/vide) ou si la
  // ligne members correspondante n'a pas pu être résolue.
  function displayNameOf(userId) {
    return namesByUserId[userId] || 'Membre';
  }

  const reactionsByMessage = new Map();
  for (const r of reactionRows) {
    if (!reactionsByMessage.has(r.message_id)) reactionsByMessage.set(r.message_id, []);
    reactionsByMessage.get(r.message_id).push({
      userId: r.user_id,
      displayName: displayNameOf(r.user_id),
      emoji: r.emoji,
    });
  }

  return rows.map((m) => {
    const displayName = displayNameOf(m.author_id);
    // `created_at` est un timestamptz (instant réel, avec fuseau) — `new Date(...)` le
    // convertit déjà correctement vers l'heure LOCALE du navigateur ; `localIso` (même module
    // que le reste du projet, brief §13/bug La Réunion déjà corrigé ailleurs) en dérive la
    // date calendaire locale pour les séparateurs Aujourd'hui/Hier/date complète.
    const created = new Date(m.created_at);
    return {
      id: m.id,
      // Conservé dans le modèle client (brief P2) pour isMine/permissions — jamais affiché
      // tel quel dans l'interface (voir Messages.jsx : seul `author`, le nom résolu, est rendu).
      authorId: m.author_id,
      author: displayName,
      initials: initialsOf(displayName),
      color: avatarColorFor(m.author_id),
      text: m.text,
      date: localIso(created),
      time: created.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }),
      reactions: reactionsByMessage.get(m.id) || [],
      linkedEventId: m.linked_event_id,
    };
  });
}

// ---------------------------------------------------------------------------
// P3 — Envoi. `authorId` vient TOUJOURS de l'appelant (App.jsx, depuis `currentUserId` =
// session.user.id réelle) — jamais d'une valeur saisie côté interface. La policy
// `insert_own_message` (sql/02_rls.sql) l'exigerait de toute façon (author_id = auth.uid()),
// mais on ne compte pas sur RLS pour rattraper un payload qui tenterait de fournir un autre
// auteur : le texte normalisé (trim) est déjà appliqué ici, la validation "non vide" reste
// côté appelant (App.jsx) pour rester la même responsabilité qu'ailleurs dans le projet.
// ---------------------------------------------------------------------------
export async function sendMessage(communityId, authorId, { text, linkedEventId }) {
  const { error } = await supabase.from('messages').insert([{
    community_id: communityId,
    author_id: authorId,
    text: (text || '').trim(),
    linked_event_id: linkedEventId || null,
  }]);
  if (error) throw error;
}

// V7.12 — modification/suppression réelles. Les policies RLS existantes restent la source
// d'autorité : seul l'auteur peut modifier son texte ; l'auteur ou un admin peut supprimer.
// `.select()` permet de distinguer une mutation réellement appliquée d'une requête filtrée à
// zéro ligne par RLS, que PostgREST ne considère pas comme une erreur réseau.
export async function updateMessageText(messageId, text) {
  const { data, error } = await supabase
    .from('messages')
    .update({ text: (text || '').trim() })
    .eq('id', messageId)
    .select('id');
  if (error) throw error;
  if (!data || data.length === 0) {
    const err = new Error("La modification n'a pas été appliquée.");
    err.code = 'UPDATE_NOT_APPLIED';
    throw err;
  }
}

export async function deleteMessage(messageId) {
  const { data, error } = await supabase
    .from('messages')
    .delete()
    .eq('id', messageId)
    .select('id');
  if (error) throw error;
  if (!data || data.length === 0) {
    const err = new Error("La suppression n'a pas été appliquée.");
    err.code = 'DELETE_NOT_APPLIED';
    throw err;
  }
}

// ---------------------------------------------------------------------------
// P4 — Lier/relier un message à un événement réel. La policy `update_own_message_or_admin`
// (sql/02_rls.sql) restreint déjà ceci à l'auteur du message ou un admin de la communauté —
// Messages.jsx ne propose ce bouton qu'à ces deux profils (brief : "l'interface ne doit pas
// proposer une action vouée à être refusée aux autres membres"), mais l'appel réseau lui-même
// reste protégé indépendamment par la RLS si jamais l'interface se trompait.
// Le trigger trg_check_message_event_link (sql/02_rls.sql, non modifié ici) reste la garantie
// serveur qu'on ne peut lier qu'à un événement réel de la MÊME communauté, jamais à un
// rappel d'anniversaire — non dupliqué côté client.
// ---------------------------------------------------------------------------
export async function linkMessageToEvent(messageId, eventId) {
  const { error } = await supabase
    .from('messages')
    .update({ linked_event_id: eventId })
    .eq('id', messageId);
  if (error) throw error;
}

// ---------------------------------------------------------------------------
// P5 — Réactions. Taper sa PROPRE pastille la retire ; choisir un autre émoji (sur sa propre
// pastille ou sur celle de quelqu'un d'autre) ajoute/remplace SA PROPRE réaction — jamais celle
// d'autrui, la policy `update_own_reaction`/`insert_own_reaction` (sql/06) l'exigerait de toute
// façon. Un REMPLACEMENT utilise UPDATE (seul `emoji` change) plutôt que DELETE+INSERT — c'est
// précisément ce que le trigger d'immuabilité (sql/06, protect_reaction_identity) autorise et
// ce que le brief demande explicitement ("seul emoji peut changer lors d'un remplacement").
// ---------------------------------------------------------------------------
export async function toggleMessageReaction(messageId, communityId, userId, emoji) {
  const { data: existing, error: selErr } = await supabase
    .from('message_reactions')
    .select('id, emoji')
    .eq('message_id', messageId)
    .eq('user_id', userId)
    .maybeSingle();
  if (selErr) throw selErr;

  if (existing) {
    if (existing.emoji === emoji) {
      const { error } = await supabase.from('message_reactions').delete().eq('id', existing.id);
      if (error) throw error;
    } else {
      const { error } = await supabase.from('message_reactions').update({ emoji }).eq('id', existing.id);
      if (error) throw error;
    }
    return;
  }
  const { error } = await supabase
    .from('message_reactions')
    .insert([{ message_id: messageId, community_id: communityId, user_id: userId, emoji }]);
  if (error) throw error;
}

// ---------------------------------------------------------------------------
// P6 — Realtime, filtré par communauté quand le filtre est supporté (syntaxe standard
// `column=eq.value` de Supabase Realtime, documentée et stable). Un seul canal pour les deux
// tables concernées (messages + message_reactions) — pas deux abonnements séparés à gérer côté
// appelant. `onChange` ne reçoit AUCUNE donnée de la charge utile : le contrat volontaire est
// "quelque chose a changé, recharge l'état qui fait foi" (brief : "un rechargement fiable de
// la liste plutôt qu'un assemblage local"), jamais une fusion locale du payload reçu — même
// principe que agendaApi.js, qui ne fait pas de temps réel du tout et recharge après chaque
// mutation. Nom de canal qualifié par communityId : deux communautés actives (deux onglets,
// deux sessions) n'entrent jamais en collision sur le même nom de canal Supabase.
// App.jsx est responsable de recréer cet abonnement au changement de communauté et de le
// nettoyer au démontage/déconnexion (voir l'effet dédié dans App.jsx) — ce module ne fait que
// fournir la fonction de (dés)abonnement, jamais sa propre gestion de cycle de vie React.
// ---------------------------------------------------------------------------
export function subscribeToMessages(communityId, onChange) {
  const channel = supabase
    .channel(`abczed-messages-${communityId}`)
    .on(
      'postgres_changes',
      { event: '*', schema: 'public', table: 'messages', filter: `community_id=eq.${communityId}` },
      // Garde-fou défensif supplémentaire, indépendant du filtre serveur ci-dessus (brief :
      // "les notifications d'une autre communauté ne modifient jamais le fil courant") — si le
      // filtre Realtime n'était pour une raison quelconque pas appliqué par le service, cette
      // vérification côté client empêche quand même une notification étrangère de déclencher
      // un rechargement pour la mauvaise communauté.
      (payload) => {
        const row = payload.new || payload.old;
        if (row && row.community_id && row.community_id !== communityId) return;
        onChange();
      },
    )
    .on(
      'postgres_changes',
      { event: '*', schema: 'public', table: 'message_reactions', filter: `community_id=eq.${communityId}` },
      (payload) => {
        const row = payload.new || payload.old;
        if (row && row.community_id && row.community_id !== communityId) return;
        onChange();
      },
    )
    .subscribe();
  return () => supabase.removeChannel(channel);
}
