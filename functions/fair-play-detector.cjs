"use strict";

const SAMPLE_LIMIT = 100;
const MIN_SAMPLE = 20;

// These are review signals, never probabilities of cheating or grounds for an automatic ban.
function analyzeRounds(input) {
    const seen = new Set();
    const rounds = input.filter(round => {
        if (!round || seen.has(round.roundId) || !['daily', 'infinite'].includes(round.mode)
            || !['sharks', 'rays', 'mixed'].includes(round.pool) || typeof round.won !== 'boolean'
            || !Number.isInteger(round.guesses) || round.guesses < 1 || round.guesses > 12
            || !Number.isFinite(round.receivedAtMs) || round.receivedAtMs <= 0) return false;
        seen.add(round.roundId);
        return true;
    }).sort((a, b) => b.receivedAtMs - a.receivedAtMs || a.roundId.localeCompare(b.roundId)).slice(0, SAMPLE_LIMIT);
    const reasons = [];
    for (const mode of ['daily', 'infinite']) {
        const sample = rounds.filter(round => round.mode === mode);
        if (sample.length < MIN_SAMPLE) continue;
        const wins = sample.filter(round => round.won);
        const oneGuess = wins.filter(round => round.guesses === 1).length;
        const label = mode === 'daily' ? 'Daily' : 'Infinite';
        if (wins.length >= 15 && oneGuess / wins.length >= 0.8) {
            reasons.push({code: `${mode}-one-guess`, message: `${label}: ${oneGuess} of ${wins.length} observed wins took one guess (${sample.length} games).`});
        }
        // A reload or partial game has unknown timing and must not count as a quick result.
        const timed = wins.filter(round => Number.isInteger(round.elapsedMs) && round.elapsedMs >= 0);
        const fast = timed.filter(round => round.elapsedMs < 1500).length;
        if (timed.length >= MIN_SAMPLE && fast >= 10 && fast / timed.length >= 0.7) {
            reasons.push({code: `${mode}-fast`, message: `${label}: ${fast} of ${timed.length} timed wins finished in under 1.5 seconds. Times are browser-reported.`});
        }
        if (mode === 'infinite' && timed.length >= MIN_SAMPLE) {
            const durations = timed.slice(0, MIN_SAMPLE).map(round => round.elapsedMs);
            const mean = durations.reduce((sum, value) => sum + value, 0) / durations.length;
            const deviation = Math.sqrt(durations.reduce((sum, value) => sum + (value - mean) ** 2, 0) / durations.length);
            if (mean >= 1500 && mean <= 60000 && deviation / mean < 0.01) {
                reasons.push({code: 'infinite-timing', message: `Infinite: the last ${MIN_SAMPLE} timed wins had nearly identical durations (about ${(mean / 1000).toFixed(1)} seconds). Times are browser-reported.`});
            }
        }
    }
    return {
        version: 1,
        status: reasons.length ? 'review' : 'clear',
        reasons,
        sampleSize: rounds.length,
        wins: rounds.filter(round => round.won).length,
        oneGuessWins: rounds.filter(round => round.won && round.guesses === 1).length,
        firstReceivedAtMs: rounds.at(-1)?.receivedAtMs || 0,
        lastReceivedAtMs: rounds[0]?.receivedAtMs || 0,
        evidence: 'Player-submitted results; signals require human review.'
    };
}

// Recompute a bounded window instead of incrementing counters. Duplicate deliveries,
// retries and events arriving out of order cannot inflate the evidence.
async function processRound(db, uid) {
    const reportRef = db.collection('fairPlayReports').doc(uid);
    const query = db.collection('fairPlayPlayers').doc(uid).collection('rounds').orderBy('createdAt', 'desc').limit(SAMPLE_LIMIT);
    return db.runTransaction(async transaction => {
        const previous = await transaction.get(reportRef);
        const snapshot = await transaction.get(query);
        const profile = await transaction.get(db.collection('userStats').doc(uid));
        const rounds = snapshot.docs.map(doc => {
            const data = doc.data();
            return {...data, roundId: doc.id, receivedAtMs: data.createdAt?.toMillis?.() || 0};
        });
        const analysis = analyzeRounds(rounds);
        const report = {
            ...analysis, uid,
            username: String(profile.data()?.username || `Player ${uid.slice(0, 6)}`).slice(0, 80)
        };
        if (previous.exists && JSON.stringify(previous.data()) === JSON.stringify(report)) return false;
        transaction.set(reportRef, report);
        return true;
    });
}

module.exports = {analyzeRounds, processRound, SAMPLE_LIMIT, MIN_SAMPLE};
