const fs = require('node:fs');
const vm = require('node:vm');
const assert = require('node:assert/strict');
const clone = value => value === undefined ? undefined : JSON.parse(JSON.stringify(value));
const deferred = () => { let resolve; const promise = new Promise(done => { resolve = done; }); return { promise, resolve }; };

function database() {
    const records = new Map(), versions = new Map();
    let writes = 0, retries = 0, offline = false, readGate = null, commitGate = null;
    const snapshot = (path, value = records.get(path)) => ({ id: path.split('/').at(-1), exists: value !== undefined, data: () => clone(value) });
    function put(path, value) { records.set(path, clone(value)); versions.set(path, (versions.get(path) || 0) + 1); }
    function ref(path) {
        return {
            path, collection: name => collection(path + '/' + name),
            async get(options) { if (offline) throw Error('offline'); return snapshot(path); },
            async set(value) { if (offline) throw Error('offline'); writes++; put(path, value); },
            async update(value) { if (!records.has(path)) throw Error('deleted account'); writes++; put(path, { ...records.get(path), ...clone(value) }); }
        };
    }
    function collection(path) {
        let field, limit = Infinity, after;
        return {
            doc: id => ref(path + '/' + id), orderBy(key) { field = key; return this; },
            limit(count) { limit = count; return this; }, startAfter(doc) { after = doc.id; return this; },
            async get(options) {
                assert.equal(options?.source, 'server');
                if (offline) throw Error('offline');
                let docs = [...records.keys()].filter(key => key.startsWith(path + '/') && key.split('/').length === path.split('/').length + 1)
                    .map(key => snapshot(key)).filter(doc => field in doc.data())
                    .sort((a, b) => b.data()[field] - a.data()[field]);
                if (after) docs = docs.slice(docs.findIndex(doc => doc.id === after) + 1);
                docs = docs.slice(0, limit);
                return { docs };
            }
        };
    }
    return {
        records, put, collection, writes: () => writes, retries: () => retries, offline: value => { offline = value; },
        blockRead(path) { const gate = { path, entered: deferred(), released: deferred() }; readGate = gate; return gate; },
        blockCommit() { const gate = { entered: deferred(), released: deferred() }; commitGate = gate; return gate; },
        async runTransaction(callback) {
            for (let attempt = 0; attempt < 5; attempt++) {
                if (offline) throw Error('offline');
                const reads = new Map(), pending = new Map();
                const result = await callback({
                    async get(target) {
                        if (offline) throw Error('offline');
                        reads.set(target.path, versions.get(target.path) || 0);
                        const doc = snapshot(target.path);
                        if (readGate?.path === target.path) {
                            const gate = readGate; readGate = null;
                            gate.entered.resolve(); await gate.released.promise;
                        }
                        return doc;
                    },
                    set(target, value) { pending.set(target.path, clone(value)); }
                });
                if (pending.size && commitGate) {
                    const gate = commitGate; commitGate = null;
                    gate.entered.resolve(); await gate.released.promise;
                }
                if (offline) throw Error('offline');
                const requestBytes = [...pending.values()].reduce((total, value) => total + Buffer.byteLength(JSON.stringify(value)), 0);
                if (requestBytes > 10 * 1024 * 1024) throw Error('Firestore request exceeds 10 MiB');
                if ([...reads].some(([path, version]) => version !== (versions.get(path) || 0))) { retries++; continue; }
                pending.forEach((value, path) => { writes++; put(path, value); });
                return result;
            }
            throw Error('too many conflicts');
        }
    };
}

function deviceStore(records) {
    return { open() {
        const request = {};
        queueMicrotask(() => {
            request.result = { close() {}, transaction() {
                const transaction = {};
                transaction.objectStore = () => ({
                    get(key) { const operation = {}; queueMicrotask(() => { operation.result = records.get(key); operation.onsuccess(); transaction.oncomplete(); }); return operation; },
                    put(value, key) { const operation = {}; queueMicrotask(() => { records.set(key, value); operation.result = key; operation.onsuccess(); transaction.oncomplete(); }); return operation; }
                });
                return transaction;
            } };
            request.onsuccess();
        });
        return request;
    } };
}

function harness(path, db = database(), storage = new Map(), largerStore = new Map()) {
    const auth = { currentUser: null };
    const warnings = [];
    const list = { innerHTML: '' };
    let quotaFull = false;
    const context = {
        window: {}, document: { getElementById: id => id === 'rng-leaderboard-list' ? list : null, querySelectorAll: () => [] },
        localStorage: { getItem: key => storage.get(key) || null, setItem: (key, value) => { if (quotaFull) throw Error('quota'); storage.set(key, value); } },
        indexedDB: deviceStore(largerStore), console: { warn(...args) { warnings.push(args.map(String).join(' ')); } }, setTimeout: () => 1, clearTimeout() {}, clearInterval() {},
        CompressionStream, DecompressionStream, Blob, Response, TextEncoder, btoa, atob,
        firebase: { firestore: { FieldValue: { serverTimestamp: () => 123 } } }
    };
    const source = fs.readFileSync(path, 'utf8').replace('    window.initRngMode = initRngMode;', `
        window.test = {
            prepare: (auth, db) => {
                rngLeaderboardAuth = auth; rngLeaderboardDb = db;
                updateAllUi = updateSettingsUi = setAutoRoll = () => {};
            },
            switchRngAccount, saveLocalProfile, scheduleLocalProfileSave, hydrateRngProfileFromFirebase,
            syncRngProfileToFirebase, loadRngLeaderboard, syncRngLeaderboardEntry, canPlayRngAccount,
            saveRngProgressNow, saveRngProgressBeforeSignOut, buildRngCloudProfilePayload,
            mergeRngProfilesForHydration, readRngProfileFromFirebase, applyRngProfileData,
            player: () => player, owner: () => rngProfileOwnerUid, dirty: () => rngCloudSaveDirty,
            localDirty: () => localSaveDirty, cloudError: () => cloudSaveError,
            change: data => { Object.assign(player, data); scheduleLocalProfileSave(); },
            defaultPlayer: createDefaultPlayer
        };`);
    vm.runInNewContext(source, context, { filename: path });
    const api = context.window.test;
    api.prepare(auth, db);
    return { api, auth, db, storage, largerStore, list, warnings,
        quota: value => { quotaFull = value; },
        async login(uid) { auth.currentUser = uid ? { uid } : null; return api.switchRngAccount(auth.currentUser); }
    };
}

const find = (name, oneIn = 100) => ({ [name]: { name, count: 1, oneIn, tier: 'Common' } });
const flush = () => new Promise(setImmediate);

module.exports = { database, harness, find, flush, deferred };

if (require.main === module) (async () => {
    for (const path of ['Minigames/SharkRNG/rng-mode.js', 'SharkdleMobile/www/Minigames/SharkRNG/rng-mode.js']) {
        const h = harness(path), t = h.api;
        h.storage.set('sharkRngProfile', JSON.stringify({ rolls: 999, bestOneIn: 999, collection: find('legacy'), rngXpCurveVersion: 3 }));
        await h.login('A');
        assert.equal(t.player().rolls, 0, 'Unowned shared saves must not be adopted on login');
        t.change({ rolls: 7, coins: 80, potions: { coin: 2 }, collection: find('A'), bestOneIn: 100 });
        await t.saveLocalProfile();
        assert.equal(await t.syncRngProfileToFirebase(), true);
        await h.login('B');
        assert.equal(t.player().rolls, 0); assert.equal(Object.keys(t.player().collection).length, 0);
        assert.equal(t.owner(), 'B');
        t.change({ rolls: 2, coins: 5, collection: find('B') }); await t.saveLocalProfile();
        await h.login(null);
        assert.equal(t.player().rolls, 999, 'Legacy guest progress remains available');
        await h.login('A');
        assert.equal(t.player().rolls, 7); assert.equal(t.player().coins, 80); assert.equal(t.player().potions.coin, 2);
        assert.equal(JSON.parse(h.storage.get('sharkRngProfile_B')).rolls, 2);
        assert.equal(t.applyRngProfileData({ uid: 'B', rolls: 500 }), false);

        const second = harness(path, h.db); await second.login('A');
        assert.equal(second.api.player().rolls, 7); assert.equal(second.api.player().potions.coin, 2);
        second.api.change({ rolls: 8, collection: { ...second.api.player().collection, ...find('second-device') }, coins: 30, potions: { coin: 0 } });
        await second.api.syncRngProfileToFirebase();
        t.change({ collection: { ...t.player().collection, ...find('first-device') } });
        await t.syncRngProfileToFirebase();
        await second.api.hydrateRngProfileFromFirebase({ force: true });
        assert.deepEqual(Object.keys(second.api.player().collection).sort(), ['A', 'first-device', 'second-device']);
        assert.equal(second.api.player().rolls, 8);

        const loadingDevice = harness(path, h.db);
        const loadingGate = h.db.blockRead('rngProfiles/A');
        const login = loadingDevice.login('A'); await loadingGate.entered.promise;
        assert.equal(loadingDevice.api.canPlayRngAccount(), false, 'Fresh-device play must wait for its account save');
        loadingGate.released.resolve(); await login;
        assert.equal(loadingDevice.api.canPlayRngAccount(), true);

        // Both writes start with stale device state; a transaction conflict must retry and retain both finds.
        const gate = h.db.blockCommit();
        t.change({ collection: { ...t.player().collection, ...find('concurrent-A') } });
        const pending = t.syncRngProfileToFirebase(); await gate.entered.promise;
        second.api.change({ collection: { ...second.api.player().collection, ...find('concurrent-B') } });
        await second.api.syncRngProfileToFirebase(); gate.released.resolve(); await pending;
        assert(h.db.retries() > 0);
        assert('concurrent-A' in t.player().collection && 'concurrent-B' in t.player().collection);

        // Logout waits for an existing cloud write and then commits newer gameplay before Auth is cleared.
        const signOutGate = h.db.blockCommit();
        t.change({ coins: 321 });
        const saving = t.syncRngProfileToFirebase(); await signOutGate.entered.promise;
        t.change({ coins: 222 });
        const signOutSave = t.saveRngProgressBeforeSignOut();
        await flush(); assert.equal(t.canPlayRngAccount(), false);
        signOutGate.released.resolve(); await saving; await signOutSave;
        assert.equal(h.db.records.get('rngProfiles/A').coins, 222);

        // A late read or commit for A cannot mutate B's player or save flags.
        const readGate = h.db.blockRead('rngProfiles/A');
        const hydration = t.hydrateRngProfileFromFirebase({ force: true }); await readGate.entered.promise;
        await h.login('B'); readGate.released.resolve(); await hydration;
        assert.equal(t.owner(), 'B'); assert.equal(t.player().rolls, 2);
        await h.login('A'); t.change({ rolls: 10 });
        const writeGate = h.db.blockCommit(); const writing = t.syncRngProfileToFirebase(); await writeGate.entered.promise;
        await h.login('B'); writeGate.released.resolve(); await writing;
        assert.equal(t.owner(), 'B'); assert.equal(t.player().rolls, 2); assert.equal(t.dirty(), true);

        // IndexedDB fallback writes capture the outgoing account key before their queued work starts.
        await h.login('A'); h.quota(true); t.change({ coins: 444 });
        const deviceWrite = t.saveLocalProfile(); await h.login('B'); await deviceWrite;
        assert.equal(JSON.parse(h.largerStore.get('sharkRngProfile_A')).coins, 444);
        assert.equal(t.player().coins, 5);
        h.quota(false);

        // Missing chunks and offline reads must block writes, preserving the recoverable device copy.
        h.db.put('rngProfiles/B', { uid: 'B', chunkCount: 1, collectionCount: 1, updatedAtMs: 1 });
        const writesBefore = h.db.writes();
        assert.equal(await t.hydrateRngProfileFromFirebase({ force: true }), false);
        assert.equal(await t.syncRngProfileToFirebase(), false);
        assert.equal(h.db.writes(), writesBefore); assert.equal(t.player().coins, 5); assert(t.cloudError());
        h.db.offline(true); assert.equal(await t.syncRngProfileToFirebase(), false); h.db.offline(false);

        const owned = harness(path);
        owned.storage.set('sharkRngProfile', JSON.stringify({ uid: 'A', coins: 777, rngXpCurveVersion: 3 }));
        await owned.login('B'); assert.equal(owned.api.player().coins, 0);
        await owned.login('A'); assert.equal(owned.api.player().coins, 777);

        const large = harness(path);
        large.db.put('rngProfiles/large', { uid: 'large', chunkCount: 70, collectionCount: 70000, updatedAtMs: 1 });
        for (let chunk = 0; chunk < 70; chunk++) {
            large.db.put('rngProfiles/large/chunks/chunk_' + String(chunk).padStart(4, '0'), {
                updatedAtMs: 1, entries: Array.from({ length: 1000 }, (_, index) => ({ key: 'species-' + (chunk * 1000 + index), entry: { oneIn: 100, count: 1 } }))
            });
        }
        const largeProfile = await large.api.readRngProfileFromFirebase({ uid: 'large' });
        assert.equal(Object.keys(largeProfile.collection).length, 70000); assert('species-69999' in largeProfile.collection);
        large.db.put('rngProfiles/large', { uid: 'large', chunkCount: 401 });
        await assert.rejects(large.api.readRngProfileFromFirebase({ uid: 'large' }), /Unsupported/);
        large.db.put('rngProfiles/large', { uid: 'large', chunkCount: 1, collectionCount: 1000, updatedAtMs: 2 });
        await assert.rejects(large.api.readRngProfileFromFirebase({ uid: 'large' }), /Incomplete/);

        // Permanent progress survives a newer but stale save; intentional reset and prestige still reset run stats.
        const merged = t.mergeRngProfilesForHydration(
            { rngStateUpdatedAtMs: 1, prestigeLevel: 2, runBestOneIn: 10, rngXp: 10, prestigeUpgrades: { luck: 3 } },
            { rngStateUpdatedAtMs: 2, prestigeLevel: 1, runBestOneIn: 9999, rngXp: 9999, prestigeUpgrades: { luck: 1 } }
        );
        assert.equal(merged.prestigeLevel, 2); assert.equal(merged.rngXp, 10); assert.equal(merged.prestigeUpgrades.luck, 3);
        const reset = t.mergeRngProfilesForHydration({ rngResetAtMs: 5, collection: {}, coins: 0 }, { collection: find('old'), coins: 100 });
        assert.equal(reset.coins, 0); assert.equal(Object.keys(reset.collection).length, 0);

        // More than a full page of orphaned scores must not hide legitimate accounts below them.
        const board = harness(path);
        for (let i = 0; i < 35; i++) board.db.put('rngLeaderboard/deleted-' + i, { bestOneIn: 10000 - i, username: 'Deleted-' + i });
        for (let i = 0; i < 10; i++) {
            board.db.put('userStats/live-' + i, { username: 'Live-' + i, rngBestOneIn: 100 - i });
            board.db.put('rngLeaderboard/live-' + i, { username: 'Live-' + i, bestOneIn: 100 - i });
        }
        await board.api.loadRngLeaderboard();
        assert(!board.list.innerHTML.includes('Deleted-')); assert(board.list.innerHTML.includes('Live-0')); assert(board.list.innerHTML.includes('Live-9'));
        await board.login('deleted-0');
        const beforeDeletedSync = board.db.writes();
        assert.equal(await board.api.syncRngLeaderboardEntry(), false);
        assert.equal(board.db.writes(), beforeDeletedSync); assert(!board.db.records.has('userStats/deleted-0'));
        console.log(path + ': PASS account/guest isolation, legacy ownership, device transfer, transaction conflicts, stale auth reads/writes, IndexedDB keys, incomplete/offline cloud safety, prestige/reset, orphan pagination and no deleted-profile recreation');
    }
    for (const path of ['script.js', 'SharkdleMobile/www/script.js']) {
        const source = fs.readFileSync(path, 'utf8');
        const start = source.indexOf('async function logoutUser()');
        const gate = deferred(), calls = [];
        const noop = () => {};
        const context = {
            window: { flushRngBeforeSignOut: async () => { calls.push('save'); await gate.promise; } },
            auth: { signOut: async () => { calls.push('logout'); } }, currentUser: { uid: 'A' },
            clearPendingProfileSyncTimeout: noop, clearCloudProfileReloadTimeouts: noop,
            clearCachedProfileState: noop, closeProfileModal: noop, updateAuthUI: noop
        };
        vm.runInNewContext(source.slice(start, source.indexOf('function openLoginModal()', start)) + '\nthis.logout = logoutUser;', context);
        const logout = context.logout(); await flush(); assert.deepEqual(calls, ['save']);
        gate.resolve(); await logout; assert.deepEqual(calls, ['save', 'logout']);
        delete context.window.flushRngBeforeSignOut;
        await context.logout(); assert.deepEqual(calls, ['save', 'logout', 'logout']);
        console.log(path + ': PASS logout waits for RNG cloud save and works on pages without RNG');
    }
})().catch(error => { console.error(error); process.exitCode = 1; });
