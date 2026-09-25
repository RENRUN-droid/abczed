-- ABCZed — V7.28 : "Le p'tit billet" (encart en haut de l'Accueil) devient un vrai contenu,
-- modifiable par l'administrateur depuis l'application, au lieu du texte de démonstration codé
-- en dur dans Accueil.jsx depuis l'origine du projet.
--
-- Conception : UNE seule ligne par communauté (`community_id` est la clé primaire de la table
-- `billet`, pas un id séparé) — l'utilisatrice a explicitement demandé "quelque chose qui
-- passe et laisse sa place", pas un historique/flux à faire défiler : chaque mise à jour
-- REMPLACE le billet courant (upsert côté client, src/billetApi.js), aucune table d'historique
-- séparée.
--
-- Lecture : tout membre de la communauté. Écriture (création ET mise à jour) : administrateur
-- de la communauté uniquement — même fonction app_private.is_community_admin(), déjà en place
-- (sql/01_schema_and_helpers.sql), déjà réutilisée telle quelle par sql/02_rls.sql (`shares`)
-- et sql/09_invitations.sql (create_invitation()). Écriture directement via la table (RLS),
-- comme `shares`/`messages` — pas de fonction SECURITY DEFINER ici, aucune logique
-- supplémentaire à faire respecter au-delà du rôle admin (contrairement aux invitations, qui
-- génèrent en plus un jeton à usage unique).
--
-- NON EXÉCUTÉ PAR MOI CONTRE LE PROJET SUPABASE RÉEL DE L'UTILISATEUR — vérifié contre un
-- PostgreSQL local jetable (mêmes scripts que sql/04 à sql/09, voir scripts/sql-tests/), jamais
-- contre Supabase directement. Application manuelle par l'utilisatrice : coller ce fichier dans
-- le SQL Editor Supabase, une fois.
--
-- Idempotent, même idiome que sql/06 à sql/09 : `create table if not exists`, `drop policy if
-- exists` avant recréation, ajout à la publication Realtime seulement si absent.

create table if not exists billet (
  community_id uuid primary key references communities(id) on delete cascade,
  content text not null,
  updated_at timestamptz not null default now(),
  updated_by uuid references auth.users(id) on delete set null
);

alter table billet enable row level security;

-- GRANTS — couche 1, avant les policies (même ordre que sql/02_rls.sql/sql/06). anon : rien.
-- authenticated : select/insert/update (jamais delete, un billet est remplacé, jamais
-- supprimé). Oublié dans la version initialement livrée (V7.28) — corrigé après un 403
-- (Forbidden) constaté par l'utilisatrice en test réel, cause : un grant manquant bloque la
-- requête avant même que les policies RLS ci-dessous ne soient évaluées.
grant select, insert, update on billet to authenticated;

drop policy if exists "select_billet_same_community" on billet;
create policy "select_billet_same_community" on billet for select to authenticated
  using ((select app_private.is_community_member(community_id)));

drop policy if exists "insert_billet_admin" on billet;
create policy "insert_billet_admin" on billet for insert to authenticated
  with check ((select app_private.is_community_admin(community_id)));

drop policy if exists "update_billet_admin" on billet;
create policy "update_billet_admin" on billet for update to authenticated
  using ((select app_private.is_community_admin(community_id)))
  with check ((select app_private.is_community_admin(community_id)));

-- ---------------------------------------------------------------------------
-- Realtime — même patron exact que sql/06_message_reactions.sql (publication déjà existante
-- par défaut chez Supabase, ajout idempotent, ne suppose jamais qu'elle s'appelle forcément
-- `supabase_realtime` sans vérifier). Aucun `replica identity full` nécessaire ici
-- (contrairement à sql/07) : `community_id` est déjà la clé primaire de `billet`, donc déjà
-- systématiquement incluse dans la ligne transmise, y compris pour un DELETE — cette table n'en
-- fait d'ailleurs jamais (un billet est remplacé, jamais supprimé).
-- ---------------------------------------------------------------------------
do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    if not exists (
      select 1 from pg_publication_tables
      where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'billet'
    ) then
      alter publication supabase_realtime add table public.billet;
    end if;
  end if;
end $$;
