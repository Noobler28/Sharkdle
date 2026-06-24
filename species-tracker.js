(function () {
    const COLLECTION_NAME = "userSpeciesStats";
    const PENDING_STORAGE_KEY = "sharkdle_species_tracker_pending_v1";
    const MAX_STORED_CONFUSIONS = 20;
    const MAX_TOP_CONFUSIONS = 3;
    const MASTERY_TARGET = 5;
    const CATEGORY_LABELS = Object.freeze({
        family: "Family",
        order: "Order",
        genus: "Genus",
        size: "Size",
        habitat: "Depth",
        yod: "Discovery Year"
    });

    function toDocumentId(value, fallback = "unknown") {
        const normalized = String(value || "")
            .trim()
            .toLowerCase()
            .replace(/[^a-z0-9]+/g, "-")
            .replace(/^-+|-+$/g, "")
            .slice(0, 120);
        return normalized || fallback;
    }

    function createRoundId(mode, seed = "") {
        const prefix = toDocumentId(mode, "round");
        if (seed) return toDocumentId(`${prefix}-${seed}`, prefix);

        const randomPart = typeof crypto !== "undefined" && typeof crypto.randomUUID === "function"
            ? crypto.randomUUID()
            : `${Date.now()}-${Math.random().toString(36).slice(2, 12)}`;
        return toDocumentId(`${prefix}-${randomPart}`, prefix);
    }

    function normalizeSpecies(value) {
        const species = value?.shark || value?.species || value;
        if (typeof species === "string") {
            return { id: toDocumentId(species), name: species };
        }
        const name = String(species?.name || "").trim();
        return name ? { id: toDocumentId(name), name } : null;
    }

    function normalizeCategoryKey(value) {
        const key = String(value || "")
            .trim()
            .toLowerCase()
            .replace(/[^a-z0-9]+/g, "");
        const aliases = {
            family: "family",
            order: "order",
            genus: "genus",
            size: "size",
            habitat: "habitat",
            depth: "habitat",
            yod: "yod",
            yearofdiscovery: "yod",
            discoveryyear: "yod"
        };
        return aliases[key] || null;
    }

    function countCategoryMistakes(categoryResults) {
        const mistakes = {};
        (Array.isArray(categoryResults) ? categoryResults : []).forEach(result => {
            if (Array.isArray(result)) {
                result.forEach(item => {
                    const key = normalizeCategoryKey(item?.category);
                    if (key && item?.correct === false) mistakes[key] = (mistakes[key] || 0) + 1;
                });
                return;
            }
            if (!result || typeof result !== "object") return;
            Object.entries(result).forEach(([category, correct]) => {
                const key = normalizeCategoryKey(category);
                if (key && correct === false) mistakes[key] = (mistakes[key] || 0) + 1;
            });
        });
        return mistakes;
    }

    function normalizeRound(payload) {
        const target = normalizeSpecies(payload?.targetSpecies);
        if (!target) throw new Error("A target species is required.");

        const mode = toDocumentId(payload?.mode, "unknown");
        const generatedRoundId = createRoundId(mode);
        const guesses = Array.isArray(payload?.guesses)
            ? payload.guesses.map(normalizeSpecies).filter(Boolean)
            : [];
        const guessesTaken = Math.max(0, Number(payload?.guessesTaken) || guesses.length);
        const wrongGuesses = guesses.filter(guess => guess.id !== target.id);
        const categoryMistakes = countCategoryMistakes(payload?.categoryResults);

        return {
            mode,
            roundId: toDocumentId(payload?.roundId || generatedRoundId, generatedRoundId),
            target,
            won: Boolean(payload?.won),
            guessesTaken,
            wrongGuesses,
            categoryMistakes
        };
    }

    function mergeConfusions(existingConfusions, wrongGuesses) {
        const merged = {};
        if (existingConfusions && typeof existingConfusions === "object") {
            Object.entries(existingConfusions).forEach(([id, value]) => {
                const name = String(value?.name || "").trim();
                const count = Math.max(0, Number(value?.count) || 0);
                if (name && count) merged[toDocumentId(id || name)] = { name, count };
            });
        }

        wrongGuesses.forEach(guess => {
            const current = merged[guess.id] || { name: guess.name, count: 0 };
            merged[guess.id] = {
                name: guess.name,
                count: current.count + 1
            };
        });

        const ranked = Object.entries(merged)
            .sort(([, a], [, b]) => b.count - a.count || a.name.localeCompare(b.name))
            .slice(0, MAX_STORED_CONFUSIONS);

        return {
            confusionCounts: Object.fromEntries(ranked),
            topConfusions: ranked.slice(0, MAX_TOP_CONFUSIONS).map(([id, value]) => ({
                id,
                name: value.name,
                count: value.count
            }))
        };
    }

    function getPendingRounds() {
        try {
            const parsed = JSON.parse(localStorage.getItem(PENDING_STORAGE_KEY) || "[]");
            return Array.isArray(parsed) ? parsed : [];
        } catch (error) {
            console.warn("Unable to read pending species tracker rounds.", error);
            return [];
        }
    }

    function savePendingRounds(rounds) {
        localStorage.setItem(PENDING_STORAGE_KEY, JSON.stringify(rounds.slice(-30)));
    }

    function queuePendingRound(uid, round) {
        const pending = getPendingRounds();
        const key = `${uid}:${round.roundId}`;
        const withoutDuplicate = pending.filter(item => `${item.uid}:${item.round?.roundId}` !== key);
        withoutDuplicate.push({ uid, round });
        savePendingRounds(withoutDuplicate);
    }

    async function writeRound(uid, round) {
        const database = firebase.firestore();
        const userRef = database.collection(COLLECTION_NAME).doc(uid);
        const speciesRef = userRef.collection("species").doc(round.target.id);
        const roundRef = userRef.collection("rounds").doc(round.roundId);
        const timestamp = firebase.firestore.FieldValue.serverTimestamp();

        return database.runTransaction(async transaction => {
            const [roundSnapshot, speciesSnapshot] = await Promise.all([
                transaction.get(roundRef),
                transaction.get(speciesRef)
            ]);

            if (roundSnapshot.exists) return { duplicate: true };

            const current = speciesSnapshot.exists ? (speciesSnapshot.data() || {}) : {};
            const gamesPlayed = Math.max(0, Number(current.gamesPlayed) || 0) + 1;
            const wins = Math.max(0, Number(current.wins) || 0) + (round.won ? 1 : 0);
            const losses = Math.max(0, Number(current.losses) || 0) + (round.won ? 0 : 1);
            const totalGuesses = Math.max(0, Number(current.totalGuesses) || 0) + round.guessesTaken;
            const currentBest = Number(current.bestWin);
            const bestWin = round.won
                ? (currentBest > 0 ? Math.min(currentBest, round.guessesTaken) : round.guessesTaken)
                : (currentBest > 0 ? currentBest : null);
            const confusionData = mergeConfusions(current.confusionCounts, round.wrongGuesses);
            const categoryMistakes = {};
            Object.keys(CATEGORY_LABELS).forEach(key => {
                categoryMistakes[key] = Math.max(0, Number(current.categoryMistakes?.[key]) || 0)
                    + Math.max(0, Number(round.categoryMistakes?.[key]) || 0);
            });
            const weakestCategoryEntry = Object.entries(categoryMistakes)
                .sort(([, a], [, b]) => b - a)
                .find(([, count]) => count > 0);
            const weakestCategory = weakestCategoryEntry
                ? {
                    key: weakestCategoryEntry[0],
                    label: CATEGORY_LABELS[weakestCategoryEntry[0]],
                    mistakes: weakestCategoryEntry[1]
                }
                : null;
            const modes = current.modes && typeof current.modes === "object" ? { ...current.modes } : {};
            const currentMode = modes[round.mode] && typeof modes[round.mode] === "object"
                ? modes[round.mode]
                : {};
            modes[round.mode] = {
                gamesPlayed: Math.max(0, Number(currentMode.gamesPlayed) || 0) + 1,
                wins: Math.max(0, Number(currentMode.wins) || 0) + (round.won ? 1 : 0),
                losses: Math.max(0, Number(currentMode.losses) || 0) + (round.won ? 0 : 1)
            };

            transaction.set(userRef, {
                schemaVersion: 2,
                lastMode: round.mode,
                updatedAt: timestamp
            }, { merge: true });

            transaction.set(speciesRef, {
                speciesId: round.target.id,
                name: round.target.name,
                gamesPlayed,
                wins,
                losses,
                totalGuesses,
                bestWin,
                winRate: gamesPlayed ? Math.round((wins / gamesPlayed) * 100) : 0,
                masteryTarget: MASTERY_TARGET,
                masteryProgress: Math.min(wins, MASTERY_TARGET),
                masteryComplete: wins >= MASTERY_TARGET,
                confusionCounts: confusionData.confusionCounts,
                topConfusions: confusionData.topConfusions,
                categoryMistakes,
                weakestCategory,
                modes,
                lastPlayedAt: timestamp,
                updatedAt: timestamp
            });

            transaction.set(roundRef, {
                roundId: round.roundId,
                mode: round.mode,
                targetSpeciesId: round.target.id,
                targetSpeciesName: round.target.name,
                won: round.won,
                guessesTaken: round.guessesTaken,
                wrongGuesses: round.wrongGuesses.map(guess => ({
                    id: guess.id,
                    name: guess.name
                })),
                categoryMistakes: round.categoryMistakes,
                completedAt: timestamp
            });

            return { duplicate: false };
        });
    }

    async function recordRound(payload) {
        if (typeof firebase === "undefined" || !firebase.auth || !firebase.firestore) return false;
        const user = firebase.auth().currentUser;
        if (!user) return false;

        const round = normalizeRound(payload);
        try {
            await writeRound(user.uid, round);
            return true;
        } catch (error) {
            queuePendingRound(user.uid, round);
            console.warn("Species history will retry when the connection is available.", error);
            return false;
        }
    }

    async function flushPendingRounds() {
        if (typeof firebase === "undefined" || !firebase.auth || !firebase.firestore) return;
        const user = firebase.auth().currentUser;
        if (!user) return;

        const pending = getPendingRounds();
        const remaining = [];
        for (const item of pending) {
            if (item.uid !== user.uid) {
                remaining.push(item);
                continue;
            }
            try {
                await writeRound(user.uid, item.round);
            } catch (error) {
                remaining.push(item);
            }
        }
        savePendingRounds(remaining);
    }

    async function loadSpeciesStats() {
        if (typeof firebase === "undefined" || !firebase.auth || !firebase.firestore) return new Map();
        const user = firebase.auth().currentUser;
        if (!user) return new Map();

        const snapshot = await firebase.firestore()
            .collection(COLLECTION_NAME)
            .doc(user.uid)
            .collection("species")
            .get();
        const stats = new Map();
        snapshot.forEach(doc => stats.set(doc.id, doc.data() || {}));
        return stats;
    }

    let retryListenersReady = false;
    let retryListenerAttempts = 0;
    function setupRetryListeners() {
        if (retryListenersReady) return;
        if (typeof firebase === "undefined" || !firebase.auth) {
            if (retryListenerAttempts++ < 20) setTimeout(setupRetryListeners, 100);
            return;
        }
        try {
            firebase.auth().onAuthStateChanged(user => {
                if (user) flushPendingRounds();
            });
            window.addEventListener("online", flushPendingRounds);
            retryListenersReady = true;
        } catch (error) {
            if (retryListenerAttempts++ < 20) setTimeout(setupRetryListeners, 100);
        }
    }

    window.SharkdleSpeciesTracker = Object.freeze({
        collectionName: COLLECTION_NAME,
        masteryTarget: MASTERY_TARGET,
        createRoundId,
        getSpeciesId: toDocumentId,
        recordRound,
        flushPendingRounds,
        loadSpeciesStats
    });

    setupRetryListeners();
})();
