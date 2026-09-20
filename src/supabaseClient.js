import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabasePublishableKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY

export const isSupabaseConfigured = Boolean(supabaseUrl && supabasePublishableKey)

if (!isSupabaseConfigured) {
  console.error(
    'Variables VITE_SUPABASE_URL / VITE_SUPABASE_PUBLISHABLE_KEY manquantes. Vérifie ton fichier .env (en local) ou les variables d\'environnement Vercel (en production).'
  )
}

// L'authentification étant désormais le passage obligé de toute l'appli (voir
// auth/AuthProvider.jsx), createClient(undefined, undefined) plantait immédiatement au
// chargement ("supabaseUrl is required") si .env n'était pas rempli — avant, ça n'avait
// aucune conséquence puisqu'on pouvait rester en mode démo locale sans jamais toucher au
// client. Ce n'est plus le cas : on évite l'appel plutôt que de laisser planter.
export const supabase = isSupabaseConfigured ? createClient(supabaseUrl, supabasePublishableKey) : null
