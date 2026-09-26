import { useMemo, useRef, useState } from 'react';
import { Search, X, ChevronRight, UserPlus, Users, Check, Clock, Ban } from 'lucide-react';
import { INK, MUTED, RED, CARD_BORDER, SECTION_THEMES, FONT_DISPLAY } from '../theme';
import { childrenOf } from '../data';
import { anyFieldMatches } from '../searchUtils';
import { useScrollRestore } from '../useScrollRestore';
import PageTitle from '../components/PageTitle';
import InviteParentSheet from '../components/InviteParentSheet';
import Avatar from '../components/Avatar';

// V7.18 : `members` reçu en prop (annuaire réel, App.jsx/src/membersApi.js) — remplace l'import
// direct de MEMBERS (donnée de démonstration, src/data.js). `isAdmin`/`communityId` :
// nécessaires au bouton "Inviter un parent", réservé aux administrateurs (vérifié à nouveau
// côté serveur par create_invitation(), sql/09_invitations.sql — l'interface ne propose jamais
// une action vouée à l'échec côté serveur, même principe déjà appliqué ailleurs dans ce projet,
// ex. "Lier à un événement" dans Messages.jsx).
//
// RÉVISION V7.46 (26 sept.) — "Inviter un parent" n'est plus réservé à l'admin (voir plus bas,
// le bouton est désormais toujours affiché à tout membre actif). Deux nouvelles props reçues
// depuis App.jsx, toutes deux déjà résolues/chargées là-bas (mêmes principes que
// members/membersLoading/membersError ci-dessus, jamais une lecture directe Supabase ici) :
//   - `pendingInvitationRequests` (admin uniquement, `[]` sinon) : demandes à trancher.
//   - `myInvitationRequests` : les demandes DU membre courant, tous statuts confondus.
// `onApproveInvitationRequest`/`onRejectInvitationRequest`/`onFinalizeInvitationRequest` :
// actions réseau, tenues par App.jsx (même découpage que onRemoveMember plus bas dans ce
// fichier) — LaBande.jsx ne fait jamais lui-même un appel réseau, uniquement déclencher l'action
// reçue en prop et refléter le résultat déjà mis à jour par App.jsx.
export default function LaBande({
  members, membersLoading, membersError, onOpenMember, query, onQueryChange, restoreState, onRestoreConsumed, isAdmin, communityId,
  pendingInvitationRequests, myInvitationRequests, onApproveInvitationRequest, onRejectInvitationRequest, onFinalizeInvitationRequest, onReloadInvitationRequests,
}) {
  const searchInputRef = useRef(null);
  const [showInvite, setShowInvite] = useState(false);
  const [decidingRequestId, setDecidingRequestId] = useState(null);
  const [finalizingRequestId, setFinalizingRequestId] = useState(null);
  const [requestActionError, setRequestActionError] = useState('');
  // V7.46 — le lien généré par finalize_invitation_request() n'existe QU'EN MÉMOIRE ici (jamais
  // stocké en base en clair, voir sql/17_invitation_requests.sql) : une fois la page quittée ou
  // rechargée, il n'est plus récupérable — comportement volontairement identique à celui que
  // l'admin connaît déjà aujourd'hui dans InviteParentSheet.jsx (le lien n'y survit pas non plus
  // à une fermeture de la feuille). Clé = id de la demande, valeur = lien complet déjà construit.
  const [finalizedLinks, setFinalizedLinks] = useState({});
  const [copiedRequestId, setCopiedRequestId] = useState(null);

  async function decide(requestId, approve) {
    if (decidingRequestId) return;
    setDecidingRequestId(requestId);
    setRequestActionError('');
    try {
      if (approve) await onApproveInvitationRequest(requestId);
      else await onRejectInvitationRequest(requestId);
      onReloadInvitationRequests?.();
    } catch (err) {
      setRequestActionError(err?.message || 'Impossible de traiter cette demande — réessaie.');
    } finally {
      setDecidingRequestId(null);
    }
  }

  async function finalize(requestId) {
    if (finalizingRequestId) return;
    setFinalizingRequestId(requestId);
    setRequestActionError('');
    try {
      const url = await onFinalizeInvitationRequest(requestId);
      setFinalizedLinks((prev) => ({ ...prev, [requestId]: url }));
      onReloadInvitationRequests?.();
    } catch (err) {
      setRequestActionError(err?.message || 'Impossible de générer le lien — réessaie.');
    } finally {
      setFinalizingRequestId(null);
    }
  }

  async function copyRequestLink(requestId, url) {
    try {
      await navigator.clipboard.writeText(url);
      setCopiedRequestId(requestId);
      setTimeout(() => setCopiedRequestId((cur) => (cur === requestId ? null : cur)), 2000);
    } catch {
      setRequestActionError('Copie automatique indisponible — sélectionne le lien manuellement.');
    }
  }

  // Delta §2.2/§26 : la recherche était déjà restaurée (état levé dans App.jsx) — il manquait
  // le scroll et le focus sur la carte parent d'origine.
  useScrollRestore(restoreState, onRestoreConsumed);

  // V7.40 (25 sept.) — bug réel signalé par l'utilisatrice (recette réelle, rechargement de
  // page) : `members` était ABSENT du tableau de dépendances de ce useMemo, alors que la
  // fonction le lit directement. Au premier rendu, `members` vaut `[]` (chargement pas encore
  // terminé, voir App.jsx) — `filtered` se calcule alors une fois, sur cette liste vide, et
  // reste figé sur cette valeur pour toute la durée de vie du composant : quand `members` se
  // remplit ensuite (chargement terminé), React ne recalcule PLUS `filtered` puisque sa seule
  // dépendance déclarée (`query`) n'a pas changé — fermeture (closure) périmée classique. Effet
  // observé : "La Bande" affichait "Aucun membre trouvé" (le message prévu pour une RECHERCHE
  // sans résultat, `members.length > 0 && filtered.length === 0`, voir plus bas) alors que les
  // membres étaient bien chargés. Pas un bug de CE lot (V7.39) — ce code n'a pas été touché
  // aujourd'hui — mais découvert par l'utilisatrice en rechargeant la page dans la foulée.
  const filtered = useMemo(() => {
    const list = [...members].sort((a, b) => a.firstName.localeCompare(b.firstName, 'fr'));
    if (!query.trim()) return list;
    // Brief §3/§29 : même normalisation (accents/casse/apostrophes) que le reste de
    // l'application — recherche réelle sur parent ET enfant/groupe, pas un simple includes().
    return list.filter((m) => {
      const kids = childrenOf(m);
      return anyFieldMatches([m.firstName, m.lastName, ...kids.map((c) => c.firstName), ...kids.map((c) => c.groupLabel)], query);
    });
  }, [query, members]);

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
              {/* V7.34 — Avatar partagé : vraie photo si mise (m.avatarUrl, memberDirectory.js),
                  sinon exactement le même cercle couleur+initiale qu'avant. */}
              <Avatar avatarPath={m.avatarUrl} color={m.avatarColor} initials={m.firstName.slice(0, 1)} size={40} />
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

      {/* V7.46 — demandes d'invitation À TRANCHER, admin uniquement. Le nom du parrain est
          résolu depuis `members` (déjà chargé par cette page) — jamais une seconde requête
          réseau juste pour un nom, même principe que Messages.jsx qui résout ses auteurs depuis
          une lecture `members` déjà en mémoire plutôt qu'un aller-retour dédié. */}
      {isAdmin && pendingInvitationRequests?.length > 0 && (
        <div style={{ marginTop: 18, display: 'flex', flexDirection: 'column', gap: 10 }}>
          <p style={{ fontSize: 13, fontWeight: 700, color: MUTED, margin: 0 }}>Demandes d'invitation en attente</p>
          {requestActionError && (
            <p role="alert" style={{ margin: 0, fontSize: 12, fontWeight: 600, color: RED }}>{requestActionError}</p>
          )}
          {pendingInvitationRequests.map((r) => {
            const sponsor = members.find((m) => m.userId === r.sponsor_user_id);
            const sponsorName = sponsor ? `${sponsor.firstName} ${sponsor.lastName}`.trim() : 'Un membre';
            const busy = decidingRequestId === r.id;
            return (
              <div key={r.id} style={{ background: '#FFFFFF', border: `1px solid ${CARD_BORDER}`, borderRadius: 14, padding: '12px 14px' }}>
                <p style={{ margin: '0 0 8px', fontSize: 13.5, color: INK }}>
                  <strong>{sponsorName}</strong> propose d'inviter {r.invited_name ? <strong>{r.invited_name}</strong> : null}
                  {r.invited_name ? ' — ' : ''}<span style={{ color: MUTED }}>{r.invited_email}</span>
                </p>
                <div style={{ display: 'flex', gap: 8 }}>
                  <button
                    onClick={() => decide(r.id, true)} disabled={busy}
                    style={{ flex: 1, padding: '10px 0', borderRadius: 10, border: 'none', fontSize: 13, fontWeight: 700, minHeight: 40, background: SECTION_THEMES.labande.color, color: '#fff', opacity: busy ? 0.6 : 1 }}
                  >
                    Valider
                  </button>
                  <button
                    onClick={() => decide(r.id, false)} disabled={busy}
                    style={{ flex: 1, padding: '10px 0', borderRadius: 10, border: `1px solid ${CARD_BORDER}`, fontSize: 13, fontWeight: 700, minHeight: 40, background: 'none', color: MUTED, opacity: busy ? 0.6 : 1 }}
                  >
                    Refuser
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* V7.46 — suivi personnel, visible pour tout membre ayant déjà proposé au moins une
          invitation (admin compris, s'il lui arrive de passer par ce même formulaire) — jamais
          mélangé avec la liste ci-dessus (celle-là est TOUJOURS filtrée à l'appelant côté
          messagesApi/invitationsApi, voir fetchMyInvitationRequests). */}
      {myInvitationRequests?.length > 0 && (
        <div style={{ marginTop: 18, display: 'flex', flexDirection: 'column', gap: 10 }}>
          <p style={{ fontSize: 13, fontWeight: 700, color: MUTED, margin: 0 }}>Tes invitations</p>
          {myInvitationRequests.map((r) => {
            const link = finalizedLinks[r.id];
            return (
              <div key={r.id} style={{ background: '#FFFFFF', border: `1px solid ${CARD_BORDER}`, borderRadius: 14, padding: '12px 14px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  {r.status === 'pending' && <Clock size={14} color={MUTED} />}
                  {r.status === 'approved' && <Check size={14} color={SECTION_THEMES.labande.color} />}
                  {r.status === 'rejected' && <Ban size={14} color={RED} />}
                  <p style={{ margin: 0, fontSize: 13.5, color: INK, flex: 1 }}>
                    {r.invited_name ? `${r.invited_name} — ` : ''}<span style={{ color: MUTED }}>{r.invited_email}</span>
                  </p>
                </div>
                {r.status === 'pending' && (
                  <p style={{ margin: '6px 0 0', fontSize: 12.5, color: MUTED }}>En attente de validation par l'administrateur.</p>
                )}
                {r.status === 'rejected' && (
                  <p style={{ margin: '6px 0 0', fontSize: 12.5, color: MUTED }}>Cette demande a été refusée.</p>
                )}
                {r.status === 'approved' && !link && !r.invitation_id && (
                  <button
                    onClick={() => finalize(r.id)} disabled={finalizingRequestId === r.id}
                    style={{ marginTop: 8, width: '100%', padding: '10px 0', borderRadius: 10, border: 'none', fontSize: 13, fontWeight: 700, minHeight: 40, background: SECTION_THEMES.labande.color, color: '#fff', opacity: finalizingRequestId === r.id ? 0.6 : 1 }}
                  >
                    {finalizingRequestId === r.id ? 'Génération…' : 'Récupérer le lien à envoyer'}
                  </button>
                )}
                {r.status === 'approved' && !link && r.invitation_id && (
                  <p style={{ margin: '6px 0 0', fontSize: 12.5, color: MUTED }}>Validée — le lien a déjà été généré. Si tu ne l'as pas envoyé à temps, propose une nouvelle invitation.</p>
                )}
                {link && (
                  <div style={{ marginTop: 8, display: 'flex', flexDirection: 'column', gap: 8 }}>
                    <div style={{ background: '#F1F1EF', border: `1px solid ${CARD_BORDER}`, borderRadius: 10, padding: '8px 10px' }}>
                      <span style={{ fontSize: 12, color: INK, wordBreak: 'break-all' }}>{link}</span>
                    </div>
                    <button
                      onClick={() => copyRequestLink(r.id, link)}
                      style={{ padding: '10px 0', borderRadius: 10, border: 'none', fontSize: 13, fontWeight: 700, minHeight: 40, background: SECTION_THEMES.labande.color, color: '#fff' }}
                    >
                      {copiedRequestId === r.id ? 'Copié !' : 'Copier le lien'}
                    </button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

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

      {showInvite && (
        <InviteParentSheet
          communityId={communityId}
          isAdmin={isAdmin}
          onClose={() => setShowInvite(false)}
          onRequested={onReloadInvitationRequests}
        />
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
