-- ABCZed — Étape 5/7 (additive) : prénoms volontaires des personnes d'un foyer inscrit à une
-- sortie "entre familles" (mode RSVP 'family', subtype sortie_parents).
--
-- Contexte (brief, recette réelle sur PC) : l'inscription/modification/annulation/persistance
-- fonctionne déjà sur adults_count/children_count (migration 04) — confirmé en usage réel par
-- l'utilisateur. Mais "Test A1 — 2 adultes · 1 enfant" n'identifie PAS qui vient réellement :
-- seul le nom du membre qui s'inscrit est connu (members.display_name), jamais les prénoms des
-- personnes de son foyer qu'il inscrit avec lui. Cette migration ajoute une colonne pour que
-- l'utilisateur puisse SAISIR VOLONTAIREMENT ces prénoms — jamais les déduire automatiquement
-- depuis La Bande (children/member_children), qui reste hors sujet ici : rien dans ce fichier
-- ne lit ni ne modifie ces deux tables.
--
-- N'AJOUTE AUCUNE policy, AUCUN grant, AUCUNE fonction SECURITY DEFINER — même arbitrage que
-- la migration 04 : le mécanisme DELETE + INSERT déjà en place (pas d'UPDATE) suffit, une
-- modification de RSVP réécrit la ligne en entier, prénoms compris.
--
-- IMPORTANT — NON EXÉCUTÉE PAR MOI, ET LA FONCTIONNALITÉ N'EST PAS OPÉRATIONNELLE SUR LA BASE
-- RÉELLE TANT QUE CE SCRIPT N'A PAS ÉTÉ APPLIQUÉ (brief, garde-fou explicite) : tant que la
-- colonne `attendee_names` n'existe pas, `src/agendaApi.js` détecte l'erreur Postgres
-- "colonne inexistante" (SQLSTATE 42703) à l'insertion et réessaie SANS les prénoms, pour ne
-- jamais casser l'inscription/modification déjà confirmée fonctionnelle — mais dans ce cas les
-- prénoms saisis ne sont PAS enregistrés, et l'utilisateur en est informé explicitement par un
-- message dédié plutôt qu'une perte silencieuse. Voir MATRICE_LIVRAISON.md pour le détail de
-- ce comportement dégradé et la procédure de mise en place de cette migration.
--
-- Forme JSONB choisie pour rester cohérente avec `events.attachments jsonb default '[]'` déjà
-- dans le schéma, et parce que la liste de prénoms n'a pas besoin d'être interrogeable en SQL
-- (aucune requête ne filtre par prénom) — un objet `{"adults": [...], "children": [...]}` ou
-- `null` (aucun prénom saisi, cas normal puisque la saisie est facultative) suffit.

alter table event_participants
  add column if not exists attendee_names jsonb;

-- Contrainte de forme (durcie après 2e contre-vérification indépendante sur le ZIP V7.2, puis
-- de nouveau après la 3e contre-vérification sur le ZIP V7.3) : si la colonne est renseignée,
-- elle doit être un objet JSON avec EXACTEMENT les clés "adults"/"children" (aucune clé
-- supplémentaire tolérée), toutes deux des TABLEAUX, dont tous les éléments sont des CHAÎNES —
-- pas seulement "un objet JSON quelconque" comme dans la première version de ce fichier, qui
-- aurait laissé passer `{"adults": "Léa"}` (chaîne au lieu d'un tableau) ou
-- `{"adults": [1, 2]}` (nombres au lieu de chaînes) sans jamais le rejeter, ouvrant la porte à
-- un comportement trompeur côté client (`buildAttendeeNames`/`attendeeNamesLine` supposent
-- des tableaux de chaînes sans le revérifier).
--
-- Correctif (3e contre-vérification, ZIP V7.3) : la version précédente de cette contrainte
-- vérifiait bien la PRÉSENCE et le TYPE des clés "adults"/"children", mais n'interdisait pas
-- de clés SUPPLÉMENTAIRES — `{"adults": [], "children": [], "extra": 1}` passait alors qu'un
-- commentaire juste au-dessus affirmait déjà (à tort, avant ce correctif) "exactement les clés
-- adults/children". La ligne `attendee_names - 'adults' - 'children' = '{}'::jsonb` ci-dessous
-- corrige cet écart entre le commentaire et le comportement réel : l'opérateur jsonb `-` retire
-- une clé nommée si elle existe (no-op sinon) ; une fois "adults" et "children" retirés, il ne
-- doit plus rien rester. Comme pour `jsonb_path_exists` plus bas, c'est un simple appel
-- d'opérateur, pas une sous-requête (interdite dans un `check`, voir plus bas) — vérifié
-- directement contre un Postgres local avec un cas valide (`{"adults":[],"children":[]}` → objet
-- vide après soustraction, contrainte satisfaite) et un cas invalide (une clé "extra" en plus →
-- objet non vide après soustraction, contrainte violée) avant livraison.
--
-- Piège corrigé au passage (à ne pas réintroduire si ce fichier est un jour modifié) :
-- `jsonb_typeof(x) = 'array'` renvoie SQL NULL, pas `false`, quand la clé `x` n'existe pas du
-- tout dans l'objet (`attendee_names -> 'adults'` renvoie alors NULL) — et Postgres traite un
-- CHECK qui s'évalue à NULL comme une ligne VALIDE, pas rejetée. Un enchaînement `and` où un
-- seul terme est NULL peut donc laisser passer une ligne malformée si tous les autres termes
-- sont vrais. D'où les `attendee_names ? 'adults'`/`? 'children'` explicites ci-dessous : cet
-- opérateur renvoie toujours un booléen défini (jamais NULL) sur un objet non nul, donc
-- `false and NULL` s'évalue bien à `false` (définitif), pas à NULL — la ligne est alors
-- réellement rejetée, pas acceptée par accident.
do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'event_participants_attendee_names_shape'
      -- Correctif (2e contre-vérification) : `pg_constraint.conname` n'est PAS unique dans
      -- toute la base — seulement unique par table. Sans ce filtre sur `conrelid`, un
      -- homonyme sur une autre table (même accidentel) aurait fait croire cette contrainte
      -- déjà posée ICI et silencieusement sauté son ajout sur `event_participants`. Même
      -- lacune présente dans `sql/04_rsvp_headcount.sql` (`event_participants_counts_valid`),
      -- non corrigée dans ce lot : fichier déjà livré et vraisemblablement déjà appliqué,
      -- hors du périmètre de cette contre-vérification — signalé dans MATRICE_LIVRAISON.md,
      -- à corriger séparément si besoin.
      and conrelid = 'public.event_participants'::regclass
  ) then
    alter table event_participants
      add constraint event_participants_attendee_names_shape
      check (
        attendee_names is null
        or (
          jsonb_typeof(attendee_names) = 'object'
          and attendee_names ? 'adults'
          and attendee_names ? 'children'
          and (attendee_names - 'adults' - 'children') = '{}'::jsonb
          and jsonb_typeof(attendee_names -> 'adults') = 'array'
          and jsonb_typeof(attendee_names -> 'children') = 'array'
          -- Postgres interdit toute sous-requête dans un CHECK (y compris un
          -- `not exists (select ... from jsonb_array_elements(...))` — testé directement
          -- contre un Postgres local, voir MATRICE_LIVRAISON.md : rejeté avec "cannot use
          -- subquery in check constraint"). `jsonb_path_exists` avec un prédicat JSONPath
          -- est un simple appel de fonction, pas une sous-requête : autorisé, et vérifié
          -- directement (cas valides ET invalides) avant livraison.
          and not jsonb_path_exists(attendee_names -> 'adults', '$[*] ? (@.type() != "string")')
          and not jsonb_path_exists(attendee_names -> 'children', '$[*] ? (@.type() != "string")')
        )
      );
  end if;
end $$;
