-- ABCZed — Invitations par lien : ouvre le chantier explicitement laissé fermé par sql/02_rls.sql
-- ("invitations : fermée dès maintenant, pas 'en attente de l'étape invitation'... sa vraie
-- policy d'acceptation viendra avec le chantier dédié").
--
-- RÉVISION (2026-09-21) : la 1ère version de ce fichier supposait le schéma `invitations` du
-- dépôt (sql/01_schema_and_helpers.sql : colonnes `token uuid`/`invited_by`). Tentative
-- d'application par l'utilisateur contre son vrai projet Supabase → échec immédiat
-- (`column "invited_by" does not exist`) : la table RÉELLE avait déjà été créée par une version
-- antérieure du schéma, avec des colonnes différentes (`token_hash text unique`, `created_by`,
-- `accepted_at`, `accepted_by`) — `create table if not exists` dans sql/01 n'avait donc jamais pu
-- les faire converger. Vérifié en direct contre le vrai projet (information_schema.columns +
-- pg_constraint) avant d'écrire cette révision : AUCUNE policy ni fonction n'existait dessus
-- (table vide de toute logique), donc rien à préserver — seule la FORME des colonnes change ici.
-- Ce fichier s'appuie désormais sur ce schéma réel, plus sûr que celui du dépôt : le jeton n'est
-- JAMAIS stocké en clair en base (seul son hash SHA-256 l'est, colonne `token_hash`) — même sous
-- fuite complète de la table, aucun lien d'invitation actif n'est récupérable.
--
-- Colonnes réelles utilisées (confirmées par l'utilisateur, vérification directe) :
--   id uuid, community_id uuid, email text, token_hash text (unique), status text
--   (check: pending/accepted/expired), expires_at timestamptz, accepted_at timestamptz,
--   accepted_by uuid, created_by uuid, created_at timestamptz.
--
-- Décision de conception (inchangée) : ni la création ni l'acceptation d'une invitation ne
-- passent par un accès direct table côté client — les deux passent par des fonctions
-- SECURITY DEFINER qui revérifient tout elles-mêmes. `authenticated` ne reçoit donc aucun droit
-- direct d'écriture sur `invitations` : seul un admin peut en créer, uniquement via
-- create_invitation() ci-dessous, qui vérifie is_community_admin() lui-même avant d'insérer.
--
-- Idempotente autant que possible (même idiome que sql/06/07/08) : `create or replace function`,
-- `drop trigger/policy/function if exists` avant recréation, `on conflict do nothing` pour
-- l'insertion de membership.
--
-- NON EXÉCUTÉE PAR MOI CONTRE LE PROJET SUPABASE RÉEL DE L'UTILISATEUR — vérifiée contre un
-- PostgreSQL local jetable, avec une table `invitations` reproduisant exactement le schéma réel
-- ci-dessus (scripts/sql-tests/setup_repro_db.sh + un stub local de auth.jwt(), jamais contre
-- Supabase directement). Application manuelle par l'utilisateur : coller ce fichier dans le
-- SQL Editor Supabase, une fois.
--
-- `digest()`/`gen_random_bytes()` (extension pgcrypto) référencées `extensions.digest(...)` /
-- `extensions.gen_random_bytes(...)` plutôt que nues : confirmé en direct contre le vrai projet
-- de l'utilisateur (pg_extension.extnamespace) que pgcrypto y vit dans le schéma `extensions`
-- (convention standard Supabase, extension déjà activée par la plateforme avant même sql/01),
-- jamais dans `public`. Cohérent avec `set search_path = ''` sur toutes les fonctions de ce
-- fichier : aucune résolution implicite de schéma nulle part, jamais une simple supposition.

create extension if not exists "pgcrypto";

alter table invitations enable row level security;

-- ---------------------------------------------------------------------------
-- Normalisation serveur de l'e-mail invité — garantie structurelle, pas seulement côté client
-- (qui normalise déjà avant l'appel RPC, voir src/invitationsApi.js) : deux invitations à
-- "Sabrina@Exemple.fr " et "sabrina@exemple.fr" doivent être comparables à l'acceptation.
-- ---------------------------------------------------------------------------
create or replace function app_private.normalize_invitation_email()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  new.email := lower(trim(new.email));
  return new;
end;
$$;
revoke all on function app_private.normalize_invitation_email() from public;

drop trigger if exists trg_normalize_invitation_email on invitations;
create trigger trg_normalize_invitation_email
  before insert on invitations
  for each row execute function app_private.normalize_invitation_email();

-- ---------------------------------------------------------------------------
-- GRANTS + RLS — invitations. Aucun droit direct (select/insert/update) accordé à `authenticated`
-- sur la table elle-même : toute lecture/écriture passe par les fonctions SECURITY DEFINER
-- ci-dessous, qui s'exécutent avec les privilèges du propriétaire (contournent RLS) après avoir
-- revérifié elles-mêmes les droits. Seule policy conservée : lecture par un admin de SA propre
-- communauté (utile pour un futur écran "invitations envoyées", sans danger — `token_hash` est
-- un hash, illisible même vu par un admin).
-- ---------------------------------------------------------------------------
grant select on invitations to authenticated;

drop policy if exists "admin_select_own_community_invitations" on invitations;
create policy "admin_select_own_community_invitations" on invitations for select to authenticated
  using ((select app_private.is_community_admin(community_id)));

drop policy if exists "admin_insert_own_community_invitations" on invitations;

-- ---------------------------------------------------------------------------
-- create_invitation(community_id, email) — seul chemin de création d'une invitation. Vérifie
-- elle-même que l'appelant est admin de LA communauté ciblée (jamais fait confiance à
-- l'interface) avant d'insérer. Génère un jeton aléatoire de 32 octets (256 bits — bien au-delà
-- de ce qui est nécessaire, mais un jeton d'invitation reste actif 7 jours, autant partir large),
-- n'en stocke jamais que le hash SHA-256 (`token_hash`, colonne unique), et renvoie le jeton EN
-- CLAIR une seule fois, à la création : c'est le seul moment où il existe hors de sa forme hachée.
-- ---------------------------------------------------------------------------
drop function if exists public.create_invitation(uuid, text);
create function public.create_invitation(p_community_id uuid, p_email text)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_token text;
begin
  if v_uid is null then
    raise exception 'Vous devez être connecté pour inviter un parent.';
  end if;

  if not (select app_private.is_community_admin(p_community_id)) then
    raise exception 'Seul un administrateur de la communauté peut inviter un parent.';
  end if;

  v_token := encode(extensions.gen_random_bytes(32), 'hex');

  insert into public.invitations (community_id, email, token_hash, status, expires_at, created_by)
  values (
    p_community_id,
    lower(trim(p_email)),
    encode(extensions.digest(v_token, 'sha256'), 'hex'),
    'pending',
    now() + interval '7 days',
    v_uid
  );

  return v_token;
end;
$$;
revoke all on function public.create_invitation(uuid, text) from public;
grant execute on function public.create_invitation(uuid, text) to authenticated;

-- ---------------------------------------------------------------------------
-- get_invitation_preview(token) — lecture publique MINIMALE nécessaire pour que la page
-- /invite/<token> puisse afficher "tu es invité·e à rejoindre <communauté>" à un visiteur PAS
-- ENCORE authentifié (anon). Compare le HASH du jeton fourni (jamais le jeton en clair, qui
-- n'est stocké nulle part) — ne renvoie jamais que la ligne correspondant EXACTEMENT au jeton,
-- jamais une liste. SECURITY DEFINER nécessaire : anon n'a par ailleurs aucun droit ici.
-- ---------------------------------------------------------------------------
drop function if exists public.get_invitation_preview(uuid);
create or replace function public.get_invitation_preview(p_token text)
returns table (email text, community_name text, status text, expires_at timestamptz)
language sql
security definer
stable
set search_path = ''
as $$
  select i.email, c.name, i.status, i.expires_at
  from public.invitations i
  join public.communities c on c.id = i.community_id
  where i.token_hash = encode(extensions.digest(p_token, 'sha256'), 'hex');
$$;
revoke all on function public.get_invitation_preview(text) from public;
grant execute on function public.get_invitation_preview(text) to anon, authenticated;

-- ---------------------------------------------------------------------------
-- accept_invitation(token, display_name) — seul chemin qui crée une ligne `members` pour un
-- compte qui n'en avait pas encore. Revérifie tout côté serveur, jamais seulement côté
-- interface : compte connecté (auth.uid() non nul), invitation existante (par hash), non
-- expirée, ET e-mail du compte connecté === e-mail invité (protection indépendante de la
-- robustesse du jeton — empêche un lien transféré par erreur d'être accepté par la mauvaise
-- personne). Idempotente : un second appel (double clic, page rechargée) ne casse rien —
-- `on conflict do nothing` sur `members`, statut/accepted_at/accepted_by mis à jour seulement
-- s'ils ne l'étaient pas déjà.
-- ---------------------------------------------------------------------------
-- Colonnes de sortie délibérément préfixées `joined_` — PAS `community_id`/`community_name` :
-- un OUT/RETURNS TABLE de ce nom entre en collision avec la colonne RÉELLE `community_id` de
-- `members`/`invitations`, référencée telle quelle plus bas (`insert ... (community_id, ...)`,
-- `on conflict (community_id, user_id)`) — PL/pgSQL substitue alors silencieusement CES
-- références bare par le paramètre de sortie plutôt que par la colonne de table visée,
-- provoquant "column reference community_id is ambiguous" à l'exécution. Confirmé
-- expérimentalement contre un PostgreSQL local jetable avant ce correctif (déjà rencontré et
-- corrigé dans la 1ère version de ce fichier — toujours vrai avec ce nouveau schéma).
drop function if exists public.accept_invitation(uuid, text);
drop function if exists public.accept_invitation(text, text);
create function public.accept_invitation(p_token text, p_display_name text default null)
returns table (joined_community_id uuid, joined_community_name text)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_invitation public.invitations%rowtype;
  v_uid uuid := auth.uid();
  v_email text := lower(coalesce(auth.jwt() ->> 'email', ''));
  v_name text;
  v_hash text := encode(extensions.digest(p_token, 'sha256'), 'hex');
begin
  if v_uid is null then
    raise exception 'Vous devez être connecté pour accepter une invitation.';
  end if;

  select * into v_invitation from public.invitations where token_hash = v_hash;
  if not found then
    raise exception 'Invitation introuvable — le lien est peut-être incorrect.';
  end if;

  if v_invitation.status = 'expired' or v_invitation.expires_at < now() then
    raise exception 'Cette invitation a expiré — demande un nouveau lien.';
  end if;

  if v_email = '' or lower(v_invitation.email) <> v_email then
    raise exception 'Cette invitation a été envoyée à une autre adresse e-mail que celle de ce compte.';
  end if;

  v_name := coalesce(nullif(trim(p_display_name), ''), split_part(v_invitation.email, '@', 1));

  insert into public.members (community_id, user_id, role, status, display_name)
  values (v_invitation.community_id, v_uid, 'member', 'active', v_name)
  on conflict (community_id, user_id) do nothing;

  if v_invitation.status <> 'accepted' then
    update public.invitations
      set status = 'accepted', accepted_at = now(), accepted_by = v_uid
      where id = v_invitation.id;
  end if;

  return query
    select c.id, c.name from public.communities c where c.id = v_invitation.community_id;
end;
$$;
revoke all on function public.accept_invitation(text, text) from public;
grant execute on function public.accept_invitation(text, text) to authenticated;
