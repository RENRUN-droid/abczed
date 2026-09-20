import { supabase } from './supabaseClient';

// NOTE (bloc Auth) : plus de communauté unique codée en dur — communityId est désormais
// un paramètre réel, dérivé de l'adhésion active de l'utilisateur connecté (voir
// auth/AuthProvider.jsx). Ces fonctions restent par ailleurs incompatibles avec le
// schéma sécurisé actuel (member_name/author_name en texte libre, alors que le schéma
// réel utilise author_id/user_id en uuid) — non corrigé ici, ce serait la migration des
// données métier que ce bloc évite explicitement.

export async function fetchEvents(communityId) {
  const { data: events, error } = await supabase
    .from('events')
    .select('*, event_participants(member_name)')
    .eq('community_id', communityId)
    .order('date', { ascending: true });
  if (error) throw error;
  return events.map((e) => ({
    id: e.id,
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
    participants: (e.event_participants || []).map((p) => p.member_name),
    hasLinkedThread: false, // recalculé côté app à partir des messages chargés
  }));
}

export async function fetchMessages(communityId) {
  const { data, error } = await supabase
    .from('messages')
    .select('*')
    .eq('community_id', communityId)
    .order('created_at', { ascending: true });
  if (error) throw error;
  return data.map((m) => ({
    id: m.id,
    author: m.author_name,
    initials: m.author_name.slice(0, 1).toUpperCase(),
    color: m.avatar_color,
    text: m.text,
    file: m.file_name ? { name: m.file_name, size: m.file_size } : null,
    time: new Date(m.created_at).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }),
    reactions: m.reactions || [],
    linkedEventId: m.linked_event_id,
  }));
}

export async function sendMessage(communityId, { authorName, avatarColor, text, linkedEventId }) {
  const { error } = await supabase.from('messages').insert([{
    community_id: communityId,
    author_name: authorName,
    avatar_color: avatarColor,
    text,
    linked_event_id: linkedEventId || null,
  }]);
  if (error) throw error;
}

export async function linkMessageToEvent(messageId, eventId) {
  const { error } = await supabase
    .from('messages')
    .update({ linked_event_id: eventId })
    .eq('id', messageId);
  if (error) throw error;
}

export async function createEvent(communityId, { category, subtype, title, date, startTime, location, description }) {
  const { error } = await supabase.from('events').insert([{
    community_id: communityId,
    category,
    subtype,
    title,
    date,
    start_time: startTime,
    location,
    description,
  }]);
  if (error) throw error;
}

export async function toggleParticipant(eventId, memberName, isJoining) {
  if (isJoining) {
    const { error } = await supabase
      .from('event_participants')
      .insert([{ event_id: eventId, member_name: memberName }]);
    if (error) throw error;
  } else {
    const { error } = await supabase
      .from('event_participants')
      .delete()
      .eq('event_id', eventId)
      .eq('member_name', memberName);
    if (error) throw error;
  }
}

export function subscribeToChanges(onChange) {
  const channel = supabase
    .channel('abczed-changes')
    .on('postgres_changes', { event: '*', schema: 'public', table: 'events' }, onChange)
    .on('postgres_changes', { event: '*', schema: 'public', table: 'event_participants' }, onChange)
    .on('postgres_changes', { event: '*', schema: 'public', table: 'messages' }, onChange)
    .subscribe();
  return () => supabase.removeChannel(channel);
}
