// V7.18 — lecture réelle de l'annuaire La Bande. Contrat vérifié contre sql/02_rls.sql avant
// d'écrire ce fichier (même méthode que agendaApi.js/messagesApi.js) : `member_children`
// référence `members(id)` et `children(id)` par de VRAIES clés étrangères (contrairement à
// messages.author_id/members.user_id, qui ne sont PAS liées entre elles) — un embed PostgREST
// imbriqué en un seul select est donc possible ici, pas besoin de fusionner deux lectures
// séparées côté client comme le fait messagesApi.js.
import { supabase } from './supabaseClient';
import { mapMemberRows } from './memberDirectory.js';

export async function fetchCommunityMembers(communityId, currentUserId) {
  const { data: rows, error } = await supabase
    .from('members')
    .select('id, user_id, display_name, role, avatar_url, member_children(label, children(id, first_name, group_label))')
    .eq('community_id', communityId)
    .eq('status', 'active');
  if (error) throw error;
  return mapMemberRows(rows || [], currentUserId);
}

// V7.30 (25 sept.) — "Retirer un membre" (admin). Le champ `status` existe depuis l'origine du
// schéma (sql/01_schema_and_helpers.sql, contrainte 'invited'|'active'|'removed') et TOUT le
// reste du système en dépend déjà : app_private.is_community_member()/is_community_admin() ne
// considèrent que status='active', donc un membre passé à 'removed' perd instantanément l'accès
// à toute la communauté (messages, partages, agenda, billet) — sans rien à changer ailleurs.
// fetchCommunityMembers() ci-dessus filtre déjà `.eq('status', 'active')`, donc un membre
// retiré disparaît aussi immédiatement de La Bande pour tout le monde, admin compris.
// Suppression volontairement PAS utilisée (delete) : `grant` sur `members` n'autorise que
// select/update au client (sql/02_rls.sql) — le retrait est une désactivation, jamais un vrai
// DELETE, pour ne jamais casser un ancien message/partage qui référence cette personne comme
// auteur (messages.author_id/shares.author_id pointent vers auth.users, jamais vers members).
// Droit déjà vérifié : policy "update_own_display_fields_or_admin" (sql/02_rls.sql) autorise un
// admin à modifier n'importe quelle ligne membre de SA communauté ; le trigger
// protect_sensitive_member_columns (sql/01_schema_and_helpers.sql) réserve déjà le changement
// de `status` aux seuls admins — aucune nouvelle règle SQL nécessaire pour cette fonctionnalité.
export async function removeMember(memberId) {
  const { error } = await supabase
    .from('members')
    .update({ status: 'removed' })
    .eq('id', memberId);
  if (error) throw error;
}
