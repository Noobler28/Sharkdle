const fs = require('node:fs');
const vm = require('node:vm');
const assert = require('node:assert/strict');

for (const path of ['Minigames/SharkRNG/rng-mode.js', 'SharkdleMobile/www/Minigames/SharkRNG/rng-mode.js']) {
    const original = fs.readFileSync(path, 'utf8');
    for (const mode of ['current', 'christmas-enabled', 'all-disabled']) {
        const storage = new Map(), math = Object.create(Math), legend = { innerHTML: '' };
        const context = {
            window: {}, Math: math, console,
            document: { getElementById: id => id === 'rng-tier-legend' ? legend : null },
            localStorage: { getItem: key => storage.get(key) || null, setItem: (key, value) => storage.set(key, value) },
            setTimeout: () => 1, clearTimeout() {}
        };
        vm.createContext(context);
        for (const file of ['sharks.js', 'rays.js']) vm.runInContext(fs.readFileSync(file, 'utf8'), context);
        let source = original;
        if (mode === 'christmas-enabled') source = source.replace('christmas: false', 'christmas: true');
        if (mode === 'all-disabled') source = source.replace('summer: true', 'summer: false').replace('halloween: true', 'halloween: false');
        source = source.replace('    window.initRngMode = initRngMode;', `window.test = {
            init: () => { buildRollPool(); grantRollXp = () => {}; player.mutationLevel = 320; },
            defs: SEASONAL_MUTATION_DEFS, events: SEASONAL_MUTATION_EVENTS, types: MUTATION_TYPES,
            keys: MUTATION_CHANCE_ORDER, standard: STANDARD_MUTATION_KEYS, pool: () => rollPool,
            total: getMutationRollWeightTotal, pick: pickWeightedMutationKey,
            chance: getNaturalMutationChanceOneIn, resolve: (input => resolveRngMutationKeys(input)[0] || null),
            mutate: applyStableMutation, roll: finalizeRoll, player: () => player,
            equip: key => { player.equipped = key; }, reload: () => { saveLocalProfile(); loadLocalProfile(); },
            candidates: getOwnedIndexCandidates, sections: () => getIndexSectionDefs(false, null),
            sprite: getMutationSpritePath, render: renderTierLegend, variants: getIndexVariantCountPerSpecies
        };`);
        vm.runInContext(source, context);
        const t = context.window.test;
        t.init(); t.render();
        assert.equal(t.defs.length, 18);
        for (const season of ['summer', 'halloween', 'christmas']) assert.equal(t.defs.filter(d => d.season === season).length, 6);
        const active = t.defs.filter(d => t.events[d.season]);
        assert.equal(t.keys.length, 226 + active.length);
        assert.equal(t.variants(), 227 + active.length);
        if (mode === 'current') { assert.equal(active.length, 12); assert.equal(t.events.christmas, false); }
        const base = t.pool().find(s => s.name === 'Ridge-egg Catshark');
        for (const def of t.defs) {
            const filename = def.spriteFile || def.name.toLowerCase().replace(/[^a-z0-9]+/g, '_') + '.png';
            const sprite = 'images/RNG/mutations/' + filename;
            for (const prefix of ['', 'SharkdleMobile/www/']) {
                assert(fs.readdirSync(prefix + 'images/RNG/mutations').includes(filename), 'Exact filename case: ' + filename);
                const png = fs.readFileSync(prefix + sprite);
                assert.equal(png.readUInt32BE(0), 0x89504e47);
                assert(png.readUInt32BE(16) > 0 && png.readUInt32BE(20) > 0);
            }
            assert.deepEqual(fs.readFileSync(sprite), fs.readFileSync('SharkdleMobile/www/' + sprite));
            if (!t.events[def.season]) {
                assert(!t.types[def.key]); assert(!t.keys.includes(def.key)); assert(!t.standard.includes(def.key));
                assert.equal(t.chance(def.key), null);
                assert.throws(() => t.resolve(def.name), /Unknown mutation/);
                assert.equal(t.mutate(base, def.key), base);
                assert(!t.sections().some(section => section.mutation === def.key));
                assert(!legend.innerHTML.includes(def.name));
                continue;
            }
            assert.equal(t.resolve(def.name), def.key);
            assert(t.standard.includes(def.key)); assert(t.chance(def.key) > 0);
            let before = 0;
            for (const key of t.standard) { if (key === def.key) break; before += t.types[key].rollWeight; }
            math.random = () => (before + def.rollWeight / 2) / t.total();
            assert.equal(t.pick(), def.key);
            assert(t.sections().some(section => section.mutation === def.key));
            assert(legend.innerHTML.includes(def.name));
            assert.equal(t.sprite(def.key), sprite);
            const rolled = t.roll(t.mutate(base, def.key));
            const candidate = t.candidates({ tierFilter: 'all', ownedOnly: true, searchTokens: [def.name.toLowerCase()] }).find(c => c.canonical.mutation === def.key);
            assert(candidate && candidate.obtained);
            t.equip(candidate.key); t.reload();
            assert.equal(t.player().equipped, candidate.key);
            assert.equal(t.player().collection[candidate.key].oneIn, rolled.oneIn);
        }
        assert(!legend.innerHTML.replace(/<[^>]*>/g, '').includes('%'));
        console.log(path + ': PASS ' + mode + ' (' + active.length + ' seasonal mutations active), weighted rolls/index/save/equip/image paths; disabled seasons unavailable');
    }
}
