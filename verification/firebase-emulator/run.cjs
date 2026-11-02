const fs = require('node:fs');
const path = require('node:path');
const { spawn } = require('node:child_process');
fs.copyFileSync(path.resolve(__dirname, '../../firestore.rules'), path.join(__dirname, 'firestore.rules'));
const cli = path.join(__dirname, 'node_modules/firebase-tools/lib/bin/firebase.js');
const child = spawn(process.execPath, [cli, 'emulators:exec', '--only', 'firestore',
    '--project', 'demo-sharkdle-stress', '--config', 'firebase.json',
    'node --max-old-space-size=2048 rules-tests.cjs'], {
    cwd: __dirname, stdio: 'inherit', windowsHide: true
});
child.on('error', error => { console.error(error); process.exitCode = 1; });
child.on('exit', (code, signal) => { process.exitCode = signal ? 1 : (code ?? 1); });
