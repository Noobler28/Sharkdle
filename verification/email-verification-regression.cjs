const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');

async function check(path) {
    const source = fs.readFileSync(path, 'utf8');
    new vm.Script(source);
    const calls = [];
    const fields = Object.fromEntries(['login-email', 'login-password', 'signup-email', 'signup-password', 'signup-username', 'auth-error'].map(id => [id, { value: id.includes('email') ? 'player@example.com' : 'test123', style: {} }]));
    const user = {
        uid: 'pending', emailVerified: false,
        updateProfile: async () => calls.push('name'),
        sendEmailVerification: async () => calls.push('email'),
        getIdToken: async () => calls.push('token')
    };
    const context = vm.createContext({
        document: { getElementById: id => fields[id], querySelector: () => null },
        auth: {
            createUserWithEmailAndPassword: async () => ({ user }),
            signInWithEmailAndPassword: async () => ({ user }),
            signOut: async () => calls.push('signout')
        },
        showNotification: () => {}, switchToLogin: () => {},
        closeLoginModal: () => calls.push('close'),
        db: { collection: () => { throw new Error('Unverified profile access'); } }
    });
    for (const [start, end] of [
        ['function getFriendlyAuthErrorMessage(', '\nfunction loginUser('],
        ['function loginUser(', '\nasync function forgotPassword('],
        ['async function signupUser(', '\nasync function logoutUser('],
        ['async function ensureAuthUserProfile(', '\nfunction getFriendlyAuthErrorMessage(']
    ]) vm.runInContext(source.slice(source.indexOf(start), source.indexOf(end, source.indexOf(start))), context);

    await context.signupUser();
    assert.deepEqual(calls, ['name', 'email', 'signout']);
    assert.match(fields['auth-error'].textContent, /Verification email sent/);
    assert.equal(await context.ensureAuthUserProfile(user), false);
    calls.length = 0;
    context.loginUser();
    await new Promise(resolve => setImmediate(resolve));
    assert.deepEqual(calls, ['email', 'signout']);
    assert.match(fields['auth-error'].textContent, /Verify your email/);
    calls.length = 0;
    user.sendEmailVerification = async () => { throw { code: 'auth/too-many-requests' }; };
    context.loginUser();
    await new Promise(resolve => setImmediate(resolve));
    assert.deepEqual(calls, ['signout']);
    calls.length = 0;
    user.emailVerified = true;
    context.loginUser();
    await new Promise(resolve => setImmediate(resolve));
    assert.deepEqual(calls, ['token', 'close']);
    assert.match(source, /const user = authUser\?\.emailVerified === true \? authUser : null/);
}

(async () => {
    await check('script.js');
    await check('SharkdleMobile/www/script.js');
    const rules = fs.readFileSync('firestore.rules', 'utf8');
    assert.match(rules, /request.auth.token.email_verified == true/);
    assert.equal((rules.match(/request.auth != null/g) || []).length, 1);
    console.log('Email verification regression checks passed for web and mobile.');
})().catch(error => { console.error(error); process.exitCode = 1; });
