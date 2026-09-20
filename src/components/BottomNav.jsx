import { Home, CalendarDays, MessageCircle, Folder, Users } from 'lucide-react';
import { MUTED, CARD_BORDER, SECTION_THEMES } from '../theme';

const TABS = [
  { key: 'accueil', label: 'Accueil', icon: Home, theme: SECTION_THEMES.accueil }, // 'House' exigé par la spec n'existe pas dans lucide-react 0.383.0 installé — Home conservé, divergence signalée
  { key: 'agenda', label: 'Agenda', icon: CalendarDays, theme: SECTION_THEMES.agenda },
  { key: 'messages', label: 'Messages', icon: MessageCircle, theme: SECTION_THEMES.messages },
  { key: 'partages', label: 'Partages', icon: Folder, theme: SECTION_THEMES.partages },
  { key: 'labande', label: 'La Bande', icon: Users, theme: SECTION_THEMES.labande },
];

export default function BottomNav({ active, onChange }) {
  return (
    <div
      style={{
        position: 'fixed', bottom: 0, left: 0, right: 0, background: '#FFFFFF',
        borderTop: `1px solid ${CARD_BORDER}`, display: 'flex', zIndex: 40,
        paddingBottom: 'env(safe-area-inset-bottom, 0px)',
      }}
    >
      <div className="max-w-md mx-auto" style={{ display: 'flex', width: '100%' }}>
        {TABS.map((t) => {
          const Icon = t.icon;
          // 'event-detail' et 'member-detail' ne sont plus mappés en dur ici : une fiche
          // événement OU une fiche membre peuvent désormais venir de n'importe quelle page
          // (brief §4 ; delta §2.2/§18/§26 pour member-detail) — App.jsx résout déjà `active`
          // vers le bon onglet (eventReturnTo / memberReturnTo) avant de le transmettre. Seul
          // 'thread' reste mappé ici : un seul chemin d'entrée possible (toujours depuis
          // Messages), pas une ambiguïté de provenance à résoudre.
          const isActive = active === t.key || (active === 'thread' && t.key === 'messages');
          return (
            <button
              key={t.key}
              data-tab={t.key}
              onClick={() => onChange(t.key)}
              aria-current={isActive ? 'page' : undefined}
              className="tap-surface"
              style={{
                flex: 1, minWidth: 0, minHeight: 64, background: 'none', border: 'none', padding: '7px 2px 9px',
                display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 2,
                color: isActive ? t.theme.color : MUTED,
              }}
            >
              <span
                aria-hidden="true"
                style={{
                  width: 34, height: 26, borderRadius: 999,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  background: isActive ? t.theme.tint : 'transparent',
                }}
              >
                <Icon size={20} strokeWidth={isActive ? 2.5 : 2} />
              </span>
              <span style={{ fontSize: 10.5, fontWeight: isActive ? 750 : 560, whiteSpace: 'nowrap' }}>{t.label}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
