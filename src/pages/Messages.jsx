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
import { prefersReducedMotion, supportsHoverPointer } from '../motionPrefs';
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
  connectedUserId, connectedDisplayName, connectedAvatarPath, onOpenProfile,
}) {
  const [text, setText] = useState('');
  // P3 : désactive le champ/le bouton d'envoi le temps de l'écriture en vol (évite un double
  // envoi sur double clic ou Entrée+clic quasi simultanés) — état purement local, symétrique au
  // contrat de retour (boolean) exposé par `onSend`.
  const [sending, setSending] = useState(false);
  const [linkPickerFor, setLinkPickerFor] = useState(null);
  const [flashId, setFlashId] = useState(null);
  // Brief pts 26-28 : quel message a son sélecteur d'émoji ouvert — un seul à la fois, jamais
  // lié à `flashId`/`linkPickerFor` (préoccupations indépendantes).
  const [reactionPickerFor, setReactionPickerFor] = useState(null);
  const [editingMessage, setEditingMessage] = useState(null);
  // Item 8 : remplace window.confirm() (natif navigateur, jamais un vrai composant ABCZed) —
  // id du message dont la suppression est en cours de confirmation, ou null.
  const [confirmingDeleteId, setConfirmingDeleteId] = useState(null);
  // V7.39 (25 sept.) — "glisser un message pour y répondre" (demande explicite de
  // l'utilisatrice, observation de Soizic) : `replyingTo` est le message ciblé, attaché à la
  // réponse en cours de rédaction (bandeau au-dessus du compositeur, citation envoyée avec le
  // message — voir messagesApi.js/App.jsx#sendMessage). Le glisser lui-même reste UNIQUEMENT
  // un raccourci tactile : le bouton "Répondre" (sur chaque message, voir plus bas) fait
  // exactement la même chose et reste le seul moyen pour qui n'utilise pas d'écran tactile ou
  // ne découvre jamais le geste — jamais de fonctionnalité accessible uniquement par un geste.
  const [replyingTo, setReplyingTo] = useState(null);
  // V7.61 (1er oct.) — trombone activé : fichier choisi en attente d'envoi (objet File réel),
  // attaché au PROCHAIN message envoyé (même patron que `replyingTo` juste au-dessus — un
  // bandeau au-dessus du compositeur, effacé seulement après un envoi réussi). `pendingFileError`
  // distinct de `messagesError` (qui reste réservé aux échecs réseau réels) : une taille
  // dépassée est détectée localement, AVANT toute tentative d'envoi, jamais découverte après
  // coup via un échec d'upload.
  const [pendingFile, setPendingFile] = useState(null);
  const [pendingFileError, setPendingFileError] = useState('');
  // V7.63 (1er oct.) — aperçu miniature de la pièce jointe en attente (demande explicite après
  // test réel sur le trombone V7.62 : "ça serait pas mal d'avoir un petit aperçu... plutôt que
  // le nom du fichier"). URL locale uniquement (jamais envoyée nulle part), voir l'effet plus
  // bas qui la crée/révoque.
  const [pendingFilePreviewUrl, setPendingFilePreviewUrl] = useState(null);
  // V7.62 (1er oct.) — bug réel confirmé en recette (captures d'écran à l'appui) : un seul
  // champ fichier SANS attribut `accept` (V7.61) faisait afficher par Android un sélecteur à 3
  // entrées ("Appareil photo"/"Caméscope"/"Photos et vidéos"), dont la 3e — censée ouvrir la
  // galerie — atterrissait en réalité sur un navigateur de fichiers générique (Téléchargements,
  // dernier dossier visité), jamais sur la pellicule photo. Remplacé par DEUX champs fichier
  // distincts, repris tels quels des deux champs DÉJÀ confirmés fonctionner sur ce même
  // téléphone (AddShareSheet.jsx, V7.55/V7.58) : `accept` pour documents SEUL (jamais combiné à
  // `image/*`, cause racine du tout premier bug Android confirmé, V7.55) et `accept="image/*,
  // video/*"` SEUL pour photo/vidéo (même principe que le champ Photo de Partages, qui affiche
  // bien le sélecteur standard appareil photo + galerie une fois `capture` retiré, V7.58).
  // Taper le trombone ouvre un petit choix (Fichier / Photo ou vidéo, popover léger — même
  // patron que le sélecteur de réaction plus haut, PAS une modale) plutôt que d'ouvrir
  // directement un sélecteur unique qui ne peut plus, de toute façon, couvrir les deux à la fois
  // sans revenir au bug ci-dessus.
  const [attachMenuOpen, setAttachMenuOpen] = useState(false);
  const attachMenuRef = useRef(null);
  const fileInputRef = useRef(null);
  const mediaInputRef = useRef(null);
  // `dragMessageId`/`dragX` pilotent UNIQUEMENT le retour visuel pendant le glisser (décalage
  // horizontal + icône qui apparaît en fondu) — `dragRef` (une seule instance, pas un state)
  // porte l'état de geste en cours entre onPointerDown/Move/Up, jamais recréé par un re-rendu.
  const [dragMessageId, setDragMessageId] = useState(null);
  const [dragX, setDragX] = useState(0);
  const dragRef = useRef({ id: null, startX: 0, startY: 0, active: false });
  const rowRefs = useRef({});
  const searchInputRef = useRef(null);
  const composerInputRef = useRef(null);
  const reactionPopoverRef = useRef(null);
  // Retour utilisateur réel (recette V7.16 sur poste réel) : après suppression d'un message,
  // l'espace qu'il occupait pouvait rester visuellement vide — les messages suivants ne
  // remontaient pas à l'écran, alors que la position RÉELLE dans le document (mesurée
  // programmatiquement, indépendamment du défilement) montre que la remontée a bien lieu et
  // que la hauteur totale de la page diminue bien de la hauteur du message supprimé. Confirmé
  // non reproductible dans le harnais Playwright (même famille de défaut que "retour en haut
  // de page" déjà documenté dans useScrollRestore.js — jamais reproduit non plus hors usage
  // réel) : tout pointe vers un défaut de réaffichage du compositeur du navigateur (un repaint
  // manqué de la zone libérée), pas une erreur de mise en page. `listRef` cible le conteneur
  // qui grandit/rétrécit avec le nombre de messages ; l'effet ci-dessous force ce conteneur à
  // sortir puis rentrer de sa propre couche de composition juste après un changement du nombre
  // de messages, ce qui oblige le navigateur à redessiner réellement la zone concernée plutôt
  // que de garder un rendu périmé — filet de sécurité défensif, sans incidence sur les données
  // ni sur aucune assertion existante (aucune suite de recette ne teste le rendu pixel par
  // pixel de cette zone).
  const listRef = useRef(null);

  // Delta §2.2/§14/§26 : restaure le scroll + le focus sur le lien qui avait ouvert
  // l'événement — la recherche elle-même était déjà conservée (état levé dans App.jsx).
  useScrollRestore(restoreState, onRestoreConsumed);

  // V7.12 — l'action rapide de l'Accueil ouvre Messages ET place immédiatement le curseur
  // dans le compositeur. Le jeton change à chaque demande, y compris si l'écran Messages était
  // déjà monté lors d'une navigation précédente.
  useEffect(() => {
    if (!focusComposerToken) return;
    const frame = requestAnimationFrame(() => composerInputRef.current?.focus());
    return () => cancelAnimationFrame(frame);
  }, [focusComposerToken]);

  // Brief §21 : recherche contextuelle — contenu, auteur, nom de pièce jointe, évènement lié
  // (delta §12, avec le VRAI titre de l'évènement désormais, pas seulement par coïncidence
  // textuelle) et date du message (delta §13 : "24 mai", "24/05", "24/05/2026", "hier",
  // "aujourd'hui"...). Seulement sur le fil complet (pas dans la vue déjà filtrée par
  // événement, qui a sa propre raison d'être). computeVisibleMessages est la même fonction
  // que scripts/test-deep-link-visibility.mjs et scripts/test-date-search.mjs exercent, pas
  // une copie de la logique.
  const q = (searchQuery || '').trim();
  const visible = computeVisibleMessages(thread, linkedEvent, q, events, TODAY_ISO);

  // Brief §22 : séparateurs Aujourd'hui / Hier / date complète, sans répéter une date
  // complète sous chaque message — un séparateur chaque fois que le jour change.
  let lastDate = null;

  // Brief §7/§24 : lien profond depuis l'Accueil — on scrolle jusqu'au message ciblé et on le
  // surligne brièvement, une seule fois, puis on prévient App.jsx que c'est consommé.
  useEffect(() => {
    if (!highlightMessageId) return;
    const el = rowRefs.current[highlightMessageId];
    const reduced = prefersReducedMotion();
    if (el) el.scrollIntoView({ behavior: reduced ? 'auto' : 'smooth', block: 'center' });
    // 7e passe (brief pt 1) : pas de flash visuel imposé si l'utilisateur a demandé moins
    // de mouvement — le scroll instantané suffit à amener le message dans le viewport.
    if (!reduced) setFlashId(highlightMessageId);
    const t1 = setTimeout(() => setFlashId(null), 2000);
    const t2 = setTimeout(() => onHighlightConsumed(), 50);
    return () => { clearTimeout(t1); clearTimeout(t2); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [highlightMessageId]);

  // Le sélecteur d'émoji (popover léger, pas une modale) se ferme sur Escape ou sur tout clic
  // ailleurs dans la page — cohérent avec le mécanisme d'accessibilité générique des modales
  // (useModalA11y) sans en être une : il n'a pas de piège de focus, juste une fermeture sûre.
  // `reactionPopoverRef` (posé sur le popover actuellement ouvert) permet d'ignorer les clics
  // À L'INTÉRIEUR du popover — sinon le mousedown qui précède le clic sur un émoji fermerait
  // le popover avant que ce clic n'atteigne son bouton, et aucun émoji ne serait jamais choisi.
  useEffect(() => {
    if (!reactionPickerFor) return;
    function handlePointer(e) {
      if (reactionPopoverRef.current && reactionPopoverRef.current.contains(e.target)) return;
      setReactionPickerFor(null);
    }
    function handleKey(e) { if (e.key === 'Escape') setReactionPickerFor(null); }
    document.addEventListener('mousedown', handlePointer);
    document.addEventListener('keydown', handleKey);
    return () => {
      document.removeEventListener('mousedown', handlePointer);
      document.removeEventListener('keydown', handleKey);
    };
  }, [reactionPickerFor]);

  // V7.62 — même mécanisme de fermeture que le sélecteur de réaction ci-dessus (clic ailleurs
  // ou Echap), appliqué au petit menu Fichier/Photo ou vidéo du trombone.
  useEffect(() => {
    if (!attachMenuOpen) return;
    function handlePointer(e) {
      if (attachMenuRef.current && attachMenuRef.current.contains(e.target)) return;
      setAttachMenuOpen(false);
    }
    function handleKey(e) { if (e.key === 'Escape') setAttachMenuOpen(false); }
    document.addEventListener('mousedown', handlePointer);
    document.addEventListener('keydown', handleKey);
    return () => {
      document.removeEventListener('mousedown', handlePointer);
      document.removeEventListener('keydown', handleKey);
    };
  }, [attachMenuOpen]);

  // Filet de sécurité repaint (voir le commentaire sur `listRef` ci-dessus) — déclenché à
  // chaque changement du NOMBRE de messages (envoi, suppression, ou écho Realtime d'une
  // suppression faite par quelqu'un d'autre : les trois cas peuvent laisser le même vide
  // visuel). `transform` plutôt que `display`/`visibility` : sort le conteneur de sa couche de
  // composition puis l'y remet sans provoquer le moindre flash visible (aucun changement de
  // taille ni de position, juste un aller-retour de propriété), assez pour forcer le
  // navigateur à redessiner réellement la zone plutôt que de garder un rendu périmé.
  useEffect(() => {
    const el = listRef.current;
    if (!el) return;
    const frame = requestAnimationFrame(() => {
      el.style.transform = 'translateZ(0)';
      // Lecture forcée de layout entre les deux écritures : sans elle, le navigateur pourrait
      // fusionner les deux changements de style et n'en tirer aucun redessin réel.
      void el.offsetHeight;
      el.style.transform = '';
    });
    return () => cancelAnimationFrame(frame);
  }, [thread.length]);

  // V7.7 (P3) : async, attend réellement la persistance avant de vider le champ — contrat de
  // retour explicite avec App.jsx (`onSend` renvoie `true` seulement si le message a bien été
  // enregistré). Sur échec, le texte reste dans le champ tel quel (rien n'est perdu, l'erreur
  // réelle est déjà affichée via `messagesError`) plutôt qu'effacé à tort. Enter et le bouton
  // Envoyer empruntent tous deux ce même chemin (onKeyDown/onClick ci-dessous), jamais deux
  // logiques distinctes qui pourraient diverger.
  //
  // V7.39 — `replyToId` part avec le message si une réponse était en cours d'attache ; effacé
  // seulement après un envoi RÉUSSI (`ok`), même logique que `text` juste au-dessus — un échec
  // réseau ne doit jamais faire disparaître silencieusement la citation en cours.
  // V7.61 — un message peut désormais partir avec UNIQUEMENT une pièce jointe, sans texte
  // (`text.trim() || pendingFile`, plus seulement `text.trim()`) — une photo n'a pas besoin de
  // légende pour être envoyée.
  async function submit() {
    if ((!text.trim() && !pendingFile) || sending) return;
    setSending(true);
    const ok = await onSend({
      text: text.trim(),
      linkedEventId: linkedEvent ? linkedEvent.id : null,
      replyToId: replyingTo ? replyingTo.id : null,
      file: pendingFile,
    });
    setSending(false);
    if (ok) { setText(''); setReplyingTo(null); setPendingFile(null); setPendingFileError(''); }
  }

  // V7.61 — sélection d'une pièce jointe. `e.target.value = ''` permet de resélectionner le
  // MÊME fichier une seconde fois après l'avoir retiré (sinon le navigateur ne redéclenche pas
  // `onChange` pour une sélection identique à la précédente).
  function handleAttachmentChange(e) {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    if (file.size > MAX_MESSAGE_FILE_BYTES) {
      setPendingFileError(`Fichier trop volumineux (maximum ${formatBytes(MAX_MESSAGE_FILE_BYTES)}).`);
      setPendingFile(null);
      return;
    }
    setPendingFileError('');
    setPendingFile(file);
  }
  function removePendingFile() {
    setPendingFile(null);
    setPendingFileError('');
  }

  // V7.63 — crée l'URL locale d'aperçu (URL.createObjectURL) uniquement pour une image (même
  // heuristique `isImageAttachment` que le rendu d'une pièce jointe déjà envoyée, plus haut
  // dans ce fichier) ; un document garde seulement son icône, aucun aperçu n'aurait de sens.
  // Révoquée à chaque changement de fichier ET au démontage — sinon chaque sélection/annulation
  // répétée fuiterait un objet mémoire jamais libéré.
  useEffect(() => {
    if (!pendingFile || !isImageAttachment(pendingFile.name)) {
      setPendingFilePreviewUrl(null);
      return;
    }
    const url = URL.createObjectURL(pendingFile);
    setPendingFilePreviewUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [pendingFile]);

  // V7.52 (30 sept.) — le compositeur était un <input> classique : jamais de retour à la ligne,
  // même quand le texte dépasse visuellement la largeur du champ — signalé par l'utilisatrice en
  // testant l'envoi d'un message un peu long ("je suis obligé de faire défiler mon curseur").
  // Remplacé par un <textarea> qui grandit avec le contenu (jusqu'à ~5 lignes, puis défilement
  // interne), même principe que EditMessageSheet plus bas dans ce fichier mais avec une hauteur
  // dynamique plutôt que fixe (`rows={4}`) — ce champ démarre sur UNE ligne comme avant, il ne
  // doit pas occuper de place tant qu'on n'a rien écrit de long. Entrée envoie toujours le
  // message (comportement inchangé) ; Maj+Entrée insère un retour à la ligne manuel (nouveau,
  // gratuit avec un textarea — un <input> ne pouvait de toute façon jamais le faire).
  const composerMaxHeight = 120; // ~5 lignes à cette taille de police, au-delà : défilement interne
  useEffect(() => {
    const el = composerInputRef.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = `${Math.min(el.scrollHeight, composerMaxHeight)}px`;
  }, [text]);

  // Réutilise EXACTEMENT le mécanisme déjà en place pour les liens profonds depuis l'Accueil
  // (scroll + flash 2s, voir l'effet `highlightMessageId` plus haut) — tapoter la citation d'un
  // message ramène à son origine dans le fil, cohérent avec un comportement déjà connu du reste
  // de l'appli plutôt qu'un mécanisme visuel différent inventé pour cette seule occasion.
  function scrollToMessage(id) {
    const el = rowRefs.current[id];
    if (!el) return;
    el.scrollIntoView({ behavior: prefersReducedMotion() ? 'auto' : 'smooth', block: 'center' });
    setFlashId(id);
    setTimeout(() => setFlashId((cur) => (cur === id ? null : cur)), 2000);
  }

  function startReply(m) {
    setReplyingTo(m);
    requestAnimationFrame(() => composerInputRef.current?.focus());
  }

  // V7.39 — glisser un message pour répondre. Pointer events (pas Touch events) : un seul jeu
  // de gestionnaires couvre tactile ET souris, sans détection de plateforme. `dragRef.current`
  // (pas un state) porte l'état du geste EN COURS entre les trois callbacks : le re-créer à
  // chaque rendu casserait le suivi d'un même geste. Un mouvement est ignoré tant que sa
  // direction n'est pas clairement établie (`Math.abs(dx) < 12 && Math.abs(dy) < 12`), puis
  // ABANDONNÉ s'il s'avère plus vertical qu'horizontal (`Math.abs(dy) > Math.abs(dx)`) — pour ne
  // jamais interférer avec le défilement normal du fil, qui reste prioritaire. Le glisser
  // fonctionne dans les deux sens (gauche ou droite), sur n'importe quel message (le sien ou
  // celui d'un autre) : pas de sens unique imposé, contrairement à certaines appli de
  // messagerie — plus simple à découvrir sans mode d'emploi.
  function handlePointerDown(e, m) {
    dragRef.current = { id: m.id, startX: e.clientX, startY: e.clientY, active: false };
  }
  function handlePointerMove(e, m) {
    const st = dragRef.current;
    if (st.id !== m.id) return;
    const dx = e.clientX - st.startX;
    const dy = e.clientY - st.startY;
    if (!st.active) {
      if (Math.abs(dx) < 12 && Math.abs(dy) < 12) return;
      if (Math.abs(dy) > Math.abs(dx)) { st.id = null; return; }
      st.active = true;
      setDragMessageId(m.id);
    }
    setDragX(Math.max(-72, Math.min(72, dx)));
  }
  function handlePointerEnd(m) {
    const st = dragRef.current;
    if (st.id === m.id && st.active && Math.abs(dragX) > 48) startReply(m);
    dragRef.current = { id: null, startX: 0, startY: 0, active: false };
    setDragMessageId(null);
    setDragX(0);
  }

  return (
    <div style={{ paddingBottom: 140, '--section-accent': SECTION_THEMES.messages.color }}>
      {/* V7.11 (P1) : en-tête compact (logo ABCZed + avatar connecté) — défaut confirmé en UAT
          réelle, les deux disparaissaient entièrement sur la vue "discussion liée". Uniquement
          ici (linkedEvent vrai) : la vue Messages générale garde déjà l'en-tête principal de
          App.jsx. Voir src/components/CompactHeader.jsx : le bouton "Retour" juste en dessous
          (déjà existant) complète ce bandeau, jamais dupliqué ici. */}
      {linkedEvent && (
        <CompactHeader currentUserId={connectedUserId} displayName={connectedDisplayName} avatarPath={connectedAvatarPath} onOpenProfile={onOpenProfile} />
      )}
      <div style={{ padding: '18px 20px 0' }}>
        {linkedEvent ? (
          // Delta §3 : header de détail à 3 zones (fleche à gauche de largeur fixe, titre
          // mathématiquement centré au milieu, zone droite symétrique de réserve) — "tous les
          // écrans secondaires/détaillés actuels et futurs", donc aussi cette mini-vue filtrée
          // de Messages, pas seulement EventDetail/MemberDetail.
          <div style={{ display: 'grid', gridTemplateColumns: '44px 1fr 44px', alignItems: 'center', marginBottom: 12 }}>
            {/* 6e passe (point 2) : revient à la fiche événement qui a ouvert cette discussion —
                distinct de "Voir tout le fil" ci-dessous, qui quitte réellement le filtre. */}
            <button onClick={onBackToEvent} aria-label="Retour" className="tap-surface icon-button" style={{ background: 'none', border: 'none' }}>
              <ArrowLeft size={20} color={INK} />
            </button>
            <div style={{ textAlign: 'center', overflow: 'hidden' }}>
              <div style={{ fontSize: 15, fontWeight: 700, fontFamily: FONT_DISPLAY, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{linkedEvent.title}</div>
              <div style={{ fontSize: 11.5, opacity: 0.6 }}>Discussion liée</div>
            </div>
            <span aria-hidden="true" />
          </div>
        ) : (
          <>
            {/* Brief §24 : arrivé ici via un lien profond depuis l'Accueil, un vrai moyen de
                revenir doit exister — pas seulement la navigation du bas. */}
            {cameFromAccueil && (
              <button id="back-to-accueil" onClick={onBackToAccueil} style={{ display: 'flex', alignItems: 'center', gap: 6, background: 'none', border: 'none', color: BLUE, fontSize: 13, fontWeight: 600, padding: 0, marginBottom: 10 }}>
                <ArrowLeft size={16} /> Accueil
              </button>
            )}
            <PageTitle section="messages">Messages</PageTitle>

            {/* Recherche contextuelle (brief §1/§21) — même grille que les autres pages. */}
            <div className="search-field" style={{ display: 'flex', alignItems: 'center', gap: 8, background: '#FFFFFF', border: `1px solid ${CARD_BORDER}`, borderRadius: 999, marginBottom: 14 }}>
              <Search size={16} color={MUTED} />
              <input
                ref={searchInputRef}
                value={searchQuery}
                onChange={(e) => onSearchChange(e.target.value)}
                placeholder="Mot, personne, événement ou date…"
                style={{ flex: 1, border: 'none', outline: 'none', fontSize: 13.5, background: 'transparent' }}
              />
              {searchQuery && (
                <button type="button" onClick={() => { onSearchChange(''); searchInputRef.current?.focus(); }} aria-label="Effacer la recherche" className="tap-surface icon-button" style={{ background: 'none', border: 'none', flexShrink: 0 }}>
                  <X size={14} color={MUTED} />
                </button>
              )}
            </div>
          </>
        )}

        <div style={{ display: 'flex', alignItems: 'center', gap: 8, background: SECTION_THEMES.messages.tint, borderRadius: 10, padding: '9px 12px', marginBottom: 14, fontSize: 12 }}>
          <Shield size={14} color={SECTION_THEMES.messages.color} style={{ flexShrink: 0 }} />
          {linkedEvent ? (
            <span>Vous voyez ici uniquement les messages liés à cet événement. <button onClick={onExitFiltered} style={{ background: 'none', border: 'none', color: BLUE, fontWeight: 700, padding: 0 }}>Voir tout le fil</button></span>
          ) : MESSAGES_FROM_SUPABASE ? (
            // V7.7 (P2) : correctif d'un vrai décalage repéré en relisant ce bandeau — ce texte
            // dépendait jusqu'ici de BUSINESS_DATA_FROM_SUPABASE (qui gouverne Partages/La
            // Bande, jamais Messages), pas du drapeau qui gouverne réellement CE module. Texte
            // exact du brief — "Les messages sont visibles uniquement par les membres du
            // groupe." — affiché uniquement quand les messages réels sont actifs.
            <span>Les messages sont visibles uniquement par les membres du groupe.</span>
          ) : (
            // Repli conservé pour le cas — hors périmètre normal de ce lot, MESSAGES_FROM_SUPABASE
            // est figé à true — où ce drapeau serait un jour repassé à false : jamais promettre
            // une confidentialité par groupe qui ne serait pas réellement appliquée.
            <span>Messages de démonstration — identiques pour toutes les communautés tant que ce module n'est pas encore connecté à Supabase. Aucune restriction de visibilité réelle n'est appliquée pour l'instant.</span>
          )}
        </div>

        {/* P1/P2 : états dédiés Messages — jamais confondus avec ceux de l'Agenda. Une erreur
            réelle reste affichée telle quelle (jamais de repli silencieux vers une donnée de
            démonstration), le chargement initial n'affiche aucun message tant qu'il est en
            cours (pas de flash d'état vide trompeur). */}
        {messagesError && (
          <div style={{ background: '#FCE9E7', border: '1px solid #D9463033', borderRadius: 10, padding: '8px 12px', marginBottom: 14, fontSize: 12, color: '#8A2E1F' }}>
            {messagesError}
          </div>
        )}
      </div>

      {messagesLoading ? (
        <p style={{ textAlign: 'center', padding: 40, opacity: 0.5, fontSize: 13 }}>Chargement des messages…</p>
      ) : (
      <div ref={listRef} style={{ padding: '0 20px', display: 'flex', flexDirection: 'column', gap: 4 }}>
        {visible.length === 0 && (
          <p style={{ fontSize: 13, opacity: 0.5, textAlign: 'center', marginTop: 24 }}>
            {/* P2 : état vide à trois formulations distinctes, jamais la même pour ces trois cas
                différents — recherche sans résultat, discussion liée sans message, fil général
                réellement vide (texte exact du brief : "Aucun message pour le moment."). */}
            {q ? `Aucun résultat pour « ${q} ».` : linkedEvent ? 'Aucun message lié à cet événement pour l\'instant.' : 'Aucun message pour le moment.'}
          </p>
        )}
        {visible.map((m) => {
          // Pas de répétition de date complète sous chaque message : un séparateur
          // seulement quand le jour change par rapport au message précédent affiché.
          const showSeparator = m.date !== lastDate;
          lastDate = m.date;
          // V7.7 (P2) : `authorId` (uuid réel, résolu par messagesApi.fetchMessages) comparé à
          // `currentUserId` (session réelle) — plus de comparaison sur `ME`/un nom affiché, qui
          // pouvait de toute façon coïncider par hasard entre deux membres différents.
          const isMine = m.authorId === currentUserId;
          // V7.11 (P1) : ce message a-t-il une réaction en vol ? Désactive le contrôle de
          // réaction CONCERNÉ (pastilles existantes + bouton "Ajouter une réaction" + menu de
          // choix) pendant ce temps — jamais les autres messages, `reactionPendingIds` est un
          // Set indexé par messageId, pas un booléen global (voir App.jsx).
          const reactionPending = Boolean(reactionPendingIds && reactionPendingIds.has(m.id));
          const mutationPending = Boolean(messageMutationPendingIds && messageMutationPendingIds.has(m.id));
          const dragging = dragMessageId === m.id;
          return (
            <div key={m.id}>
              {showSeparator && (
                <div style={{ textAlign: 'center', fontSize: 11, fontWeight: 700, color: MUTED, margin: '14px 0 10px', textTransform: 'uppercase', letterSpacing: 0.3 }}>
                  {dateSeparatorLabel(m.date)}
                </div>
              )}
              {/* V7.39 — conteneur relatif dédié au glisser : l'icône "Répondre" apparaît en
                  fondu DERRIÈRE le message pendant le glisser (révélée par le décalage), centrée
                  sur toute la largeur de la liste plutôt que sur la bulle elle-même (qui peut
                  être ancrée à gauche ou à droite selon `isMine`) — repère visuel simple, pas de
                  calcul de position dépendant du sens du glisser. */}
              <div style={{ position: 'relative' }}>
                {dragging && (
                  <div aria-hidden="true" style={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)', color: BLUE, opacity: Math.min(1, Math.abs(dragX) / 48), pointerEvents: 'none' }}>
                    <Reply size={22} />
                  </div>
                )}
              <div
                id={`msg-row-${m.id}`}
                ref={(el) => { rowRefs.current[m.id] = el; }}
                onPointerDown={(e) => handlePointerDown(e, m)}
                onPointerMove={(e) => handlePointerMove(e, m)}
                onPointerUp={() => handlePointerEnd(m)}
                onPointerCancel={() => handlePointerEnd(m)}
                style={{
                  display: 'flex', gap: 10, marginBottom: 14,
                  position: 'relative', touchAction: 'pan-y',
                  transform: dragging ? `translateX(${dragX}px)` : undefined,
                  // Brief §23 : jamais d'alternance décorative gauche/droite entre tous les
                  // parents — un fil collectif, pas un chat privé. Seuls MES messages ont un
                  // léger décalage/fond distinct ; les autres restent en cascade à gauche.
                  flexDirection: isMine ? 'row-reverse' : 'row',
                  // Item 7 (correctif UAT phase 3) : `marginLeft: 40` seul ne faisait qu'INDENTER
                  // le bloc de 40px depuis le bord gauche. Cause réelle, confirmée en mesurant
                  // la bounding box réelle en navigateur (pas seulement en lisant le CSS) : ce
                  // conteneur flex, en `display:flex` block-level SANS largeur explicite, se
                  // comporte comme un bloc normal et REMPLIT toute la largeur disponible (pas de
                  // "shrink-to-fit" ici, contrairement à un flex container flottant/inline) — donc
                  // `marginLeft: auto` seul n'avait RIEN à absorber (la largeur valait déjà 100%
                  // des deux côtés, mine et non-mine mesuraient exactement la même boîte). Le
                  // contenu (avatar/bulle/réactions/horodatage) n'est pas touché — uniquement le
                  // dimensionnement/positionnement du conteneur : `width: 'fit-content'` fait
                  // reprendre au bloc la largeur de son contenu réel (avatar + bulle), plafonnée à
                  // 86% pour un message très long, et `marginLeft: 'auto'` peut alors réellement
                  // pousser ce bloc, désormais plus étroit que son conteneur, jusqu'au bord droit.
                  width: 'fit-content',
                  maxWidth: '86%',
                  marginLeft: isMine ? 'auto' : 0,
                  background: flashId === m.id ? '#FFF4D2' : 'transparent',
                  borderRadius: 12,
                  // V7.39 — les deux transitions coexistent désormais sur cette même règle : le
                  // fondu de fond (flash de mise en évidence, inchangé depuis avant ce lot) reste
                  // toujours actif ; le glissement horizontal n'en a PAS pendant le geste lui-même
                  // (suit le doigt sans latence), mais retrouve une transition douce ('transform
                  // 0.2s') dès le relâchement, pour l'animation de retour à zéro.
                  transition: dragging ? 'background 0.4s' : 'background 0.4s, transform 0.2s',
                }}
              >
                {/* V7.34 — Avatar partagé (composant) : vraie photo si mise (m.avatarUrl,
                    messagesApi.js), sinon exactement le même cercle couleur+initiale qu'avant. */}
                <Avatar avatarPath={m.avatarUrl} color={m.color} initials={m.initials} size={30} />

                <div style={{ flex: 1, minWidth: 0 }}>
                  {/* V7.11 (P2) — défaut confirmé en UAT réelle : les messages de l'utilisateur
                      connecté affichaient son display_name réel comme n'importe quel autre
                      membre, jamais "Vous". Uniquement SES PROPRES messages (`isMine`) — tous
                      les autres membres continuent d'afficher leur display_name réel, exactement
                      comme avant, jamais un UUID brut. */}
                  <div style={{ fontSize: 12.5, fontWeight: 700, color: BLUE, textAlign: isMine ? 'right' : 'left' }}>{isMine ? 'Vous' : m.author}</div>
                  <div style={{
                    background: isMine ? '#EAF1FB' : '#FFFFFF', border: `1px solid ${CARD_BORDER}`,
                    borderRadius: isMine ? '12px 2px 12px 12px' : '2px 12px 12px 12px', padding: 10, marginTop: 3,
                  }}>
                    {/* V7.39 — citation du message auquel celui-ci répond, déjà résolue par
                        messagesApi.js (texte + auteur). Tapoter dessus ramène au message
                        d'origine dans le fil (`scrollToMessage`) — jamais de citation cassée :
                        si le message d'origine a depuis été supprimé, `m.replyTo` vaut `null`
                        (voir sql/14_reponses_message.sql, `on delete set null`) et ce bloc ne
                        s'affiche simplement pas. */}
                    {m.replyTo && (
                      <button
                        type="button"
                        onClick={() => scrollToMessage(m.replyTo.id)}
                        style={{
                          display: 'block', width: '100%', textAlign: 'left', cursor: 'pointer',
                          background: 'rgba(23,32,51,0.05)', border: 'none', borderLeft: `3px solid ${BLUE}`,
                          borderRadius: 6, padding: '4px 8px', marginBottom: 6,
                        }}
                      >
                        <div style={{ fontSize: 10.5, fontWeight: 700, color: BLUE }}>{m.replyTo.authorId === currentUserId ? 'Vous' : m.replyTo.author}</div>
                        <div style={{ fontSize: 11.5, color: MUTED, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{m.replyTo.text}</div>
                      </button>
                    )}
                    {m.text && <p style={{ fontSize: 16, margin: 0, lineHeight: 1.45, color: INK }}>{m.text}</p>}
                    {/* V7.61 (1er oct.) — pièce jointe RÉELLE (trombone), remplace l'ancien bloc
                        de démonstration (`m.fileId`/src/documents.js) : mort depuis que
                        MESSAGES_FROM_SUPABASE est figé à true (fetchMessages, messagesApi.js, ne
                        renvoie plus jamais `fileId`). Une image (heuristique sur l'extension du
                        nom réel, voir isImageAttachment ci-dessus) s'affiche en miniature
                        directement ; tout autre fichier garde la carte Ouvrir/Télécharger déjà
                        éprouvée sur Partages — même composant ActionButton, même garde-fou
                        `openableCardProps` (carte entière actionnable, pas seulement les deux
                        boutons). `fileUrl` peut valoir `null` (URL signée individuellement en
                        échec, voir messagesApi.fetchMessages) : la carte reste alors affichée
                        (nom/taille visibles) mais non actionnable — jamais un fichier qui
                        semblerait avoir disparu. */}
                    {m.fileName && (
                      isImageAttachment(m.fileName) && m.fileUrl ? (
                        <div
                          className="tap-container"
                          {...openableCardProps(m.fileUrl)}
                          style={{ borderRadius: 12, overflow: 'hidden', marginTop: m.text ? 8 : 0, cursor: 'pointer' }}
                        >
                          <img src={m.fileUrl} alt={m.fileName} style={{ display: 'block', width: '100%', maxHeight: 220, objectFit: 'cover' }} />
                        </div>
                      ) : (
                        <div className="tap-container" {...openableCardProps(m.fileUrl)} style={{ borderRadius: 12, padding: 4, marginTop: m.text ? 8 : 0, cursor: m.fileUrl ? 'pointer' : 'default' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                            <FileText size={18} color={BLUE} />
                            <div>
                              <div style={{ fontSize: 12.5, fontWeight: 600 }}>{m.fileName}</div>
                              {m.fileSize && <div style={{ fontSize: 10.5, opacity: 0.55 }}>{m.fileSize}</div>}
                            </div>
                          </div>
                          {m.fileUrl && (
                            <div style={{ display: 'flex', gap: 6, marginTop: 6 }}>
                              <ActionButton icon={ExternalLink} href={m.fileUrl} title="Ouvrir dans un nouvel onglet">Ouvrir</ActionButton>
                              <ActionButton icon={Download} href={m.fileUrl} download={m.fileName} title="Télécharger">Télécharger</ActionButton>
                            </div>
                          )}
                        </div>
                      )
                    )}
                  </div>
                  {/* V7.42 (25 sept.) — nouveau retour direct après capture d'écran réelle : le
                      premier essai (V7.41, deux rangées, la seconde alignée à gauche) créait en
                      fait un décalage visible entre les deux rangées pour SES PROPRES messages
                      (`isMine`) — la première restait alignée à DROITE (sous la bulle, ancrée à
                      droite de l'écran) tandis que la seconde (Modifier/Supprimer) était pourtant
                      bien à gauche : deux points d'ancrage différents sur deux lignes, d'où
                      l'impression de dispersion signalée ("ça prend encore un peu dispersé").
                      Demande précise cette fois, avec capture à l'appui : TOUT sur une seule
                      ligne, ancrée à GAUCHE en permanence (plus de `justifyContent: isMine ?
                      'flex-end' : 'flex-start'` — cette bascule selon l'auteur est justement ce
                      qui cassait l'alignement), juste sous la bulle, légèrement décrochée (pas
                      collée) mais pas éloignée. Modifier/Supprimer rejoignent donc cette même
                      rangée (temps/réactions/Répondre/Lier), au lieu d'une rangée séparée. */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 4, flexWrap: 'wrap', justifyContent: 'flex-start' }}>
                    <span style={{ fontSize: 10.5, opacity: 0.5 }}>{m.time}</span>
                    {/* V7.54 (30 sept.) — "qui a réagi" reposait uniquement sur title/aria-label
                        (survol souris ou lecteur d'écran) : invisible au doigt sur un
                        téléphone, où taper la pastille ajoute/retire directement SA PROPRE
                        réaction au lieu de révéler quoi que ce soit — aucun moyen de consulter
                        sans risquer de réagir soi-même par erreur. Signalé par l'utilisatrice
                        ("si je le fais en tapant sur l'emoji, ça ajoute mon emoji"). Corrigé en
                        affichant directement les prénoms sur la pastille plutôt que le chiffre
                        — visible d'un coup d'œil, sans aucune action requise ; groupe de taille
                        familiale, la liste reste courte. Le tap garde exactement le même
                        comportement qu'avant (ajoute/retire sa propre réaction) ; title/
                        aria-label conservés pour la souris/le clavier/les lecteurs d'écran. */}
                    {reactionSummary(m.reactions, currentUserId).map((r) => (
                      <button
                        key={r.emoji}
                        onClick={() => onToggleReaction(m.id, r.emoji)}
                        disabled={reactionPending}
                        title={`${r.people.join(', ')} — taper pour ${r.mine ? 'retirer' : 'ajouter'} votre réaction`}
                        aria-label={`${r.emoji} ${r.count} réaction${r.count > 1 ? 's' : ''} : ${r.people.join(', ')}`}
                        className={reactionPending ? undefined : 'tap-surface'}
                        style={{
                          minHeight: 32, fontSize: 11, borderRadius: 999, padding: '4px 9px', border: r.mine ? `1px solid ${BLUE}` : '1px solid transparent',
                          background: r.mine ? '#EAF1FB' : '#F4F0E6', color: r.mine ? BLUE : INK, fontWeight: r.mine ? 700 : 500,
                          cursor: reactionPending ? 'default' : 'pointer', opacity: reactionPending ? 0.55 : 1,
                          maxWidth: 220,
                        }}
                      >
                        {r.emoji} {r.people.join(', ')}
                      </button>
                    ))}
                    <span style={{ position: 'relative' }}>
                      <button
                        onClick={() => setReactionPickerFor(reactionPickerFor === m.id ? null : m.id)}
                        disabled={reactionPending}
                        aria-label="Ajouter une réaction"
                        title="Ajouter une réaction"
                        className={reactionPending ? undefined : 'tap-surface'}
                        style={{ minWidth: 36, minHeight: 36, background: 'none', border: 'none', padding: 0, borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center', color: MUTED, opacity: reactionPending ? 0.35 : 0.7, cursor: reactionPending ? 'default' : 'pointer' }}
                      >
                        <SmilePlus size={13} />
                      </button>
                      {reactionPickerFor === m.id && (
                        <div
                          ref={reactionPopoverRef}
                          role="menu"
                          aria-label="Choisir une réaction"
                          style={{
                            position: 'absolute', bottom: '120%', [isMine ? 'right' : 'left']: 0,
                            display: 'flex', gap: 2, background: '#fff', border: `1px solid ${CARD_BORDER}`,
                            borderRadius: 999, padding: '4px 6px', boxShadow: '0 4px 14px rgba(23,32,51,0.15)', zIndex: 5,
                          }}
                        >
                          {REACTION_EMOJIS.map((emoji) => (
                            <button
                              key={emoji}
                              role="menuitem"
                              disabled={reactionPending}
                              onClick={() => { onToggleReaction(m.id, emoji); setReactionPickerFor(null); }}
                              style={{ width: 40, height: 40, background: 'none', border: 'none', fontSize: 19, padding: 0, cursor: reactionPending ? 'default' : 'pointer', lineHeight: 1, opacity: reactionPending ? 0.5 : 1 }}
                            >
                              {emoji}
                            </button>
                          ))}
                        </div>
                      )}
                    </span>
                    {/* V7.39 — équivalent bouton du glisser, pour tout le monde : geste tactile
                        non découvrable sans indice pour qui ne l'essaie jamais, et strictement
                        indisponible au clavier/lecteur d'écran. Disponible sur TOUT message (le
                        sien ou celui d'un autre), contrairement à "Modifier"/"Lier à un
                        événement" réservés à l'auteur/l'admin — répondre n'a pas cette
                        restriction. */}
                    <button
                      onClick={() => startReply(m)}
                      className="tap-surface"
                      title="Répondre à ce message"
                      aria-label="Répondre à ce message"
                      style={{ fontSize: 10.5, color: MUTED, background: 'none', border: 'none', display: 'flex', alignItems: 'center', gap: 2, borderRadius: 6, padding: '2px 4px' }}
                    >
                      <Reply size={11} /> Répondre
                    </button>
                    {m.linkedEventId && !linkedEvent && (
                      <button
                        id={`msg-event-btn-${m.id}`}
                        onClick={() => onOpenEventFromTag(m.linkedEventId, `msg-event-btn-${m.id}`)}
                        className="tap-surface"
                        style={{ fontSize: 10.5, color: BLUE, background: '#EAF1FB', border: 'none', borderRadius: 999, padding: '1px 7px', fontWeight: 600 }}
                      >
                        {events.find((e) => e.id === m.linkedEventId)?.title}
                      </button>
                    )}
                    {/* V7.7 (P4) : le bouton n'est proposé qu'à l'auteur du message ou un admin
                        de la communauté — la policy update_own_message_or_admin (sql/02_rls.sql)
                        refuserait de toute façon la requête à tout autre membre ; l'interface ne
                        doit pas offrir une action vouée à l'échec (brief explicite). */}
                    {!m.linkedEventId && !linkedEvent && (isMine || isAdmin) && (
                      <button
                        onClick={() => setLinkPickerFor(m.id)}
                        className="tap-surface"
                        title="Lier ce message à un événement de l'agenda"
                        aria-label="Lier ce message à un événement de l'agenda"
                        style={{ fontSize: 10.5, color: MUTED, background: 'none', border: 'none', display: 'flex', alignItems: 'center', gap: 2, borderRadius: 6, padding: '2px 4px' }}
                      >
                        <Link2 size={11} /> Lier à un événement
                      </button>
                    )}
                    {/* V7.43 (25 sept.) — cause réelle du désordre visible sur la capture V7.42 :
                        `minHeight: MIN_TOUCH_TARGET` (44px) posé directement sur ces deux
                        boutons FORÇAIT chaque ligne où ils atterrissaient (flexWrap: 'wrap') à
                        faire 44px de haut, alors que les autres éléments de la même rangée
                        (heure, réactions, Répondre, Lier) ne font que ~15-20px — d'où les
                        immenses espaces vides entre les lignes une fois la rangée repliée sur
                        plusieurs lignes (6 éléments ne tenaient plus sur une seule ligne large
                        de ~260px). Correctif : zone tactile ≥44px (Item 8, MIN_TOUCH_TARGET)
                        obtenue par `padding` généreux + `margin` négatif de compensation — la
                        cible réellement tapable fait bien 44px, mais sa contribution à la
                        hauteur de ligne du flex redevient celle du contenu visible (~15px),
                        exactement comme Répondre/Lier juste à côté. Résultat : la rangée entière
                        tient à nouveau sur une seule ligne (ou se replie proprement sur une
                        deuxième si l'écran est très étroit), sans plus jamais ce trou géant. */}
                    {isMine && (
                      <button
                        onClick={() => setEditingMessage(m)}
                        disabled={mutationPending}
                        className={mutationPending ? undefined : 'tap-surface'}
                        aria-label="Modifier ce message"
                        title="Modifier ce message"
                        style={{
                          fontSize: 10.5, color: BLUE, background: 'none', border: 'none',
                          display: 'flex', alignItems: 'center', gap: 2, borderRadius: 6,
                          padding: '15px 6px', margin: '-15px -6px',
                          opacity: mutationPending ? 0.45 : 1,
                        }}
                      >
                        <Pencil size={11} /> Modifier
                      </button>
                    )}
                    {(isMine || isAdmin) && (
                      <button
                        onClick={() => { if (!mutationPending) setConfirmingDeleteId(m.id); }}
                        disabled={mutationPending}
                        className={mutationPending ? undefined : 'tap-surface'}
                        aria-label="Supprimer ce message"
                        title={mutationPending ? 'Suppression en cours…' : 'Supprimer ce message'}
                        style={{
                          fontSize: 10.5, color: RED, background: 'none', border: 'none',
                          display: 'flex', alignItems: 'center', gap: 2, borderRadius: 6,
                          padding: '15px 6px', margin: '-15px -6px',
                          opacity: mutationPending ? 0.45 : 1,
                        }}
                      >
                        <Trash2 size={11} /> Supprimer
                      </button>
                    )}
                  </div>
                </div>
              </div>
              </div>
            </div>
          );
        })}
      </div>
      )}

      {/* Champ de saisie */}
      <div style={{ position: 'fixed', bottom: 'calc(64px + env(safe-area-inset-bottom, 0px))', left: 0, right: 0, background: '#FBF6EC', borderTop: `1px solid ${CARD_BORDER}`, padding: '10px 14px', zIndex: 35 }}>
        {/* V7.39 — le message auquel on répond reste "collé" au compositeur tant qu'on n'a pas
            envoyé ou annulé (X) — même citation (auteur + extrait) que celle affichée une fois
            le message envoyé, pour que l'expéditeur voie exactement ce que les autres verront. */}
        {replyingTo && (
          <div className="max-w-md mx-auto" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, background: '#EAF1FB', border: `1px solid ${CARD_BORDER}`, borderLeft: `3px solid ${BLUE}`, borderRadius: 10, padding: '6px 10px', marginBottom: 8 }}>
            <div style={{ minWidth: 0 }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: BLUE }}>Réponse à {replyingTo.authorId === currentUserId ? 'votre message' : replyingTo.author}</div>
              <div style={{ fontSize: 12, color: MUTED, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{replyingTo.text}</div>
            </div>
            <button type="button" onClick={() => setReplyingTo(null)} aria-label="Annuler la réponse" className="tap-surface icon-button" style={{ background: 'none', border: 'none', flexShrink: 0 }}>
              <X size={16} color={MUTED} />
            </button>
          </div>
        )}
        {/* V7.61 (1er oct.) — pièce jointe en attente, même patron visuel que le bandeau
            "Réponse à" juste au-dessus : reste collée au compositeur jusqu'à l'envoi ou le
            retrait (X), jamais envoyée silencieusement sans que l'utilisatrice la voie. */}
        {pendingFile && (
          <div className="max-w-md mx-auto" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, background: '#EAF1FB', border: `1px solid ${CARD_BORDER}`, borderLeft: `3px solid ${BLUE}`, borderRadius: 10, padding: '6px 10px', marginBottom: 8 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0 }}>
              {/* V7.63 — miniature réelle si image (aperçu local, jamais uploadée en tant que
                  tel), sinon le même trombone qu'avant pour tout autre type de fichier. */}
              {pendingFilePreviewUrl ? (
                <img src={pendingFilePreviewUrl} alt="" style={{ width: 36, height: 36, borderRadius: 8, objectFit: 'cover', flexShrink: 0 }} />
              ) : (
                <Paperclip size={14} color={BLUE} style={{ flexShrink: 0 }} />
              )}
              <div style={{ minWidth: 0 }}>
                <div style={{ fontSize: 12.5, fontWeight: 600, color: INK, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{pendingFile.name}</div>
                <div style={{ fontSize: 11, color: MUTED }}>{formatBytes(pendingFile.size)}</div>
              </div>
            </div>
            <button type="button" onClick={removePendingFile} aria-label="Retirer la pièce jointe" className="tap-surface icon-button" style={{ background: 'none', border: 'none', flexShrink: 0 }}>
              <X size={16} color={MUTED} />
            </button>
          </div>
        )}
        {pendingFileError && (
          <div className="max-w-md mx-auto" style={{ background: '#FCE9E7', border: '1px solid #D9463033', borderRadius: 10, padding: '6px 10px', marginBottom: 8, fontSize: 12, color: '#8A2E1F' }}>
            {pendingFileError}
          </div>
        )}
        <div className="max-w-md mx-auto" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          {/* V7.62 (1er oct.) — trombone activé, DEUX champs fichier dédiés (voir le commentaire
              détaillé sur `attachMenuOpen` plus haut pour le bug Android confirmé que ce
              correctif évite) : jamais un seul champ sans `accept`, ni `image/*` combiné à des
              extensions de documents. */}
          <input
            ref={fileInputRef}
            type="file"
            accept=".pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt,.csv"
            onChange={handleAttachmentChange}
            style={{ display: 'none' }}
          />
          <input
            ref={mediaInputRef}
            type="file"
            accept="image/*,video/*"
            onChange={handleAttachmentChange}
            style={{ display: 'none' }}
          />
          <span style={{ position: 'relative' }}>
            <button
              type="button"
              onClick={() => setAttachMenuOpen((v) => !v)}
              title="Joindre un fichier"
              aria-label="Joindre un fichier"
              className="tap-surface icon-button"
              style={{ background: 'none', border: 'none' }}
            >
              <Paperclip size={19} color={INK} />
            </button>
            {attachMenuOpen && (
              <div
                ref={attachMenuRef}
                role="menu"
                aria-label="Joindre"
                style={{
                  position: 'absolute', bottom: '120%', left: 0,
                  display: 'flex', flexDirection: 'column', gap: 2, background: '#fff', border: `1px solid ${CARD_BORDER}`,
                  borderRadius: 12, padding: 6, boxShadow: '0 4px 14px rgba(23,32,51,0.15)', zIndex: 5, minWidth: 170,
                }}
              >
                <button
                  type="button"
                  role="menuitem"
                  onClick={() => { setAttachMenuOpen(false); fileInputRef.current?.click(); }}
                  style={{ display: 'flex', alignItems: 'center', gap: 8, background: 'none', border: 'none', borderRadius: 8, padding: '9px 10px', fontSize: 13.5, color: INK, textAlign: 'left' }}
                >
                  <FileText size={16} color={BLUE} /> Fichier
                </button>
                <button
                  type="button"
                  role="menuitem"
                  onClick={() => { setAttachMenuOpen(false); mediaInputRef.current?.click(); }}
                  style={{ display: 'flex', alignItems: 'center', gap: 8, background: 'none', border: 'none', borderRadius: 8, padding: '9px 10px', fontSize: 13.5, color: INK, textAlign: 'left' }}
                >
                  <Image size={16} color={BLUE} /> Photo ou vidéo
                </button>
              </div>
            )}
          </span>
          {/* V7.53 (30 sept.) — le texte ne passait pas à la ligne tout seul dans le champ malgré
              le <textarea> (V7.52) : bug classique flexbox, `flex: 1` seul ne suffit pas, un
              enfant flex garde par défaut une largeur minimale égale à son contenu ("min-width:
              auto"), donc ni cette div ni le textarea n'acceptaient de rétrécir sous la largeur
              du texte tapé — d'où le texte qui continuait tout droit au lieu de revenir à la
              ligne. `minWidth: 0` sur les deux lève ce plancher et laisse le retour à la ligne
              automatique (comportement par défaut d'un textarea) s'appliquer normalement. */}
          <div style={{ flex: 1, minWidth: 0, minHeight: 46, display: 'flex', alignItems: 'flex-end', gap: 6, background: '#FFFFFF', border: `1px solid ${CARD_BORDER}`, borderRadius: 22, padding: '6px 12px' }}>
            <textarea
              ref={composerInputRef}
              value={text}
              onChange={(e) => setText(e.target.value)}
              // V7.64 (2 oct.) — bug réel signalé par l'utilisatrice : sur téléphone, taper la
              // touche "retour" du clavier tactile envoyait le message au lieu d'aller à la
              // ligne, parce qu'aucun clavier tactile ne peut jamais produire "Maj+Entrée" (pas
              // de vraie touche Maj) — `!e.shiftKey` valait donc toujours vrai et Entrée
              // déclenchait systématiquement l'envoi, quelle que soit l'intention. Corrigé en
              // réutilisant `supportsHoverPointer()` (déjà utilisé ailleurs dans l'appli,
              // motionPrefs.js — `(hover: hover) and (pointer: fine)`, vrai seulement pour un
              // vrai clavier/souris) : Entrée n'envoie plus QUE sur un appareil avec clavier/
              // souris réels (comportement desktop inchangé, Maj+Entrée toujours disponible) ;
              // sur tactile, Entrée insère désormais une ligne, l'envoi se fait uniquement via
              // le bouton d'envoi (bulle bleue) — même convention que la plupart des
              // messageries mobiles.
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey && supportsHoverPointer()) {
                  e.preventDefault();
                  submit();
                }
              }}
              placeholder="Écrivez un message..."
              disabled={sending}
              rows={1}
              style={{
                flex: 1, minWidth: 0, border: 'none', outline: 'none', fontSize: 13.5, background: 'transparent',
                font: 'inherit', resize: 'none', overflowY: 'auto', maxHeight: composerMaxHeight,
                padding: '4px 0', lineHeight: 1.35,
              }}
            />
            <Smile size={17} color={MUTED} style={{ flexShrink: 0, marginBottom: 6 }} />
          </div>
          {/* V7.61 — une pièce jointe sans légende reste envoyable (même garde que `submit()`
              ci-dessus : `text.trim() || pendingFile`, plus seulement `text.trim()`). */}
          <button
            onClick={(text.trim() || pendingFile) && !sending ? submit : undefined}
            disabled={(!text.trim() && !pendingFile) || sending}
            aria-label={(text.trim() || pendingFile) ? 'Envoyer le message' : 'Message vocal — bientôt disponible'}
            title={(text.trim() || pendingFile) ? 'Envoyer' : 'Message vocal — bientôt disponible'}
            className="icon-button"
            style={{
              borderRadius: '50%', background: BLUE, border: 'none',
              display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
              opacity: (text.trim() || pendingFile) && !sending ? 1 : 0.55, cursor: (text.trim() || pendingFile) && !sending ? 'pointer' : 'not-allowed',
            }}
          >
            {(text.trim() || pendingFile) ? <Send size={16} color="#fff" /> : <Mic size={16} color="#fff" />}
          </button>
        </div>
      </div>

      {/* Feuille de liaison à un événement — extraite en sous-composant (LinkEventPicker,
          ci-dessous) pour ne monter/démonter qu'à l'ouverture réelle : useModalA11y doit
          s'armer à CE moment précis, pas au montage de Messages lui-même (brief pt 6/45). */}
      {linkPickerFor && (
        <LinkEventPicker
          sourceMessage={thread.find((m) => m.id === linkPickerFor)}
          events={events}
          onLink={(eventId) => { onLinkMessage(linkPickerFor, eventId); setLinkPickerFor(null); }}
          onClose={() => setLinkPickerFor(null)}
        />
      )}
      {editingMessage && (
        <EditMessageSheet
          message={editingMessage}
          pending={Boolean(messageMutationPendingIds && messageMutationPendingIds.has(editingMessage.id))}
          onClose={() => setEditingMessage(null)}
          onSave={async (nextText) => {
            const ok = await onEditMessage(editingMessage.id, nextText);
            if (ok) setEditingMessage(null);
            return ok;
          }}
        />
      )}
      {/* Item 8 : remplace window.confirm() — même contrat visuel/interaction que la
          confirmation de suppression d'événement d'EventDetail.jsx (non dupliquée ici :
          composant partagé src/components/ConfirmDialog.jsx). `busy` = mutation déjà en vol
          pour CE message précis (protection anti double-soumission, contrat pessimiste
          inchangé — voir onDeleteMessage/reloadScheduler, non touchés). */}
      {confirmingDeleteId && (
        <ConfirmDialog
          title="Supprimer ce message ?"
          message="Cette action est définitive."
          cautiousLabel="Annuler"
          confirmLabel="Supprimer"
          confirmBusyLabel="Suppression…"
          busy={Boolean(messageMutationPendingIds && messageMutationPendingIds.has(confirmingDeleteId))}
          onCautious={() => setConfirmingDeleteId(null)}
          onConfirm={async () => {
            const id = confirmingDeleteId;
            await onDeleteMessage(id);
            setConfirmingDeleteId(null);
          }}
        />
      )}
    </div>
  );
}

function EditMessageSheet({ message, pending, onClose, onSave }) {
  const [value, setValue] = useState(message.text || '');
  const [saving, setSaving] = useState(false);
  const panelRef = useRef(null);
  const inputRef = useRef(null);
  const { onBackdropClick } = useModalA11y(panelRef, onClose);

  useEffect(() => { inputRef.current?.focus(); }, []);

  async function submit() {
    const trimmed = value.trim();
    if (!trimmed || saving || pending) return;
    setSaving(true);
    const ok = await onSave(trimmed);
    if (!ok) setSaving(false);
  }

  return (
    <div onClick={onBackdropClick} style={{ position: 'fixed', inset: 0, background: 'rgba(29,43,34,0.4)', display: 'flex', alignItems: 'flex-end', zIndex: 70 }}>
      <div ref={panelRef} role="dialog" aria-modal="true" aria-label="Modifier le message" className="max-w-md mx-auto" style={{ width: '100%', background: '#fff', borderRadius: '20px 20px 0 0', padding: 20 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
          <strong>Modifier le message</strong>
          <button onClick={onClose} aria-label="Fermer" className="tap-surface icon-button" style={{ background: 'none', border: 'none' }}><X size={20} /></button>
        </div>
        <textarea
          ref={inputRef}
          value={value}
          onChange={(e) => setValue(e.target.value)}
          disabled={saving || pending}
          rows={4}
          style={{ width: '100%', resize: 'vertical', border: `1px solid ${CARD_BORDER}`, borderRadius: 12, padding: 12, font: 'inherit', fontSize: 14, boxSizing: 'border-box' }}
        />
        <button
          onClick={submit}
          disabled={!value.trim() || saving || pending}
          style={{ width: '100%', minHeight: 46, marginTop: 10, border: 'none', borderRadius: 14, background: BLUE, color: '#fff', fontWeight: 700, opacity: (!value.trim() || saving || pending) ? 0.5 : 1 }}
        >
          {saving || pending ? 'Enregistrement…' : 'Enregistrer'}
        </button>
      </div>
    </div>
  );
}

// Brief pt 23 : l'action "Lier" (renommée "Lier à un événement" sur le bouton déclencheur,
// voir plus haut) ouvrait une modale générique sans jamais rappeler QUEL message on est en
// train de lier — on pouvait perdre le fil après un clic accidentel sur le mauvais message.
// La citation ci-dessous ("Message de {auteur} — « … »") est le même motif visuel qu'une
// citation de réponse (pt 21), pour rester cohérent.
function LinkEventPicker({ sourceMessage, events, onLink, onClose }) {
  const panelRef = useRef(null);
  const { onBackdropClick } = useModalA11y(panelRef, onClose);
  const preview = sourceMessage?.text || (sourceMessage?.file ? sourceMessage.file.displayName || sourceMessage.file.name : '');
  // V7.7 (P4) : même règle d'exclusion que l'ancienne `linkableEvents()` (data.js), appliquée
  // maintenant aux vrais événements de la communauté (`events`, prop reçue de Messages.jsx,
  // transmise par App.jsx depuis l'agenda Supabase réel) — jamais aux événements de démonstration.
  const linkable = (events || []).filter((e) => e.category !== 'anniversaire');

  return (
    <div onClick={onBackdropClick} style={{ position: 'fixed', inset: 0, background: 'rgba(29,43,34,0.4)', display: 'flex', alignItems: 'flex-end', zIndex: 60 }}>
      <div ref={panelRef} role="dialog" aria-modal="true" aria-label="Lier à un événement" className="max-w-md mx-auto" style={{ width: '100%', background: '#fff', borderRadius: '20px 20px 0 0', padding: 20 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
          <span style={{ fontSize: 16, fontWeight: 700, fontFamily: FONT_DISPLAY }}>Lier à un événement</span>
          <button onClick={onClose} aria-label="Fermer" className="tap-surface icon-button" style={{ background: 'none', border: 'none' }}><X size={20} /></button>
        </div>
        {sourceMessage && (
          <div style={{ background: '#FBF6EC', border: `1px solid ${CARD_BORDER}`, borderRadius: 10, padding: '8px 10px', marginBottom: 12, fontSize: 12.5, color: MUTED }}>
            Message de <strong style={{ color: INK }}>{sourceMessage.author}</strong>
            {preview ? <> — « {preview} »</> : null}
          </div>
        )}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          {linkable.length === 0 && (
            <p style={{ fontSize: 12.5, opacity: 0.5 }}>Aucun événement de l'agenda ne peut recevoir de discussion liée pour l'instant.</p>
          )}
          {linkable.map((e) => (
            <button
              key={e.id}
              onClick={() => onLink(e.id)}
              style={{ textAlign: 'left', padding: '10px 12px', borderRadius: 10, border: `1px solid ${CARD_BORDER}`, background: '#FBF6EC', fontSize: 13.5 }}
            >
              {e.title}
            </button>
          ))}
        </div>
        <p style={{ fontSize: 11, opacity: 0.5, marginTop: 10 }}>Les rappels d'anniversaire ne peuvent pas recevoir de discussion liée.</p>
      </div>
    </div>
  );
}
