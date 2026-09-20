-- ABCZed — V7.8 : REPLICA IDENTITY FULL sur `messages` et `message_reactions`, nécessaire pour
-- que les événements DELETE Realtime filtrés (`postgres_changes`, filtre `community_id=eq.<id>`
-- posé par src/messagesApi.js) fonctionnent réellement.
--
-- Pourquoi ce fichier existe : par défaut, PostgreSQL ne transmet dans le "old record" d'un
-- événement de réplication logique (dont se sert Supabase Realtime) QUE les colonnes de la clé
-- de réplication — par défaut, la clé primaire seule (`id`). Un DELETE sur `messages` ou
-- `message_reactions` n'inclurait donc PAS `community_id` dans la ligne supprimée transmise au
-- client, et le filtre serveur `community_id=eq.<id>` ne matcherait alors JAMAIS un DELETE réel
-- — silencieusement, sans erreur visible côté application. Documenté par Supabase :
-- https://supabase.com/docs/guides/realtime/postgres-changes#delete-events
--
-- Signalé par contre-vérification indépendante du ZIP V7.7 : `sql/06_message_reactions.sql`
-- ajoutait bien les deux tables à la publication `supabase_realtime`, mais sans jamais régler
-- leur REPLICA IDENTITY sur FULL — un DELETE aurait donc pu échapper au filtre Realtime, hors
-- du périmètre couvert jusqu'ici par MATRICE_LIVRAISON.md.
--
-- Fichier ADDITIF séparé (pas un correctif rétroactif de sql/06) : permet de corriger une
-- installation ayant DÉJÀ appliqué sql/01 à sql/06 (V7.7) sans avoir à rejouer sql/06 en entier
-- — il suffit d'exécuter ce seul fichier en plus. `alter table ... replica identity full` est
-- par nature idempotent (le rejouer ne fait rien si déjà réglé), mais ce fichier vérifie quand
-- même l'existence des deux tables avant d'agir, pour rester rejouable sans erreur même si, par
-- erreur d'ordre, il était exécuté avant sql/06 sur un projet qui ne l'aurait pas encore reçu.
--
-- NON EXÉCUTÉ PAR MOI CONTRE LE PROJET SUPABASE RÉEL DE L'UTILISATEUR — vérifié uniquement
-- contre un PostgreSQL local jetable (voir scripts/sql-tests/, livrés dans ce ZIP à partir de
-- la V7.8 — voir MATRICE_LIVRAISON.md, section V7.8, et GUIDE_VALIDATION_SUPABASE.md).
--
-- Aucun impact sur la taille du WAL en pratique ici : `messages`/`message_reactions` sont des
-- tables de contenu applicatif à faible volume de lignes par rapport à des tables de données de
-- masse — REPLICA IDENTITY FULL n'est déconseillé que pour des tables à très fort débit
-- d'écriture, ce qui n'est pas le profil de ces deux tables.

do $$
begin
  if to_regclass('public.messages') is not null then
    alter table public.messages replica identity full;
  end if;
  if to_regclass('public.message_reactions') is not null then
    alter table public.message_reactions replica identity full;
  end if;
end $$;
