const fs = require('node:fs');
const vm = require('node:vm');
const assert = require('node:assert/strict');

function harness(path) {
    const timers = new Map();
    const events = {};
    const storage = new Map();
    let nextTimer = 1;
    let failWrites = false;
    const context = {
        window: { addEventListener: (name, callback) => { events[name] = callback; } },
        document: {
            getElementById: () => null, querySelector: () => null, querySelectorAll: () => [],
            addEventListener: (name, callback) => { events[name] = callback; }
        },
        localStorage: {
            getItem: key => storage.get(key) || null,
            setItem: (key, value) => {
                if (failWrites) throw new Error('Storage quota exceeded');
                storage.set(key, value);
            }
        },
        console: { warn() {}, log() {} },
        setTimeout: (callback, delay) => { const id = nextTimer++; timers.set(id, { callback, delay }); return id; },
        clearTimeout: id => timers.delete(id)
    };
    let source = fs.readFileSync(path, 'utf8');
    source = source.replace('    window.initRngMode = initRngMode;', `
        window.initRngMode = initRngMode;
        window.test = {
            setPlayer: (profile) => { player = { ...createDefaultPlayer(), ...profile }; },
            player: () => player,
            pool: (pool) => { rollPool = pool; },
            saveLocalProfile, loadLocalProfile, scheduleLocalProfileSave, flushLocalProfileSave,
            bindLocalProfileSaveFlush, mergeRngProfilesForHydration, normalizeStoredCollectionRarities,
            buyPotion, usePotion, performRoll, hydrateRngProfileFromFirebase, syncRngProfileToFirebase,
            dirty: () => localSaveDirty,
            cloudDirty: () => rngCloudSaveDirty,
            mockRoll: () => {
                let count = 0;
                GameFx.resumeAudio = GameFx.pulseRollButton = () => {};
                updateRollButtonState = maybeAwardRollinBadge = updateRngDailyQuestsForRolls = consumeRollActionEffects = scheduleCloudSync = () => {};
                getPrestigeMultiRollCount = () => 32;
                createRollActionContext = () => ({});
                rollForShark = () => {
                    player.rolls++;
                    const oneIn = ++count === 28 ? 617e9 : 44e9;
                    player.bestOneIn = Math.max(player.bestOneIn, oneIn);
                    return { name: 'shark' + count, oneIn, coinReward: 1 };
                };
                getRollRevealShark = (_rolls, best) => best;
                animateRoll = () => new Promise(() => {});
            },
            mockHydration: (read) => {
                ensureRngLeaderboardServices = () => true;
                getRngCurrentUser = () => ({ uid: 'test' });
                readRngProfileFromFirebase = read;
                updateAllUi = updateSettingsUi = scheduleRngCloudProfileSync = () => {};
            },
            mockCloud: (commit) => {
                ensureRngLeaderboardServices = () => true;
                getRngCurrentUser = () => ({ uid: 'test' });
                rngLeaderboardDb = { collection: () => ({ doc: () => ({ collection: () => ({ doc: () => ({}) }) }) }), batch: () => ({ set() {}, commit }) };
                rngCloudSaveDirty = true;
            }
        };`);
    context.firebase = { firestore: { FieldValue: { serverTimestamp: () => 1 } } };
    vm.runInNewContext(source, context, { filename: path });
    return {
        api: context.window.test, storage, timers, events,
        failWrites: value => { failWrites = value; },
        runSave: () => {
            const pending = [...timers.entries()].find(([, timer]) => timer.delay === 250);
            assert(pending, 'A local save must be queued within 250ms');
            timers.delete(pending[0]); pending[1].callback();
        }
    };
}

(async () => {
    for (const path of ['Minigames/SharkRNG/rng-mode.js', 'SharkdleMobile/www/Minigames/SharkRNG/rng-mode.js']) {
        let h = harness(path), t = h.api;
        t.setPlayer({ coins: 1e12 });
        t.buyPotion('coin', 1);
        const boughtCoins = t.player().coins;
        assert(boughtCoins < 1e12);
        h.runSave(); t.loadLocalProfile();
        assert.equal(t.player().potions.coin, 1);
        assert.equal(t.player().coins, boughtCoins);
        t.usePotion('coin'); h.runSave(); t.loadLocalProfile();
        assert.equal(t.player().potions.coin, 0);
        assert(t.player().activeEffects.coin.remaining > 0);

        t.bindLocalProfileSaveFlush();
        t.player().coins = 123; t.scheduleLocalProfileSave(); h.events.pagehide();
        assert.equal(JSON.parse(h.storage.get('sharkRngProfile')).coins, 123);
        h.failWrites(true); t.player().coins = 456;
        assert.equal(t.saveLocalProfile(), false); assert(t.dirty()); assert.equal(t.player().coins, 456);
        h.failWrites(false); assert.equal(t.saveLocalProfile(), true); assert(!t.dirty());

        t.pool([{ name: 'Test shark', oneIn: 44e9, tier: 'Omniversal', baseTier: 'Omniversal' }]);
        t.setPlayer({ bestOneIn: 617e9, collection: { 'Test shark': { oneIn: 617e9, tier: 'Omniversal', count: 1 } } });
        t.saveLocalProfile(); t.loadLocalProfile();
        assert.equal(t.player().bestOneIn, 617e9);
        assert.equal(t.player().collection['Test shark'].oneIn, 617e9);
        t.setPlayer({ bestOneIn: 617e9, collection: {} }); t.normalizeStoredCollectionRarities();
        assert.equal(t.player().bestOneIn, 617e9);

        const merged = t.mergeRngProfilesForHydration(
            { rngStateUpdatedAtMs: 20, rngXpCurveVersion: 3, coins: 10, potions: { coin: 0 }, activeEffects: { coin: { remaining: 25 } }, bestOneIn: 617e9 },
            { rngStateUpdatedAtMs: 10, rngXpCurveVersion: 3, coins: 100, potions: { coin: 1 }, bestOneIn: 44e9 }
        );
        assert.equal(merged.coins, 10); assert.equal(merged.potions.coin, 0); assert.equal(merged.activeEffects.coin.remaining, 25); assert.equal(merged.bestOneIn, 617e9);

        h = harness(path); t = h.api; t.mockRoll();
        t.performRoll(); // The animation deliberately never completes.
        const duringReveal = JSON.parse(h.storage.get('sharkRngProfile'));
        assert.equal(duringReveal.rolls, 32); assert.equal(duringReveal.bestOneIn, 617e9);

        h = harness(path); t = h.api;
        t.setPlayer({ coins: 100, bestOneIn: 44e9 }); t.saveLocalProfile();
        let finishRead;
        t.mockHydration(() => new Promise(resolve => { finishRead = resolve; }));
        const hydration = t.hydrateRngProfileFromFirebase();
        t.player().coins = 10; t.player().bestOneIn = 617e9; t.scheduleLocalProfileSave();
        finishRead({ coins: 100, bestOneIn: 44e9, rngXpCurveVersion: 3 });
        await hydration;
        assert.equal(t.player().coins, 10); assert.equal(t.player().bestOneIn, 617e9);

        h = harness(path); t = h.api;
        let finishWrite;
        let commits = 0;
        t.mockCloud(() => { commits++; return new Promise(resolve => { finishWrite = resolve; }); });
        t.scheduleLocalProfileSave();
        const writing = t.syncRngProfileToFirebase();
        t.player().coins = 10; t.scheduleLocalProfileSave();
        assert.equal(await t.syncRngProfileToFirebase({ force: true }), false);
        assert.equal(commits, 1);
        finishWrite(); await writing;
        assert(t.cloudDirty(), 'Changes made during a cloud write need a follow-up save');
        console.log(path + ': PASS purchases/use/reload, page exit, storage failure, 617B record, newest potion state, save before reveal, hydration race, cloud write race');
    }
})().catch(error => { console.error(error); process.exitCode = 1; });
