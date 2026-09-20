// Harnais de test local (Playwright) — livré dans le ZIP (corrigé V7.8, affirmait auparavant à
// tort "PAS livré dans le ZIP", signalé par contre-vérification indépendante), mais PAS une
// modification du code produit lui-même. Remplace uniquement auth/AuthProvider.jsx via un alias
// Vite (vite.harness.config.js) pour pouvoir monter App.jsx dans un vrai navigateur sans toucher
// au projet Supabase réel.
// V7.7 : `session.user.id` DOIT rester 'test-user-1' — c'est l'identifiant que
// test-harness/mockMessagesApi.js utilise comme CURRENT_USER_ID pour que isMine/réactions
// "mine" fonctionnent exactement comme author_id = auth.uid() le ferait réellement.
// `activeCommunity` ici n'est PAS ce qu'App.jsx utilise pour communityId/isAdmin (App.jsx reçoit
// son propre `activeCommunity` en PROP, câblé par test-harness/main.jsx — voir son commentaire) ;
// gardé identique ici uniquement pour la cohérence des autres composants qui appellent useAuth()
// directement (ex. MyProfileSheet.jsx).
export function useAuth() {
  return {
    session: { user: { id: 'test-user-1' } },
    status: 'authorized',
    // V7.11 (P1) : `display_name` ajouté pour cohérence avec AuthProvider.jsx réel (voir son
    // commentaire) — non utilisé par App.jsx (qui reçoit son propre `activeCommunity` en PROP,
    // câblé par test-harness/main.jsx, voir son commentaire), seulement par d'éventuels autres
    // appelants directs de useAuth().activeCommunity.
    activeCommunity: { community_id: 'test-community-1', role: 'admin', display_name: 'Amélie Dupont' },
    memberships: [],
    signOut: () => {},
  };
}
