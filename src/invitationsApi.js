// V7.18 — invitation par lien. Contrat vérifié contre sql/09_invitations.sql (fonctions SECURITY
// DEFINER create_invitation/get_invitation_preview/accept_invitation) avant d'écrire ce fichier,
// revérifié directement contre un PostgreSQL local jetable (voir le commentaire de tête de
// sql/09_invitations.sql) — pas seulement supposé correct.
// RÉVISION (2026-09-21) : `createInvitation` passait par un insert direct sur `invitations`
// (colonnes `token`/`invited_by`, schéma initialement supposé). La vraie table Supabase de
// l'utilisateur a un schéma différent et plus sûr (`token_hash`, jamais le jeton en clair) —
// la création passe désormais PAR la fonction `create_invitation` (RPC), jamais par un insert
// table direct (qui n'aurait de toute façon plus aucun droit, voir sql/09_invitations.sql).
import { supabase } from './supabaseClient';

// Impur (window.location) — volontairement pas dans memberDirectory.js/un futur module "pur"
// pour cette raison, contrairement à mapMemberRow (voir ce module pour la distinction).
export function buildInviteLink(token) {
  return `${window.location.origin}/invite/${token}`;
}

// Admin uniquement — vérifié CÔTÉ SERVEUR par create_invitation() elle-même (is_community_admin),
// jamais seulement supposé par l'interface. `invited_by`/`created_by` n'est jamais fourni par le
// client : la fonction utilise auth.uid() en interne, pas une valeur qu'on pourrait falsifier.
export async function createInvitation(communityId, email) {
  const { data: token, error } = await supabase.rpc('create_invitation', {
    p_community_id: communityId,
    p_email: email.trim().toLowerCase(),
  });
  if (error) throw error;
  return buildInviteLink(token);
}

// Lecture publique minimale (anon compris) pour afficher "tu es invité·e à rejoindre <X>" avant
// même que la personne ait un compte — get_invitation_preview() ne renvoie jamais que la ligne
// correspondant EXACTEMENT au token fourni (voir sql/09_invitations.sql).
export async function fetchInvitationPreview(token) {
  const { data, error } = await supabase.rpc('get_invitation_preview', { p_token: token });
  if (error) throw error;
  // Le RPC renvoie une table Postgres (donc toujours un tableau côté client) — jamais 0 ou
  // plusieurs lignes utiles ici (token = clé), `null` si le token est invalide/inconnu.
  const row = Array.isArray(data) ? data[0] : data;
  return row || null;
}

// Doit être appelé APRÈS qu'une session authentifiée existe (signUp/signIn réussi) — la
// fonction SQL elle-même refuse tout appel sans auth.uid() (voir sql/09_invitations.sql).
export async function acceptInvitation(token, displayName) {
  const { data, error } = await supabase.rpc('accept_invitation', { p_token: token, p_display_name: displayName });
  if (error) throw error;
  const row = Array.isArray(data) ? data[0] : data;
  return row || null;
}
