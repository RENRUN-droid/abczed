-- Schéma ABCZed v2 — remplace l'ancien modèle "posts" générique.
-- À exécuter dans Supabase : Project > SQL Editor > New query > coller > Run.
-- ATTENTION : si l'ancien schéma (table "posts") existe déjà, ce script ne le supprime
-- pas automatiquement. Fais-le manuellement si tu repars de zéro :
--   drop table if exists posts cascade;

create extension if not exists "pgcrypto";

-- Une communauté = un groupe indépendant (une école, un cycle, un groupe de parents).
-- Toutes les autres tables sont rattachées à une communauté via community_id.
-- Objectif : permettre plus tard plusieurs communautés (primaire, collège, etc.)
-- sans avoir à migrer les données existantes. Aucune fonctionnalité multi-communauté
-- n'est construite en V1 — seule la colonne existe, prête à être utilisée.
create table if not exists communities (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  created_at timestamptz default now()
);

-- Une seule communauté par défaut pour la V1.
insert into communities (id, name)
values ('00000000-0000-0000-0000-000000000001', 'La Bande')
on conflict (id) do nothing;

-- Membres. Pas d'authentification réelle en V1 (voir remarque de sécurité plus bas) :
-- un membre est identifié par son prénom, comme dans la maquette actuelle.
create table if not exists members (
  id uuid primary key default gen_random_uuid(),
  community_id uuid not null references communities(id) on delete cascade,
  name text not null,
  avatar_color text default '#9BB7D4',
  created_at timestamptz default now()
);

-- Événements. category = 'anniversaire' | 'sortie' | 'ecole' | 'autre' (règle des couleurs
-- verrouillée : jaune / vert / violet / gris). subtype précise le type de sortie
-- ('sortie_ecole' | 'sortie_parents') ou reste vide pour les autres catégories.
--
-- Règle verrouillée sur les anniversaires : un rappel d'anniversaire n'utilise QUE
-- day/month (jamais year, jamais d'âge stocké). Une vraie fête (🎉) est un événement
-- normal de catégorie 'autre' ou 'sortie', pas un anniversaire.
create table if not exists events (
  id uuid primary key default gen_random_uuid(),
  community_id uuid not null references communities(id) on delete cascade,
  category text not null check (category in ('anniversaire', 'sortie', 'ecole', 'autre')),
  subtype text check (subtype in ('sortie_ecole', 'sortie_parents', 'evenement_scolaire', null)),
  title text not null,
  description text default '',
  -- Champs pour un événement normal (tout sauf anniversaire) :
  date date,
  start_time time,
  end_time time,
  location text default '',
  address text default '',
  attachments jsonb default '[]', -- [{ name, size, url }]
  -- Champs pour un rappel d'anniversaire UNIQUEMENT :
  birthday_day int check (birthday_day between 1 and 31),
  birthday_month int check (birthday_month between 1 and 12),
  created_by uuid references members(id),
  created_at timestamptz default now(),
  constraint anniversaire_minimal check (
    category <> 'anniversaire' or (date is null and start_time is null and location = '')
  )
);

-- Participants ("Je viens"). Jamais utilisé pour category = 'anniversaire' —
-- appliqué au niveau applicatif, pas contraint en base pour rester simple.
create table if not exists event_participants (
  event_id uuid not null references events(id) on delete cascade,
  member_name text not null,
  joined_at timestamptz default now(),
  primary key (event_id, member_name)
);

-- Fil de messages. Un seul fil collectif par communauté en V1 (pas de groupes multiples).
-- linked_event_id : 0 ou 1 événement associé, jamais un anniversaire (contrainte applicative,
-- voir la fonction check_not_birthday ci-dessous pour l'appliquer aussi côté base).
create table if not exists messages (
  id uuid primary key default gen_random_uuid(),
  community_id uuid not null references communities(id) on delete cascade,
  author_name text not null,
  avatar_color text default '#9BB7D4',
  text text,
  file_name text,
  file_size text,
  reactions jsonb default '[]', -- [{ emoji, count }]
  linked_event_id uuid references events(id) on delete set null,
  created_at timestamptz default now()
);

-- Empêche de lier un message à un rappel d'anniversaire (règle verrouillée).
create or replace function check_not_birthday() returns trigger as $$
begin
  if new.linked_event_id is not null then
    if exists (select 1 from events where id = new.linked_event_id and category = 'anniversaire') then
      raise exception 'Un message ne peut pas être lié à un rappel d''anniversaire.';
    end if;
  end if;
  return new;
end;
$$ language plpgsql;

drop trigger if exists trg_check_not_birthday on messages;
create trigger trg_check_not_birthday
  before insert or update on messages
  for each row execute function check_not_birthday();

-- Row Level Security : comme pour l'ancien schéma, PAS d'authentification en V1.
-- Quiconque a le lien de l'appli peut lire et écrire. C'est un choix assumé pour un
-- petit groupe de confiance, documenté ici — pas un oubli. À revoir avant tout usage
-- élargi (vraie authentification par invitation, comme prévu au point 6 du récapitulatif).
alter table communities enable row level security;
alter table members enable row level security;
alter table events enable row level security;
alter table event_participants enable row level security;
alter table messages enable row level security;

create policy "Lecture publique communities" on communities for select using (true);
create policy "Lecture publique members" on members for select using (true);
create policy "Ajout public members" on members for insert with check (true);

create policy "Lecture publique events" on events for select using (true);
create policy "Ajout public events" on events for insert with check (true);
create policy "Modification publique events" on events for update using (true);
create policy "Suppression publique events" on events for delete using (true);

create policy "Lecture publique participants" on event_participants for select using (true);
create policy "Ajout public participants" on event_participants for insert with check (true);
create policy "Suppression publique participants" on event_participants for delete using (true);

create policy "Lecture publique messages" on messages for select using (true);
create policy "Ajout public messages" on messages for insert with check (true);
create policy "Modification publique messages" on messages for update using (true);

-- Stockage fichiers (pièces jointes de messages et d'événements)
insert into storage.buckets (id, name, public)
values ('fichiers', 'fichiers', true)
on conflict (id) do nothing;

create policy "Lecture fichiers publique" on storage.objects
  for select using (bucket_id = 'fichiers');
create policy "Upload fichiers public" on storage.objects
  for insert with check (bucket_id = 'fichiers');
