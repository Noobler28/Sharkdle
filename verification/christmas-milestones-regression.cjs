const fs = require('node:fs');
const vm = require('node:vm');
const assert = require('node:assert/strict');
const { database } = require('./rng-account-sync-regression.cjs');
const clone = value => JSON.parse(JSON.stringify(value));
const EVENT = 'christmas-stethacanthus-2026';

function harness(file, db = database(), uid = 'A') {
    const source = fs.readFileSync(file, 'utf8');
    const section = (start, end) => source.slice(source.indexOf(start), source.indexOf(end, source.indexOf(start)));
    let profile = { uid, totalXP: 0, crateInventory: { reef: 10, christmas: 0 }, unlockedBadges: [] };
    let localSaves = 0;
    const messages = [], noop = () => {};
    const c = {
        window: {}, db, currentUser: { uid }, communityBossState: { wins: 150 }, console: { warn: noop },
        document: { getElementById: () => null },
        getCurrentProfileData: () => clone(profile),
        mergeProfilesSafely: (local, remote) => ({ ...clone(local), ...clone(remote) }),
        getCrateInventory: p => ({ reef: 0, christmas: 0, ...p.crateInventory }),
        normalizeCrateInventory: p => ({ ...p }),
        markCrateInventoryChanged: p => { p.crateInventoryUpdatedAt = Date.now(); },
        getCrateInventoryUpdatedAt: p => p.crateInventoryUpdatedAt || 0,
        getUnlockedBadgeIds: p => p.unlockedBadges || [],
        applySharkPassXpGain: (p, xp) => { p.passXp = (p.passXp || 0) + xp; },
        getSharkPassSyncPayload: p => ({ passXp: p.passXp || 0 }),
        saveUserProfileLocally: p => { profile = clone(p); localSaves++; },
        updateProfileDisplay: noop, updateProfileBadgeUI: noop, renderCratesButton: noop,
        renderCommunityBossPanel: noop, renderCratesModal: noop, updateSeasonalCrateCraftingUI: noop,
        showNotification: message => messages.push(message), openLoginModal: noop,
        getActiveSeasonalCrateId: () => 'christmas', getCrateDefinition: () => ({ name: 'Christmas Crate' }),
        isSeasonalCrateId: () => true, isSeasonalCrateThemeActive: () => false,
        crateDefinitions: { christmas: { name: 'Christmas Crate' } }
    };
    vm.createContext(c);
    vm.runInContext(section('const COMMUNITY_BOSS_EVENTS =', 'const CLADOSELACHE_PARTICIPATION_EVENT_ID') +
        section('function createCommunityBossRewards(', 'async function getCommunityBossTopContributors(') +
        section('async function claimParticipatingCommunityBossRewards(', 'async function claimCommunityBossReward(') +
        'let seasonalCrateCraftingInProgress = false, crateOpeningInProgress = false; const SEASONAL_CRATE_CRAFT_COST = 2;\n' +
        section('window.craftSeasonalCrate =', 'function getDuelStatusClass('), c);
    return { c, db, profile: () => clone(profile), localSaves: () => localSaves, messages,
        seed() { db.put(`userStats/${uid}`, profile); },
        wins: wins => { db.put(`communityEvents/${EVENT}`, { wins }); c.communityBossState = { wins }; },
        contributor: (user, wins) => db.put(`communityEvents/${EVENT}/contributors/${user}`, { uid: user, wins })
    };
}

(async () => {
    for (const file of ['script.js', 'SharkdleMobile/www/script.js']) {
        const h = harness(file); h.seed(); h.wins(150);
        await h.c.claimParticipatingCommunityBossRewards();
        assert.equal(h.localSaves(), 0, 'Noncontributors cannot claim');
        h.contributor('A', 1); h.contributor('B', 100);
        for (const [wins, crates, xp] of [[49, 0, 0], [50, 5, 10000], [99, 5, 10000], [100, 13, 25000], [149, 13, 25000], [150, 25, 50000]]) {
            h.wins(wins);
            await h.c.claimParticipatingCommunityBossRewards();
            assert.equal(h.profile().crateInventory.christmas, crates);
            assert.equal(h.profile().totalXP, xp);
            if (wins < 150) assert(!h.profile().unlockedBadges.includes('frost-anvil'));
        }
        assert(h.profile().unlockedBadges.includes('frost-anvil'));
        const stale = harness(file, h.db); // Stale browser with no local claims.
        await stale.c.claimParticipatingCommunityBossRewards();
        assert.equal(h.db.records.get('userStats/A').crateInventory.christmas, 25);
        assert.equal(stale.localSaves(), 0);

        const leader = harness(file, h.db, 'B'); leader.seed();
        await Promise.all([leader.c.claimParticipatingCommunityBossRewards(), leader.c.claimParticipatingCommunityBossRewards()]);
        assert.equal(leader.profile().crateInventory.christmas, 25, 'Champion still has a 25-crate cap');
        assert.equal(leader.profile().totalXP, 60000, 'Champion gets the extra 10,000 XP');
        assert(leader.profile().communityBossRewards[EVENT].claimedRewardIds.includes('champion-bonus'));
        await leader.c.claimParticipatingCommunityBossRewards();
        assert.equal(leader.profile().totalXP, 60000);

        const legacy = harness(file); legacy.seed(); legacy.wins(150); legacy.contributor('A', 1); legacy.contributor('B', 10);
        legacy.db.put('userStats/A', { ...legacy.profile(), totalXP: 25000, crateInventory: { reef: 10, christmas: 10 },
            communityBossRewards: { [EVENT]: { rank: 1, xp: 25000, crates: { christmas: 10 } } } });
        await legacy.c.claimParticipatingCommunityBossRewards();
        assert.equal(legacy.profile().crateInventory.christmas, 25, 'Old rank-based payouts count toward the 25-crate total');
        assert.equal(legacy.profile().totalXP, 50000);

        const parallel = harness(file); parallel.seed(); parallel.wins(150); parallel.contributor('A', 1); parallel.contributor('B', 5);
        const secondTab = harness(file, parallel.db);
        await Promise.all([parallel.c.claimParticipatingCommunityBossRewards(), secondTab.c.claimParticipatingCommunityBossRewards()]);
        assert.equal(parallel.db.records.get('userStats/A').crateInventory.christmas, 25, 'Concurrent tabs grant each milestone once');
        assert.equal(parallel.db.records.get('userStats/A').totalXP, 50000);

        const offline = harness(file); offline.seed(); offline.wins(150); offline.contributor('A', 1); offline.db.offline(true);
        await offline.c.claimParticipatingCommunityBossRewards();
        await offline.c.window.craftSeasonalCrate();
        assert.equal(offline.localSaves(), 0, 'Failed saves never mutate local balances or backups');
        assert.equal(offline.profile().crateInventory.reef, 10);
        offline.db.offline(false);
        await offline.c.window.craftSeasonalCrate();
        assert.equal(offline.profile().crateInventory.reef, 8);
        assert.equal(offline.profile().crateInventory.christmas, 1);

        const crafting = harness(file); crafting.seed();
        const otherCraftTab = harness(file, crafting.db);
        await Promise.all([crafting.c.window.craftSeasonalCrate(), otherCraftTab.c.window.craftSeasonalCrate()]);
        assert.equal(crafting.db.records.get('userStats/A').crateInventory.reef, 6);
        assert.equal(crafting.db.records.get('userStats/A').crateInventory.christmas, 2);
        crafting.db.put('userStats/A', { ...crafting.profile(), crateInventory: { reef: 1, christmas: 2 } });
        const saves = crafting.localSaves();
        await crafting.c.window.craftSeasonalCrate();
        assert.equal(crafting.localSaves(), saves, 'A stale local balance cannot spend crates missing on the server');
        assert.equal(crafting.db.records.get('userStats/A').crateInventory.reef, 1);

        const switched = harness(file); switched.seed(); switched.wins(150); switched.contributor('A', 1);
        const gate = switched.db.blockCommit();
        const pending = switched.c.claimParticipatingCommunityBossRewards();
        await gate.entered.promise;
        switched.c.currentUser = { uid: 'B' }; gate.released.resolve(); await pending;
        assert.equal(switched.localSaves(), 0, 'An account switch cannot load another player’s rewards');
        console.log(`${file}: PASS milestone boundaries, participation, champion bonus, repeat/concurrent claims, offline crafting and account switching`);
    }
})().catch(error => { console.error(error); process.exitCode = 1; });
