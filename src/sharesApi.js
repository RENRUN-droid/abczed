// Module dédié Partages (backlog point 4, session du 23 septembre) — même méthode que
// messagesApi.js/agendaApi.js/membersApi.js : jamais l'ancien src/api.js (author_name/
// member_name en texte libre, incompatibles avec le schéma sécurisé réel — voir le commentaire
// en tête de messagesApi.js). Contrat vérifié contre sql/02_rls.sql (table `shares` + ses 4
// policies + son trigger de liaison d'événement, tous déjà en place depuis un chantier
// antérieur mais jamais branchés côté appli) et sql/03_storage.sql (bucket privé
// `community-files`, déjà en place) avant d'écrire ce fichier — pas supposé.
//
// `shares.author_id` référence auth.users, AUCUNE FK directe vers `members` — mêmes lectures
// séparées fusionnées en mémoire côté client que messagesApi.js/agendaApi.js (PostgREST ne
// peut pas faire de jointure imbriquée entre deux tables qui référencent chacune séparément
// auth.users).

import { supabase } from './supabaseClient';

// Limite raisonnable côté client, avant même de tenter l'upload — remplace l'ancienne limite
// de src/sharesStorage.js (1,5 Mo, qui n'existait que parce que la démonstration locale
// stockait les fichiers en `data:` URL dans localStorage, quota ~5 Mo par origine). Un vrai
// bucket Supabase Storage n'a pas cette contrainte ; 10 Mo reste un plafond raisonnable pour
// un document/une photo de famille sur une connexion mobile, pas une limite technique réelle
// du bucket lui-même (le bucket `community-files` n'a aucune limite de taille configurée côté
// Supabase pour l'instant — celle-ci est uniquement applicative, documentée ici).
export const MAX_SHARE_FILE_BYTES = 10_000_000; // ~10 Mo

// Une URL signée expire — voir SIGNED_URL_TTL_SECONDS ci-dessous. Limite connue et assumée
// (documentée dans MATRICE_LIVRAISON.md) : un onglet Partages resté ouvert plus d'une heure
// sans aucun rechargement peut présenter un lien "Ouvrir"/"Télécharger" expiré tant que la
// page n'a pas été rafraîchie ou que la communauté n'a pas été rechargée (changement d'onglet,
// mutation, écho Realtime) — jamais un fichier réellement perdu, seulement un lien à renouveler.
const SIGNED_URL_TTL_SECONDS = 3600; // 1h

// Convention de chemin FIGÉE par les policies déjà posées dans sql/03_storage.sql — segment
// [1] = community_id (vérifié par app_private.is_community_member), segment [2] = auth.uid()
// du déposant (vérifié littéralement à l'insertion). Documentée aussi en tête de
// sql/08_shares_storage.sql (colonne `shares.file_path`, jamais redéfinie ici, seulement
// appliquée) : {community_id}/{user_id}/{share_id}-{nom_original}.
//
// Correctif recette (23 sept., même session) : un nom de fichier réel contenant un accent
// et/ou une apostrophe (ex. "Capture d'écran 2026-07-31 081708.png", cas très courant en
// français) faisait échouer l'upload avec une erreur 400 côté stockage Supabase — confirmé en
// recette, via la console du navigateur. Le NOM AFFICHÉ dans l'app (`shares.file_name`, envoyé
// séparément par createShare/updateShare) reste inchangé, intact, avec accents et apostrophe ;
// seul ce nom TECHNIQUE, utilisé uniquement pour construire le chemin dans le bucket, est
// nettoyé — accents retirés (NFD + suppression des diacritiques), tout caractère hors
// lettres/chiffres/point/tiret/underscore remplacé par un underscore.
function safeStorageName(fileName) {
  return (fileName || 'fichier')
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/[^A-Za-z0-9._-]/g, '_');
}

function storagePathFor(communityId, userId, shareId, fileName) {
  const safeName = safeStorageName(fileName);
  return `${communityId}/${userId}/${shareId}-${safeName}`;
}

function formatBytes(n) {
  if (n == null) return null;
  if (n < 1024) return `${n} o`;
  if (n < 1024 * 1024) return `${Math.round(n / 1024)} Ko`;
  return `${(n / (1024 * 1024)).toFixed(1)} Mo`;
}

// ---------------------------------------------------------------------------
// Lecture — auteurs résolus (members.display_name, jamais un fragment d'e-mail/UUID, même
// garde-fou que messagesApi.js/agendaApi.js), URLs de fichiers résolues EN LOT (un seul aller-
// retour Storage pour tous les partages de la page, pas un par fichier — `createSignedUrls`,
// pluriel, plutôt que `createSignedUrl` répété).
//
// Champs de sortie délibérément nommés comme l'ancienne donnée de démonstration locale
// (`fileDataUrl` pour un document, `photoDataUrl` pour une photo) — Partages.jsx/shareDoc()
// n'ont ainsi PAS eu besoin d'être réécrits pour cette bascule : ce qui était une `data:` URL
// locale est désormais une vraie URL signée Supabase Storage, sous le même nom de champ.
// ---------------------------------------------------------------------------
export async function fetchShares(communityId) {
  const { data: rows, error } = await supabase
    .from('shares')
    .select('id, type, title, description, author_id, date, file_name, file_size, file_path, photo_count, link_url, domain, linked_event_id, created_at')
    .eq('community_id', communityId)
    .order('date', { ascending: false });
  if (error) throw error;

  const authorIds = [...new Set(rows.map((r) => r.author_id))];
  let namesByUserId = {};
  if (authorIds.length > 0) {
    const { data: memberRows, error: membersErr } = await supabase
      .from('members')
      .select('user_id, display_name')
      .eq('community_id', communityId)
      .in('user_id', authorIds);
    if (membersErr) throw membersErr;
    namesByUserId = Object.fromEntries(memberRows.map((m) => [m.user_id, m.display_name]));
  }
  // Repli défensif volontaire (même garde-fou que messagesApi.js/agendaApi.js) : jamais de
  // fragment d'UUID, jamais d'e-mail — uniquement members.display_name ou le libellé neutre
  // "Membre" si le profil est incomplet ou introuvable.
  function displayNameOf(userId) {
    return namesByUserId[userId] || 'Membre';
  }

  const pathsNeeded = rows.filter((r) => r.file_path).map((r) => r.file_path);
  let signedUrlByPath = {};
  if (pathsNeeded.length > 0) {
    const { data: signed, error: signErr } = await supabase.storage
      .from('community-files')
      .createSignedUrls(pathsNeeded, SIGNED_URL_TTL_SECONDS);
    if (signErr) throw signErr;
    // Un chemin individuellement en échec (fichier supprimé du bucket hors synchronisation
    // avec la ligne `shares`, cas limite) ne doit jamais faire échouer TOUTE la liste — url à
    // null pour CE partage seulement, jamais une exception qui viderait tout l'écran.
    signedUrlByPath = Object.fromEntries(
      (signed || []).map((s) => [s.path, s.error ? null : s.signedUrl]),
    );
  }

  return rows.map((r) => {
    const fileUrl = r.file_path ? (signedUrlByPath[r.file_path] ?? null) : null;
    return {
      id: r.id,
      type: r.type,
      title: r.title,
      description: r.description || '',
      authorId: r.author_id,
      author: displayNameOf(r.author_id),
      // `date` est une colonne `date` (pas timestamptz) — déjà au format ISO jour (YYYY-MM-DD)
      // attendu tel quel par fmtDate (Partages.jsx), aucune conversion de fuseau nécessaire.
      date: r.date,
      fileName: r.file_name,
      fileSize: r.file_size,
      filePath: r.file_path,
      fileDataUrl: r.type === 'document' ? fileUrl : undefined,
      photoDataUrl: r.type === 'photo' ? fileUrl : undefined,
      photoCount: r.photo_count,
      linkUrl: r.link_url,
      domain: r.domain,
      linkedEventId: r.linked_event_id,
    };
  });
}

// Upload réel du fichier vers le bucket privé `community-files`, AVANT l'écriture de la ligne
// `shares` — `shareId` est généré côté client (crypto.randomUUID()) précisément pour pouvoir
// construire le chemin final avant l'insertion, plutôt que de dépendre d'un id renvoyé après
// coup par la base.
async function uploadShareFile(communityId, userId, shareId, file) {
  const path = storagePathFor(communityId, userId, shareId, file.name);
  const { error } = await supabase.storage.from('community-files').upload(path, file, { upsert: false });
  if (error) throw error;
  return path;
}

// ---------------------------------------------------------------------------
// Création. `file` = objet File réel (input type=file, AddShareSheet.jsx) ou `null`/`undefined`
// pour un partage 'lien'/'info', qui n'en a jamais. `authorId` vient TOUJOURS de l'appelant
// (App.jsx, `currentUserId` = session.user.id réelle) — jamais saisi côté interface ; la policy
// `insert_own_share` (sql/02_rls.sql) l'exigerait de toute façon.
// ---------------------------------------------------------------------------
export async function createShare(communityId, authorId, payload, file) {
  const id = crypto.randomUUID();
  const filePath = file ? await uploadShareFile(communityId, authorId, id, file) : null;
  const row = {
    id,
    community_id: communityId,
    type: payload.type,
    title: payload.title,
    description: payload.description || '',
    author_id: authorId,
    file_name: file ? file.name : null,
    file_size: file ? formatBytes(file.size) : null,
    file_path: filePath,
    photo_count: payload.type === 'photo' ? 1 : null,
    link_url: payload.type === 'lien' ? payload.linkUrl : null,
    domain: payload.type === 'lien' ? payload.domain : null,
    linked_event_id: payload.linkedEventId || null,
  };
  const { error } = await supabase.from('shares').insert([row]);
  if (error) throw error;
}

// ---------------------------------------------------------------------------
// Modification. Les policies RLS existantes restent la source d'autorité (auteur ou admin de
// la communauté seulement — `update_own_share_or_admin`). `file` non nul = remplacement réel :
// le nouveau fichier est déposé sous un chemin distinct AVANT l'update de la ligne, et l'ANCIEN
// fichier n'est supprimé du bucket qu'APRÈS le succès de cet update — jamais l'inverse, pour ne
// jamais perdre le fichier existant si l'update échoue en cours de route (ex. RLS refuse).
// `previousFilePath` est transmis explicitement par l'appelant (App.jsx, depuis l'état `shares`
// déjà chargé) plutôt que relu ici, pour ne pas ajouter un aller-retour réseau supplémentaire.
// ---------------------------------------------------------------------------
export async function updateShare(shareId, communityId, authorId, payload, file, previousFilePath) {
  const patch = {
    title: payload.title,
    description: payload.description || '',
    linked_event_id: payload.linkedEventId || null,
  };
  if (payload.type === 'lien') {
    patch.link_url = payload.linkUrl;
    patch.domain = payload.domain;
  }
  if (file) {
    patch.file_path = await uploadShareFile(communityId, authorId, shareId, file);
    patch.file_name = file.name;
    patch.file_size = formatBytes(file.size);
  }
  const { data, error } = await supabase.from('shares').update(patch).eq('id', shareId).select('id');
  if (error) throw error;
  if (!data || data.length === 0) {
    const err = new Error("La modification n'a pas été appliquée.");
    err.code = 'UPDATE_NOT_APPLIED';
    throw err;
  }
  if (file && previousFilePath) {
    // Best effort délibéré — un échec de nettoyage ne fait jamais échouer une modification déjà
    // appliquée avec succès (ligne déjà à jour) ; un fichier orphelin dans le bucket reste un
    // défaut mineur de nettoyage, jamais une perte de donnée pour l'utilisateur.
    await supabase.storage.from('community-files').remove([previousFilePath]).catch(() => {});
  }
}

// Suppression. Même raisonnement que la modification : la ligne `shares` est supprimée
// d'abord (RLS = source d'autorité), le fichier associé n'est retiré du bucket qu'ensuite, en
// best effort — jamais l'inverse (un fichier supprimé puis un refus RLS sur la ligne laisserait
// une ligne orpheline pointant vers rien).
export async function deleteShare(shareId, filePath) {
  const { data, error } = await supabase.from('shares').delete().eq('id', shareId).select('id');
  if (error) throw error;
  if (!data || data.length === 0) {
    const err = new Error("La suppression n'a pas été appliquée.");
    err.code = 'DELETE_NOT_APPLIED';
    throw err;
  }
  if (filePath) {
    await supabase.storage.from('community-files').remove([filePath]).catch(() => {});
  }
}

// Realtime — même principe que messagesApi.js/subscribeToMessages : un seul canal, filtré par
// communauté, contrat volontaire "quelque chose a changé, recharge l'état qui fait foi" (jamais
// de fusion locale du payload reçu). App.jsx est responsable du cycle de vie de cet abonnement
// (recréation au changement de communauté, nettoyage au démontage).
export function subscribeToShares(communityId, onChange) {
  const channel = supabase
    .channel(`abczed-shares-${communityId}`)
    .on(
      'postgres_changes',
      { event: '*', schema: 'public', table: 'shares', filter: `community_id=eq.${communityId}` },
      (payload) => {
        const row = payload.new || payload.old;
        if (row && row.community_id && row.community_id !== communityId) return;
        onChange();
      },
    )
    .subscribe();
  return () => supabase.removeChannel(channel);
}
