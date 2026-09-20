// V7.7 (P2) : couleur d'avatar et initiales pour un message réel Supabase — dérivées côté
// client de `authorId` (uuid réel) et de `display_name` (members.display_name), jamais d'une
// nouvelle colonne arbitraire en base (brief explicite : "sans nouvelle colonne arbitraire").
// Fonctions pures, testables directement en Node (scripts/test-avatar-color.mjs), sur le même
// principe que src/agendaSearch.js/src/reactions.js.

// Palette reprise des teintes déjà utilisées par les avatars de démonstration (src/data.js,
// MEMBERS/GENERAL_THREAD) — cohérence visuelle avec le reste de l'application, complétée pour
// réduire les collisions de couleur entre membres distincts.
const AVATAR_PALETTE = [
  '#C9A6D4', '#E7A6B0', '#9BB7D4', '#9BD4C0', '#E7C89B',
  '#D4A69B', '#A6C9D4', '#D4C9A6', '#B8A6D4', '#A6D4B8',
];

// Hash déterministe simple (FNV-1a-like) : le même `id` produit TOUJOURS la même couleur, sur
// n'importe quel appareil/session, sans coordination serveur — condition nécessaire puisque
// rien n'est stocké en base pour ça. Pas destiné à une répartition cryptographiquement uniforme,
// seulement à une répartition visuelle raisonnable sur une petite palette fixe.
export function avatarColorFor(id) {
  const s = String(id || '');
  let hash = 2166136261;
  for (let i = 0; i < s.length; i++) {
    hash ^= s.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  const index = Math.abs(hash) % AVATAR_PALETTE.length;
  return AVATAR_PALETTE[index];
}

// Initiales dérivées du nom affiché (brief P2) : jusqu'à 2 lettres, une par mot (comme "SV"
// pour "Sabrina Vally" dans la donnée de démonstration existante) — jamais un fragment d'uuid,
// jamais une valeur inventée. '?' seulement si `displayName` est vide/absent (cas limite,
// jamais censé arriver puisque fetchMessages replie déjà sur 'Membre' avant d'appeler ceci).
export function initialsOf(displayName) {
  const name = (displayName || '').trim();
  if (!name) return '?';
  const parts = name.split(/\s+/).filter(Boolean);
  const letters = parts.slice(0, 2).map((p) => p[0].toUpperCase());
  return letters.join('') || '?';
}
