const fs = require('node:fs');
const vm = require('node:vm');
const assert = require('node:assert/strict');
(async () => {
for (const path of ['Minigames/SharkRNG/rng-mode.js', 'SharkdleMobile/www/Minigames/SharkRNG/rng-mode.js']) {
    const nodes = Object.fromEntries(['rng-save-status', 'rng-save-local', 'rng-save-cloud'].map(id => [id, { dataset: {}, textContent: '' }]));
    let fail = false;
    const storage = new Map();
    const context = {
        window: {}, document: { getElementById: id => nodes[id] || null },
        console: { warn() {} }, setTimeout: () => 1, clearTimeout() {},
        localStorage: { getItem: key => storage.get(key) || null, setItem: (key, value) => { if (fail) throw Error('quota'); storage.set(key, value); } }
    };
    const source = fs.readFileSync(path, 'utf8').replace('    window.initRngMode = initRngMode;', `
        window.test = {
            updateSaveStatusUi, scheduleLocalProfileSave, saveLocalProfile, saveRngProgressNow,
            cloud: (state) => {
                rngLeaderboardUser = state.user ? { uid: 'test' } : null;
                rngCloudSaveDirty = Boolean(state.dirty);
                rngCloudSaveInFlight = Boolean(state.saving);
                cloudSaveError = Boolean(state.error);
                player.rngCloudUpdatedAtMs = state.saved ? Date.now() : 0;
                updateSaveStatusUi();
            }
        };`);
    vm.runInNewContext(source, context);
    const api = context.window.test;
    api.updateSaveStatusUi(); assert.equal(nodes['rng-save-local'].textContent, 'Not saved yet');
    api.scheduleLocalProfileSave(); assert.equal(nodes['rng-save-local'].textContent, 'Saving on device...');
    api.saveLocalProfile(); assert.equal(nodes['rng-save-local'].textContent, 'Saved on device');
    assert(nodes['rng-save-status'].title.includes('250ms'));
    assert(nodes['rng-save-status'].title.includes('60 seconds'));
    fail = true; assert.equal(api.saveLocalProfile(), false);
    assert.equal(nodes['rng-save-local'].textContent, 'Device save failed');
    assert.equal(nodes['rng-save-status'].dataset.state, 'error');
    fail = false; await api.saveRngProgressNow(); assert.equal(nodes['rng-save-local'].textContent, 'Saved on device');
    for (const [state, expected] of [
        [{}, 'Cloud: sign in to sync'], [{ user: true }, 'Cloud: not synced yet'],
        [{ user: true, dirty: true }, 'Cloud: waiting to sync'],
        [{ user: true, dirty: true, saving: true }, 'Cloud: saving...'],
        [{ user: true, error: true }, 'Cloud save failed - retry'],
        [{ user: true, saved: true }, 'Cloud: synced']
    ]) { api.cloud(state); assert.equal(nodes['rng-save-cloud'].textContent, expected); }
    assert(!source.includes('renderLuckBreakdown'));
    const html = fs.readFileSync(path.replace('rng-mode.js', 'index.html'), 'utf8');
    assert(!html.includes('rng-tab-luck')); assert(html.includes('id="rng-save-status"'));
    console.log(path + ': PASS full startup, pending/success/failure/retry, cloud states, save-now, timing tooltip, Luck tab removed');
}
})().catch(error => { console.error(error); process.exitCode = 1; });
