import { useRef, useState } from 'react';
import { X, FileText, Image, Link2, Info, Paperclip } from 'lucide-react';
import { RED, MUTED, CARD_BORDER, SHARE_TYPE_THEMES, SECTION_THEMES, FONT_DISPLAY } from '../theme';
import { linkableEvents } from '../data';
import { useModalA11y } from '../useModalA11y';
import { isValidAbsoluteUrl } from '../urlValidation';
import { MAX_LOCAL_FILE_BYTES } from '../sharesStorage';

const TYPES = [
  { key: 'document', label: 'Fichier', icon: FileText },
  { key: 'photo', label: 'Photo', icon: Image },
  { key: 'lien', label: 'Lien', icon: Link2 },
  { key: 'info', label: 'Information', icon: Info },
];

// Item 13/item 11 : même patron visuel d'erreur de champ que CreateEventSheet.jsx (bordure
// RED, message inline, aria-invalid/aria-describedby) — recopié ici plutôt qu'importé, car
// CreateEventSheet.jsx est hors périmètre de cette phase (propriété de la phase 2, ne pas
// toucher) et ces deux helpers n'y sont pas exportés ; même apparence garantie par les mêmes
// tokens (theme.js), pas par coïncidence visuelle.
const labelStyle = { display: 'block', fontSize: 12, fontWeight: 700, color: MUTED, marginBottom: 4 };
const inputStyle = { width: '100%', boxSizing: 'border-box', minHeight: 48, padding: '10px 12px', borderRadius: 10, border: `1px solid ${CARD_BORDER}`, fontSize: 14, background: '#fff' };
function fieldStyle(hasError) {
  return { ...inputStyle, border: `1.5px solid ${hasError ? RED : CARD_BORDER}` };
}
function ErrorText({ id, message }) {
  if (!message) return null;
  return <p id={id} style={{ margin: '4px 0 0', fontSize: 12, fontWeight: 600, color: RED }}>{message}</p>;
}

function formatBytes(n) {
  if (n == null) return '';
  if (n < 1024) return `${n} o`;
  if (n < 1024 * 1024) return `${Math.round(n / 1024)} Ko`;
  return `${(n / (1024 * 1024)).toFixed(1)} Mo`;
}

export default function AddShareSheet({ onClose, onCreate, editingShare }) {
  const isEditing = Boolean(editingShare);
  const [type, setType] = useState(editingShare?.type || 'document');
  const [title, setTitle] = useState(editingShare?.title || '');
  const [description, setDescription] = useState(editingShare?.description || '');
  const [linkUrl, setLinkUrl] = useState(editingShare?.linkUrl || '');
  const [linkedEventId, setLinkedEventId] = useState(editingShare?.linkedEventId || '');
  // Item 11 : remplace le champ texte libre "Nom du fichier" — un vrai fichier choisi via
  // <input type="file">, lu en `data:` URL (FileReader) pour que "Ouvrir"/"Télécharger"
  // fonctionnent réellement dans cette démo locale (aucun Supabase Storage réel ici,
  // BUSINESS_DATA_FROM_SUPABASE=false — voir sql/08_shares_storage.sql pour le schéma prévu
  // côté vrai Storage). `null` tant qu'aucun nouveau fichier n'a été choisi — en modification,
  // le fichier déjà enregistré (editingShare.fileName/fileDataUrl) reste utilisé si non
  // remplacé (voir submit()).
  const [documentFile, setDocumentFile] = useState(null);
  const [photoFile, setPhotoFile] = useState(null);
  const [errors, setErrors] = useState({});
  const [submitError, setSubmitError] = useState('');
  const [saving, setSaving] = useState(false);
  const panelRef = useRef(null);
  const { onBackdropClick } = useModalA11y(panelRef, onClose);

  const titleRef = useRef(null);
  const fileRef = useRef(null);
  const photoRef = useRef(null);
  const linkRef = useRef(null);
  const FIELD_REFS = { title: titleRef, file: fileRef, photo: photoRef, linkUrl: linkRef };

  function readFile(fileList, kind) {
    const file = fileList?.[0];
    if (!file) return;
    if (file.size > MAX_LOCAL_FILE_BYTES) {
      setErrors((prev) => ({ ...prev, [kind]: `Fichier trop volumineux pour cette démo locale (maximum ${formatBytes(MAX_LOCAL_FILE_BYTES)}).` }));
      return;
    }
    setErrors((prev) => { const next = { ...prev }; delete next[kind]; return next; });
    const reader = new FileReader();
    reader.onload = () => {
      const entry = { name: file.name, size: file.size, dataUrl: reader.result };
      if (kind === 'file') setDocumentFile(entry); else setPhotoFile(entry);
    };
    reader.onerror = () => {
      setErrors((prev) => ({ ...prev, [kind]: "Impossible de lire ce fichier sur cet appareil — réessaie ou choisis-en un autre." }));
    };
    reader.readAsDataURL(file);
  }

  // Item 13 (même patron que CreateEventSheet.jsx) : validation réelle à la soumission, jamais
  // un simple `disabled` sans explication — le bouton reste cliquable, une tentative invalide
  // produit une erreur inline précise + déplace le focus sur le premier champ fautif.
  function validate() {
    const errs = {};
    if (!title.trim()) errs.title = 'Indique un titre.';
    if (type === 'document') {
      const hasFile = documentFile || editingShare?.fileName;
      if (!hasFile) errs.file = 'Choisis un fichier.';
    }
    if (type === 'photo') {
      const hasPhoto = photoFile || editingShare?.photoDataUrl;
      if (!hasPhoto) errs.photo = 'Choisis une photo.';
    }
    if (type === 'lien') {
      if (!linkUrl.trim()) errs.linkUrl = 'Indique un lien.';
      else if (!isValidAbsoluteUrl(linkUrl)) errs.linkUrl = 'Adresse invalide — utilise une adresse complète, ex. https://exemple.fr.';
    }
    return errs;
  }

  function focusFirstError(errs) {
    const order = ['title', 'file', 'photo', 'linkUrl'];
    for (const key of order) {
      if (errs[key]) { FIELD_REFS[key].current?.focus(); return; }
    }
  }

  async function submit() {
    if (saving) return;
    const errs = validate();
    setErrors(errs);
    if (Object.keys(errs).length > 0) {
      focusFirstError(errs);
      return;
    }
    setSaving(true);
    setSubmitError('');
    const payload = {
      id: editingShare?.id,
      type,
      title: title.trim(),
      description: description.trim(),
      linkedEventId: linkedEventId || null,
    };
    if (type === 'document') {
      const f = documentFile;
      payload.fileName = f ? f.name : editingShare?.fileName;
      payload.fileSize = f ? formatBytes(f.size) : editingShare?.fileSize;
      // Nouveau fichier -> sa data: URL ; sinon (modification sans remplacement) -> celle déjà
      // enregistrée, s'il y en avait une (undefined sinon, jamais une chaîne vide trompeuse).
      payload.fileDataUrl = f ? f.dataUrl : editingShare?.fileDataUrl;
    }
    if (type === 'photo') {
      const f = photoFile;
      payload.photoDataUrl = f ? f.dataUrl : editingShare?.photoDataUrl;
      payload.photoCount = editingShare?.photoCount || 1;
    }
    if (type === 'lien') {
      const trimmed = linkUrl.trim();
      payload.linkUrl = trimmed;
      payload.domain = trimmed.replace(/^https?:\/\//, '').split('/')[0];
    }
    // Item 11 : App.jsx renvoie désormais { ok, error? } (persistance locale réelle,
    // src/sharesStorage.js) au lieu de rien — un échec (ex. quota localStorage dépassé) garde
    // le formulaire ouvert avec toutes les valeurs déjà saisies intactes, erreur affichée
    // inline, jamais une fermeture silencieuse qui ferait croire le partage enregistré.
    const result = await onCreate(payload);
    setSaving(false);
    if (result && result.ok === false) {
      setSubmitError(result.error || "Une erreur est survenue — réessaie.");
      return;
    }
    onClose();
  }

  return (
    <div onClick={onBackdropClick} style={{ position: 'fixed', inset: 0, background: 'rgba(23,32,51,0.4)', display: 'flex', alignItems: 'flex-end', zIndex: 60, '--section-accent': SECTION_THEMES.partages.color }}>
      <div ref={panelRef} role="dialog" aria-modal="true" aria-label={isEditing ? 'Modifier le partage' : 'Ajouter un partage'} className="max-w-md mx-auto" style={{ width: '100%', background: '#fff', borderRadius: '20px 20px 0 0', padding: 20, maxHeight: '85vh', overflowY: 'auto' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
          <span style={{ fontSize: 17, fontWeight: 700, fontFamily: FONT_DISPLAY }}>{isEditing ? 'Modifier le partage' : 'Ajouter un partage'}</span>
          <button onClick={onClose} aria-label="Fermer" className="tap-surface icon-button" style={{ background: 'none', border: 'none' }}><X size={20} /></button>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 8, marginBottom: 16 }}>
          {TYPES.map((t) => {
            const Icon = t.icon;
            const active = type === t.key;
            return (
              <button
                key={t.key}
                onClick={() => { setType(t.key); setErrors({}); }}
                aria-pressed={active}
                style={{
                  flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4,
                  minHeight: 52, padding: '8px 6px', borderRadius: 12, border: 'none',
                  background: active ? SHARE_TYPE_THEMES[t.key].color : SHARE_TYPE_THEMES[t.key].tint,
                  color: active ? '#fff' : SHARE_TYPE_THEMES[t.key].color,
                }}
              >
                <Icon size={18} />
                <span style={{ fontSize: 11, fontWeight: 600 }}>{t.label}</span>
              </button>
            );
          })}
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <div>
            <label htmlFor="ass-title" style={labelStyle}>Titre</label>
            <input
              id="ass-title"
              ref={titleRef}
              placeholder="Titre"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              aria-invalid={errors.title ? 'true' : undefined}
              aria-describedby={errors.title ? 'ass-error-title' : undefined}
              style={fieldStyle(errors.title)}
            />
            <ErrorText id="ass-error-title" message={errors.title} />
          </div>

          {type === 'document' && (
            <div>
              <label htmlFor="ass-file" style={labelStyle}>Fichier</label>
              <input
                id="ass-file"
                ref={fileRef}
                type="file"
                // Types raisonnables pour un partage familial : documents courants + images
                // (une photo scannée d'un formulaire papier reste un cas réel fréquent).
                accept=".pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt,.csv,image/*"
                onChange={(e) => readFile(e.target.files, 'file')}
                aria-invalid={errors.file ? 'true' : undefined}
                aria-describedby={errors.file ? 'ass-error-file' : undefined}
                style={fieldStyle(errors.file)}
              />
              {(documentFile || editingShare?.fileName) && (
                <p style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12.5, color: MUTED, margin: '6px 0 0' }}>
                  <Paperclip size={13} />
                  {documentFile ? `${documentFile.name} · ${formatBytes(documentFile.size)}` : `${editingShare.fileName}${editingShare.fileSize ? ' · ' + editingShare.fileSize : ''}`}
                </p>
              )}
              <ErrorText id="ass-error-file" message={errors.file} />
            </div>
          )}
          {type === 'lien' && (
            <div>
              <label htmlFor="ass-link" style={labelStyle}>Lien</label>
              <input
                id="ass-link"
                ref={linkRef}
                placeholder="https://…"
                value={linkUrl}
                onChange={(e) => setLinkUrl(e.target.value)}
                aria-invalid={errors.linkUrl ? 'true' : undefined}
                aria-describedby={errors.linkUrl ? 'ass-error-link' : undefined}
                style={fieldStyle(errors.linkUrl)}
              />
              <ErrorText id="ass-error-link" message={errors.linkUrl} />
            </div>
          )}
          {type === 'photo' && (
            <div>
              <label htmlFor="ass-photo" style={labelStyle}>Photo</label>
              <input
                id="ass-photo"
                ref={photoRef}
                type="file"
                accept="image/*"
                // `capture` reste un indice pour les navigateurs mobiles (ouvre directement
                // l'appareil photo comme option) — n'empêche jamais de choisir une photo déjà
                // existante dans la pellicule, contrairement à `capture="environment"` seul
                // sur certains anciens navigateurs ; laissé sans valeur forcée pour ça.
                capture="environment"
                onChange={(e) => readFile(e.target.files, 'photo')}
                aria-invalid={errors.photo ? 'true' : undefined}
                aria-describedby={errors.photo ? 'ass-error-photo' : undefined}
                style={fieldStyle(errors.photo)}
              />
              {/* Item 11 : vraie miniature d'aperçu avant envoi — remplace le texte
                  "non disponible" qui existait avant cette passe. */}
              {(photoFile || editingShare?.photoDataUrl) && (
                <img
                  src={photoFile ? photoFile.dataUrl : editingShare.photoDataUrl}
                  alt="Aperçu de la photo choisie"
                  style={{ marginTop: 8, width: '100%', maxHeight: 160, objectFit: 'cover', borderRadius: 10, border: `1px solid ${CARD_BORDER}` }}
                />
              )}
              <ErrorText id="ass-error-photo" message={errors.photo} />
            </div>
          )}
          {/* Item 11 : Information reste texte seul (titre + description ci-dessous couvrent
              déjà ce type) — aucun champ fichier/lien requis, confirmé non cassé par cette
              passe (rendu conditionnel déjà correct avant, non modifié ici). */}

          <div>
            <label htmlFor="ass-description" style={labelStyle}>Description (optionnel)</label>
            <textarea id="ass-description" placeholder="Description (optionnel)" value={description} onChange={(e) => setDescription(e.target.value)} rows={3} style={{ ...inputStyle, resize: 'none' }} />
          </div>

          {/* Item 11 : libellé exact demandé — "Événement associé (facultatif)" / option par
              défaut "Aucun événement" (avant cette passe : pas de <label> propre, l'option par
              défaut disait "Ne pas lier à un événement"). Un vrai <label htmlFor> plutôt qu'un
              texte reposant uniquement sur l'option elle-même — principe déjà posé en phase 2
              pour CreateEventSheet.jsx ("aucun champ ne doit reposer sur un placeholder comme
              seul libellé"). */}
          <div>
            <label htmlFor="ass-linked-event" style={labelStyle}>Événement associé (facultatif)</label>
            <select id="ass-linked-event" value={linkedEventId} onChange={(e) => setLinkedEventId(e.target.value)} style={inputStyle}>
              <option value="">Aucun événement</option>
              {linkableEvents().map((e) => (
                <option key={e.id} value={e.id}>{e.title}</option>
              ))}
            </select>
          </div>

          {submitError && (
            <div style={{ background: '#FCE9E7', border: '1px solid #D9463033', borderRadius: 10, padding: '8px 12px', fontSize: 12.5, color: '#8A2E1F' }}>
              {submitError}
            </div>
          )}

          <button
            onClick={submit}
            disabled={saving}
            style={{
              marginTop: 4, padding: '13px 0', borderRadius: 14, border: 'none', fontSize: 14.5, fontWeight: 700, minHeight: 48,
              background: SECTION_THEMES.partages.color, color: '#fff',
              opacity: saving ? 0.6 : 1,
            }}
          >
            {saving ? (isEditing ? 'Enregistrement…' : 'Ajout…') : (isEditing ? 'Enregistrer' : 'Ajouter')}
          </button>
        </div>
      </div>
    </div>
  );
}
