// Vérification sur un VRAI projet Supabase — à exécuter après seed-test-personas.sql.
// Usage : node scripts/verify-real-supabase.mjs
//
// Règle de conception centrale, après un faux négatif détecté : une vérification "l'objet
// existe toujours après un blocage" ne doit JAMAIS dépendre d'un témoin qui n'a lui-même
// plus le droit de voir cet objet. Pour les avatars, la policy interdit précisément à
// l'admin de voir l'avatar d'un membre removed (shares_active_community_with exige que
// LA CIBLE soit aussi active) — donc la preuve d'existence se fait en restaurant d'abord
// le propriétaire actif, puis en le laissant constater lui-même que rien n'a disparu.
// Pour community-files en revanche, le droit de modération admin est scopé à la communauté,
// pas au statut de l'auteur du fichier — l'admin reste un témoin valable là.

import { createClient } from '@supabase/supabase-js';
import { readFileSync, existsSync } from 'fs';

if (existsSync('.env.test')) {
  for (const line of readFileSync('.env.test', 'utf8').split('\n')) {
    const m = line.match(/^([A-Z_]+)=(.*)$/);
    if (m) process.env[m[1]] = m[2];
  }
}

const URL = process.env.SUPABASE_URL;
const KEY = process.env.SUPABASE_PUBLISHABLE_KEY;
const COMMUNITY_A = process.env.TEST_COMMUNITY_A_ID;
const COMMUNITY_B = process.env.TEST_COMMUNITY_B_ID;

if (!URL || !KEY || !COMMUNITY_A || !COMMUNITY_B) {
  console.error('Variables manquantes — vérifie .env.test (voir .env.test.example).');
  process.exit(1);
}

let passed = 0, failed = 0;

async function check(label, fn) {
  try {
    const ok = await fn();
    if (ok) { console.log(`✅ ${label}`); passed++; }
    else { console.log(`❌ ${label} — résultat inattendu`); failed++; }
  } catch (e) {
    console.log(`⚠️  ${label} — erreur inattendue : ${e.message}`);
    failed++;
  }
}

async function mustSucceed(label, fn) {
  const { data, error } = await fn();
  if (error) {
    console.error(`\n💥 PRÉCONDITION ÉCHOUÉE : ${label}\n   ${error.message}`);
    console.error('   Le script s\'arrête ici — corriger avant de relancer.');
    process.exit(1);
  }
  return data;
}

async function signIn(emailVar, passVar) {
  const client = createClient(URL, KEY);
  const { error } = await client.auth.signInWithPassword({
    email: process.env[emailVar],
    password: process.env[passVar],
  });
  if (error) throw new Error(`Connexion ${emailVar} échouée : ${error.message}`);
  return client;
}

async function main() {
  const a1 = await signIn('TEST_A1_EMAIL', 'TEST_A1_PASSWORD');
  const a2admin = await signIn('TEST_A2_ADMIN_EMAIL', 'TEST_A2_ADMIN_PASSWORD');
  const b1 = await signIn('TEST_B1_EMAIL', 'TEST_B1_PASSWORD');
  const a3 = await signIn('TEST_A3_EMAIL', 'TEST_A3_PASSWORD');
  const none = await signIn('TEST_NONE_EMAIL', 'TEST_NONE_PASSWORD');

  const { data: { user: a1User } } = await a1.auth.getUser();
  const { data: { user: a3User } } = await a3.auth.getUser();
  const { data: { user: b1User } } = await b1.auth.getUser();

  console.log('\n--- RLS relationnelle : isolation de base ---');

  await check('A1 lit les événements de sa communauté', async () => {
    const { data, error } = await a1.from('events').select('*').eq('community_id', COMMUNITY_A);
    if (error) throw error;
    return data.length >= 1;
  });

  await check('A1 NE lit PAS les événements de B', async () => {
    const { data, error } = await a1.from('events').select('*').eq('community_id', COMMUNITY_B);
    if (error) throw error;
    return data.length === 0;
  });

  await check('B1 NE lit PAS les événements de A (réciproque)', async () => {
    const { data, error } = await b1.from('events').select('*').eq('community_id', COMMUNITY_A);
    if (error) throw error;
    return data.length === 0;
  });

  await check('Authentifié sans communauté ne lit rien', async () => {
    const { data, error } = await none.from('events').select('*');
    if (error) throw error;
    return data.length === 0;
  });

  await check('A1 ne peut PAS insérer un événement dans B', async () => {
    const { error } = await a1.from('events').insert({
      community_id: COMMUNITY_B, category: 'sortie', title: 'Injection', created_by: a1User.id,
    });
    return Boolean(error);
  });

  console.log('\n--- Admin : modération scopée à sa communauté ---');

  const ownMsg = await mustSucceed('création du message A1 (précondition)', () =>
    a1.from('messages').insert({ community_id: COMMUNITY_A, author_id: a1User.id, text: 'Message A1 pour modération admin' }).select().single()
  );

  await check('Admin A modère réellement un message de A', async () => {
    const { data, error } = await a2admin.from('messages').update({ text: 'Modéré par admin A' }).eq('id', ownMsg.id).select();
    if (error) throw error;
    return data.length === 1 && data[0].text === 'Modéré par admin A';
  });

  const bMsg = await mustSucceed('création du message B1 (précondition)', () =>
    b1.from('messages').insert({ community_id: COMMUNITY_B, author_id: b1User.id, text: 'Message B1' }).select().single()
  );

  await check('Admin A NE PEUT PAS modérer un message de B', async () => {
    const { data, error } = await a2admin.from('messages').update({ text: 'Tentative admin A sur B' }).eq('id', bMsg.id).select();
    const blocked = Boolean(error) || data.length === 0;
    if (!blocked) return false;
    const { data: check2 } = await b1.from('messages').select('text').eq('id', bMsg.id).single();
    return check2?.text === 'Message B1';
  });

  console.log('\n--- Storage community-files : isolation + modération admin, dans les deux communautés ---');

  const pathA = `${COMMUNITY_A}/${a1User.id}/verif-${Date.now()}.txt`;
  await mustSucceed('upload du fichier A1 (précondition)', () =>
    a1.storage.from('community-files').upload(pathA, new Blob(['test'])).then((r) => r)
  );
  const pathB = `${COMMUNITY_B}/${b1User.id}/verif-${Date.now()}.txt`;
  await mustSucceed('upload du fichier B1 (précondition)', () =>
    b1.storage.from('community-files').upload(pathB, new Blob(['test'])).then((r) => r)
  );

  console.log('\n--- Usage réel : download() et createSignedUrl(), pas seulement list() ---');
  // C'est précisément l'API qu'ABCZed utilisera pour "Ouvrir/Télécharger" un document —
  // list() confirme la visibilité des métadonnées, pas l'accès réel au contenu du fichier.

  await check('A1 télécharge réellement son fichier (download)', async () => {
    const { data, error } = await a1.storage.from('community-files').download(pathA);
    return !error && Boolean(data);
  });

  await check('Admin A télécharge le fichier de A1 (download)', async () => {
    const { data, error } = await a2admin.storage.from('community-files').download(pathA);
    return !error && Boolean(data);
  });

  await check('B1 NE PEUT PAS télécharger le fichier de A (download refusé)', async () => {
    const { error } = await b1.storage.from('community-files').download(pathA);
    return Boolean(error);
  });

  await check('Authentifié sans communauté NE PEUT PAS télécharger le fichier de A', async () => {
    const { error } = await none.storage.from('community-files').download(pathA);
    return Boolean(error);
  });

  await check('A1 obtient une signed URL pour son fichier', async () => {
    const { data, error } = await a1.storage.from('community-files').createSignedUrl(pathA, 60);
    return !error && Boolean(data?.signedUrl);
  });

  await check('B1 NE PEUT PAS obtenir de signed URL pour le fichier de A', async () => {
    const { error } = await b1.storage.from('community-files').createSignedUrl(pathA, 60);
    return Boolean(error);
  });

  await check('Authentifié sans communauté NE PEUT PAS obtenir de signed URL', async () => {
    const { error } = await none.storage.from('community-files').createSignedUrl(pathA, 60);
    return Boolean(error);
  });

  await check('A1 NE PEUT PAS upload dans le dossier de B', async () => {
    const { error } = await a1.storage.from('community-files').upload(`${COMMUNITY_B}/${a1User.id}/intrusion.txt`, new Blob(['test']));
    return Boolean(error);
  });

  await check('B1 NE voit PAS le dossier de A', async () => {
    const { data, error } = await b1.storage.from('community-files').list(`${COMMUNITY_A}/${a1User.id}`);
    if (error) return true;
    return data.length === 0;
  });

  await check('Admin A modère (supprime) réellement le fichier de A1', async () => {
    const { error } = await a2admin.storage.from('community-files').remove([pathA]);
    if (error) return false;
    const { data } = await a2admin.storage.from('community-files').list(`${COMMUNITY_A}/${a1User.id}`);
    return !data.some((f) => pathA.endsWith(f.name));
  });

  await check('Admin A NE PEUT PAS lire le fichier de B (frontière inter-communautés)', async () => {
    const { data, error } = await a2admin.storage.from('community-files').list(`${COMMUNITY_B}/${b1User.id}`);
    if (error) return true;
    return data.length === 0;
  });

  await check('Admin A NE PEUT PAS supprimer le fichier de B', async () => {
    const { error } = await a2admin.storage.from('community-files').remove([pathB]);
    // B1 reste le témoin légitime ici : lui A le droit de voir son propre fichier.
    const { data: stillThere } = await b1.storage.from('community-files').list(`${COMMUNITY_B}/${b1User.id}`);
    const present = stillThere?.some((f) => pathB.endsWith(f.name));
    return Boolean(error) ? present !== false : present;
  });

  await check('B1 nettoie lui-même son fichier de test (témoin légitime de son propre contenu)', async () => {
    const { error } = await b1.storage.from('community-files').remove([pathB]);
    if (error) return false;
    const { data } = await b1.storage.from('community-files').list(`${COMMUNITY_B}/${b1User.id}`);
    return !data.some((f) => pathB.endsWith(f.name));
  });

  console.log('\n--- Storage avatars : isolation, sans jamais utiliser un témoin qui n\'a pas le droit de voir ---');

  const avatarPathA1 = `${a1User.id}/avatar-${Date.now()}.txt`;
  await mustSucceed('upload de l\'avatar A1 (précondition)', () =>
    a1.storage.from('avatars').upload(avatarPathA1, new Blob(['avatar'])).then((r) => r)
  );

  await check('A1 télécharge réellement son propre avatar (download)', async () => {
    const { data, error } = await a1.storage.from('avatars').download(avatarPathA1);
    return !error && Boolean(data);
  });

  await check('Admin A (même communauté) télécharge l\'avatar de A1', async () => {
    const { data, error } = await a2admin.storage.from('avatars').download(avatarPathA1);
    return !error && Boolean(data);
  });

  await check('B1 NE PEUT PAS télécharger l\'avatar de A1 (aucune communauté commune)', async () => {
    const { error } = await b1.storage.from('avatars').download(avatarPathA1);
    return Boolean(error);
  });

  await check('A1 obtient une signed URL pour son propre avatar', async () => {
    const { data, error } = await a1.storage.from('avatars').createSignedUrl(avatarPathA1, 60);
    return !error && Boolean(data?.signedUrl);
  });

  await check('Admin A (même communauté) obtient une signed URL pour l\'avatar de A1', async () => {
    const { data, error } = await a2admin.storage.from('avatars').createSignedUrl(avatarPathA1, 60);
    return !error && Boolean(data?.signedUrl);
  });

  await check('B1 NE PEUT PAS obtenir de signed URL pour l\'avatar de A1', async () => {
    const { error } = await b1.storage.from('avatars').createSignedUrl(avatarPathA1, 60);
    return Boolean(error);
  });

  await check('Admin A (même communauté, A1 actif) lit l\'avatar de A1', async () => {
    const { data, error } = await a2admin.storage.from('avatars').list(a1User.id);
    if (error) throw error;
    return data.length >= 1;
  });

  await check('B1 NE PEUT PAS lire l\'avatar de A1 (aucune communauté commune)', async () => {
    const { data, error } = await b1.storage.from('avatars').list(a1User.id);
    if (error) return true;
    return data.length === 0;
  });

  await check('Authentifié sans communauté NE PEUT PAS upload d\'avatar', async () => {
    const { data: { user: noneUser } } = await none.auth.getUser();
    const { error } = await none.storage.from('avatars').upload(`${noneUser.id}/avatar.txt`, new Blob(['x']));
    return Boolean(error);
  });

  await check('A1 nettoie son propre avatar de test (témoin légitime : lui-même)', async () => {
    const { error } = await a1.storage.from('avatars').remove([avatarPathA1]);
    if (error) return false;
    const { data } = await a1.storage.from('avatars').list(a1User.id);
    return !data.some((f) => avatarPathA1.endsWith(f.name));
  });

  console.log('\n--- Scénario removed complet (A3 : actif -> retiré -> vérifications -> restauré) ---');

  const preReset = await mustSucceed('remise à active de A3 avant le scénario (précondition)', () =>
    a2admin.from('members').update({ status: 'active' }).eq('user_id', a3User.id).select()
  );
  if (preReset.length !== 1 || preReset[0].status !== 'active') {
    console.error('\n💥 PRÉCONDITION ÉCHOUÉE : A3 non confirmé actif avant le scénario removed.');
    process.exit(1);
  }

  const pathA3 = `${COMMUNITY_A}/${a3User.id}/fichier-a3-${Date.now()}.txt`;
  await mustSucceed('upload du fichier A3 (précondition)', () => a3.storage.from('community-files').upload(pathA3, new Blob(['a3'])).then((r) => r));
  const avatarPathA3 = `${a3User.id}/avatar-a3-${Date.now()}.txt`;
  await mustSucceed('upload de l\'avatar A3 (précondition)', () => a3.storage.from('avatars').upload(avatarPathA3, new Blob(['a3-avatar'])).then((r) => r));
  const a3Event = await mustSucceed('création de l\'événement A3 (précondition)', () =>
    a3.from('events').insert({ community_id: COMMUNITY_A, category: 'sortie', title: 'Événement A3', created_by: a3User.id }).select().single()
  );
  await mustSucceed('participation de A3 (précondition)', () =>
    a3.from('event_participants').insert({ event_id: a3Event.id, community_id: COMMUNITY_A, user_id: a3User.id }).select().single()
  );

  await check('Admin A retire réellement A3 (status devient removed, vérifié)', async () => {
    const { data, error } = await a2admin.from('members').update({ status: 'removed' }).eq('user_id', a3User.id).select();
    if (error) throw error;
    return data.length === 1 && data[0].status === 'removed';
  });

  // --- Vérifications qui ne dépendent d'aucun témoin externe (A3 s'auto-observe, ou
  // s'appuient sur un droit qui reste valable indépendamment du statut d'A3 : community-files
  // reste modérable par un admin scopé à la communauté, quel que soit le statut de l'auteur). ---

  await check('A3 (removed) ne lit plus les événements de A', async () => {
    const { data, error } = await a3.from('events').select('*').eq('community_id', COMMUNITY_A);
    if (error) throw error;
    return data.length === 0;
  });

  await check('A3 (removed) ne peut plus insérer de message', async () => {
    const { error } = await a3.from('messages').insert({ community_id: COMMUNITY_A, author_id: a3User.id, text: 'Après retrait' });
    return Boolean(error);
  });

  await check('A3 (removed) ne peut plus insérer d\'événement', async () => {
    const { error } = await a3.from('events').insert({ community_id: COMMUNITY_A, category: 'sortie', title: 'Après retrait', created_by: a3User.id });
    return Boolean(error);
  });

  await check('A3 (removed) ne peut plus insérer de partage', async () => {
    const { error } = await a3.from('shares').insert({ community_id: COMMUNITY_A, type: 'info', title: 'Après retrait', author_id: a3User.id });
    return Boolean(error);
  });

  await check('A3 (removed) ne peut plus supprimer son ancienne participation (témoin : admin, valable ici)', async () => {
    const { data, error } = await a3.from('event_participants').delete().eq('event_id', a3Event.id).eq('user_id', a3User.id).select();
    const blocked = Boolean(error) || data.length === 0;
    if (!blocked) return false;
    const { data: stillThere } = await a2admin.from('event_participants').select('*').eq('event_id', a3Event.id).eq('user_id', a3User.id);
    return stillThere.length === 1;
  });

  await check('A3 (removed) ne lit plus son ancien fichier community-files', async () => {
    const { data, error } = await a3.storage.from('community-files').list(`${COMMUNITY_A}/${a3User.id}`);
    if (error) return true;
    return data.length === 0;
  });

  await check('A3 (removed) ne peut plus supprimer son fichier (témoin : admin, valable ici — droit scopé à la communauté, pas au statut de l\'auteur)', async () => {
    const { error } = await a3.storage.from('community-files').remove([pathA3]);
    const { data: stillThere } = await a2admin.storage.from('community-files').list(`${COMMUNITY_A}/${a3User.id}`);
    const present = stillThere?.some((f) => pathA3.endsWith(f.name));
    return Boolean(error) ? present !== false : present;
  });

  await check('A3 (removed) ne lit plus son propre avatar', async () => {
    const { data, error } = await a3.storage.from('avatars').list(a3User.id);
    if (error) return true;
    return data.length === 0;
  });

  await check('A3 (removed) ne peut plus uploader d\'avatar', async () => {
    const { error } = await a3.storage.from('avatars').upload(`${a3User.id}/nouveau-${Date.now()}.txt`, new Blob(['x']));
    return Boolean(error);
  });

  // Tentative de suppression pendant le retrait — on note juste le résultat brut ici,
  // SANS tenter de la "prouver" via un témoin qui n'a plus le droit de regarder. La preuve
  // vient juste après, une fois A3 restauré actif : lui seul peut légitimement témoigner.
  await a3.storage.from('avatars').remove([avatarPathA3]);

  console.log('\n--- Restauration ---');

  const restored = await mustSucceed('restauration de A3 en active', () =>
    a2admin.from('members').update({ status: 'active' }).eq('user_id', a3User.id).select()
  );
  if (restored.length !== 1 || restored[0].status !== 'active') {
    console.error('\n💥 RESTAURATION ÉCHOUÉE : A3 non confirmé actif après le scénario.');
    process.exit(1);
  }
  console.log('✅ A3 restauré actif (vérifié)');

  // La vraie preuve que le DELETE pendant le retrait n'a pas fonctionné : maintenant qu'A3
  // est redevenu un témoin légitime de son propre avatar, il constate qu'il est toujours là.
  await check('Preuve : l\'avatar d\'A3 a bien survécu à la tentative de suppression pendant le retrait', async () => {
    const { data, error } = await a3.storage.from('avatars').list(a3User.id);
    if (error) throw error;
    return data.some((f) => avatarPathA3.endsWith(f.name));
  });

  console.log('\n--- Nettoyage final (par les acteurs réellement autorisés, succès vérifié) ---');

  let cleanupOk = true;
  const relationalCleanups = [
    ['message A1', () => a1.from('messages').delete().eq('id', ownMsg.id).select()],
    ['message B1', () => b1.from('messages').delete().eq('id', bMsg.id).select()],
    ['participation A3', () => a3.from('event_participants').delete().eq('event_id', a3Event.id).eq('user_id', a3User.id).select()],
    ['événement A3', () => a3.from('events').delete().eq('id', a3Event.id).select()],
  ];
  for (const [label, fn] of relationalCleanups) {
    const { data, error } = await fn();
    if (error) { console.log(`⚠️  Nettoyage "${label}" incomplet : ${error.message}`); cleanupOk = false; }
    else if (!data || data.length !== 1) { console.log(`⚠️  Nettoyage "${label}" douteux : 0 ligne réellement supprimée (pas d'erreur, mais rien touché)`); cleanupOk = false; }
    else console.log(`✅ Nettoyé : ${label}`);
  }

  const storageCleanups = [
    ['fichier A3 (community-files)', () => a3.storage.from('community-files').remove([pathA3]), () => a3.storage.from('community-files').list(`${COMMUNITY_A}/${a3User.id}`), pathA3],
    ['avatar A3', () => a3.storage.from('avatars').remove([avatarPathA3]), () => a3.storage.from('avatars').list(a3User.id), avatarPathA3],
  ];
  for (const [label, removeFn, listFn, fullPath] of storageCleanups) {
    const { error } = await removeFn();
    const { data: stillThere } = await listFn();
    const present = stillThere?.some((f) => fullPath.endsWith(f.name));
    if (error || present) { console.log(`⚠️  Nettoyage "${label}" incomplet : ${error?.message || 'fichier toujours présent après remove()'}`); cleanupOk = false; }
    else console.log(`✅ Nettoyé (vérifié disparu) : ${label}`);
  }
  if (!cleanupOk) console.log('   Le script reste utilisable, mais supprime manuellement ce qui n\'a pas pu l\'être.');

  console.log(`\n${passed} réussite(s), ${failed} échec(s).`);
  console.log('\nÀ vérifier manuellement dans le Dashboard Supabase :');
  console.log('  - Storage > Buckets : community-files et avatars affichent bien "Private"');
  console.log('  - Project Settings > API > Exposed schemas : app_private n\'y figure PAS');

  if (failed > 0) process.exit(1);
}

main();
