const fs = require('node:fs');
const vm = require('node:vm');
const assert = require('node:assert/strict');
const banned = 'sIoLtlm9kubExe2BY5cVvIlOqKA3';
const dev = 'ETPtQC0VA2NiSnX67rS2P2ma2tC2';
const cloneUids = [
    '1MPm8Ra9VYQusZkCBpRCRDo7nJq2', 'AtXSxyWxB0XTLVoB38EP9lXYY143',
    'FhAoaY0rbGeuHaDdpxeAOUxj7Tz2', 'HqV0msSXj4MfRMxrZm5lcHijXSM2',
    'L5Hq0ozcQobIMUs2PySv2lHt4eQ2', 'USfUIeFsBDbInpSqzuf9hF3ERSa2',
    'Xv8ZMsmMKUZ29AfF8NlDuoc9nXR2', 'ef4NrLvi5mRWwNIAf9To9T2fxfH2',
    'jkF9e0C2IlhuzcPR7kNfymLH9yu2', 'jsu9p9Yr2WVZxOlKn8QV1oPOQ972',
    'pDjQ4iYMC7cwP6fIcCM70HhngR63', 'pQQ53hnSQpU45QbYO0uaU5VAlRm1'
];
const offensiveNameUid = 'vhprPM4Hdghiz1Rpx3t2BX9bmap2';
const newBlockedUids = [...cloneUids, offensiveNameUid];
const moduleSource = fs.readFileSync('leaderboard-blacklist.js', 'utf8');
assert.equal(moduleSource, fs.readFileSync('SharkdleMobile/www/leaderboard-blacklist.js', 'utf8'));
const restoredSource = moduleSource;
// Simulate the temporary restriction only in this isolated test, never in the shipped policy.
const blockedSource = moduleSource.replace('const entries = Object.freeze({',
    'const entries = Object.freeze({\n' + dev + ': Object.freeze({ reason: "Temporary developer blacklist test" }),');
assert.notEqual(blockedSource, moduleSource);

function element() {
    return {innerHTML: '', textContent: '', hidden: true, style: {}, children: [], dataset: {},
        classList: {add() {}, remove() {}, toggle() {}, contains: () => false},
        appendChild(child) {this.children.push(child);}, addEventListener() {}, querySelectorAll: () => []};
}
function context(policySource = moduleSource) {
    const nodes = {}, storage = new Map();
    const c = {window: {}, console,
        localStorage: {getItem: key => storage.get(key) || null, setItem: (key, value) => storage.set(key, value)},
        document: {getElementById: id => nodes[id] ||= element(), querySelectorAll: () => [], createElement: element},
        setTimeout: () => 1, clearTimeout() {}, setInterval: () => 1, clearInterval() {}};
    vm.createContext(c); vm.runInContext(policySource, c);
    return {c, nodes, storage};
}
function doc(id, data) {return {id, exists: true, data: () => data};}

(async () => {
    const initial = context(), policy = initial.c.window.SharkdleLeaderboardBlacklist;
    assert.equal(policy.getReason(banned), 'Automated Scripts');
    for (const uid of newBlockedUids) {
        assert.equal(policy.getReason(uid), uid === offensiveNameUid ? 'Offensive username' : 'Cloned account data');
        assert(policy.isRecordBlacklisted({uid, username: 'New harmless name'}, 'alias'));
        assert(policy.isRecordBlacklisted({uid: 'spoofed'}, uid));
    }
    assert.equal(policy.getReason(dev), null);
    assert(!policy.isBlacklisted(dev));
    assert(policy.isRecordBlacklisted({uid: 'spoofed'}, banned));
    assert(policy.isRecordBlacklisted({uid: banned}, 'alias'));
    assert(!policy.isBlacklisted('constructor', 'other', null));
    const notice = element(); policy.renderNotice(notice, banned);
    assert(!notice.hidden && notice.textContent.includes('Automated Scripts'));
    for (const uid of [null, 'other']) {policy.renderNotice(notice, uid); assert(notice.hidden); assert.equal(notice.textContent, '');}

    for (const path of ['Leaderboard/index.html', 'SharkdleMobile/www/Leaderboard/index.html']) {
        const {c, nodes} = context(); let authCallback, queries = 0, writes = 0;
        const records = [doc(banned, {uid: 'spoofed', username: 'Excluded', wins: 1000}),
            doc('alias', {uid: banned, username: 'Alias', wins: 999}),
            doc('first', {username: 'First', wins: 30}), doc('second', {username: 'Second', wins: 20}),
            doc('self', {username: 'Self', wins: 10})];
        records.push(...newBlockedUids.map(uid => doc(uid, {uid, username: 'Renamed clone', wins: 5000})));
        function collection() {
            let limit = Infinity, after = null, where = null, order = 'wins';
            return {
                orderBy(field) {order = field; return this;}, limit(value) {limit = value; return this;},
                startAfter(value) {after = value; return this;}, where(field, op, value) {where = [field, value]; return this;},
                async get() {
                    queries++;
                    let rows = [...records].sort((a,b) => (b.data()[order] || 0) - (a.data()[order] || 0));
                    if (where) rows = rows.filter(d => d.data()[where[0]] > where[1]);
                    if (after) rows = rows.slice(rows.indexOf(after) + 1);
                    rows = rows.slice(0, limit);
                    return {docs: rows, size: rows.length, empty: !rows.length, forEach: callback => rows.forEach(callback)};
                },
                doc(id) {return {get: async () => records.find(d => d.id === id) || {exists: false}, set: async () => {writes++;}};}
            };
        }
        const auth = {currentUser: null, onAuthStateChanged: callback => {authCallback = callback;}};
        c.firebase = {apps: [{}], firestore: () => ({collection}), auth: () => auth};
        const html = fs.readFileSync(path, 'utf8');
        assert(html.includes('src="leaderboard-blacklist.js?v='));
        const inline = Array.from(html.matchAll(/<script[^>]*>([\s\S]*?)<\/script>/g), m => m[1]).find(s => s.includes('const firebaseConfig'));
        vm.runInContext(inline + `\nwindow.test = {
            candidates: getLeaderboardCandidateRows, config: getRangeConfig, today: getUtcDateKey, month: getCurrentMonthKey,
            rank: computePersonalLeaderboardRank, personal: renderPersonalLeaderboardPosition,
            history: renderPreviousWinnerList, record: recordPreviousLeaderboardWinner, reward: grantPermanentLeaderPfp,
            notice: renderLeaderboardBlacklistNotice,
            user: uid => {currentUserUID = uid; currentUserEmail = null; currentUsername = null; auth.currentUser = uid ? {uid} : null;}
        };`, c);
        const t = c.window.test;
        for (const record of records) Object.assign(record.data(), {dailyWins: record.data().wins, monthlyWins: record.data().wins, dailyWinsUtcDate: t.today(), monthlyWinsUtcKey: t.month()});
        for (const range of ['all_time', 'daily', 'monthly']) {
            const rows = await t.candidates(t.config(range), 2);
            assert.deepEqual(Array.from(rows, r => r.doc.id), ['first', 'second']); // Refill after exclusions.
        }
        t.user('self'); assert.equal((await t.rank(t.config('all_time'), [])).rank, 3);
        t.user(banned); const before = queries;
        await t.personal(t.config('all_time'), []);
        assert.equal(queries, before); assert.equal(nodes['personal-rank-position'].textContent, 'Blacklisted');
        assert(nodes['leaderboard-blacklist-notice'].textContent.includes('Automated Scripts'));
        assert.equal(await t.reward({name: 'Reward'}), false); assert.equal(writes, 0);
        assert.equal(await t.record('daily', {leaderUid: banned}, {}), null);
        t.history('daily', [{uid: banned, rangeType: 'daily', displayName: 'Excluded'}, {uid: 'first', rangeType: 'daily', displayName: 'First'}]);
        assert(!nodes['previous-daily-winners'].innerHTML.includes('Excluded'));
        assert(nodes['previous-daily-winners'].innerHTML.includes('First'));
        t.user('other'); t.notice(); assert(nodes['leaderboard-blacklist-notice'].hidden);
        t.user(null); await authCallback(null); assert(nodes['leaderboard-blacklist-notice'].hidden);
        assert.equal(nodes['leaderboard-blacklist-notice'].textContent, '');
        const devRecord = doc(dev, {uid: dev, username: 'Developer', wins: 2000, dailyWins: 2000, monthlyWins: 2000,
            dailyWinsUtcDate: t.today(), monthlyWinsUtcKey: t.month()});
        records.unshift(devRecord);
        const savedScores = JSON.stringify(devRecord.data());
        vm.runInContext(blockedSource, c);
        t.user(dev); await t.personal(t.config('all_time'), []);
        assert.equal(nodes['personal-rank-position'].textContent, 'Blacklisted');
        assert(nodes['leaderboard-blacklist-notice'].textContent.includes('Temporary developer blacklist test'));
        for (const range of ['all_time', 'daily', 'monthly']) {
            assert(!(await t.candidates(t.config(range), 2)).some(row => row.doc.id === dev));
        }
        vm.runInContext(restoredSource, c); // Remove only the temporary restriction, retaining saved records.
        for (const range of ['all_time', 'daily', 'monthly']) {
            const restored = await t.candidates(t.config(range), 2);
            assert.deepEqual(Array.from(restored, row => row.doc.id), [dev, 'first']);
            assert.equal((await t.rank(t.config(range), [])).rank, 1);
        }
        await t.personal(t.config('all_time'), []);
        assert(nodes['leaderboard-blacklist-notice'].hidden);
        assert.notEqual(nodes['personal-rank-position'].textContent, 'Blacklisted');
        assert.equal(JSON.stringify(devRecord.data()), savedScores);
        assert(c.window.SharkdleLeaderboardBlacklist.isBlacklisted(banned));
        console.log(path + ': PASS UID/alias filtering across all ranges, pagination, exact personal ranks, excluded rewards/history, authenticated-only reason and logout cleanup');
        console.log(path + ': PASS removing developer restriction restores all ranges and personal rank with saved scores unchanged');
    }

    for (const path of ['Minigames/SharkRNG/rng-mode.js', 'SharkdleMobile/www/Minigames/SharkRNG/rng-mode.js']) {
        const {c, nodes} = context(); let writes = 0;
        const auth = {currentUser: null}, db = {collection: () => ({doc: () => ({get: async () => ({exists: true, data: () => ({})}), set: async () => {writes++;}, update: async () => {writes++;}})})};
        const source = fs.readFileSync(path, 'utf8').replace('    window.initRngMode = initRngMode;', `window.test = {
            normalize: normalizeRngLeaderboardRow, merge: mergeRngLeaderboardRows, render: renderRngLeaderboardRows,
            self: renderRngLeaderboardSelf, sync: syncRngLeaderboardEntry, cloud: buildRngCloudProfilePayload,
            user: (uid, auth, db) => {auth.currentUser = uid ? {uid} : null; rngLeaderboardAuth = auth; rngLeaderboardDb = db; rngLeaderboardUser = auth.currentUser; rngProfileOwnerUid = rngCloudHydratedUid = uid;}
        };`);
        vm.runInContext(source, c); const t = c.window.test;
        assert.equal(t.normalize(doc(banned, {uid: 'spoofed', bestOneIn: 1e30})), null);
        assert.equal(t.normalize(doc('alias', {uid: banned, rngBestOneIn: 1e30}), 'userStats'), null);
        const eligible = t.normalize(doc('first', {username: 'First', bestOneIn: 1000}));
        const rows = t.merge([{uid: banned, username: 'Excluded', bestOneIn: 1e30}, eligible]);
        assert.equal(rows.length, 1); t.render([{uid: banned, username: 'Excluded'}, ...rows]);
        assert(!nodes['rng-leaderboard-list'].innerHTML.includes('Excluded')); assert(nodes['rng-leaderboard-list'].innerHTML.includes('#1'));
        t.user(banned, auth, db); t.self(); assert(nodes['rng-leaderboard-blacklist-notice'].textContent.includes('Automated Scripts'));
        assert.equal(await t.sync(), false); assert.equal(writes, 0);
        for (const uid of newBlockedUids) {
            t.user(uid, auth, db);
            assert.equal(t.normalize(doc(uid, {uid, username: 'Renamed clone', bestOneIn: 1e30})), null);
            assert.equal(t.normalize(doc('alias', {uid, username: 'Renamed clone', rngBestOneIn: 1e30}), 'userStats'), null);
            assert.equal(await t.sync(), false);
        }
        assert.equal(writes, 0);
        assert(t.cloud().metadata); // Private save remains available.
        for (const uid of ['other', null]) {t.user(uid, auth, db); t.self(); assert(nodes['rng-leaderboard-blacklist-notice'].hidden); assert.equal(nodes['rng-leaderboard-blacklist-notice'].textContent, '');}
        const devRecord = doc(dev, {uid: dev, username: 'Developer', bestOneIn: 123456});
        const savedScores = JSON.stringify(devRecord.data());
        vm.runInContext(blockedSource, c);
        t.user(dev, auth, db); t.self();
        assert(nodes['rng-leaderboard-blacklist-notice'].textContent.includes('Temporary developer blacklist test'));
        assert.equal(t.normalize(devRecord), null);
        assert.equal(await t.sync(), false); assert.equal(writes, 0);
        vm.runInContext(restoredSource, c);
        const restored = t.normalize(devRecord);
        assert.equal(restored.uid, dev); assert.equal(restored.bestOneIn, 123456);
        t.render(t.merge([restored, eligible]));
        assert(nodes['rng-leaderboard-list'].innerHTML.includes('Developer'));
        t.self(); assert(nodes['rng-leaderboard-blacklist-notice'].hidden);
        assert.equal(await t.sync(), true); assert.equal(writes, 2);
        assert.equal(JSON.stringify(devRecord.data()), savedScores);
        assert(c.window.SharkdleLeaderboardBlacklist.isBlacklisted(banned));
        console.log(path + ': PASS dedicated/fallback/forged-UID filtering, contiguous ranks, blocked publication, private save retained, reason only for signed-in restricted account');
        console.log(path + ': PASS removing developer restriction restores saved RNG ranking, clears notice and resumes publication');
    }
    const rules = fs.readFileSync('firestore.rules', 'utf8');
    const ruleUids = Array.from(rules.match(/function isLeaderboardBlacklisted\(userId\)\s*\{([\s\S]*?)\}/)[1].matchAll(/'([^']+)'/g), match => match[1]);
    assert(ruleUids.includes(banned)); assert(!ruleUids.includes(dev));
    for (const uid of ruleUids) assert(policy.isBlacklisted(uid));
    assert.deepEqual([...ruleUids].sort(), [banned, ...newBlockedUids].sort());
    const documentedUids = Array.from(fs.readFileSync('LeaderboardBlacklist.txt', 'utf8').matchAll(/UserId = ([^,\s]+)/g), match => match[1]);
    assert.deepEqual(documentedUids.sort(), [...ruleUids].sort());
    assert(rules.includes('&& !isLeaderboardBlacklisted(userId)'));
    assert(rules.includes('&& !isLeaderboardBlacklisted(request.resource.data.uid)'));
    assert(rules.includes('!hasRngLeaderboardFields(request.resource.data.keys())'));
    assert(rules.includes('!hasRngLeaderboardFields(request.resource.data.diff(resource.data).affectedKeys())'));
    console.log('Blacklist configuration and Firestore publication restrictions match.');
})().catch(error => {console.error(error); process.exitCode = 1;});
