-- ABCZed — V7.14 (phase 3, item 11) : préparation Supabase Storage réel pour Partages.
--
-- ============================================================================
-- NON EXÉCUTÉ PAR MOI CONTRE LE PROJET SUPABASE RÉEL DE L'UTILISATEUR. Ce fichier n'a été
-- vérifié que par relecture attentive (même style/idiomes que sql/04 à sql/07, qui ONT été
-- vérifiés contre un PostgreSQL local jetable dans des passes antérieures — voir
-- MATRICE_LIVRAISON.md) — il n'a PAS été rejoué contre une base réelle dans cette phase.
-- Fourni pour une future intégration réelle du stockage de fichiers, à appliquer manuellement
-- par l'utilisateur (SQL editor du dashboard Supabase, comme les migrations précédentes) une
-- fois qu'il aura décidé d'activer vraiment l'upload de fichiers. Ne touche à AUCUNE table ni
-- policy existante — additif uniquement (ADD COLUMN IF NOT EXISTS / policies nouvelles avec
-- garde d'idempotence). BUSINESS_DATA_FROM_SUPABASE reste à `false` dans le code
-- (src/dataSourceFlags.js, non modifié par cette phase) tant que ce fichier n'a pas été
-- appliqué ET que Partages.jsx/AddShareSheet.jsx n'ont pas été rebranchés dessus (hors
-- périmètre de cette phase — la persistance ajoutée ici côté client reste `localStorage`,
-- voir src/sharesStorage.js).
-- ============================================================================
--
-- CONSTAT IMPORTANT, avant d'écrire quoi que ce soit — évite de dupliquer un travail déjà fait :
-- la table `shares` (type/title/description/author_id/date/file_name/file_size/photo_count/
-- link_url/domain/linked_event_id/community_id/created_at), son trigger de cohérence
-- "linked_event_id doit être un événement réel de la même communauté, jamais un anniversaire"
-- (`trg_shares_event_link`), son trigger d'immutabilité d'identité
-- (`trg_protect_share_identity`), ET ses 4 policies RLS scoped par communauté (lecture membre,
-- insertion par l'auteur authentifié seul, modification auteur-ou-admin, suppression
-- auteur-ou-admin — `select_shares_same_community` / `insert_own_share` /
-- `update_own_share_or_admin` / `delete_own_share_or_admin`) existent déjà intégralement dans
-- `sql/02_rls.sql` (lignes ~73-88 pour la table, ~130-140 pour les triggers, ~323-338 pour les
-- policies). Le bucket Storage privé `community-files` (documents/photos de Partages,
-- distinct du bucket `avatars`) et ses 3 policies (lecture par tout membre de la communauté du
-- dossier, insertion dans SON PROPRE sous-dossier uniquement, suppression par le déposant ou un
-- admin) existent déjà intégralement dans `sql/03_storage.sql` — jamais recopiés ici.
--
-- Ce qui manque RÉELLEMENT pour qu'un vrai upload fonctionne bout en bout : `shares` a bien
-- `file_name`/`file_size` (métadonnées descriptives, déjà utilisées par le mode démonstration
-- local actuel), mais AUCUNE colonne ne référence où le fichier est réellement stocké dans le
-- bucket `community-files` — c'est la seule chose que ce fichier ajoute.

-- ---------------------------------------------------------------------------
-- Colonne de référence Storage — un seul chemin, réutilisé pour un document OU une photo (le
-- bucket `community-files` ne distingue déjà pas les deux, voir son commentaire d'en-tête dans
-- sql/03_storage.sql : "documents/photos de Partages"). `null` pour un partage de type 'lien'
-- ou 'info', qui n'a jamais de fichier.
-- ---------------------------------------------------------------------------
alter table shares add column if not exists file_path text;

-- ---------------------------------------------------------------------------
-- Convention de chemin — DOIT rester cohérente avec les policies DÉJÀ POSÉES dans
-- sql/03_storage.sql pour le bucket `community-files`, qui attendent very précisément :
--   segment [1] du chemin = community_id (vérifié par app_private.is_community_member)
--   segment [2] du chemin = auth.uid() du déposant (vérifié littéralement à l'insertion)
-- Documenté ici plutôt que redéfini : `{community_id}/{user_id}/{share_id}-{nom_original}` —
-- le préfixe `{share_id}-` (pas un sous-dossier séparé) évite une collision entre deux
-- fichiers de même nom déposés par le même utilisateur, sans introduire un 3e segment qui
-- casserait les policies existantes (qui ne lisent que les segments [1] et [2]).
-- Exemple : 3f2a.../8b91.../a10c-autorisation-piscine.pdf
--
-- Contrainte de forme minimale — au moins 3 segments non vides séparés par '/', jamais un
-- chemin vide ni un chemin à un seul segment qui ne pointerait vers rien de valide dans le
-- bucket. Ne vérifie PAS que le fichier existe réellement dans storage.objects (une vérification
-- d'existence relève de l'application/d'un trigger séparé si souhaité un jour, hors périmètre
-- ici) — seulement que la VALEUR, si renseignée, a une forme exploitable.
do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'shares_file_path_shape'
      -- Filtre explicite sur conrelid, pas seulement conname — même précaution que
      -- sql/05_participant_names.sql et sql/06_message_reactions.sql après la 2e
      -- contre-vérification indépendante (un homonyme sur une autre table ne doit jamais
      -- faire croire cette contrainte déjà posée ICI).
      and conrelid = 'public.shares'::regclass
  ) then
    alter table shares add constraint shares_file_path_shape
      check (file_path is null or array_length(string_to_array(file_path, '/'), 1) >= 3);
  end if;
end $$;

-- Aucune policy Storage supplémentaire nécessaire : `community-files` (sql/03_storage.sql)
-- couvre déjà exactement ce besoin (bucket privé, lecture par membre de la communauté du
-- dossier, insertion dans son propre sous-dossier, suppression par le déposant ou un admin).
-- Aucune policy RLS supplémentaire nécessaire sur `shares` non plus : `file_path` est une
-- colonne ordinaire de cette table, déjà couverte par les 4 policies existantes.

-- ---------------------------------------------------------------------------
-- Étapes côté application, PAS effectuées par ce fichier (rappel, pour la prochaine phase qui
-- brancherait réellement Storage) :
--   1. `BUSINESS_DATA_FROM_SUPABASE` (src/dataSourceFlags.js) passe à `true`.
--   2. AddShareSheet.jsx envoie le fichier réel vers
--      `supabase.storage.from('community-files').upload(path, file)` (au lieu de le lire en
--      `data:` URL et de le garder en localStorage, src/sharesStorage.js — ce module devient
--      alors inutile et pourrait être supprimé) puis enregistre `path` dans `shares.file_path`.
--   3. Partages.jsx résout une URL signée (`createSignedUrl`) à partir de `file_path` pour
--      Ouvrir/Télécharger, au lieu de `fileDataUrl`/`photoDataUrl` (mode démonstration local).
-- ---------------------------------------------------------------------------
