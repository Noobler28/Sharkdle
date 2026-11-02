const assert = require('node:assert/strict');
const { performance } = require('node:perf_hooks');
const { harness, database, find } = require('./rng-account-sync-regression.cjs');
let seed = 0x5a17c0de;
function random() { seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0; return seed / 2 ** 32; }
const pick = values => values[Math.floor(random() * values.length)];

(async () => {
    for (const file of ['Minigames/SharkRNG/rng-mode.js', 'SharkdleMobile/www/Minigames/SharkRNG/rng-mode.js']) {
        const started = performance.now();
        const db = database();
        const users = Array.from({ length: 12 }, (_, index) => 'account-' + index);
        const expected = new Map(users.map(uid => [uid, new Set()]));
        let devices = Array.from({ length: 4 }, () => harness(file, db));
        for (const device of devices) await device.login(pick(users));
        let operations = 0, failedSaves = 0;
        for (let step = 0; step < 1200; step++) {
            const index = Math.floor(random() * devices.length);
            let device = devices[index], uid = device.auth.currentUser?.uid;
            switch (Math.floor(random() * 7)) {
                case 0: {
                    if (!uid) break;
                    const key = uid + '-catch-' + step;
                    device.api.change({ collection: { ...device.api.player().collection, ...find(key, step + 100) }, bestOneIn: step + 100, rolls: device.api.player().rolls + 1 });
                    await device.api.saveLocalProfile();
                    expected.get(uid).add(key);
                    break;
                }
                case 1: await device.api.syncRngProfileToFirebase(); break;
                case 2: await device.login(pick([...users, null])); break;
                case 3: {
                    await device.api.saveLocalProfile();
                    const reloaded = harness(file, db, device.storage, device.largerStore);
                    devices[index] = reloaded; await reloaded.login(uid || null); device = reloaded;
                    break;
                }
                case 4: {
                    db.offline(true);
                    if (uid) { assert.equal(await device.api.syncRngProfileToFirebase(), false); failedSaves++; }
                    db.offline(false);
                    break;
                }
                case 5: {
                    device.quota(true); await device.api.saveLocalProfile(); device.quota(false);
                    break;
                }
                case 6: await Promise.all(devices.map(item => item.api.syncRngProfileToFirebase())); break;
            }
            for (const candidate of devices) {
                const owner = candidate.api.owner();
                for (const key of Object.keys(candidate.api.player().collection)) assert(key.startsWith(owner + '-catch-'), 'Cross-account catch leak: ' + owner + ' / ' + key);
            }
            operations++;
        }
        // Visit every account on every device to upload locally retained offline/signed-out work.
        for (const device of devices) for (const uid of users) { await device.login(uid); await device.api.syncRngProfileToFirebase(); }
        const validator = harness(file, db);
        let catches = 0;
        for (const uid of users) {
            await validator.login(uid);
            const actual = new Set(Object.keys(validator.api.player().collection));
            for (const key of expected.get(uid)) { assert(actual.has(key), 'Lost catch after churn: ' + key); catches++; }
            assert.equal(actual.size, expected.get(uid).size);
        }
        // Simultaneous writers must retry optimistic conflicts while retaining every device's catches.
        const racers = Array.from({ length: 4 }, () => harness(file, db));
        for (const racer of racers) await racer.login(users[0]);
        for (let round = 0; round < 30; round++) {
            racers.forEach((racer, index) => racer.api.change({ collection: { ...racer.api.player().collection, ...find('race-' + round + '-' + index) } }));
            const results = await Promise.all(racers.map(racer => racer.api.syncRngProfileToFirebase()));
            assert(results.every(Boolean), 'Concurrent writers should complete after retry');
        }
        await validator.login(users[0]);
        for (let round = 0; round < 30; round++) for (let index = 0; index < racers.length; index++) assert('race-' + round + '-' + index in validator.api.player().collection);
        console.log(file + ': PASS ' + operations + ' randomized account/save/reload/quota/offline operations across 12 accounts and 4 devices, ' + catches + ' catches retained, ' + failedSaves + ' offline failures, 120 competing saves, ' + db.retries() + ' transaction retries (' + Math.round(performance.now() - started) + 'ms)');
    }
})().catch(error => { console.error(error); process.exitCode = 1; });
