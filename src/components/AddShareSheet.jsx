import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { X, FileText, Image, Link2, Info, Paperclip } from 'lucide-react';
import { RED, MUTED, CARD_BORDER, SHARE_TYPE_THEMES, SECTION_THEMES, FONT_DISPLAY } from '../theme';
import { useModalA11y } from '../useModalA11y';
import { isValidAbsoluteUrl } from '../urlValidation';
import { MAX_SHARE_FILE_BYTES, MAX_SHARE_FILES_COUNT } from '../sharesApi';

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

// Signalé en recette (23 sept.) : le bloc de champ propre à chaque type (Fichier/Lien/Photo/
// rien pour Information) n'a pas la même hauteur — passer à "Information" fait donc rétrécir
// le cadre d'un coup, perçu comme un décalage. Comportement normal (moins de champs = moins de
// hauteur), pas un bug — mais la demande explicite est d'adoucir la transition, pas de la
// supprimer. Pas de librairie : simple mesure de la hauteur réelle du contenu (scrollHeight)
// après chaque changement de type, appliquée en hauteur explicite avec une transition CSS.
// Premier montage volontairement SANS animation (départ à 'auto', un navigateur n'anime jamais
// depuis 'auto' — la bascule vers la première valeur en pixels est donc instantanée) : seul un
// changement de type en cours d'utilisation doit être adouci, pas l'ouverture du formulaire.
function AnimatedTypeFields({ children }) {
  const innerRef = useRef(null);
  const [height, setHeight] = useState('auto');
  useLayoutEffect(() => {
    setHeight(innerRef.current ? innerRef.current.scrollHeight : 0);
  }, [children]);
  return (
    <div style={{ height, overflow: 'hidden', transition: 'height 0.25s ease' }}>
      <div ref={innerRef}>{children}</div>
    </div>
  );
}

function formatBytes(n) {
  if (n == null) return '';
  if (n < 1024) return `${n} o`;
  if (n < 1024 * 1024) return `${Math.round(n / 1024)} Ko`;
  return `${(n / (1024 * 1024)).toFixed(1)} Mo`;
}

export default function AddShareSheet({ onClose, onCreate, editingShare, events }) {
  const isEditing = Boolean(editingShare);
  const [type, setType] = useState(editingShare?.type || 'document');
  const [title, setTitle] = useState(editingShare?.title || '');
  const [description, setDescription] = useState(editingShare?.description || '');
  const [linkUrl, setLinkUrl] = useState(editingShare?.linkUrl || '');
  const [linkedEventId, setLinkedEventId] = useState(editingShare?.linkedEventId || '');
  // V7.76 (11 oct.) — plusieurs fichiers par partage (Documents ET Photos, jusqu'à
  // MAX_SHARE_FILES_COUNT), demande explicite de l'utilisatrice : le formulaire ne permettait
  // jusqu'ici de choisir qu'UN SEUL fichier, sans pouvoir en ajouter d'autres ensuite. Remplace
  // les anciens `documentFile`/`photoFile` (un seul File, ou `null`) par deux tableaux — un par
  // type, car un partage n'a qu'un seul `type` à la fois (document OU photo, jamais les deux) et
  // changer de tuile ne doit pas faire disparaître ce qui a déjà été choisi dans l'autre tuile.
  // Chaque entrée : `{ localId, file, previewUrl }` — `localId` (clé React stable + ciblage pour
  // le retrait), `previewUrl` (URL objet, UNIQUEMENT pour les photos, `null` pour un document).
  const [newDocFiles, setNewDocFiles] = useState([]);
  const [newPhotoFiles, setNewPhotoFiles] = useState([]);
  // En modification : fichiers DÉJÀ enregistrés (editingShare.files, résolus en URL signée par
  // sharesApi.fetchShares) que l'utilisatrice a marqués à retirer — un Set de `path` (plutôt que
  // `id`, qui peut valoir `null` pour un fichier encore porté par les colonnes historiques, voir
  // le commentaire de fetchShares dans sharesApi.js — `path`, lui, est toujours unique et présent).
  const [removedExistingFilePaths, setRemovedExistingFilePaths] = useState(() => new Set());
  const [errors, setErrors] = useState({});
  const [submitError, setSubmitError] = useState('');
  const [saving, setSaving] = useState(false);
  const panelRef = useRef(null);
  const { onBackdropClick } = useModalA11y(panelRef, guardedOnClose);

  const titleRef = useRef(null);
  const fileRef = useRef(null);
  const photoRef = useRef(null);
  const linkRef = useRef(null);
  const FIELD_REFS = { title: titleRef, file: fileRef, photo: photoRef, linkUrl: linkRef };

  // V7.60 (1er oct.) — ergonomie signalée en recette : taper une tuile "Fichier"/"Photo" ne
  // faisait QUE révéler le champ correspondant plus bas dans le formulaire — il fallait ensuite
  // taper une seconde fois, sur CE champ, pour réellement ouvrir le sélecteur natif. Signalé
  // explicitement comme pas intuitif ("il faut tout simplement cliquer sur fichier qui est en
  // dessous"). Désormais, taper une tuile qui a besoin d'un fichier (Fichier/Photo) ouvre
  // IMMÉDIATEMENT le sélecteur natif correspondant, sans étape intermédiaire ; taper "Lien"
  // place directement le curseur dans son champ. `autoOpenRef` mémorise l'intention entre le
  // clic (qui ne fait que changer `type`, donc démonte/remonte le champ concerné via
  // AnimatedTypeFields) et l'effet ci-dessous, qui s'exécute APRÈS que React a mis à jour le DOM
  // et donc monté le bon champ — jamais une tentative de clic synchrone sur un champ qui
  // n'existe pas encore au moment du clic sur la tuile.
  const autoOpenRef = useRef(null);
  function selectType(key) {
    setType(key);
    // Correctif recette (23 sept.) : l'erreur d'un envoi précédent (`submitError`) restait
    // affichée en changeant de type — comportement déjà en place avant ce lot, conservé ici.
    setErrors({});
    setSubmitError('');
    if (key === 'document' || key === 'photo' || key === 'lien') {
      autoOpenRef.current = key;
    }
  }
  useEffect(() => {
    if (autoOpenRef.current !== type) return;
    autoOpenRef.current = null;
    if (type === 'document') { fileRef.current?.click(); }
    else if (type === 'photo') { photoRef.current?.click(); }
    else if (type === 'lien') linkRef.current?.focus();
  }, [type]);

  // V7.56 (1er oct.) puis V7.57 (1er oct., correctif du correctif) — bug réel trouvé en recette
  // (captures d'écran à l'appui) : choisir un fichier dans l'explorateur Android (ou une photo
  // dans la galerie) referme IMMÉDIATEMENT cette feuille et ramène sur la page Partages vide,
  // sans aucune erreur, AVANT même que le champ n'ait pu afficher le fichier choisi. V7.56
  // armait la protection seulement dans l'`onChange` du champ fichier — trop tard : si le
  // "clic fantôme" (rejoué par Android/Chrome WebView sur la page, à l'endroit tapé dans
  // l'explorateur, au retour d'une appli externe ouverte par <input type="file">) ferme la
  // feuille AVANT que le navigateur ait eu le temps de livrer l'évènement `change` au champ
  // (le champ est alors déjà démonté), `onChange` ne se déclenche jamais et la protection
  // n'était donc jamais armée à temps — ce qui explique que V7.56 n'ait rien changé. V7.57
  // arme la protection dès le clic qui OUVRE le sélecteur (avant même que l'appli externe ne
  // s'ouvre), la maintient pendant toute la durée où l'appli externe est au premier plan, et ne
  // la relâche qu'un court instant après le retour réel sur la page (`focus`/`visibilitychange`)
  // — fenêtre qui couvre donc tout le trajet, pas seulement l'instant du `change`. Branché
  // directement DANS `onClose` passé à `useModalA11y` (pas seulement sur le clic du fond) pour
  // couvrir aussi bien un clic fantôme que éventuellement une touche fantôme (Echap).
  const suppressCloseRef = useRef(false);
  const suppressCloseTimerRef = useRef(null);
  function armCloseSuppression() {
    suppressCloseRef.current = true;
  }
  useEffect(() => {
    function onPossibleReturn() {
      if (!suppressCloseRef.current) return;
      // V7.69 (3 oct.) — bug réel trouvé grâce au journal de diagnostic : cette fonction
      // s'exécute aussi bien quand la page devient CACHÉE (en partant vers le sélecteur de
      // fichier) que quand elle redevient VISIBLE (au retour) — `visibilitychange` se déclenche
      // dans les deux sens. Avant ce correctif, le décompte d'1 seconde démarrait dès le départ
      // (page cachée), donc la protection tombait PENDANT que le sélecteur de fichier natif
      // était encore ouvert, bien avant le retour réel — l'inverse de l'intention du
      // commentaire V7.57 ci-dessus. Ne démarrer le décompte qu'au retour réel (page de nouveau
      // visible, ou focus de la fenêtre) couvre désormais tout le trajet comme prévu.
      if (document.visibilityState === 'hidden') return;
      window.clearTimeout(suppressCloseTimerRef.current);
      suppressCloseTimerRef.current = window.setTimeout(() => {
        suppressCloseRef.current = false;
      }, 1000);
    }
    window.addEventListener('focus', onPossibleReturn);
    document.addEventListener('visibilitychange', onPossibleReturn);
    return () => {
      window.removeEventListener('focus', onPossibleReturn);
      document.removeEventListener('visibilitychange', onPossibleReturn);
      window.clearTimeout(suppressCloseTimerRef.current);
    };
  }, []);
  function guardedOnClose() {
    if (suppressCloseRef.current) return;
    onClose();
  }

  // V7.76 — toutes les URLs objet (aperçus photo) encore vivantes sont révoquées au démontage,
  // jamais de fuite mémoire sur une longue session (plusieurs photos essayées avant validation).
  // Un `ref` tenu à jour à chaque rendu (plutôt qu'une dépendance `[newPhotoFiles]` sur l'effet
  // lui-même) est nécessaire ici : avec une dépendance directe, la fonction de nettoyage
  // s'exécuterait à CHAQUE changement du tableau (à chaque photo ajoutée/retirée), révoquant
  // alors des aperçus encore affichés à l'écran — seul le tout dernier tableau, au démontage
  // réel de la feuille, doit être révoqué.
  const newPhotoFilesRef = useRef(newPhotoFiles);
  newPhotoFilesRef.current = newPhotoFiles;
  useEffect(() => {
    return () => { newPhotoFilesRef.current.forEach((f) => { if (f.previewUrl) URL.revokeObjectURL(f.previewUrl); }); };
  }, []);

  // P4 (même règle que LinkEventPicker, src/pages/Messages.jsx) : événements RÉELS de la
  // communauté (prop reçue de App.jsx, agenda Supabase) — plus jamais MOCK_EVENTS/data.js.
  // Rappels d'anniversaire explicitement exclus, même exclusion que partout ailleurs.
  const linkable = (events || []).filter((e) => e.category !== 'anniversaire');

  // V7.76 — fichiers DÉJÀ enregistrés (en modification) pour le TYPE actuellement affiché
  // seulement : si l'utilisatrice bascule la tuile vers un autre type pendant une modification
  // (ex. un partage 'document' basculé vers 'photo'), les fichiers déjà enregistrés sous
  // l'ancien type ne s'appliquent plus à l'affichage de ce nouveau type — même comportement
  // implicite que l'ancien code (`editingShare?.fileName`/`editingShare?.photoDataUrl` n'étaient
  // de toute façon jamais renseignés pour le type "opposé").
  const existingFilesForType = (editingShare && editingShare.type === type) ? (editingShare.files || []) : [];
  const existingVisible = existingFilesForType.filter((f) => !removedExistingFilePaths.has(f.path));
  const newFilesForType = type === 'document' ? newDocFiles : type === 'photo' ? newPhotoFiles : [];
  const remainingCount = existingVisible.length + newFilesForType.length;

  // Choisit un ou plusieurs fichiers à la fois (`<input multiple>`) — `kind` = 'file' (Fichier)
  // ou 'photo' (Photo), même clé que les erreurs de champ. Respecte le plafond
  // MAX_SHARE_FILES_COUNT (fichiers déjà présents + nouveaux déjà choisis + ceux-ci) : les
  // fichiers en trop ne sont simplement pas ajoutés, avec une erreur inline qui l'explique —
  // jamais un plafond uniquement illustré côté serveur sans explication côté interface. Chaque
  // fichier trop volumineux (MAX_SHARE_FILE_BYTES) est lui aussi ignoré individuellement, sans
  // bloquer les autres fichiers valides du même lot.
  function pickFiles(fileList, kind) {
    const incoming = Array.from(fileList || []);
    if (incoming.length === 0) return;
    const setFiles = kind === 'file' ? setNewDocFiles : setNewPhotoFiles;
    const currentCount = existingVisible.length + (kind === 'file' ? newDocFiles.length : newPhotoFiles.length);
    const room = MAX_SHARE_FILES_COUNT - currentCount;
    if (room <= 0) {
      setErrors((prev) => ({ ...prev, [kind]: `Maximum ${MAX_SHARE_FILES_COUNT} fichiers par partage.` }));
      return;
    }
    const accepted = [];
    const tooLarge = [];
    for (const file of incoming) {
      if (accepted.length >= room) break;
      if (file.size > MAX_SHARE_FILE_BYTES) { tooLarge.push(file.name); continue; }
      accepted.push({
        localId: crypto.randomUUID(),
        file,
        previewUrl: kind === 'photo' ? URL.createObjectURL(file) : null,
      });
    }
    if (accepted.length > 0) {
      setErrors((prev) => { const next = { ...prev }; delete next[kind]; return next; });
      setFiles((prev) => [...prev, ...accepted]);
    }
    if (tooLarge.length > 0) {
      setErrors((prev) => ({ ...prev, [kind]: `Fichier(s) trop volumineux (maximum ${formatBytes(MAX_SHARE_FILE_BYTES)}) : ${tooLarge.join(', ')}` }));
    } else if (incoming.length > accepted.length) {
      setErrors((prev) => ({ ...prev, [kind]: `Maximum ${MAX_SHARE_FILES_COUNT} fichiers par partage — certains fichiers n'ont pas été ajoutés.` }));
    }
  }

  // Retire un fichier NOUVELLEMENT choisi (pas encore envoyé) — révoque son aperçu immédiatement
  // (contrairement au nettoyage au démontage ci-dessus, qui ne couvre que les fichiers encore
  // présents à la fermeture de la feuille).
  function removeNewFile(kind, localId) {
    const setFiles = kind === 'file' ? setNewDocFiles : setNewPhotoFiles;
    setFiles((prev) => {
      const found = prev.find((f) => f.localId === localId);
      if (found?.previewUrl) URL.revokeObjectURL(found.previewUrl);
      return prev.filter((f) => f.localId !== localId);
    });
  }

  // Item 13 (même patron que CreateEventSheet.jsx) : validation réelle à la soumission, jamais
  // un simple `disabled` sans explication — le bouton reste cliquable, une tentative invalide
  // produit une erreur inline précise + déplace le focus sur le premier champ fautif.
  function validate() {
    const errs = {};
    if (!title.trim()) errs.title = 'Indique un titre.';
    if (type === 'document' && remainingCount === 0) errs.file = 'Choisis au moins un fichier.';
    if (type === 'photo' && remainingCount === 0) errs.photo = 'Choisis au moins une photo.';
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
    if (type === 'lien') {
      const trimmed = linkUrl.trim();
      payload.linkUrl = trimmed;
      payload.domain = trimmed.replace(/^https?:\/\//, '').split('/')[0];
    }
    // V7.76 — les fichiers réels (objets File) et les fichiers existants retirés partent
    // directement vers App.jsx/sharesApi.js — plus aucune donnée de fichier construite ici
    // (nom/taille/URL sont désormais dérivés côté sharesApi.js, à partir du File lui-même et de
    // l'upload Storage réel). `removedFiles` = `{ id, path }` de chaque fichier déjà enregistré
    // que l'utilisatrice a marqué à retirer (`id` à `null` pour un repli pré-migration, voir
    // fetchShares dans sharesApi.js — sharesApi.updateShare sait l'interpréter).
    const removedFiles = existingFilesForType
      .filter((f) => removedExistingFilePaths.has(f.path))
      .map((f) => ({ id: f.id, path: f.path }));
    const filesChange = {
      newFiles: newFilesForType.map((f) => f.file),
      removedFiles,
    };
    // App.jsx renvoie { ok, error? } — un échec (réseau, RLS, upload Storage) garde le
    // formulaire ouvert avec toutes les valeurs déjà saisies intactes, erreur affichée inline,
    // jamais une fermeture silencieuse qui ferait croire le partage enregistré.
    const result = await onCreate(payload, filesChange);
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
          {/* V7.69 (3 oct.) — corrigé : ce bouton appelait `onClose` directement, en
              contournant entièrement `guardedOnClose` et donc la protection anti-fermeture
              fantôme (V7.56/57) — un clic fantôme replayé par Android pile sur ce bouton
              n'aurait jamais été bloqué. Même garde que partout ailleurs sur cette feuille. */}
          <button onClick={guardedOnClose} aria-label="Fermer" className="tap-surface icon-button" style={{ background: 'none', border: 'none' }}><X size={20} /></button>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 8, marginBottom: 16 }}>
          {TYPES.map((t) => {
            const Icon = t.icon;
            const active = type === t.key;
            return (
              <button
                key={t.key}
                // V7.60 : ouverture directe du sélecteur natif pour Fichier/Photo, focus direct
                // pour Lien — voir `selectType`/`autoOpenRef` ci-dessus pour le détail.
                onClick={() => selectType(t.key)}
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

          <AnimatedTypeFields>
          {type === 'document' && (
            <div>
              <label htmlFor="ass-file" style={labelStyle}>Fichier(s)</label>
              <input
                id="ass-file"
                ref={fileRef}
                type="file"
                // V7.76 (11 oct.) — `multiple` : jusqu'à MAX_SHARE_FILES_COUNT fichiers par
                // partage désormais (demande explicite de l'utilisatrice), plutôt qu'un seul.
                multiple
                // V7.55 (1er oct.) — bug réel trouvé en recette (capture d'écran à l'appui) :
                // `image/*` combiné aux extensions de documents dans ce même `accept` faisait
                // qu'Android proposait UNIQUEMENT "Appareil photo"/"Photos et vidéos" au tap sur
                // "Choisir un fichier" — aucun moyen d'atteindre les fichiers/téléchargements du
                // téléphone, donc aucun PDF/Word jamais sélectionnable malgré un champ qui
                // semblait fonctionner. Retiré : le type "Photo" (juste en dessous, bouton
                // séparé) couvre déjà le cas d'une photo/scan, ce champ-ci n'a plus besoin
                // d'accepter les images — seuls les documents courants restent listés.
                accept=".pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt,.csv"
                onClick={() => { armCloseSuppression(); }}
                onChange={(e) => {
                  armCloseSuppression();
                  pickFiles(e.target.files, 'file');
                  // Vide le champ après lecture — sans cela, re-choisir EXACTEMENT le même
                  // fichier après l'avoir retiré ne redéclencherait pas `onChange` (le
                  // navigateur ne considère la valeur du champ comme changée que si elle
                  // diffère de la précédente).
                  e.target.value = '';
                }}
                aria-invalid={errors.file ? 'true' : undefined}
                aria-describedby={errors.file ? 'ass-error-file' : undefined}
                style={fieldStyle(errors.file)}
              />
              {/* V7.76 — liste des fichiers déjà enregistrés (non retirés) PUIS des fichiers
                  nouvellement choisis, chacun avec son propre bouton de retrait — remplace
                  l'ancien aperçu à un seul fichier. */}
              {(existingVisible.length > 0 || newDocFiles.length > 0) && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 4, marginTop: 6 }}>
                  {existingVisible.map((f) => (
                    <div key={f.path} style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12.5, color: MUTED }}>
                      <Paperclip size={13} style={{ flexShrink: 0 }} />
                      <span style={{ flex: 1, overflowWrap: 'anywhere' }}>{f.name}{f.size ? ` · ${f.size}` : ''}</span>
                      <button type="button" onClick={() => setRemovedExistingFilePaths((prev) => new Set(prev).add(f.path))} aria-label={`Retirer ${f.name}`} className="tap-surface icon-button" style={{ background: 'none', border: 'none', flexShrink: 0 }}>
                        <X size={13} />
                      </button>
                    </div>
                  ))}
                  {newDocFiles.map((nf) => (
                    <div key={nf.localId} style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12.5, color: MUTED }}>
                      <Paperclip size={13} style={{ flexShrink: 0 }} />
                      <span style={{ flex: 1, overflowWrap: 'anywhere' }}>{nf.file.name} · {formatBytes(nf.file.size)}</span>
                      <button type="button" onClick={() => removeNewFile('file', nf.localId)} aria-label={`Retirer ${nf.file.name}`} className="tap-surface icon-button" style={{ background: 'none', border: 'none', flexShrink: 0 }}>
                        <X size={13} />
                      </button>
                    </div>
                  ))}
                </div>
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
              <label htmlFor="ass-photo" style={labelStyle}>Photo(s)</label>
              <input
                id="ass-photo"
                ref={photoRef}
                type="file"
                // V7.76 (11 oct.) — `multiple` : jusqu'à MAX_SHARE_FILES_COUNT photos par
                // partage désormais (demande explicite de l'utilisatrice), plutôt qu'une seule.
                multiple
                accept="image/*"
                // V7.58 (1er oct.) — bug réel confirmé en recette : contrairement à ce que
                // prétendait ce commentaire, `capture="environment"` envoyait bien DIRECTEMENT
                // à l'appareil photo sur le téléphone de l'utilisatrice, sans aucune option pour
                // choisir une photo déjà présente dans la pellicule — `capture` n'est pas une
                // simple suggestion, certains navigateurs/Android l'appliquent strictement.
                // Retiré entièrement : sans cet attribut, `accept="image/*"` seul affiche le
                // sélecteur standard (appareil photo ET galerie), laissant le choix à
                // l'utilisatrice plutôt que de le lui imposer.
                onClick={() => { armCloseSuppression(); }}
                onChange={(e) => {
                  armCloseSuppression();
                  pickFiles(e.target.files, 'photo');
                  // Même raison que pour le champ "Fichier" ci-dessus : permet de re-choisir la
                  // même photo après l'avoir retirée.
                  e.target.value = '';
                }}
                aria-invalid={errors.photo ? 'true' : undefined}
                aria-describedby={errors.photo ? 'ass-error-photo' : undefined}
                style={fieldStyle(errors.photo)}
              />
              {/* V7.76 — grille de miniatures (photos déjà enregistrées PUIS nouvellement
                  choisies), chacune avec son propre bouton de retrait superposé — remplace
                  l'ancienne miniature unique. URL objet locale pour un nouveau fichier tout
                  juste choisi (nf.previewUrl), sinon l'URL signée déjà résolue par
                  sharesApi.fetchShares (f.url) pour une photo déjà enregistrée. */}
              {(existingVisible.length > 0 || newPhotoFiles.length > 0) && (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: 6, marginTop: 8 }}>
                  {existingVisible.map((f) => (
                    <div key={f.path} style={{ position: 'relative', borderRadius: 10, overflow: 'hidden', border: `1px solid ${CARD_BORDER}`, aspectRatio: '1 / 1', background: '#F1F1EF' }}>
                      {f.url && <img src={f.url} alt="Photo déjà enregistrée" style={{ display: 'block', width: '100%', height: '100%', objectFit: 'cover' }} />}
                      <button type="button" onClick={() => setRemovedExistingFilePaths((prev) => new Set(prev).add(f.path))} aria-label="Retirer cette photo" className="tap-surface icon-button" style={{ position: 'absolute', top: 3, right: 3, background: 'rgba(23,32,51,0.65)', border: 'none', borderRadius: 999, width: 22, height: 22, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 0 }}>
                        <X size={12} color="#fff" />
                      </button>
                    </div>
                  ))}
                  {newPhotoFiles.map((nf) => (
                    <div key={nf.localId} style={{ position: 'relative', borderRadius: 10, overflow: 'hidden', border: `1px solid ${CARD_BORDER}`, aspectRatio: '1 / 1' }}>
                      <img src={nf.previewUrl} alt="Aperçu de la photo choisie" style={{ display: 'block', width: '100%', height: '100%', objectFit: 'cover' }} />
                      <button type="button" onClick={() => removeNewFile('photo', nf.localId)} aria-label="Retirer cette photo" className="tap-surface icon-button" style={{ position: 'absolute', top: 3, right: 3, background: 'rgba(23,32,51,0.65)', border: 'none', borderRadius: 999, width: 22, height: 22, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 0 }}>
                        <X size={12} color="#fff" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
              <ErrorText id="ass-error-photo" message={errors.photo} />
            </div>
          )}
          {/* Item 11 : Information reste texte seul (titre + description ci-dessous couvrent
              déjà ce type) — aucun champ fichier/lien requis, confirmé non cassé par cette
              passe (rendu conditionnel déjà correct avant, non modifié ici). */}
          </AnimatedTypeFields>

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
              {linkable.map((e) => (
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
