import { useState, useRef } from 'react';
import { Trash2, X } from 'lucide-react';
import { CATEGORIES, RED, MUTED, CARD_BORDER, FONT_DISPLAY } from '../theme';
import { useModalA11y } from '../useModalA11y';

const MONTHS = ['Janvier', 'Février', 'Mars', 'Avril', 'Mai', 'Juin', 'Juillet', 'Août', 'Septembre', 'Octobre', 'Novembre', 'Décembre'];

// Brief §20 : formulaire dédié, volontairement minimal — jamais d'année de naissance, jamais
// d'heure, jamais de lieu, jamais de RSVP. Un anniversaire n'est pas un événement standard.
export default function AddBirthdaySheet({
  onClose, onCreate, birthday = null, canManage = true, onUpdate, onDelete, deleteBusy = false,
}) {
  const editing = Boolean(birthday);
  const initialName = birthday?.title?.replace(/^Anniversaire de\s+/i, '') || '';
  const [name, setName] = useState(initialName);
  const [day, setDay] = useState(birthday?.day ? String(birthday.day) : '');
  const [month, setMonth] = useState(birthday?.month ? String(birthday.month) : '');
  const [saving, setSaving] = useState(false);
  const panelRef = useRef(null);
  const { onBackdropClick } = useModalA11y(panelRef, onClose);

  const dayNum = Number(day);
  const monthNum = Number(month);
  const valid = name.trim() && dayNum >= 1 && dayNum <= 31 && monthNum >= 1 && monthNum <= 12;

  async function submit() {
    if (!valid || saving) return;
    setSaving(true);
    const payload = {
      title: `Anniversaire de ${name.trim()}`,
      day: dayNum,
      month: monthNum,
    };
    const success = editing ? await onUpdate(birthday.id, payload) : await onCreate(payload);
    setSaving(false);
    if (success !== false) onClose();
  }

  return (
    <div onClick={onBackdropClick} style={{ position: 'fixed', inset: 0, background: 'rgba(29,43,34,0.4)', display: 'flex', alignItems: 'flex-end', zIndex: 60, '--section-accent': CATEGORIES.anniversaire.color }}>
      <div ref={panelRef} role="dialog" aria-modal="true" aria-label={editing ? 'Anniversaire' : 'Ajouter un anniversaire'} className="max-w-md mx-auto" style={{ width: '100%', background: '#fff', borderRadius: '20px 20px 0 0', padding: 20, maxHeight: '85vh', overflowY: 'auto' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
          <span style={{ fontSize: 17, fontWeight: 700, fontFamily: FONT_DISPLAY }}>{editing ? (canManage ? 'Modifier l’anniversaire' : 'Anniversaire') : 'Ajouter un anniversaire'}</span>
          <button onClick={onClose} aria-label="Fermer" className="tap-surface icon-button" style={{ background: 'none', border: 'none' }}><X size={20} /></button>
        </div>

        <p style={{ fontSize: 12, color: MUTED, margin: '0 0 14px', lineHeight: 1.4 }}>
          Jour et mois seulement — pas d'année, pas d'heure, pas de lieu. Ce rappel ne propose
          pas de participation.
        </p>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <input placeholder="Prénom" value={name} onChange={(e) => setName(e.target.value)} disabled={editing && !canManage} style={inputStyle} />
          <div style={{ display: 'flex', gap: 10 }}>
            <input
              type="number" min={1} max={31} placeholder="Jour"
              value={day} onChange={(e) => setDay(e.target.value)} disabled={editing && !canManage}
              style={{ ...inputStyle, flex: 1 }}
            />
            <select value={month} onChange={(e) => setMonth(e.target.value)} disabled={editing && !canManage} style={{ ...inputStyle, flex: 2 }}>
              <option value="">Mois</option>
              {MONTHS.map((m, i) => <option key={m} value={i + 1}>{m}</option>)}
            </select>
          </div>

          {(!editing || canManage) && (
            <button
              onClick={submit}
              disabled={saving || !valid || deleteBusy}
              style={{
                marginTop: 4, padding: '13px 0', borderRadius: 14, border: 'none', fontSize: 14.5, fontWeight: 700, minHeight: 48,
                background: CATEGORIES.anniversaire.color, color: CATEGORIES.anniversaire.onColor,
                opacity: (saving || !valid || deleteBusy) ? 0.5 : 1,
              }}
            >
              {saving ? 'Enregistrement…' : editing ? 'Enregistrer les modifications' : 'Ajouter l’anniversaire'}
            </button>
          )}
          {editing && canManage && (
            <button
              onClick={async () => {
                if (deleteBusy || saving) return;
                if (!window.confirm(`Supprimer « ${birthday.title} » ?`)) return;
                await onDelete(birthday.id);
              }}
              disabled={deleteBusy || saving}
              style={{ padding: '12px 0', borderRadius: 14, border: `1px solid ${RED}55`, background: '#fff', color: RED, fontSize: 14, fontWeight: 700, minHeight: 46, opacity: (deleteBusy || saving) ? 0.5 : 1 }}
            >
              <Trash2 size={15} style={{ display: 'inline', marginRight: 6, verticalAlign: -2 }} />
              {deleteBusy ? 'Suppression…' : 'Supprimer l’anniversaire'}
            </button>
          )}
          {editing && !canManage && (
            <p style={{ margin: '4px 0 0', fontSize: 12, color: MUTED, textAlign: 'center' }}>
              Seul le créateur ou un administrateur peut modifier cet anniversaire.
            </p>
          )}
        </div>
      </div>
    </div>
  );
}

const inputStyle = { minHeight: 48, padding: '10px 12px', borderRadius: 10, border: `1px solid ${CARD_BORDER}`, fontSize: 14 };
