import { useMemo, useRef } from 'react';
import { CircleAlert, ChevronRight, Image, FileText, Link2, Info, CalendarDays, CakeSlice, Search, X, CalendarPlus, MessageCircle } from 'lucide-react';
import { BLUE, RED, INK, MUTED, CARD_BORDER, CATEGORIES, SECTION_THEMES, categoryOf, FONT_DISPLAY } from '../theme';
import { anyFieldMatches } from '../searchUtils';
import { nextOccurrence, isUpcomingEvent } from '../agendaSearch';
import { MEMBERS, childrenOf } from '../data';
import { useScrollRestore } from '../useScrollRestore';
// V7.7 (P2) : dernier message de l'Accueil désormais trié sur le vrai `created_at` (via cette
// même fonction pure que Messages.jsx utilise déjà), jamais sur l'ordre d'arrivée réseau — un
// message reçu en second via Realtime mais horodaté AVANT un autre ne doit pas se faire passer
// pour "le plus récent" simplement parce qu'il est arrivé en dernier dans le tableau `thread`.
import { sortMessagesChronologically } from '../messageSearch';
// V7.8 : même fonction que Messages.jsx (extraite dans ce module partagé) — corrige un bug
// signalé par contre-vérification indépendante : cet écran affichait "Aujourd'hui à HH:MM"
// pour CHAQUE dernier message, même quand sa vraie date était hier ou plus ancienne.
import { dateSeparatorLabel } from '../dateLabels.js';
import PageTitle from '../components/PageTitle';
import Button from '../components/Button';

// Brief §9 : une information importante ne mène qu'à son propre contenu réellement lié —
// jamais à "le prochain événement, peu importe lequel". "Rentrée décalée à 8h45 vendredi"
// correspond à l'événement École réel 'evt-rentree' (voir data.js) : c'est CE lien précis,
// pas nextEvent, qui doit s'ouvrir. Si l'événement lié n'existe pas dans les données reçues
// (ex. pas encore migré côté Supabase), le chevron disparaît et la ligne devient non cliquable
// plutôt que de mentir sur une destination inexistante.
const IMPORTANT_INFOS = [
  { id: 'info-rentree', text: 'Rentrée décalée à 8h45 vendredi.', linkedEventId: 'evt-rentree' },
];

const SHARE_ICONS = { document: FileText, photo: Image, lien: Link2, info: Info };

function fmtShortDate(dateStr) {
  const d = new Date(dateStr + 'T00:00:00');
  return d.toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' });
}
function capitalize(s) { return s ? s.charAt(0).toUpperCase() + s.slice(1) : s; }

export default function Accueil({
  events, thread, shares, onOpenEvent, onOpenMessage, onOpenShare, onOpenMember,
  onViewAllMessages, onViewAllPartages, onCreateEvent, onWriteMessage,
  query, onQueryChange,
  restoreState, onRestoreConsumed,
  // V7.8 (correctif) : états dédiés Messages, transmis par App.jsx exactement comme à
  // Messages.jsx — avant ce lot, ils n'étaient PAS transmis ici, si bien que "Derniers
  // messages" affichait "Aucun message pour l'instant." pendant le chargement initial ET en
  // cas d'échec réseau, confondant les trois états (chargement, erreur, fil réellement vide).
  messagesLoading, messagesError,
}) {
  const searchInputRef = useRef(null);

  // Delta §2.2/§26 + lot consolidé UX/navigation (point 8) : la recherche Accueil est
  // désormais levée dans App.jsx (comme les 4 autres pages) — la recette manuelle a montré
  // qu'un aller-retour vers un résultat de recherche perdait sinon silencieusement la requête
  // tapée, le composant étant démonté/remonté à chaque changement de vue. useScrollRestore
  // s'occupe du scroll + du focus + du repère visuel bref sur le résultat/la carte d'origine.
  useScrollRestore(restoreState, onRestoreConsumed);

  // Correctif UAT V7.14 (point 15, bug confirmé) : ce tri ne filtrait auparavant AUCUN événement
  // déjà passé — un jeu de données entièrement au passé affichait quand même "le plus ancien du
  // lot" comme "Prochain événement". `isUpcomingEvent` (agendaSearch.js, testée par
  // scripts/test-upcoming-events.mjs) compare date ET heure en heure locale ; un événement daté
  // sans heure reste "à venir" jusqu'à la fin de son jour calendaire, jamais exclu à 00h01.
  const now = new Date();
  const nextEvent = [...events]
    .filter((e) => e.category !== 'anniversaire' && isUpcomingEvent(e, now))
    .sort((a, b) => new Date(a.date) - new Date(b.date))[0];
  // Correction (contre-vérification indépendante, 2e passe) : prenait auparavant le premier
  // anniversaire trouvé dans le tableau (ordre d'arrivée, pas ordre chronologique) et
  // affichait "Samedi" en dur, peu importe la vraie date. Trie maintenant par prochaine
  // occurrence réelle (même fonction que Agenda.jsx utilise pour "À venir", brief §11-16)
  // et affiche le jour de la semaine calculé pour CETTE occurrence.
  const birthdaysWithOccurrence = events
    .filter((e) => e.category === 'anniversaire')
    .map((e) => ({ ...e, _occurrence: nextOccurrence(e.month, e.day) }))
    .sort((a, b) => a._occurrence - b._occurrence);
  const nextBirthday = birthdaysWithOccurrence[0] || null;
  const nextBirthdayLabel = nextBirthday
    ? capitalize(nextBirthday._occurrence.toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' }))
    : '';

  // Dernier message avec du texte réel (brief §7) — plus un texte figé qui ne correspondait
  // à aucun message du fil ; on prend le vrai dernier échange, lié à son vrai identifiant.
  // V7.7 (P2) : `sortMessagesChronologically` appliqué avant l'inversion — sans ça, un fil
  // rechargé (Realtime, ou après une mutation) affichait "le dernier message" comme "le message
  // le plus récemment reçu par le réseau", pas "le message au plus grand created_at réel".
  const lastMessage = [...sortMessagesChronologically(thread)].reverse().find((m) => m.text);
  // Deux derniers partages réels, triés par date (brief §8) — idem, plus deux libellés
  // inventés qui ne correspondaient à aucun partage existant.
  const lastShares = [...shares].sort((a, b) => new Date(b.date) - new Date(a.date)).slice(0, 2);

  // Brief §5/§10 : recherche transversale simple en V1 — pas de moteur séparé, réutilise la
  // normalisation commune (accents/casse/apostrophes) partagée avec Messages/Partages/La Bande.
  const q = query.trim();
  const searching = q.length > 0;
  const eventResults = useMemo(() => {
    if (!searching) return [];
    return events.filter((e) => anyFieldMatches([e.title, e.location], q));
  }, [searching, q, events]);
  const messageResults = useMemo(() => {
    if (!searching) return [];
    return thread.filter((m) => anyFieldMatches([m.text, m.author, m.file?.name], q));
  }, [searching, q, thread]);
  const shareResults = useMemo(() => {
    if (!searching) return [];
    return shares.filter((s) => anyFieldMatches([s.title, s.description, s.author], q));
  }, [searching, q, shares]);
  // Correction (contre-vérification indépendante, 2e passe) : "Rechercher dans ABCZed…" est
  // annoncée comme transversale mais ignorait La Bande. Même normalisation, sur parent +
  // enfants + groupe — cohérent avec la recherche propre de La Bande (LaBande.jsx).
  const memberResults = useMemo(() => {
    if (!searching) return [];
    return MEMBERS.filter((m) => {
      const kids = childrenOf(m);
      return anyFieldMatches([m.firstName, m.lastName, ...kids.map((c) => c.firstName), ...kids.map((c) => c.groupLabel)], q);
    });
  }, [searching, q]);
  const noResults = searching && eventResults.length === 0 && messageResults.length === 0 && shareResults.length === 0 && memberResults.length === 0;

  function clearQuery() {
    onQueryChange('');
    searchInputRef.current?.focus();
  }

  return (
    <div className="page-shell" style={{ '--section-accent': SECTION_THEMES.accueil.color }}>
      <PageTitle section="accueil">Accueil</PageTitle>

      {/* Recherche contextuelle (brief §1/§5) — même largeur/style que les recherches
          Agenda/Partages/La Bande, pour la même grille commune aux 5 pages.
          Delta §11 : bouton "x" pour vider le champ d'un geste, sans casser le focus. */}
      <div className="search-field" style={{ display: 'flex', alignItems: 'center', gap: 8, background: '#FFFFFF', border: `1px solid ${CARD_BORDER}`, borderRadius: 999, marginBottom: 16 }}>
        <Search size={16} color={MUTED} />
        <input
          ref={searchInputRef}
          value={query}
          onChange={(e) => onQueryChange(e.target.value)}
          placeholder="Rechercher dans ABCZed…"
          style={{ flex: 1, border: 'none', outline: 'none', fontSize: 13.5, background: 'transparent' }}
        />
        {query && (
          <button type="button" onClick={clearQuery} aria-label="Effacer la recherche" className="tap-surface icon-button" style={{ background: 'none', border: 'none', flexShrink: 0 }}>
            <X size={14} color={MUTED} />
          </button>
        )}
      </div>

      {searching ? (
        <div>
          {noResults && <p style={{ fontSize: 13, opacity: 0.5, textAlign: 'center', marginTop: 24 }}>Aucun résultat pour « {query} ».</p>}
          {eventResults.length > 0 && (
            <>
              <SectionTitle>Agenda</SectionTitle>
              {eventResults.map((e) => (
                <Row key={e.id} onClick={() => e.category !== 'anniversaire' && onOpenEvent(e.id, `home-search-event-${e.id}`)} id={`home-search-event-${e.id}`}>
                  <div style={{ width: 34, height: 34, borderRadius: 9, background: categoryOf(e).tint, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                    <CalendarDays size={16} color={categoryOf(e).color} />
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 14, fontWeight: 600 }}>{e.title}</div>
                    {e.location && <div style={{ fontSize: 12, opacity: 0.6 }}>{e.location}</div>}
                  </div>
                </Row>
              ))}
            </>
          )}
          {messageResults.length > 0 && (
            <>
              <SectionTitle>Messages</SectionTitle>
              {messageResults.map((m) => (
                <Row key={m.id} onClick={() => onOpenMessage(m.id, `home-search-message-${m.id}`)} id={`home-search-message-${m.id}`}>
                  <Avatar initials={m.initials} color={m.color} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 13.5 }}><b>{m.author}</b> — {m.text || m.file?.name}</div>
                  </div>
                </Row>
              ))}
            </>
          )}
          {shareResults.length > 0 && (
            <>
              <SectionTitle>Partages</SectionTitle>
              {shareResults.map((s) => {
                const Icon = SHARE_ICONS[s.type] || Info;
                return (
                  <Row key={s.id} onClick={() => onOpenShare(s.id, `home-search-share-${s.id}`)} id={`home-search-share-${s.id}`}>
                    <div style={{ width: 34, height: 34, borderRadius: 9, background: '#F1F1EF', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                      <Icon size={16} color={BLUE} />
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 14, fontWeight: 600 }}>{s.title}</div>
                    </div>
                  </Row>
                );
              })}
            </>
          )}
          {memberResults.length > 0 && (
            <>
              <SectionTitle>La Bande</SectionTitle>
              {memberResults.map((m) => {
                const kids = childrenOf(m);
                return (
                  <Row key={m.id} onClick={() => onOpenMember(m.id, `home-search-member-${m.id}`)} id={`home-search-member-${m.id}`}>
                    <div style={{ width: 34, height: 34, borderRadius: '50%', background: m.avatarColor, color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13, fontWeight: 700, flexShrink: 0 }}>
                      {m.firstName.slice(0, 1)}
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 14, fontWeight: 600 }}>{m.firstName} {m.lastName}</div>
                      {kids.length > 0 && <div style={{ fontSize: 12, opacity: 0.6 }}>{kids.map((c) => `${c.label} de ${c.firstName}`).join(' — ')}</div>}
                    </div>
                  </Row>
                );
              })}
            </>
          )}
        </div>
      ) : (
        <>
          {/* V7.12 — actions de création visibles dès l'Accueil. Elles réutilisent les flux
              existants : le formulaire Agenda et le compositeur Messages, sans recréer deux
              implémentations concurrentes ni réintroduire le bouton + global ambigu.
              V7.14 (correctif UAT point 6) : ces deux boutons étaient en fond teinté pâle +
              bordure colorée — exactement le motif "pastel délavé" signalé. Ils passent en
              aplat solide (composant partagé `Button`, variante 'primary') avec le texte
              `onColor` correspondant, conformément à la convention couleur de src/theme.js.
              `.home-quick-actions` (règle globale, App.jsx) les empile verticalement sous
              ~340px si jamais l'un des deux libellés ne tient plus sur une ligne — mesuré :
              à 320px avec ce nouveau style, les deux tiennent encore côte à côte sans
              débordement (voir scripts/test-design-system.mjs et
              test-harness/recette-v714.mjs), la règle est un filet de sécurité, pas un
              correctif d'un bug observé. */}
          <div className="home-quick-actions" style={{ marginBottom: 16 }}>
            <Button
              id="home-create-event"
              onClick={onCreateEvent}
              icon={CalendarPlus}
              color={SECTION_THEMES.agenda.color}
              onColor={SECTION_THEMES.agenda.onColor}
            >
              Créer un événement
            </Button>
            <Button
              id="home-write-message"
              onClick={onWriteMessage}
              icon={MessageCircle}
              color={SECTION_THEMES.messages.color}
              onColor={SECTION_THEMES.messages.onColor}
            >
              Écrire un message
            </Button>
          </div>

          {/* Le p'tit billet */}
          <div style={{ background: '#FFFFFF', border: `1px solid ${CARD_BORDER}`, borderLeft: `4px solid ${RED}`, borderRadius: 18, padding: 16, marginBottom: 16 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
              <span style={{ fontWeight: 700, color: RED, fontSize: 15 }}>Le p'tit billet</span>
              <span style={{ fontSize: 11, opacity: 0.5 }}>aujourd'hui</span>
            </div>
            <p style={{ fontSize: 16, lineHeight: 1.45, margin: '8px 0 0', color: INK }}>
              Bienvenue sur ABCZed ! Ici, on simplifie la vie de la bande : sorties, infos utiles,
              messages, photos et contacts réunis au même endroit. Chacun peut partager, proposer,
              aider et faire vivre cet espace. Merci d'en prendre soin ensemble ! ❤️
            </p>
          </div>

          {/* Informations importantes — titre centré (delta §4.1), pas de CTA (§4.3 : tant
              qu'il n'existe pas de vraie liste/historique dédié, un "Tout voir" serait
              artificiel). */}
          <SectionTitle>Informations importantes</SectionTitle>
          {IMPORTANT_INFOS.map((info) => {
            // Cherche d'abord dans les vraies données Agenda, puis dans les événements de
            // démonstration (mêmes ids que 'evt-rentree') — même repli que App.jsx pour
            // selectedEvent, pour rester cohérent tant que les données ne sont pas unifiées.
            const target = events.find((e) => e.id === info.linkedEventId);
            return (
              <Row
                key={info.id}
                id={`home-info-${info.id}`}
                icon={<CircleAlert size={18} color={RED} />}
                onClick={target ? () => onOpenEvent(target.id, `home-info-${info.id}`) : undefined}
                noChevron={!target}
              >
                <span style={{ fontSize: 13.5 }}>{info.text}</span>
              </Row>
            );
          })}

          {/* Prochain événement — titre centré (§4.1), pas de CTA (§4.3 : l'Agenda existe déjà
              comme destination complète). */}
          {nextEvent && (
            <>
              <SectionTitle>Prochain événement</SectionTitle>
              <Row id={`home-nextevent-${nextEvent.id}`} onClick={() => onOpenEvent(nextEvent.id, `home-nextevent-${nextEvent.id}`)}>
                <div style={{ width: 34, height: 34, borderRadius: 9, background: categoryOf(nextEvent).tint, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                  <CalendarDays size={16} color={categoryOf(nextEvent).color} />
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 14, fontWeight: 600 }}>{nextEvent.title}</div>
                  <div style={{ fontSize: 12, opacity: 0.6 }}>
                    {fmtShortDate(nextEvent.date)}{nextEvent.startTime ? ` à ${nextEvent.startTime}` : ''}{nextEvent.location ? ` · ${nextEvent.location}` : ''}
                  </div>
                </div>
              </Row>
            </>
          )}

          {/* Anniversaire — rappel seul, non cliquable, pas de fiche événement */}
          {nextBirthday && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, background: CATEGORIES.anniversaire.tint, border: `1px solid ${CATEGORIES.anniversaire.color}33`, borderRadius: 18, padding: '12px 14px', marginBottom: 16 }}>
              <CakeSlice size={20} color={CATEGORIES.anniversaire.color} />
              <div>
                <div style={{ fontSize: 14, fontWeight: 600 }}>{nextBirthday.title}</div>
                <div style={{ fontSize: 12, opacity: 0.65 }}>{nextBirthdayLabel}</div>
              </div>
            </div>
          )}

          {/* Derniers messages — titre centré (§4.1), CTA explicite SOUS le contenu (§4.2),
              plus l'ancien petit "Tout voir" accolé au titre qui cassait le centrage.
              V7.8 (correctif) : trois états désormais distingués, jamais confondus — chargement
              initial, erreur réseau réelle (même style que le bandeau de Messages.jsx, jamais
              un repli silencieux), et fil réellement vide APRÈS une lecture réussie. Avant ce
              lot, `messagesLoading`/`messagesError` n'étaient pas transmis à cet écran : un
              chargement en cours ou un échec réseau affichaient tous deux, à tort, le texte
              "Aucun message pour l'instant." */}
          <SectionTitle>Derniers messages</SectionTitle>
          {messagesError ? (
            <div style={{ background: '#FCE9E7', border: '1px solid #D9463033', borderRadius: 10, padding: '8px 12px', fontSize: 12, color: '#8A2E1F' }}>
              {messagesError}
            </div>
          ) : messagesLoading ? (
            <p style={{ fontSize: 13, opacity: 0.5 }}>Chargement des messages…</p>
          ) : lastMessage ? (
            <Row id="home-lastmessage" onClick={() => onOpenMessage(lastMessage.id, 'home-lastmessage')}>
              <Avatar initials={lastMessage.initials} color={lastMessage.color} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 13.5 }}><b>{lastMessage.author}</b> — {lastMessage.text}</div>
                {/* V7.8 (correctif) : étiquette calculée à partir de la vraie date du message
                    (Aujourd'hui / Hier / date complète), jamais "Aujourd'hui" en dur — voir
                    ../dateLabels.js. */}
                <div style={{ fontSize: 11.5, opacity: 0.55 }}>{dateSeparatorLabel(lastMessage.date)} à {lastMessage.time}</div>
              </div>
            </Row>
          ) : (
            <p style={{ fontSize: 13, opacity: 0.5 }}>Aucun message pour l'instant.</p>
          )}
          <SectionCTA id="home-viewall-messages" onClick={onViewAllMessages}>Voir tous les messages</SectionCTA>

          {/* Derniers partages — même traitement (§4.1/§4.2). */}
          <SectionTitle>Derniers partages</SectionTitle>
          <div style={{ display: 'flex', gap: 10, marginBottom: 8 }}>
            {lastShares.map((s) => {
              const Icon = SHARE_ICONS[s.type] || Info;
              return <ShareTile key={s.id} id={`home-share-${s.id}`} icon={<Icon size={16} color={s.type === 'document' ? RED : BLUE} />} label={s.title} onClick={() => onOpenShare(s.id, `home-share-${s.id}`)} />;
            })}
          </div>
          <SectionCTA id="home-viewall-partages" onClick={onViewAllPartages}>Voir tous les partages</SectionCTA>
        </>
      )}
    </div>
  );
}

// Delta §4.1/§24 : tous les titres de section de l'Accueil sont désormais centrés — élément
// structurant, contrairement au contenu des cartes qui reste aligné naturellement pour la
// lecture (§24 : ne pas appliquer un text-align:center global, seulement aux titres).
function SectionTitle({ children }) {
  return <div style={{ fontSize: 17, fontWeight: 700, fontFamily: FONT_DISPLAY, color: INK, margin: '22px 0 10px', textAlign: 'center' }}>{children}</div>;
}
// Delta §4.2 : CTA explicite sous le contenu, centré, avec une vraie zone tactile — remplace
// l'ancien petit lien "Tout voir" accolé au titre de section (qui empêchait ce dernier d'être
// centré et créait une ambiguïté d'appartenance visuelle).
function SectionCTA({ children, onClick, id }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'center', margin: '10px 0 4px' }}>
      <button
        id={id}
        onClick={onClick}
        className="tap-surface"
        style={{
          display: 'flex', alignItems: 'center', gap: 6, background: 'none',
          border: `1.5px solid ${BLUE}`, borderRadius: 999, padding: '10px 18px', minHeight: 40,
          fontSize: 13, color: BLUE, fontWeight: 700,
        }}
      >
        {children} <ChevronRight size={14} />
      </button>
    </div>
  );
}
function Row({ children, onClick, icon, noChevron, id }) {
  const clickable = Boolean(onClick);
  return (
    <button
      id={id}
      onClick={onClick}
      disabled={!clickable}
      className={clickable ? 'tap-surface' : undefined}
      style={{
        width: '100%', display: 'flex', alignItems: 'center', gap: 12, textAlign: 'left',
        background: '#FFFFFF', border: `1px solid ${CARD_BORDER}`, borderRadius: 18, padding: '12px 14px', marginBottom: 8,
        cursor: clickable ? 'pointer' : 'default',
      }}
    >
      {icon}
      {children}
      {!noChevron && <ChevronRight size={16} color={MUTED} style={{ marginLeft: 'auto', flexShrink: 0 }} />}
    </button>
  );
}
function Avatar({ initials, color }) {
  return (
    <div style={{ width: 34, height: 34, borderRadius: '50%', background: color, color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13, fontWeight: 700, flexShrink: 0 }}>
      {initials}
    </div>
  );
}
function ShareTile({ icon, label, onClick, id }) {
  return (
    <button id={id} onClick={onClick} className="tap-surface" style={{ flex: 1, background: '#FFFFFF', border: `1px solid ${CARD_BORDER}`, borderRadius: 18, padding: '14px 12px', textAlign: 'left' }}>
      {icon}
      <div style={{ fontSize: 12, marginTop: 8 }}>{label}</div>
    </button>
  );
}
