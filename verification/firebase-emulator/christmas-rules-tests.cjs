const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
const { initializeTestEnvironment, assertSucceeds, assertFails } = require('@firebase/rules-unit-testing');
const { doc, setDoc, getDoc, serverTimestamp, updateDoc } = require('firebase/firestore');
let env;
(async () => {
    const rules = fs.readFileSync(path.resolve(__dirname, '../../firestore.rules'), 'utf8');
    env = await initializeTestEnvironment({ projectId: 'demo-sharkdle-christmas', firestore: { host: '127.0.0.1', port: 8787, rules } });
    await env.clearFirestore();
    const a = env.authenticatedContext('calendar-a', { email_verified: true }).firestore();
    const b = env.authenticatedContext('calendar-b', { email_verified: true }).firestore();
    const developer = env.authenticatedContext('ETPtQC0VA2NiSnX67rS2P2ma2tC2', { email_verified: true }).firestore();
    const guest = env.unauthenticatedContext().firestore();
    const unverified = env.authenticatedContext('calendar-a', { email_verified: false }).firestore();
    const config = { part: 2, updatedBy: 'ETPtQC0VA2NiSnX67rS2P2ma2tC2', updatedAt: serverTimestamp() };
    await assertSucceeds(setDoc(doc(developer, 'globalConfig/christmasEvent'), config));
    await assertSucceeds(getDoc(doc(guest, 'globalConfig/christmasEvent')));
    await assertFails(setDoc(doc(a, 'globalConfig/christmasEvent'), { ...config, updatedBy: 'calendar-a' }));
    await assertFails(setDoc(doc(developer, 'globalConfig/christmasEvent'), { ...config, part: 3 }));
    await assertFails(setDoc(doc(developer, 'globalConfig/christmasEvent'), { ...config, previewDay: 1 }));

    // The production rules compile as-is. Shift only the calendar's month in this
    // isolated test project so today's emulator clock can exercise successful claims.
    const now = new Date(), day = now.getUTCDate(), year = now.getUTCFullYear(), month = now.getUTCMonth() + 1;
    const begin = rules.indexOf('      // One calendar win receipt');
    const end = rules.indexOf('    // Full Sharkdle profile saves.', begin);
    assert(begin > 0 && end > begin);
    if (day <= 25) {
        const calendar = rules.slice(begin, end).replaceAll('2026, 12', `${year}, ${month}`);
        await env.cleanup();
        env = await initializeTestEnvironment({ projectId: 'demo-sharkdle-christmas', firestore: {
            host: '127.0.0.1', port: 8787, rules: rules.slice(0, begin) + calendar + rules.slice(end) } });
        const a = env.authenticatedContext('calendar-a', { email_verified: true }).firestore();
        const b = env.authenticatedContext('calendar-b', { email_verified: true }).firestore();
        const guest = env.unauthenticatedContext().firestore();
        const unverified = env.authenticatedContext('calendar-a', { email_verified: false }).firestore();
        const winPath = `userStats/calendar-a/christmasCalendarWins/${day}`;
        const claimPath = `userStats/calendar-a/christmasCalendarClaims/${day}`;
        const win = { uid: 'calendar-a', day, mode: 'infinite', wonAt: serverTimestamp() };
        const claim = { uid: 'calendar-a', day, claimedAt: serverTimestamp() };
        await assertFails(setDoc(doc(a, claimPath), claim));
        await assertFails(setDoc(doc(b, winPath), win));
        await assertFails(setDoc(doc(guest, winPath), win));
        await assertFails(setDoc(doc(unverified, winPath), win));
        await assertSucceeds(setDoc(doc(a, winPath), win));
        await assertFails(updateDoc(doc(a, winPath), { mode: 'daily' }));
        await assertFails(getDoc(doc(b, winPath)));
        await assertSucceeds(setDoc(doc(a, claimPath), claim));
        await assertFails(setDoc(doc(a, claimPath), claim));
        await assertFails(updateDoc(doc(a, claimPath), { day: day + 1 }));
        if (day < 25) await assertFails(setDoc(doc(a, `userStats/calendar-a/christmasCalendarWins/${day + 1}`), { ...win, day: day + 1 }));
        if (day > 1) await assertFails(setDoc(doc(a, `userStats/calendar-a/christmasCalendarWins/${day - 1}`), { ...win, day: day - 1 }));
        await assertFails(setDoc(doc(a, 'userStats/calendar-a/christmasCalendarWins/0'), { ...win, day: 0 }));
        await assertFails(setDoc(doc(a, 'userStats/calendar-a/christmasCalendarWins/26'), { ...win, day: 26 }));
    }
    console.log('PASS Christmas rules: admin-only part switch, private win records, win-gated gifts, immutable claims and daily date enforcement');
})().catch(error => { console.error(error); process.exitCode = 1; }).finally(async () => { if (env) await env.cleanup(); });
