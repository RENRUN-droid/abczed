# Valider la sécurité sur un vrai projet Supabase

Ce guide est pour **toi**, pas pour moi — je ne peux pas créer de compte Supabase ni
exécuter ces étapes à ta place. Suis-le dans l'ordre. Compte environ 30-40 minutes.

**Recommandation :** fais ça sur un projet Supabase **dédié aux tests**, séparé de celui
que tu utiliseras un jour en vrai — pour ne jamais risquer de mélanger données de test et
données réelles.

## 1. Créer le projet de test

1. Sur supabase.com, "New project" — donne-lui un nom du genre `abczed-test`.
2. Attends que le projet soit prêt (1-2 minutes).

## 2. Exécuter les scripts SQL, dans l'ordre

Dans **SQL Editor** → **New query**, colle et exécute (**Run**) chacun de ces fichiers
l'un après l'autre, en attendant que chacun se termine sans erreur avant de passer au
suivant :

1. `sql/01_schema_and_helpers.sql`
2. `sql/02_rls.sql`
3. `sql/03_storage.sql`
4. `sql/04_rsvp_headcount.sql`
5. `sql/05_participant_names.sql`
6. **`sql/06_message_reactions.sql`** — **nouveau depuis la V7.7**, nécessaire pour
   que Messages fonctionne réellement : ajoute la table `message_reactions` (réactions), une
   contrainte `unique(id, community_id)` sur `messages` et tente d'ajouter `messages`/
   `message_reactions` à la publication Realtime `supabase_realtime` si elle existe déjà (sans
   erreur si elle n'existe pas encore — dans ce cas, active-la toi-même ensuite, voir l'étape 8
   ci-dessous). Comme les scripts précédents, il est écrit pour être rejouable sans erreur si tu
   l'exécutes deux fois par erreur. **Sans cette étape, l'application affichera une erreur
   réelle dès l'ouverture de Messages** (table absente) — c'est le comportement honnête voulu
   (jamais un repli silencieux vers une donnée de démonstration), pas un bug à signaler.
7. **`sql/07_realtime_replica_identity.sql`** — **nouveau dans cette livraison (V7.8)**, à
   exécuter juste après `sql/06`. Règle `messages` et `message_reactions` en
   `REPLICA IDENTITY FULL`, condition nécessaire pour qu'un `DELETE` Realtime **filtré** par
   `community_id` fonctionne réellement : par défaut, PostgreSQL ne transmet dans la ligne
   supprimée que la clé primaire, jamais `community_id` — le filtre appliqué côté client
   (`messagesApi.js`) ne matcherait alors jamais un vrai `DELETE`. Signalé par contre-
   vérification indépendante du ZIP V7.7 (où `sql/06` ajoutait bien les deux tables à la
   publication `supabase_realtime`, mais sans ce réglage). Rejouable sans erreur si exécuté deux
   fois, et sans effet néfaste s'il est exécuté même sans que `sql/06` ait encore été appliqué
   (il vérifie l'existence des tables avant d'agir).

## 3. Créer les 5 comptes de test

Dans **Authentication** → **Users** → **Add user** (en haut à droite), crée ces 5 comptes.
Pour chacun, choisis un mot de passe et **note-le** — tu en auras besoin à l'étape 5.

| Email | Rôle prévu |
|---|---|
| `test-a1@abczed-verif.local` | membre normal, communauté A |
| `test-a2-admin@abczed-verif.local` | admin, communauté A |
| `test-b1@abczed-verif.local` | membre normal, communauté B |
| `test-a3-toberemoved@abczed-verif.local` | membre normal, communauté A — le script le passera "removed" pendant la vérification, puis le restaurera actif à la fin |
| `test-sans-communaute@abczed-verif.local` | authentifié, aucune communauté |

Pour chaque compte créé, la liste des utilisateurs affiche son **UID** (un identifiant du
type `xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx`) — copie-le, il te faut ceux des 4 premiers
(pas celui du 5ᵉ compte, volontairement laissé sans communauté).

## 4. Rattacher ces comptes à des communautés de test

Ouvre `scripts/seed-test-personas.sql`, remplace les quatre `REPLACE_WITH_..._UUID` par les
UID copiés à l'étape précédente, colle le résultat dans **SQL Editor**, **Run**.

## 5. Récupérer l'URL et la clé du projet

**Project Settings** (icône engrenage) → **API** → **API Keys** :
- **Project URL**
- **Publishable key**

## 6. Préparer le fichier de configuration du test

```
cp .env.test.example .env.test
```

Remplis `.env.test` avec l'URL, la clé, et les emails/mots de passe des étapes 3 et 5.
Les deux UUID de communautés sont déjà dans le gabarit (`a1111111...` / `b2222222...`),
inutile d'y toucher sauf si tu les as changés dans `seed-test-personas.sql`.

## 7. Lancer la vérification

```
npm install
node scripts/verify-real-supabase.mjs
```

Le script se connecte tour à tour avec chaque compte de test et affiche ✅/❌/⚠️ pour
chaque vérification. **Aucun ❌ ne doit apparaître.** Un ⚠️ signale une erreur imprévue
(souvent un problème de configuration du test lui-même, pas forcément une faille) — dans
ce cas, lis le message d'erreur affiché, il indique généralement quoi corriger.

## 8. Trois vérifications à faire toi-même dans le Dashboard

Le script ne peut pas voir ça depuis l'extérieur — à confirmer visuellement :

1. **Storage** → les deux buckets `community-files` et `avatars` affichent bien
   l'étiquette **Private** (pas Public).
2. **Project Settings** → **API** → **Exposed schemas** → la liste ne doit **jamais**
   contenir `app_private`. Si elle y figure, préviens-moi immédiatement — c'est une
   régression de sécurité, pas un détail.
3. **Depuis la V7.7** — **Database** → **Replication** (ou **Publications**) → la publication
   `supabase_realtime` doit inclure les tables `messages` et `message_reactions`. Le script
   `sql/06_message_reactions.sql` tente de les y ajouter automatiquement, mais seulement si
   cette publication existe déjà sur ton projet — je n'ai pas pu vérifier ce point moi-même
   (aucun accès à ton Supabase réel). Si l'une des deux tables manque, coche-la manuellement
   dans le Dashboard, ou exécute dans SQL Editor :
   `alter publication supabase_realtime add table public.messages, public.message_reactions;`
   Sans ça, Messages continuera de fonctionner normalement (lecture, envoi, liaison, réactions),
   mais un message envoyé par quelqu'un d'autre n'apparaîtra qu'après avoir quitté puis rouvert
   l'onglet Messages (pas de mise à jour automatique en direct). **Nouveau (V7.8)** — vérifie
   aussi que `sql/07_realtime_replica_identity.sql` a bien été exécuté (étape 2.7) : sans lui,
   l'apparition automatique d'un NOUVEAU message fonctionne quand même, mais la disparition
   automatique d'un message SUPPRIMÉ par quelqu'un d'autre peut ne jamais se propager (le
   `DELETE` ne transmet alors pas `community_id`, donc ne passe jamais le filtre serveur) — tu ne
   le remarquerais qu'en rechargeant manuellement la page pour voir le message effectivement
   disparu. Pour vérifier ce réglage précis, exécute dans SQL Editor :
   `select relname, relreplident from pg_class where relname in ('messages', 'message_reactions');`
   — la colonne `relreplident` doit valoir `f` (full) pour les deux lignes ; si elle vaut `d`
   (default), rejoue `sql/07_realtime_replica_identity.sql`.

## 9. Recette manuelle Messages (V7.7/V7.8) — à préparer, mais que TOI seul dois exécuter

Comme pour le reste de ce guide, je n'ai exécuté aucune de ces étapes contre ton projet réel —
je ne peux pas m'y connecter. Cette recette vérifie que Messages fonctionne bout en bout une
fois `sql/06` ET `sql/07` appliqués (étape 2) et l'application démarrée avec `MESSAGES_FROM_SUPABASE=true`
(déjà la valeur par défaut de cette livraison, `src/dataSourceFlags.js`) et connectée à ton
projet (`.env.local`, voir `.env.example`). Prévois deux comptes de test actifs dans la MÊME
communauté (par ex. `test-a1@abczed-verif.local` et `test-a2-admin@abczed-verif.local`, déjà
créés à l'étape 3) et, si possible, deux navigateurs/fenêtres privées distinctes (un par
compte) pour les étapes qui vérifient la visibilité croisée.

1. Connecte-toi avec le compte A1. Ouvre Messages : le bandeau de confidentialité doit afficher
   exactement *« Les messages sont visibles uniquement par les membres du groupe. »* — jamais le
   texte de démonstration. Si le fil est vide, le texte doit être exactement
   *« Aucun message pour le moment. »*.
2. Envoie un message texte. Il doit apparaître immédiatement dans le fil, le champ de saisie se
   vide, et il reste visible après un rechargement complet de la page (F5).
3. Connecte-toi avec le compte A2 (admin) dans l'autre navigateur/fenêtre : il doit voir le même
   message (même communauté), avec le vrai nom d'A1 en auteur — jamais un uuid, jamais "Vous".
4. Depuis A1 (l'auteur), lie ce message à un événement réel de l'agenda de cette communauté
   (bouton "Lier à un événement" — la liste ne doit proposer aucun anniversaire). Vérifie que le
   badge d'événement affiche le vrai titre, et que ce badge ouvre bien la fiche de cet événement.
5. Depuis A2 (admin, pas auteur), ajoute une réaction (emoji) sur le message d'A1, puis retire-la
   en retapant la même pastille. Vérifie qu'un simple membre non-auteur/non-admin (un 3ᵉ compte,
   si tu en crées un) ne voit PAS le bouton "Lier à un événement" sur un message qui n'est pas le
   sien.
6. Coupe ta connexion réseau (mode avion, ou décoche temporairement Wi-Fi) puis tente d'envoyer
   un message : une erreur doit s'afficher clairement (jamais un succès silencieux ni un message
   fantôme) et le texte doit rester dans le champ. Restaure la connexion, renvoie : ça doit
   fonctionner normalement.
7. Si la publication Realtime est bien configurée (étape 8.3 ci-dessus) : laisse A1 sur l'écran
   Messages, envoie un message depuis A2 — il doit apparaître chez A1 sans action de sa part
   (pas besoin de recharger la page).
8. Supprime (depuis l'Agenda, si tu as les droits) l'événement lié à l'étape 4 : le message doit
   rester visible, avec son badge d'événement qui disparaît proprement (lien remis à vide),
   jamais une erreur ni une fiche cassée.
9. **Nouveau (V7.8)** — vérifie spécifiquement la propagation d'un `DELETE` (c'est le point que
   `sql/07_realtime_replica_identity.sql` corrige) : laisse A1 sur l'écran Messages, sur le
   message qu'A2 a réagi à l'étape 5. Depuis A2, retire cette réaction (retape la même pastille).
   Si `sql/07` est bien appliqué ET la publication Realtime bien configurée (étape 8.3), la
   réaction doit disparaître chez A1 sans qu'il recharge la page. Si elle reste affichée chez A1
   jusqu'à un rechargement manuel, c'est le signe que `sql/07` n'a pas été appliqué (ou que la
   vérification `relreplident` de l'étape 8.3 n'est pas repassée à `f`) — pas un bug à signaler,
   juste une étape à refaire.

Si l'un de ces points échoue, note précisément lequel et le message d'erreur affiché — comme
pour le reste de ce guide, c'est exactement le genre d'écart entre la vérification locale
(harnais Playwright, jamais connecté à un vrai Supabase) et le comportement réel de ton projet
qu'on cherche à débusquer ici.

## 10. Si tout est vert

Dis-le-moi avec le résultat exact du script (le nombre de ✅ et de ❌). On pourra alors
attaquer le chantier suivant : le flux d'invitation et l'authentification côté React.

## Si quelque chose ne colle pas

Note précisément quel ❌ ou quelle erreur apparaît, avec le message affiché — c'est
exactement le genre d'écart entre la simulation locale et le comportement réel de
Supabase qu'on cherche à débusquer maintenant plutôt que plus tard.
