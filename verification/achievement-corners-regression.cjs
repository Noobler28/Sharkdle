const fs = require('node:fs');
const vm = require('node:vm');
const assert = require('node:assert/strict');
const pages = ['index.html','Achievements/index.html','Daily/index.html','Infinite/index.html','Practice/index.html','Library/index.html','Story/index.html','Sharkpass/index.html','Leaderboard/index.html','Minigames/SharkRNG/index.html','shark-rescue/index.html'];
function payload(source, field, n) {
    const list = Array.from({length: Math.floor(n)}, (_, i) => String(i + 1));
    if (source === 'library') return { [field === 'favorites' ? 'favorites' : 'recent']: list };
    if (source === 'story') {
        if (field === 'tasks') return { areas: { a: { species: [list.map(() => true)] } } };
        if (field === 'finale') return { finale: { seen: n >= 1 } };
        return { areas: Object.fromEntries(list.map(id => [id, { [field === 'bosses' ? 'bossCompleted' : 'completed']: true }])) };
    }
    if (source === 'rng' && ['finds', 'mutatedFinds'].includes(field)) return { collection: Object.fromEntries(list.map(id => [id, { count: 1, ...(field === 'mutatedFinds' ? { mutations: ['shiny'] } : {}) }])) };
    if (source === 'rng' && field === 'indexClaims') return { claimedIndexRewards: list };
    if (source === 'profile') {
        if (field === 'passLevel' || field === 'passRewards') return { sharkPassLevel: n };
        if (field === 'questClaims') return { sharkPassMissionClaims: { season: list } };
        if (field === 'portraits') return { earnedCosmetics: list.map(id => ({ imagePath: id })) };
        const keys = { badges: 'unlockedBadges', themes: 'unlockedCardThemes', socialClaims: 'socialRewardsClaimed', codes: 'redeemedCodes' };
        if (keys[field]) return { [keys[field]]: list };
    }
    return { [field]: n };
}
(async () => {
for (const root of ['', 'SharkdleMobile/www/']) {
    const storage = new Map();
    const c = vm.createContext({ console, currentUser: { uid: 'A' },
        localStorage: { getItem: k => storage.get(k) ?? null, setItem: (k,v) => storage.set(k,String(v)) },
        getCurrentPlayerLevel: p => p.sharkPassLevel || 0,
        getLevelFromXP: () => 1, document: { addEventListener() {} },
        sharkPassRewards: Array.from({length:30},(_,i)=>({level:i+1,type:'pfp'}))
    }); c.window=c;
    vm.runInContext(fs.readFileSync(root+'achievement-corners.js','utf8'),c);
    const api=c.SharkdleCorners;
    assert.equal(api.definitions.length,90);
    assert.equal(new Set(api.definitions.map(a=>a.id)).size,90);
    assert(!/shivers|shark cards|slots|debt week|lagoon/i.test(JSON.stringify(api.definitions)));
    for(const a of api.definitions.filter(a=>a.metric)) {
        const [,source,field]=a.metric.split(':');
        storage.clear();
        api.check(source,payload(source,field,a.milestone-1));
        assert(!JSON.parse(storage.get('unlockedAchievements') || '[]').includes(a.id),a.id+' below threshold');
        api.check(source,payload(source,field,a.milestone));
        let ids=JSON.parse(storage.get('unlockedAchievements') || '[]');
        assert(ids.includes(a.id),a.id+' exact threshold');
        api.check(source,payload(source,field,a.milestone));
        assert.equal(JSON.parse(storage.get('unlockedAchievements')).length,ids.length,a.id+' duplicate');
    }
    storage.clear();
    api.check('profile',{unlockedBadges:['starter','starter'],unlockedCardThemes:['default'],earnedCosmetics:[]});
    assert.equal(storage.get('unlockedAchievements'),undefined,'Starter cosmetics cannot earn collection achievements');
    api.check('profile',{unlockedBadges:['a','a','a']});
    assert.equal(storage.get('unlockedAchievements'),undefined,'Duplicate items must not count as distinct badges');
    storage.set('sharkRngProfile_B',JSON.stringify({rolls:1e6,prestigeLevel:50}));
    storage.set('sharkRngProfile',JSON.stringify({rolls:1e6,prestigeLevel:50}));
    const roll=api.definitions.find(a=>a.id==='explore_rng_rolls_100000');
    assert.equal(api.progress(roll,{}),0,'RNG progress must use current account');
    storage.set('sharkRngProfile_A',JSON.stringify({rolls:1e6}));
    assert.equal(api.progress(roll,{}),1e6);
    storage.set('heartedSharks','malformed'); api.check('library');
    storage.clear();
    api.win('daily',true,1);
    assert.equal(JSON.parse(storage.get('unlockedAchievements')).length,3);
    api.win('daily',true,1);
    assert.equal(JSON.parse(storage.get('unlockedAchievements')).length,3);
    const before=storage.get('unlockedAchievements');api.award('not_a_real_achievement');
    assert.equal(storage.get('unlockedAchievements'),before);
    vm.runInContext(fs.readFileSync(root+'Achievements/achievements.js','utf8'),c);
    const catalog=vm.runInContext('getAllAchievementDefinitions()',c);
    assert.equal(new Set(catalog.map(a=>a.id)).size,catalog.length);
    for(const a of api.definitions) assert(catalog.some(v=>v.id===a.id));
    const unlocked=await c.retroactivelyUnlockAchievements({friendsCount:25},[]);
    assert(!unlocked.includes('explore_profile_socialClaims_3'),'Friend count cannot award social reward milestones');
    assert(vm.runInContext('getCategoryAchievements("worldmap")[0].id',c)==='atlantic_master');
    const secret=api.definitions.filter(a=>a.category==='rescue');assert(secret.every(a=>a.hiddenUntilSecret));
    for(const page of pages) assert(fs.readFileSync(root+page,'utf8').includes('src="achievement-corners.js?v=1"'),page);
    // Targets follow the actual campaign size and Rescue combo cap.
    assert(api.definitions.filter(a=>a.metric==='corner:story:tasks').every(a=>a.milestone<=8*3*3));
    assert(api.definitions.filter(a=>a.metric==='corner:rescue:bestCombo').every(a=>a.milestone<=2));
    console.log(root || 'web','PASS 90 milestones: boundaries, duplicate awards, distinct collections, account isolation, catalog integration, category order and reachable goals');
}
assert.equal(fs.readFileSync('achievement-corners.js','utf8'),fs.readFileSync('SharkdleMobile/www/achievement-corners.js','utf8'));
})().catch(e=>{console.error(e);process.exitCode=1;});
