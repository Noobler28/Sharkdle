const assert = require('node:assert/strict');
const { harness } = require('./rng-account-sync-regression.cjs');

(async () => {
    const count = Number(process.env.RNG_LARGE_COUNT) || 50000;
    const files = process.env.RNG_LARGE_COUNT ? ['Minigames/SharkRNG/rng-mode.js']
        : ['Minigames/SharkRNG/rng-mode.js', 'SharkdleMobile/www/Minigames/SharkRNG/rng-mode.js'];
    for (const file of files) {
        const device = harness(file);
        await device.login('large-account');
        const collection = {};
        for (let index = 0; index < count; index++) {
            const name = 'Large collection shark number ' + index;
            collection[name + ' (Temporal)'] = {
                tier: 'Common', baseTier: 'Common', oddsTier: 'Singularity', oneIn: 1975890000000,
                firstRoll: index + 1, count: 3, mutation: 'chronoshark', mutations: ['chronoshark'], baseName: name
            };
        }
        device.api.change({ collection, coins: 12345, rolls: 150000, bestOneIn: 1975890000000 });
        const raw = device.api.buildRngCloudProfilePayload();
        const rawBytes = Buffer.byteLength(JSON.stringify(raw));
        assert(rawBytes > 10 * 1024 * 1024, 'Fixture must exceed the real Firestore request limit');
        assert.equal(await device.api.syncRngProfileToFirebase(), true, 'Large collections must save within real request limits');
        const reloaded = harness(file, device.db);
        await reloaded.login('large-account');
        assert.equal(Object.keys(reloaded.api.player().collection).length, count);
        assert.equal(reloaded.api.player().collection['Large collection shark number ' + (count - 1) + ' (Temporal)'].firstRoll, count);
        assert.equal(reloaded.api.player().coins, 12345);
        const cloudBytes = [...device.db.records.values()].reduce((sum, value) => sum + Buffer.byteLength(JSON.stringify(value)), 0);
        console.log(file + ': PASS ' + count + ' catches / ' + (rawBytes / 1024 / 1024).toFixed(1) + ' MiB raw -> ' + (cloudBytes / 1024 / 1024).toFixed(2) + ' MiB cloud save and fresh-device round-trip');
        const chunkPath = 'rngProfiles/large-account/chunks/chunk_0000';
        const firstChunk = device.db.records.get(chunkPath);
        assert.equal(typeof firstChunk.entriesGzip, 'string');
        const before = device.db.writes();
        device.db.put(chunkPath, { ...firstChunk, entriesGzip: '!invalid-base64!' });
        assert.equal(await reloaded.api.hydrateRngProfileFromFirebase({ force: true }), false);
        assert.equal(await reloaded.api.syncRngProfileToFirebase(), false);
        assert.equal(Object.keys(reloaded.api.player().collection).length, count);
        assert.equal(device.db.writes(), before, 'Corrupt compressed chunks must not be replaced by an incomplete upload');
    }
})().catch(error => { console.error(error); process.exitCode = 1; });
