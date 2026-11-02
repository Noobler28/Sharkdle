const fs = require('node:fs');
const vm = require('node:vm');
const assert = require('node:assert/strict');

for (const path of ['Minigames/SharkRNG/rng-mode.js', 'SharkdleMobile/www/Minigames/SharkRNG/rng-mode.js']) {
    const storage = new Map(), math = Object.create(Math), legend = {innerHTML: ''};
    const c = {
        window: {}, Math: math, console, setTimeout: () => 1, clearTimeout() {},
        document: {getElementById: id => id === 'rng-tier-legend' ? legend : null},
        localStorage: {getItem: key => storage.get(key) || null, setItem: (key, value) => storage.set(key, value)}
    };
    vm.createContext(c);
    for (const file of ['sharks.js', 'rays.js']) vm.runInContext(fs.readFileSync(file, 'utf8'), c);
    const source = fs.readFileSync(path, 'utf8').replace('    window.initRngMode = initRngMode;', `window.test = {
        init: () => { buildRollPool(); persistPlayerState = () => saveLocalProfile(); },
        player: () => player, types: MUTATION_TYPES, keys: STANDARD_MUTATION_KEYS,
        defs: UPGRADE_SHOP_DEFS, upgrades: UPGRADE_LISTS.mutationRarity,
        weight: getMutationRollWeight, total: getMutationRollWeightTotal, pick: pickWeightedMutationKey,
        chance: getNaturalMutationChanceOneIn, trigger: getMutationChance,
        stack: rollStandardMutationStack, forced: getQueuedForcedMutation,
        buy: () => buyUpgrade(UPGRADE_LISTS.mutationRarity, 'mutationRarityLevel'),
        next: () => getNextUpgrade(UPGRADE_LISTS.mutationRarity, player.mutationRarityLevel),
        reload: () => { saveLocalProfile(); loadLocalProfile(); }, cloud: buildRngCloudProfilePayload,
        pool: () => rollPool, mutate: applyStableMutation, render: renderTierLegend, format: formatOneIn,
        detail: next => formatUpgradeDetail(UPGRADE_SHOP_DEFS.find(d => d.id === 'mutationRarity'), next, player.mutationRarityLevel)
    };`);
    vm.runInContext(source, c); const t = c.window.test; t.init();
    assert(t.defs.some(d => d.id === 'mutationRarity'));
    assert.equal(t.upgrades.length, 40); assert.equal(t.player().mutationRarityLevel, 0);
    for (const key of t.keys) assert.equal(t.weight(key), t.types[key].rollWeight);
    assert.equal(t.trigger(), null); assert.equal(t.chance('infiniteabyss'), null);
    t.player().mutationLevel = 125;
    const baseTrigger = t.trigger(), baseOdds = t.chance('infiniteabyss');
    const base = t.pool().find(s => s.name === 'Ridge-egg Catshark');
    const originalCatch = t.mutate(base, 'infiniteabyss').oneIn;
    const baseCommonShare = t.weight('melanistic') / t.total();
    let previousRareChance = Infinity;
    for (let level = 0; level <= 40; level++) {
        t.player().mutationRarityLevel = level;
        assert.equal(t.trigger(), baseTrigger); // Never changes the mutation trigger rate.
        assert(t.chance('infiniteabyss') < previousRareChance); previousRareChance = t.chance('infiniteabyss');
        const total = t.total(); let before = 0;
        for (const key of t.keys) {
            const weight = t.weight(key); assert(Number.isFinite(weight) && weight > 0);
            math.random = () => (before + weight / 2) / total;
            assert.equal(t.pick(), key); // Real selection uses exactly the same upgraded weights.
            assert.equal(t.chance(key), Math.round(baseTrigger * total / weight));
            before += weight;
        }
        assert(Math.abs(before / total - 1) < 1e-12);
        assert.equal(t.chance('gingerbread'), null); // Christmas remains unavailable.
        assert(!t.keys.includes('gingerbread'));
    }
    assert(t.chance('infiniteabyss') < baseOdds / 50);
    assert(t.weight('melanistic') / t.total() < baseCommonShare);
    assert.equal(t.mutate(base, 'infiniteabyss').oneIn, originalCatch);
    t.render();
    const row = legend.innerHTML.split('rng-mutation-chance-row infiniteabyss')[1].split('</div>')[0];
    assert(row.includes('1 in ' + t.format(t.chance('infiniteabyss'))));
    assert(!row.includes('mutation rolls'));

    // Guaranteed random mutations share the bias; specific guarantees keep their species.
    let before = 0;
    for (const key of t.keys) { if (key === 'infiniteabyss') break; before += t.weight(key); }
    const pickRare = (before + t.weight('infiniteabyss') / 2) / t.total();
    let draws = [0, pickRare]; math.random = () => draws.shift() ?? 0;
    assert.deepEqual(Array.from(t.stack([], {rollInitial: true})), ['infiniteabyss']);
    t.player().activeEffects.randomMutation.remaining = 1; math.random = () => pickRare;
    assert.equal(t.forced().type, 'infiniteabyss');
    t.player().activeEffects.albino.remaining = 1;
    assert.equal(t.forced().type, 'albino');

    t.player().mutationRarityLevel = 0;
    const next = t.next(), preview = t.detail(next);
    assert(preview.includes('1 in ' + t.format(t.chance('infiniteabyss', next.level))));
    t.player().coins = next.cost + 100; t.buy();
    assert.equal(t.player().coins, 100); assert.equal(t.player().mutationRarityLevel, 1);
    t.reload(); assert.equal(t.player().mutationRarityLevel, 1);
    assert.equal(t.cloud().metadata.mutationRarityLevel, 1);
    t.player().mutationRarityLevel = 40; assert.equal(t.next(), null);
    console.log(path + ': PASS all 238 mutations selectable at every rarity level; same mutation trigger and saved catch power; random potion parity; visible odds and preview match; buy/save/cloud; Cosmos ' + t.format(baseOdds) + ' -> ' + t.format(t.chance('infiniteabyss')));
}
