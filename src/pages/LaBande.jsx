import { useMemo, useRef, useState } from 'react';
import { Search, X, ChevronRight, UserPlus, Users } from 'lucide-react';
import { INK, MUTED, CARD_BORDER, SECTION_THEMES, FONT_DISPLAY } from '../theme';
import { childrenOf } from '../data';
import { anyFieldMatches } from '../searchUtils';
import { useScrollRestore } from '../useScrollRestore';
import PageTitle from '../components/PageTitle';
import InviteParentSheet from '../components/InviteParentSheet';

// V7.18 : `members` reçu en prop (annuaire réel, App.jsx/src/membersApi.js) — remplace l'import
// direct de MEMBERS (donnée de démonstration, src/data.js). `isAdmin`/`communityId` :
// nécessaires au bouton "Inviter un parent", réservé aux administrateurs (vérifié à nouveau
// côté serveur par create_invitation(), sql/09_invitations.sql — l'interface ne propose jamais
// une action vouée à l'échec côté serveur, même principe déjà appliqué ailleurs dans ce projet,
// ex. "Lier à un événement" dans Messages.jsx).
export default function LaBande({ members, membersLoading, membersError, onOpenMember, query, onQueryChange, restoreState, onRestoreConsumed, isAdmin, communityId }) {
  const searchInputRef = useRef(null);
  const [showInvite, setShowInvite] = useState(false);

  // Delta §2.2/§26 : la recherche était déjà restaurée (état levé dans App.jsx) — il manquait
  // le scroll et le focus sur la carte parent d'origine.
  useScrollRestore(restoreState, onRestoreConsumed);

  const filtered = useMemo(() => {
    const list = [...members].sort((a, b) => a.firstName.localeCompare(b.firstName, 'fr'));
    if (!query.trim()) return list;
    // Brief §3/§29 : même normalisation (accents/casse/apostrophes) que le reste de
    // l'application — recherche réelle sur parent ET enfant/groupe, pas un simple includes().
    return list.filter((m) => {
      const kids = childrenOf(m);
      return anyFieldMatches([m.firstName, m.lastName, ...kids.map((c) => c.firstName), ...kids.map((c) => c.groupLabel)], query);
    });
  }, [query]);

  return (
    <div className="page-shell" style={{ '--section-accent': SECTION_THEMES.labande.color }}>
      <PageTitle section="labande">La Bande</PageTitle>

      <div className="search-field" style={{ display: 'flex', alignItems: 'center', gap: 8, background: '#FFFFFF', border: `1px solid ${CARD_BORDER}`, borderRadius: 999, marginBottom: 16 }}>
        <Search size={16} color={MUTED} />
        <input
          ref={searchInputRef}
          value={query}
          onChange={(e) => onQueryChange(e.target.value)}
          placeholder="Chercher un parent, un enfant, un groupe…"
          style={{ flex: 1, border: 'none', outline: 'none', fontSize: 13.5, background: 'transparent' }}
        />
        {query && (
          <button type="button" onClick={() => { onQueryChange(''); searchInputRef.current?.focus(); }} aria-label="Effacer la recherche" className="tap-surface icon-button" style={{ background: 'none', border: 'none', flexShrink: 0 }}>
            <X size={14} color={MUTED} />
          </button>
        )}
      </div>

      {/* Mêmes états dédiés que Messages.jsx (messagesLoading/messagesError) : une erreur réelle
          reste affichée telle quelle (jamais de repli silencieux), le chargement initial
          n'affiche aucun état vide trompeur tant qu'il est en cours. */}
      {membersError && (
        <div style={{ background: '#FCE9E7', border: '1px solid #D9463033', borderRadius: 10, padding: '8px 12px', marginBottom: 14, fontSize: 12, color: '#8A2E1F' }}>
          {membersError}
        </div>
      )}

      {membersLoading ? (
        <p style={{ textAlign: 'center', padding: 40, opacity: 0.5, fontSize: 13 }}>Chargement de La Bande…</p>
      ) : (
      <>
      {members.length === 0 && (
        <EmptyState icon={Users} title="Pas encore de membres" text="Les membres invités dans la communauté apparaîtront ici." />
      )}
      {members.length > 0 && filtered.length === 0 && (
        <EmptyState icon={Search} title="Aucun membre trouvé" text="Aucun membre ne correspond à votre recherche." />
      )}

      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {filtered.map((m) => {
          const kids = childrenOf(m);
          return (
            <button
              key={m.id}
              id={`member-row-${m.id}`}
              onClick={() => onOpenMember(m.id, `member-row-${m.id}`)}
              // Delta §16 : la carte parent EST la cible cliquable (elle ouvre bien une fiche,
              // contrairement aux cartes Partages) — grammaire interactive complète :
              // hover/focus-visible/pressed, jamais dépendante du hover seul.
              className="tap-surface"
              style={{
                display: 'flex', alignItems: 'center', gap: 12, textAlign: 'left', width: '100%',
                background: '#FFFFFF', border: `1px solid ${CARD_BORDER}`, borderRadius: 18, padding: '14px 16px', minHeight: 44,
              }}
            >
              <div style={{ width: 40, height: 40, borderRadius: '50%', background: m.avatarColor, color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 15, fontWeight: 700, flexShrink: 0 }}>
                {m.firstName.slice(0, 1)}
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 15, fontWeight: 700, color: INK }}>
                  {m.firstName} {m.lastName}
                  {/* Point 7 backlog : repère visuel sur sa propre cartouche — `m.id ===
                      'mem-vous'` est la même sentinelle déjà posée par memberDirectory.js
                      (mapMemberRow) et déjà utilisée par le court-circuit "Mon profil" dans
                      App.jsx (openMember, ligne ~618) : source unique de vérité "est-ce moi ?",
                      jamais une comparaison redondante ici. */}
                  {m.id === 'mem-vous' && (
                    <span style={{ marginLeft: 6, fontSize: 12, fontWeight: 700, color: SECTION_THEMES.labande.color }}>
                      (Vous)
                    </span>
                  )}
                </div>
                {/* V7.14 (correctif UAT) : ce texte (enfants/groupe du parent, ou statut par
                    défaut) était à 13px — lu en pratique comme trop petit/pas assez appuyé
                    sur mobile face au nom en 700. Passé à 14px/fontWeight 560 (lisible sans
                    pour autant rivaliser visuellement avec le nom). Le reste de la carte
                    (padding '14px 16px', gap 12, marginTop 2) a été mesuré avant modification
                    — scripts/test-design-system.mjs et Playwright confirment que la hauteur
                    de carte reste strictement dictée par son contenu réel (avatar 40px +
                    padding), sans marge résiduelle "excessive" à retirer : aucune n'a été
                    trouvée dans ce composant, seule la taille de texte a été corrigée. */}
                {kids.length > 0 ? (
                  <div style={{ fontSize: 14, fontWeight: 560, color: MUTED, marginTop: 3, lineHeight: 1.35 }}>
                    {kids.map((c, i) => (
                      <span key={c.id}>{i > 0 ? ' · ' : ''}{c.label} de {c.firstName} ({c.groupLabel})</span>
                    ))}
                  </div>
                ) : (
                  <div style={{ fontSize: 14, fontWeight: 560, color: MUTED, marginTop: 3, lineHeight: 1.35 }}>Membre de la communauté</div>
                )}
              </div>
              <ChevronRight size={16} color={MUTED} style={{ flexShrink: 0 }} />
            </button>
          );
        })}
      </div>
      </>
      )}

      {isAdmin && (
        <button
          onClick={() => setShowInvite(true)}
          style={{
            width: '100%', marginTop: 18, padding: '13px 0', borderRadius: 14, border: `1px dashed ${SECTION_THEMES.labande.color}`,
            background: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
            fontSize: 13.5, fontWeight: 700, color: SECTION_THEMES.labande.color, cursor: 'pointer', minHeight: 48,
          }}
        >
          <UserPlus size={16} /> Inviter un parent
        </button>
      )}

      {showInvite && (
        <InviteParentSheet communityId={communityId} onClose={() => setShowInvite(false)} />
      )}
    </div>
  );
}

function EmptyState({ icon: Icon, title, text }) {
  return (
    <div style={{ textAlign: 'center', padding: '40px 20px', opacity: 0.6 }}>
      <Icon size={30} color={MUTED} style={{ marginBottom: 10 }} />
      <p style={{ fontSize: 15, fontWeight: 700, fontFamily: FONT_DISPLAY, color: INK, margin: '0 0 4px' }}>{title}</p>
      <p style={{ fontSize: 13, color: MUTED, margin: 0 }}>{text}</p>
    </div>
  );
}
