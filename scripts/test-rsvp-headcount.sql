-- Tests de la contrainte adults_count/children_count — à exécuter après 01, 02, 03 et
-- 04_rsvp_headcount.sql, en tant que rôle non-superutilisateur (sinon RLS ignorée).
-- FAIL-FAST comme test-rls.sql et test-storage.sql : toute divergence lève une vraie
-- exception, psql sort en erreur (utilisable en CI).

\set ON_ERROR_STOP on

insert into communities (id, name) values ('11111111-1111-1111-1111-111111111111', 'Communauté A') on conflict do nothing;
insert into auth.users (id) values ('a0000000-0000-0000-0000-000000000001') on conflict do nothing;
insert into members (community_id, user_id, role, status) values
  ('11111111-1111-1111-1111-111111111111', 'a0000000-0000-0000-0000-000000000001', 'member', 'active')
on conflict do nothing;
insert into events (id, community_id, category, subtype, title, date, created_by) values
  ('e0000000-0000-0000-0000-000000000001', '11111111-1111-1111-1111-111111111111', 'sortie', 'sortie_ecole', 'Sortie test', '2026-01-01', 'a0000000-0000-0000-0000-000000000001')
on conflict do nothing;

set role authenticated;
select set_config('test.current_user_id', 'a0000000-0000-0000-0000-000000000001', false);

-- TEST H1 : valeurs négatives rejetées
DO $$
BEGIN
  insert into event_participants (event_id, community_id, user_id, adults_count, children_count)
    values ('e0000000-0000-0000-0000-000000000001', '11111111-1111-1111-1111-111111111111', 'a0000000-0000-0000-0000-000000000001', -1, 0);
  RAISE EXCEPTION 'TEST H1 ECHEC : adults_count négatif accepté' USING ERRCODE = 'TEST0';
EXCEPTION
  WHEN SQLSTATE 'TEST0' THEN RAISE;
  WHEN OTHERS THEN RAISE NOTICE 'TEST H1 OK : %', SQLERRM;
END $$;

-- TEST H2 : 0 adulte + 0 enfant rejeté (une participation doit représenter au moins
-- quelqu'un)
DO $$
BEGIN
  insert into event_participants (event_id, community_id, user_id, adults_count, children_count)
    values ('e0000000-0000-0000-0000-000000000001', '11111111-1111-1111-1111-111111111111', 'a0000000-0000-0000-0000-000000000001', 0, 0);
  RAISE EXCEPTION 'TEST H2 ECHEC : 0/0 accepté' USING ERRCODE = 'TEST0';
EXCEPTION
  WHEN SQLSTATE 'TEST0' THEN RAISE;
  WHEN OTHERS THEN RAISE NOTICE 'TEST H2 OK : %', SQLERRM;
END $$;

-- TEST H3 : 1 adulte + 0 enfant accepté — cas "Sortie -> Entre familles" (le titulaire
-- du compte est présent)
DO $$
BEGIN
  insert into event_participants (event_id, community_id, user_id, adults_count, children_count)
    values ('e0000000-0000-0000-0000-000000000001', '11111111-1111-1111-1111-111111111111', 'a0000000-0000-0000-0000-000000000001', 1, 0);
  RAISE NOTICE 'TEST H3 OK : 1/0 (Sortie -> Entre familles) accepté';
END $$;
delete from event_participants where event_id = 'e0000000-0000-0000-0000-000000000001';

-- TEST H4 : 0 adulte + 1 enfant accepté — cas "Sortie -> Avec l'école" (un enfant
-- inscrit sans que le parent l'accompagne)
DO $$
BEGIN
  insert into event_participants (event_id, community_id, user_id, adults_count, children_count)
    values ('e0000000-0000-0000-0000-000000000001', '11111111-1111-1111-1111-111111111111', 'a0000000-0000-0000-0000-000000000001', 0, 1);
  RAISE NOTICE 'TEST H4 OK : 0/1 (Sortie -> Avec l''école) accepté';
END $$;

-- TEST H5 : valeurs par défaut à l'omission = 1/0
DO $$
DECLARE v_adults int; v_children int;
BEGIN
  delete from event_participants where event_id = 'e0000000-0000-0000-0000-000000000001';
  insert into event_participants (event_id, community_id, user_id)
    values ('e0000000-0000-0000-0000-000000000001', '11111111-1111-1111-1111-111111111111', 'a0000000-0000-0000-0000-000000000001');
  select adults_count, children_count into v_adults, v_children from event_participants
    where event_id = 'e0000000-0000-0000-0000-000000000001' and user_id = 'a0000000-0000-0000-0000-000000000001';
  IF v_adults <> 1 OR v_children <> 0 THEN
    RAISE EXCEPTION 'TEST H5 ECHEC : défauts obtenus %/%, attendu 1/0', v_adults, v_children;
  END IF;
  RAISE NOTICE 'TEST H5 OK';
END $$;

-- TEST H6 : modification (DELETE + INSERT) avec de nouveaux compteurs
DO $$
DECLARE v_adults int; v_children int;
BEGIN
  delete from event_participants where event_id = 'e0000000-0000-0000-0000-000000000001' and user_id = 'a0000000-0000-0000-0000-000000000001';
  insert into event_participants (event_id, community_id, user_id, adults_count, children_count)
    values ('e0000000-0000-0000-0000-000000000001', '11111111-1111-1111-1111-111111111111', 'a0000000-0000-0000-0000-000000000001', 2, 2);
  select adults_count, children_count into v_adults, v_children from event_participants
    where event_id = 'e0000000-0000-0000-0000-000000000001' and user_id = 'a0000000-0000-0000-0000-000000000001';
  IF v_adults <> 2 OR v_children <> 2 THEN
    RAISE EXCEPTION 'TEST H6 ECHEC : obtenus %/%, attendu 2/2', v_adults, v_children;
  END IF;
  RAISE NOTICE 'TEST H6 OK';
END $$;

-- TEST H7 : annulation complète (DELETE simple), peu importe les compteurs qu'elle portait
DO $$
DECLARE v_rows int;
BEGIN
  delete from event_participants where event_id = 'e0000000-0000-0000-0000-000000000001' and user_id = 'a0000000-0000-0000-0000-000000000001';
  GET DIAGNOSTICS v_rows = ROW_COUNT;
  IF v_rows <> 1 THEN
    RAISE EXCEPTION 'TEST H7 ECHEC : % ligne(s) supprimée(s), attendu 1', v_rows;
  END IF;
  RAISE NOTICE 'TEST H7 OK';
END $$;

reset role;
\echo '=== 7/7 TESTS HEADCOUNT PASSÉS ==='
