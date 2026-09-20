import { createContext, useContext, useEffect, useState, useCallback, useRef } from 'react';
import { supabase, isSupabaseConfigured } from '../supabaseClient';
import { selectActiveCommunity } from './selectActiveCommunity';

const AuthContext = createContext(null);

// États explicites, un seul écran possible par état — jamais de flash de contenu protégé.
// not-configured | loading-session | signed-out | authenticated-checking-membership
// | authorized | authenticated-but-no-access

export function AuthProvider({ children }) {
  const [status, setStatus] = useState(isSupabaseConfigured ? 'loading-session' : 'not-configured');
  const [session, setSession] = useState(null);
  const [memberships, setMemberships] = useState([]);
  const [activeCommunity, setActiveCommunity] = useState(null);
  const [error, setError] = useState('');
  // Empêche une réponse de requête "membership" obsolète (utilisateur déjà déconnecté ou
  // reconnecté entre-temps) d'écraser un état plus récent.
  const requestId = useRef(0);

  const loadMemberships = useCallback(async (currentSession) => {
    const myRequestId = ++requestId.current;
    setStatus('authenticated-checking-membership');
    setError('');

    // La RLS permet à un membre de voir aussi les autres membres actifs de sa communauté
    // (annuaire La Bande) — sans ce filtre user_id, la requête remonterait leurs adhésions
    // à eux, pas seulement la mienne.
    // V7.11 (P1) : `display_name` ajouté à cette lecture — nécessaire pour que l'avatar
    // connecté (src/components/ConnectedAvatar.jsx, affiché par App.jsx et par les nouveaux
    // en-têtes compacts) montre le VRAI nom du membre connecté au lieu d'un "V" figé en dur
    // (défaut confirmé en UAT réelle, brief V7.11 P1). Colonne déjà présente dans le schéma
    // livré (sql/01_schema_and_helpers.sql, table members) — aucune migration nécessaire.
    const { data, error: err } = await supabase
      .from('members')
      .select('id, community_id, role, status, display_name, communities(name)')
      .eq('user_id', currentSession.user.id)
      .eq('status', 'active');

    if (myRequestId !== requestId.current) return; // réponse obsolète, ignorée

    if (err) {
      setError('Impossible de vérifier votre accès pour le moment. Réessayez.');
      setMemberships([]);
      setActiveCommunity(null);
      setStatus('authenticated-but-no-access');
      return;
    }

    setMemberships(data || []);
    if (!data || data.length === 0) {
      setActiveCommunity(null);
      setStatus('authenticated-but-no-access');
    } else {
      setActiveCommunity(selectActiveCommunity(data));
      setStatus('authorized');
    }
  }, []);

  useEffect(() => {
    if (!isSupabaseConfigured) return; // rien à écouter, l'état "not-configured" reste figé
    // Un seul point d'écoute : onAuthStateChange fournit déjà la session initiale à
    // l'abonnement (pas besoin d'appeler getSession() en plus — ça créerait exactement le
    // double appel / la requête concurrente qu'on veut éviter).
    const { data: listener } = supabase.auth.onAuthStateChange((_event, newSession) => {
      setSession(newSession);
      if (newSession) {
        loadMemberships(newSession);
      } else {
        requestId.current++; // annule toute vérification de membership encore en vol
        setMemberships([]);
        setActiveCommunity(null);
        setError('');
        setStatus('signed-out');
      }
    });
    return () => listener.subscription.unsubscribe();
  }, [loadMemberships]);

  async function signIn(email, password) {
    if (!isSupabaseConfigured) return false;
    setError('');
    const { error: err } = await supabase.auth.signInWithPassword({ email, password });
    if (err) {
      // Message générique volontaire — ne jamais préciser si c'est l'email ou le mot de
      // passe qui est en cause (ça renseignerait sur l'existence d'un compte).
      setError('Identifiants incorrects.');
      return false;
    }
    return true;
  }

  async function signOut() {
    if (!isSupabaseConfigured) return;
    await supabase.auth.signOut();
  }

  return (
    <AuthContext.Provider value={{ status, session, memberships, activeCommunity, error, signIn, signOut }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth() doit être utilisé à l\'intérieur de <AuthProvider>.');
  return ctx;
}
