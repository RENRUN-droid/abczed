import { useMemo, useState, useEffect, useRef } from 'react';
import { Search, X, FileText, Image, Link2, Info, Download, ExternalLink, Ellipsis, Pencil, Trash2, FolderOpen, Plus, ArrowLeft, ChevronRight } from 'lucide-react';
import { INK, MUTED, CARD_BORDER, BLUE, RED, SECTION_THEMES, SHARE_TYPE_THEMES, FONT_DISPLAY } from '../theme';
import { SHARE_TYPES } from '../data';
import { computeFilteredShares } from '../shareSearch';
import { useScrollRestore } from '../useScrollRestore';
import { prefersReducedMotion } from '../motionPrefs';
import { documentById } from '../documents';
import { openableCardProps } from '../attachmentCardA11y';
import ActionButton from '../components/ActionButton';
import PageTitle from '../components/PageTitle';

const ME = 'Vous';
const ICONS = { document: FileText, photo: Image, lien: Link2, info: Info };

function fmtDate(dateStr) {
  return new Date(dateStr + 'T00:00:00').toLocaleDateString('fr-FR', { day: 'numeric', month: 'long' });
}

// Delta pts 29/30/39/42 (arbitrage D1) : un partage de type document a soit un `documentId`
// réel (catalogue src/documents.js, fichier réellement ouvrable/téléchargeable), soit un
// `fileName`/`fileSize` typés à la main via "Ajouter un partage" (aucun import de fichier
// réel n'existe encore) — cette fonction unifie les deux en la même forme d'affichage, sans
// jamais fabriquer une `url` qui n'existe pas pour le second cas.
function shareDoc(s) {
  const canonical = s.documentId ? documentById(s.documentId) : null;
  if (canonical) return canonical;
  // Item 11 : un partage créé via "Ajouter un partage" (AddShareSheet.jsx) a désormais une
  // vraie `fileDataUrl` (data: URL, FileReader) quand un fichier a réellement été choisi —
  // Ouvrir/Télécharger doivent alors fonctionner pour de vrai, pas rester désactivés comme
  // avant cette passe (fileName seul, sans aucune donnée réelle derrière).
  if (s.fileDataUrl) return { filename: s.fileName, size: s.fileSize, url: s.fileDataUrl };
  if (s.fileName) return { filename: s.fileName, size: s.fileSize, url: null };
  return null;
}

export default function Partages({
  shares, events, onDelete, onEdit, onAdd, onOpenEvent,
  filter, onFilterChange, query, onQueryChange,
  highlightShareId, onHighlightConsumed,
  cameFromAccueil, onBackToAccueil,
  restoreState, onRestoreConsumed,
}) {
  const [openMenuId, setOpenMenuId] = useState(null);
  const [flashId, setFlashId] = useState(null);
  const cardRefs = useRef({});
  const searchInputRef = useRef(null);

  // Delta §2.2/§26 : filtre/recherche étaient déjà restaurés (2e passe) — il manquait le
  // scroll et le focus sur le lien "Voir l'événement" d'origine.
  useScrollRestore(restoreState, onRestoreConsumed);

  const filtered = useMemo(() => {
    // Brief §3/§26 : même qualité de normalisation que partout ailleurs (accents/casse/
    // apostrophes), combinée au filtre de type — computeFilteredShares est la même
    // fonction que scripts/test-deep-link-visibility.mjs exerce, pas une copie.
    const list = computeFilteredShares(shares, filter, query);
    return [...list].sort((a, b) => new Date(b.date) - new Date(a.date));
  }, [shares, filter, query]);

  // Brief §8/§27 : lien profond depuis l'Accueil (ou détail/ciblage d'un partage) — on
  // scrolle jusqu'à la carte visée et on la surligne brièvement, une seule fois.
  useEffect(() => {
    if (!highlightShareId) return;
    const el = cardRefs.current[highlightShareId];
    const reduced = prefersReducedMotion();
    if (el) el.scrollIntoView({ behavior: reduced ? 'auto' : 'smooth', block: 'center' });
    if (!reduced) setFlashId(highlightShareId);
    const t1 = setTimeout(() => setFlashId(null), 2000);
    const t2 = setTimeout(() => onHighlightConsumed(), 50);
    return () => { clearTimeout(t1); clearTimeout(t2); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [highlightShareId]);

  return (
    <div className="page-shell" style={{ '--section-accent': SECTION_THEMES.partages.color }}>
      {/* Brief §28 : arrivé ici via un lien profond depuis l'Accueil, un vrai moyen de
          revenir doit exister — pas seulement la navigation du bas. */}
      {cameFromAccueil && (
        <button id="back-to-accueil" onClick={onBackToAccueil} style={{ display: 'flex', alignItems: 'center', gap: 6, background: 'none', border: 'none', color: BLUE, fontSize: 13, fontWeight: 600, padding: 0, marginBottom: 10 }}>
          <ArrowLeft size={16} /> Accueil
        </button>
      )}

      <PageTitle section="partages">Partages</PageTitle>

      <div className="search-field" style={{ display: 'flex', alignItems: 'center', gap: 8, background: '#FFFFFF', border: `1px solid ${CARD_BORDER}`, borderRadius: 999, marginBottom: 14 }}>
        <Search size={16} color={MUTED} />
        <input
          ref={searchInputRef}
          value={query}
          onChange={(e) => onQueryChange(e.target.value)}
          placeholder="Rechercher un partage…"
          style={{ flex: 1, border: 'none', outline: 'none', fontSize: 13.5, background: 'transparent' }}
        />
        {query && (
          <button type="button" onClick={() => { onQueryChange(''); searchInputRef.current?.focus(); }} aria-label="Effacer la recherche" className="tap-surface icon-button" style={{ background: 'none', border: 'none', flexShrink: 0 }}>
            <X size={14} color={MUTED} />
          </button>
        )}
      </div>

      {/* V7.14 (correctif UAT) : modificateur --wrap dédié (voir App.jsx) — passe en
          plusieurs lignes plutôt qu'en défilement horizontal masqué dès que les 5 chips ne
          tiennent plus sur une seule ligne (≤360px environ), sans toucher au comportement
          d'Agenda.jsx qui garde la classe de base seule. */}
      <div className="filter-strip filter-strip--wrap" style={{ marginBottom: 16 }}>
        <FilterChip active={filter === 'tous'} color={SECTION_THEMES.partages.color} onClick={() => onFilterChange('tous')}>Tout</FilterChip>
        {Object.entries(SHARE_TYPES).map(([key, t]) => (
          <FilterChip key={key} active={filter === key} color={SHARE_TYPE_THEMES[key]?.color} onClick={() => onFilterChange(key)}>{t.label}</FilterChip>
        ))}
      </div>

      {/* CTA contextuel (brief §2/§25) — remplace le + global du header, cohérent avec le
          bouton d'Agenda : centré, sous les filtres. */}
      <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 16 }}>
        <button
          onClick={onAdd}
          className="tap-surface"
          style={{
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
            padding: '0 20px', height: 44, borderRadius: 14,
            border: `1.5px solid ${SECTION_THEMES.partages.color}`, background: SECTION_THEMES.partages.tint,
            color: SECTION_THEMES.partages.color, fontSize: 13.5, fontWeight: 700, cursor: 'pointer',
          }}
        >
          <Plus size={16} /> Ajouter un partage
        </button>
      </div>

      {filtered.length === 0 && (
        <div style={{ textAlign: 'center', padding: '48px 20px', opacity: 0.6 }}>
          <FolderOpen size={32} color={MUTED} style={{ marginBottom: 10 }} />
          <p style={{ fontSize: 15, fontWeight: 700, fontFamily: FONT_DISPLAY, color: INK, margin: '0 0 4px' }}>
            {shares.length === 0 ? 'Encore aucun partage' : 'Aucun résultat'}
          </p>
          <p style={{ fontSize: 13, color: MUTED, margin: 0 }}>
            {shares.length === 0
              ? 'Les documents, photos, informations et liens utiles du groupe apparaîtront ici.'
              : 'Essaie un autre mot ou un autre filtre.'}
          </p>
        </div>
      )}

      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {filtered.map((s) => {
          const Icon = ICONS[s.type];
          const linkedEvent = s.linkedEventId ? events.find((e) => e.id === s.linkedEventId) : null;
          const isMine = s.author === ME;
          // Item 9 (correctif UAT phase 3) : la carte entière ouvre désormais "la fiche ou la
          // ressource" du partage — pour un document/lien avec un `href` réel, exactement la
          // même action que le bouton "Ouvrir" déjà existant (openableCardProps ouvre le même
          // href, ni plus ni moins) ; pour une photo/info sans ressource réelle, aucune
          // interaction n'est ajoutée (openableCardProps(null) renvoie {} — pas de piège de
          // focus/clic qui ne ferait rien), cohérent avec l'état "indisponible" déjà affiché
          // par ActionButton pour ces cas. Aucune nouvelle vue "fiche partage" inventée.
          const cardHref = s.type === 'document' ? shareDoc(s)?.url : s.type === 'lien' ? s.linkUrl : s.type === 'photo' ? s.photoDataUrl : null;
          return (
            <div
              key={s.id}
              ref={(el) => { cardRefs.current[s.id] = el; }}
              {...openableCardProps(cardHref)}
              // Delta §9.1/§16, révisé item 9 : la carte contient toujours plusieurs actions
              // distinctes (menu, "voir l'événement", Ouvrir/Télécharger) — .tap-container reste
              // le signal visuel de "cette carte contient des actions" (relief au survol, anneau
              // focus-within). Le clic sur la carte entière, lui, est désormais réel quand
              // `cardHref` existe (voir openableCardProps ci-dessus) — chaque action interne
              // (menu, lien événement, Ouvrir/Télécharger) stoppe sa propre propagation pour ne
              // jamais déclencher une SECONDE navigation en plus de son propre clic.
              className="tap-container"
              style={{
                background: flashId === s.id ? '#FFF4D2' : '#FFFFFF', border: `1px solid ${CARD_BORDER}`, borderRadius: 18, padding: '14px 16px',
                transition: 'background 0.4s', cursor: cardHref ? 'pointer' : 'default',
              }}
            >
              <div style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
                {/* Item 9 (révisé) : l'icône n'a plus SA PROPRE interactivité (role/tabIndex/
                    onClick) — la carte ENTIÈRE porte désormais openableCardProps (voir plus
                    haut) pour exactement la même action ; dupliquer le même gestionnaire ici
                    aurait ouvert le fichier DEUX FOIS au clic (bubbling non stoppé entre
                    l'icône et son parent, contrairement à ActionButton qui stoppe la sienne).
                    Le style visuel (curseur) reste un indice, purement décoratif. */}
                <div
                  style={{
                    width: 34, height: 34, borderRadius: 9, background: SHARE_TYPE_THEMES[s.type]?.tint || '#F1F1EF', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
                    cursor: s.type === 'document' && shareDoc(s)?.url ? 'pointer' : 'default',
                  }}
                >
                  <Icon size={16} color={SHARE_TYPE_THEMES[s.type]?.color || BLUE} />
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8 }}>
                    <span style={{ fontSize: 15, fontWeight: 700 }}>{s.title}</span>
                    {isMine && (
                      // Item 9 : la carte entière étant désormais cliquable (openableCardProps
                      // ci-dessus), ce bouton doit stopper sa propre propagation pour ne jamais
                      // déclencher AUSSI l'action de carte (ouvrir le fichier/lien) en plus
                      // d'ouvrir son propre menu.
                      <button onClick={(e) => { e.stopPropagation(); setOpenMenuId(openMenuId === s.id ? null : s.id); }} aria-label="Autres actions" className="tap-surface icon-button" style={{ background: 'none', border: 'none', borderRadius: 10 }}>
                        <Ellipsis size={16} color={MUTED} />
                      </button>
                    )}
                  </div>

                  {s.description && <p style={{ fontSize: 14, color: INK, opacity: 0.85, margin: '4px 0 0', lineHeight: 1.4 }}>{s.description}</p>}

                  {/* Delta pts 29/30/39/42 (arbitrage D1) : nom/taille résolus depuis le
                      catalogue src/documents.js quand ce partage y référence un fichier réel
                      (même id que l'attachement de l'événement lié et le fichier partagé dans
                      Messages, quand c'est réellement le même fichier) — repli sur
                      fileName/fileSize pour un partage créé via le formulaire "Ajouter un
                      partage" (aucun import de fichier réel n'existe encore, voir
                      AddShareSheet), qui n'a donc jamais de `documentId`. */}
                  {s.type === 'document' && (
                    // Item 9 (révisé) : même raison que l'icône ci-dessus — plus de
                    // openableCardProps propre ici, la carte entière porte déjà la même action.
                    <p
                      style={{ fontSize: 12.5, color: shareDoc(s)?.url ? BLUE : MUTED, margin: '6px 0 0', cursor: shareDoc(s)?.url ? 'pointer' : 'default', display: 'inline-block' }}
                    >
                      {shareDoc(s)?.filename} · {shareDoc(s)?.size}
                    </p>
                  )}
                  {s.type === 'photo' && (
                    <p style={{ fontSize: 12.5, color: MUTED, margin: '6px 0 0' }}>{s.photoCount} photo{s.photoCount > 1 ? 's' : ''}</p>
                  )}
                  {s.type === 'lien' && (
                    <p style={{ fontSize: 12.5, color: BLUE, margin: '6px 0 0' }}>{s.domain}</p>
                  )}

                  <p style={{ fontSize: 11.5, color: MUTED, margin: '8px 0 0' }}>Partagé par {s.author} · {fmtDate(s.date)}</p>

                  {linkedEvent && (
                    // Brief §28 : ouvrir l'événement lié reste possible, mais le retour doit
                    // ramener ici (filtre/recherche/contexte conservés), jamais vers Agenda —
                    // App.jsx transmet désormais la provenance réelle à openEvent.
                    // Delta §9.2 : "Lié à : ..." ressemblait à une simple information — libellé
                    // et chevron rendent maintenant l'action explicite, sans dépendre du hover ;
                    // l'intitulé de l'événement reste affiché comme demandé.
                    <button
                      id={`share-linkbtn-${s.id}`}
                      onClick={(e) => { e.stopPropagation(); onOpenEvent(linkedEvent.id, `share-linkbtn-${s.id}`); }}
                      className="tap-surface"
                      style={{ display: 'flex', alignItems: 'center', gap: 3, fontSize: 11, color: BLUE, background: '#EAF1FB', border: 'none', borderRadius: 999, padding: '3px 9px', marginTop: 8, fontWeight: 600 }}
                    >
                      Voir l'événement : {linkedEvent.title} <ChevronRight size={12} />
                    </button>
                  )}

                  {/* Delta pts 29/30/39/42 (arbitrage D1) : Ouvrir/Télécharger sont réellement
                      fonctionnels dès qu'un `href` réel existe — le document (fichier de
                      démonstration réel dans public/demo/) et le lien (URL du partage) en ont
                      un ; l'album photo n'en a volontairement pas : aucune image de
                      démonstration réelle n'est associée à ce partage (seul un nombre de
                      photos existe dans les données), donc le bouton reste désactivé avec un
                      motif spécifique plutôt que le message générique "stockage non activé",
                      qui serait désormais faux pour les deux autres cas de cet écran. */}
                  <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
                    {s.type === 'document' && (() => {
                      const doc = shareDoc(s);
                      const openTitle = doc?.url ? 'Ouvrir dans un nouvel onglet' : 'Ajouté sans import de fichier réel — rien à ouvrir';
                      return (
                        <>
                          <ActionButton icon={ExternalLink} href={doc?.url} title={openTitle}>Ouvrir</ActionButton>
                          <ActionButton icon={Download} href={doc?.url} download={doc?.filename} title={doc?.url ? 'Télécharger' : openTitle}>Télécharger</ActionButton>
                        </>
                      );
                    })()}
                    {s.type === 'photo' && (
                      // Item 11 : réellement ouvrable dès qu'une vraie photo a été importée via
                      // "Ajouter un partage" (photoDataUrl) — le texte "aucune photo de
                      // démonstration..." reste affiché tel quel pour les albums de
                      // démonstration qui n'en ont jamais eu (ex. l'album zoo, hors périmètre :
                      // src/data.js non touché par cette phase).
                      <ActionButton icon={ExternalLink} href={s.photoDataUrl} title={s.photoDataUrl ? 'Ouvrir la photo' : 'Aucune photo de démonstration disponible pour cet album'}>Ouvrir</ActionButton>
                    )}
                    {s.type === 'lien' && (
                      <ActionButton icon={ExternalLink} href={s.linkUrl} title="Ouvrir dans un nouvel onglet">Ouvrir</ActionButton>
                    )}
                  </div>

                  {openMenuId === s.id && (
                    // Item 9 : les deux boutons du menu stoppent désormais leur propagation
                    // (défensif — la carte entière peut être actionnable, voir plus haut).
                    <div style={{ marginTop: 8, borderTop: `1px solid ${CARD_BORDER}`, paddingTop: 8, display: 'flex', gap: 16 }}>
                      <button
                        onClick={(e) => { e.stopPropagation(); onEdit(s); setOpenMenuId(null); }}
                        className="tap-surface"
                        style={{ display: 'flex', alignItems: 'center', gap: 6, background: 'none', border: 'none', borderRadius: 8, fontSize: 13, color: BLUE, padding: '4px 6px' }}
                      >
                        <Pencil size={14} /> Modifier
                      </button>
                      <button
                        onClick={(e) => { e.stopPropagation(); onDelete(s.id); setOpenMenuId(null); }}
                        className="tap-surface"
                        // Point 4 : couleur RED importée depuis theme.js (token partagé) au
                        // lieu du hex codé en dur — "Supprimer" reste bien une action
                        // destructrice, la seule chose corrigée est la source de la couleur.
                        style={{ display: 'flex', alignItems: 'center', gap: 6, background: 'none', border: 'none', borderRadius: 8, fontSize: 13, color: RED, padding: '4px 6px' }}
                      >
                        <Trash2 size={14} /> Supprimer
                      </button>
                    </div>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function FilterChip({ children, active, color = SECTION_THEMES.partages.color, onClick }) {
  return (
    <button
      onClick={onClick}
      className="tap-surface"
      style={{
        minHeight: 44, padding: '7px 13px', borderRadius: 999, border: 'none', fontSize: 12.5, fontWeight: 650, whiteSpace: 'nowrap',
        background: active ? color : '#FFFFFF', color: active ? '#fff' : INK,
        boxShadow: active ? 'none' : `0 0 0 1px ${CARD_BORDER} inset`,
      }}
    >
      {children}
    </button>
  );
}

// ActionButton (Ouvrir/Télécharger) vit désormais dans src/components/ActionButton.jsx —
// partagé avec EventDetail.jsx (delta §8), pas dupliqué.
