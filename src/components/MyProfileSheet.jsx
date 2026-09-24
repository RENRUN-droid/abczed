import { useRef, useState } from 'react';
import { X, LogOut, Plus, Pencil, Check, Camera } from 'lucide-react';
import { BLUE, RED, INK, MUTED, CARD_BORDER, FONT_DISPLAY, buttonStyle } from '../theme';
import { childrenOf } from '../data';
import { useAuth } from '../auth/AuthProvider';
import { useModalA11y } from '../useModalA11y';
import ConfirmDialog from './ConfirmDialog';
import Avatar from './Avatar';
import * as childrenApi from '../childrenApi';
import * as avatarApi from '../avatarApi';

// Delta §19 : flags de partage indépendants sur un numéro/e-mail uniques (voir data.js) —
// remplace les 4 paires {value, shared} par canal de l'ancien modèle. `LABELS` fait
// correspondre chaque case à cocher au flag qu'elle contrôle.
const LABELS = { share_whatsapp: 'WhatsApp', share_phone: 'Téléphone', share_sms: 'SMS', share_email: 'E-mail' };

// V7.33 (25 sept.) — cette modale lisait jusqu'ici `MEMBERS`/`childrenOf` importés directement
// de src/data.js : la donnée de DÉMONSTRATION d'origine, jamais reliée à Supabase, quel que soit
// le compte réellement connecté. Conséquence signalée par l'utilisatrice : "Mon profil"
// affichait toujours le même prénom d'enfant figé dans le code (jusqu'à une coquille de frappe
// dans ce texte de démo) au lieu de ses vraies données. Corrigé en recevant `members` (l'annuaire
// réel, déjà chargé par App.jsx pour La Bande/MemberDetail) en prop, et en y retrouvant "moi"
// via la sentinelle 'mem-vous' — exactement le même mécanisme que MemberDetail.jsx/LaBande.jsx
// utilisent déjà pour tout le monde D'AUTRE.
//
// Même passage ajoute la gestion des enfants soi-même (ajouter/corriger/retirer) — jusqu'ici
// lecture seule pour tout le monde, y compris l'administratrice (sql/02_rls.sql, "écriture
// volontairement absente en V1"). Voir sql/11_enfants_en_libre_service.sql pour les nouvelles
// policies, et src/childrenApi.js pour les 3 opérations exposées ici.
//
// V7.34 (25 sept.) — même écran, ajout de la photo de profil (jusqu'ici uniquement un cercle de
// couleur avec l'initiale, partout dans l'app). `onChildrenChanged` renommé `onMemberDataChanged`
// (même callback — App.jsx#loadMembers — mais qui ne concerne plus QUE les enfants désormais).
export default function MyProfileSheet({ onClose, shareFlags, onToggleShareFlag, members, communityId, onMemberDataChanged }) {
  const { signOut } = useAuth();
  const me = (members || []).find((m) => m.id === 'mem-vous');
  const kids = me ? childrenOf(me) : [];

  const [adding, setAdding] = useState(false);
  const [newFirstName, setNewFirstName] = useState('');
  const [newGroupLabel, setNewGroupLabel] = useState('');
  const [newLabel, setNewLabel] = useState('Parent');
  const [editingChildId, setEditingChildId] = useState(null);
  const [editFirstName, setEditFirstName] = useState('');
  const [editGroupLabel, setEditGroupLabel] = useState('');
  const [removingChild, setRemovingChild] = useState(null);
  const [busy, setBusy] = useState(false);
  const [childrenError, setChildrenError] = useState('');
  const [avatarBusy, setAvatarBusy] = useState(false);
  const [avatarError, setAvatarError] = useState('');
  const fileInputRef = useRef(null);

  // Brief pt 6/45 : Escape, clic hors modale, piège de focus, et retour du focus (+ repère
  // visuel) sur l'élément qui a ouvert cette modale (l'avatar du header ou la carte "Vous" de
  // La Bande, selon d'où on vient) — un seul mécanisme générique, voir useModalA11y.js.
  const panelRef = useRef(null);
  const { onBackdropClick } = useModalA11y(panelRef, onClose);

  async function handleAvatarFileChange(e) {
    const file = e.target.files?.[0];
    e.target.value = ''; // permet de resélectionner le même fichier ensuite (ex. après une erreur)
    if (!file || !me || avatarBusy) return;
    if (!file.type.startsWith('image/')) { setAvatarError('Choisis une image (photo, JPG, PNG…).'); return; }
    if (file.size > 5 * 1024 * 1024) { setAvatarError('Photo trop lourde (5 Mo maximum).'); return; }
    setAvatarBusy(true); setAvatarError('');
    try {
      await avatarApi.uploadAvatar(me.userId, me.rawId, file);
      await onMemberDataChanged?.();
    } catch {
      setAvatarError("Impossible d'enregistrer cette photo — réessaie.");
    } finally {
      setAvatarBusy(false);
    }
  }

  async function handleRemoveAvatar() {
    if (!me || avatarBusy) return;
    setAvatarBusy(true); setAvatarError('');
    try {
      await avatarApi.removeAvatar(me.userId, me.rawId, me.avatarUrl);
      await onMemberDataChanged?.();
    } catch {
      setAvatarError('Impossible de retirer la photo — réessaie.');
    } finally {
      setAvatarBusy(false);
    }
  }

  async function handleAddChild(e) {
    e.preventDefault();
    if (!newFirstName.trim() || busy || !me) return;
    setBusy(true); setChildrenError('');
    try {
      await childrenApi.addChild(communityId, me.rawId, {
        firstName: newFirstName.trim(),
        groupLabel: newGroupLabel.trim(),
        label: newLabel.trim() || 'Parent',
      });
      setNewFirstName(''); setNewGroupLabel(''); setNewLabel('Parent'); setAdding(false);
      await onMemberDataChanged?.();
    } catch {
      setChildrenError("Impossible d'ajouter cet enfant — réessaie.");
    } finally {
      setBusy(false);
    }
  }

  function startEdit(child) {
    setChildrenError('');
    setEditingChildId(child.childId);
    setEditFirstName(child.firstName);
    setEditGroupLabel(child.groupLabel || '');
  }

  async function handleSaveEdit(childId) {
    if (!editFirstName.trim() || busy) return;
    setBusy(true); setChildrenError('');
    try {
      await childrenApi.updateChild(childId, { firstName: editFirstName.trim(), groupLabel: editGroupLabel.trim() });
      setEditingChildId(null);
      await onMemberDataChanged?.();
    } catch {
      setChildrenError('Impossible d\'enregistrer — réessaie.');
    } finally {
      setBusy(false);
    }
  }

  async function handleConfirmRemove() {
    if (!removingChild || busy || !me) return;
    setBusy(true); setChildrenError('');
    try {
      await childrenApi.removeChildLink(me.rawId, removingChild.childId);
      setRemovingChild(null);
      await onMemberDataChanged?.();
    } catch {
      setChildrenError('Impossible de retirer cet enfant — réessaie.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div onClick={onBackdropClick} style={{ position: 'fixed', inset: 0, background: 'rgba(23,32,51,0.4)', display: 'flex', alignItems: 'flex-end', zIndex: 60 }}>
      <div ref={panelRef} role="dialog" aria-modal="true" aria-label="Mon profil" className="max-w-md mx-auto" style={{ width: '100%', background: '#fff', borderRadius: '20px 20px 0 0', padding: 20, maxHeight: '85vh', overflowY: 'auto' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
          <span style={{ fontSize: 17, fontWeight: 700, fontFamily: FONT_DISPLAY }}>Mon profil</span>
          <button onClick={onClose} aria-label="Fermer" className="tap-surface icon-button" style={{ background: 'none', border: 'none' }}><X size={20} /></button>
        </div>

        {!me ? (
          <p style={{ fontSize: 13.5, color: MUTED, padding: '20px 0' }}>Chargement de ton profil…</p>
        ) : (
          <>
            <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 20 }}>
              {/* V7.34 — photo de profil : bucket Storage privé `avatars` + `members.avatar_url`,
                  déjà entièrement prêts côté base depuis l'origine (voir src/avatarApi.js) —
                  seule l'interface manquait. Le crayon déclenche un `<input type="file">` caché
                  (id/htmlFor plutôt qu'un ref direct sur le bouton, pour rester accessible au
                  clavier) ; tap sur l'avatar lui-même fait la même chose. */}
              <div style={{ position: 'relative', width: 56, height: 56, flexShrink: 0 }}>
                <label
                  htmlFor="avatar-file-input"
                  className="tap-surface"
                  style={{ display: 'block', width: 56, height: 56, borderRadius: '50%', cursor: avatarBusy ? 'default' : 'pointer', opacity: avatarBusy ? 0.5 : 1 }}
                >
                  <Avatar avatarPath={me.avatarUrl} color={me.avatarColor} initials={me.firstName.slice(0, 1)} size={56} alt="Ta photo de profil" />
                </label>
                <input
                  id="avatar-file-input" ref={fileInputRef} type="file" accept="image/*"
                  onChange={handleAvatarFileChange} disabled={avatarBusy}
                  style={{ position: 'absolute', width: 1, height: 1, opacity: 0, pointerEvents: 'none' }}
                />
                <label
                  htmlFor="avatar-file-input"
                  className="tap-surface"
                  aria-hidden="true"
                  style={{
                    position: 'absolute', bottom: -2, right: -2, width: 22, height: 22, borderRadius: '50%',
                    background: BLUE, border: '2px solid #fff', display: 'flex', alignItems: 'center', justifyContent: 'center',
                    cursor: avatarBusy ? 'default' : 'pointer',
                  }}
                >
                  <Camera size={11} color="#fff" />
                </label>
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 15, fontWeight: 700 }}>{me.firstName}{me.lastName ? ` ${me.lastName}` : ''}</div>
                {me.avatarUrl && (
                  <button type="button" onClick={handleRemoveAvatar} disabled={avatarBusy} className="tap-surface" style={{ background: 'none', border: 'none', padding: 0, marginTop: 2, fontSize: 12.5, fontWeight: 600, color: MUTED, cursor: avatarBusy ? 'default' : 'pointer' }}>
                    {avatarBusy ? 'Un instant…' : 'Retirer la photo'}
                  </button>
                )}
              </div>
            </div>

            {avatarError && <p role="alert" style={{ fontSize: 13, color: RED, margin: '0 0 12px' }}>{avatarError}</p>}

            {/* V7.33 — "Mes enfants" : jusqu'ici lecture seule (voir note en tête de fichier). */}
            <div style={{ fontSize: 13, fontWeight: 700, color: INK, margin: '0 0 8px' }}>Mes enfants</div>

            {kids.length === 0 && !adding && (
              <p style={{ fontSize: 13, color: MUTED, margin: '0 0 10px' }}>Aucun enfant renseigné pour l'instant.</p>
            )}

            <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 10 }}>
              {kids.map((child) => (
                <div key={child.childId} style={{ border: `1px solid ${CARD_BORDER}`, borderRadius: 12, padding: '10px 12px' }}>
                  {editingChildId === child.childId ? (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                      <div>
                        <label htmlFor={`edit-fn-${child.childId}`} style={labelStyle}>Prénom</label>
                        <input id={`edit-fn-${child.childId}`} type="text" value={editFirstName} onChange={(e) => setEditFirstName(e.target.value)} disabled={busy} style={inputStyle} />
                      </div>
                      <div>
                        <label htmlFor={`edit-gl-${child.childId}`} style={labelStyle}>Classe (optionnel)</label>
                        <input id={`edit-gl-${child.childId}`} type="text" value={editGroupLabel} onChange={(e) => setEditGroupLabel(e.target.value)} disabled={busy} style={inputStyle} placeholder="ex. MS/GS" />
                      </div>
                      <div style={{ display: 'flex', gap: 8 }}>
                        <button type="button" onClick={() => handleSaveEdit(child.childId)} disabled={busy || !editFirstName.trim()} className="tap-surface" style={{ ...buttonStyle('primary', { compact: true }), flex: 1 }}>
                          <Check size={15} /> Enregistrer
                        </button>
                        <button type="button" onClick={() => setEditingChildId(null)} disabled={busy} className="tap-surface" style={{ ...buttonStyle('secondary', { compact: true }), flex: 1 }}>
                          Annuler
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
                      <div style={{ fontSize: 13.5, color: INK }}>
                        {child.label} de <strong>{child.firstName}</strong>{child.groupLabel ? ` · ${child.groupLabel}` : ''}
                      </div>
                      <div style={{ display: 'flex', gap: 2 }}>
                        <button type="button" onClick={() => startEdit(child)} aria-label={`Modifier ${child.firstName}`} className="tap-surface icon-button" style={{ background: 'none', border: 'none', width: 36, height: 36, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                          <Pencil size={15} color={MUTED} />
                        </button>
                        <button type="button" onClick={() => setRemovingChild(child)} aria-label={`Retirer ${child.firstName}`} className="tap-surface icon-button" style={{ background: 'none', border: 'none', width: 36, height: 36, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                          <X size={15} color={RED} />
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>

            {adding ? (
              <form onSubmit={handleAddChild} style={{ display: 'flex', flexDirection: 'column', gap: 8, border: `1px solid ${CARD_BORDER}`, borderRadius: 12, padding: '10px 12px', marginBottom: 14 }}>
                <div>
                  <label htmlFor="new-child-fn" style={labelStyle}>Prénom</label>
                  <input id="new-child-fn" type="text" required value={newFirstName} onChange={(e) => setNewFirstName(e.target.value)} disabled={busy} style={inputStyle} autoFocus />
                </div>
                <div>
                  <label htmlFor="new-child-gl" style={labelStyle}>Classe (optionnel)</label>
                  <input id="new-child-gl" type="text" value={newGroupLabel} onChange={(e) => setNewGroupLabel(e.target.value)} disabled={busy} style={inputStyle} placeholder="ex. MS/GS" />
                </div>
                <div>
                  <label htmlFor="new-child-label" style={labelStyle}>Vous êtes son/sa</label>
                  <input id="new-child-label" type="text" value={newLabel} onChange={(e) => setNewLabel(e.target.value)} disabled={busy} style={inputStyle} placeholder="Maman, Papa, Parent…" />
                </div>
                <div style={{ display: 'flex', gap: 8 }}>
                  <button type="submit" disabled={busy || !newFirstName.trim()} className="tap-surface" style={{ ...buttonStyle('primary', { compact: true }), flex: 1 }}>
                    {busy ? 'Ajout…' : 'Ajouter'}
                  </button>
                  <button type="button" onClick={() => { setAdding(false); setChildrenError(''); }} disabled={busy} className="tap-surface" style={{ ...buttonStyle('secondary', { compact: true }), flex: 1 }}>
                    Annuler
                  </button>
                </div>
              </form>
            ) : (
              <button type="button" onClick={() => setAdding(true)} className="tap-surface" style={{ ...buttonStyle('secondary', { compact: true }), width: '100%', marginBottom: 14 }}>
                <Plus size={16} /> Ajouter un enfant
              </button>
            )}

            {childrenError && <p role="alert" style={{ fontSize: 13, color: RED, margin: '0 0 14px' }}>{childrenError}</p>}

            {/* Correction post-livraison (contre-vérification indépendante) : logique pure
                d'inversion d'un flag de partage, extraite pour être testable indépendamment de
                React (src/shareFlags.js) — utilisée par App.jsx (toggleMeShareFlag) pour
                mettre à jour l'état des réglages ci-dessous, désormais porté par App.jsx (qui
                ne démonte jamais) plutôt que par un useState local ici (perdu à chaque
                fermeture de la modale). Reste réellement local à la session — `members` n'a
                aucune colonne pour ça aujourd'hui — d'où le texte ci-dessous, une limitation
                actuelle et réelle, pas une relique : reste affiché tant qu'elle est vraie. */}
            <p style={{ fontSize: 11.5, color: MUTED, margin: '0 0 16px', lineHeight: 1.4 }}>
              Ces préférences sont enregistrées uniquement pour cette session et ne sont pas encore synchronisées avec Supabase.
            </p>

            <div style={{ fontSize: 13, fontWeight: 700, color: '#172033', margin: '0 0 4px' }}>
              Votre numéro et votre e-mail ne sont visibles par les autres membres que si vous choisissez de les partager ici.
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 4, marginTop: 10 }}>
              {Object.keys(LABELS).map((key) => (
                <label key={key} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 4px', borderBottom: `1px solid ${CARD_BORDER}`, minHeight: 44 }}>
                  <span style={{ fontSize: 14 }}>Partager mon {LABELS[key].toLowerCase()} avec La Bande</span>
                  <input type="checkbox" checked={shareFlags[key]} onChange={() => onToggleShareFlag(key)} style={{ width: 20, height: 20, accentColor: BLUE }} />
                </label>
              ))}
            </div>

            {/* Point 4 (recette réelle sur PC, audit transversal des couleurs) : "Se déconnecter"
                utilisait RED (#E53935 codé en dur, sans même importer le token) — RED est réservé
                à l'annulation/suppression dans le reste de l'app (annuler une participation,
                supprimer un partage) ; se déconnecter n'annule ni ne supprime rien, c'est une
                action neutre. La couleur RED sur un bouton aussi visible aurait laissé croire à
                une action destructrice qu'elle n'est pas. Style neutre (bordure/texte gris,
                cohérent avec CARD_BORDER/MUTED déjà utilisés dans cette même modale) à la place. */}
            <button
              onClick={signOut}
              className="tap-surface"
              style={{
                width: '100%', marginTop: 20, padding: '12px 0', borderRadius: 14, minHeight: 44,
                border: `1px solid ${CARD_BORDER}`, background: 'none', color: MUTED,
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                fontSize: 14, fontWeight: 600,
              }}
            >
              <LogOut size={16} /> Se déconnecter
            </button>
          </>
        )}
      </div>

      {removingChild && (
        <ConfirmDialog
          title={`Retirer ${removingChild.firstName} ?`}
          message={`${removingChild.firstName} n'apparaîtra plus sur ton profil. Si un autre parent est aussi rattaché à ${removingChild.firstName}, son propre profil n'est pas affecté.`}
          cautiousLabel="Annuler"
          confirmLabel="Retirer"
          confirmBusyLabel="Retrait…"
          busy={busy}
          onCautious={() => setRemovingChild(null)}
          onConfirm={handleConfirmRemove}
        />
      )}
    </div>
  );
}

const labelStyle = { display: 'block', fontSize: 12, fontWeight: 600, color: INK, marginBottom: 4 };
const inputStyle = {
  width: '100%', boxSizing: 'border-box', padding: '9px 12px', borderRadius: 10, border: `1px solid ${CARD_BORDER}`,
  fontSize: 14, minHeight: 40,
};
