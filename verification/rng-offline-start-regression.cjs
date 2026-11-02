const assert = require('node:assert/strict');
const { harness } = require('./rng-account-sync-regression.cjs');

(async () => {
    for (const file of ['Minigames/SharkRNG/rng-mode.js', 'SharkdleMobile/www/Minigames/SharkRNG/rng-mode.js']) {
        const device = harness(file);
        device.db.offline(true);
        await device.login('unloaded-account');
        assert.equal(device.api.canPlayRngAccount(), false);
        await device.api.saveRngProgressNow();
        assert.equal(device.api.canPlayRngAccount(), false, 'A failed Save now must not authorize an empty, unhydrated account save');
        const reloaded = harness(file, device.db, device.storage, device.largerStore);
        await reloaded.login('unloaded-account');
        assert.equal(reloaded.api.canPlayRngAccount(), false, 'Reloading an unhydrated placeholder must not authorize play');
        device.db.offline(false);
        await reloaded.api.hydrateRngProfileFromFirebase({ force: true });
        assert.equal(reloaded.api.canPlayRngAccount(), true, 'A confirmed new cloud account can start playing');
        console.log(file + ': PASS failed fresh-device cloud load, repeated Save now and reload remain protected until server confirmation');
    }
})().catch(error => { console.error(error); process.exitCode = 1; });
