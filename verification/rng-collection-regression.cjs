const fs = require('node:fs');
const vm = require('node:vm');
const assert = require('node:assert/strict');
function element() {
    return {
        children: [], classList: { add() {}, toggle() {} }, style: { setProperty() {} },
        append(...children) { this.children.push(...children); },
        appendChild(child) { this.children.push(child); },
        setAttribute() {}, addEventListener(name, handler) { this[name] = handler; },
        set innerHTML(value) { this.firstElementChild = element(); }
    };
}
for (const path of ['Minigames/SharkRNG/rng-mode.js', 'SharkdleMobile/www/Minigames/SharkRNG/rng-mode.js']) {
    const storage = new Map();
    const context = {
        window: {}, document: { createElement: element, getElementById: () => null }, console,
        localStorage: { getItem: key => storage.get(key) || null, setItem: (key, value) => storage.set(key, value) },
        setTimeout: () => 1, clearTimeout() {}
    };
    vm.createContext(context);
    vm.runInContext(fs.readFileSync('sharks.js', 'utf8'), context);
    vm.runInContext(fs.readFileSync('rays.js', 'utf8'), context);
    const source = fs.readFileSync(path, 'utf8').replace('    window.initRngMode = initRngMode;', `
        window.test = {
            init: () => { buildRollPool(); grantRollXp = () => {}; persistPlayerState = () => saveLocalProfile(); },
            roll: () => finalizeRoll(applyStableMutation(getRollPoolEntryByName('Western Blue Skate'), 'chronoshark')),
            candidates: getOwnedIndexCandidates, card: createIndexCard,
            reload: () => { saveLocalProfile(); loadLocalProfile(); },
            player: () => player
        };`);
    vm.runInContext(source, context);
    const api = context.window.test; api.init();
    const rolled = api.roll();
    assert.equal(rolled.oneIn, 1975890000000);
    const filters = { tierFilter: 'all', ownedOnly: true, searchTokens: ['western', 'temporal'] };
    let candidates = api.candidates(filters);
    assert.equal(candidates.length, 1);
    assert.equal(candidates[0].key, 'Western Blue Skate (Temporal)');
    assert(candidates[0].obtained);
    assert.equal(candidates[0].entry.oneIn, rolled.oneIn);
    const card = api.card(candidates[0]); assert.equal(card.disabled, false);
    card.click(); assert.equal(api.player().equipped, 'Western Blue Skate (Temporal)');
    api.reload(); candidates = api.candidates(filters);
    assert.equal(candidates.length, 1);
    assert.equal(api.player().equipped, candidates[0].key);
    assert.equal(candidates[0].entry.oneIn, rolled.oneIn);
    assert.equal(api.candidates({ ...filters, mutationFilter: 'chronoshark' }).length, 1);
    assert.equal(api.candidates({ ...filters, baseOnlyFilter: true }).length, 0);
    assert.equal(api.candidates({ ...filters, tierFilter: 'Common' }).length, 0);
    console.log(path + ': PASS actual Western Blue Skate Temporal 1.97589T roll, owned search, enabled equip card, click equips, save/reload, mutation/base/rarity filters');
}
