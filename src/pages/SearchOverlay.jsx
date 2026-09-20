import { useState, useMemo } from 'react';
import { ArrowLeft, Calendar, MessageCircle } from 'lucide-react';
import { BLUE, INK, MUTED, CARD_BORDER, categoryOf } from '../theme';

export default function SearchOverlay({ events, thread, onClose, onOpenEvent, onOpenMessage }) {
  const [q, setQ] = useState('');
  const query = q.trim().toLowerCase();

  const eventResults = useMemo(() => {
    if (!query) return [];
    return events.filter((e) =>
      e.title.toLowerCase().includes(query) ||
      (e.description || '').toLowerCase().includes(query) ||
      (e.location || '').toLowerCase().includes(query)
    );
  }, [query, events]);

  const messageResults = useMemo(() => {
    if (!query) return [];
    return thread.filter((m) => (m.text || '').toLowerCase().includes(query) || (m.file?.name || '').toLowerCase().includes(query));
  }, [query, thread]);

  return (
    <div style={{ position: 'fixed', inset: 0, background: '#FBF6EC', zIndex: 70, overflowY: 'auto' }}>
      <div className="max-w-md mx-auto" style={{ padding: '18px 20px 40px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
          <button onClick={onClose} style={{ background: 'none', border: 'none' }}><ArrowLeft size={20} color={INK} /></button>
          <input
            autoFocus
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Rechercher dans Agenda, Messages…"
            style={{ flex: 1, padding: '10px 14px', borderRadius: 999, border: `1px solid ${CARD_BORDER}`, fontSize: 14 }}
          />
        </div>

        {!query && <p style={{ fontSize: 13, opacity: 0.5, textAlign: 'center', marginTop: 30 }}>Tape un mot pour chercher dans les événements et les messages.</p>}

        {query && eventResults.length === 0 && messageResults.length === 0 && (
          <p style={{ fontSize: 13, opacity: 0.5, textAlign: 'center', marginTop: 30 }}>Aucun résultat pour « {q} ».</p>
        )}

        {eventResults.length > 0 && (
          <>
            <SectionLabel icon={<Calendar size={13} />}>Agenda</SectionLabel>
            {eventResults.map((e) => (
              <ResultRow key={e.id} onClick={() => onOpenEvent(e.id)} color={categoryOf(e).color}>
                <b>{e.title}</b>{e.location ? ` — ${e.location}` : ''}
              </ResultRow>
            ))}
          </>
        )}

        {messageResults.length > 0 && (
          <>
            <SectionLabel icon={<MessageCircle size={13} />}>Messages</SectionLabel>
            {messageResults.map((m) => (
              <ResultRow key={m.id} onClick={() => onOpenMessage()} color={BLUE}>
                <b>{m.author}</b> — {m.text || m.file?.name}
              </ResultRow>
            ))}
          </>
        )}
      </div>
    </div>
  );
}

function SectionLabel({ icon, children }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, fontWeight: 700, color: MUTED, margin: '16px 0 8px' }}>
      {icon} {children}
    </div>
  );
}
function ResultRow({ children, onClick, color }) {
  return (
    <button
      onClick={onClick}
      style={{
        display: 'block', width: '100%', textAlign: 'left', background: '#FFFFFF', border: `1px solid ${CARD_BORDER}`,
        borderLeft: `3px solid ${color}`, borderRadius: 10, padding: '10px 12px', fontSize: 13, marginBottom: 6,
      }}
    >
      {children}
    </button>
  );
}
