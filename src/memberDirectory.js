// V7.18 — traduit une ligne réelle Supabase (`members`, avec `member_children`/`children`
// imbriqués via une vraie clé étrangère, voir sql/02_rls.sql) vers la forme attendue par
// LaBande.jsx/MemberDetail.jsx/Accueil.jsx, héritée de la donnée de démonstration
// (src/data.js : {id, firstName, lastName, avatarColor, relations}). Un seul point de
// traduction — évite de dupliquer cette logique dans les 3 pages qui consomment la liste des
// membres. Module volontairement pur (aucun accès à `supabase`/`window` ici, seulement
// avatarColorFor qui l'est déjà) — testable directement en Node, voir
// scripts/test-member-directory.mjs, même principe que agendaSearch.js/reactions.js.

import { avatarColorFor } from './avatarColor.js';

// Prénom = premier mot du nom affiché, nom = le reste — même heuristique simple que partout
// ailleurs dans ce projet pour un nom saisi librement (aucun champ "prénom"/"nom" séparé dans
// `members.display_name`). Un nom vide/absent retombe sur "Membre" plutôt qu'une chaîne vide
// affichée nue dans l'interface (carte La Bande, fiche membre).
export function splitDisplayName(displayName) {
  const name = (displayName || '').trim();
  if (!name) return { firstName: 'Membre', lastName: '' };
  const parts = name.split(/\s+/);
  return { firstName: parts[0], lastName: parts.slice(1).join(' ') };
}

// `row.member_children` : embed PostgREST (member_children -> children, vraie FK) — chaque
// entrée devient une relation complète {childId, label, firstName, groupLabel}, déjà résolue
// (contrairement à la donnée de démonstration, qui ne stocke que {childId, label} et laisse
// data.js#childrenOf() résoudre contre CHILDREN — voir ce module pour la façade commune aux
// deux origines). `mc.children` peut être `null` si la ligne enfant a été supprimée entre-temps
// (FK ON DELETE CASCADE le rend en pratique impossible, filtré quand même par prudence).
export function mapMemberRow(row, currentUserId) {
  const { firstName, lastName } = splitDisplayName(row.display_name);
  const relations = (row.member_children || [])
    .filter((mc) => mc.children)
    .map((mc) => ({
      childId: mc.children.id,
      label: mc.label,
      firstName: mc.children.first_name,
      groupLabel: mc.children.group_label,
    }));
  return {
    // Même sentinelle 'mem-vous' que src/data.js : préserve tel quel le court-circuit "Mon
    // profil" déjà en place dans App.jsx (openMember) sans y toucher — ce module est le SEUL
    // endroit qui décide "est-ce moi ?", à partir du vrai user_id (jamais deviné ailleurs).
    id: row.user_id === currentUserId ? 'mem-vous' : row.id,
    // V7.33 (25 sept.) — le vrai UUID `members.id` était jusqu'ici PERDU pour soi-même (remplacé
    // ci-dessus par la sentinelle 'mem-vous'), alors que c'est précisément ce que
    // `member_children.member_id` exige pour qu'on puisse ajouter/retirer SES PROPRES enfants
    // (MyProfileSheet.jsx, src/childrenApi.js) — conservé ici sans toucher à `id`, pour ne
    // JAMAIS casser le court-circuit existant partout ailleurs dans l'app.
    rawId: row.id,
    userId: row.user_id,
    role: row.role,
    firstName,
    lastName,
    avatarColor: avatarColorFor(row.id),
    // V7.34 — chemin de la photo dans le bucket Storage privé `avatars`, ou `null` (jamais de
    // photo mise, ou retirée) — voir src/avatarApi.js/src/components/Avatar.jsx, qui résolvent
    // ce chemin en URL signée à l'affichage seulement.
    avatarUrl: row.avatar_url || null,
    // V7.37 — coordonnées de contact réelles + flags de partage indépendants. Noms de clé en
    // snake_case (au lieu du camelCase habituel de ce fichier) : c'est exactement la forme déjà
    // attendue par MemberDetail.jsx#CONTACT_METHODS (member[c.shareFlag]/member[c.valueField])
    // et par src/data.js (donnée de démonstration) — pas touché ici pour ne rien casser des deux
    // côtés déjà écrits contre ce contrat.
    phone_number: row.phone_number || null,
    email: row.email || null,
    share_whatsapp: !!row.share_whatsapp,
    share_phone: !!row.share_phone,
    share_sms: !!row.share_sms,
    share_email: !!row.share_email,
    relations,
  };
}

export function mapMemberRows(rows, currentUserId) {
  return rows
    .map((row) => mapMemberRow(row, currentUserId))
    .sort((a, b) => a.firstName.localeCompare(b.firstName, 'fr'));
}
