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

// ---------------------------------------------------------------------------
// V7.46 (26 sept.) — un parent (admin ou non) propose une invitation, l'admin valide/refuse,
// puis le PARRAIN lui-même génère et envoie le lien une fois approuvé (jamais l'admin — voir
// sql/17_invitation_requests.sql pour le détail de ce choix). Vocabulaire d'interface volontaire
// : ces fonctions s'appellent "invitation_requests" en base, mais Messages.jsx/InviteParentSheet.jsx
// n'affichent jamais le mot "parrainage" — toujours "Inviter un parent", même libellé qu'avant.
// ---------------------------------------------------------------------------

// N'importe quel membre actif (admin ou non) — vérifié CÔTÉ SERVEUR par request_invitation()
// elle-même (is_community_member), jamais seulement supposé par l'interface.
export async function requestInvitation(communityId, email, name) {
  const { data: requestId, error } = await supabase.rpc('request_invitation', {
    p_community_id: communityId,
    p_email: email.trim().toLowerCase(),
    p_name: (name || '').trim() || null,
  });
  if (error) throw error;
  return requestId;
}

// Admin uniquement (RLS : sponsor_user_id = auth.uid() OU is_community_admin ci-dessous, voir
// sql/17) — ne renvoie ici que les demandes encore À TRANCHER, jamais l'historique déjà décidé
// (pas utile pour l'écran de validation, qui n'a besoin que de ce qui reste à faire).
export async function fetchPendingInvitationRequests(communityId) {
  const { data, error } = await supabase
    .from('invitation_requests')
    .select('id, sponsor_user_id, invited_email, invited_name, created_at')
    .eq('community_id', communityId)
    .eq('status', 'pending')
    .order('created_at', { ascending: true });
  if (error) throw error;
  return data || [];
}

// Revérifié CÔTÉ SERVEUR par approve_invitation_request() (is_community_admin) — ne génère
// AUCUN lien : voir le commentaire en tête de sql/17_invitation_requests.sql pour pourquoi.
export async function approveInvitationRequest(requestId) {
  const { error } = await supabase.rpc('approve_invitation_request', { p_request_id: requestId });
  if (error) throw error;
}

export async function rejectInvitationRequest(requestId) {
  const { error } = await supabase.rpc('reject_invitation_request', { p_request_id: requestId });
  if (error) throw error;
}

// Le parrain suit SES PROPRES demandes (RLS : sponsor_user_id = auth.uid() suffit déjà, mais on
// filtre aussi explicitement côté client — un admin qui a lui-même sponsorisé une demande ne
// doit voir ICI que les siennes, pas confondre avec la liste globale qu'il voit par ailleurs en
// tant qu'admin). Toutes statuts confondus (pending/approved/rejected) : le parrain doit pouvoir
// suivre où en est sa demande, pas seulement les approuvées.
export async function fetchMyInvitationRequests(communityId, userId) {
  const { data, error } = await supabase
    .from('invitation_requests')
    .select('id, invited_email, invited_name, status, invitation_id, created_at')
    .eq('community_id', communityId)
    .eq('sponsor_user_id', userId)
    .order('created_at', { ascending: false });
  if (error) throw error;
  return data || [];
}

// Appelée par le parrain lui-même une fois sa demande approuvée — c'est le SEUL moment où le
// jeton en clair existe, dans SA réponse à LUI (jamais celle de l'admin). Idempotente côté
// serveur (finalize_invitation_request refuse une seconde génération) — l'appelant (App.jsx)
// n'a donc besoin d'appeler ceci qu'une fois par demande approuvée, jamais en boucle.
export async function finalizeInvitationRequest(requestId) {
  const { data: token, error } = await supabase.rpc('finalize_invitation_request', { p_request_id: requestId });
  if (error) throw error;
  return buildInviteLink(token);
}
