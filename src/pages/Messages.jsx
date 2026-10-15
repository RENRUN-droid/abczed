import { useState, useEffect, useRef } from 'react';
import { ArrowLeft, Shield, Paperclip, Smile, SmilePlus, Mic, Send, Link2, X, FileText, Image, Search, ExternalLink, Download, Pencil, Trash2, Reply } from 'lucide-react';
import { BLUE, RED, INK, MUTED, CARD_BORDER, SECTION_THEMES, FONT_DISPLAY } from '../theme';
// V7.7 (P4) : `linkableEvents` (data.js, MOCK_EVENTS) n'est plus importé ici — le choix d'un
// événement réel à lier vient désormais de la prop `events` (Agenda réel, transmise par
// App.jsx), filtrée localement dans LinkEventPicker ci-dessous (exclusion des anniversaires,
// même règle qu'avant, appliquée à la vraie liste). TODAY_ISO reste utilisé tel quel (calcul
// des séparateurs de date, sans rapport avec la source des messages).
import { TODAY_ISO } from '../data';
import { computeVisibleMessages } from '../messageSearch';
import { useScrollRestore } from '../useScrollRestore';
import { prefersReducedMotion, supportsHoverPointer, afterPaint } from '../motionPrefs';
import { useModalA11y } from '../useModalA11y';
import { reactionSummary, REACTION_EMOJIS } from '../reactions';
import { openableCardProps } from '../attachmentCardA11y';
// V7.61 (1er oct.) — trombone activé : limite de taille partagée avec messagesApi.sendMessage
// (même valeur des deux côtés, jamais deux plafonds qui pourraient diverger).
import { MAX_MESSAGE_FILE_BYTES } from '../messagesApi';
import ActionButton from '../components/ActionButton';
import ConfirmDialog from '../components/ConfirmDialog';
import Avatar from '../components/Avatar';
// V7.8 : `dateSeparatorLabel` était définie ici en local — désormais extraite dans
// ../dateLabels.js et PARTAGÉE avec Accueil.jsx (dernier message), qui ne calculait avant ce
// lot aucune étiquette réelle du tout (voir ../dateLabels.js pour le détail du bug corrigé).
import { dateSeparatorLabel } from '../dateLabels.js';
import { MESSAGES_FROM_SUPABASE } from '../dataSourceFlags';
import CompactHeader from '../components/CompactHeader';
import PageTitle from '../components/PageTitle';

// V7.61 (1er oct.) — mêmes helpers que AddShareSheet.jsx (formatBytes) et même heuristique que
// nécessaire ici spécifiquement : un message n'a qu'UN SEUL trombone (contrairement à Partages,
// qui a des tuiles Fichier/Photo séparées) — rien ne distingue une image d'un document autre
// que l'extension de son nom réel, utilisée uniquement pour choisir l'aperçu (miniature vs
// carte avec icône), jamais pour restreindre la sélection elle-même (voir le champ fichier
// plus bas : volontairement SANS attribut `accept`, pour ne pas reproduire le bug Android confirmé
// en V7.55 — combiner `image/*` et des extensions de documents dans un même `accept` fait
// qu'Android ne propose plus que "Appareil photo"/"Galerie", plus aucun moyen d'atteindre
// l'explorateur de fichiers).
function formatBytes(n) {
  if (n == null) return '';
  if (n < 1024) return `${n} o`;
  if (n < 1024 * 1024) return `${Math.round(n / 1024)} Ko`;
  return `${(n / (1024 * 1024)).toFixed(1)} Mo`;
}
function isImageAttachment(name) {
  return /\.(jpe?g|png|gif|webp|heic|heif|bmp|svg)$/i.test(name || '');
}

export default function Messages({
  thread, onSend, onLinkMessage, onToggleReaction, onEditMessage, onDeleteMessage, linkedEvent, onBackToEvent, onExitFiltered, onOpenEventFromTag, events,
  searchQuery, onSearchChange,
  highlightMessageId, onHighlightConsumed,
  cameFromAccueil, onBackToAccueil,
  restoreState, onRestoreConsumed,
  // V7.7 (P2/P3/P4) : `currentUserId` remplace le MY_USER_ID/ME figés en dur — vient de la
  // session réelle (App.jsx, `session.user.id`). `isAdmin` (rôle réel de la communauté active)
  // et `currentUserId` gouvernent ensemble qui peut lier un message à un événement (P4).
  // `messagesLoading`/`messagesError` sont des états DÉDIÉS à Messages (distincts de ceux de
  // l'Agenda) — jamais un repli silencieux vers une donnée de démonstration en cas d'erreur.
  currentUserId, isAdmin, messagesLoading, messagesError,
  // V7.11 (P1) : quels messages ont une réaction en vol (Set de messageId) — le contrôle de
  // réaction concerné se désactive tant que son id y figure. Voir App.jsx, `toggleMessageReaction`,
  // pour le contrat pessimiste complet.
  reactionPendingIds, messageMutationPendingIds, focusComposerToken,
  // V7.11 (P1) : en-tête compact (logo + avatar connecté), affiché uniquement dans la vue
  // "thread" (`linkedEvent` vrai) — la vue "messages" non filtrée garde l'en-tête principal de
  // App.jsx, déjà affiché au-dessus de ce composant dans ce cas.
  connectedUserId, connectedDisplayName, connectedA
