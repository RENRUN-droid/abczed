import { useState, useEffect, useRef } from 'react';
import { ArrowLeft, Shield, Paperclip, Smile, SmilePlus, Mic, Send, Link2, X, FileText, Search, ExternalLink, Download, Pencil, Trash2, Reply } from 'lucide-react';
import { BLUE, INK, MUTED, CARD_BORDER, SECTION_THEMES, buttonStyle, FONT_DISPLAY, MIN_TOUCH_TARGET } from '../theme';
// V7.7 (P4) : `linkableEvents` (data.js, MOCK_EVENTS) n'est plus importé ici — le choix d'un
// événement réel à lier vient désormais de la prop `events` (Agenda réel, transmise par
// App.jsx), filtrée localement dans LinkEventPicker ci-dessous (exclusion des anniversaires,
// même règle qu'avant, appliquée à la vraie liste). TODAY_ISO reste utilisé tel quel (calcul
// des séparateurs de date, sans rapport avec la source des messages).
import { TODAY_ISO } from '../data';
import { computeVisibleMessages } from '../messageSearch';
import { useScrollRestore } from '../useScrollRestore';
import { prefersReducedMotion } from '../motionPrefs';
import { useModalA11y } from '../useModalA11y';
import { reactionSummary, REACTION_EMOJIS } from '../reactions';
import { documentById } from '../documents';
import { openableCardProps } from '../attachmentCardA11y';
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
  async function submit() {
    if (!text.trim() || sending) return;
    setSending(true);
    const ok = await onSend({ text: text.trim(), linkedEventId: linkedEvent ? linkedEvent.id : null, replyToId: replyingTo ? replyingTo.id : null });
    setSending(false);
    if (ok) { setText(''); setReplyingTo(null); }
  }

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
                    {/* Delta pts 29/30/39/42 (arbitrage D1) : `m.fileId` référence le
                        catalogue src/documents.js — même id que l'attachement de l'événement
                        lié et le partage correspondant quand c'est réellement le même fichier
                        — et Ouvrir/Télécharger sont désormais réellement fonctionnels (fichier
                        de démonstration réel, servi depuis public/demo/). */}
                    {m.fileId && (() => {
                      const doc = documentById(m.fileId);
                      if (!doc) return null;
                      return (
                        // Précision reçue avant codage (arbitrage D1) : la carte de pièce
                        // jointe elle-même doit être actionnable (tap mobile, hover/focus
                        // desktop, activation clavier) — pas seulement Ouvrir/Télécharger.
                        <div className="tap-container" {...openableCardProps(doc.url)} style={{ borderRadius: 12, padding: 4, cursor: doc.url ? 'pointer' : 'default' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                            <FileText size={18} color={BLUE} />
                            <div>
                              <div style={{ fontSize: 12.5, fontWeight: 600 }}>{doc.displayName || doc.filename}</div>
                              <div style={{ fontSize: 10.5, opacity: 0.55 }}>{doc.size}</div>
                            </div>
                          </div>
                          <div style={{ display: 'flex', gap: 6, marginTop: 6 }}>
                            <ActionButton icon={ExternalLink} href={doc.url} title="Ouvrir dans un nouvel onglet">Ouvrir</ActionButton>
                            <ActionButton icon={Download} href={doc.url} download={doc.filename} title="Télécharger">Télécharger</ActionButton>
                          </div>
                        </div>
                      );
                    })()}
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 4, flexWrap: 'wrap', justifyContent: isMine ? 'flex-end' : 'flex-start' }}>
                    <span style={{ fontSize: 10.5, opacity: 0.5 }}>{m.time}</span>
                    {/* Delta pts 26-28 (arbitrage D3) : pastilles dérivées de reactionSummary,
                        jamais du compteur brut. Taper sa PROPRE pastille la retire ; taper une
                        pastille d'autrui y ajoute sa réaction (en remplaçant une éventuelle
                        autre réaction déjà posée par la même personne sur ce message — une
                        seule réaction active par personne). "Qui a réagi" : title/aria-label
                        listent les prénoms, consultable au survol comme au clavier — pas de
                        popover séparé pour cette liste, déjà exposée ainsi de façon accessible. */}
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
                        }}
                      >
                        {r.emoji} {r.count}
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
                    {isMine && (
                      // Item 8 (zone tactile ≥44px, MIN_TOUCH_TARGET) TOUJOURS respecté — mais
                      // V7.40 (25 sept.), retour direct de l'utilisatrice sur l'encombrement
                      // visuel de cette rangée d'actions une fois "Répondre" ajouté (V7.39) :
                      // icône SEULE désormais (bordure colorée conservée pour distinguer
                      // Modifier/bleu de Supprimer/rouge), largeur fixée à MIN_TOUCH_TARGET au
                      // lieu de s'étirer au texte — même zone tactile carrée de 44px, beaucoup
                      // moins de largeur occupée (le texte du libellé reste sur aria-label/
                      // title, jamais perdu pour l'accessibilité).
                      <button
                        onClick={() => setEditingMessage(m)}
                        disabled={mutationPending}
                        className={mutationPending ? undefined : 'tap-surface'}
                        aria-label="Modifier ce message"
                        title="Modifier ce message"
                        style={{ ...buttonStyle('secondary', { compact: true }), width: MIN_TOUCH_TARGET, padding: 0, opacity: mutationPending ? 0.45 : 1 }}
                      >
                        <Pencil size={15} />
                      </button>
                    )}
                    {(isMine || isAdmin) && (
                      <button
                        onClick={() => { if (!mutationPending) setConfirmingDeleteId(m.id); }}
                        disabled={mutationPending}
                        className={mutationPending ? undefined : 'tap-surface'}
                        aria-label="Supprimer ce message"
                        title={mutationPending ? 'Suppression en cours…' : 'Supprimer ce message'}
                        style={{ ...buttonStyle('destructive', { compact: true }), width: MIN_TOUCH_TARGET, padding: 0, opacity: mutationPending ? 0.45 : 1 }}
                      >
                        <Trash2 size={15} />
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
        <div className="max-w-md mx-auto" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <button
            disabled
            title="Bientôt disponible"
            aria-label="Joindre un fichier — bientôt disponible"
            className="icon-button"
            style={{ background: 'none', border: 'none', opacity: 0.35, cursor: 'not-allowed' }}
          >
            <Paperclip size={19} color={INK} />
          </button>
          <div style={{ flex: 1, minHeight: 46, display: 'flex', alignItems: 'center', gap: 6, background: '#FFFFFF', border: `1px solid ${CARD_BORDER}`, borderRadius: 999, padding: '6px 12px' }}>
            <input
              ref={composerInputRef}
              value={text}
              onChange={(e) => setText(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && submit()}
              placeholder="Écrivez un message..."
              disabled={sending}
              style={{ flex: 1, border: 'none', outline: 'none', fontSize: 13.5, background: 'transparent' }}
            />
            <Smile size={17} color={MUTED} />
          </div>
          <button
            onClick={text.trim() && !sending ? submit : undefined}
            disabled={!text.trim() || sending}
            aria-label={text.trim() ? 'Envoyer le message' : 'Message vocal — bientôt disponible'}
            title={text.trim() ? 'Envoyer' : 'Message vocal — bientôt disponible'}
            className="icon-button"
            style={{
              borderRadius: '50%', background: BLUE, border: 'none',
              display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
              opacity: text.trim() && !sending ? 1 : 0.55, cursor: text.trim() && !sending ? 'pointer' : 'not-allowed',
            }}
          >
            {text.trim() ? <Send size={16} color="#fff" /> : <Mic size={16} color="#fff" />}
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
