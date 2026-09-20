-- Script de tests RLS reproductible — rejoue la matrice du §13 de la spec sécurité.
-- Doit être exécuté APRÈS 01_schema_and_helpers.sql et 02_rls.sql, en tant que rôle
-- non-superutilisateur (sinon RLS ignorée).
-- FAIL-FAST : chaque test lève une vraie exception en cas d'écart -> psql sort en erreur,
-- utilisable tel quel en CI (code de sortie non nul). Rien n'est un simple message ignorable.

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
  ('a0000000-0000-0000-0000-000000000004'), -- membre retiré A (removed)
  ('a0000000-0000-0000-0000-000000000005'), -- authentifié SANS communauté
  ('a0000000-0000-0000-0000-000000000006')  -- cible d'une tentative de vol de membership
on conflict do nothing;

insert into members (community_id, user_id, role, status) values
  ('11111111-1111-1111-1111-111111111111', 'a0000000-0000-0000-0000-000000000001', 'member', 'active'),
  ('11111111-1111-1111-1111-111111111111', 'a0000000-0000-0000-0000-000000000002', 'admin', 'active'),
  ('22222222-2222-2222-2222-222222222222', 'a0000000-0000-0000-0000-000000000003', 'member', 'active'),
  ('11111111-1111-1111-1111-111111111111', 'a0000000-0000-0000-0000-000000000004', 'member', 'removed')
on conflict do nothing;

insert into events (id, community_id, category, title, date, created_by) values
  ('e0000000-0000-0000-0000-000000000001', '11111111-1111-1111-1111-111111111111', 'sortie', 'Sortie piscine A', '2025-06-01', 'a0000000-0000-0000-0000-000000000001'),
  ('e0000000-0000-0000-0000-000000000003', '22222222-2222-2222-2222-222222222222', 'sortie', 'Sortie plage B', '2025-06-03', 'a0000000-0000-0000-0000-000000000003')
on conflict do nothing;

-- ---------------------------------------------------------------------------
-- TEST 1 : membre actif A lit les événements de A -> exactement 1 ligne
-- ---------------------------------------------------------------------------
set role authenticated;
select set_config('test.current_user_id', 'a0000000-0000-0000-0000-000000000001', false);
DO $$
DECLARE v_count int;
BEGIN
  select count(*) into v_count from events where community_id = '11111111-1111-1111-1111-111111111111';
  IF v_count <> 1 THEN
    RAISE EXCEPTION 'TEST 1 ECHEC : attendu 1 ligne, obtenu %', v_count;
  END IF;
  RAISE NOTICE 'TEST 1 OK';
END $$;
reset role;

-- ---------------------------------------------------------------------------
-- TEST 2 : membre actif A ne voit aucun événement de B
-- ---------------------------------------------------------------------------
set role authenticated;
select set_config('test.current_user_id', 'a0000000-0000-0000-0000-000000000001', false);
DO $$
DECLARE v_count int;
BEGIN
  select count(*) into v_count from events where community_id = '22222222-2222-2222-2222-222222222222';
  IF v_count <> 0 THEN
    RAISE EXCEPTION 'TEST 2 ECHEC : membre A voit % ligne(s) de B', v_count;
  END IF;
  RAISE NOTICE 'TEST 2 OK';
END $$;
reset role;

-- ---------------------------------------------------------------------------
-- TEST 3 : authentifié sans communauté -> rien nulle part
-- ---------------------------------------------------------------------------
set role authenticated;
select set_config('test.current_user_id', 'a0000000-0000-0000-0000-000000000005', false);
DO $$
DECLARE v_events int; v_members int;
BEGIN
  select count(*) into v_events from events;
  select count(*) into v_members from members;
  IF v_events <> 0 OR v_members <> 0 THEN
    RAISE EXCEPTION 'TEST 3 ECHEC : events=%, members=% (attendu 0 et 0)', v_events, v_members;
  END IF;
  RAISE NOTICE 'TEST 3 OK';
END $$;
reset role;

-- ---------------------------------------------------------------------------
-- TEST 4 : membre removed de A -> perd tout accès
-- ---------------------------------------------------------------------------
set role authenticated;
select set_config('test.current_user_id', 'a0000000-0000-0000-0000-000000000004', false);
DO $$
DECLARE v_count int;
BEGIN
  select count(*) into v_count from events where community_id = '11111111-1111-1111-1111-111111111111';
  IF v_count <> 0 THEN
    RAISE EXCEPTION 'TEST 4 ECHEC : membre removed voit % ligne(s)', v_count;
  END IF;
  RAISE NOTICE 'TEST 4 OK';
END $$;
reset role;

-- ---------------------------------------------------------------------------
-- TEST 5 : anon -> 0 ligne OU refus de lecture (les deux valident le test)
-- ---------------------------------------------------------------------------
set role anon;
DO $$
DECLARE v_count int;
BEGIN
  select count(*) into v_count from events;
  IF v_count <> 0 THEN
    RAISE EXCEPTION 'TEST 5 ECHEC : anon voit % ligne(s)', v_count;
  END IF;
  RAISE NOTICE 'TEST 5 OK (0 ligne)';
EXCEPTION WHEN insufficient_privilege THEN
  RAISE NOTICE 'TEST 5 OK (accès refusé, encore plus strict)';
END $$;
reset role;

-- ---------------------------------------------------------------------------
-- TEST 6 : membre A tente d'insérer un événement avec community_id = B -> doit échouer
-- ---------------------------------------------------------------------------
set role authenticated;
select set_config('test.current_user_id', 'a0000000-0000-0000-0000-000000000001', false);
DO $$
BEGIN
  insert into events (community_id, category, title, date, created_by)
    values ('22222222-2222-2222-2222-222222222222', 'sortie', 'Tentative injection', '2025-06-02', 'a0000000-0000-0000-0000-000000000001');
  RAISE EXCEPTION 'TEST 6 ECHEC : insertion acceptée malgré mauvaise communauté' USING ERRCODE = 'TEST0';
EXCEPTION
  WHEN SQLSTATE 'TEST0' THEN RAISE;  -- notre propre échec de test remonte tel quel
  WHEN OTHERS THEN RAISE NOTICE 'TEST 6 OK : bloqué par la policy (%)', SQLERRM;
END $$;
reset role;

-- ---------------------------------------------------------------------------
-- TEST 7 : admin A modère (UPDATE) un message d'un autre membre de A -> doit réussir,
-- avec vérification explicite du ROW_COUNT (pas juste "aucune exception levée").
-- ---------------------------------------------------------------------------
set role authenticated;
select set_config('test.current_user_id', 'a0000000-0000-0000-0000-000000000001', false);
insert into messages (id, community_id, author_id, text) values
  ('c0000000-0000-0000-0000-000000000001', '11111111-1111-1111-1111-111111111111', 'a0000000-0000-0000-0000-000000000001', 'message de A1');
reset role;
set role authenticated;
select set_config('test.current_user_id', 'a0000000-0000-0000-0000-000000000002', false);
DO $$
DECLARE v_rows int;
BEGIN
  update messages set text = 'modéré par admin' where id = 'c0000000-0000-0000-0000-000000000001';
  GET DIAGNOSTICS v_rows = ROW_COUNT;
  IF v_rows <> 1 THEN
    RAISE EXCEPTION 'TEST 7 ECHEC : admin légitime n''a modifié que % ligne(s), attendu 1', v_rows;
  END IF;
  RAISE NOTICE 'TEST 7 OK';
END $$;
reset role;

-- ---------------------------------------------------------------------------
-- TEST 8 : membre B (ni admin ni auteur) tente de modifier le message de A -> 0 ligne touchée
-- ---------------------------------------------------------------------------
set role authenticated;
select set_config('test.current_user_id', 'a0000000-0000-0000-0000-000000000003', false);
DO $$
DECLARE v_rows int;
BEGIN
  update messages set text = 'piraté par B' where id = 'c0000000-0000-0000-0000-000000000001';
  GET DIAGNOSTICS v_rows = ROW_COUNT;
  IF v_rows <> 0 THEN
    RAISE EXCEPTION 'TEST 8 ECHEC : membre B a modifié % ligne(s) d''un message de A', v_rows;
  END IF;
  RAISE NOTICE 'TEST 8 OK';
END $$;
reset role;

-- ---------------------------------------------------------------------------
-- TEST 9 : lier un message à un rappel anniversaire -> doit échouer
-- ---------------------------------------------------------------------------
insert into events (id, community_id, category, title, birthday_day, birthday_month) values
  ('e0000000-0000-0000-0000-000000000002', '11111111-1111-1111-1111-111111111111', 'anniversaire', 'Anniversaire de Léa', 24, 5)
on conflict do nothing;
set role authenticated;
select set_config('test.current_user_id', 'a0000000-0000-0000-0000-000000000001', false);
DO $$
BEGIN
  insert into messages (community_id, author_id, text, linked_event_id) values
    ('11111111-1111-1111-1111-111111111111', 'a0000000-0000-0000-0000-000000000001', 'test lien anniversaire', 'e0000000-0000-0000-0000-000000000002');
  RAISE EXCEPTION 'TEST 9 ECHEC : liaison à un anniversaire acceptée' USING ERRCODE = 'TEST0';
EXCEPTION
  WHEN SQLSTATE 'TEST0' THEN RAISE;
  WHEN OTHERS THEN RAISE NOTICE 'TEST 9 OK : %', SQLERRM;
END $$;
reset role;

-- ---------------------------------------------------------------------------
-- TEST 10 (nouveau) : admin A tente de voler un membership en changeant user_id -> doit échouer
-- ---------------------------------------------------------------------------
set role authenticated;
select set_config('test.current_user_id', 'a0000000-0000-0000-0000-000000000002', false);
DO $$
BEGIN
  update members set user_id = 'a0000000-0000-0000-0000-000000000006'
    where community_id = '11111111-1111-1111-1111-111111111111'
      and user_id = 'a0000000-0000-0000-0000-000000000001';
  RAISE EXCEPTION 'TEST 10 ECHEC : transfert de membership à un autre compte accepté' USING ERRCODE = 'TEST0';
EXCEPTION
  WHEN SQLSTATE 'TEST0' THEN RAISE;
  WHEN OTHERS THEN RAISE NOTICE 'TEST 10 OK : %', SQLERRM;
END $$;
reset role;

-- ---------------------------------------------------------------------------
-- TEST 11 (nouveau) : membre A insère event_participants avec community_id=A mais
-- event_id appartenant à B -> doit échouer (contrainte structurelle FK composite).
-- ---------------------------------------------------------------------------
set role authenticated;
select set_config('test.current_user_id', 'a0000000-0000-0000-0000-000000000001', false);
DO $$
BEGIN
  insert into event_participants (event_id, community_id, user_id) values
    ('e0000000-0000-0000-0000-000000000003', '11111111-1111-1111-1111-111111111111', 'a0000000-0000-0000-0000-000000000001');
  RAISE EXCEPTION 'TEST 11 ECHEC : croisement event_id/community_id incohérent accepté' USING ERRCODE = 'TEST0';
EXCEPTION
  WHEN SQLSTATE 'TEST0' THEN RAISE;
  WHEN OTHERS THEN RAISE NOTICE 'TEST 11 OK : %', SQLERRM;
END $$;
reset role;

\echo '=== TESTS 1-11 PASSÉS ==='

-- ---------------------------------------------------------------------------
-- TEST 12 : membre A tente de déplacer son propre événement de A vers B -> BLOQUÉ
-- ---------------------------------------------------------------------------
set role authenticated;
select set_config('test.current_user_id', 'a0000000-0000-0000-0000-000000000001', false);
DO $$
BEGIN
  update events set community_id = '22222222-2222-2222-2222-222222222222'
    where id = 'e0000000-0000-0000-0000-000000000001';
  RAISE EXCEPTION 'TEST 12 ECHEC : événement déplacé vers une autre communauté' USING ERRCODE = 'TEST0';
EXCEPTION
  WHEN SQLSTATE 'TEST0' THEN RAISE;
  WHEN OTHERS THEN RAISE NOTICE 'TEST 12 OK : %', SQLERRM;
END $$;
reset role;

-- ---------------------------------------------------------------------------
-- TEST 13 : membre A tente de déplacer son propre message de A vers B -> BLOQUÉ
-- ---------------------------------------------------------------------------
set role authenticated;
select set_config('test.current_user_id', 'a0000000-0000-0000-0000-000000000001', false);
DO $$
BEGIN
  update messages set community_id = '22222222-2222-2222-2222-222222222222'
    where id = 'c0000000-0000-0000-0000-000000000001';
  RAISE EXCEPTION 'TEST 13 ECHEC : message déplacé vers une autre communauté' USING ERRCODE = 'TEST0';
EXCEPTION
  WHEN SQLSTATE 'TEST0' THEN RAISE;
  WHEN OTHERS THEN RAISE NOTICE 'TEST 13 OK : %', SQLERRM;
END $$;
reset role;

-- ---------------------------------------------------------------------------
-- TEST 14 : membre A tente de déplacer son propre partage de A vers B -> BLOQUÉ
-- ---------------------------------------------------------------------------
set role authenticated;
select set_config('test.current_user_id', 'a0000000-0000-0000-0000-000000000001', false);
insert into shares (id, community_id, type, title, author_id) values
  ('50000000-0000-0000-0000-000000000001', '11111111-1111-1111-1111-111111111111', 'info', 'Partage de A1', 'a0000000-0000-0000-0000-000000000001');
DO $$
BEGIN
  update shares set community_id = '22222222-2222-2222-2222-222222222222'
    where id = '50000000-0000-0000-0000-000000000001';
  RAISE EXCEPTION 'TEST 14 ECHEC : partage déplacé vers une autre communauté' USING ERRCODE = 'TEST0';
EXCEPTION
  WHEN SQLSTATE 'TEST0' THEN RAISE;
  WHEN OTHERS THEN RAISE NOTICE 'TEST 14 OK : %', SQLERRM;
END $$;
reset role;

-- ---------------------------------------------------------------------------
-- TEST 15 : tentative de changement d'auteur (author_id) sur un message -> BLOQUÉ
-- ---------------------------------------------------------------------------
set role authenticated;
select set_config('test.current_user_id', 'a0000000-0000-0000-0000-000000000001', false);
DO $$
BEGIN
  update messages set author_id = 'a0000000-0000-0000-0000-000000000002'
    where id = 'c0000000-0000-0000-0000-000000000001';
  RAISE EXCEPTION 'TEST 15 ECHEC : changement d''auteur accepté' USING ERRCODE = 'TEST0';
EXCEPTION
  WHEN SQLSTATE 'TEST0' THEN RAISE;
  WHEN OTHERS THEN RAISE NOTICE 'TEST 15 OK : %', SQLERRM;
END $$;
reset role;

-- ---------------------------------------------------------------------------
-- TEST 16 : membre removed tente de modifier son propre profil -> 0 ligne
-- ---------------------------------------------------------------------------
set role authenticated;
select set_config('test.current_user_id', 'a0000000-0000-0000-0000-000000000004', false);
DO $$
DECLARE v_rows int;
BEGIN
  update members set display_name = 'Tentative après retrait' where user_id = 'a0000000-0000-0000-0000-000000000004';
  GET DIAGNOSTICS v_rows = ROW_COUNT;
  IF v_rows <> 0 THEN
    RAISE EXCEPTION 'TEST 16 ECHEC : membre removed a modifié % ligne(s) de son profil', v_rows;
  END IF;
  RAISE NOTICE 'TEST 16 OK';
END $$;
reset role;

-- ---------------------------------------------------------------------------
-- TEST 17 : membre removed tente de supprimer son ancienne participation -> 0 ligne
-- ---------------------------------------------------------------------------
set role authenticated;
select set_config('test.current_user_id', 'a0000000-0000-0000-0000-000000000001', false);
insert into event_participants (event_id, community_id, user_id) values
  ('e0000000-0000-0000-0000-000000000001', '11111111-1111-1111-1111-111111111111', 'a0000000-0000-0000-0000-000000000001');
reset role;
-- On retire ce membre APRÈS l'insertion, en tant qu'admin, pour simuler un retrait réel.
set role authenticated;
select set_config('test.current_user_id', 'a0000000-0000-0000-0000-000000000002', false);
update members set status = 'removed' where user_id = 'a0000000-0000-0000-0000-000000000001';
reset role;
set role authenticated;
select set_config('test.current_user_id', 'a0000000-0000-0000-0000-000000000001', false);
DO $$
DECLARE v_rows int;
BEGIN
  delete from event_participants
    where event_id = 'e0000000-0000-0000-0000-000000000001'
      and user_id = 'a0000000-0000-0000-0000-000000000001';
  GET DIAGNOSTICS v_rows = ROW_COUNT;
  IF v_rows <> 0 THEN
    RAISE EXCEPTION 'TEST 17 ECHEC : membre removed a supprimé % ligne(s) de participation', v_rows;
  END IF;
  RAISE NOTICE 'TEST 17 OK';
END $$;
reset role;
-- Remise en état pour ne pas fausser un futur test qui dépendrait de ce membre actif.
set role authenticated;
select set_config('test.current_user_id', 'a0000000-0000-0000-0000-000000000002', false);
update members set status = 'active' where user_id = 'a0000000-0000-0000-0000-000000000001';
reset role;

-- ---------------------------------------------------------------------------
-- TEST 18 : un membre actif ne voit pas les lignes invited/removed dans La Bande
-- ---------------------------------------------------------------------------
set role authenticated;
select set_config('test.current_user_id', 'a0000000-0000-0000-0000-000000000001', false);
DO $$
DECLARE v_count int;
BEGIN
  select count(*) into v_count from members
    where community_id = '11111111-1111-1111-1111-111111111111' and status <> 'active';
  IF v_count <> 0 THEN
    RAISE EXCEPTION 'TEST 18 ECHEC : membre actif voit % ligne(s) non actives', v_count;
  END IF;
  RAISE NOTICE 'TEST 18 OK';
END $$;
reset role;

-- ---------------------------------------------------------------------------
-- TEST 19 : invitations est totalement fermée à ce stade, pour authenticated et anon
-- ---------------------------------------------------------------------------
set role authenticated;
select set_config('test.current_user_id', 'a0000000-0000-0000-0000-000000000002', false);
DO $$
DECLARE v_count int;
BEGIN
  select count(*) into v_count from invitations;
  IF v_count <> 0 THEN
    RAISE EXCEPTION 'TEST 19 ECHEC : authenticated voit % ligne(s) dans invitations', v_count USING ERRCODE = 'TEST0';
  END IF;
  RAISE NOTICE 'TEST 19 OK (authenticated) : 0 ligne visible';
EXCEPTION
  WHEN SQLSTATE 'TEST0' THEN RAISE;
  WHEN insufficient_privilege THEN RAISE NOTICE 'TEST 19 OK (authenticated) : accès refusé, encore plus strict';
END $$;
reset role;
set role anon;
DO $$
BEGIN
  perform 1 from invitations;
  RAISE EXCEPTION 'TEST 19 ECHEC : anon a pu lire invitations' USING ERRCODE = 'TEST0';
EXCEPTION
  WHEN SQLSTATE 'TEST0' THEN RAISE;
  WHEN OTHERS THEN RAISE NOTICE 'TEST 19 OK (anon) : accès refusé';
END $$;
reset role;

\echo '=== 19/19 TESTS RLS PASSÉS ==='
