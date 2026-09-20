# ABCZed

Appli web pour le groupe de parents (annuaire des membres : « La Bande ») — sorties, infos, docs, avec de vrais fichiers joints (photos, PDF…) et mise à jour en temps réel entre tous les membres.

Gratuit : hébergement sur Vercel (gratuit), base de données + stockage de fichiers sur Supabase (gratuit).

**⚠️ Migration sécurité en cours — ne pas utiliser en usage réel pour l'instant.**
Ce projet passe actuellement d'un prototype à données ouvertes vers une architecture avec authentification et accès privé par communauté. Cette migration se fait par étapes (`sql/01_...`, `sql/02_...`, etc.) — tant qu'elle n'est pas terminée, **aucune donnée réelle de parent, enfant, document ou photo ne doit être utilisée**, seulement des données fictives locales.

L'ancien schéma public (`legacy/schema_INSECURE_OLD_DO_NOT_RUN.sql`) **ne doit jamais être exécuté** — il n'a ni authentification ni cloisonnement entre communautés : quiconique aurait le lien pourrait tout lire et tout modifier. Il est conservé uniquement comme référence historique du prototype initial, pas comme une option.

**À savoir avant de te lancer :**
- Sans configuration Supabase (`.env` non rempli), l'appli tourne en **mode démo local** avec des données d'exemple — rien n'est sauvegardé entre deux ouvertures, et c'est volontaire tant que la sécurisation n'est pas terminée.
- Le projet Supabase gratuit se met en pause automatiquement après 7 jours sans activité. Si personne n'ouvre l'appli une semaine, elle affiche une erreur au prochain qui l'ouvre — il suffit de se reconnecter au tableau de bord Supabase et cliquer "Restore/Unpause".
- Limites du gratuit (largement suffisant pour un groupe de familles) : 1 Go de fichiers stockés, 5 Go de trafic par mois.

## Étape 1 — Créer le projet Supabase (base de données + fichiers)

1. Va sur supabase.com, crée un compte gratuit.
2. "New project" — choisis un nom et un mot de passe de base de données (à garder de côté, tu n'en auras pas besoin au quotidien).
3. Une fois le projet créé, va dans **SQL Editor** (menu de gauche) → **New query**.
4. Ouvre `sql/01_schema_and_helpers.sql` de ce dossier (**pas** le dossier `legacy/`), copie tout son contenu, colle-le dans l'éditeur, clique **Run**. Fais de même ensuite avec `sql/02_rls.sql`, puis `sql/03_storage.sql`, dans cet ordre — chaque script suppose le précédent déjà exécuté.
5. Va dans **Project Settings** (icône engrenage) → **API**. Note deux valeurs :
   - **Project URL**
   - **Publishable key** (remplace l'ancienne « anon key », dépréciée par Supabase fin 2026)

## Étape 2 — Mettre le code en ligne sur GitHub

1. Crée un compte gratuit sur github.com si tu n'en as pas.
2. Crée un nouveau dépôt (bouton vert "New").
3. Mets tout le contenu de ce dossier dedans (soit en glissant les fichiers depuis l'interface web GitHub, soit avec `git push` si tu es à l'aise avec ça).

## Étape 3 — Déployer sur Vercel

1. Va sur vercel.com, crée un compte gratuit (tu peux te connecter directement avec ton compte GitHub).
2. "Add New" → "Project" → sélectionne le dépôt GitHub que tu viens de créer.
3. Dans "Environment Variables", ajoute :
   - `VITE_SUPABASE_URL` = l'URL notée à l'étape 1
   - `VITE_SUPABASE_PUBLISHABLE_KEY` = la clé notée à l'étape 1
4. Clique "Deploy". Après une minute, Vercel te donne une URL du type `abczed.vercel.app`.
5. C'est cette URL que tu partages au groupe WhatsApp.

## Tester en local avant de déployer (optionnel)

```
npm install
cp .env.example .env
# remplis .env avec tes clés Supabase
npm run dev
```

## Rejouer les preuves de test livrées avec ce ZIP (optionnel)

- **Tests Node** (`scripts/test-*.mjs`) : `node scripts/test-nom-du-fichier.mjs`, aucune
  dépendance supplémentaire au-delà de `npm install`.
- **Tests Playwright** (`test-harness/`) : `npm install` installe la dépendance `playwright`
  elle-même, mais **pas** le binaire du navigateur — il faut en plus, une seule fois,
  `npx playwright install chromium`. Ensuite : `npx vite --config vite.harness.config.js` dans un
  terminal, puis `node test-harness/recette.mjs` et `node test-harness/recette-messages-isolation.mjs`
  dans un autre. Le lot V7.12 ajoute aussi `node test-harness/recette-v712.mjs` pour les actions
  rapides de l'Accueil, la modification/suppression des messages et la gestion des anniversaires.
- **Tests SQL discriminants** (`scripts/sql-tests/`) : nécessitent un PostgreSQL local (pas
  `npm install`, qui n'installe aucune base de données) et `pip install psycopg2-binary`. Voir
  `scripts/sql-tests/README.md` pour la marche à suivre complète — ces scripts ne se connectent
  jamais à un projet Supabase réel (garde-fou intégré).

## Pour aller plus loin

- Ajouter un vrai nom de domaine (ex. `labande.fr`) : possible gratuitement dans Vercel si tu achètes le domaine ailleurs (quelques euros/an chez un registrar), Vercel ne facture pas pour le brancher.
- Installer l'appli sur l'écran d'accueil du téléphone : ouvrir l'URL dans le navigateur du téléphone, puis "Ajouter à l'écran d'accueil" (Safari) ou "Installer l'application" (Chrome Android).
