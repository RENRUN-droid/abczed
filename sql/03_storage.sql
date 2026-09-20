-- ABCZed — Étape 4/7 : Storage privé.
-- Deux buckets, comme validé : community-files (documents/photos de Partages, cycle de vie
-- communautaire) et avatars (photos de profil, cycle de vie individuel). Policies séparées
-- par bucket — un bucket mixte aurait rendu l'audit plus difficile, pas plus simple.

insert into storage.buckets (id, name, public)
values
  ('community-files', 'community-files', false),
  ('avatars', 'avatars', false)
on conflict (id) do update set public = false;  -- au cas où un bucket existant serait public

alter table storage.objects enable row level security;

-- ---------------------------------------------------------------------------
-- community-files — chemin obligatoire : community_id/user_id/uuid-nomfichier.ext
-- storage.foldername(name) retourne les segments de dossier, PAS le nom de fichier final :
-- segment [1] = community_id, segment [2] = user_id (celui qui a déposé le fichier).
-- ---------------------------------------------------------------------------

create policy "select_community_files_same_community" on storage.objects
  for select to authenticated
  using (
    bucket_id = 'community-files'
    and (select app_private.is_community_member((storage.foldername(name))[1]::uuid))
  );

create policy "insert_community_files_own_folder" on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'community-files'
    and (select app_private.is_community_member((storage.foldername(name))[1]::uuid))
    -- Le segment [2] du chemin DOIT être l'utilisateur qui dépose le fichier — sinon un
    -- membre pourrait déposer un fichier dans le dossier affiché comme appartenant à
    -- quelqu'un d'autre. Vérifié explicitement, pas supposé.
    and (storage.foldername(name))[2] = (select auth.uid())::text
  );

create policy "delete_community_files_owner_or_admin" on storage.objects
  for delete to authenticated
  using (
    bucket_id = 'community-files'
    and (
      (
        (storage.foldername(name))[2] = (select auth.uid())::text
        and (select app_private.is_community_member((storage.foldername(name))[1]::uuid))
      )
      or (select app_private.is_community_admin((storage.foldername(name))[1]::uuid))
    )
  );

-- Pas de policy UPDATE : remplacer un fichier = le supprimer puis en déposer un nouveau
-- (évite la question distincte d'un UPDATE qui changerait le propriétaire ou la communauté
-- encodés dans le chemin — même choix que pour les tables applicatives).

-- ---------------------------------------------------------------------------
-- avatars — chemin : user_id/uuid.ext. Cycle de vie individuel, pas communautaire :
-- le propriétaire gère tout ; la lecture est ouverte à quiconque partage une communauté
-- active avec lui (pas à n'importe quel utilisateur authentifié d'ABCZed).
-- ---------------------------------------------------------------------------

create policy "select_avatars_shared_community" on storage.objects
  for select to authenticated
  using (
    bucket_id = 'avatars'
    and (
      (
        (storage.foldername(name))[1] = (select auth.uid())::text
        and (select app_private.has_any_active_membership())
      )
      or (select app_private.shares_active_community_with((storage.foldername(name))[1]::uuid))
    )
  );

create policy "insert_own_avatar" on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'avatars'
    and (storage.foldername(name))[1] = (select auth.uid())::text
    and (select app_private.has_any_active_membership())
  );

create policy "delete_own_avatar" on storage.objects
  for delete to authenticated
  using (
    bucket_id = 'avatars'
    and (storage.foldername(name))[1] = (select auth.uid())::text
    and (select app_private.has_any_active_membership())
  );
