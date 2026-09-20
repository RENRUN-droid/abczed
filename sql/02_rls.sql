-- ABCZed — Étape 2/7 : grants + RLS sur toutes les tables communautaires.
-- Complète le schéma de l'étape 1 avec les tables applicatives qui n'existaient pas encore
-- dans un modèle sécurisé (elles vivaient sans user_id/community_id dans l'ancien schema.sql,
-- désormais en legacy/). Grants et policies sont deux couches distinctes traitées séparément,
-- comme demandé : un grant trop large au niveau table rendrait une policy correcte inutile.

-- ---------------------------------------------------------------------------
-- Tables applicatives manquantes, avec community_id / user_id dès la création.
-- ---------------------------------------------------------------------------
create table if not exists children (
  id uuid primary key default gen_random_uuid(),
  community_id uuid not null references communities(id) on delete cascade,
  first_name text not null,
  group_label text,
  created_at timestamptz default now()
);

create table if not exists member_children (
  member_id uuid not null references members(id) on delete cascade,
  child_id uuid not null references children(id) on delete cascade,
  label text not null,
  created_at timestamptz default now(),
  primary key (member_id, child_id)
);

create table if not exists events (
  id uuid primary key default gen_random_uuid(),
  community_id uuid not null references communities(id) on delete cascade,
  category text not null check (category in ('anniversaire', 'sortie', 'ecole', 'autre')),
  subtype text check (subtype in ('sortie_ecole', 'sortie_parents', 'evenement_scolaire', null)),
  title text not null,
  description text default '',
  date date,
  start_time time,
  end_time time,
  location text default '',
  address text default '',
  attachments jsonb default '[]',
  birthday_day int check (birthday_day between 1 and 31),
  birthday_month int check (birthday_month between 1 and 12),
  created_by uuid references auth.users(id),
  created_at timestamptz default now(),
  constraint anniversaire_minimal check (
    category <> 'anniversaire' or (date is null and start_time is null and location = '')
  ),
  unique (id, community_id)
);

create table if not exists event_participants (
  event_id uuid not null,
  community_id uuid not null references communities(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  joined_at timestamptz default now(),
  primary key (event_id, user_id),
  -- Contrainte structurelle : impossible d'insérer event_id + community_id qui ne
  -- correspondent pas au même événement — pas un trigger qu'on pourrait oublier ailleurs,
  -- une garantie du schéma lui-même.
  foreign key (event_id, community_id) references events (id, community_id) on delete cascade
);

create table if not exists messages (
  id uuid primary key default gen_random_uuid(),
  community_id uuid not null references communities(id) on delete cascade,
  author_id uuid not null references auth.users(id),
  text text,
  file_name text,
  file_size text,
  reactions jsonb default '[]',
  linked_event_id uuid references events(id) on delete set null,
  created_at timestamptz default now()
);

create table if not exists shares (
  id uuid primary key default gen_random_uuid(),
  community_id uuid not null references communities(id) on delete cascade,
  type text not null check (type in ('info', 'document', 'photo', 'lien')),
  title text not null,
  description text default '',
  author_id uuid not null references auth.users(id),
  date date default current_date,
  file_name text,
  file_size text,
  photo_count int,
  link_url text,
  domain text,
  linked_event_id uuid references events(id) on delete set null,
  created_at timestamptz default now()
);

-- Un message/partage ne peut être lié qu'à un événement de la MÊME communauté, jamais à un
-- rappel d'anniversaire — les deux règles vérifiées ici, pas seulement l'une des deux.
create or replace function app_private.check_event_link(p_community_id uuid, p_event_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_event record;
begin
  if p_event_id is null then return; end if;
  select category, community_id into v_event from public.events where id = p_event_id;
  if v_event is null then
    raise exception 'Événement introuvable.';
  end if;
  if v_event.category = 'anniversaire' then
    raise exception 'Impossible de lier un message/partage à un rappel d''anniversaire.';
  end if;
  if v_event.community_id is distinct from p_community_id then
    raise exception 'L''événement lié doit appartenir à la même communauté.';
  end if;
end;
$$;
revoke all on function app_private.check_event_link(uuid, uuid) from public;
-- Pas de grant à authenticated : cette fonction n'est appelée que depuis les triggers
-- SECURITY DEFINER ci-dessous, jamais directement par un client. Moindre privilège.

create or replace function app_private.trg_check_message_event_link()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  perform app_private.check_event_link(new.community_id, new.linked_event_id);
  return new;
end;
$$;
revoke all on function app_private.trg_check_message_event_link() from public;
drop trigger if exists trg_messages_event_link on messages;
create trigger trg_messages_event_link before insert or update on messages
  for each row execute function app_private.trg_check_message_event_link();

create or replace function app_private.trg_check_share_event_link()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  perform app_private.check_event_link(new.community_id, new.linked_event_id);
  return new;
end;
$$;
revoke all on function app_private.trg_check_share_event_link() from public;
drop trigger if exists trg_shares_event_link on shares;
create trigger trg_shares_event_link before insert or update on shares
  for each row execute function app_private.trg_check_share_event_link();

-- ---------------------------------------------------------------------------
-- Immutabilité d'identité après création — même logique que members.community_id/user_id.
-- Sans ça, le WITH CHECK "created_by/author_id = auth.uid()" reste vrai même si l'auteur
-- déplace son propre contenu vers une autre communauté : il reste l'auteur, seule la
-- communauté change. Vérifié par test avant correction : faille confirmée.
-- ---------------------------------------------------------------------------
create or replace function app_private.protect_event_identity()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if new.community_id is distinct from old.community_id then
    raise exception 'events.community_id est immuable après création.';
  end if;
  if new.created_by is distinct from old.created_by then
    raise exception 'events.created_by est immuable après création.';
  end if;
  return new;
end;
$$;
revoke all on function app_private.protect_event_identity() from public;
drop trigger if exists trg_protect_event_identity on events;
create trigger trg_protect_event_identity before update on events
  for each row execute function app_private.protect_event_identity();

create or replace function app_private.protect_message_identity()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if new.community_id is distinct from old.community_id then
    raise exception 'messages.community_id est immuable après création.';
  end if;
  if new.author_id is distinct from old.author_id then
    raise exception 'messages.author_id est immuable après création.';
  end if;
  return new;
end;
$$;
revoke all on function app_private.protect_message_identity() from public;
drop trigger if exists trg_protect_message_identity on messages;
create trigger trg_protect_message_identity before update on messages
  for each row execute function app_private.protect_message_identity();

create or replace function app_private.protect_share_identity()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if new.community_id is distinct from old.community_id then
    raise exception 'shares.community_id est immuable après création.';
  end if;
  if new.author_id is distinct from old.author_id then
    raise exception 'shares.author_id est immuable après création.';
  end if;
  return new;
end;
$$;
revoke all on function app_private.protect_share_identity() from public;
drop trigger if exists trg_protect_share_identity on shares;
create trigger trg_protect_share_identity before update on shares
  for each row execute function app_private.protect_share_identity();

-- ---------------------------------------------------------------------------
-- GRANTS — couche 1, avant les policies. anon : rien nulle part. authenticated : seulement
-- les opérations que le produit autorise réellement depuis le client.
-- ---------------------------------------------------------------------------
revoke all on communities, members, children, member_children, events, event_participants, messages, shares
  from anon, authenticated;

-- invitations : fermée dès maintenant, pas "en attente de l'étape invitation". Contiendra
-- email + token à terme ; sa vraie policy d'acceptation viendra avec le chantier dédié,
-- mais elle ne doit jamais dépendre de droits par défaut entre-temps.
revoke all on invitations from anon, authenticated;
alter table invitations enable row level security;
-- Aucune policy créée ici volontairement : RLS activée + zéro policy = refus par défaut
-- pour tout le monde, y compris authenticated. Rien à lire ni écrire tant que le chantier
-- Invitations n'a pas défini qui a le droit de voir/créer quoi.

grant select on communities to authenticated;
grant select, update on members to authenticated;  -- insert/delete: réservés au flux invitation (secret key), pas au client
grant select on children, member_children to authenticated;  -- écriture volontairement absente en V1 (règle restrictive)
grant select, insert, update, delete on events to authenticated;
grant select, insert, delete on event_participants to authenticated;  -- pas d'update : join/leave = insert/delete
grant select, insert, update, delete on messages to authenticated;
grant select, insert, update, delete on shares to authenticated;

-- ---------------------------------------------------------------------------
-- RLS — couche 2. Chaque policy utilise (select app_private.fn(...)) : la forme sous-requête
-- est le pattern documenté par Supabase pour que Postgres mette le résultat en cache par
-- requête plutôt que de le recalculer à chaque ligne évaluée.
-- ---------------------------------------------------------------------------
alter table communities enable row level security;
alter table members enable row level security;
alter table children enable row level security;
alter table member_children enable row level security;
alter table events enable row level security;
alter table event_participants enable row level security;
alter table messages enable row level security;
alter table shares enable row level security;

-- communities
create policy "select_own_community" on communities for select to authenticated
  using ((select app_private.is_community_member(id)));

-- members
-- members : un membre normal ne voit que les membres ACTIFS de sa communauté (La Bande
-- n'affiche pas les invités/retirés). Un admin voit tous les statuts, via une policy
-- séparée plutôt que d'élargir la première à tout le monde.
create policy "select_active_members_same_community" on members for select to authenticated
  using ((select app_private.is_community_member(community_id)) and status = 'active');

create policy "admin_select_all_members_same_community" on members for select to authenticated
  using ((select app_private.is_community_admin(community_id)));

create policy "update_own_display_fields_or_admin" on members for update to authenticated
  using (
    (user_id = (select auth.uid()) and status = 'active')
    or (select app_private.is_community_admin(community_id))
  )
  with check (
    (user_id = (select auth.uid()) and status = 'active')
    or (select app_private.is_community_admin(community_id))
  );
  -- L'immutabilité de community_id et la restriction role/status à l'admin restent appliquées
  -- par le trigger protect_sensitive_member_columns (étape 1), qui s'exécute quel que soit
  -- ce que cette policy autorise au niveau ligne — défense en profondeur, pas redondance inutile.

-- children / member_children — lecture seule pour tout membre actif de la communauté
create policy "select_children_same_community" on children for select to authenticated
  using ((select app_private.is_community_member(community_id)));

create policy "select_member_children_same_community" on member_children for select to authenticated
  using (
    exists (
      select 1 from children c
      where c.id = child_id and (select app_private.is_community_member(c.community_id))
    )
  );

-- events
create policy "select_events_same_community" on events for select to authenticated
  using ((select app_private.is_community_member(community_id)));

create policy "insert_own_event_in_own_community" on events for insert to authenticated
  with check (
    (select app_private.is_community_member(community_id))
    and created_by = (select auth.uid())
  );

create policy "update_own_event_or_admin" on events for update to authenticated
  using (created_by = (select auth.uid()) or (select app_private.is_community_admin(community_id)))
  with check (created_by = (select auth.uid()) or (select app_private.is_community_admin(community_id)));

create policy "delete_own_event_or_admin" on events for delete to authenticated
  using (created_by = (select auth.uid()) or (select app_private.is_community_admin(community_id)));

-- event_participants — un membre voit/gère seulement sa propre participation
create policy "select_participants_same_community" on event_participants for select to authenticated
  using ((select app_private.is_community_member(community_id)));

create policy "insert_own_participation" on event_participants for insert to authenticated
  with check (
    (select app_private.is_community_member(community_id))
    and user_id = (select auth.uid())
  );

create policy "delete_own_participation" on event_participants for delete to authenticated
  using (user_id = (select auth.uid()) and (select app_private.is_community_member(community_id)));

-- messages
create policy "select_messages_same_community" on messages for select to authenticated
  using ((select app_private.is_community_member(community_id)));

create policy "insert_own_message" on messages for insert to authenticated
  with check (
    (select app_private.is_community_member(community_id))
    and author_id = (select auth.uid())
  );

create policy "update_own_message_or_admin" on messages for update to authenticated
  using (author_id = (select auth.uid()) or (select app_private.is_community_admin(community_id)))
  with check (author_id = (select auth.uid()) or (select app_private.is_community_admin(community_id)));

create policy "delete_own_message_or_admin" on messages for delete to authenticated
  using (author_id = (select auth.uid()) or (select app_private.is_community_admin(community_id)));

-- shares
create policy "select_shares_same_community" on shares for select to authenticated
  using ((select app_private.is_community_member(community_id)));

create policy "insert_own_share" on shares for insert to authenticated
  with check (
    (select app_private.is_community_member(community_id))
    and author_id = (select auth.uid())
  );

create policy "update_own_share_or_admin" on shares for update to authenticated
  using (author_id = (select auth.uid()) or (select app_private.is_community_admin(community_id)))
  with check (author_id = (select auth.uid()) or (select app_private.is_community_admin(community_id)));

create policy "delete_own_share_or_admin" on shares for delete to authenticated
  using (author_id = (select auth.uid()) or (select app_private.is_community_admin(community_id)));
