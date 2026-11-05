const fs = require('node:fs');
const vm = require('node:vm');
const assert = require('node:assert/strict');

(async () => {
for (const root of ['', 'SharkdleMobile/www/']) {
    const storage = new Map();
    const context = vm.createContext({
        console, currentUser: { uid: 'A' },
        document: { addEventListener() {} },
        localStorage: { getItem: k => storage.get(k) ?? null, setItem: (k,v) => storage.set(k,String(v)) },
        getLevelFromXP: xp => Math.floor(xp / 100) + 1,
        getCommunityBossPersonalWins: () => 1
    });
    context.window = context;
    vm.runInContext(fs.readFileSync(root + 'Achievements/achievements.js', 'utf8'), context);
    const definitions = vm.runInContext('getAllAchievementDefinitions()', context);
    assert.equal(new Set(definitions.map(a => a.id)).size, definitions.length);
    assert.equal(definitions.filter(a => ['accountLevel','loginStreak','rngBestOneIn','rngPrestige','rngRolls'].includes(a.metric)).length, 20);
    storage.set('sharkRngProfile_B', JSON.stringify({ bestOneIn: 1e12, prestigeLevel: 99 }));
    storage.set('sharkRngProfile', JSON.stringify({ bestOneIn: 1e12 }));
    assert.equal(context.getAchievementProgressValue({ metric: 'rngBestOneIn' }, {}), 0, 'Do not read another account or guest RNG progress');
    storage.set('sharkRngProfile_A', JSON.stringify({ bestOneIn: 1e6, prestigeLevel: 5, rolls: 1000 }));
    const profile = { totalXP: 4900, loginStreak: 30, friendsCount: 0, redeemedCodes: ['CODE'], socialRewardsClaimed: ['task'], cratesOpened: 100, referralRewards: { claimedShareRewards: ['share'] }, lastSpinWheelDate: '2026-11-05', dailySpinWinDate: '2026-11-05' };
    let unlocked = await context.retroactivelyUnlockAchievements(profile, []);
    assert(!unlocked.includes('rng_odds_1000000'), 'Exact odds must not unlock a strictly rarer achievement');
    for (const id of ['account_level_50','login_days_30','rng_prestige_5','rng_rolls_1000','code_redeemed','social_reward_claimed','friend_shared','daily_spin_used','global_contest_joined','crate_collector_100']) assert(unlocked.includes(id), id);
    assert(!unlocked.includes('rng_prestige_10'));
    profile.rngBestOneIn = 100000000001;
    unlocked = await context.retroactivelyUnlockAchievements(profile, unlocked);
    for(const v of [1e6,5e7,1e8,1e9,5e10,1e11]) assert(unlocked.includes('rng_odds_'+v));
    const count = unlocked.length;
    assert.equal((await context.retroactivelyUnlockAchievements(profile, unlocked)).length, count, 'Repeated checks must not duplicate unlocks');

    const script = fs.readFileSync(root + 'script.js','utf8');
    const start = script.indexOf('window.checkRngProgressAchievements =');
    const end = script.indexOf('function getDuelOpponentUid', start);
    const earned = new Set();
    const hooks = vm.createContext({ window: {}, unlockDuelAchievement: id => earned.add(id) });
    vm.runInContext(script.slice(start,end), hooks);
    hooks.window.checkRngProgressAchievements({ bestOneIn: 1e6, prestigeLevel: 1, rolls: 99 });
    assert(!earned.has('rng_odds_1000000'));
    assert(earned.has('rng_prestige_1'));
    hooks.window.checkRngProgressAchievements({ bestOneIn: 1e11+1, prestigeLevel: 10, rolls: 10000 });
    assert.equal(earned.size, 12);
    for (const [file,fn,completed] of [['Daily/daily.js','shareDailyResults','gameCompleted'],['Infinite/infinite.js','shareInfiniteResults','categoryRevealGameCompleted']]) {
        const src=fs.readFileSync(root+file,'utf8'); const a=src.indexOf('async function '+fn+'()'); const b=src.indexOf('\n}',a)+2;
        let shared=0, awards=0;
        const c=vm.createContext({ [completed]: true, console, window:{ recordSharkdleAchievement:()=>awards++ }, navigator:{ share:async()=>{shared++;} }, generateDailyShareText:()=> 'results', generateInfiniteShareText:()=> 'results', messageDiv:null, document:{getElementById:()=>null} });
        vm.runInContext(src.slice(a,b),c);
        await c[fn](); assert.equal(awards,1);
        c[completed]=false; await c[fn](); assert.equal(shared,1,'Incomplete games cannot share results');
        c[completed]=true; c.navigator.share=async()=>{throw {name:'AbortError'};};
        c.console={warn(){},error(){}};c.alert=()=>{};
        await c[fn](); assert.equal(awards,1,'Failed share/copy cannot award achievement');
    }
    console.log(root || 'web', 'PASS achievement definitions, backfill, strict RNG boundaries, account isolation, idempotence and result sharing');
}
})().catch(e => { console.error(e); process.exitCode=1; });
