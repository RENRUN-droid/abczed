-- Tests Storage reproductibles — matrice demandée pour l'étape 4.
-- ATTENTION : storage.foldername() est ici SIMULÉ (voir tmp/setup_storage_sim.sql équivalent
-- documenté dans le README). Ce script valide la LOGIQUE des policies de 03_storage.sql,
-- pas le comportement exact de l'implémentation Supabase réelle — à rejouer sur un vrai
-- projet avant de considérer le Storage réellement verrouillé.

\set ON_ERROR_STOP on

reset role;
insert into communities (id, name) values
  ('11111111-1111-1111-1111-111111111111', 'Communauté A'),
  ('22222222-2222-2222-2222-222222222222', 'Communauté B')
on conflict do nothing;

insert into auth.users (id) values
  ('a0000000-0000-0000-0000-000000000001'), -- membre actif A
  ('a0000000-0000-0000-0000-000000000002'), -- admin A
  ('a0000000-0000-0000-0000-000000000003'), -- membre actif B
  ('a0000000-0000-0000-0000-000000000005')  -- authentifié SANS communauté
on conflict do nothing;

insert into members (community_id, user_id, role, status) values
  ('11111111-1111-1111-1111-111111111111', 'a0000000-0000-0000-0000-000000000001', 'member', 'active'),
  ('11111111-1111-1111-1111-111111111111', 'a0000000-0000-0000-0000-000000000002', 'admin', 'active'),
  ('22222222-2222-2222-2222-222222222222', 'a0000000-0000-0000-0000-000000000003', 'member', 'active')
on conflict do nothing;

-- Un fichier déjà déposé par A1, un autre par B3 (insérés directement, hors policy, pour
-- construire le jeu de données de lecture avant de tester les policies elles-mêmes).
reset role;
insert into storage.objects (bucket_id, name, owner) values
  ('community-files', '11111111-1111-1111-1111-111111111111/a0000000-0000-0000-0000-000000000001/doc-a.pdf', 'a0000000-0000-0000-0000-000000000001'),
  ('community-files', '22222222-2222-2222-2222-222222222222/a0000000-0000-0000-0000-000000000003/doc-b.pdf', 'a0000000-0000-0000-0000-000000000003');

-- =============================================================================
-- TEST S1 : A lit A -> 1 ligne visible
-- =============================================================================
set role authenticated;
select set_config('test.current_user_id', 'a0000000-0000-0000-0000-000000000001', false);
DO $$
DECLARE v_count int;
BEGIN
  select count(*) into v_count from storage.objects
    where bucket_id = 'community-files' and name like '11111111-1111-1111-1111-111111111111/%';
  IF v_count <> 1 THEN RAISE EXCEPTION 'TEST S1 ECHEC : attendu 1, obtenu %', v_count; END IF;
  RAISE NOTICE 'TEST S1 OK';
END $$;
reset role;

-- =============================================================================
-- TEST S2 : A ne lit pas B -> 0 ligne
-- =============================================================================
set role authenticated;
select set_config('test.current_user_id', 'a0000000-0000-0000-0000-000000000001', false);
DO $$
DECLARE v_count int;
BEGIN
  select count(*) into v_count from storage.objects
    where bucket_id = 'community-files' and name like '22222222-2222-2222-2222-222222222222/%';
  IF v_count <> 0 THEN RAISE EXCEPTION 'TEST S2 ECHEC : A voit % fichier(s) de B', v_count; END IF;
  RAISE NOTICE 'TEST S2 OK';
END $$;
reset role;

-- =============================================================================
-- TEST S3 : A ne peut pas uploader dans le dossier de B -> BLOQUÉ
-- =============================================================================
set role authenticated;
select set_config('test.current_user_id', 'a0000000-0000-0000-0000-000000000001', false);
DO $$
BEGIN
  insert into storage.objects (bucket_id, name, owner) values
    ('community-files', '22222222-2222-2222-2222-222222222222/a0000000-0000-0000-0000-000000000001/intrusion.pdf', 'a0000000-0000-0000-0000-000000000001');
  RAISE EXCEPTION 'TEST S3 ECHEC : upload dans B accepté' USING ERRCODE = 'TEST0';
EXCEPTION
  WHEN SQLSTATE 'TEST0' THEN RAISE;
  WHEN OTHERS THEN RAISE NOTICE 'TEST S3 OK : %', SQLERRM;
END $$;
reset role;

-- =============================================================================
-- TEST S4 (réciproque de S2/S3) : B ne lit pas A, ne peut pas uploader dans A
-- =============================================================================
set role authenticated;
select set_config('test.current_user_id', 'a0000000-0000-0000-0000-000000000003', false);
DO $$
DECLARE v_count int;
BEGIN
  select count(*) into v_count from storage.objects
    where bucket_id = 'community-files' and name like '11111111-1111-1111-1111-111111111111/%';
  IF v_count <> 0 THEN RAISE EXCEPTION 'TEST S4a ECHEC : B voit % fichier(s) de A', v_count; END IF;
  RAISE NOTICE 'TEST S4a OK';
END $$;
DO $$
BEGIN
  insert into storage.objects (bucket_id, name, owner) values
    ('community-files', '11111111-1111-1111-1111-111111111111/a0000000-0000-0000-0000-000000000003/intrusion.pdf', 'a0000000-0000-0000-0000-000000000003');
  RAISE EXCEPTION 'TEST S4b ECHEC : upload de B dans A accepté' USING ERRCODE = 'TEST0';
EXCEPTION
  WHEN SQLSTATE 'TEST0' THEN RAISE;
  WHEN OTHERS THEN RAISE NOTICE 'TEST S4b OK : %', SQLERRM;
END $$;
reset role;

-- =============================================================================
-- TEST S5 : sans membership -> rien
-- =============================================================================
set role authenticated;
select set_config('test.current_user_id', 'a0000000-0000-0000-0000-000000000005', false);
DO $$
DECLARE v_count int;
BEGIN
  select count(*) into v_count from storage.objects where bucket_id = 'community-files';
  IF v_count <> 0 THEN RAISE EXCEPTION 'TEST S5 ECHEC : % fichier(s) visibles sans membership', v_count; END IF;
  RAISE NOTICE 'TEST S5 OK';
END $$;
reset role;

-- =============================================================================
-- TEST S6 : removed -> rien (on retire A1 après coup, comme pour les tests RLS)
-- =============================================================================
set role authenticated;
select set_config('test.current_user_id', 'a0000000-0000-0000-0000-000000000002', false);
update members set status = 'removed' where user_id = 'a0000000-0000-0000-0000-000000000001';
reset role;
set role authenticated;
select set_config('test.current_user_id', 'a0000000-0000-0000-0000-000000000001', false);
DO $$
DECLARE v_count int;
BEGIN
  select count(*) into v_count from storage.objects
    where bucket_id = 'community-files' and name like '11111111-1111-1111-1111-111111111111/%';
  IF v_count <> 0 THEN RAISE EXCEPTION 'TEST S6 ECHEC : membre removed voit % fichier(s)', v_count; END IF;
  RAISE NOTICE 'TEST S6 OK';
END $$;
reset role;
-- remise en état
set role authenticated;
select set_config('test.current_user_id', 'a0000000-0000-0000-0000-000000000002', false);
update members set status = 'active' where user_id = 'a0000000-0000-0000-0000-000000000001';
reset role;

-- =============================================================================
-- TEST S7 : le propriétaire supprime son propre fichier -> réussit
-- =============================================================================
set role authenticated;
select set_config('test.current_user_id', 'a0000000-0000-0000-0000-000000000001', false);
insert into storage.objects (bucket_id, name, owner) values
  ('community-files', '11111111-1111-1111-1111-111111111111/a0000000-0000-0000-0000-000000000001/a-supprimer.pdf', 'a0000000-0000-0000-0000-000000000001');
DO $$
DECLARE v_rows int;
BEGIN
  delete from storage.objects
    where name = '11111111-1111-1111-1111-111111111111/a0000000-0000-0000-0000-000000000001/a-supprimer.pdf';
  GET DIAGNOSTICS v_rows = ROW_COUNT;
  IF v_rows <> 1 THEN RAISE EXCEPTION 'TEST S7 ECHEC : propriétaire n''a supprimé que % ligne(s)', v_rows; END IF;
  RAISE NOTICE 'TEST S7 OK';
END $$;
reset role;

-- =============================================================================
-- TEST S8 : un autre membre (non admin, non propriétaire) ne peut pas le supprimer
-- =============================================================================
set role authenticated;
select set_config('test.current_user_id', 'a0000000-0000-0000-0000-000000000001', false);
insert into storage.objects (bucket_id, name, owner) values
  ('community-files', '11111111-1111-1111-1111-111111111111/a0000000-0000-0000-0000-000000000001/proteger.pdf', 'a0000000-0000-0000-0000-000000000001');
reset role;
-- Un second membre normal de A, ni admin ni propriétaire.
insert into auth.users (id) values ('a0000000-0000-0000-0000-000000000007') on conflict do nothing;
insert into members (community_id, user_id, role, status) values
  ('11111111-1111-1111-1111-111111111111', 'a0000000-0000-0000-0000-000000000007', 'member', 'active')
on conflict do nothing;
set role authenticated;
select set_config('test.current_user_id', 'a0000000-0000-0000-0000-000000000007', false);
DO $$
DECLARE v_rows int;
BEGIN
  delete from storage.objects
    where name = '11111111-1111-1111-1111-111111111111/a0000000-0000-0000-0000-000000000001/proteger.pdf';
  GET DIAGNOSTICS v_rows = ROW_COUNT;
  IF v_rows <> 0 THEN RAISE EXCEPTION 'TEST S8 ECHEC : membre tiers a supprimé % ligne(s)', v_rows; END IF;
  RAISE NOTICE 'TEST S8 OK';
END $$;
reset role;

-- =============================================================================
-- TEST S9 : admin A peut modérer (supprimer) un fichier de A, mais pas de B
-- =============================================================================
set role authenticated;
select set_config('test.current_user_id', 'a0000000-0000-0000-0000-000000000002', false);
DO $$
DECLARE v_rows int;
BEGIN
  delete from storage.objects
    where name = '11111111-1111-1111-1111-111111111111/a0000000-0000-0000-0000-000000000001/proteger.pdf';
  GET DIAGNOSTICS v_rows = ROW_COUNT;
  IF v_rows <> 1 THEN RAISE EXCEPTION 'TEST S9a ECHEC : admin A n''a supprimé que % ligne(s) dans A', v_rows; END IF;
  RAISE NOTICE 'TEST S9a OK';
END $$;
DO $$
DECLARE v_rows int;
BEGIN
  delete from storage.objects
    where name = '22222222-2222-2222-2222-222222222222/a0000000-0000-0000-0000-000000000003/doc-b.pdf';
  GET DIAGNOSTICS v_rows = ROW_COUNT;
  IF v_rows <> 0 THEN RAISE EXCEPTION 'TEST S9b ECHEC : admin A a supprimé % ligne(s) dans B', v_rows; END IF;
  RAISE NOTICE 'TEST S9b OK';
END $$;
reset role;

-- =============================================================================
-- TEST S10 : usurpation du segment "propriétaire" dans le chemin à l'upload -> BLOQUÉ
-- (le coeur de la dernière remarque : le chemin doit être cohérent avec auth.uid(), pas
-- seulement la communauté)
-- =============================================================================
set role authenticated;
select set_config('test.current_user_id', 'a0000000-0000-0000-0000-000000000001', false);
DO $$
BEGIN
  insert into storage.objects (bucket_id, name, owner) values
    ('community-files', '11111111-1111-1111-1111-111111111111/a0000000-0000-0000-0000-000000000002/usurpation.pdf', 'a0000000-0000-0000-0000-000000000001');
  RAISE EXCEPTION 'TEST S10 ECHEC : upload avec segment propriétaire usurpé accepté' USING ERRCODE = 'TEST0';
EXCEPTION
  WHEN SQLSTATE 'TEST0' THEN RAISE;
  WHEN OTHERS THEN RAISE NOTICE 'TEST S10 OK : %', SQLERRM;
END $$;
reset role;

\echo '--- section community-files (S1-S10) terminée ---'

-- =============================================================================
-- TESTS AVATARS
-- =============================================================================

-- TEST S11 : authentifié SANS communauté -> upload avatar BLOQUÉ
set role authenticated;
select set_config('test.current_user_id', 'a0000000-0000-0000-0000-000000000005', false);
DO $$
BEGIN
  insert into storage.objects (bucket_id, name, owner) values
    ('avatars', 'a0000000-0000-0000-0000-000000000005/photo.jpg', 'a0000000-0000-0000-0000-000000000005');
  RAISE EXCEPTION 'TEST S11 ECHEC : upload avatar accepté sans aucune communauté' USING ERRCODE = 'TEST0';
EXCEPTION
  WHEN SQLSTATE 'TEST0' THEN RAISE;
  WHEN OTHERS THEN RAISE NOTICE 'TEST S11 OK : %', SQLERRM;
END $$;
reset role;

-- Préparer un avatar existant pour A1, avant de le retirer, pour tester les trois angles removed.
set role authenticated;
select set_config('test.current_user_id', 'a0000000-0000-0000-0000-000000000001', false);
insert into storage.objects (bucket_id, name, owner) values
  ('avatars', 'a0000000-0000-0000-0000-000000000001/photo.jpg', 'a0000000-0000-0000-0000-000000000001');
reset role;
set role authenticated;
select set_config('test.current_user_id', 'a0000000-0000-0000-0000-000000000002', false);
update members set status = 'removed' where user_id = 'a0000000-0000-0000-0000-000000000001';
reset role;

-- TEST S12 : removed -> lecture de son propre avatar = 0
set role authenticated;
select set_config('test.current_user_id', 'a0000000-0000-0000-0000-000000000001', false);
DO $$
DECLARE v_count int;
BEGIN
  select count(*) into v_count from storage.objects
    where bucket_id = 'avatars' and name = 'a0000000-0000-0000-0000-000000000001/photo.jpg';
  IF v_count <> 0 THEN RAISE EXCEPTION 'TEST S12 ECHEC : removed voit % ligne(s) de son avatar', v_count; END IF;
  RAISE NOTICE 'TEST S12 OK';
END $$;

-- TEST S13 : removed -> upload avatar BLOQUÉ
DO $$
BEGIN
  insert into storage.objects (bucket_id, name, owner) values
    ('avatars', 'a0000000-0000-0000-0000-000000000001/nouvelle-photo.jpg', 'a0000000-0000-0000-0000-000000000001');
  RAISE EXCEPTION 'TEST S13 ECHEC : removed a pu uploader un avatar' USING ERRCODE = 'TEST0';
EXCEPTION
  WHEN SQLSTATE 'TEST0' THEN RAISE;
  WHEN OTHERS THEN RAISE NOTICE 'TEST S13 OK : %', SQLERRM;
END $$;

-- TEST S14 : removed -> suppression de son avatar impossible
DO $$
DECLARE v_rows int;
BEGIN
  delete from storage.objects where bucket_id = 'avatars' and name = 'a0000000-0000-0000-0000-000000000001/photo.jpg';
  GET DIAGNOSTICS v_rows = ROW_COUNT;
  IF v_rows <> 0 THEN RAISE EXCEPTION 'TEST S14 ECHEC : removed a supprimé % ligne(s) de son avatar', v_rows; END IF;
  RAISE NOTICE 'TEST S14 OK';
END $$;
reset role;

-- Remise en état : A1 redevient actif pour les tests suivants.
set role authenticated;
select set_config('test.current_user_id', 'a0000000-0000-0000-0000-000000000002', false);
update members set status = 'active' where user_id = 'a0000000-0000-0000-0000-000000000001';
reset role;

-- TEST S15 : membre actif -> upload/lecture/suppression de son propre avatar OK
set role authenticated;
select set_config('test.current_user_id', 'a0000000-0000-0000-0000-000000000001', false);
DO $$
DECLARE v_count int; v_rows int;
BEGIN
  select count(*) into v_count from storage.objects
    where bucket_id = 'avatars' and name = 'a0000000-0000-0000-0000-000000000001/photo.jpg';
  IF v_count <> 1 THEN RAISE EXCEPTION 'TEST S15a ECHEC : lecture, attendu 1 obtenu %', v_count; END IF;
  RAISE NOTICE 'TEST S15a OK (lecture)';

  insert into storage.objects (bucket_id, name, owner) values
    ('avatars', 'a0000000-0000-0000-0000-000000000001/photo2.jpg', 'a0000000-0000-0000-0000-000000000001');
  RAISE NOTICE 'TEST S15b OK (upload)';

  delete from storage.objects where bucket_id = 'avatars' and name = 'a0000000-0000-0000-0000-000000000001/photo2.jpg';
  GET DIAGNOSTICS v_rows = ROW_COUNT;
  IF v_rows <> 1 THEN RAISE EXCEPTION 'TEST S15c ECHEC : suppression, attendu 1 ligne obtenu %', v_rows; END IF;
  RAISE NOTICE 'TEST S15c OK (suppression)';
END $$;
reset role;

-- TEST S16 : membre actif A voit l'avatar d'un autre membre actif de A (communauté partagée)
insert into auth.users (id) values ('a0000000-0000-0000-0000-000000000008') on conflict do nothing;
insert into members (community_id, user_id, role, status) values
  ('11111111-1111-1111-1111-111111111111', 'a0000000-0000-0000-0000-000000000008', 'member', 'active')
on conflict do nothing;
set role authenticated;
select set_config('test.current_user_id', 'a0000000-0000-0000-0000-000000000008', false);
insert into storage.objects (bucket_id, name, owner) values
  ('avatars', 'a0000000-0000-0000-0000-000000000008/photo.jpg', 'a0000000-0000-0000-0000-000000000008');
reset role;
set role authenticated;
select set_config('test.current_user_id', 'a0000000-0000-0000-0000-000000000001', false);
DO $$
DECLARE v_count int;
BEGIN
  select count(*) into v_count from storage.objects
    where bucket_id = 'avatars' and name = 'a0000000-0000-0000-0000-000000000008/photo.jpg';
  IF v_count <> 1 THEN RAISE EXCEPTION 'TEST S16 ECHEC : A1 voit % avatar(s) de A8 au lieu de 1', v_count; END IF;
  RAISE NOTICE 'TEST S16 OK';
END $$;
reset role;

-- TEST S17 : membre A ne voit PAS l'avatar d'un membre de B (aucune communauté commune)
set role authenticated;
select set_config('test.current_user_id', 'a0000000-0000-0000-0000-000000000003', false);
insert into storage.objects (bucket_id, name, owner) values
  ('avatars', 'a0000000-0000-0000-0000-000000000003/photo.jpg', 'a0000000-0000-0000-0000-000000000003');
reset role;
set role authenticated;
select set_config('test.current_user_id', 'a0000000-0000-0000-0000-000000000001', false);
DO $$
DECLARE v_count int;
BEGIN
  select count(*) into v_count from storage.objects
    where bucket_id = 'avatars' and name = 'a0000000-0000-0000-0000-000000000003/photo.jpg';
  IF v_count <> 0 THEN RAISE EXCEPTION 'TEST S17 ECHEC : A1 voit % avatar(s) de membre(s) de B', v_count; END IF;
  RAISE NOTICE 'TEST S17 OK';
END $$;
reset role;

\echo '--- section avatars (S11-S17) terminée ---'

-- =============================================================================
-- TESTS COMPLÉMENTAIRES community-files : suppression et statut removed
-- =============================================================================

-- Fichier déposé par A1 pendant qu'il est encore actif, pour les trois scénarios suivants.
set role authenticated;
select set_config('test.current_user_id', 'a0000000-0000-0000-0000-000000000001', false);
insert into storage.objects (bucket_id, name, owner) values
  ('community-files', '11111111-1111-1111-1111-111111111111/a0000000-0000-0000-0000-000000000001/ancien-fichier.pdf', 'a0000000-0000-0000-0000-000000000001');
reset role;

-- TEST S18 : membre actif propriétaire -> suppression OK (déjà couvert par S7 sur un autre
-- fichier ; refait ici sur celui qui servira ensuite au scénario removed, pour prouver que
-- le fichier existe bel et bien et est supprimable tant que le propriétaire est actif).
set role authenticated;
select set_config('test.current_user_id', 'a0000000-0000-0000-0000-000000000001', false);
DO $$
DECLARE v_rows int;
BEGIN
  delete from storage.objects
    where name = '11111111-1111-1111-1111-111111111111/a0000000-0000-0000-0000-000000000001/ancien-fichier.pdf';
  GET DIAGNOSTICS v_rows = ROW_COUNT;
  IF v_rows <> 1 THEN RAISE EXCEPTION 'TEST S18 ECHEC : propriétaire actif n''a supprimé que % ligne(s)', v_rows; END IF;
  RAISE NOTICE 'TEST S18 OK';
END $$;
-- On le redépose immédiatement pour le scénario removed qui suit.
insert into storage.objects (bucket_id, name, owner) values
  ('community-files', '11111111-1111-1111-1111-111111111111/a0000000-0000-0000-0000-000000000001/ancien-fichier.pdf', 'a0000000-0000-0000-0000-000000000001');
reset role;

-- Vérification préalable, en tant que postgres (contourne la RLS), que le fichier existe
-- bien avant le retrait — sinon un "0 ligne supprimée" pourrait juste signifier "rien à
-- supprimer", pas "bloqué par la policy".
reset role;
DO $$
DECLARE v_exists boolean;
BEGIN
  select exists(select 1 from storage.objects
    where name = '11111111-1111-1111-1111-111111111111/a0000000-0000-0000-0000-000000000001/ancien-fichier.pdf')
    into v_exists;
  IF NOT v_exists THEN
    RAISE EXCEPTION 'PRECONDITION TEST S19 INVALIDE : le fichier n''existe même pas avant le test';
  END IF;
END $$;

-- Retrait de A1.
set role authenticated;
select set_config('test.current_user_id', 'a0000000-0000-0000-0000-000000000002', false);
update members set status = 'removed' where user_id = 'a0000000-0000-0000-0000-000000000001';
reset role;

-- TEST S19 : membre removed -> suppression de son ancien fichier = 0 ligne, ET le fichier
-- doit toujours exister après (preuve que c'est bien la RLS qui bloque, pas une absence).
set role authenticated;
select set_config('test.current_user_id', 'a0000000-0000-0000-0000-000000000001', false);
DO $$
DECLARE v_rows int;
BEGIN
  delete from storage.objects
    where name = '11111111-1111-1111-1111-111111111111/a0000000-0000-0000-0000-000000000001/ancien-fichier.pdf';
  GET DIAGNOSTICS v_rows = ROW_COUNT;
  IF v_rows <> 0 THEN RAISE EXCEPTION 'TEST S19 ECHEC : membre removed a supprimé % ligne(s)', v_rows; END IF;
  RAISE NOTICE 'TEST S19 OK (0 ligne supprimée par removed)';
END $$;
reset role;
DO $$
DECLARE v_exists boolean;
BEGIN
  select exists(select 1 from storage.objects
    where name = '11111111-1111-1111-1111-111111111111/a0000000-0000-0000-0000-000000000001/ancien-fichier.pdf')
    into v_exists;
  IF NOT v_exists THEN
    RAISE EXCEPTION 'TEST S19 ECHEC (preuve) : le fichier a disparu — le blocage ne vient pas de la RLS';
  END IF;
  RAISE NOTICE 'TEST S19 OK (preuve) : le fichier existe toujours, bloqué par la policy, pas par absence';
END $$;

-- Remise en état.
set role authenticated;
select set_config('test.current_user_id', 'a0000000-0000-0000-0000-000000000002', false);
update members set status = 'active' where user_id = 'a0000000-0000-0000-0000-000000000001';
reset role;

-- TEST S20 : authentifié sans aucune communauté -> suppression d'un fichier historique = 0
set role authenticated;
select set_config('test.current_user_id', 'a0000000-0000-0000-0000-000000000005', false);
DO $$
DECLARE v_rows int;
BEGIN
  delete from storage.objects
    where name = '11111111-1111-1111-1111-111111111111/a0000000-0000-0000-0000-000000000001/ancien-fichier.pdf';
  GET DIAGNOSTICS v_rows = ROW_COUNT;
  IF v_rows <> 0 THEN RAISE EXCEPTION 'TEST S20 ECHEC : authentifié sans communauté a supprimé % ligne(s)', v_rows; END IF;
  RAISE NOTICE 'TEST S20 OK';
END $$;
reset role;

\echo '=== 20/20 TESTS STORAGE PASSÉS ==='
