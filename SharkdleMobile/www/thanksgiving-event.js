(function () {
"use strict";
function openThanksgivingEventModal() {
    document.getElementById("thanksgivingEventModal")?.classList.remove("hidden");
    refreshThanksgivingEventState();
}

function closeThanksgivingEventModal() {
    document.getElementById("thanksgivingEventModal")?.classList.add("hidden");
}

window.openThanksgivingEventModal = openThanksgivingEventModal;
window.closeThanksgivingEventModal = closeThanksgivingEventModal;

function getThanksgivingAuthUser() {
    if (typeof firebase !== "undefined" && typeof firebase.auth === "function") {
        return firebase.auth().currentUser || window.currentUser || currentUser || null;
    }
    return window.currentUser || currentUser || null;
}

function getThanksgivingDb() {
    if (typeof db !== "undefined" && db) return db;
    return typeof firebase !== "undefined" && typeof firebase.firestore === "function" ? firebase.firestore() : null;
}

async function waitForThanksgivingAuthUser() {
    const existing = getThanksgivingAuthUser();
    if (existing?.uid || typeof firebase === "undefined" || typeof firebase.auth !== "function") return existing;
    return new Promise(resolve => {
        let unsubscribe = () => {};
        const timeout = setTimeout(() => { unsubscribe(); resolve(getThanksgivingAuthUser()); }, 1800);
        unsubscribe = firebase.auth().onAuthStateChanged(user => {
            clearTimeout(timeout);
            unsubscribe();
            resolve(user || null);
        });
    });
}

const THANKSGIVING_EVENT_QUESTS = [
    { id: "daily-win", activity: "dailyWin", goal: 1, points: 25, game: "daily" },
    { id: "daily-fast", activity: "dailyFast", goal: 1, points: 25, game: "daily" },
    { id: "infinite-play", activity: "infinitePlay", goal: 3, points: 20, game: "infinite" },
    { id: "infinite-wins", activity: "infiniteWin", goal: 3, points: 30, game: "infinite" },
    { id: "practice-solve", activity: "practiceSolve", goal: 5, points: 15, game: "practice" },
    { id: "rng-rolls", activity: "rngRoll", goal: 1000, points: 25, game: "rng" },
    { id: "rng-rare", activity: "rngRare", goal: 1, points: 40, game: "rng" },
    { id: "rng-index", activity: "rngIndex", goal: 3, points: 15, game: "rng" },
    { id: "story-chapter", activity: "storyChapter", goal: 1, points: 15, game: "story" },
    { id: "story-explorer", activity: "storyExplorer", goal: 3, points: 25, game: "story" },
    { id: "story-complete", activity: "storyComplete", goal: 1, points: 0, game: "story", hidden: true },
    { id: "cross-game", activity: "anyQuest", goal: 3, points: 15, game: "cross" }
];
const THANKSGIVING_EVENT_MILESTONES = [
    { points: 25, crates: 1 }, { points: 50, crates: 2 }, { points: 75, crates: 3 },
    { points: 100, crates: 4 }, { points: 125, crates: 5 }, { points: 150, crates: 6 },
    { points: 175, crates: 7 }, { points: 250, crates: 10, bramble: true }
];

function renderThanksgivingEventState(eventState = {}) {
    const points = Math.max(0, Number(eventState.points) || 0);
    const pointLabel = document.querySelector("#thanksgivingEventModal .thanksgiving-event-preview-heading span");
    const bar = document.querySelector("#thanksgivingEventModal .thanksgiving-event-progress");
    if (pointLabel) pointLabel.textContent = `${Math.min(points, 250).toLocaleString()} / 250 points`;
    if (bar) {
        bar.setAttribute("aria-valuenow", String(Math.min(points, 250)));
        const fill = bar.querySelector("span");
        if (fill) fill.style.width = `${Math.min(100, points / 2.5)}%`;
    }
    const rows = document.querySelectorAll("#thanksgivingEventModal .thanksgiving-event-quest-list article");
    THANKSGIVING_EVENT_QUESTS.filter(quest => !quest.hidden).forEach((quest, index) => {
        const row = rows[index];
        if (!row) return;
        const progress = Math.min(quest.goal, Math.max(0, Number(eventState.progress?.[quest.id]) || 0));
        const done = Boolean(eventState.claimedQuests?.includes(quest.id));
        const detail = row.querySelector("small");
        if (detail) {
            detail.dataset.description ||= detail.textContent;
            detail.textContent = done ? `Completed · ${detail.dataset.description}` : `${progress.toLocaleString()}/${quest.goal.toLocaleString()} · ${detail.dataset.description}`;
        }
        row.classList.toggle("completed", done);
    });
    document.querySelectorAll("#thanksgivingEventModal [data-thanksgiving-reward]").forEach(button => {
        const milestone = Number(button.dataset.thanksgivingReward);
        const claimed = Boolean(eventState.claimedRewards?.includes(String(milestone)));
        button.disabled = claimed || points < milestone || !getThanksgivingAuthUser();
        button.textContent = claimed ? "Claimed" : points >= milestone ? "Claim" : "Locked";
        button.classList.toggle("ready", points >= milestone && !claimed);
    });
}

async function refreshThanksgivingEventState() {
    const uid = getThanksgivingAuthUser()?.uid;
    const firestore = getThanksgivingDb();
    if (!uid || !firestore) return renderThanksgivingEventState({});
    try {
        const snapshot = await firestore.collection("userStats").doc(uid).get();
        if (getThanksgivingAuthUser()?.uid === uid) renderThanksgivingEventState(snapshot.data()?.thanksgivingEvent || {});
    } catch (error) { console.warn("Thanksgiving event progress could not load:", error); }
}

async function recordThanksgivingEventActivity(activity, amount = 1, source = "") {
    const authUser = await waitForThanksgivingAuthUser();
    const uid = authUser?.uid;
    const value = Math.max(1, Math.min(1000, Math.floor(Number(amount) || 1)));
    const firestore = getThanksgivingDb();
    if (!uid || !firestore || typeof firebase === "undefined" || !firebase.firestore) {
        if (typeof showNotification === "function") showNotification("Log in to save Thanksgiving quest progress.", "info", 4000);
        return { success: false, reason: "login-required" };
    }
    const ref = firestore.collection("userStats").doc(uid);
    try {
        let completed = [];
        let gainedPoints = 0;
        let resultingState;
        await firestore.runTransaction(async tx => {
            completed = [];
            gainedPoints = 0;
            resultingState = undefined;
            const snapshot = await tx.get(ref);
            const profile = snapshot.data() || {};
            const state = profile.thanksgivingEvent && typeof profile.thanksgivingEvent === "object"
                ? JSON.parse(JSON.stringify(profile.thanksgivingEvent)) : { points: 0, progress: {}, claimedQuests: [], claimedRewards: [], games: [] };
            state.progress ||= {}; state.claimedQuests ||= []; state.claimedRewards ||= []; state.games ||= [];
            const quest = THANKSGIVING_EVENT_QUESTS.find(item => item.activity === activity);
            if (!quest) return;
            state.progress[quest.id] = Math.min(quest.goal, (Number(state.progress[quest.id]) || 0) + value);
            const awardQuest = item => {
                if (state.progress[item.id] < item.goal || state.claimedQuests.includes(item.id)) return;
                state.claimedQuests.push(item.id); state.points = (Number(state.points) || 0) + item.points;
                gainedPoints += item.points; completed.push(item.id);
                const game = item.game;
                if (game && game !== "cross" && !state.games.includes(game)) state.games.push(game);
            };
            awardQuest(quest);
            if (activity === "storyComplete") {
                const completedStoryQuests = ["story-chapter", "story-explorer"].filter(id => !state.claimedQuests.includes(id));
                for (const id of completedStoryQuests) {
                    const storyQuest = THANKSGIVING_EVENT_QUESTS.find(item => item.id === id);
                    state.progress[id] = storyQuest.goal;
                    awardQuest(storyQuest);
                }
                state.games = Array.from(new Set([...state.games, "story"]));
            }
            if (quest.id !== "cross-game") {
                state.progress["cross-game"] = state.games.length;
                awardQuest(THANKSGIVING_EVENT_QUESTS.find(item => item.id === "cross-game"));
            }
            tx.set(ref, { thanksgivingEvent: state }, { merge: true });
            resultingState = state;
        });
        if (getThanksgivingAuthUser()?.uid !== uid || !resultingState) return { success: false, reason: "not-updated" };
        const local = getCurrentProfileData();
        local.thanksgivingEvent = resultingState;
        const remote = await ref.get();
        const data = remote.data() || {};
        local.crateInventory = normalizeCrateInventory(data.crateInventory || local.crateInventory);
        local.earnedCosmetics = Array.isArray(data.earnedCosmetics) ? data.earnedCosmetics : local.earnedCosmetics;
        saveUserProfileLocally(local, { skipRemoteSync: true });
        renderThanksgivingEventState(resultingState);
        if (completed.length) showNotification(`Thanksgiving quest complete! +${gainedPoints} points`, "success", 5000);
        return { success: true, completed, points: gainedPoints };
    } catch (error) {
        console.warn("Thanksgiving quest progress could not save:", error);
        if (currentUser?.uid === uid) showNotification("Thanksgiving quest progress could not save. Please try again.", "error", 3500);
        return { success: false, reason: "save-failed" };
    }
}
window.recordThanksgivingEventActivity = recordThanksgivingEventActivity;

async function claimThanksgivingEventReward(rawPoints) {
    const points = Number(rawPoints);
    const milestone = THANKSGIVING_EVENT_MILESTONES.find(item => item.points === points);
    const uid = getThanksgivingAuthUser()?.uid;
    const firestore = getThanksgivingDb();
    if (!milestone || !uid || !firestore || typeof firebase === "undefined" || !firebase.firestore) return false;
    const ref = firestore.collection("userStats").doc(uid);
    try {
        await firestore.runTransaction(async tx => {
            const snapshot = await tx.get(ref);
            const profile = snapshot.data() || {};
            const state = profile.thanksgivingEvent && typeof profile.thanksgivingEvent === "object"
                ? JSON.parse(JSON.stringify(profile.thanksgivingEvent)) : { points: 0, claimedRewards: [] };
            state.claimedRewards ||= [];
            const id = String(points);
            if ((Number(state.points) || 0) < points || state.claimedRewards.includes(id)) throw new Error("Reward is not available.");
            state.claimedRewards.push(id);
            const inventory = normalizeCrateInventory(profile.crateInventory || {});
            inventory.thanksgiving = (inventory.thanksgiving || 0) + milestone.crates;
            const cosmetics = Array.isArray(profile.earnedCosmetics) ? [...profile.earnedCosmetics] : [];
            if (milestone.bramble && !cosmetics.some(item => item.imagePath === "images/ThanksGivingEvent/BrambleShark.png")) {
                cosmetics.push({ name: "Bramble Shark", imagePath: "images/ThanksGivingEvent/BrambleShark.png", eventReward: true, rarity: "legendary" });
            }
            tx.set(ref, { thanksgivingEvent: state, crateInventory: inventory, crateInventoryUpdatedAt: firebase.firestore.FieldValue.serverTimestamp(), earnedCosmetics: cosmetics }, { merge: true });
        });
        await refreshThanksgivingEventState();
        const profile = getCurrentProfileData();
        const updated = (await ref.get()).data() || {};
        profile.thanksgivingEvent = updated.thanksgivingEvent;
        profile.crateInventory = normalizeCrateInventory(updated.crateInventory || profile.crateInventory);
        profile.earnedCosmetics = Array.isArray(updated.earnedCosmetics) ? updated.earnedCosmetics : profile.earnedCosmetics;
        saveUserProfileLocally(profile, { skipRemoteSync: true });
        renderCratesButton(); renderCratesModal();
        showNotification(`${milestone.crates} Thanksgiving Crate${milestone.crates === 1 ? "" : "s"}${milestone.bramble ? " and the Bramble Shark icon" : ""} claimed!`, "success", 4500);
        return true;
    } catch (error) {
        showNotification(error.message === "Reward is not available." ? "Earn enough Thanksgiving Points to claim this reward." : "The reward could not be saved. Please try again.", "error", 3500);
        return false;
    }
}
window.claimThanksgivingEventReward = claimThanksgivingEventReward;


})();
