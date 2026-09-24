import { useState, useRef } from 'react';
import { ArrowLeft, MapPin, FileText, Check, MessageCircle, Minus, Plus, Pencil, ExternalLink, Download, X, Trash2 } from 'lucide-react';
import { BLUE, RED, INK, MUTED, CARD_BORDER, SPACING, buttonStyle, categoryOf, FONT_DISPLAY } from '../theme';
import ActionButton from '../components/ActionButton';
import { documentById } from '../documents';
import { buildMapsUrl } from '../mapsUrl';
import { openableCardProps } from '../attachmentCardA11y';
import { resizeNames, buildAttendeeNames, attendeeNamesLine } from '../attendeeNames';
import { peopleCountOf, familiesCountOf, eventModeOf } from '../agendaSearch';
import { useModalA11y } from '../useModalA11y';
import CompactHeader from '../components/CompactHeader';

// Gère les deux formes de participants qui peuvent coexister tant que Messages/Partages
// n'ont pas migré : chaîne simple (données fictives de data.js) ou objet {userId, label,
// adultsCount, childrenCount} (événements réels Supabase).
function participantId(p) { return typeof p === 'string' ? p : p.userId; }
function participantLabel(p) { return typeof p === 'string' ? p : p.label; }

function Stepper({ label, value, onChange, min = 0 }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 0' }}>
      <span style={{ fontSize: 14, color: INK }}>{label}</span>
      <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
        <button
          type="button"
          onClick={() => onChange(Math.max(min, value - 1))}
          disabled={value <= min}
          aria-label={`Diminuer — ${label}`}
          className={value > min ? 'tap-surface' : undefined}
          style={{
            width: 44, height: 44, borderRadius: '50%', border: `1px solid ${CARD_BORDER}`, background: '#fff',
            display: 'flex', alignItems: 'center', justifyContent: 'center', opacity: value <= min ? 0.4 : 1,
            cursor: value <= min ? 'default' : 'pointer',
          }}
        >
          <Minus size={14} color={INK} />
        </button>
        <span style={{ fontSize: 15, fontWeight: 700, minWidth: 18, textAlign: 'center' }}>{value}</span>
        <button
          type="button"
          onClick={() => onChange(value + 1)}
          aria-label={`Augmenter — ${label}`}
          className="tap-surface"
          style={{
            width: 44, height: 44, borderRadius: '50%', border: `1px solid ${CARD_BORDER}`, background: '#fff',
            display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer',
          }}
        >
          <Plus size={14} color={INK} />
        </button>
      </div>
    </div>
  );
}

// Point 2 (recette réelle sur PC) : saisie volontaire des prénoms des personnes du foyer —
// jamais déduite automatiquement (La Bande n'est pas lue ici). Un champ texte par personne
// déjà comptée par les steppers Adultes/Enfants ci-dessus, jamais plus — resizeNames() garde
// exactement ce nombre de champs à jour quand un stepper change. Saisie facultative : un champ
// laissé vide n'empêche ni la confirmation ni l'enregistrement (voir buildAttendeeNames).
function NameInputs({ label, names, onChange }) {
  if (names.length === 0) return null;
  return (
    <div style={{ marginTop: 8 }}>
      <div style={{ fontSize: 12, fontWeight: 600, color: MUTED, marginBottom: 4 }}>
        Prénoms — {label}{names.length > 1 ? 's' : ''} <span style={{ fontWeight: 400 }}>(facultatif)</span>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        {names.map((name, i) => (
          <input
            key={i}
            type="text"
            value={name}
            onChange={(e) => onChange(i, e.target.value)}
            placeholder={`${label} ${i + 1}`}
            aria-label={`Prénom ${label.toLowerCase()} ${i + 1}`}
            style={{
              width: '100%', boxSizing: 'border-box', padding: '9px 12px', borderRadius: 10,
              border: `1px solid ${CARD_BORDER}`, fontSize: 13.5, color: INK, background: '#fff',
            }}
          />
        ))}
      </div>
    </div>
  );
}

// V7.14 (correctif UAT, points 4-5) : ces deux helpers construisent désormais leurs styles sur
// `buttonStyle()` (src/theme.js, API partagée introduite en phase 1) au lieu de valeurs répétées
// à la main — même échelle (BUTTON_H=48, RADIUS_MD=14) que partout ailleurs dans l'app, une
// seule source de vérité. `onColor` désormais transmis explicitement (au lieu d'un `color: '#fff'`
// figé) : corrige au passage un vrai défaut de contraste latent — `primaryBtn(cat.color, ...)`
// affichait un texte blanc sur l'aplat de CATÉGORIE, or `autre.onColor` vaut '#0C1320' (quasi
// noir) car `autre.color` (#7C838D, gris moyen) ne passe pas 4,5:1 avec du blanc — un texte
// blanc y était donc illisible ; `onColor` est déjà calculé pour CHAQUE catégorie (voir
// scripts/test-design-system.mjs). `secondaryBtn` (RSVP négatif : "Je ne participe pas"/"Me
// retirer"/"Oui, annuler...") passe de son ancien fond teinté `#FBEAE8` à `buttonStyle('destructive')`
// (fond blanc, bordure RED) — exactement la convention couleur documentée en tête de theme.js
// (une teinte pâle ne doit jamais être le fond d'une action réelle) et le style déjà validé pour
// "Supprimer l'anniversaire" (AddBirthdaySheet.jsx), désormais partagé au lieu d'être redéfini
// ici avec une variante légèrement différente.
const primaryBtn = (color, disabled, onColor) => ({
  ...buttonStyle('primary', { color, onColor }),
  width: '100%',
  opacity: disabled ? 0.6 : 1, cursor: disabled ? 'default' : 'pointer',
});
const secondaryBtn = (disabled) => ({
  ...buttonStyle('destructive'),
  width: '100%',
  opacity: disabled ? 0.6 : 1, cursor: disabled ? 'default' : 'pointer',
});

// P4 (exercice de correction V7.5) : défaut corrigé — "Annuler ma participation" supprimait
// l'inscription (compteurs adultes/enfants + prénoms saisis) IMMÉDIATEMENT au clic, sans la
// moindre confirmation ; un tap malheureux suffisait à tout perdre. Cette confirmation
// réutilise le mécanisme d'accessibilité déjà partagé par toutes les autres modales de l'app
// (useModalA11y, voir AddBirthdaySheet/AddShareSheet/CreateEventSheet/MyProfileSheet) plutôt
// qu'une mécanique ad hoc : Escape ferme, un clic sur le fond ferme, Tab/Shift+Tab restent
// emprisonnés dans le panneau, et le focus revient sur le bouton "Annuler ma participation" qui
// a ouvert cette confirmation (le déclencheur réel) à la fermeture — succès ou abandon.
// `onKeep` (fermeture "sûre" : Escape, fond, bouton fermer, ET le bouton "Conserver ma
// participation" lui-même) ne fait jamais rien d'autre que fermer — aucune des quatre façons de
// fermer ce panneau ne peut donc supprimer l'inscription. Ordre du DOM délibéré : "Conserver ma
// participation" est le PREMIER élément focusable du panneau (avant "Oui, annuler..." et avant
// le bouton fermer "X", ce dernier repoussé en dernier dans le DOM) — useModalA11y donne le
// focus initial au premier élément focusable trouvé, donc c'est bien l'option prudente qui le
// reçoit, sans changement à faire dans ce hook générique. Le bouton "X" reste positionné
// visuellement en haut à droite (CSS `position: absolute`), qui n'a aucune influence sur
// l'ordre du DOM/de tabulation, seulement sur l'affichage.
function ConfirmCancelDialog({ onKeep, onConfirm, busy }) {
  const panelRef = useRef(null);
  const { onBackdropClick } = useModalA11y(panelRef, onKeep);
  return (
    <div
      onClick={onBackdropClick}
      style={{ position: 'fixed', inset: 0, background: 'rgba(29,43,34,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 70, padding: 20 }}
    >
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="confirm-leave-title"
        style={{ position: 'relative', width: '100%', maxWidth: 380, background: '#fff', borderRadius: 18, padding: '20px 18px 18px' }}
      >
        <div id="confirm-leave-title" style={{ fontSize: 16, fontWeight: 700, fontFamily: FONT_DISPLAY, marginBottom: 8, paddingRight: 28 }}>
          Annuler votre participation ?
        </div>
        <p style={{ fontSize: 13.5, color: MUTED, lineHeight: 1.4, margin: '0 0 18px' }}>
          Les nombres de participants et les prénoms saisis seront supprimés.
        </p>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {/* Option prudente : mise en avant visuellement (bouton plein) ET premier élément
              focusable du panneau (focus initial, voir commentaire ci-dessus). */}
          <button onClick={onKeep} disabled={busy} className={busy ? undefined : 'tap-surface'} style={primaryBtn(BLUE, busy)}>
            Conserver ma participation
          </button>
          {/* Option destructive : accessible mais délibérément en second plan visuellement
              (contour, pas de remplissage) — jamais la même proéminence que "Conserver". */}
          <button onClick={onConfirm} disabled={busy} className={busy ? undefined : 'tap-surface'} style={secondaryBtn(busy)}>
            Oui, annuler ma participation
          </button>
        </div>
        <button
          onClick={onKeep}
          aria-label="Fermer"
          className="tap-surface"
          style={{
            position: 'absolute', top: 8, right: 8, width: 44, height: 44, borderRadius: '50%',
            background: 'none', border: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}
        >
          <X size={16} color={INK} />
        </button>
      </div>
    </div>
  );
}

// V7.11 (P0) — confirmation de suppression d'événement, MÊME PATRON que ConfirmCancelDialog
// ci-dessus (useModalA11y, jamais réimplémenté) : Escape ferme, un clic sur le fond ferme,
// Tab/Shift+Tab restent emprisonnés dans le panneau, le focus revient sur le bouton "Supprimer
// l'événement" qui a ouvert cette confirmation à la fermeture. Ordre du DOM délibéré, comme pour
// ConfirmCancelDialog : "Annuler" (option prudente) est le PREMIER élément focusable du panneau
// (reçoit donc le focus initial), "Supprimer l'événement" (option destructive) vient en second —
// brief P0 explicite : "le bouton prudent/non destructif (Annuler) doit être listé en premier
// dans l'ordre des boutons de la boîte de dialogue, l'action destructive en second". `onCancel`
// (fermeture "sûre" : Escape, fond, bouton fermer "X", ET le bouton "Annuler" lui-même) ne fait
// jamais rien d'autre que fermer.
function ConfirmDeleteEventDialog({ onCancel, onConfirm, busy }) {
  const panelRef = useRef(null);
  const { onBackdropClick } = useModalA11y(panelRef, onCancel);
  return (
    <div
      onClick={onBackdropClick}
      style={{ position: 'fixed', inset: 0, background: 'rgba(29,43,34,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 70, padding: 20 }}
    >
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="confirm-delete-event-title"
        style={{ position: 'relative', width: '100%', maxWidth: 380, background: '#fff', borderRadius: 18, padding: '20px 18px 18px' }}
      >
        <div id="confirm-delete-event-title" style={{ fontSize: 16, fontWeight: 700, fontFamily: FONT_DISPLAY, marginBottom: 8, paddingRight: 28 }}>
          Supprimer cet événement ?
        </div>
        <p style={{ fontSize: 13.5, color: MUTED, lineHeight: 1.4, margin: '0 0 18px' }}>
          Cette action est définitive. Les messages déjà liés à cet événement resteront dans le
          fil, mais ne seront plus rattachés à lui.
        </p>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {/* Option prudente : premier élément focusable du panneau (focus initial, voir
              commentaire ci-dessus) et mise en avant visuellement (bouton plein). */}
          <button onClick={onCancel} disabled={busy} className={busy ? undefined : 'tap-surface'} style={primaryBtn(BLUE, busy)}>
            Annuler
          </button>
          {/* Option destructive : accessible mais délibérément en second plan visuellement. */}
          <button onClick={onConfirm} disabled={busy} className={busy ? undefined : 'tap-surface'} style={secondaryBtn(busy)}>
            {busy ? 'Suppression en cours…' : "Supprimer l'événement"}
          </button>
        </div>
        <button
          onClick={onCancel}
          aria-label="Fermer"
          className="tap-surface"
          style={{
            position: 'absolute', top: 8, right: 8, width: 44, height: 44, borderRadius: '50%',
            background: 'none', border: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}
        >
          <X size={16} color={INK} />
        </button>
      </div>
    </div>
  );
}

export default function EventDetail({
  event, onBack, onJoin, onLeave, onModify, rsvpBusy, onOpenThread, currentUserId, attendeeNamesUnsupported,
  // V7.11 (P0) : suppression réelle d'un événement — `canDeleteEvent` est dérivé par App.jsx
  // (créateur ou admin, événement réellement issu de l'agenda Supabase), jamais recalculé ici
  // (une seule source de vérité pour ce calcul, cohérent avec le reste du fichier — voir
  // `isLiveEvent`/`isAdmin` dans App.jsx).
  canDeleteEvent, onDeleteEvent, deleteBusy,
  // V7.11 (P1) : en-tête compact (logo + avatar connecté) — voir src/components/CompactHeader.jsx.
  connectedUserId, connectedDisplayName, connectedAvatarPath, onOpenProfile,
}) {
  const [editing, setEditing] = useState(false);
  const [draftAdults, setDraftAdults] = useState(1);
  const [draftChildren, setDraftChildren] = useState(0);
  // Point 2 : un prénom par personne comptée ci-dessus, jamais plus — resizeNames() garde ces
  // deux tableaux synchronisés avec draftAdults/draftChildren à chaque changement de stepper.
  const [draftAdultNames, setDraftAdultNames] = useState(['']);
  const [draftChildNames, setDraftChildNames] = useState([]);
  // Delta §6.2 : identification des accompagnateurs sans dépendre du hover (absent au tactile)
  // — un tap sur une pastille révèle le nom ; "showAll" bascule vers la liste complète en texte
  // si elle est tronquée (le "+N" doit permettre d'y accéder, pas juste l'annoncer).
  const [revealedId, setRevealedId] = useState(null);
  // Correctif (retour recette réelle, post-V7.14) : l'attribut `title` HTML natif utilisé
  // jusqu'ici pour le survol desktop met ~1s à apparaître et disparaît dès que la souris
  // bouge — trop lent/fragile pour être perçu comme "ça marche" pendant un test rapide.
  // `hoveredId` déclenche désormais le MÊME bandeau de révélation que le tap (`revealedId`,
  // juste en dessous des pastilles) immédiatement au survol, sans latence — le tap reste
  // inchangé pour le tactile (onMouseEnter/onMouseLeave n'existent pas sur un écran tactile,
  // donc les deux mécanismes coexistent sans jamais se marcher dessus).
  const [hoveredId, setHoveredId] = useState(null);
  const [showAllParticipants, setShowAllParticipants] = useState(false);
  // P4 (exercice de correction V7.5) : la confirmation ci-dessous s'intercale désormais entre
  // le clic sur "Annuler ma participation" et l'appel réel à `onLeave` (voir
  // confirmCancelParticipation ci-dessous) — `onLeave` n'est plus jamais appelé directement
  // depuis un onClick de bouton dans ce composant pour le mode "family".
  const [confirmingLeave, setConfirmingLeave] = useState(false);
  // V7.11 (P0) : même mécanique que `confirmingLeave` ci-dessus — la confirmation s'intercale
  // entre le clic sur "Supprimer l'événement" et l'appel réel à `onDeleteEvent`.
  const [confirmingDelete, setConfirmingDelete] = useState(false);

  if (!event) return null;
  const cat = categoryOf(event);

  // Un seul bloc participation, dont le contenu dépend du type — jamais deux parcours qui
  // se succèdent pour exprimer la même décision (retour direct du test réel).
  // P2 (exercice de correction V7.5) : extrait dans agendaSearch.js (eventModeOf) pour être
  // réutilisé tel quel par Agenda.jsx — même expression qu'avant, juste déplacée, aucun
  // changement de comportement ici.
  const mode = eventModeOf(event);

  const mine = event.participants?.find((p) => participantId(p) === currentUserId) || null;
  const joined = Boolean(mine);
  const dateLabel = new Date(event.date + 'T00:00:00').toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' });

  function startEdit() {
    const adults = mine?.adultsCount ?? 1;
    const children = mine?.childrenCount ?? 0;
    setDraftAdults(adults);
    setDraftChildren(children);
    // Repeuple les champs prénoms depuis la participation existante (mine.attendeeNames) —
    // `null` (aucun prénom saisi jusqu'ici, ou migration 05 pas encore appliquée) donne des
    // tableaux de chaînes vides, jamais des noms inventés.
    setDraftAdultNames(resizeNames(mine?.attendeeNames?.adults || [], adults));
    setDraftChildNames(resizeNames(mine?.attendeeNames?.children || [], children));
    setEditing(true);
  }
  function startJoinFamily() {
    setDraftAdults(1);
    setDraftChildren(0);
    setDraftAdultNames(['']);
    setDraftChildNames([]);
    setEditing(true);
  }
  function setAdultsCount(n) {
    setDraftAdults(n);
    setDraftAdultNames((names) => resizeNames(names, n));
  }
  function setChildrenCount(n) {
    setDraftChildren(n);
    setDraftChildNames((names) => resizeNames(names, n));
  }
  function setAdultName(i, value) {
    setDraftAdultNames((names) => { const next = names.slice(); next[i] = value; return next; });
  }
  function setChildName(i, value) {
    setDraftChildNames((names) => { const next = names.slice(); next[i] = value; return next; });
  }
  function confirmFamily() {
    const counts = {
      adultsCount: draftAdults,
      childrenCount: draftChildren,
      attendeeNames: buildAttendeeNames(draftAdultNames, draftChildNames),
    };
    if (joined) onModify(counts); else onJoin(counts);
    setEditing(false);
  }
  // P4 (exercice de correction V7.5) : seul point d'appel réel de `onLeave` pour le mode
  // "family" — jamais invoqué avant que l'utilisateur ait explicitement choisi "Oui, annuler ma
  // participation" dans ConfirmCancelDialog. `onLeave` (leaveEvent, App.jsx) est déjà défensif
  // en cas d'échec réseau : il n'efface `event.participants` QUE si la requête a réussi (voir
  // App.jsx, leaveEvent) — en cas d'échec, il affiche un message d'erreur explicite
  // (dataError, bandeau visible même sur cette fiche) sans jamais toucher l'inscription
  // affichée, qui reste donc visible exactement comme avant le clic. Le panneau de
  // confirmation se ferme dans les deux cas (succès ou échec) : en cas d'échec, l'utilisateur
  // revoit sa fiche avec son inscription toujours là et le message d'erreur au-dessus — jamais
  // une perte silencieuse.
  async function confirmCancelParticipation() {
    await onLeave();
    setConfirmingLeave(false);
  }

  const headerLabel = mode === 'accompaniment'
    ? `${event.participants.length} accompagnateur${event.participants.length > 1 ? 's' : ''}`
    : `Participants (${event.participants.length})`;

  return (
    <>
    {/* V7.11 (P1) : en-tête compact (logo ABCZed + avatar connecté) — défaut confirmé en UAT
        réelle, les deux disparaissaient entièrement sur cette fiche. Voir
        src/components/CompactHeader.jsx : le bouton "Retour" juste en dessous (déjà existant)
        complète ce bandeau, jamais dupliqué ici. */}
    <CompactHeader currentUserId={connectedUserId} displayName={connectedDisplayName} avatarPath={connectedAvatarPath} onOpenProfile={onOpenProfile} />
    <div className="page-shell" style={{ paddingTop: 18, '--section-accent': cat.color }}>
      {/* Delta §3 : header de détail à 3 zones — flèche à gauche (largeur fixe), titre
          mathématiquement centré, zone droite symétrique de réserve. Un simple
          display:flex flèche+titre (ancienne version) décale le titre de la largeur de la
          flèche ; ce n'est plus le cas ici. Règle appliquée à tous les écrans de détail. */}
      <div style={{ display: 'grid', gridTemplateColumns: '44px 1fr 44px', alignItems: 'center', marginBottom: 16 }}>
        <button onClick={onBack} aria-label="Retour" className="tap-surface icon-button" style={{ background: 'none', border: 'none' }}>
          <ArrowLeft size={20} color={INK} />
        </button>
        <span style={{ fontSize: 16, fontWeight: 700, fontFamily: FONT_DISPLAY, textAlign: 'center', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{event.title}</span>
        <span aria-hidden="true" />
      </div>

      {/* Delta pt 43 : le bloc date/lieu est sorti de la grille à deux zones et affiché en
          pleine largeur, AU-DESSUS — brief §17 (contenu centré) reste respecté. Avant cette
          passe, il restait seul dans la colonne de gauche dès que l'événement n'avait ni
          description ni pièce jointe (le cas le plus courant dans les données de
          démonstration : zoo, pique-nique, rentrée...), laissant cette colonne clairsemée à
          côté d'une colonne de droite bien plus remplie (participants + participation). Un
          bloc pleine largeur, commun aux deux formes du contenu ci-dessous qu'il ait ou non
          une seconde zone, n'a plus ce problème par construction — rééquilibrage ciblé, pas
          une redistribution complète de l'écran. */}
      <div style={{ background: cat.tint, border: `1px solid ${cat.color}33`, borderRadius: 18, padding: 16, marginBottom: 16, textAlign: 'center' }}>
        <div style={{ fontSize: 13, fontWeight: 700, color: cat.color, textTransform: 'capitalize' }}>{dateLabel}</div>
        <div style={{ fontSize: 14, marginTop: 2 }}>
          {event.startTime}{event.endTime ? ` – ${event.endTime}` : ''}
        </div>
        {event.location && (
          // Delta §7 : la ligne de lieu est désormais l'action elle-même (pas toute la
          // carte date/heure, pour éviter l'ambiguïté) — ouvre une carte/itinéraire.
          <button
            type="button"
            onClick={() => window.open(buildMapsUrl(event), '_blank', 'noopener,noreferrer')}
            aria-label={`Ouvrir ${event.location} dans une carte`}
            className="tap-surface"
            style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 5, fontSize: 13, marginTop: 6, background: 'none', border: 'none', borderRadius: 10, padding: '4px 10px', color: 'inherit', width: '100%' }}
          >
            <MapPin size={14} color={cat.color} /> {event.location}
            {event.address && <span style={{ opacity: 0.6 }}>· {event.address}</span>}
          </button>
        )}
      </div>

      {/* Delta §23/pt 43 : disposition à deux zones sur tablette/desktop (≥1024px, voir
          index.html) pour ce qui reste — description/pièces jointes à gauche,
          participation/actions à droite. Quand la colonne de gauche n'a rien à montrer (aucune
          description ni pièce jointe), elle n'est pas rendue du tout et `.single` fait passer
          la grille à une seule colonne — jamais de colonne vide à côté d'une colonne pleine. */}
      <div className={`event-detail-grid${(event.description || event.attachments?.length > 0) ? '' : ' single'}`}>
        {(event.description || event.attachments?.length > 0) && (
        <div>
          {event.description && (
            <p style={{ fontSize: 16, lineHeight: 1.45, color: INK, marginBottom: 16 }}>{event.description}</p>
          )}

          {event.attachments?.length > 0 && (
            <div style={{ marginBottom: 16 }}>
              {event.attachments.map((attachmentRef, i) => {
                // Delta pts 29/30/39/42 (arbitrage D1) : un attachement référence désormais un
                // id du catalogue src/documents.js (source unique, voir data.js) plutôt qu'un
                // objet {name, size} recopié ici — un ancien format objet resterait affichable
                // (repli défensif) mais n'a plus lieu d'exister dans les données démo actuelles.
                const doc = typeof attachmentRef === 'string' ? documentById(attachmentRef) : attachmentRef;
                if (!doc) return null;
                return (
                  // Delta §8, précisé par l'utilisateur avant codage (arbitrage D1) : la carte
                  // elle-même est désormais actionnable (pas seulement les deux boutons) —
                  // tap mobile, clic desktop (curseur pointer + :focus-within visible via
                  // .tap-container), et activation clavier (Entrée/Espace) via
                  // `openableCardProps`. Un clic sur Ouvrir/Télécharger garde son propre
                  // comportement : ActionButton stoppe déjà la propagation, donc n'active
                  // jamais AUSSI le clic de la carte.
                  <div
                    key={doc.id || i}
                    className="tap-container"
                    {...openableCardProps(doc.url)}
                    style={{ background: '#FFFFFF', border: `1px solid ${CARD_BORDER}`, borderRadius: 18, padding: 12, marginBottom: 8, cursor: doc.url ? 'pointer' : 'default' }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      <FileText size={20} color={RED} />
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: 13, fontWeight: 600 }}>{doc.displayName || doc.filename}</div>
                        <div style={{ fontSize: 11, opacity: 0.55 }}>{doc.size}</div>
                      </div>
                    </div>
                    <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
                      <ActionButton icon={ExternalLink} href={doc.url} title="Ouvrir dans un nouvel onglet">Ouvrir</ActionButton>
                      <ActionButton icon={Download} href={doc.url} download={doc.filename} title="Télécharger">Télécharger</ActionButton>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
        )}

        <div>
          {/* Liste des participants */}
          {event.participants?.length > 0 && (
            <div style={{ marginBottom: 16 }}>
              {mode === 'family' ? (
                // Delta §5 : remplace le résumé abstrait "X famille(s) · Y personne(s)" par
                // "Qui vient ?" + décompte réel de personnes, puis le détail par foyer
                // (display_name déjà autorisé + adultes/enfants, singulier/pluriel géré).
                //
                // P3 (exercice de correction V7.5) : défaut observé — l'inscription du foyer
                // courant était affichée DEUX FOIS : une fois ici (comme n'importe quel autre
                // foyer), une seconde fois dans un bloc "Votre participation" séparé plus bas
                // (mêmes décompte adultes/enfants, mêmes prénoms), avec Modifier/Annuler dans
                // ce second bloc uniquement. Ce bloc séparé n'existe plus (voir plus bas, cas
                // `joined && !editing` -> `null`) : la ligne du foyer courant, ci-dessous, porte
                // désormais une pastille "VOUS" et les actions Modifier/Annuler intégrées
                // directement dans cette même ligne (masquées pendant l'édition, puisque le
                // formulaire ouvert plus bas a alors déjà ses propres actions Enregistrer/
                // Annuler). Les AUTRES foyers et le total global ci-dessus sont strictement
                // inchangés — seule la ligne correspondant à `currentUserId` est concernée.
                <>

                  <div style={{ fontSize: 15, fontWeight: 700, fontFamily: FONT_DISPLAY, textAlign: 'center' }}>Qui vient ?</div>
                  {/* Delta pt 19 : familiesCount était déjà calculé côté serveur
                      (src/agendaApi.js : `familiesCount: participants.length`) mais jamais
                      affiché — seul peopleCount l'était. Les deux sont deux informations
                      distinctes et utiles (nombre de foyers inscrits vs nombre réel de
                      personnes), pas une redite l'une de l'autre.
                      Correctif (point 2, recette réelle sur PC) : ces deux nombres sont
                      maintenant dérivés localement via peopleCountOf/familiesCountOf plutôt
                      que lus depuis event.peopleCount/event.familiesCount, qui n'existent que
                      pour les événements réellement issus de Supabase — un événement "entre
                      familles" de démonstration (MOCK_EVENTS ou harnais de test) affichait
                      auparavant "undefined personne(s) inscrite(s)". */}
                  <div style={{ fontSize: 13, fontWeight: 600, color: MUTED, textAlign: 'center', margin: '2px 0 10px' }}>
                    {peopleCountOf(event.participants)} personne{peopleCountOf(event.participants) > 1 ? 's' : ''} inscrite{peopleCountOf(event.participants) > 1 ? 's' : ''}
                    {' · '}{familiesCountOf(event.participants)} foyer{familiesCountOf(event.participants) > 1 ? 's' : ''}
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                    {event.participants.map((p, i) => {
                      const adults = p.adultsCount ?? 1;
                      const children = p.childrenCount ?? 0;
                      // Point 2 : nom du foyer (membre inscrit) toujours affiché comme avant ;
                      // en plus, quand des prénoms ont été saisis volontairement, ils sont
                      // affichés à la suite — jamais de "?" ni de nom déduit quand ils manquent,
                      // le décompte adultes/enfants brut reste alors la seule information.
                      const names = typeof p === 'string' ? '' : attendeeNamesLine(p.attendeeNames);
                      // P3 : cette ligne est-elle celle du foyer courant ? Seule cette ligne
                      // reçoit la pastille "VOUS" et les actions Modifier/Annuler — toutes les
                      // autres lignes (autres foyers) sont rendues exactement comme avant.
                      const isMine = participantId(p) === currentUserId;
                      return (
                        <div
                          key={participantId(p) || i}
                          style={{
                            fontSize: 13.5, color: INK,
                            background: isMine ? cat.tint : 'transparent',
                            borderRadius: isMine ? 12 : 0,
                            padding: isMine ? '10px 12px' : 0,
                          }}
                        >
                          <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                            <span style={{ fontWeight: 600 }}>{participantLabel(p)}</span>
                            {isMine && (
                              <span style={{ fontSize: 10, fontWeight: 700, color: '#fff', background: cat.color, borderRadius: 999, padding: '2px 7px', letterSpacing: 0.4 }}>
                                VOUS
                              </span>
                            )}
                          </div>
                          <div style={{ color: MUTED }}>
                            {adults} adulte{adults > 1 ? 's' : ''}{children > 0 ? ` · ${children} enfant${children > 1 ? 's' : ''}` : ''}
                          </div>
                          {names && <div style={{ color: MUTED, fontStyle: 'italic' }}>{names}</div>}
                          {/* P3 : Modifier/Annuler intégrées ici, dans la ligne "Vous" elle-même
                              — remplace l'ancien bloc séparé "Votre participation" (supprimé plus
                              bas). Masquées pendant l'édition (`editing`) : le formulaire ouvert
                              plus bas porte alors déjà ses propres actions
                              Enregistrer/Annuler pour ce même foyer — deux jeux de boutons
                              simultanés pour la même action seraient une confusion, pas une aide. */}
                          {/* V7.14 (correctif UAT point 4) : ces deux boutons utilisaient une
                              échelle À PART (minHeight 40, borderRadius 10, padding '8px 12px')
                              — différente de CELLE, unique, du reste des contrôles d'action de
                              cette fiche (48/14, ou son plancher compact 44/14 documenté par
                              `buttonStyle`, theme.js). Reconstruits sur `buttonStyle('secondary'
                              | 'destructive', { compact: true })` : plancher tactile 44px
                              (MIN_TOUCH_TARGET, jamais 40), RADIUS_MD (14) partout, même police
                              de bouton (TEXT.button) que primaryBtn/secondaryBtn ci-dessus —
                              conceptuellement le même type de contrôle (action liée à SA
                              participation), il doit désormais lire comme tel. */}
                          {isMine && !editing && (
                            <div style={{ display: 'flex', gap: SPACING.sm, marginTop: SPACING.sm, flexWrap: 'wrap' }}>
                              <button
                                onClick={startEdit}
                                disabled={rsvpBusy}
                                className="tap-surface"
                                style={{
                                  ...buttonStyle('secondary', { color: BLUE, compact: true }),
                                  padding: '0 14px', flex: '0 0 auto',
                                  opacity: rsvpBusy ? 0.6 : 1, cursor: rsvpBusy ? 'default' : 'pointer',
                                }}
                              >
                                <Pencil size={13} /> Modifier
                              </button>
                              <button
                                onClick={() => setConfirmingLeave(true)}
                                disabled={rsvpBusy}
                                className="tap-surface"
                                style={{
                                  ...buttonStyle('destructive', { compact: true }),
                                  padding: '0 14px', flex: '0 0 auto',
                                  opacity: rsvpBusy ? 0.6 : 1, cursor: rsvpBusy ? 'default' : 'pointer',
                                }}
                              >
                                Annuler ma participation
                              </button>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </>
              ) : (
                <>
                  {/* Delta §6.1 : compteur + pastilles centrés pour l'accompagnement (élément
                      structurant de la fiche) — le mode "simple" (rare, pas d'instance peuplée
                      actuellement) garde son alignement gauche d'origine, non concerné par ce
                      point du brief. */}
                  <div style={{ fontSize: 13, fontWeight: 600, opacity: 0.7, marginBottom: 8, textAlign: mode === 'accompaniment' ? 'center' : 'left' }}>
                    {headerLabel}
                  </div>
                  {showAllParticipants ? (
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, justifyContent: mode === 'accompaniment' ? 'center' : 'flex-start' }}>
                      {event.participants.map((p, i) => (
                        <span key={participantId(p) || i} style={{ fontSize: 12.5, background: '#F1F1EF', borderRadius: 999, padding: '4px 10px' }}>{participantLabel(p)}</span>
                      ))}
                      <button type="button" onClick={() => setShowAllParticipants(false)} className="tap-surface" style={{ fontSize: 11.5, color: BLUE, background: 'none', border: 'none', fontWeight: 600, padding: '4px 6px', borderRadius: 6 }}>
                        Réduire
                      </button>
                    </div>
                  ) : (
                    <>
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 2, justifyContent: mode === 'accompaniment' ? 'center' : 'flex-start' }}>
                        {event.participants.slice(0, 6).map((p, i) => {
                          const pid = participantId(p) || i;
                          return (
                            // Correctif : survol desktop (hoveredId, instantané) ET tap tactile
                            // (onClick -> revealedId, persiste jusqu'au tap suivant) déclenchent
                            // désormais le même bandeau de nom sous la rangée — `title` conservé
                            // en repli (lecteur d'écran, recherche navigateur) mais plus la seule
                            // voie pour voir le nom au survol.
                            <button
                              key={pid}
                              type="button"
                              onClick={() => setRevealedId(revealedId === pid ? null : pid)}
                              onMouseEnter={() => setHoveredId(pid)}
                              onMouseLeave={() => setHoveredId((h) => (h === pid ? null : h))}
                              onFocus={() => setHoveredId(pid)}
                              onBlur={() => setHoveredId((h) => (h === pid ? null : h))}
                              aria-label={participantLabel(p)}
                              title={participantLabel(p)}
                              className="tap-surface"
                              style={{
                                width: 32, height: 32, borderRadius: '50%', background: '#D9D2BC', color: '#fff', fontSize: 12, fontWeight: 700,
                                display: 'flex', alignItems: 'center', justifyContent: 'center', marginLeft: i === 0 ? 0 : -8, border: '2px solid #FFFFFF',
                              }}
                            >
                              {participantLabel(p).slice(0, 1).toUpperCase()}
                            </button>
                          );
                        })}
                        {event.participants.length > 6 && (
                          <button
                            type="button"
                            onClick={() => setShowAllParticipants(true)}
                            aria-label={`Voir les ${event.participants.length - 6} autres accompagnateurs`}
                            className="tap-surface"
                            style={{ width: 32, height: 32, borderRadius: '50%', background: CARD_BORDER, fontSize: 11, fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center', marginLeft: -8, border: '2px solid #FFFFFF' }}
                          >
                            +{event.participants.length - 6}
                          </button>
                        )}
                      </div>
                      {(hoveredId ?? revealedId) != null && (
                        <div style={{ textAlign: 'center', fontSize: 12.5, color: INK, marginTop: 8 }}>
                          {participantLabel(event.participants.find((p, i) => (participantId(p) || i) === (hoveredId ?? revealedId)))}
                        </div>
                      )}
                    </>
                  )}
                </>
              )}
            </div>
          )}
          {/* Correctif (2e contre-vérification, ZIP V7.2) : ce message restait affiché
              au-dessus du formulaire d'inscription pendant la SAISIE elle-même (steppers
              Adultes/Enfants déjà à 2/1, par exemple) — contradiction visuelle directe avec
              ce qu'on est en train de saisir juste en dessous. `editing` (vrai dès qu'un
              formulaire d'inscription/modification est ouvert, dans les 3 modes) masque ce
              texte tant que la saisie est en cours ; il ne réapparaît, si toujours pertinent,
              qu'une fois revenu à l'état non-édition (confirmé ou annulé). */}
          {event.participants?.length === 0 && !editing && (
            <p style={{ fontSize: 12.5, color: MUTED, textAlign: 'center', margin: '0 0 16px' }}>
              {mode === 'accompaniment' ? 'Aucun accompagnateur pour le moment' : 'Aucun participant pour le moment'}
            </p>
          )}

          {/* ============ UN SEUL BLOC PARTICIPATION, selon le mode ============ */}

          {mode === 'family' && (
            editing ? (
              <div style={{ background: '#fff', border: `1px solid ${CARD_BORDER}`, borderRadius: 18, padding: '14px 16px', marginBottom: 8 }}>
                <div style={{ fontSize: 15, fontWeight: 700, fontFamily: FONT_DISPLAY, marginBottom: 2 }}>Vous venez à combien ?</div>
                <div style={{ borderTop: `1px solid ${CARD_BORDER}`, marginTop: 8 }}>
                  <Stepper label="Adultes" value={draftAdults} onChange={setAdultsCount} min={0} />
                  <div style={{ borderTop: `1px solid ${CARD_BORDER}` }} />
                  <Stepper label="Enfants" value={draftChildren} onChange={setChildrenCount} min={0} />
                </div>
                {draftAdults + draftChildren === 0 && (
                  <p style={{ fontSize: 12, color: RED, margin: '8px 0 0' }}>Au moins une personne doit être indiquée.</p>
                )}
                {/* P5 (exercice de correction V7.5) : avertissement PROACTIF — affiché AVANT
                    toute tentative d'enregistrement, dès que fetchAgendaEvents a dû lire
                    l'agenda sans `attendee_names` (colonne absente, migration sql/05 pas encore
                    appliquée sur ce projet Supabase). La saisie reste ouverte et fonctionnelle
                    (jamais désactivée) : les compteurs adultes/enfants seront bien enregistrés
                    quoi qu'il arrive — seuls les prénoms saisis ici ne le seront pas tant que la
                    migration n'est pas appliquée, ce que ce message dit explicitement plutôt que
                    de laisser croire à une saisie normale qui se perdrait en silence. */}
                {attendeeNamesUnsupported && (
                  <p style={{ fontSize: 12, color: MUTED, background: '#F1F1EF', borderRadius: 10, padding: '8px 10px', margin: '10px 0 0', lineHeight: 1.4 }}>
                    Les prénoms saisis ci-dessous ne pourront pas être enregistrés pour le moment
                    (mise à jour de la base en attente) — les effectifs (adultes/enfants), eux,
                    seront bien pris en compte.
                  </p>
                )}
                <NameInputs label="Adulte" names={draftAdultNames} onChange={setAdultName} />
                <NameInputs label="Enfant" names={draftChildNames} onChange={setChildName} />
                <div style={{ display: 'flex', gap: 8, marginTop: 14 }}>
                  {joined && (
                    <button onClick={() => setEditing(false)} className="tap-surface" style={{ flex: 1, padding: '12px 0', borderRadius: 14, border: `1px solid ${CARD_BORDER}`, background: '#fff', fontSize: 14, fontWeight: 600, color: INK, minHeight: 48 }}>
                      Annuler
                    </button>
                  )}
                  <button
                    onClick={confirmFamily}
                    disabled={draftAdults + draftChildren === 0 || rsvpBusy}
                    className={draftAdults + draftChildren === 0 || rsvpBusy ? undefined : 'tap-surface'}
                    style={{ ...primaryBtn(cat.color, draftAdults + draftChildren === 0 || rsvpBusy, cat.onColor), flex: 1 }}
                  >
                    {joined ? 'Enregistrer' : 'Confirmer ma participation'}
                  </button>
                </div>
              </div>
            ) : !joined ? (
              <button onClick={startJoinFamily} disabled={rsvpBusy} className={rsvpBusy ? undefined : 'tap-surface'} style={primaryBtn(cat.color, rsvpBusy, cat.onColor)}>
                Vous venez à combien ?
              </button>
            ) : (
              // P3 (exercice de correction V7.5) : plus rien à afficher ici — l'ancien bloc
              // "Votre participation" (décompte + prénoms + Modifier/Annuler), redondant avec la
              // ligne "VOUS" de la liste "Qui vient ?" ci-dessus (mêmes informations, mêmes
              // actions), a été supprimé. Cette ligne porte maintenant seule ce contenu, avec les
              // actions Modifier/Annuler intégrées directement dedans (voir plus haut).
              null
            )
          )}

          {mode === 'accompaniment' && (
            <div style={{ background: '#fff', border: `1px solid ${CARD_BORDER}`, borderRadius: 18, padding: '14px 16px' }}>
              <div style={{ fontSize: 15, fontWeight: 700, fontFamily: FONT_DISPLAY, marginBottom: 2 }}>Accompagnement</div>
              {joined ? (
                <>
                  <p style={{ fontSize: 13.5, color: INK, margin: '4px 0 12px' }}>Vous êtes disponible pour accompagner.</p>
                  <button onClick={onLeave} disabled={rsvpBusy} className="tap-surface" style={secondaryBtn(rsvpBusy)}>Me retirer</button>
                </>
              ) : (
                <>
                  <p style={{ fontSize: 13.5, color: MUTED, margin: '4px 0 12px' }}>Vous pouvez accompagner cette sortie ?</p>
                  <button onClick={() => onJoin({ adultsCount: 1, childrenCount: 0 })} disabled={rsvpBusy} className={rsvpBusy ? undefined : 'tap-surface'} style={primaryBtn(cat.color, rsvpBusy, cat.onColor)}>
                    {joined && <Check size={16} />} Je peux accompagner
                  </button>
                </>
              )}
            </div>
          )}

          {mode === 'simple' && (
            <div style={{ background: '#fff', border: `1px solid ${CARD_BORDER}`, borderRadius: 18, padding: '14px 16px' }}>
              {joined ? (
                <>
                  <p style={{ fontSize: 13.5, color: INK, margin: '0 0 12px', display: 'flex', alignItems: 'center', gap: 6 }}>
                    <Check size={15} color={cat.color} /> Vous participez.
                  </p>
                  <button onClick={onLeave} disabled={rsvpBusy} className="tap-surface" style={secondaryBtn(rsvpBusy)}>Je ne participe pas</button>
                </>
              ) : (
                <button onClick={() => onJoin({ adultsCount: 1, childrenCount: 0 })} disabled={rsvpBusy} className={rsvpBusy ? undefined : 'tap-surface'} style={primaryBtn(cat.color, rsvpBusy, cat.onColor)}>
                  Je participe
                </button>
              )}
            </div>
          )}

          {/* V7.14 (correctif UAT point 4) : "Voir la discussion liée" et "Supprimer
              l'événement" avaient chacun leur propre `marginTop` (12 puis 10) au lieu d'un
              espacement uniforme, et le premier avait une bordure NEUTRE (`CARD_BORDER`) avec un
              texte/icône BLUE — un troisième traitement visuel, ni `primaryBtn` ni
              `secondaryBtn`. Un seul conteneur avec un `gap` unique (`SPACING.md`) remplace les
              deux marges ad hoc ; les deux boutons partagent maintenant `buttonStyle('secondary'
              | 'destructive')` — même échelle (48/14) que primaryBtn/secondaryBtn ci-dessus,
              bordure de la MÊME couleur que le texte (cohérent avec la variante "secondary"
              documentée dans theme.js), plutôt qu'un style bespoke supplémentaire. */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: SPACING.md, marginTop: SPACING.md }}>
            {event.hasLinkedThread && (
              <button
                onClick={onOpenThread}
                className="tap-surface"
                style={{
                  ...buttonStyle('secondary', { color: BLUE }),
                  width: '100%',
                }}
              >
                <MessageCircle size={16} /> Voir la discussion liée
              </button>
            )}

            {/* V7.11 (P0) — défaut confirmé en UAT réelle : A2 (admin) n'avait AUCUNE commande de
                suppression, nulle part dans l'Agenda ni sur cette fiche. `canDeleteEvent` (calculé
                par App.jsx : créateur de l'événement OU admin de la communauté, et uniquement pour
                un événement réellement issu de l'agenda Supabase) — jamais recalculé ici, une
                seule source de vérité. Volontairement discret (contour, pas de remplissage plein)
                et placé en fin de fiche, séparé visuellement du bloc participation — une action de
                suppression n'est jamais mise en avant comme une action principale de la page. */}
            {canDeleteEvent && (
              <button
                onClick={() => setConfirmingDelete(true)}
                disabled={deleteBusy}
                className={deleteBusy ? undefined : 'tap-surface'}
                style={{
                  ...buttonStyle('destructive'),
                  width: '100%',
                  opacity: deleteBusy ? 0.6 : 1, cursor: deleteBusy ? 'default' : 'pointer',
                }}
              >
                <Trash2 size={15} /> Supprimer l'événement
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
    {confirmingLeave && (
      <ConfirmCancelDialog
        onKeep={() => setConfirmingLeave(false)}
        onConfirm={confirmCancelParticipation}
        busy={rsvpBusy}
      />
    )}
    {confirmingDelete && (
      <ConfirmDeleteEventDialog
        onCancel={() => setConfirmingDelete(false)}
        onConfirm={async () => {
          // V7.11 (P0) : la confirmation se ferme dans tous les cas (succès ou échec) — en cas
          // d'échec, App.jsx affiche l'erreur honnête (dataError, bandeau visible même sur
          // cette fiche puisqu'on n'a pas navigué) et `event` reste affiché tel quel, jamais
          // touché localement avant confirmation réelle du serveur.
          await onDeleteEvent();
          setConfirmingDelete(false);
        }}
        busy={deleteBusy}
      />
    )}
    </>
  );
}
