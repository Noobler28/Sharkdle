const fs = require('node:fs');
const vm = require('node:vm');
const assert = require('node:assert/strict');

for (const path of ['Minigames/SharkRNG/rng-mode.js', 'SharkdleMobile/www/Minigames/SharkRNG/rng-mode.js']) {
    const storage = new Map(), math = Object.create(Math), legend = {innerHTML: ''};
    const c = {
        window: {}, Math: math, console,
        document: { getElementById: id => id === 'rng-tier-legend' ? legend : null },
        localStorage: { getItem: key => storage.get(key) || null, setItem: (key, value) => storage.set(key, value) },
        setTimeout: () => 1, clearTimeout() {}
    };
    vm.createContext(c);
    for (const file of ['sharks.js', 'rays.js']) vm.runInContext(fs.readFileSync(file, 'utf8'), c);
    const source = fs.readFileSync(path, 'utf8').replace('    window.initRngMode = initRngMode;', `window.test = {
        init: () => { buildRollPool(); grantRollXp = () => {}; }, pool: () => rollPool,
        player: () => player, types: MUTATION_TYPES, keys: MUTATION_CHANCE_ORDER, standard: STANDARD_MUTATION_KEYS,
        pick: pickWeightedMutationKey, total: getMutationRollWeightTotal, chance: getNaturalMutationChanceOneIn,
        trigger: getMutationChance, stack: rollStandardMutationStack, forced: getQueuedForcedMutation,
        roll: rollForShark, mutate: applyStableMutation, reveal: isApexPull, legend: renderTierLegend,
        shops: UPGRADE_SHOP_DEFS, upgrades: UPGRADE_LISTS, prestige: PRESTIGE_UPGRADE_DEFS, potions: POTION_DEFS,
        migrate: migrateRankXpProfile, merge: mergeRngProfilesForHydration, costs: LEGACY_APEX_UPGRADE_COSTS,
        load: loadLocalProfile, reload: () => { saveLocalProfile(); loadLocalProfile(); },
        perk: getPrestigeMutationOddsMultiplier, consume: consumeEffectRolls
    };`);
    vm.runInContext(source, c);
    const t = c.window.test; t.init();
    assert(t.standard.includes('apex')); assert.equal(t.keys.filter(k => k === 'apex').length, 1);
    assert(!t.shops.some(d => d.id === 'apex')); assert(!t.upgrades.apex);
    assert(!source.includes('rollApexPathMutationKey')); assert(!source.includes('getApexMutationChance'));
    assert(!source.includes('Apex Instinct locked'));
    assert.equal(t.trigger(), null); assert.equal(t.chance('apex'), null);
    t.player().mutationLevel = 1;
    assert(t.chance('apex') > 0);
    const baseline = t.chance('apex');
    t.player().mutationLevel = 320;
    assert(t.chance('apex') < baseline);
    assert(t.chance('infiniteabyss') > t.chance('apex'));
    assert.equal(t.types.apex.oneInMult, 1250);

    let before = 0;
    for (const key of t.standard) { if (key === 'apex') break; before += t.types[key].rollWeight; }
    const pickApex = (before + t.types.apex.rollWeight / 2) / t.total();
    math.random = () => pickApex;
    assert.equal(t.pick(), 'apex');
    let draws = [0, pickApex]; math.random = () => draws.shift() ?? 0;
    assert.deepEqual(Array.from(t.stack([], {rollInitial: true})), ['apex']);
    draws = [0, pickApex];
    const rolled = t.roll();
    assert.equal(rolled.mutation, 'apex'); assert(t.reveal(rolled));
    const key = rolled.name + ' (Apex)';
    t.player().equipped = key; t.reload();
    assert.equal(t.player().collection[key].oneIn, rolled.oneIn);
    assert.equal(t.player().equipped, key);
    t.player().activeEffects.randomMutation.remaining = 1; math.random = () => pickApex;
    assert.equal(t.forced().type, 'apex');
    t.legend(); assert(legend.innerHTML.includes('apex')); assert(!legend.innerHTML.includes('locked'));

    // Legacy upgrades refund once; stale cloud copies cannot add a second refund.
    const legacy = { coins: 100, apexLevel: 3, rngXpCurveVersion: 3, rngStateUpdatedAtMs: 10, collection: {} };
    const refund = t.costs.slice(0, 3).reduce((sum, cost) => sum + cost, 0);
    const migrated = t.migrate(legacy);
    assert.equal(migrated.coins, 100 + refund); assert.equal(migrated.apexLevel, 0);
    assert.equal(legacy.apexLevel, 3); assert.equal(t.migrate(migrated), migrated);
    assert.equal(t.merge(migrated, legacy).coins, migrated.coins);
    const spent = {...migrated, coins: 20, rngStateUpdatedAtMs: 20};
    assert.equal(t.merge(spent, legacy).coins, 20);
    t.load(legacy); assert.equal(t.player().coins, 100 + refund); t.reload();
    assert.equal(t.player().coins, 100 + refund); assert.equal(t.player().apexLevel, 0);

    // Existing prestige purchases and surge inventory benefit the whole mutation pool.
    const p = t.player(); p.mutationLevel = 0; p.prestigeUpgrades = {apexMemory: 1, apexCartography: 1};
    assert(t.trigger() > 0); assert(t.perk() > 1);
    assert(t.prestige.filter(d => ['apexMemory', 'apexCartography'].includes(d.id)).every(d => !d.name.includes('Apex') && d.desc.includes('mutation')));
    p.prestigeUpgrades = {}; p.mutationLevel = 1;
    const ordinaryChance = t.trigger(); p.activeEffects.apexSurge.remaining = 1;
    assert.equal(t.trigger(), Math.max(2, Math.round(ordinaryChance / 4)));
    p.mutationLevel = 320; assert.equal(t.trigger(), 2);
    p.mutationLevel = 0; assert.equal(t.trigger(), 100000);
    t.consume(); assert.equal(p.activeEffects.apexSurge.remaining, 0); assert.equal(t.trigger(), null);
    assert.equal(t.potions.apexSurge.name, 'Mutation Surge Potion');
    console.log(path + ': PASS Apex is a standard natural/potion mutation; catch rarity/equip preserved; legacy refunds idempotent across local/cloud saves; prestige and surge benefits retained');
}
