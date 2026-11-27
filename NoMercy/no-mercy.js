// Dedicated No Mercy game script, based on Daily's shared guessing implementation.
// Get today's date in UTC (same puzzle for all users globally)
function getTodayInLocalTimezone() {
    const now = new Date();
    const year = now.getUTCFullYear();
    const month = String(now.getUTCMonth() + 1).padStart(2, '0');
    const day = String(now.getUTCDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
}

function getRequestedSpeciesMode() {
    return "nightmare";
}

const HERO_ART = {
    sharkBg: "images/home-v3/shark-bg.png",
    sharkFg: "images/home-v3/shark-fg.png",
    manta: "images/home-v3/manta-ray.png"
};

function getSpeciesModeConfig(modeKey) {
    const configs = {
        sharks: {
            key: "sharks",
            title: "Sharkdle - Daily",
            kicker: "Daily Challenge",
            heading: "Guess the Shark",
            lead: "Think you know this shark? Make your guess below.",
            placeholder: "Enter shark name...",
            animal: "shark",
            animalTitle: "Shark",
            shareTitle: "Sharkdle Daily",
            recentMode: "Daily",
            heroBackground: HERO_ART.sharkBg,
            heroForeground: HERO_ART.sharkFg
        },
        rays: {
            key: "rays",
            title: "Relatives - Daily",
            kicker: "Daily Relatives",
            heading: "Guess the Relative",
            lead: "Think you know this shark relative? Make your guess below.",
            placeholder: "Enter relative name...",
            animal: "relative",
            animalTitle: "Relative",
            shareTitle: "Relatives Daily",
            recentMode: "Daily Relatives",
            heroBackground: HERO_ART.manta,
            heroForeground: HERO_ART.manta
        },
        mixed: {
            key: "mixed",
            title: "Sharkdle - Mixed Daily",
            kicker: "Mixed Daily",
            heading: "Guess the Species",
            lead: "Sharks, rays, skates, and chimaeras share the board. Make your guess below.",
            placeholder: "Enter a shark, ray, skate, or chimaera...",
            animal: "species",
            animalTitle: "Species",
            shareTitle: "Sharkdle Mixed Daily",
            recentMode: "Daily Mixed",
            heroBackground: HERO_ART.sharkBg,
            heroForeground: HERO_ART.manta
        },
        nightmare: {
            key: "nightmare",
            title: "No Mercy Mode",
            kicker: "No Mercy Mode",
            heading: "Guess the Shark if you dare...",
            lead: "Blame Gillsy if you lose your mind.",
            placeholder: "Enter shark name...",
            animal: "shark",
            animalTitle: "Shark",
            shareTitle: "Sharkdle No Mercy",
            recentMode: "No Mercy",
            heroBackground: HERO_ART.sharkBg,
            heroForeground: HERO_ART.sharkFg
        }
    };

    return configs[modeKey] || configs.sharks;
}

function getActiveSpeciesPool(modeKey) {
    const sharkPool = Array.isArray(window.sharks) ? window.sharks : [];
    const rayPool = Array.isArray(window.rays) ? window.rays : [];
    if (modeKey === "nightmare") return sharkPool;
    if (modeKey === "rays") return rayPool.length ? rayPool : sharkPool;
    if (modeKey === "mixed") return [...sharkPool, ...rayPool];
    return sharkPool;
}

const speciesMode = getSpeciesModeConfig(getRequestedSpeciesMode());
const nightmareParams = new URLSearchParams(window.location.search);
const noMercySkipWarningKey = "noMercySkipWarning";
let nightmareRunId = nightmareParams.get("run") || "";
let nightmareEntryAccepted = speciesMode.key !== "nightmare";
if (speciesMode.key === "nightmare") {
    if (!/^\d{1,16}$/.test(nightmareRunId)) {
        nightmareRunId = String(Date.now());
        nightmareParams.set("run", nightmareRunId);
        history.replaceState(null, "", `${window.location.pathname}?${nightmareParams.toString()}`);
    }
    nightmareEntryAccepted = localStorage.getItem(noMercySkipWarningKey) === "true"
        || sessionStorage.getItem("nightmareWarningRun") === nightmareRunId;
}
const maxAttempts = speciesMode.key === "nightmare" ? 6 : speciesMode.key === "mixed" ? 12 : 8;
function getSpeciesType(species) {
    if (species?.order === "Chimaeriformes") return "chimaera";
    if (species?.order === "Rajiformes" || /\bskate\b/i.test(`${species?.name || ""} ${species?.family || ""}`)) return "skate";
    if (species?.order === "Myliobatiformes" || species?.order === "Torpediniformes" || species?.order === "Rhinopristiformes" || (window.rays || []).some(item => item.name === species?.name)) return "ray";
    return "shark";
}
const speciesPool = getActiveSpeciesPool(speciesMode.key);

function getDailyStorageKey(uid = firebase.auth().currentUser?.uid || "guest") {
    const modeKey = speciesMode.key === "sharks" ? "sharks" : speciesMode.key;
    return `${speciesMode.key === "nightmare" ? `nightmare_${nightmareRunId}` : "daily"}_${uid}_${modeKey}_${today}`;
}

function getDailyFirestoreState(firebaseData) {
    if (speciesMode.key === "nightmare") return firebaseData?.modes?.nightmare || null;
    if (speciesMode.key === "sharks") return firebaseData;
    return firebaseData?.modes?.[speciesMode.key] || null;
}

function getDailyFirestorePayload(state) {
    if (speciesMode.key === "nightmare") {
        return { modes: { nightmare: { ...state, lastUpdated: firebase.firestore.FieldValue.serverTimestamp() } } };
    }
    if (speciesMode.key === "sharks") {
        return {
            ...state,
            lastUpdated: firebase.firestore.FieldValue.serverTimestamp()
        };
    }

    return {
        modes: {
            [speciesMode.key]: {
                ...state,
                lastUpdated: firebase.firestore.FieldValue.serverTimestamp()
            }
        }
    };
}

function applySpeciesModeCopy() {
    document.title = speciesMode.title;
    document.body.classList.remove("species-mode-sharks", "species-mode-rays", "species-mode-mixed");
    document.body.classList.add(`species-mode-${speciesMode.key}`);
    document.body.classList.toggle("nightmare-mode", speciesMode.key === "nightmare");
    if (speciesMode.key === "nightmare") {
        Array.from(document.body.classList).forEach(className => {
            if ((className.startsWith("index-theme-") || className.startsWith("global-ui-theme-")) && !className.endsWith("-default")) {
                document.body.classList.remove(className);
            }
        });
        document.body.classList.add("index-theme-default", "global-ui-theme-default");
    }

    document.querySelectorAll("[data-pool-mode]").forEach(link => {
        link.classList.toggle("active", link.dataset.poolMode === speciesMode.key);
    });

    const title = document.getElementById("mode-title");
    const kicker = document.getElementById("mode-kicker");
    const heading = document.getElementById("guess-heading");
    const lead = document.getElementById("mode-lead");
    const input = document.getElementById("sharkGuess");
    const heroBackground = document.querySelector(".guess-hero-bg");
    const heroForeground = document.querySelector(".guess-hero-fg");

    if (title) title.textContent = speciesMode.title;
    const nightmareRulesButton = document.getElementById("nightmare-rules-btn");
    if (nightmareRulesButton) nightmareRulesButton.hidden = speciesMode.key !== "nightmare";
    if (kicker) kicker.textContent = speciesMode.kicker;
    if (heading) heading.textContent = speciesMode.heading;
    if (lead) lead.textContent = speciesMode.lead;
    if (input) input.placeholder = speciesMode.placeholder;
    const nightmareDossier = document.querySelector(".nightmare-dossier");
    if (nightmareDossier) nightmareDossier.hidden = speciesMode.key !== "nightmare";
    document.querySelectorAll("[data-nightmare-hide]").forEach(element => {
        element.hidden = speciesMode.key === "nightmare";
    });
    const modeSwitcher = document.querySelector(".species-mode-switcher");
    if (modeSwitcher) modeSwitcher.hidden = speciesMode.key === "nightmare";
    const mysteryProfile = document.querySelector(".guess-hero-art");
    if (mysteryProfile) mysteryProfile.hidden = speciesMode.key === "nightmare";
    if (heroBackground) heroBackground.src = speciesMode.heroBackground;
    if (heroForeground) heroForeground.src = speciesMode.heroForeground;
}

applySpeciesModeCopy();

function getInfiniteModeHref() {
    const path = speciesMode.key === "sharks"
        ? "infinite.html"
        : `Infinite/index.html?pool=${speciesMode.key}`;
    return typeof resolveAppPath === "function" ? resolveAppPath(path) : path;
}

function getDailyModeHref(modeKey) {
    const path = modeKey === "sharks"
        ? "Daily/index.html"
        : `Daily/index.html?pool=${modeKey}`;
    return typeof resolveAppPath === "function" ? resolveAppPath(path) : path;
}

function replayNightmare() {
    const nextRun = String(Math.max(Date.now(), Number(nightmareRunId) + 1));
    const replayUrl = new URL(resolveAppPath("NoMercy/index.html"));
    replayUrl.searchParams.set("run", nextRun);
    window.location.assign(replayUrl.href);
}

function acceptNightmareEntry() {
    if (speciesMode.key !== "nightmare" || nightmareEntryAccepted) return;
    if (document.getElementById("nightmare-skip-warning")?.checked) {
        localStorage.setItem(noMercySkipWarningKey, "true");
    }
    nightmareEntryAccepted = true;
    sessionStorage.setItem("nightmareWarningRun", nightmareRunId);
    document.getElementById("nightmare-warning")?.setAttribute("hidden", "");
    const input = document.getElementById("sharkGuess");
    const button = document.getElementById("guessBtn");
    if (input) input.disabled = false;
    if (button) button.disabled = false;
    void initializeGame();
}

function declineNightmareEntry() {
    window.location.replace(typeof resolveAppPath === "function" ? resolveAppPath("index.html") : "../index.html");
}

const NIGHTMARE_INSULTS = [
    "Go back to normal mode. You aren't cut out for this.",
    "Do you even know what sharks are?",
    "I thought you were supposed to be good at this.",
    "This game isn't for everyone... especially you....",
    "Still think it's too easy?",
    "Don't give up. You're almost there. NOT.",
    "Do you hate yourself yet?",
    "The sharks are starting to feel bad for you.",
    "At this point, even the autocomplete is disappointed.",
    "Your guesses are swimming in the wrong direction.",
    "That was certainly one way to use six guesses.",
    "The answer was right there. Somewhere. Probably."
];

function getNightmareStats() {
    try {
        const userId = firebase.auth().currentUser?.uid || "guest";
        const profileStats = typeof getBestLocalProfile === "function" ? getBestLocalProfile()?.nightmareStats : null;
        const stats = profileStats || JSON.parse(localStorage.getItem(`nightmareStats_${userId}`) || localStorage.getItem("nightmareStats") || "{}");
        return { wins: 0, losses: 0, totalGuesses: 0, failures: 0, ...(stats && typeof stats === "object" ? stats : {}) };
    } catch { return { wins: 0, losses: 0, totalGuesses: 0, failures: 0 }; }
}

function updateNightmareDossier() {
    if (speciesMode.key !== "nightmare") return;
    const stats = getNightmareStats();
    [
        [1, "no_mercy_fail_1"],
        [5, "no_mercy_fail_5"],
        [10, "no_mercy_fail_10"],
        [25, "no_mercy_fail_25"],
        [50, "no_mercy_fail_50"],
        [100, "no_mercy_fail_100"]
    ].forEach(([milestone, achievementId]) => {
        if (stats.failures >= milestone) window.unlockAchievement?.(achievementId);
    });
    [
        [5, "no_mercy_win_5"],
        [10, "no_mercy_win_10"],
        [25, "no_mercy_win_25"]
    ].forEach(([milestone, achievementId]) => {
        if (stats.wins >= milestone) window.unlockAchievement?.(achievementId);
    });
    const record = document.getElementById("nightmare-record");
    const average = document.getElementById("nightmare-average");
    const failures = document.getElementById("nightmare-fails");
    if (record) record.textContent = `${stats.wins} wins · ${stats.losses} losses`;
    if (average) average.textContent = stats.wins ? (stats.totalGuesses / stats.wins).toFixed(2) : "—";
    if (failures) failures.textContent = `${stats.failures} ${stats.failures === 1 ? "failure" : "failures"}`;
}

function recordNightmareResult(won, guessesTaken) {
    const stats = getNightmareStats();
    stats[won ? "wins" : "losses"] += 1;
    stats.totalGuesses += guessesTaken;
    if (!won) stats.failures += 1;
    localStorage.setItem(`nightmareStats_${firebase.auth().currentUser?.uid || "guest"}`, JSON.stringify(stats));
    const profile = typeof getBestLocalProfile === "function" ? getBestLocalProfile() : JSON.parse(localStorage.getItem("userProfile") || "{}");
    profile.nightmareStats = stats;
    if (typeof saveUserProfileLocally === "function") saveUserProfileLocally({ ...profile, uid: window.currentUser?.uid || firebase.auth().currentUser?.uid || profile.uid });
    else localStorage.setItem("userProfile", JSON.stringify(profile));
    updateNightmareDossier();
}

function getNightmareCompletionKey() {
    return `nightmareResultRecorded_${firebase.auth().currentUser?.uid || "guest"}_${today}_${nightmareRunId}`;
}

function recordNightmareCompletion(won, guessesTaken) {
    const completionKey = getNightmareCompletionKey();
    if (localStorage.getItem(completionKey) === "true") return;
    localStorage.setItem(completionKey, "true");
    recordNightmareResult(won, guessesTaken);
    const recent = JSON.parse(localStorage.getItem("nightmareRecentGames") || "[]");
    recent.unshift({
        date: new Date().toLocaleDateString(),
        time: new Date().toLocaleTimeString(),
        result: won ? "Win" : "Loss",
        guesses: won ? guessesTaken : "X",
        sharkName: targetShark.name,
        mode: "No Mercy"
    });
    localStorage.setItem("nightmareRecentGames", JSON.stringify(recent.slice(0, 20)));
}

let nightmareGuardRef = null;
let nightmareGuardUnsubscribe = null;
let nightmareGuardHeartbeat = null;
let nightmareGuardStartPromise = Promise.resolve();

function finishNightmareCrossDeviceGuard(status) {
    if (!nightmareGuardRef) return;
    const ref = nightmareGuardRef;
    if (nightmareGuardHeartbeat) window.clearInterval(nightmareGuardHeartbeat);
    nightmareGuardHeartbeat = null;
    nightmareGuardStartPromise.then(async () => {
        try {
            const snapshot = await ref.get();
            const guard = snapshot.data()?.modes?.nightmareGuard;
            if (guard?.runId !== nightmareRunId || guard.status !== "active") return;
            await ref.update({
                "modes.nightmareGuard.status": status,
                "modes.nightmareGuard.endedAt": Date.now(),
                "modes.nightmareGuard.expiresAt": 0
            });
        } catch (error) {
            console.warn("Could not update the Nightmare session guard.", error);
        }
        if (nightmareGuardUnsubscribe) nightmareGuardUnsubscribe();
        nightmareGuardUnsubscribe = null;
    }).catch(() => {});
}

async function startNightmareCrossDeviceGuard() {
    const user = firebase.auth().currentUser;
    if (speciesMode.key !== "nightmare" || !user?.emailVerified || typeof db === "undefined" || !db) return;
    const ref = db.collection("userDaily").doc(user.uid);
    nightmareGuardRef = ref;
    const writeActive = () => ref.set({ modes: { nightmareGuard: {
        runId: nightmareRunId,
        status: "active",
        heartbeatAt: Date.now(),
        expiresAt: Date.now() + 35000
    } } }, { merge: true });
    nightmareGuardStartPromise = writeActive().then(() => {
        if (gameCompleted) {
            finishNightmareCrossDeviceGuard(gameWon ? "finished" : "forfeit");
            return;
        }
        nightmareGuardUnsubscribe = ref.onSnapshot(snapshot => {
            const guard = snapshot.data()?.modes?.nightmareGuard;
            if (guard && (guard.runId !== nightmareRunId || guard.status === "forfeit")) {
                loseNightmareAfterTabSwitch("The Sharchive was opened while Nightmare was active.");
            }
        }, error => console.warn("Nightmare session guard listener failed.", error));
        nightmareGuardHeartbeat = window.setInterval(async () => {
            try {
                const stillActive = await db.runTransaction(async transaction => {
                    const snapshot = await transaction.get(ref);
                    const guard = snapshot.data()?.modes?.nightmareGuard;
                    if (!guard || guard.runId !== nightmareRunId || guard.status !== "active") return false;
                    transaction.update(ref, {
                        "modes.nightmareGuard.heartbeatAt": Date.now(),
                        "modes.nightmareGuard.expiresAt": Date.now() + 35000
                    });
                    return true;
                });
                if (!stillActive) loseNightmareAfterTabSwitch("The Nightmare session ended on another device.");
            } catch (error) {
                console.warn("Nightmare session heartbeat failed.", error);
            }
        }, 10000);
    }).catch(error => {
        console.warn("Nightmare cross-device session guard is unavailable.", error);
    });
}

function getNightmareTimerKey() {
    return `nightmareTimer_${firebase.auth().currentUser?.uid || "guest"}_${today}_${nightmareRunId}`;
}

function getNightmareTimerRemaining() {
    if (nightmarePausedRemainingMs !== null) return nightmarePausedRemainingMs;
    const deadline = Number(localStorage.getItem(getNightmareTimerKey())) || 0;
    return Math.max(0, deadline - Date.now());
}

let nightmareTimer = null;
let nightmarePausedRemainingMs = null;

function updateNightmareTimer() {
    if (speciesMode.key !== "nightmare" || gameCompleted || nightmarePausedRemainingMs !== null) return;
    const remaining = getNightmareTimerRemaining();
    const button = document.getElementById("guessBtn");
    const label = document.getElementById("attempts-left");
    if (label) label.textContent = `00:${String(Math.ceil(remaining / 1000)).padStart(2, "0")} · ${attempts} guesses left`;
    if (button) button.textContent = `Guess · ${Math.ceil(remaining / 1000)}s`;
    if (!remaining) {
        voidNightmareGuess();
        return;
    }
    nightmareTimer = window.setTimeout(updateNightmareTimer, Math.min(200, remaining));
}

function voidNightmareGuess() {
    if (speciesMode.key !== "nightmare" || gameCompleted) return;
    if (getNightmareTimerRemaining() > 0) return;
    attempts = Math.max(0, attempts - 1);
    const input = document.getElementById("sharkGuess");
    if (input) input.value = "";
    document.getElementById("suggestions")?.classList.remove("active");
    document.getElementById("attempts-left").textContent = `${attempts} guesses left · time expired`;
    if (messageDiv) messageDiv.textContent = "Time expired. One guess was used.";
    saveGameState();
    if (attempts <= 0) {
        gameCompleted = true;
        gameWon = false;
        recordNightmareCompletion(false, guesses.length);
        finishNightmareCrossDeviceGuard("finished");
        saveGameState();
        document.getElementById("sharkGuess").disabled = true;
        document.getElementById("guessBtn").disabled = true;
        document.getElementById("attempts-left").textContent = "Run complete · replay anytime";
        showLose();
        return;
    }
    localStorage.setItem(getNightmareTimerKey(), String(Date.now() + 20000));
    updateNightmareTimer();
}

function startNightmareTimer() {
    if (speciesMode.key !== "nightmare" || gameCompleted || nightmarePausedRemainingMs !== null) return;
    localStorage.setItem(getNightmareTimerKey(), String(Date.now() + 20000));
    if (nightmareTimer) window.clearTimeout(nightmareTimer);
    updateNightmareTimer();
}

function pauseNightmareTimer() {
    if (speciesMode.key !== "nightmare" || gameCompleted || nightmarePausedRemainingMs !== null) return;
    const timerDeadline = Number(localStorage.getItem(getNightmareTimerKey())) || 0;
    nightmarePausedRemainingMs = timerDeadline ? getNightmareTimerRemaining() : 20000;
    if (nightmareTimer) window.clearTimeout(nightmareTimer);
    nightmareTimer = null;
}

function resumeNightmareTimer() {
    if (speciesMode.key !== "nightmare" || gameCompleted || nightmarePausedRemainingMs === null) return;
    const remaining = nightmarePausedRemainingMs;
    nightmarePausedRemainingMs = null;
    localStorage.setItem(getNightmareTimerKey(), String(Date.now() + remaining));
    updateNightmareTimer();
}

function openNightmareRules() {
    const warning = document.getElementById("nightmare-warning");
    const isPreGame = warning && !warning.hidden && !nightmareEntryAccepted;
    if (speciesMode.key !== "nightmare" || (!isPreGame && (!nightmareEntryAccepted || gameCompleted))) return;
    const modal = document.getElementById("nightmare-rules-modal");
    if (!modal || !modal.hidden) return;
    if (!isPreGame) pauseNightmareTimer();
    modal.hidden = false;
    modal.querySelector("button")?.focus();
}

function closeNightmareRules() {
    const modal = document.getElementById("nightmare-rules-modal");
    if (!modal || modal.hidden) return;
    modal.hidden = true;
    if (nightmareEntryAccepted) {
        resumeNightmareTimer();
        document.getElementById("nightmare-rules-btn")?.focus();
    } else {
        document.querySelector("#nightmare-warning .nightmare-warning-rules")?.focus();
    }
}

document.addEventListener("keydown", event => {
    if (event.key === "Escape" && !document.getElementById("nightmare-rules-modal")?.hidden) {
        closeNightmareRules();
    }
});

function loseNightmareAfterTabSwitch(reason = "You left the tab") {
    if (speciesMode.key !== "nightmare" || !nightmareEntryAccepted || gameCompleted) return;
    if (nightmareTimer) window.clearTimeout(nightmareTimer);
    gameCompleted = true;
    gameWon = false;
    attempts = 0;
    recordNightmareCompletion(false, guesses.length);
    saveGameState();
    finishNightmareCrossDeviceGuard("forfeit");
    const input = document.getElementById("sharkGuess");
    const button = document.getElementById("guessBtn");
    if (input) input.disabled = true;
    if (button) button.disabled = true;
    const label = document.getElementById("attempts-left");
    if (label) label.textContent = `Run ended: ${reason}`;
    showLose();
}

function handleNightmareVisibilityChange() {
    if (document.visibilityState === "hidden") loseNightmareAfterTabSwitch();
}

function hidePreviousNightmareFeedback() {
    if (speciesMode.key !== "nightmare") return;
    document.querySelectorAll("#guesses .guess-card .feedback").forEach(feedback => {
        feedback.style.display = "none";
        feedback.dataset.nightmareHidden = "true";
    });
}

function getNightmareSignal(key, guessedShark) {
    const target = targetShark;
    const actualValue = key === "size" ? guessedShark.size
        : key === "depth" ? guessedShark.depth
        : key === "yod" ? Number(guessedShark.yod)
        : guessedShark[key];
    const targetValue = key === "size" ? target.size
        : key === "depth" ? target.depth
        : key === "yod" ? Number(target.yod)
        : target[key];
    if (actualValue === targetValue) return "green";

    if (key === "genus" && guessedShark.family === target.family) return "yellow";
    if (key === "size" || key === "depth") {
        const ranks = key === "size"
            ? ["Tiny", "Small", "Medium", "Large", "Giant"]
            : ["Epipelagic", "Mesopelagic", "Bathypelagic"];
        const guessRank = ranks.indexOf(actualValue);
        const targetRank = ranks.indexOf(targetValue);
        if (guessRank >= 0 && targetRank >= 0 && Math.abs(guessRank - targetRank) === 1) return "yellow";
    }
    if (key === "yod" && Number.isFinite(actualValue) && Number.isFinite(targetValue) && Math.abs(actualValue - targetValue) <= 25) return "yellow";
    return "red";
}

function getSharchiveReviewHref() {
    const path = typeof resolveAppPath === "function" ? resolveAppPath("Library/index.html") : "Library/index.html";
    return `${path}?species=${encodeURIComponent(targetShark.name)}`;
}

function appendSharchiveReviewButton(container) {
    const actionRows = container.querySelectorAll('div');
    const actions = actionRows[actionRows.length - 1];
    if (!actions) return;
    actions.style.flexWrap = 'wrap';
    const button = document.createElement('button');
    button.type = 'button';
    button.textContent = 'Review in Sharchive';
    button.style.cssText = 'padding:12px 18px;font-size:15px;cursor:pointer;background:rgba(70,229,139,0.18);border:1px solid rgba(70,229,139,0.5);border-radius:6px;color:#b8ffd2;font-weight:bold;';
    button.addEventListener('click', () => {
        window.location.href = getSharchiveReviewHref();
    });
    actions.appendChild(button);
}

function getDailyVariantSwitcherHtml() {
    if (speciesMode.key === "nightmare") return '<div class="nightmare-result-note"><span>Your normal streak is safe. Start another No Mercy run whenever you want.</span><button type="button" onclick="replayNightmare()">Play No Mercy Again</button></div>';
    const variants = [
        { key: "sharks", label: "Sharks" },
        { key: "rays", label: "Relatives" },
        { key: "mixed", label: "Mixed" }
    ];

    const links = variants.map(variant => {
        const activeClass = variant.key === speciesMode.key ? " active" : "";
        const currentAttr = variant.key === speciesMode.key ? ' aria-current="page"' : "";
        return `<a class="daily-result-variant${activeClass}" href="${getDailyModeHref(variant.key)}"${currentAttr}>${variant.label}</a>`;
    }).join("");

    return `
<div class="daily-result-variants" aria-label="Daily variants">
    <span>Play another Daily</span>
    <div class="daily-result-variant-list">${links}</div>
</div>`;
}

// --- Share Results (Daily) ---
function generateDailyShareText() {
    const title = `${speciesMode.key === "nightmare" && gameWon ? "I conquered Sharkdle!\n" : ""}${speciesMode.shareTitle} ${today} - ${gameWon ? guesses.length : 'X'}/${maxAttempts}`;
    // No Mercy shares its five color signals; standard modes share exact matches only.
    const rows = guesses.map(g => {
        if (speciesMode.key === "nightmare") {
            const categoryKeys = ["family", "genus", "size", "depth", "yod"];
            if (!g?.shark) return "⬛⬛⬛⬛⬛";
            const signalEmoji = { green: "🟩", yellow: "🟨", red: "🟥" };
            return categoryKeys.map(key => {
                const signal = getNightmareSignal(key, g.shark);
                return signalEmoji[signal] || "⬛";
            }).join("");
        }
        const order = [...(speciesMode.key === 'mixed' ? ['type'] : []), 'order','family','genus','size','depth','yod'];
        return order.map(cat => (g.feedback && g.feedback[cat]) ? '🟩' : '⬛').join('');
    });
    const body = rows.join('\n');
    const url = window.location.href.split("#")[0];
    const tag = " #Sharkdle";
    return `${title}\n${body}\n\nPlay: ${url}\n\n${tag}`;
}

async function shareDailyResults() {
    if (!gameCompleted) return;
    const text = generateDailyShareText();
    try {
        if (navigator.share) {
            await navigator.share({ text });
            window.recordSharkdleAchievement?.('results_shared');
            if (messageDiv) messageDiv.textContent = 'Shared via system share';
            return;
        }
    } catch (e) {
        console.warn('Navigator.share failed', e);
    }

    // Fallback to clipboard
    try {
        await navigator.clipboard.writeText(text);
        window.recordSharkdleAchievement?.('results_shared');
        if (messageDiv) {
            messageDiv.textContent = 'Results copied to clipboard';
            setTimeout(() => { if (messageDiv) messageDiv.textContent = ''; }, 3000);
        } else {
            alert('Results copied to clipboard');
        }
    } catch (err) {
        console.error('Clipboard write failed', err);
        alert('Could not copy share text.');
    }
}

// Get the next midnight in the user's local timezone
const today = getTodayInLocalTimezone()
let dailyStorageKey = getDailyStorageKey()
const dailyTargetSeed = speciesMode.key === "sharks" ? today : speciesMode.key === "nightmare" ? `${today}:nightmare:${nightmareRunId}` : `${today}:${speciesMode.key}`

// Daily target must be fully deterministic so every player gets the same species.
const dailySharkIndex = hashDate(dailyTargetSeed) % speciesPool.length
const targetShark = speciesPool[dailySharkIndex]

let attempts = maxAttempts
let guesses = []
let gameCompleted = false
let gameWon = false
let lastLoadedDate = today
let categoryReveal = null
if (speciesMode.key === "nightmare") {
    document.addEventListener("visibilitychange", handleNightmareVisibilityChange);
}
let dailyAuthReady = null
if (typeof firebase !== "undefined" && firebase.auth) {
    dailyAuthReady = new Promise(resolve => {
        const unsubscribe = firebase.auth().onAuthStateChanged(() => {
            unsubscribe();
            resolve();
        }, () => resolve());
    });
}
const dailySpeciesTrackerRoundId = window.SharkdleSpeciesTracker
    ? window.SharkdleSpeciesTracker.createRoundId("daily", `${today}-${speciesMode.key}`)
    : `daily-${today}-${speciesMode.key}`

if (speciesMode.key === "nightmare" && !nightmareEntryAccepted) {
    document.getElementById("nightmare-warning")?.removeAttribute("hidden");
    const input = document.getElementById("sharkGuess");
    const button = document.getElementById("guessBtn");
    if (input) input.disabled = true;
    if (button) button.disabled = true;
}

const dailyFairPlayRound = speciesMode.key === "nightmare" ? null : window.SharkdleFairPlay?.startRound('daily', speciesMode.key, dailySpeciesTrackerRoundId);

function recordDailySpeciesHistory(won) {
    if (speciesMode.key === "nightmare") return;
    void window.SharkdleFairPlay?.finishRound(dailyFairPlayRound, won, guesses.length);
    if (!window.SharkdleSpeciesTracker) return;
    void window.SharkdleSpeciesTracker.recordRound({
        mode: `daily-${speciesMode.key}`,
        roundId: dailySpeciesTrackerRoundId,
        targetSpecies: targetShark,
        guesses: guesses.map(entry => entry.shark),
        categoryResults: guesses.map(entry => entry.feedback),
        guessesTaken: guesses.length,
        won
    });
}

const messageDiv = document.getElementById("message");

const sizeThresholds = {
    "Tiny": "0-3ft",
    "Small": "3-6ft",
    "Medium": "6-10ft",
    "Large": "10-20ft",
    "Giant": "20ft+"
};

function getSizeWithThreshold(size) {
    const threshold = sizeThresholds[size];
    return threshold ? `${size} (${threshold})` : size;
}

const depthClues = {
    "Epipelagic": "0-200m deep",
    "Mesopelagic": "200-1000m deep",
    "Bathypelagic": "1000-4000m deep"
};

function getDepthWithClue(depth) {
    const clue = depthClues[depth];
    return clue ? `${depth} (${clue})` : depth;
}

function normalizeSavedFeedback(shark, savedFeedback = {}) {
    return {
        ...(speciesMode.key === "mixed" ? { type: getSpeciesType(shark) === getSpeciesType(targetShark) } : {}),
        family: savedFeedback.family ?? shark.family === targetShark.family,
        order: savedFeedback.order ?? shark.order === targetShark.order,
        genus: savedFeedback.genus ?? shark.genus === targetShark.genus,
        size: savedFeedback.size ?? shark.size === targetShark.size,
        depth: savedFeedback.depth ?? shark.depth === targetShark.depth,
        yod: savedFeedback.yod ?? shark.yod === targetShark.yod
    };
}

function normalizeSavedGuess(guess) {
    const savedShark = guess?.shark || guess?.species || guess;
    if (!savedShark?.name) return null;

    const currentSpecies = speciesPool.find(species => species.name === savedShark.name);
    const shark = { ...savedShark, ...(currentSpecies || {}) };

    return {
        shark,
        feedback: normalizeSavedFeedback(shark, guess?.feedback || {})
    };
}

function normalizeSavedGuesses(savedGuesses) {
    if (!Array.isArray(savedGuesses)) return [];
    return savedGuesses.map(normalizeSavedGuess).filter(Boolean);
}

const CATEGORY_REVEAL_PRICE = 25;
const CATEGORY_REVEAL_OPTIONS = [
    { key: "order", label: "Order", getValue: shark => shark.order },
    { key: "family", label: "Family", getValue: shark => shark.family },
    { key: "genus", label: "Genus", getValue: shark => shark.genus },
    { key: "size", label: "Size", getValue: shark => getSizeWithThreshold(shark.size) },
    { key: "depth", label: "Depth", getValue: shark => getDepthWithClue(shark.depth) },
    { key: "yod", label: "Year of Discovery", getValue: shark => shark.yod }
];

function getCategoryRevealOption(key) {
    return CATEGORY_REVEAL_OPTIONS.find(option => option.key === key) || null;
}

function normalizeCategoryRevealState(rawReveal) {
    if (!rawReveal || typeof rawReveal !== "object") return null;
    const option = getCategoryRevealOption(rawReveal.key);
    if (!option) return null;
    return {
        key: option.key,
        revealedAt: Number(rawReveal.revealedAt) || null
    };
}

function getDiscoveredCategoryKeys() {
    const discovered = new Set();

    guesses.forEach(guess => {
        const feedback = guess && guess.feedback;
        if (!feedback || typeof feedback !== "object") return;

        CATEGORY_REVEAL_OPTIONS.forEach(option => {
            if (feedback[option.key]) {
                discovered.add(option.key);
            }
        });
    });

    if (categoryReveal?.key) {
        discovered.add(categoryReveal.key);
    }

    return discovered;
}

function getAvailableCategoryRevealOptions() {
    const discovered = getDiscoveredCategoryKeys();
    return CATEGORY_REVEAL_OPTIONS.filter(option => !discovered.has(option.key));
}

function getCategoryRevealCommonName(option) {
    if (!["family", "order", "genus"].includes(option.key)) return "";
    const value = option.getValue(targetShark);
    return typeof window.getSharkTaxonomyCommonName === "function"
        ? window.getSharkTaxonomyCommonName(value)
        : "";
}

function formatCategoryRevealText(option) {
    const value = option.getValue(targetShark);
    const commonName = getCategoryRevealCommonName(option);
    return commonName ? `${option.label}: ${value} (${commonName})` : `${option.label}: ${value}`;
}

function hasCorrectGuessForProfileField(key) {
    return guesses.some(guess => guess?.feedback?.[key]);
}

function isMysteryProfileSpeciesDiscovered() {
    return gameWon || guesses.some(guess => guess?.shark?.name === targetShark.name);
}

function getProfileGuessedSpecies() {
    return guesses.map(guess => guess?.shark).filter(Boolean);
}

function getYearDiscoveryClueRange() {
    const targetYear = Number(targetShark?.yod);
    if (!Number.isFinite(targetYear)) return { lower: null, upper: null };

    return getProfileGuessedSpecies().reduce((range, shark) => {
        const guessYear = Number(shark?.yod);
        if (!Number.isFinite(guessYear) || guessYear === targetYear) return range;
        if (guessYear < targetYear) {
            range.lower = range.lower === null ? guessYear : Math.max(range.lower, guessYear);
        } else {
            range.upper = range.upper === null ? guessYear : Math.min(range.upper, guessYear);
        }
        return range;
    }, { lower: null, upper: null });
}

function formatYearDiscoveryClueRange(range) {
    if (!range) return "";
    if (range.lower !== null && range.upper !== null) return `${range.lower} - ${range.upper}`;
    if (range.lower !== null) return `After ${range.lower}`;
    if (range.upper !== null) return `Before ${range.upper}`;
    return "";
}

function hasProfileFilterValue(key) {
    return hasCorrectGuessForProfileField(key) || categoryReveal?.key === key;
}

function getMysteryProfileFilterState() {
    const yearRange = getYearDiscoveryClueRange();
    const state = {
        search: "",
        size: "",
        depth: "",
        yearEarliest: "",
        yearLatest: ""
    };

    if (isMysteryProfileSpeciesDiscovered()) {
        state.search = targetShark.name;
    } else {
        state.search = ["family", "order", "genus"]
            .filter(hasProfileFilterValue)
            .map(key => targetShark[key])
            .filter(Boolean)
            .join(" ");
    }

    if (hasProfileFilterValue("size")) state.size = targetShark.size || "";
    if (hasProfileFilterValue("depth")) state.depth = targetShark.depth || "";
    if (hasProfileFilterValue("yod")) {
        state.yearEarliest = targetShark.yod || "";
        state.yearLatest = targetShark.yod || "";
    } else {
        state.yearEarliest = yearRange.lower === null ? "" : yearRange.lower + 1;
        state.yearLatest = yearRange.upper === null ? "" : yearRange.upper - 1;
    }

    return state;
}

function getMysteryProfileFilterHref() {
    if (speciesMode.key === "nightmare") return "";
    const state = getMysteryProfileFilterState();
    const params = new URLSearchParams();

    if (state.search) params.set("search", state.search);
    if (state.size) params.set("size", state.size);
    if (state.depth) params.set("depth", state.depth);
    if (state.yearEarliest !== "") params.set("yearEarliest", state.yearEarliest);
    if (state.yearLatest !== "") params.set("yearLatest", state.yearLatest);

    if (!Array.from(params.keys()).length) return "";

    const speciesType = { sharks: "shark", rays: "ray", mixed: "all" }[speciesMode.key];
    params.set("speciesType", speciesType);

    const path = typeof resolveAppPath === "function" ? resolveAppPath("Library/index.html") : "Library/index.html";
    return `${path}?${params.toString()}`;
}

const SHARCHIVE_FILTER_WINDOW_NAME = "sharkdle-sharchive-filter";
let sharchiveFilterWindow = null;
let sharchiveFilterToastTimer = null;

function showSharchiveFilterToast(message = "Sharchive updated") {
    if (!document.body) return;

    let toast = document.querySelector(".profile-filter-toast");
    if (!toast) {
        toast = document.createElement("div");
        toast.className = "profile-filter-toast";
        toast.setAttribute("role", "status");
        toast.setAttribute("aria-live", "polite");
        document.body.appendChild(toast);
    }

    toast.textContent = message;
    window.clearTimeout(sharchiveFilterToastTimer);
    toast.classList.remove("show");
    void toast.offsetWidth;
    toast.classList.add("show");
    sharchiveFilterToastTimer = window.setTimeout(() => {
        toast.classList.remove("show");
    }, 1800);
}

function openOrUpdateMysteryProfileFilter(href) {
    if (speciesMode.key === "nightmare" || !href) return;

    if (sharchiveFilterWindow && !sharchiveFilterWindow.closed) {
        try {
            sharchiveFilterWindow.location.href = href;
            sharchiveFilterWindow.focus();
            showSharchiveFilterToast();
            return;
        } catch (error) {
            sharchiveFilterWindow = null;
        }
    }

    sharchiveFilterWindow = window.open(href, SHARCHIVE_FILTER_WINDOW_NAME);
    if (sharchiveFilterWindow) {
        try {
            sharchiveFilterWindow.opener = null;
            sharchiveFilterWindow.focus();
        } catch (error) {}
        showSharchiveFilterToast();
    }
}

function updateMysteryProfileFilterButton(panel) {
    if (speciesMode.key === "nightmare") return;
    const button = panel.querySelector("#profile-sharchive-filter-btn");
    if (!button) return;

    const href = getMysteryProfileFilterHref();
    button.disabled = !href;
    button.dataset.href = href;
    button.title = href ? "Open or update these clues in the Sharchive" : "Reveal a clue before filtering the Sharchive";
    button.onclick = () => {
        if (button.dataset.href) {
            openOrUpdateMysteryProfileFilter(button.dataset.href);
        }
    };
}

function updateMysteryProfilePanel(animate = false) {
    if (speciesMode.key === "nightmare") return;
    const panel = document.querySelector(".mystery-profile-panel");
    if (!panel) return;

    let confirmedCount = 0;
    let narrowedCount = 0;
    const rowsToAnimate = [];

    CATEGORY_REVEAL_OPTIONS.forEach(option => {
        const row = panel.querySelector(`[data-profile-key="${option.key}"]`);
        if (!row) return;

        const valueElement = row.querySelector(".mystery-profile-value");
        const wasVisible = row.classList.contains("revealed") || row.classList.contains("narrowed");
        const previousValue = valueElement?.textContent || "";
        const confirmedByGuess = hasCorrectGuessForProfileField(option.key);
        const confirmedByReveal = categoryReveal?.key === option.key;
        const isConfirmed = confirmedByGuess || confirmedByReveal;
        const rangeValue = option.key === "yod" && !isConfirmed
            ? formatYearDiscoveryClueRange(getYearDiscoveryClueRange())
            : "";
        const isNarrowed = Boolean(rangeValue);
        const value = isConfirmed ? String(option.getValue(targetShark) ?? "") : rangeValue;

        row.classList.remove("profile-revealing");
        row.classList.toggle("revealed", isConfirmed);
        row.classList.toggle("narrowed", isNarrowed);
        row.classList.toggle("purchased", confirmedByReveal && !confirmedByGuess);
        if (animate && (isConfirmed || isNarrowed) && (!wasVisible || previousValue !== value)) {
            rowsToAnimate.push(row);
        }

        if (valueElement) {
            valueElement.textContent = value;
            valueElement.title = value;
        }

        if (isConfirmed) confirmedCount++;
        if (isNarrowed) narrowedCount++;
    });

    panel.classList.toggle("has-reveals", confirmedCount > 0 || narrowedCount > 0);

    const name = panel.querySelector(".mystery-profile-target strong");
    if (name) {
        const discovered = isMysteryProfileSpeciesDiscovered();
        name.textContent = discovered ? targetShark.name : "Unknown species";
        name.title = discovered ? targetShark.name : "";
    }

    const status = panel.querySelector(".mystery-profile-target small");
    if (status) {
        if (confirmedCount > 0) {
            status.textContent = `${confirmedCount}/${CATEGORY_REVEAL_OPTIONS.length} clues confirmed`;
        } else if (narrowedCount > 0) {
            status.textContent = `${narrowedCount} clue narrowed`;
        } else {
            status.textContent = "Profile locked";
        }
    }

    updateMysteryProfileFilterButton(panel);

    if (rowsToAnimate.length) {
        void panel.offsetWidth;
        rowsToAnimate.forEach(row => row.classList.add("profile-revealing"));
        window.setTimeout(() => {
            rowsToAnimate.forEach(row => row.classList.remove("profile-revealing"));
        }, 720);
    }
}

function getCategoryRevealProfile() {
    if (typeof window.getBestLocalProfile === "function") {
        return window.getBestLocalProfile();
    }

    try {
        return JSON.parse(localStorage.getItem("userProfile") || "{}");
    } catch (error) {
        return {};
    }
}

function getCategoryRevealPearls(profileData) {
    if (typeof window.getPearlCount === "function") {
        return window.getPearlCount(profileData);
    }

    return Math.max(0, Math.floor(Number(profileData?.pearls ?? profileData?.tidePearls) || 0));
}

function spendCategoryRevealPearls(profileData, amount) {
    const currentPearls = getCategoryRevealPearls(profileData);
    const nextPearls = currentPearls - amount;

    if (typeof window.setPearlCount === "function") {
        window.setPearlCount(profileData, nextPearls);
    } else {
        profileData.pearls = Math.max(0, nextPearls);
    }

    return Math.max(0, nextPearls);
}

async function persistCategoryRevealProfile(profileData, authUser) {
    const nextProfile = {
        ...profileData,
        uid: window.currentUser?.uid || authUser?.uid || profileData.uid
    };

    if (typeof window.saveUserProfileLocally === "function") {
        window.saveUserProfileLocally(nextProfile, { skipRemoteSync: true });
    } else {
        localStorage.setItem("userProfile", JSON.stringify(nextProfile));
    }

    if (authUser && typeof db !== "undefined") {
        try {
            await db.collection("userStats").doc(authUser.uid).set({
                pearls: getCategoryRevealPearls(nextProfile),
                lastCategoryRevealPurchase: {
                    mode: speciesMode.recentMode,
                    gameKey: today,
                    targetShark: targetShark.name,
                    category: categoryReveal?.key || "",
                    price: CATEGORY_REVEAL_PRICE,
                    purchasedAt: new Date()
                },
                lastUpdated: new Date()
            }, { merge: true });
        } catch (error) {
            console.warn("Error saving category reveal pearl spend:", error);
        }
    }

    if (typeof updateHomeV3Sidebar === "function") {
        updateHomeV3Sidebar(nextProfile);
    }
    if (typeof renderPearlShop === "function") {
        renderPearlShop(nextProfile);
    }
}

function setCategoryRevealMessage(text, type = "info") {
    if (messageDiv) messageDiv.textContent = text;
    if (typeof showNotification === "function") {
        showNotification(text, type, 3000);
    }
}

function updateCategoryRevealPanel() {
    const panel = document.getElementById("category-reveal-panel");
    if (!panel) return;
    if (speciesMode.key === "nightmare") {
        panel.hidden = true;
        return;
    }

    const result = document.getElementById("category-reveal-result");
    const balance = document.getElementById("category-reveal-balance");
    const button = document.getElementById("category-reveal-btn");
    const authUser = firebase.auth().currentUser;
    const profileData = getCategoryRevealProfile();
    const pearls = getCategoryRevealPearls(profileData);
    const revealedOption = categoryReveal?.key ? getCategoryRevealOption(categoryReveal.key) : null;
    const availableOptions = getAvailableCategoryRevealOptions();

    panel.classList.toggle("revealed", Boolean(revealedOption));

    if (balance) {
        balance.textContent = authUser ? `${pearls.toLocaleString()} pearls available` : "Login required to spend pearls";
    }

    if (revealedOption) {
        if (result) result.textContent = `Revealed: ${formatCategoryRevealText(revealedOption)}`;
        if (button) {
            button.disabled = true;
            button.textContent = "Category Revealed";
        }
        return;
    }

    if (!availableOptions.length) {
        if (result) result.textContent = "Every category has already been discovered.";
        if (button) {
            button.disabled = true;
            button.textContent = "All Categories Found";
        }
        return;
    }

    if (gameCompleted) {
        if (result) result.textContent = "Category reveal is unavailable after the game ends.";
        if (button) {
            button.disabled = true;
            button.textContent = "Game Complete";
        }
        return;
    }

    if (!authUser) {
        if (result) result.textContent = `Reveal one undiscovered category for ${CATEGORY_REVEAL_PRICE} pearls.`;
        if (button) {
            button.disabled = true;
            button.textContent = "Login Required";
        }
        return;
    }

    if (pearls < CATEGORY_REVEAL_PRICE) {
        if (result) result.textContent = `Reveal one undiscovered category for ${CATEGORY_REVEAL_PRICE} pearls.`;
        if (button) {
            button.disabled = true;
            button.textContent = `Need ${CATEGORY_REVEAL_PRICE - pearls} More`;
        }
        return;
    }

    if (result) result.textContent = "Reveal one random category you have not discovered yet.";
    if (button) {
        button.disabled = false;
        button.textContent = `Reveal Category - ${CATEGORY_REVEAL_PRICE}p`;
    }
}

async function buyCategoryReveal() {
    if (speciesMode.key === "nightmare") return;
    if (gameCompleted) {
        setCategoryRevealMessage("Category reveal is unavailable after the game ends.", "error");
        updateCategoryRevealPanel();
        return;
    }

    if (categoryReveal?.key) {
        setCategoryRevealMessage("You already revealed a category this game.", "error");
        updateCategoryRevealPanel();
        return;
    }

    const availableOptions = getAvailableCategoryRevealOptions();
    if (!availableOptions.length) {
        setCategoryRevealMessage("You already discovered every category.", "info");
        updateCategoryRevealPanel();
        return;
    }

    const authUser = firebase.auth().currentUser;
    if (!authUser) {
        setCategoryRevealMessage("Login to spend pearls on a category reveal.", "error");
        updateCategoryRevealPanel();
        return;
    }

    const profileData = getCategoryRevealProfile();
    const pearls = getCategoryRevealPearls(profileData);
    if (pearls < CATEGORY_REVEAL_PRICE) {
        setCategoryRevealMessage(`You need ${CATEGORY_REVEAL_PRICE - pearls} more pearls.`, "error");
        updateCategoryRevealPanel();
        return;
    }

    const option = availableOptions[Math.floor(Math.random() * availableOptions.length)];
    categoryReveal = {
        key: option.key,
        revealedAt: Date.now()
    };

    spendCategoryRevealPearls(profileData, CATEGORY_REVEAL_PRICE);
    await persistCategoryRevealProfile(profileData, authUser);
    await saveGameState();
    updateCategoryRevealPanel();
    updateMysteryProfilePanel();
    setCategoryRevealMessage(`${formatCategoryRevealText(option)} revealed.`, "success");
}




// Load game state from localStorage and Firestore
async function loadGameState() {
    // Keep the local cache aligned with the account active when the game loads.
    dailyStorageKey = getDailyStorageKey();
    // First, check localStorage for today's game
    const stored = localStorage.getItem(dailyStorageKey)
    if (stored) {
        const state = JSON.parse(stored)
        // Validate that stored state is actually for today (not from device date manipulation)
        if (state.date === today) {
            guesses = normalizeSavedGuesses(state.guesses)
            attempts = Math.max(0, maxAttempts - guesses.length)
            gameCompleted = state.completed || false
            gameWon = state.won || false
            categoryReveal = normalizeCategoryRevealState(state.categoryReveal)
            lastLoadedDate = today
        } else {
            // Date mismatch in localStorage - device date was likely changed. Start fresh.
            console.warn("localStorage date mismatch. Resetting game.");
            localStorage.removeItem(dailyStorageKey);
        }
    }

    if (speciesMode.key === "nightmare") return;

    // If user is logged in, also load from Firestore for cross-device persistence
    const currentUser = firebase.auth().currentUser;
    if (currentUser && typeof db !== 'undefined') {
        try {
            const dailyRef = db.collection("userDaily").doc(currentUser.uid);
            const doc = await dailyRef.get();

            if (doc.exists) {
                const firebaseData = doc.data();
                const modeData = getDailyFirestoreState(firebaseData);
                if (!modeData) return;

                // Check server timestamp to prevent device date manipulation
                if (modeData.lastUpdated) {
                    const lastPlayDate = modeData.lastUpdated.toDate();
                    const lastPlayUTC = lastPlayDate.getUTCFullYear() + '-' +
                                       String(lastPlayDate.getUTCMonth() + 1).padStart(2, '0') + '-' +
                                       String(lastPlayDate.getUTCDate()).padStart(2, '0');

                    // If they played today (according to server time), load their game
                    // regardless of what their client date says
                    if (lastPlayUTC === today) {
                        guesses = normalizeSavedGuesses(modeData.guesses)
                        attempts = Math.max(0, maxAttempts - guesses.length)
                        gameCompleted = modeData.completed || false
                        gameWon = modeData.won || false
                        categoryReveal = normalizeCategoryRevealState(modeData.categoryReveal)
                        lastLoadedDate = today
                        return; // Don't allow resetting if already played today
                    } else if (lastPlayUTC !== today && modeData.date === today) {
                        // Server says they played a different day, but stored date says today
                        // This means device date was manipulated. Use server truth.
                        console.warn("Device date manipulation detected. Resetting game.");
                        guesses = []
                        attempts = maxAttempts
                        gameCompleted = false
                        gameWon = false
                        categoryReveal = null
                        lastLoadedDate = today
                        return;
                    }
                }

                // Fallback: validate the saved date against stored date field
                if (modeData.date === today) {
                    guesses = normalizeSavedGuesses(modeData.guesses)
                    attempts = Math.max(0, maxAttempts - guesses.length)
                    gameCompleted = modeData.completed || false
                    gameWon = modeData.won || false
                    categoryReveal = normalizeCategoryRevealState(modeData.categoryReveal)
                    lastLoadedDate = today
                } else if (modeData.date && modeData.date !== today) {
                    // Date mismatch: likely device date was changed. Reset the game
                    console.warn("Date mismatch detected. Device date may have been manipulated.");
                    guesses = []
                    attempts = maxAttempts
                    gameCompleted = false
                    gameWon = false
                    categoryReveal = null
                    lastLoadedDate = today
                }
            }
        } catch (error) {
            console.warn("Error loading daily game from Firestore:", error);
        }
    }
}

// Save game state to localStorage and Firestore
async function saveGameState() {
    const state = {
        guesses: guesses,
        attempts: attempts,
        completed: gameCompleted,
        won: gameWon,
        categoryReveal: categoryReveal,
        mode: speciesMode.key,
        date: today
    }

    // Save to localStorage
    localStorage.setItem(dailyStorageKey, JSON.stringify(state))

    if (speciesMode.key === "nightmare") return;

    // Save to Firestore if user is logged in
    // Use firebase.auth().currentUser for more reliable auth check
    const currentUser = firebase.auth().currentUser;
    if (currentUser && typeof db !== 'undefined') {
        try {
            const dailyRef = db.collection("userDaily").doc(currentUser.uid);
            await dailyRef.set(getDailyFirestorePayload(state), { merge: true });
        } catch (error) {
            console.warn("Error saving daily game to Firestore:", error);
        }
    }
}

// Initialize game
async function initializeGame() {
    if (!nightmareEntryAccepted) return;
    if (dailyAuthReady) await dailyAuthReady;
    if (speciesMode.key === "nightmare") window.unlockAchievement?.("no_mercy_signed");
    await loadGameState()

    // Recover today's saved win if event progress was unavailable when the win first occurred.
    if (gameCompleted && gameWon) {
        if (speciesMode.key !== "nightmare") {
            window.recordThanksgivingEventActivity?.("dailyWin", 1);
            if (guesses.length <= 5) window.recordThanksgivingEventActivity?.("dailyFast", 1);
        }
    }

    if (!gameCompleted && attempts === 0) {
        gameCompleted = true;
        gameWon = guesses.some(guess => guess.shark.name === targetShark.name);
        saveGameState();
    }

    if (speciesMode.key === "nightmare" && !gameCompleted) void startNightmareCrossDeviceGuard();

    // Set attempts display if game not completed
    if (!gameCompleted) {
        document.getElementById("attempts-left").textContent = "Attempts left: " + attempts;
    }

    // If game already completed, show the result
    if (gameCompleted) {
        if (speciesMode.key === "nightmare") finishNightmareCrossDeviceGuard(gameWon ? "finished" : "forfeit");
        if (gameWon) {
            showWin(0, guesses.length, true) // XP already gained, alreadyCompleted = true
        } else {
            showLose(true) // alreadyCompleted = true
        }
        // Disable input
        document.getElementById("sharkGuess").disabled = true
        document.getElementById("guessBtn").disabled = true
        document.getElementById("attempts-left").textContent = speciesMode.key === "nightmare" ? "Run complete · replay anytime" : "Game completed for today"
    }

    // Render existing guesses
    guesses.forEach(guess => {
        renderGuess(guess.shark, guess.feedback)
    })

    // Nightmare shows only the newest guess; older feedback stays hidden.
    const cards = document.querySelectorAll('#guesses .guess-card');
    cards.forEach(card => {
        const feedbackDiv = card.querySelector('.feedback');
        if (speciesMode.key === "nightmare") {
            const isNewest = card === cards[0];
            feedbackDiv.style.display = isNewest || gameCompleted ? "flex" : "none";
            if (!isNewest && !gameCompleted) feedbackDiv.dataset.nightmareHidden = "true";
        } else {
            const correctCount = feedbackDiv.querySelectorAll('.correct').length;
            if (correctCount === 0) feedbackDiv.style.display = 'none';
        }
    });

    updateCategoryRevealPanel();
    updateMysteryProfilePanel();
    if (speciesMode.key === "nightmare") {
        updateNightmareDossier();
        if (gameCompleted) recordNightmareCompletion(gameWon, guesses.length);
        if (!gameCompleted) {
            if (!localStorage.getItem(getNightmareTimerKey())) startNightmareTimer();
            else updateNightmareTimer();
        }
    }
}

// Start the initialization when the page loads
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initializeGame);
} else {
    initializeGame();
}

// Countdown timer for next puzzle
function updateCountdown() {
    const countdownDiv = document.getElementById("countdown-timer");
    const winCountdown = document.getElementById("win-countdown");

    const now = new Date();
    // Calculate next UTC midnight
    const nextMidnight = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + 1, 0, 0, 0, 0));

    const timeUntil = nextMidnight - now;

    let timeStr;
    if (timeUntil <= 0) {
        timeStr = "00:00:00";
    } else {
        const hours = Math.floor(timeUntil / (1000 * 60 * 60));
        const minutes = Math.floor((timeUntil % (1000 * 60 * 60)) / (1000 * 60));
        const seconds = Math.floor((timeUntil % (1000 * 60)) / 1000);

        timeStr = `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
    }

    if (countdownDiv) {
        countdownDiv.textContent = `Next puzzle: ${timeStr}`;
    }

    if (winCountdown) {
        winCountdown.textContent = timeStr;
    }
}

// Update countdown every second
updateCountdown();
setInterval(updateCountdown, 1000);

function hashDate(date){

let hash=0

for(let i=0;i<date.length;i++){

hash=(hash<<5)-hash+date.charCodeAt(i)
hash|=0

}

return Math.abs(hash)

}


document.getElementById("guessBtn").onclick = makeGuess
document.getElementById("category-reveal-btn")?.addEventListener("click", buyCategoryReveal)

if (typeof firebase !== "undefined" && firebase.auth) {
    firebase.auth().onAuthStateChanged(() => updateCategoryRevealPanel());
}

function normalizeInput(input) {
    return String(input || "").replace(/\s+/g, "").toLowerCase();
}

function escapeHtml(value) {
    return String(value)
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#39;");
}

const sharkGuessInput = document.getElementById("sharkGuess");
const suggestionsDiv = document.getElementById("suggestions");
let highlightedSuggestionIndex = -1;

function getVisibleSuggestionItems() {
    return Array.from(suggestionsDiv.querySelectorAll(".suggestion-item[data-species-name]"));
}

function updateHighlightedSuggestion(nextIndex) {
    const items = getVisibleSuggestionItems();
    highlightedSuggestionIndex = items.length ? (nextIndex + items.length) % items.length : -1;
    suggestionsDiv.querySelectorAll(".suggestion-item").forEach(item => item.classList.remove("highlighted"));
    const highlightedItem = items[highlightedSuggestionIndex];
    if (highlightedItem) {
        highlightedItem.classList.add("highlighted");
        highlightedItem.scrollIntoView({ block: "nearest" });
    }
}

// Allow keyboard control of suggestions and Enter submission.
sharkGuessInput.addEventListener("keydown", function(event) {
    if (event.key === "Escape") {
        suggestionsDiv.classList.remove("active");
        highlightedSuggestionIndex = -1;
        return;
    }

    if ((event.key === "ArrowDown" || event.key === "ArrowUp") && suggestionsDiv.classList.contains("active")) {
        event.preventDefault();
        updateHighlightedSuggestion(highlightedSuggestionIndex + (event.key === "ArrowDown" ? 1 : -1));
        return;
    }

    if (event.key === "Enter") {
        const highlightedItem = getVisibleSuggestionItems()[highlightedSuggestionIndex];
        if (highlightedItem) {
            selectShark(decodeURIComponent(highlightedItem.dataset.speciesName));
        }
        makeGuess();
    }
});

sharkGuessInput.addEventListener("input", function() {
    const input = normalizeInput(this.value);

    if (input.length === 0) {
        suggestionsDiv.classList.remove("active");
        highlightedSuggestionIndex = -1;
        return;
    }

    // Filter species that match the input
    const matches = speciesPool.filter(shark => normalizeInput(shark.name).includes(input));

    if (matches.length === 0) {
        suggestionsDiv.classList.remove("active");
        highlightedSuggestionIndex = -1;
        return;
    }

    // Build suggestions HTML
    suggestionsDiv.innerHTML = matches.map(shark => {
        const isGuessed = guesses.some(g => g.shark.name === shark.name);
        const guessedClass = isGuessed ? 'guessed' : '';
        const speciesName = encodeURIComponent(shark.name);
        const disabledAttr = isGuessed ? 'aria-disabled="true"' : `data-species-name="${speciesName}"`;
        return `<div class="suggestion-item ${guessedClass}" ${disabledAttr}>${escapeHtml(shark.name)}</div>`;
    }).join("");

    suggestionsDiv.classList.add("active");
    highlightedSuggestionIndex = -1;
});

// Close suggestions when clicking outside
document.addEventListener("click", function(event) {
    if (event.target !== sharkGuessInput && !event.target.closest(".suggestions-dropdown")) {
        suggestionsDiv.classList.remove("active");
    }
});

suggestionsDiv.addEventListener("click", function(event) {
    const item = event.target.closest(".suggestion-item[data-species-name]");
    if (!item) return;
    selectShark(decodeURIComponent(item.dataset.speciesName));
});

function selectShark(sharkName) {
    document.getElementById("sharkGuess").value = sharkName;
    document.getElementById("suggestions").classList.remove("active");
    highlightedSuggestionIndex = -1;
}

function openGuessFeedback(feedbackDiv, animate = false) {
    if (!feedbackDiv) return;
    feedbackDiv.style.display = "flex";
    if (!animate) return;

    feedbackDiv.classList.remove("feedback-revealing");
    void feedbackDiv.offsetWidth;
    feedbackDiv.classList.add("feedback-revealing");
    window.setTimeout(() => {
        feedbackDiv.classList.remove("feedback-revealing");
    }, 720);
}

let mysteryProfileRevealTimer = null;

function scheduleMysteryProfileReveal() {
    window.clearTimeout(mysteryProfileRevealTimer);
    if (speciesMode.key === "nightmare") return;
    mysteryProfileRevealTimer = window.setTimeout(() => {
        mysteryProfileRevealTimer = null;
        updateMysteryProfilePanel(true);
    }, 520);
}


function makeGuess(){

if (gameCompleted) return
if (speciesMode.key === "nightmare" && getNightmareTimerRemaining() <= 0) {
    voidNightmareGuess();
    return;
}

const input = document.getElementById("sharkGuess")
const guess = normalizeInput(input.value)

// Clear previous message
if (messageDiv) messageDiv.textContent = "";

if (!guess) {
    if (messageDiv) messageDiv.textContent = `Enter a ${speciesMode.animal} name.`;
    return;
}

const shark = speciesPool.find(s => normalizeInput(s.name) === guess)

if(!shark) {
    if (messageDiv) messageDiv.textContent = `${speciesMode.animalTitle} not found in the list.`;
    return;
}

// Check if already guessed
if (guesses.some(g => g.shark.name === shark.name)) {
    if (messageDiv) messageDiv.textContent = `You already guessed this ${speciesMode.animal}.`;
    return;
}

attempts--
hidePreviousNightmareFeedback();

document.getElementById("attempts-left").textContent="Attempts left: "+attempts

const feedback = {
    ...(speciesMode.key === "mixed" ? { type: getSpeciesType(shark) === getSpeciesType(targetShark) } : {}),
    family: shark.family === targetShark.family,
    order: shark.order === targetShark.order,
    genus: shark.genus === targetShark.genus,
    size: shark.size === targetShark.size,
    depth: shark.depth === targetShark.depth,
    yod: shark.yod === targetShark.yod
}

guesses.push({ shark: shark, feedback: feedback })
window.SharkdleFairPlay?.noteGuess(dailyFairPlayRound)
// Save game state to both localStorage and Firestore (fire and forget for better UX)
saveGameState()

renderGuess(shark, feedback)

// Close guesses with no correct information, then open the newest
const cards = document.querySelectorAll('#guesses .guess-card');
cards.forEach(card => {
    const feedbackDiv = card.querySelector('.feedback');
    const correctCount = feedbackDiv.querySelectorAll('.correct').length;
    if (correctCount === 0) {
        feedbackDiv.style.display = 'none';
    }
});
// Open the newest (first) guess
if (cards.length > 0) {
    const newestFeedback = cards[0].querySelector('.feedback');
    if (speciesMode.key === "nightmare") newestFeedback.style.display = "flex";
    else openGuessFeedback(newestFeedback, true);
}
startNightmareTimer();

updateCategoryRevealPanel();
scheduleMysteryProfileReveal();

if(shark.name === targetShark.name){

    // Track total guesses for this game
    const guessesTaken = maxAttempts - attempts;

    // Calculate XP gain (170 - 10 per guess, minimum 50)
    const baseXpGain = Math.max(50, 170 - guessesTaken * 10);
    const xpAward = typeof window.applyLimitedTimeXpBonus === 'function'
        ? window.applyLimitedTimeXpBonus(baseXpGain)
        : { totalXp: baseXpGain };
    const xpGain = speciesMode.key === "nightmare" ? xpAward.totalXp * 3 : xpAward.totalXp;

    // Save stats to localStorage
    let profileData = typeof getBestLocalProfile === 'function'
        ? getBestLocalProfile()
        : JSON.parse(localStorage.getItem("userProfile") || "{}");

    // Track total guesses accumulated
    if (speciesMode.key !== "nightmare") profileData.totalGuesses = (profileData.totalGuesses || 0) + guessesTaken;

    // Update stats
    if (speciesMode.key === "nightmare") {
        profileData.nightmareStats = getNightmareStats();
        profileData.totalXP = (Number(profileData.totalXP) || 0) + xpGain;
        window.applySharkPassXpGain?.(profileData, xpGain);
        var pearlsEarned = window.awardPearlsForWin?.(profileData, { amount: (window.PEARLS_PER_WIN || 50) * 3, deferSave: true, deferUiUpdate: true }) || 0;
        profileData.unlockedCardThemes = [...new Set(["default", ...(profileData.unlockedCardThemes || []), "blood-and-bones"])];
        const earnedCosmetics = Array.isArray(profileData.earnedCosmetics) ? [...profileData.earnedCosmetics] : [];
        if (!earnedCosmetics.some(cosmetic => cosmetic.imagePath === "images/NoMercy/ZebraBullheadShark.png")) {
            earnedCosmetics.push({
                name: "Zebra Bullhead Shark",
                imagePath: "images/NoMercy/ZebraBullheadShark.png",
                source: "No Mercy Mode"
            });
        }
        profileData.earnedCosmetics = earnedCosmetics;
        profileData.lastUpdated = Date.now();
    } else {
    profileData.gamesPlayed = (profileData.gamesPlayed || 0) + 1;
    profileData.wins = (profileData.wins || 0) + 1;
    profileData.currentStreak = (profileData.currentStreak || 0) + 1;
    profileData.highestStreak = Math.max(profileData.highestStreak || 0, profileData.currentStreak);
    profileData.currentLossStreak = 0;
    if (typeof incrementProfilePeriodWins === 'function') {
        incrementProfilePeriodWins(profileData);
    }
    if (typeof window.markDailySpinWinUnlocked === 'function') {
        profileData = window.markDailySpinWinUnlocked(profileData);
    }

    // Update best game (fewest guesses)
    if (!profileData.bestGame || profileData.bestGame === 'N/A' || guessesTaken < parseInt(profileData.bestGame)) {
        profileData.bestGame = guessesTaken;
    }

    // Keep total guesses consistent across wins and losses for the all-game average.
    profileData.totalGuesses = (Number(profileData.totalGuesses) || 0) + guessesTaken;
    if (profileData.gamesPlayed > 0) {
        profileData.averageGuesses = (profileData.totalGuesses / profileData.gamesPlayed).toFixed(2);
    }

    // Gain XP and Pearls, then save for Shark Pass/profile progress.
    profileData.totalXP = (profileData.totalXP || 0) + xpGain;
    if (typeof window.applySharkPassXpGain === 'function') {
        window.applySharkPassXpGain(profileData, xpGain);
    }
    const pearlsEarned = typeof window.awardPearlsForWin === 'function'
        ? window.awardPearlsForWin(profileData, { deferSave: true, deferUiUpdate: true })
        : 0;
    profileData.lastUpdated = Date.now();
    }

    if (typeof saveUserProfileLocally === 'function') {
        saveUserProfileLocally({
            ...profileData,
            uid: window.currentUser?.uid || firebase.auth().currentUser?.uid || profileData.uid
        });
    } else {
        localStorage.setItem("userProfile", JSON.stringify(profileData));
    }
    if (speciesMode.key === "nightmare") window.unlockProfileBadge?.("nightmare-victory", "who-needs-mercy");

    // Add to recent games (for profile modal)
    if (speciesMode.key !== "nightmare") {
        const recentGames = JSON.parse(localStorage.getItem('recentGames') || '[]');
        const now = new Date();
        recentGames.unshift({ date: now.toLocaleDateString(), time: now.toLocaleTimeString(), result: 'Win', guesses: guessesTaken, sharkName: targetShark.name, mode: speciesMode.recentMode });
        localStorage.setItem('recentGames', JSON.stringify(recentGames.slice(0, 20)));
    }

    // Sync to Firebase
    if (speciesMode.key !== "nightmare" && typeof syncStatsToFirebase !== 'undefined') {
        syncStatsToFirebase();
    }

    gameCompleted = true
    gameWon = true
    if (speciesMode.key === "nightmare") {
        if (nightmareTimer) window.clearTimeout(nightmareTimer);
        document.getElementById("sharkGuess").disabled = true;
        document.getElementById("guessBtn").disabled = true;
        document.getElementById("attempts-left").textContent = "Run complete · replay anytime";
        recordNightmareCompletion(true, guessesTaken);
        finishNightmareCrossDeviceGuard("finished");
    } else {
        window.recordThanksgivingEventActivity?.("dailyWin", 1);
        window.recordNewYearsEventActivity?.("dailyWin", 1, speciesMode.key);
        window.recordNewYearsEventActivity?.("win", 1);
        if (speciesMode.key === "sharks") window.recordNewYearsEventActivity?.("species", 1, targetShark.name);
        if (guessesTaken <= 5) window.recordThanksgivingEventActivity?.("dailyFast", 1);
    }
    saveGameState()
    recordDailySpeciesHistory(true)
    updateCategoryRevealPanel()

    // Update display
    if (speciesMode.key !== "nightmare" && typeof window.updateIndexStats !== 'undefined') {
        window.updateIndexStats();
    }

    if (speciesMode.key !== "nightmare" && typeof window.maybeAwardCrateDrop === 'function') {
        window.maybeAwardCrateDrop(`${speciesMode.recentMode.toLowerCase()} win`);
    }

    if (speciesMode.key !== "nightmare" && typeof window.contributeCommunityBossWin === 'function') {
        window.SharkdleChristmas?.recordWin('daily');
        const contributionKey = speciesMode.key === "sharks" ? today : `${today}_${speciesMode.key}`;
        window.contributeCommunityBossWin('daily', { contributionKey });
    }

    showWin(xpGain, guessesTaken, false, pearlsEarned);

}

if(attempts===0 && !gameWon){

    if (window.currentUser && speciesMode.key !== "nightmare") {
        let profileData = typeof getBestLocalProfile === 'function'
            ? getBestLocalProfile()
            : JSON.parse(localStorage.getItem("userProfile") || "{}");

        // Track total guesses for this game (all attempts used)
        const guessesTaken = guesses.length;
        profileData.totalGuesses = (profileData.totalGuesses || 0) + guessesTaken;

        // Update stats
        profileData.gamesPlayed = (profileData.gamesPlayed || 0) + 1;
        profileData.losses = (profileData.losses || 0) + 1;
        profileData.currentLossStreak = (profileData.currentLossStreak || 0) + 1;
        const previousWinStreak = Math.max(0, Number(profileData.currentStreak) || 0);
        const streakShieldUsed = typeof window.applyStreakShieldOnLoss === 'function'
            ? window.applyStreakShieldOnLoss(profileData, { mode: speciesMode.recentMode })
            : false;
        if (!streakShieldUsed) {
            profileData.currentStreak = 0; // Reset streak on loss when no shield is available
            if (previousWinStreak > 0) {
                if (window.unlockProfileBadge?.("lost-win-streak", "arrow-to-the-knee")) {
                    profileData.unlockedBadges = [...new Set([...(Array.isArray(profileData.unlockedBadges) ? profileData.unlockedBadges : ["starter"]), "arrow-to-the-knee"])];
                }
            }
        }
        if (profileData.currentLossStreak >= 6) {
            if (window.unlockProfileBadge?.("loss-streak", "im-not-okay")) {
                profileData.unlockedBadges = [...new Set([...(Array.isArray(profileData.unlockedBadges) ? profileData.unlockedBadges : ["starter"]), "im-not-okay"])];
            }
        }

        // Calculate and save average guesses
        profileData.totalGuesses = (Number(profileData.totalGuesses) || 0) + guessesTaken;
        if (profileData.gamesPlayed > 0) {
            profileData.averageGuesses = (profileData.totalGuesses / profileData.gamesPlayed).toFixed(2);
        }
        profileData.lastUpdated = Date.now();

        if (typeof saveUserProfileLocally === 'function') {
            saveUserProfileLocally({
                ...profileData,
                uid: window.currentUser?.uid || firebase.auth().currentUser?.uid || profileData.uid
            });
        } else {
            localStorage.setItem("userProfile", JSON.stringify(profileData));
        }

        // Add to recent games (for profile modal)
        const recentGames = JSON.parse(localStorage.getItem('recentGames') || '[]');
        const now = new Date();
        recentGames.unshift({ date: now.toLocaleDateString(), time: now.toLocaleTimeString(), result: 'Loss', guesses: 'X', sharkName: targetShark.name, mode: speciesMode.recentMode });
        localStorage.setItem('recentGames', JSON.stringify(recentGames.slice(0, 20)));

        // Sync to Firebase
        if (speciesMode.key !== "nightmare" && typeof syncStatsToFirebase !== 'undefined') {
            syncStatsToFirebase();
        }
    }

    if (speciesMode.key === "nightmare") {
        recordNightmareCompletion(false, guesses.length);
    }

    gameCompleted = true
    gameWon = false
    if (speciesMode.key === "nightmare") {
        if (nightmareTimer) window.clearTimeout(nightmareTimer);
        document.getElementById("sharkGuess").disabled = true;
        document.getElementById("guessBtn").disabled = true;
        document.getElementById("attempts-left").textContent = "Run complete · replay anytime";
        finishNightmareCrossDeviceGuard("finished");
    }
    saveGameState()
    recordDailySpeciesHistory(false)
    updateCategoryRevealPanel()

    // Update display
    if (speciesMode.key !== "nightmare" && typeof window.updateIndexStats !== 'undefined') {
        window.updateIndexStats();
    }

    showLose()

}

input.value=""
document.getElementById("suggestions").classList.remove("active")

}


function renderGuess(shark, feedback){

const card = document.createElement("div")
card.className="guess-card"

const nameColor = shark.name === targetShark.name ? "#00ff00" : "#ff0000"
card.innerHTML = `<b style="color: ${nameColor};">${shark.name}</b> (click)`


const feedbackDiv = document.createElement("div")
feedbackDiv.className="feedback"

if (speciesMode.key === "mixed") feedbackDiv.appendChild(createCategory("Type", getSpeciesType(shark), feedback.type))

if (speciesMode.key !== "nightmare") feedbackDiv.appendChild(createCategory("Order", shark.order, feedback.order))
feedbackDiv.appendChild(createCategory("Family", shark.family, feedback.family, "", "family", shark))
feedbackDiv.appendChild(createCategory("Genus", shark.genus, feedback.genus, "", "genus", shark))
feedbackDiv.appendChild(createCategory("Size", getSizeWithThreshold(shark.size), feedback.size, "", "size", shark))
feedbackDiv.appendChild(createCategory("Depth", getDepthWithClue(shark.depth ?? "Unknown"), feedback.depth, "", "depth", shark))

// Calculate arrow for year of discovery
let yodArrow = ""
if (shark.yod !== targetShark.yod) {
    yodArrow = shark.yod < targetShark.yod ? "⬆️" : "⬇️"
}
feedbackDiv.appendChild(createCategory("Year of Discovery", shark.yod, feedback.yod, yodArrow, "yod", shark))


card.appendChild(feedbackDiv)


card.onclick = ()=>{

const isOpen = feedbackDiv.style.display === "flex"
feedbackDiv.style.display = speciesMode.key === "nightmare" && feedbackDiv.dataset.nightmareHidden ? "none" : isOpen ? "none" : "flex"
if (isOpen) feedbackDiv.classList.remove("feedback-revealing")

}


document.getElementById("guesses").prepend(card)
if (speciesMode.key === "nightmare") feedbackDiv.style.display = gameCompleted ? "flex" : "none"

}


function createCategory(name, value, correct, arrow = "", nightmareKey = "", guessedShark = null){

const div = document.createElement("div")

div.className="category"

if(correct) div.classList.add("correct")

if (speciesMode.key === "nightmare" && nightmareKey && guessedShark) {
    div.classList.add(`nightmare-signal-${getNightmareSignal(nightmareKey, guessedShark)}`);
    const label = nightmareKey === "yod" ? "Year" : name;
    div.textContent = label;
    return div;
}

const displayText = arrow ? `${name}: ${value} ${arrow}` : `${name}: ${value}`
const shouldShowCommonName = name === "Family" || name === "Order" || name === "Genus"
const commonName = shouldShowCommonName && typeof window.getSharkTaxonomyCommonName === "function"
    ? window.getSharkTaxonomyCommonName(value)
    : ""

if(commonName) {
    const tooltip = document.createElement("span")
    tooltip.className = "tooltip"
    tooltip.textContent = displayText

    const tooltipText = document.createElement("span")
    tooltipText.className = "tooltiptext"
    tooltipText.textContent = commonName

    tooltip.appendChild(tooltipText)
    div.appendChild(tooltip)
} else {
    div.textContent = displayText
}

return div

}


function createBubbles(container) {
    for (let i = 0; i < 10; i++) {
        const bubble = document.createElement("div");
        bubble.className = "bubble";
        bubble.style.width = `${Math.random() * 20 + 10}px`;
        bubble.style.height = bubble.style.width;
        bubble.style.left = `${Math.random() * 100}%`;
        bubble.style.animationDelay = `${Math.random() * 2}s`;
        bubble.style.bottom = '0';
        container.appendChild(bubble);
    }
}

function showWin(xpGained, guessesTaken, alreadyCompleted = false, pearlsGained = 0){
    if (speciesMode.key === "nightmare") window.unlockAchievement?.("no_mercy_first_win");
    if (speciesMode.key !== "nightmare") window.SharkdleCorners?.win('daily', speciesMode.key === 'rays', guessesTaken);

// Check achievements for win conditions (only on first completion)
if (speciesMode.key !== "nightmare" && !alreadyCompleted && window.checkAchievements) {
    window.checkAchievements(true, guessesTaken, true);
}

const win = document.getElementById("win-screen")

let headerText = speciesMode.key === "nightmare" ? "NO MERCY. YOU WON." : alreadyCompleted ? "✓ Already Discovered" : "🎉 You Guessed It!";

win.innerHTML = `
<button onclick="document.getElementById('win-screen').style.display='none'; document.getElementById('show-results-btn').style.display='block';" style="position: absolute; top: 8px; right: 8px; width: 32px; height: 32px; background: rgba(0,0,0,0.3); border: none; border-radius: 50%; color: inherit; font-size: 20px; cursor: pointer; display: flex; align-items: center; justify-content: center; transition: background 0.2s; font-weight: bold;">×</button>
<h2 style="margin-top: 0; font-size: 32px; margin-bottom: 20px;">${headerText}</h2>
<p style="font-size: 18px; margin: 10px 0; color: inherit;">The ${speciesMode.animal} was <b>${targetShark.name}</b></p>
${speciesMode.key === "nightmare" ? "" : `<p style="margin: 8px 0 14px;"><a href="${getSharkdleWikipediaUrl(targetShark.name)}" target="_blank" rel="noopener noreferrer" style="color: inherit; font-weight: 700; text-decoration: underline;">Learn more about the ${speciesMode.animal} on Wikipedia ↗</a></p>`}
<p style="font-size: 16px; margin: 10px 0; opacity: 0.9;">Discovered in ${targetShark.yod}</p>
        <p style="font-size: 16px; margin: 10px 0; opacity: 0.9;">You took ${guessesTaken} guess${guessesTaken !== 1 ? 'es' : ''}.</p>
${!firebase.auth().currentUser ? `<aside style="margin: 18px 0; padding: 14px 16px; border-radius: 10px; background: rgba(0,151,167,0.18); border: 1px solid rgba(0,188,212,0.4);"><strong>Sharkdle is better with an account 🦈</strong><p style="margin: 6px 0 10px; font-size: 14px;">Create an account to save your progress and unlock more features.</p><a href="index.html" style="color: inherit; font-weight: 700;">Create a free account →</a></aside>` : ''}
${!alreadyCompleted ? `<div style="margin: 20px 0; padding: 15px; background: rgba(255,255,255,0.2); border-radius: 8px;"><p style="font-size: 28px; font-weight: bold; margin: 0; color: inherit;">+${xpGained} XP</p>${pearlsGained ? `<p style="font-size: 20px; font-weight: bold; margin: 8px 0 0; color: #8ff5ef;">+${pearlsGained} Pearls</p>` : ''}</div>` : ''}
${speciesMode.key === "nightmare" ? '<div class="nightmare-reward-card"><span>WHO NEEDS MERCY · THEME: BLOOD &amp; BONES</span><strong>3× pearls and XP · Zebra Bullhead Shark icon · exclusive badge unlocked</strong><span>Sorry. You were right to doubt me.</span></div>' : '<div style="margin: 20px 0; padding: 12px; background: rgba(255,0,0,0.1); border-radius: 6px; font-size: 14px; text-align: center; color: #ff4444; font-weight: 600;">Next puzzle: <span id="win-countdown">--:--:--</span></div>'}
${getDailyVariantSwitcherHtml()}
<div style="display: flex; gap: 10px; margin-top: 25px; justify-content: center;">
    <button onclick="shareDailyResults()" style="padding: 12px 18px; font-size: 15px; cursor: pointer; background: #0097a7; border: none; border-radius: 6px; color: white; font-weight: bold; transition: filter 0.2s;">🦈 Share Results</button>
    ${speciesMode.key === "nightmare" ? '<button onclick="shareDailyResults()" style="padding: 12px 18px; font-size: 15px; cursor: pointer; background: #B5121B; border: none; border-radius: 6px; color: white; font-weight: bold;">Bragging rights: share your win</button>' : `<button onclick="window.location.href='${getInfiniteModeHref()}'" style="padding: 12px 25px; font-size: 15px; cursor: pointer; background: rgba(255,255,255,0.3); border: none; border-radius: 6px; color: inherit; font-weight: bold; transition: background 0.3s;">Play Infinite</button>`}
    <button onclick="window.location.href=resolveAppPath('index.html')" style="padding: 12px 25px; font-size: 15px; cursor: pointer; background: rgba(0,0,0,0.3); border: none; border-radius: 6px; color: inherit; font-weight: bold; transition: background 0.3s;">Back to Home</button>
</div>
`

win.style.display="block"
win.classList.add("win")
win.classList.remove("lose")

createBubbles(win);

}


function showLose(alreadyCompleted = false){

// Check achievements for loss conditions (only on first completion)
if (speciesMode.key !== "nightmare" && !alreadyCompleted && window.checkAchievements) {
    window.checkAchievements(false, maxAttempts, false);
}

const win = document.getElementById("win-screen")

const failureCount = getNightmareStats().failures;
const insult = NIGHTMARE_INSULTS[Math.min(Math.floor(Math.log2(Math.max(1, failureCount))), NIGHTMARE_INSULTS.length - 1)];
let headerText = speciesMode.key === "nightmare" ? "YOU RAN OUT OF MERCY." : alreadyCompleted ? `✗ You could not discover today's Daily ${speciesMode.animalTitle}` : "😢 You Lost";

win.innerHTML = `
<button onclick="document.getElementById('win-screen').style.display='none'; document.getElementById('show-results-btn').style.display='block';" style="position: absolute; top: 8px; right: 8px; width: 32px; height: 32px; background: rgba(0,0,0,0.3); border: none; border-radius: 50%; color: inherit; font-size: 20px; cursor: pointer; display: flex; align-items: center; justify-content: center; transition: background 0.2s; font-weight: bold;">×</button>
<h2 style="margin-top: 0; font-size: 32px; margin-bottom: 20px;">${headerText}</h2>
<p style="font-size: 18px; margin: 10px 0; color: inherit;">The ${speciesMode.animal} was <b>${targetShark.name}</b></p>
${speciesMode.key === "nightmare" ? `<p class="nightmare-insult">${insult}<br><small>Failure #${failureCount} · your normal streak is safe.</small></p>` : ""}
<p style="font-size: 16px; margin: 10px 0; opacity: 0.9;">Discovered in ${targetShark.yod}</p>
${speciesMode.key === "nightmare" ? "" : '<div style="margin: 20px 0; padding: 12px; background: rgba(255,0,0,0.1); border-radius: 6px; font-size: 14px; text-align: center; color: #ff4444; font-weight: 600;">Next puzzle: <span id="win-countdown">--:--:--</span></div>'}
${getDailyVariantSwitcherHtml()}
<div style="display: flex; gap: 10px; margin-top: 25px; justify-content: center;">
    <button onclick="shareDailyResults()" style="padding: 12px 18px; font-size: 15px; cursor: pointer; background: #0097a7; border: none; border-radius: 6px; color: white; font-weight: bold; transition: filter 0.2s;">🦈 Share Results</button>
    ${speciesMode.key === "nightmare" ? "" : `<button onclick="window.location.href='${getInfiniteModeHref()}'" style="padding: 12px 25px; font-size: 15px; cursor: pointer; background: rgba(255,255,255,0.3); border: none; border-radius: 6px; color: inherit; font-weight: bold; transition: background 0.3s;">Play Infinite</button>`}
    <button onclick="window.location.href=resolveAppPath('index.html')" style="padding: 12px 25px; font-size: 15px; cursor: pointer; background: rgba(0,0,0,0.3); border: none; border-radius: 6px; color: inherit; font-weight: bold; transition: background 0.3s;">Back to Home</button>
</div>
`

win.style.display="block"
if (speciesMode.key !== "nightmare") appendSharchiveReviewButton(win)
win.classList.add("lose")
win.classList.remove("win")
}

// Console command for testing: revealShark() - Dev only
window.revealShark = function() {
    const DEV_UIDS = ['ETPtQC0VA2NiSnX67rS2P2ma2tC2', 'gOcPqOuyPJRWisE4dxvFkGTOl5g2'];
    if (!firebase.auth().currentUser || !DEV_UIDS.includes(firebase.auth().currentUser.uid)) {
        console.log("Access denied. This command is for developers only.");
        return;
    }
    console.log(`TESTING ONLY: The target ${speciesMode.animal} is: ${targetShark.name}`);
};

// Hint functionality
const common_names = [
    {"scientific": "Carcharhiniformes", "Common": "Ground Sharks"},
    {"scientific": "Orectolobiformes", "Common": "Carpet Sharks"},
    {"scientific": "Lamniformes", "Common": "Mackerel Sharks"},
    {"scientific": "Heterodontiformes", "Common": "Bullhead Sharks"},
    {"scientific": "Squatiniformes", "Common": "Angel Sharks"},
    {"scientific": "Pristiophoriformes", "Common": "Saw Sharks"},
    {"scientific": "Squaliformes", "Common": "Dog Sharks"},
    {"scientific": "Hexanchiformes", "Common": "Cow and Frilled Sharks"},
    {"scientific": "Sphyrnidae", "Common": "Hammerhead Sharks"},
    {"scientific": "Carcharhinidae", "Common": "Requiem Sharks"},
    {"scientific": "Rhincodontidae", "Common": "Whale Sharks"},
    {"scientific": "Orectolobidae", "Common": "Wobbegong Sharks"},
    {"scientific": "Hemiscylliidae", "Common": "Bamboo Sharks"},
    {"scientific": "Ginglymostomatidae", "Common": "Nurse Sharks"},
    {"scientific": "Dalatiidae", "Common": "Kitefin Sharks"},
    {"scientific": "Etmopteridae", "Common": "Lantern Sharks"},
    {"scientific": "Echinorhinidae", "Common": "Bramble Sharks"},
    {"scientific": "Odontaspididae", "Common": "Sand Tiger Sharks"},
    {"scientific": "Megachasmidae", "Common": "Megamouth Sharks"},
    {"scientific": "Lamnidae", "Common": "Mackerel Sharks"},
    {"scientific": "Hexanchidae", "Common": "Cow Sharks"},
    {"scientific": "Centrophoridae", "Common": "Gulper Sharks"},
    {"scientific": "Pristiophoridae", "Common": "Saw Sharks"},
    {"scientific": "Squatinidae", "Common": "Angel Sharks"},
    {"scientific": "Heterodontidae", "Common": "Bullhead Sharks"},
    {"scientific": "Alopiidae", "Common": "Thresher Sharks"},
    {"scientific": "Cetorhinidae", "Common": "Basking Sharks"},
    {"scientific": "Mitsukurinidae", "Common": "Goblin Sharks"},
    {"scientific": "Brachaeluridae", "Common": "Blind Sharks"},
    {"scientific": "Chlamydoselachidae", "Common": "Frilled Sharks"},
    {"scientific": "Pseudocarchariidae", "Common": "Crocodile Sharks"},
    {"scientific": "Somniosidae", "Common": "Sleeper Sharks"},
];
