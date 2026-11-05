const fs = require('node:fs');
const vm = require('node:vm');
const assert = require('node:assert/strict');
const { database } = require('./rng-account-sync-regression.cjs');
const clone = value => JSON.parse(JSON.stringify(value));
function harness(file, db = database()) {
    const source = fs.readFileSync(file, 'utf8');
    const section = (start, end) => source.slice(source.indexOf(start), source.indexOf(end, source.indexOf(start)));
    let profile = { uid: 'A', totalXP: 123, pearls: 17, earnedCosmetics: [], redeemedCodes: [] };
    const storage = new Map(), messages = [], input = { value: 'sorry' };
    const noop = () => {};
    const context = {
        window: {}, console: { error: noop, warn: noop }, currentUser: { uid: 'A', email: 'a@example.com' }, db,
        firebase: { firestore: { FieldValue: { serverTimestamp: () => 123 } } },
        document: { getElementById: () => input },
        localStorage: { getItem: key => storage.get(key) || null, setItem: (key, value) => storage.set(key, value), removeItem: key => storage.delete(key) },
        normalizeStoredDateValue: value => String(value || ''), getLocalDateKey: () => '2026-11-02',
        getCurrentProfileData: () => clone(profile), saveUserProfileLocally: data => { profile = clone(data); },
        mergeProfilesSafely: (local, remote) => ({ ...clone(local), ...clone(remote),
            totalXP: Math.max(local.totalXP || 0, remote.totalXP || 0),
            earnedCosmetics: [...new Map([...(local.earnedCosmetics || []), ...(remote.earnedCosmetics || [])].map(item => [item.imagePath, item])).values()],
            redeemedCodes: [...new Set([...(local.redeemedCodes || []), ...(remote.redeemedCodes || [])])] }),
        applySharkPassXpGain: (data, xp) => { data.passXp = (data.passXp || 0) + xp; },
        getSharkPassSyncPayload: data => ({ passXp: data.passXp || 0 }),
        normalizeCrateInventory: data => data || {}, getCrateInventoryUpdatedAt: () => 0,
        getCrateInventory: data => ({ reef: 0, ...data.crateInventory }),
        crateDefinitions: { reef: { name: 'Cosmetic Crate' } }, getCrateDefinition: () => ({ name: 'Cosmetic Crate' }),
        markCrateInventoryChanged: data => { data.crateInventoryUpdatedAt = 123; },
        isSeasonalCrateId: () => false, isSeasonalCrateThemeActive: () => false,
        showRedeemMessage: (message, success) => messages.push({ message, success }),
        loadUserProfile: noop, loadEarnedCosmetics: noop, loadAvailablePFPs: noop,
        renderCratesButton: noop, renderCratesModal: noop, updateSeasonalCratePanels: noop,
        alert: noop, showNotification: noop
    };
    vm.createContext(context);
    vm.runInContext([
        section('function getPearlCount(', 'function getClaimedSocialRewards('),
        section('function getLastSpinWheelDateStorageKey(', 'function resolveSpinWheelReward('),
        section('const redeemCodes = {', 'function applyCodeCrateRewards('),
        section('function applyCodeCrateRewards(', '// Keep track of redeemed codes'),
        section('function getRedeemedCodes()', 'const xpIncrements ='),
        section('async function redeemCode(', 'function showRedeemMessage(')
    ].join('\n'), context);
    return { context, input, storage, messages, db, profile: () => profile,
        claim: code => { input.value = code; return context.redeemCode(); },
        switchUser: uid => { context.currentUser = { uid, email: uid + '@example.com' }; profile = { uid, totalXP: 0, pearls: 0, earnedCosmetics: [], redeemedCodes: [] }; storage.clear(); }
    };
}

(async () => {
    for (const file of ['script.js', 'SharkdleMobile/www/script.js']) {
        const h = harness(file);
        h.db.put('userStats/A', clone(h.profile()));
        h.db.offline(true);
        await h.claim('sorry');
        assert.equal(h.profile().totalXP, 123, 'A failed redemption must not credit XP locally before its claim is saved');
        for (let retry = 0; retry < 20; retry++) await h.claim('SORRY');
        assert.equal(h.profile().totalXP, 123);
        h.db.offline(false);
        await Promise.all(Array.from({ length: 20 }, () => h.claim('SORRY')));
        assert.equal(h.db.records.get('userStats/A').totalXP, 5123);
        assert(h.db.records.get('userStats/A').redeemedCodes.includes('SORRY'));
        const other = harness(file, h.db);
        await Promise.all([h.claim(' lsfsw '), other.claim('LsFsW')]);
        const saved = h.db.records.get('userStats/A');
        assert.equal(saved.totalXP, 7123); assert.equal(saved.pearls, 267);
        assert.equal(saved.earnedCosmetics.filter(item => item.name === 'LSFSW Partner').length, 1);
        assert(saved.redeemedCodes.includes('LSFSW'));
        assert(h.db.records.has('userStats/A/redeemedCodes/SORRY'));
        assert(h.db.records.has('userStats/A/redeemedCodes/LSFSW'));
        h.db.put('userStats/A', { ...saved, redeemedCodes: [] });
        const staleProfile = harness(file, h.db);
        await staleProfile.claim('SORRY');
        assert.equal(h.db.records.get('userStats/A').totalXP, 7123, 'A stale profile overwrite must not erase the immutable claim');
        other.storage.set('redeemedCodes', '{broken');
        await other.claim('LSFSW');
        assert.equal(h.db.records.get('userStats/A').pearls, 267);
        const switching = harness(file);
        switching.db.put('userStats/A', clone(switching.profile()));
        const gate = switching.db.blockCommit();
        const pending = switching.claim('SORRY'); await gate.entered.promise;
        switching.switchUser('B'); gate.released.resolve(); await pending;
        assert.equal(switching.profile().uid, 'B'); assert.equal(switching.profile().totalXP, 0);
        assert.equal(switching.storage.has('redeemedCodes'), false);
        assert.equal(switching.db.records.has('userStats/B'), false);
        const interrupted = harness(file);
        interrupted.db.put('userStats/A', clone(interrupted.profile()));
        const failedCommit = interrupted.db.blockCommit();
        const interruptedClaim = interrupted.claim('LSFSW'); await failedCommit.entered.promise;
        interrupted.db.offline(true); failedCommit.released.resolve(); await interruptedClaim;
        assert.equal(interrupted.profile().totalXP, 123);
        assert.equal(interrupted.db.records.get('userStats/A').totalXP, 123);
        assert.equal(interrupted.db.records.has('userStats/A/redeemedCodes/LSFSW'), false);
        interrupted.db.offline(false); await interrupted.claim('LSFSW');
        assert.equal(interrupted.db.records.get('userStats/A').totalXP, 2123);
        const multiple = harness(file);
        multiple.db.put('userStats/A', clone(multiple.profile()));
        const codes = ['SHARKDLE', 'UPDATE1', 'UPDATE2', 'TIKTOK2026', 'INSTAGRAM2026', 'SORRY', 'LSFSW'];
        await Promise.all(codes.map(code => multiple.claim(code)));
        for (const code of codes) await multiple.claim(code); // Retry any exhausted transaction conflicts.
        assert.equal(multiple.db.records.get('userStats/A').totalXP, 16123);
        for (const code of codes) assert(multiple.db.records.has('userStats/A/redeemedCodes/' + code));
        const thanks = harness(file); thanks.db.put('userStats/A', clone(thanks.profile()));
        thanks.db.offline(true); await thanks.claim('ThankYou100');
        assert.equal(thanks.storage.has('dailySpinBonusSpins_A'), false, 'Failed redemption must not cache unearned bonus spins');
        thanks.db.offline(false);
        const secondThanks = harness(file, thanks.db);
        await Promise.all([thanks.claim('ThankYou100'), secondThanks.claim('thankyou100')]);
        const thankSave = thanks.db.records.get('userStats/A');
        assert.equal(thankSave.totalXP, 10123); assert.equal(thankSave.pearls, 1017);
        assert.equal(thankSave.crateInventory.reef, 5); assert.equal(thankSave.dailySpinBonusSpins, 3);
        const winner = thanks.profile().dailySpinBonusSpins === 3 ? thanks : secondThanks;
        const spinProfile = clone(thankSave);
        assert.equal(winner.context.hasUnlockedDailySpinToday(spinProfile), false);
        for (let spin = 0; spin < 3; spin++) {
            assert.equal(winner.context.canUseDailySpin(spinProfile), true, 'All three bonus spins must work without a win');
            winner.context.markDailySpinUsed(spinProfile);
        }
        assert.equal(winner.context.canUseDailySpin(spinProfile), false);
        assert.equal(spinProfile.lastSpinWheelDate, undefined, 'Bonus spins must not consume the normal daily spin');
        spinProfile.dailySpinWinDate = '2026-11-02';
        assert.equal(winner.context.canUseDailySpin(spinProfile), true, 'A later win still unlocks the normal daily spin');
        winner.context.markDailySpinUsed(spinProfile);
        assert.equal(winner.context.canUseDailySpin(spinProfile), false);
        await thanks.claim('THANKYOU100'); assert.equal(thanks.db.records.get('userStats/A').dailySpinBonusSpins, 3);
        const actualSpin = harness(file); actualSpin.db.put('userStats/A', clone(actualSpin.profile()));
        await actualSpin.claim('ThankYou100');
        const source = fs.readFileSync(file, 'utf8');
        const spinSection = source.slice(source.indexOf('async function spinDailyWheel('), source.indexOf('function collectAllUnlockablePfps('));
        const reward = { id: 'xp', type: 'xp' };
        const noop = () => {};
        const ui = { style: {}, classList: { add: noop, remove: noop }, innerHTML: '' };
        Object.assign(actualSpin.context, {
            document: { getElementById: () => ui }, setTimeout: fn => fn(),
            updateSpinWheelUI: noop, updateIndexStats: noop, getSpinWheelRewards: () => [reward],
            pickSpinWheelReward: () => reward, getSpinWheelSliceGeometry: () => [{}],
            normalizeSpinWheelDegrees: value => value % 360, getSpinWheelRotationForSlice: () => 0,
            getStreakShieldCount: () => 0,
            grantSpinWheelReward: profileData => ({ profileData: { ...profileData, totalXP: profileData.totalXP + 50,
                earnedCosmetics: [], unlockedBadges: ['starter'], unlockedCardThemes: ['default'] }, message: '50 XP' })
        });
        vm.runInContext('let spinWheelSpinning = false, spinWheelRotation = 0;\n' + spinSection, actualSpin.context);
        for (let spin = 0; spin < 3; spin++) await actualSpin.context.spinDailyWheel();
        assert.equal(actualSpin.db.records.get('userStats/A').dailySpinBonusSpins, 0);
        assert.equal(actualSpin.db.records.get('userStats/A').totalXP, 10273);
        assert.equal(actualSpin.db.records.get('userStats/A').dailySpinWinDate, '', 'No-win bonus spins must save a defined win date');
        assert.equal(actualSpin.db.records.get('userStats/A').lastSpinWheelDate, '');
        await actualSpin.context.spinDailyWheel();
        assert.equal(actualSpin.db.records.get('userStats/A').totalXP, 10273, 'A fourth bonus spin is blocked');
        const permissions = harness(file);
        permissions.context.db = { collection: () => ({ doc: () => ({ collection: () => ({ doc: () => ({}) }) }) }),
            runTransaction: async () => { throw Object.assign(new Error('blocked'), { code: 'permission-denied' }); } };
        await permissions.claim('ThankYou100');
        assert.match(permissions.messages.at(-1).message, /database permissions/);
        assert.equal(permissions.profile().totalXP, 123);
        const unverified = harness(file); unverified.context.currentUser.emailVerified = false;
        await unverified.claim('ThankYou100');
        assert.match(unverified.messages.at(-1).message, /verify your email/);
        assert.equal(unverified.db.records.size, 0);
        const savedWithUiFailure = harness(file); savedWithUiFailure.db.put('userStats/A', clone(savedWithUiFailure.profile()));
        savedWithUiFailure.context.saveUserProfileLocally = () => { throw new Error('cache unavailable'); };
        await savedWithUiFailure.claim('ThankYou100');
        assert.match(savedWithUiFailure.messages.at(-1).message, /redeemed and saved/);
        assert.equal(savedWithUiFailure.db.records.get('userStats/A').totalXP, 10123);
        console.log(file + ': PASS offline redemption cannot multiply XP, 20 rapid duplicate claims, concurrent devices, LSFSW XP/pearls/icon, malformed cache and account switching during commit');
    }
})().catch(error => { console.error(error); process.exitCode = 1; });
