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

// V7.76 (11 oct.) — plafond CLIENT, uniquement pour afficher une erreur inline immédiate dans
// AddShareSheet.jsx sans attendre un aller-retour serveur ; la vraie limite qui compte est
// appliquée côté serveur par le trigger `app_private.check_share_files_limit()` (voir
// sql/22_share_files.sql) — cette constante doit juste rester EGALE à la valeur codée dans ce
// trigger, jamais une source de vérité à elle seule.
export const MAX_SHARE_FILES_COUNT = 10;

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

// V7.76 (11 oct.) — `fileId` ajouté à la convention de chemin pour permettre PLUSIEURS fichiers
// sous le même `shareId` sans collision (un seul fichier par partage jusqu'ici, un chemin par
// `shareId` suffisait). Reste À L'INTÉRIEUR du 3e segment du chemin (community_id/user_id/CECI) —
// voir le commentaire en tête de sql/22_share_files.sql : les policies Storage existantes
// (sql/03_storage.sql) ne lisent que les segments [1]/[2], jamais celui-ci, donc rien à y changer.
function storagePathFor(communityId, userId, shareId, fileId, fileName) {
  const safeName = safeStorageName(fileName);
  return `${communityId}/${userId}/${shareId}-${fileId}-${safeName}`;
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

  // V7.76 (11 oct.) — table `share_files` (voir sql/22_share_files.sql) : un partage peut
  // désormais avoir PLUSIEURS fichiers. Un seul aller-retour pour TOUS les partages de la page
  // (jamais un par partage) — même principe que la résolution des auteurs ci-dessus.
  const shareIds = rows.map((r) => r.id);
  let fileRowsByShareId = {};
  if (shareIds.length > 0) {
    const { data: fileRows, error: filesErr } = await supabase
      .from('share_files')
      .select('id, share_id, file_path, file_name, file_size, created_at')
      .in('share_id', shareIds)
      .order('created_at', { ascending: true });
    if (filesErr) throw filesErr;
    fileRowsByShareId = (fileRows || []).reduce((acc, f) => {
      (acc[f.share_id] = acc[f.share_id] || []).push(f);
      return acc;
    }, {});
  }

  // URLs signées en lot pour TOUS les chemins impliqués — les nouveaux (`share_files`) ET les
  // anciens (colonne `shares.file_path`, encore utilisée en repli pour un partage créé AVANT
  // cette migration, quand `share_files` est vide pour ce partage précis — voir le commentaire
  // en tête de sql/22_share_files.sql).
  const newPaths = Object.values(fileRowsByShareId).flat().map((f) => f.file_path);
  const legacyPaths = rows
    .filter((r) => r.file_path && !(fileRowsByShareId[r.id]?.length > 0))
    .map((r) => r.file_path);
  const pathsNeeded = [...new Set([...newPaths, ...legacyPaths])];
  let signedUrlByPath = {};
  if (pathsNeeded.length > 0) {
    const { data: signed, error: signErr } = await supabase.storage
      .from('community-files')
      .createSignedUrls(pathsNeeded, SIGNED_URL_TTL_SECONDS);
    if (signErr) throw signErr;
    // Un chemin individuellement en échec (fichier supprimé du bucket hors synchronisation
    // avec la ligne `shares`/`share_files`, cas limite) ne doit jamais faire échouer TOUTE la
    // liste — url à null pour CE fichier seulement, jamais une exception qui viderait tout
    // l'écran.
    signedUrlByPath = Object.fromEntries(
      (signed || []).map((s) => [s.path, s.error ? null : s.signedUrl]),
    );
  }

  return rows.map((r) => {
    const fileRows = fileRowsByShareId[r.id] || [];
    // Repli historique : partage créé AVANT cette migration (aucune ligne `share_files`), son
    // unique fichier vit encore dans les colonnes `shares.file_path`/`file_name`/`file_size` —
    // `id: null` le distingue d'un vrai fichier `share_files` (utile à AddShareSheet.jsx pour
    // savoir qu'il n'y a pas de ligne `share_files` à supprimer si celui-ci est retiré).
    const files = fileRows.length > 0
      ? fileRows.map((f) => ({
          id: f.id,
          name: f.file_name,
          size: f.file_size,
          path: f.file_path,
          url: signedUrlByPath[f.file_path] ?? null,
        }))
      : (r.file_path
          ? [{
              id: null,
              name: r.file_name,
              size: r.file_size,
              path: r.file_path,
              url: signedUrlByPath[r.file_path] ?? null,
            }]
          : []);

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
      // V7.76 — nouvelle source de vérité pour l'affichage (Partages.jsx) et l'édition
      // (AddShareSheet.jsx) : un tableau, jamais un fichier unique, même pour un partage qui n'en
      // a qu'un seul.
      files,
      // Champs conservés pour compatibilité (toujours dérivés de `files`, jamais relus
      // directement sur `r` — un partage multi-fichiers n'a plus de sens avec un seul "le"
      // fichier, mais rien ici ne doit planter pour un code pas encore adapté).
      fileName: files[0]?.name,
      fileSize: files[0]?.size,
      filePath: files[0]?.path,
      fileDataUrl: r.type === 'document' ? files[0]?.url : undefined,
      photoDataUrl: r.type === 'photo' ? files[0]?.url : undefined,
      photoCount: r.type === 'photo' ? files.length : null,
      linkUrl: r.link_url,
      domain: r.domain,
      linkedEventId: r.linked_event_id,
      // V7.75 (8 oct.) — ajouté pour le badge rouge (partages non lus, voir
      // fetchSharesLastReadAt/markSharesRead plus bas) : `created_at` était déjà sélectionné par
      // la requête ci-dessus mais jamais exposé dans l'objet mappé jusqu'ici (rien n'en avait
      // besoin avant). Même nom que messagesApi.js (`createdAtIso`) pour cohérence — un vrai
      // timestamptz, jamais `date` (colonne `date` sans heure, déjà utilisée pour l'affichage,
      // impropre à une comparaison "avant/après la dernière lecture").
      createdAtIso: r.created_at,
    };
  });
}

// Upload réel du fichier vers le bucket privé `community-files`, AVANT l'écriture de la ligne
// `shares` — `shareId` est généré côté client (crypto.randomUUID()) précisément pour pouvoir
// construire le chemin final avant l'insertion, plutôt que de dépendre d'un id renvoyé après
// coup par la base.
async function uploadShareFile(communityId, userId, shareId, fileId, file) {
  const path = storagePathFor(communityId, userId, shareId, fileId, file.name);
  const { error } = await supabase.storage.from('community-files').upload(path, file, { upsert: false });
  if (error) throw error;
  return path;
}

// ---------------------------------------------------------------------------
// Création. V7.76 (11 oct.) — `files` = tableau d'objets File réels (0 à MAX_SHARE_FILES_COUNT,
// AddShareSheet.jsx), `[]`/`undefined` pour un partage 'lien'/'info' (qui n'en a jamais) ou un
// partage 'document'/'photo' sans aucun fichier choisi (cas déjà empêché par la validation
// d'AddShareSheet.jsx, mais pas supposé ici). `authorId` vient TOUJOURS de l'appelant (App.jsx,
// `currentUserId` = session.user.id réelle) — jamais saisi côté interface ; la policy
// `insert_own_share` (sql/02_rls.sql) l'exigerait de toute façon.
// ---------------------------------------------------------------------------
export async function createShare(communityId, authorId, payload, files) {
  const id = crypto.randomUUID();
  const fileList = files || [];

  // Chaque fichier est déposé dans le bucket AVANT l'insertion de la ligne `shares` — même
  // ordre de prudence que l'ancien code à un seul fichier : jamais une ligne qui pointerait
  // vers un fichier pas encore réellement présent dans le bucket.
  const uploaded = [];
  for (const file of fileList) {
    const fileId = crypto.randomUUID();
    const path = await uploadShareFile(communityId, authorId, id, fileId, file);
    uploaded.push({ fileId, path, name: file.name, size: formatBytes(file.size) });
  }

  const row = {
    id,
    community_id: communityId,
    type: payload.type,
    title: payload.title,
    description: payload.description || '',
    author_id: authorId,
    // Colonnes historiques laissées à `null` pour tout NOUVEAU partage — `share_files`
    // ci-dessous est désormais l'unique source pour les fichiers, même quand il n'y en a qu'un
    // seul (voir le commentaire en tête de sql/22_share_files.sql).
    file_name: null,
    file_size: null,
    file_path: null,
    photo_count: payload.type === 'photo' ? uploaded.length : null,
    link_url: payload.type === 'lien' ? payload.linkUrl : null,
    domain: payload.type === 'lien' ? payload.domain : null,
    linked_event_id: payload.linkedEventId || null,
  };
  const { error } = await supabase.from('shares').insert([row]);
  if (error) throw error;

  if (uploaded.length > 0) {
    const fileRows = uploaded.map((u) => ({
      id: u.fileId,
      share_id: id,
      community_id: communityId,
      author_id: authorId,
      file_path: u.path,
      file_name: u.name,
      file_size: u.size,
    }));
    const { error: filesErr } = await supabase.from('share_files').insert(fileRows);
    if (filesErr) {
      // Best effort : la ligne `shares` déjà créée est retirée pour ne jamais laisser un
      // partage "vide" visible sans aucun des fichiers que l'utilisateur avait pourtant choisis
      // — jamais l'inverse (des fichiers orphelins dans le bucket, défaut mineur déjà accepté
      // ailleurs dans ce fichier, plutôt qu'une ligne trompeuse).
      await supabase.from('shares').delete().eq('id', id).catch(() => {});
      throw filesErr;
    }
  }
}

// ---------------------------------------------------------------------------
// Modification. Les policies RLS existantes restent la source d'autorité (auteur ou admin de
// la communauté seulement — `update_own_share_or_admin` pour la ligne `shares`,
// `delete_own_share_file_or_admin`/`insert_share_file_own_share_or_admin` pour `share_files`).
//
// `newFiles` = tableau d'objets File réels à AJOUTER. `removedFiles` = tableau d'éléments
// `{ id, path }` (tels que renvoyés par `files` dans fetchShares) à RETIRER — `id` vaut `null`
// pour un fichier encore porté par les colonnes historiques (repli pré-migration, voir
// fetchShares), auquel cas ces colonnes sont vidées sur la ligne `shares` elle-même plutôt que
// de chercher une ligne `share_files` inexistante.
//
// Ordre volontaire, même prudence que l'ancien code à un seul fichier : 1) l'update de la ligne
// `shares` (et le vidage des colonnes historiques si besoin) d'abord — seule source d'autorité
// RLS ; 2) suppression des lignes `share_files` retirées, SEULEMENT après ce succès ; 3) nettoyage
// best-effort du bucket pour tous les fichiers retirés ; 4) upload + insertion des nouveaux
// fichiers. Jamais de suppression de fichier AVANT la confirmation que la modification
// "principale" a bien été appliquée.
// ---------------------------------------------------------------------------
export async function updateShare(shareId, communityId, authorId, payload, newFiles, removedFiles) {
  const patch = {
    title: payload.title,
    description: payload.description || '',
    linked_event_id: payload.linkedEventId || null,
  };
  if (payload.type === 'lien') {
    patch.link_url = payload.linkUrl;
    patch.domain = payload.domain;
  }

  const removedList = removedFiles || [];
  const removedLegacy = removedList.filter((f) => f.id == null);
  const removedNew = removedList.filter((f) => f.id != null);
  if (removedLegacy.length > 0) {
    patch.file_path = null;
    patch.file_name = null;
    patch.file_size = null;
  }

  const { data, error } = await supabase.from('shares').update(patch).eq('id', shareId).select('id');
  if (error) throw error;
  if (!data || data.length === 0) {
    const err = new Error("La modification n'a pas été appliquée.");
    err.code = 'UPDATE_NOT_APPLIED';
    throw err;
  }

  if (removedNew.length > 0) {
    await supabase.from('share_files').delete().in('id', removedNew.map((f) => f.id)).catch(() => {});
  }
  // Nettoyage best-effort du bucket pour TOUS les fichiers retirés (legacy et nouveaux) — même
  // raisonnement "best effort" que partout ailleurs dans ce fichier : un fichier orphelin dans
  // le bucket est un défaut mineur de nettoyage, jamais une perte de donnée pour l'utilisateur.
  const removedPaths = removedList.map((f) => f.path).filter(Boolean);
  if (removedPaths.length > 0) {
    await supabase.storage.from('community-files').remove(removedPaths).catch(() => {});
  }

  const fileList = newFiles || [];
  if (fileList.length > 0) {
    const fileRows = [];
    for (const file of fileList) {
      const fileId = crypto.randomUUID();
      const path = await uploadShareFile(communityId, authorId, shareId, fileId, file);
      fileRows.push({
        id: fileId,
        share_id: shareId,
        community_id: communityId,
        author_id: authorId,
        file_path: path,
        file_name: file.name,
        file_size: formatBytes(file.size),
      });
    }
    const { error: filesErr } = await supabase.from('share_files').insert(fileRows);
    if (filesErr) throw filesErr;
  }
}

// Suppression. Même raisonnement que la modification : la ligne `shares` est supprimée
// d'abord (RLS = source d'autorité) — les lignes `share_files` disparaissent automatiquement
// (ON DELETE CASCADE, voir sql/22_share_files.sql) — puis TOUS les fichiers associés sont
// retirés du bucket, en best effort, jamais l'inverse (un fichier supprimé puis un refus RLS
// sur la ligne laisserait une ligne orpheline pointant vers rien). `filePaths` = tableau de
// chemins (tous les `files[].path` du partage côté appelant, App.jsx).
export async function deleteShare(shareId, filePaths) {
  const { data, error } = await supabase.from('shares').delete().eq('id', shareId).select('id');
  if (error) throw error;
  if (!data || data.length === 0) {
    const err = new Error("La suppression n'a pas été appliquée.");
    err.code = 'DELETE_NOT_APPLIED';
    throw err;
  }
  const paths = (filePaths || []).filter(Boolean);
  if (paths.length > 0) {
    await supabase.storage.from('community-files').remove(paths).catch(() => {});
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

// ---------------------------------------------------------------------------
// V7.75 (8 oct.) — Badge rouge sur la cloche, étendu aux partages (même demande/mécanisme que
// messagesApi.js V7.45 pour les messages — voir sql/21_shares_last_read.sql pour le détail des
// droits, déjà couverts, aucun grant/policy nouveau). Deux fonctions dédiées, même séparation de
// responsabilités que messagesApi.js vis-à-vis de membersApi.js : cette donnée (quand MOI j'ai
// ouvert Partages) n'a rien à voir avec l'annuaire La Bande.
// ---------------------------------------------------------------------------

// Lue une seule fois par changement de communauté/utilisateur (App.jsx) — `null` si la personne
// n'a jamais ouvert Partages de cette communauté (colonne par défaut `null`, voir
// sql/21_shares_last_read.sql), jamais une date arbitraire substituée ici.
export async function fetchSharesLastReadAt(communityId, userId) {
  const { data, error } = await supabase
    .from('members')
    .select('shares_last_read_at')
    .eq('community_id', communityId)
    .eq('user_id', userId)
    .eq('status', 'active')
    .maybeSingle();
  if (error) throw error;
  return data?.shares_last_read_at || null;
}

// Appelée par App.jsx à chaque fois que la vue Partages devient active. Filtre sur
// `user_id = userId` (jamais sur l'id de ligne members) — même policy "update_own_display_
// fields_or_admin" déjà en place que messagesApi.markMessagesRead.
export async function markSharesRead(communityId, userId) {
  const { error } = await supabase
    .from('members')
    .update({ shares_last_read_at: new Date().toISOString() })
    .eq('community_id', communityId)
    .eq('user_id', userId);
  if (error) throw error;
}
