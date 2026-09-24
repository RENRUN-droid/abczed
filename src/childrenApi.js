// V7.33 (25 sept.) — jusqu'ici, `children`/`member_children` n'avaient aucun droit d'écriture
// côté client (sql/02_rls.sql : "grant select on children, member_children to authenticated —
// écriture volontairement absente en V1"). Demande explicite de l'utilisatrice après le premier
// partage réel : impossible de corriger soi-même un prénom d'enfant mal orthographié, ni
// d'ajouter/retirer un enfant sans repasser par une livraison de code. Trois opérations
// exposées ici, chacune couverte par sa policy dédiée — voir sql/11_enfants_en_libre_service.sql
// pour le détail des droits et le raisonnement de sécurité.
import { supabase } from './supabaseClient';

// Crée la ligne `children` PUIS le lien `member_children` — jamais l'inverse : un lien vers un
// enfant qui n'existe pas encore violerait sa clé étrangère. `memberId` doit être le VRAI UUID
// `members.id` (voir memberDirectory.js#mapMemberRow, champ `rawId` — jamais la sentinelle
// 'mem-vous' utilisée ailleurs dans l'app pour l'affichage).
export async function addChild(communityId, memberId, { firstName, groupLabel, label }) {
  const { data: child, error: childErr } = await supabase
    .from('children')
    .insert({ community_id: communityId, first_name: firstName, group_label: groupLabel || null })
    .select('id, first_name, group_label')
    .single();
  if (childErr) throw childErr;

  const { error: linkErr } = await supabase
    .from('member_children')
    .insert({ member_id: memberId, child_id: child.id, label });
  if (linkErr) throw linkErr;

  return { childId: child.id, firstName: child.first_name, groupLabel: child.group_label, label };
}

// Corrige le prénom/la classe d'un enfant auquel on est soi-même rattaché (ou dont on est
// l'administrateur de la communauté — voir la policy SQL). Un enfant peut avoir plusieurs
// parents rattachés (garde partagée) : ce champ est donc partagé entre eux, pas propre à
// chacun.
export async function updateChild(childId, { firstName, groupLabel }) {
  const { error } = await supabase
    .from('children')
    .update({ first_name: firstName, group_label: groupLabel || null })
    .eq('id', childId);
  if (error) throw error;
}

// Retire SON PROPRE lien vers un enfant — jamais un vrai DELETE sur la ligne `children`
// elle-même, qui romprait le lien d'un éventuel autre parent rattaché au même enfant. Une ligne
// `children` qui ne reste plus rattachée à personne devient simplement invisible partout (rien
// ne l'affiche sans passer par `member_children`) — même philosophie que "retirer un membre"
// (V7.30) : une désactivation du lien, jamais une suppression physique de la donnée partagée.
export async function removeChildLink(memberId, childId) {
  const { error } = await supabase
    .from('member_children')
    .delete()
    .eq('member_id', memberId)
    .eq('child_id', childId);
  if (error) throw error;
}
