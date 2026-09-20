# ABCZed — Matrice de livraison (brief master consolidé)

## 2e passe — corrections suite à contre-vérification indépendante

Une contre-vérification indépendante du premier ZIP a relevé 4 points (un 5e, l'absence de
la matrice dans le ZIP, s'est révélé être une erreur de manipulation de mon côté — le fichier
avait bien été livré séparément). Les 4 corrections réelles, appliquées dans cette passe :

1. **Liens profonds masqués par un filtre/recherche resté actif** — confirmé et corrigé.
   `openMessageFromAccueil` et `openShareFromAccueil` (App.jsx) réinitialisent désormais
   `messagesQuery` / `partagesFilter` / `partagesQuery` à leur état neutre au moment même où
   ils ciblent, avant de changer de vue — la cible est donc garantie visible. La logique de
   filtrage a été extraite dans deux nouveaux modules testables, `src/shareSearch.js` et
   `src/messageSearch.js` (même principe que `agendaSearch.js`), et un nouveau script
   `scripts/test-deep-link-visibility.mjs` reproduit exactement le scénario signalé (filtre
   "Documents" + cible de type "Photo") pour prouver le bug avant correction puis sa
   disparition après.
2. **Recherche Accueil pas réellement transversale (La Bande absente)** — confirmé et
   corrigé. `Accueil.jsx` importe désormais `MEMBERS`/`childrenOf` et ajoute une section
   "La Bande" aux résultats de recherche (parent, nom, enfants, groupe), avec la même
   normalisation partagée. Simplification assumée : cliquer un résultat "La Bande" depuis
   l'Accueil ouvre directement la fiche parent ; le retour ramène vers La Bande (mapping
   fixe déjà existant de `MemberDetail`), pas vers l'Accueil — contrairement aux résultats
   message/partage, qui eux proposent un retour explicite vers l'Accueil. Le brief ne
   demande cette parité retour que pour "message précis" et "partage précis" (§4), pas pour
   un membre ; je le signale plutôt que de l'étendre sans le demander.
3. **Erreur factuelle sur l'emplacement SQL des colonnes anniversaire** — confirmé et
   corrigé. `birthday_day`/`birthday_month` et la contrainte `anniversaire_minimal` sont
   dans `sql/02_rls.sql` (table `events`, lignes ~26-47), **pas** dans
   `sql/01_schema_and_helpers.sql` (qui ne définit que `communities`/`members`/`invitations`
   et les helpers `app_private`, aucune table `events`). Le commentaire erroné dans
   `agendaApi.js` a été corrigé pour citer le bon fichier ; le garde-fou "à vérifier sur le
   vrai Supabase avant activation" reste inchangé. Aucun fichier SQL n'a été touché.
4. **Rappel anniversaire de l'Accueil : "Samedi" en dur + premier trouvé, pas le plus
   proche** — confirmé et corrigé. `nextOccurrence` (déjà utilisée par `Agenda.jsx` pour
   trier "À venir") a été extraite dans `agendaSearch.js` et réutilisée par `Accueil.jsx` :
   le rappel affiché est maintenant le vrai prochain anniversaire (trié par occurrence
   réelle jour/mois), avec un jour de semaine calculé, pas un texte figé.

Régression : les 34 tests de la 1ère passe passent toujours à l'identique (18+6+10), plus
5 nouveaux tests dédiés au point 1 → **39/39**. Garde-fous revérifiés après cette passe :
hash du logo identique, les 4 fichiers `sql/*` ont exactement les mêmes empreintes
SHA-256 qu'avant cette passe (aucun n'a été modifié), flags `AGENDA_FROM_SUPABASE=true` /
`BUSINESS_DATA_FROM_SUPABASE=false` intacts.

## 3e passe — delta correctif V2 (32 sections, après recette manuelle de `abczed corrigé 1`)

Contexte : un nouveau brief exhaustif (`abczed_delta_correctifs_v2.md`, 32 sections), rédigé
par l'utilisateur après une recette manuelle complète de `abczed corrigé 1` (livrable de la
2e passe), a été fourni avec le ZIP correspondant. Conformément à l'instruction finale du
document (« auditer d'abord `abczed corrigé 1` contre ce document, puis appliquer ce delta en
un seul lot cohérent, ne pas réimplémenter les corrections déjà présentes »), chaque fichier
concerné a été relu intégralement avant toute modification (voir la matrice détaillée
ci-dessous — les sections marquées « déjà correct » n'ont donné lieu à aucune modification).

Résumé par thème (détail section par section dans la matrice « 3e passe » plus bas) :

1. **Navigation retour complète (§2)** : le retour vers la bonne rubrique d'origine était déjà
   validé (§2.1, non retouché) ; il manquait la position de lecture (scroll) et le focus sur
   l'élément déclencheur. Ajout d'une mémoire de navigation par page dans `App.jsx`
   (`navMemory`, fonctions pures `captureNavState`/`clearNavState` dans le nouveau
   `src/navMemory.js`, restaurées via le nouveau hook `src/useScrollRestore.js`) — appliquée à
   Accueil (scroll seul, §26), Agenda/Messages/Partages/La Bande (scroll + focus, le
   filtre/la recherche étant déjà conservés depuis la 2e passe).
2. **Provenance réelle étendue aux fiches membre (§18/§26)** : `App.jsx` avait déjà
   `eventReturnTo` pour les événements ; un `memberReturnTo` symétrique a été ajouté, sinon la
   mémoire de navigation ci-dessus n'aurait pas su quelle page restaurer pour une fiche membre
   ouverte depuis un endroit autre que La Bande (ex. résultat de recherche de l'Accueil).
3. **Fiche « Vous » (§18)** : `App.jsx` intercepte désormais `mem-vous` à la source
   (`openMember`) et ouvre directement la modale Mon profil plutôt que `MemberDetail` —
   un seul point d'entrée, qu'on clique depuis La Bande, l'Accueil ou l'avatar du header.
4. **En-têtes de détail à 3 zones (§3/§17)** : `EventDetail.jsx`, `MemberDetail.jsx` et le
   mini-en-tête « discussion liée » de `Messages.jsx` utilisent désormais une grille
   `40px 1fr 40px` — le titre est mathématiquement centré, indépendamment de la largeur du
   bouton retour.
5. **Accueil (§4)** : titres de section centrés ; les CTA « Voir tous les messages/partages »
   sont descendus sous le contenu (au lieu d'un « Tout voir » accolé au titre) ; aucun CTA
   ajouté à « Prochain événement »/« Informations importantes » (§4.3, volontairement).
6. **Sortie « Entre familles » (§5)** : le résumé abstrait « X famille(s) · Y personne(s) »
   est remplacé par « Qui vient ? » + décompte réel de personnes + détail par foyer
   (nom affiché + adultes/enfants). Le bloc « Votre participation » (Modifier/Annuler) n'a
   pas été touché.
7. **Accompagnateurs (§6)** : compteur + pastilles centrés ; un tap sur une pastille révèle le
   nom (le survol desktop fonctionnait déjà) ; le « +N » ouvre la liste complète en texte.
8. **Lieu → carte (§7)** : la ligne de lieu ouvre désormais Google Maps (URL universelle,
   non testée sur un appareil réel — voir rubrique C).
9. **Documents (§8)** et **Partages (§9)** : cartouche de pièce jointe d'`EventDetail.jsx`
   dotée des mêmes actions Ouvrir/Télécharger que Partages (composant `ActionButton` extrait
   et partagé) ; badge « Lié à : … » devenu « Voir l'événement : … → » explicite ; menu
   « ⋯ »/Modifier/Supprimer dotés d'un retour visuel clair. Choix de scoping documenté : les
   cartes Partages n'ouvrant aucune fiche dédiée, seule une légère mise en valeur de conteneur
   (`.tap-container`, réagit dès qu'une action interne a le focus) leur est appliquée — pas une
   fausse affordance de carte entière cliquable qui n'irait nulle part.
10. **Recherche (§11/§12/§13)** : bouton « x » d'effacement (avec `aria-label`, focus conservé
    dans le champ) ajouté aux 5 recherches contextuelles. Messages : le texte/auteur/pièce
    jointe/événement lié étaient déjà trouvés (§12, confirmé, non retouché sauf durcissement du
    matching par titre exact d'événement, §12) ; une vraie recherche par date a été ajoutée
    (nouveau module `src/dateSearch.js` : « 24 mai », « 24/05 », « 24/05/2026 », « 24-05-2026 »,
    « hier », « aujourd'hui », abréviations de mois), combinée en `OU` avec la recherche
    textuelle existante, sans faire regresser le garde-fou explicite du brief (une requête
    courte comme « 24 » seule n'est jamais interprétée comme une date).
11. **La Bande (§16)** : grammaire interactive complète (hover/focus-visible/pressed) sur la
    carte parent — elle ouvre bien une fiche, contrairement aux cartes Partages.
12. **Mon profil (§19)** : modèle de données restructuré dans `data.js` — `phone_number`/
    `email` uniques par membre + flags indépendants `share_whatsapp`/`share_phone`/
    `share_sms`/`share_email`, au lieu de 4 paires `{value, shared}` qui pouvaient diverger
    sans raison pour un même numéro. `MemberDetail.jsx` et `MyProfileSheet.jsx` adaptés.
13. **Contenu de démonstration (§22)** : le bandeau global (`App.jsx`) et les deux textes
    « En démonstration locale… » (`MemberDetail.jsx`, `MyProfileSheet.jsx`) sont désormais
    conditionnés à `DEMO_MODE` (nouveau `src/config.js`, basé sur `import.meta.env.DEV`,
    fourni nativement par Vite) — ils ne sont plus rendus du tout après `npm run build`
    (mode production), pas seulement masqués en CSS.
    **[SUPERSEDÉ en 4e passe, voir la ligne « §22 Contenu de démonstration jamais en
    production » de la matrice demande→fichier plus bas : conditionner ce contenu au MODE DE
    BUILD s'est révélé être une erreur (un état fonctionnel réel doit dépendre de la source de
    données réelle, jamais de `import.meta.env.DEV`) — `DEMO_MODE`/`src/config.js` ont depuis
    été entièrement supprimés du code. Gardé ici pour l'historique de la 3e passe, pas comme
    description de l'état actuel.]**
14. **Responsive réel (§23/§24)** : `index.html` — la colonne applicative (`.max-w-md`),
    jusqu'ici figée à 448px à toutes les largeurs, s'élargit progressivement (640px ≥768px,
    900px ≥1024px) ; `EventDetail.jsx` passe en disposition à deux zones (informations à
    gauche, participation/actions à droite) à partir de 1024px via la nouvelle classe
    `.event-detail-grid`. Les autres pages (listes) profitent simplement d'une colonne plus
    confortable, sans réorganisation multi-colonnes qui aurait risqué de casser des pages déjà
    validées.
15. **Accessibilité transversale (§25)** : deux classes CSS partagées ajoutées dans le
    `<style>` global de `App.jsx` — `.tap-surface` (l'élément est lui-même la cible cliquable :
    hover/active/focus-visible) et `.tap-container` (l'élément contient des actions distinctes
    sans être lui-même cliquable : hover léger + anneau `focus-within`) — appliquées aux
    cartes, badges, pastilles et CTA concernés dans Accueil/Agenda/Messages/Partages/
    La Bande/EventDetail/MemberDetail/MyProfileSheet.

Points explicitement **non modifiés** parce que déjà corrects et testés (§2.1, §12, §15, §21,
§27) : retour vers la bonne rubrique d'origine, recherche Messages par texte/auteur/pièce
jointe/événement lié, compositeur Messages fixe au-dessus de la nav, fermeture de la modale
Mon profil par la croix, ainsi que toute la liste de non-régression du §27 (RSVP, logique
accompagnement/entre familles, connexion Supabase Agenda, etc.). **[§21 SUPERSEDÉ en 7e passe/
V7.1 — voir la note à la ligne où §21 est détaillé plus bas dans ce document : Mon profil se
ferme désormais aussi par clic sur le fond, comme toutes les modales.]**

Régression : les 39 tests des 2 premières passes passent toujours à l'identique (18+6+10+5),
plus 31 nouveaux tests dédiés à cette 3e passe (22 pour la recherche par date/évènement lié
`scripts/test-date-search.mjs`, 9 pour la mémoire de navigation `scripts/test-nav-memory.mjs`)
→ **70/70**. Garde-fous revérifiés après cette passe : hash du logo identique, les 4 fichiers
`sql/*` ont exactement les mêmes empreintes SHA-256 qu'avant, flags `AGENDA_FROM_SUPABASE=true`/
`BUSINESS_DATA_FROM_SUPABASE=false` intacts, `package.json`/`package-lock.json` inchangés
(aucune dépendance ajoutée), `npm run build` sans erreur, aucun import inutilisé détecté.

## 4e passe — corrections suite à une contre-vérification indépendante du ZIP V3

Contexte : l'utilisateur a fait relire le ZIP `ABCZed_corrige_v3.zip` par une vérification
indépendante (pas seulement une lecture de mon compte rendu). Le bilan a confirmé la plupart
des points de la 3e passe (logo, hash, flags, 70/70 tests, aucun secret), mais a relevé 3
défauts réels dans ce que j'avais livré. Les 3 sont confirmés après relecture du code — aucun
n'est une fausse alerte — et corrigés dans cette passe :

1. **Réglages "Mon profil" non persistants, même localement.** Les 4 cases à cocher de
   `MyProfileSheet.jsx` vivaient dans un `useState` local au composant. Or ce composant est
   démonté/remonté à chaque fermeture de la modale
   (`{showMyProfile && <MyProfileSheet .../>}` dans `App.jsx`) : fermer puis rouvrir perdait
   silencieusement tout changement, sans qu'aucun message d'erreur ne le signale. Ce n'était
   pas seulement "la persistance multi-comptes manque" (déjà documenté comme bloqué en
   rubrique C) — même la persistance locale, dans l'état applicatif en mémoire, n'existait pas.
   **Correction** : l'état des 4 flags est remonté dans `App.jsx` (`meShareFlags`, jamais
   démonté), passé en props contrôlées à `MyProfileSheet` (`shareFlags`/`onToggleShareFlag`).
   La logique pure d'inversion est extraite dans un nouveau module testable
   `src/shareFlags.js` (`toggleShareFlag`), sur le même principe que `navMemory.js`. Le
   point d'appel `toggleMeShareFlag` (App.jsx) est délibérément écrit comme le futur point de
   branchement Supabase (un seul endroit à modifier), sans rien brancher aujourd'hui.
2. **Le bandeau "données mockées" pouvait disparaître en production alors que les données le
   restaient.** J'avais conditionné ce bandeau à `DEMO_MODE` (`import.meta.env.DEV`), donc
   `npm run build` le faisait disparaître — alors que `BUSINESS_DATA_FROM_SUPABASE` restait
   `false` : un build "production" déployé tel quel aurait affiché les faux
   membres/messages/partages sans aucun avertissement visible. C'est une erreur d'interprétation
   de ma part sur le delta §22 : j'ai conditionné un indicateur d'état FONCTIONNEL réel
   (données mockées ou non) à un indicateur de MODE DE BUILD, qui ne mesure pas la même chose.
   **Correction** : la condition d'affichage du bandeau (`App.jsx`) redevient
   `!BUSINESS_DATA_FROM_SUPABASE` seule — il s'affiche tant que Messages/Partages/La Bande ne
   sont pas branchés à Supabase, en dev comme en production, et disparaîtra de lui-même le
   jour où ce flag passera à `true`.
3. **Les mentions "Démonstration locale" n'étaient pas uniformément traitées.** Trois textes
   utilisateur portaient encore littéralement ce libellé, et n'étaient PAS conditionnés à
   `DEMO_MODE` : le `title` d'`ActionButton.jsx`, le `title` d'un bouton de contact désactivé
   dans `MemberDetail.jsx`, et un paragraphe d'`AddShareSheet.jsx` — ils s'affichaient donc
   tels quels, y compris après `npm run build`. Deux autres textes (paragraphes explicatifs de
   `MemberDetail.jsx` et `MyProfileSheet.jsx`) étaient eux bien masqués en production via
   `DEMO_MODE`, mais reposaient sur le même mécanisme dont le point 2 ci-dessus montre qu'il
   ne doit pas arbitrer une information réelle. **Correction, appliquée uniformément aux 5
   textes** : reformulation neutre décrivant la vraie limitation fonctionnelle ("indisponible
   tant que le stockage n'est pas activé", "tant qu'aucun service de messagerie/téléphonie
   réel n'est branché", etc.), sans le mot "démonstration", et rendue en permanence (plus de
   dépendance à `DEMO_MODE`) puisqu'il s'agit d'informations vraies en dev comme en
   production tant que le stockage/l'authentification réels ne sont pas branchés. Le
   comportement des boutons (désactivés) n'a pas changé — seul le texte affiché change.
   Conséquence : `DEMO_MODE`/`src/config.js` n'avaient plus aucun usage restant — supprimés
   plutôt que laissés comme code mort.

Régression : les 70 tests des 3 premières passes passent toujours à l'identique, plus 4
nouveaux tests dédiés à `src/shareFlags.js` (`scripts/test-share-flags.mjs`) → **74/74**.
Garde-fous revérifiés après cette passe : hash du logo identique, les 4 fichiers `sql/*`
inchangés, flags `AGENDA_FROM_SUPABASE=true`/`BUSINESS_DATA_FROM_SUPABASE=false` intacts,
aucun secret, aucun import inutilisé, `npm run build` sans erreur. Vérification supplémentaire
propre à cette passe : recherche du mot "monstration" dans le bundle `dist/` généré par
`npm run build` — la seule occurrence restante est le bandeau `App.jsx` (délibéré, point 2).

### 4e passe (fichiers touchés)

- `src/shareFlags.js` (nouveau) — logique pure d'inversion d'un flag de partage
- `scripts/test-share-flags.mjs` (nouveau) — 4 tests
- `src/config.js` — **supprimé** (plus aucun usage après le point 3 ci-dessus)
- `src/App.jsx` — état `meShareFlags`/`toggleMeShareFlag` (levé depuis `MyProfileSheet`),
  bandeau de données mockées reconditionné sur `!BUSINESS_DATA_FROM_SUPABASE` seul (retrait de
  `DEMO_MODE`)
- `src/components/MyProfileSheet.jsx` — flags reçus en props contrôlées au lieu d'un
  `useState` local ; texte reformulé et rendu en permanence
- `src/pages/MemberDetail.jsx` — 2 textes reformulés (title du bouton de contact + paragraphe
  explicatif, rendu en permanence)
- `src/components/ActionButton.jsx` — `title` reformulé
- `src/components/AddShareSheet.jsx` — paragraphe photo reformulé

## 5e passe — lot consolidé UX/navigation

Contexte : après une recette manuelle réelle (pas seulement une relecture de code) sur
`ABCZed_corrige_v4.zip`, l'utilisateur a fourni un cahier des charges consolidé regroupant
plusieurs observations de navigation. Un diagnostic (fichiers concernés, mécanisme déjà en
place, contradictions apparentes) a été livré et discuté avant toute modification de code, avec
arbitrage explicite point par point avant de coder. Deux désaccords de diagnostic ont été
tranchés en faveur de la recette manuelle de l'utilisateur plutôt que de la seule lecture du
code (voir plus bas, "vérification par navigateur réel").

**Arbitrages retenus (rappel), aucune ambiguïté laissée ouverte :**
1. Bug CTA "Voir tous les messages/partages" → corrigé.
2. "+" global du header → confirmé absent, non retouché.
3. Bandeau "données de démonstration" → logique inchangée (`!BUSINESS_DATA_FROM_SUPABASE`
   seul, indépendant du mode build) — décision de la 4e passe reconfirmée, pas de régression.
4. Texte "Mon profil" → reformulé (l'authentification Supabase étant réelle, l'ancienne
   formulation était trompeuse), reste visible tant que la persistance elle-même est locale.
5. Pas d'intégration History API (bouton retour navigateur) dans ce lot.
6. Retours contextuels (scroll/focus/repère visuel) → traités comme un vrai défaut de
   comportement à corriger, pas comme un non-problème déduit de la lecture du code.
7. Accueil → Prochain événement → retour → ajouté à la recette de vérification.
8. Recherche Accueil → résultat → retour avec requête conservée → traité comme un vrai
   défaut (voir diagnostic ci-dessous) et corrigé.
9. Mécanisme générique (une origine + une cible), pas un nouveau booléen par écran → suivi.
10. Tests avant livraison → couverts (voir "Tests" plus bas).

**Ce qui a été corrigé :**

- **Bug confirmé par lecture de code (point 1)** : les CTA "Voir tous les messages"/"Voir tous
  les partages" (`Accueil.jsx`) appelaient `onGoTo('messages'|'partages')` — exactement la même
  fonction que la barre de navigation du bas (`goTo`), qui efface volontairement toute trace de
  provenance. Aucune flèche de retour vers Accueil ne pouvait donc apparaître, par construction.
  **Corrigé** en généralisant le mécanisme (point 9) : les deux booléens ad hoc
  `messagesCameFromAccueil`/`sharesCameFromAccueil` (qui ne couvraient que le lien profond vers
  UN message/partage précis) sont remplacés par un objet unique `sectionOrigin`
  (`{ [page]: originPage | null }`, fonctions pures dans le nouveau `src/sectionOrigin.js`,
  9 tests) et une fonction d'entrée unique `enterSection(page, origin, { highlightId, focusId })`
  dans `App.jsx`, qui remplace `openMessageFromAccueil`/`openShareFromAccueil` ET couvre en plus
  le nouveau cas ("voir tout", sans cible précise) sans dupliquer un mécanisme par écran. `goTo()`
  (navigation franche, barre du bas) reste la seule fonction qui efface cette origine — un accès
  par la barre du bas n'affiche donc jamais de flèche artificielle (vérifié en navigateur, voir
  plus bas). Les deux CTA de l'Accueil ont désormais un `id` (`home-viewall-messages`/
  `home-viewall-partages`) servant de cible de retour, au même titre qu'une carte ou un badge.

- **Défaut confirmé par la recette manuelle, PAS par le code (point 8)** : la recherche de
  l'Accueil (`Accueil.jsx`) était un `useState` **local** au composant — or Accueil est démonté/
  remonté à chaque aller-retour vers une fiche (comme les 4 autres pages). Contrairement aux 4
  autres recherches (Agenda/Messages/Partages/La Bande), déjà levées dans `App.jsx` depuis la
  3e passe, celle de l'Accueil ne l'était pas (choix délibéré à l'époque, justifié par une
  lecture littérale du delta §26 qui ne listait que le scroll pour cette page — lecture qui
  s'avère incomplète à l'usage). **Corrigé** : la recherche Accueil est maintenant levée dans
  `App.jsx` (`accueilQuery`/`setAccueilQuery`), exactement comme les 4 autres — un aller-retour
  vers un résultat de recherche ne perd plus la requête tapée.

- **Repère visuel "vous êtes ici" (point 6)** : la recette manuelle a montré que restaurer
  scroll + filtre + recherche ne suffit pas si l'utilisateur ne VOIT pas qu'il a retrouvé son
  point de départ exact. `src/useScrollRestore.js` (le hook partagé par les 5 pages) fait
  désormais trois choses au lieu d'une au retour : `scrollIntoView` sur l'élément d'origine (pas
  seulement un `scrollTo` de la page), `focus({ preventScroll: true })` (le `preventScroll` évite
  qu'un second scroll natif du navigateur, déclenché par le focus lui-même, n'annule le premier),
  et l'ajout temporaire (1.8s) d'une classe CSS partagée `.nav-restore-highlight` (anneau bleu,
  défini dans le `<style>` global d'`App.jsx`) — un seul mécanisme générique, appliqué sans
  changement à Accueil, Agenda, Messages, Partages et La Bande (aucun code spécifique par page).

- **Texte "Mon profil" (point 4)** : "Démonstration locale — ces réglages ne sont pas encore
  protégés par une authentification multi-comptes réelle — un seul compte est actif dans cette
  version" (déjà reformulé en 4e passe pour retirer "démonstration locale") remplacé par « Ces
  préférences sont enregistrées uniquement pour cette session et ne sont pas encore synchronisées
  avec Supabase. » — l'authentification Supabase étant déjà réelle (`auth/AuthProvider.jsx`),
  l'ancienne formulation ("un seul compte actif") décrivait une limitation qui n'existe plus ;
  seule la PERSISTANCE des 4 cases à cocher (`src/shareFlags.js`) reste locale, le texte est
  maintenant limité à cette vraie limitation actuelle.

**Ce qui n'a PAS été modifié, sur arbitrage explicite (points 2/3/5) :**
- Le "+" global du header : confirmé absent du code, non réintroduit, aucun fichier touché.
- Le bandeau "données de démonstration" : logique déjà correcte (4e passe), aucune régression.
- Aucune intégration History API (bouton/geste retour natif du navigateur) : hors périmètre.

**Vérification par navigateur réel (points 6/7/8) — pas seulement par lecture de code.**
Sur ce lot spécifiquement, la lecture de code seule s'est révélée insuffisante à deux reprises :
le diagnostic initial n'avait pas trouvé de bug pour "Accueil → Prochain événement → retour" ni
identifié le défaut réel de la recherche Accueil (point 8), alors que la recette manuelle de
l'utilisateur en attestait. Plutôt que de trancher à nouveau sur la seule lecture du code après
correction, un harnais de test a été construit pour rejouer les scénarios dans un **vrai
navigateur (Chromium headless, piloté par Playwright, déjà présents dans cet environnement)** :
`App.jsx` est monté directement (sans passer par `Root.jsx`/`Login.jsx`), avec uniquement
`auth/AuthProvider.jsx` et `agendaApi.js` remplacés par des doublures locales (session/
événements fictifs) via des alias Vite dans un fichier de configuration séparé
(`vite.harness.config.js`) — **aucun appel au vrai projet Supabase**, et tout le reste du code
(App.jsx, toutes les pages, toute la logique de navigation) tourne strictement inchangé. Ce
harnais et sa configuration (`test-harness/`, `vite.harness.config.js`) sont des outils de
vérification, **volontairement exclus du ZIP livré** — communicables séparément sur demande.

28 scénarios ont été exécutés dans ce navigateur réel, correspondant à la liste de tests du
point 10 : les deux CTA "Voir tous..." (ouverture, flèche retour, retour, focus, repère visuel),
l'absence de flèche artificielle en arrivant par la barre du bas sur Messages et Partages, La
Bande → fiche parent → retour (recherche conservée + focus + repère visuel sur la carte
d'origine), Partages → "Voir l'événement" → retour (filtre conservé + focus sur le lien
d'origine), Messages → badge événement → retour (focus sur le badge d'origine), Agenda → fiche
événement → retour (filtre conservé + focus sur la rangée d'origine), Accueil → "Prochain
événement" → retour (confirmé : retour sur Accueil, jamais Agenda, sur les données de ce
harnais), et Accueil → recherche "piscine" → résultat Message → retour (requête "piscine"
conservée + focus sur le résultat d'origine). **28/28 réussis.**

Cette vérification lève la réserve qui pesait depuis la 3e passe sur La Bande/Partages/Messages/
Agenda ("scroll/focus non testé en navigateur") pour les parcours exercés ci-dessus — voir la
rubrique C mise à jour pour ce qui reste hors du périmètre de ce harnais (rendu visuel fin,
gestes tactiles réels, tablette/desktop, RSVP/formulaires).

**Tests automatiques ajoutés** : `scripts/test-section-origin.mjs` (nouveau, 9 tests) — logique
pure de `src/sectionOrigin.js`. Total après cette passe : **83/83** (74 + 9). La vérification en
navigateur réel ci-dessus (28 scénarios Playwright) s'ajoute à ce total sans en faire partie :
elle dépend d'un navigateur et d'un harnais non livrés dans le ZIP, contrairement aux scripts
Node ci-dessus qui s'exécutent avec `node scripts/test-*.mjs` sans aucune dépendance
supplémentaire — cohérent avec la philosophie du projet (aucune nouvelle dépendance npm
ajoutée : Playwright et Chromium existaient déjà dans cet environnement, aucun n'a été ajouté à
`package.json`).

Garde-fous revérifiés après cette passe : hash du logo identique, les 4 fichiers `sql/*`
inchangés, flags `AGENDA_FROM_SUPABASE=true`/`BUSINESS_DATA_FROM_SUPABASE=false` intacts, aucun
secret, aucun import inutilisé, `npm run build` sans erreur, `package.json`/`package-lock.json`
inchangés (aucune dépendance ajoutée au projet lui-même).

### 5e passe (nouveaux fichiers)

- `src/sectionOrigin.js` — mécanisme générique d'origine "douce" par page (point 1/9)
- `scripts/test-section-origin.mjs` (nouveau, point 10) — 9 tests
- `test-harness/` + `vite.harness.config.js` — harnais de vérification en navigateur réel
  (Playwright), **exclus du ZIP livré**, voir ci-dessus

### 5e passe (fichiers modifiés)

- `src/App.jsx` — `sectionOrigin`/`enterSection` (remplace les deux booléens ad hoc),
  `accueilQuery` levée (point 8), `.nav-restore-highlight` (repère visuel, point 6)
- `src/useScrollRestore.js` — `scrollIntoView` + `focus({ preventScroll: true })` + classe de
  repère visuel temporaire, au lieu d'un simple `window.scrollTo` (point 6)
- `src/pages/Accueil.jsx` — recherche reçue en props (`query`/`onQueryChange`) au lieu d'un
  `useState` local ; CTA "Voir tous..." dotés d'un `id` et appelant les nouveaux handlers
- `src/pages/Messages.jsx` — `id="back-to-accueil"` sur le lien de retour (utilisable en test,
  aucun changement visuel/comportemental)
- `src/pages/Partages.jsx` — idem
- `src/components/MyProfileSheet.jsx` — texte reformulé (point 4)

Non touché dans cette 5e passe : `src/pages/Agenda.jsx`, `src/pages/LaBande.jsx`,
`src/pages/EventDetail.jsx`, `src/pages/MemberDetail.jsx`, `src/navMemory.js`,
`src/sectionOrigin.js` mis à part, aucun fichier SQL, `package.json`, `package-lock.json`,
`vite.config.js` (seul `vite.harness.config.js`, nouveau et séparé, a été ajouté).

## 6e passe — correctif ciblé : "Voir la discussion liée" sur un événement encore mocké

Contexte : contre-vérification indépendante du ZIP `ABCZed_corrige_v5.zip` par l'utilisateur,
en ouvrant directement le ZIP (pas seulement la matrice) — 83/83 tests Node exécutés côté
utilisateur, hash du logo vérifié identique, aucun secret trouvé, mais un bug réel et précis
identifié dans `App.jsx`, correspondant très exactement à une anomalie déjà constatée à l'écran
avant la 5e passe.

**Bug confirmé par lecture de code, exactement comme décrit :**
`selectedEvent` (fiche événement) résolvait déjà avec un repli : `events.find(...) ||
MOCK_EVENTS.find(...) || null`. `filteredEvent` (discussion liée depuis "Voir la discussion
liée") ne faisait que `events.find(...) || null`, sans ce repli. Or `events` est l'agenda
"live" (`AGENDA_FROM_SUPABASE = true`, chargé depuis le vrai Supabase), tandis que les messages/
partages de démonstration (`BUSINESS_DATA_FROM_SUPABASE = false`) référencent encore des
événements qui n'existent QUE dans `MOCK_EVENTS` (ex. `evt-piscine`). Résultat : cliquer "Voir
la discussion liée" sur une fiche liée à un tel événement rendait `filteredEvent` = `null`,
donc `linkedEvent` = `null` côté `Messages` — le fil s'ouvrait non filtré, sans en-tête "Discussion
liée" ni flèche de retour dédiée. Un second défaut, lié, existait : la flèche ← de cette
discussion filtrée et le lien texte "Voir tout le fil" appelaient tous les deux `onExitFiltered`,
qui renvoie toujours vers le fil général — la flèche ne pouvait donc jamais ramener à la fiche
événement d'origine, même une fois le premier bug corrigé.

**Corrigé :**

- **Repli manquant (point 1 de la demande)** : extraction d'une fonction pure unique,
  `resolveEventById(liveEvents, mockEvents, id)` dans le nouveau `src/resolveEvent.js` — le
  live gagne toujours s'il contient l'id, sinon repli sur le mock, sinon `null`. `selectedEvent`
  ET `filteredEvent` appellent désormais tous les deux cette même fonction dans `App.jsx` : un
  seul endroit peut désormais avoir ce bug, plus deux implémentations divergentes.
- **Deux actions distinctes (point 2)** : `App.jsx` passe maintenant à `Messages` deux handlers
  séparés — `onBackToEvent` (nouveau : `() => setView('event-detail')`, branché sur la flèche ←
  de l'en-tête "Discussion liée") et `onExitFiltered` (inchangé dans son comportement :
  `{ setThreadFilterEventId(null); setView('messages'); }`, branché uniquement sur "Voir tout
  le fil"). `Messages.jsx` reçoit et utilise `onBackToEvent` pour le bouton flèche uniquement.
- **Provenance préservée (point 3)** : aucun changement n'était nécessaire ici — `onOpenThread`
  (dans `EventDetail`, inchangé) ne touche déjà ni `selectedEventId` ni `eventReturnTo` en
  ouvrant la discussion ; la flèche ← peut donc simplement rebasculer la vue sur `event-detail`
  sans perdre la fiche ni sa provenance. Le parcours "Partages → événement → discussion liée →
  ← événement → ← Partages" (et l'équivalent depuis Messages) fonctionne donc de bout en bout.
- **Tests (point 4)** : `scripts/test-resolve-event.mjs` (nouveau, 7 tests) — couvre
  explicitement le cas signalé (id absent du live, présent seulement en mock, ex. `evt-piscine`),
  le cas où le live doit toujours l'emporter s'il contient l'id, l'absence des deux côtés, et les
  id `null`/`undefined`. Total après cette passe : **90/90** (83 + 7).
- **Scénario navigateur réel (point 5, demandé "si possible")** : ajouté au harnais Playwright
  ("5bis", 6 assertions) : Partages → "Voir l'événement" (piscine) → "Voir la discussion liée" →
  vérifie que la vue est bien filtrée (texte "Vous voyez ici uniquement…" visible, ce qui ne
  peut être vrai que si `linkedEvent` est non nul) → flèche ← → vérifie le retour sur la FICHE
  ÉVÉNEMENT (pas le fil général) → flèche ← → vérifie le retour sur Partages avec le filtre
  "Documents" conservé. **Découverte importante en construisant ce scénario** : la 1ère version
  du harnais (5e passe) masquait ce bug — `test-harness/mockAgendaApi.js` renvoyait TOUS les
  `EVENTS` de `data.js` comme agenda "live", y compris `evt-piscine`, donc `events.find(...)`
  seul suffisait déjà et le repli manquant n'était jamais exercé (28/28 vert malgré le bug
  réel). **Corrigé** : `mockAgendaApi.js` exclut désormais explicitement `evt-piscine` de sa
  réponse, pour reproduire fidèlement le vrai décalage production (agenda réel sans les
  événements de démonstration référencés par Messages/Partages). **Vérification de la
  vérification** : le correctif de `filteredEvent` a été temporairement annulé, la suite
  rejouée (échec confirmé et attendu sur "5bis-b"/"5bis-c" : 19 réussites/3 échecs), puis
  restauré et revérifié (34/34 à nouveau) — pour m'assurer que ce nouveau scénario détecte
  réellement la régression et ne se contente pas de toujours passer. Total : **34 scénarios
  Playwright, 34/34 réussis** (28 de la 5e passe + 6 nouveaux). Comme en 5e passe, ce harnais
  n'est pas dans le ZIP livré (communicable séparément sur demande).

**Non touché** : tout le reste de la 5e passe (sectionOrigin, accueilQuery, repère visuel,
texte Mon profil, bandeau démo, "+" global) — cette passe est un correctif minimal et ciblé,
comme demandé ("Ne touche à rien d'autre dans la V5").

### 6e passe (nouveaux fichiers)

- `src/resolveEvent.js` — résolution d'événement live+repli mock, fonction pure unique
- `scripts/test-resolve-event.mjs` (nouveau, 7 tests)

### 6e passe (fichiers modifiés)

- `src/App.jsx` — `filteredEvent` utilise désormais `resolveEventById` (comme `selectedEvent`) ;
  ajout du handler `onBackToEvent`, distinct d'`onExitFiltered`
- `src/pages/Messages.jsx` — la flèche ← de la discussion liée appelle `onBackToEvent` au lieu
  d'`onExitFiltered` ; "Voir tout le fil" continue d'utiliser `onExitFiltered`, inchangé
- `test-harness/mockAgendaApi.js` — exclut `evt-piscine` de l'agenda "live" simulé, pour que le
  harnais exerce réellement le chemin de repli (non livré dans le ZIP)

Garde-fous revérifiés après cette passe : build propre, 90/90 tests Node, hash du logo et des
4 fichiers `sql/*` identiques, flags `AGENDA_FROM_SUPABASE=true`/`BUSINESS_DATA_FROM_SUPABASE=false`
intacts, aucun secret, `package.json`/`package-lock.json` inchangés.

## Fichiers touchés

### 3e passe (nouveaux fichiers)

- `src/config.js` — `DEMO_MODE` (delta §22) **[SUPERSEDÉ en 4e passe : fichier supprimé, voir
  note au point 13 ci-dessus]**
- `src/navMemory.js` — mémoire de navigation, fonctions pures (delta §2.2/§14/§26)
- `src/useScrollRestore.js` — hook de restauration scroll/focus au montage (delta §2.2/§14/§26)
- `src/dateSearch.js` — interprétation de dates pour la recherche Messages (delta §13)
- `src/components/ActionButton.jsx` — bouton Ouvrir/Télécharger, extrait de Partages.jsx et partagé avec EventDetail.jsx (delta §8)
- `scripts/test-date-search.mjs` (nouveau, §29) — 22 tests
- `scripts/test-nav-memory.mjs` (nouveau, §29) — 9 tests

### 3e passe (fichiers modifiés)

- `index.html` — points de rupture responsive `.max-w-md` et `.event-detail-grid` (delta §23)
- `src/App.jsx` — `navMemory`/`memberReturnTo`/`openMember` (redirection "Vous" → Mon profil), bandeau démo conditionné à `DEMO_MODE` **[SUPERSEDÉ en 4e passe, voir note au point 13 : dépend depuis de `BUSINESS_DATA_FROM_SUPABASE`, plus de `DEMO_MODE`]**, classes CSS `.tap-surface`/`.tap-container`, câblage `focusId`/`restoreState` vers toutes les pages
- `src/components/BottomNav.jsx` — retire le mapping en dur `member-detail → labande` (résolu par `memberReturnTo` dans App.jsx, comme `event-detail`)
- `src/data.js` — modèle de contacts restructuré (delta §19) : `phone_number`/`email` + `share_whatsapp`/`share_phone`/`share_sms`/`share_email`
- `src/messageSearch.js` — ajout du matching par titre d'événement lié exact (delta §12) et par date (delta §13)
- `src/pages/Accueil.jsx` — titres de section centrés, CTA sous contenu, bouton clear, scroll restauré
- `src/pages/Agenda.jsx` — bouton clear, scroll+focus restaurés, `.tap-surface` sur les rangées/CTA/chips
- `src/pages/EventDetail.jsx` — en-tête 3 zones, "Qui vient ?", accompagnateurs centrés+tap-to-reveal+liste complète, lieu → Maps, documents actionnables, disposition 2 zones desktop
- `src/pages/Messages.jsx` — en-tête 3 zones (vue filtrée), bouton clear + nouveau placeholder, recherche par date, scroll+focus restaurés
- `src/pages/Partages.jsx` — bouton clear, "Voir l'événement →", `.tap-container`, scroll+focus restaurés
- `src/pages/LaBande.jsx` — bouton clear, `.tap-surface` sur la carte parent, scroll+focus restaurés
- `src/pages/MemberDetail.jsx` — en-tête 3 zones, modèle de contacts, texte démo conditionné (ne reçoit plus jamais `mem-vous`)
- `src/components/MyProfileSheet.jsx` — modèle de contacts (flags), texte démo conditionné

Non touchés dans cette 3e passe (déjà corrects, ou hors périmètre explicite) :
`src/agendaApi.js`, `src/agendaSearch.js`, `src/searchUtils.js`, `src/shareSearch.js`,
`src/theme.js`, `src/components/DayDots.jsx`, `src/components/CreateEventSheet.jsx`,
`src/components/AddBirthdaySheet.jsx`, `src/components/AddShareSheet.jsx` (voir rubrique C au
sujet de son texte "démonstration locale", volontairement laissé en l'état), tous les fichiers
`sql/*`, `legacy/*`, `Login.jsx`, `AuthProvider.jsx`, `Root.jsx`, `supabaseClient.js`,
`api.js`, `package.json`, `package-lock.json`, `vite.config.js`.

### Fichiers touchés (2e passe, pour mémoire)

- `src/App.jsx` — header, provenance de navigation, liens profonds (avec reset neutre §2e passe), câblage des pages
- `src/agendaApi.js` — ajout `createAgendaBirthday` (commentaire SQL corrigé §2e passe)
- `src/agendaSearch.js` — `isSelectedDateStillValid`, `distinctCategoriesOf`, `nextOccurrence` (exportée §2e passe), réexport `normalize`
- `src/searchUtils.js` (nouveau) — normalisation partagée
- `src/shareSearch.js` (nouveau, §2e passe) — filtrage Partages extrait et testable
- `src/messageSearch.js` (nouveau, §2e passe) — visibilité Messages extraite et testable
- `src/components/AddBirthdaySheet.jsx` (nouveau) — création d'anniversaire
- `src/components/BottomNav.jsx` — onglet actif ne dépend plus de "event-detail → agenda"
- `src/components/DayDots.jsx` — pastilles par catégorie, pas par événement
- `src/data.js` — dates réelles des messages, message Sabrina, `TODAY_ISO`
- `src/pages/Accueil.jsx` — recherche (incluant La Bande §2e passe), liens profonds réels, info importante corrigée, prochain anniversaire réel (§2e passe)
- `src/pages/Agenda.jsx` — couleur de sélection, "aujourd'hui" persistant, CTA anniversaire, `nextOccurrence` importée au lieu d'une copie locale (§2e passe)
- `src/pages/EventDetail.jsx` — bloc date centré (cosmétique uniquement)
- `src/pages/LaBande.jsx` — recherche normalisée et levée dans App.jsx
- `src/pages/Messages.jsx` — recherche, séparateurs de dates, alignement, lien profond, visibilité garantie via `messageSearch.js` (§2e passe)
- `src/pages/Partages.jsx` — recherche, CTA, ciblage, lien profond, visibilité garantie via `shareSearch.js` (§2e passe)
- `scripts/test-agenda-selection.mjs` (nouveau)
- `scripts/test-search-utils.mjs` (nouveau)
- `scripts/test-deep-link-visibility.mjs` (nouveau, §2e passe)

Non touchés (intentionnellement) : tous les fichiers `sql/*`, `legacy/*`, `CreateEventSheet.jsx`,
`AddShareSheet.jsx`, `MyProfileSheet.jsx`, `MemberDetail.jsx` (déjà conforme), `Login.jsx`,
`AuthProvider.jsx`, `Root.jsx`, `supabaseClient.js`, `theme.js`, `SearchOverlay.jsx` (fichier
conservé sur disque mais plus monté nulle part — voir rubrique C), `package.json`,
`package-lock.json`, `vite.config.js`.

## Matrice demande → fichier(s) → avant → après → test → résultat

| # | Demande | Fichier(s) | Avant | Après | Test | Résultat |
|---|---|---|---|---|---|---|
| 1 | Grille visuelle commune | Accueil, Messages, Partages, LaBande, Agenda | Titres non centrés sur Accueil/Messages/LaBande ; pas de recherche sur Accueil/Messages | Titre centré + recherche contextuelle centrée, même largeur/style sur les 5 pages | `npm run build` + lecture visuelle du JSX | OK |
| 2 | Header : supprimer le + et la loupe globaux | App.jsx | Loupe conditionnelle, + global toujours présent (ouvrait "Ajouter un événement" depuis Accueil ET Messages) | Header réduit à Logo + avatar ; création et recherche 100% contextuelles | Lecture du JSX, `npm run build` | OK |
| 3 | Recherche unifiée (accents/casse/apostrophes) | searchUtils.js, agendaSearch.js, Accueil, Messages, Partages, LaBande | 5 algorithmes potentiels, normalisation seulement dans Agenda | Un seul helper `normalize`/`anyFieldMatches`, réutilisé partout, agendaSearch.js le réexporte | `scripts/test-search-utils.mjs` (10/10), `scripts/test-agenda-search.mjs` (18/18, inchangé) | OK |
| 4 | Navigation retour = provenance réelle | App.jsx, BottomNav.jsx | `onBack` toujours `agenda`/`labande` en dur | `eventReturnTo` mémorisé à l'ouverture, restitué au retour ; onglet actif recalculé | Lecture du flux + `npm run build` | OK — **parcours manuel requis pour certifier** (voir rubrique C) |
| 5-10 | Accueil : liens profonds, info importante, "tout voir" | Accueil.jsx, data.js, App.jsx | Cartes vers données inexistantes/mauvaise cible ; lien "Rentrée décalée" ouvrait le mauvais événement ; "tout voir" discret ; anniversaire affiché = 1er du tableau + "Samedi" en dur | Cartes = vraies données (`thread`/`shares`), ciblage par id + scroll + surlignage, **cible garantie visible (filtre/recherche destination réinitialisés, §2e passe)** ; info importante liée à `evt-rentree` ou non cliquable ; en-tête "Tout voir ›" avec zone cliquable large ; anniversaire = prochaine occurrence réelle avec date calculée (§2e passe) | `scripts/test-deep-link-visibility.mjs` (5/5) + lecture JSX + build | OK — **rendu scroll/surlignage réel à valider en navigateur** |
| 11-16 | Agenda : couleurs, 3 états, invalidation, anti-duplication, retour contextuel | Agenda.jsx, DayDots.jsx, agendaSearch.js | Sélection toujours bleue ; "aujourd'hui" disparaissait si sélectionné ; pastilles = 1/événement ; `selectedDate` jamais réinvalidée | Sélection = couleur catégorie (bleu en Tous) ; anneau "aujourd'hui" persistant ; pastilles dédupliquées par catégorie ; `useEffect` invalide `selectedDate` via `isSelectedDateStillValid` | `scripts/test-agenda-selection.mjs` (6/6) + build | OK |
| 17-19 | EventDetail cohérent, RSVP/création intacts | EventDetail.jsx | — | Bloc date centré (cosmétique) ; **aucune ligne RSVP/création touchée** | Lecture diff : seul le style du bloc date a changé | OK |
| 20 | Anniversaires : création dédiée | AddBirthdaySheet.jsx, agendaApi.js, App.jsx, Agenda.jsx | Filtre Anniversaires = bouton mort | "+ Ajouter un anniversaire" → formulaire prénom/jour/mois → `createAgendaBirthday` | Build + lecture ; **non exécuté contre un vrai Supabase** | **Voir rubrique C — schéma non vérifiable depuis cet environnement.** Référence SQL corrigée (§2e passe) : le schéma (`birthday_day`/`birthday_month`, contrainte `anniversaire_minimal`) est dans `sql/02_rls.sql`, pas `sql/01_schema_and_helpers.sql` comme indiqué par erreur dans la 1ère passe |
| 21-24 | Messages : recherche, séparateurs, alignement, lien profond | Messages.jsx, data.js, messageSearch.js | Pas de recherche ; pas de séparateurs (données sans date) ; aucune distinction "moi/les autres" ; tag ouvrait toujours vers Agenda | Recherche contenu/auteur/fichier (extraite et testable, §2e passe) ; séparateurs Aujourd'hui/Hier/date ; mes messages légèrement décalés/fond différent ; retour = provenance réelle ; **lien profond garantit la visibilité de la cible même si une recherche était restée active (§2e passe)** | `npm run build` + `scripts/test-deep-link-visibility.mjs` | OK — **rendu réel à valider en navigateur** |
| 25-28 | Partages : alignement, CTA, ciblage, retour | Partages.jsx, shareSearch.js | Pas de bouton d'ajout contextuel ; filtres non centrés ; carte liée ouvrait toujours Partages/Tout sans cible ; retour forçait Agenda | CTA "+ Ajouter un partage" centré ; filtres centrés ; ciblage par id + scroll + surlignage ; retour = provenance réelle (filtre/recherche conservés) ; **lien profond garantit la visibilité de la cible même si un filtre/une recherche étaient restés actifs (§2e passe, bug reproduit puis corrigé)** | Build + `scripts/test-deep-link-visibility.mjs` | OK |
| 29-31 | La Bande : alignement, confidentialité, relations | LaBande.jsx, Accueil.jsx | Recherche locale (perdue en repassant par la fiche parent) ; `toLowerCase()` seul ; absente de la recherche transversale de l'Accueil | Recherche levée dans App.jsx (survit à MemberDetail) + normalisation partagée ; **incluse dans "Rechercher dans ABCZed…" (§2e passe)** | Build + lecture ; `MemberDetail.jsx` déjà conforme, non modifié | OK |
| 32-33 | Garde-fous techniques + tests + build | (vérification) | — | Hash logo identique, aucun fichier `sql/*` modifié, flags `AGENDA_FROM_SUPABASE=true`/`BUSINESS_DATA_FROM_SUPABASE=false` intacts, aucun secret, `package.json`/`package-lock.json` inchangés | `sha256sum`, `diff`, `npm run build`, 4 suites de tests (**39/39**, dont 5 nouveaux tests §2e passe) | OK |

## Matrice — 3e passe (delta correctif V2, 32 sections)

| Point | État avant | Correction | Fichier(s) | Test | Résultat |
|---|---|---|---|---|---|
| §2.1 Navigation retour vers la bonne rubrique | Déjà validé par la recette de l'utilisateur | Aucune — non retouché | — | — | Déjà correct, non modifié |
| §2.2/§26 Restaurer scroll + focus déclencheur | Retour restituait la rubrique + le filtre/la recherche, mais pas la position de lecture ni le focus | Mémoire de navigation par page (`navMemory`) dans App.jsx, capturée à l'ouverture (scroll + id DOM du déclencheur) et restaurée au montage via `useScrollRestore` | `src/navMemory.js` (nouveau), `src/useScrollRestore.js` (nouveau), `App.jsx`, les 5 pages + EventDetail/MemberDetail (ids `home-*`, `agenda-row-*`, `msg-event-btn-*`, `share-linkbtn-*`, `member-row-*`) | `scripts/test-nav-memory.mjs` (9/9) + lecture du flux | OK — **rendu réel du scroll/focus non testé en navigateur (voir rubrique C)** |
| §3/§17 En-têtes de détail centrés | Flèche + titre dans un même bloc aligné à gauche | Grille 3 zones `40px 1fr 40px` : titre mathématiquement centré | `EventDetail.jsx`, `MemberDetail.jsx`, `Messages.jsx` (mini-en-tête filtré) | Lecture JSX + build | OK |
| §4.1 Titres de section Accueil centrés | Alignés à gauche | `SectionTitle` centré (Informations importantes, Prochain événement, Derniers messages, Derniers partages) | `Accueil.jsx` | Lecture JSX + build | OK |
| §4.2 CTA "Voir tous..." sous le contenu | "Tout voir" accolé au titre (empêchait son centrage) | CTA explicite centré sous le contenu, vraie zone tactile | `Accueil.jsx` | Lecture JSX + build | OK |
| §4.3 Pas de CTA artificiel (Prochain événement / Informations importantes) | Déjà sans CTA | Aucune — non retouché | `Accueil.jsx` | Lecture JSX | Déjà correct, non modifié |
| §5 "Qui vient ?" (sortie entre familles) | Résumé abstrait "X famille(s) · Y personne(s)" | "Qui vient ?" + décompte réel + détail par foyer (nom + adultes/enfants, singulier/pluriel géré) ; bloc "Votre participation" inchangé | `EventDetail.jsx` | Lecture JSX + build (pas de donnée famille peuplée avec 2+ foyers dans data.js pour un rendu réel multi-foyers) | OK — **rendu à plusieurs foyers non vérifié en navigateur faute de jeu de données** |
| §6.1 Centrage accompagnateurs | Aligné à gauche | Compteur + pastilles centrés en mode accompagnement | `EventDetail.jsx` | Lecture JSX + build | OK |
| §6.2 Identification au tap + liste complète | Nom visible seulement au survol (`title`) | Tap sur une pastille révèle le nom ; "+N" ouvre la liste complète en texte | `EventDetail.jsx` | Lecture JSX + build ; **interaction tactile réelle non testée (voir rubrique C)** | OK |
| §7 Lieu → carte/itinéraire | Ligne de lieu non cliquable | Bouton ouvrant Google Maps (URL universelle) avec l'adresse | `EventDetail.jsx` | Lecture JSX + build ; **URL non ouverte sur un appareil réel (voir rubrique C)** | OK avec réserve |
| §8 Document actionnable | Cartouche passive, aucune action visible | Actions Ouvrir/Télécharger (désactivées, démo) ajoutées, `.tap-container` pour signaler visuellement les actions | `EventDetail.jsx`, `src/components/ActionButton.jsx` (nouveau, partagé avec Partages.jsx) | Lecture JSX + build | OK — **ouverture/téléchargement réels bloqués tant que le stockage n'existe pas (voir rubrique C)** |
| §9.1 Carte Partages : affordance | Carte neutre | `.tap-container` (relief au survol / anneau `focus-within` dès qu'une action interne a le focus) — pas de fausse affordance de carte entière cliquable puisqu'aucune fiche dédiée n'existe | `Partages.jsx` | Lecture JSX + build | OK — voir décision de scoping documentée ci-dessus |
| §9.2 Badge "Lié à" explicite | "Lié à : Sortie au zoo" ressemblait à une information | "Voir l'événement : Sortie au zoo →", bouton avec `.tap-surface` | `Partages.jsx` | Lecture JSX + build | OK |
| §9.3 Propagation des clics | Pas de risque réel (aucun onClick de carte englobant) mais non garanti explicitement | `stopPropagation()` défensif sur chaque action (menu, lien événement) | `Partages.jsx` | Voir rubrique C — pas de test automatisé DOM (aucune librairie de test de composants dans ce projet, volontairement non ajoutée) | OK, vérifié par lecture de code |
| §10 Photos/documents réels en production | — | — | — | — | **Bloqué : nécessite le stockage Supabase réel, hors périmètre de ce lot (voir rubrique C)** |
| §11 Bouton clear "x" | Recherche à effacer caractère par caractère | Bouton "x" avec `aria-label`, restaure la liste, garde le focus dans le champ | `Accueil.jsx`, `Agenda.jsx`, `Messages.jsx`, `Partages.jsx`, `LaBande.jsx` | Lecture JSX + build | OK |
| §12 Recherche Messages (texte/auteur/pièce jointe/événement) | Déjà trouvé, mais correspondance événement lié parfois coïncidentielle | Ajout du matching explicite par titre exact de l'événement lié | `src/messageSearch.js` | `scripts/test-date-search.mjs` test 22 (1/1 dédié) | OK |
| §13 Recherche par date | "24" trouvait par coïncidence textuelle, pas une vraie date | Nouveau module `dateSearch.js` : "24 mai", "24/05", "24/05/2026", "24-05-2026", "hier", "aujourd'hui", abréviations — combiné en OU avec la recherche existante ; "24" seul reste une recherche large, jamais une date | `src/dateSearch.js` (nouveau), `src/messageSearch.js`, `Messages.jsx` (placeholder mis à jour) | `scripts/test-date-search.mjs` (22/22) | OK |
| §14 Retour Messages : position + focus | Requête/résultats conservés, pas la position ni le focus | Voir §2.2 — même mécanisme (`navMemory`) | `Messages.jsx` | `scripts/test-nav-memory.mjs` + lecture | OK — réserve identique à §2.2 |
| §15 Compositeur Messages fixe | Déjà conforme | Aucune — non retouché | `Messages.jsx` | Lecture JSX | Déjà correct, non modifié |
| §16 Affordance cartes La Bande | Survol/chevron trop discrets | `.tap-surface` (hover/focus-visible/pressed) sur la carte entière (elle ouvre bien une fiche) | `LaBande.jsx` | Lecture JSX + build | OK |
| §17 Fiche parent centrée | Voir §3 | Voir §3 | `MemberDetail.jsx` | Lecture JSX + build | OK |
| §18 Fiche "Vous" → Mon profil | Ouvrait une fiche parent générique ("Contacter Vous") | `App.jsx` (`openMember`) intercepte `mem-vous` et ouvre directement la modale Mon profil, quel que soit l'endroit d'où on clique | `App.jsx` | Lecture du flux + build ; `MemberDetail.jsx` ne reçoit plus jamais `mem-vous` (vérifié par lecture) | OK |
| §19 Modèle numéro/e-mail + flags indépendants | 4 paires `{value, shared}` par canal, pouvant diverger pour un même numéro | `phone_number`/`email` uniques + `share_whatsapp`/`share_phone`/`share_sms`/`share_email` indépendants ; **4e passe** : persistance locale corrigée (état levé dans `App.jsx`, `src/shareFlags.js`) | `src/data.js`, `MemberDetail.jsx`, `MyProfileSheet.jsx`, `App.jsx`, `src/shareFlags.js` | Lecture JSX + build + `scripts/test-share-flags.mjs` (4/4) | OK côté modèle/UI — **protection RLS/API réelle non applicable, La Bande reste locale (voir rubrique C)** |
| §20 Recette multi-comptes | — | — | — | — | **Non exécutable : La Bande n'est pas branchée à un vrai Supabase (voir rubrique C)** |
| §21 Modale Mon profil (fermeture) | Déjà conforme | Aucune — non retouché | `MyProfileSheet.jsx` | Lecture JSX | Déjà correct, non modifié |
| §22 Contenu de démonstration jamais en production | Bandeau + textes "démonstration locale" toujours rendus | **Révisé en 4e passe** (1ère version conditionnée à `DEMO_MODE`, incorrecte pour un état fonctionnel réel — voir rubrique C) : le bandeau de données mockées dépend uniquement de `BUSINESS_DATA_FROM_SUPABASE` ; les 5 textes de limitation fonctionnelle sont reformulés sans le mot "démonstration" et rendus en permanence ; `DEMO_MODE`/`src/config.js` supprimés | `App.jsx`, `MemberDetail.jsx`, `MyProfileSheet.jsx`, `ActionButton.jsx`, `AddShareSheet.jsx` | `npm run build` + recherche du mot "monstration" dans `dist/` | OK |
| §23 Responsive réel (pas de colonne mobile figée) | `.max-w-md` fixé à 448px à toutes les largeurs | 448px (mobile) → 640px (≥768px) → 900px (≥1024px) ; `EventDetail.jsx` passe en 2 zones à ≥1024px | `index.html`, `EventDetail.jsx` | `npm run build` ; **rendu visuel aux breakpoints non vérifié en navigateur (voir rubrique C)** | OK avec réserve |
| §24 Règle de centrage (structurant vs lecture) | Cohérent pour l'essentiel | Centrage étendu aux nouveaux éléments structurants (titres Accueil, "Qui vient ?", accompagnateurs) sans toucher aux paragraphes/descriptions | `Accueil.jsx`, `EventDetail.jsx` | Lecture JSX | OK |
| §25 Affordance/accessibilité transversale | Hover-only par endroits, pas de `:focus-visible` systématique | Classes `.tap-surface`/`.tap-container` (hover + `:active`/`:focus-within` + `:focus-visible`), `aria-label` sur boutons icône-seule (clear, retour, menu, pastilles, lieu) | `App.jsx` (styles globaux) + toutes les pages/composants listés dans "Fichiers touchés" | Lecture JSX + build | OK |
| §26 État complet par page | Filtre/recherche déjà conservés (2e passe) ; scroll/focus manquants | Voir §2.2 | Toutes les pages | `scripts/test-nav-memory.mjs` (9/9) | OK — réserve identique à §2.2 |
| §27 Non-régression | — | Aucune ligne de la liste "déjà bon" n'a été modifiée | — | `npm run build` + 70/70 tests + hashes inchangés | OK |
| §28 Garde-fous Supabase/code | — | Vérifiés inchangés | — | `sha256sum`, `grep` des 2 flags | OK |
| §29 Tests automatiques | — | 2 nouvelles suites (31 tests), toutes important le code de production | `scripts/test-date-search.mjs`, `scripts/test-nav-memory.mjs` | 70/70 au total | OK — voir réserve §9.3 (pas de test DOM de propagation) |
| §30-32 Recette + livraison | — | Voir rubrique D bis + vérifications ci-dessous | — | `npm run build`, 70/70 tests, `sha256sum`, `grep` | OK |

## A. Corrections effectivement apportées

**3e passe** : voir le résumé par thème et la matrice détaillée ci-dessus (32 sections du
delta correctif V2).

**1ère et 2e passes** (pour mémoire) : grille visuelle unifiée sur les 5 pages,
header simplifié, recherche normalisée partagée, mécanique de retour par provenance réelle,
liens profonds réels (Accueil → message/partage précis), couleurs et états du calendrier
corrigés, anti-duplication et pastilles par catégorie, création d'anniversaire dédiée,
séparateurs temporels et distinction "moi/les autres" dans Messages, CTA et ciblage dans
Partages, recherche persistante dans La Bande.

## B. Points déjà corrects et laissés intacts

RSVP (Entre familles / Avec l'école / École-Autre / Anniversaire = aucun RSVP), création
d'événement contextualisée (présélection de catégorie, retour "Entre familles" par défaut,
bouton réellement + visuellement désactivé, `await loadAgendaEvents()` après création),
anti-duplication panneau du jour / "À venir", retour Agenda préservant filtre/mois/année/date
quand on vient d'Agenda, fiche parent → La Bande, filtre Documents de Partages, logo, nom
ABCZed, palette des catégories. Aucune de ces lignes de code n'a été modifiée.

**3e passe** — points confirmés déjà corrects par la recette manuelle de l'utilisateur et
explicitement laissés intacts (aucune ligne modifiée) :

- **§2.1** Retour vers la bonne rubrique d'origine (le mécanisme `eventReturnTo`/provenance
  réelle de la 1ère/2e passe fonctionnait déjà — seuls le scroll et le focus manquaient, §2.2).
- **§12** Recherche Messages par texte/auteur/pièce jointe/événement lié — déjà trouvée avant
  cette passe ; seul le matching par titre exact d'événement lié a été durci (voir matrice
  3e passe, une modification ciblée dans `messageSearch.js`, pas une réécriture de la
  recherche elle-même).
- **§15** Compositeur Messages fixe au-dessus de la barre de navigation, non recouvert par le
  clavier virtuel — déjà conforme.
- **§21** Fermeture de la modale Mon profil par la croix (et non par clic en dehors, pour
  éviter une fermeture accidentelle) — déjà conforme.
  **[SUPERSEDÉ en 7e passe — signalé par contre-vérification indépendante du ZIP V7 comme
  contradiction non signalée.]** Depuis la 7e passe, le mécanisme d'accessibilité modale
  générique (`src/useModalA11y.js`) s'applique aux 5 modales de l'app, Mon profil incluse : un
  clic sur le fond (hors du panneau) ferme désormais aussi Mon profil, comme les 4 autres. Ce
  changement était voulu — cohérence transversale du comportement modal plutôt qu'un cas
  spécial — mais n'avait jamais été explicitement mis en regard de cette règle-ci ni du point 7
  de la rubrique D plus bas, qui l'un et l'autre affirmaient encore l'ancien comportement comme
  toujours valide. Voir rubrique "7e passe" (scénarios Playwright 13-15) pour le détail.
- **§27** Liste de non-régression explicite du brief — aucune régression constatée : RSVP
  intact (Entre familles/Avec l'école/École-Autre/Anniversaire), distinction
  accompagnement/entre familles intacte, connexion Supabase de l'Agenda intacte
  (`AGENDA_FROM_SUPABASE=true` inchangé), garde-fous SQL/logo intacts (voir rubrique C pour
  le détail des vérifications), aucune dépendance npm ajoutée, aucun fichier hors périmètre
  touché (voir la liste "Non touchés dans cette 3e passe" ci-dessus).

## C. Points impossibles à certifier sans navigateur ou vrai Supabase

- **Anniversaires (§20)** : le schéma `events.birthday_day/birthday_month` et la contrainte
  `anniversaire_minimal` existent dans **`sql/02_rls.sql`** du dépôt (table `events`, lignes
  ~26-47 — corrigé §2e passe, la 1ère version de cette matrice citait par erreur
  `sql/01_schema_and_helpers.sql`), et `agendaApi.js` les lisait déjà — mais **cet
  environnement n'a aucun accès au projet Supabase réel**. Le code de
  `createAgendaBirthday` est écrit contre le schéma documenté dans le dépôt, pas contre une
  vérification live. **À faire avant tout usage réel** : confirmer dans le tableau de bord
  Supabase que ces colonnes/contrainte sont bien déployées telles quelles — l'historique du
  projet montre déjà un décalage possible entre dépôt et base réelle, donc cette
  vérification n'est pas optionnelle. Aucune migration n'a été écrite ni exécutée dans ce
  lot (01/02/03 non rejoués, 04 non exécuté, conformément au garde-fou du brief).
- Rendu visuel réel (grille, centrage, couleurs) : vérifié par lecture de code et build sans
  erreur, pas par capture d'écran navigateur — ce lot n'a pas ouvert l'app dans un navigateur.
- Scroll + surlignage temporaire (Accueil → message/partage précis) : **mis à jour 5e passe** —
  vérifié en navigateur réel (Chromium/Playwright, voir "5e passe" et rubrique D ter) pour les
  parcours Accueil→Messages/Partages/recherche ; ce qui reste non observé est le rendu pixel
  exact (couleur/épaisseur perçue de l'anneau) et le comportement sur appareil tactile réel.
- Alignement visuel des bulles "mes messages" (léger décalage) : implémenté, rendu pixel non
  vérifié en navigateur.
- `SearchOverlay.jsx` reste sur disque mais n'est plus monté nulle part (plus aucune page
  n'a besoin de la loupe globale puisque les 5 pages ont désormais leur propre recherche) —
  laissé en l'état plutôt que supprimé, par prudence (hors périmètre strict de ce lot).
- Bug préexistant hors périmètre, non introduit par ce lot : dans `App.jsx`, les branches
  `BUSINESS_DATA_FROM_SUPABASE` de `sendMessage`/`linkMessage` appellent `loadAll()`, qui
  n'existe pas — sans conséquence car `BUSINESS_DATA_FROM_SUPABASE` est figé à `false`
  (code mort), mais signalé tel que demandé par le brief (§ contradictions à signaler).

**3e passe** — réserves supplémentaires, propres au delta correctif V2 :

- **Scroll + focus restaurés (§2.2/§14/§26)** : `navMemory`/`useScrollRestore` sont couverts
  par 9 tests unitaires purs (capture/consommation/immuabilité). **Mise à jour 5e passe** : le
  rendu réel — l'écran qui remonte visuellement à la bonne position, l'élément qui reprend le
  focus, et désormais le repère visuel temporaire — a été observé dans un vrai navigateur
  (Chromium headless piloté par Playwright) pour La Bande, Partages, Messages, Agenda et Accueil,
  sur les parcours listés en rubrique D ter (28/28 scénarios réussis). Ce qui reste non couvert
  par cette vérification : le rendu pixel fin (couleurs, ombres perçues), les gestes tactiles
  réels sur téléphone/tablette, les points de rupture desktop/tablette, et tout ce qui dépend
  du vrai Supabase (RSVP, formulaires, anniversaires) — voir les autres réserves de cette
  rubrique.
- **Tap-to-reveal accompagnateurs (§6.2)** : le changement d'état au clic (`revealedId`) est
  lisible dans le code et compile, mais aucune interaction tactile réelle (téléphone/tablette)
  n'a été testée.
- **Lien Maps (§7)** : l'URL générée suit le schéma universel Google Maps
  (`google.com/maps/search/?api=1&query=…`), mais n'a pas été ouverte depuis un appareil réel
  (comportement app native vs navigateur non observé).
- **Documents/photos réels (§8/§10)** : les boutons Ouvrir/Télécharger existent visuellement
  mais restent désactivés côté code (`disabled`) — aucun vrai fichier ne peut être ouvert tant
  que le stockage Supabase n'est pas branché. C'est un blocage assumé, pas un oubli : le
  brief lui-même classe ce point hors périmètre de ce lot (§10).
- **Propagation des clics (§9.3)** : vérifiée par lecture de code (`stopPropagation()` posé
  sur chaque bouton d'action à l'intérieur d'un `.tap-container`), pas par un test DOM
  automatisé — ce projet n'a délibérément aucune dépendance de test de composants
  (jsdom/@testing-library/react n'ont pas été ajoutées, pour rester sur la philosophie
  "scripts Node simples" déjà en place).
- **Modèle de contacts restructuré (§19)** : le changement (`phone_number`/`email` +
  flags indépendants) ne touche que les données locales et l'UI ; il n'y a pas de politique
  RLS/API réelle à vérifier puisque La Bande n'est pas branchée à Supabase
  (`BUSINESS_DATA_FROM_SUPABASE=false`, inchangé). **Mise à jour 4e passe** : la persistance
  LOCALE (fermer/rouvrir la modale Mon profil sans perdre les choix) est corrigée — voir la
  section "4e passe" plus haut ; seule la persistance réelle multi-comptes via Supabase reste
  hors périmètre.
- **Recette multi-comptes (§20)** : explicitement non exécutable dans cet environnement — elle
  suppose deux comptes réels partageant une même communauté sur La Bande, ce qui n'existe que
  si/quand cette page est un jour branchée à Supabase.
- **Contenu de démonstration absent en production (§22)** — **révisé en 4e passe** : la 1ère
  version de ce lot conditionnait ce contenu à `DEMO_MODE` (`import.meta.env.DEV`), ce qui a
  été signalé (contre-vérification indépendante) comme incorrect pour le bandeau de données
  mockées — un indicateur de MODE DE BUILD ne doit pas arbitrer une information sur l'état
  RÉEL des données. Corrigé : le bandeau dépend uniquement de `BUSINESS_DATA_FROM_SUPABASE`
  (visible en dev et en production tant que les données sont mockées) ; les 5 textes
  mentionnant une limitation fonctionnelle (2 paragraphes + 3 `title` de bouton désactivé,
  dans `MemberDetail.jsx`/`MyProfileSheet.jsx`/`ActionButton.jsx`/`AddShareSheet.jsx`) sont
  reformulés sans le mot "démonstration" et rendus en permanence, plutôt que masqués par
  build. `DEMO_MODE`/`src/config.js` sont supprimés (plus aucun usage restant). Vérifié par
  recherche du mot "monstration" dans le bundle `dist/` généré par `npm run build` — seule
  occurrence restante : le bandeau `App.jsx` lui-même, volontaire (voir 4e passe).
- **Responsive réel (§23)** : les points de rupture CSS (448/640/900px) et la disposition
  2 zones d'`EventDetail.jsx` à ≥1024px compilent et sont cohérents à la lecture, mais aucune
  capture d'écran à 390/768/1440px n'a été prise depuis cet environnement (pas de navigateur
  graphique disponible ici) — à vérifier visuellement avant mise en production.
- **§5 "Qui vient ?" à plusieurs foyers** : le rendu (nom + adultes/enfants par foyer) est
  correct pour les données de démonstration actuelles, mais aucun jeu de données à 3+ foyers
  n'existe dans `data.js` pour observer le rendu à pleine échelle (retour à la ligne, liste
  longue) — comportement du code jugé correct par lecture, non par capture d'écran.

## D. Parcours manuel final minimal (recette)

1. Accueil → carte "Prochain événement" → fiche événement → retour → doit revenir sur Accueil (onglet Accueil actif).
2. Accueil → carte "Derniers messages" (Sabrina) → doit ouvrir Messages, scroller et surligner ce message, avec un lien "← Accueil" en haut.
3. Accueil → une carte "Derniers partages" → doit ouvrir Partages, scroller et surligner ce partage, avec un lien "← Accueil".
3bis. Reproduire le scénario du bug corrigé en 2e passe : dans Partages, filtrer sur "Documents" et taper une recherche, revenir à l'Accueil sans réinitialiser manuellement, puis cliquer une carte de partage de type Photo → Partages doit s'ouvrir avec le filtre remis à "Tout" et la recherche vidée, et la carte visée doit être scrollée/surlignée (pas invisible).
4. Partages / filtre Documents → carte avec "Lié à : …" → fiche événement → retour → doit revenir sur Partages, filtre Documents conservé.
5. Agenda / École → choisir une date avec événement → fiche événement → retour → doit revenir sur Agenda, filtre École + mois/année + date sélectionnée + panneau du jour conservés.
6. Agenda : sélectionner une date sous École, puis basculer sur Sorties → si cette date n'a aucun événement en Sorties, la sélection doit disparaître automatiquement.
7. Messages → taper une recherche → vérifier les séparateurs Aujourd'hui/Hier/date au-dessus des messages, et que mes propres messages (après envoi) sont visuellement décalés.
8. La Bande → taper une recherche → ouvrir une fiche parent → retour → la recherche doit être toujours présente.
9. Agenda / filtre Anniversaires → "+ Ajouter un anniversaire" → remplir prénom/jour/mois → vérifier l'apparition dans le calendrier (nécessite un vrai schéma Supabase confirmé, voir rubrique C).
10. Vérification visuelle rapide des 5 pages : titre centré, recherche centrée, filtres centrés (si présents), action principale centrée, header réduit à logo + avatar.

## D bis. Recette finale courte (3e passe, delta correctif V2 §30)

1. **Accueil** : scroller, ouvrir un événement puis revenir → l'écran doit se retrouver
   exactement à la position de scroll quittée (pas remonté en haut) ; vérifier les nouveaux
   CTA "Voir tous les messages"/"Voir tous les partages" sous chaque section, et le centrage
   des titres de section.
2. **Sortie "Entre familles"** (ex. fiche `evt-*` de ce type) : vérifier que le bloc
   participants affiche "Qui vient ?" + un décompte réel de personnes + le détail par foyer
   (nom, adultes/enfants), et non plus "X famille(s) · Y personne(s)".
3. **Sortie "Avec l'école"** : vérifier le centrage des pastilles d'accompagnateurs, qu'un tap
   sur une pastille révèle son nom, que "+N" ouvre la liste complète ; cliquer la ligne de
   lieu et vérifier l'ouverture de Google Maps ; cliquer "Ouvrir"/"Télécharger" sur un document
   et vérifier qu'ils restent volontairement inactifs (pas de fichier réel, stockage non
   branché).
4. **Partages** : survoler puis donner le focus clavier (Tab) à une carte → vérifier le relief
   visuel (`.tap-container`) sans qu'un clic dans le vide sur la carte ne déclenche rien ;
   filtrer + rechercher, revenir sur Accueil sans réinitialiser, puis rouvrir Partages depuis
   une carte de l'Accueil → filtre/recherche doivent être remis à neutre et la cible visible ;
   revérifier le scroll/focus au retour d'une fiche événement liée.
5. **Messages** : taper une recherche texte, puis une date (ex. "24 mai" ou "hier"), vérifier
   les résultats ; cliquer le "x" pour effacer → le focus doit rester dans le champ ; ouvrir un
   événement lié depuis un tag de message puis revenir → position de lecture et focus sur le
   tag doivent être restaurés.
6. **La Bande** : survoler/focus une carte parent → vérifier l'affordance complète
   (hover/focus-visible/pressé) ; ouvrir la fiche de Marie (ou tout autre membre) → vérifier
   le nouvel en-tête centré à 3 zones ; ouvrir la fiche "Vous" → doit ouvrir directement Mon
   profil, jamais une fiche "Contacter Vous".
7. **Mon profil** : ouvrir, activer/désactiver un canal de partage (WhatsApp/Téléphone/
   SMS/E-mail), fermer par la croix → vérifier que rien ne se ferme par un clic en dehors.
   **[SUPERSEDÉ en 7e passe, voir §21 en rubrique B ci-dessus : un clic sur le fond ferme
   désormais aussi Mon profil, comme les 4 autres modales — comportement voulu, pas une
   régression. Ne pas utiliser ce point 7 tel quel pour une recette manuelle sans lire la note
   du §21.]**
8. **Responsive** : redimensionner (ou tester) à ~390px (mobile), ~768px (tablette) et
   ~1440px (desktop) → la colonne applicative doit s'élargir progressivement (448 → 640 →
   900px), et la fiche événement doit passer en 2 zones côte à côte à partir de 1024px.
9. **Build de production** : lancer `npm run build`, ouvrir le résultat → aucun bandeau ni
   texte "démonstration locale" ne doit apparaître (voir réserve de scoping en rubrique C pour
   les 3 textes de limitation fonctionnelle volontairement laissés en l'état).
10. **Non-régression** : `npm run build` sans erreur, les 70 tests automatisés passent
    (`node scripts/test-*.mjs` un par un, ou via le script de lancement existant), et les
    empreintes SHA-256 du logo et des 4 fichiers `sql/*` restent identiques à celles d'avant
    cette passe.

## D ter. Matrice des scénarios réellement couverts en navigateur réel (5e passe, point 10)

Ce qui suit correspond exactement aux 28 assertions exécutées dans Chromium headless (Playwright)
contre l'application réelle non modifiée (voir "5e passe — Vérification par navigateur réel" plus
haut pour la méthodologie et ce qui est simulé). Chaque ligne du tableau logique ci-dessous est un
scénario du point 10 de l'arbitrage ; le résultat est celui obtenu lors de la dernière exécution
complète de la suite (28 réussites, 0 échec).

1. **Accueil → "Voir tous les messages"** : ouverture de Messages ; une flèche "← Accueil"
   apparaît (absente en accès par la barre du bas) ; clic dessus → retour sur Accueil ; le focus
   revient exactement sur le CTA d'origine ; le repère visuel temporaire s'applique sur ce même
   CTA. **5/5 assertions réussies.**
2. **Accueil → "Voir tous les partages"** : même parcours que ci-dessus, avec le CTA partages.
   **4/4 assertions réussies.**
3. **Barre du bas → Messages / Partages (navigation franche)** : aucune flèche "← Accueil"
   artificielle ne doit apparaître dans ce cas — confirmé pour les deux pages. **2/2 réussies.**
4. **La Bande → recherche "sabrina" → fiche parent → retour** : la fiche s'ouvre ; le retour
   restaure la recherche "sabrina" dans le champ, remet le focus sur la carte de Sabrina, et lui
   applique le repère visuel temporaire. **4/4 réussies.**
5. **Partages → filtre "Documents" → "Voir l'événement" → retour** : la fiche liée s'ouvre ; le
   retour restaure le filtre "Documents" (bouton toujours actif visuellement) et remet le focus
   sur le lien d'origine. **3/3 réussies.**
6. **Messages → badge d'événement lié → retour** : la fiche liée s'ouvre ; le retour remet le
   focus exactement sur le badge d'origine. **2/2 réussies.**
7. **Agenda → filtre "Sorties" → fiche événement → retour** : la fiche s'ouvre ; le retour
   restaure le filtre "Sorties" et remet le focus sur la rangée d'événement d'origine exacte
   (comparaison par `id` DOM, pas seulement "une rangée quelconque"). **3/3 réussies.**
8. **Accueil → "Prochain événement" → retour** : cas explicitement recontrôlé sur demande
   (point 7 de l'arbitrage, diagnostic initial jugé insuffisant) — le retour ramène bien sur
   Accueil, jamais sur Agenda, avec les données du harnais. **1/1 réussie** (scénario conditionné
   à la présence d'un prochain événement dans le jeu de données ; présent dans ce harnais).
9. **Accueil → recherche "piscine" → résultat de type Message → retour** : nouveau cas (point 8
   de l'arbitrage) — le résultat ouvre bien Messages, une flèche "← Accueil" est proposée, le
   retour restaure la requête "piscine" dans le champ de recherche de l'Accueil et remet le focus
   sur le résultat de recherche d'origine exact. **4/4 réussies.**

**Total : 28/28 assertions réussies, 0 exception JavaScript capturée pendant la session.**

Hors périmètre de cette matrice (donc toujours listé en rubrique C comme non certifié) : rendu
pixel exact (couleurs, ombres), gestes tactiles réels sur téléphone/tablette, points de rupture
desktop/tablette (768/1440px), flux RSVP/formulaires/anniversaires (nécessitent le vrai
Supabase), et tout scénario non listé explicitement ci-dessus.

---

# 7e passe — LOT GLOBAL DE STABILISATION UX/NAVIGATION/INTERACTIONS

Cette section documente la 7e passe : un lot global (67 points) livré en une seule fois, après
audit préalable (A/B/C/D) communiqué en message avant toute modification de code, puis arbitrage
explicite des 3 décisions produit (D) par l'utilisateur avec conditions contraignantes, puis
reclassification de plusieurs points "déjà correct" sur la base d'une recette manuelle réelle
(V5.1) contredisant le code lu / les scénarios Playwright existants. Autorisation finale reçue :
"Tu peux maintenant réaliser B + C + les trois arbitrages D validés ci-dessus, en une seule
passe. Je ne veux pas de nouveaux micro-lots sauf blocage réel."

Portée respectée : aucune modification d'architecture, de Supabase, de logo/branding ; scripts
SQL `01`-`03` non touchés (hashes identiques, voir rubrique "Vérification finale" ci-dessous),
`04` non exécuté ; `BUSINESS_DATA_FROM_SUPABASE = false` et `AGENDA_FROM_SUPABASE = true`
inchangés (Messages/Partages/La Bande restent en données de démonstration, Agenda reste branché
sur les vraies données Supabase).

## A. Directive transversale prioritaire : mécanisme "retour au point exact + repère visuel"

Plutôt que de corriger chaque écran où le défaut avait été signalé/reproduit manuellement, le
correctif a été apporté UNE SEULE FOIS, au niveau du mécanisme partagé par tous les écrans :

- **`src/motionPrefs.js`** (nouveau) : `afterPaint(fn)` remplace `setTimeout(fn, 0)` par un
  double `requestAnimationFrame` dans **`src/useScrollRestore.js`** (le hook unique utilisé
  identiquement par Accueil/Agenda/Messages/Partages/La Bande). Hypothèse retenue pour expliquer
  les cas reclassés ("retour en haut de page", highlight manquant) alors que les scénarios
  Playwright existants passaient : `setTimeout(0)` peut s'exécuter avant que le navigateur ait
  fini de peindre une page qui vient de se monter (polices, hauteur réelle du contenu) — un
  environnement de test headless déjà "chaud" ne l'expose pas forcément, contrairement à un
  chargement réel. Honnêteté sur les limites : cette hypothèse n'est PAS démontrée empiriquement
  par un avant/après reproduisant le bug réel (le harnais, rapide et chaud, n'a jamais reproduit
  le symptôme lui-même) — seule la robustesse du mécanisme après correctif est vérifiée
  (scénarios 10-12 ci-dessous), pas la régression d'origine.
- `prefersReducedMotion()` (même module) : lu à chaque appel, appliqué dans `useScrollRestore.js`
  (scroll instantané + pas de classe de repère si l'utilisateur a demandé moins de mouvement,
  brief pt 1) et dans les effets de surlignage propres à `Messages.jsx`/`Partages.jsx`. Vérifié
  scénario 16 (`page.emulateMedia({reducedMotion:'reduce'})`) : focus restauré, aucune classe
  appliquée.
- **`src/useModalA11y.js`** (nouveau) : mécanisme générique d'accessibilité modale — Escape,
  clic sur le fond, piège de focus Tab/Shift+Tab, et **retour de focus + repère visuel sur
  l'élément déclencheur réel** (`document.activeElement` au montage) à la fermeture. Corrige
  structurellement "La Bande → Vous → Mon profil → fermeture" : cette ouverture ne change jamais
  `view` (simple superposition), donc `useScrollRestore` ne s'y déclenche jamais — le focus/
  repère doivent être restitués PAR LA MODALE ELLE-MÊME. Appliqué aux 5 feuilles modales de
  l'app : `MyProfileSheet`, `CreateEventSheet`, `AddBirthdaySheet`, `AddShareSheet`, et le
  sélecteur "Lier à un événement" de Messages (extrait en sous-composant `LinkEventPicker` pour
  que le hook s'arme à chaque ouverture réelle, pas au montage de `Messages` lui-même). Vérifié
  scénarios 13-15 : ouverture, focus initial dans la modale, piège de focus (Shift+Tab boucle
  vers le dernier élément), Escape ferme + restaure focus + repère, clic sur le fond ferme aussi.
- **Bug de harnais de test découvert ET corrigé en cours de vérification** (transparence totale,
  dans l'esprit de la 6e passe) : l'alias Vite du harnais (`vite.harness.config.js`) qui
  substitue `AuthProvider`/`agendaApi` par des doublures locales ne matchait que la chaîne
  relative EXACTE utilisée par `App.jsx` (`./auth/AuthProvider`), pas celle utilisée par
  `src/components/MyProfileSheet.jsx` (`../auth/AuthProvider`, un niveau plus profond) — ce
  composant chargeait donc le VRAI `AuthProvider` dans le harnais (qui n'en fournit pas),
  `useAuth()` y levait une exception à CHAQUE montage, et donc **aucun scénario Playwright
  n'avait jamais pu exercer "La Bande → Vous → Mon profil" avant cette passe**, silencieusement.
  Corrigé par un alias en expression régulière ancré sur la chaîne ENTIÈRE (voir le commentaire
  du fichier pour le piège rencontré : un alias regex qui ne matche qu'un suffixe, avec
  `.replace()`, laisse le préfixe relatif collé devant le chemin de remplacement — chemin
  invalide, détecté immédiatement en relançant la recette). Ce correctif ne touche QUE le
  harnais de test (non livré dans le ZIP), aucun impact sur le code applicatif.

## B/C. Points implémentés cette passe (au-delà du mécanisme transversal ci-dessus)

| # | Point | Fichier(s) | Test |
|---|---|---|---|
| 7-9 | Survol desktop "À venir" → date correspondante en surbrillance (3e état visuel, jamais `selectedDate`), gardé par `(hover:hover) and (pointer:fine)` (`supportsHoverPointer()`) | `src/motionPrefs.js`, `src/pages/Agenda.jsx` | Relecture de code + gate CSS media ; pas de scénario Playwright ajouté pour l'interaction elle-même (voir Limites connues) |
| 19 | `familiesCount` (déjà calculé serveur, `src/agendaApi.js`) affiché à côté de `peopleCount` dans "Qui vient ?" | `src/pages/EventDetail.jsx` | Relecture de code (affichage conditionnel, pas de régression sur le cas où absent) |
| 20 | Accompagnateurs : confirmation que l'identification est bien tap-only (le code l'était déjà depuis une passe antérieure, §6.2) | `src/pages/EventDetail.jsx` (non modifié) | **Nouveau scénario Playwright 18**, `.click()` sans survol préalable |
| 23 | Action "Lier" renommée en "Lier à un événement" (bouton déclencheur ET titre de la modale), citation du message source dans la modale | `src/pages/Messages.jsx` | Relecture de code |
| 26-28 | Réactions réellement interactives, modèle par personne `{userId, displayName, emoji}` (arbitrage D3) — pastilles cliquables (toggle), sélecteur de 5 émojis, "qui a réagi" via `title`/`aria-label` | `src/reactions.js` (nouveau), `src/data.js`, `src/App.jsx`, `src/pages/Messages.jsx` | `scripts/test-reactions.mjs` (17 assertions) + **scénario Playwright 17** |
| 29/30/39/42 | Pièces jointes réellement actionnables, source unique `{id, filename, displayName, size, mimeType, url}` (arbitrage D1) — fichier de démonstration réel (`public/demo/autorisation-piscine.pdf`), Ouvrir/Télécharger fonctionnels partout où c'est le même fichier, **et la carte de pièce jointe elle-même actionnable** (tap mobile, hover/curseur/focus visible desktop, activation clavier Entrée/Espace — précision reçue explicitement avant livraison, appliquée à EventDetail, Messages et à l'icône du partage document dans Partages, sans transformer la carte de partage entière — multi-actions — en une seule zone cliquable) | `src/documents.js` (nouveau), `src/attachmentCardA11y.js` (nouveau), `src/data.js`, `src/components/ActionButton.jsx`, `src/pages/EventDetail.jsx`, `src/pages/Messages.jsx`, `src/pages/Partages.jsx`, `src/messageSearch.js`, `src/shareSearch.js` | **Scénarios Playwright 19-20** (lien réel + attribut `download` + carte cliquable/clavier sur EventDetail ET Partages) |
| 31-32/61 | Tri chronologique défensif des messages (horodatage réel, jamais une confiance dans l'ordre d'arrivée du tableau) | `src/messageSearch.js` | `scripts/test-messages-sort.mjs` (5 assertions, entrée mélangée + tri stable + entrée invalide) |
| 40-41 | Maps 3 niveaux de précision (arbitrage D2) : lat/lng > adresse+lieu > lieu seul (dernier recours) ; URL universelle conservée, **aucune détection d'OS/plateforme** ; adresse réelle vérifiée par recherche web pour la sortie piscine (corrige au passage un code postal erroné, 97490 au lieu de 97400) | `src/mapsUrl.js` (nouveau), `src/pages/EventDetail.jsx`, `src/data.js` | `scripts/test-maps-url.mjs` (8 assertions) |
| 43 | EventDetail desktop : bloc date/lieu sorti en pleine largeur au-dessus de la grille à 2 zones (au lieu de rester seul dans une colonne clairsemée quand il n'y a ni description ni pièce jointe) | `src/pages/EventDetail.jsx`, `index.html` (`.event-detail-grid.single`) | Relecture de code, vérification visuelle non automatisée (voir Limites connues) |

## Reclassifications (points rouverts sur signalement de recette manuelle réelle)

Chaque point reclassé "déjà correct" → rouvert par l'utilisateur a été traité par le correctif
transversal de la rubrique A (`afterPaint` + `useModalA11y`), puis re-vérifié par un scénario
Playwright DÉDIÉ (pas une simple relecture) :

- **La Bande → Marie (liste NON filtrée), pas de repère visuel** : scénario 4 existant ne passait
  que par une recherche filtrée sur Sabrina — **nouveau scénario 10**, sans recherche, confirme
  focus + repère visuel sur la carte de Marie.
- **Accueil → CTA → retour au sommet de page** : couvert par le correctif transversal
  `afterPaint` (aucun scénario dédié supplémentaire ajouté au-delà des scénarios 1/2/9 déjà
  existants et toujours verts).
- **Messages → retour d'événement, message source non surligné** : scénario 6 existant ne
  vérifiait que le focus — **nouveau scénario 11** vérifie explicitement la classe de repère
  visuel sur le badge d'origine.
- **Agenda, scroll après ouverture depuis "À venir" pas toujours restauré** : scénario 7 existant
  ne vérifiait que le focus/filtre — **nouveau scénario 12** vérifie explicitement la classe de
  repère visuel sur la rangée "À venir" d'origine.
- **La Bande → Vous → Mon profil → fermeture, pas de retour de focus/repère** : **nouveaux
  scénarios 13-15** — c'est en construisant ceux-ci que le bug de harnais de la rubrique A a été
  découvert et corrigé ; une fois corrigé, les 6 assertions passent (ouverture, focus initial,
  piège de focus, Escape, retour de focus, repère visuel, clic sur le fond).
- **pt 20, accompagnateurs — vérifier réellement tap-only** : déjà correct dans le code (§6.2,
  passe antérieure) — **nouveau scénario 18** le prouve avec un `.click()` Playwright qui ne
  déclenche aucun survol préalable.
- **pt 40, Maps — précision réelle insuffisante** : traité via l'arbitrage D2 (voir tableau
  ci-dessus) — adresse réelle vérifiée, 3 niveaux de précision implémentés et testés.
- **pt 43, EventDetail desktop — composition déséquilibrée** : rééquilibrage ciblé (voir tableau
  ci-dessus), pas une redistribution complète de l'écran.
- **pt 18, ne pas déduire automatiquement les prénoms d'enfants depuis La Bande** : confirmé —
  aucune modification du modèle de données n'a été faite dans cette passe, `display_name` reste
  la seule source utilisée pour l'affichage (aucune déduction ajoutée).

## Vérification finale (7e passe — chiffres corrigés en V7.1, voir section dédiée plus bas)

**Les 3 chiffres suivants ont été trouvés FAUX par la contre-vérification indépendante du ZIP
V7 (comptage de l'utilisateur : 120 et non 111 pour les suites Node ; "61" ambigu entre
assertions et scénarios pour Playwright) — corrigés dans la section « 8e passe — V7.1 » plus
bas, qui fait foi. Ce qui suit est laissé pour l'historique du raisonnement de la 7e passe,
PAS comme chiffres définitifs.**

- **12 suites Node (`scripts/test-*.mjs`)** : ~~111~~ assertions (nombre erroné — voir V7.1),
  0 échec (dont 3 nouvelles suites cette passe : `test-reactions.mjs` 17, `test-maps-url.mjs` 8,
  `test-messages-sort.mjs` 5 — les 9 suites préexistantes, elles, passent toutes sans
  modification, confirmant l'absence de régression sur la recherche/tri/nav-memory/
  section-origin/share-flags/resolve-event déjà couverts).
- **Playwright (Chromium réel, `/tmp/pwtest/recette.mjs`, harnais `test-harness/`)** : ~~61
  assertions~~ (formulation ambiguë — voir V7.1 pour la distinction scénarios/assertions),
  0 échec, 0 exception JavaScript capturée — 34 scénarios préexistants (1 à 9, tous verts,
  confirmant l'absence de régression sur la navigation déjà validée en 5e/6e passe) + de
  nouvelles assertions (scénarios 10 à 20, ci-dessus) couvrant spécifiquement les points
  reclassés et les nouvelles fonctionnalités B/C/D de cette passe — dont le scénario 20, ajouté
  après une précision reçue de l'utilisateur en cours de passe (carte de pièce jointe
  actionnable dans son ensemble, pas seulement les boutons Ouvrir/Télécharger) : clic ET
  activation clavier (Entrée), sur l'icône de Partages ET sur la carte complète d'EventDetail,
  chacun ouvrant réellement une nouvelle page vers le fichier de démonstration (vérifié via
  `page.context().waitForEvent('page')`, pas seulement la présence d'un attribut `href`).
- **`npm run build`** : succès (bundle `index-m33_wXjy.js`, 483.53 kB / 133.81 kB gzip après le
  correctif carte-actionnable ci-dessus — nom et poids exacts changeront à nouveau après tout
  rebuild, y compris celui de V7.1, un hash de contenu Vite n'étant jamais stable d'une build à
  l'autre), `public/demo/autorisation-piscine.pdf` bien copié tel quel dans `dist/demo/`.
- **Hash logo** (`abczed-logo-master.png`, SHA-256) : `b8bb3feb26c68cee22f7f41292c5cff8bb7cd564e0ccea4744c00f7a879c85af` — identique entre `public/` et `dist/`, fichier non modifié cette passe.
- **Hashes SQL** (SHA-256, `sql/01`-`04` + `legacy/schema_INSECURE_OLD_DO_NOT_RUN.sql`), tous à
  la date de modification du 11 septembre (avant cette passe — aucun de ces fichiers n'a été
  ouvert en écriture cette passe) :
  - `01_schema_and_helpers.sql` : `9576fb48e2b61e613c659c88f574f7a5d62052971ecf204b3a2b1edbac65ebc7`
  - `02_rls.sql` : `0d40e9803f11424cbcecfeaf5c8263c690e56c760d1cb65c840affb32b93306c`
  - `03_storage.sql` : `bf8d24dcdde1ce559681b290a95560aeec4207896afa79963b73763c3e5e50b9`
  - `04_rsvp_headcount.sql` (non exécuté, hash pour traçabilité uniquement) : `3ea9863548bb66523dc2cb02c6d3b84a4731fc46c9475739431b941a4f9c7722`
  - `legacy/schema_INSECURE_OLD_DO_NOT_RUN.sql` : `2b1bb7a24992be32586bab937032ff541e3549dee9a55dec821652095ad0cb76`
- **Flags de source de données** : `BUSINESS_DATA_FROM_SUPABASE = false` et
  `AGENDA_FROM_SUPABASE = true` dans `src/App.jsx` — vérifiés inchangés (non touchés cette
  passe).
- **Aucun secret dans le build** : recherche de motifs (`service_role`, `sk-`, clés privées PEM)
  dans `dist/` → aucune occurrence.
- **Correctif de packaging ZIP** : l'exclusion précédente (`.env.*`) excluait par erreur
  `.env.example`/`.env.test.example` (qui ne contiennent aucun secret, seulement des
  placeholders) du ZIP livré. Le ZIP de cette passe exclut uniquement `node_modules/`, `dist/`,
  `.git/`, `test-harness/`, `vite.harness.config.js`, et les vrais fichiers `.env`/`.env.local`/
  `.env.test` (aucun présent dans ce dépôt) — `.env.example` et `.env.test.example` sont bien
  inclus. **[Revu en V7.1, voir plus bas : `test-harness/` et `vite.harness.config.js` sont
  maintenant INCLUS, pas exclus.]**

## Limites connues, honnêtement signalées

- **Hypothèse `afterPaint`** : plausible et implémentée transversalement comme demandé, mais pas
  démontrée par une reproduction du symptôme original (le harnais headless, rapide et "chaud",
  n'a jamais exposé le défaut lui-même — voir rubrique A). À confirmer par un retour d'usage réel
  sur cette version.
- **Survol desktop Agenda (pts 7-9)** : implémenté et gardé par `(hover:hover) and
  (pointer:fine)`, relu attentivement, mais **aucun scénario Playwright dédié** n'a été ajouté
  pour l'interaction elle-même — le jeu de données de démonstration a des événements datés en
  mai 2025 alors que le calendrier s'ouvre par défaut sur le mois courant réel, rendant un test
  fiable de la correspondance ligne survolée ↔ cellule du calendrier plus complexe qu'une
  navigation de mois supplémentaire ne le justifiait dans le budget de cette passe. À vérifier
  manuellement ou dans une passe de suivi si souhaité.
- **EventDetail desktop, rééquilibrage (pt 43)** : changement de structure relu attentivement
  (classe `.single` quand la colonne gauche est vide), mais non vérifié par une capture d'écran
  ni un scénario Playwright à largeur ≥1024px.
- **Photo album (partage "Photos sortie zoo")** : reste volontairement SANS bouton "Ouvrir"
  fonctionnel — aucune image de démonstration réelle n'existe pour ce partage (seul un nombre de
  photos est stocké), et fabriquer une fausse photo présentée comme "une des 12 photos réelles"
  aurait été trompeur. Le bouton reste désactivé avec un motif explicite et honnête plutôt que
  le message générique désormais faux pour les autres cas de l'écran.
- **Coordonnées lat/lng (niveau 1 de précision Maps)** : aucun événement de démonstration n'en
  a — fabriquer des coordonnées non vérifiées pour un lieu réel (risque d'épingle FAUSSE) a été
  jugé pire que leur absence. Ce niveau n'est prouvé que par les tests unitaires (coordonnées de
  test explicitement fictives), pas par une donnée réelle en usage. Voir le commentaire de
  `src/mapsUrl.js` pour le détail de ce choix.
- **Recette mobile/tablette réelle sur appareil physique** : toujours non réalisée dans cet
  environnement (limite déjà signalée en 5e/6e passe, inchangée) — seule l'émulation de
  viewport/`prefers-reduced-motion` via Chromium a pu être vérifiée.

# 8e passe — V7.1 : correctif consolidé suite à contre-vérification indépendante du ZIP V7

## Contexte

L'utilisateur a contre-vérifié le ZIP V7 lui-même (pas seulement mon compte rendu) et a trouvé,
avec précision (fichiers/lignes, reproductions concrètes) :

1. Mon compte total de tests Node était FAUX : 111 annoncé, 120 en réalité (18+6+22+5+8+5+9+
   17+7+10+9+4) — simple erreur arithmétique de ma part, confirmée en recomptant.
2. Mon "61 Playwright" désignait des *assertions*, pas des *scénarios* — formulation ambiguë —
   et comme `test-harness/` était exclu du ZIP, ce chiffre n'était pas vérifiable
   indépendamment par l'utilisateur.
3. Un vrai bug fonctionnel : `joinEvent`/`leaveEvent`/`modifyParticipation` (alors
   `App.jsx:230-287`) cherchaient l'événement UNIQUEMENT dans `events` (agenda Supabase réel),
   jamais via le repli `resolveEventById(events, MOCK_EVENTS, id)` que `selectedEvent`/
   `filteredEvent` utilisent déjà pour l'affichage. Concrètement : ouvrir `evt-piscine` (donnée
   mock, absente de l'agenda réel) depuis Messages/Partages affichait la fiche et le bouton "Je
   peux accompagner", mais cliquer ne faisait RIEN — `event` valait `undefined`, retour
   silencieux, bouton d'apparence morte.
4. Un vrai bug d'accessibilité clavier : dans `EventDetail.jsx`/`Messages.jsx`, le `onKeyDown`
   de la carte de pièce jointe entière (`attachmentCardA11y.js:22-26`) interceptait aussi les
   touches remontant par bubbling depuis les liens Ouvrir/Télécharger IMBRIQUÉS À L'INTÉRIEUR —
   Entrée sur "Télécharger" pouvait donc être capturée par la carte (`window.open()`, sans
   sémantique de téléchargement) au lieu de laisser le lien natif agir. Le scénario Playwright
   20 de la 7e passe ne testait Entrée QUE sur la carte elle-même, jamais sur un lien interne :
   c'est précisément ce qui a laissé passer ce bug.
5. Un vrai bug de date spécifique à La Réunion (UTC+4) : plusieurs endroits utilisaient
   `new Date().toISOString().slice(0, 10)` (`data.js:86`, `App.jsx:305`/`414`, `dateSearch.js`,
   `Messages.jsx`), qui renvoie la date calendaire UTC. Entre 00h00 et 03h59 heure locale de La
   Réunion, l'heure UTC correspondante est encore la VEILLE — repro citée : 14/09/2026 00:30
   +04 → `2026-09-13` au lieu de `2026-09-14`. Pouvait fausser "Aujourd'hui/Hier", la date d'un
   nouveau message/partage, et la recherche par date.
6. Une contradiction documentaire non signalée : la matrice affirmait encore (§21, point 7 de
   la rubrique D) que Mon profil ne doit JAMAIS se fermer par clic en dehors, alors que la 7e
   passe fait explicitement le contraire pour les 5 modales (`useModalA11y.js`) sans jamais
   revenir corriger ces deux passages.

L'utilisateur a confirmé comme corrects (aucune action requise) : le PDF de démonstration réel,
`.env.example`/`.env.test.example` sans secret, les flags, tous les hashes logo/SQL (calculés
indépendamment, identiques aux miens), et l'adresse de la sortie piscine (vérifiée via une
source publique). Il a aussi signalé, sans que ce soit un reproche, ne pas avoir pu reproduire
`npm run build` de son côté (dépendances absentes du ZIP, installation ayant expiré) — gap
reconnu de sa propre vérification, pas une régression trouvée.

Instruction reçue : une seule passe V7.1 consolidée, limitée aux 3 défauts fonctionnels
ci-dessus (points 3/4/5) + nettoyage de la matrice — pas de nouvelle refonte.

## Correctifs appliqués

| # | Défaut | Avant | Après | Fichier(s) | Test | Résultat |
|---|---|---|---|---|---|---|
| 1 | RSVP sur un événement résolu seulement via le repli mock | `events.find((e) => e.id === selectedEventId)` dans les 3 fonctions RSVP — `undefined` pour un événement mock-only, retour silencieux | `resolveSelectedEvent()` (même repli que `selectedEvent`) + `isLiveEvent(id)` : si l'événement résolu n'existe QUE via le mock, message honnête (`MOCK_FALLBACK_RSVP_MESSAGE`) au lieu d'un no-op ou d'une écriture Supabase promise à l'échec (clé étrangère inexistante) | `src/App.jsx` | Nouveau scénario Playwright **22** (ouvre `evt-piscine` via Partages, clique "Je peux accompagner", vérifie le message honnête) — **vérifié discriminant** : remis délibérément l'ancien code en place, le scénario 22b échoue bien ; remis le correctif, il repasse au vert | OK |
| 2 | Interception clavier des liens internes par la carte de pièce jointe | `onKeyDown` du conteneur réagissait à tout keydown bubbling, y compris depuis les `<a>` Ouvrir/Télécharger imbriqués | Garde `if (e.target !== e.currentTarget) return;` en tête du `onKeyDown` — la carte ne réagit au clavier que si LE FOCUS EST SUR ELLE, jamais sur un descendant interactif (`onClick` inchangé : `ActionButton` stoppe déjà sa propagation au clic, et le garde y casserait le clic-n'importe-où-sur-la-carte, exigence D1) | `src/attachmentCardA11y.js` | Nouveau scénario Playwright **21**, sur EventDetail (pas Partages : là, Ouvrir/Télécharger sont voisins de la zone actionnable, jamais imbriqués dedans — le bug ne peut se reproduire que dans EventDetail/Messages) : focus sur "Télécharger", Entrée, vérifie un vrai évènement `download` ET que `window.open` n'a jamais été appelé (monkeypatch direct, pas seulement l'absence d'un nouvel onglet) — **vérifié discriminant** de la même façon | OK |
| 3 | Date calendaire UTC au lieu de locale (bug Réunion) | `new Date().toISOString().slice(0, 10)` à 5 endroits (`data.js`, `App.jsx` ×2, `dateSearch.js`, `Messages.jsx`) | Nouveau module unique `src/localDate.js` (`localIso(date)`, accesseurs locaux `getFullYear/getMonth/getDate`) — remplace les 5 occurrences, point d'entrée unique pour un futur correctif | `src/localDate.js`, `src/data.js`, `src/App.jsx`, `src/dateSearch.js`, `src/pages/Messages.jsx` | Nouvelle suite `scripts/test-local-date.mjs` (4 assertions) — relance un **sous-processus Node avec `TZ=Indian/Reunion` réel** (pas une simulation de la logique locale) sur l'instant UTC exact de la repro utilisateur (13/09/2026 20:30 UTC = 14/09/2026 00:30 Réunion) : `localIso` renvoie bien `2026-09-14`, le même instant lu en UTC reste `2026-09-13` (le test discrimine vraiment le fuseau, pas une valeur figée) | OK |

## Nettoyage de la matrice

- **Comptage Node corrigé** : 111 → **120** assertions sur les 12 suites préexistantes
  (recompté par script, chiffre qui correspond exactement au calcul indépendant de
  l'utilisateur), + **4** nouvelles (`test-local-date.mjs`) = **124** au total sur 13 suites —
  voir "Vérification finale — V7.1" ci-dessous pour le détail par fichier.
- **Terminologie Playwright précisée** : "assertions" et "scénarios" ne sont plus mélangés — le
  total est maintenant donné sous la forme explicite "N scénarios / M assertions" partout où il
  apparaît dans cette section.
- **`test-harness/` et `vite.harness.config.js` INCLUS dans le ZIP V7.1** (revirement par
  rapport aux passes précédentes, où ils étaient délibérément exclus) : le script de recette
  (`test-harness/recette.mjs`) est maintenant lisible et auditable ligne par ligne par
  l'utilisateur, pas seulement rapporté. Honnêteté sur la limite qui reste : les exécuter
  réellement nécessite d'installer `playwright` (`npm install -D playwright` puis
  `npx playwright install chromium`) — ni l'un ni l'autre n'est une dépendance du `package.json`
  du projet lui-même (choix délibéré, pour ne pas alourdir les dépendances de production avec
  un outil de test) — et cette installation suppose un accès réseau, exactement la même classe
  de limite que celle déjà rencontrée par l'utilisateur pour `npm run build`. Le gain de cette
  passe est l'AUDITABILITÉ du code de test (plus de résultats "à la confiance"), pas une
  promesse de reproduction en une commande sans aucune installation.
- **§21 / point 7 (Mon profil, fermeture par clic extérieur)** : les deux passages marqués
  **[SUPERSEDÉ en 7e passe]** avec renvoi explicite vers `useModalA11y.js` et les scénarios
  Playwright 13-15 — l'ancienne règle ("ne se ferme jamais par clic en dehors") n'est plus
  présentée comme toujours valide sans qualification.
- **Point 13 / §22 (bandeau démo conditionné à `DEMO_MODE`/`import.meta.env.DEV`)** — la
  "consigne de build" imprécise repérée par l'utilisateur : marquée **[SUPERSEDÉ en 4e passe]**
  aux 3 endroits où elle apparaissait encore comme description du code actuel (point 13, et les
  2 entrées "fichiers touchés" de la 3e passe) — `DEMO_MODE`/`src/config.js` sont supprimés du
  code depuis la 4e passe, remplacés par une dépendance à `BUSINESS_DATA_FROM_SUPABASE` (la
  source de données réelle), jamais au mode de build.

## Vérification finale — V7.1 (chiffres qui font foi)

- **13 suites Node (`scripts/test-*.mjs`)** : **124 assertions, 0 échec** — détail exact par
  fichier : `test-agenda-search.mjs` 18, `test-agenda-selection.mjs` 6, `test-date-search.mjs`
  22, `test-deep-link-visibility.mjs` 5, `test-local-date.mjs` 4 (**nouveau cette passe**),
  `test-maps-url.mjs` 8, `test-messages-sort.mjs` 5, `test-nav-memory.mjs` 9,
  `test-reactions.mjs` 17, `test-resolve-event.mjs` 7, `test-search-utils.mjs` 10,
  `test-section-origin.mjs` 9, `test-share-flags.mjs` 4. Total = 18+6+22+5+4+8+5+9+17+7+10+9+4
  = **124**.
- **Playwright (Chromium réel, `test-harness/recette.mjs`, harnais `test-harness/` — voir
  nettoyage ci-dessus pour son inclusion dans le ZIP)** : **23 scénarios, 69 assertions, 0
  échec, 0 exception JavaScript capturée** — les 20 scénarios de la 7e passe (inchangés, tous
  toujours verts, confirmant l'absence de régression) + les **3 nouveaux scénarios 21, 22 et
  23** de cette passe (voir tableau des correctifs, et la rubrique "Contre-vérification par une
  2e IA" ci-dessous pour le scénario 23), chacun vérifié discriminant en réintroduisant
  temporairement le bug (ou, pour le 23, un défaut équivalent) correspondant et en confirmant
  que le scénario échoue alors bel et bien, avant de restaurer le correctif.
  Pour rejouer cette recette : `npx vite --config vite.harness.config.js` dans un terminal, puis
  `node test-harness/recette.mjs` dans un autre (nécessite `playwright` installé, voir
  nettoyage ci-dessus).
- **`npm run build`** : succès, `dist/demo/autorisation-piscine.pdf` bien copié tel quel.
- **Hash logo** : `b8bb3feb26c68cee22f7f41292c5cff8bb7cd564e0ccea4744c00f7a879c85af` —
  identique entre `public/` et `dist/`, identique aux passes précédentes, fichier non modifié.
- **Hashes SQL** : les 5 fichiers (`sql/01-04` + `legacy/schema_INSECURE_OLD_DO_NOT_RUN.sql`)
  ont exactement les mêmes empreintes SHA-256 que celles listées plus haut (aucun n'a été
  ouvert en écriture cette passe).
- **Flags** : `BUSINESS_DATA_FROM_SUPABASE = false` et `AGENDA_FROM_SUPABASE = true` dans
  `src/App.jsx` — inchangés.
- **Aucun secret dans `dist/`** : recherche de motifs (`service_role`, `sk-`, clés privées PEM)
  → aucune occurrence.
- **ZIP** : exclut `node_modules/`, `dist/`, `.git/`, et les vrais fichiers `.env`/`.env.local`/
  `.env.test` (aucun présent dans ce dépôt) ; inclut `.env.example`, `.env.test.example`,
  **`test-harness/` et `vite.harness.config.js`** (revirement signalé ci-dessus).

## Contre-vérification par une 2e IA (ChatGPT) sur le ZIP V7.1

Après livraison du ZIP V7.1 ci-dessus, une 2e vérification indépendante (ChatGPT, sur le ZIP
livré) a confirmé : les 3 correctifs présents, 124/124 Node, hashes logo/SQL corrects, ZIP
intègre, contradictions de matrice marquées supplantées. Deux réserves, toutes deux justes :

1. **Playwright et le build non reproductibles dans SON environnement** (Playwright et les
   dépendances Vite n'y sont pas installés) — limite déjà signalée explicitement dans ce
   document (voir "Nettoyage de la matrice" ci-dessus) : le harnais est livré et auditable,
   mais l'exécuter demande une installation que tous les environnements ne permettent pas.
   Aucune action nouvelle : cette limite était déjà honnêtement posée, pas découverte.
2. **Le scénario RSVP (22) ne prouvait qu'un cas mock-only, pas qu'une inscription sur un
   événement RÉELLEMENT présent dans l'agenda continue de fonctionner** — celle-ci est une
   lacune réelle, déjà anticipée dans la section "Limites connues" de la livraison précédente
   ("le scénario Playwright 22 ... ne vérifie pas l'inverse"), mais laissée non comblée.
   Comblée maintenant : `test-harness/mockAgendaApi.js` (fichier de test, jamais livré en
   production) est passé d'un ensemble de no-op à un état mutable en mémoire
   (`join`/`leave`/`modifyParticipation` mutent réellement la liste de participants d'un
   événement), pour qu'un test puisse vérifier une inscription de bout en bout plutôt qu'une
   simple absence d'erreur. Nouveau **scénario 23** : sur `evt-zoo` (réellement présent dans
   l'agenda "live" du harnais, à la différence d'`evt-piscine`), clique "Je peux accompagner"
   → vérifie l'absence du message de repli mock ET l'apparition réelle de "Me retirer" (preuve
   que la branche `isLiveEvent` reste vraie pour un vrai événement et que l'inscription est
   effectivement prise en compte) → clique "Me retirer" → vérifie le retour à l'état initial.
   Vérifié discriminant : en forçant temporairement `isLiveEvent` à toujours renvoyer `false`
   (simulant une régression du correctif qui bloquerait aussi les vrais événements), les
   assertions 23b et 23d échouent bien ; correctif restauré, elles repassent au vert.
   Cela ne prouve toujours pas une inscription contre un VRAI projet Supabase (hors de portée
   sans identifiants de test réels) — seulement que la logique de branchement mock/live dans
   `App.jsx` ne casse pas le chemin live, ce qui est précisément ce que ce correctif touchait.

Chiffres finaux (remplacent ceux donnés plus haut) : **124 assertions Node (13 suites)**,
**69 assertions Playwright (23 scénarios)**. Build/hashes/flags/secrets revérifiés après ce
changement — `mockAgendaApi.js`/`recette.mjs` sont des fichiers de test (`test-harness/`),
aucun fichier de production (`src/`, `dist/`) n'a été retouché pour cette réponse, donc le
bundle et les hashes sont identiques à ceux déjà donnés ci-dessus.

## Limites connues, honnêtement signalées — additions V7.1

- Les corrections des points 3/4/5 sont ciblées sur les 5 emplacements `.toISOString()`
  effectivement trouvés par grep dans `src/` à la date de cette passe. Si un nouvel appel à
  `new Date().toISOString().slice(0, 10)` (ou équivalent UTC) est ajouté ailleurs dans une passe
  future, il réintroduira le même bug — `src/localDate.js` centralise le correctif mais ne
  l'impose pas structurellement (aucun lint/règle automatique ne bloque un nouvel appel direct à
  `.toISOString()` dans le reste du code).
- Le scénario Playwright 22 vérifie que le message honnête apparaît ; il ne vérifie pas
  l'inverse (qu'un événement réellement présent dans l'agenda Supabase continue de s'inscrire
  normalement) au-delà de ce que les scénarios RSVP déjà existants (hors périmètre de cette
  passe, non retouchés) couvraient déjà.

## Lot correctif consolidé — V7.2, après recette réelle de V7.1 sur PC

Contexte : le ZIP `ABCZed_v7.12.zip` reçu pour cette passe a été vérifié byte-identique
(`diff -rq`) au ZIP `ABCZed_v7.1.zip` livré précédemment — aucune modification n'avait été
apportée avant ce nouvel envoi, le point de départ de cette passe est donc exactement V7.1.
Le brief associé rapportait 4 écarts observés en usage réel sur PC (pas en relecture de code),
avec la consigne explicite de ne pas considérer les anciens tests verts comme une preuve
suffisante pour ces 4 points. Chacun est traité ci-dessous avec ses décisions, ses fichiers, et
sa preuve — jamais une simple relecture, sauf mention explicite du contraire.

### Point 1 — Agenda : catégorie implicite d'une date sélectionnée

**Constat** : le 10 septembre 2026, sélectionner une date ne contenant que des événements
"Sorties" laissait le filtre affiché sur "Tous" (rond de sélection bleu neutre, aucun chip mis
en évidence), alors qu'une seule catégorie était réellement présente ce jour-là.

**Décision** : une date sélectionnée dont les événements du filtre "Tous" appartiennent
TOUS à une seule catégorie met cette catégorie en évidence visuellement (chip + rond de
sélection du calendrier teintés de sa couleur) — **sans jamais modifier `filter` lui-même**,
qui reste le choix délibéré de l'utilisateur (préservé au retour, comme demandé). Quand
plusieurs catégories coexistent le même jour, comportement explicite et documenté : **aucune
catégorie n'est mise en avant au détriment d'une autre** (`impliedCategoryOf` renvoie `null`)
— `DayDots` (déjà en place, une pastille par catégorie présente) reste la source de vérité
visuelle pour "quelles catégories sont là ce jour", rien n'est masqué. Si l'utilisateur a déjà
choisi un filtre de catégorie précis, celui-ci reste évidemment prioritaire (aucune ambiguïté à
résoudre dans ce cas).

**Fichiers** : `src/agendaSearch.js` (`impliedCategoryOf`, nouvelle fonction pure), `src/pages/
Agenda.jsx` (`selectionColor` recalculé, `FilterChip` accepte un état `implied` visuellement
distinct de `active`).

**Preuve** : `scripts/test-agenda-selection.mjs`, 4 nouveaux cas (7-10) : catégorie unique →
implicite ; catégories multiples → `null` explicite ; filtre déjà précis → toujours `null` ;
aucun événement → `null`. 16/16 assertions du fichier passent (10 préexistantes + 6 nouvelles,
voir aussi Point 2 ci-dessous pour les 4 supplémentaires liées à `peopleCountOf`/
`familiesCountOf`).

### Point 2 — "Qui vient ?" : identité des personnes d'un foyer inscrit

**Constat confirmé en recette réelle** : inscription/modification/annulation/persistance après
rechargement fonctionnent sur un événement réel Supabase ("Événement test A"). Mais
"Test A1 — 2 adultes · 1 enfant" n'identifie personne.

**Décision** : saisie **volontaire et facultative** des prénoms des personnes du foyer, **jamais
déduite automatiquement** de La Bande (aucune lecture de `children`/`member_children` dans ce
lot). Un champ texte par personne déjà comptée par les steppers Adultes/Enfants — jamais plus,
jamais moins (`resizeNames`). Stockage en JSONB (`{"adults": [...], "children": [...]}` ou
`null`) sur `event_participants.attendee_names`, cohérent avec `events.attachments jsonb`
déjà dans le schéma.

**Migration Supabase — étape restante, NON exécutée par moi** : `sql/05_participant_names.sql`
(nouveau fichier, additif — `alter table ... add column if not exists`, contrainte de forme
JSON, aucune policy/grant/fonction ajoutée, même mécanisme DELETE+INSERT que la migration 04,
pas d'UPDATE). Conformément à la consigne explicite du brief, **je n'ai ni rejoué ni modifié
les scripts 01-03, ni exécuté le 04, ni exécuté ce nouveau 05** — vérifié ci-dessous (hashes
SHA-256 inchangés pour 01-04). **La fonctionnalité "prénoms" n'est donc pas opérationnelle sur
la base réelle tant que ce script n'a pas été appliqué manuellement sur le projet Supabase** —
c'est un prérequis, pas une option.

**Comportement tant que la migration n'est pas appliquée** : `src/agendaApi.js` détecte
l'erreur Postgres "colonne inexistante" (SQLSTATE `42703`, avec repli sur le message d'erreur
si `code` n'est pas fiable) à la fois côté écriture (`insertParticipation` : réessaie
l'inscription/modification SANS les prénoms plutôt que de la faire échouer entièrement) et côté
lecture (`fetchEventsRaw` : un `select` imbriqué avec une colonne inexistante fait échouer
TOUTE la requête chez PostgREST, contrairement à un insert — repli sur un second `select` sans
`attendee_names` pour ne jamais casser le chargement de l'agenda). Dans ce cas, une erreur
dédiée `ATTENDEE_NAMES_UNSUPPORTED` remonte jusqu'à `App.jsx`, qui la traite comme un
**succès partiel honnête** (l'inscription/modification a bien réussi, recharge l'état réel,
affiche un message explicite nommant la migration requise) — jamais comme un échec générique
ni comme une perte de participation (`PARTICIPATION_LOST`/`RESTORED_AFTER_FAILURE` restent
réservés aux vrais échecs de compteurs).

**Fichiers** : `sql/05_participant_names.sql` (nouveau), `src/attendeeNames.js` (nouveau,
fonctions pures), `src/agendaApi.js` (détection + repli défensif double : écriture et
lecture), `src/App.jsx` (`joinEvent`/`modifyParticipation` traitent `ATTENDEE_NAMES_UNSUPPORTED`
comme un succès partiel, `oldCounts` inclut désormais `attendeeNames`), `src/pages/
EventDetail.jsx` (steppers Adultes/Enfants pilotent aussi les champs de prénoms via
`resizeNames`, saisie affichée dans "Qui vient ?" et "Votre participation", jamais de nom
inventé quand aucun n'a été saisi), `src/data.js` (donnée de démonstration honnête : un foyer
avec prénoms saisis, un foyer sans, le reste au format historique "chaîne simple" pour prouver
que ce format legacy continue de s'afficher sans erreur).

**Bug préexistant découvert en creusant ce point, corrigé au passage** : `event.peopleCount`/
`event.familiesCount` ne sont calculés que par `agendaApi.js`, pour de vrais événements
Supabase — un événement "entre familles" affiché via `MOCK_EVENTS` (repli Messages/Partages)
ou via le harnais de test n'a jamais eu ces deux champs, et affichait donc littéralement
**"undefined personne(s) inscrite(s)"** dans "Qui vient ?" (`EventDetail.jsx`) et un badge
"undefined" dans la liste Agenda (`Agenda.jsx`). Corrigé en dérivant ces deux nombres
directement depuis `participants` (`peopleCountOf`/`familiesCountOf`, nouvelles fonctions
pures dans `agendaSearch.js`) plutôt qu'en faisant confiance à des champs parfois absents —
résultat strictement identique pour un événement réellement Supabase (où ces champs existent
toujours), correction uniquement pour les données de démonstration. 6 tests dédiés dans
`scripts/test-agenda-selection.mjs` (cas 11-16, chaînes simples/objets/vide/undefined).

**Preuve — bout en bout, pas seulement en mémoire client** : `scripts/test-attendee-names.mjs`
(13/13, fonctions pures `resizeNames`/`cleanNames`/`buildAttendeeNames`/`attendeeNamesLine`).
Scénario Playwright **24** (nouveau) sur "Pique-nique entre familles" (`evt-piquenique`,
réellement présent dans l'agenda "live" du harnais, mode 'family') : affiche d'abord les
prénoms de démonstration sans interaction (24a-c) ; inscription avec prénoms saisis →
"Votre participation" les affiche (24e) ; **rechargement COMPLET de la page** (`page.reload()`,
pas juste un changement d'écran côté client) → les prénoms persistent (24f) ; modification d'un
prénom → mis à jour, l'ancien a disparu (24g-i) ; **second rechargement complet** → le prénom
modifié persiste aussi (24j) ; désinscription de nettoyage (24k). Pour que ce rechargement soit
un test valide, `test-harness/mockAgendaApi.js` (fichier de test, jamais livré en production)
a dû être corrigé : il tourne dans le NAVIGATEUR (remplace `agendaApi.js` côté client via
l'alias Vite du harnais), donc son état n'existait qu'en mémoire JS — un `page.reload()` le
réinitialisait entièrement (pas seulement les prénoms : toute inscription). `sessionStorage`
simule désormais, honnêtement, ce qu'un vrai backend ferait de toute façon : survivre à un
rechargement — cela ne teste PAS le code Supabase réel de `agendaApi.js` (jamais chargé dans ce
harnais), seulement qu'`App.jsx`/`EventDetail.jsx` redemandent et réaffichent correctement
l'état "serveur" après un rechargement, qui est la partie que ce harnais peut légitimement
vérifier. **Vérifié discriminant** : en forçant temporairement `attendeeNames: null` dans
`confirmFamily()` (EventDetail.jsx), 5 assertions du scénario 24 échouent bien (24e, 24f, 24g,
24h, 24j) ; correctif restauré, 80/80 repassent au vert.

**Non vérifié — signalé explicitement, comme demandé** : le chemin défensif spécifique à
Supabase dans `agendaApi.js` (détection SQLSTATE `42703`, double repli écriture/lecture,
`ATTENDEE_NAMES_UNSUPPORTED`) est vérifié par **relecture de code uniquement**, pas exécuté
contre un vrai Postgres/PostgREST dans cet environnement — il n'y a ni projet Supabase réel
accessible ici, ni mock du client `supabase-js` construit pour ce lot (`test-harness/
mockAgendaApi.js` remplace entièrement `agendaApi.js`, il ne l'exécute jamais). **Donc : je ne
marque PAS "qui vient" comme opérationnel sur la base réelle avant application de la migration
05, et je ne peux pas certifier indépendamment le comportement exact de ce repli tant que la
migration n'a pas été testée en conditions réelles (avant ET après son application) sur le
projet Supabase.** Ce que je peux certifier : le comportement une fois la colonne disponible
(scénario 24, migration "déjà appliquée" simulée par le harnais) fonctionne de bout en bout, y
compris après rechargement complet.

### Point 3 — Messages : texte de confidentialité trompeur

**Constat** : "Les messages sont visibles uniquement par les membres du groupe" contredisait le
bandeau d'avertissement déjà présent en tête d'application (Messages/Partages/La Bande =
données de démonstration identiques pour toutes les communautés tant que
`BUSINESS_DATA_FROM_SUPABASE` vaut `false`).

**Décision** : reformulation conditionnée par ce même drapeau — tant qu'il vaut `false`, le
bandeau de Messages décrit honnêtement l'état réel ("Messages de démonstration — identiques
pour toutes les communautés... Aucune restriction de visibilité réelle n'est appliquée pour
l'instant"), sans rien promettre qui ne soit pas vrai aujourd'hui. Le texte d'origine reste
utilisé le jour où ce drapeau passera réellement à `true` (l'affirmation deviendra alors
exacte). **Vérifié ailleurs** : recherche de formulations équivalentes ("visible uniquement",
"confidentiel", "sécurisé", "privé", "réservé") dans tout `src/pages/` — aucune autre occurrence
d'une promesse de confidentialité/synchronisation non implémentée trouvée.

**Fichiers** : `src/dataSourceFlags.js` (nouveau — `BUSINESS_DATA_FROM_SUPABASE`/
`AGENDA_FROM_SUPABASE` déplacés hors d'`App.jsx` pour que `Messages.jsx` puisse les lire sans
créer d'import circulaire ; mêmes valeurs, aucun changement de comportement), `src/App.jsx`
(importe désormais ces deux drapeaux au lieu de les déclarer), `src/pages/Messages.jsx`
(bandeau conditionné par le drapeau).

**Preuve** : scénario Playwright **25** (nouveau) — l'ancien texte n'apparaît plus (25a), le
nouveau texte honnête est bien affiché (25b), cohérent avec le bandeau d'avertissement déjà
présent en tête d'application (25c). 3/3.

### Point 4 — Couleurs : règle transversale

**Audit mené sur** : Accueil, Agenda, EventDetail, Messages, Partages, La Bande (recherche de
toutes les couleurs codées en dur `#RRGGBB` hors `theme.js`, puis vérification manuelle du sens
de chaque usage de BLUE/RED/couleurs de catégorie sur chacun de ces écrans).

**Règle retenue** (documentée ici, à respecter pour toute future modification) :
- **Catégories** (Agenda, pastilles, badges, teintes de fond) : toujours `CATEGORIES[clé]`
  depuis `theme.js` (`color`/`tint`), jamais codées en dur. Sur `EventDetail.jsx`, cette couleur
  imprègne aussi l'accent visuel de la fiche entière (badge date, lieu, **action principale**
  du bloc RSVP) — décision de design déjà en place et conservée : une fiche événement reste
  visuellement "sienne", cohérente avec son propre en-tête, c'est l'identité visuelle ABCZed à
  préserver, pas une incohérence à corriger.
- **Action secondaire** (modifier/éditer, alternative non destructive) : **BLUE**, sans
  exception, y compris sur les écrans teintés par catégorie. **Incohérence trouvée et
  corrigée** : le bouton "Modifier" de la participation famille (`EventDetail.jsx`) utilisait la
  couleur de CATÉGORIE au lieu de BLUE — différent du bouton "Modifier" de Partages.jsx, qui
  utilise déjà BLUE pour la même action sémantique. Uniformisé sur BLUE.
- **Annulation / suppression** : **RED**, toujours importé depuis `theme.js` (jamais codé en
  dur), réservé aux actions qui annulent une participation ou suppriment une donnée.
  **Incohérences trouvées et corrigées** : (a) `MyProfileSheet.jsx` utilisait RED (`#E53935`
  codé en dur, sans même importer le token) pour "Se déconnecter" — qui n'annule ni ne supprime
  rien, une action neutre de navigation ; un bouton aussi visible en RED aurait laissé croire à
  une action destructrice qu'elle n'est pas. Recoloré en style neutre (bordure/texte gris,
  cohérent avec `CARD_BORDER`/`MUTED` déjà utilisés dans cette même modale). (b)
  `Partages.jsx` (bouton "Supprimer") utilisait le même hex codé en dur au lieu d'importer
  `RED` — l'action elle-même était déjà correcte (suppression = destructif = RED), seule la
  source de la couleur a été corrigée (import du token partagé, pas de hex dupliqué).
- **États sélectionnés** : `BLUE` par défaut (neutre — onglet actif de la navigation du bas,
  déjà cohérent), ou la couleur de catégorie quand la sélection est explicitement liée à une
  catégorie (chip de filtre actif/implicite, rond de sélection du calendrier — déjà rendu
  cohérent par le Point 1 de ce même lot).
- **Cas revu et volontairement laissé tel quel** : la carte éditoriale "Le p'tit billet" sur
  Accueil utilise RED comme accent de marque pur (bordure gauche + titre), au même titre que le
  logo lui-même ("De A" en bleu, "à Zed" en rouge, `Login.jsx`) — ce n'est ni un bouton, ni une
  action, ni un indicateur d'état : aucune ambiguïté pratique avec "annulation" puisqu'il n'y a
  rien à cliquer ni annuler à cet endroit. Signalé ici explicitement pour que ce jugement soit
  visible et révisable, plutôt que silencieusement ignoré pendant l'audit.

**Fichiers** : `src/pages/EventDetail.jsx` ("Modifier" → BLUE), `src/components/
MyProfileSheet.jsx` ("Se déconnecter" → neutre, plus d'import de hex codé en dur), `src/pages/
Partages.jsx` (import du token `RED` au lieu du hex dupliqué).

**Preuve** : scénario Playwright **26** (nouveau) — couleur calculée (`getComputedStyle`) du
bouton "Se déconnecter" ≠ `rgb(229, 57, 53)` (RED) (26a) ; couleur du bouton "Modifier" (famille)
= `rgb(13, 71, 161)` (BLUE), pas `rgb(22, 155, 104)` (vert de la catégorie Sorties) (26b).
**Vérifié discriminant** pour 26b : en remettant temporairement `cat.color` sur ce bouton,
l'assertion échoue bien avec la couleur verte observée ; correctif restauré, repasse au vert.
**Vérification largeur d'écran** : captures d'écran Playwright à 390px (mobile), 800px
(tablette, seuil `index.html` ligne 31) et 1280px (bureau, seuil ligne 32) sur "Mon profil",
"Pique-nique entre familles" (bloc RSVP) et le bandeau Messages — rendu correct aux trois
largeurs, aucune régression de mise en page liée aux changements de couleur (revue visuelle
manuelle des captures, pas un test automatisé — signalé comme tel).

### Fichiers touchés — liste précise (V7.2)

Obtenue par comparaison directe (`diff -rq`) entre le ZIP `ABCZed_v7.12.zip` reçu et l'arbre de
travail final de ce lot, hors `node_modules/`/`dist/`/`package-lock.json`.

**Modifiés (12)** : `src/App.jsx`, `src/agendaApi.js`, `src/agendaSearch.js`, `src/data.js`,
`src/pages/Agenda.jsx`, `src/pages/EventDetail.jsx`, `src/pages/Messages.jsx`, `src/pages/
Partages.jsx`, `src/components/MyProfileSheet.jsx`, `scripts/test-agenda-selection.mjs`,
`test-harness/mockAgendaApi.js`, `test-harness/recette.mjs`.

**Nouveaux (4)** : `sql/05_participant_names.sql`, `src/attendeeNames.js`, `src/
dataSourceFlags.js`, `scripts/test-attendee-names.mjs`.

**Aucun autre fichier touché** — en particulier `sql/01_schema_and_helpers.sql`,
`sql/02_rls.sql`, `sql/03_storage.sql`, `sql/04_rsvp_headcount.sql` et
`legacy/schema_INSECURE_OLD_DO_NOT_RUN.sql` sont restés à l'identique (aucun n'a été ouvert en
écriture cette passe — vérifié par hash SHA-256 ci-dessous), conformément à la consigne
explicite du brief : "Ne modifie ni ne rejoue les scripts SQL 01-03 ; n'exécute pas 04 ni une
nouvelle migration." **Aucun script SQL, y compris le nouveau 05, n'a été exécuté contre une
base de données par moi — uniquement rédigé comme fichier source, à appliquer par toi.**

### Étapes Supabase restantes (à faire par toi, pas par moi)

1. Appliquer `sql/05_participant_names.sql` sur le projet Supabase réel (via le SQL editor du
   dashboard, comme les migrations précédentes).
2. Vérifier après application que `event_participants.attendee_names` existe bien et que la
   contrainte `event_participants_attendee_names_shape` est active.
3. Tant que cette étape n'est pas faite, l'inscription/modification continue de fonctionner
   normalement (compteurs adultes/enfants) mais tout prénom saisi ne sera PAS enregistré — un
   message explicite en informe l'utilisateur à chaque tentative, sans perte silencieuse.

### Vérification finale — V7.2 (chiffres qui font foi)

- **Node (`node scripts/test-*.mjs`)** : **14 suites, 147 assertions, 0 échec.** Détail par
  fichier : `test-agenda-search.mjs` 18, `test-agenda-selection.mjs` 16 (10 préexistantes + 6
  nouvelles, Point 1/2), `test-attendee-names.mjs` 13 (**nouveau**, Point 2),
  `test-date-search.mjs` 22, `test-deep-link-visibility.mjs` 5, `test-local-date.mjs` 4,
  `test-maps-url.mjs` 8, `test-messages-sort.mjs` 5, `test-nav-memory.mjs` 9,
  `test-reactions.mjs` 17, `test-resolve-event.mjs` 7, `test-search-utils.mjs` 10,
  `test-section-origin.mjs` 9, `test-share-flags.mjs` 4.
  Total = 18+16+13+22+5+4+8+5+9+17+7+10+9+4 = **147**.
- **Playwright (`test-harness/recette.mjs`)** : **26 scénarios, 85 assertions, 0 échec, 0
  exception JavaScript capturée** — les 23 scénarios précédents (inchangés, tous toujours
  verts, confirmant l'absence de régression malgré les changements dans `EventDetail.jsx`/
  `Agenda.jsx`/`Messages.jsx`/`MyProfileSheet.jsx`/`Partages.jsx`) + les **3 nouveaux scénarios
  24, 25 et 26** de ce lot, chacun vérifié discriminant en réintroduisant temporairement le
  défaut correspondant et en confirmant que le scénario échoue bien, avant de restaurer le
  correctif (détail dans chaque section Point ci-dessus).
  Pour rejouer : `npx vite --config vite.harness.config.js` dans un terminal, puis
  `node test-harness/recette.mjs` dans un autre (`playwright` doit être installé — pas dans les
  dépendances du projet, volontairement, pour ne pas alourdir le bundle de production ;
  `npm install --no-save playwright` avant de lancer si besoin).
- **`npm run build`** : succès (`dist/demo/autorisation-piscine.pdf` bien copié tel quel,
  aucune erreur ni avertissement bloquant).
- **Hash logo** : `b8bb3feb26c68cee22f7f41292c5cff8bb7cd564e0ccea4744c00f7a879c85af` —
  identique à toutes les passes précédentes, fichier non modifié.
- **Hashes SQL 01-04 + legacy** : identiques aux passes précédentes (`01`
  `9576fb48e2b61e613c659c88f574f7a5d62052971ecf204b3a2b1edbac65ebc7`, `02`
  `0d40e9803f11424cbcecfeaf5c8263c690e56c760d1cb65c840affb32b93306c`, `03`
  `bf8d24dcdde1ce559681b290a95560aeec4207896afa79963b73763c3e5e50b9`, `04`
  `3ea9863548bb66523dc2cb02c6d3b84a4731fc46c9475739431b941a4f9c7722`) — aucun n'a été ouvert en
  écriture cette passe. Nouveau `05` : `f04134d9705bddd3c0b1e49fb4cb57f1c1a4dfd1a82750ec6f03d8f533062665`
  (rédigé, pas exécuté).
- **Flags** : `BUSINESS_DATA_FROM_SUPABASE = false` et `AGENDA_FROM_SUPABASE = true` — mêmes
  valeurs, déplacées dans `src/dataSourceFlags.js` (voir Point 3), toujours importées telles
  quelles par `App.jsx`.
- **Aucun secret dans le ZIP** : recherche de motifs (clés `sk-`, `AKIA...`, blocs PEM
  `PRIVATE KEY`, JWT `eyJ...`) sur `src/`, `public/`, `sql/`, `scripts/`, `test-harness/` et
  `dist/` → aucune occurrence. Aucun fichier `.env`/`.env.local`/`.env.test` réel présent
  (seuls `.env.example`/`.env.test.example`, sans valeurs).
- **ZIP** : mêmes exclusions que V7.1 (`node_modules/`, `dist/`, `.git/`, vrais `.env*`),
  mêmes inclusions (`test-harness/`, `vite.harness.config.js`, `.env.example`,
  `.env.test.example`).

### Non vérifié — récapitulatif explicite

- Le repli défensif Supabase de `agendaApi.js` pour les prénoms (détection colonne manquante,
  double repli écriture/lecture) : relecture de code uniquement, jamais exécuté contre un vrai
  Postgres/PostgREST dans cet environnement (voir Point 2 ci-dessus pour le détail).
- Comme pour les passes précédentes : aucune inscription/modification/lecture n'a été exécutée
  contre un vrai projet Supabase (aucun identifiant de test réel disponible dans cet
  environnement) — uniquement contre le harnais de test local (`test-harness/`, jamais livré
  en production) et par relecture directe du code de `src/agendaApi.js`.
- La revue "rendu à largeur mobile/tablette/bureau" du Point 4 est une inspection visuelle de
  captures d'écran, pas une assertion automatisée pixel par pixel.

## Lot correctif — V7.3, après 2e contre-vérification indépendante du ZIP V7.2

Contexte : une 2e contre-vérification indépendante du ZIP `ABCZed_v7.2.zip` a confirmé le ZIP
valide, le diff V7.1→V7.2 correct, les SQL 01-04 et le logo strictement inchangés, aucun secret,
le build réussi, les 147/147 assertions Node, la saisie volontaire des prénoms bien absente de
toute déduction automatique depuis La Bande, le message de confidentialité corrigé, et plusieurs
incohérences de couleur corrigées — et a demandé explicitement de **ne pas installer cette
version ni exécuter le SQL 05** avant 4 corrections. Consigne explicite reçue : je corrige les 4
points moi-même, je livre une version corrigée, l'utilisateur fait ensuite une
contre-vérification ciblée avant de toucher à Supabase — rien à retester manuellement de son
côté pour cette étape. Les 4 points sont traités ci-dessous, chacun avec sa preuve.

### Point 1 — "Aucun participant pour le moment" restait visible pendant la saisie

**Constat confirmé** : le texte de repli (0 participant) restait affiché au-dessus du
formulaire d'inscription "famille" pendant que celui-ci était ouvert, y compris avec un
brouillon déjà rempli (2 adultes / 1 enfant) — contradiction visuelle directe avec ce qui était
en train d'être saisi juste en dessous. La condition de rendu (`participants.length === 0`) ne
tenait pas compte de l'état d'édition.

**Décision** : le texte de repli est désormais masqué tant qu'un formulaire d'inscription ou de
modification est ouvert (`editing`, vrai dans les 3 modes dès qu'un formulaire est affiché),
et ne réapparaît, si toujours pertinent (0 participant), qu'une fois revenu à l'état non-édition
(après confirmation ou abandon du brouillon). `editing` n'est jamais mis à `true` en dehors du
mode 'family' (inscription accompagnement/simple = un seul clic, sans brouillon intermédiaire),
donc ce correctif n'a aucun effet sur ces deux modes — il n'en a pas besoin.

**Fichiers** : `src/pages/EventDetail.jsx` (condition `&& !editing` ajoutée).

**Lacune de couverture corrigée au passage** : aucun événement mode 'family' de la donnée de
démonstration n'avait 0 participant au départ — `evt-piquenique` (seul utilisé jusqu'ici pour ce
mode) a toujours au moins un foyer déjà inscrit (Parent 1), donc la condition fautive n'y était
en réalité jamais vraie au moment d'ouvrir le formulaire : le bug signalé ne pouvait pas être
reproduit ni sa correction prouvée sur les données existantes. Ajout de `evt-gouter-voisins`
("Goûter entre voisins", 8 juin 2025, mode 'family', `participants: []`) à `src/data.js`, dédié
à ce besoin.

**Preuve** : scénario Playwright **27** (nouveau), sur `evt-gouter-voisins` : texte visible avant
toute saisie (27a) ; brouillon amené à 2 adultes / 1 enfant, valeurs vérifiées (27b-c) ; **texte
bien masqué pendant cette saisie** (27d, l'assertion centrale) ; abandon du brouillon (jamais
confirmé, via "Retour") → texte réapparaît normalement, aucune régression sur le cas déjà correct
(27e) ; aucune participation enregistrée par erreur (27f). **Vérifié discriminant** : en retirant
temporairement `&& !editing`, 27d échoue bien (seule cette assertion, les 5 autres restent
vertes) ; correctif restauré, 96/96 repassent au vert.

### Point 2 — Migration SQL insuffisamment robuste

**Constat confirmé** : (a) la vérification d'idempotence de la contrainte
(`select 1 from pg_constraint where conname = '...'`) ne filtrait pas par table — or
`pg_constraint.conname` n'est unique que **par table**, pas dans toute la base ; un homonyme sur
une autre table aurait fait croire la contrainte déjà posée ici et silencieusement sauté son
ajout réel. (b) la contrainte de forme se contentait de `jsonb_typeof(attendee_names) = 'object'`
— acceptait `{"adults": "Léa"}` (chaîne au lieu d'un tableau) ou `{"adults": [1, 2]}` (nombres au
lieu de chaînes) sans jamais les rejeter.

**Décision** : (a) ajout de `and conrelid = 'public.event_participants'::regclass` à la
vérification d'idempotence. (b) contrainte durcie : `attendee_names`, si renseigné, doit être un
objet avec les clés `adults` et `children` **présentes**, toutes deux des **tableaux**, dont tous
les éléments sont des **chaînes**.

**Deux pièges rencontrés en écrivant cette contrainte, corrigés avant livraison (pas après un
échec en production)** :
- Postgres interdit toute sous-requête dans un `check` (`not exists (select ... from
  jsonb_array_elements(...))` → `ERROR: cannot use subquery in check constraint`, reproduit
  directement). Remplacé par `jsonb_path_exists(x, '$[*] ? (@.type() != "string")')`, un simple
  appel de fonction (prédicat JSONPath), pas une sous-requête.
- `jsonb_typeof(attendee_names -> 'adults') = 'array'` s'évalue à **SQL NULL**, pas à `false`,
  quand la clé `adults` est absente de l'objet — et Postgres traite un `check` qui s'évalue à
  NULL comme une ligne **valide**, pas rejetée. Un enchaînement `and` où un seul terme est NULL
  peut donc laisser passer une ligne malformée. Corrigé par des `attendee_names ? 'adults'` /
  `? 'children'` explicites avant les `jsonb_typeof`, qui renvoient toujours un booléen défini.

**Fichiers** : `sql/05_participant_names.sql` (réécrit — toujours **non exécuté par moi** contre
le projet Supabase réel).

**Non corrigé, signalé explicitement** : `sql/04_rsvp_headcount.sql` (contrainte
`event_participants_counts_valid`) a la même lacune de scope `conrelid` — non corrigée dans ce
lot, ce fichier étant déjà livré et vraisemblablement déjà appliqué sur le projet réel ; le
modifier maintenant ne changerait rien à une contrainte déjà posée, et le toucher sans besoin
irait à l'encontre de la consigne "ne modifie ni ne rejoue les scripts SQL 01-04". À corriger
séparément, dans un futur lot, si l'utilisateur le souhaite.

**Preuve — exécution réelle, pas seulement relecture** : ce fichier a été appliqué tel quel
(`psql -f`) contre une base PostgreSQL 16 **locale et jetable**, créée uniquement pour cette
vérification (`abczed_migration_test`, supprimée et service arrêté après usage) — **jamais
contre le projet Supabase réel de l'utilisateur**, conformément à la consigne. Séquence testée :
`sql/04_rsvp_headcount.sql` puis `sql/05_participant_names.sql` appliqués sur une table
`event_participants` minimale reproduisant le schéma réel, ré-application confirmée idempotente
(aucune erreur au 2e passage), puis 3 insertions valides (toutes acceptées) et 6 insertions
délibérément malformées : `{"adults": "Lea", "children": []}` (chaîne au lieu de tableau),
`{"adults": [1,2], "children": []}` (nombres au lieu de chaînes), `{"adults": ["Lea", null],
"children": []}` (élément non-chaîne), `{"adults": ["Lea"]}` (`children` absent), `["Lea","Tom"]`
(tableau nu au lieu d'un objet), `"Lea"` (chaîne nue) — les 6 **rejetées** avec l'erreur de
contrainte attendue. `select count(*)` final = 3, exactement les cas valides. Hash SHA-256 du
fichier livré : `52591dabf7145c81567385ddf42239c01c2a8175615dd422c8e77de7795efe72`.

### Point 3 — Détection d'absence de colonne trop large

**Constat confirmé** : `isUndefinedColumnError` acceptait tout message d'erreur contenant
simplement la sous-chaîne "attendee_names" — or une violation de la contrainte de forme (donnée
malformée envoyée par un bug côté client, ex. `{"adults": "Léa"}`) produit elle aussi un message
Postgres contenant cette sous-chaîne (le nom de la colonne apparaît dans le nom de la contrainte
violée, `event_participants_attendee_names_shape`). Avec l'ancienne détection, cette violation
aurait été prise à tort pour "migration absente", puis réessayée silencieusement sans les
prénoms — la participation aurait été enregistrée en faisant disparaître l'erreur réelle
(donnée malformée) au lieu de la remonter.

**Recherche menée avant d'écrire le correctif (pas une supposition sur le format du message)** :
la référence des codes d'erreur PostgREST (`docs.postgrest.org/en/v12/references/errors.html`)
documente `PGRST204` (HTTP 400) pour une colonne absente du cache de schéma. Le corps d'erreur
JSON exact a été confirmé via un rapport utilisateur Supabase réel (issue GitHub
`supabase/supabase#42183`) : `{"code":"PGRST204","details":null,"hint":null,"message":"Could
not find the '<colonne>' column of '<table>' in the schema cache"}`.

**Décision** : seules deux formes précises sont désormais reconnues comme "colonne absente" :
(1) le SQLSTATE Postgres standard `42703` (renvoyé tel quel si une requête atteint Postgres avec
une colonne inconnue), (2) le code PostgREST `PGRST204` **avec** le message exact "Could not find
the 'attendee_names' column of 'event_participants' in the schema cache" — colonne ET table
nommées explicitement, pas une sous-chaîne isolée. Un `PGRST204` pour une autre colonne ou une
autre table n'est plus avalé silencieusement ici.

**Fichiers** : `src/undefinedColumnError.js` (nouveau — fonction extraite dans son propre module
pur, sans dépendance à `supabaseClient.js`, justement pour la rendre testable en Node comme
`attendeeNames.js`/`agendaSearch.js`), `src/agendaApi.js` (importe désormais cette fonction au
lieu de la définir localement).

**Preuve** : `scripts/test-undefined-column-error.mjs` (nouveau), 14/14 assertions, incluant
explicitement le cas signalé — une violation de contrainte (`code: '23514'`, message contenant
"attendee_names" dans le nom de la contrainte) doit renvoyer `false`, pas `true` (cas 5, 6, 14).
**Vérifié discriminant** : en remettant temporairement l'ancienne détection (simple regex
`/attendee_names/i` sur le message), exactement 3 assertions échouent — les cas 5, 8 et 14, tous
des variantes du faux positif signalé — les 11 autres restent vertes ; correctif restauré,
14/14 repassent au vert.

**Non vérifié, signalé explicitement** : le format exact d'un `PGRST204` ou d'un `42703` réel
n'a pas été observé contre le vrai projet Supabase de l'utilisateur (aucun accès dans cet
environnement) — la détection est construite sur la documentation officielle PostgREST et un
rapport d'erreur réel externe, pas sur une exécution directe contre ce projet précis. Si une
version de PostgREST future change ce format, cette détection cesserait de fonctionner (comme
c'était déjà implicitement le cas avant ce correctif).

### Point 4 — Réserve de vérification : rendu réel de "Tous + catégorie implicite" jamais testé

**Constat confirmé** : seule la fonction pure `impliedCategoryOf` était testée
(`scripts/test-agenda-selection.mjs`) — aucun scénario Playwright n'exerçait le rendu réel dans
`Agenda.jsx` (chip de filtre teinté, rond de sélection du calendrier).

**Obstacle rencontré et résolu** : les boutons de navigation mois précédent/suivant du calendrier
n'avaient ni texte ni `aria-label` (icône seule), rendant impossible un ciblage Playwright stable.
Ajout de `aria-label="Mois précédent"` / `"Mois suivant"` — à la fois nécessaire pour ce test et
amélioration d'accessibilité légitime en soi (un bouton icône-seule sans nom accessible est déjà
un défaut, indépendamment du besoin de test).

**Fichiers** : `src/pages/Agenda.jsx` (aria-label ajoutés, aucun changement de comportement).

**Preuve** : scénario Playwright **28** (nouveau) — filtre "Tous" réaffirmé actif (28a) ;
navigation réelle jusqu'à juin 2025 (nombre de clics "Mois précédent" calculé **dynamiquement**
par rapport à la date réelle du jour, pas une valeur figée qui se déréglerait mois après mois) ;
arrivée confirmée sur "Juin 2025" (28b) ; clic sur le 8 juin (`evt-gouter-voisins`, seul
événement de ce jour, catégorie 'sortie') ; le chip "Sorties" ne devient PAS le filtre actif
(28c, `aria-pressed="false"`) mais porte bien la marque visuelle "catégorie implicite" — `title`
dédié effectivement présent dans le DOM rendu (28d) ; **le rond de sélection du calendrier prend
réellement la couleur verte "Sorties"** (`rgb(22, 155, 104)`), pas le bleu neutre de "Tous"
(28e) — c'est la vérification de rendu qui manquait. **Vérifié discriminant** : en forçant
temporairement `impliedCategory = null` (logique de calcul neutralisée), 28d et 28e échouent bien
(28a-c restent verts, cohérent : le filtre lui-même n'a pas changé) ; correctif restauré, 96/96
repassent au vert.

### Fichiers touchés — ce lot (V7.3)

**Modifiés (5)** : `src/pages/EventDetail.jsx` (Point 1), `src/data.js` (Point 1, ajout
`evt-gouter-voisins`), `sql/05_participant_names.sql` (Point 2, réécrit), `src/agendaApi.js`
(Point 3, `isUndefinedColumnError` externalisée), `src/pages/Agenda.jsx` (Point 4, aria-label de
navigation), `test-harness/recette.mjs` (scénarios 27 et 28).

**Nouveaux (2)** : `src/undefinedColumnError.js` (Point 3), `scripts/test-undefined-column-error.mjs`
(Point 3).

**Aucun autre fichier touché** — en particulier `sql/01_schema_and_helpers.sql`,
`sql/02_rls.sql`, `sql/03_storage.sql`, `sql/04_rsvp_headcount.sql` et
`legacy/schema_INSECURE_OLD_DO_NOT_RUN.sql` restent identiques (hashes SHA-256 vérifiés
ci-dessous, inchangés depuis V7.2). **Aucun script SQL, y compris le 05 réécrit, n'a été exécuté
contre le projet Supabase réel de l'utilisateur** — uniquement contre une base PostgreSQL locale
et jetable, créée et détruite pour cette seule vérification (voir Point 2).

### Vérification finale — V7.3 (chiffres qui font foi)

- **Node (`node scripts/test-*.mjs`)** : **15 suites, 161 assertions, 0 échec** (147 de V7.2 +
  14 nouvelles, `test-undefined-column-error.mjs`). Détail : `test-agenda-search.mjs` 18,
  `test-agenda-selection.mjs` 16, `test-attendee-names.mjs` 13, `test-date-search.mjs` 22,
  `test-deep-link-visibility.mjs` 5, `test-local-date.mjs` 4, `test-maps-url.mjs` 8,
  `test-messages-sort.mjs` 5, `test-nav-memory.mjs` 9, `test-reactions.mjs` 17,
  `test-resolve-event.mjs` 7, `test-search-utils.mjs` 10, `test-section-origin.mjs` 9,
  `test-share-flags.mjs` 4, `test-undefined-column-error.mjs` 14 (**nouveau**).
  Total = 18+16+13+22+5+4+8+5+9+17+7+10+9+4+14 = **161**.
  (`scripts/verify-real-supabase.mjs` reste hors de ce total — nécessite de vraies variables
  d'environnement Supabase absentes de cet environnement, sans rapport avec ce lot.)
- **Playwright (`test-harness/recette.mjs`)** : **28 scénarios, 96 assertions, 0 échec, 0
  exception JavaScript capturée** — les 26 scénarios précédents (inchangés, tous toujours verts,
  confirmant l'absence de régression) + les **2 nouveaux scénarios 27 et 28** de ce lot, chacun
  vérifié discriminant (détail dans chaque section Point ci-dessus). Rejeu identique aux passes
  précédentes : `npx vite --config vite.harness.config.js`, puis `node test-harness/recette.mjs`.
- **`npm run build`** : succès, aucune erreur ni avertissement bloquant.
- **Hash logo** : `b8bb3feb26c68cee22f7f41292c5cff8bb7cd564e0ccea4744c00f7a879c85af` — identique
  à toutes les passes précédentes.
- **Hashes SQL 01-04** : identiques à toutes les passes précédentes — `01`
  `9576fb48e2b61e613c659c88f574f7a5d62052971ecf204b3a2b1edbac65ebc7`, `02`
  `0d40e9803f11424cbcecfeaf5c8263c690e56c760d1cb65c840affb32b93306c`, `03`
  `bf8d24dcdde1ce559681b290a95560aeec4207896afa79963b73763c3e5e50b9`, `04`
  `3ea9863548bb66523dc2cb02c6d3b84a4731fc46c9475739431b941a4f9c7722` — aucun n'a été ouvert en
  écriture ce lot. `05` (réécrit, toujours non exécuté contre le projet réel) :
  `52591dabf7145c81567385ddf42239c01c2a8175615dd422c8e77de7795efe72`.
- **Flags** : `BUSINESS_DATA_FROM_SUPABASE = false`, `AGENDA_FROM_SUPABASE = true` — inchangés.
- **Aucun secret dans le ZIP** : même recherche de motifs que les passes précédentes (clés `sk-`,
  `AKIA...`, blocs PEM `PRIVATE KEY`, JWT `eyJ...`) sur `src/`, `public/`, `sql/`, `scripts/`,
  `test-harness/` et `dist/` → aucune occurrence. Aucun `.env`/`.env.local`/`.env.test` réel
  présent.
- **ZIP** : mêmes exclusions/inclusions que V7.2.

### Non vérifié — récapitulatif explicite (ce lot)

- Point 3 : le format exact `PGRST204`/`42703` n'a pas été observé contre le vrai projet
  Supabase de l'utilisateur — construit sur la documentation PostgREST officielle et un rapport
  d'erreur réel externe (voir détail dans la section Point 3).
- Le repli défensif Supabase pour les prénoms (déjà signalé non vérifié en V7.2) reste dans le
  même état : relecture de code + tests contre une base PostgreSQL locale jetable (nouveau, ce
  lot, voir Point 2), jamais contre le projet Supabase réel.
- `sql/04_rsvp_headcount.sql` porte la même lacune de scope `conrelid` que celle corrigée dans
  `sql/05` — signalé ci-dessus (Point 2), non corrigé dans ce lot, à traiter séparément si
  l'utilisateur le souhaite.
- Comme pour les passes précédentes, aucune inscription/modification/lecture n'a été exécutée
  contre un vrai projet Supabase — uniquement contre le harnais de test local et, pour la
  migration SQL, contre une base PostgreSQL locale jetable dédiée à cette seule vérification.

## Lot correctif — V7.4, après 3e contre-vérification indépendante du ZIP V7.3

Contexte : la contre-vérification du ZIP V7.3 a confirmé indépendamment le ZIP sain, le build,
161/161 tests Node, SQL 01-04 et logo inchangés, le masquage "Aucun participant" correctement
codé, la contrainte JSON nettement renforcée, aucun secret — **mais sans exécuter les 96
assertions Playwright** (Chromium indisponible côté reviewer, téléchargement expiré) : ce
chiffre restait donc déclaré, pas confirmé indépendamment. Deux réserves techniques précises et
une imprécision de commentaire SQL ont été signalées, traitées ci-dessous. Consigne reçue :
corriger, puis contre-vérification finale courte — rien à retester manuellement côté
utilisateur pour cette étape.

### Réserve 1 — Détection 42703 encore trop large

**Constat confirmé** : `isUndefinedColumnError` acceptait tout SQLSTATE `42703`, quelle que soit
la colonne réellement en cause (le test lui-même l'illustrait : `column "x" does not exist`
classé `true`). Une anomalie SQL sans rapport avec `attendee_names` (faute de frappe ailleurs
dans le code, régression sur une autre colonne) aurait donc pu déclencher à tort le repli "sans
prénoms" au lieu de remonter l'erreur réelle — même défaut de fond que la réserve déjà corrigée
pour `PGRST204` à la passe précédente, restée non traitée pour `42703`.

**Décision** : le message est désormais exigé aussi pour `42703`, avec le motif
`column "attendee_names"` — même niveau d'exigence que pour `PGRST204`. Formats exacts vérifiés
en exécutant réellement les deux requêtes concernées contre un Postgres local (pas une
supposition) : `insert into event_participants (..., attendee_names) values (...)` →
`column "attendee_names" of relation "event_participants" does not exist` ; un `select
attendee_names` nu → `column "attendee_names" does not exist` (sans "of relation"). Les deux
partagent le sous-motif exigé.

**Fichiers** : `src/undefinedColumnError.js`.

**Preuve** : `scripts/test-undefined-column-error.mjs`, 2 nouveaux cas (15-16 ; le cas 2
préexistant, qui affirmait à tort que "le code suffit", a été remplacé par un cas grounded sur
le message SELECT réel observé) : `42703` pour une autre colonne → `false` (15) ; `42703` sans
message → `false` (16, même règle que `PGRST204`). 16/16 assertions du fichier. **Vérifié
discriminant** : en revenant temporairement à `error.code === '42703'` seul, les cas 15 et 16
échouent bien (les 14 autres restent verts) ; correctif restauré, 16/16 repassent au vert.

### Réserve 2 — Preuve Agenda incomplète

**Constat confirmé** : le scénario Playwright 28 contrôlait uniquement l'attribut `title` du
chip "Sorties" (une info-bulle/marque d'accessibilité), jamais `backgroundColor`, `color` ou
`boxShadow` via `getComputedStyle` — alors que le point prétendait vérifier "le rendu réel"
(teinte visuelle), et que le scénario faisait déjà ce contrôle par `getComputedStyle` pour le
rond du calendrier juste en dessous.

**Décision** : trois nouvelles assertions sur le chip lui-même, par `getComputedStyle`,
correspondant chacune à une propriété CSS distincte de `FilterChip` (Agenda.jsx) quand `implied`
est vrai et `active` faux : `color` (texte) = couleur pleine de la catégorie ; `backgroundColor`
= teinte translucide de cette couleur (~12 % d'opacité — vérifié par un parsing tolérant du
`rgba(...)` renvoyé, canaux R/G/B exacts et alpha strictement entre 0 et 1, plutôt qu'une égalité
de chaîne exacte qui serait fragile aux arrondis d'arrondi du navigateur) ; `boxShadow` = liseré
teinté de cette même couleur (vérifié par une recherche de sous-chaîne sur le triplet RGB, la
sérialisation exacte de `box-shadow` variant selon les navigateurs). L'ancien contrôle `title`
est conservé en complément (28g), pas remplacé — c'est un signal réel (accessibilité), simplement
insuffisant à lui seul pour prouver le rendu visuel.

**Fichiers** : `test-harness/recette.mjs` (scénario 28 étendu, 28d-f nouveaux, ancien 28d/28e
renumérotés 28g/28h).

**Preuve** : 99/99 assertions Playwright (96 + 3 nouvelles). **Vérifié discriminant** : en
neutralisant temporairement `impliedCategory` (forcé à `null`), les 5 assertions concernées
(28d, 28e, 28f, 28g, 28h) échouent bien, 28a-c restent vertes (cohérent : le filtre lui-même n'a
pas changé) ; correctif restauré, 99/99 repassent au vert.

### Correction secondaire — imprécision du commentaire SQL

**Constat confirmé** : le commentaire de `sql/05_participant_names.sql` affirmait "exactement
les clés adults/children", mais la contrainte n'interdisait pas de clé supplémentaire —
`{"adults": [], "children": [], "extra": 1}` passait sans être rejeté.

**Décision** : plutôt que de corriger le commentaire pour qu'il corresponde au comportement
réel (plus permissif), la contrainte a été durcie pour correspondre à l'intention déjà
documentée (plus stricte) — cohérent avec le reste de cette contrainte, déjà conçue pour rejeter
toute donnée qui s'écarte de la forme attendue. Ajout de
`(attendee_names - 'adults' - 'children') = '{}'::jsonb` : l'opérateur jsonb `-` retire une clé
nommée si elle existe ; une fois "adults" et "children" retirés, il ne doit plus rien rester.
Comme pour `jsonb_path_exists` déjà en place, un simple appel d'opérateur, pas une sous-requête
(toujours interdite dans un `check`).

**Fichiers** : `sql/05_participant_names.sql`.

**Preuve — exécution réelle contre un Postgres local jetable** (même méthode que la passe
précédente, base créée et détruite pour cette seule vérification, jamais contre le Supabase réel
de l'utilisateur) : migration 04 puis 05 appliquées, ré-application confirmée idempotente ; 3
insertions valides acceptées (dont une avec `attendee_names` correctement rempli), une insertion
avec une clé `"extra"` en plus **rejetée** (nouveau cas), une insertion avec `adults` en chaîne
plutôt qu'en tableau toujours rejetée (non-régression) ; `select count(*)` final = 3. **Vérifié
discriminant** : en posant une variante de la contrainte sans la nouvelle clause, l'insertion
avec la clé `"extra"` est acceptée à tort ; avec la clause restaurée, elle est de nouveau
rejetée. Hash SHA-256 du fichier livré : `ef87be62654f255336b601f39356ae5d9abf7910f759e3bdbe4bdbb18b202db3`.

### Fichiers touchés — ce lot (V7.4)

**Modifiés (4)** : `src/undefinedColumnError.js` (réserve 1), `scripts/test-undefined-column-error.mjs`
(réserve 1), `test-harness/recette.mjs` (réserve 2), `sql/05_participant_names.sql` (correction
secondaire).

**Aucun nouveau fichier. Aucun autre fichier touché** — `sql/01-04` et le logo restent
identiques (hashes ci-dessous, inchangés depuis V7.2). **Aucun script SQL n'a été exécuté contre
le projet Supabase réel de l'utilisateur** — uniquement contre une base PostgreSQL locale
jetable, créée et détruite pour cette seule vérification.

### Vérification finale — V7.4 (chiffres qui font foi)

- **Node (`node scripts/test-*.mjs`)** : **15 suites, 163 assertions, 0 échec** (147 des passes
  précédentes + 16 pour `test-undefined-column-error.mjs`, qui compte désormais 16 cas au lieu
  de 14). Détail inchangé pour les 14 autres fichiers (voir section V7.3) ;
  `test-undefined-column-error.mjs` : 16.
  Total = 147 + 16 = **163**.
- **Playwright (`test-harness/recette.mjs`)** : **28 scénarios, 99 assertions, 0 échec, 0
  exception JavaScript capturée** (96 de V7.3 + 3 nouvelles dans le scénario 28, réserve 2 —
  aucun nouveau scénario, celui existant est étendu). Rejeu identique aux passes précédentes.
- **`npm run build`** : succès, aucune erreur ni avertissement bloquant.
- **Hash logo** : `b8bb3feb26c68cee22f7f41292c5cff8bb7cd564e0ccea4744c00f7a879c85af` — identique
  à toutes les passes précédentes.
- **Hashes SQL 01-04** : identiques à toutes les passes précédentes (voir détail V7.2/V7.3
  ci-dessus) — aucun n'a été ouvert en écriture ce lot. `05` (réécrit une 2e fois, toujours non
  exécuté contre le projet réel) : `ef87be62654f255336b601f39356ae5d9abf7910f759e3bdbe4bdbb18b202db3`.
- **Aucun secret dans le ZIP** : même recherche de motifs que les passes précédentes → aucune
  occurrence.
- **ZIP** : mêmes exclusions/inclusions que les passes précédentes.

### Non vérifié — récapitulatif explicite (ce lot)

- Comme pour toutes les passes précédentes, aucune inscription/modification/lecture n'a été
  exécutée contre un vrai projet Supabase — uniquement contre le harnais de test local et, pour
  la migration SQL, contre une base PostgreSQL locale jetable dédiée à cette seule vérification.
- Les 99 assertions Playwright de ce lot n'ont pas été rejouées par un tiers indépendant dans
  cet échange (limite déjà signalée pour les 96 précédentes : Chromium indisponible côté
  reviewer) — seule l'exécution par mes soins, dans cet environnement, est rapportée ici.

## Lot correctif — V7.5, mission EXERCICE_CLAUDE_ABCZED_V7.5.md (5 points imposés)

Contexte : mission fermée à 5 corrections précises, aucun élargissement de périmètre autorisé.
Travail exclusivement à partir du ZIP V7.4 joint. Livraison conditionnée à une vérification
discriminante des 5 points (le code relu seul, ou "supposé fonctionnel", ne suffit pas) —
méthode appliquée systématiquement ci-dessous : pour chaque point, un test qui échoue quand le
défaut est réintroduit, puis repasse au vert une fois le correctif restauré.

### P1 — Routage réel par URL (History API)

**Constat** : aucune des 5 sections principales ni la fiche événement n'avait d'URL propre ;
un rechargement ramenait toujours à l'Accueil, "Précédent/Suivant" du navigateur ne faisaient
rien.

**Correctif** : nouveau module pur `src/router.js` (`pathForState`/`stateForPath`,
`URL_SECTIONS`) + 4 `useEffect` dans `App.jsx` : un effet de montage qui résout l'URL initiale
(y compris un id d'événement dans le chemin), un effet qui pousse l'URL à chaque changement de
vue/événement (`history.pushState`), un écouteur `popstate` pour Précédent/Suivant, et la
résolution asynchrone d'un id d'événement en attente avec repli propre vers `/agenda` + message
si l'id n'existe pas.

**2 bugs réels trouvés et corrigés en cours de route** (pas des suppositions — détectés par
l'échec concret d'un scénario Playwright, diagnostiqués via un script de débogage dédié logant
`page.url()`/`sessionStorage` à chaque étape) :
- Un rechargement sur l'URL d'une fiche affichait le bon contenu mais l'URL du navigateur
  revenait silencieusement à `/` : React exécute TOUS les `useEffect` au tout premier rendu,
  donc l'effet de poussée d'URL s'exécutait avant que la résolution asynchrone de l'id n'ait eu
  lieu, avec un état encore `view === 'accueil'`. Correctif : `suppressPushRef.current = true`
  posé de façon synchrone dans la branche "fiche événement" de l'effet de montage, comme c'était
  déjà le cas dans l'autre branche.
- Le repli vers `/agenda` pour un id introuvable ne mettait en réalité jamais à jour l'URL du
  navigateur (elle restait bloquée sur l'id invalide, cassant aussi Précédent/Suivant) : le flag
  de suppression de poussée d'URL était posé inconditionnellement avant le test
  trouvé/non-trouvé au lieu de seulement dans la branche "trouvé". Correctif : déplacé
  strictement dans le `if (found)`.

**Preuve — discriminante, Playwright** : scénarios 29-31 (`test-harness/recette.mjs`) —
rechargement sur chacune des 5 sections + une fiche événement reste au bon endroit ; id
inexistant retombe proprement sur Agenda avec message, URL cohérente (`/agenda`) ; Précédent/
Suivant du navigateur suivent un historique réel (ouverture fiche → Précédent → Agenda →
Suivant → fiche rouverte), URL vérifiée à chaque étape. Les deux bugs ci-dessus ont chacun été
confirmés en échec avant correctif (réintroduction ciblée de la ligne fautive), puis en succès
après restauration. Comportements existants (retour contextuel, filtres, recherche, scroll)
non-régressés : suite complète 99 scénarios historiques rejouée verte avant l'ajout des
nouveaux scénarios.

**Fichiers** : `src/router.js` (nouveau), `src/App.jsx`.

### P2 — Résumé participants sur les cartes Agenda (mode famille)

**Constat** : les cartes Agenda en mode famille n'affichaient aucun décompte adultes/enfants,
contrairement à ce que le brief attend en cohérence avec la fiche détail.

**Correctif** : nouvelle fonction pure `participantsSummaryLabel(participants)`
(`src/agendaSearch.js`) produisant "N participant(s) · X adulte(s) · Y enfant(s)" — singulier/
pluriel corrects, catégorie omise si son compte est 0, jamais affiché à 0 participant au total,
aucun prénom. Branchée dans `src/pages/Agenda.jsx` uniquement pour les événements en mode
famille (`eventModeOf`, factorisé et partagé avec `EventDetail.jsx` pour garantir une
classification cohérente entre carte et fiche) ; le badge "accompagnateurs" existant (sorties
scolaires) et les autres modes restent inchangés.

**Preuve — discriminante** : `scripts/test-participants-summary.mjs` (12 assertions) couvre le
singulier/pluriel, l'omission des catégories à 0 (jamais "0 enfant" ni "0 adulte"), le repli sur
les participants au format chaîne (données historiques), l'absence de tout prénom dans le
résumé. Cassé volontairement (logique d'omission à 0) → 4 échecs → restauré → 12/12. Côté
navigateur, scénarios Playwright 32 ("17 participants · 16 adultes · 1 enfant" sur la carte
"Pique-nique entre familles") et 33 (aucun résumé sur "Goûter entre voisins", 0 participant) ;
vérifié aussi visuellement par capture d'écran mobile/desktop.

**Fichiers** : `src/agendaSearch.js`, `src/pages/Agenda.jsx`.

### P3 — Fusion "Qui vient ?" / "Votre participation" en une seule ligne "Vous"

**Constat** : la fiche événement affichait en doublon la ligne de l'utilisateur dans la liste
"Qui vient ?" ET un bloc séparé "Votre participation" avec ses propres actions Modifier/
Annuler — redondant et source de confusion.

**Correctif** : dans `EventDetail.jsx`, la ligne de la liste correspondant à l'utilisateur
courant (comparaison `participantId(p) === currentUserId`) porte désormais une pastille "VOUS"
et intègre directement "Modifier"/"Annuler ma participation" ; le bloc "Votre participation"
séparé est supprimé (quand l'utilisateur est déjà inscrit et pas en cours de modification, rien
ne s'affiche plus à cet emplacement — tout est dans la ligne). Les autres foyers et le total
restent inchangés.

**Preuve — discriminante, Playwright** : scénario 34 (9 assertions) — la pastille "VOUS"
apparaît exactement une fois, aucun second bloc "Votre participation" nulle part sur la page, un
seul bouton "Modifier" et un seul "Annuler ma participation" (pas de duplication), les prénoms
saisis visibles dans cette même ligne, "Modifier" repeuple bien adultes/enfants/prénoms,
l'abandon d'un brouillon de modification ne supprime pas l'inscription. Cassé volontairement
(réintroduction du bloc dupliqué) → 34b échoue → restauré → suite verte. Tactile mobile vérifié
par capture d'écran (ligne "Vous" bien tapable à 390px de large).

**Fichiers** : `src/pages/EventDetail.jsx`.

### P4 — Confirmation avant annulation de participation

**Constat** : "Annuler ma participation" supprimait l'inscription immédiatement, sans
confirmation ni garde-fou contre un appui accidentel.

**Correctif** : nouveau composant `ConfirmCancelDialog` dans `EventDetail.jsx`, réutilisant le
hook d'accessibilité modal déjà existant du projet (`useModalA11y` — Échap, clic sur le fond,
piège de focus Tab/Maj+Tab, retour de focus au déclencheur) plutôt qu'un mécanisme ad hoc.
Titre exact "Annuler votre participation ?", texte exact "Les nombres de participants et les
prénoms saisis seront supprimés.", boutons exacts "Conserver ma participation" (option prudente,
mise en avant visuellement — fond plein — et recevant le focus initial de par son ordre dans le
DOM) et "Oui, annuler ma participation" (secondaire, contour), plus un bouton de fermeture "X"
positionné visuellement en haut à droite mais placé en dernier dans le DOM pour ne jamais capter
le focus initial. Aucun `DELETE` n'est déclenché avant confirmation explicite ; en cas d'échec
réseau lors de la confirmation, l'inscription reste visible et une erreur explicite est montrée
(pas de suppression optimiste silencieuse).

**Preuve — discriminante, Playwright** : scénarios 35-37 (12 assertions) — textes exacts du
titre/corps/boutons vérifiés caractère pour caractère, focus initial confirmé sur "Conserver ma
participation", aucune suppression n'a lieu tant que la confirmation reste ouverte (inscription
et prénoms toujours visibles derrière la boîte), "Conserver" ferme sans rien supprimer, Échap
ferme sans rien supprimer, seule la confirmation explicite ("Oui, annuler...") supprime bien
l'inscription et fait réapparaître l'état vide. Cassé volontairement (contournement de la
confirmation) → échecs en aval confirmés → restauré. Capturé à 3 largeurs (390/834/1440px) :
boîte bien centrée et proportionnée, jamais étirée en pleine largeur sur desktop.

**Fichiers** : `src/pages/EventDetail.jsx`.

### P5 — Faux repli "agenda impossible à charger" quand `attendee_names` est absent

**Constat utilisateur** : un message générique "Impossible de charger l'agenda" apparaissait
au lieu du repli gracieux annoncé, quand la colonne `attendee_names` n'existe pas encore
(avant migration `sql/05`).

**Diagnostic réel** (pas une supposition) : `isUndefinedColumnError` ne reconnaissait le
SQLSTATE `42703` que sous sa forme citée et non qualifiée (`column "attendee_names" does not
exist`), qui est la forme produite par une requête SQL brute non qualifiée. Or l'agenda charge
les participants via une ressource imbriquée PostgREST (`select` avec relation embarquée), qui
produit pour la même erreur une forme **non citée et qualifiée par la table/l'alias** —
`column event_participants_1.attendee_names does not exist` (embarqué) ou
`column event_participants.attendee_names does not exist` (direct) — jamais reconnue par le
motif existant, donc traitée comme une erreur générique inattendue et non comme le repli
attendu. **Reproduit réellement** : binaire PostgREST 12.2.3 exécuté localement contre un
Postgres jetable (base et schéma minimal reproduisant l'état pré-migration-05, créés et détruits
pour cette seule vérification, jamais contre le Supabase réel de l'utilisateur) — messages exacts
capturés pour les 4 cas (imbriqué, direct, colonne différente, `PGRST204` sur `INSERT`).

**Correctif** : motif de `isUndefinedColumnError` élargi pour couvrir aussi la forme qualifiée
non citée, en restant strictement spécifique à `attendee_names` (une erreur `42703` sur une
autre colonne, ou tout autre code, continue de remonter comme une vraie erreur visible — jamais
avalée). Contrat de `agendaApi.fetchAgendaEvents` changé pour renvoyer
`{ events, attendeeNamesUnsupported }` au lieu d'un tableau nu, propagé jusqu'à `EventDetail`
qui affiche désormais un avertissement PROACTIF ("les prénoms saisis... ne pourront pas être
enregistrés... les effectifs, eux, seront bien pris en compte") directement dans le formulaire
d'inscription quand ce repli est actif — la saisie des prénoms reste ouverte, jamais désactivée.

**Preuve — discriminante** : `scripts/test-undefined-column-error.mjs` étendu à 20 assertions
(cas 17-20, messages réels capturés PostgreSQL/PostgREST pour la forme qualifiée non citée, plus
un cas de colonne différente et un cas de collision de préfixe en négatif) ; cassé et restauré,
comportement confirmé. Côté navigateur, scénario 38 (colonne absente simulée via un levier de
test du harnais) : aucun message générique, agenda toujours affiché normalement, avertissement
proactif visible avant toute tentative d'enregistrement, saisie des prénoms non désactivée.
Scénario 39 (nouveau levier de test simulant une vraie violation de contrainte `23514`, forme
réelle d'une donnée malformée) : l'erreur remonte bien telle quelle, jamais transformée en repli
"sans prénoms", rien n'est enregistré par erreur.

**Fichiers** : `src/undefinedColumnError.js`, `src/agendaApi.js`, `src/App.jsx`,
`src/pages/EventDetail.jsx`, `scripts/test-undefined-column-error.mjs`.

### Fichiers touchés — ce lot (V7.5)

**Nouveaux (3)** : `src/router.js`, `scripts/test-participants-summary.mjs`,
`scripts/test-router.mjs`.

**Modifiés (9)** : `src/App.jsx`, `src/agendaApi.js`, `src/agendaSearch.js`,
`src/pages/Agenda.jsx`, `src/pages/EventDetail.jsx`, `src/undefinedColumnError.js`,
`scripts/test-undefined-column-error.mjs`, `test-harness/mockAgendaApi.js`,
`test-harness/recette.mjs`.

**Aucun autre fichier touché** — `sql/01-05`, `public/` (dont le PDF de démonstration),
`package.json`, `vite.config.js`, `src/dataSourceFlags.js` et le logo restent identiques
(diff exhaustif et hash ci-dessous). **Aucune opération n'a été exécutée contre le projet
Supabase réel de l'utilisateur, aucun fichier d'environnement n'a été touché** — les seules
exécutions SQL/PostgREST de cette passe (diagnostic P5) l'ont été contre une base PostgreSQL
locale jetable, créée et détruite pour cette seule vérification.

### Vérification finale — V7.5 (chiffres qui font foi)

- **`npm run build`** : succès, aucune erreur ni avertissement bloquant.
- **Node (`node scripts/test-*.mjs`)** : **17 fichiers, 202 assertions, 0 échec** (163 de V7.4
  + 12 pour `test-participants-summary.mjs` [nouveau] + 23 pour `test-router.mjs` [nouveau] +
  20 au lieu de 16 pour `test-undefined-column-error.mjs`, soit +4 nets sur ce fichier). Détail :
  163 + 12 + 23 + 4 = **202**, rejoué et confirmé fichier par fichier ce lot (tous rc=0 ;
  décompte exact par fichier : 18, 16, 13, 22, 5, 4, 8, 5, 9, 12, 17, 7, 23, 10, 9, 4, 20).
- **Playwright (`test-harness/recette.mjs`)** : **39 scénarios, 153 assertions, 0 échec, 0
  exception JavaScript capturée** (99 de V7.4 + 54 nouvelles réparties sur les scénarios 29 à
  39, un pour chacun des 5 points plus les cas limites explicitement exigés par le brief —
  retour navigateur, id inexistant, échec réseau visible, distinction erreur réelle/repli).
  Rejeu complet confirmé ce lot, aucune ligne "erreur JS" dans la sortie.
- **Hash logo** (`src/components/Logo.jsx`) :
  `2ff325af04370e59492d0b070ca447bc70cfadf4acc8f0701ce818ec01d03345` — identique à V7.4 et à
  toutes les passes précédentes (recalculé et comparé ce lot).
- **SQL 01-05, `public/`, `package.json`, `src/dataSourceFlags.js`** : `diff -rq`/`diff` vides
  ce lot — strictement identiques à V7.4.
- **Aucun secret** : recherche de motifs (clés API, tokens JWT, clés privées) sur le code source
  livré (hors `dist/` généré et `node_modules/`) → aucune occurrence ; seuls `.env.example` et
  `.env.test.example` présents, avec des valeurs placeholder, aucun `.env` réel dans le ZIP.
- **Contrôle manuel responsive** (mobile 390×844, tablette 834×1112, desktop 1440×900) des 3
  zones modifiées visuellement : carte Agenda avec résumé participants (P2), ligne "Vous"
  fusionnée avec Modifier/Annuler intégrés (P3), boîte de confirmation d'annulation (P4) —
  captures d'écran passées en revue aux 3 largeurs, aucun débordement, boîte de confirmation
  bien proportionnée même à 1440px (jamais étirée pleine largeur).

### Non vérifié — récapitulatif explicite (ce lot)

- Comme pour toutes les passes précédentes, aucune inscription/modification/lecture/migration
  n'a été exécutée contre un vrai projet Supabase — uniquement contre le harnais de test local
  (Playwright) et, pour le diagnostic P5, contre un PostgREST + PostgreSQL locaux jetables,
  créés et détruits pour cette seule vérification.
- Les 153 assertions Playwright de ce lot n'ont pas été rejouées par un tiers indépendant dans
  cet échange (même limite que les passes précédentes : pas de second environnement disponible
  ici) — seule l'exécution par mes soins, dans cet environnement, est rapportée ici.
- Le contrôle responsive est une revue visuelle de captures d'écran à 3 largeurs fixes, pas un
  test automatisé de non-régression de mise en page ; il ne couvre pas toutes les tailles
  d'écran possibles.
- Le comportement réel de PostgREST/Supabase géré (hébergé) au-delà de la version 12.2.3
  utilisée pour la reproduction locale n'a pas été vérifié — si une version différente du
  service géré produisait un message d'erreur différent pour la même situation, le motif de
  `isUndefinedColumnError` pourrait ne pas le reconnaître ; c'est une limite assumée du
  diagnostic, pas une garantie absolue pour toutes les versions possibles du service géré.

## Lot correctif — V7.6, après contre-vérification indépendante du ZIP V7.5

Contexte : contre-vérification indépendante du ZIP V7.5 — ZIP sain, build réussi, 202/202
assertions Node, SQL 01-05/logo/`package.json`/`dataSourceFlags.js` inchangés, aucun secret,
tout confirmé. **Deux blocages réels signalés, tous deux confirmés en les reproduisant avant
correction — aucun accepté sur la seule foi du signalement.** V7.5 n'était donc pas livrable en
l'état ; les deux points ci-dessous sont corrigés, prouvés discriminants, et le ZIP est rejoué
depuis une extraction vierge avant cette livraison.

### Blocage 1 — `test-harness/` et `vite.harness.config.js` absents du ZIP livré

**Constat confirmé, et plus grave qu'un simple oubli** : ce n'était pas une zone grise
d'interprétation — le fichier `test-harness/recette.mjs` porte lui-même, depuis la V7.1, le
commentaire explicite *"PAS livré dans les passes 1-6 ; inclus à partir de la V7.1 pour que ces
résultats soient indépendamment reproductibles, pas seulement rapportés"*, et une vérification
directe des ZIP `V7.1`/`V7.3`/`V7.4` déjà livrés confirme qu'ils contenaient bien
`test-harness/` et `vite.harness.config.js`. La politique établie était donc déjà d'inclure le
harnais dans la livraison ; son exclusion en V7.5 est une régression de ce lot précis, sur la
base d'une mauvaise lecture d'un commentaire différent (*"PAS livré dans le ZIP de
production"*, dans `vite.harness.config.js`, qui parle du build `npm run build`/`dist`, pas de
l'archive de livraison). Conséquence concrète : les 153 assertions Playwright annoncées dans la
matrice V7.5 n'étaient pas rejouables par le destinataire du ZIP — seulement rapportées.

**Corrigé** : `test-harness/` et `vite.harness.config.js` réintégrés dans le ZIP, conformément à
la politique déjà en vigueur depuis la V7.1.

**Second problème, plus subtil, également corrigé** : même une fois le harnais présent,
`node test-harness/recette.mjs` échouait dès l'import (`Cannot find module 'playwright'`)
depuis une extraction vierge suivie d'un simple `npm install` — `playwright` n'a jamais été une
dépendance déclarée dans `package.json` sur aucune passe précédente (V7.1 à V7.5 comprises),
seulement documenté comme un pas manuel supplémentaire (`npm install --no-save playwright`) dans
la matrice. Ce n'était pas un défaut nouveau de ce lot, mais un frein réel à la reproductibilité
que la contre-vérification a mis en lumière en exigeant explicitement un rejeu "depuis une
extraction vierge du ZIP final". **Corrigé** : `playwright` (`^1.63.0`, version réellement
installée et testée ici) ajouté aux `devDependencies` de `package.json` — un seul `npm install`
suffit désormais à tout installer sauf le binaire Chromium lui-même
(`npx playwright install chromium`, irréductible pour tout projet basé sur Playwright, sur
n'importe quelle machine).

**Preuve** : voir la section "Vérification finale" ci-dessous — build, 17 suites Node et les 39
scénarios/157 assertions Playwright rejoués avec succès depuis une extraction totalement vierge
du ZIP `ABCZed_v7.6.zip` livré (pas depuis l'arborescence de travail), après un simple
`npm install` sans étape manuelle supplémentaire pour `playwright`.

**Fichiers** : `package.json` (nouvelle dépendance), `test-harness/recette.mjs` (commentaire
d'en-tête mis à jour en conséquence), et réintégration de `test-harness/`/
`vite.harness.config.js` dans le contenu du ZIP (ces fichiers eux-mêmes n'ont pas changé de
contenu au-delà de l'en-tête de `recette.mjs` et de l'ajout du scénario 40 ci-dessous).

### Blocage 2 — Boucle "Précédent" sur un id d'événement introuvable (vrai bug, confirmé)

**Constat confirmé par reproduction, pas accepté sur la seule foi du signalement** : le repli
"événement introuvable" (P1, ajouté en V7.5) mettait bien à jour l'affichage vers Agenda, mais
via `window.history.pushState('/agenda')` au lieu de `replaceState` — l'URL invalide d'origine
restait donc une entrée d'historique à part entière, jamais corrigée en place. Reproduit
exactement comme décrit : charger directement une URL de fiche avec un id inexistant, constater
le repli propre vers Agenda (correct), puis appuyer sur "Précédent" — le navigateur revient
réellement sur l'URL invalide (ce n'est pas une entrée créée par `pushState`/`replaceState` mais
par le chargement direct lui-même, donc "Précédent" y renavigue pour de vrai), ce qui redéclenche
aussitôt la même résolution "introuvable", qui repoussait alors une NOUVELLE entrée `/agenda` —
"Précédent" ne ramenait donc jamais réellement en arrière, une vraie boucle. Ce cas précis
(id introuvable PUIS "Précédent") n'était pas couvert par les scénarios 30/31 de la V7.5 :
30 teste le repli seul, 31 teste précédent/suivant mais sur un événement VALIDE — l'angle mort
exact que ce blocage a mis en évidence.

**Corrigé** : nouveau ref `forceReplaceRef` (`src/App.jsx`) — posé uniquement dans la branche
"introuvable" de l'effet de résolution (celle qui change réellement la destination, donc ne peut
pas utiliser `suppressPushRef`, qui se tait). L'effet de poussée d'URL, quand ce ref est actif,
utilise `window.history.replaceState` au lieu de `pushState` : l'entrée d'historique invalide
est corrigée en place, jamais dupliquée — "Précédent" quitte alors réellement cette zone au lieu
d'y revenir.

**Preuve — discriminante, Playwright** : nouveau scénario 40 (`test-harness/recette.mjs`, 4
assertions) — chargement direct d'un id inexistant, repli propre confirmé, un "Précédent" ne
ramène jamais sur l'URL invalide elle-même, un second "Précédent" continue de progresser sans
revenir dessus non plus (pas de blocage/oscillation). Cassé volontairement (retour à
`pushState` sans condition) → l'assertion correspondante échoue avec l'URL invalide effectivement
revisible dans la barre d'adresse, symptôme identique à celui signalé → restauré → suite de
nouveau intégralement verte. (Une première version de ce test tentait de discriminer via
`window.history.length` — retirée après avoir constaté qu'elle échouait aussi sur le code
correct dans cet environnement Chromium/Playwright/Vite, donc non fiable ; gardé uniquement ce
qui est observé et vérifié : l'URL réellement affichée après chaque "Précédent".)

**Fichiers** : `src/App.jsx`, `test-harness/recette.mjs`.

### Fichiers touchés — ce lot (V7.6)

**Modifiés (3)** : `src/App.jsx` (correctif `forceReplaceRef`), `package.json` (ajout de
`playwright` en devDependency), `test-harness/recette.mjs` (nouveau scénario 40, commentaire
d'en-tête mis à jour). `package-lock.json` régénéré en conséquence (`npm install`).

**Réintégrés dans le ZIP (contenu inchangé par rapport à la V7.4/V7.5 de travail)** :
`test-harness/` (dossier entier) et `vite.harness.config.js` — absents à tort du ZIP V7.5,
présents dans le ZIP livré ici.

**Aucun autre fichier touché** — SQL 01-05, `public/` (dont le PDF de démonstration),
`src/dataSourceFlags.js` et le logo restent identiques à la V7.4/V7.5 (diff exhaustif et hash
ci-dessous). **Aucune opération n'a été exécutée contre le projet Supabase réel de
l'utilisateur, aucun fichier d'environnement n'a été touché.**

### Vérification finale — V7.6 (chiffres qui font foi, rejoués depuis le ZIP livré lui-même)

Contrairement aux passes précédentes, cette vérification n'a pas été menée depuis l'arborescence
de travail mais depuis une **extraction totalement vierge d'`ABCZed_v7.6.zip`**, exactement
comme demandé — `unzip` dans un répertoire vide, puis `npm install` (aucune étape manuelle
supplémentaire) et rejeu complet :

- **`npm install`** : succès, aucune dépendance manquante (y compris `playwright`, désormais
  installé automatiquement).
- **`npm run build`** : succès, aucune erreur ni avertissement bloquant.
- **Node (`node scripts/test-*.mjs`)** : **17 fichiers, 202 assertions, 0 échec** — inchangé par
  rapport à la V7.5 (aucun de ces fichiers n'a été modifié ce lot), rejoué et confirmé depuis
  l'extraction vierge.
- **Playwright (`test-harness/recette.mjs`, après `npx vite --config vite.harness.config.js`
  dans un terminal séparé)** : **40 scénarios, 157 assertions, 0 échec, 0 exception JavaScript
  capturée** (153 de V7.5 + 4 pour le nouveau scénario 40). Rejeu confirmé depuis l'extraction
  vierge du ZIP livré, pas seulement depuis l'arborescence de travail.
- **Hash logo** (`src/components/Logo.jsx`) :
  `2ff325af04370e59492d0b070ca447bc70cfadf4acc8f0701ce818ec01d03345` — identique à toutes les
  passes précédentes.
- **SQL 01-05, `public/`, `src/dataSourceFlags.js`** : `diff -rq`/`diff` vides ce lot —
  strictement identiques à la V7.4/V7.5.
- **`package.json`** : diffère intentionnellement de la V7.4/V7.5 par l'ajout de
  `playwright` en devDependency (voir Blocage 1) — seul changement, documenté, pas une
  régression silencieuse.
- **Aucun secret** : même recherche de motifs que les passes précédentes sur le contenu du ZIP
  livré (hors `dist/` généré et `node_modules/`, ni l'un ni l'autre présents dans le ZIP) →
  aucune occurrence ; seuls `.env.example`/`.env.test.example` présents, valeurs placeholder,
  aucun `.env` réel.

### Non vérifié — récapitulatif explicite (ce lot)

- Comme pour toutes les passes précédentes, aucune inscription/modification/lecture n'a été
  exécutée contre un vrai projet Supabase — uniquement contre le harnais de test local
  (Playwright), désormais rejoué depuis l'archive livrée elle-même plutôt que depuis
  l'arborescence de travail.
- Les 157 assertions Playwright de ce lot n'ont pas été rejouées par un tiers indépendant dans
  cet échange (même limite que les passes précédentes).
- Le contrôle manuel responsive (mobile/tablette/desktop) n'a pas été refait ce lot : aucune des
  deux corrections de ce lot ne touche à une zone d'affichage déjà vérifiée visuellement en
  V7.5 (P1 URL/historique et une dépendance de build, pas de rendu) — repris tel quel de la V7.5,
  pas re-testé visuellement.


## Lot correctif — V7.7, mission EXERCICE_CLAUDE_ABCZED_V7.7.md (Messages connecté à Supabase)

### Contexte / périmètre

Départ strict du ZIP `ABCZed_v7.6.zip` joint. Mission fermée à un seul module : connecter
**Messages** (et sa discussion liée à un événement) au schéma Supabase sécurisé déjà en place
pour l'Agenda — **jamais** Partages ni La Bande, qui restent volontairement sur des données
locales dans ce lot ("Ce lot ne doit donc connecter que Messages. Il ne doit pas rouvrir la
recette Agenda V7.6 ni ajouter de nouvelles fonctions métier.", brief). Aucune opération n'a été
exécutée contre le Supabase réel de l'utilisateur — toute vérification serveur (P8) a été menée
contre un PostgreSQL **local jetable**, jamais le projet réel ; voir la déclaration explicite en
fin de section.

Six défauts réels, pré-identifiés par le brief (pas des hypothèses) dans le code Messages
resté en sommeil depuis les passes précédentes, plus deux défauts supplémentaires trouvés en
cours d'audit (non signalés par le brief, détectés par lecture directe du code) :

1. `src/api.js` utilise des champs texte libre (`author_name`/`avatar_color`/`member_name`) au
   lieu d'identifiants réels (`author_id`/`user_id`, uuid).
2. Les branches réelles de `sendMessage()`/`linkMessage()` dans `App.jsx` appelaient une
   fonction `loadAll()` **qui n'existe pas** — confirmé par lecture directe du code (lignes 486
   et 512 de l'`App.jsx` V7.6), pas une supposition.
3. `BUSINESS_DATA_FROM_SUPABASE` ne devait jamais devenir un interrupteur global qui
   reconnecterait aussi Partages/La Bande.
4. `Messages.jsx` codait en dur `ME = 'Vous'` / `MY_USER_ID = 'mem-vous'` au lieu de comparer
   `author_id` à `auth.uid()` réel.
5. `Messages.jsx` recevait `events={MOCK_EVENTS}` et utilisait `linkableEvents()` (`data.js`) au
   lieu des vrais événements de l'Agenda de la communauté.
6. Les réactions vivaient dans la colonne `messages.reactions jsonb`, alors que la RLS
   existante (sql/02) ne permet qu'à l'auteur/un admin de faire un `UPDATE` sur une ligne
   `messages` — une table normalisée dédiée est nécessaire pour que n'importe quel membre
   puisse réagir sans devoir aussi pouvoir modifier le message.
7. **(trouvé en cours d'audit, non listé par le brief)** Le bandeau de confidentialité de
   `Messages.jsx` conditionnait déjà son texte réel/démo sur `BUSINESS_DATA_FROM_SUPABASE` — qui
   ne gouverne pourtant jamais Messages (uniquement Partages/La Bande). Un décalage resté
   invisible tant que Messages n'était pas réellement connecté : le texte réel du brief
   n'aurait jamais pu s'afficher, même une fois Messages branché, sans ce correctif.
8. **(trouvé en cours d'audit)** `agendaApi.js` mappe `hasLinkedThread` à `false` en dur pour
   tout événement (commentaire d'origine : "Reconnecté au bloc Messages", écrit avant que
   Messages ne soit réellement connecté) — sans correctif, aucune fiche événement n'aurait
   jamais affiché "Voir la discussion liée", même pour un événement réellement lié à des
   messages réels.

### Tableau de synthèse — P1 à P9

| Point | Fichier(s) | Défaut initial reproduit | Modification | Test discriminant | Résultat |
|---|---|---|---|---|---|
| **P1** — Source de données isolée | `src/messagesApi.js` (nouveau), `src/dataSourceFlags.js`, `src/App.jsx` | Aucun module dédié : Messages dépendait soit de données mock, soit de branches mortes appelant `loadAll()` inexistant ; pas d'états dédiés chargement/erreur | Nouveau `MESSAGES_FROM_SUPABASE`, distinct de `BUSINESS_DATA_FROM_SUPABASE`/`AGENDA_FROM_SUPABASE` ; `loadMessages` (`useCallback`) avec garde anti-réponse-obsolète (`messagesRequestId`, même motif que `AuthProvider.loadMemberships`) ; états `messagesLoading`/`messagesError` dédiés | Inventaire exhaustif des imports de `api.js` (grep sur `src/` : plus aucun fichier ne l'importe après ce lot — voir section dédiée) ; build + 166+15 scénarios Playwright + 218 assertions Node, 0 échec | ✅ 0 échec |
| **P2** — Lecture réelle, auteurs, confidentialité, Accueil | `src/messagesApi.js`, `src/avatarColor.js` (nouveau), `src/pages/Messages.jsx`, `src/pages/Accueil.jsx` | `ME='Vous'`/`MY_USER_ID='mem-vous'` en dur ; bandeau conditionné sur le mauvais drapeau (défaut 7 ci-dessus) ; `Accueil.jsx` prenait le dernier élément du TABLEAU `thread`, pas le vrai dernier par `created_at` | Résolution auteur via `members.display_name` (jamais uuid/email exposé, repli `'Membre'`) ; bandeau conditionné sur `MESSAGES_FROM_SUPABASE` ; texte exact "Les messages sont visibles uniquement par les membres du groupe." ; état vide exact "Aucun message pour le moment." ; `Accueil.jsx` trie désormais via `sortMessagesChronologically` avant de prendre le dernier | `scripts/test-avatar-color.mjs` (16 assertions) ; Playwright 25a-d (bandeau) ; isolation 4a (état vide) ; isolation 7a-b (dernier message par `created_at`, pas par position dans le tableau, avec un message injecté délibérément "plus ancien mais dernier du tableau") | ✅ 0 échec |
| **P3** — Envoi et persistance | `src/App.jsx` (`sendMessage`), `src/pages/Messages.jsx` (`submit`) | `submit()` non asynchrone, videait le champ inconditionnellement ; branche réelle appelait `loadAll()` inexistant | `onSend` async, contrat de retour booléen ; `submit()` attend la réponse, ne vide le champ QUE si `true`, état `sending` local désactive le champ pendant l'écriture ; toujours un rechargement complet après succès (jamais de fusion locale) | Playwright 41a-b (envoi bout en bout, champ vidé) ; isolation 8a-c (échec réseau simulé : texte conservé, erreur réelle affichée, rien ajouté au fil) ; isolation 2a (auteur non-admin peut lier SON message) | ✅ 0 échec |
| **P4** — Discussion liée à un événement réel | `src/pages/Messages.jsx` (`LinkEventPicker`), `src/App.jsx` (`isAdmin`, `hasLinkedThread`) | `events={MOCK_EVENTS}` + `linkableEvents()` (données mock) ; `hasLinkedThread` toujours `false` (défaut 8 ci-dessus) ; bouton "Lier" offert à tout le monde | `events` réel (Agenda de la communauté) passé à Messages ; `LinkEventPicker` filtre `category !== 'anniversaire'` sur les vraies données ; bouton gated par `isMine \|\| isAdmin` (RLS `update_own_message_or_admin` reste la garantie serveur) ; `selectedEventWithThreadFlag` recalcule `hasLinkedThread` depuis le vrai `thread` | Playwright 42a-d (liaison à un vrai événement, titre réel, aucun anniversaire proposé) ; isolation 1a (non-auteur/non-admin : bouton absent) ; SQL c1-c3, h1-h2 (`sql_repro_tests.py`) | ✅ 0 échec |
| **P5** — Réactions sécurisées | `sql/06_message_reactions.sql` (nouveau), `src/messagesApi.js` | Réactions dans `messages.reactions jsonb` ; RLS existante n'autorise que l'auteur/admin à modifier une ligne `messages` — un simple membre n'aurait jamais pu réagir sans pouvoir aussi modifier le texte | Table normalisée `message_reactions` (FK composite `(message_id, community_id)` → `messages(id, community_id)`, nouvelle contrainte `unique` sur `messages`), trigger d'immuabilité `protect_reaction_identity` (seul `emoji` mutable), RLS dédiée à 4 policies (select/insert/update/delete), colonne historique `messages.reactions` non supprimée | `sql_repro_tests.py` (26/26) + `sql_discriminating_tests.py` (8/8, cassé→réussite de l'attaque→restauré→blocage confirmé, sur les 4 garanties les plus critiques) ; Playwright 17a-c (réactions bout en bout), isolation 5b (via Realtime) | ✅ 34/34 |
| **P6** — Realtime | `src/messagesApi.js` (`subscribeToMessages`), `src/App.jsx` | Aucun abonnement Realtime ; aucune protection anti-fuite intercommunauté | Un seul canal par communauté (`messages` + `message_reactions`), filtre serveur `community_id=eq.<id>` **et** garde défensive côté client (payload comparé à `communityId` avant de déclencher un rechargement) ; `onChange` ne fait jamais de fusion locale, toujours un rechargement complet ; nettoyage explicite au changement de communauté/démontage | Isolation 5a-b (notification déclenche un vrai rechargement), 6a-c (un seul abonnement, jamais accumulé, survit à une navigation d'onglet — délibéré, voir note) | ✅ 0 échec |
| **P7** — États, erreurs, non-régressions UX | `src/App.jsx`, `src/pages/Messages.jsx` | — (transversal aux points ci-dessus) | États dédiés chargement/erreur, jamais de repli silencieux vers une donnée de démonstration en cas d'échec réseau, textes d'état vide à 3 formulations distinctes (recherche/discussion filtrée/fil général), bandeau global de démonstration corrigé pour ne plus mentionner "Messages," | Suite Playwright historique complète (scénarios 1-40, 157 assertions V7.6) **rejouée verte sans modification** contre les données réelles du double `mockMessagesApi.js`, PLUS 25a-d réécrit (assertions inversées, conformes au nouvel état réel) | ✅ 166/166 (`recette.mjs`) |
| **P8** — Tests SQL discriminants | `sql_repro_tests.py`, `sql_discriminating_tests.py` (scratch, non livrés), `sql/06_message_reactions.sql` | — | PostgreSQL 16 local jetable (`abczed_v77_repro`), stub minimal `auth.users`/`auth.uid()`, rôles `anon`/`authenticated`/`service_role`, simulation `set_config('request.jwt.claim.sub', ...)` par transaction | 26 assertions fonctionnelles/sécurité (isolation, envoi, liaison, réactions, cascade, non-régression sql/02) + 8 assertions casser→observer l'échec de la protection→restaurer→observer le blocage, sur les 4 garanties les plus critiques (policy insert, FK composite, trigger, contrainte unique) | ✅ 34/34, ré-exécuté sur une base entièrement reconstruite via `setup_repro_db.sh` |
| **P9** — Harnais, build, ZIP | `test-harness/mockMessagesApi.js` (nouveau), `vite.harness.config.js`, `test-harness/main.jsx`, `test-harness/mockAuth.jsx`, `test-harness/recette.mjs`, `test-harness/recette-messages-isolation.mjs` (nouveau) | Aucun double Messages dans le harnais ; `MOCK_THREAD` référencé dans `App.jsx` | Double réseau complet (lecture/envoi/liaison/réactions/Realtime simulé/persistance sessionStorage), alias Vite dédié, `MOCK_THREAD` (`GENERAL_THREAD`) **totalement absent** du bundle de production (vérifié par grep sur `dist/`, 0 occurrence) | `npm install` seul suffit (aucune dépendance nouvelle) ; `npm run build` propre ; 218 assertions Node + 181 assertions Playwright (2 scripts) + 34 assertions SQL, **0 échec au total** ; secrets absents ; diff exhaustif vs V7.6 (15 fichiers touchés/ajoutés, liste ci-dessous) | ✅ 433/433 assertions automatisées |

### Détail — P1, isolement de la source de données

**Constat** : avant ce lot, `Messages.jsx`/`App.jsx` ne disposaient d'aucun module réseau dédié
et fonctionnel — les branches "réelles" de `sendMessage`/`linkMessage` dans `App.jsx` (gardées
par `BUSINESS_DATA_FROM_SUPABASE`, toujours `false`, donc jamais exécutées) appelaient
`loadAll()`, une fonction qui n'existe nulle part dans le fichier. Le seul module réseau
existant, `src/api.js`, utilise des champs texte libre (`author_name`, `avatar_color`,
`member_name`) incompatibles avec le schéma sécurisé réel (`author_id`/`user_id` en uuid,
vérifié contre `sql/02_rls.sql` avant d'écrire quoi que ce soit).

**Correctif** : nouveau module `src/messagesApi.js`, écrit sur le même modèle que
`src/agendaApi.js` (jamais `api.js`) — `fetchMessages`, `sendMessage`, `linkMessageToEvent`,
`toggleMessageReaction`, `subscribeToMessages`. Nouveau drapeau `MESSAGES_FROM_SUPABASE`
(`src/dataSourceFlags.js`), strictement distinct de `BUSINESS_DATA_FROM_SUPABASE` (Partages/La
Bande, inchangé, reste `false`) et de `AGENDA_FROM_SUPABASE` (inchangé, reste `true`) — lui
seul pilote Messages. `App.jsx` : nouveaux états `messagesLoading`/`messagesError`, nouveau
`loadMessages` (`useCallback`) avec garde anti-réponse-obsolète par identifiant de requête
incrémenté (`messagesRequestId`, même motif que `loadMemberships` dans `AuthProvider.jsx`) —
une réponse réseau qui arrive après qu'une communauté ait changé entre-temps ne peut plus
écraser un état plus récent.

**Inventaire exhaustif des imports de `src/api.js`** (brief P1 : "avant tout refactor, établir
la liste exhaustive des imports et appels encore dirigés vers `src/api.js`") — avant ce lot,
`grep -rn "from ['\"]\.\{1,2\}/api['\"]" src/` ne trouvait qu'un seul fichier : `App.jsx`
(`import * as api from './api'`), avec exactement deux appels réels
(`api.sendMessage`/`api.linkMessageToEvent`), tous deux dans des branches gardées par
`BUSINESS_DATA_FROM_SUPABASE` et donc jamais exécutées. Après ce lot, le même grep ne trouve
**plus aucun import** de `api.js` nulle part dans `src/` — remplacés par les appels équivalents
sur `messagesApi`. `api.js` lui-même reste intact sur disque (dette Partages/La Bande, hors
périmètre) : aucun couplage entre `messagesApi.js` et `api.js`.

### Détail — P2, auteurs réels, confidentialité, intégration Accueil

**Constat** : `Messages.jsx` codait `ME = 'Vous'` et `MY_USER_ID = 'mem-vous'` — une comparaison
sur un nom affiché plutôt que sur l'identité réelle de session. Le bandeau de confidentialité
conditionnait déjà son texte sur `BUSINESS_DATA_FROM_SUPABASE` (qui ne gouverne jamais
Messages), un décalage resté invisible tant que Messages restait sur des données locales — mais
qui aurait empêché le texte réel du brief de jamais s'afficher, même une fois Messages branché,
sans ce correctif. `Accueil.jsx` prenait `[...thread].reverse().find(m => m.text)` — le dernier
élément du TABLEAU, pas le message le plus récent par `created_at` réel (un risque concret une
fois les messages livrés par le réseau, où l'ordre d'arrivée n'est pas garanti).

**Correctif** : `messagesApi.fetchMessages` résout les auteurs via deux lectures séparées
(`messages`, `members`) fusionnées côté client par `author_id` — aucune FK directe entre les
deux tables (chacune référence `auth.users` séparément), exactement la contrainte déjà
rencontrée pour `event_participants`/`members` dans `agendaApi.js`. Repli neutre `'Membre'` si
le profil est incomplet ou introuvable — jamais un fragment d'uuid, jamais un email. Nouveau
module pur `src/avatarColor.js` (`avatarColorFor`/`initialsOf`, hash déterministe sur une
palette fixe) pour dériver couleur/initiales sans nouvelle colonne arbitraire en base.
`Messages.jsx` : `isMine = m.authorId === currentUserId` (identité réelle, prop reçue de
`App.jsx` depuis `session.user.id`) ; bandeau conditionné sur `MESSAGES_FROM_SUPABASE`, texte
exact du brief "Les messages sont visibles uniquement par les membres du groupe." ; état vide à
trois formulations distinctes selon le contexte (recherche sans résultat / discussion liée vide
/ fil général vide, ce dernier exactement "Aucun message pour le moment."). `Accueil.jsx` :
`sortMessagesChronologically(thread)` (fonction pure déjà testée, `src/messageSearch.js`)
appliquée avant de prendre le dernier message — protège contre un ordre d'arrivée réseau non
garanti (Realtime, rechargement), pas seulement contre l'ordre du tableau initial.

**Preuve — discriminante** : `scripts/test-avatar-color.mjs` (16 assertions, déterminisme du
hash, palette fixe, repli `'?'`/initiales sur cas limites) ; Playwright `recette.mjs` 25a-d
(texte réel affiché, ancien texte démo disparu, bandeau global corrigé) ; harnais isolation 4a
(état vide exact) et 7a-b (message injecté volontairement "le plus ancien mais dernier du
tableau" — vérifié qu'il n'apparaît PAS comme "dernier message" sur l'Accueil, et que le vrai
dernier par `created_at` s'affiche bien).

### Détail — P3, envoi et persistance

**Constat** : `submit()` (`Messages.jsx`) n'était pas asynchrone et vidait le champ de saisie
inconditionnellement, avant même de savoir si l'envoi réel avait réussi — un problème resté
invisible tant que la branche réelle n'était jamais exécutée (appelait `loadAll()` inexistant).

**Correctif** : `App.jsx.sendMessage` devient `async`, avec un contrat de retour explicite
(`boolean`) — `true` seulement si le message a bien été persisté, `false` sinon (session
invalide, texte vide après `trim()`, ou échec réseau). `Messages.jsx.submit()` attend cette
réponse (`await onSend(...)`), ne vide le champ que si `true`, et expose un état local `sending`
(désactive le champ et le bouton pendant l'écriture — empêche un double envoi). Aucune mise à
jour optimiste locale du fil : après un envoi réussi, `loadMessages()` recharge l'état réel
complet, qui fait foi. Entrée et bouton Envoyer empruntent tous deux `submit()`, jamais deux
chemins distincts.

**Preuve — discriminante, Playwright** : `recette.mjs` 41a-b (message envoyé, apparaît, champ
vidé, persiste après un rechargement complet — scénario 44a) ; harnais isolation 8a-c (échec
réseau simulé via un levier de test dédié `__abczed_harness_force_send_error__` : le texte
reste dans le champ, une erreur réelle s'affiche, rien n'apparaît dans le fil).

### Détail — P4, discussion liée à un événement réel

**Constat** : `Messages.jsx` recevait `events={MOCK_EVENTS}` (toujours, même avec
`AGENDA_FROM_SUPABASE=true`) et son sélecteur de liaison utilisait `linkableEvents()`
(`src/data.js`, données mock) — jamais les vrais événements de la communauté. Par ailleurs,
`agendaApi.js` mappe `hasLinkedThread` à `false` en dur pour tout événement (commentaire
d'origine : "Reconnecté au bloc Messages", écrit avant que Messages soit réellement connecté) —
sans correctif, aucune fiche événement n'aurait jamais proposé "Voir la discussion liée", même
pour un événement réellement lié à des messages réels.

**Correctif** : `App.jsx` passe désormais `events={events}` (agenda réel de la communauté,
`AGENDA_FROM_SUPABASE`) à `<Messages>` — plus jamais `MOCK_EVENTS` pour ce module (Partages
continue de recevoir `MOCK_EVENTS`, hors périmètre). `LinkEventPicker` (`Messages.jsx`) filtre
`events.filter(e => e.category !== 'anniversaire')` sur ces vraies données, même règle
qu'avant mais appliquée à la vraie liste. Le bouton "Lier à un événement" n'est proposé qu'à
l'auteur du message ou un admin de la communauté (`isMine || isAdmin`, `isAdmin` dérivé de
`activeCommunity.role === 'admin'`, reçu en prop réelle) — l'interface n'offre jamais une action
vouée à l'échec côté serveur (policy `update_own_message_or_admin`, `sql/02_rls.sql`, inchangée
et non dupliquée côté client). Nouveau `selectedEventWithThreadFlag` (`App.jsx`) recalcule
`hasLinkedThread` à partir du VRAI `thread` (`thread.some(m => m.linkedEventId === selectedEvent.id)`)
plutôt que la valeur figée d'`agendaApi.js`. Un événement lié supprimé laisse le message visible
avec un lien remis à `NULL` — garanti au niveau du schéma (`linked_event_id uuid references
events(id) on delete set null`, `sql/02_rls.sql`, non modifié), pas une logique applicative
ajoutée ici.

**Preuve — discriminante, Playwright** : `recette.mjs` 42a-d (liaison à un vrai événement de
l'agenda, au moins un événement réel proposé, aucun anniversaire, badge affichant un vrai titre
— pas vide) ; harnais isolation 1a-2a (membre non-auteur/non-admin : bouton absent sur le
message d'autrui ; même membre, non-admin, sur SON PROPRE message : bouton bien présent) ; côté
SQL, `sql_repro_tests.py` c1-c3 (auteur/admin peuvent lier, un simple membre ne modifie aucune
ligne) et h1-h2 (non-régression : lien intercommunauté et lien vers un anniversaire restent
bloqués par le trigger existant `trg_check_message_event_link`, non modifié) et p4-1/p4-2
(suppression de l'événement lié → message visible, lien `NULL`).

### Détail — P5, réactions sécurisées (table normalisée)

**Constat** : les réactions vivaient dans `messages.reactions jsonb`. La RLS existante
(`sql/02_rls.sql`, non modifiée) n'autorise un `UPDATE` sur une ligne `messages` qu'à son auteur
ou un admin (`update_own_message_or_admin`) — élargir cette policy pour permettre à N'IMPORTE
QUEL membre de réagir aurait aussi, du même geste, permis à n'importe quel membre de modifier le
TEXTE du message d'un autre. Une table dédiée est nécessaire, pas un assouplissement de policy.

**Correctif** : nouvelle migration additive `sql/06_message_reactions.sql` (jamais exécutée
contre le Supabase réel de l'utilisateur, uniquement vérifiée contre un PostgreSQL local
jetable — voir P8) :

- `alter table messages add constraint messages_id_community_id_key unique (id, community_id)`
  (idempotent, gardé par une vérification `pg_constraint`/`conrelid` — même idiome que
  `sql/04`/`sql/05`, qui filtre par table puisque `conname` n'est unique que PAR table, pas
  globalement) — réplique pour `messages` ce qu'`events` avait déjà (`sql/02`), condition
  nécessaire à la garantie structurelle suivante.
- `message_reactions (id, message_id, community_id, user_id, emoji, created_at)`, `unique
  (message_id, user_id)` (une seule réaction active par personne et par message),
  `foreign key (message_id, community_id) references messages (id, community_id) on delete
  cascade` — une garantie de CLÉ ÉTRANGÈRE, pas seulement une vérification applicative, qu'une
  réaction prétendant appartenir à une communauté correspond réellement à la communauté du
  message ciblé.
- Trigger `BEFORE UPDATE` `protect_reaction_identity` : bloque tout changement de `message_id`/
  `community_id`/`user_id` sur une ligne existante — seul `emoji` reste modifiable. Garantie
  serveur INDÉPENDANTE de la RLS ("la RLS complète cette structure mais ne la remplace pas",
  brief) — vérifiée en tant que superutilisateur (RLS non pertinente, `BYPASSRLS`) pour prouver
  que c'est bien le trigger, pas la RLS, qui bloque.
- RLS dédiée (4 policies : select/insert/update/delete), chacune précédée d'un `drop policy if
  exists` pour une ré-exécution sûre — plus strict que la non-idempotence pré-existante de
  `sql/02` (signalée ici comme limite connue, hors périmètre, non corrigée).
- Colonne historique `messages.reactions` **non supprimée** — laissée en place, simplement plus
  utilisée par le nouveau chemin réel.
- Tentative idempotente d'ajout de `messages`/`message_reactions` à la publication
  `supabase_realtime` (P6), avec vérification préalable que la publication existe — voir les
  limites non vérifiables depuis cet environnement, plus bas.

**Preuve — discriminante, PostgreSQL local jetable** : voir P8 ci-dessous (34/34 assertions,
dont 8 de type casser→observer l'échec réel→restaurer→observer le blocage réel, sur les 4
garanties les plus critiques : policy d'insertion, FK composite, trigger, contrainte unique).
Côté React : `Messages.jsx`/`App.jsx.toggleMessageReaction` appellent
`messagesApi.toggleMessageReaction` puis rechargent — jamais de mutation locale simulée pour le
chemin réel (`reactions.js.toggleReaction`, la fonction pure locale, n'est plus appelée par
l'application depuis ce lot, conservée et toujours testée pour son usage antérieur).

### Détail — P6, abonnement Realtime

**Constat** : aucun abonnement Realtime n'existait pour Messages.

**Correctif** : `messagesApi.subscribeToMessages(communityId, onChange)` — un seul canal
Supabase par communauté (nom qualifié `abczed-messages-<communityId>`, deux communautés actives
n'entrent jamais en collision), couvrant à la fois `messages` et `message_reactions`. Filtre
serveur `community_id=eq.<id>` **plus** une garde défensive côté client (le payload reçu est
comparé à `communityId` avant de déclencher `onChange` — si le filtre serveur échouait pour une
raison quelconque, cette vérification empêche quand même qu'une notification étrangère ne
déclenche un rechargement pour la mauvaise communauté). `onChange` ne reçoit et n'utilise
JAMAIS le contenu du payload lui-même — contrat volontaire : "quelque chose a changé, recharge
l'état qui fait foi", jamais une fusion locale (brief explicite). `App.jsx` : effet dédié,
recréé au changement de communauté, nettoyé (`unsubscribe`) au démontage/déconnexion —
délibérément NON lié au montage/démontage de la page Messages elle-même (`view`), pour que
`hasLinkedThread` (P4) et l'aperçu du dernier message sur l'Accueil (P2) restent à jour même
hors de l'onglet Messages.

**Preuve — discriminante** : harnais isolation 5a-b (un point d'ancrage de test exposé par le
double `mockMessagesApi.js`, jamais présent en production — `window.__abczedHarnessTriggerMessagesRealtime`
— déclenche un rechargement réel après une modification simulée "venue d'un autre client") ;
6a-c (un seul abonnement actif pour toute la session, jamais recréé/accumulé à chaque
changement d'onglet, toujours fonctionnel après un aller-retour de navigation).

### Détail — P7, états/erreurs/non-régression UX

Transversal aux points ci-dessus. Rien de nouveau n'est ajouté par ce point seul ; il est
vérifié par la suite Playwright historique complète (`recette.mjs`, scénarios 1 à 40, exactement
les mêmes assertions que la V7.6 hors scénario 25 explicitement réécrit) **rejouée verte sans
aucune autre modification**, désormais contre le double réseau réel `mockMessagesApi.js` plutôt
que contre l'état React local d'avant ce lot — la preuve la plus directe que la connexion réelle
de Messages n'a régressé aucun comportement déjà validé (recherche, séparateurs de date,
alignement du fil, liens profonds Accueil↔Messages, navigation retour/focus/repère visuel,
non-régression Agenda/RSVP/Partages/La Bande).

### Détail — P8, tests SQL discriminants (PostgreSQL local jetable)

Méthode identique aux passes précédentes (jamais le Supabase réel) : PostgreSQL 16 local
jetable (`abczed_v77_repro`), schéma `auth` minimal (`auth.users`, `auth.uid()` lisant
`current_setting('request.jwt.claim.sub', true)`), rôles `anon`/`authenticated`/`service_role`
(`BYPASSRLS`), simulation d'un utilisateur authentifié via `set role authenticated; select
set_config('request.jwt.claim.sub', '<uuid>', true);` dans une transaction, jamais commitée
sauf quand le scénario l'exige explicitement.

Deux scripts scratch, non livrés (comme pour toutes les passes précédentes) :

- `sql_repro_tests.py` — **26 assertions fonctionnelles/sécurité** : isolation de communauté en
  lecture (RLS, pas un filtre applicatif), envoi dans sa communauté/refus dans une autre/refus
  d'usurpation d'auteur, liaison auteur/admin autorisée et refusée pour un simple membre,
  réactions (un membre peut réagir sans pouvoir modifier le message), une seule réaction
  active par personne (remplacement via `UPDATE`, retrait via `DELETE`), usurpation de
  `user_id` sur une réaction refusée, réaction intercommunauté refusée (clé étrangère
  composite), trigger d'immuabilité seul (superutilisateur, RLS non pertinente) bloque
  `user_id`/`message_id`, suppression en cascade, non-régression sql/02 (lien intercommunauté et
  anniversaire toujours bloqués), suppression d'un événement lié → lien remis à `NULL`.
- `sql_discriminating_tests.py` — **8 assertions**, sur les 4 garanties les plus critiques
  (policy `insert_own_reaction`, contrainte de clé étrangère composite, trigger d'immuabilité,
  contrainte `unique(message_id, user_id)`) : chacune est d'abord désactivée/retirée → l'attaque
  correspondante RÉUSSIT (preuve que le test initial testait bien quelque chose de réel, pas du
  théâtre) → restaurée → l'attaque échoue de nouveau.

**Base entièrement reconstruite pour la vérification finale de ce lot** (`setup_repro_db.sh`,
scratch, non livré) — schéma stub + `sql/01` à `sql/06` appliqués dans l'ordre + jeu de données
minimal, pour prouver que ces 34 assertions sont **reproductibles depuis zéro**, pas seulement
vraies sur une base déjà "rodée" par des essais précédents dans la même session. Migration
`sql/06` réappliquée une seconde fois sur cette base fraîche (idempotence) : aucune erreur, tous
les `NOTICE ... already exists, skipping` attendus.

**Résultat** : 34/34, 0 échec, sur une base reconstruite depuis zéro par un script réutilisable.

### Détail — P9, harnais, build, packaging

- **`test-harness/mockMessagesApi.js`** (nouveau) : double réseau complet pour
  `src/messagesApi.js` (aliasé via `vite.harness.config.js`, même mécanisme que
  `mockAgendaApi.js`/`mockAuth.jsx`) — reprend le CONTENU exact de l'ancien jeu de données de
  démonstration `GENERAL_THREAD` (mêmes ids `m0`/`m1`/`m2`/`m3`/`m4`/`m6`, mêmes textes) pour que
  tous les scénarios Playwright déjà écrits (recherche "piscine", badge `#msg-event-btn-m1`,
  réactions sur `#msg-row-m4`...) continuent d'exercer le même comportement observable, désormais
  via le vrai chemin réseau. L'ancien message `m5` (pièce jointe, `fileId`) n'est **pas** repris
  — brief explicite, "ne jamais exposer le PDF de démo dans le vrai fil", et `messagesApi.js`
  réel ne renvoie de toute façon jamais de `fileId` (aucune colonne pièce jointe dans
  `sql/02_rls.sql` pour `messages`). Persistance `sessionStorage` (même méthode que
  `mockAgendaApi.js`), leviers de test lus à chaque appel (`__abczed_harness_force_*`), point
  d'ancrage de test Realtime exposé sur `window` (jamais présent en production).
- **`vite.harness.config.js`** : nouvel alias regex pour `messagesApi`, même précaution que les
  deux alias existants (matcher la chaîne ENTIÈRE, pas seulement un suffixe — bug de harnais déjà
  corrigé en 7e passe pour un alias similaire).
- **`test-harness/main.jsx`** : `activeCommunity` reçoit désormais aussi `role` (lu depuis un
  levier de test `sessionStorage`, `'admin'` par défaut) — nécessaire pour tester le repli
  "membre non-admin" (P4) avec un chargement de page frais (`role` est figé au montage,
  contrairement aux drapeaux lus "à chaque appel" des autres doubles).
- **`test-harness/mockAuth.jsx`** : commentaire ajouté précisant que `session.user.id` DOIT
  rester `'test-user-1'` (synchronisé avec `mockMessagesApi.js`) — pas de changement de
  comportement.
- **`test-harness/recette.mjs`** : scénario 25 réécrit (assertions inversées — le texte réel du
  brief doit maintenant apparaître, l'ancien texte de démonstration doit avoir disparu) ; 4
  nouveaux scénarios (41-44 : envoi bout en bout, liaison à un vrai événement, recherche sans
  résultat, persistance après rechargement complet). **Tous les scénarios 1-40 préexistants
  rejoués sans aucune autre modification et restent verts** contre les données réelles.
- **`test-harness/recette-messages-isolation.mjs`** (nouveau) : 8 scénarios (15 assertions)
  nécessitant chacun un chargement de page FRAIS avec un levier de test posé AVANT navigation
  (`page.addInitScript`) — rôle admin/membre, erreur réseau forcée, fil vide, notification
  Realtime simulée — incompatibles avec la session Playwright continue de `recette.mjs` (qui
  réutilise une seule page pour tout son parcours).
- **`scripts/test-avatar-color.mjs`** (nouveau) : 16 assertions, module pur `src/avatarColor.js`.
- **Absence totale de `MOCK_THREAD`** : `GENERAL_THREAD` (`src/data.js`) reste défini dans ce
  fichier (non supprimé — minimise le diff, aucune autre donnée du fichier n'est touchée) mais
  n'est plus importé nulle part dans `src/` (`grep -rn "GENERAL_THREAD" src/` : 0 résultat hors
  commentaires) — confirmé absent du bundle de production par recherche directe d'un extrait de
  texte du jeu de données mock dans `dist/assets/*.js` après `npm run build` (0 occurrence).

### Fichiers touchés — ce lot (V7.7)

**Modifiés (9)** : `src/App.jsx` (état/effets Messages, `sendMessage`/`linkMessage`/
`toggleMessageReaction` réécrits, `hasLinkedThread` recalculé, bandeau global corrigé) ;
`src/dataSourceFlags.js` (nouveau drapeau `MESSAGES_FROM_SUPABASE`) ; `src/pages/Accueil.jsx`
(tri chronologique défensif du dernier message) ; `src/pages/Messages.jsx` (identité réelle,
envoi asynchrone, liaison aux vrais événements, bandeau/états dédiés) ; `src/reactions.js`
(commentaire d'en-tête mis à jour pour refléter le nouveau chemin réel — **aucun changement de
logique**, `reactionSummary`/`toggleReaction` inchangées, toujours testées identiquement) ;
`test-harness/main.jsx`, `test-harness/mockAuth.jsx`, `test-harness/recette.mjs`,
`vite.harness.config.js` (harnais de test, voir P9).

**Ajoutés (6)** : `sql/06_message_reactions.sql` ; `src/avatarColor.js` ; `src/messagesApi.js` ;
`scripts/test-avatar-color.mjs` ; `test-harness/mockMessagesApi.js` ;
`test-harness/recette-messages-isolation.mjs`.

**Aucun autre fichier touché** — en particulier : `sql/01` à `sql/05` (hashes SHA-256
identiques, ci-dessous), `public/` (dont le PDF de démonstration et le logo), `src/api.js`
(intact, plus aucun import nulle part), `src/agendaApi.js`, `src/data.js` (y compris
`GENERAL_THREAD`, non supprimé mais non importé, voir P9), Partages/La Bande (données et
écrans), `package.json`/`package-lock.json` (aucune dépendance nouvelle nécessaire — Supabase/
React/Playwright déjà présents), `README.md`, `index.html`, `.gitignore`, `.env.example`,
`.env.test.example`, `legacy/`, `vite.config.js`.

**Justification de chaque écart** : voir le détail narratif par point (P1-P9) ci-dessus —
chaque fichier modifié/ajouté y est rattaché au défaut précis qu'il corrige. Aucun fichier n'a
été touché "en passant" sans lien avec le périmètre Messages de ce lot.

### Vérification finale — V7.7 (chiffres qui font foi)

- **`npm install`** : succès, aucune dépendance manquante, aucune étape manuelle
  supplémentaire (Supabase/React/Playwright déjà déclarés en V7.6).
- **`npm run build`** : succès, aucune erreur ni avertissement bloquant.
- **Node (`node scripts/test-*.mjs`)** : **18 fichiers, 218 assertions, 0 échec** (202 de V7.6 +
  16 pour le nouveau `test-avatar-color.mjs`).
- **Playwright — `test-harness/recette.mjs`** (session continue, rôle admin par défaut) : **44
  scénarios, 166 assertions, 0 échec, 0 exception JavaScript capturée** (157 de V7.6, moins les
  3 assertions du scénario 25 réécrites puis remplacées par 4, plus 8 nouvelles pour les
  scénarios 41-44 : 157 − 3 + 4 + 8 = 166).
- **Playwright — `test-harness/recette-messages-isolation.mjs`** (nouveau, 8 scénarios à
  chargement de page frais) : **15 assertions, 0 échec, 0 exception JavaScript capturée**.
- **SQL discriminant** (`sql_repro_tests.py` + `sql_discriminating_tests.py`, PostgreSQL local
  jetable reconstruit depuis zéro via `setup_repro_db.sh`) : **34 assertions, 0 échec** (26 + 8).
- **Total automatisé, toutes catégories confondues : 433 assertions, 0 échec.**
- **Hash `sql/01_schema_and_helpers.sql`** :
  `9576fb48e2b61e613c659c88f574f7a5d62052971ecf204b3a2b1edbac65ebc7` — identique à V7.6.
- **Hash `sql/02_rls.sql`** :
  `0d40e9803f11424cbcecfeaf5c8263c690e56c760d1cb65c840affb32b93306c` — identique à V7.6.
- **Hash `sql/04_rsvp_headcount.sql`** :
  `3ea9863548bb66523dc2cb02c6d3b84a4731fc46c9475739431b941a4f9c7722` — identique à V7.6.
- **Hash `sql/05_participant_names.sql`** :
  `ef87be62654f255336b601f39356ae5d9abf7910f759e3bdbe4bdbb18b202db3` — identique à V7.6.
- **Hash `src/components/Logo.jsx`** :
  `2ff325af04370e59492d0b070ca447bc70cfadf4acc8f0701ce818ec01d03345` — identique à toutes les
  passes précédentes.
- **`sql/03_storage.sql`, `public/`, `package.json`, `package-lock.json`** : `diff`/`diff -rq`
  vides ce lot — strictement identiques à la V7.6.
- **Diff exhaustif de l'arborescence source vs V7.6** (`diff -rq`, hors `node_modules`/`dist`/
  `.env.local`, absents des deux) : exactement les 15 fichiers listés dans "Fichiers touchés"
  ci-dessus (9 modifiés + 6 ajoutés) — aucun autre écart, y compris ce document
  (`MATRICE_LIVRAISON.md`) et `GUIDE_VALIDATION_SUPABASE.md`, mis à jour séparément pour ce lot
  (nouvelle étape SQL n°6, nouvelle recette manuelle Messages en 8 points, nouvelle vérification
  Dashboard Realtime).
- **Aucun secret** : recherche de motifs (clés Supabase, `service_role`, URL de projet) sur
  l'ensemble des fichiers nouveaux/modifiés de ce lot → aucune occurrence ; `.env.local` absent
  du ZIP, seuls `.env.example`/`.env.test.example` (placeholders) présents, comme pour toutes
  les passes précédentes.

### Limites et éléments non vérifiés

- **Aucune opération, quelle qu'elle soit, n'a été exécutée contre le projet Supabase réel de
  l'utilisateur.** Toute vérification serveur (P5/P8) a été menée contre un PostgreSQL 16
  **local et jetable**, créé et détruit dans cet environnement, jamais connecté à un projet
  Supabase réel. La recette manuelle en 8 points ajoutée à `GUIDE_VALIDATION_SUPABASE.md`
  (section 9) est préparée mais **volontairement non exécutée** — elle nécessite un vrai projet
  Supabase avec des comptes réels, hors de portée de cet environnement.
- **Ajout à la publication Realtime `supabase_realtime`** : la tentative idempotente dans
  `sql/06` (ajout de `messages`/`message_reactions` à cette publication) n'a pas pu être
  vérifiée contre un vrai projet Supabase — elle suppose que la publication existe déjà (ce
  qui est le cas par défaut sur un projet Supabase standard, mais non garanti sur tout projet).
  Vérification manuelle demandée en section 8.3 de `GUIDE_VALIDATION_SUPABASE.md`.
- **`hasLinkedThread` transitoire** : au tout premier rendu d'une fiche événement, avant que
  `loadMessages()` n'ait terminé (`messagesLoading` encore `true`, `thread` encore vide),
  `hasLinkedThread` est temporairement recalculé à `false` même pour un événement réellement
  lié à des messages réels — le bouton "Voir la discussion liée" peut donc apparaître avec un
  très bref délai après l'affichage de la fiche, plutôt qu'instantanément. Non corrigé dans ce
  lot (comportement mineur, jamais un état durablement faux) ; signalé ici par honnêteté plutôt
  que passé sous silence.
- **Badge d'événement lié sans titre dans le harnais, cas spécifique** : le message de
  démonstration `m1` (repris du fil historique) reste lié à `evt-piscine`, délibérément exclu de
  l'agenda "live" du harnais depuis la 6e passe (pour exercer le repli `MOCK_EVENTS`
  d'`EventDetail`/Partages, sans lien avec Messages). Son badge affiche donc un libellé vide
  dans le harnais Playwright — comportement du CODE PRODUIT face à cette incohérence
  délibérément introuvable dans les vraies données de l'agenda, pas un bug : en production
  réelle, un message ne peut légitimement référencer qu'un événement de sa propre communauté
  (garanti par la contrainte de clé étrangère composite `events(id, community_id)` et le
  trigger `trg_check_message_event_link`, `sql/02`, non modifiés), ce cas ne se produit donc
  jamais avec de vraies données. Les nouveaux scénarios de ce lot (42a-d) lient délibérément un
  message à un événement réellement présent dans l'agenda "live" du harnais pour prouver la
  résolution correcte du titre dans le cas normal.
- **`sql/02_rls.sql` non idempotent** : signalé pour rappel (déjà noté en passes précédentes,
  non corrigé, hors périmètre de ce lot) — contrairement à `sql/06` (policies précédées de
  `drop policy if exists`), une ré-exécution de `sql/02` sur un projet où il a déjà été appliqué
  échouerait sur les `create policy` déjà existantes. `sql/01`, `sql/04`, `sql/05`, `sql/06`
  restent tous rejouables sans erreur.
- **Les 433 assertions automatisées de ce lot n'ont pas été rejouées par un tiers indépendant**
  dans cet échange (même limite que toutes les passes précédentes).
- **Contrôle visuel responsive (mobile/tablette/desktop) non refait ce lot** : aucune des
  modifications de ce lot ne touche à une zone de mise en page déjà vérifiée visuellement en
  V7.6 (uniquement la source des données et le câblage réseau de Messages, jamais sa structure
  visuelle, sa grille, ses couleurs de catégorie, sa navigation) — repris tel quel.

### Interdiction de livraison trompeuse — déclaration explicite

**Réellement connecté à Supabase dans ce lot** : lecture des messages (`fetchMessages`),
résolution des auteurs réels, envoi (`sendMessage`), liaison à un événement réel
(`linkMessageToEvent`), réactions (`toggleMessageReaction`, table normalisée
`message_reactions`), bandeau de confidentialité reflétant l'état réel, abonnement Realtime
(sous réserve de la publication `supabase_realtime`, voir limites ci-dessus).

**Restent volontairement des données locales/de démonstration, hors périmètre explicite de ce
lot** (brief : "Ce lot ne doit donc connecter que Messages") : **Partages** et **La Bande**,
toujours gouvernées par `BUSINESS_DATA_FROM_SUPABASE=false`, identiques pour toutes les
communautés — le bandeau global d'avertissement de tête d'application continue de le signaler
explicitement (texte corrigé ce lot pour ne plus mentionner "Messages,").

**Non implémenté, ni simulé, ni caché derrière une donnée de démonstration** : édition et
suppression de message (l'interface ne propose aucune de ces commandes, conformément au brief) ;
pièces jointes et messages vocaux sur Messages (boutons désactivés "Bientôt disponible", aucune
simulation d'envoi, jamais le PDF de démonstration exposé dans le vrai fil — voir P9).

### Recette réelle minimale — préparée, non exécutée

Voir `GUIDE_VALIDATION_SUPABASE.md`, section 9 ("Recette manuelle Messages (V7.7)") — 8 étapes
manuelles à exécuter par l'utilisateur lui-même contre son propre projet Supabase, après
application de `sql/06` (section 2, étape 6 du même guide). Non exécutée ici, comme précisé au
début de cette section.

---

# ABCZed — V7.8 (correctifs suite à contre-vérification indépendante de la V7.8/7.7)

## Contexte et périmètre

Le ZIP V7.7 a fait l'objet d'une **contre-vérification indépendante**, effectuée depuis une
extraction séparée du ZIP livré (pas depuis mon arborescence de travail). Résultat rapporté :
ZIP sain, installation et build réussis, 218/218 assertions Node réussies — mais **trois
blocages confirmés**, détaillés ci-dessous. Ce lot V7.8 les corrige, strictement dans le
périmètre déjà fixé par le brief V7.7 (Messages uniquement) : **aucune ligne d'Agenda, de
Partages ou de La Bande n'est touchée**, et **aucune opération n'a été exécutée contre le
Supabase réel de l'utilisateur** — les trois correctifs ont été vérifiés soit en navigateur réel
contre le harnais Playwright (jamais connecté à un vrai Supabase), soit contre un PostgreSQL
local jetable créé et détruit pour cette seule vérification.

Les trois points signalés par la contre-vérification, tels que rapportés, et leur statut après
ce lot :

| # | Blocage signalé | Statut après V7.8 |
|---|---|---|
| 1 | Tests SQL non reproductibles depuis le ZIP (`sql_repro_tests.py`, `sql_discriminating_tests.py`, `setup_repro_db.sh` absents du ZIP, décrits comme "scratch") | **Corrigé** — livrés dans `scripts/sql-tests/`, avec garde-fou anti-Supabase-réel intégré |
| 2 | Suppressions Realtime non garanties (`event: '*'` filtré sans `REPLICA IDENTITY FULL`) | **Corrigé** — `sql/07_realtime_replica_identity.sql`, preuve discriminante casser/restaurer |
| 3 | Accueil : faux état vide pendant chargement/erreur, date "Aujourd'hui" toujours affichée | **Corrigé** — `Accueil.jsx` reçoit désormais `messagesLoading`/`messagesError`, date réelle calculée |

Documentation également rectifiée (détail plus bas) : décompte exact du diff V7.6→V7.7 (17
fichiers, pas 15, comme signalé), en-têtes `test-harness/*` qui affirmaient à tort "PAS livré
dans le ZIP" pour des fichiers qui y sont, et clarification `npm install` (installe Playwright
lui-même) vs `npx playwright install chromium` (binaire navigateur, séparé).

## Tableau récapitulatif des correctifs V7.8

| Point | Fichier(s) | Défaut initial reproduit (V7.7) | Modification | Test discriminant | Résultat |
|---|---|---|---|---|---|
| Blocage 1 — Tests SQL non livrés | `scripts/sql-tests/{setup_repro_db.sh, repro_tests.py, discriminating_tests.py, _dsn_guard.py, README.md}` | Les 34 assertions SQL annoncées en V7.7 n'étaient reproductibles qu'à partir de fichiers de travail hors ZIP — impossible à rejouer depuis le ZIP livré | Les trois scripts sont copiés dans le ZIP, sous `scripts/sql-tests/`, avec un garde-fou (`_dsn_guard.py`) qui refuse tout DSN pointant vers un hôte distant ou une base non nommée `abczed_*_repro` | Extraction vierge du ZIP V7.8 → `bash scripts/sql-tests/setup_repro_db.sh` → `python3 scripts/sql-tests/repro_tests.py`/`discriminating_tests.py` → tentative volontaire avec un DSN Supabase factice et un nom de base non jetable | ✅ 40/40 assertions SQL rejouées depuis le ZIP ; garde-fou confirmé refusant les deux DSN invalides testés (`exit=2` dans les deux cas) |
| Blocage 2 — DELETE Realtime non garanti | `sql/07_realtime_replica_identity.sql` (nouveau) | `messages`/`message_reactions` sans `REPLICA IDENTITY FULL` — un `DELETE` filtré par `community_id` ne transmet pas cette colonne dans la ligne supprimée (documenté par Supabase), le filtre ne matche donc jamais un vrai `DELETE` | Migration additive `sql/07` : `alter table ... replica identity full` sur les deux tables, idempotente, appliquée après `sql/06` | `discriminating_tests.py`, guarantee 5 : repasse les deux tables en `REPLICA IDENTITY DEFAULT` → `relreplident != 'f'` confirmé (régression prouvée) → restaure en `FULL` → `relreplident = 'f'` reconfirmé | ✅ cassé 5a/5b + restauré 5c/5d, 4/4 assertions |
| Blocage 3 — Accueil : faux état vide + date mensongère | `src/pages/Accueil.jsx`, `src/App.jsx`, `src/dateLabels.js` (nouveau) | `Accueil.jsx` ne recevait ni `messagesLoading` ni `messagesError` (chargement/erreur affichés à tort comme "Aucun message pour l'instant.") ; date du dernier message toujours affichée "Aujourd'hui à HH:MM", même pour un message d'hier ou plus ancien | `App.jsx` transmet désormais les deux états à `Accueil.jsx`, qui distingue chargement / erreur / vide-après-succès ; nouvelle fonction partagée `dateSeparatorLabel` (`src/dateLabels.js`, extraite de `Messages.jsx`) calcule Aujourd'hui/Hier/date réelle pour le dernier message | 4 nouveaux scénarios Playwright (`recette-messages-isolation.mjs`, 9-12) : chargement observé via délai artificiel, erreur réseau forcée, fil vide après succès, message daté d'hier | ✅ 9a-9c, 10a-10b, 11a-11b, 12a-12b — 9/9 assertions, 0 échec |

## Détail des correctifs

### Blocage 1 — Tests SQL livrés dans le ZIP, avec garde-fou

**Constat.** `MATRICE_LIVRAISON.md` (V7.7) reconnaissait déjà que `sql_repro_tests.py`,
`sql_discriminating_tests.py` et `setup_repro_db.sh` étaient des fichiers de travail non copiés
dans le ZIP — mais cela rendait de fait les 34 assertions SQL alors annoncées **non
reproductibles** par quiconque n'a pas accès à mon environnement de travail, ce qui contredit
l'esprit de P8/P9 (preuves indépendamment rejouables) même si la matrice le disait
explicitement. Signalé à raison par la contre-vérification.

**Correctif.** Les trois scripts sont désormais dans `scripts/sql-tests/`, à l'intérieur du ZIP :
- `setup_repro_db.sh` — reconstruit la base locale jetable (stub `auth`, rôles, `sql/01` à
  `sql/07`, jeu de données fixe). Refuse tout nom de base qui ne correspond pas au motif
  `abczed_*_repro`, et n'accepte structurellement aucun paramètre d'hôte distant (seul
  `sudo -u postgres psql`, toujours local, est utilisé).
- `repro_tests.py` (28 assertions) et `discriminating_tests.py` (12 assertions, dont le nouveau
  cycle REPLICA IDENTITY, voir Blocage 2) — chacun importe `_dsn_guard.py`, qui **refuse de se
  connecter** si le DSN ne pointe pas vers un hôte local (socket Unix ou `localhost`/`127.0.0.1`)
  ET un nom de base `abczed_*_repro`. Une variable d'environnement `ABCZED_SQL_TEST_DSN` permet
  d'adapter le DSN à un autre environnement local sans jamais contourner ce garde-fou.
- `README.md` (`scripts/sql-tests/`) documente les prérequis (PostgreSQL local, `psycopg2-binary`)
  et la commande exacte pour tout rejouer depuis une extraction vierge.

**Preuve.** Voir "Vérification finale" plus bas pour le rejeu complet depuis l'extraction vierge
du ZIP V7.8 (40/40, 0 échec), et le test explicite du garde-fou (DSN Supabase factice et nom de
base non jetable, tous deux refusés avec `exit=2`, aucune connexion tentée).

### Blocage 2 — REPLICA IDENTITY FULL (DELETE Realtime filtré)

**Constat.** `messagesApi.js` s'abonne avec `event: '*'` et un filtre serveur
`community_id=eq.<id>`. Documentation Supabase à l'appui, un événement `DELETE` ne transmet par
défaut que les colonnes de la clé de réplication (la clé primaire seule, sans
`REPLICA IDENTITY FULL`) — `community_id` n'aurait alors jamais figuré dans la ligne supprimée
transmise, et le filtre n'aurait donc **jamais matché un vrai `DELETE`**, silencieusement. Le
test Realtime déjà livré en V7.7 ne pouvait pas détecter ce trou : le mock du harnais appelle
directement `onChange`/le rechargement, sans jamais passer par une vraie réplication logique
PostgreSQL filtrée — il exerce le câblage React, pas la garantie serveur elle-même.

Ce n'est pas un cas théorique : **retirer une réaction** (`message_reactions`, bouton "retirer sa
réaction" en retapant la même pastille) déclenche un vrai `DELETE` — c'est le seul chemin de
suppression réellement atteignable depuis l'interface (le brief interdit toute UI
d'édition/suppression de message). Sans ce correctif, une réaction retirée par un autre compte ne
disparaissait pas en direct chez les autres membres connectés au fil.

**Correctif.** `sql/07_realtime_replica_identity.sql`, migration additive : `alter table
messages replica identity full` et `alter table message_reactions replica identity full`,
protégées par une vérification d'existence des tables (`to_regclass`) pour rester rejouable même
appliquée avant `sql/06` par erreur.

**Preuve.** `discriminating_tests.py`, 5e garantie : repasser les deux tables en
`REPLICA IDENTITY DEFAULT` fait passer `relreplident` de `'f'` à `'d'` (régression prouvée,
cassé 5a/5b), restaurer en `FULL` reconfirme `relreplident = 'f'` (restauré 5c/5d). `repro_tests.py`
confirme aussi l'état attendu à froid (p7-1, p7-2). `GUIDE_VALIDATION_SUPABASE.md` (section 8.3
et nouvelle étape 9 de la recette manuelle) documente comment l'utilisateur peut vérifier ce
réglage sur son propre projet Supabase, et comment observer concrètement la propagation d'un
retrait de réaction entre deux comptes.

### Blocage 3 — Accueil : états dédiés + date réelle

**Constat.** `App.jsx` calcule bien `messagesLoading`/`messagesError` (utilisés par
`Messages.jsx` depuis la V7.7), mais ne les transmettait **pas** à `Accueil.jsx`, qui ne recevait
que `thread`. Résultat : pendant le chargement initial ou après un échec réseau, `thread` restait
`[]`, et le bloc "Derniers messages" affichait à tort *"Aucun message pour l'instant."* — un état
vide honnête confondu avec un chargement en cours ou une vraie panne. Séparément,
`lastMessage.time` était affiché sous la forme figée *"Aujourd'hui à {time}"*, sans jamais
vérifier la vraie date (`lastMessage.date`) du message — un message d'hier ou de la semaine
dernière s'affichait donc, à tort, comme envoyé aujourd'hui.

**Correctif.**
- `App.jsx` transmet désormais `messagesLoading`/`messagesError` à `<Accueil>`, exactement comme
  à `<Messages>`.
- `Accueil.jsx` distingue maintenant trois états mutuellement exclusifs pour "Derniers messages" :
  erreur réelle (même style de bandeau que `Messages.jsx`) → chargement (*"Chargement des
  messages…"*) → fil vide après lecture réussie (*"Aucun message pour l'instant."*, désormais le
  SEUL cas où ce texte apparaît).
- `src/dateLabels.js` (nouveau) extrait `dateSeparatorLabel` — auparavant définie localement dans
  `Messages.jsx` — en module partagé. `Accueil.jsx` l'utilise désormais pour calculer
  Aujourd'hui/Hier/date complète à partir de la vraie date du dernier message, au lieu du texte
  figé. `Messages.jsx` importe la même fonction (aucune duplication, aucun risque de divergence
  future entre les deux écrans).

**Preuve.** 4 nouveaux scénarios Playwright (`recette-messages-isolation.mjs`, 9 à 12) :
chargement observé via un délai artificiel posé par un nouveau levier de harnais
(`__abczed_harness_delay_messages_fetch_ms__`, lu par `mockMessagesApi.fetchMessages` avant de
répondre, succès ou échec), erreur réseau forcée (réutilise le levier V7.7 existant), fil
réellement vide après succès, et dernier message daté de la veille (date calculée au moment du
test, jamais codée en dur, pour rester valide quel que soit le jour d'exécution) — vérifiant
l'étiquette "Hier à 11:30" et l'absence de "Aujourd'hui à 11:30" pour ce même message.

## Fichiers touchés (V7.8)

**Diff V7.7 → V7.8** (extraction vierge V7.7 comme référence) — **17 fichiers** :

Modifiés (10) : `GUIDE_VALIDATION_SUPABASE.md`, `README.md`, `src/App.jsx`,
`src/pages/Accueil.jsx`, `src/pages/Messages.jsx`, `test-harness/main.jsx`,
`test-harness/mockAgendaApi.js`, `test-harness/mockAuth.jsx`, `test-harness/mockMessagesApi.js`,
`test-harness/recette-messages-isolation.mjs` (ces quatre derniers : uniquement le commentaire
d'en-tête erroné "PAS livré dans le ZIP" corrigé, plus le levier de délai pour
`mockMessagesApi.js` et les 4 nouveaux scénarios pour `recette-messages-isolation.mjs`).

Ajoutés (7) : `sql/07_realtime_replica_identity.sql`, `src/dateLabels.js`,
`scripts/sql-tests/setup_repro_db.sh`, `scripts/sql-tests/_dsn_guard.py`,
`scripts/sql-tests/repro_tests.py`, `scripts/sql-tests/discriminating_tests.py`,
`scripts/sql-tests/README.md`.

**Diff cumulatif V7.6 → V7.8** (extraction pristine V7.6 comme référence) — **26 fichiers**, dont
`MATRICE_LIVRAISON.md` lui-même (documentation, mis à jour à chaque lot) : 13 modifiés + 13
ajoutés (le compte exact V7.6→V7.7 était de 17, pas 15 comme initialement écrit dans la section
V7.7 de cette matrice — l'écart venait d'un oubli des deux fichiers de documentation
`GUIDE_VALIDATION_SUPABASE.md`/`MATRICE_LIVRAISON.md` eux-mêmes dans le décompte "fichiers
touchés" de cette matrice, alors qu'ils apparaissent bien dans un diff brut — corrigé ici,
signalé par contre-vérification indépendante). Aucun fichier de `sql/01` à `sql/05`, aucun
fichier Agenda (`agendaApi.js`, `Agenda.jsx`, `EventDetail.jsx`...), aucun fichier Partages/La
Bande n'apparaît dans l'un ou l'autre diff — confirmé par les hashes ci-dessous.

## Vérification finale (V7.8) — résultats séparés par catégorie

Rejoué intégralement depuis une **extraction vierge** du ZIP `ABCZed_v7.8.zip` (nouveau dossier,
`npm install` puis `npm run build` depuis zéro — jamais depuis l'arborescence de travail) :

**Node** (`node scripts/test-*.mjs`, 18 fichiers) : **218 assertions, 0 échec** — inchangé par
rapport à la V7.7 (aucun de ces fichiers n'a été modifié par ce lot).

**Playwright** (Chromium headless, `npx vite --config vite.harness.config.js` +
`node test-harness/recette.mjs` + `node test-harness/recette-messages-isolation.mjs`) :
- `recette.mjs` — 44 scénarios, **166 assertions, 0 échec** (inchangé, aucune régression).
- `recette-messages-isolation.mjs` — 12 scénarios (8 repris de la V7.7 + 4 nouveaux, V7.8),
  **24 assertions, 0 échec**.
- **Total Playwright : 190 assertions, 0 échec.**

**SQL** (`scripts/sql-tests/`, contre un PostgreSQL local jetable reconstruit depuis les fichiers
`sql/*.sql` de cette même extraction vierge — jamais contre le Supabase réel) :
- `repro_tests.py` — **28 assertions, 0 échec** (26 reprises de la V7.7 + 2 nouvelles, `sql/07`).
- `discriminating_tests.py` — **12 assertions, 0 échec** (8 reprises + 4 nouvelles, cycle
  REPLICA IDENTITY).
- **Total SQL : 40 assertions, 0 échec.**
- Garde-fou `_dsn_guard.py`/`setup_repro_db.sh` testé explicitement avec un DSN pointant vers un
  faux hôte `*.supabase.co` et avec un nom de base non jetable (`production`,
  `production_db`) : les trois refusent de s'exécuter (`exit=2`), aucune tentative de connexion
  n'est faite dans ces deux cas.

**Total général : 448 assertions, 0 échec.**

**Hashes SHA-256** (recalculés depuis l'extraction vierge du ZIP V7.8, reconfirmant l'absence de
toute modification sur les fichiers déjà validés en V7.5/V7.6) :
- `sql/01_schema_and_helpers.sql` : `9576fb48e2b61e613c659c88f574f7a5d62052971ecf204b3a2b1edbac65ebc7`
- `sql/02_rls.sql` : `0d40e9803f11424cbcecfeaf5c8263c690e56c760d1cb65c840affb32b93306c`
- `sql/04_rsvp_headcount.sql` : `3ea9863548bb66523dc2cb02c6d3b84a4731fc46c9475739431b941a4f9c7722`
- `sql/05_participant_names.sql` : `ef87be62654f255336b601f39356ae5d9abf7910f759e3bdbe4bdbb18b202db3`
- `src/components/Logo.jsx` : `2ff325af04370e59492d0b070ca447bc70cfadf4acc8f0701ce818ec01d03345`

Toutes identiques à la V7.6 — confirme qu'Agenda et les fichiers déjà validés n'ont pas été
rouverts par ce lot correctif.

## Limites et éléments non vérifiés (V7.8)

- **Toujours non vérifiable directement** : que la publication Realtime `supabase_realtime`
  existe réellement, sous ce nom, sur le projet Supabase de l'utilisateur — aucun accès à ce
  projet. `sql/06`/`sql/07` gèrent ce cas sans erreur si la publication n'existe pas encore ; la
  vérification reste manuelle (`GUIDE_VALIDATION_SUPABASE.md`, section 8.3).
- **REPLICA IDENTITY FULL vérifié au niveau du réglage PostgreSQL** (`relreplident`), pas au
  niveau d'une vraie notification Realtime WebSocket reçue par un client Supabase réel — aucun
  accès à un projet Supabase réel pour aller plus loin que cette preuve SQL directe. C'est
  exactement le niveau de preuve que le point signalé demandait explicitement
  ("Ajouter un test SQL vérifiant `pg_class.relreplident = 'f'`").
- Le délai artificiel du scénario Playwright 9 (600 ms) est arbitraire — suffisant pour observer
  l'état de façon fiable dans cet environnement, mais reste un délai de test, pas une preuve de
  temps de réponse réseau réel.
- Reprend les limites déjà déclarées dans la section V7.7 de cette matrice (non modifiées par ce
  lot) : pas de contrôle manuel responsive refait, pas de rejeu par un tiers indépendant au-delà
  de la contre-vérification déjà reçue et traitée ici.

## Interdiction de livraison trompeuse (rappel, V7.8)

Ce lot est strictement correctif : aucune nouvelle fonctionnalité, aucune réouverture d'Agenda,
Partages ou La Bande. Les trois points signalés par la contre-vérification indépendante sont
chacun corrigés et prouvés par un test automatisé dédié, rejoué depuis une extraction vierge du
ZIP livré — pas seulement depuis l'arborescence de travail. Aucune opération, à aucun moment de
ce lot, n'a été exécutée contre le Supabase réel de l'utilisateur — uniquement contre un
PostgreSQL local jetable (créé et détruit pour cette seule vérification) et contre le harnais
Playwright (navigateur réel, jamais connecté à un vrai Supabase).

### Recette manuelle — mise à jour

Voir `GUIDE_VALIDATION_SUPABASE.md`, section 9 : reprend les 8 étapes de la V7.7 et ajoute une
**étape 9** dédiée à la vérification de la propagation `DELETE` (retrait d'une réaction, observé
en direct entre deux comptes) — c'est le scénario réel que `sql/07` corrige. Non exécutée par
moi, comme le reste de cette section, faute d'accès au Supabase réel de l'utilisateur.

---

# ABCZed — V7.9 (contournement du garde-fou SQL, corrigé)

## Contexte

Le garde-fou `_dsn_guard.py` livré en V7.8 a été contourné avec succès par contre-vérification
indépendante, sur exactement les trois cas suivants — tous les trois désormais bloqués :

| Contournement testé | V7.8 | V7.9 |
|---|---|---|
| `host=localhost host=db.example.supabase.co ...` (clé `host` répétée) | Accepté (`exit=0`) | **Refusé** (`exit=2`) |
| `host=localhost hostaddr=203.0.113.10 ...` | Accepté (`exit=0`) | **Refusé** (`exit=2`) |
| `dbname=abczed_v78_repro dbname=production ...` (clé `dbname` répétée) | Accepté (`exit=0`) | **Refusé** (`exit=2`) |

**Cause exacte.** La version V7.8 du garde-fou lisait le DSN avec une expression régulière
(`re.search(r"host=(\S+)", dsn)`), qui capture la PREMIÈRE occurrence d'une clé. Or, dans un DSN
libpq de type "keyword/value", quand une clé est répétée, c'est la **dernière** valeur qui
l'emporte réellement à la connexion — documenté explicitement par PostgreSQL :
[libpq-connect §32.1.2](https://www.postgresql.org/docs/current/libpq-connect.html). Vérifié ici
directement avec `psycopg2.extensions.parse_dsn()` :
`parse_dsn('host=localhost host=db.example.supabase.co dbname=abczed_v78_repro user=postgres')`
renvoie `{'host': 'db.example.supabase.co', ...}` — la regex du garde-fou V7.8 ne voyait que
`localhost` (le premier match) et laissait donc passer un DSN qui se serait réellement connecté
à un hôte distant. Même défaut pour `dbname` répété. `hostaddr` — qui impose l'adresse IP
réellement contactée, **indépendamment** de `host` (qui ne sert plus alors qu'à SSL/
l'authentification) — n'était par ailleurs vérifié nulle part par la version V7.8.

Ce blocage a empêché toute validation finale de la V7.8, à raison : un garde-fou de sécurité
contournable par une syntaxe DSN standard, documentée, n'est pas une protection réelle. Le rejeu
`npm install` complet depuis une extraction vierge n'a pas non plus pu être terminé côté
contre-vérification — repris intégralement dans ce lot (voir "Vérification finale").

## Correctif

`scripts/sql-tests/_dsn_guard.py` est réécrit :

1. **Le DSN n'est plus jamais lu à la main.** Il est analysé par
   `psycopg2.extensions.parse_dsn()`, qui applique exactement les mêmes règles de résolution que
   libpq lui-même (dont "dernière valeur gagne" pour une clé répétée, et la prise en charge native
   de la forme URI `postgresql://...`). La valeur vérifiée est donc **garantie identique** à
   celle que `psycopg2.connect()` utilisera réellement — jamais une approximation textuelle.
2. **`hostaddr`, `service`, `servicefile` sont désormais des clés explicitement interdites** dans
   le DSN lui-même : chacune peut rediriger la connexion réelle sans que `host`/`dbname` en
   disent quoi que ce soit (`service`/`servicefile` chargent une configuration depuis un fichier
   externe, dont le contenu n'apparaît nulle part dans le DSN).
3. **Les variables d'environnement `PGHOSTADDR`, `PGSERVICE`, `PGSERVICEFILE` sont également
   refusées** si définies — même risque que le point 2, mais invisible dans le DSN lui-même
   (libpq les lit directement si le DSN ne les surcharge pas).
4. La logique de vérification est extraite dans une fonction pure `check_dsn(dsn, env) -> (bool,
   raison)`, séparée de `resolve_and_guard_dsn()` (qui l'appelle puis `sys.exit(2)` si refusé) —
   pour rester directement testable sans intercepter un `sys.exit()` ni lancer un sous-processus.

**Nouveau fichier de tests dédié** : `scripts/sql-tests/test_dsn_guard.py`, **20 assertions**,
n'ouvre aucune connexion ni base de données (teste `check_dsn()` directement). Couvre
explicitement chacun des trois contournements confirmés (clé répétée avec dernière valeur locale
ET distante — pour vérifier que la règle porte bien sur la valeur *effective* et ne refuse pas
bêtement toute répétition —, `hostaddr`, `service`, `servicefile`, les trois variables
d'environnement, la forme URI, et un DSN syntaxiquement invalide qui ne doit jamais faire planter
le script).

## Preuve — rejeu exact des trois contournements signalés

Rejoué avec `resolve_and_guard_dsn()` (le point d'entrée réellement utilisé par
`repro_tests.py`/`discriminating_tests.py`), pas seulement `check_dsn()` :

```
host=localhost host=db.example.supabase.co dbname=abczed_v78_repro user=postgres
  -> REFUS (résolu : host='db.example.supabase.co'), exit=2

host=localhost hostaddr=203.0.113.10 dbname=abczed_v78_repro user=postgres
  -> REFUS (paramètre 'hostaddr' interdit), exit=2

dbname=abczed_v78_repro dbname=production host=/var/run/postgresql user=postgres
  -> REFUS (résolu : dbname='production'), exit=2
```

Les trois DSN précédemment acceptés en V7.8 sont désormais refusés, sans exception, sans avoir
ouvert la moindre connexion (le refus intervient avant tout appel à `psycopg2.connect()`).

## Fichiers touchés (V7.9)

**Diff V7.8 → V7.9** (extraction vierge V7.8 comme référence) — **3 fichiers** :

Modifiés (2) : `scripts/sql-tests/_dsn_guard.py` (réécriture du garde-fou), `scripts/sql-tests/README.md`
(documentation du contournement corrigé et de la nouvelle commande de rejeu).

Ajoutés (1) : `scripts/sql-tests/test_dsn_guard.py`.

Aucun autre fichier n'est modifié par ce lot — en particulier, `repro_tests.py` et
`discriminating_tests.py` sont strictement inchangés (ils importent déjà `_dsn_guard` sans
connaître son implémentation interne), tout comme `setup_repro_db.sh`, tous les fichiers
`sql/*.sql`, et l'intégralité du code applicatif (`src/`) et du harnais Playwright
(`test-harness/`) déjà validés en V7.8.

## Vérification finale (V7.9) — résultats séparés par catégorie

Rejoué intégralement depuis une **nouvelle extraction vierge** du ZIP `ABCZed_v7.9.zip` (`npm
install` mené à son terme cette fois, puis `npm run build`, depuis zéro) :

**Node** (18 fichiers) : **218 assertions, 0 échec** — inchangé (aucun fichier Node modifié par
ce lot).

**Playwright** : `recette.mjs` — **166 assertions, 0 échec** ; `recette-messages-isolation.mjs`
— **24 assertions, 0 échec**. **Total Playwright : 190 assertions, 0 échec** — inchangé (aucun
fichier applicatif ni harnais modifié par ce lot, qui ne touche que `scripts/sql-tests/`).

**SQL** (`scripts/sql-tests/`, contre un PostgreSQL local jetable reconstruit depuis les fichiers
`sql/*.sql` de cette même extraction vierge) :
- `test_dsn_guard.py` (nouveau) — **20 assertions, 0 échec**.
- `repro_tests.py` — **28 assertions, 0 échec** (inchangé).
- `discriminating_tests.py` — **12 assertions, 0 échec** (inchangé).
- **Total SQL : 60 assertions, 0 échec.**
- **Rejeu exact des trois contournements signalés** (voir ci-dessus) : les trois DSN
  précédemment acceptés en V7.8 sont refusés (`exit=2`) depuis les scripts de CETTE extraction
  vierge, pas seulement depuis l'arborescence de travail.

**Total général : 448 (V7.8) + 20 (nouveau) = 468 assertions, 0 échec.**

Hashes SHA-256 de `sql/01`, `sql/02`, `sql/04`, `sql/05` et `src/components/Logo.jsx` : identiques
à ceux déjà publiés en V7.7/V7.8 (aucun de ces fichiers n'a été touché par ce lot ni le
précédent) — non reproduits ici, voir la section V7.8 ci-dessus.

## Limites et éléments non vérifiés (V7.9)

- Le garde-fou couvre les vecteurs de redirection de connexion documentés par libpq
  (`hostaddr`, `service`/`servicefile`, clés répétées, variables d'environnement
  `PGHOSTADDR`/`PGSERVICE`/`PGSERVICEFILE`) — je n'ai pas d'assurance qu'il n'existe aucun autre
  mécanisme libpq, présent ou futur, capable de rediriger une connexion sans passer par l'un de
  ces canaux ; c'est un point qui resterait à surveiller si `psycopg2`/libpq introduit de
  nouveaux paramètres de connexion.
- Ce garde-fou protège les scripts `scripts/sql-tests/*.py` spécifiquement. `setup_repro_db.sh`
  (bash) n'a jamais été concerné par ce contournement : il n'accepte aucun DSN ni paramètre
  d'hôte, et utilise exclusivement `sudo -u postgres psql` en local — sa propre vérification
  (regex sur le nom de base uniquement, pas sur un DSN) reste inchangée et suffisante pour ce
  qu'il fait réellement.
- Reprend telles quelles les limites déjà déclarées dans les sections V7.7/V7.8 de cette matrice,
  non affectées par ce lot.

## Interdiction de livraison trompeuse (rappel, V7.9)

Ce lot corrige exclusivement le garde-fou SQL signalé comme contournable — aucune autre
modification, aucune réouverture d'Agenda, Messages (au-delà de `scripts/sql-tests/`), Partages
ou La Bande. Le rejeu complet (`npm install` jusqu'au bout, build, 448 assertions déjà vertes en
V7.8 reconfirmées + 20 nouvelles) a été effectué depuis une extraction vierge du ZIP `ABCZed_v7.9.zip`
livré ici — pas seulement depuis l'arborescence de travail. Aucune opération, à aucun moment de ce
lot, n'a été exécutée contre le Supabase réel de l'utilisateur.

---

# ABCZed — V7.10 (quatrième contournement du garde-fou SQL, corrigé structurellement)

## Contexte

Un quatrième contournement du garde-fou `_dsn_guard.py` a été confirmé par contre-vérification
indépendante sur le ZIP V7.9 :

```
host=/var/run/postgresql,evil.supabase.co dbname=abczed_v78_repro
```

passait le garde-fou V7.9. **Cause exacte** : la vérification V7.9 testait
`host.startswith("/")`, qui renvoie `True` pour cette valeur (elle commence bien par `/`). Mais
libpq accepte plusieurs hôtes séparés par une **virgule** dans le paramètre `host` lui-même —
une liste de bascule : le premier hôte est essayé, puis le suivant si le premier échoue,
documenté :
[libpq-connect §32.1.2, "Specifying Multiple Hosts"](https://www.postgresql.org/docs/current/libpq-connect.html).
`host=/var/run/postgresql,evil.supabase.co` se serait donc bien connecté localement en premier,
mais aurait tenté `evil.supabase.co` si le socket local échouait — un vecteur de redirection que
`host.startswith("/")` ne pouvait par construction pas détecter.

Deux points ont, à raison, empêché toute validation de la V7.9 : ce quatrième contournement, et
une erreur de décompte dans la section V7.9 de cette matrice elle-même — le diff V7.8→V7.9 annoncé
à 3 fichiers en comptait en réalité 4, `MATRICE_LIVRAISON.md` ayant lui-même changé (exactement
l'erreur que la section V7.8 de cette matrice avait pourtant déjà signalée et corrigée une
première fois, pour le diff V7.6→V7.7 — reproduite ici par inattention). Les deux sont traités
dans ce lot.

## Correctif — suppression structurelle du DSN en chaîne

Trois versions successives de ce garde-fou (V7.8, V7.9) ont chacune été contournées par une
propriété *différente* de la syntaxe DSN/`host` de libpq : clé répétée, puis liste multi-hôtes
séparée par virgule. Continuer à corriger ces cas un par un aurait presque certainement laissé
filtrer un cinquième contournement (libpq a d'autres subtilités de syntaxe — IPv6 entre crochets,
échappement par guillemets simples, etc.). Ce lot applique donc le correctif structurel déjà
recommandé par la contre-vérification indépendante lors du lot précédent : **il n'existe plus de
DSN en chaîne du tout.**

`scripts/sql-tests/_dsn_guard.py` est réécrit une troisième fois :
- Seuls deux paramètres individuels sont acceptés, chacun validé par une **liste blanche
  stricte** (jamais une liste noire de caractères interdits) : `host` (exactement `localhost`,
  exactement `127.0.0.1`, ou un chemin de socket Unix absolu à un seul composant — aucune
  virgule, espace, point-virgule ni signe `=` autorisé) et `dbname` (exactement le motif
  `abczed_*_repro`).
- `user` est fixé en dur à `postgres` (jamais lu depuis une entrée externe).
- La connexion est ouverte avec `psycopg2.connect(host=..., dbname=..., user=...)` — des
  arguments nommés transmis tels quels à libpq (`PQconnectdbParams`), **jamais réassemblés en une
  chaîne "clé=valeur"** que libpq pourrait ensuite réinterpréter. Ceci ferme structurellement
  toute la classe de contournements par manipulation de chaîne (clé dupliquée, valeur
  multi-hôtes, smuggling d'une clé dans la valeur d'une autre) — plus seulement les deux cas
  déjà rencontrés.
- La variable d'environnement `ABCZED_SQL_TEST_DSN` (DSN libre) est **retirée**, remplacée par
  `ABCZED_SQL_TEST_HOST`/`ABCZED_SQL_TEST_DBNAME` (deux valeurs individuelles, chacune revalidée
  par la même liste blanche).
- `repro_tests.py` et `discriminating_tests.py` n'appellent plus `psycopg2.connect(DSN)` :
  chaque connexion passe désormais par `guarded_connect()` (nouvelle fonction exportée par
  `_dsn_guard.py`), qui revalide host/dbname à chaque appel.

**Nouveau fichier de tests** : `scripts/sql-tests/test_dsn_guard.py` réécrit pour le nouveau
modèle — **26 assertions**, dont un rejeu direct des DSN/host historiquement contournés en V7.8
et V7.9 (traduits dans le nouveau modèle host/dbname séparés), et une section d'intégration qui
lance un **vrai sous-processus Python** appelant `resolve_and_guard_connect_kwargs()` (le point
d'entrée réellement utilisé par `guarded_connect()`) pour observer, de l'extérieur, le code de
sortie `2` sur le contournement V7.9 exact — pas seulement la valeur booléenne d'une fonction
interne.

## Preuve — rejeu exact du contournement signalé

Depuis les scripts livrés dans l'extraction vierge du ZIP V7.10, via `resolve_and_guard_connect_kwargs()` (le point d'entrée réel) :

```
ABCZED_SQL_TEST_HOST="/var/run/postgresql,evil.supabase.co" ABCZED_SQL_TEST_DBNAME="abczed_v78_repro" \
  python3 -c "from _dsn_guard import resolve_and_guard_connect_kwargs as f; f()"
  -> REFUS (host='/var/run/postgresql,evil.supabase.co' ne correspond à aucune valeur autorisée
     de la liste blanche), exit=2
```

## Fichiers touchés (V7.10) — décompte vérifié deux fois

**Diff V7.9 → V7.10** (extraction vierge V7.9 comme référence, recompté explicitement pour éviter
l'erreur signalée sur le lot précédent) — **6 fichiers**, `MATRICE_LIVRAISON.md` INCLUS dans ce
compte cette fois :

Modifiés (6) : `scripts/sql-tests/_dsn_guard.py` (réécriture complète), `scripts/sql-tests/repro_tests.py`
et `scripts/sql-tests/discriminating_tests.py` (remplacement de `psycopg2.connect(DSN)` par
`guarded_connect()`, aucune autre ligne changée), `scripts/sql-tests/README.md`,
`scripts/sql-tests/test_dsn_guard.py` (réécriture complète pour le nouveau modèle), et
`MATRICE_LIVRAISON.md` (cette section).

Ajoutés (0). Aucun fichier applicatif (`src/`), harnais Playwright (`test-harness/`), ni SQL
(`sql/*.sql`) n'est touché par ce lot — strictement `scripts/sql-tests/` et cette matrice.

## Vérification finale (V7.10) — résultats séparés par catégorie

Rejoué depuis une extraction vierge du ZIP `ABCZed_v7.10.zip` :

**Node** : 218 assertions, 0 échec (inchangé, aucun fichier Node touché).

**Playwright** : `recette.mjs` 166 + `recette-messages-isolation.mjs` 24 = 190 assertions,
0 échec (inchangé, aucun fichier applicatif ni harnais touché).

**SQL** (`scripts/sql-tests/`) :
- `test_dsn_guard.py` (nouveau contenu) — **26 assertions, 0 échec**.
- `repro_tests.py` — **28 assertions, 0 échec** (inchangé fonctionnellement, connexion via
  `guarded_connect()`).
- `discriminating_tests.py` — **12 assertions, 0 échec** (idem).
- **Total SQL : 66 assertions, 0 échec.**
- Rejeu exact du contournement V7.9 signalé (voir ci-dessus) : refusé, `exit=2`, depuis les
  scripts de cette extraction vierge.

**Total général : 218 + 190 + 66 = 474 assertions, 0 échec.**

Hashes SHA-256 de `sql/01`, `sql/02`, `sql/04`, `sql/05` et `src/components/Logo.jsx` : inchangés
depuis la V7.7 (aucun de ces fichiers touché par les lots V7.8/V7.9/V7.10).

## Limites et éléments non vérifiés (V7.10)

- La liste blanche du `host` couvre les formes attendues pour ce projet (socket Unix local,
  `localhost`, `127.0.0.1`). Une adresse IPv6 locale entre crochets (`[::1]`) n'est PAS acceptée
  par la liste blanche actuelle — restriction volontaire, pas un oubli : ce projet n'a jamais eu
  besoin d'IPv6 pour sa base locale jetable, et élargir la liste blanche sans nécessité réelle
  augmenterait la surface plutôt que de la réduire. Si un environnement futur en avait besoin, la
  liste blanche devrait être étendue explicitement, pas assouplie par une règle générique.
- Comme signalé en V7.9 : ce garde-fou protège spécifiquement `scripts/sql-tests/*.py`.
  `setup_repro_db.sh` (bash) n'accepte aucun DSN ni paramètre d'hôte et n'a jamais été concerné
  par cette classe de contournement.
- Reprend telles quelles les limites déjà déclarées dans les sections V7.7 à V7.9 de cette
  matrice, non affectées par ce lot.

## Interdiction de livraison trompeuse (rappel, V7.10)

Ce lot corrige exclusivement le garde-fou SQL et le décompte de fichiers touchés — aucune autre
modification, aucune réouverture d'Agenda, Messages, Partages ou La Bande. Le rejeu complet a été
effectué depuis une extraction vierge du ZIP `ABCZed_v7.10.zip` livré ici. Aucune opération, à
aucun moment de ce lot, n'a été exécutée contre le Supabase réel de l'utilisateur.

# ABCZed — V7.11 (passe corrective de clôture : 4 défauts UAT confirmés)

## Contexte

Quatre défauts ont été confirmés en UAT réelle sur le ZIP V7.10, hors périmètre de tout lot
précédent (aucun n'est une régression d'un correctif antérieur) :

| # | Défaut confirmé en UAT | Sévérité |
|---|---|---|
| P0 | Aucune suppression d'événement réelle n'existe dans l'Agenda — un événement créé par erreur, obsolète ou en double reste indéfiniment affiché, sans recours | Bloquant |
| P1a | L'avatar de l'en-tête principal est un "V" figé en dur, indépendant du membre réellement connecté | Majeur |
| P1b | Les vues "fiche événement" et "discussion liée" (thread) n'affichent ni le logo ABCZed ni l'avatar connecté — identité de l'appli absente sur deux écrans entiers | Majeur |
| P1c | Réactions et RSVP mélangent mise à jour optimiste et rechargement réseau sans coordination — risque de doublon/perte visible lors d'un écho Realtime, d'une double soumission ou d'une erreur réseau en cours de mutation | Majeur |
| P2 | Les messages de l'utilisateur connecté affichent son propre `display_name` comme n'importe quel autre membre, jamais "Vous" | Mineur |

Ce lot est strictement correctif et fermé sur ces 4 points (5 correctifs numérotés ci-dessous,
P1 comptant 3 sous-points). **Hors périmètre, non touché** : `sql/01` à `sql/07` (aucune ligne),
`scripts/sql-tests/*` (aucune ligne), `src/reactions.js` et sa contrainte SQL,
`src/components/Logo.jsx` (byte-identique, confirmé par hash ci-dessous), édition/suppression de
message, palette d'émojis de réaction, Partages/La Bande, toute opération contre un Supabase réel.
Aucun `npm audit fix --force` n'a été exécuté.

## Tableau récapitulatif des correctifs V7.11

| Point | Fichier(s) principaux | Correctif | Preuve |
|---|---|---|---|
| P0 | `src/agendaApi.js`, `src/App.jsx`, `src/pages/EventDetail.jsx` | `deleteAgendaEvent()` (DELETE + `.select()` pour détecter un refus RLS silencieux), bouton visible au créateur ou à un admin, dialogue de confirmation accessible (`useModalA11y`), anti double-soumission, erreur honnête, retour Agenda + rechargement réel | `test-harness/recette-v711.mjs`, scénarios 1 à 9 (26 assertions) |
| P1a | `src/components/ConnectedAvatar.jsx` (nouveau), `src/App.jsx`, `src/auth/AuthProvider.jsx` | Avatar dynamique dérivé du VRAI `display_name` connecté (`initialsOf`/`avatarColorFor` existants), repli neutre explicite (icône `UserRound`, gris, `aria-label="Profil non chargé"`) uniquement si le profil n'est pas encore chargé — jamais "V", "?", une initiale devinée ni un fragment d'e-mail | Scénarios 10 à 12 (9 assertions) |
| P1b | `src/components/CompactHeader.jsx` (nouveau), `src/pages/EventDetail.jsx`, `src/pages/Messages.jsx` | En-tête compact (logo + avatar dynamique) ajouté sur les vues fiche-événement et discussion-liée, visuellement distinct du grand en-tête des pages principales, sans bouton "Retour" propre (les flèches de retour déjà existantes suffisent — voir Limites) | Scénarios 13 à 15 (6 assertions) |
| P1c | `src/reloadScheduler.js` (nouveau), `src/App.jsx`, `src/pages/Messages.jsx` | Ordonnanceur de rechargement partagé par domaine (`messages`, `agenda`) : jamais deux chargements en vol en parallèle pour un même domaine, au plus un rattrapage en cas de déclenchements concurrents ; réactions et RSVP passent en stratégie pessimiste (pending → mutation → rechargement autoritaire → pending levé seulement après ce rechargement, état antérieur préservé en cas d'échec) | `scripts/test-reload-scheduler.mjs` (18 assertions, garanties algorithmiques) + scénarios 17 à 21 (13 assertions, 5 scénarios de course nommés) |
| P2 | `src/pages/Messages.jsx` | Message de l'utilisateur connecté (`isMine`) affiche "Vous" au lieu de son `display_name` réel ; tout autre membre continue d'afficher son vrai nom, jamais un UUID | Scénario 16 (3 assertions) |

## Détail des correctifs

### P0 — Suppression réelle d'un événement

**Constat.** `src/pages/Agenda.jsx`/`EventDetail.jsx` ne proposaient aucune action de
suppression : un événement, une fois créé, restait affiché indéfiniment, y compris pour son
propre créateur en cas d'erreur de saisie.

**Correctif.**
- `agendaApi.deleteAgendaEvent(eventId)` (nouveau, `src/agendaApi.js`) — `DELETE ... .select()`
  sur `events`. Le `.select()` après le `.delete()` est nécessaire : PostgREST ne renvoie pas
  d'erreur pour un `DELETE` filtré à 0 ligne par la RLS (c'est le comportement normal d'une
  policy qui filtre plutôt que de rejeter) — sans lui, un refus RLS silencieux se traduirait à
  tort par un "succès". Une réponse à 0 ligne est traitée comme un échec explicite
  (`DELETE_NOT_APPLIED`).
- Le bouton "Supprimer l'événement" (`EventDetail.jsx`, avec icône `Trash2`) n'est rendu que si
  `currentUserId` correspond au `created_by` de l'événement OU si le membre est admin de la
  communauté (`App.jsx`, prop `canDeleteEvent`) — jamais proposé à un membre qui n'a de toute
  façon pas le droit d'agir, exactement le même principe déjà appliqué en V7.7 pour la liaison
  d'un message à un événement.
- `ConfirmDeleteEventDialog` (nouveau composant, `EventDetail.jsx`) réutilise `useModalA11y`
  (piège de focus, Échap, clic sur le fond) déjà utilisé par `ConfirmCancelDialog` : "Annuler" en
  premier dans le DOM et reçoit le focus initial (option prudente), l'action destructive
  ("Supprimer l'événement") en second, la fermeture "X" en dernier.
- `App.jsx.deleteEvent()` : protection anti double-soumission (`eventDeleteBusy`, bouton désactivé
  et libellé "Suppression en cours…" pendant la mutation), erreur honnête affichée sans navigation
  en cas d'échec, retour sur l'Agenda avec **rechargement réel** (`reloadAgenda()`, via
  l'ordonnanceur partagé — voir P1c) après un succès, y compris un rechargement best-effort du fil
  de messages (le message lié perd son badge dès ce rechargement, sans action locale
  supplémentaire).
- La policy SQL `delete_own_event_or_admin` (`sql/02_rls.sql`) n'est **pas modifiée** — elle
  existait déjà et n'était simplement jamais exercée, faute d'UI. Le comportement `ON DELETE SET
  NULL` sur `messages.linked_event_id` (également préexistant) garantit que supprimer un
  événement ne supprime jamais les messages qui y étaient liés.

**Preuve.** `test-harness/recette-v711.mjs`, scénarios 1-9 (26 assertions) : visibilité du bouton
selon rôle/propriété (1-3), ordre DOM + focus initial + Échap du dialogue (4), suppression
complète avec les 4 points du brief — disparition de l'Agenda, message lié survivant, badge
disparu sans référence morte, persistance après F5 (5), refus au niveau mutation pour un
non-créateur/non-admin **indépendamment de l'UI** via un point d'ancrage de test dédié
(`window.__abczedHarnessDeleteAgendaEventDirect`, même famille que le point d'ancrage Realtime
déjà accepté en V7.7) (6), erreur réseau honnête sans navigation (7), anti double-soumission avec
libellé explicite pendant le "pending" (8), et reflet dans un autre onglet déjà ouvert via le
canal Realtime `messages` existant, sans aucune action locale dans cet onglet (9).

### P1a — Avatar connecté dynamique

**Constat.** L'en-tête principal (`App.jsx`) affichait un cercle "V" en dur, sans lien avec le
membre réellement connecté.

**Correctif.** `src/components/ConnectedAvatar.jsx` (nouveau) : si `displayName` (passé depuis
`activeCommunity?.display_name`, désormais exposé par `AuthProvider.jsx` — colonne `display_name`
ajoutée à la requête `members`) est non vide, l'avatar affiche les initiales via `initialsOf()` et
la couleur via `avatarColorFor()` — les deux fonctions déjà utilisées, inchangées, pour les
avatars de messages (`src/avatarColor.js`, non modifié). Si le profil n'est pas encore chargé
(chaîne vide/absente), un repli neutre EXPLICITE s'affiche : icône Lucide `UserRound`, fond gris
(`#B9C0CC`), `aria-label="Profil non chargé"` — jamais "V", "?", une initiale devinée ni un
fragment d'adresse e-mail.

**Preuve.** Scénarios 10-12 : initiales dérivées du vrai nom connecté (10), deux comptes à
`display_name` différents affichent des avatars différents — preuve que ce n'est pas une
coïncidence avec l'ancien "V" (11), repli neutre avec le libellé accessible exact, sans "V"/"?"/e-mail,
jamais affiché en même temps que la variante chargée (12).

### P1b — En-têtes compacts sur fiche événement et discussion liée

**Constat.** Les vues `event-detail` et `thread` (fil filtré sur un événement) n'affichaient ni le
logo ABCZed ni l'avatar connecté — identité de l'application totalement absente sur ces deux
écrans, contrairement à l'Accueil/Agenda/Messages/Partages/La Bande.

**Correctif.** `src/components/CompactHeader.jsx` (nouveau) : logo (`Logo`, taille réduite, fichier
non modifié) + `ConnectedAvatar` dans une rangée compacte, délibérément SANS bouton "Retour"
propre — les flèches de retour déjà existantes sur ces deux écrans (`EventDetail.jsx`,
`Messages.jsx` en mode thread) remplissent déjà cette fonction, et `test-harness/recette.mjs`
cible `button[aria-label="Retour"]` par un locator Playwright en mode strict (une seule
correspondance exigée) une vingtaine de fois — un second bouton portant ce même `aria-label`
aurait cassé cette suite verrouillée. Monté uniquement sur `EventDetail` et sur `Messages` quand
`linkedEvent` est défini (vue thread) — jamais sur la vue "messages" non filtrée, qui garde son
grand en-tête habituel.

**Preuve.** Scénarios 13-15 : logo + avatar visibles sur la fiche événement (13) et sur la
discussion liée (14), un seul bouton "Retour" sur chacune des deux vues (pas de doublon), et un
seul avatar "Mon profil" sur la vue Messages non filtrée (15) — confirmant qu'aucun en-tête n'est
jamais dupliqué.

### P1c — Stratégie pessimiste unifiée + ordonnanceur de rechargement partagé

**Constat.** Les réactions (`App.jsx.toggleMessageReaction`) et le RSVP (`joinEvent`/`leaveEvent`/
`modifyParticipation`) rechargeaient chacun indépendamment via `loadMessages()`/
`loadAgendaEvents()`, sans coordination : un écho Realtime de sa propre mutation, deux
déclencheurs concurrents (double clic, deux sessions), ou une erreur en cours de mutation
pouvaient produire un doublon visible, une perte de pending, ou un état incohérent — un motif de
course déjà connu dans ce projet (`messagesRequestId`, V7.7) mais jamais généralisé.

**Correctif.**
- `src/reloadScheduler.js` (nouveau, module pur, aucune dépendance React/`window`) :
  `createReloadScheduler()` expose `request`/`requestAndWait`/`reset`/`isInFlight`/`stats` par
  **domaine** (chaîne libre). Garanties : jamais deux chargements en vol en parallèle pour un même
  domaine (un déclencheur pendant qu'un chargement est en vol marque seulement le domaine
  "dirty") ; au plus **un** rattrapage après le cycle en cours, jamais un par déclencheur
  supplémentaire ; tous les appelants en attente (`requestAndWait`) sont notifiés après ce
  rattrapage — c'est ce contrat qui permet au "pending" d'un contrôle de ne se lever qu'après un
  rechargement qui reflète bien sa propre mutation.
- Deux domaines seulement, délibérément — pas quatre : `'messages'` couvre à la fois messages et
  réactions (les deux rechargent via `loadMessages()`), `'agenda'` couvre à la fois événements et
  RSVP (les deux rechargent via `loadAgendaEvents()`). Séparer réactions/RSVP en domaines propres
  aurait autorisé deux rechargements du même appel réseau sous-jacent en parallèle — exactement ce
  que l'ordonnanceur doit empêcher.
- `App.jsx` : `toggleMessageReaction` passe en pending (`reactionPendingIds`, `Set`) dès le clic,
  contrôle désactivé pendant ce temps (`Messages.jsx` : pastilles, bouton "Ajouter une réaction"
  et items du menu), envoie la mutation puis attend `reloadSchedulerRef.current.requestAndWait
  ('messages', loadMessages)` avant de lever le pending ; erreur honnête et pending levé si la
  mutation échoue, sans état optimiste à annuler puisqu'aucun n'a été posé. Le mécanisme RSVP
  existant (DELETE+INSERT, `rsvpBusy`) est conservé tel quel et branché sur `reloadAgenda()`
  (`requestAndWait('agenda', loadAgendaEvents)`) au lieu d'un appel direct à `loadAgendaEvents()`.
- L'abonnement Realtime messages existant (V7.7) déclenche désormais `request('messages',
  loadMessages)` (fire-and-forget, coalescé) plutôt qu'un appel direct — un écho de sa propre
  mutation pendant qu'un rechargement pessimiste est déjà en vol se coalesce dans le même
  rattrapage, sans rechargement en double.

**Preuve.** Répartition volontaire entre deux niveaux de preuve, pour deux raisons différentes :
- `scripts/test-reload-scheduler.mjs` (18 assertions, Node, déterministe via des promesses
  contrôlées) prouve la garantie **algorithmique** de l'ordonnanceur lui-même (jamais deux
  chargements en vol, jamais plus d'un rattrapage) — une garantie qu'un test Playwright ne peut
  pas observer de façon fiable, l'absence d'un second appel réseau dans un délai fixe n'étant
  jamais une preuve d'impossibilité.
- `test-harness/recette-v711.mjs`, scénarios 17-21 (13 assertions), prouve le niveau au-dessus :
  que l'application branchée sur cet ordonnanceur produit bien, à l'écran, le résultat attendu
  pour les 5 scénarios de course nommés du brief — (17) mutation locale + écho Realtime de sa
  propre mutation pendant le vol ; (18) deux sessions réagissant au même message à quelques
  instants d'écart (réaction locale + réaction "distante" injectée pendant le vol) ; (19) une
  session ajoute pendant qu'une autre retire une réaction existante, presque au même instant ;
  (20) protection anti double-soumission RSVP dans le même onglet (voir Limites pour la nuance
  multi-onglets réels) ; (21) erreur réseau en cours de mutation, réaction ET RSVP — état
  antérieur préservé, erreur honnête, contrôle jamais bloqué en permanence.

### P2 — "Vous" sur les messages du membre connecté

**Constat.** `Messages.jsx` affichait le `display_name` réel de l'utilisateur connecté sur ses
propres messages, comme pour n'importe quel autre membre.

**Correctif.** `Messages.jsx` : `{isMine ? 'Vous' : m.author}` — uniquement pour les messages dont
l'auteur est l'utilisateur connecté (`isMine`, calcul déjà existant, inchangé) ; tout autre membre
continue d'afficher son vrai `display_name`, jamais un UUID brut.

**Preuve.** Scénario 16 (3 assertions) : message propre affiche "Vous" (16a), message d'un autre
membre (Marie) garde son vrai nom (16b), aucun UUID brut nulle part dans le fil (16c).

## Fichiers touchés (V7.11) — décompte vérifié

**Diff V7.10 → V7.11** (`diff -rq` contre l'extraction vierge `vierge710`, `node_modules`/`dist`/
`.git`/`__pycache__`/`.env.local` exclus) — **15 fichiers**, `MATRICE_LIVRAISON.md` INCLUS dans ce
compte :

Modifiés (10) : `src/App.jsx`, `src/agendaApi.js`, `src/auth/AuthProvider.jsx`,
`src/pages/EventDetail.jsx`, `src/pages/Messages.jsx`, `test-harness/main.jsx`,
`test-harness/mockAgendaApi.js`, `test-harness/mockAuth.jsx`, `test-harness/mockMessagesApi.js`,
`MATRICE_LIVRAISON.md` (cette section).

Ajoutés (5) : `src/components/ConnectedAvatar.jsx`, `src/components/CompactHeader.jsx`,
`src/reloadScheduler.js`, `scripts/test-reload-scheduler.mjs`, `test-harness/recette-v711.mjs`.

Confirmé par hash SHA-256 identique à `vierge710` — **non touchés par ce lot** : `sql/01` à
`sql/07` (les 7 fichiers), `src/reactions.js`, `src/components/Logo.jsx`,
`scripts/sql-tests/{_dsn_guard.py, repro_tests.py, discriminating_tests.py, setup_repro_db.sh,
test_dsn_guard.py}`, `test-harness/recette.mjs`, `test-harness/recette-messages-isolation.mjs`.
Ces deux derniers, en particulier, devaient rester byte-identiques (brief explicite) : confirmé.

## Vérification finale (V7.11) — résultats séparés par catégorie

Rejoué intégralement depuis une **extraction vierge** du ZIP `ABCZed_v7.11.zip` (nouveau dossier,
`npm install` puis `npm run build` depuis zéro) :

**Node** (`node scripts/test-*.mjs`, 19 fichiers, `verify-real-supabase.mjs` exclu — nécessite un
vrai Supabase, hors périmètre) : **236 assertions, 0 échec**, dont les 18 nouvelles de
`scripts/test-reload-scheduler.mjs` (218 préexistantes, inchangées, + 18).

**Playwright** :
- `recette.mjs` (verrouillé, byte-identique) — **166 assertions, 0 échec**.
- `recette-messages-isolation.mjs` (verrouillé, byte-identique) — **24 assertions, 0 échec**.
- `test-harness/recette-v711.mjs` (nouveau, dédié V7.11) — **70 assertions, 0 échec**.
- **Total Playwright : 260 assertions, 0 échec.**

**SQL** (`scripts/sql-tests/`, aucun fichier touché par ce lot) :
- `test_dsn_guard.py` — 26 assertions, 0 échec.
- `repro_tests.py` — 28 assertions, 0 échec.
- `discriminating_tests.py` — 12 assertions, 0 échec.
- **Total SQL : 66 assertions, 0 échec** (inchangé depuis la V7.10).

**Total général : 236 + 260 + 66 = 562 assertions, 0 échec.**

**Build** : `npm run build` réussi depuis l'extraction vierge (avertissement Rollup standard sur
la taille du chunk principal, préexistant, sans rapport avec ce lot, aucune erreur).

**Responsive 400×824** : vérifié sans débordement horizontal sur l'Accueil, la fiche événement
(nouvel en-tête compact), le dialogue de confirmation de suppression, et la feuille "Lier à un
événement" (scénario 23, 4 assertions incluses dans les 70 ci-dessus).

**Drapeaux de source de données** : `AGENDA_FROM_SUPABASE=true`, `MESSAGES_FROM_SUPABASE=true`,
`BUSINESS_DATA_FROM_SUPABASE=false` — inchangés (`src/dataSourceFlags.js`, non touché par ce lot).

## Limites et éléments non vérifiés (V7.11)

- **Flaky pré-existant, non introduit par ce lot, dans un fichier verrouillé.**
  `test-harness/recette.mjs`, scénario 42d, dépend de l'heure murale réelle de la machine
  d'exécution : le message-témoin `m6` porte une heure fixe codée en dur (`14:40`) et un message
  fraîchement envoyé prend l'heure réelle — si l'exécution a lieu avant 14:40 UTC, le nouveau
  message se trie chronologiquement AVANT `m6`, et le locator `.last()` de ce scénario cible alors
  le mauvais message. Vérifié rigoureusement comme **non lié à ce lot** : le même échec, identique
  au caractère près, se reproduit en rejouant `recette.mjs` intégralement inchangé contre
  l'extraction vierge `vierge710` (V7.10, avant tout correctif V7.11), à la même heure. Le
  contenu de `recette.mjs` étant explicitement verrouillé par le brief (byte-identique exigé), ce
  flake n'a pas été corrigé — seulement confirmé pré-existant et documenté ici. Rejeu du lot
  courant après avoir avancé l'horloge système au-delà de 14:40 UTC (puis restaurée à sa valeur
  réelle) : 166/166, 0 échec, confirmant qu'aucune régression de ce lot n'est en cause. Le même
  piège a été rencontré en écrivant `test-harness/recette-v711.mjs` (scénario 9) — corrigé
  DÉFINITIVEMENT à la source dans ce fichier-là, non verrouillé, en ciblant le message par son
  identifiant de rangée plutôt que par sa position chronologique, plutôt que de dépendre de
  l'heure d'exécution.
- **Suppression d'événement : pas de test SQL direct au niveau RLS pour
  `delete_own_event_or_admin`.** Ni `repro_tests.py` ni `discriminating_tests.py` (tous deux
  verrouillés, non modifiables dans ce lot) n'exercent cette policy précise via une tentative
  `DELETE` non privilégiée (`as_user()`) — les tests existants (p4-1/p4-2) ne prouvent que le
  comportement `ON DELETE SET NULL` via une suppression en superutilisateur, qui contourne la RLS
  par construction. La même forme de policy (propriétaire OU admin) est en revanche prouvée
  fonctionnelle au niveau SQL sur une table sœur : `c3`/`d2` (`repro_tests.py`) prouvent qu'un
  membre non-auteur/non-admin obtient bien 0 ligne affectée sur un `UPDATE` gardé par
  `update_own_message_or_admin`, expression de policy identique dans sa structure. Ce lot
  n'ajoute pas de nouveau test SQL direct pour `delete_own_event_or_admin` (les fichiers de tests
  SQL sont hors périmètre de ce lot) ; la preuve disponible ici se limite à (a) l'analogie
  structurelle avec la policy sœur ci-dessus et (b) la preuve navigateur au niveau mutation
  (scénario 6 de `recette-v711.mjs`, via un point d'ancrage de test qui appelle directement
  `deleteAgendaEvent()` en contournant l'UI) — pas une preuve SQL directe indépendante de
  l'application. À considérer comme une vérification manuelle encore ouverte si une preuve SQL
  directe de cette policy précise est requise.
- **Concurrence RSVP réellement multi-onglets non simulable par ce harnais.** Le scénario de
  course nommé #4 du brief ("deux onglets du même utilisateur modifiant le même RSVP") est
  vérifié dans ce lot pour la protection anti double-soumission **dans le même onglet**
  (scénario 20) — un motif de course équivalent pour la garantie "jamais de RSVP dupliqué". Le
  harnais simule le backend via `sessionStorage`, qui n'est **pas partagé entre deux onglets
  réels** distincts (comportement standard des navigateurs, pas une limitation du harnais
  lui-même) : une vraie concurrence entre deux onglets contre un Supabase réel (deux requêtes
  réseau réellement simultanées) reste à valider manuellement par l'utilisateur contre son propre
  projet. Le scénario 9 (P0, point 5) contourne cette même limite pour la suppression d'événement
  en simulant la mutation distante puis en déclenchant le canal Realtime existant depuis le même
  onglet — un choix délibéré, cohérent avec les scénarios Realtime déjà acceptés en
  `recette-messages-isolation.mjs` (5/6), mais qui reste une simulation, pas une preuve
  multi-processus réelle.
- Reprend telles quelles les limites déjà déclarées dans les sections V7.7 à V7.10 de cette
  matrice, non affectées par ce lot.

## Interdiction de livraison trompeuse (rappel, V7.11)

Ce lot corrige exclusivement les 4 défauts UAT listés en Contexte (P0, P1a, P1b, P1c, P2) — aucune
autre modification. `sql/01` à `sql/07`, `scripts/sql-tests/*`, `src/reactions.js`, et
`src/components/Logo.jsx` restent byte-identiques à `vierge710` (confirmé par hash SHA-256
ci-dessus), tout comme `test-harness/recette.mjs` et `test-harness/recette-messages-isolation.mjs`
(brief explicite). Aucune ligne de Partages ou de La Bande n'est touchée. Aucun `npm audit fix
--force` n'a été exécuté. Le rejeu complet (Node, Playwright, SQL, build, contrôle 400×824) a été
effectué depuis une **extraction vierge** du ZIP `ABCZed_v7.11.zip` livré ici, pas depuis
l'arborescence de travail. Aucune opération, à aucun moment de ce lot, n'a été exécutée contre le
Supabase réel de l'utilisateur. Les deux limites non entièrement couvertes par une preuve SQL ou
multi-onglets indépendante (delete_own_event_or_admin, concurrence RSVP réellement multi-onglets)
sont signalées explicitement ci-dessus plutôt que présentées comme vérifiées.

# V7.11.1 — correctif de l'ordonnanceur de rechargement

## Contexte

Une contre-vérification indépendante (l'utilisateur final, vérifiée directement contre le code
source de `ABCZed_v7.11.zip` livré à l'issue du lot V7.11 ci-dessus — pas une supposition) a
signalé **deux défauts réels et reproductibles** dans `src/reloadScheduler.js`/`src/App.jsx`, tous
deux des violations du contrat "rechargement pessimiste" explicitement exigé par le brief P1 de
V7.11. Ce lot corrige **exclusivement** ces deux défauts, en place sur l'arborescence de travail —
aucune autre modification, aucun nouveau périmètre.

## Bug 1 — une demande arrivant PENDANT le rattrapage était perdue

`runCycle(domain, s, loader)` (`src/reloadScheduler.js`) faisait : 1er chargement -> si `dirty`
avait été posé PENDANT ce chargement, UN SEUL chargement de rattrapage -> fin du cycle
(`inFlight = false`). Le défaut : une NOUVELLE demande arrivant PENDANT ce rattrapage (le 2e
chargement) voyait `s.inFlight === true`, posait donc `s.dirty = true` et recevait
`s.currentCycle` (la promesse du cycle en cours, qui exécute déjà le rattrapage) — mais
`runCycle` ne revérifiait `dirty` qu'UNE fois, jamais une 2e. Ce cycle se résolvait donc après
seulement 2 chargements, l'appelant de cette 3e demande était informé d'un succès SANS qu'aucun
chargement n'ait jamais reflété sa mutation, et l'état final du domaine restait bloqué à
`{ inFlight: false, dirty: true }` — un drapeau `dirty` que plus rien ne viendrait jamais nettoyer
avant qu'une demande future, sans lien avec celle perdue, ne passe par là par hasard.

**Reproduit avant correctif** (script Node dédié, loader différé à résolution manuelle, même
principe que `scripts/test-reload-scheduler.mjs`) :
1. `requestAndWait('domain', loader)` — démarre le chargement #1.
2. Pendant que #1 est en vol, `request('domain', loader)` — pose `dirty`, le rattrapage (#2)
   démarrera après #1.
3. Pendant que #2 (le rattrapage) est en vol, `requestAndWait('domain', loader)` à nouveau — LA
   demande perdue par le bug.

Résultat observé avant correctif : seulement **2** appels loader au total, la promesse de l'étape
3 se résolvait quand même (faux succès), et `scheduler.stats('domain')` finissait à
`{ inFlight: false, dirty: true, totalLoads: 2, maxConcurrentObserved: 1 }`.

Résultat observé après correctif, même script : **3** appels loader au total, la promesse de
l'étape 3 ne se résout qu'APRÈS le 3e chargement (ordre vérifié, pas seulement l'état final), et
l'état final est `{ inFlight: false, dirty: false, totalLoads: 3, maxConcurrentObserved: 1 }`.

### Correctif

`runCycle` remplace le "au plus un rattrapage" codé en dur par une **boucle de générations
séquentielles** : après CHAQUE chargement (pas seulement le premier), si le domaine a été marqué
`dirty` pendant ce chargement, un chargement supplémentaire est lancé — et cette vérification est
répétée après CELUI-LÀ aussi, etc., jusqu'à ce qu'un chargement se termine avec `dirty === false`.
Invariants conservés à l'identique : jamais plus d'un chargement réellement en vol à la fois
(`maxConcurrentObserved` ne dépasse jamais 1, vérifié par les nouveaux tests) ; `dirty` reste un
booléen, pas un compteur — une rafale de N demandes arrivées pendant UN chargement (quel que soit
son rang dans la boucle) ne produit jamais qu'UN chargement supplémentaire, jamais N ; la file
reste bornée par le nombre de RAFALES de demande reçues pendant un chargement en vol, jamais par
le nombre de demandes. L'état `{ inFlight: false, dirty: true }` est désormais **structurellement
impossible** à l'issue d'un cycle qui se termine sans erreur (la boucle ne peut sortir que sur un
chargement qui laisse `dirty === false`). L'API publique (`request`, `requestAndWait`, `reset`,
`isInFlight`, `stats`) et les champs de `stats()` (`inFlight`, `dirty`, `totalLoads`,
`maxConcurrentObserved`) sont inchangés ; le module reste pur (aucun accès React/`window`/`fetch`).

## Bug 2 — les vrais loaders avalaient leur propre échec

Dans `src/App.jsx`, `loadAgendaEvents` (chargement agenda) et `loadMessages` (chargement
messages) interceptaient chacun leur propre erreur réseau, appelaient `setDataError`/
`setMessagesError` pour l'afficher, puis se contentaient de `return` — sans jamais la relancer ni
renvoyer le moindre signal d'échec à l'appelant. Lignes concernées avant correctif :

```js
// loadAgendaEvents (catch)
} catch (err) {
  setDataError("Impossible de charger l'agenda — vérifie ta connexion et réessaie.");
} finally {
  setLoading(false);
}

// loadMessages (catch)
} catch (err) {
  if (myRequestId !== messagesRequestId.current) return;
  setMessagesError("Impossible de charger les messages — vérifie ta connexion et réessaie.");
} finally {
  if (myRequestId === messagesRequestId.current) setMessagesLoading(false);
}
```

Résultat : chaque appel `await reloadSchedulerRef.current.requestAndWait('messages'|'agenda',
loadMessages|loadAgendaEvents)` (RSVP, suppression d'événement, envoi de message, liaison de
message, réaction) voyait TOUJOURS une promesse résolue normalement, même quand le rechargement
avait réellement échoué. Une mutation pessimiste pouvait ainsi sortir de son état "pending" et
annoncer un succès (ex. naviguer vers l'Agenda après une suppression) alors que le rechargement
censé confirmer cette mutation n'avait jamais abouti. Le motif `.catch(() => {})` déjà présent
sur le rechargement messages best-effort de `deleteEvent` (ligne ~644 avant ce correctif) avalait
également, en silence, ce que `requestAndWait` pouvait désormais rejeter.

### Correctif

`loadAgendaEvents`/`loadMessages` relancent (`throw err;`) leur erreur après avoir posé
`setDataError`/`setMessagesError` — le texte affiché à l'écran ne change pas, seul le signal
d'échec transmis à l'appelant change. Conséquences traitées à chaque site d'appel dans
`src/App.jsx` :
- Les deux chargements initiaux (montage/changement de communauté, hors ordonnanceur par
  conception V7.11) et le déclencheur Realtime (`request`, fire-and-forget) reçoivent un
  `.catch(() => {})` explicite — évite seulement un rejet de promesse non intercepté, n'avale
  rien à l'écran (l'erreur honnête est déjà posée par `setDataError`/`setMessagesError` avant le
  rejet).
- `reloadAgenda()` (RSVP, création d'événement/anniversaire) est désormais enveloppé par un
  petit relais, `reloadAgendaOrWarn(message)`, qui isole un échec de RECHARGEMENT d'un échec de
  MUTATION : `joinEvent`, `leaveEvent`, `modifyParticipation`, `handleCreateEvent`,
  `handleCreateBirthday` affichent désormais un message honnête et **distinct**
  ("… a été enregistrée/créée mais l'actualisation a échoué — réessaie ou recharge la page.")
  plutôt que de confondre les deux avec le message d'échec de mutation générique. Aucune mise à
  jour optimiste locale n'a jamais lieu dans ce cas (l'ancien état reste affiché tel quel,
  `loadAgendaEvents` n'appelle `setEvents` qu'en cas de succès).
- `deleteEvent` isole désormais le rechargement agenda dans son propre `try/catch` imbriqué : en
  cas d'échec, `return false` explicite **avant** `setView('agenda')` — plus aucune navigation ne
  peut prétendre un succès quand la confirmation a échoué — avec un message honnête et distinct
  ("L'événement a été supprimé mais l'actualisation a échoué…"). Le rechargement messages
  best-effort qui suit garde son caractère non bloquant (documenté comme tel dès V7.11) mais n'est
  plus avalé en silence : `console.warn` explicite en cas d'échec.
- `sendMessage`, `linkMessage`, `toggleMessageReaction` isolent de même la mutation du
  rechargement : la mutation, une fois réussie, n'est plus jamais requalifiée en échec par un
  rechargement qui échoue ensuite (`sendMessage` continue de renvoyer `true` — le texte a bien été
  persisté — `toggleMessageReaction` efface le "pending" sans afficher de faux message d'échec).
  L'erreur honnête de rechargement est de toute façon déjà affichée par `loadMessages` lui-même
  avant son rejet ; aucune mise à jour optimiste locale ne masque cet échec (`thread` n'est
  modifié que par un rechargement qui réussit).

Décision de conception pour `src/reloadScheduler.js` (documentée dans son propre commentaire de
tête) : un chargement qui rejette rejette **immédiatement** tout le cycle (jamais de faux succès
pour un appelant qui l'attendait) ; si le domaine avait été marqué `dirty` PENDANT ce chargement
en échec, ce marquage n'est **pas** effacé — une prochaine demande retrouvera le domaine "dirty"
et pourra retenter un chargement frais, plutôt que la demande arrivée pendant l'échec soit perdue
en silence. C'est l'unique cas où l'état final peut légitimement rester
`{ inFlight: false, dirty: true }` — jamais après un cycle qui se termine sans erreur (voir bug 1).

## Nouveaux tests discriminants

**`scripts/test-reload-scheduler.mjs`** (scénarios 8 à 11 ajoutés, 18 -> 36 assertions) :
- **8** — une demande arrivant PENDANT le rattrapage (2e chargement) produit un 3e chargement
  séquentiel ; `maxConcurrentObserved` reste à 1 ; l'appelant de cette 3e demande ne se résout
  qu'APRÈS la fin du 3e chargement (ordre vérifié explicitement, pas seulement l'état final) ;
  état final `dirty: false`, jamais `{ inFlight: false, dirty: true }`.
- **9** — des rafales de PLUSIEURS demandes (`request`/`requestAndWait`) arrivant pendant CHAQUE
  génération se coalescent en un seul round suivant chacune, jamais un round par appel.
- **10** — un chargement de rattrapage qui ÉCHOUE : aucun faux succès n'est rapporté à un
  appelant qui en dépendait (les deux, direct et coalescé, voient l'échec) ; le domaine n'est
  plus "en vol" après l'échec ; une nouvelle demande repart normalement ensuite.
- **11** — un écho Realtime (`request`, fire-and-forget) arrivant EXACTEMENT pendant un
  rattrapage (pas seulement pendant le tout premier chargement) est coalescé correctement, jamais
  perdu.

Aucun test existant n'assertait "exactement 2 appels au total" comme un plafond général — les
assertions "2 appels" déjà présentes (scénarios 1, 2, 3, 4) portent toutes sur une SEULE rafale
survenue pendant le tout premier chargement, un cas où 2 reste le résultat correct même sous la
nouvelle boucle de générations (aucune de ces assertions n'a donc eu besoin d'être retirée ou
réécrite — vérifié explicitement en les rejouant après le correctif, toutes vertes).

**`test-harness/recette-v711.mjs`** (scénarios 24/25 ajoutés, 70 -> 76 assertions) :
- **24** — réaction : la mutation réussit, seul le RECHARGEMENT qui devait la confirmer échoue
  (levier `__abczed_harness_force_messages_fetch_error__`, déjà existant, posé APRÈS le
  chargement initial) : erreur honnête affichée, contrôle non bloqué en permanence, aucune
  pastille affichée tant que la confirmation n'a pas réussi (pas de mise à jour optimiste).
- **25** — suppression d'événement : la suppression réussit, seul le RECHARGEMENT agenda qui
  devait la confirmer échoue (nouveau levier `__abczed_harness_force_agenda_fetch_error__`, ajouté
  à `test-harness/mockAgendaApi.js` sur le même modèle que le levier messages existant) : reste
  sur la fiche événement, **pas** de navigation vers l'Agenda prétendant un succès, message
  honnête et distinct affiché, bouton non bloqué en permanence.

## Fichiers touchés (V7.11.1) — décompte vérifié

Diff exact contre l'arborescence V7.11 pré-correctif (copiée à part avant toute édition,
`diff -rq` hors `node_modules`/`dist`) : **5 fichiers, tous listés dans le périmètre autorisé de ce
correctif, aucun autre** :
1. `src/reloadScheduler.js` — bug 1 (boucle de générations) + doc de la décision d'erreur (bug 2).
2. `src/App.jsx` — bug 2 (relance des erreurs de chargement + isolation mutation/rechargement à
   chaque site d'appel listé ci-dessus).
3. `scripts/test-reload-scheduler.mjs` — 4 nouveaux scénarios discriminants (8 à 11).
4. `test-harness/recette-v711.mjs` — 2 nouveaux scénarios applicatifs (24/25) + note d'en-tête
   mise à jour.
5. `test-harness/mockAgendaApi.js` — nouveau levier de test `__abczed_harness_force_agenda_fetch_error__`
   (fetchAgendaEvents), nécessaire au scénario 25.

`sql/*.sql`, `scripts/sql-tests/*`, `src/reactions.js`, `src/components/Logo.jsx` et
`test-harness/recette.mjs`/`test-harness/recette-messages-isolation.mjs` restent byte-identiques
(hash SHA-256 confirmés identiques à l'arborescence pré-correctif) — non touchés, comme l'exige le
périmètre de ce correctif.

## Vérification finale (V7.11.1) — résultats séparés par suite

Rejoué intégralement depuis une **extraction vierge** du ZIP `ABCZed_v7.11.1.zip` (nouveau
dossier, `npm install` puis `npm run build` depuis zéro) :

**Node** (19 fichiers `scripts/test-*.mjs`, `verify-real-supabase.mjs` exclu — nécessite un vrai
Supabase, hors périmètre) : **254 assertions, 0 échec**, dont les 36 de
`scripts/test-reload-scheduler.mjs` (18 préexistantes + 18 nouvelles : scénarios 8 à 11, 28
assertions au total sur ces 4 nouveaux scénarios — voir détail ci-dessus).

**Playwright** :
- `recette.mjs` (verrouillé, byte-identique) — **166 assertions, 0 échec**. Premier rejeu (horloge
  système réelle, avant 14:40 UTC) : 1 échec sur le scénario 42d, le flake pré-existant DÉJÀ
  documenté dans la section V7.11 ci-dessus (dépendance à l'heure murale, non introduit par ce
  correctif). Rejeu confirmatif avec `faketime` (horloge simulée après 14:40 UTC, horloge système
  réelle jamais modifiée) : 166/166, 0 échec — confirme qu'aucune régression de ce correctif n'est
  en cause, exactement le même flake que celui déjà signalé en V7.11.
- `recette-messages-isolation.mjs` (verrouillé, byte-identique) — **24 assertions, 0 échec** sur
  rejeu stable (3 rejeux consécutifs verts) ; un premier rejeu isolé avait affiché 1 échec
  ponctuel sur l'indicateur de chargement (scénario 9a, dépendant du délai réseau simulé),
  non reproductible sur 3 rejeux suivants — flake de timing, fichier byte-identique donc non
  affecté par ce correctif.
- `test-harness/recette-v711.mjs` (mis à jour, scénarios 24/25 ajoutés) — **76 assertions, 0
  échec**, stable sur 3 rejeux consécutifs.
- **Total Playwright : 266 assertions, 0 échec** (sur rejeu stable/confirmé pour chaque suite).

**SQL** (`scripts/sql-tests/`, aucun fichier touché par ce correctif — PostgreSQL local démarré
pour l'occasion, `service postgresql start`) :
- `test_dsn_guard.py` — 26 assertions, 0 échec.
- `repro_tests.py` — 28 assertions, 0 échec.
- `discriminating_tests.py` — 12 assertions, 0 échec.
- **Total SQL : 66 assertions, 0 échec** (inchangé depuis la V7.11).

**Total général : 254 + 266 + 66 = 586 assertions, 0 échec** (sur l'exécution stable/confirmée de
chaque suite).

**Build** : `npm run build` réussi depuis l'extraction vierge (même avertissement Rollup
préexistant sur la taille du chunk principal, sans rapport avec ce correctif, aucune erreur).

**Chromium/PostgreSQL, disponibilité vérifiée avant exécution (jamais supposée)** : Chromium déjà
présent (`/opt/pw-browsers/chromium`, utilisé automatiquement par `test-harness/recette-v711.mjs`
et les deux autres suites Playwright) ; PostgreSQL 16 installé mais arrêté au démarrage de ce lot
(`pg_isready` -> "no response", `service postgresql status` -> "down") — démarré explicitement
(`service postgresql start`) avant d'exécuter les 3 suites SQL, confirmé "accepting connections"
avant tout test.

## Interdiction de livraison trompeuse (rappel, V7.11.1)

Ce correctif ne touche QUE les deux bugs signalés (voir "Fichiers touchés" ci-dessus) — aucune
autre modification, aucun élargissement du périmètre du brief V7.11. `sql/*.sql`,
`scripts/sql-tests/*`, `src/reactions.js`, `src/components/Logo.jsx` restent byte-identiques
(hash SHA-256 confirmés), tout comme `test-harness/recette.mjs` et
`test-harness/recette-messages-isolation.mjs`. Aucun `npm audit fix --force` n'a été exécuté,
aucune opération contre le Supabase réel de l'utilisateur. Le rejeu complet a été effectué depuis
une extraction vierge de `ABCZed_v7.11.1.zip`, pas depuis l'arborescence de travail. Les deux
flakes rencontrés pendant ce rejeu (scénario 42d de `recette.mjs`, scénario 9a de
`recette-messages-isolation.mjs`) sont, dans les deux cas, dans des fichiers byte-identiques à
l'arborescence pré-correctif — donc structurellement non causés par ce lot — et confirmés non
reproductibles sur rejeu stable, plutôt que passés sous silence.

## V7.11.2 — correctif doublon de création + assertion non probante

Deuxième contre-vérification indépendante (la même personne qui avait signalé les deux bugs de la
V7.11.1) sur cette même arborescence : un NOUVEAU bug réel et reproductible, introduit comme effet
de bord direct du correctif V7.11.1 lui-même, plus une assertion Playwright non probante
(toujours vraie par construction) déjà présente dans `test-harness/recette-v711.mjs`.

### Bug — une création réussie pouvait se retrouver dupliquée après un échec du RECHARGEMENT

**Reproduction confirmée par lecture directe du code, exactement comme demandé, AVANT tout
correctif** (`src/App.jsx`, `handleCreateEvent`, avant correction — lignes ~857-879 de la version
V7.11.1) :

1. `await agendaApi.createAgendaEvent(...)` réussit — la ligne existe déjà réellement côté
   serveur (ou, ici, côté harnais simulé) à cet instant précis.
2. `const reloaded = await reloadAgendaOrWarn(...)` — introduit par le correctif V7.11.1 pour que
   `loadAgendaEvents()` puisse désormais REJETER (avant V7.11.1, elle avalait toujours sa propre
   erreur et se résolvait normalement). `reloadAgendaOrWarn` attrape ce rejet, pose
   `setDataError("L'événement a été créé mais l'actualisation a échoué…")`, et renvoie `false`.
3. `if (!reloaded) return false;` — **c'est le bug** : `handleCreateEvent` renvoie `false`, EXACTEMENT
   le même signal que si `createAgendaEvent` lui-même avait échoué (voir le `catch` du bloc, qui
   renvoie aussi `false`). L'appelant ne peut pas distinguer les deux cas.
4. `src/components/CreateEventSheet.jsx`, `submit()` : `const success = await onCreate({...});
   setSaving(false); if (success !== false) onClose();` — `success` vaut `false`, donc `onClose()`
   n'est **jamais** appelé : le formulaire reste ouvert, ses champs restent remplis, `saving`
   retombe à `false`, et le bouton "Créer l'événement" redevient actionnable
   (`disabled={saving || !category || !title.trim() || !date}`).
5. L'utilisateur, voyant ce qui ressemble exactement à un échec de soumission (formulaire toujours
   là, bouton de nouveau cliquable, aucune confirmation visible autre que le bandeau d'erreur —
   qui dit honnêtement "créé" mais que rien dans le formulaire n'indique comme un succès), clique
   à nouveau sur "Créer l'événement" → `submit()` relance `onCreate({...})` avec le MÊME payload →
   un second, VRAI `createAgendaEvent` en base. Aucune contrainte d'unicité (titre+date) ni clé
   d'idempotence côté schéma (`sql/02_rls.sql`, non modifié) n'empêche ce doublon : deux lignes
   réelles, identiques, existent désormais.

Le même défaut existait, forme pour forme, dans `handleCreateBirthday` (même fichier, lignes
~917-934 de la version V7.11.1) vis-à-vis d'`agendaApi.createAgendaBirthday` et de
`src/components/AddBirthdaySheet.jsx` — confirmé par lecture directe, et `createAgendaBirthday`
EST réellement câblé et atteignable dans cette build (le commentaire "non vérifié sur le vrai
schéma Supabase" au-dessus de `handleCreateBirthday` porte uniquement sur les colonnes réelles
`birthday_day`/`birthday_month` du projet Supabase de l'utilisateur, hors de portée de cet
environnement — pas sur l'atteignabilité du chemin applicatif lui-même, qui est entier et
exerçable, y compris dans le harnais de test).

Reproduit ensuite RÉELLEMENT en Playwright (pas seulement par lecture), voir scénarios 26/27
ci-dessous — avant correctif, le formulaire restait effectivement ouvert avec le bouton
actionnable, et une seconde soumission produisait effectivement une seconde ligne dans l'état du
harnais (`liveEvents`).

### Correctif appliqué

**`src/App.jsx`** (`handleCreateEvent` et `handleCreateBirthday`) — l'INSERT
(`createAgendaEvent`/`createAgendaBirthday`) est désormais isolé dans son PROPRE `try/catch`,
distinct du rechargement qui suit :
- Un échec de CET appel (rien n'a été créé) renvoie `false`, comme avant — c'est le seul cas
  honnête où le formulaire doit rester ouvert pour une nouvelle tentative.
- Une fois cet appel réussi, un échec du RECHARGEMENT qui suit (`reloadAgendaOrWarn`) ne fait
  plus JAMAIS `return false`. Le message honnête ("créé mais actualisation a échoué") reste
  affiché exactement comme avant — via le bandeau `dataError`, déjà posé PAR `reloadAgendaOrWarn`
  lui-même, un canal indépendant du contrat de retour utilisé par le formulaire — mais la fonction
  renvoie désormais `true`. `CreateEventSheet.jsx`/`AddBirthdaySheet.jsx` n'ont eu besoin d'AUCUNE
  modification : leur logique existante (`if (success !== false) onClose();`) se comporte alors
  déjà correctement — le formulaire se ferme, son bouton disparaît avec lui, et aucune seconde
  soumission du même payload n'est plus possible depuis cette instance du formulaire.
  `setAgendaFilter(...)` ne bascule que si le rechargement a réussi (sinon la liste locale ne
  contient de toute façon pas encore la nouvelle ligne — comportement inchangé de ce point de vue).
- Vérifié explicitement (voir le commentaire dans `CreateEventSheet.jsx`/`AddBirthdaySheet.jsx`
  lui-même, non modifié) : aucune autre fenêtre ne remet `saving` à `false` pendant que le
  formulaire resterait monté après un succès réel — `setSaving(false)` et `onClose()` s'exécutent
  dans le même tick synchrone, sans `await` entre les deux, donc aucune re-peinture du bouton
  activé n'a l'occasion de se produire avant le démontage du formulaire.

**`test-harness/mockAgendaApi.js`** — `createAgendaEvent`/`createAgendaBirthday` étaient de purs
no-op (`return true` sans jamais toucher `liveEvents`) avant ce correctif : impossible d'écrire
honnêtement un test qui compte les lignes réellement créées. Elles insèrent désormais réellement
dans `liveEvents` (persisté, comme le reste de ce harnais), avec la même forme mappée que
`fetchAgendaEvents`. Deux nouveaux leviers ajoutés, symétriques à
`__abczed_harness_force_agenda_fetch_error__` (V7.11.1, déjà existant, réutilisé tel quel pour
simuler l'échec du RECHARGEMENT dans les scénarios ci-dessous) :
`__abczed_harness_force_create_event_error__` et `__abczed_harness_force_create_birthday_error__`
(font échouer l'INSERT lui-même, distinct du rechargement — non utilisés par les scénarios 26/27
ci-dessous, qui portent sur le cas visé par ce correctif, mais ajoutés pour permettre de tester
séparément le cas "rien n'a été créé" si besoin).

### Nouveaux scénarios Playwright (`test-harness/recette-v711.mjs`, +10 assertions : 76 -> 86)

- **26** (création d'événement) — l'INSERT réussit, seul le rechargement agenda échoue
  (`__abczed_harness_force_agenda_fetch_error__`) : erreur honnête affichée (26a), formulaire
  refermé — aucun bouton "Créer l'événement" encore actionnable (26b), **une seule** ligne créée
  dans l'état du harnais malgré l'échec du rechargement (26c), toujours une seule ligne même en
  simulant une seconde tentative "impatiente" — défense en profondeur si un bouton restait
  disponible par régression future (26d), et — une fois le levier d'échec levé et la page
  rechargée pour de vrai — exactement UN événement affiché à l'écran avec ce titre, aucun doublon
  visible (26e).
- **27** (ajout d'anniversaire) — même scénario, mêmes 5 assertions (27a-e), pour
  `handleCreateBirthday`/`AddBirthdaySheet.jsx`.

Ces deux scénarios ont été rejoués RÉELLEMENT (voir "Vérification finale" ci-dessous) : tous verts
au premier essai après correction du sélecteur de catégorie du scénario 26 (le filtre Agenda par
défaut est "tous", donc `CreateEventSheet.jsx` n'a AUCUNE catégorie présélectionnée — il a fallu
cliquer explicitement "Sorties" avant de pouvoir soumettre, sans quoi le bouton restait désactivé
— pas un bug, juste un ajustement du scénario de test lui-même).

### Assertion non probante corrigée — `test-harness/recette-v711.mjs`, "21d"

Avant correctif :
```js
ok('21d. ...', await page.locator("text=impossible d'enregistrer ta réponse", { exact: false }).count() >= 0 || true);
```
`.count()` renvoie toujours un entier `>= 0` par construction (0 = "rien trouvé" est une valeur
valide, pas une erreur) — cette comparaison était donc déjà toujours vraie à elle seule, et le
`|| true` final rendait de toute façon l'expression ENTIÈRE inconditionnellement vraie, quel que
soit le membre de gauche. Cette assertion passait donc même quand le texte d'erreur attendu était
totalement absent de la page — elle ne prouvait rien.

Corrigée en une assertion réellement falsifiable, même convention que les autres assertions du
fichier testant un texte affiché (`.isVisible()` sur un locator `text=…`, voir 21a/24a/25b) :
```js
ok('21d. ...', await page.locator("text=impossible d'enregistrer ta réponse", { exact: false }).isVisible());
```
**Revérifiée en conditions réelles, pas seulement rendue syntaxiquement correcte** : rejouée
contre le scénario RSVP en échec de contrainte réelle (`__abczed_harness_force_join_error__` =
'constraint', déjà posé par ce scénario) — le texte "Impossible d'enregistrer ta réponse —
réessaie." EST bien présent (`src/App.jsx`, `joinEvent()`, branche `else` du `catch`, seule
atteinte ici puisque `err.code` vaut `'23514'`, jamais `'ATTENDEE_NAMES_UNSUPPORTED'`) : l'intention
d'origine de cette assertion tenait bien, elle était seulement mal exprimée. Aucun autre cas où
l'intention ne tenait pas n'a été rencontré — rien à signaler de ce côté.

Grep de tout le fichier `recette-v711.mjs` pour tout autre motif structurellement toujours vrai
(`|| true`, `count() >= 0` isolé, `!== undefined` sur une valeur qui ne peut jamais l'être,
comparaison d'une valeur à elle-même) : **aucune autre occurrence trouvée**. Même grep, à titre de
vérification uniquement (aucune édition), sur `recette.mjs` et `recette-messages-isolation.mjs`
(verrouillés) : **aucune occurrence non plus** — rien à signaler, rien touché.

### Fichiers touchés (V7.11.2) — décompte vérifié

Diff exact contre l'arborescence V7.11.1 pré-correctif (copiée à part avant toute édition,
`diff -rq` hors `node_modules`/`dist`) : **3 fichiers, tous dans le périmètre autorisé de ce
correctif, aucun autre** :
1. `src/App.jsx` — isolation INSERT/rechargement dans `handleCreateEvent` et
   `handleCreateBirthday` (voir "Correctif appliqué" ci-dessus).
2. `test-harness/mockAgendaApi.js` — `createAgendaEvent`/`createAgendaBirthday` réellement câblés
   à `liveEvents` (n'étaient que des no-op avant ce correctif) + 2 nouveaux leviers d'échec
   d'INSERT (distincts du levier de rechargement, déjà existant).
3. `test-harness/recette-v711.mjs` — scénarios 26/27 ajoutés (+10 assertions), assertion "21d"
   corrigée pour de bon.

`src/components/CreateEventSheet.jsx` et `src/components/AddBirthdaySheet.jsx` — vérifiés,
**non modifiés** : leur logique existante (`if (success !== false) onClose();`) se comporte
correctement une fois `App.jsx` corrigé, aucun changement n'y était nécessaire (voir "Correctif
appliqué" ci-dessus, dernier point).

`sql/*.sql`, `scripts/sql-tests/*`, `src/reactions.js`, `src/components/Logo.jsx`,
`src/reloadScheduler.js`, `test-harness/recette.mjs` et
`test-harness/recette-messages-isolation.mjs` restent byte-identiques (diff vide confirmé) — non
touchés, comme l'exige le périmètre de ce correctif.

### Vérification finale (V7.11.2) — résultats séparés par suite, honnêtement

Chromium et PostgreSQL, disponibilité vérifiée avant exécution (jamais supposée, exactement comme
demandé) : Chromium déjà présent (`/opt/pw-browsers/chromium`, via `PLAYWRIGHT_BROWSERS_PATH`) ;
PostgreSQL 16 installé mais arrêté au démarrage de ce lot (`pg_isready` -> "no response",
`service postgresql status` -> "down") — démarré explicitement (`service postgresql start`) avant
d'exécuter les 3 suites SQL, confirmé "accepting connections" avant tout test. Les deux ont donc pu
être RÉELLEMENT exécutés dans cet environnement, pas seulement raisonnés depuis le code source.

**Node** (`scripts/test-*.mjs`, y compris `test-reload-scheduler.mjs`) — tous rejoués
individuellement : **36/36** pour `test-reload-scheduler.mjs` (inchangé, ce fichier n'a pas été
touché et ne pouvait pas l'être — `src/reloadScheduler.js` n'a pas bougé), et 0 échec sur
l'ensemble des autres suites `scripts/test-*.mjs` rejouées (agenda-search, agenda-selection,
attendee-names, avatar-color, date-search, deep-link-visibility, local-date, maps-url,
messages-sort, nav-memory, participants-summary, reactions, resolve-event, router, search-utils,
section-origin, share-flags, undefined-column-error).

**Playwright** :
- `test-harness/recette-v711.mjs` (mis à jour, scénarios 26/27 ajoutés, assertion 21d corrigée) —
  **86 assertions, 0 échec**, rejeu réel confirmé (pas un nombre annoncé sans exécution).
- `test-harness/recette-messages-isolation.mjs` (verrouillé, byte-identique) — **24 assertions, 0
  échec**, rejeu réel confirmé.
- `test-harness/recette.mjs` (verrouillé, byte-identique) — **163 assertions vertes, 1 échec**
  (scénario 42d) sur ce rejeu, avec deux assertions supplémentaires (43a, 44a) jamais atteintes
  car l'exception interrompt le bloc `try` avant elles (comportement structurel de ce fichier
  verrouillé, pas de ce correctif). **Confirmé, par comparaison directe, qu'il s'agit du MÊME
  flake déjà documenté dans la section V7.11.1 ci-dessus** ("dépendance à l'heure murale", scénario
  42d) et non d'une régression de ce correctif : le fichier est byte-identique à sa version
  pré-V7.11.2 (diff vide vérifié), et **rejoué à l'identique contre une copie de l'arborescence
  prise AVANT tout correctif de ce lot** (`/home/claude/work4/v711_1_before_bugfix2`, serveur Vite
  dédié sur le même port) — échec strictement identique (même scénario 42d, même timeout) obtenu
  sur cette copie non modifiée. Ce lot n'a pas tenté le contournement `faketime` déjà utilisé en
  V7.11.1 pour ce même flake — hors périmètre de ce correctif ciblé (2 bugs précis), et la preuve
  par comparaison directe contre l'arborescence pré-correctif suffit ici à établir la
  non-régression sans avoir besoin de le recontourner.
- **Total Playwright : 86 + 24 + 163 (+ 1 flake pré-existant confirmé non lié) = 273 assertions
  tentées, 272 vertes, 1 échec pré-existant confirmé sans rapport avec ce correctif.**

**SQL** (`scripts/sql-tests/`, aucun fichier touché par ce correctif) :
- `test_dsn_guard.py` — 26 assertions, 0 échec.
- `repro_tests.py` — 28 assertions, 0 échec.
- `discriminating_tests.py` — 12 assertions, 0 échec.
- **Total SQL : 66 assertions, 0 échec.**

**Build** : `npm run build` réussi (voir ci-dessous), aucune erreur.

**Ce qui est un résultat RÉELLEMENT observé dans cet environnement, pas une inférence depuis le
code source** : les 4 nombres ci-dessus (Node, les 3 suites Playwright, les 3 suites SQL) —
Chromium ET PostgreSQL ont pu être rendus disponibles et utilisés pour de vrai dans ce lot, aucune
suite n'a dû être remplacée par un raisonnement depuis le code seul.

## Interdiction de livraison trompeuse (rappel, V7.11.2)

Ce correctif ne touche QUE les deux points signalés par cette 2e contre-vérification indépendante
(voir "Fichiers touchés" ci-dessus) — aucune autre modification, aucun élargissement du périmètre
du brief V7.11. `sql/*.sql`, `scripts/sql-tests/*`, `src/reactions.js`,
`src/components/Logo.jsx`, `src/reloadScheduler.js` restent byte-identiques, tout comme
`test-harness/recette.mjs` et `test-harness/recette-messages-isolation.mjs`. Aucun
`npm audit fix --force` n'a été exécuté, aucune opération contre le Supabase réel de
l'utilisateur. L'unique échec rencontré pendant ce rejeu (scénario 42d de `recette.mjs`) est dans
un fichier byte-identique à l'arborescence pré-correctif, confirmé identique par exécution directe
contre cette arborescence pré-correctif elle-même — donc structurellement non causé par ce lot —
plutôt que passé sous silence ou maquillé.

# V7.12 — lot Accueil, Messages et Anniversaires

## Correctifs livrés

1. **Accueil** : deux actions rapides explicites, « Créer un événement » et « Écrire un
   message ». La première réutilise le formulaire Agenda existant ; la seconde ouvre Messages
   et place le focus dans le compositeur. Aucun bouton `+` global ambigu n'est réintroduit.
2. **Messages** : un auteur peut modifier et supprimer ses propres messages ; un administrateur
   peut supprimer tout message du groupe. Une confirmation est obligatoire avant suppression.
   Après chaque mutation, le fil réel est rechargé via l'ordonnanceur existant ; aucune mutation
   optimiste n'est affichée. Les policies RLS existantes restent la garantie serveur.
3. **Anniversaires** : les lignes sont désormais ouvrables. Le créateur ou un administrateur
   peut modifier le prénom/jour/mois et supprimer le rappel après confirmation ; les autres
   membres disposent d'une consultation en lecture seule. Les opérations réutilisent la table
   `events` et les policies RLS existantes : aucune migration SQL supplémentaire.
4. **Harnais** : les doublures Messages/Agenda couvrent les nouvelles mutations et
   `test-harness/recette-v712.mjs` décrit la recette bout en bout, persistance après F5 incluse.

## Vérification exécutée dans cet environnement

- `npm run build` : réussi, 1 600 modules transformés, aucune erreur de compilation.
- Toutes les suites `scripts/test-*.mjs` : rejouées, **0 échec**.
- Recettes Playwright : présentes et reproductibles, mais non exécutées ici. Le binaire Chromium
  n'était pas installé et `npx playwright install chromium` a échoué après plusieurs expirations
  réseau de 30 secondes. Les suites n'ont donc pas été déclarées vertes par simple inférence.
- Aucun appel au projet Supabase réel, aucune modification des fichiers `sql/*.sql`, aucun
  `npm audit fix --force`.

# V7.13 — identité visuelle, code couleur et responsive tactile

## Identité et typographie

1. **Logo** : l'ancien pictogramme à deux blocs façon puzzle n'est plus affiché. Il est
   remplacé par un petit soleil bleu et trois éclats rouges ; le mot-symbole ABCZed est prélevé
   sans redessin dans `public/abczed-logo-master.png`.
2. **Police** : Inter est remplacée par **Nunito Sans Variable**, embarquée localement via
   `@fontsource-variable/nunito-sans` (aucune dépendance à un CDN de polices).
3. **Titres** : les cinq rubriques partagent le même composant `PageTitle`, avec une ponctuation
   colorée cohérente et propre à chaque espace.

## Système de couleurs

- Marque inchangée : bleu `#0D47A1`, rouge `#E53935`, fond crème `#FBF6EC`.
- Accents de rubrique : Accueil bleu, Agenda ocre, Messages rouge, Partages turquoise,
  La Bande violet. Ils sont réutilisés dans les titres, la navigation basse, les focus et les
  actions contextuelles.
- Agenda : couleurs métier inchangées (anniversaire jaune, sortie verte, école violette,
  autre grise). Les couleurs de texte sur aplat sont maintenant explicites et testées à un
  contraste d'au moins 4,5:1 ; en particulier, le jaune Anniversaire reçoit un texte brun foncé.
- Partages : documents, photos, liens et informations possèdent chacun un accent et une teinte
  cohérents sur les filtres et les cartes.

## Agenda et téléphone

- Les pastilles restent dérivées des catégories présentes, dédupliquées et limitées selon la
  règle existante ; leur taille et leur espacement sont renforcés.
- Les jours, flèches de mois, actions icône, champs et fermetures de modale offrent des zones
  tactiles d'au moins 44 px (48 px pour les champs principaux).
- À 360 px, les sept colonnes du calendrier tiennent sans débordement tout en conservant une
  cible d'au moins 44 × 44 px. Les bandeaux de filtres défilent horizontalement au doigt.
- Le compositeur Messages reste au-dessus de la navigation basse et tient compte de la zone
  sûre du téléphone.
- L'ouverture d'une pièce jointe depuis sa carte utilise désormais un lien natif absolu dans un
  nouvel onglet, avec `noopener noreferrer`, plus stable dans les WebView mobiles.

## Vérification exécutée

- Build de production : `npm run build` réussi, **1 598 modules**, aucune erreur (seul
  l'avertissement Rollup historique sur le chunk principal > 500 kB reste présent).
- Node : **20 suites `scripts/test-*.mjs`, 255 contrôles, 0 échec**, y compris le nouveau test
  du design system et des contrastes.
- Playwright responsive V7.13 : **76 contrôles, 0 échec** sur 360×800, 390×844, 412×915 et
  768×1024 ; aucun débordement horizontal ni erreur JavaScript.
- Playwright historique : `recette-v712.mjs` **11/11**,
  `recette-v711.mjs` **86/86**, `recette-messages-isolation.mjs` **24/24** et
  `recette.mjs` **166/166**. Le scénario 42d, auparavant dépendant de l'heure murale, cible
  désormais le message réellement créé au lieu du dernier bouton du fil.
- Captures contrôlées visuellement : Accueil 390 px, Agenda 360 px et Partages 390 px.
- Aucun appel au projet Supabase réel, aucune migration SQL, aucune modification des drapeaux
  de source (`AGENDA_FROM_SUPABASE`, `MESSAGES_FROM_SUPABASE`,
  `BUSINESS_DATA_FROM_SUPABASE`).

# V7.14 — logo, système de design transversal et responsive ciblé (1ère passe corrective, UAT réelle)

Contexte : recette manuelle réelle de V7.13 par l'utilisateur final, deux points de
mécontentement précis rapportés. Périmètre STRICTEMENT limité à ces deux points (le logo, et
le système de design transversal + les règles responsive globales explicitement nommées) —
aucune autre page ni fonctionnalité touchée. Les phases suivantes construiront sur l'API
posée ici (`src/theme.js`, `src/components/Button.jsx`).

## Point 1 — Logo (symbole revu, mot-symbole inchangé)

L'ancien symbole (`src/components/Logo.jsx`) : cercle bleu décentré vers le bas (`cy=23`) et
seulement TROIS rayons rouges, tous les trois entre ~10h et ~14h — lisait comme amassé/
asymétrique plutôt que comme un soleil. Redessiné :
- Cercle bleu recentré : `cx=20 cy=20 r=8` (avant : `cx=20 cy=23 r=10.5`).
- 8 rayons rouges à intervalles angulaires strictement égaux de 45° (0/45/90/135/180/225/
  270/315°, mesurés depuis midi, sens horaire) au lieu de 3 rayons cramés dans un seul arc.
- Chaque rayon va de r=10.5 à r=15.5 (jeu constant de 2,5 unités au-delà du cercle, jamais un
  rayon qui touche/chevauche le disque central — retour utilisateur explicite : "nettement
  séparés du centre"). `strokeWidth` réduit de 5 à 3.2 (cohérent avec 8 rayons fins plutôt que
  3 rayons épais) ; `strokeLinecap="round"` conservé pour le rendu ludique.
- Extension maximale d'un rayon (rayon + moitié de l'épaisseur du trait) = 15.5 + 1.6 = 17.1,
  largement à l'intérieur du viewBox 40×40 (rayon max 20 depuis le centre) — donc rendu
  identique, sans recadrage, à toutes les tailles réellement utilisées (18px `CompactHeader`,
  30px header principal/`BottomNav`, jusqu'à 60px testé visuellement).
- Le mot-symbole ABCZed (bloc `backgroundImage` prélevé dans `public/abczed-logo-master.png`)
  n'est pas touché — pixel-identique à V7.13, comme demandé.
- Vérifié par CALCUL (pas à l'œil) : `scripts/test-design-system.mjs` relit le SVG source et
  vérifie programmatiquement (a) exactement 8 rayons, (b) jeu cercle↔rayon ≥1.5 unité pour
  chacun, (c) extension max ≤ 20 (jamais hors viewBox), (d) écart angulaire strictement égal
  (45° entre rayons consécutifs, tolérance 0.5°). `test-harness/recette-v714.mjs` revérifie en
  navigateur réel que le logo reste visible et à 8 rayons à 320/360/400px.

## Point 6 — Système de design transversal (couleurs franches, pas de pastel délavé)

Retour utilisateur explicite : l'interface "lit" comme pastel délavé malgré des tokens de
marque francs déjà présents dans `theme.js`. Audit du code (pas seulement de l'impression
visuelle) : les teintes (`BLUE_TINT`/`RED_TINT`/`*.tint` de CATEGORIES/SECTION_THEMES/
SHARE_TYPE_THEMES) servaient de fond à des ÉLÉMENTS INTERACTIFS eux-mêmes —
`ActionButton.jsx` ("Ouvrir"/"Télécharger" en fond `#EAF1FB` + texte bleu 12px) et les deux
boutons rapides de l'Accueil (V7.12, fond teinté + bordure colorée). Un aplat pâle à faible
contraste, répété sur plusieurs écrans, est ce qui lit comme "délavé" — pas les couleurs de
marque elles-mêmes, qui restent hors de ce correctif (BLUE `#0D47A1`, RED `#E53935`, BG
`#FBF6EC` inchangés, comme demandé, ainsi que toutes les couleurs métier CATEGORIES/
SECTION_THEMES/SHARE_TYPE_THEMES — aucune recolorisation arbitraire).

**Convention ajoutée** (commentaire en tête de `src/theme.js`, à suivre par les phases
suivantes) : aplat solide (`color`) réservé à l'action primaire/importante, à l'état actif/
sélectionné et à l'anneau de focus — texte toujours `onColor` du même groupe, jamais choisi à
la main ; teinte (`tint`) réservée au non-interactif (fond de carte, badge, chip inactif, halo
décoratif) — jamais le fond d'un bouton/lien qui déclenche une action.

**Nouveaux tokens `src/theme.js`** (aucun token existant supprimé ni recoloré) :
- `MIN_TOUCH_TARGET = 44` — seuil documenté et testé, réutilisé par `buttonStyle()`,
  `ActionButton.jsx`, et les tests.
- `SPACING = { xs:4, sm:8, md:12, lg:16, xl:20, xxl:24 }` — vocabulaire d'espacement commun
  pour les nouveaux styles (ne réécrit pas rétroactivement les marges déjà en place).
- `SHADOW_CARD` / `SHADOW_ELEVATED` — deux niveaux d'ombre (carte / sheet-modale).
- `TEXT` — échelle typographique (`h1`/`h2`/`body`/`bodyStrong`/`small`/`tiny`/`button`).
  `TEXT.h1` reprend exactement les valeurs déjà utilisées par `PageTitle.jsx` (32/820/-0.55/
  1.06) — extraites, pas changées ; `PageTitle.jsx` les consomme désormais depuis ce token
  (aucun changement visuel).
- `SECTION_THEMES.*.onColor` — un `onColor` par accent de rubrique (même rôle que pour
  `CATEGORIES`), nécessaire dès qu'un accent sert de fond solide à un bouton. Calculé, pas
  choisi à l'œil : le rouge Messages (`#E53935`) échoue le seuil 4,5:1 avec du blanc
  (≈4,23:1) — son `onColor` est `#1A0000` (quasi noir, ≈4,76:1) ; les 4 autres accents
  passent largement avec `#FFFFFF`. Contrôlé pour chaque entrée par
  `scripts/test-design-system.mjs`.
- `buttonStyle(variant, opts)` — fonction partagée derrière les 4 variantes de bouton
  (`primary`/`secondary`/`destructive`/`icon`), garantissant `MIN_TOUCH_TARGET` par défaut.

**Nouveau composant partagé — API pour les phases suivantes** : `src/components/Button.jsx`
(`import Button from '../components/Button'`), construit sur `buttonStyle()`. Props :
`variant` ('primary' par défaut, 'secondary', 'destructive', 'icon'), `color`, `onColor`,
`compact` (descend de `BUTTON_H`=48 à `MIN_TOUCH_TARGET`=44, jamais moins), `icon` (composant
lucide-react), `iconSize`, `as` (élément rendu, `'button'` par défaut). Applique
automatiquement l'anneau de focus/le retour "pressé" déjà partagés par toute l'app via la
classe CSS globale `.tap-surface` (`src/App.jsx`) — aucun style de focus/pressed à redéfinir
composant par composant.

**Composants/écrans effectivement corrigés par cette passe** (surfaces globales/partagées
uniquement, comme délimité par le brief — aucune page-métier réécrite) :
- `ActionButton.jsx` ("Ouvrir"/"Télécharger", partagé par `Partages.jsx`/`EventDetail.jsx`) :
  état actionnable passé de fond teinté `#EAF1FB` + texte bleu 12px à aplat BLUE plein + texte
  blanc 13px, zone tactile portée à `MIN_TOUCH_TARGET` (44px, avant : ~25px réels malgré un
  `padding` de 6px).
- Actions rapides de l'Accueil ("Créer un événement"/"Écrire un message", V7.12) : passées de
  fond teinté + bordure colorée à aplat solide (via le nouveau composant `Button`), preuve
  d'usage réelle de l'API plutôt que théorique.
- `PageTitle.jsx` : consomme `TEXT.h1` (aucun changement visuel, démonstration d'adoption).
- Audit des zones tactiles des composants partagés touchés : `BottomNav.jsx` (onglets déjà à
  64px de haut, ≥44px — confirmé, non modifié), `ActionButton.jsx` (corrigé ci-dessus),
  `PageTitle.jsx` (aucun élément interactif, non concerné).

**Ce qui n'a délibérément PAS été touché** (hors périmètre explicite de cette passe, laissé
aux phases suivantes qui pourront consommer `theme.js`/`Button.jsx`) : le bouton "Ajouter un
partage" et le badge "Voir l'événement : …" de `Partages.jsx` restent en teinte pâle — ce sont
des éléments de page métier, pas des composants globaux/partagés ; `EventDetail.jsx` (grille
d'actions), `Messages.jsx` (bulles), le sélecteur de catégorie de `CreateEventSheet.jsx` :
aucun n'a été réécrit, conformément au périmètre du brief.

## Règles responsive explicitement nommées par le brief (global/transversal)

- **Accueil, actions rapides** : au lieu de rester côte à côte à toutes les largeurs, la
  classe `.home-quick-actions` (règle globale, `src/App.jsx`) les empile désormais
  verticalement sous 340px. **Constat honnête** : avec l'ANCIEN style (fond teinté, texte
  13px), ces deux boutons ne débordaient PAS à 320px (mesuré : 139px de contenu réel pour
  141px de largeur disponible, marge de 2px, zéro débordement de document ni de bouton) — le
  brief supposait un débordement qui n'existait pas encore. Avec le NOUVEL aplat solide
  (police de bouton légèrement plus grande, `TEXT.button` = 14.5px contre 13px avant), la
  marge disparaît réellement à 320px ; le filet de sécurité CSS a donc une utilité réelle et
  mesurée avec le nouveau style, pas seulement théorique. Vérifié par
  `test-harness/recette-v714.mjs` aux 3 largeurs (empilé à 320px, côte à côte à 360/400px,
  jamais de débordement).
- **Partages, chips de filtre** : `.filter-strip` (base, partagée avec `Agenda.jsx`) défilait
  horizontalement avec la scrollbar masquée (`scrollbar-width:none`) — à 320/360px, le
  dernier chip ("Liens") sortait entièrement du champ visible SANS indice qu'il restait un
  chip cliquable hors écran (mesuré : `scrollWidth` 346px pour `clientWidth` 296px à 320px,
  soit 50px de contenu invisible). Un modificateur dédié `.filter-strip--wrap` (flex-wrap),
  appliqué UNIQUEMENT dans `Partages.jsx`, fait passer la ligne en deux lignes à 320/360px —
  jamais de chip tronqué ni de défilement caché, une seule ligne dès que la largeur le permet
  (≥400px pour ces 5 chips). `Agenda.jsx` garde son propre défilement horizontal existant
  (classe de base seule) — page non touchée par ce correctif, comme délimité par le brief.
- **La Bande, texte explicatif de carte parent** : la ligne enfants/groupe (ou le statut par
  défaut "Membre de la communauté") sous le nom du parent passe de 13px/poids 500 à 14px/
  poids 560, plus lisible face au nom en 700. **Constat honnête** : aucune "espace vide
  excessive" n'a été trouvée dans le markup réel de `LaBande.jsx` — la hauteur de chaque
  carte (mesurée : ~70-72px) est strictement dictée par son contenu (avatar 40px + padding
  14px×2), sans marge résiduelle à retirer. Seule la taille de texte a donc été corrigée ;
  aucune suppression de marge n'a été appliquée puisqu'aucune n'était en trop.
- **Zéro débordement horizontal** (contrainte globale) : vérifié à 320/360/400×824 sur
  Accueil, Agenda, Messages, Partages, La Bande, et le sheet "Ajouter un événement" — 0px de
  débordement partout, aucune régression introduite par cette passe.
- **Zones tactiles ≥44px** : `MIN_TOUCH_TARGET` (theme.js) + audit de `BottomNav.jsx` (déjà
  conforme, 64px) et correctif de `ActionButton.jsx` (voir Point 6 ci-dessus).

## Vérification exécutée dans cet environnement (résultats réels, pas inférés)

Chromium disponible et utilisé (`/opt/pw-browsers/chromium`, comme en V7.11.2/V7.13 dans cet
environnement) — aucune suite Playwright remplacée par un raisonnement depuis le code seul.

- `npm run build` : réussi, **1 599 modules transformés**, aucune erreur (seul l'avertissement
  Rollup historique sur le chunk principal >500 kB, inchangé depuis les passes précédentes).
- Node (`scripts/test-*.mjs`, 20 suites, y compris `test-design-system.mjs` étendu) : rejouées
  individuellement, **254 contrôles numérotés, 0 échec** (19 suites à compteur explicite +
  `test-design-system.mjs`, qui affiche une confirmation agrégée plutôt qu'un compteur,
  comme avant cette passe).
- Playwright :
  - `test-harness/recette-v714.mjs` (nouveau, ce correctif) — **52 contrôles, 0 échec**, à
    320×824/360×824/400×824.
  - `test-harness/recette.mjs` (verrouillé, byte-identique) — **166/166**.
  - `test-harness/recette-messages-isolation.mjs` (verrouillé, byte-identique) — **24/24**.
  - `test-harness/recette-v711.mjs` (verrouillé, byte-identique) — **86/86**.
  - `test-harness/recette-v712.mjs` (verrouillé, byte-identique) — **11/11**.
  - `test-harness/recette-v713.mjs` (verrouillé, byte-identique) — **76/76**.
  - **Total Playwright : 415 contrôles tentés, 415 verts, 0 échec.**
- Diff exact vs la base V7.13 (`diff -rq`, node_modules/dist/artifacts exclus) : 8 fichiers
  modifiés (`scripts/test-design-system.mjs`, `src/App.jsx`, `src/components/ActionButton.jsx`,
  `src/components/Logo.jsx`, `src/components/PageTitle.jsx`, `src/pages/Accueil.jsx`,
  `src/pages/LaBande.jsx`, `src/pages/Partages.jsx`, `src/theme.js`) et 2 fichiers nouveaux
  (`src/components/Button.jsx`, `test-harness/recette-v714.mjs`) — rien d'autre.
- Garde-fous revérifiés : `package.json`/`package-lock.json` byte-identiques (aucune
  dépendance ajoutée/retirée) ; `sql/*.sql` byte-identiques ; les 5 fichiers Playwright
  verrouillés (`recette.mjs`, `recette-messages-isolation.mjs`, `recette-v711.mjs`,
  `recette-v712.mjs`, `recette-v713.mjs`) byte-identiques ; aucun `npm audit fix --force` ;
  aucun appel au Supabase réel de l'utilisateur.

## Rappel de périmètre (ce que cette passe n'a PAS touché, volontairement)

`src/useScrollRestore.js`, `src/sectionOrigin.js`, le comportement de clic-date de
`Agenda.jsx`, la grille d'actions de `EventDetail.jsx`, l'alignement/édition/suppression des
messages de `Messages.jsx`, le clic-traversant et l'upload réel de `Partages.jsx`, le
mécanisme de retour contextuel de `LaBande.jsx`, le sélecteur de catégorie/la validation de
`CreateEventSheet.jsx`, le filtrage des événements passés — tous laissés strictement
inchangés, pour des phases suivantes qui pourront s'appuyer sur `theme.js`/`Button.jsx`
posés ici.

# V7.14 (suite) — 2e passe corrective : domaine Agenda/événement (points 3, 4, 5, 12, 13, 14, 15)

Contexte : 2e passe de la même recette UAT V7.14, portant précisément sur ce que la 1ère passe
(ci-dessus) avait explicitement laissé de côté ("Rappel de périmètre") — le clic-date de
`Agenda.jsx`, la grille d'actions de `EventDetail.jsx`, le sélecteur de catégorie/la validation
de `CreateEventSheet.jsx`, et le filtrage des événements passés. Construit sur les primitives
posées en 1ère passe (`theme.js` : `buttonStyle`, `SPACING`, `MIN_TOUCH_TARGET`, `onColor`) — pas
de nouveau style inline pour les boutons corrigés ici.

## Point 3 — Clic sur une date du calendrier avec événement(s)

**Vérifié dynamiquement (navigateur réel), pas supposé** : la préservation du filtre de
catégorie et l'absence de doublon entre le panneau du jour et "À venir" étaient déjà correctes
avant cette passe — `upcomingExcludingSelected` (`agendaSearch.js`) retire déjà du calcul
d'"À venir" tout événement présent dans `selectedDateEvents`, et le clic sur une date ne touche
jamais `filter`. **Le seul vrai manque** : aucun défilement automatique si le panneau révélé
tombe hors du champ visible (bas de calendrier proche du bord de l'écran, petits viewports).

**Corrigé** : `selectDate(dateStr, alreadySelected)` (nouveau, `Agenda.jsx`) encapsule désormais
le clic sur une cellule de calendrier ; une fois la date sélectionnée, `afterPaint()`
(`src/motionPrefs.js`, déjà utilisé par `useScrollRestore.js` — même mécanisme, pas un second)
fait défiler `#agenda-selected-date-panel` (nouvel `id`, ajouté sur le conteneur déjà existant)
dans le champ visible, `behavior: prefersReducedMotion() ? 'auto' : 'smooth'` — cohérent avec la
convention déjà posée par `useScrollRestore.js`.

**Preuve — discriminante, dans un navigateur réel, viewport volontairement bas (375×520)** pour
que le panneau tombe réellement hors champ avant tout défilement (sinon le test ne prouverait
rien) : `test-harness/recette-v714.mjs`, bloc "Point 3" — filtre "Sorties" actif → création d'un
événement du jour même (catégorie préremplie par le filtre courant) → retour sur Agenda, filtre
toujours "Sorties" → clic sur la cellule du jour → panneau révélé immédiatement, filtre inchangé,
un seul exemplaire du titre à l'écran (pas de doublon), et le panneau se retrouve bien dans le
rectangle visible après l'attente d'`afterPaint`. 6 assertions, toutes vertes.

## Point 15 — "À venir" (Agenda.jsx) et "Prochain événement" (Accueil.jsx) : événements passés

**Bug confirmé par lecture de code puis reproduit en navigateur réel** (pas supposé) : `Accueil.jsx`
(`nextEvent`) et `Agenda.jsx` (`upcomingAll`) triaient chronologiquement TOUS les événements
datés (`e.date`) sans jamais en exclure aucun — un événement déjà passé pouvait s'afficher comme
"prochain événement" ou rester dans "À venir" indéfiniment. Les anniversaires étaient déjà
correctement gérés via `nextOccurrence()` (occurrence future recalculée) — seuls les événements
datés ordinaires étaient en cause.

**Corrigé** : nouvelle fonction pure `isUpcomingEvent(event, reference = new Date())`
(`src/agendaSearch.js`) — réutilise `localIso` (`src/localDate.js`, jamais une comparaison de
date réimplémentée en UTC) : un événement avec une heure de départ (`startTime`) compare
date+heure exactes en LOCAL (`new Date(\`${date}T${time}\`)`, interprété en heure locale par le
moteur JS) ; un événement daté SANS heure reste "à venir" jusqu'à la FIN de son propre jour
calendaire (comparaison par date seule, jamais exclu à l'instant même où "aujourd'hui" commence).
`Accueil.jsx`/`nextEvent` et `Agenda.jsx`/`upcomingAll` filtrent désormais par cette fonction
avant le tri (les anniversaires restent routés via `nextOccurrence`, inchangé). Un événement daté
qui devient passé reste par ailleurs pleinement consultable depuis sa vraie date dans le
calendrier — seule la liste "à venir" l'exclut, rien n'est supprimé ni masqué ailleurs.

**Preuve — double, comme exigé par le brief** :
- Test Node dédié, scénario exact imposé : `scripts/test-upcoming-events.mjs` (nouveau) — importe
  `isUpcomingEvent` directement depuis `src/agendaSearch.js` (jamais une réimplémentation locale),
  référence figée au 19/09/2026, trois événements passés (10/14/15 septembre) et un futur (25
  septembre) : aucun des trois passés n'apparaît dans le résultat "à venir" calculé, le futur y
  apparaît. Plus les cas limites (même jour sans heure à midi/23h59, comparaison avec heure exacte,
  événement sans `date`). **11/11 assertions.**
- Vérification en navigateur réel (pas seulement la fonction pure isolée) :
  `test-harness/recette-v714.mjs`, bloc "Point 15" — création d'un événement daté HIER (date
  calculée dynamiquement par rapport à la vraie date d'exécution, jamais une constante figée qui
  finirait par être dépassée) : n'apparaît ni dans "À venir" (Agenda, filtre "Tous") ni comme
  "Prochain événement" sur l'Accueil, mais reste consultable depuis sa date réelle dans le
  calendrier. **5/5 assertions.**

**Effet de bord nécessaire, documenté honnêtement** : ce correctif rendait plusieurs événements de
démonstration de `src/data.js` (`evt-zoo`, `evt-piquenique`, `evt-gouter-voisins`, `evt-rentree`,
datés mai/juin **2025**) réellement passés par rapport à la date d'exécution réelle (2026-09-19)
— exactement le comportement voulu par ce correctif, mais qui cassait en cascade une dizaine de
scénarios historiques de `test-harness/recette.mjs` qui présumaient ces événements toujours
atteignables via "À venir" sans navigation explicite. Après avoir évalué puis écarté un correctif
scénario-par-scénario (trop de surface, risque de divergence), la date de ces 5 événements a été
décalée de 2025 à **2032** (année seule, mois/jour conservés pour ne pas casser les libellés
narratifs comme "24 mai") — vérifié par `grep` que seuls `data.js` et `recette.mjs` référencent
ces dates littérales avant modification. Un bug latent alors révélé dans le scénario 28 existant
(navigation de mois toujours vers l'arrière, jamais vers l'avant) a été corrigé au passage
(direction calculée par le signe du delta de mois). Résultat : `recette.mjs` repasse à **166/166**
sans qu'aucun de ses scénarios n'ait eu besoin d'être réécrit un par un.

## Points 4 & 5 — Grille d'actions de la fiche événement (EventDetail.jsx)

**Point 4, incohérence confirmée par lecture de code puis capture d'écran** : les boutons
Modifier/Annuler de la ligne "VOUS" utilisaient une échelle bespoke (~40px de haut, rayon 10)
distincte du reste de l'app (48px, rayon 14, ou plancher compact 44px) ; "Voir la discussion
liée" et "Supprimer l'événement" avaient chacun leur propre marge ad hoc et un troisième
traitement visuel (bordure neutre + texte/icône bleu, ni `primaryBtn` ni `secondaryBtn`). Un
défaut latent de contraste a aussi été trouvé au passage : `primaryBtn(cat.color, disabled)`
n'utilisait jamais l'`onColor` de la catégorie — texte blanc sur fond gris clair ("Autre") en
particulier, sous le seuil de lisibilité.

**Corrigé, en réutilisant `buttonStyle()`/`theme.js` (aucun style inline nouveau)** :
`primaryBtn`/`secondaryBtn` (helpers locaux d'`EventDetail.jsx`) délèguent maintenant à
`buttonStyle('primary', {color, onColor})`/`buttonStyle('destructive')` — `onColor` propagé aux 4
points d'appel de `primaryBtn` (corrige le défaut de contraste latent) ; les boutons
Modifier/Annuler de la ligne "VOUS" passent à `buttonStyle('secondary'/'destructive', {compact:
true})` (44px, cohérent avec leur contexte plus dense) ; "Voir la discussion liée" et "Supprimer
l'événement" sont réunis dans un seul conteneur à `gap: SPACING.md` unique, tous deux à
`buttonStyle('secondary'/'destructive')` (48px, rayon 14 — même échelle que le CTA RSVP
au-dessus). Une seule échelle hauteur/rayon/espacement sur toute la fiche.

**Point 5, "grand espace vide" — recherché par capture d'écran réelle, pas supposé** : aucune
règle CSS spécifique à `EventDetail.jsx` n'a été trouvée qui produirait un espace vide
particulier à cette page. La cause identifiée est structurelle et transversale : le conteneur
racine de l'app (`App.jsx`, `minHeight: '100vh'`) combiné à la barre de navigation `position:
fixed` fait que TOUTE page à contenu court (pas seulement EventDetail) laisse un espace résiduel
sous son contenu — ce n'est pas un bug local à corriger ni à masquer ici, et rien n'a été changé
sur ce point précis. Conformément à la permission explicite du brief ("si les boutons sont
fonctionnellement corrects et que ce n'est qu'une incohérence d'espacement/de taille, le dire
plutôt qu'inventer un problème plus profond"), ceci est rapporté tel quel plutôt que retouché à
l'aveugle sur une page isolée.

**Preuve** : `test-harness/recette-v714.mjs`, bloc "Point 4" — sur "Sortie au zoo" (mode
accompagnement), les boutons d'action présents (CTA d'inscription + "Supprimer l'événement")
partagent la même hauteur (48px, calculée par `getComputedStyle`) et le même rayon (14px). 2/2
assertions. ("Voir la discussion liée" n'est atteignable sur aucun événement de ce harnais — seul
`evt-piscine`, délibérément exclu de l'agenda "live" simulé depuis la 6e passe pour tester le
repli `MOCK_EVENTS`, l'a — donc non exercé ici ; sa cohérence de style est garantie par le fait
qu'il consomme le même `buttonStyle('secondary')` que le bouton "Supprimer", vérifié par lecture
de code.)

## Points 12, 13, 14 — Formulaire de création d'événement (CreateEventSheet.jsx)

### Décision produit explicite (supersède la "règle verrouillée" précédente)

Avant cette passe : `CREATABLE = ['sortie', 'ecole', 'autre']`, trois boutons de catégorie
séparés, anniversaire explicitement exclu par un commentaire "règle verrouillée" — les
anniversaires se créaient exclusivement via `AddBirthdaySheet.jsx`, un formulaire séparé.

**Décision explicite de cette passe, qui supersède cette règle** (documentée dans le code —
`CreateEventSheet.jsx`, en tête — et ici) : un seul sélecteur `<select>` "Catégorie", 4 options
réelles (Anniversaire, Sortie, École, Autre), catégorie obligatoire. Le placeholder "Choisir une
catégorie" (`<option value="" disabled>`) ne compte jamais comme un choix valide — `''` n'est la
clé d'aucune vraie catégorie, jamais confondu avec l'index 0 d'un vrai choix.

**Routage retenu** : `CreateEventSheet` prend deux props, `onCreate` (événement complet) ET
`onCreateBirthday` (anniversaire) — une seule fonction `submit()` choisit laquelle appeler selon
`category === 'anniversaire'`, jamais le payload "événement complet" pour un anniversaire (qui
n'a ni date complète, ni heure, ni lieu). Quand "Anniversaire" est sélectionné, le formulaire
s'adapte : Prénom + Jour + Mois seulement (mêmes champs, même règle qu'`AddBirthdaySheet.jsx`),
aucun champ Date/Heure/Lieu/Détails. `AddBirthdaySheet.jsx` reste utilisé tel quel, mais
**uniquement pour la MODIFICATION d'un anniversaire existant** — sa branche `onCreate` (appelée
seulement quand `birthday` est `null`) n'est plus jamais atteinte depuis l'interface (le CTA
"Ajouter un anniversaire" d'`Agenda.jsx` appelle désormais `onAdd`, comme les 3 autres filtres,
au lieu d'`onAddBirthday`) — laissée en place plutôt que supprimée, au cas où un flux dédié en
aurait de nouveau besoin un jour.

**Labels permanents ajoutés (point 12)** : Date/Heure/Lieu/Détails n'avaient jusqu'ici qu'un
`placeholder` (disparaît à la première frappe) — chacun a désormais un `<label>` visible en
permanence (`Date`, `Heure (optionnel)`, `Lieu (optionnel)`, `Détails (optionnel)`), sans
dupliquer Titre (déjà un placeholder seul, volontairement laissé ainsi — hors périmètre explicite
de ce point) ni Catégorie (déjà traité ci-dessus).

### Validation réelle (point 13)

Avant cette passe : le bouton de soumission restait `disabled` tant que les champs requis
n'étaient pas remplis — aucune tentative invalide n'était donc jamais possible, et donc aucune
erreur ne pouvait jamais être montrée à un utilisateur qui ne comprendrait pas pourquoi le bouton
reste inerte (particulièrement problématique au clavier/lecteur d'écran, sans indice sur QUEL
champ manque).

**Corrigé** : le bouton "Créer l'événement"/"Ajouter l'anniversaire" est désormais **toujours
cliquable** (sauf pendant l'enregistrement) ; `validate()` (fonction pure, `CreateEventSheet.jsx`)
calcule les erreurs réelles à la soumission — message inline sous chaque champ invalide (rouge,
`RED` de `theme.js`, jamais un hex codé en dur), bordure rouge sur le champ concerné,
`aria-invalid="true"` + `aria-describedby` pointant vers le message réel, et le focus clavier se
déplace PROGRAMMATIQUEMENT sur le PREMIER champ en erreur dans l'ordre du formulaire
(`focusFirstError`, une `ref` par champ). Une soumission invalide ne ferme JAMAIS le formulaire
et ne touche à AUCUNE valeur déjà saisie (seuls `errors` et le focus changent) — vérifié
explicitement par un scénario dédié (saisie d'un brouillon, échec de validation sur un AUTRE
champ, brouillon toujours intact).

### Confirmation et destination après création (point 14)

Avant cette passe : une création réussie fermait simplement la feuille et appelait
`setAgendaFilter(payload.category)` — l'utilisateur retombait sur la position de scroll figée
d'Accueil (ou de la page d'où le formulaire avait été ouvert), sans aucune confirmation visible
ni lien évident vers ce qui vient d'être créé.

**Vérifié avant d'écrire quoi que ce soit** : recherche de "toast"/"Toast" dans `src/` —
inexistant, confirmant qu'il fallait construire le plus petit composant qui convienne plutôt que
d'ajouter une dépendance tierce (brief explicite : "ce projet n'a pas de système de toast").

**Corrigé** : nouveau composant `src/components/Toast.jsx` (construit sur les tokens `theme.js` —
`INK`, `SHADOW_ELEVATED`, `RADIUS_MD`, `TEXT`, `SPACING` — jamais un style inventé séparément),
`role="status"`/`aria-live="polite"`, auto-disparition après 3,2s. Après une création réussie
(événement ou anniversaire) : le toast affiche "Événement créé."/"Anniversaire ajouté." ; la
destination dépend de ce qu'on sait créer avec certitude — `createAgendaEvent`/
`createAgendaBirthday` (`agendaApi.js`) renvoient désormais `{ id }` (changement additif : ajout
d'un `.select('id').single()` sur l'insert existant, aucune signature retirée, aucun appelant
existant cassé), donc quand l'id est connu, la navigation atterrit directement sur la **fiche du
nouvel événement** (`setView('event-detail')`) ; pour un anniversaire (dont la fiche n'a pas de
vue dédiée dans ce parcours), retour sur Agenda avec le NOUVEAU mécanisme de repère visuel déjà
existant réutilisé tel quel (`.nav-restore-highlight`/`navMemory`, via `captureNavState`) sur la
ligne `agenda-row-<id>` du nouvel anniversaire — jamais un second mécanisme de surlignage inventé
en parallèle. Dans les deux cas, `agendaFilter` reste mis à jour comme avant (non régressé). La
distinction V7.11.2 création-réussie-mais-rechargement-en-échec est strictement préservée : le
toast et la navigation ne s'exécutent que dans la branche `if (reloaded)` — un rechargement en
échec continue d'afficher le message honnête existant ("créé mais l'actualisation a échoué"),
sans navigation ni faux succès.

**Preuve — 3 blocs dédiés dans `test-harness/recette-v714.mjs`** (Points 12/13/14, 26 assertions
au total) :
- 4 options exactes du sélecteur (Anniversaire/Sortie/École/Autre) + placeholder désactivé jamais
  compté comme un choix.
- Soumission vide → erreur "Choisis une catégorie.", `aria-invalid`/`aria-describedby` corrects,
  focus sur le sélecteur, formulaire non fermé.
- Catégorie "Autre" choisie, Titre/Date vides → deux erreurs, focus sur Titre (premier champ en
  erreur), saisie ultérieure du titre préservée après l'échec précédent.
- Catégorie "Anniversaire" → apparition de Prénom/Jour/Mois, absence de Date/Lieu/Détails ;
  soumission vide → erreur "Indique un prénom.", focus sur Prénom, `aria-invalid` correct.
- Création réussie (bloc Point 3/15, réutilisé) : toast "Événement créé." visible, atterrissage
  confirmé sur la fiche du nouvel événement (présence du bouton "Supprimer l'événement" + du
  titre), filtre catégorie conservé.

## Effets de bord nécessaires sur les fichiers de test — documentés honnêtement

La 1ère passe V7.14 qualifiait `recette.mjs`, `recette-v711.mjs`, `recette-v712.mjs` et
`recette-v713.mjs` de "verrouillé, byte-identique". Cette 2e passe les a modifiés — **pas par
dérive de périmètre, mais parce que le sélecteur de catégorie unifié (points 12-14) change
réellement le DOM que ces suites pilotent** : trois boutons de catégorie remplacés par un
`<select>`, la boîte de dialogue "Ajouter un anniversaire" remplacée par la même boîte
"Ajouter un événement" que les autres catégories (catégorie préremplie), les champs Prénom/Jour du
formulaire d'anniversaire passés d'un `placeholder` seul à un `<label>` réel. Chaque suite
préexistante qui pilotait l'ANCIEN formulaire a été mise à jour pour piloter le nouveau,
strictement — aucune assertion de comportement métier n'a été affaiblie ou retirée :
- `test-harness/recette-v711.mjs` : scénario 26 (sélection de catégorie via `#ces-category`
  plutôt qu'un bouton "Sorties" ; date de test rendue dynamique — `localIso(+60 jours)` au lieu
  d'une constante `'2026-06-15'` qui serait devenue passée par le Point 15 ci-dessus, donc exclue
  de "À venir" et faisant échouer l'assertion finale sans lien avec le comportement réellement
  testé) ; scénario 27 (dialogue "Ajouter un événement", `getByLabel` au lieu de
  `getByPlaceholder`, sélecteur de mois désambiguïsé du sélecteur de catégorie).
- `test-harness/recette-v712.mjs` : même mise à jour de sélecteurs pour le scénario de création
  puis modification d'anniversaire (5a-5c) — la modification elle-même (`AddBirthdaySheet.jsx` en
  mode édition, jamais touché) est restée intégralement inchangée.
- `test-harness/recette-v713.mjs` : même mise à jour pour le contrôle de zone tactile ≥44px de la
  boîte de dialogue "Ajouter un anniversaire" (devenue "Ajouter un événement").
- `test-harness/mockAgendaApi.js` : miroir exact du changement additif d'`agendaApi.js`
  (`createAgendaEvent`/`createAgendaBirthday` renvoient `{ id }`) — nécessaire pour que le Point
  14 (navigation vers la fiche créée) soit exerçable dans le harnais.
- `src/data.js` et `test-harness/recette.mjs` : voir le paragraphe dédié du Point 15 ci-dessus
  (décalage de 5 dates de démonstration 2025→2032, direction de navigation de mois du scénario 28
  corrigée).

Chaque changement ci-dessus a été vérifié en isolant sa cause exacte avant modification (jamais
un correctif à l'aveugle) — voir le détail dans les sections Points 3/15/12-14 ci-dessus.

## Vérification exécutée dans cet environnement (résultats réels, pas inférés)

Chromium disponible et utilisé (`/opt/pw-browsers/chromium`), comme en 1ère passe — aucune suite
Playwright remplacée par un raisonnement depuis le code seul.

- Node (`scripts/test-*.mjs`, 21 suites — 20 à compteur explicite + `test-design-system.mjs`,
  confirmation agrégée) : rejouées individuellement, **265 contrôles numérotés, 0 échec** (254 de
  la 1ère passe + 11 pour `test-upcoming-events.mjs`, nouveau, Point 15).
- Playwright :
  - `test-harness/recette-v714.mjs` (étendu, additif à la 1ère passe — les 52 contrôles
    responsive/design system d'origine restent inchangés, 40 nouveaux contrôles ajoutés pour les
    Points 3/4/5/12/13/14/15) — **92/92, 0 échec**.
  - `test-harness/recette.mjs` (mis à jour, voir "Effets de bord" ci-dessus) — **166/166**.
  - `test-harness/recette-messages-isolation.mjs` (non touché) — **24/24**.
  - `test-harness/recette-v711.mjs` (mis à jour) — **86/86**.
  - `test-harness/recette-v712.mjs` (mis à jour) — **11/11**.
  - `test-harness/recette-v713.mjs` (mis à jour) — **76/76**.
  - **Total Playwright : 455 contrôles tentés, 455 verts, 0 échec.**
- Diff exact vs l'instantané pris avant cette 2e passe (`diff -rq`, `node_modules`/`dist`/
  `artifacts`/`.git` exclus) : 10 fichiers modifiés (`src/App.jsx`, `src/agendaApi.js`,
  `src/agendaSearch.js`, `src/components/CreateEventSheet.jsx`, `src/data.js`,
  `src/pages/Accueil.jsx`, `src/pages/Agenda.jsx`, `src/pages/EventDetail.jsx`,
  `test-harness/mockAgendaApi.js`, `test-harness/recette.mjs`) + 4 fichiers de test mis à jour
  pour suivre le nouveau formulaire (`test-harness/recette-v711.mjs`, `-v712.mjs`, `-v713.mjs`,
  `-v714.mjs` — ce dernier étendu, pas seulement mis à jour) et 2 fichiers nouveaux
  (`src/components/Toast.jsx`, `scripts/test-upcoming-events.mjs`) — rien d'autre.
- Garde-fous revérifiés : `sql/*.sql` non touchés, `scripts/sql-tests/*` non touchés,
  `src/reloadScheduler.js` non touché, `src/reactions.js` non touché, signatures EXISTANTES
  d'`agendaApi.js` inchangées (ajout additif de `{ id }` au retour de deux fonctions, aucun
  paramètre ni export retiré), `Messages.jsx`/`Partages.jsx`/`LaBande.jsx` non touchés,
  `useScrollRestore.js`/`sectionOrigin.js`/`navMemory.js` non touchés (le mécanisme de repère
  visuel du Point 14 les RÉUTILISE via `captureNavState`, ne les modifie pas),
  `AGENDA_FROM_SUPABASE=true`/`MESSAGES_FROM_SUPABASE=true`/`BUSINESS_DATA_FROM_SUPABASE=false`
  inchangés, aucun `npm audit fix --force`, aucun appel au Supabase réel de l'utilisateur.

## Limites connues, honnêtement signalées (cette 2e passe)

- Le Point 5 ("grand espace vide") n'a pas de correctif : la cause trouvée est structurelle et
  transversale (`minHeight: 100vh` + nav fixe), pas spécifique à `EventDetail.jsx` — voir le
  détail ci-dessus. Aucun changement n'a donc été apporté sur ce point précis, conformément à la
  permission explicite du brief de le signaler tel quel plutôt que d'inventer un correctif.
- "Voir la discussion liée" n'a pas pu être exercé par un scénario Playwright dédié à cette passe
  (aucun événement du harnais actuel n'a `hasLinkedThread: true` — seul `evt-piscine`, exclu de
  l'agenda "live" simulé depuis la 6e passe) ; sa cohérence de style avec "Supprimer l'événement"
  est garantie par la lecture de code (même `buttonStyle('secondary')`), pas par une mesure de
  pixels en navigateur pour CE bouton précis.
- Comme pour toutes les passes précédentes : aucune opération n'a été exécutée contre le projet
  Supabase réel de l'utilisateur — uniquement contre le harnais de test local
  (`test-harness/`, alias Vite sur `agendaApi`/`AuthProvider`/`messagesApi`).

# V7.14 — 3e passe (phase 3 : navigation + Messages + Partages + La Bande)

Passe UAT réelle (l'utilisateur final a testé le build V7.13 livré et signalé des défauts
précis, numérotés 2/7/8/9/10/11 ci-dessous) — même méthode que les deux passes précédentes :
vérification DYNAMIQUE (build + Playwright réel, Chromium `/opt/pw-browsers/chromium`) avant
tout correctif, jamais une relecture de code seule pour conclure qu'un point est déjà correct.
Instantané pris avant cette passe : `/home/claude/work4/v714_phase3_before` (copie complète de
l'arborescence, pas `v713_src`).

## Item 2 — Position de défilement (navMemory / retour / rechargement)

**Verdict : un vrai écart trouvé et corrigé ; le reste du mécanisme (`navMemory`,
`useScrollRestore.js`, `sectionOrigin.js`, `goTo`/`captureNav`/`consumeNav`/`openMember`/
`enterSection` dans `src/App.jsx`) était déjà correct — non réécrit.**

- **Écart réel trouvé** : `history.scrollRestoration` (API native du navigateur, valeur par
  défaut `'auto'`) n'était posé nulle part dans le code. Sur un rechargement franc (F5), le
  navigateur peut donc restaurer LUI-MÊME une position de défilement mémorisée dans son
  historique natif, en plus / en conflit avec la logique applicative `navMemory` — un
  comportement natif indépendant de React, jamais neutralisé. Confirmé par
  `grep -rn "scrollRestoration"` : aucune occurrence avant cette passe.
- **Correctif** : `window.history.scrollRestoration = 'manual'` posé une seule fois, au
  chargement, dans `src/main.jsx` (point d'entrée réel) ET dans `test-harness/main.jsx` (point
  d'entrée SÉPARÉ du harnais de test, qui n'hérite pas de `src/main.jsx` — sans cette même ligne
  côté harnais, aucun scénario Playwright n'aurait pu vérifier ce comportement en navigateur réel).
- **Reste du mécanisme, vérifié dynamiquement, sans écart trouvé** :
  - Rechargement franc (F5) sur Agenda et sur Messages, après défilement : atterrit bien à
    `scrollY=0` dans les deux cas (Item 2b/2c, `recette-v714.mjs`).
  - Cliquer un onglet DÉJÀ actif de la barre du bas ne déclenche aucune restauration surprise
    d'une position obsolète (Item 2d) — `goTo()` est appelé sans condition par `BottomNav`,
    donc consomme déjà `navMemory` pour l'onglet ciblé y compris quand il est déjà actif ; ce
    n'est pas une voie d'entrée distincte de `goTo`/`enterSection`/`openMember` qui contournerait
    la consommation de `navMemory`.
  - Chaque paire page→détail→retour (Accueil→événement/membre/partage, Agenda→événement,
    Messages→fil lié à un événement, Partages→événement, La Bande→membre) repose sur le même
    triplet `captureNavState`/`useScrollRestore`/`consumeNav`, déjà exercé par les suites des
    passes précédentes (`recette.mjs` scénarios 1e/4d/10c/11a/12b/13f) — non dupliqué inutilement
    ici, un scénario dédié La Bande (Item 10, voir plus bas) referme la boucle pour cette page en
    particulier.

## Items 7 & 8 — Messages

### Item 7 — Alignement réel des messages "mine" à droite

**Bug confirmé dynamiquement** (mesure de bounding box réelle en navigateur, pas seulement
lecture du CSS) : `flexDirection: isMine ? 'row-reverse' : 'row'` + `marginLeft: isMine ? 40 : 0`
n'indentait le bloc que de 40px depuis la GAUCHE. Cause réelle, confirmée en mesurant :
`display:flex` block-level SANS `width` explicite REMPLIT toute la largeur disponible (pas de
"shrink-to-fit" comme pour un élément flottant) — donc `marginLeft: auto` seul n'avait rien à
absorber (mine et non-mine mesuraient exactement la même boîte, un premier essai de correctif à
base de `marginLeft: 'auto'` seul l'a confirmé : 9 assertions Playwright ont échoué en montrant
des bounding boxes identiques pour "mine" et "autrui").

**Correctif final**, `src/pages/Messages.jsx`, style du conteneur de ligne (`#msg-row-<id>`) :
```js
flexDirection: isMine ? 'row-reverse' : 'row',
width: 'fit-content',
maxWidth: '86%',
marginLeft: isMine ? 'auto' : 0,
```
`width: 'fit-content'` fait reprendre au bloc la largeur de son contenu réel (avatar + bulle),
plafonnée à 86% pour un message très long ; `marginLeft: 'auto'` peut alors réellement pousser ce
bloc — désormais plus étroit que son conteneur — jusqu'au bord droit de la zone de contenu.
Contenu (avatar/bulle/réactions/horodatage) non touché — uniquement le dimensionnement/
positionnement du conteneur.

Vérifié à 320/360/400px (Playwright, bounding box réelle comparée au bord de la zone de CONTENU
du conteneur de liste — `padding: '0 20px'`, `Messages.jsx` ligne ~236 — pas au viewport brut,
qui aurait inclus le padding externe de page) : la bulle "mine" est flush au bord droit (±2px),
ne remplit pas toute la largeur (preuve que ce n'est pas juste "toute la largeur, décalée", l'
ancien bug), et un message d'autrui reste flush au bord gauche — aux 3 largeurs.

### Item 8 — Boutons Modifier/Supprimer agrandis + `window.confirm()` natif remplacé

- **Boutons agrandis** : `Modifier`/`Supprimer` (visibles seulement si `isMine`/`isAdmin`)
  passent par `buttonStyle('secondary', { compact: true })` / `buttonStyle('destructive',
  { compact: true })` (`src/theme.js`, conventions phase 1) — hauteur `MIN_TOUCH_TARGET` = 44px,
  vérifiée ≥44px en Playwright (Item 8a/8b).
- **`window.confirm()` remplacé par une vraie modale ABCZed** : le `window.confirm('Supprimer ce
  message ? Cette action est définitive.')` (ligne ~422 avant correctif) est remplacé par un
  nouveau composant réutilisable, **`src/components/ConfirmDialog.jsx`**, construit sur le même
  patron que `EventDetail.jsx` (`useModalA11y`, `role="dialog"` réel avec titre + avertissement,
  bouton prudent "Annuler" LISTÉ EN PREMIER dans le DOM, état "busy" pendant la mutation, focus
  initial sur "Annuler", retour de focus sur le déclencheur à la fermeture) — reconstruit en
  composant séparé plutôt qu'importé depuis `EventDetail.jsx`, qui reste hors périmètre
  (off-limits, propriété de la phase 2).
- La mutation de suppression elle-même (`onDeleteMessage`, contrat pessimiste du
  reload-scheduler) **n'a pas été touchée** — seul `window.confirm()` a été remplacé par la
  modale ; `messageMutationPendingIds` pilote toujours l'état "busy" du bouton de confirmation.
- Vérifié en Playwright (Item 8c-8i) : vraie modale affichée (plus de dialogue natif), texte
  d'avertissement exact présent, "Annuler" avant "Supprimer" dans le DOM, focus initial sur
  "Annuler", "Annuler" ferme sans rien supprimer + rend le focus au bouton "Supprimer ce message"
  d'origine, la confirmation explicite supprime réellement le message.
- **Effet de bord nécessaire** (constaté, pas une dérive de périmètre) : `test-harness/
  recette-v712.mjs` utilisait `page.once('dialog', (dialog) => dialog.accept())` pour ce même
  flux de suppression de message (scénario 4a) — n'interceptait plus rien une fois
  `window.confirm()` retiré. Mis à jour pour cliquer le bouton "Supprimer" DANS la nouvelle
  modale (`page.getByRole('dialog', { name: 'Supprimer ce message ?' })`). Confirmé par `grep`
  qu'aucun autre fichier de test ne dépendait du dialogue natif pour ce flux. Suite rejouée après
  correctif : 11/11.

## Items 9 & 11 — Partages

### Item 9 — Carte entière cliquable, sans double navigation

- Nouveau handler de clic sur la carte entière, via `openableCardProps(cardHref)`
  (`src/attachmentCardA11y.js`, déjà existant pour un autre besoin, réutilisé tel quel — `role=
  "button"` + `tabIndex=0` + gestionnaire clavier réel) — `cardHref` résolu selon le type
  (document → `shareDoc(s)?.url`, lien → `s.linkUrl`, photo → `s.photoDataUrl`, info → jamais de
  href, carte non actionnable comme les autres cas sans ressource réelle).
- `e.stopPropagation()` déjà présent dans `ActionButton.jsx` (Ouvrir/Télécharger) a été confirmé
  suffisant ; ajouté explicitement sur le bouton "…" (menu), "Modifier" et "Supprimer" (dans le
  menu ouvert) pour empêcher qu'un clic sur ces actions internes déclenche AUSSI le clic de
  carte.
- Vérifié en Playwright (Item 9a-9e) : `role="button"`/`tabIndex=0` présents ; cliquer le corps
  de la carte ouvre exactement 1 nouvel onglet ; cliquer "Ouvrir" ouvre exactement 1 onglet (pas
  2 — preuve que `stopPropagation` empêche la double navigation) ; le chip "Voir l'événement"
  navigue en interne sans ouvrir de nouvel onglet en plus.

### Item 11 — Fonctionnalité réelle des 4 types de partage + persistance locale

- **Fichier / Photo** : vrai `<input type="file">` (`accept="image/*"` + attribut `capture` pour
  Photo), lu en URL `data:` via `FileReader.readAsDataURL` (pas de vrai Supabase Storage tant que
  `BUSINESS_DATA_FROM_SUPABASE=false`). Taille limitée par `MAX_LOCAL_FILE_BYTES` (1,5 Mo,
  `src/sharesStorage.js`) — erreur inline explicite et immédiate au choix d'un fichier trop
  volumineux (Item 11g), pas un échec silencieux. Aperçu réel avant envoi : nom + taille pour un
  fichier (Item 11h), vraie miniature `<img src="data:...">` pour une photo (Item 11m/11n).
- **Lien** : validation réelle via nouveau module **`src/urlValidation.js`**
  (`isValidAbsoluteUrl`, exige un protocole `http:`/`https:`) — même convention aria-invalid/
  aria-describedby/erreur inline que `CreateEventSheet.jsx` (reconstruite localement dans
  `AddShareSheet.jsx`, `CreateEventSheet.jsx` restant hors périmètre).
- **Information** : confirmé texte seul, aucun champ fichier/lien superflu (Item 11s/11t).
- **Libellé exact demandé par le brief**, vérifié caractère pour caractère en Playwright
  (Item 11a/11b) :
  - `<label htmlFor="ass-linked-event">Événement associé (facultatif)</label>`
  - `<option value="">Aucun événement</option>` (option par défaut)
- **Persistance locale réelle**, nouveau module **`src/sharesStorage.js`** :
  - Clé `localStorage` : `abczed:shares:v1`.
  - `readSharesFromStorage(storage, fallback)` : lu UNE FOIS à l'initialisation de l'état
    `shares` dans `src/App.jsx` — `useState(() => BUSINESS_DATA_FROM_SUPABASE ? MOCK_SHARES :
    readSharesFromStorage(getBrowserStorage(), MOCK_SHARES))` — repli sur `MOCK_SHARES` si
    absent/corrompu/indisponible (navigation privée, quota, `JSON.parse` invalide — tout est
    dans un `try/catch`).
  - `writeSharesToStorage(storage, shares)` : appelé par le nouveau helper `persistShares(next)`
    dans `App.jsx`, lui-même appelé par `handleCreateShare`/`handleDeleteShare` (et l'édition) à
    CHAQUE création/modification/suppression — jamais en scrivant directement, toujours via ce
    point unique. Retourne `{ ok:false, error }` sur échec réel (ex. quota dépassé) plutôt que
    d'échouer silencieusement — `AddShareSheet.jsx` affiche cette erreur si `onCreate` renvoie
    `{ ok:false }` et garde la feuille ouverte (rien n'est perdu pour l'utilisateur).
  - **Gate respecté** : toute cette persistance locale est court-circuitée si
    `BUSINESS_DATA_FROM_SUPABASE` passait un jour à `true` (`persistShares` renvoie alors
    directement `{ ok:true }` sans toucher `localStorage`) — le drapeau lui-même reste à `false`,
    non modifié par cette passe.
  - Testé par un nouveau `scripts/test-shares-storage.mjs` (10 contrôles, lecture/écriture/repli/
    tolérance aux erreurs, sans DOM — `storage` injecté).
- **Bout en bout vérifié en Playwright** (Item 11c-11u) : erreurs inline réelles (titre, fichier
  manquant/trop gros), aperçu réel, fermeture de la feuille après succès, apparition IMMÉDIATE
  dans la liste, **survie à un rechargement complet (F5)** — pas seulement un changement d'écran
  client (Item 11k) — et re-ouverture réelle de la ressource après ce rechargement (Item 11l, voir
  diagnostic ci-dessous), Photo/Lien/Information chacun testés bout en bout.

#### Diagnostic complémentaire trouvé en testant l'Item 11l (pas une régression de persistance)

Le premier essai du scénario "Ouvrir fonctionne après rechargement" échouait : le lien "Ouvrir"
avait bien le bon `href` (`data:...`, confirmé identique avant/après F5, confirmé présent dans
`localStorage`) mais le clic n'ouvrait AUCUN nouvel onglet — ni avant ni après rechargement
(vérifié par un test isolé dédié). **Cause réelle, pas un bug de persistance** : Chromium bloque
silencieusement toute navigation de NOUVEL ONGLET initiée par le clic d'un lien
(`<a href="data:..." target="_blank">`) directement vers une URL `data:` — restriction anti-
hameçonnage présente dans Chrome/Chromium réels, pas une particularité du bac à sable de test.
Une URL `blob:` du même document (même origine), elle, s'ouvre normalement — confirmé
empiriquement par un test isolé (`fetch(dataUrl)` → `blob()` → `URL.createObjectURL` →
`window.open`).

**Correctif** : nouveau module **`src/attachmentOpen.js`**, partagé par les deux points
d'ouverture de pièce jointe existants de l'appli :
- `src/components/ActionButton.jsx` (bouton "Ouvrir" — jamais "Télécharger", qui garde l'attribut
  `download` natif, non concerné : ce n'est pas une navigation de nouvel onglet).
- `src/attachmentCardA11y.js` (`openableCardProps`, clic sur la carte entière, Item 9).

`openInNewTab(href)` laisse toute URL http(s) normale (catalogue `src/documents.js`) inchangée ;
pour une URL `data:`, convertit à la volée en URL `blob:` temporaire avant `window.open`, révoquée
après coup. Vérifié en Playwright : l'onglet ouvert après rechargement pointe bien vers une URL
`blob:` réelle (preuve que la DONNÉE persistée est bien servie, pas une redirection à vide).

## Item 10 — La Bande : retour contextuel depuis une fiche membre

**Verdict : mécanisme déjà correctement câblé de bout en bout (`openMember()`, `labandeQuery`
levé dans `App.jsx`, `restoreState={navMemory.labande}` / `onRestoreConsumed={() =>
consumeNav('labande')}`, `member-row-${m.id}` + `useScrollRestore` dans `LaBande.jsx`) —
confirmé DYNAMIQUEMENT, rien réécrit.**

Un premier essai de scénario Playwright pour ce point a fait apparaître un écart apparent
(`avant=16 après=0`, comparaison de `window.scrollY` brut) — investigation avant toute
conclusion :
- Le jeu de données de démonstration du harnais est court (5 membres au total ; recherche
  "marie" le réduit à 1 seule carte) — trop court pour remplir un viewport de téléphone, donc
  `window.scrollTo(0, 40)` posé par le test avant l'ouverture de la fiche était lui-même
  plafonné à 16px par le navigateur (rien à faire défiler au-delà).
- `useScrollRestore.js` applique `window.scrollTo(0, restoreState.scrollY || 0)` PUIS
  `el.scrollIntoView({ block: 'center' })` sur la carte cible — ce second appel est une
  correction INTENTIONNELLE de toute dérive (commentaire déjà présent dans ce fichier avant
  cette passe : "corrige toute dérive ... garantit que l'élément précis est bien visible, pas
  seulement à peu près à la bonne hauteur de page"), pas un simple filet de sécurité. Avec une
  liste aussi courte, ce recentrage retombe légitimement sur `scrollY=0`.
- Confirmé en relisant les suites des passes précédentes (`recette.mjs`, scénarios 1e/4d/10c/
  11a/12b/13f) : AUCUNE n'a jamais vérifié `window.scrollY` brut pour ce mécanisme, sur aucune
  page — seulement la présence de `.nav-restore-highlight` sur la carte exacte. Le premier essai
  de test de cette passe introduisait donc une assertion plus stricte que ce que l'architecture
  a jamais promis.
- **Conclusion : test corrigé, pas l'application.** `test-harness/recette-v714.mjs` vérifie
  désormais que la carte exacte est VISIBLE dans le viewport au retour (bounding box entièrement
  dans les bornes du viewport), ce qui est la garantie réelle apportée par `scrollIntoView` et
  ce qui compte pour l'utilisateur — plutôt qu'une égalité de `scrollY` brut que le mécanisme
  n'a jamais eu pour objectif de produire au pixel près.

Vérifié bout en bout (Item 10a-10f) : requête de recherche ("marie") toujours dans le champ au
retour, carte exacte visible sans défilement supplémentaire, id DOM stable
`member-row-<id>` présent, focus clavier rendu à cette carte précise, repère visuel
`.nav-restore-highlight` appliqué puis disparu après ~2s (`setTimeout(1800ms)` +
`navRestorePulse` CSS — cohérent avec le "~2 secondes" du brief).

## Préparation Supabase Storage (non exécutée)

Nouveau fichier **`sql/08_shares_storage.sql`** — additif uniquement, jamais rejoué contre le
projet Supabase réel de l'utilisateur (documenté explicitement en tête du fichier). Constat fait
avant d'écrire quoi que ce soit, pour éviter de dupliquer un travail déjà fait : la table
`shares` (colonnes, triggers `trg_shares_event_link`/`trg_protect_share_identity`) et ses 4
policies RLS scoped par communauté existent déjà intégralement dans `sql/02_rls.sql` ; le bucket
Storage privé `community-files` et ses 3 policies existent déjà intégralement dans
`sql/03_storage.sql`. Ce qui manquait réellement : aucune colonne ne référence où un fichier
réel serait stocké dans ce bucket. Le fichier ajoute uniquement :
- `alter table shares add column if not exists file_path text;`
- une contrainte de forme idempotente `shares_file_path_shape` (gardée par
  `conrelid = 'public.shares'::regclass`, même précaution que `sql/05`/`sql/06` après leurs
  contre-vérifications indépendantes).
- Documentation de la convention de chemin `{community_id}/{user_id}/{share_id}-{nom}`,
  délibérément alignée sur ce que les policies EXISTANTES de `sql/03_storage.sql` attendent déjà
  (segments 1 et 2), sans introduire de 3e segment qui les casserait.
- Aucune policy RLS ni Storage supplémentaire nécessaire (déjà couvertes).
- Étapes côté application pour une future intégration réelle, listées mais NON faites ici (hors
  périmètre de cette passe) : bascule de `BUSINESS_DATA_FROM_SUPABASE`, upload réel vers
  `community-files`, résolution d'URL signée à la place de `fileDataUrl`/`photoDataUrl`.

## Fichiers touchés (cette 3e passe)

Nouveaux : `src/components/ConfirmDialog.jsx`, `src/sharesStorage.js`, `src/urlValidation.js`,
`src/attachmentOpen.js`, `scripts/test-shares-storage.mjs`, `scripts/test-url-validation.mjs`,
`sql/08_shares_storage.sql`.

Modifiés : `src/main.jsx`, `test-harness/main.jsx` (Item 2), `src/pages/Messages.jsx` (Items 7/8),
`src/pages/Partages.jsx` (Item 9), `src/components/AddShareSheet.jsx` (réécriture complète, Item
11), `src/App.jsx` (initialisation/persistance de `shares`, Item 11), `src/components/
ActionButton.jsx`, `src/attachmentCardA11y.js` (diagnostic complémentaire Item 11l),
`test-harness/recette-v712.mjs` (effet de bord nécessaire Item 8), `test-harness/
recette-v714.mjs` (étendu, additif).

Non touchés (confirmé par `diff -rq` vs l'instantané avant passe) : tous les fichiers listés
comme hors périmètre par le brief — `sql/01` à `sql/07` (seul `sql/08` est nouveau),
`scripts/sql-tests/*`, `src/reloadScheduler.js`, `src/agendaApi.js`, `src/reactions.js`,
`src/pages/Agenda.jsx`, `src/pages/EventDetail.jsx`, `src/components/CreateEventSheet.jsx`,
`src/data.js`, `src/agendaSearch.js`.

## Vérification exécutée dans cet environnement (résultats réels, pas inférés)

Chromium disponible et utilisé (`/opt/pw-browsers/chromium`), comme les deux passes précédentes.

- Node (`scripts/test-*.mjs`, 22 suites) : rejouées individuellement, **0 échec** sur toutes
  (les 21 suites des passes précédentes + 2 nouvelles de cette passe,
  `test-shares-storage.mjs` 10/10 et `test-url-validation.mjs` 15/15).
- Playwright :
  - `test-harness/recette-v714.mjs` (étendu, additif — les 92 contrôles des passes précédentes
    restent inchangés, 59 nouveaux contrôles ajoutés pour les Items 2/7/8/9/10/11) —
    **151/151, 0 échec**.
  - `test-harness/recette.mjs` (non touché) — **166/166**.
  - `test-harness/recette-messages-isolation.mjs` (non touché) — **24/24**.
  - `test-harness/recette-v711.mjs` (non touché) — **86/86**.
  - `test-harness/recette-v712.mjs` (mis à jour, effet de bord Item 8) — **11/11**.
  - `test-harness/recette-v713.mjs` (non touché) — **76/76**.
  - **Total Playwright : 514 contrôles tentés, 514 verts, 0 échec.**
- Deux échecs de test intermédiaires (avant correctifs finaux) ont été diagnostiqués en détail
  avant d'agir, et se sont avérés être des défauts de méthodologie de test introduits PAR cette
  passe (pas des régressions applicatives) : la comparaison `scrollY` brut de l'Item 10 (voir
  section dédiée ci-dessus) et une première mesure d'alignement de l'Item 7 comparée au viewport
  brut plutôt qu'à la zone de contenu réelle du conteneur de liste (écart constant et exact de
  20px des deux côtés = le padding du conteneur, `padding: '0 20px'`) — les deux tests ont été
  corrigés pour mesurer la bonne référence, sans qu'aucun changement d'application ne soit requis
  au-delà des correctifs déjà décrits.
- 320/360/400px : zéro débordement horizontal et zone tactile ≥44px confirmés pour tous les
  éléments touchés (boutons Modifier/Supprimer, alignement des messages).
- Garde-fous revérifiés (`diff -rq` vs l'instantané `/home/claude/work4/v714_phase3_before`) :
  `sql/01` à `07` non touchés (seul `sql/08` ajouté), `scripts/sql-tests/*` non touchés,
  `src/reloadScheduler.js`/`src/agendaApi.js`/`src/reactions.js` non touchés,
  `src/pages/Agenda.jsx`/`src/pages/EventDetail.jsx`/`src/components/CreateEventSheet.jsx`/
  `src/data.js`/`src/agendaSearch.js` non touchés, `AGENDA_FROM_SUPABASE=true`/
  `MESSAGES_FROM_SUPABASE=true`/`BUSINESS_DATA_FROM_SUPABASE=false` inchangés dans
  `src/dataSourceFlags.js`, aucun `npm audit fix --force`, aucun appel au Supabase réel de
  l'utilisateur, `sql/08_shares_storage.sql` jamais exécuté contre une base réelle.
- Dossier `artifacts/` (captures d'écran de travail laissées à la racine pendant cette passe)
  supprimé avant livraison — aucun résidu de ce type à la racine du dépôt.

## Limites connues, honnêtement signalées (cette 3e passe)

- La conversion `data:` → `blob:` à l'ouverture (Item 11l) corrige l'ouverture via clic gauche/
  activation clavier (le cas réellement testé et utilisé par l'appli). Un clic milieu / "Ouvrir
  dans un nouvel onglet" du menu contextuel du navigateur sur le lien "Ouvrir" lui-même
  contournerait ce JS et retomberait sur l'ancien blocage Chromium — cas marginal, non couvert,
  signalé plutôt que silencieusement ignoré.
- Le jeu de données de démonstration de La Bande (5 membres) reste trop court pour qu'un scénario
  Playwright exerce un défilement réel de plusieurs centaines de pixels sur cette page précise ;
  la garantie vérifiée (carte exacte visible + repère visuel + focus) reste la garantie réelle
  offerte par le mécanisme, mais un défilement long n'a pas pu être mesuré spécifiquement pour
  La Bande faute de données assez nombreuses dans le harnais.
- Comme pour toutes les passes précédentes : aucune opération n'a été exécutée contre le projet
  Supabase réel de l'utilisateur — uniquement contre le harnais de test local
  (`test-harness/`, alias Vite sur `agendaApi`/`AuthProvider`/`messagesApi`).

# V7.14 — Bilan consolidé (3 passes) et rejeu final indépendant

Cette section réunit les trois passes ci-dessus (design system/logo, Agenda/événement,
navigation/Messages/Partages/La Bande), chacune développée et testée séparément, puis rejouées
**une quatrième fois ici, dans une seule session continue**, contre l'arborescence de travail
complète (pas contre chaque copie intermédiaire "avant" utilisée par chaque passe pour son
propre diff) — décompte et résultats ci-dessous obtenus directement, pas recopiés des rapports
de passe.

## Fichiers touchés — décompte unique, `diff -rq` contre l'extraction vierge V7.13

Référence : extraction vierge de `ABCZed_v7.13.zip` (le ZIP fourni en entrée de cette mission),
conservée intacte pendant toute la mission. Commande : `diff -rq <vierge V7.13> code --exclude=node_modules --exclude=dist --exclude=.git`.

**26 fichiers modifiés** : `MATRICE_LIVRAISON.md`, `scripts/test-design-system.mjs`,
`src/App.jsx`, `src/agendaApi.js`, `src/agendaSearch.js`, `src/attachmentCardA11y.js`,
`src/components/ActionButton.jsx`, `src/components/AddShareSheet.jsx`,
`src/components/CreateEventSheet.jsx`, `src/components/Logo.jsx`, `src/components/PageTitle.jsx`,
`src/data.js`, `src/main.jsx`, `src/pages/Accueil.jsx`, `src/pages/Agenda.jsx`,
`src/pages/EventDetail.jsx`, `src/pages/LaBande.jsx`, `src/pages/Messages.jsx`,
`src/pages/Partages.jsx`, `src/theme.js`, `test-harness/main.jsx`,
`test-harness/mockAgendaApi.js`, `test-harness/recette-v711.mjs`, `test-harness/recette-v712.mjs`,
`test-harness/recette-v713.mjs`, `test-harness/recette.mjs`.

**11 fichiers ajoutés** : `scripts/test-shares-storage.mjs`, `scripts/test-upcoming-events.mjs`,
`scripts/test-url-validation.mjs`, `sql/08_shares_storage.sql`, `src/components/Button.jsx`,
`src/components/ConfirmDialog.jsx`, `src/components/Toast.jsx`, `src/attachmentOpen.js`,
`src/sharesStorage.js`, `src/urlValidation.js`, `test-harness/recette-v714.mjs`.

**Total : 37 fichiers.**

### Point d'attention explicite — fichiers de recette antérieurement "verrouillés"

`test-harness/recette.mjs`, `recette-v711.mjs`, `recette-v712.mjs` et `recette-v713.mjs`
faisaient l'objet, depuis la V7.10, d'une règle stricte : rester byte-identiques une fois livrés.
Cette règle est **rompue par cette passe**, pour deux raisons documentées, pas par accident :
1. Le correctif du point 15 (événements passés exclus de "À venir") a fait basculer 5 dates de
   démonstration figées (mai/juin 2025, dans `src/data.js`) dans le passé réel — décalées à 2032
   (jour/mois inchangés) pour rester "à venir" sans réécrire ce jeu de données à chaque passe
   future. Les scénarios qui affichaient littéralement "Juin 2025" ou naviguaient un nombre fixe
   de mois vers cette date ont dû être ajustés en conséquence.
2. Le brief demande explicitement, aux points 12-14, de fusionner la création d'anniversaire
   dans le même formulaire que les autres événements (`CreateEventSheet.jsx`, catégorie
   "Anniversaire" du nouveau menu déroulant) — l'ancienne boîte de dialogue séparée
   "Ajouter un anniversaire" n'existe donc plus sous ce nom/cette structure, ce que plusieurs
   scénarios plus anciens ciblaient explicitement par son ancien libellé/placeholder.
Dans les deux cas, la modification de ces fichiers est la conséquence mécanique d'un changement
de comportement explicitement demandé par ce brief — jamais un affaiblissement d'assertion pour
maquiller une régression (chaque scénario modifié a été vérifié comme passant pour la BONNE
raison, pas simplement rendu vert). Signalé ici sans détour, parce que l'utilisateur a fait
respecter cette règle de manière stricte sur toutes les passes précédentes et doit pouvoir juger
lui-même si ce compromis est acceptable plutôt que de le découvrir après coup.

## Rejeu final — résultats obtenus directement dans cette session (pas recopiés des 3 passes)

**Build** : `npm run build` — succès, aucune erreur (seul l'avertissement Rollup habituel sur la
taille du chunk principal).

**Node** — 22 suites `scripts/test-*.mjs` rejouées une à une : **290 assertions numérotées + 1
suite `test-design-system.mjs` (assertion agrégée, pas de compteur individuel) — 0 échec.**
(`scripts/verify-real-supabase.mjs` exclu : nécessite un vrai projet Supabase, hors périmètre de
toute cette mission.)

**Playwright** — les 6 suites rejouées contre un serveur Vite du harnais démarré dans cette
session (`/opt/pw-browsers/chromium`) :

| Suite | Résultat |
|---|---|
| `recette.mjs` | 166/166 |
| `recette-messages-isolation.mjs` | 24/24 |
| `recette-v711.mjs` | 86/86 |
| `recette-v712.mjs` | 11/11 |
| `recette-v713.mjs` | 76/76 |
| `recette-v714.mjs` | 151/151 |
| **Total** | **514/514, 0 échec** |

**SQL** (`scripts/sql-tests/`) : non rejoué dans ce bilan consolidé — aucun fichier SQL verrouillé
ni script de garde-fou n'a été modifié par les 3 passes (confirmé par le décompte de fichiers
touchés ci-dessus, qui ne liste que le nouveau `sql/08_shares_storage.sql`, additif et non
exécuté) ; le dernier rejeu vérifié de ces suites reste celui de la V7.11.2 (66/66). Point à
rejouer par l'utilisateur s'il souhaite une reconfirmation directe dans le cadre de cette
livraison précise plutôt qu'une inférence par absence de modification.

**Aucun répertoire de scratch (`artifacts/` ou similaire) ne subsiste à la racine du projet** —
vérifié et nettoyé avant la construction de l'archive finale.

## Ce qui reste à vérifier manuellement par l'utilisateur

- Confirmation visuelle du nouveau logo (8 rayons) et du système de couleurs "franc" sur un vrai
  téléphone, pas seulement en émulation Playwright/Chromium headless.
- Le compromis sur les fichiers de recette antérieurement verrouillés (voir ci-dessus) — à valider
  explicitement plutôt qu'à découvrir.
- Le comportement réel du stockage Supabase pour les partages (fichier/photo) une fois
  `sql/08_shares_storage.sql` appliqué manuellement et `BUSINESS_DATA_FROM_SUPABASE` activé —
  non exécutable dans cet environnement par construction (interdiction absolue de toucher au
  Supabase réel de l'utilisateur).
- Le cas marginal signalé plus haut (clic milieu / "ouvrir dans un nouvel onglet" sur un lien
  `data:`/`blob:` de pièce jointe locale de démonstration).
- Le mécanisme de retour contextualisé de La Bande sur un jeu de données réel (plusieurs dizaines
  de membres), pas seulement les 5 comptes de démonstration du harnais.

## Interdiction de livraison trompeuse (rappel, V7.14)

Chaque correction annoncée ci-dessus dans les 3 passes a été vérifiée soit par une reproduction
dynamique réelle (Playwright), soit par un test Node falsifiable, soit — quand un point s'est
avéré déjà correct après vérification dynamique (points 2 et 10, notamment) — signalée comme
telle plutôt que "corrigée" artificiellement. Aucun `npm audit fix --force` n'a été exécuté,
aucune opération contre le Supabase réel de l'utilisateur, aucun secret ni `.env.local` ne figure
dans l'archive livrée.

---

# V7.15 — Correctif ciblé + garanties SQL rejouées (post-recette réelle sur poste utilisateur)

Contexte : les 15 points de la V7.14 ont été vérifiés un par un par l'utilisateur lui-même, en
conditions réelles (son poste Windows, son vrai projet Supabase de test), avec Claude en guidage
pas-à-pas synchrone (captures d'écran à chaque étape). Les 15 points ont tous été confirmés
fonctionnels. Cette recette réelle a fait remonter un manque non couvert par la V7.14 (hors des
15 points d'origine), et l'utilisateur a demandé, en clôture de cette session de vérification :
1. Corriger ce manque (identification des participants).
2. Confirmer explicitement le compromis "fichiers de recette verrouillés" signalé en fin de
   V7.14 (accepté par l'utilisateur — voir ci-dessous).
3. Rejouer les suites SQL pour une garantie complète (non rejouées dans le bilan consolidé V7.14).

## Correctif — identification des participants au survol/tap

**Constat de l'utilisateur** : sur la fiche détail d'un événement, la pastille avatar d'un
participant (ex. "T") ne révélait aucune identification perceptible au survol de la souris.

**Diagnostic** : le mécanisme existait déjà (attribut `title` HTML natif + révélation au tap via
`revealedId`, voir commentaire "Delta §6.2" dans `EventDetail.jsx`), mais le tooltip natif du
navigateur met environ une seconde à apparaître et disparaît dès que la souris bouge — assez
fragile pour passer complètement inaperçu pendant un usage normal, ce qu'a confirmé le test réel.

**Correctif** (`src/pages/EventDetail.jsx`) : ajout d'un état `hoveredId`, déclenché par
`onMouseEnter`/`onMouseLeave` (et `onFocus`/`onBlur` pour la navigation clavier) sur chaque
pastille, qui affiche désormais le même bandeau de révélation que le tap (`revealedId`) — sans le
délai du `title` natif, lequel reste conservé en repli (lecteur d'écran, recherche navigateur du
texte de la page). Le tap tactile (`onClick` → `revealedId`, bascule marche/arrêt) est inchangé
et continue de fonctionner indépendamment du survol (aucun événement `mouseenter`/`mouseleave` sur
un écran tactile réel).

**Fichiers touchés** :
- `src/pages/EventDetail.jsx` (modifié) — 3 changements localisés : ajout de l'état `hoveredId`,
  des gestionnaires `onMouseEnter`/`onMouseLeave`/`onFocus`/`onBlur` sur le bouton-pastille, et de
  la condition d'affichage du bandeau de révélation (`hoveredId ?? revealedId` au lieu de
  `revealedId` seul).
- `test-harness/recette-v715.mjs` (ajouté) — 5 assertions Playwright dédiées : révélation quasi
  immédiate au survol, disparition à la sortie du survol, révélation au tap tactile simulé
  (`dispatchEvent('click')`, pour ne jamais mélanger hover et tap dans le même scénario), bascule
  marche/arrêt d'un second tap, absence d'erreur JavaScript.

## Rejeu complet effectué dans cette session

**Build** : `npm run build` — succès, aucune erreur (seul l'avertissement Rollup habituel sur la
taille du chunk principal).

**Node** — les 22 suites `scripts/test-*.mjs` rejouées une à une après le correctif : mêmes
290 assertions numérotées + `test-design-system.mjs`, **0 échec** — aucune régression.

**Playwright** — les 6 suites existantes rejouées contre le harnais (port 5183,
`/opt/pw-browsers/chromium`), **plus** la nouvelle suite V7.15 :

| Suite | Résultat |
|---|---|
| `recette.mjs` | 166/166 |
| `recette-messages-isolation.mjs` | 24/24 |
| `recette-v711.mjs` | 86/86 |
| `recette-v712.mjs` | 11/11 |
| `recette-v713.mjs` | 76/76 |
| `recette-v714.mjs` | 151/151 |
| `recette-v715.mjs` (nouveau) | 5/5 |
| **Total** | **519/519, 0 échec** |

**SQL** (`scripts/sql-tests/`) — rejoué intégralement dans cette session, à la demande explicite
de l'utilisateur (non fait dans le bilan consolidé V7.14) :
- `test_dsn_guard.py` : 26/26
- `setup_repro_db.sh` : base `abczed_v78_repro` reconstruite proprement (l'échec attendu de
  `sql/03_storage.sql` sur `storage.buckets`, schéma Supabase absent du stub local, est documenté
  et sans rapport avec ces suites — voir `scripts/sql-tests/README.md`)
- `repro_tests.py` : 28/28
- `discriminating_tests.py` : 12/12
- **Total SQL : 66/66, 0 échec** — aucune régression sur l'isolation de communauté, les policies
  RLS, la contrainte composite, le trigger d'immuabilité, la contrainte unique de réaction, ni
  `REPLICA IDENTITY FULL`.

## Point d'attention V7.14 — confirmé par l'utilisateur

Le compromis sur les fichiers de recette antérieurement "verrouillés" (dates de démonstration
décalées 2025→2032, fusion du formulaire anniversaire), signalé en fin de V7.14 sans réponse
explicite de l'utilisateur à ce moment-là, a été **explicitement validé** par l'utilisateur au
cours de cette session de recette réelle. Aucune action supplémentaire requise sur ce point.

## Ce qui reste à vérifier manuellement par l'utilisateur

- Reprise des points déjà listés en fin de V7.14 (logo sur téléphone réel, stockage Supabase des
  partages une fois `sql/08` appliqué et `BUSINESS_DATA_FROM_SUPABASE` activé, La Bande sur un
  jeu de données réel de plusieurs dizaines de membres).
- Le bouton "Télécharger" d'un partage a été vérifié comme déclenchant un vrai téléchargement
  (dialogue Windows standard) lors de la recette réelle — confirmé, pas un point ouvert.

## Interdiction de livraison trompeuse (rappel)

Le correctif ci-dessus a été vérifié par une reproduction dynamique réelle (Playwright, nouvelle
suite dédiée) plutôt que déclaré corrigé sur la seule lecture du code. Les 22 suites Node, les 6
suites Playwright existantes et les 66 assertions SQL ont toutes été rejouées dans cette session
(pas recopiées d'une passe antérieure) pour confirmer l'absence de régression. Aucun
`npm audit fix --force` n'a été exécuté, aucune opération contre le Supabase réel de
l'utilisateur, aucun secret ni `.env.local` ne figure dans l'archive livrée.

---

# V7.16 — Typographie : police d'affichage (titres/menus/boutons)

## Contexte

Dernier point ouvert avant bêta, signalé par l'utilisateur : la police utilisée pour les titres,
les menus et les différentes pages n'avait jamais été traitée en tant que telle — l'application
utilisait Nunito Sans partout (texte courant ET titres), sujet déjà longuement discuté par
l'utilisateur avec un autre outil mais jamais implémenté. Demande explicite : une police "à la
hauteur du logo ABCZ", lisible, fraîche, dans l'esprit de l'application.

## Démarche

Un comparatif visuel (HTML autonome, logo + échantillons d'interface réels) a été construit et
envoyé à l'utilisateur avec 4 options : Nunito seule (référence), Baloo 2, Fredoka, Quicksand,
avec une recommandation motivée (Baloo 2 pour les titres, en conservant Nunito Sans pour le texte
courant — cohérence avec le lettrage arrondi et plein du wordmark "ABCZed" du logo, sans sacrifier
la lisibilité du texte courant à petite taille, où une police "bulle" comme Baloo 2 devient moins
nette). Décision utilisateur explicite : **"Baloo 2, celle-là me plaît."**

Ce comparatif (`comparatif_polices.html`) est un outil de décision hors périmètre applicatif, non
inclus dans l'archive livrée.

## Implémentation

- Police auto-hébergée via `@fontsource-variable/baloo-2` (aucun appel réseau externe au runtime,
  même convention que Nunito Sans déjà en place) — importée dans `src/main.jsx`, avec commentaire
  explicite qu'elle est réservée aux titres/menus/boutons, jamais au texte courant.
- Nouveau jeton central `FONT_DISPLAY` dans `theme.js` (`'Baloo 2 Variable', 'Baloo 2', sans-serif`).
- `TEXT.h1`/`TEXT.h2`/`TEXT.button` (theme.js) et `buttonStyle()` (source unique de la mise en
  forme de tous les boutons de l'application) mis à jour pour utiliser `FONT_DISPLAY` — c'est le
  changement à plus fort effet de levier : il couvre `Button.jsx` et tous les boutons
  primaire/secondaire/destructif de l'application sans les toucher individuellement.
- `TEXT.h1.fontWeight` et le h1 de `Login.jsx` : plafonnés de 820 à 800 (poids maximum de l'axe
  variable de Baloo 2 — le navigateur aurait de toute façon tronqué à 800, changement neutre en
  pratique, documenté en commentaire à chaque endroit modifié).
- `FONT_DISPLAY` appliqué explicitement aux titres de page, titres de section, en-têtes de
  boutons compacts, titres de boîtes de dialogue et de feuilles modales suivants :
  `PageTitle.jsx` (titres de page, via `TEXT.h1`), `ActionButton.jsx` (boutons compacts
  "Ouvrir"/"Télécharger"), `Accueil.jsx` (`SectionTitle` — couvre "Informations importantes",
  "Derniers messages", "Derniers partages"), `ConfirmDialog.jsx` (titre générique de boîte de
  dialogue), `EventDetail.jsx` (titre de fiche événement, "Qui vient ?", "Vous venez à combien ?",
  "Accompagnement", titres de dialogues), `Agenda.jsx` ("À venir"), `Messages.jsx` (en-tête de fil
  lié à un événement, titre de la feuille "Lier à un événement"), `MemberDetail.jsx` ("Fiche
  parent"), `LaBande.jsx` (titre d'état vide), `Partages.jsx` (titre d'état vide — délibérément
  PAS appliqué aux titres des partages individuels, contenu de liste, resté en Nunito Sans),
  `Login.jsx` ("Bienvenue"), `NotConfigured.jsx` ("Configuration Supabase manquante"),
  `AccessUnavailable.jsx` ("Accès indisponible"), `CreateEventSheet.jsx` ("Ajouter un
  événement"), `AddShareSheet.jsx` ("Ajouter un partage"/"Modifier le partage"),
  `MyProfileSheet.jsx` ("Mon profil"), `AddBirthdaySheet.jsx` (titre de la feuille anniversaire).
- Vérification délibérée des éléments en gras NON convertis (`ActionButton`/avatar initiales,
  `DayDots` "+N", `Toast`, étiquette de section en majuscules de `SearchOverlay.jsx`,
  `ConnectedAvatar.jsx`) : ce sont du texte courant/chrome d'interface à petite taille, pas des
  titres — laissés volontairement en Nunito Sans pour la lisibilité, conformément au principe
  "titres en Baloo 2, texte courant en Nunito Sans" énoncé à l'utilisateur avant implémentation.

## Rejeu complet (cette session)

Build (`npm run build`) : compile sans erreur.

| Suite | Résultat |
|---|---|
| 22 suites Node (`scripts/test-*.mjs`) | toutes vertes, aucune régression |
| `scripts/test-design-system.mjs` | OK (couleurs, contrastes, zones tactiles, géométrie du logo) |
| `recette.mjs` | 166/166 |
| `recette-messages-isolation.mjs` | 24/24 |
| `recette-v711.mjs` (incl. item 23, non-débordement horizontal à 400×824) | 86/86 |
| `recette-v712.mjs` | 11/11 |
| `recette-v713.mjs` | 76/76 |
| `recette-v714.mjs` | 151/151 |
| `recette-v715.mjs` | 5/5 |
| **Total Playwright** | **519/519, 0 échec** |

Attention particulière portée à l'assertion 23 de `recette-v711.mjs` (aucun débordement
horizontal sur en-tête Accueil, fiche événement, boîte de dialogue, feuille modale à 400×824) :
Baloo 2 a des métriques de lettrage différentes de Nunito Sans (plus large sur certains
caractères) et aurait pu provoquer un débordement de texte sur les titres/boutons désormais en
Baloo 2 — confirmé absent après rejeu.

Suite SQL non rejouée : aucun fichier SQL n'est touché par ce changement, purement typographique
côté React.

## Fichiers touchés

`package.json`, `src/main.jsx`, `src/theme.js`, `src/components/ActionButton.jsx`,
`src/components/ConfirmDialog.jsx`, `src/components/CreateEventSheet.jsx`,
`src/components/AddShareSheet.jsx`, `src/components/MyProfileSheet.jsx`,
`src/components/AddBirthdaySheet.jsx`, `src/pages/Accueil.jsx`, `src/pages/Agenda.jsx`,
`src/pages/Messages.jsx`, `src/pages/MemberDetail.jsx`, `src/pages/LaBande.jsx`,
`src/pages/Partages.jsx`, `src/pages/Login.jsx`, `src/pages/NotConfigured.jsx`,
`src/pages/AccessUnavailable.jsx`, `src/pages/EventDetail.jsx`.

Aucun fichier de recette (`test-harness/recette*.mjs`) n'a été modifié dans cette passe.

---

# V7.17 — Logo (rayons) + investigation sur un vide visuel après suppression de message

## 1. Logo — rayons plus espacés/marqués, un peu plus longs, un peu plus loin du disque

Demande utilisateur explicite : les rayons du soleil devaient avoir un jeu davantage marqué
par rapport au disque bleu, et être un peu plus longs.

Avant : chaque rayon commençait à r=10.5 (2.5 unités de jeu au-delà du disque, r=8) et
s'arrêtait à r=15.5 (longueur 5.0). Après : début à r=12 (4 unités de jeu) et fin à r=17.5
(longueur 5.5). Répartition angulaire (45° constant, 8 rayons) et épaisseur de trait (3.2)
inchangées — seule la géométrie radiale bouge, modérément, comme demandé ("un tout petit peu").

Revérifié géométriquement (pas à l'œil) par `scripts/test-design-system.mjs`, qui n'impose
qu'un jeu MINIMUM (≥1.5 unités — largement respecté, jeu réel désormais 4.0) et une extension
maximale restant dans le viewBox 40×40 (rayon max 20 depuis le centre) : extension réelle
désormais 17.5 + 3.2/2 = 19.1, encore nettement à l'intérieur. Sortie de la suite après ce
correctif : "8 rayons, jeu mini 4.00u, écart angulaire 45°" — confirmé.

## 2. Investigation — vide visuel après suppression d'un message

Signalé par l'utilisateur en recette réelle (poste Windows, projet Supabase réel) : après avoir
supprimé un message, l'espace qu'il occupait reste visuellement vide — les messages suivants ne
remontent pas à l'écran. Confirmé par l'utilisateur : un défilement (molette) ne fait pas
disparaître le vide.

Investigation menée AVANT toute correction (jamais une correction "à l'aveugle") :
- Reproduction ciblée (script Playwright dédié, supprimé après usage — ne fait pas partie de
  l'archive livrée) : trois messages envoyés, position du 2e et 3e message mesurée dans le
  DOCUMENT (`getBoundingClientRect().top + window.scrollY`, indépendant du défilement, pas la
  seule position dans la fenêtre) avant et après suppression du 1er.
- Résultat : le message suivant remonte exactement de la hauteur du message supprimé (delta
  mesuré : -173px, identique pour le message d'après), et la hauteur totale de la page diminue
  de ce même montant. La mise en page (le calcul CSS/React) est donc CORRECTE — le vide est
  réellement comblé au niveau du document.
- Conclusion : le défaut observé en usage réel n'est pas un bug de mise en page mais très
  probablement un défaut de réaffichage du COMPOSITEUR du navigateur (un repaint manqué de la
  zone libérée, qui garde un rendu périmé de l'ancien contenu) — non reproductible dans le
  harnais Playwright (Chromium headless, backend de test local), comme le défaut "retour en
  haut de page" déjà documenté dans `src/useScrollRestore.js` (lui aussi jamais reproduit en
  dehors d'un usage réel).

Correctif appliqué (défensif, honnêtement présenté comme non vérifié à 100% faute de
reproduction possible dans cet environnement) : `src/pages/Messages.jsx` — un effet déclenché à
chaque changement du NOMBRE de messages (envoi, suppression locale, ou écho Realtime d'une
suppression faite par un autre membre) force le conteneur de la liste à sortir puis rentrer de
sa propre couche de composition (`transform: translateZ(0)` puis lecture forcée de layout puis
retour à `transform: ''`) — technique standard pour ce type de défaut Chromium, sans aucun
changement visuel, sans toucher aux données ni à la logique métier. Build et build les 22
suites Node + les 7 suites Playwright (519/519) rejouées sans régression après ce changement.

**Point ouvert, signalé honnêtement** : cette correction cible la cause la plus probable
compte tenu du diagnostic, mais n'a pas pu être vérifiée par reproduction directe du symptôme
exact (impossible à déclencher dans ce harnais). L'utilisateur doit revérifier sur son poste
réel après cette version ; si le vide persiste malgré tout, il faudra creuser plus avant (piste
suivante déjà identifiée si besoin : l'écho Realtime de la propre suppression de l'utilisateur,
qui déclenche un second rechargement quelques centaines de ms après le premier — comportement
qui n'existe que contre le vrai projet Supabase, jamais dans le harnais de test).

## Rejeu complet (cette session)

Build (`npm run build`) : compile sans erreur.

| Suite | Résultat |
|---|---|
| 22 suites Node (`scripts/test-*.mjs`) | toutes vertes |
| `scripts/test-design-system.mjs` | OK (8 rayons, jeu mini 4.00u, écart angulaire 45°) |
| `recette.mjs` | 166/166 |
| `recette-messages-isolation.mjs` | 24/24 |
| `recette-v711.mjs` | 86/86 |
| `recette-v712.mjs` | 11/11 |
| `recette-v713.mjs` | 76/76 |
| `recette-v714.mjs` | 151/151 |
| `recette-v715.mjs` | 5/5 |
| **Total Playwright** | **519/519, 0 échec** |

Suite SQL non rejouée : aucun fichier SQL touché par ce lot.

## Fichiers touchés

`src/components/Logo.jsx`, `src/pages/Messages.jsx`.
