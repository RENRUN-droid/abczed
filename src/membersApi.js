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
    .select('id, user_id, display_name, role, member_children(label, children(id, first_name, group_label))')
    .eq('community_id', communityId)
    .eq('status', 'active');
  if (error) throw error;
  return mapMemberRows(rows || [], currentUserId);
}
