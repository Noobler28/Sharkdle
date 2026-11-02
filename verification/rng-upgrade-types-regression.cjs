const fs = require('node:fs');
const vm = require('node:vm');
const assert = require('node:assert/strict');

function element(tag = 'article') {
    return {
        tag, dataset: {}, children: [], innerHTML: '',
        addEventListener() {},
        querySelector(selector) {
            if (selector === 'button') return this.children.find(child => child.tag === 'button') || null;
            const key = selector.match(/data-upgrade-key="([^"]+)"/)?.[1];
            return this.children.find(child => child.dataset.upgradeKey === key) || null;
        },
        appendChild(child) {
            this.children = this.children.filter(existing => existing !== child);
            this.children.push(child);
        }
    };
}

for (const path of ['Minigames/SharkRNG/rng-mode.js', 'SharkdleMobile/www/Minigames/SharkRNG/rng-mode.js']) {
    const storage = new Map(), shop = element('section');
    const c = {
        window: {}, console, setTimeout: () => 1, clearTimeout() {},
        document: { getElementById: id => id === 'rng-upgrade-shop' ? shop : null, createElement: element },
        localStorage: { getItem: key => storage.get(key) || null, setItem: (key, value) => storage.set(key, value) }
    };
    vm.createContext(c);
    for (const file of ['sharks.js', 'rays.js']) vm.runInContext(fs.readFileSync(file, 'utf8'), c);
    const source = fs.readFileSync(path, 'utf8').replace('    window.initRngMode = initRngMode;', `window.test = {
        init: () => { buildRollPool(); grantRollXp = () => {}; persistPlayerState = () => saveLocalProfile(); },
        player: () => player, lists: UPGRADE_LISTS, defs: UPGRADE_SHOP_DEFS, pool: () => rollPool,
        render: renderUpgradeShop, next: getNextUpgrade, progress: getUpgradeProgress, values: getEffectiveUpgradeValues,
        chance: getMutationChance, permanentChance: getPermanentMutationChance,
        rolls: key => getPotionEffectRolls(POTION_DEFS[key]), cost: getPotionCost, restock: getEffectivePotionRestockRolls,
        reward: getRewardCoinMultiplier, roll: finalizeRoll,
        buy: def => buyUpgrade(UPGRADE_LISTS[def.listKey], def.levelKey),
        load: loadLocalProfile, reload: () => { saveLocalProfile(); loadLocalProfile(); },
        cloud: buildRngCloudProfilePayload, defaults: createDefaultPlayer
    };`);
    vm.runInContext(source, c);
    const t = c.window.test; t.init();
    // Existing branches keep their old tiers and costs; six distinct effects are added.
    for (const [key, count] of Object.entries({luck: 320, coin: 310, streak: 270, xp: 290, mutationBounty: 240, potionRestock: 220})) assert.equal(t.lists[key].length, count);
    const newKeys = ['potionDuration', 'potionDiscount', 'discoveryBounty', 'duplicateBounty', 'compassRestock', 'mutationRarity'];
    for (const key of newKeys) {
        const def = t.defs.find(d => d.id === key); assert(def);
        assert.equal(t.player()[def.levelKey], 0);
        const next = t.next(t.lists[key], 0);
        t.player().coins = next.cost - 1; t.buy(def); assert.equal(t.player()[def.levelKey], 0);
        t.player().coins = next.cost + 10; t.buy(def);
        assert.equal(t.player()[def.levelKey], 1); assert.equal(t.player().coins, 10);
        t.reload(); assert.equal(t.player()[def.levelKey], 1);
        assert.equal(t.cloud().metadata[def.levelKey], 1);
        let lastCost = 0, lastBonus = 0;
        for (const upgrade of t.lists[key]) {
            assert(Number.isFinite(upgrade.cost) && upgrade.cost > lastCost && upgrade.bonus > lastBonus);
            lastCost = upgrade.cost; lastBonus = upgrade.bonus;
        }
    }

    t.load({rngXpCurveVersion: 3});
    for (const key of newKeys) assert.equal(t.player()[key + 'Level'], 0);
    const p = t.player();
    const originalDuration = t.rolls('luck'); p.potionDurationLevel = 25;
    assert.equal(t.rolls('luck'), originalDuration * 2);
    p.prestigeUpgrades = {potionChemistry: 5}; assert(t.rolls('luck') > originalDuration * 2);
    assert.equal(t.rolls('apexSurge'), 1); // Fixed-use potions remain fixed.
    p.prestigeUpgrades = {}; const originalPrice = t.cost('luck'); p.potionDiscountLevel = 20;
    assert.equal(t.cost('luck'), Math.round(originalPrice * 0.8));
    p.prestigeUpgrades = {potionContract: 5}; assert(t.cost('luck') < originalPrice * 0.8 && t.cost('luck') > 0);

    p.prestigeUpgrades = {}; p.compassRestockLevel = 0;
    assert.equal(t.restock('abyssalCompass'), 250); assert.equal(t.restock('omniversalCompass'), 800);
    p.compassRestockLevel = 30;
    assert.equal(t.restock('abyssalCompass'), 63); assert.equal(t.restock('omniversalCompass'), 200);
    assert.equal(t.restock('ultra'), 20); assert.equal(t.restock('omega'), 80);
    p.prestigeUpgrades = {restockCrew: 4}; assert(t.restock('omniversalCompass') < 200);
    p.prestigeUpgrades = {};

    const base = t.pool().find(s => s.name === 'Ridge-egg Catshark');
    const originalReward = t.reward(base);
    p.discoveryBountyLevel = 30; p.duplicateBountyLevel = 20;
    assert.equal(t.reward(base), originalReward * 2.5);
    t.roll(base); assert.equal(t.reward(base), originalReward * 1.5);
    p.discoveryBountyLevel = 0; assert.equal(t.reward(base), originalReward * 1.5);
    p.duplicateBountyLevel = 0; assert.equal(t.reward(base), originalReward);

    // The exact reported cap is full, even for saves beyond the useful legacy levels.
    p.mutationLevel = 125; p.collection = {}; t.render();
    let card = shop.querySelector('[data-upgrade-key="mutationLevel"]');
    assert(card.innerHTML.includes('125/125')); assert(card.innerHTML.includes('width:100%')); assert(card.querySelector('button').disabled);
    p.mutationLevel = 320; t.render(); assert(card.innerHTML.includes('125/125'));
    p.potionRestockLevel = 149; t.render();
    const restockCard = shop.querySelector('[data-upgrade-key="potionRestockLevel"]');
    assert(restockCard.innerHTML.includes('149/149')); assert(restockCard.querySelector('button').disabled);
    const before = restockCard.innerHTML;
    p.prestigeUpgrades = {restockCrew: 4}; t.render();
    const progress = t.progress(t.lists.potionRestock, p.potionRestockLevel);
    assert.equal(progress.percent, 100); assert(restockCard.innerHTML.includes(progress.maxLevel + '/' + progress.maxLevel));
    assert.notEqual(restockCard.innerHTML, before); // Same saved level, changed permanent bonuses.

    for (const [key, levelKey] of [['mutation', 'mutationLevel'], ['potionRestock', 'potionRestockLevel'], ['speed', 'rollSpeedLevel'], ['auto', 'autoRollLevel']]) {
        const list = t.lists[key];
        for (const prestige of [{}, {restockCrew: 4, swiftReturn: 5, timePearl: 5, mutagenArchive: 5}]) {
            p.prestigeUpgrades = prestige;
            for (let level = 0; level <= list.length; level++) {
                p[levelKey] = level;
                const next = t.next(list, level), current = t.values(list, level);
                if (next) assert(t.values(list, next.level).some((value, i) => value < current[i]));
                else assert.equal(t.progress(list, level).percent, 100);
            }
        }
    }
    // A temporary potion must not alter the permanent maximum or available purchases.
    p.prestigeUpgrades = {}; p.mutationLevel = 1;
    const permanent = t.progress(t.lists.mutation, 1), nextLevel = t.next(t.lists.mutation, 1).level;
    p.activeEffects.apexSurge.remaining = 1;
    assert.equal(t.progress(t.lists.mutation, 1).maxLevel, permanent.maxLevel);
    assert.equal(t.next(t.lists.mutation, 1).level, nextLevel);
    for (const key of newKeys) assert.equal(t.defaults()[key + 'Level'], 0);
    console.log(path + ': PASS six new upgrade branches: buying/saving/cloud state, real potion/reward/restock effects, accurate capped counters and cache refresh, no ineffective purchases');
}
