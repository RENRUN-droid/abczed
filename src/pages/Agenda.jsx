import { useEffect, useRef, useState } from 'react';
import { ChevronLeft, ChevronRight, MapPin, Users, Plus, Search, X, CakeSlice, UsersRound, School, Ellipsis } from 'lucide-react';
import { BLUE, INK, MUTED, CARD_BORDER, CATEGORIES, ALL_FILTER_COLOR, SECTION_THEMES, categoryOf, FONT_DISPLAY } from '../theme';
import DayDots from '../components/DayDots';
import PageTitle from '../components/PageTitle';
import { computeFilteredEvents, eventsOnDate as eventsOnDateFrom, upcomingExcludingSelected, isSelectedDateStillValid, nextOccurrence, pad, impliedCategoryOf, peopleCountOf, eventModeOf, participantsSummaryLabel, isUpcomingEvent } from '../agendaSearch';
import { useScrollRestore } from '../useScrollRestore';
import { supportsHoverPointer, afterPaint, prefersReducedMotion } from '../motionPrefs';

// Brief pts 7-9 : date correspondante d'une ligne "À venir" — calcule la même chaîne
// YYYY-MM-DD que les cellules du calendrier (`dateStr` dans `monthGrid`), sans repasser par
// `new Date(e.date)` qui décale d'un jour dans certains fuseaux (parsing UTC d'une date sans
// heure) — un événement daté garde directement sa chaîne, seul l'anniversaire (jour/mois sans
// année) a besoin du calcul de prochaine occurrence.
function eventDateStr(e) {
  if (e.date) return e.date;
  const d = nextOccurrence(e.month, e.day, TODAY);
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

const WEEKDAYS = ['LUN', 'MAR', 'MER', 'JEU', 'VEN', 'SAM', 'DIM'];
const MONTH_NAMES = ['Janvier', 'Février', 'Mars', 'Avril', 'Mai', 'Juin', 'Juillet', 'Août', 'Septembre', 'Octobre', 'Novembre', 'Décembre'];
const TODAY = new Date();

function monthGrid(year, monthIndex) {
  const first = new Date(year, monthIndex, 1);
  const startOffset = (first.getDay() + 6) % 7;
  const daysInMonth = new Date(year, monthIndex + 1, 0).getDate();
  const cells = [];
  for (let i = 0; i < startOffset; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(new Date(year, monthIndex, d));
  return cells;
}

export default function Agenda({
  events, onOpenEvent, onOpenBirthday, onAdd,
  filter, onFilterChange,
  year, monthIndex, onMonthChange,
  selectedDate, onSelectedDateChange,
  searchQuery, onSearchChange,
  restoreState, onRestoreConsumed,
}) {
  const searchInputRef = useRef(null);
  // Brief pts 7-9 : survol desktop d'une ligne "À venir" → mise en évidence de sa date dans le
  // calendrier, sans jamais toucher `selectedDate` (état contrôlé, remonté à App.jsx) — un
  // simple état local suffit puisque rien ici ne doit survivre à un changement de page/mois.
  const [hoveredDate, setHoveredDate] = useState(null);

  // Delta §2.2/§26 : filtre/mois/année/date sélectionnée étaient déjà restaurés (2e passe,
  // état levé dans App.jsx) — il ne manquait que le scroll et le focus sur la rangée d'origine.
  useScrollRestore(restoreState, onRestoreConsumed);

  const filtered = computeFilteredEvents(events, filter, searchQuery);

  // Brief §14 : recalcul à chaque changement de filtre/recherche — la date sélectionnée ne
  // doit être effacée QUE si elle devient invalide dans le nouvel ensemble filtré, jamais
  // systématiquement. isSelectedDateStillValid est la même fonction que le test automatisé
  // (scripts/test-agenda-search.mjs) exerce, pas une copie de la logique.
  useEffect(() => {
    if (!isSelectedDateStillValid(filtered, selectedDate)) {
      onSelectedDateChange(null);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filter, searchQuery]);

  // Correctif UAT V7.14 (point 15, bug confirmé) : ce tri ne filtrait auparavant AUCUN événement
  // daté déjà passé — un événement d'hier restait éligible à "À venir" simplement parce qu'il
  // n'avait jamais été exclu, seulement trié. `isUpcomingEvent` (agendaSearch.js) ne s'applique
  // QU'AUX événements datés (`e.category !== 'anniversaire'`) : un anniversaire est déjà
  // "future-safe" par construction via `nextOccurrence` ci-dessous (clé de tri), qui fait
  // toujours avancer à l'année suivante un jour/mois déjà passé — inutile et hors périmètre de
  // lui appliquer aussi ce filtre (il n'a de toute façon pas de `e.date`).
  const upcomingAll = [...filtered]
    .filter((e) => e.category === 'anniversaire' || isUpcomingEvent(e, TODAY))
    .sort((a, b) => {
      const da = a.date ? new Date(a.date) : nextOccurrence(a.month, a.day, TODAY);
      const db = b.date ? new Date(b.date) : nextOccurrence(b.month, b.day, TODAY);
      return da - db;
    });

  // Bug corrigé (verrouillé) : eventsOnDate travaillait autrefois sur `events` (toutes
  // catégories confondues), pas sur `filtered` — un filtre "École" pouvait donc laisser des
  // pastilles et des événements ouvrables d'une autre catégorie sur le calendrier, alors que
  // "À venir" respectait déjà le filtre. eventsOnDateFrom (agendaSearch.js) prend désormais
  // `filtered` explicitement en paramètre — plus possible d'oublier de le filtrer par erreur.
  function eventsOnDate(d) { return eventsOnDateFrom(filtered, d); }

  function openAgendaItem(event) {
    const focusId = `agenda-row-${event.id}`;
    if (event.category === 'anniversaire') onOpenBirthday(event.id, focusId);
    else onOpenEvent(event.id, focusId);
  }

  function changeMonth(delta) {
    let m = monthIndex + delta;
    let y = year;
    if (m < 0) { m = 11; y -= 1; }
    if (m > 11) { m = 0; y += 1; }
    onMonthChange(y, m);
    onSelectedDateChange(null);
  }

  function goToday() {
    onMonthChange(TODAY.getFullYear(), TODAY.getMonth());
    onSelectedDateChange(null);
  }

  // Correctif UAT V7.14 (point 3) : `selectedDate`/`selectedDateEvents` étaient déjà câblés
  // correctement (état levé dans App.jsx, panneau du jour rendu juste sous le calendrier — voir
  // plus bas) — vérifié dynamiquement (Playwright réel), pas supposé : le filtre `filter` n'est
  // JAMAIS touché par un clic sur une date (aucun `onFilterChange` dans ce fichier ne dépend de
  // `selectDate`), et `selectedDateEvents`/`upcoming` ne peuvent pas produire de carte dupliquée
  // (`upcomingExcludingSelected`, agendaSearch.js, retire déjà les événements du panneau du jour
  // de la liste "À venir" ; re-cliquer la même date bascule vers `null`, changer de date
  // recalcule `selectedDateEvents` sans jamais l'accumuler). Le seul défaut réel : sur un petit
  // écran, le calendrier peut être plus haut que la fenêtre visible — le panneau du jour
  // sélectionné, ajouté SOUS la grille, restait alors hors champ après le clic, sans aucun scroll
  // automatique pour le révéler. Même convention que `useScrollRestore.js`
  // (afterPaint + respect de prefers-reduced-motion, jamais un second mécanisme de scroll
  // inventé) : on attend un cycle de peinture complet (le panneau vient d'apparaître/changer de
  // contenu) avant de mesurer sa position.
  function selectDate(dateStr, alreadySelected) {
    const next = alreadySelected ? null : dateStr;
    onSelectedDateChange(next);
    if (!next) return;
    afterPaint(() => {
      const panel = document.getElementById('agenda-selected-date-panel');
      panel?.scrollIntoView({ behavior: prefersReducedMotion() ? 'auto' : 'smooth', block: 'nearest' });
    });
  }

  const cells = monthGrid(year, monthIndex);
  const selectedDateEvents = selectedDate ? eventsOnDate(new Date(selectedDate + 'T00:00:00')) : [];

  // Correctif (recette réelle sur PC, point 1) : une date sélectionnée dont TOUS les
  // événements appartiennent à une seule catégorie n'activait visuellement rien — le chip de
  // filtre restait sur "Tous" et le rond de sélection du calendrier restait bleu, alors que la
  // catégorie réelle du jour était sans ambiguïté (ex. 10 septembre : un seul événement,
  // "Sorties"). On ne touche PAS `filter` lui-même : c'est un choix explicite de l'utilisateur,
  // préservé tel quel à la navigation/au retour (brief), donc seule une mise en évidence
  // dérivée est calculée ici, jamais persistée. Si `filter` cible déjà une catégorie précise,
  // aucune ambiguïté ne se pose : ce filtre EST déjà la catégorie affichée.
  // Comportement multi-catégories défini explicitement (pas de masquage silencieux) : quand
  // plusieurs catégories coexistent le même jour (uniquement possible en filtre "Tous"), aucune
  // n'est mise en avant plus qu'une autre — le rond de sélection reste bleu neutre, et les
  // pastilles de `DayDots` (une par catégorie présente, jusqu'à 3 + "+") restent la source de
  // vérité visuelle pour "quelles catégories sont là" ; rien n'est jamais retiré de la liste du
  // panneau du jour, qui montre toujours tous les événements filtrés de la date, toutes
  // catégories confondues.
  const impliedCategory = selectedDate ? impliedCategoryOf(filter, selectedDateEvents) : null;

  // Brief §13 (étendu par le correctif ci-dessus) : la sélection reprend la couleur de la
  // catégorie en filtre spécifique, celle de la catégorie implicite du jour sélectionné à
  // défaut, et le bleu ABCZed en dernier recours (Tous + plusieurs catégories, ou aucune date
  // sélectionnée).
  const selectionColor = filter !== 'tous'
    ? (CATEGORIES[filter]?.color || ALL_FILTER_COLOR)
    : impliedCategory
      ? CATEGORIES[impliedCategory].color
      : ALL_FILTER_COLOR;
  const selectionTextColor = filter !== 'tous'
    ? (CATEGORIES[filter]?.onColor || '#FFFFFF')
    : impliedCategory
      ? CATEGORIES[impliedCategory].onColor
      : '#FFFFFF';

  // Pas de répétition immédiate : si une date est sélectionnée, "À venir" ne remontre pas
  // les événements déjà affichés dans le panneau du jour, juste au-dessus.
  const upcoming = selectedDate ? upcomingExcludingSelected(upcomingAll, selectedDateEvents) : upcomingAll;
  const createTheme = filter !== 'tous' && CATEGORIES[filter]
    ? CATEGORIES[filter]
    : SECTION_THEMES.agenda;

  return (
    <div className="page-shell" style={{ '--section-accent': SECTION_THEMES.agenda.color }}>
      <PageTitle section="agenda">Agenda</PageTitle>

      <div className="search-field" style={{ display: 'flex', alignItems: 'center', gap: 8, background: '#FFFFFF', border: `1px solid ${CARD_BORDER}`, borderRadius: 999, marginBottom: 14 }}>
        <Search size={16} color={MUTED} />
        <input
          ref={searchInputRef}
          value={searchQuery}
          onChange={(e) => onSearchChange(e.target.value)}
          placeholder="Rechercher un événement…"
          style={{ flex: 1, border: 'none', outline: 'none', fontSize: 13.5, background: 'transparent' }}
        />
        {searchQuery && (
          <button type="button" onClick={() => { onSearchChange(''); searchInputRef.current?.focus(); }} aria-label="Effacer la recherche" className="tap-surface icon-button" style={{ background: 'none', border: 'none', flexShrink: 0 }}>
            <X size={14} color={MUTED} />
          </button>
        )}
      </div>

      <div className="filter-strip">
        <FilterChip active={filter === 'tous'} color={ALL_FILTER_COLOR} onClick={() => onFilterChange('tous')}>Tous</FilterChip>
        {Object.entries(CATEGORIES).map(([key, c]) => (
          <FilterChip key={key} active={filter === key} implied={impliedCategory === key} color={c.color} activeTextColor={c.onColor} onClick={() => onFilterChange(key)}>{c.label}</FilterChip>
        ))}
      </div>

      {/* CTA contextuel — remplace le + flottant de cette page, qui faisait doublon, et
          remplace désormais aussi le + global du header (supprimé, brief §2). Largeur
          réduite et centré : il ne doit plus occuper toute la largeur disponible.
          Brief §20 : en filtre Anniversaires, un bouton mort n'a plus de sens puisque la
          création d'anniversaire existe désormais — CTA dédié plutôt que bouton désactivé.
          V7.14 (correctif UAT, points 12-14) : ce bouton ouvrait auparavant AddBirthdaySheet
          directement (`onAddBirthday`) — décision produit EXPLICITE de cette passe qui remplace
          l'ancienne "règle verrouillée" (CreateEventSheet.jsx) : la création d'anniversaire est
          désormais unifiée dans le même formulaire que les autres catégories (sélecteur
          "Catégorie"), donc ce bouton appelle maintenant `onAdd` comme les trois autres filtres —
          seul le libellé reste adapté au filtre courant. `onAddBirthday` (prop) n'est donc plus
          utilisé ici ; AddBirthdaySheet.jsx reste employé tel quel pour la MODIFICATION d'un
          anniversaire existant (voir onOpenBirthday, plus haut), jamais pour sa création. */}
      <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 16 }}>
        {filter === 'anniversaire' ? (
          <button
            onClick={onAdd}
            className="tap-surface"
            style={{
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
              padding: '0 20px', height: 44, borderRadius: 14,
              border: `1.5px solid ${CATEGORIES.anniversaire.color}`,
              background: CATEGORIES.anniversaire.tint,
              color: CATEGORIES.anniversaire.color, fontSize: 13.5, fontWeight: 700, cursor: 'pointer',
            }}
          >
            <Plus size={16} /> Ajouter un anniversaire
          </button>
        ) : (
          <button
            onClick={onAdd}
            className="tap-surface"
            style={{
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
              padding: '0 20px', height: 44, borderRadius: 14,
              border: `1.5px solid ${createTheme.color}`, background: createTheme.tint,
              color: createTheme.color, fontSize: 13.5, fontWeight: 700, cursor: 'pointer',
            }}
          >
            <Plus size={16} /> Ajouter un événement
          </button>
        )}
      </div>

      <div className="calendar-card" style={{ background: '#FFFFFF', border: `1px solid ${CARD_BORDER}`, borderRadius: 18, marginBottom: 12 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
          {/* Point 4 (2e contre-vérification, ZIP V7.2) : aria-label ajouté sur ces deux
              boutons icône-seule — nécessaire pour que la recette navigateur puisse cibler la
              navigation mois précédent/suivant de façon stable (pas de texte ni d'aria-label
              avant ce correctif), et amélioration d'accessibilité légitime en soi (un bouton
              sans nom accessible est déjà un défaut indépendamment du besoin de test). */}
          <button onClick={() => changeMonth(-1)} aria-label="Mois précédent" className="tap-surface icon-button" style={{ background: 'none', border: 'none' }}><ChevronLeft size={20} color={MUTED} /></button>
          <span style={{ fontSize: 13.5, fontWeight: 600 }}>{MONTH_NAMES[monthIndex]} {year}</span>
          <button onClick={() => changeMonth(1)} aria-label="Mois suivant" className="tap-surface icon-button" style={{ background: 'none', border: 'none' }}><ChevronRight size={20} color={MUTED} /></button>
        </div>
        <div style={{ textAlign: 'right', marginBottom: 6 }}>
          <button onClick={goToday} className="tap-surface" style={{ minHeight: 44, padding: '0 8px', background: 'none', border: 'none', fontSize: 12, color: BLUE, fontWeight: 700 }}>Aujourd'hui</button>
        </div>
        <div className="calendar-grid">
          {WEEKDAYS.map((w) => (
            <div key={w} style={{ textAlign: 'center', fontSize: 9.5, opacity: 0.5, fontWeight: 600 }}>{w}</div>
          ))}
          {cells.map((d, i) => {
            if (!d) return <div key={i} />;
            const dateStr = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
            const isToday = d.toDateString() === TODAY.toDateString();
            const isSelected = selectedDate === dateStr;
            const dayEvents = eventsOnDate(d);
            const hasEvents = dayEvents.length > 0;
            // Brief pts 7-9 : 3e état visuel, distinct de "aujourd'hui" (anneau) et de
            // "sélectionné" (fond plein) — un survol venant de "À venir" ne doit jamais se
            // confondre avec une sélection réelle, ni disparaître le repère "aujourd'hui".
            const isHovered = !isSelected && hoveredDate === dateStr;
            return (
              <button
                key={i}
                onClick={() => hasEvents && selectDate(dateStr, isSelected)}
                disabled={!hasEvents}
                title={hasEvents ? `${dayEvents.length} événement${dayEvents.length > 1 ? 's' : ''}` : undefined}
                aria-label={`${d.getDate()} ${MONTH_NAMES[monthIndex]}${hasEvents ? ` — ${dayEvents.length} événement${dayEvents.length > 1 ? 's' : ''} : ${[...new Set(dayEvents.map((event) => CATEGORIES[event.category]?.label || CATEGORIES.autre.label))].join(', ')}` : ''}`}
                className={hasEvents ? 'tap-surface calendar-day' : 'calendar-day'}
                style={{
                  textAlign: 'center', padding: '4px 0', background: 'none', border: 'none',
                  cursor: hasEvents ? 'pointer' : 'default',
                }}
              >
                <div
                  title={isToday ? "Aujourd'hui" : undefined}
                  style={{
                    width: 26, height: 26, lineHeight: '26px', margin: '0 auto', borderRadius: '50%',
                    background: isSelected ? selectionColor : isHovered ? `${selectionColor}2A` : isToday ? `${BLUE}22` : 'transparent',
                    color: isSelected ? selectionTextColor : INK,
                    fontSize: 13, fontWeight: (isToday || isSelected) ? 700 : 500,
                    // Brief §13 : "Aujourd'hui" est un concept distinct de la sélection — le
                    // repère (anneau) ne doit pas disparaître simplement parce que le jour du
                    // jour est aussi sélectionné. Anneau blanc sur fond plein quand les deux
                    // coexistent, anneau bleu sur fond transparent sinon. Le survol se superpose
                    // en teinte de fond seulement, jamais via ce même anneau, pour rester
                    // visuellement subordonné aux deux autres états.
                    boxShadow: isToday ? `inset 0 0 0 1.5px ${isSelected ? '#FFFFFF' : BLUE}` : isHovered ? `inset 0 0 0 1.5px ${selectionColor}99` : 'none',
                    transition: 'background 0.1s, box-shadow 0.1s',
                  }}
                >
                  {d.getDate()}
                </div>
                <DayDots events={dayEvents} />
              </button>
            );
          })}
        </div>

        {/* Liste inline du jour sélectionné — ne remplace plus systématiquement le premier
            événement du jour par le clic, comme avant. Toute la journée est consultable. */}
        {selectedDate && (
          <div id="agenda-selected-date-panel" style={{ marginTop: 12, paddingTop: 12, borderTop: `1px solid ${CARD_BORDER}` }}>
            <div style={{ fontSize: 12, fontWeight: 600, color: MUTED, marginBottom: 8 }}>
              {new Date(selectedDate + 'T00:00:00').toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' })}
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {selectedDateEvents.map((e) => (
                <EventRow key={e.id} event={e} compact onOpen={() => openAgendaItem(e)} />
              ))}
            </div>
          </div>
        )}
      </div>

      <div style={{ fontSize: 17, fontWeight: 700, fontFamily: FONT_DISPLAY, color: INK, margin: '20px 0 12px' }}>À venir</div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {upcoming.length === 0 && <p style={{ fontSize: 13, opacity: 0.5 }}>Rien pour l'instant dans cette catégorie.</p>}
        {upcoming.map((e) => (
          <EventRow
            key={e.id}
            event={e}
            onOpen={() => openAgendaItem(e)}
            onHoverEnter={() => { if (supportsHoverPointer()) setHoveredDate(eventDateStr(e)); }}
            onHoverLeave={() => setHoveredDate(null)}
          />
        ))}
      </div>
    </div>
  );
}

// `implied` (correctif point 1) : mise en évidence dérivée de la date sélectionnée, jamais du
// filtre réel (`active`). Style délibérément DIFFÉRENT de `active` (anneau coloré + fond teinté
// léger, pas de remplissage plein) pour qu'on ne puisse jamais confondre "catégorie du jour
// sélectionné" avec "filtre effectivement appliqué" — les deux peuvent diverger (ex. filtre
// "Tous" + jour à catégorie unique), et l'utilisateur doit pouvoir distinguer les deux d'un
// coup d'œil, pas seulement au clic.
function FilterChip({ children, active, implied, color, activeTextColor = '#FFFFFF', onClick }) {
  return (
    <button
      onClick={onClick}
      className="tap-surface"
      aria-pressed={active}
      title={implied ? `${children} — catégorie de la date sélectionnée (filtre "Tous" toujours actif)` : undefined}
      style={{
        minHeight: 44, padding: '7px 13px', borderRadius: 999, border: 'none', fontSize: 12.5, fontWeight: 650, whiteSpace: 'nowrap',
        background: active ? color : implied ? `${color}1F` : '#FFFFFF',
        color: active ? activeTextColor : implied ? color : INK,
        boxShadow: active ? 'none' : `0 0 0 1.5px ${implied ? color : CARD_BORDER} inset`,
        cursor: 'pointer',
      }}
    >
      {children}
    </button>
  );
}

function EventRow({ event, onOpen, compact, onHoverEnter, onHoverLeave }) {
  const cat = categoryOf(event);
  const isBirthday = event.category === 'anniversaire';
  const mode = eventModeOf(event);
  const dateLabel = isBirthday
    ? `${event.day} ${MONTH_NAMES[event.month - 1]?.toLowerCase()}`
    : new Date(event.date + 'T00:00:00').toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' }).toUpperCase();

  // Badge à droite : accompagnateurs pour une sortie scolaire, nombre de comptes sinon — JAMAIS
  // pour le mode 'family' (sortie entre familles), qui a son propre résumé détaillé ci-dessous
  // (P2, exercice de correction V7.5).
  //
  // Défaut observé : après une inscription, la carte Agenda d'un événement "entre familles"
  // n'affichait qu'une icône + un total brut de personnes (ex. "3"), sans dire combien
  // d'adultes et d'enfants — la répartition utile n'apparaissait qu'après ouverture de la
  // fiche. `participantsSummaryLabel` (agendaSearch.js, testée par
  // scripts/test-agenda-search.mjs) donne ce résumé lisible ("3 participants · 2 adultes ·
  // 1 enfant"), rendu sur sa propre ligne pleine largeur ci-dessous (pas dans le badge compact
  // à droite, trop étroit pour ce texte plus long) — sans aucun prénom (la carte Agenda reste
  // volontairement moins détaillée que la fiche, brief), et absent entièrement à 0 participant.
  const badgeCount = event.participants?.length;
  const badgeLabel = event.subtype === 'sortie_ecole' ? 'accompagnateur' : null;
  const showLegacyBadge = mode !== 'family' && !isBirthday && event.participants?.length > 0;
  const familySummary = mode === 'family' ? participantsSummaryLabel(event.participants) : '';

  return (
    <button
      id={`agenda-row-${event.id}`}
      onClick={onOpen}
      onMouseEnter={onHoverEnter}
      onMouseLeave={onHoverLeave}
      onFocus={onHoverEnter}
      onBlur={onHoverLeave}
      className="tap-surface"
      style={{
        display: 'flex', alignItems: 'center', gap: 12, textAlign: 'left', width: '100%',
        background: cat.tint, border: `1px solid ${cat.color}33`, borderRadius: compact ? 12 : 18,
        padding: compact ? '10px 12px' : '12px 14px', cursor: 'pointer',
      }}
    >
      <CategoryIcon category={event.category} color={cat.color} size={compact ? 15 : 17} />
      <div style={{ flex: 1, minWidth: 0 }}>
        {!compact && (
          <div style={{ fontSize: 10.5, fontWeight: 700, color: cat.color, letterSpacing: 0.3 }}>
            {dateLabel}{event.startTime ? ` · ${event.startTime}` : ''}
          </div>
        )}
        <div style={{ fontSize: compact ? 13 : 14, fontWeight: 600, margin: compact ? 0 : '2px 0 0' }}>{event.title}</div>
        {event.location && !compact && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 12, opacity: 0.6, marginTop: 2 }}>
            <MapPin size={11} /> {event.location}
          </div>
        )}
        {familySummary && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: compact ? 11 : 11.5, color: cat.color, fontWeight: 600, marginTop: 2, flexWrap: 'wrap' }}>
            <Users size={11} /> {familySummary}
          </div>
        )}
      </div>
      {showLegacyBadge && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 3, fontSize: 11.5, color: cat.color, fontWeight: 600, whiteSpace: 'nowrap' }}>
          <Users size={12} /> {badgeCount}{badgeLabel ? ` ${badgeLabel}${badgeCount > 1 ? 's' : ''}` : ''}
        </div>
      )}
    </button>
  );
}

const CAT_ICONS = { anniversaire: CakeSlice, sortie: UsersRound, ecole: School, autre: Ellipsis };
function CategoryIcon({ category, color, size = 16 }) {
  const Icon = CAT_ICONS[category] || Ellipsis;
  return <Icon size={size} color={color} strokeWidth={2} />;
}
