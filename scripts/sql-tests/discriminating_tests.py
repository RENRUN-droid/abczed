#!/usr/bin/env python3
# ABCZed V7.8 — preuve discriminante (brief P8) : pour chaque garde-fou clé de
# sql/06_message_reactions.sql et sql/07_realtime_replica_identity.sql, on le désactive
# volontairement, on constate que l'attaque (ou la régression) RÉUSSIT (preuve que le test
# précédent testait bien quelque chose de réel, pas un théâtre), puis on restaure et on
# reconfirme le blocage. Contre le même PostgreSQL local jetable que repro_tests.py — jamais le
# Supabase réel (garde-fou : voir _dsn_guard.py, appelé avant toute connexion, à chaque
# connexion).
#
# LIVRÉ DANS LE ZIP à partir de la V7.8 (voir repro_tests.py pour le contexte de ce changement).
# (V7.10 : n'ouvre plus jamais de connexion via une chaîne DSN assemblée à la main — voir
# _dsn_guard.py pour le détail des contournements V7.8/V7.9 que ce changement élimine.)
import sys

from _dsn_guard import guarded_connect

A = "11111111-1111-1111-1111-111111111111"
A1 = "a1111111-0000-0000-0000-000000000001"
A2_ADMIN = "a1111111-0000-0000-0000-000000000002"
MSG_A = "aaaa1111-0000-0000-0000-000000000001"
MSG_B = "bbbb2222-0000-0000-0000-000000000001"

pas, echec = 0, 0

def ok(label, cond, detail=""):
    global pas, echec
    if cond:
        print(f"OK  {label}")
        pas += 1
    else:
        print(f"XXX {label}" + (f" — {detail}" if detail else ""))
        echec += 1

def su():
    conn = guarded_connect(); conn.autocommit = False
    return conn, conn.cursor()

def as_user(user_id):
    conn = guarded_connect(); conn.autocommit = False
    cur = conn.cursor()
    cur.execute("set role authenticated")
    cur.execute("select set_config('request.jwt.claim.sub', %s, true)", (user_id,))
    return conn, cur

def try_sql(cur, sql, params=None):
    try:
        cur.execute(sql, params or ())
        return True, None
    except Exception as e:
        return False, str(e)

# ---------------------------------------------------------------------------
# 1. Policy insert_own_reaction — retirer le contrôle user_id=auth.uid() doit permettre
#    l'usurpation (attaque réussie), la restaurer doit de nouveau la bloquer.
# ---------------------------------------------------------------------------
conn, cur = su()
cur.execute("""drop policy "insert_own_reaction" on message_reactions;""")
cur.execute("""create policy "insert_own_reaction" on message_reactions for insert to authenticated
  with check ((select app_private.is_community_member(community_id)));""")  # user_id check retiré
conn.commit(); conn.close()

conn, cur = as_user(A1)
success, err = try_sql(cur, "insert into message_reactions (message_id, community_id, user_id, emoji) values (%s, %s, %s, '❤️')", (MSG_A, A, A2_ADMIN))
ok("cassé 1a. Policy affaiblie : l'usurpation RÉUSSIT (preuve que le test original teste bien cette policy)", success, err)
conn.rollback(); conn.close()

conn, cur = su()
cur.execute("""drop policy "insert_own_reaction" on message_reactions;""")
cur.execute("""create policy "insert_own_reaction" on message_reactions for insert to authenticated
  with check ((select app_private.is_community_member(community_id)) and user_id = (select auth.uid()));""")
conn.commit(); conn.close()

conn, cur = as_user(A1)
success, err = try_sql(cur, "insert into message_reactions (message_id, community_id, user_id, emoji) values (%s, %s, %s, '❤️')", (MSG_A, A, A2_ADMIN))
ok("restauré 1b. Policy restaurée : l'usurpation est de nouveau BLOQUÉE", not success)
conn.rollback(); conn.close()

# ---------------------------------------------------------------------------
# 2. Clé étrangère composite — la retirer doit permettre une réaction intercommunauté,
#    la restaurer doit de nouveau la bloquer.
# ---------------------------------------------------------------------------
conn, cur = su()
cur.execute("alter table message_reactions drop constraint message_reactions_message_id_community_id_fkey")
conn.commit(); conn.close()

conn, cur = as_user(A1)
success, err = try_sql(cur, "insert into message_reactions (message_id, community_id, user_id, emoji) values (%s, %s, %s, '❤️')", (MSG_B, A, A1))
ok("cassé 2a. FK composite retirée : la réaction intercommunauté RÉUSSIT (preuve du rôle réel de la FK)", success, err)
conn.rollback(); conn.close()

conn, cur = su()
cur.execute("""alter table message_reactions
  add constraint message_reactions_message_id_community_id_fkey
  foreign key (message_id, community_id) references messages (id, community_id) on delete cascade""")
conn.commit(); conn.close()

conn, cur = as_user(A1)
success, err = try_sql(cur, "insert into message_reactions (message_id, community_id, user_id, emoji) values (%s, %s, %s, '❤️')", (MSG_B, A, A1))
ok("restauré 2b. FK composite restaurée : la réaction intercommunauté est de nouveau BLOQUÉE", not success)
conn.rollback(); conn.close()

# ---------------------------------------------------------------------------
# 3. Trigger d'immuabilité — le désactiver doit permettre à un superutilisateur de changer
#    user_id, le réactiver doit de nouveau le bloquer.
# ---------------------------------------------------------------------------
conn, cur = su()
cur.execute("alter table message_reactions disable trigger trg_protect_reaction_identity")
cur.execute("insert into message_reactions (message_id, community_id, user_id, emoji) values (%s, %s, %s, '😮') returning id", (MSG_A, A, A2_ADMIN))
rid = cur.fetchone()[0]
conn.commit()
success, err = try_sql(cur, "update message_reactions set user_id = %s where id = %s", (A1, rid))
ok("cassé 3a. Trigger désactivé : le changement de user_id RÉUSSIT (preuve du rôle réel du trigger)", success, err)
conn.rollback()
cur.execute("delete from message_reactions where id = %s", (rid,))
conn.commit(); conn.close()

conn, cur = su()
cur.execute("alter table message_reactions enable trigger trg_protect_reaction_identity")
cur.execute("insert into message_reactions (message_id, community_id, user_id, emoji) values (%s, %s, %s, '😮') returning id", (MSG_A, A, A2_ADMIN))
rid = cur.fetchone()[0]
conn.commit()
success, err = try_sql(cur, "update message_reactions set user_id = %s where id = %s", (A1, rid))
ok("restauré 3b. Trigger réactivé : le changement de user_id est de nouveau BLOQUÉ", not success)
conn.rollback()
cur.execute("delete from message_reactions where id = %s", (rid,))
conn.commit(); conn.close()

# ---------------------------------------------------------------------------
# 4. Contrainte unique(message_id,user_id) — la retirer doit permettre 2 réactions actives
#    pour la même personne sur le même message, la restaurer doit de nouveau le bloquer.
# ---------------------------------------------------------------------------
conn, cur = su()
cur.execute("alter table message_reactions drop constraint message_reactions_message_id_user_id_key")
conn.commit(); conn.close()

conn, cur = as_user(A1)
cur.execute("insert into message_reactions (message_id, community_id, user_id, emoji) values (%s, %s, %s, '❤️')", (MSG_A, A, A1))
success, err = try_sql(cur, "insert into message_reactions (message_id, community_id, user_id, emoji) values (%s, %s, %s, '👍')", (MSG_A, A, A1))
ok("cassé 4a. Contrainte unique retirée : une 2e réaction active RÉUSSIT (preuve du rôle réel de la contrainte)", success, err)
conn.rollback(); conn.close()

conn, cur = su()
cur.execute("alter table message_reactions add constraint message_reactions_message_id_user_id_key unique (message_id, user_id)")
conn.commit(); conn.close()

conn, cur = as_user(A1)
cur.execute("insert into message_reactions (message_id, community_id, user_id, emoji) values (%s, %s, %s, '❤️')", (MSG_A, A, A1))
success, err = try_sql(cur, "insert into message_reactions (message_id, community_id, user_id, emoji) values (%s, %s, %s, '👍')", (MSG_A, A, A1))
ok("restauré 4b. Contrainte unique restaurée : une 2e réaction active est de nouveau BLOQUÉE", not success)
conn.rollback(); conn.close()

# ---------------------------------------------------------------------------
# 5. (V7.8) REPLICA IDENTITY FULL sur messages/message_reactions (sql/07) — la repasser en
#    DEFAULT doit désactiver la garantie nécessaire aux DELETE Realtime filtrés (preuve :
#    relreplident != 'f'), la restaurer en FULL doit la reconfirmer (relreplident = 'f'). Signalé
#    par contre-vérification indépendante du ZIP V7.7 : aucune des deux tables n'avait ce réglage
#    — un DELETE réel n'aurait alors jamais transmis community_id au filtre Realtime, voir
#    sql/07_realtime_replica_identity.sql pour l'explication complète.
# ---------------------------------------------------------------------------
conn, cur = su()
cur.execute("alter table messages replica identity default")
cur.execute("alter table message_reactions replica identity default")
conn.commit(); conn.close()

conn, cur = su()
cur.execute("select relname, relreplident from pg_class where oid in ('public.messages'::regclass, 'public.message_reactions'::regclass)")
idents = dict(cur.fetchall())
conn.close()
ok("cassé 5a. messages en REPLICA IDENTITY DEFAULT : un DELETE Realtime filtré perdrait community_id (preuve : relreplident != 'f')", idents.get('messages') != 'f', f"idents={idents}")
ok("cassé 5b. message_reactions en REPLICA IDENTITY DEFAULT : même risque (preuve : relreplident != 'f')", idents.get('message_reactions') != 'f', f"idents={idents}")

conn, cur = su()
cur.execute("alter table messages replica identity full")
cur.execute("alter table message_reactions replica identity full")
conn.commit(); conn.close()

conn, cur = su()
cur.execute("select relname, relreplident from pg_class where oid in ('public.messages'::regclass, 'public.message_reactions'::regclass)")
idents = dict(cur.fetchall())
conn.close()
ok("restauré 5c. messages restaurée en REPLICA IDENTITY FULL (relreplident = 'f')", idents.get('messages') == 'f', f"idents={idents}")
ok("restauré 5d. message_reactions restaurée en REPLICA IDENTITY FULL (relreplident = 'f')", idents.get('message_reactions') == 'f', f"idents={idents}")

print(f"\n{pas} réussite(s), {echec} échec(s).")
sys.exit(1 if echec else 0)
