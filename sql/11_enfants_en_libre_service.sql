-- ABCZed — Étape 11 : les parents peuvent désormais renseigner, corriger et retirer eux-mêmes
-- les enfants rattachés à leur profil.
--
-- Jusqu'ici (sql/02_rls.sql, ligne "grant select on children, member_children to authenticated
-- -- écriture volontairement absente en V1"), children/member_children étaient en lecture seule
-- pour tout le monde, y compris l'administrateur — un prénom d'enfant mal orthographié ne
-- pouvait être corrigé que par une livraison de code. Demande explicite de l'utilisatrice.
--
-- Modèle retenu : "retirer un enfant" = supprimer UNIQUEMENT le lien member_children (la
-- personne ne voit plus cet enfant sur son profil), JAMAIS un vrai DELETE sur la ligne children
-- elle-même — un enfant peut être rattaché à plusieurs parents (garde partagée, même schéma que
-- la donnée de démonstration d'origine, src/data.js) ; supprimer la ligne children romprait le
-- lien pour l'AUTRE parent aussi. Une ligne children qui ne reste plus rattachée à personne
-- devient simplement invisible partout (rien ne l'affiche sans passer par member_children) —
-- laissée en base sans ménage automatique, même philosophie que "retirer un membre" (V7.30,
-- désactivation, jamais une suppression physique).
--
-- Portée des policies : une personne ne peut modifier/retirer QUE les enfants auxquels elle est
-- elle-même rattachée (exists member_children qui la lie) ; un administrateur de la communauté
-- garde ce droit sur tous les enfants de sa communauté, même sans lien direct — même principe
-- que "update_own_display_fields_or_admin" sur members (sql/02_rls.sql).

-- ---------------------------------------------------------------------------
-- GRANTS
-- ---------------------------------------------------------------------------
grant insert, update on children to authenticated;
grant insert, delete on member_children to authenticated;
-- select déjà accordé (sql/02_rls.sql). update sur member_children volontairement absent —
-- changer le libellé ("Maman"/"Papa"/...) d'un lien existant n'est pas demandé ; ajouter/retirer
-- suffit à couvrir le besoin exprimé. delete sur children volontairement absent aussi — voir le
-- modèle retenu ci-dessus (retirer = un DELETE member_children, jamais children).

-- ---------------------------------------------------------------------------
-- POLICIES — children
-- ---------------------------------------------------------------------------

-- Ajouter un enfant dans SA PROPRE communauté (jamais dans une autre).
create policy "insert_child_own_community" on children for insert to authenticated
  with check ((select app_private.is_community_member(community_id)));

-- Corriger un enfant auquel on est soi-même rattaché, ou être admin de la communauté de
-- l'enfant.
create policy "update_child_own_or_admin" on children for update to authenticated
  using (
    exists (
      select 1 from member_children mc
      join members m on m.id = mc.member_id
      where mc.child_id = children.id and m.user_id = (select auth.uid()) and m.status = 'active'
    )
    or (select app_private.is_community_admin(community_id))
  )
  with check (
    exists (
      select 1 from member_children mc
      join members m on m.id = mc.member_id
      where mc.child_id = children.id and m.user_id = (select auth.uid()) and m.status = 'active'
    )
    or (select app_private.is_community_admin(community_id))
  );

-- ---------------------------------------------------------------------------
-- POLICIES — member_children
-- ---------------------------------------------------------------------------

-- Créer son propre lien (jamais au nom d'un autre membre).
create policy "insert_own_member_children" on member_children for insert to authenticated
  with check (
    exists (
      select 1 from members m
      where m.id = member_id and m.user_id = (select auth.uid()) and m.status = 'active'
    )
  );

-- Retirer son propre lien, ou être admin de la communauté de l'enfant.
create policy "delete_own_member_children_or_admin" on member_children for delete to authenticated
  using (
    exists (
      select 1 from members m
      where m.id = member_id and m.user_id = (select auth.uid()) and m.status = 'active'
    )
    or exists (
      select 1 from children c
      where c.id = child_id and (select app_private.is_community_admin(c.community_id))
    )
  );
