-- ABCZed — Étape 4/7 (suite) : décompte adultes/enfants sur le RSVP des sorties.
-- N'ajoute AUCUNE policy, AUCUN grant, AUCUNE fonction SECURITY DEFINER — arbitrage
-- explicite : on reste sur le mécanisme DELETE + INSERT déjà en place (pas d'UPDATE),
-- gestion défensive de l'échec intermédiaire déplacée côté frontend (voir agendaApi.js).
--
-- Contrainte volontairement générique, PAS spécifique à un sous-type : un même garde-fou
-- couvre à la fois "Sortie entre familles" (le titulaire est présent, adults_count >= 1
-- dans l'usage normal) et "Sortie avec l'école" (un parent peut inscrire un enfant sans
-- l'accompagner, adults_count = 0 est légitime). Seul l'absurde est interdit : une ligne de
-- participation qui ne représente personne du tout.
--
-- École et Autre restent en RSVP simple — ces deux colonnes existent quand même sur leurs
-- lignes (valeurs par défaut 1/0), mais l'interface ne montre jamais le panneau de
-- décompte pour ces catégories. Anniversaire n'a toujours aucun RSVP, inchangé.

alter table event_participants
  add column if not exists adults_count int not null default 1,
  add column if not exists children_count int not null default 0;

-- IF NOT EXISTS n'existe pas pour ADD CONSTRAINT en Postgres — sans ce contrôle explicite
-- sur pg_constraint, relancer ce script une deuxième fois (procédure manuelle, pas de
-- migrations versionnées côté Supabase) échouerait sur une contrainte déjà présente.
do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'event_participants_counts_valid'
  ) then
    alter table event_participants
      add constraint event_participants_counts_valid
      check (adults_count >= 0 and children_count >= 0 and adults_count + children_count >= 1);
  end if;
end $$;
