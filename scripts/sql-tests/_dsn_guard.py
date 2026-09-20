"""ABCZed V7.10 — garde-fou pour repro_tests.py/discriminating_tests.py.

Troisième réécriture, après un QUATRIÈME contournement confirmé de la V7.9 :

    host=/var/run/postgresql,evil.supabase.co dbname=abczed_v78_repro

passait le garde-fou V7.9 (`host.startswith("/")` renvoie `True`, la valeur commence bien par
'/') alors que libpq accepte plusieurs hôtes séparés par une virgule dans le paramètre `host`
lui-même et essaie le suivant de la liste si le premier échoue — documenté :
https://www.postgresql.org/docs/current/libpq-connect.html#LIBPQ-MULTIPLE-HOSTS

Les versions précédentes de ce garde-fou (V7.8 : regex sur un DSN en chaîne ; V7.9 : analyse du
DSN via `psycopg2.extensions.parse_dsn` mais acceptant encore `host` comme chaîne libre) ont
chacune été contournées par une propriété différente de la syntaxe DSN/`host` de libpq (clé
répétée, `hostaddr`, liste multi-hôtes séparée par des virgules). Plutôt que de continuer à
corriger ces cas un par un — approche qui laissera presque certainement filtrer un cinquième
contournement —, ce lot applique le correctif structurel recommandé par la contre-vérification
indépendante : **il n'existe plus de DSN en chaîne du tout.**

Seuls deux paramètres sont acceptés, individuellement validés par une expression régulière
stricte en LISTE BLANCHE (jamais en liste noire) :
  - `host` : exactement 'localhost', exactement '127.0.0.1', ou un chemin de socket Unix absolu
    à un seul composant, sans virgule, espace, point-virgule ni signe '=' ;
  - `dbname` : exactement le motif `abczed_[a-zA-Z0-9]*_repro`.

`user` est FIXÉ à `'postgres'` (jamais lu depuis une entrée externe) — c'est le rôle système
local déjà utilisé par `setup_repro_db.sh` (`sudo -u postgres`), jamais un identifiant Supabase.
Aucun autre paramètre libpq (`hostaddr`, `service`, `servicefile`, `port`, `sslmode`, ...) n'est
accepté nulle part — ils ne peuvent donc plus être injectés, ni directement, ni via une virgule,
un espace ou une clé dupliquée dans une valeur, puisqu'il n'y a plus de chaîne à analyser : la
connexion est ouverte avec `psycopg2.connect(host=..., dbname=..., user=...)`, des arguments
nommés transmis tels quels à libpq (`PQconnectdbParams`) — jamais réassemblés en une chaîne
"clé=valeur" que libpq pourrait ensuite réinterpréter.

Refuse toujours, par défense en profondeur, les variables d'environnement `PGHOSTADDR`,
`PGSERVICE`, `PGSERVICEFILE` si elles sont définies (même risque que `hostaddr`/`service` dans
un DSN, mais invisible ici puisqu'il n'y a plus de DSN à inspecter).
"""
import os
import re
import sys

import psycopg2

DEFAULT_HOST = "/var/run/postgresql"
DEFAULT_DBNAME = "abczed_v78_repro"
FIXED_USER = "postgres"

# Liste blanche stricte — jamais une liste noire de caractères interdits. Un chemin de socket
# absolu à un seul composant (lettres/chiffres/'_'/'.'/'/'/'-'), OU exactement 'localhost'/
# '127.0.0.1'. Aucune virgule (liste multi-hôtes libpq), aucun espace, aucun '=' (empêcherait
# qu'une clé libpq supplémentaire soit smugglée à l'intérieur de la valeur elle-même).
_HOST_PATTERN = re.compile(r"^(?:localhost|127\.0\.0\.1|/[A-Za-z0-9_./-]*)$")
_DBNAME_PATTERN = re.compile(r"^abczed_[a-zA-Z0-9]*_repro$")

FORBIDDEN_ENV_VARS = ("PGHOSTADDR", "PGSERVICE", "PGSERVICEFILE")


def check_host_dbname(host, dbname, env=None):
    """Fonction PURE (aucun sys.exit, aucune connexion) : renvoie (ok: bool, reason: str)."""
    env = os.environ if env is None else env

    for var in FORBIDDEN_ENV_VARS:
        if env.get(var):
            return False, (
                f"la variable d'environnement {var} est définie — elle peut rediriger la "
                "connexion réelle sans apparaître dans host/dbname. Retire-la avant de relancer."
            )

    if not isinstance(host, str) or not _HOST_PATTERN.fullmatch(host):
        return False, (
            f"host {host!r} refusé — doit être exactement 'localhost', '127.0.0.1', ou un "
            "chemin de socket Unix absolu à un seul composant (aucune virgule, aucun espace, "
            "aucun '=')."
        )
    if not isinstance(dbname, str) or not _DBNAME_PATTERN.fullmatch(dbname):
        return False, f"dbname {dbname!r} refusé — doit correspondre exactement à 'abczed_*_repro'."

    return True, ""


def resolve_and_guard_connect_kwargs():
    host = os.environ.get("ABCZED_SQL_TEST_HOST", DEFAULT_HOST)
    dbname = os.environ.get("ABCZED_SQL_TEST_DBNAME", DEFAULT_DBNAME)
    ok, reason = check_host_dbname(host, dbname)
    if not ok:
        sys.stderr.write(
            f"REFUS : {reason}\n"
            f"host={host!r} dbname={dbname!r}\n"
            "Ceci est volontaire — voir sql-tests/_dsn_guard.py — et empêche structurellement "
            "toute exécution accidentelle de ces tests contre un projet Supabase réel.\n"
        )
        sys.exit(2)
    return {"host": host, "dbname": dbname, "user": FIXED_USER}


def guarded_connect():
    """Ouvre une connexion PostgreSQL avec des paramètres structurés, jamais une chaîne DSN
    assemblée à la main — utilisée par repro_tests.py/discriminating_tests.py à la place de
    `psycopg2.connect(DSN)`. Chaque appel revalide host/dbname (coût négligeable, protège aussi
    contre une modification accidentelle des variables d'environnement en cours de script)."""
    return psycopg2.connect(**resolve_and_guard_connect_kwargs())
