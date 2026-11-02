const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const { performance } = require('node:perf_hooks');
const root = path.resolve(__dirname, '..');
const tests = fs.readdirSync(__dirname).filter(file => file.endsWith('-regression.cjs')).sort();
const results = [];
for (const test of [...tests, 'project-audit.cjs']) {
    const env = { ...process.env };
    delete env.RNG_LARGE_COUNT;
    if (test === 'rng-balance-regression.cjs') env.RNG_BALANCE_DRAWS = '250000';
    const started = performance.now();
    const run = spawnSync(process.execPath, [path.join(__dirname, test)], {
        cwd: root, env, encoding: 'utf8', timeout: 60000, maxBuffer: 6 * 1024 * 1024,
        windowsHide: true
    });
    const result = { test, passed: run.status === 0 && !run.error,
        milliseconds: Math.round(performance.now() - started),
        output: (run.stdout || '') + (run.stderr || '') + (run.error ? run.error.message : '') };
    results.push(result);
    console.log((result.passed ? 'PASS ' : 'FAIL ') + test + ' (' + result.milliseconds + 'ms)');
    if (!result.passed) console.log(result.output.slice(0, 8000));
}
const report = { total: results.length, passed: results.filter(result => result.passed).length,
    failed: results.filter(result => !result.passed).length, results };
fs.writeFileSync(path.join(__dirname, 'stress-results.json'), JSON.stringify(report, null, 2) + '\n');
console.log('Completed: ' + report.passed + '/' + report.total + ' checks passed.');
if (report.failed) process.exitCode = 1;
