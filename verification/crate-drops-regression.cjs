const fs = require('node:fs');
const vm = require('node:vm');
const assert = require('node:assert/strict');

const clone = value => JSON.parse(JSON.stringify(value));
const noop = () => {};

(async () => {
    for (const file of ['script.js', 'SharkdleMobile/www/script.js']) {
        const source = fs.readFileSync(file, 'utf8');
        const section = (start, end) => {
            const a = source.indexOf(start), b = source.indexOf(end, a);
            assert(a >= 0 && b > a, `Missing section: ${start}`);
            return source.slice(a, b);
        };
        let profile = { uid: 'player', crateInventory: { reef: 0 }, crateInventoryUpdatedAt: 1 };
        let rolls = [], event = null, notifications = [], retries = 0, failSave = false;
        const c = {
            currentUser: { uid: 'player' }, console: { warn: noop },
            Math: { ...Math, random: () => { assert(rolls.length, 'Unexpected random roll'); return rolls.shift(); } },
            getCurrentProfileData: () => clone(profile), getBestLocalProfile: () => clone(profile),
            getProfileTimestampMs: value => Number(value) || 0,
            getActiveSeasonalCrateId: () => event,
            getCrateDefinition: id => ({ name: { reef: 'Cosmetic Crate', christmas: 'Christmas Crate', halloween: 'Halloween Crate' }[id] }),
            persistCrateProfileUpdate: async value => { profile = clone(value); if (failSave) throw Error('offline'); },
            scheduleRemoteProfileSync: () => retries++,
            showNotification: message => notifications.push(message), renderCratesButton: noop, renderCratesModal: noop
        };
        // Keep native Math helpers for inventory normalization/timestamps.
        c.Math.max = Math.max;
        vm.createContext(c);
        vm.runInContext(source.match(/const CRATE_DROP_CHANCE = [^;]+;/)[0] + '\n' +
            source.match(/const EVENT_CRATE_DROP_CHANCE = [^;]+;/)[0] + '\n' +
            section('function normalizeCrateInventory(', 'function getCrateInventoryFromProfileOrInventory(') +
            section('function getCrateInventory(profileData', 'function getStreakShieldCount(') +
            section('function preserveNewerLocalCrateInventory(', 'function retireSummerCrates(') +
            section('function maybeAwardCrateDrop(', 'window.openCratesModal ='), c);

        c.currentUser = null;
        assert.equal(c.maybeAwardCrateDrop(), false);
        c.currentUser = { uid: 'player' };
        rolls = [0.5]; assert.equal(c.maybeAwardCrateDrop(), false);
        assert.equal(notifications.length, 0);
        rolls = [0.499999]; assert.equal(c.maybeAwardCrateDrop(), true);
        assert.equal(profile.crateInventory.reef, 1);
        assert.equal(rolls.length, 0, 'No seasonal roll when no event is active');

        for (event of ['christmas', 'halloween']) {
            rolls = [0, 0.149999]; assert.equal(c.maybeAwardCrateDrop('infinite win'), true);
            assert.equal(profile.crateInventory[event], 1);
            assert(notifications.at(-1).startsWith(c.getCrateDefinition(event).name));
            const before = profile.crateInventory.reef;
            rolls = [0, 0.15]; c.maybeAwardCrateDrop();
            assert.equal(profile.crateInventory.reef, before + 1);
        }
        // Exhaust the probability grid: 50% drops; 15% of drops are event crates.
        profile = { uid: 'player', crateInventory: {}, crateInventoryUpdatedAt: 1 };
        event = 'christmas';
        for (let drop = 0; drop < 100; drop++) {
            for (let seasonal = 0; seasonal < 100; seasonal++) {
                rolls = drop < 50 ? [drop / 100, seasonal / 100] : [drop / 100];
                c.maybeAwardCrateDrop();
                assert.equal(rolls.length, 0);
            }
        }
        assert.equal(profile.crateInventory.christmas, 750);
        assert.equal(profile.crateInventory.reef, 4250);
        failSave = true; rolls = [0, 0]; c.maybeAwardCrateDrop();
        await new Promise(setImmediate);
        assert.equal(retries, 1, 'Failed cloud saves schedule a retry and retain the local reward');
        assert.equal(profile.crateInventory.christmas, 751);
        failSave = false;

        // Execute the real sync completion code with inventory changes at each await.
        const completion = section('        // Retain inventory changed while this sync was in progress.', '        localStorage.setItem("claimedAchievements", JSON.stringify(mergedClaimedAchievements));');
        for (const phase of ['before-write', 'stats-write', 'full-profile-write']) {
            for (const balance of [0, 4]) { // Protect both openings (lower balance) and drops.
                profile = { uid: 'player', crateInventory: { reef: 2 }, crateInventoryUpdatedAt: 10 };
                c.mergedProfile = clone(profile); c.stats = clone(profile);
                const change = () => { profile.crateInventory.reef = balance; profile.crateInventoryUpdatedAt = 20; };
                if (phase === 'before-write') change();
                c.statsRef = { set: async stats => {
                    if (phase === 'before-write') assert.equal(stats.crateInventory.reef, balance);
                    if (phase === 'stats-write') change();
                } };
                c.syncFullUserProfileToFirebase = async () => { if (phase === 'full-profile-write') change(); };
                c.saveUserProfileLocally = value => { profile = clone(value); };
                const before = retries;
                await vm.runInContext(`(async () => { ${completion} })()`, c);
                assert.equal(profile.crateInventory.reef, balance, `${phase}: preserve the latest inventory`);
                assert.equal(profile.crateInventoryUpdatedAt, 20);
                if (phase !== 'before-write') assert.equal(retries, before + 1, 'Repair cloud state after an overlapping save');
            }
        }
        const otherAccount = { uid: 'other', crateInventory: { reef: 9 }, crateInventoryUpdatedAt: 1 };
        assert.equal(c.preserveNewerLocalCrateInventory(otherAccount), false);
        assert.equal(otherAccount.crateInventory.reef, 9);
        console.log(`${file}: drop probabilities, seasonal rewards, retry and sync race checks passed`);
    }
})().catch(error => { console.error(error); process.exitCode = 1; });
