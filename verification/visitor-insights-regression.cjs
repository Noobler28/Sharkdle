const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const crypto = require('node:crypto').webcrypto;
const source = fs.readFileSync('global-broadcast.js', 'utf8');
const writes = [];
const storage = new Map();
const context = vm.createContext({
    crypto, Uint8Array, Date, String, Array,
    localStorage: { getItem: key => storage.get(key), setItem: (key, value) => storage.set(key, value) },
    window: { location: { pathname: '/Daily/' } },
    firebase: { firestore: { FieldValue: { serverTimestamp: () => 'server-time' } } },
    getCurrentActivityPayload: () => ({ label: 'Daily' }),
    getUtcVisitorDayKey: () => '2026-11-04',
    VISITOR_DAILY_COLLECTION: 'visitorDaily'
});
vm.runInContext(source.slice(source.indexOf('    let guestVisitorId;'), source.indexOf('    function startVisitorTracking(db)')), context);
const db = { collection(name) { return { doc(day) { return { collection(kind) { return { doc(id) {
    return { set: async data => writes.push({ name, day, kind, id, data }) };
} }; } }; } }; } };
(async () => {
    await context.recordGuestVisitor(db);
    await context.recordGuestVisitor(db);
    assert.equal(writes.length, 2);
    assert.match(writes[0].id, /^[a-f0-9]{32}$/);
    assert.equal(writes[0].id, writes[1].id);
    assert.equal(writes[0].kind, 'guests');
    assert.equal(writes[0].data.activity, 'Daily');
    assert.equal(writes[0].data.visitedAt, 'server-time');
    assert.equal(storage.get('sharkdle-guest-visitor-id'), writes[0].id);
    console.log('PASS guest visits reuse a persistent browser ID and record server-timestamped activity');
})().catch(error => { console.error(error); process.exitCode = 1; });
