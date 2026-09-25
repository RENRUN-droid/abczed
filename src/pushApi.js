// ABCZed — V7.44 (25 sept.) : la cloche — abonnement du navigateur aux notifications push
// (niveau système, même appli fermée). Même principe que avatarApi.js/childrenApi.js : un
// module dédié, jamais mêlé à App.jsx au-delà de l'appel des fonctions ci-dessous.
//
// Ce fichier gère UNIQUEMENT le côté navigateur (permission, service worker, abonnement
// PushManager) et la ligne correspondante dans push_subscriptions (sql/15_push_subscriptions.sql).
// L'envoi réel des notifications est fait côté serveur par l'Edge Function send-push, jamais ici.
import { supabase } from './supabaseClient';

const VAPID_PUBLIC_KEY = import.meta.env.VITE_VAPID_PUBLIC_KEY;

// Le navigateur attend la clé VAPID sous forme de Uint8Array, jamais la chaîne base64 telle
// quelle (format standard de la Push API, rien de spécifique à ABCZed).
function urlBase64ToUint8Array(base64String) {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; i++) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

// Support réel du navigateur — jamais supposé : certains navigateurs (ex. Safari iOS hors
// écran d'accueil, avant iOS 16.4) n'ont ni Service Worker ni Push Manager. La cloche doit
// rester invisible plutôt que de proposer un bouton qui plante au clic.
export function isPushSupported() {
  return Boolean(
    typeof window !== 'undefined' &&
      'serviceWorker' in navigator &&
      'PushManager' in window &&
      VAPID_PUBLIC_KEY
  );
}

// État réel au chargement : interroge le navigateur (pas seulement la base), pour refléter le
// cas où l'utilisateur a révoqué la permission depuis les réglages du navigateur sans passer
// par ABCZed — la base ne le saurait pas toute seule.
export async function getPushSubscriptionState() {
  if (!isPushSupported()) return false;
  const registration = await navigator.serviceWorker.ready;
  const existing = await registration.pushManager.getSubscription();
  return Boolean(existing);
}

// Active les notifications : demande la permission navigateur, crée l'abonnement PushManager,
// puis l'enregistre dans push_subscriptions (upsert sur endpoint — un même navigateur qui se
// réabonne après une expiration remplace sa ligne au lieu d'en créer une deuxième en doublon).
export async function subscribeToPush(userId) {
  if (!isPushSupported()) throw new Error('Notifications non disponibles sur ce navigateur.');

  const permission = await Notification.requestPermission();
  if (permission !== 'granted') {
    throw new Error('Permission refusée.');
  }

  const registration = await navigator.serviceWorker.ready;
  let subscription = await registration.pushManager.getSubscription();
  if (!subscription) {
    subscription = await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY),
    });
  }

  const raw = subscription.toJSON();
  const { error } = await supabase.from('push_subscriptions').upsert(
    {
      user_id: userId,
      endpoint: raw.endpoint,
      p256dh_key: raw.keys.p256dh,
      auth_key: raw.keys.auth,
    },
    { onConflict: 'endpoint' }
  );
  if (error) throw error;

  return true;
}

// Désactive : supprime l'abonnement côté navigateur ET la ligne correspondante en base (les
// deux, sinon soit le navigateur croit encore être abonné, soit la base garde un abonnement mort
// que l'Edge Function tenterait d'appeler en vain à chaque nouveau message).
export async function unsubscribeFromPush() {
  if (!isPushSupported()) return;
  const registration = await navigator.serviceWorker.ready;
  const subscription = await registration.pushManager.getSubscription();
  if (!subscription) return;

  const endpoint = subscription.endpoint;
  await subscription.unsubscribe();
  await supabase.from('push_subscriptions').delete().eq('endpoint', endpoint);
}
