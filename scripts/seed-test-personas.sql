-- Données de test pour la validation sur un vrai projet Supabase.
-- À exécuter dans SQL Editor APRÈS avoir créé les 4 utilisateurs de test ci-dessous
-- via Authentication > Users > Add user, et après avoir remplacé les 4 UUID.
--
-- Utilisateurs à créer manuellement dans le Dashboard (Authentication > Users > Add user) :
--   1. test-a1@abczed-verif.local      -> membre normal, communauté A
--   2. test-a2-admin@abczed-verif.local -> admin, communauté A
--   3. test-b1@abczed-verif.local      -> membre normal, communauté B
--   4. test-a3-toberemoved@abczed-verif.local -> membre normal, communauté A, passé
--      "removed" PENDANT le script de vérification (voir verify-real-supabase.mjs)
--   5. test-sans-communaute@abczed-verif.local -> authentifié, aucune communauté
--
-- Note un mot de passe pour chacun (tu en auras besoin dans .env.test).
-- Une fois créés, copie leur UUID (colonne "UID" dans la liste des utilisateurs) et
-- remplace les 4 UUID ci-dessous (le 5e compte, sans communauté, n'a volontairement
-- aucune ligne à insérer — c'est précisément le cas qu'il sert à tester).

insert into communities (id, name) values
  ('a1111111-1111-1111-1111-111111111111', 'Communauté test A'),
  ('b2222222-2222-2222-2222-222222222222', 'Communauté test B')
on conflict (id) do nothing;

insert into members (community_id, user_id, role, status) values
  ('a1111111-1111-1111-1111-111111111111', 'REPLACE_WITH_A1_UUID'::uuid, 'member', 'active'),
  ('a1111111-1111-1111-1111-111111111111', 'REPLACE_WITH_A2_ADMIN_UUID'::uuid, 'admin', 'active'),
  ('b2222222-2222-2222-2222-222222222222', 'REPLACE_WITH_B1_UUID'::uuid, 'member', 'active'),
  ('a1111111-1111-1111-1111-111111111111', 'REPLACE_WITH_A3_TOBEREMOVED_UUID'::uuid, 'member', 'active')
on conflict (community_id, user_id) do nothing;
-- Le 5e utilisateur (sans communauté) ne doit avoir AUCUNE ligne dans members —
-- ne pas l'insérer, c'est précisément le cas à tester.

-- Un événement de test dans chaque communauté, pour avoir quelque chose à lire/à isoler.
-- id fixes (pas de gen_random_uuid() implicite) pour que "on conflict" fonctionne vraiment
-- si ce script est rejoué sur un projet déjà seedé — sans ça, chaque exécution créait un
-- nouvel événement en double, faute de cible de conflit.
insert into events (id, community_id, category, title, date, created_by) values
  ('e1111111-1111-1111-1111-111111111111', 'a1111111-1111-1111-1111-111111111111', 'sortie', 'Événement test A', current_date + 7, 'REPLACE_WITH_A1_UUID'::uuid),
  ('e2222222-2222-2222-2222-222222222222', 'b2222222-2222-2222-2222-222222222222', 'sortie', 'Événement test B', current_date + 7, 'REPLACE_WITH_B1_UUID'::uuid)
on conflict (id) do nothing;
