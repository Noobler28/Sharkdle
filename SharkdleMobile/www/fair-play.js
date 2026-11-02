(function () {
    "use strict";

    let reportsUnsubscribe = null;
    let authUnsubscribe = null;
    let adminSession = 0;

    function getUser() {
        return typeof firebase !== 'undefined' && firebase.auth ? firebase.auth().currentUser : null;
    }

    function startRound(mode, pool, roundId) {
        return {mode, pool, roundId, startedAt: performance.now(), observedGuesses: 0, uid: undefined, accountChanged: false, sent: false};
    }

    function noteGuess(round) {
        if (!round || round.sent) return;
        const uid = getUser()?.uid || null;
        if (round.uid === undefined) round.uid = uid;
        else if (round.uid !== uid) round.accountChanged = true;
        round.observedGuesses++;
    }

    async function finishRound(round, won, guesses) {
        if (!round || round.sent) return false;
        const user = getUser();
        if (!user?.emailVerified || round.accountChanged || round.uid !== user.uid
            || !Number.isInteger(guesses) || guesses < 1 || guesses > 12) return false;
        round.sent = true;
        const elapsed = Math.round(performance.now() - round.startedAt);
        const payload = {
            uid: user.uid, mode: round.mode, pool: round.pool, roundId: round.roundId,
            won: Boolean(won), guesses,
            elapsedMs: round.observedGuesses === guesses && elapsed >= 0 && elapsed <= 86400000 ? elapsed : null,
            createdAt: firebase.firestore.FieldValue.serverTimestamp()
        };
        try {
            const db = firebase.firestore();
            const ref = db.collection('fairPlayPlayers').doc(user.uid).collection('rounds').doc(round.roundId);
            await db.runTransaction(async transaction => {
                const existing = await transaction.get(ref);
                if (!existing.exists) transaction.set(ref, payload);
            });
            return true;
        } catch (error) {
            // This optional signal must never interfere with a result, reward or private save.
            round.sent = false;
            console.warn('Fair play observation could not be saved:', error.code || error.message);
            return false;
        }
    }

    function isDeveloper() {
        const user = getUser();
        return user?.emailVerified && typeof isDeveloperUid === 'function' && isDeveloperUid(user.uid);
    }

    function setStatus(message) {
        const status = document.getElementById('admin-fair-play-status');
        if (status) status.textContent = message;
    }

    function renderReports(reports) {
        const list = document.getElementById('admin-fair-play-list');
        if (!list) return;
        list.replaceChildren();
        for (const report of reports.sort((a, b) => b.lastReceivedAtMs - a.lastReceivedAtMs)) {
            const card = document.createElement('article');
            card.className = 'fair-play-report';
            const name = document.createElement('strong');
            name.textContent = report.username || 'Player';
            const uid = document.createElement('code');
            uid.textContent = report.uid;
            const summary = document.createElement('p');
            summary.textContent = `${report.sampleSize} recent games observed · ${report.oneGuessWins} one-guess wins · Needs review`;
            const reasons = document.createElement('ul');
            for (const reason of report.reasons || []) {
                const item = document.createElement('li');
                item.textContent = reason.message;
                reasons.appendChild(item);
            }
            card.append(name, uid, summary, reasons);
            list.appendChild(card);
        }
        if (!reports.length) list.textContent = 'No accounts currently flagged in the review queue.';
    }

    function stopAdminReview() {
        adminSession++;
        if (reportsUnsubscribe) reportsUnsubscribe();
        if (authUnsubscribe) authUnsubscribe();
        reportsUnsubscribe = authUnsubscribe = null;
        document.getElementById('admin-fair-play-list')?.replaceChildren();
        setStatus('Open this panel to load private reports.');
    }

    function startAdminReview() {
        stopAdminReview();
        if (!isDeveloper()) return;
        const uid = getUser().uid;
        const session = adminSession;
        setStatus('Loading automatic checks…');
        authUnsubscribe = firebase.auth().onAuthStateChanged(user => {
            if (user?.uid !== uid || !isDeveloper()) stopAdminReview();
        });
        reportsUnsubscribe = firebase.firestore().collection('fairPlayReports').where('status', '==', 'review').limit(50)
            .onSnapshot(snapshot => {
                if (session !== adminSession || !isDeveloper() || getUser()?.uid !== uid) return;
                renderReports(snapshot.docs.map(doc => ({...doc.data(), uid: doc.id})));
                setStatus(`${snapshot.size} flagged account${snapshot.size === 1 ? '' : 's'} shown (up to 50). Checks require 20 observed games per mode. Flags do not blacklist players.`);
            }, error => {
                if (session !== adminSession) return;
                setStatus(error.code === 'permission-denied'
                    ? 'Reports are unavailable. Publish the updated Firestore rules and confirm developer access.'
                    : 'Reports could not load. Try reopening this panel.');
            });
    }

    window.SharkdleFairPlay = Object.freeze({startRound, noteGuess, finishRound, startAdminReview, stopAdminReview});
})();
