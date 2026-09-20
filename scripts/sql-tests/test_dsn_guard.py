#!/usr/bin/env python3
# ABCZed V7.10 — tests automatisés du garde-fou _dsn_guard.py. Couvre les QUATRE contournements
# confirmés au fil des lots précédents (regex sur clé DSN répétée en V7.8, `hostaddr`/`service`/
# `servicefile` en V7.8, liste multi-hôtes séparée par virgule en V7.9) ainsi que le nouveau
# modèle sans DSN en chaîne (V7.10). `check_host_dbname()` est une fonction pure — ces tests
# n'ouvrent aucune connexion ni base de données, et sont donc rapides et indépendants de tout
# serveur PostgreSQL local.
#
# Un test d'intégration (section j) lance en plus un VRAI sous-processus Python qui appelle
# `resolve_and_guard_connect_kwargs()` (le point d'entrée réellement utilisé par
# repro_tests.py/discriminating_tests.py via guarded_connect()) pour prouver que le code de
# sortie observé de l'extérieur — pas seulement la valeur booléenne interne — est bien 2 en cas
# de refus, exactement ce qu'une contre-vérification indépendante observerait.
import os
import subprocess
import sys

from _dsn_guard import check_host_dbname, FORBIDDEN_ENV_VARS

pas, echec = 0, 0

def ok(label, cond, detail=""):
    global pas, echec
    if cond:
        print(f"OK  {label}")
        pas += 1
    else:
        print(f"XXX {label}" + (f" — {detail}" if detail else ""))
        echec += 1

def accepted(host, dbname, env=None):
    return check_host_dbname(host, dbname, env=env or {})

# ---------------------------------------------------------------------------
# a. Cas nominaux — doivent être ACCEPTÉS
# ---------------------------------------------------------------------------
r, reason = accepted("/var/run/postgresql", "abczed_v78_repro")
ok("a1. Socket local par défaut + base jetable -> accepté", r, reason)
r, reason = accepted("localhost", "abczed_v78_repro")
ok("a2. host=localhost (nom exact) -> accepté", r, reason)
r, reason = accepted("127.0.0.1", "abczed_test_repro")
ok("a3. host=127.0.0.1 -> accepté", r, reason)
r, reason = accepted("/tmp", "abczed_x_repro")
ok("a4. Autre chemin de socket local (/tmp) -> accepté", r, reason)

# ---------------------------------------------------------------------------
# b. Contournement V7.9 confirmé — liste multi-hôtes libpq séparée par une virgule : `host`
#    commence bien par '/' (passait l'ancien `host.startswith('/')`) mais contient un second
#    hôte que libpq essaierait si le premier échoue. Doit être REFUSÉ, quel que soit l'ordre.
# ---------------------------------------------------------------------------
r, reason = accepted("/var/run/postgresql,evil.supabase.co", "abczed_v78_repro")
ok("b1. host multi-hôtes, local PUIS distant (contournement V7.9) -> REFUSÉ", not r, "devrait être refusé")
r, reason = accepted("evil.supabase.co,localhost", "abczed_v78_repro")
ok("b2. host multi-hôtes, distant PUIS local -> REFUSÉ (l'ordre ne doit rien changer)", not r, "devrait être refusé")
r, reason = accepted("localhost,127.0.0.1", "abczed_v78_repro")
ok("b3. host multi-hôtes, les DEUX locaux -> REFUSÉ quand même (aucune virgule tolérée, liste blanche stricte)", not r, "devrait être refusé")

# ---------------------------------------------------------------------------
# c. Tentative de smuggler un paramètre supplémentaire À L'INTÉRIEUR de la valeur host elle-même
#    (espace, '=') — n'a de toute façon plus d'effet depuis que la connexion est ouverte avec
#    des arguments nommés séparés (jamais une chaîne réassemblée), mais la valeur doit rester
#    refusée par la liste blanche elle-même, en défense en profondeur.
# ---------------------------------------------------------------------------
r, reason = accepted("/var/run/postgresql hostaddr=203.0.113.10", "abczed_v78_repro")
ok("c1. host contenant un espace + 'hostaddr=...' -> REFUSÉ", not r, "devrait être refusé")
r, reason = accepted("/var/run/postgresql;evil.supabase.co", "abczed_v78_repro")
ok("c2. host contenant un point-virgule -> REFUSÉ", not r, "devrait être refusé")
r, reason = accepted("", "abczed_v78_repro")
ok("c3. host vide -> REFUSÉ", not r, "devrait être refusé")
r, reason = accepted(None, "abczed_v78_repro")
ok("c4. host = None (type invalide) -> REFUSÉ proprement, pas de crash", not r, "devrait être refusé")

# ---------------------------------------------------------------------------
# d. Hôte distant simple (sans virgule) — non-régression des garde-fous précédents.
# ---------------------------------------------------------------------------
r, reason = accepted("my-project.supabase.co", "abczed_v78_repro")
ok("d1. Hôte distant *.supabase.co (sans virgule) -> REFUSÉ", not r, "devrait être refusé")
r, reason = accepted("203.0.113.10", "abczed_v78_repro")
ok("d2. Hôte = adresse IP publique -> REFUSÉ", not r, "devrait être refusé")

# ---------------------------------------------------------------------------
# e. Base non jetable — non-régression.
# ---------------------------------------------------------------------------
r, reason = accepted("/var/run/postgresql", "production")
ok("e1. dbname ne correspondant pas au motif abczed_*_repro -> REFUSÉ", not r, "devrait être refusé")
r, reason = accepted("/var/run/postgresql", "abczed_production")
ok("e2. dbname 'abczed_production' (ne finit pas par _repro) -> REFUSÉ", not r, "devrait être refusé")
r, reason = accepted("/var/run/postgresql", "abczed_v78_repro,production")
ok("e3. dbname contenant une virgule (même logique que le host) -> REFUSÉ", not r, "devrait être refusé")
r, reason = accepted("/var/run/postgresql", None)
ok("e4. dbname = None (type invalide) -> REFUSÉ proprement, pas de crash", not r, "devrait être refusé")

# ---------------------------------------------------------------------------
# f. Variables d'environnement PGHOSTADDR/PGSERVICE/PGSERVICEFILE — refusées même avec un
#    host/dbname par ailleurs parfaitement conformes (défense en profondeur, non-régression).
# ---------------------------------------------------------------------------
for var in FORBIDDEN_ENV_VARS:
    r, reason = accepted("/var/run/postgresql", "abczed_v78_repro", env={var: "x"})
    ok(f"f-{var}. Variable d'environnement {var} définie -> REFUSÉ même avec host/dbname conformes", not r, "devrait être refusé")

# ---------------------------------------------------------------------------
# g. Rejeu exact des DSN historiquement contournés (V7.8 x3, V7.9 x1), traduits dans le nouveau
#    modèle host/dbname séparés (la valeur EFFECTIVE que libpq aurait retenue) — chacun doit
#    rester REFUSÉ. `hostaddr`/`service`/`servicefile` (V7.8 #2) sont structurellement
#    impossibles à soumettre depuis que ce module n'accepte plus que host/dbname — voir section c
#    pour la preuve qu'une tentative de les smuggler dans `host` est de toute façon rejetée.
# ---------------------------------------------------------------------------
r, reason = accepted("db.example.supabase.co", "abczed_v78_repro")  # V7.8 #1 : host dupliqué, dernière valeur distante
ok("g1. Rejeu V7.8 #1 (host dupliqué -> valeur effective distante) -> REFUSÉ", not r, "devrait être refusé")
r, reason = accepted("/var/run/postgresql", "production")  # V7.8 #3 : dbname dupliqué, dernière valeur non jetable
ok("g2. Rejeu V7.8 #3 (dbname dupliqué -> valeur effective non jetable) -> REFUSÉ", not r, "devrait être refusé")
r, reason = accepted("/var/run/postgresql,evil.supabase.co", "abczed_v78_repro")  # V7.9
ok("g3. Rejeu V7.9 (host multi-hôtes) -> REFUSÉ", not r, "devrait être refusé")

# ---------------------------------------------------------------------------
# h. Confirmation croisée : le point d'entrée RÉELLEMENT utilisé par repro_tests.py et
#    discriminating_tests.py (guarded_connect(), via resolve_and_guard_connect_kwargs()) sort
#    bien avec le code 2 pour le contournement V7.9 exact, observé depuis un VRAI sous-processus
#    — pas seulement la fonction pure check_host_dbname() testée ci-dessus.
# ---------------------------------------------------------------------------
_HERE = os.path.dirname(__file__)

proc = subprocess.run(
    [sys.executable, "-c", "from _dsn_guard import resolve_and_guard_connect_kwargs; resolve_and_guard_connect_kwargs()"],
    cwd=_HERE,
    env={**os.environ, "ABCZED_SQL_TEST_HOST": "/var/run/postgresql,evil.supabase.co", "ABCZED_SQL_TEST_DBNAME": "abczed_v78_repro"},
    capture_output=True, text=True,
)
ok("h1. Sous-processus réel, rejeu V7.9 exact via ABCZED_SQL_TEST_HOST -> exit code 2", proc.returncode == 2, f"exit={proc.returncode}, stderr={proc.stderr!r}")
ok("h2. ...et le message de refus mentionne bien le host refusé", "REFUS" in proc.stderr)

proc_ok = subprocess.run(
    [sys.executable, "-c", "from _dsn_guard import resolve_and_guard_connect_kwargs; print(resolve_and_guard_connect_kwargs())"],
    cwd=_HERE,
    env={**os.environ, "ABCZED_SQL_TEST_HOST": "/var/run/postgresql", "ABCZED_SQL_TEST_DBNAME": "abczed_v78_repro"},
    capture_output=True, text=True,
)
ok("h3. Sous-processus réel, DSN conforme -> exit code 0 (n'ouvre pas de connexion, résout juste les kwargs)", proc_ok.returncode == 0, f"exit={proc_ok.returncode}, stderr={proc_ok.stderr!r}")

print(f"\n{pas} réussite(s), {echec} échec(s).")
sys.exit(1 if echec else 0)
