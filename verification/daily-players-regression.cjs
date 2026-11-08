const fs = require('node:fs');
const vm = require('node:vm');
const assert = require('node:assert/strict');

(async () => {
    for (const file of ['script.js', 'SharkdleMobile/www/script.js']) {
        const source = fs.readFileSync(file, 'utf8');
        const day = '2026-11-08';
        const state = (date = day, guesses = [{}]) => ({ date, guesses });
        const accounts = {
            winner: { ...state(), won: true, completed: true },
            loser: { ...state(), won: false, completed: true },
            unfinished: state(),
            multiple: { ...state(), modes: { rays: state(), mixed: state() } },
            relatives: { modes: { rays: state() } },
            mixed: { ...state('2026-11-07'), modes: { mixed: state() } },
            empty: state(day, []),
            revealedOnly: { ...state(day, []), categoryReveal: { key: 'order' } },
            missing: { date: day },
            yesterday: state('2026-11-07'),
            oldVariants: { ...state(day, []), modes: { rays: state('2026-11-07') } }
        };
        let queries = [];
        const context = {
            getUtcDateKey: () => day,
            db: { collection: name => {
                assert.equal(name, 'userDaily');
                return { where: (field, op, value) => {
                    assert.equal(op, '=='); queries.push([field, value]);
                    return { get: async () => ({ docs: Object.entries(accounts)
                        .filter(([, data]) => field.split('.').reduce((value, key) => value?.[key], data) === value)
                        .map(([id, data]) => ({ id, data: () => data })) }) };
                } };
            } }
        };
        vm.createContext(context);
        vm.runInContext(source.slice(source.indexOf('async function getAdminDailyPlayerCount('), source.indexOf('async function refreshAdminVisitorInsights(')), context);
        assert.equal(await context.getAdminDailyPlayerCount(), 6, 'Count unique players across all variants, including losses and unfinished games');
        assert.equal(queries.length, 3);
        queries = [];
        assert.equal(await context.getAdminDailyPlayerCount('2026-11-06'), 0);
        context.db.collection = () => ({ where: () => ({ get: async () => { throw Error('permission-denied'); } }) });
        await assert.rejects(context.getAdminDailyPlayerCount(), /permission-denied/, 'Do not display a failed request as zero players');
        console.log(`${file}: daily participation deduplication and failure checks passed`);
    }
})().catch(error => { console.error(error); process.exitCode = 1; });
