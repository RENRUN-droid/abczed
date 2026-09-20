-- ABCZed — V7.7 : réactions aux messages, table normalisée (remplace le chemin réel qui
-- aurait autrement exigé d'élargir la policy UPDATE de `messages` à tout membre — ce qui
-- aurait aussi autorisé la modification du TEXTE ou du LIEN d'un message d'autrui, bien
-- au-delà d'une simple réaction). Additive : ne modifie ni ne supprime rien de `sql/01` à
-- `sql/05`, n'ajoute aucune colonne à `messages`, ne supprime pas `messages.reactions`
-- (colonne historique conservée, simplement plus lue par le chemin réel — voir
-- src/messagesApi.js).
--
-- Idempotente autant que PostgreSQL le permet : chaque `create table`/`add column` utilise
-- IF NOT EXISTS ; chaque contrainte/policy/trigger vérifie son existence avant de l'ajouter
-- (IF NOT EXISTS n'existe pas pour ADD CONSTRAINT en Postgres, et une policy ne peut pas être
-- créée deux fois sous le même nom) — voir le même idiome déjà utilisé dans
-- sql/04_rsvp_headcount.sql et sql/05_participant_names.sql pour les contraintes, étendu ici
-- aux policies (sql/02_rls.sql ne le faisait pas pour ses propres policies — pas corrigé ici,
-- hors périmètre de ce lot, signalé dans MATRICE_LIVRAISON.md).
--
-- NON EXÉCUTÉE PAR MOI CONTRE LE PROJET SUPABASE RÉEL DE L'UTILISATEUR — vérifiée uniquement
-- contre un PostgreSQL local jetable, créé et détruit pour cette seule vérification (voir
-- MATRICE_LIVRAISON.md, section V7.7, pour le détail de cette vérification et
-- GUIDE_VALIDATION_SUPABASE.md pour la procédure d'application manuelle par l'utilisateur).

-- ---------------------------------------------------------------------------
-- Clé candidate sur `messages`, nécessaire à l'intégrité structurelle ci-dessous : une
-- réaction doit appartenir à la MÊME communauté que le message qu'elle cible, garanti par une
-- contrainte serveur (clé étrangère composite), jamais seulement par confiance dans
-- l'application. `messages.id` est déjà une clé primaire (donc déjà unique à elle seule) —
-- cette contrainte supplémentaire sur la PAIRE (id, community_id) est ce qui permet à la clé
-- étrangère composite de `message_reactions` de vérifier les deux à la fois, exactement comme
-- `events (id, community_id)` le fait déjà pour `event_participants` depuis sql/02_rls.sql.
-- ---------------------------------------------------------------------------
do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'messages_id_community_id_key'
      -- Filtre explicite sur conrelid (pas seulement conname) : un homonyme sur une autre
      -- table ne doit jamais faire croire cette contrainte déjà posée ICI — même précaution
      -- déjà appliquée dans sql/05_participant_names.sql après la 2e contre-vérification.
      and conrelid = 'public.messages'::regclass
  ) then
    alter table messages add constraint messages_id_community_id_key unique (id, community_id);
  end if;
end $$;

-- ---------------------------------------------------------------------------
-- Table `message_reactions` — une réaction = une ligne, jamais un JSONB partagé sur la ligne
-- du message (ce qui aurait exigé une policy UPDATE ouverte à tout membre pour `messages`).
-- ---------------------------------------------------------------------------
create table if not exists message_reactions (
  id uuid primary key default gen_random_uuid(),
  message_id uuid not null,
  community_id uuid not null references communities(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  -- Liste fermée, strictement les 5 valeurs déjà présentes dans REACTION_EMOJIS
  -- (src/reactions.js) — jamais un émoji arbitraire, côté serveur comme côté client.
  emoji text not null check (emoji in ('❤️', '👍', '😂', '😮', '😢')),
  created_at timestamptz default now(),
  -- Une seule réaction par utilisateur et par message — pas une contrainte applicative,
  -- une garantie du schéma lui-même : un INSERT qui violerait ceci échoue immédiatement,
  -- quel que soit le chemin qui a tenté de l'insérer.
  unique (message_id, user_id),
  -- Intégrité structurelle : message_id ET community_id doivent correspondre EXACTEMENT à
  -- une ligne existante de `messages` — impossible d'insérer une réaction dont le
  -- `community_id` fourni ne correspond pas à la vraie communauté du message ciblé (ça
  -- échouerait la clé étrangère, pas seulement la policy RLS ci-dessous). C'est précisément
  -- ce qui empêche une "réaction intercommunauté" au niveau serveur, pas seulement au niveau
  -- applicatif.
  foreign key (message_id, community_id) references messages (id, community_id) on delete cascade
);

-- ---------------------------------------------------------------------------
-- Immutabilité d'identité après création — même logique que
-- app_private.protect_message_identity() (sql/02_rls.sql) : seul `emoji` peut changer lors
-- d'un remplacement de réaction (voir messagesApi.toggleMessageReaction, qui utilise un
-- UPDATE pour ce cas précis, jamais un DELETE+INSERT). La RLS (plus bas) restreint déjà
-- l'UPDATE à sa propre ligne, mais ce trigger est une garantie SERVEUR indépendante de la
-- policy — si une policy future était mal réécrite, ce trigger empêcherait quand même un
-- glissement de message_id/community_id/user_id lors d'un UPDATE par ailleurs autorisé.
-- ---------------------------------------------------------------------------
create or replace function app_private.protect_reaction_identity()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if new.message_id is distinct from old.message_id then
    raise exception 'message_reactions.message_id est immuable — supprimez puis recréez la réaction si besoin.';
  end if;
  if new.community_id is distinct from old.community_id then
    raise exception 'message_reactions.community_id est immuable.';
  end if;
  if new.user_id is distinct from old.user_id then
    raise exception 'message_reactions.user_id est immuable — impossible de transférer une réaction à un autre compte.';
  end if;
  return new;
end;
$$;
revoke all on function app_private.protect_reaction_identity() from public;
drop trigger if exists trg_protect_reaction_identity on message_reactions;
create trigger trg_protect_reaction_identity before update on message_reactions
  for each row execute function app_private.protect_reaction_identity();

-- ---------------------------------------------------------------------------
-- GRANTS — couche 1, avant les policies (même ordre que sql/02_rls.sql). anon : rien.
-- authenticated : select/insert/update/delete, la RLS ci-dessous restreint ensuite chaque
-- ligne à ce que le produit autorise réellement (sa propre réaction seulement, en écriture).
-- ---------------------------------------------------------------------------
revoke all on message_reactions from anon, authenticated;
grant select, insert, update, delete on message_reactions to authenticated;

-- ---------------------------------------------------------------------------
-- RLS — couche 2. `drop policy if exists` avant chaque `create policy`, pour que ce fichier
-- reste rejouable sans erreur (contrairement à sql/02_rls.sql, qui ne le fait pas pour ses
-- propres policies — signalé dans MATRICE_LIVRAISON.md, non corrigé rétroactivement, hors
-- périmètre de ce lot).
-- ---------------------------------------------------------------------------
alter table message_reactions enable row level security;

-- Lecture : tout membre actif de la communauté voit toutes les réactions de cette
-- communauté (nécessaire pour afficher "qui a réagi" sur le message d'un autre membre).
drop policy if exists "select_reactions_same_community" on message_reactions;
create policy "select_reactions_same_community" on message_reactions for select to authenticated
  using ((select app_private.is_community_member(community_id)));

-- Écriture : strictement sa propre réaction, jamais celle d'un autre utilisateur — c'est
-- cette policy (INSERT/UPDATE/DELETE toutes restreintes à user_id = auth.uid()), et non un
-- élargissement de la policy UPDATE de `messages`, qui permet à un membre de réagir au
-- message d'un autre sans jamais pouvoir modifier ce message lui-même.
drop policy if exists "insert_own_reaction" on message_reactions;
create policy "insert_own_reaction" on message_reactions for insert to authenticated
  with check (
    (select app_private.is_community_member(community_id))
    and user_id = (select auth.uid())
  );

drop policy if exists "update_own_reaction" on message_reactions;
create policy "update_own_reaction" on message_reactions for update to authenticated
  using (user_id = (select auth.uid()) and (select app_private.is_community_member(community_id)))
  with check (user_id = (select auth.uid()) and (select app_private.is_community_member(community_id)));

drop policy if exists "delete_own_reaction" on message_reactions;
create policy "delete_own_reaction" on message_reactions for delete to authenticated
  using (user_id = (select auth.uid()) and (select app_private.is_community_member(community_id)));

-- ---------------------------------------------------------------------------
-- Realtime — publication Postgres nécessaire pour que `messagesApi.subscribeToMessages`
-- (src/messagesApi.js) reçoive les changements en direct sur `messages` et
-- `message_reactions`. Idempotent : vérifie d'abord que la publication `supabase_realtime`
-- existe (créée par défaut par Supabase — si elle a été renommée ou supprimée sur ce projet,
-- ce bloc ne fait rien plutôt que d'échouer, et ce doit être vérifié manuellement, voir
-- GUIDE_VALIDATION_SUPABASE.md), puis n'ajoute chaque table que si elle n'y figure pas déjà.
-- NON VÉRIFIÉ contre le vrai projet Supabase (aucun accès) — la structure de
-- pg_publication/pg_publication_tables utilisée ici est documentée et stable, mais seule une
-- vérification manuelle par l'utilisateur (GUIDE_VALIDATION_SUPABASE.md) confirme que la
-- publication s'appelle bien `supabase_realtime` sur CE projet précis.
-- ---------------------------------------------------------------------------
do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    if not exists (
      select 1 from pg_publication_tables
      where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'messages'
    ) then
      alter publication supabase_realtime add table public.messages;
    end if;
    if not exists (
      select 1 from pg_publication_tables
      where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'message_reactions'
    ) then
      alter publication supabase_realtime add table public.message_reactions;
    end if;
  end if;
end $$;
