// ABCZed — "Le p'tit billet" (encart d'accueil), backend réel (sql/10_billet.sql). Une seule
// ligne par communauté (clé primaire `community_id`) : chaque mise à jour REMPLACE le billet
// courant (upsert), pas d'historique — demande explicite de l'utilisatrice ("quelque chose qui
// passe et laisse sa place"). Lecture par tout membre (RLS), écriture réservée à
// l'administrateur (RLS, sql/10_billet.sql) — jamais revérifié ici côté client, l'interface ne
// propose simplement pas l'action à un non-admin (voir EditBilletSheet.jsx/Accueil.jsx), même
// principe que "Inviter un parent" dans La Bande.
import { supabase } from './supabaseClient';

export async function fetchBillet(communityId) {
  const { data, error } = await supabase
    .from('billet')
    .select('content, updated_at')
    .eq('community_id', communityId)
    .maybeSingle();
  if (error) throw error;
  if (!data) return null;
  return { content: data.content, updatedAt: data.updated_at };
}

export async function upsertBillet(communityId, content) {
  const { data: userData, error: userErr } = await supabase.auth.getUser();
  if (userErr) throw userErr;
  const { error } = await supabase
    .from('billet')
    .upsert(
      {
        community_id: communityId,
        content,
        updated_at: new Date().toISOString(),
        updated_by: userData.user?.id ?? null,
      },
      { onConflict: 'community_id' },
    );
  if (error) throw error;
}

export function subscribeToBillet(communityId, onChange) {
  const channel = supabase
    .channel(`abczed-billet-${communityId}`)
    .on(
      'postgres_changes',
      { event: '*', schema: 'public', table: 'billet', filter: `community_id=eq.${communityId}` },
      () => onChange(),
    )
    .subscribe();
  return () => supabase.removeChannel(channel);
}
