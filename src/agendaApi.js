// Module dédié Agenda — délibérément séparé de api.js (qui reste la dette Messages/
// Partages, non touchée dans ce bloc). Contrat réel vérifié dans sql/02_rls.sql avant
// d'écrire ce fichier : events.created_by et event_participants.user_id sont tous deux
// des uuid liés à auth.uid(), jamais du texte libre.
//
// Point vérifié explicitement avant d'écrire fetchAgendaEvents : event_participants et
// members référencent chacun auth.users séparément, AUCUNE FK ne relie directement les
// deux tables. PostgREST ne peut donc pas faire de jointure imbriquée event_participants
// -> members en un seul select. D'où les deux lectures distinctes ci-dessous, fusionnées
// en mémoire côté client — pas de modification du schéma pour contourner ça.

import { supabase } from './supabaseClient';
// Point 3 (2e contre-vérification, ZIP V7.2) : détection de "colonne attendee_names absente"
// déplacée dans son propre module pur, testable en Node sans dépendre de supabaseClient.js —
// voir src/undefinedColumnError.js pour le détail du correctif (l'ancienne détection, une
// simple sous-chaîne "attendee_names" dans le message, confondait à tort une violation de la
// contrainte de forme avec une migration non appliquée) et scripts/test-undefined-column-error.mjs
// pour la vérification discriminante correspondante.
import { isUndefinedColumnError } from './undefinedColumnError';

// Insertion défensive d'une ligne de participation : inclut `attendee_names` quand fourni,
// mais ne bloque JAMAIS l'inscription/modification de base (compteurs adultes/enfants) si la
// migration additive n'a pas encore été appliquée sur ce projet Supabase — brief explicite :
// la fonctionnalité "prénoms" ne doit pas être déclarée opérationnelle avant cette migration,
// mais elle ne doit pas non plus casser le RSVP déjà confirmé fonctionnel en recette réelle.
// Si la colonne manque, réessaie sans les prénoms et lève une erreur dédiée
// (ATTENDEE_NAMES_UNSUPPORTED, traitée explicitement par App.jsx) pour que l'appelant sache
// que l'inscription/modification a bien réussi mais que les prénoms n'ont pas été enregistrés
// — jamais une perte silencieuse de cette information.
async function insertParticipation(eventId, communityId, userId, counts) {
  const base = { event_id: eventId, community_id: communityId, user_id: userId, adults_count: counts.adultsCount, children_count: counts.childrenCount };
  const withNames = counts.attendeeNames ? { ...base, attendee_names: counts.attendeeNames } : base;
  const { error } = await supabase.from('event_participants').insert([withNames]);
  if (!error) return;
  if (!counts.attendeeNames || !isUndefinedColumnError(error)) throw error;

  const { error: retryError } = await supabase.from('event_participants').insert([base]);
  if (retryError) throw retryError;
  const err = new Error(
    "Ta réponse a bien été enregistrée, mais les prénoms n'ont pas pu être sauvegardés — la base de données n'a pas encore la migration nécessaire (sql/05_participant_names.sql).",
  );
  err.code = 'ATTENDEE_NAMES_UNSUPPORTED';
  throw err;
}

// Point 2 : lecture défensive symétrique à `insertParticipation` — `attendee_names` est demandé
// en priorité, mais si la migration 05 n'a pas encore été appliquée, PostgREST rejette la
// requête ENTIÈRE pour une colonne inexistante dans un `select` imbriqué (contrairement à un
// insert, où seule cette ligne échoue) : sans ce repli, charger l'agenda casserait totalement
// tant que la migration n'est pas faite, bien pire que l'absence de prénoms elle-même.
// P5 (exercice de correction V7.5) : renvoie désormais `{ data, namesUnsupported }` plutôt
// qu'un simple tableau — `namesUnsupported` (vrai seulement si le repli sans `attendee_names`
// a réellement été emprunté) permet à l'appelant (fetchAgendaEvents, puis App.jsx) de savoir
// que la migration sql/05 n'est pas encore appliquée, pour avertir l'utilisateur AVANT même
// qu'il essaie d'enregistrer des prénoms — pas seulement après un échec réactif à
// l'enregistrement (ATTENDEE_NAMES_UNSUPPORTED, déjà géré séparément dans joinEvent/
// modifyParticipation). Voir src/undefinedColumnError.js pour le détail, réellement vérifié
// cette fois-ci, de la forme d'erreur PostgREST propre à CE select imbriqué précis.
async function fetchEventsRaw(communityId) {
  const withNames = supabase
    .from('events')
    .select('*, event_participants(user_id, adults_count, children_count, attendee_names)')
    .eq('community_id', communityId)
    .order('date', { ascending: true });
  const first = await withNames;
  if (!first.error) return { data: first.data, namesUnsupported: false };
  if (!isUndefinedColumnError(first.error)) throw first.error;

  const withoutNames = await supabase
    .from('events')
    .select('*, event_participants(user_id, adults_count, children_count)')
    .eq('community_id', communityId)
    .order('date', { ascending: true });
  if (withoutNames.error) throw withoutNames.error;
  return { data: withoutNames.data, namesUnsupported: true };
}

export async function fetchAgendaEvents(communityId) {
  const { data: events, namesUnsupported } = await fetchEventsRaw(communityId);

  // Deuxième lecture RLS-safe : les display_name des participants, par communauté.
  const allUserIds = [...new Set(events.flatMap((e) => (e.event_participants || []).map((p) => p.user_id)))];
  let namesByUserId = {};
  if (allUserIds.length > 0) {
    const { data: members, error: membersErr } = await supabase
      .from('members')
      .select('user_id, display_name')
      .eq('community_id', communityId)
      .in('user_id', allUserIds);
    if (membersErr) throw membersErr;
    namesByUserId = Object.fromEntries(members.map((m) => [m.user_id, m.display_name]));
  }

  // P5 (exercice de correction V7.5) : `attendeeNamesUnsupported` remonté avec les événements
  // (jamais un simple tableau nu comme avant cette passe) pour que App.jsx puisse avertir
  // PROACTIVEMENT dans le formulaire d'inscription (avant tout essai d'enregistrement) que les
  // prénoms ne seront pas sauvegardés tant que sql/05_participant_names.sql n'est pas appliqué —
  // complète, sans le remplacer, l'avertissement réactif déjà géré ailleurs
  // (ATTENDEE_NAMES_UNSUPPORTED, levé par insertParticipation au moment d'un essai réel).
  const mapped = events.map((e) => {
    const participants = (e.event_participants || []).map((p) => ({
      userId: p.user_id,
      // Repli défensif volontaire : jamais de fragment d'UUID, jamais d'email, jamais
      // de donnée issue de auth.users — uniquement members.display_name ou "Membre".
      label: namesByUserId[p.user_id] || 'Membre',
      adultsCount: p.adults_count,
      childrenCount: p.children_count,
      // Point 2 : `null` tant qu'aucun prénom n'a été saisi (saisie facultative) OU tant que
      // la migration 05 n'a pas été appliquée (la colonne n'existe alors simplement pas dans
      // la ligne renvoyée par PostgREST) — les deux cas sont indiscernables ici et se
      // comportent déjà correctement de la même façon côté UI (rien n'est affiché).
      attendeeNames: p.attendee_names || null,
    }));
    return {
      id: e.id,
      // V7.11 (P0) : nécessaire pour déterminer, côté interface, qui peut voir l'action
      // "Supprimer l'événement" (le créateur, ou un admin — voir EventDetail.jsx/App.jsx) sans
      // deviner : `created_by` était déjà lu par `select('*')` mais jamais mappé jusqu'ici.
      createdBy: e.created_by,
      category: e.category,
      subtype: e.subtype,
      title: e.title,
      description: e.description,
      date: e.date,
      startTime: e.start_time?.slice(0, 5) || '',
      endTime: e.end_time?.slice(0, 5) || '',
      location: e.location,
      address: e.address,
      attachments: e.attachments || [],
      day: e.birthday_day,
      month: e.birthday_month,
      // Forme objet, pas juste des chaînes : il faut à la fois l'identité réelle (pour
      // "est-ce que j'ai rejoint ?") et un libellé affichable (pour les avatars), et rien
      // dans le schéma ne garantit qu'un nom existe pour chaque participant.
      participants,
      // Deux agrégats distincts, demandés explicitement : familiesCount = nombre de lignes
      // (foyers inscrits), peopleCount = somme réelle de personnes. Pertinent uniquement
      // pour category === 'sortie' côté affichage, mais calculé pour tous par simplicité —
      // pour École/Autre, familiesCount === peopleCount puisque adults_count vaut 1 par défaut.
      familiesCount: participants.length,
      peopleCount: participants.reduce((sum, p) => sum + (p.adultsCount || 0) + (p.childrenCount || 0), 0),
      // Migration module par module : les messages restent factices dans ce bloc, avec des
      // linkedEventId qui pointent vers d'anciens identifiants fictifs — aucune correspondance
      // possible avec les vrais UUID Supabase. Reconnecté au bloc Messages.
      hasLinkedThread: false,
    };
  });
  return { events: mapped, attendeeNamesUnsupported: namesUnsupported };
}

// V7.14 (correctif UAT point 14) : `.select('id').single()` ajouté à l'INSERT — la fonction ne
// renvoyait jusqu'ici RIEN (`{ error }` seul, valeur de retour toujours `undefined`). Nécessaire
// pour qu'App.jsx (`handleCreateEvent`) puisse naviguer directement vers la fiche du NOUVEL
// événement après une création réussie, plutôt que de renvoyer aveuglément à l'Accueil/l'Agenda
// à une position de défilement quelconque. Changement additif seul : la signature (paramètres)
// est strictement inchangée, et aucun appelant existant n'utilisait déjà cette valeur de retour
// (qui valait `undefined` avant ce lot) — rien ne peut donc régresser côté appelants existants.
export async function createAgendaEvent(communityId, userId, { category, subtype, title, date, startTime, location, description }) {
  const { data, error } = await supabase.from('events').insert([{
    community_id: communityId,
    created_by: userId,
    category,
    subtype,
    title,
    date,
    start_time: startTime,
    location,
    description,
  }]).select('id').single();
  if (error) throw error;
  return { id: data?.id };
}

// Brief §20 : un anniversaire n'est pas un événement standard — prénom + jour + mois
// seulement, jamais d'année, d'heure, de lieu ni de RSVP. Insertion basée sur le schéma
// documenté dans sql/02_rls.sql (table events, lignes ~26-47 : colonnes birthday_day/
// birthday_month, contrainte anniversaire_minimal exigeant date/start_time nuls et
// location='') — PAS dans sql/01_schema_and_helpers.sql, qui ne définit que
// communities/members/invitations et les helpers app_private, aucune table events.
// IMPORTANT — non vérifié sur le vrai projet Supabase (hors de portée de cet environnement) :
// avant tout usage réel, confirmer que ces colonnes/contrainte existent bien telles quelles
// sur la base réelle et pas seulement dans les fichiers du dépôt (brief §20, garde-fou explicite).
// V7.14 (correctif UAT point 14) : même ajout, même raisonnement, que createAgendaEvent
// ci-dessus — App.jsx a besoin de l'id du nouvel anniversaire pour surligner sa ligne dans
// l'Agenda après création (il n'a pas de fiche de détail propre, voir handleCreateBirthday).
export async function createAgendaBirthday(communityId, userId, { title, day, month }) {
  const { data, error } = await supabase.from('events').insert([{
    community_id: communityId,
    created_by: userId,
    category: 'anniversaire',
    title,
    birthday_day: day,
    birthday_month: month,
  }]).select('id').single();
  if (error) throw error;
  return { id: data?.id };
}

export async function updateAgendaBirthday(eventId, { title, day, month }) {
  const { data, error } = await supabase
    .from('events')
    .update({
      title,
      birthday_day: day,
      birthday_month: month,
    })
    .eq('id', eventId)
    .eq('category', 'anniversaire')
    .select('id');
  if (error) throw error;
  if (!data || data.length === 0) {
    const err = new Error("La modification n'a pas été appliquée.");
    err.code = 'UPDATE_NOT_APPLIED';
    throw err;
  }
}

export async function joinAgendaEvent(eventId, communityId, userId, counts) {
  await insertParticipation(eventId, communityId, userId, counts);
}

export async function leaveAgendaEvent(eventId, userId) {
  const { error } = await supabase
    .from('event_participants')
    .delete()
    .eq('event_id', eventId)
    .eq('user_id', userId);
  if (error) throw error;
}

// Modification d'un RSVP existant — DELETE puis INSERT, PAS une transaction atomique
// (arbitrage explicite : pas de policy UPDATE, pas de fonction SECURITY DEFINER pour ça).
// Gestion défensive de l'échec intermédiaire : si le DELETE réussit mais que le nouvel
// INSERT échoue, on tente immédiatement de restaurer l'ancien RSVP avant de remonter
// l'erreur — sans jamais prétendre que c'est une garantie parfaite. Trois issues possibles,
// distinguées par le code d'erreur levé :
// - succès : rien n'est levé.
// - 'RESTORED_AFTER_FAILURE' : le nouvel INSERT a échoué, l'ancien RSVP a pu être restauré.
// - 'PARTICIPATION_LOST' : le nouvel INSERT a échoué ET la restauration aussi — la
//   participation est réellement perdue, il faut recharger l'état réel et le signaler.
export async function modifyAgendaParticipation(eventId, communityId, userId, oldCounts, newCounts) {
  // .select() force Supabase à renvoyer les lignes effectivement supprimées — sans ça,
  // un DELETE qui ne touche aucune ligne (état déjà changé entre-temps, ex. onglet ouvert
  // ailleurs) ne produit aucune erreur, et on enchaînerait à tort sur l'INSERT en croyant
  // l'ancienne ligne partie.
  const { data: deletedRows, error: deleteError } = await supabase
    .from('event_participants')
    .delete()
    .eq('event_id', eventId)
    .eq('user_id', userId)
    .select();
  if (deleteError) throw deleteError; // rien n'a été modifié, état d'origine intact

  if (!deletedRows || deletedRows.length === 0) {
    // La ligne attendue n'existait déjà plus — pas une perte, un état obsolète côté client.
    // Ne pas enchaîner sur INSERT/restauration : ça pourrait entrer en conflit avec une
    // ligne déjà recréée ailleurs (autre onglet, autre appareil) et produire un faux
    // PARTICIPATION_LOST alors que la vraie participation existe peut-être encore.
    const err = new Error("L'état de ta participation a changé entre-temps.");
    err.code = 'STALE_STATE';
    throw err;
  }

  try {
    await insertParticipation(eventId, communityId, userId, newCounts);
    return; // succès complet (prénoms inclus s'il y en avait, sinon rien à signaler)
  } catch (err) {
    // Point 2 : la nouvelle ligne a bien été insérée (compteurs corrects), seuls les prénoms
    // n'ont pas pu l'être (migration 05 pas encore appliquée) — ce n'est PAS un échec de la
    // modification, donc pas de restauration de l'ancien état : on remonte tel quel.
    if (err.code === 'ATTENDEE_NAMES_UNSUPPORTED') throw err;
  }

  try {
    await insertParticipation(eventId, communityId, userId, oldCounts);
  } catch (restoreErr) {
    // Même nuance que ci-dessus : la restauration a en réalité réussi (compteurs restaurés),
    // seuls les prénoms n'ont pas pu l'être — pas une perte de participation.
    if (restoreErr.code !== 'ATTENDEE_NAMES_UNSUPPORTED') {
      const err = new Error('La participation a été perdue et n\'a pas pu être restaurée.');
      err.code = 'PARTICIPATION_LOST';
      throw err;
    }
  }
  const err = new Error('La modification a échoué — ton ancienne réponse a été restaurée.');
  err.code = 'RESTORED_AFTER_FAILURE';
  throw err;
}

// ---------------------------------------------------------------------------------------------
// V7.11 (P0) — Suppression réelle d'un événement. Réservée au créateur de l'événement ou à un
// admin de la communauté — l'interface ne doit proposer ce bouton qu'à ces deux profils (voir
// EventDetail.jsx/App.jsx), mais l'appel réseau lui-même reste protégé indépendamment par RLS :
// la policy `delete_own_event_or_admin` (sql/02_rls.sql, EXISTANTE, non modifiée par ce lot —
// brief explicite "P0 n'a besoin d'AUCUNE nouvelle migration SQL") l'exigerait de toute façon.
//
// `.select()` après `.delete()` force PostgREST à renvoyer la ou les lignes RÉELLEMENT
// supprimées — sans ça, un DELETE que RLS aurait filtré à zéro ligne (un appel déclenché malgré
// tout par un client sans droit, ex. bug d'interface ou requête forgée) ne produirait AUCUNE
// erreur : Supabase ne lève pas d'erreur pour un DELETE qui touche 0 ligne par construction
// (comportement standard de PostgREST, pas un bug) — sans cette vérification explicite du
// tableau renvoyé, l'appelant croirait à tort à une suppression réussie. C'est exactement le
// même garde-fou déjà appliqué à `modifyAgendaParticipation` ci-dessus (`deletedRows.length`).
//
// Aucune fusion locale de l'état après suppression : l'appelant (App.jsx) recharge l'agenda
// réel (`loadAgendaEvents`) après un succès, jamais une simple suppression de l'événement de la
// liste locale en mémoire — cohérent avec le principe déjà appliqué à tout le reste de ce module
// (join/leave/modify rechargent tous l'état réel plutôt que de deviner le résultat).
//
// Effet de bord attendu côté serveur, DÉJÀ couvert par le schéma existant, non dupliqué ici :
// `messages.linked_event_id references events(id) on delete set null` (sql/02_rls.sql, ligne
// ~86) — un message lié à l'événement supprimé n'est jamais supprimé lui-même, seul son lien
// est retiré. Ce module ne touche pas `messages` : App.jsx recharge aussi le fil (`loadMessages`)
// après une suppression réussie pour que le badge d'événement disparaisse sans attendre un
// rechargement de page.
export async function deleteAgendaEvent(eventId) {
  const { data, error } = await supabase.from('events').delete().eq('id', eventId).select();
  if (error) throw error;
  if (!data || data.length === 0) {
    const err = new Error(
      "La suppression n'a pas pu être effectuée — droits insuffisants ou événement déjà supprimé.",
    );
    err.code = 'DELETE_NOT_APPLIED';
    throw err;
  }
}
