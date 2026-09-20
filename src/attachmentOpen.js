// V7.14 (phase 3, item 11 — diagnostic complémentaire, trouvé en vérifiant DYNAMIQUEMENT en
// Playwright la persistance réelle des partages Fichier/Photo après rechargement, pas seulement
// en lisant le code) : Chromium bloque silencieusement toute navigation d'un NOUVEL ONGLET vers
// une URL `data:` déclenchée par le clic d'un lien (`<a href="data:..." target="_blank">`) —
// restriction anti-hameçonnage présente dans Chrome/Chromium réels depuis plusieurs versions,
// pas une particularité du bac à sable de test. Confirmé empiriquement ici : le lien existe, son
// `href` est correct, mais `window.open`/le clic n'ouvrent RIEN, sans erreur JS visible. Une URL
// `blob:` du même document (même origine), elle, s'ouvre normalement — donc la persistance
// elle-même (localStorage, src/sharesStorage.js) n'était PAS en cause : seul le mécanisme
// d'OUVERTURE d'une URL `data:` en nouvel onglet doit passer par un `blob:` intermédiaire.
//
// Les DEUX points d'ouverture de pièce jointe de l'appli partagent ce correctif :
//   - src/components/ActionButton.jsx (boutons "Ouvrir"/"Télécharger")
//   - src/attachmentCardA11y.js (clic sur la carte entière, brief pts 29/30/39/42)
// Une URL http(s) normale (catalogue src/documents.js, servie depuis public/demo/, ou un lien
// externe de partage) n'est JAMAIS concernée : son comportement de lien natif existant reste
// inchangé, cette fonction se contente de la laisser passer telle quelle.

export function isDataUrl(href) {
  return typeof href === 'string' && href.startsWith('data:');
}

// Ouvre `href` dans un nouvel onglet (comportement de "Ouvrir" — jamais utilisé pour
// "Télécharger", qui garde l'attribut `download` natif d'ActionButton.jsx, non concerné par
// cette restriction : ce n'est pas une navigation de nouvel onglet). Convertit d'abord une URL
// `data:` en URL `blob:` temporaire (même origine, jamais soumise à ce blocage), révoquée après
// coup ; laisse toute autre URL absolue inchangée.
export async function openInNewTab(href) {
  if (!href) return;
  if (!isDataUrl(href)) {
    const absoluteUrl = new URL(href, window.location.href).href;
    window.open(absoluteUrl, '_blank', 'noopener,noreferrer');
    return;
  }
  try {
    const res = await fetch(href);
    const blob = await res.blob();
    const blobUrl = URL.createObjectURL(blob);
    window.open(blobUrl, '_blank', 'noopener,noreferrer');
    // Révocation différée (pas immédiate) : le nouvel onglet doit avoir le temps de charger la
    // ressource avant que son URL ne devienne invalide.
    setTimeout(() => { try { URL.revokeObjectURL(blobUrl); } catch { /* déjà révoquée */ } }, 60000);
  } catch {
    // Repli silencieux plutôt qu'une erreur JS non interceptée qui casserait le reste de l'écran
    // — l'utilisateur ne perd rien d'autre qu'une tentative d'ouverture sans effet visible.
  }
}
