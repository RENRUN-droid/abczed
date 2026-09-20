# Tests SQL discriminants — Messages/réactions (V7.8, garde-fou revu en V7.9 puis V7.10)

Vérifie directement en SQL les garanties serveur (RLS, contrainte composite, trigger
d'immuabilité, REPLICA IDENTITY) apportées par `sql/06_message_reactions.sql` et
`sql/07_realtime_replica_identity.sql`, contre un **PostgreSQL local jetable** — jamais contre
le Supabase réel de l'utilisateur. Livré dans le ZIP à partir de la V7.8 (voir
`MATRICE_LIVRAISON.md`, sections V7.8 à V7.10, pour le contexte de ces ajouts).

## Prérequis

- Un serveur **PostgreSQL 14+** installé localement, accessible via `sudo -u postgres psql`
  (socket Unix). Ce n'est pas une dépendance `npm` — `npm install` n'installe aucune base de
  données, seulement les paquets Node du projet.
- **Python 3** avec `psycopg2` : `pip install psycopg2-binary` (ou `pip3`, selon votre
  environnement).

## Garde-fou (réécrit en V7.9, puis en V7.10)

`repro_tests.py`/`discriminating_tests.py` **refusent de s'exécuter** contre autre chose qu'une
base PostgreSQL locale dont le nom correspond exactement au motif `abczed_*_repro`, sur un hôte
local. `setup_repro_db.sh` applique la même règle sur le nom de base qu'on peut lui passer en
argument, et n'accepte structurellement aucun paramètre d'hôte (il n'utilise que
`sudo -u postgres psql`, toujours local) — il n'a jamais été concerné par les contournements
ci-dessous, qui portent tous sur la façon dont les scripts Python analysaient un DSN.

**Trois contournements confirmés au fil des lots précédents, tous corrigés :**

1. **V7.8** — le garde-fou lisait le DSN avec une regex qui capturait la PREMIÈRE occurrence
   d'une clé (`host=`, `dbname=`) — mais quand une clé libpq est répétée, c'est la DERNIÈRE
   valeur qui l'emporte réellement à la connexion (documenté :
   [libpq-connect](https://www.postgresql.org/docs/current/libpq-connect.html)). Un DSN du type
   `host=localhost host=evil.supabase.co dbname=abczed_v78_repro` passait donc la regex tout en
   se connectant réellement à `evil.supabase.co`. `hostaddr` (adresse IP réellement contactée,
   indépendante de `host`) n'était par ailleurs vérifié nulle part.
2. **V7.9 (correctif du point 1)** — remplacement de la regex par `psycopg2.extensions.parse_dsn`
   (résout correctement "dernière valeur gagne") et rejet explicite de `hostaddr`/`service`/
   `servicefile`. Mais `host` restait accepté comme chaîne libre, et libpq accepte plusieurs
   hôtes séparés par une VIRGULE dans la valeur `host` elle-même (liste de bascule : essaie le
   suivant si le premier échoue). `host=/var/run/postgresql,evil.supabase.co` passait donc
   `host.startswith('/')` tout en tentant aussi `evil.supabase.co`.
3. **V7.10 (correctif structurel)** — plutôt que de continuer à corriger une propriété de la
   syntaxe DSN/`host` à la fois (approche qui aurait fini par laisser filtrer un cinquième cas),
   **le DSN en chaîne est entièrement supprimé.** Seuls deux paramètres individuels sont
   acceptés, chacun validé par une liste blanche stricte (jamais une liste noire) : `host` (
   exactement `localhost`, exactement `127.0.0.1`, ou un chemin de socket absolu à un seul
   composant — aucune virgule, espace, point-virgule ni `=`) et `dbname` (exactement le motif
   `abczed_*_repro`). `user` est fixé en dur à `postgres`. La connexion est ouverte avec
   `psycopg2.connect(host=..., dbname=..., user=...)` — des arguments nommés transmis tels quels
   à libpq, jamais réassemblés en chaîne "clé=valeur" que libpq pourrait ensuite réinterpréter.
   Les variables d'environnement `PGHOSTADDR`/`PGSERVICE`/`PGSERVICEFILE` restent refusées si
   définies, par défense en profondeur.

Voir `_dsn_guard.py` pour le détail complet, et `test_dsn_guard.py` (26 assertions) pour la
couverture de ces trois contournements — y compris un test d'intégration qui lance un vrai
sous-processus et observe son code de sortie, pas seulement la logique interne.

## Rejouer les assertions depuis une extraction vierge de ce ZIP

Depuis la racine du projet extrait :

```bash
python3 scripts/sql-tests/test_dsn_guard.py
bash scripts/sql-tests/setup_repro_db.sh
sudo -u postgres python3 scripts/sql-tests/repro_tests.py
sudo -u postgres python3 scripts/sql-tests/discriminating_tests.py
```

- `test_dsn_guard.py` (26 assertions) — teste le garde-fou lui-même. La majorité ne nécessite
  aucune connexion (fonction pure `check_host_dbname`) ; trois assertions (section h) lancent un
  vrai sous-processus Python pour observer le code de sortie réel de `guarded_connect()`, sans
  jamais ouvrir de connexion PostgreSQL. Peut être lancé indépendamment de tout serveur
  PostgreSQL.
- `setup_repro_db.sh` détruit puis recrée la base locale `abczed_v78_repro`, stub un schéma
  `auth` minimal (jamais le vrai Supabase), applique `sql/01` à `sql/07` dans l'ordre, puis
  insère un jeu de données de test fixe (communautés A/B, 4 comptes, 4 événements, 2 messages).
- `repro_tests.py` (28 assertions) vérifie directement chaque garantie attendue : isolation de
  communauté, envoi, liaison à un événement, réactions (ajout/remplacement/retrait), usurpation
  bloquée, réaction intercommunauté bloquée, immuabilité d'identité, suppression en cascade,
  non-régression sur les liens interdits (`sql/02`), `ON DELETE SET NULL` sur un événement
  supprimé, et l'état `REPLICA IDENTITY FULL` posé par `sql/07`.
- `discriminating_tests.py` (12 assertions) reprend les 5 garanties les plus critiques et, pour
  chacune, **casse le garde-fou → prouve que l'attaque (ou la régression) réussit → restaure →
  reconfirme le blocage** : policy `insert_own_reaction`, clé étrangère composite, trigger
  d'immuabilité, contrainte unique `(message_id, user_id)`, et `REPLICA IDENTITY FULL` (V7.8).

Total : **66 assertions** (26 + 28 + 12).

`sudo -u postgres` est nécessaire pour les mêmes droits que `setup_repro_db.sh` a utilisés pour
créer la base — c'est le rôle `postgres` du système local, jamais un identifiant Supabase.

## Adapter la connexion à un autre environnement local

Si votre PostgreSQL local n'utilise pas le chemin de socket `/var/run/postgresql`, définissez la
variable d'environnement `ABCZED_SQL_TEST_HOST` avant de lancer les scripts Python — et
`ABCZED_SQL_TEST_DBNAME` si le nom de base diffère. Chacune passe par le même garde-fou que les
valeurs par défaut (liste blanche stricte, décrite ci-dessus) :

```bash
ABCZED_SQL_TEST_HOST=/tmp ABCZED_SQL_TEST_DBNAME=abczed_v78_repro python3 scripts/sql-tests/repro_tests.py
```

Il n'existe plus de variable pour un DSN complet en chaîne (`ABCZED_SQL_TEST_DSN`, retirée en
V7.10) — c'est délibéré, voir "Garde-fou" ci-dessus. `setup_repro_db.sh` accepte de son côté un
nom de base en premier argument (même motif obligatoire) s'il faut en créer une différente de la
valeur par défaut.

## Ce que ces scripts ne font PAS

Ils ne se connectent jamais à un projet Supabase réel, ne lisent ni n'écrivent d'identifiants
réels, et n'ont besoin d'aucune variable `.env`/`.env.local`. La base qu'ils créent et détruisent
est entièrement locale et jetable — la détruire (`drop database`, fait automatiquement en tête de
`setup_repro_db.sh` à chaque relance) ne supprime rien qui appartienne à l'utilisateur.
