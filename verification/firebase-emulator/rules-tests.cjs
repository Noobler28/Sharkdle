const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
const { initializeTestEnvironment, assertSucceeds, assertFails } = require('@firebase/rules-unit-testing');
const { doc, getDoc, setDoc, updateDoc, deleteDoc, runTransaction, serverTimestamp, setLogLevel } = require('firebase/firestore');
const { harness } = require('../rng-account-sync-regression.cjs');
const results = [];
let environment;
process.chdir(path.resolve(__dirname, '../..'));
setLogLevel('silent');
async function test(name, callback) {
    const started = Date.now();
    await callback();
    results.push({ name, passed: true, milliseconds: Date.now() - started });
    console.log('PASS ' + name);
}
const claim = (uid, code, extra = {}) => ({ uid, code, redeemedAt: serverTimestamp(), ...extra });
function adapter(db) {
    // The VM harness has a different Object prototype from the SDK's Node realm.
    const nativeData = value => JSON.parse(JSON.stringify(value));
    const wrapSnapshot = snapshot => ({ exists: snapshot.exists(), data: () => snapshot.data(), id: snapshot.id });
    const collection = prefix => ({ doc: id => reference(prefix + '/' + id) });
    const reference = location => ({
        native: doc(db, location), collection: name => collection(location + '/' + name),
        get: async () => wrapSnapshot(await getDoc(doc(db, location))),
        set: (value, options) => setDoc(doc(db, location), nativeData(value), options),
        update: value => updateDoc(doc(db, location), nativeData(value))
    });
    return { collection, runTransaction: callback => runTransaction(db, tx => callback({
        get: async ref => wrapSnapshot(await tx.get(ref.native)),
        set: (ref, value, options) => tx.set(ref.native, nativeData(value), options)
    })) };
}
(async () => {
    environment = await initializeTestEnvironment({ projectId: 'demo-sharkdle-stress', firestore: {
        host: '127.0.0.1', port: 8787,
        rules: fs.readFileSync(path.resolve(__dirname, '../../firestore.rules'), 'utf8')
    } });
    await environment.clearFirestore();
    const a = environment.authenticatedContext('account-a', { email_verified: true }).firestore();
    const b = environment.authenticatedContext('account-b', { email_verified: true }).firestore();
    const unverified = environment.authenticatedContext('account-a', { email_verified: false }).firestore();
    const guest = environment.unauthenticatedContext().firestore();
    const developer = environment.authenticatedContext('ETPtQC0VA2NiSnX67rS2P2ma2tC2', { email_verified: true }).firestore();
    await test('Only verified owners can save or read private RNG data', async () => {
        await assertSucceeds(setDoc(doc(a, 'rngProfiles/account-a'), { schemaVersion: 1, coins: 10 }));
        for (const db of [b, guest, unverified]) {
            await assertFails(getDoc(doc(db, 'rngProfiles/account-a')));
            await assertFails(setDoc(doc(db, 'rngProfiles/account-a'), { coins: 900 }));
            await assertFails(setDoc(doc(db, 'rngProfiles/account-a/chunks/chunk_0000'), { entries: [] }));
        }
        await assertSucceeds(setDoc(doc(a, 'rngProfiles/account-a/chunks/chunk_0000'), { entries: [] }));
        await assertSucceeds(getDoc(doc(developer, 'rngProfiles/account-a')));
    });
    await test('Old clients cannot downgrade a schema 2 save', async () => {
        await assertSucceeds(setDoc(doc(a, 'rngProfiles/account-a'), { schemaVersion: 2, coins: 20 }));
        await assertFails(setDoc(doc(a, 'rngProfiles/account-a'), { schemaVersion: 1, coins: 1 }));
        await assertFails(setDoc(doc(a, 'rngProfiles/account-a'), { coins: 1 }));
        await assertSucceeds(updateDoc(doc(a, 'rngProfiles/account-a'), { coins: 21 }));
    });
    await test('Reward claims are private, validated and immutable', async () => {
        const location = 'userStats/account-a/redeemedCodes/LSFSW';
        await assertSucceeds(setDoc(doc(a, location), claim('account-a', 'LSFSW')));
        await assertSucceeds(getDoc(doc(a, location)));
        for (const db of [b, guest, unverified]) {
            await assertFails(getDoc(doc(db, location)));
            await assertFails(setDoc(doc(db, 'userStats/account-a/redeemedCodes/OTHER'), claim('account-a', 'OTHER')));
        }
        await assertFails(setDoc(doc(a, location), claim('account-a', 'LSFSW')));
        await assertFails(deleteDoc(doc(a, location)));
        const invalid = [
            ['BAD1', claim('account-b', 'BAD1')],
            ['BAD2', claim('account-a', 'SPOOF')],
            ['BAD3', claim('account-a', 'BAD3', { extra: true })],
            ['BAD4', claim('account-a', 'BAD4', { redeemedAt: 123 })],
            ['lowercase', claim('account-a', 'lowercase')],
            ['A'.repeat(61), claim('account-a', 'A'.repeat(61))]
        ];
        for (const [code, value] of invalid) await assertFails(setDoc(doc(a, 'userStats/account-a/redeemedCodes/' + code), value));
        await assertSucceeds(deleteDoc(doc(developer, location)));
    });
    await test('Real competing transactions grant LSFSW exactly once', async () => {
        await setDoc(doc(a, 'userStats/account-a'), { xp: 0, pearls: 0 });
        const redeem = () => runTransaction(a, async tx => {
            const profile = doc(a, 'userStats/account-a'), marker = doc(a, 'userStats/account-a/redeemedCodes/LSFSW');
            const [stats, claimed] = await Promise.all([tx.get(profile), tx.get(marker)]);
            if (claimed.exists()) return false;
            tx.set(profile, { xp: stats.data().xp + 2000, pearls: stats.data().pearls + 250 });
            tx.set(marker, claim('account-a', 'LSFSW'));
            return true;
        });
        const outcomes = await Promise.all(Array.from({ length: 8 }, redeem));
        assert.equal(outcomes.filter(Boolean).length, 1);
        assert.deepEqual((await getDoc(doc(a, 'userStats/account-a'))).data(), { xp: 2000, pearls: 250 });
        await assertFails(runTransaction(a, async tx => {
            await tx.get(doc(a, 'userStats/account-a'));
            tx.update(doc(a, 'userStats/account-a'), { xp: 999999 });
            tx.set(doc(a, 'userStats/account-a/redeemedCodes/FAIL'), claim('other-user', 'FAIL'));
        }));
        assert.equal((await getDoc(doc(a, 'userStats/account-a'))).data().xp, 2000);
        assert.equal((await getDoc(doc(a, 'userStats/account-a/redeemedCodes/FAIL'))).exists(), false);
    });
    await test('Every listed blacklist UID is blocked from both leaderboard write paths', async () => {
        const source = fs.readFileSync(path.resolve(__dirname, '../../firestore.rules'), 'utf8');
        const ids = [...source.match(/function isLeaderboardBlacklisted\(userId\)\s*\{([\s\S]*?)\}/)[1].matchAll(/'([^']+)'/g)].map(match => match[1]);
        assert.equal(ids.length, 14);
        for (const uid of ids) {
            const db = environment.authenticatedContext(uid, { email_verified: true }).firestore();
            await assertFails(setDoc(doc(db, 'userStats/' + uid), { rngRolls: 1 }));
            await assertSucceeds(setDoc(doc(db, 'userStats/' + uid), { xp: 10 }));
            await assertFails(updateDoc(doc(db, 'userStats/' + uid), { rngBestOneIn: 99999 }));
            await assertFails(setDoc(doc(db, 'rngLeaderboard/' + uid), { uid, bestOneIn: 99999 }));
            await assertSucceeds(setDoc(doc(db, 'rngProfiles/' + uid), { schemaVersion: 2, coins: 10 }));
        }
    });
    await test('Leaderboard requires a canonical account and matching owner', async () => {
        await assertFails(setDoc(doc(b, 'rngLeaderboard/account-b'), { uid: 'account-b' }));
        await setDoc(doc(b, 'userStats/account-b'), { xp: 0 });
        await assertFails(setDoc(doc(b, 'rngLeaderboard/account-a'), { uid: 'account-b' }));
        await assertFails(setDoc(doc(b, 'rngLeaderboard/account-b'), { uid: 'account-a' }));
        await assertSucceeds(setDoc(doc(b, 'rngLeaderboard/account-b'), { uid: 'account-b', bestOneIn: 100 }));
        await deleteDoc(doc(b, 'userStats/account-b'));
        await assertFails(updateDoc(doc(b, 'rngLeaderboard/account-b'), { bestOneIn: 200 }));
    });
    await test('Actual RNG save and fresh-device hydration: 297,316 catches, 298 chunks', async () => {
        const uid = 'large-account';
        const db = environment.authenticatedContext(uid, { email_verified: true }).firestore();
        const store = adapter(db), device = harness('Minigames/SharkRNG/rng-mode.js', store);
        await device.login(uid);
        const collection = {};
        for (let i = 0; i < 297316; i++) {
            const name = 'Large collection shark number ' + i;
            collection[name + ' (Temporal)'] = { tier: 'Common', baseTier: 'Common', oddsTier: 'Singularity',
                oneIn: 1975890000000, firstRoll: i + 1, count: 3, mutation: 'chronoshark', mutations: ['chronoshark'], baseName: name };
        }
        device.api.change({ collection, coins: 12345, rolls: 150000, bestOneIn: 1975890000000 });
        assert.equal(await device.api.syncRngProfileToFirebase(), true, 'Real emulator must accept the full save: ' + device.warnings.join('\n'));
        const metadata = (await getDoc(doc(db, 'rngProfiles/' + uid))).data();
        assert.equal(metadata.collectionEntryCount, 297316);
        assert.equal(metadata.chunkCount, 298);
        assert.equal(metadata.collectionEncoding, 'gzip-json-v1');
        const second = harness('Minigames/SharkRNG/rng-mode.js', store);
        await second.login(uid);
        assert.equal(Object.keys(second.api.player().collection).length, 297316);
        assert.equal(second.api.player().coins, 12345);
        assert.equal(second.api.canPlayRngAccount(), true);
    });
})().catch(error => {
    results.push({ name: 'Aborted check', passed: false, error: error.stack });
    console.error(error); process.exitCode = 1;
}).finally(async () => {
    fs.writeFileSync(path.join(__dirname, 'results.json'), JSON.stringify({ projectId: 'demo-sharkdle-stress', results }, null, 2) + '\n');
    if (environment) await environment.cleanup();
});
