#!/bin/bash
# ABCZed V7.8 — reconstruction d'un PostgreSQL LOCAL JETABLE pour rejouer les 40 assertions SQL
# discriminantes (scripts/sql-tests/repro_tests.py + discriminating_tests.py) depuis une
# extraction vierge de ce ZIP. NE TOUCHE JAMAIS un Supabase réel ni aucune base distante — voir
# le garde-fou ci-dessous, qui refuse de s'exécuter si le nom de base ne se déclare pas
# explicitement jetable.
#
# LIVRÉ DANS LE ZIP à partir de la V7.8 (contrairement à la V7.7, où ce script et les deux
# suites Python n'existaient que comme fichiers de travail hors ZIP — signalé par
# contre-vérification indépendante comme rendant les 34 assertions SQL alors annoncées
# impossibles à rejouer depuis le ZIP livré, contrairement à ce que P8/P9 laissaient entendre).
#
# Prérequis : un serveur PostgreSQL 14+ accessible localement via `sudo -u postgres psql` (socket
# Unix, jamais un hôte réseau) — c'est la seule méthode de connexion utilisée par ce script,
# volontairement, pour qu'il ne puisse structurellement pas être redirigé vers un serveur distant
# sans modifier le script lui-même.
#
# Usage (depuis la racine de cette extraction du ZIP) :
#   bash scripts/sql-tests/setup_repro_db.sh
# Un nom de base optionnel peut être passé en premier argument — DOIT correspondre au motif
# abczed_*_repro, sinon le script refuse de s'exécuter (voir garde-fou) :
#   bash scripts/sql-tests/setup_repro_db.sh abczed_v78_repro
set -euo pipefail

DB="${1:-abczed_v78_repro}"

# ---------------------------------------------------------------------------------------------
# GARDE-FOU — refuse toute base dont le nom ne se déclare pas explicitement jetable. Combiné à
# l'usage exclusif de `sudo -u postgres psql` (toujours local, jamais un --host distant accepté
# nulle part dans ce script), ceci rend structurellement impossible un lancement accidentel de
# ce script contre le Supabase réel de l'utilisateur : aucun DSN, aucune URL, aucun host
# Supabase n'apparaît ni n'est accepté n'importe où dans ce fichier.
# ---------------------------------------------------------------------------------------------
if [[ ! "$DB" =~ ^abczed_[a-zA-Z0-9]*_repro$ ]]; then
  echo "REFUS : '$DB' n'est pas reconnu comme un nom de base jetable (motif attendu : abczed_*_repro)." >&2
  echo "Ce script n'agit jamais sur une base qui ne se déclare pas explicitement jetable, et" >&2
  echo "n'accepte aucune option d'hôte distant — voir l'en-tête de ce fichier." >&2
  exit 2
fi

cd "$(dirname "$0")/../.."   # racine du projet (ce script vit dans scripts/sql-tests/)
if [[ ! -f sql/01_schema_and_helpers.sql ]]; then
  echo "REFUS : ce script doit être lancé depuis une racine de projet ABCZed valide (sql/01_schema_and_helpers.sql introuvable)." >&2
  exit 2
fi

PSQL="sudo -u postgres psql -v ON_ERROR_STOP=1 -d $DB"

echo "--- (re)création de la base locale jetable '$DB' ---"
sudo -u postgres psql -v ON_ERROR_STOP=1 <<SQL
drop database if exists $DB;
create database $DB;
SQL

# Stub minimal du schéma auth (jamais le vrai Supabase) : auth.users + auth.uid() lisant le
# claim JWT simulé via set_config, et les trois rôles applicatifs standard.
$PSQL <<'SQL'
create schema if not exists auth;
create table auth.users (id uuid primary key);

create or replace function auth.uid() returns uuid
language sql stable as $$
  select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid
$$;

do $$
begin
  if not exists (select 1 from pg_roles where rolname = 'anon') then
    create role anon nologin;
  end if;
  if not exists (select 1 from pg_roles where rolname = 'authenticated') then
    create role authenticated nologin;
  end if;
  if not exists (select 1 from pg_roles where rolname = 'service_role') then
    create role service_role nologin bypassrls;
  end if;
end $$;
grant usage on schema public to anon, authenticated;
alter default privileges in schema public grant all on tables to postgres;
SQL

echo "--- sql/01 ---"
$PSQL -f sql/01_schema_and_helpers.sql
echo "--- sql/02 ---"
$PSQL -f sql/02_rls.sql
echo "--- sql/03 ---"
$PSQL -f sql/03_storage.sql || echo "(sql/03 : ignoré si dépend du schéma storage Supabase absent du stub — hors périmètre de ces tests Messages/réactions)"
echo "--- sql/04 ---"
$PSQL -f sql/04_rsvp_headcount.sql
echo "--- sql/05 ---"
$PSQL -f sql/05_participant_names.sql
echo "--- sql/06 ---"
$PSQL -f sql/06_message_reactions.sql
echo "--- sql/07 ---"
$PSQL -f sql/07_realtime_replica_identity.sql

# ---------------------------------------------------------------------------------------------
# Jeu de données de test — mêmes uuids EXACTS attendus par repro_tests.py / discriminating_tests.py
# ---------------------------------------------------------------------------------------------
$PSQL <<'SQL'
insert into auth.users (id) values
  ('a1111111-0000-0000-0000-000000000001'), -- A1, membre A (auteur du message A)
  ('a1111111-0000-0000-0000-000000000002'), -- A2_ADMIN, admin A
  ('a1111111-0000-0000-0000-000000000003'), -- A3, membre A, ni auteur ni admin
  ('b2222222-0000-0000-0000-000000000001'), -- B1, membre B
  ('c9999999-0000-0000-0000-000000000001'); -- NONE_USER, authentifié sans adhésion

insert into communities (id, name) values
  ('11111111-1111-1111-1111-111111111111', 'Communauté A'),
  ('22222222-2222-2222-2222-222222222222', 'Communauté B');

insert into members (community_id, user_id, role, status, display_name) values
  ('11111111-1111-1111-1111-111111111111', 'a1111111-0000-0000-0000-000000000001', 'member', 'active', 'A1'),
  ('11111111-1111-1111-1111-111111111111', 'a1111111-0000-0000-0000-000000000002', 'admin',  'active', 'A2 Admin'),
  ('11111111-1111-1111-1111-111111111111', 'a1111111-0000-0000-0000-000000000003', 'member', 'active', 'A3'),
  ('22222222-2222-2222-2222-222222222222', 'b2222222-0000-0000-0000-000000000001', 'member', 'active', 'B1');

insert into events (id, community_id, category, subtype, title, date, start_time, location) values
  ('eaaa1111-0000-0000-0000-000000000001', '11111111-1111-1111-1111-111111111111', 'sortie', 'sortie_ecole', 'Evenement A', '2026-10-01', '10:00', 'Quelque part'),
  ('eaaa1111-0000-0000-0000-000000000002', '11111111-1111-1111-1111-111111111111', 'sortie', 'sortie_ecole', 'Evenement A jetable', '2026-10-02', '10:00', 'Quelque part'),
  ('ebbb2222-0000-0000-0000-000000000001', '22222222-2222-2222-2222-222222222222', 'sortie', 'sortie_ecole', 'Evenement B', '2026-10-03', '10:00', 'Ailleurs');
insert into events (id, community_id, category, title) values
  ('eaaa1111-0000-0000-0000-0000000000aa', '11111111-1111-1111-1111-111111111111', 'anniversaire', 'Anniversaire A');

insert into messages (id, community_id, author_id, text) values
  ('aaaa1111-0000-0000-0000-000000000001', '11111111-1111-1111-1111-111111111111', 'a1111111-0000-0000-0000-000000000001', 'message A'),
  ('bbbb2222-0000-0000-0000-000000000001', '22222222-2222-2222-2222-222222222222', 'b2222222-0000-0000-0000-000000000001', 'message B');
SQL

echo "--- Vérification rapide des comptes ---"
$PSQL -c "select 'communities' t, count(*) from communities union all select 'members', count(*) from members union all select 'events', count(*) from events union all select 'messages', count(*) from messages;"

echo ""
echo "Base '$DB' prête. Lancer ensuite :"
echo "  sudo -u postgres python3 scripts/sql-tests/repro_tests.py"
echo "  sudo -u postgres python3 scripts/sql-tests/discriminating_tests.py"
echo "(sudo -u postgres : mêmes droits que ceux utilisés pour créer la base ci-dessus — le rôle"
echo "'postgres' du système local, jamais un compte Supabase.)"
