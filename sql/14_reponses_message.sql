-- ABCZed — V7.39 : répondre à un message précis (glisser un message → sa citation s'attache à
-- la réponse en cours de rédaction).
--
-- Une seule colonne : `messages.reply_to_id`, référence vers un AUTRE message (même table,
-- auto-référence). `on delete set null` : si le message d'origine est supprimé plus tard, la
-- réponse qui le citait redevient un message normal (sans citation cassée pointant vers un id
-- disparu) plutôt que d'empêcher la suppression ou de casser l'affichage.
--
-- Écriture déjà couverte SANS nouvelle policy/grant : `grant select, insert, update, delete on
-- messages to authenticated` (sql/02_rls.sql, ligne 220) est un grant de TABLE, et la policy
-- "insert_own_message" (sql/02_rls.sql) ne contraint que community_id/author_id — jamais cette
-- nouvelle colonne.
--
-- Garde-fou ajouté quand même, même patron exact que check_event_link (sql/02_rls.sql, "un
-- message ne peut être lié qu'à un événement de la MÊME communauté") : un message ne peut
-- répondre qu'à un message de SA PROPRE communauté — empêche un id de message deviné/volé
-- appartenant à une autre communauté ABCZed d'être cité par erreur ou malveillance.
--
-- NON EXÉCUTÉ PAR MOI CONTRE LE PROJET SUPABASE RÉEL DE L'UTILISATEUR. Application manuelle :
-- coller ce fichier dans le SQL Editor Supabase, une fois. Idempotent.

alter table messages add column if not exists reply_to_id uuid references messages(id) on delete set null;

create or replace function app_private.check_reply_link(p_community_id uuid, p_reply_to_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_msg record;
begin
  if p_reply_to_id is null then return; end if;
  select community_id into v_msg from public.messages where id = p_reply_to_id;
  if v_msg is null then
    raise exception 'Message d''origine introuvable.';
  end if;
  if v_msg.community_id is distinct from p_community_id then
    raise exception 'Impossible de répondre à un message d''une autre communauté.';
  end if;
end;
$$;
revoke all on function app_private.check_reply_link(uuid, uuid) from public;

create or replace function app_private.trg_check_message_reply_link()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  perform app_private.check_reply_link(new.community_id, new.reply_to_id);
  return new;
end;
$$;
revoke all on function app_private.trg_check_message_reply_link() from public;
drop trigger if exists trg_messages_reply_link on messages;
create trigger trg_messages_reply_link before insert or update on messages
  for each row execute function app_private.trg_check_message_reply_link();

notify pgrst, 'reload schema';
