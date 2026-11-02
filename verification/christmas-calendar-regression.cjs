const fs = require('node:fs');
const vm = require('node:vm');
const assert = require('node:assert/strict');
const { database } = require('./rng-account-sync-regression.cjs');
const clone = value => JSON.parse(JSON.stringify(value));
const flush = () => new Promise(setImmediate);

function harness(file, base = database(), uid = 'A') {
    let now = Date.UTC(2026, 11, 5, 12), profile = { uid, totalXP: 50, pearls: 25, crateInventory: { reef: 4, christmas: 0 } };
    let ready, saves = 0;
    const messages = [], noop = () => {};
    const collection = path => ({
        doc: id => reference(path + '/' + id),
        async get() {
            if (isOffline) throw Error('offline');
            return { docs: [...base.records].filter(([key]) => key.startsWith(path + '/') && key.split('/').length === path.split('/').length + 1)
                .map(([key, value]) => ({ id: key.split('/').at(-1), data: () => clone(value) })) };
        }
    });
    const reference = path => ({ ...base.collection(path.split('/').slice(0, -1).join('/')).doc(path.split('/').at(-1)),
        collection: name => collection(path + '/' + name),
        onSnapshot(callback) { callback({ data: () => clone(base.records.get(path)) }); }
    });
    let isOffline = false;
    const db = { collection, runTransaction: callback => base.runTransaction(tx => callback({ get: target => tx.get(target),
        set: (target, value, options) => tx.set(target, options?.merge ? { ...(base.records.get(target.path) || {}), ...value } : value) })) };
    const sprite = { style: {} }, paragraph = { textContent: '' };
    const reveal = { hidden: true, innerHTML: '', scrollIntoView: noop, querySelector: selector => selector === 'p' ? paragraph : sprite };
    const elements = { 'christmas-present-reveal': reveal, 'admin-christmas-part': { value: '2' },
        'admin-christmas-day': { value: '10' }, 'admin-christmas-status': { textContent: '' } };
    const c = { window: { matchMedia: () => ({ matches: true }) }, currentUser: { uid }, db,
        Date: class extends Date { static now() { return now; } },
        document: { addEventListener: (name, fn) => { if (name === 'DOMContentLoaded') ready = fn; },
            getElementById: id => elements[id] || null, querySelectorAll: () => [], querySelector: () => null },
        console: { warn: noop }, setInterval: noop, setTimeout: fn => fn(),
        firebase: { firestore: { FieldValue: { serverTimestamp: () => 123 } } },
        isDeveloperUid: id => id === 'admin',
        getCurrentProfileData: () => clone(profile), mergeProfilesSafely: (local, remote) => ({ ...local, ...remote }),
        getCrateInventory: p => ({ reef: 0, christmas: 0, ...p.crateInventory }),
        markCrateInventoryChanged: p => { p.crateInventoryUpdatedAt = now; },
        getCrateInventoryUpdatedAt: p => p.crateInventoryUpdatedAt || 0,
        getPearlCount: p => p.pearls || 0, getPearlBalanceUpdatedAt: p => p.pearlBalanceUpdatedAt || 0,
        setPearlCount: (p, count) => { p.pearls = count; p.pearlBalanceUpdatedAt = now; },
        applySharkPassXpGain: (p, xp) => { p.passXp = (p.passXp || 0) + xp; }, getSharkPassSyncPayload: p => ({ passXp: p.passXp || 0 }),
        saveUserProfileLocally: p => { profile = clone(p); saves++; }, updateHomeV3Sidebar: noop, renderCratesButton: noop,
        renderCommunityBossPanel: noop, openCommunityBossEventModal: noop, openLoginModal: () => messages.push('login'),
        showNotification: message => messages.push(message)
    };
    vm.createContext(c); vm.runInContext(fs.readFileSync(file, 'utf8'), c);
    return { c, api: c.window.SharkdleChristmas, base, reveal, paragraph, elements, messages, profile: () => profile, saves: () => saves,
        date: iso => { now = Date.parse(iso); }, offline: value => { isOffline = value; base.offline(value); },
        async start(part = 2) { base.put('globalConfig/christmasEvent', { part }); ready(); await flush(); },
        seed() { base.put('userStats/' + uid, profile); } };
}

(async () => {
    for (const file of ['christmas-event.js', 'SharkdleMobile/www/christmas-event.js']) {
        const h = harness(file); h.seed(); await h.start();
        assert.equal(h.api.dayAt(Date.UTC(2026, 10, 30, 23, 59, 59)), 0);
        assert.equal(h.api.dayAt(Date.UTC(2026, 11, 1)), 1);
        assert.equal(h.api.dayAt(Date.UTC(2026, 11, 25, 23, 59, 59)), 25);
        assert.equal(h.api.dayAt(Date.UTC(2026, 11, 26)), 0);
        assert.equal(h.api.daysLeft(Date.UTC(2026, 11, 25)), 0);
        assert.equal(h.api.statusFor(5), 'win-needed'); assert.equal(h.api.statusFor(6), 'locked');
        await h.api.openGift(5); assert.equal(h.saves(), 0, 'A gift cannot open before a win');
        await h.api.recordWin('daily'); assert.equal(h.api.statusFor(5), 'ready');
        assert(h.base.records.has('userStats/A/christmasCalendarWins/5'));
        await Promise.all([h.api.openGift(5), h.api.openGift(5)]);
        assert.equal(h.profile().pearls, 125); assert.equal(h.profile().totalXP, 550);
        assert.equal(h.profile().crateInventory.christmas, 1);
        assert.equal(h.api.statusFor(5), 'opened'); assert(h.paragraph.textContent.includes('Gift saved!'));
        assert.equal(h.base.records.get('userStats/A').crateInventory.reef, 4);
        assert.equal(h.base.records.get('userStats/A').uid, 'A');
        await h.api.openGift(5); assert.equal(h.profile().totalXP, 550, 'Repeated clicks cannot award a second gift');
        h.date('2026-12-06T00:00:00Z'); assert.equal(h.api.statusFor(6), 'win-needed');
        await h.api.recordWin('infinite');
        h.date('2026-12-07T00:00:00Z'); assert.equal(h.api.statusFor(6), 'ready', 'Earned gifts can be claimed later');
        await h.api.openGift(6); assert.equal(h.profile().crateInventory.christmas, 1);
        assert.equal(h.profile().totalXP, 1050); assert.equal(h.profile().pearls, 225);
        h.date('2026-12-26T00:00:00Z'); assert.equal(h.api.statusFor(7), 'ended');
        assert.equal((h.api.markup().match(/data-calendar-day=/g) || []).length, 25);

        const offline = harness(file); offline.seed(); await offline.start(); await offline.api.recordWin('infinite');
        offline.offline(true); await offline.api.openGift(5);
        assert.equal(offline.saves(), 0, 'Offline claim failures leave local rewards unchanged');
        assert(!offline.base.records.has('userStats/A/christmasCalendarClaims/5'));
        offline.offline(false); await offline.api.openGift(5); assert.equal(offline.profile().totalXP, 550);

        const concurrent = harness(file); concurrent.seed(); await concurrent.start(); await concurrent.api.recordWin('daily');
        const second = harness(file, concurrent.base); await second.start();
        await Promise.all([concurrent.api.openGift(5), second.api.openGift(5)]);
        assert.equal(concurrent.base.records.get('userStats/A').totalXP, 550, 'Two browsers cannot claim the same date twice');

        const preview = harness(file, database(), 'admin'); preview.seed(); await preview.start(1);
        preview.date('2026-11-02T00:00:00Z'); preview.api.preview('2');
        assert.equal(preview.api.activePart(), 2); assert.equal(preview.api.statusFor(10), 'win-needed');
        preview.api.testWin(); await preview.api.openGift(10);
        assert(preview.paragraph.textContent.includes('Preview only'));
        assert.equal(preview.api.statusFor(10), 'opened', 'Preview gifts must stay unboxed after opening');
        assert.equal(preview.saves(), 0); assert(!preview.base.records.has('userStats/admin/christmasCalendarClaims/10'));
        assert.equal(preview.base.records.get('globalConfig/christmasEvent').part, 1);
        preview.api.preview('live'); assert.equal(preview.api.activePart(), 1);
        preview.api.preview('2'); preview.c.currentUser = { uid: 'B' };
        assert.equal(preview.api.activePart(), 1, 'Admin preview must not carry over to another account');
        preview.api.preview('2'); assert.equal(preview.api.activePart(), 1, 'Nonadmins cannot preview another part');

        const switcher = harness(file); switcher.seed(); await switcher.start(); await switcher.api.recordWin('daily');
        const gate = switcher.base.blockCommit(), pending = switcher.api.openGift(5);
        await gate.entered.promise; switcher.c.currentUser = { uid: 'B' }; gate.released.resolve(); await pending;
        assert.equal(switcher.saves(), 0, 'An in-flight claim cannot load the old account into the new account');
        console.log(`${file}: PASS UTC dates, win gating, gifts, animation, duplicates, concurrent claims, offline saves, admin preview and account switching`);
    }
})().catch(error => { console.error(error); process.exitCode = 1; });
