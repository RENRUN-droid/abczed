// V7.34 (25 sept.) — demande explicite de l'utilisatrice : pouvoir mettre une vraie photo sur
// son profil (jusqu'ici, uniquement un cercle de couleur avec l'initiale du prénom, partout).
//
// Trouvé en creusant AVANT d'écrire une ligne de code : le bucket Storage `avatars` et la
// colonne `members.avatar_url` existaient déjà intégralement depuis le chantier sécurité
// d'origine (sql/01_schema_and_helpers.sql, sql/03_storage.sql — bucket privé, policies
// select/insert/delete déjà posées, `grant select, update on members` déjà en place) — jamais
// utilisés par la moindre ligne d'interface jusqu'ici. Aucune requête SQL nécessaire pour cette
// fonctionnalité — troisième fois que ce schéma s'avère plus prêt que l'interface qui l'utilise
// (même constat que "Le p'tit billet" et "Retirer un membre").
//
// `avatar_url` stocke le CHEMIN dans le bucket (ex. "3f2a.../9c1b....jpg"), jamais une URL —
// le bucket est privé (policies scopées par dossier utilisateur + appartenance communautaire
// partagée), donc chaque affichage doit obtenir une URL signée temporaire à la demande, voir
// getAvatarSignedUrl() plus bas.
import { supabase } from './supabaseClient';

const AVATAR_BUCKET = 'avatars';
const SIGNED_URL_TTL_SECONDS = 3600;

function extensionOf(file) {
  const fromName = (file.name || '').split('.').pop();
  if (fromName && fromName.length <= 5 && /^[a-z0-9]+$/i.test(fromName)) return fromName.toLowerCase();
  return (file.type || '').split('/').pop() || 'jpg';
}

// Remplace la photo existante : supprime d'abord tout fichier déjà présent dans le dossier de
// l'utilisateur (la policy Storage n'autorise qu'un dossier par utilisateur, jamais plus d'une
// photo active à la fois — pas d'accumulation silencieuse au fil des changements), dépose la
// nouvelle sous un nom unique, puis met à jour `members.avatar_url`. `memberId` doit être le
// VRAI UUID `members.id` (voir memberDirectory.js#mapMemberRow, champ `rawId` — jamais la
// sentinelle 'mem-vous' utilisée ailleurs dans l'app pour l'affichage).
export async function uploadAvatar(userId, memberId, file) {
  const { data: existing } = await supabase.storage.from(AVATAR_BUCKET).list(userId);
  if (existing && existing.length > 0) {
    await supabase.storage.from(AVATAR_BUCKET).remove(existing.map((f) => `${userId}/${f.name}`));
  }

  const path = `${userId}/${crypto.randomUUID()}.${extensionOf(file)}`;
  const { error: uploadErr } = await supabase.storage.from(AVATAR_BUCKET).upload(path, file);
  if (uploadErr) throw uploadErr;

  const { error: updateErr } = await supabase.from('members').update({ avatar_url: path }).eq('id', memberId);
  if (updateErr) throw updateErr;

  return path;
}

// Retire la photo : supprime le fichier du bucket puis remet `avatar_url` à null (repli
// automatique sur le cercle de couleur/initiale, comportement d'origine — voir Avatar.jsx).
export async function removeAvatar(userId, memberId, currentPath) {
  if (currentPath) {
    await supabase.storage.from(AVATAR_BUCKET).remove([currentPath]);
  }
  const { error } = await supabase.from('members').update({ avatar_url: null }).eq('id', memberId);
  if (error) throw error;
}

// URL signée temporaire — jamais d'URL publique stockée ni réutilisée au-delà de sa durée de
// vie (bucket privé par design). Cache mémoire simple (perdu à chaque rechargement de page,
// donc toujours largement dans la fenêtre de validité d'1h) : évite de re-signer la même photo
// à chaque re-rendu quand elle apparaît plusieurs fois dans la même session (ex. La Bande).
const signedUrlCache = new Map();

export async function getAvatarSignedUrl(path) {
  if (!path) return null;
  if (signedUrlCache.has(path)) return signedUrlCache.get(path);
  const { data, error } = await supabase.storage.from(AVATAR_BUCKET).createSignedUrl(path, SIGNED_URL_TTL_SECONDS);
  if (error || !data?.signedUrl) return null;
  signedUrlCache.set(path, data.signedUrl);
  return data.signedUrl;
}
