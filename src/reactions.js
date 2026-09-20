// Brief pts 26-28, arbitrage D3 : les réactions aux messages passent d'un compteur statique
// {emoji, count} à un modèle enrichi par personne {userId, displayName, emoji}. Le compte
// affiché et l'état "j'ai réagi" sont TOUJOURS dérivés de cette liste par les fonctions
// ci-dessous, jamais stockés séparément — impossible que "count" et la liste réelle des
// personnes divergent, contrairement à l'ancien modèle où rien ne garantissait leur cohérence.
// Fonctions pures, sans appel réseau ici (voir scripts/test-reactions.mjs) : `reactionSummary`
// reste utilisée telle quelle par Messages.jsx pour l'affichage, quelle que soit la provenance
// de `reactions` (V7.7 : table normalisée message_reactions, résolue par messagesApi.js — plus
// une donnée de démonstration locale). `toggleReaction`, elle, n'est plus appelée par
// l'application depuis V7.7 (le chemin réel passe par un aller-retour serveur, voir
// App.jsx/messagesApi.toggleMessageReaction) — conservée et toujours testée pour son usage
// antérieur, sans lien avec le nouveau chemin réel.

export const REACTION_EMOJIS = ['❤️', '👍', '😂', '😮', '😢'];

// Un message → un résumé par émoji, prêt à afficher : [{emoji, count, mine, people}].
// `people` (noms) alimente le "qui a réagi" (affiché via title/aria-label sur chaque pastille,
// accessible au clavier/lecteur d'écran comme au survol souris — pas de popover séparé pour
// cette version, ce serait une pièce d'UI en plus pour une information déjà consultable).
export function reactionSummary(reactions, myUserId) {
  const list = reactions || [];
  const byEmoji = new Map();
  for (const r of list) {
    if (!byEmoji.has(r.emoji)) byEmoji.set(r.emoji, []);
    byEmoji.get(r.emoji).push(r);
  }
  return [...byEmoji.entries()].map(([emoji, people]) => ({
    emoji,
    count: people.length,
    mine: people.some((p) => p.userId === myUserId),
    people: people.map((p) => p.displayName),
  }));
}

// Une personne n'a jamais plus d'une réaction active à la fois sur le même message (retire
// l'ancienne avant d'ajouter la nouvelle) — comportement standard de messagerie, non explicité
// dans le brief mais nécessaire pour éviter l'ambiguïté d'un empilement de réactions par la
// même personne sur le même message. Fonction pure : ne mute jamais le tableau reçu.
export function toggleReaction(reactions, { userId, displayName, emoji }) {
  const list = reactions || [];
  const mine = list.find((r) => r.userId === userId);
  const withoutMine = list.filter((r) => r.userId !== userId);
  if (mine && mine.emoji === emoji) return withoutMine; // re-tap sur sa propre réaction = la retirer
  return [...withoutMine, { userId, displayName, emoji }];
}
