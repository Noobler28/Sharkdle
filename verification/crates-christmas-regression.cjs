const fs = require('node:fs');
const vm = require('node:vm');
const assert = require('node:assert/strict');

function harness(file) {
    const source = fs.readFileSync(file, 'utf8');
    const section = (start, end) => source.slice(source.indexOf(start), source.indexOf(end, source.indexOf(start)));
    const noop = () => {};
    const profile = { crateInventory: { reef: 3 }, cratesOpened: 0 };
    const timers = [], buttons = [];
    let saves = 0, failSave = false, failPresentation = false, instant = false, overlay = false;
    const context = {
        console: { warn: noop }, currentUser: { uid: 'test' }, window: {},
        document: { getElementById: () => ({ classList: { add: noop, remove: noop } }) },
        getCurrentProfileData: () => profile, getCrateInventory: p => ({ ...p.crateInventory }),
        normalizeCrateInventory: p => p, markCrateInventoryChanged: noop,
        getOpenedCrateCount: p => p.cratesOpened, pickCrateRewardRarity: () => 'common',
        getCrateRewardsByRarity: () => [{ rarity: 'common' }], getCratePoolById: () => [],
        getCratesSinceLegendary: () => 0, grantCrateReward: () => ({ duplicateReward: false }),
        updateSeasonalCrateCraftingUI: noop, saveUserProfileLocally: noop,
        persistCrateProfileUpdate: async () => { saves++; if (failSave) throw Error('offline'); },
        renderCratesButton: () => buttons.push(context.locked()), renderCratesModal: noop,
        getCrateInstantOpenEnabled: () => instant,
        finalizeCrateRewardPresentation: () => { if (failPresentation) throw Error('presentation'); },
        openCrateUnboxOverlay: () => { overlay = true; }, closeCrateUnboxOverlay: () => { overlay = false; },
        getCrateUnboxRevealDelay: () => 1, getCrateUnboxRevealHoldDelay: () => 1,
        showCrateOverlayReward: noop, setTimeout: resolve => timers.push(resolve),
        showNotification: noop, setCratesModalTab: noop
    };
    vm.createContext(context);
    vm.runInContext('let crateOpeningInProgress = false; let seasonalCrateCraftingInProgress = false;\n' +
        section('function openCratesModal()', 'function pickCrateReward(') +
        section('async function openCrate(', 'function maybeAwardCrateDrop(') +
        '\nfunction locked() { return crateOpeningInProgress; }', context);
    return { context, profile, buttons, saves: () => saves, overlay: () => overlay,
        failSave: value => { failSave = value; }, instant: value => { instant = value; },
        failPresentation: value => { failPresentation = value; },
        tick: async () => { assert(timers.length); timers.shift()(); await new Promise(setImmediate); }
    };
}

(async () => {
    for (const file of ['script.js', 'SharkdleMobile/www/script.js']) {
        const h = harness(file), c = h.context;
        const pending = c.openCrate();
        await new Promise(setImmediate);
        assert(c.locked()); assert(h.overlay());
        c.closeCratesModal(); c.openCratesModal();
        await c.openCrate();
        assert.equal(h.saves(), 1, 'Reopening menus must not permit overlapping crate openings');
        await h.tick(); await h.tick();
        assert(c.locked(), 'Keep the lock until the previous overlay closes');
        await c.openCrate(); assert.equal(h.saves(), 1);
        await h.tick(); await pending;
        assert(!c.locked()); assert(!h.overlay()); assert.equal(h.buttons.at(-1), false);
        h.failSave(true); await c.openCrate();
        assert.equal(h.profile.crateInventory.reef, 2, 'Failed saves restore the spent crate');
        assert(!c.locked());
        h.failSave(false); h.instant(true); await c.openCrate();
        assert.equal(h.profile.crateInventory.reef, 1); assert(!c.locked());
        h.failPresentation(true);
        await assert.rejects(c.openCrate(), /presentation/);
        assert(!c.locked(), 'Presentation errors must release the opening lock');

        const source = fs.readFileSync(file, 'utf8');
        const events = source.slice(source.indexOf('const COMMUNITY_BOSS_EVENTS ='), source.indexOf('const CLADOSELACHE_PARTICIPATION_EVENT_ID'));
        const selector = source.slice(source.indexOf('function getCurrentCommunityBossEvent('), source.indexOf('function getCommunityBossWins('));
        const eventContext = { createCommunityBossRewards: () => ({}), createCommunityBossMilestoneRewards: () => [] };
        vm.createContext(eventContext);
        vm.runInContext(events + selector + '\nfunction eventAt(date) { return getCurrentCommunityBossEvent(Date.parse(date)); }', eventContext);
        const event = eventContext.eventAt('2026-11-02T12:00:00Z');
        assert.equal(event.id, 'christmas-stethacanthus-2026');
        assert.equal(event.targetWins, 500); assert.equal(event.crateId, 'christmas');
        assert.deepEqual(Array.from(event.rewards, reward => reward.goal), [50, 100, 150, 200, 300, 400, 500]);
        assert(event.endMs > Date.parse('2026-11-02T12:00:00Z'));
        assert.equal(eventContext.eventAt('2026-10-31').season, 'halloween');
        console.log(`${file}: crate lifecycle and Christmas Part 1 checks passed`);
    }
})().catch(error => { console.error(error); process.exitCode = 1; });
