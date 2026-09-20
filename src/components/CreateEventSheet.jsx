import { useState, useRef } from 'react';
import { X, ChevronDown } from 'lucide-react';
import { BLUE, RED, MUTED, CARD_BORDER, CATEGORIES, SECTION_THEMES, buttonStyle, FONT_DISPLAY } from '../theme';
import { useModalA11y } from '../useModalA11y';

// V7.14 (correctif UAT, points 12-14) — DÉCISION PRODUIT EXPLICITE qui SUPERSEDE la règle
// verrouillée précédente ("anniversaire = rappel, jamais créé ici (règle verrouillée)") : le
// brief de cette passe liste explicitement les quatre options attendues du sélecteur de
// catégorie de CE formulaire — "Anniversaire; Sortie; École; Autre" — unifiant ce qui était deux
// flux de création séparés (ce formulaire + AddBirthdaySheet.jsx en mode création). Documenté ici
// ET dans MATRICE_LIVRAISON.md (section V7.14) : ce n'est pas un oubli de l'ancienne règle, mais
// un changement de produit demandé directement par l'utilisateur pour cette passe.
//
// AddBirthdaySheet.jsx reste utilisé tel quel, mais UNIQUEMENT pour la MODIFICATION d'un
// anniversaire existant (voir Agenda.jsx/App.jsx, onOpenBirthday) — sa branche "création"
// (`onCreate`, appelée seulement quand `birthday` est `null`) n'est plus jamais atteinte par
// l'interface, volontairement laissée en place (composant toujours correct, juste plus jamais
// monté en mode création) plutôt que supprimée, au cas où un flux dédié en aurait de nouveau
// besoin — voir aussi le commentaire sur le bouton "Ajouter un anniversaire" dans Agenda.jsx.
//
// `Object.keys(CATEGORIES)` suit l'ordre de déclaration réel dans theme.js — anniversaire,
// sortie, ecole, autre — qui EST déjà l'ordre demandé par le brief ; pas de second tableau à
// tenir manuellement synchronisé avec CATEGORIES.
const ALL_CATEGORIES = Object.keys(CATEGORIES);
// Libellés du SÉLECTEUR seulement (singulier — "Anniversaire", pas "Anniversaires") : distincts
// de `CATEGORIES[key].label`, qui reste au pluriel pour les chips de filtre d'Agenda.jsx (hors
// périmètre de ce correctif, pas touché).
const CATEGORY_OPTION_LABELS = { anniversaire: 'Anniversaire', sortie: 'Sortie', ecole: 'École', autre: 'Autre' };
const SUBTYPES = { sortie: [{ value: 'sortie_ecole', label: 'Avec l’école' }, { value: 'sortie_parents', label: 'Entre familles' }] };
const MONTHS = ['Janvier', 'Février', 'Mars', 'Avril', 'Mai', 'Juin', 'Juillet', 'Août', 'Septembre', 'Octobre', 'Novembre', 'Décembre'];

// Item 12 : labels PERMANENTS (toujours visibles), pas seulement un placeholder qui disparaît
// dès la première frappe — Date/Heure/Lieu/Détails n'en avaient aucun avant cette passe (le
// texte affiché était uniquement le `placeholder` de chaque `<input>`, absent dès qu'un
// caractère est saisi). Catégorie n'avait pas non plus de label propre (trois boutons côte à
// côte, le libellé ÉTAIT le bouton) — nécessaire de toute façon avec un `<select>`.
const labelStyle = { display: 'block', fontSize: 12, fontWeight: 700, color: MUTED, marginBottom: 4 };
const inputStyle = { width: '100%', boxSizing: 'border-box', minHeight: 48, padding: '10px 12px', borderRadius: 10, border: `1px solid ${CARD_BORDER}`, fontSize: 14, background: '#fff' };
// Item 13 : état d'erreur visuel — bordure rouge (RED, theme.js), cohérent avec la convention
// couleur "aplat solide pour l'action, teinte réservée au non-interactif" : une bordure n'est ni
// l'un ni l'autre, RED plein reste le choix le plus lisible pour signaler une erreur de champ.
function fieldStyle(hasError) {
  return { ...inputStyle, border: `1.5px solid ${hasError ? RED : CARD_BORDER}` };
}
function ErrorText({ id, message }) {
  if (!message) return null;
  return <p id={id} style={{ margin: '4px 0 0', fontSize: 12, fontWeight: 600, color: RED }}>{message}</p>;
}

export default function CreateEventSheet({ onClose, onCreate, onCreateBirthday, initialCategory }) {
  // Item 12 : '' est la valeur "placeholder" ('' n'est la clé d'AUCUNE vraie catégorie dans
  // CATEGORIES) — elle compte explicitement comme "aucune catégorie choisie" pour la validation
  // (item 13), jamais soumissible par accident comme le serait l'index 0 d'un vrai choix.
  const [category, setCategory] = useState(ALL_CATEGORIES.includes(initialCategory) ? initialCategory : '');
  const [subtype, setSubtype] = useState('sortie_parents');
  const [title, setTitle] = useState('');
  const [date, setDate] = useState('');
  const [startTime, setStartTime] = useState('');
  const [location, setLocation] = useState('');
  const [description, setDescription] = useState('');
  // Champs anniversaire (item 12) — mêmes trois champs, même règle, qu'AddBirthdaySheet.jsx :
  // prénom + jour + mois seulement, jamais d'année/heure/lieu.
  const [name, setName] = useState('');
  const [day, setDay] = useState('');
  const [month, setMonth] = useState('');
  const [errors, setErrors] = useState({});
  const [saving, setSaving] = useState(false);
  const panelRef = useRef(null);
  const { onBackdropClick } = useModalA11y(panelRef, onClose);

  // Item 13 : une ref par champ potentiellement invalide, dans l'ordre du DOM — permet de
  // déplacer PROGRAMMATIQUEMENT le focus clavier sur le premier champ en erreur après une
  // tentative de soumission invalide (pas seulement une indication visuelle, qui n'aiderait pas
  // un utilisateur clavier/lecteur d'écran à savoir où corriger).
  const categoryRef = useRef(null);
  const titleRef = useRef(null);
  const dateRef = useRef(null);
  const nameRef = useRef(null);
  const dayRef = useRef(null);
  const monthRef = useRef(null);
  const FIELD_REFS = { category: categoryRef, title: titleRef, date: dateRef, name: nameRef, day: dayRef, month: monthRef };

  const isBirthday = category === 'anniversaire';

  // Item 13 : validation réelle, jamais un simple `disabled` sur le bouton (l'ANCIEN
  // comportement — le bouton ne devenait cliquable qu'une fois déjà valide, donc aucune
  // tentative invalide n'était même possible, et donc aucune erreur ne pouvait jamais être
  // montrée). Le bouton "Créer" est maintenant TOUJOURS cliquable (sauf pendant `saving`) : un
  // clic avec des champs manquants doit produire une erreur visible, pas être empêché en amont.
  function validate() {
    const errs = {};
    if (!category) {
      errs.category = 'Choisis une catégorie.';
      return errs; // rien d'autre à valider tant que la catégorie elle-même n'est pas choisie
    }
    if (isBirthday) {
      if (!name.trim()) errs.name = 'Indique un prénom.';
      const dayNum = Number(day);
      const monthNum = Number(month);
      if (!day || !(dayNum >= 1 && dayNum <= 31)) errs.day = 'Jour invalide (1 à 31).';
      if (!month || !(monthNum >= 1 && monthNum <= 12)) errs.month = 'Choisis un mois.';
    } else {
      if (!title.trim()) errs.title = 'Indique un titre.';
      if (!date) errs.date = 'Choisis une date.';
    }
    return errs;
  }

  function focusFirstError(errs) {
    const order = isBirthday ? ['category', 'name', 'day', 'month'] : ['category', 'title', 'date'];
    for (const key of order) {
      if (errs[key]) { FIELD_REFS[key].current?.focus(); return; }
    }
  }

  async function submit() {
    if (saving) return;
    const errs = validate();
    setErrors(errs);
    if (Object.keys(errs).length > 0) {
      // Item 13 : ne ferme jamais le formulaire sur une validation en échec, ne touche à AUCUNE
      // valeur déjà saisie — seules `errors` (affichage) et le focus changent.
      focusFirstError(errs);
      return;
    }
    setSaving(true);
    // Item 12 : route vers le bon gestionnaire selon la catégorie choisie — jamais le payload
    // "événement complet" pour un anniversaire (qui n'a ni date complète, ni lieu, ni heure).
    const success = isBirthday
      ? await onCreateBirthday({ title: `Anniversaire de ${name.trim()}`, day: Number(day), month: Number(month) })
      : await onCreate({
        category,
        subtype: category === 'sortie' ? subtype : null,
        title: title.trim(),
        date,
        startTime: startTime || null,
        location: location.trim(),
        description: description.trim(),
      });
    setSaving(false);
    // Ne ferme que si la création a réellement réussi — sinon l'échec (déjà signalé via le
    // bandeau d'erreur d'App.jsx) se présenterait visuellement comme une fermeture normale, et
    // la personne croirait son événement/anniversaire créé alors qu'il ne l'est pas ; le texte
    // déjà saisi reste alors intact (état local non touché).
    if (success !== false) onClose();
  }

  function selectCategory(next) {
    setCategory(next);
    if (next === 'sortie') setSubtype('sortie_parents');
    // Changer de catégorie change aussi QUELS champs sont obligatoires — une erreur affichée
    // pour l'ancienne catégorie (ex. "Choisis une date" pour "sortie") n'a plus de sens une fois
    // basculé sur "anniversaire" (et inversement) : on l'efface plutôt que de laisser une erreur
    // trompeuse pour un champ qui n'est même plus affiché.
    setErrors({});
  }

  return (
    <div onClick={onBackdropClick} style={{ position: 'fixed', inset: 0, background: 'rgba(29,43,34,0.4)', display: 'flex', alignItems: 'flex-end', zIndex: 60, '--section-accent': SECTION_THEMES.agenda.color }}>
      <div ref={panelRef} role="dialog" aria-modal="true" aria-label="Ajouter un événement" className="max-w-md mx-auto" style={{ width: '100%', background: '#fff', borderRadius: '20px 20px 0 0', padding: 20, maxHeight: '85vh', overflowY: 'auto' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
          <span style={{ fontSize: 17, fontWeight: 700, fontFamily: FONT_DISPLAY }}>Ajouter un événement</span>
          <button onClick={onClose} aria-label="Fermer" className="tap-surface icon-button" style={{ background: 'none', border: 'none' }}><X size={20} /></button>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {/* Item 12 : sélecteur de catégorie unique, natif — clavier/lecteur d'écran robustes
              "avec flèche et liste déroulante" (brief), 4 options réelles. La flèche visible est
              à la fois celle, native, du système ET une ChevronDown superposée (cohérente sur
              tous les navigateurs qui masquent parfois la première avec `appearance: none`). */}
          <div>
            <label htmlFor="ces-category" style={labelStyle}>Catégorie</label>
            <div style={{ position: 'relative' }}>
              <select
                id="ces-category"
                ref={categoryRef}
                value={category}
                onChange={(e) => selectCategory(e.target.value)}
                aria-invalid={errors.category ? 'true' : undefined}
                aria-describedby={errors.category ? 'ces-error-category' : undefined}
                style={{ ...fieldStyle(errors.category), appearance: 'none', paddingRight: 36, cursor: 'pointer' }}
              >
                <option value="" disabled>Choisir une catégorie</option>
                {ALL_CATEGORIES.map((key) => (
                  <option key={key} value={key}>{CATEGORY_OPTION_LABELS[key]}</option>
                ))}
              </select>
              <ChevronDown size={16} color={MUTED} aria-hidden="true" style={{ position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none' }} />
            </div>
            <ErrorText id="ces-error-category" message={errors.category} />
          </div>

          {isBirthday && (
            <>
              {/* Item 12 : une fois "Anniversaire" choisi, le formulaire s'adapte à ce qu'un
                  rappel d'anniversaire a réellement besoin (même règle qu'AddBirthdaySheet.jsx,
                  brief §20) — prénom + jour + mois seulement, jamais de date complète, d'heure,
                  de lieu ni de description. */}
              <p style={{ fontSize: 12, color: MUTED, margin: 0, lineHeight: 1.4 }}>
                Jour et mois seulement — pas d'année, pas d'heure, pas de lieu. Ce rappel ne
                propose pas de participation.
              </p>
              <div>
                <label htmlFor="ces-name" style={labelStyle}>Prénom</label>
                <input
                  id="ces-name" ref={nameRef} value={name} onChange={(e) => setName(e.target.value)}
                  aria-invalid={errors.name ? 'true' : undefined}
                  aria-describedby={errors.name ? 'ces-error-name' : undefined}
                  style={fieldStyle(errors.name)}
                />
                <ErrorText id="ces-error-name" message={errors.name} />
              </div>
              <div style={{ display: 'flex', gap: 10 }}>
                <div style={{ flex: 1 }}>
                  <label htmlFor="ces-day" style={labelStyle}>Jour</label>
                  <input
                    id="ces-day" ref={dayRef} type="number" min={1} max={31} value={day}
                    onChange={(e) => setDay(e.target.value)}
                    aria-invalid={errors.day ? 'true' : undefined}
                    aria-describedby={errors.day ? 'ces-error-day' : undefined}
                    style={fieldStyle(errors.day)}
                  />
                  <ErrorText id="ces-error-day" message={errors.day} />
                </div>
                <div style={{ flex: 2 }}>
                  <label htmlFor="ces-month" style={labelStyle}>Mois</label>
                  <select
                    id="ces-month" ref={monthRef} value={month} onChange={(e) => setMonth(e.target.value)}
                    aria-invalid={errors.month ? 'true' : undefined}
                    aria-describedby={errors.month ? 'ces-error-month' : undefined}
                    style={fieldStyle(errors.month)}
                  >
                    <option value="">Mois</option>
                    {MONTHS.map((m, i) => <option key={m} value={i + 1}>{m}</option>)}
                  </select>
                  <ErrorText id="ces-error-month" message={errors.month} />
                </div>
              </div>
            </>
          )}

          {!isBirthday && category && (
            <>
              {category === 'sortie' && (
                <div style={{ paddingLeft: 4 }}>
                  <div style={{ fontSize: 11, fontWeight: 600, color: MUTED, marginBottom: 5, textTransform: 'uppercase', letterSpacing: 0.3 }}>
                    Type de sortie
                  </div>
                  <div style={{ display: 'flex', gap: 6 }}>
                    {SUBTYPES.sortie.map((s) => (
                      <button
                        key={s.value}
                        type="button"
                        onClick={() => setSubtype(s.value)}
                        style={{
                          flex: 1, minHeight: 44, padding: '6px 4px', borderRadius: 8, fontSize: 11.5, fontWeight: 600,
                          border: 'none', borderBottom: subtype === s.value ? `2px solid ${BLUE}` : '2px solid transparent',
                          background: 'transparent', color: subtype === s.value ? BLUE : MUTED,
                        }}
                      >
                        {s.label}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              <div>
                <input
                  ref={titleRef} placeholder="Titre" value={title} onChange={(e) => setTitle(e.target.value)}
                  aria-invalid={errors.title ? 'true' : undefined}
                  aria-describedby={errors.title ? 'ces-error-title' : undefined}
                  style={fieldStyle(errors.title)}
                />
                <ErrorText id="ces-error-title" message={errors.title} />
              </div>
              {/* Item 12 : labels permanents pour Date/Heure/Lieu/Détails — ces quatre champs
                  n'affichaient jusqu'ici qu'un `placeholder` (disparaît à la première frappe),
                  jamais un vrai `<label>` visible en permanence. */}
              <div>
                <label htmlFor="ces-date" style={labelStyle}>Date</label>
                <input
                  id="ces-date" ref={dateRef} type="date" value={date} onChange={(e) => setDate(e.target.value)}
                  aria-invalid={errors.date ? 'true' : undefined}
                  aria-describedby={errors.date ? 'ces-error-date' : undefined}
                  style={fieldStyle(errors.date)}
                />
                <ErrorText id="ces-error-date" message={errors.date} />
              </div>
              <div>
                <label htmlFor="ces-time" style={labelStyle}>Heure <span style={{ fontWeight: 400 }}>(optionnel)</span></label>
                <input id="ces-time" type="time" value={startTime} onChange={(e) => setStartTime(e.target.value)} style={inputStyle} />
              </div>
              <div>
                <label htmlFor="ces-location" style={labelStyle}>Lieu <span style={{ fontWeight: 400 }}>(optionnel)</span></label>
                <input id="ces-location" value={location} onChange={(e) => setLocation(e.target.value)} style={inputStyle} />
              </div>
              <div>
                <label htmlFor="ces-description" style={labelStyle}>Détails <span style={{ fontWeight: 400 }}>(optionnel)</span></label>
                <textarea id="ces-description" value={description} onChange={(e) => setDescription(e.target.value)} rows={3} style={{ ...inputStyle, resize: 'none' }} />
              </div>
            </>
          )}

          <button
            type="button"
            onClick={submit}
            disabled={saving}
            className={saving ? undefined : 'tap-surface'}
            style={{
              ...buttonStyle('primary', {
                color: category ? CATEGORIES[category]?.color : BLUE,
                onColor: category ? CATEGORIES[category]?.onColor : '#FFFFFF',
              }),
              marginTop: 4, width: '100%',
              opacity: saving ? 0.6 : 1, cursor: saving ? 'default' : 'pointer',
            }}
          >
            {saving ? 'Création…' : isBirthday ? 'Ajouter l’anniversaire' : 'Créer l’événement'}
          </button>
        </div>
      </div>
    </div>
  );
}
