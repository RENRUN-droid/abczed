#!/usr/bin/env python3
# ABCZed V7.8 — vérification SQL directe (P5/P8/P9) contre un PostgreSQL LOCAL JETABLE, jamais
# contre le Supabase réel de l'utilisateur (garde-fou : voir _dsn_guard.py, appelé avant toute
# connexion, à chaque connexion). LIVRÉ DANS LE ZIP à partir de la V7.8 — voir
# scripts/sql-tests/setup_repro_db.sh pour reconstruire la base attendue par ce script depuis une
# extraction vierge de ce ZIP.
#
# (V7.7 : ce script n'existait que comme fichier de travail hors ZIP — signalé par
# contre-vérification indépendante comme rendant ces assertions alors annoncées impossibles à
# rejouer depuis le ZIP livré. Corrigé ici : ce fichier même EST la preuve.)
# (V7.10 : n'ouvre plus jamais de connexion via une chaîne DSN assemblée à la main — voir
# _dsn_guard.py pour le détail des contournements V7.8/V7.9 que ce changement élimine.)
#
# Prérequis : `pip install psycopg2-binary` (ou `psycopg2` si votre distribution fournit déjà
# les bibliothèques PostgreSQL de dev) — dépendance Python, distincte de `npm install` (qui
# n'installe que les dépendances Node du projet, jamais celle-ci).
import sys

from _dsn_guard import guarded_connect

A = "11111111-1111-1111-1111-111111111111"
B = "22222222-2222-2222-2222-222222222222"
A1 = "a1111111-0000-0000-0000-000000000001"  # membre A (auteur du message A)
A2_ADMIN = "a1111111-0000-0000-0000-000000000002"  # admin A
A3 = "a1111111-0000-0000-0000-000000000003"  # membre A, ni auteur ni admin
B1 = "b2222222-0000-0000-0000-000000000001"  # membre B
NONE_USER = "c9999999-0000-0000-0000-000000000001"  # authentifié, sans adhesion

MSG_A = "aaaa1111-0000-0000-0000-000000000001"
MSG_B = "bbbb2222-0000-0000-0000-000000000001"
EVT_A = "eaaa1111-0000-0000-0000-000000000001"
EVT_A_DELETABLE = "eaaa1111-0000-0000-0000-000000000002"
EVT_B = "ebbb2222-0000-0000-0000-000000000001"
EVT_A_BDAY = "eaaa1111-0000-0000-0000-0000000000aa"

pas, echec = 0, 0
failures = []

def ok(label, cond, detail=""):
    global pas, echec
    if cond:
        print(f"OK  {label}")
        pas += 1
    else:
        print(f"XXX {label}" + (f" — {detail}" if detail else ""))
        echec += 1
        failures.append(label)

def as_user(user_id):
    """Nouvelle connexion, role authenticated, jwt.claim.sub = user_id, transaction ouverte
    (jamais commit implicite) — l'appelant décide explicitement de commit()/rollback()."""
    conn = guarded_connect()
    conn.autocommit = False
    cur = conn.cursor()
    cur.execute("set role authenticated")
    cur.execute("select set_config('request.jwt.claim.sub', %s, true)", (user_id,))
    return conn, cur

def as_superuser():
    conn = guarded_connect()
    conn.autocommit = False
    return conn, conn.cursor()

def try_sql(cur, sql, params=None):
    """Retourne (True, None) si la requête réussit, (False, message) si elle lève une erreur
    (et absorbe l'erreur — le test suivant sur la même connexion doit rester utilisable après
    un ROLLBACK explicite par l'appelant, PostgreSQL n'autorisant plus rien sur une transaction
    déjà avortée)."""
    try:
        cur.execute(sql, params or ())
        return True, None
    except Exception as e:
        return False, str(e)

# ---------------------------------------------------------------------------
# a. Isolation de communauté en lecture
# ---------------------------------------------------------------------------
conn, cur = as_user(A1)
cur.execute("select id from messages where community_id = %s", (A,))
rows = [r[0] for r in cur.fetchall()]
ok("a1. A1 (membre A) voit le message de A", MSG_A in rows)
cur.execute("select id from messages where community_id = %s", (B,))
rows = [r[0] for r in cur.fetchall()]
ok("a2. A1 ne voit AUCUN message de B (RLS, pas juste un filtre applicatif)", rows == [])
conn.rollback(); conn.close()

conn, cur = as_user(B1)
cur.execute("select id from messages")
rows = [r[0] for r in cur.fetchall()]
ok("a3. B1 (membre B) ne voit que le message de B", rows == [MSG_B], f"rows={rows}")
conn.rollback(); conn.close()

conn, cur = as_user(NONE_USER)
cur.execute("select id from messages")
rows = [r[0] for r in cur.fetchall()]
ok("a4. Un utilisateur authentifié SANS adhésion ne voit AUCUN message", rows == [])
conn.rollback(); conn.close()

# ---------------------------------------------------------------------------
# b. Envoi : membre A peut envoyer dans A, pas dans B, ne peut pas usurper author_id
# ---------------------------------------------------------------------------
conn, cur = as_user(A1)
success, err = try_sql(cur, "insert into messages (community_id, author_id, text) values (%s, %s, 'test envoi A')", (A, A1))
ok("b1. A1 peut envoyer un message dans SA communauté A", success, err)
conn.rollback(); conn.close()

conn, cur = as_user(A1)
success, err = try_sql(cur, "insert into messages (community_id, author_id, text) values (%s, %s, 'tentative B')", (B, A1))
ok("b2. A1 NE PEUT PAS envoyer dans B (pas membre de B)", not success)
conn.rollback(); conn.close()

conn, cur = as_user(A1)
success, err = try_sql(cur, "insert into messages (community_id, author_id, text) values (%s, %s, 'usurpation')", (A, A2_ADMIN))
ok("b3. A1 NE PEUT PAS usurper author_id (insérer au nom de A2)", not success)
conn.rollback(); conn.close()

# ---------------------------------------------------------------------------
# c. Liaison à un événement : auteur/admin peuvent, un autre membre ne peut pas
# ---------------------------------------------------------------------------
conn, cur = as_user(A1)
success, err = try_sql(cur, "update messages set linked_event_id = %s where id = %s", (EVT_A, MSG_A))
ok("c1. A1 (auteur du message) peut le lier à un événement réel de A", success, err)
conn.commit(); conn.close()  # committed : la suite du script s'appuie sur ce lien

conn, cur = as_user(A2_ADMIN)
success, err = try_sql(cur, "update messages set linked_event_id = NULL where id = %s", (MSG_A,))
ok("c2. A2 (admin, pas auteur) peut aussi modifier le lien du message de A1", success, err)
conn.rollback(); conn.close()  # rollback : on garde le lien posé par c1 pour la suite

conn, cur = as_user(A3)
cur.execute("update messages set text = 'hacked par A3' where id = %s", (MSG_A,))
rowcount = cur.rowcount
ok("c3. A3 (simple membre, ni auteur ni admin) NE MODIFIE AUCUNE ligne (RLS silencieuse, 0 ligne affectée)", rowcount == 0, f"rowcount={rowcount}")
conn.rollback(); conn.close()

# ---------------------------------------------------------------------------
# d. Réactions : un membre peut réagir au message d'un autre sans pouvoir le modifier
# ---------------------------------------------------------------------------
conn, cur = as_user(A3)
success, err = try_sql(cur, "insert into message_reactions (message_id, community_id, user_id, emoji) values (%s, %s, %s, '❤️')", (MSG_A, A, A3))
ok("d1. A3 peut réagir au message de A1", success, err)
conn.commit(); conn.close()

conn, cur = as_user(A3)
cur.execute("update messages set text = 'hacked par A3 (2)' where id = %s", (MSG_A,))
ok("d2. ...mais A3 ne peut toujours PAS modifier ce message (0 ligne)", cur.rowcount == 0)
conn.rollback(); conn.close()

# ---------------------------------------------------------------------------
# e. Une seule réaction par utilisateur/message ; changement et retrait fonctionnent
# ---------------------------------------------------------------------------
conn, cur = as_user(A3)
success, err = try_sql(cur, "insert into message_reactions (message_id, community_id, user_id, emoji) values (%s, %s, %s, '👍')", (MSG_A, A, A3))
ok("e1. Une 2e réaction (autre émoji) du MÊME utilisateur sur le MÊME message est REJETÉE (contrainte unique)", not success)
conn.rollback(); conn.close()

conn, cur = as_user(A3)
success, err = try_sql(cur, "update message_reactions set emoji = '👍' where message_id = %s and user_id = %s", (MSG_A, A3))
ok("e2. Remplacer sa réaction via UPDATE (seul emoji change) fonctionne", success, err)
cur.execute("select emoji from message_reactions where message_id=%s and user_id=%s", (MSG_A, A3))
ok("e2b. ...et l'émoji est bien '👍' après remplacement", cur.fetchone()[0] == '👍')
conn.commit(); conn.close()

conn, cur = as_user(A3)
success, err = try_sql(cur, "delete from message_reactions where message_id = %s and user_id = %s", (MSG_A, A3))
ok("e3. Retirer sa réaction (DELETE) fonctionne", success, err)
cur.execute("select count(*) from message_reactions where message_id=%s and user_id=%s", (MSG_A, A3))
ok("e3b. ...et elle a bien disparu", cur.fetchone()[0] == 0)
conn.commit(); conn.close()

# ---------------------------------------------------------------------------
# f. Usurpation, réaction intercommunauté, modification d'identité — tout échoue
# ---------------------------------------------------------------------------
conn, cur = as_user(A1)
success, err = try_sql(cur, "insert into message_reactions (message_id, community_id, user_id, emoji) values (%s, %s, %s, '❤️')", (MSG_A, A, A2_ADMIN))
ok("f1. A1 NE PEUT PAS insérer une réaction au nom de A2 (usurpation de user_id)", not success)
conn.rollback(); conn.close()

conn, cur = as_user(A1)
# community_id fourni = A (la vraie communauté de A1), mais message_id = MSG_B (appartient à B)
# — la clé étrangère composite (message_id, community_id) doit rejeter ceci : aucune ligne de
# `messages` n'a (MSG_B, A), puisque MSG_B a réellement community_id = B.
success, err = try_sql(cur, "insert into message_reactions (message_id, community_id, user_id, emoji) values (%s, %s, %s, '❤️')", (MSG_B, A, A1))
ok("f2. Réaction intercommunauté rejetée par la clé étrangère composite (message_id,community_id)", not success, err)
conn.rollback(); conn.close()

# Test du TRIGGER d'immuabilité indépendamment de la RLS : en tant que superutilisateur
# (BYPASSRLS), la RLS ne peut pas être ce qui bloque — seul le trigger BEFORE UPDATE peut
# encore l'empêcher. Nécessaire pour prouver que le trigger est une garantie réelle et pas une
# redite invisible de la policy (brief : "la RLS complète cette structure mais ne la remplace pas").
conn, cur = as_superuser()
cur.execute("insert into message_reactions (message_id, community_id, user_id, emoji) values (%s, %s, %s, '😮') returning id", (MSG_A, A, A2_ADMIN))
rid = cur.fetchone()[0]
success, err = try_sql(cur, "update message_reactions set user_id = %s where id = %s", (A3, rid))
ok("f3. Le TRIGGER seul (superutilisateur, RLS non pertinente) bloque un changement de user_id", not success, err)
conn.rollback(); conn.close()

conn, cur = as_superuser()
cur.execute("insert into message_reactions (message_id, community_id, user_id, emoji) values (%s, %s, %s, '😮') returning id", (MSG_A, A, A2_ADMIN))
rid = cur.fetchone()[0]
success, err = try_sql(cur, "update message_reactions set message_id = %s where id = %s", (MSG_B, rid))
ok("f4. Le TRIGGER seul bloque aussi un changement de message_id", not success, err)
conn.rollback(); conn.close()

# ---------------------------------------------------------------------------
# g. Suppression du message => suppression en cascade de ses réactions
# ---------------------------------------------------------------------------
conn, cur = as_superuser()
cur.execute("insert into messages (id, community_id, author_id, text) values (gen_random_uuid(), %s, %s, 'a supprimer') returning id", (A, A1))
tmp_msg = cur.fetchone()[0]
cur.execute("insert into message_reactions (message_id, community_id, user_id, emoji) values (%s, %s, %s, '😂')", (tmp_msg, A, A3))
conn.commit()
cur.execute("delete from messages where id = %s", (tmp_msg,))
conn.commit()
cur.execute("select count(*) from message_reactions where message_id = %s", (tmp_msg,))
ok("g1. Supprimer un message supprime bien ses réactions en cascade", cur.fetchone()[0] == 0)
conn.close()

# ---------------------------------------------------------------------------
# h. Non-régression : événement d'une autre communauté / anniversaire restent impossibles à lier
# (trg_check_message_event_link, déjà en sql/02, non modifié par sql/06 — juste reconfirmé)
# ---------------------------------------------------------------------------
conn, cur = as_user(A1)
success, err = try_sql(cur, "update messages set linked_event_id = %s where id = %s", (EVT_B, MSG_A))
ok("h1. Lier un message de A à un événement de B reste impossible (non-régression sql/02)", not success)
conn.rollback(); conn.close()

conn, cur = as_user(A1)
success, err = try_sql(cur, "update messages set linked_event_id = %s where id = %s", (EVT_A_BDAY, MSG_A))
ok("h2. Lier un message à un rappel d'anniversaire reste impossible (non-régression sql/02)", not success)
conn.rollback(); conn.close()

# ---------------------------------------------------------------------------
# P4 : un événement supprimé laisse le message visible sans lien cassé (ON DELETE SET NULL)
# ---------------------------------------------------------------------------
conn, cur = as_superuser()
cur.execute("insert into messages (id, community_id, author_id, text, linked_event_id) values (gen_random_uuid(), %s, %s, 'lie a un evenement jetable', %s) returning id", (A, A1, EVT_A_DELETABLE))
tmp_msg2 = cur.fetchone()[0]
conn.commit()
cur.execute("delete from events where id = %s", (EVT_A_DELETABLE,))
conn.commit()
cur.execute("select linked_event_id from messages where id = %s", (tmp_msg2,))
row = cur.fetchone()
ok("p4-1. Le message existe toujours après suppression de l'événement lié", row is not None)
ok("p4-2. ...et son linked_event_id est bien NULL (ON DELETE SET NULL), pas un lien cassé", row is not None and row[0] is None)
conn.close()

# ---------------------------------------------------------------------------
# P7 (V7.8) : REPLICA IDENTITY FULL sur messages/message_reactions (sql/07) — condition
# nécessaire pour qu'un DELETE Realtime filtré par community_id fonctionne réellement (voir
# sql/07_realtime_replica_identity.sql pour le détail). Vérification de l'état attendu tel que
# posé par sql/07 — la preuve discriminante casser/restaurer est dans discriminating_tests.py.
# ---------------------------------------------------------------------------
conn, cur = as_superuser()
cur.execute("select relname, relreplident from pg_class where oid in ('public.messages'::regclass, 'public.message_reactions'::regclass)")
idents = dict(cur.fetchall())
ok("p7-1. messages a bien REPLICA IDENTITY FULL dès l'application de sql/07 (relreplident='f')", idents.get('messages') == 'f', f"idents={idents}")
ok("p7-2. message_reactions a bien REPLICA IDENTITY FULL dès l'application de sql/07 (relreplident='f')", idents.get('message_reactions') == 'f', f"idents={idents}")
conn.close()

print(f"\n{pas} réussite(s), {echec} échec(s).")
if failures:
    print("Échecs :", failures)
sys.exit(1 if echec else 0)
