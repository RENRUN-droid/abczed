import { createContext, useContext, useEffect, useState, useCallback, useRef } from 'react';
import { supabase, isSupabaseConfigured } from '../supabaseClient';
import { selectActiveCommunity } from './selectActiveCommunity';

const AuthContext = createContext(null);

// États explicites, un seul écran possible par état — jamais de flash de contenu protégé.
// not-configured | loading-session | signed-out | authenticated-checking-membership
// | authorized | authenticated-but-no-access | password-recovery

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
    const { data: listener } = supabase.auth.onAuthStateChange((event, newSession) => {
      // V7.19 — "mot de passe oublié" : en ouvrant le lien reçu par e-mail, Supabase authentifie
      // une session TEMPORAIRE dédiée au seul changement de mot de passe (le SDK détecte tout
      // seul le jeton de récupération dans l'URL, quelle que soit la page d'atterrissage — voir
      // requestPasswordReset ci-dessous, redirectTo pointe simplement vers la racine du site).
      // Surtout ne jamais enchaîner sur loadMemberships ici comme pour une connexion normale :
      // ce serait faire entrer l'utilisateur dans l'app avec son ANCIEN mot de passe encore
      // valide, sans être jamais passé par l'écran de changement — la session `PASSWORD_RECOVERY`
      // doit rester bloquée sur ResetPassword.jsx (Root.jsx) tant que updatePassword() n'a pas
      // été appelé avec succès.
      if (event === 'PASSWORD_RECOVERY') {
        setSession(newSession);
        requestId.current++; // annule toute vérification de membership encore en vol
        setError('');
        setStatus('password-recovery');
        return;
      }
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

  // V7.18 — nécessaire au parcours d'invitation (InviteAccept.jsx) : jusqu'ici AuthProvider
  // n'exposait que signIn (aucun écran d'inscription n'existait). Ne définit AUCUNE politique
  // de confirmation d'e-mail elle-même — le projet Supabase peut avoir "Confirm email" activé
  // ou non ; c'est `data.session` (présente ou non dans la réponse) qui le révèle après coup,
  // jamais deviné à l'avance ici. L'appelant (InviteAccept.jsx) décide quoi afficher selon ce
  // que cette fonction renvoie, pas cette fonction elle-même.
  async function signUp(email, password) {
    if (!isSupabaseConfigured) return { ok: false, error: 'not-configured' };
    const { data, error: err } = await supabase.auth.signUp({ email, password });
    if (err) return { ok: false, error: err.message };
    // `data.session` non nul = confirmation d'e-mail désactivée sur ce projet : le compte est
    // déjà authentifié, onAuthStateChange (ci-dessus) va lever loadMemberships tout seul.
    return { ok: true, hasSession: Boolean(data.session) };
  }

  async function signOut() {
    if (!isSupabaseConfigured) return;
    await supabase.auth.signOut();
  }

  // V7.19 — "mot de passe oublié" (Login.jsx). Message de succès volontairement identique que
  // l'adresse corresponde ou non à un compte existant — même logique anti-énumération que le
  // message d'erreur générique de signIn() ci-dessus : ne jamais laisser un visiteur déduire
  // qu'une adresse est enregistrée ou non à partir de la réponse de ce formulaire.
  async function requestPasswordReset(email) {
    if (!isSupabaseConfigured) return { ok: false, error: 'not-configured' };
    // redirectTo pointe vers la racine du site, jamais une page dédiée : le SDK Supabase détecte
    // tout seul le jeton de récupération présent dans l'URL au chargement, quelle que soit la
    // page — inutile (et fragile) de coder un chemin spécifique en dur ici ET côté Supabase.
    const { error: err } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: window.location.origin,
    });
    if (err) return { ok: false, error: err.message };
    return { ok: true };
  }

  // Appelé depuis ResetPassword.jsx (Root.jsx, status === 'password-recovery') une fois le
  // nouveau mot de passe saisi. Après succès, relance loadMemberships nous-mêmes : la session de
  // récupération est déjà active côté Supabase, mais aucun nouvel événement onAuthStateChange ne
  // sera émis pour signaler "le mot de passe est changé, tu peux continuer" — sans cet appel
  // explicite, l'utilisateur resterait bloqué sur l'écran de changement de mot de passe.
  async function updatePassword(newPassword) {
    if (!isSupabaseConfigured) return { ok: false, error: 'not-configured' };
    const { error: err } = await supabase.auth.updateUser({ password: newPassword });
    if (err) return { ok: false, error: err.message };
    if (session) loadMemberships(session);
    return { ok: true };
  }

  // V7.18 — après accept_invitation() (nouvelle ligne `members` créée côté serveur),
  // AuthProvider ne le sait pas tout seul : `memberships`/`activeCommunity`/`status` ne se
  // recalculent que sur un événement onAuthStateChange, jamais sur une simple mutation en base.
  // Réutilise loadMemberships tel quel (même garde anti-réponse-obsolète) plutôt qu'une
  // nouvelle logique — InviteAccept.jsx l'appelle explicitement juste après une acceptation
  // réussie, pour que Root.jsx puisse ensuite basculer naturellement vers l'app une fois
  // `status` passé à 'authorized'.
  function refreshMemberships() {
    if (session) loadMemberships(session);
  }

  return (
    <AuthContext.Provider value={{ status, session, memberships, activeCommunity, error, signIn, signUp, signOut, refreshMemberships, requestPasswordReset, updatePassword }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth() doit être utilisé à l\'intérieur de <AuthProvider>.');
  return ctx;
}
