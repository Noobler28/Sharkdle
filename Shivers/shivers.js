(function () {
    "use strict";

    const SHIVER_MAX_MEMBERS = 25;
    const SHIVER_SEASON_ID = "tide-clash-2026-07";
    const SHIVER_SEASON_LABEL = "Tide Clash";
    const SHIVER_BATTLE_CONFIG_DOC = "shiverBattle";
    const DEFAULT_PROFILE_PIC = "images/pfp/shark1.png";
    const DEFAULT_BATTLE_GOAL_ID = "points";

    const SHIVER_BATTLE_GOALS = Object.freeze({
        points: {
            id: "points",
            field: "points",
            shiverField: "seasonPoints",
            label: "Most Teeth",
            shortLabel: "Teeth",
            unit: "teeth",
            copy: "Daily and Infinite wins add teeth for your Shiver."
        },
        wins: {
            id: "wins",
            field: "wins",
            shiverField: "wins",
            label: "Most Wins",
            shortLabel: "Wins",
            unit: "wins",
            copy: "Every counted Daily or Infinite win moves the board."
        },
        dailyWins: {
            id: "dailyWins",
            field: "dailyWins",
            shiverField: "dailyWins",
            label: "Most Daily Wins",
            shortLabel: "Daily Wins",
            unit: "daily wins",
            copy: "Only Daily Challenge wins count for this battle goal."
        },
        infiniteWins: {
            id: "infiniteWins",
            field: "infiniteWins",
            shiverField: "infiniteWins",
            label: "Most Infinite Wins",
            shortLabel: "Infinite Wins",
            unit: "infinite wins",
            copy: "Only Infinite Mode wins count for this battle goal."
        },
        memberCount: {
            id: "memberCount",
            field: "memberCount",
            shiverField: "memberCount",
            label: "Biggest Shiver",
            shortLabel: "Members",
            unit: "members",
            copy: "The Shiver with the largest active roster leads."
        }
    });

    const state = {
        auth: null,
        db: null,
        user: null,
        membership: null,
        currentShiver: null,
        members: [],
        leaderboard: [],
        battleEntries: [],
        battleConfig: normalizeBattleConfig(null),
        selectedGoalId: DEFAULT_BATTLE_GOAL_ID,
        leaderboardUnsubscribe: null,
        battleUnsubscribe: null,
        configUnsubscribe: null
    };

    const els = {};

    document.addEventListener("DOMContentLoaded", initShiversPage);

    function initShiversPage() {
        cacheElements();
        bindEvents();
        setupColorPicker();
        renderBattleGoalUi();

        waitForFirebase().then(() => {
            state.auth = firebase.auth();
            state.db = firebase.firestore();
            subscribeToBattleConfig();
            subscribeToLeaderboard();
            state.auth.onAuthStateChanged(async user => {
                state.user = user || null;
                await refreshUserShiver();
                renderAll();
            });
        }).catch(error => {
            console.warn("Unable to start Shivers:", error);
            setAuthState("Shivers could not connect right now.", true);
        });
    }

    function cacheElements() {
        [
            "shiver-auth-state",
            "hero-shiver-name",
            "hero-battle-goal",
            "hero-season-points",
            "hero-member-count",
            "current-shiver-panel",
            "current-shiver-name",
            "current-shiver-tag",
            "current-shiver-points-label",
            "current-shiver-points",
            "current-shiver-wins",
            "current-shiver-role",
            "current-shiver-description",
            "leave-shiver-btn",
            "play-daily-btn",
            "play-infinite-btn",
            "create-shiver-form",
            "shiver-name-input",
            "shiver-tag-input",
            "shiver-description-input",
            "shiver-color-input",
            "roster-count",
            "roster-list",
            "battle-goal-title",
            "battle-goal-copy",
            "battle-goal-admin",
            "battle-goal-options",
            "save-battle-goal-btn",
            "battle-list",
            "leaderboard-list",
            "discover-list",
            "shiver-search-input",
            "refresh-shivers-btn"
        ].forEach(id => {
            els[id] = document.getElementById(id);
        });
    }

    function bindEvents() {
        els["create-shiver-form"]?.addEventListener("submit", createShiver);
        els["leave-shiver-btn"]?.addEventListener("click", leaveCurrentShiver);
        els["play-daily-btn"]?.addEventListener("click", () => navigate("Daily/index.html"));
        els["play-infinite-btn"]?.addEventListener("click", () => navigate("Infinite/index.html"));
        els["refresh-shivers-btn"]?.addEventListener("click", () => {
            refreshUserShiver().then(renderAll);
            showToast("Shivers refreshed.", "success");
        });
        els["shiver-search-input"]?.addEventListener("input", renderDiscoverList);
        els["save-battle-goal-btn"]?.addEventListener("click", saveBattleGoal);

        document.addEventListener("click", event => {
            const joinButton = event.target.closest("[data-join-shiver]");
            if (joinButton) {
                joinShiver(joinButton.dataset.joinShiver);
                return;
            }

            const goalButton = event.target.closest("[data-battle-goal]");
            if (goalButton && canEditBattleGoal()) {
                state.selectedGoalId = normalizeGoalId(goalButton.dataset.battleGoal);
                renderBattleGoalUi();
            }
        });
    }

    function setupColorPicker() {
        document.querySelectorAll("[data-shiver-color]").forEach(button => {
            button.addEventListener("click", () => {
                document.querySelectorAll("[data-shiver-color]").forEach(item => item.classList.remove("selected"));
                button.classList.add("selected");
                if (els["shiver-color-input"]) {
                    els["shiver-color-input"].value = button.dataset.shiverColor || "reef";
                }
            });
        });
    }

    function waitForFirebase() {
        return new Promise((resolve, reject) => {
            let attempts = 0;
            const timer = setInterval(() => {
                attempts += 1;
                if (typeof firebase !== "undefined" && firebase.apps && firebase.apps.length) {
                    clearInterval(timer);
                    resolve();
                } else if (attempts > 80) {
                    clearInterval(timer);
                    reject(new Error("Firebase was not ready."));
                }
            }, 100);
        });
    }

    function subscribeToBattleConfig() {
        if (!state.db || state.configUnsubscribe) return;
        state.configUnsubscribe = state.db.collection("globalConfig").doc(SHIVER_BATTLE_CONFIG_DOC)
            .onSnapshot(snapshot => {
                state.battleConfig = normalizeBattleConfig(snapshot.exists ? snapshot.data() : null);
                state.selectedGoalId = state.battleConfig.goalId;
                subscribeToBattleEntries();
                renderBattleGoalUi();
                renderAll();
            }, error => {
                console.warn("Unable to load Shiver battle config:", error);
                state.battleConfig = normalizeBattleConfig(null);
                subscribeToBattleEntries();
                renderBattleGoalUi();
            });
    }

    function subscribeToLeaderboard() {
        if (!state.db || state.leaderboardUnsubscribe) return;
        state.leaderboardUnsubscribe = state.db.collection("shivers")
            .orderBy("seasonPoints", "desc")
            .limit(30)
            .onSnapshot(snapshot => {
                state.leaderboard = snapshot.docs
                    .map(doc => ({ id: doc.id, ...(doc.data() || {}) }))
                    .filter(shiver => shiver.status !== "disbanded");
                renderLeaderboard();
                renderBattleList();
                renderDiscoverList();
            }, error => {
                console.warn("Unable to load Shiver leaderboard:", error);
                setListHtml(els["leaderboard-list"], `<p class="shiver-empty">Leaderboard unavailable.</p>`);
            });
    }

    function subscribeToBattleEntries() {
        if (!state.db) return;
        if (state.battleUnsubscribe) {
            state.battleUnsubscribe();
            state.battleUnsubscribe = null;
        }

        const goal = getActiveGoal();
        const query = goal.id === "memberCount"
            ? state.db.collection("shivers")
            : state.db.collection("shiverSeasons").doc(SHIVER_SEASON_ID).collection("entries");

        state.battleUnsubscribe = query
            .orderBy(goal.field, "desc")
            .limit(15)
            .onSnapshot(snapshot => {
                state.battleEntries = snapshot.docs.map(doc => ({ id: doc.id, ...(doc.data() || {}) }));
                renderBattleList();
            }, error => {
                console.warn("Unable to load Shiver battle entries:", error);
                state.battleEntries = [];
                renderBattleList();
            });
    }

    async function refreshUserShiver() {
        if (!state.db || !state.user) {
            state.membership = null;
            state.currentShiver = null;
            state.members = [];
            return;
        }

        try {
            const membershipRef = state.db.collection("userShivers").doc(state.user.uid);
            const membershipSnap = await membershipRef.get();
            if (!membershipSnap.exists) {
                state.membership = null;
                state.currentShiver = null;
                state.members = [];
                return;
            }

            const membership = membershipSnap.data() || {};
            if (!membership.shiverId) {
                state.membership = null;
                state.currentShiver = null;
                state.members = [];
                return;
            }

            const shiverRef = state.db.collection("shivers").doc(membership.shiverId);
            const [shiverSnap, membersSnap] = await Promise.all([
                shiverRef.get(),
                shiverRef.collection("members").orderBy("joinedAt", "asc").limit(SHIVER_MAX_MEMBERS).get()
            ]);

            if (!shiverSnap.exists || shiverSnap.data()?.status === "disbanded") {
                state.membership = null;
                state.currentShiver = null;
                state.members = [];
                return;
            }

            state.membership = membership;
            state.currentShiver = { id: shiverSnap.id, ...(shiverSnap.data() || {}) };
            state.members = membersSnap.docs.map(doc => ({ id: doc.id, ...(doc.data() || {}) }));
            syncLocalShiverProfile(state.membership, state.currentShiver);
        } catch (error) {
            console.warn("Unable to refresh current Shiver:", error);
            showToast("Could not load your Shiver.", "error");
        }
    }

    function renderAll() {
        renderAuthState();
        renderCurrentShiver();
        renderRoster();
        renderLeaderboard();
        renderBattleList();
        renderDiscoverList();
        renderBattleGoalUi();
        updateCreateFormState();
    }

    function renderAuthState() {
        if (!state.user) {
            setAuthState("Login to create, join, or score for a Shiver.", true);
            return;
        }
        setAuthState(`Logged in as ${getProfileName()}.`, false);
    }

    function renderBattleGoalUi() {
        const activeGoal = getActiveGoal();
        setText("hero-battle-goal", activeGoal.shortLabel);
        setText("battle-goal-title", activeGoal.label);
        setText("battle-goal-copy", activeGoal.copy);

        if (els["battle-goal-admin"]) {
            els["battle-goal-admin"].hidden = !canEditBattleGoal();
        }

        if (els["battle-goal-options"]) {
            els["battle-goal-options"].innerHTML = Object.values(SHIVER_BATTLE_GOALS).map(goal => `
                <button type="button" class="${goal.id === state.selectedGoalId ? "selected" : ""}" data-battle-goal="${goal.id}">
                    ${escapeHtml(goal.label)}
                </button>
            `).join("");
        }

        const saveButton = els["save-battle-goal-btn"];
        if (saveButton) {
            saveButton.disabled = !canEditBattleGoal() || state.selectedGoalId === state.battleConfig.goalId;
        }
    }

    function renderCurrentShiver() {
        const shiver = state.currentShiver;
        const goal = getActiveGoal();
        document.body.classList.remove("shiver-color-reef", "shiver-color-current", "shiver-color-ember", "shiver-color-glacier");
        setText("current-shiver-points-label", goal.shortLabel);

        if (!shiver) {
            setText("hero-shiver-name", "None");
            setText("hero-season-points", "0");
            setText("hero-member-count", `0/${SHIVER_MAX_MEMBERS}`);
            setText("current-shiver-name", "No Shiver Joined");
            setText("current-shiver-tag", "----");
            setText("current-shiver-points", "0");
            setText("current-shiver-wins", "0");
            setText("current-shiver-role", "None");
            setText("current-shiver-description", state.user ? "Create or join a Shiver to start earning group points." : "Login to join a Shiver.");
            els["leave-shiver-btn"] && (els["leave-shiver-btn"].disabled = true);
            return;
        }

        document.body.classList.add(`shiver-color-${sanitizeColor(shiver.color)}`);
        setText("hero-shiver-name", shiver.name || "Your Shiver");
        setText("hero-season-points", formatNumber(getBattleValue(shiver, goal)));
        setText("hero-member-count", `${Math.max(0, Number(shiver.memberCount) || 0)}/${SHIVER_MAX_MEMBERS}`);
        setText("current-shiver-name", shiver.name || "Unnamed Shiver");
        setText("current-shiver-tag", shiver.tag || "----");
        setText("current-shiver-points", formatNumber(getBattleValue(shiver, goal)));
        setText("current-shiver-wins", formatNumber(shiver.wins));
        setText("current-shiver-role", formatRole(state.membership?.role || "member"));
        setText("current-shiver-description", shiver.description || `${SHIVER_SEASON_LABEL} is live.`);
        els["leave-shiver-btn"] && (els["leave-shiver-btn"].disabled = false);
    }

    function renderRoster() {
        setText("roster-count", String(state.members.length));
        if (!state.currentShiver) {
            setListHtml(els["roster-list"], `<p class="shiver-empty">No roster yet.</p>`);
            return;
        }

        if (!state.members.length) {
            setListHtml(els["roster-list"], `<p class="shiver-empty">No members loaded.</p>`);
            return;
        }

        const rows = state.members.map(member => `
            <article class="shiver-member-row">
                <img src="${escapeAttr(resolveProfilePicture(member.profilePicture))}" alt="${escapeAttr(member.username || "Shiver member")}" onerror="this.onerror=null;this.src='${DEFAULT_PROFILE_PIC}';">
                <div>
                    <strong>${escapeHtml(member.username || "Sharkdle Player")}</strong>
                    <span class="shiver-member-role">${formatRole(member.role || "member")} - ${formatNumber(member.wins)} wins</span>
                </div>
                <span class="shiver-member-score">${formatNumber(member.points)} teeth</span>
            </article>
        `).join("");
        setListHtml(els["roster-list"], rows);
    }

    function renderLeaderboard() {
        if (!els["leaderboard-list"]) return;
        const rows = state.leaderboard.slice(0, 12);
        if (!rows.length) {
            setListHtml(els["leaderboard-list"], `<p class="shiver-empty">No Shivers yet.</p>`);
            return;
        }
        setListHtml(els["leaderboard-list"], rows.map((shiver, index) => renderShiverCard(shiver, index + 1)).join(""));
    }

    function renderBattleList() {
        if (!els["battle-list"]) return;
        const goal = getActiveGoal();
        const rows = getBattleRows(goal).slice(0, 8);
        if (!rows.length) {
            setListHtml(els["battle-list"], `<p class="shiver-empty">No battle scores yet.</p>`);
            return;
        }

        setListHtml(els["battle-list"], rows.map((shiver, index) => {
            const value = getBattleValue(shiver, goal);
            return `
                <article class="shiver-battle-row top-${index + 1}">
                    <span class="shiver-card-rank">#${index + 1}</span>
                    <div>
                        <strong>${escapeHtml(shiver.name || "Unnamed Shiver")} <span class="shiver-card-meta">[${escapeHtml(shiver.tag || "----")}]</span></strong>
                        <span class="shiver-card-meta">${formatNumber(shiver.wins)} wins - ${Math.max(0, Number(shiver.memberCount) || 0)} members</span>
                    </div>
                    <span class="shiver-battle-score">${formatMetric(value, goal)}</span>
                </article>
            `;
        }).join(""));
    }

    function renderDiscoverList() {
        if (!els["discover-list"]) return;
        const query = String(els["shiver-search-input"]?.value || "").trim().toLowerCase();
        const rows = state.leaderboard
            .filter(shiver => shiver.visibility !== "closed")
            .filter(shiver => !query
                || String(shiver.name || "").toLowerCase().includes(query)
                || String(shiver.tag || "").toLowerCase().includes(query))
            .slice(0, 8);

        if (!rows.length) {
            setListHtml(els["discover-list"], `<p class="shiver-empty">No open Shivers found.</p>`);
            return;
        }

        setListHtml(els["discover-list"], rows.map(shiver => renderShiverCard(shiver, null)).join(""));
    }

    function renderShiverCard(shiver, rank) {
        const isCurrent = state.currentShiver?.id === shiver.id;
        const isFull = (Number(shiver.memberCount) || 0) >= SHIVER_MAX_MEMBERS;
        const disabled = !state.user || Boolean(state.membership) || isCurrent || isFull;
        const buttonLabel = isCurrent ? "Joined" : isFull ? "Full" : state.membership ? "In Shiver" : "Join";
        const rankMarkup = rank ? `<span class="shiver-card-rank">#${rank}</span>` : "";
        return `
            <article class="shiver-card">
                <div class="shiver-card-main">
                    <div class="shiver-card-title">
                        ${rankMarkup}
                        <strong>${escapeHtml(shiver.name || "Unnamed Shiver")}</strong>
                        <span class="shiver-tag">${escapeHtml(shiver.tag || "----")}</span>
                    </div>
                    <div class="shiver-card-meta">
                        <span>${formatNumber(shiver.seasonPoints ?? shiver.points)} teeth</span>
                        <span>${formatNumber(shiver.wins)} wins</span>
                        <span>${Math.max(0, Number(shiver.memberCount) || 0)}/${SHIVER_MAX_MEMBERS}</span>
                    </div>
                </div>
                <button type="button" class="${!disabled ? "primary" : ""}" data-join-shiver="${escapeAttr(shiver.id)}" ${disabled ? "disabled" : ""}>${buttonLabel}</button>
            </article>
        `;
    }

    function getBattleRows(goal = getActiveGoal()) {
        const source = state.battleEntries.length
            ? state.battleEntries
            : state.leaderboard.map(shiver => ({
                ...shiver,
                points: shiver.seasonPoints ?? shiver.points ?? 0
            }));

        return [...source]
            .filter(row => row.status !== "disbanded")
            .sort((a, b) => getBattleValue(b, goal) - getBattleValue(a, goal));
    }

    function updateCreateFormState() {
        const disabled = !state.user || Boolean(state.membership);
        els["create-shiver-form"]?.querySelectorAll("input, button").forEach(control => {
            if (control.matches("[data-shiver-color]") || control.type === "submit" || control.tagName === "INPUT") {
                control.disabled = disabled;
            }
        });
    }

    async function saveBattleGoal() {
        if (!canEditBattleGoal() || !state.db) return;
        const goalId = normalizeGoalId(state.selectedGoalId);
        const goal = SHIVER_BATTLE_GOALS[goalId];
        const button = els["save-battle-goal-btn"];
        setBusy(button, true, "Saving...");

        try {
            await state.db.collection("globalConfig").doc(SHIVER_BATTLE_CONFIG_DOC).set({
                goalId,
                field: goal.field,
                label: goal.label,
                seasonId: SHIVER_SEASON_ID,
                updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
                updatedBy: state.user.uid
            }, { merge: true });
            showToast(`Battle goal set to ${goal.label}.`, "success");
        } catch (error) {
            console.warn("Unable to save Shiver battle goal:", error);
            showToast("Could not save battle goal.", "error");
        } finally {
            setBusy(button, false);
            renderBattleGoalUi();
        }
    }

    async function createShiver(event) {
        event.preventDefault();
        if (!ensureLoggedIn()) return;
        if (state.membership) {
            showToast("Leave your current Shiver before creating another.", "info");
            return;
        }

        const name = normalizeDisplayText(els["shiver-name-input"]?.value, 28);
        const tag = normalizeTag(els["shiver-tag-input"]?.value);
        const description = normalizeDisplayText(els["shiver-description-input"]?.value, 120);
        const color = sanitizeColor(els["shiver-color-input"]?.value);

        if (name.length < 3) {
            showToast("Shiver name needs at least 3 characters.", "error");
            return;
        }
        if (tag.length < 2) {
            showToast("Tag needs 2 to 5 letters or numbers.", "error");
            return;
        }

        const submit = els["create-shiver-form"]?.querySelector("button[type='submit']");
        setBusy(submit, true, "Creating...");

        try {
            const existingTag = await state.db.collection("shivers").where("tagUpper", "==", tag).limit(1).get();
            if (!existingTag.empty && existingTag.docs.some(doc => doc.data()?.status !== "disbanded")) {
                showToast("That Shiver tag is already taken.", "error");
                return;
            }

            const profile = getLocalProfile();
            const userName = getProfileName(profile);
            const profilePicture = resolveProfilePicture(profile.profilePicture || profile.profilePic);
            const shiverId = `${tag.toLowerCase()}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;
            const shiverRef = state.db.collection("shivers").doc(shiverId);
            const memberRef = shiverRef.collection("members").doc(state.user.uid);
            const membershipRef = state.db.collection("userShivers").doc(state.user.uid);
            const now = firebase.firestore.FieldValue.serverTimestamp();

            await state.db.runTransaction(async transaction => {
                const membershipSnap = await transaction.get(membershipRef);
                if (membershipSnap.exists) throw new Error("You are already in a Shiver.");

                const shiverPayload = {
                    id: shiverId,
                    name,
                    nameLower: name.toLowerCase(),
                    tag,
                    tagUpper: tag,
                    description,
                    color,
                    ownerUid: state.user.uid,
                    ownerName: userName,
                    status: "active",
                    visibility: "open",
                    memberCount: 1,
                    maxMembers: SHIVER_MAX_MEMBERS,
                    totalPoints: 0,
                    seasonPoints: 0,
                    battlePoints: 0,
                    wins: 0,
                    dailyWins: 0,
                    infiniteWins: 0,
                    dailyPoints: 0,
                    infinitePoints: 0,
                    seasonId: SHIVER_SEASON_ID,
                    createdAt: now,
                    updatedAt: now
                };

                const memberPayload = {
                    uid: state.user.uid,
                    username: userName,
                    profilePicture,
                    role: "leader",
                    shiverId,
                    shiverName: name,
                    shiverTag: tag,
                    shiverColor: color,
                    points: 0,
                    wins: 0,
                    dailyWins: 0,
                    infiniteWins: 0,
                    joinedAt: now,
                    updatedAt: now
                };

                transaction.set(shiverRef, shiverPayload);
                transaction.set(memberRef, memberPayload);
                transaction.set(membershipRef, memberPayload);
            });

            await persistUserShiverFields({ shiverId, shiverName: name, shiverTag: tag, shiverColor: color, shiverRole: "leader" });
            els["create-shiver-form"]?.reset();
            document.querySelector("[data-shiver-color='reef']")?.click();
            showToast("Shiver created.", "success");
            await refreshUserShiver();
            renderAll();
        } catch (error) {
            console.warn("Unable to create Shiver:", error);
            showToast(error.message || "Could not create Shiver.", "error");
        } finally {
            setBusy(submit, false);
        }
    }

    async function joinShiver(shiverId) {
        if (!ensureLoggedIn()) return;
        if (!shiverId || state.membership) return;

        try {
            const shiverRef = state.db.collection("shivers").doc(shiverId);
            const memberRef = shiverRef.collection("members").doc(state.user.uid);
            const membershipRef = state.db.collection("userShivers").doc(state.user.uid);
            const seasonRef = state.db.collection("shiverSeasons").doc(SHIVER_SEASON_ID).collection("entries").doc(shiverId);
            const now = firebase.firestore.FieldValue.serverTimestamp();
            let joinedShiver = null;

            await state.db.runTransaction(async transaction => {
                const [membershipSnap, shiverSnap, seasonSnap] = await Promise.all([
                    transaction.get(membershipRef),
                    transaction.get(shiverRef),
                    transaction.get(seasonRef)
                ]);
                if (membershipSnap.exists) throw new Error("You are already in a Shiver.");
                if (!shiverSnap.exists || shiverSnap.data()?.status === "disbanded") throw new Error("That Shiver is unavailable.");

                const shiver = shiverSnap.data() || {};
                const memberCount = Math.max(0, Number(shiver.memberCount) || 0);
                const maxMembers = Math.max(1, Number(shiver.maxMembers) || SHIVER_MAX_MEMBERS);
                if (memberCount >= maxMembers) throw new Error("That Shiver is full.");
                if (shiver.visibility === "closed") throw new Error("That Shiver is closed.");

                const profile = getLocalProfile();
                const nextMemberCount = memberCount + 1;
                const memberPayload = {
                    uid: state.user.uid,
                    username: getProfileName(profile),
                    profilePicture: resolveProfilePicture(profile.profilePicture || profile.profilePic),
                    role: "member",
                    shiverId,
                    shiverName: shiver.name || "Unnamed Shiver",
                    shiverTag: shiver.tag || "----",
                    shiverColor: sanitizeColor(shiver.color),
                    points: 0,
                    wins: 0,
                    dailyWins: 0,
                    infiniteWins: 0,
                    joinedAt: now,
                    updatedAt: now
                };

                transaction.set(memberRef, memberPayload);
                transaction.set(membershipRef, memberPayload);
                transaction.update(shiverRef, {
                    memberCount: firebase.firestore.FieldValue.increment(1),
                    updatedAt: now
                });

                if (seasonSnap.exists) {
                    transaction.update(seasonRef, {
                        memberCount: firebase.firestore.FieldValue.increment(1),
                        updatedAt: now
                    });
                }

                joinedShiver = { id: shiverId, ...shiver, memberCount: nextMemberCount };
            });

            await persistUserShiverFields({
                shiverId,
                shiverName: joinedShiver?.name || "Unnamed Shiver",
                shiverTag: joinedShiver?.tag || "----",
                shiverColor: sanitizeColor(joinedShiver?.color),
                shiverRole: "member"
            });
            showToast("Joined Shiver.", "success");
            await refreshUserShiver();
            renderAll();
        } catch (error) {
            console.warn("Unable to join Shiver:", error);
            showToast(error.message || "Could not join Shiver.", "error");
        }
    }

    async function leaveCurrentShiver() {
        if (!ensureLoggedIn() || !state.membership?.shiverId) return;
        const shiverName = state.currentShiver?.name || "this Shiver";
        if (!window.confirm(`Leave ${shiverName}?`)) return;

        try {
            const shiverId = state.membership.shiverId;
            const shiverRef = state.db.collection("shivers").doc(shiverId);
            const memberRef = shiverRef.collection("members").doc(state.user.uid);
            const membershipRef = state.db.collection("userShivers").doc(state.user.uid);
            const seasonRef = state.db.collection("shiverSeasons").doc(SHIVER_SEASON_ID).collection("entries").doc(shiverId);
            const now = firebase.firestore.FieldValue.serverTimestamp();

            await state.db.runTransaction(async transaction => {
                const [membershipSnap, shiverSnap, seasonSnap] = await Promise.all([
                    transaction.get(membershipRef),
                    transaction.get(shiverRef),
                    transaction.get(seasonRef)
                ]);
                if (!membershipSnap.exists) return;
                const membership = membershipSnap.data() || {};
                const shiver = shiverSnap.exists ? (shiverSnap.data() || {}) : {};
                const memberCount = Math.max(0, Number(shiver.memberCount) || 0);
                const isLeader = membership.role === "leader";

                if (isLeader && memberCount > 1) {
                    throw new Error("Leaders cannot leave while other members remain.");
                }

                if (shiverSnap.exists) {
                    if (isLeader) {
                        transaction.update(shiverRef, {
                            status: "disbanded",
                            memberCount: 0,
                            updatedAt: now
                        });
                        if (seasonSnap.exists) {
                            transaction.update(seasonRef, {
                                memberCount: 0,
                                updatedAt: now
                            });
                        }
                    } else {
                        transaction.update(shiverRef, {
                            memberCount: firebase.firestore.FieldValue.increment(-1),
                            updatedAt: now
                        });
                        if (seasonSnap.exists) {
                            transaction.update(seasonRef, {
                                memberCount: firebase.firestore.FieldValue.increment(-1),
                                updatedAt: now
                            });
                        }
                    }
                }

                transaction.delete(memberRef);
                transaction.delete(membershipRef);
            });

            await clearUserShiverFields();
            state.membership = null;
            state.currentShiver = null;
            state.members = [];
            showToast("Left Shiver.", "success");
            renderAll();
        } catch (error) {
            console.warn("Unable to leave Shiver:", error);
            showToast(error.message || "Could not leave Shiver.", "error");
        }
    }

    function normalizeBattleConfig(rawConfig) {
        const goalId = normalizeGoalId(rawConfig?.goalId || rawConfig?.goal || rawConfig?.field);
        return {
            goalId,
            field: SHIVER_BATTLE_GOALS[goalId].field,
            label: SHIVER_BATTLE_GOALS[goalId].label,
            seasonId: rawConfig?.seasonId || SHIVER_SEASON_ID
        };
    }

    function normalizeGoalId(value) {
        const id = String(value || DEFAULT_BATTLE_GOAL_ID).trim();
        return SHIVER_BATTLE_GOALS[id] ? id : DEFAULT_BATTLE_GOAL_ID;
    }

    function getActiveGoal() {
        return SHIVER_BATTLE_GOALS[normalizeGoalId(state.battleConfig.goalId)];
    }

    function getBattleValue(row, goal = getActiveGoal()) {
        if (!row) return 0;
        if (goal.id === "points") {
            return Math.max(0, Number(row.points ?? row.seasonPoints ?? row.battlePoints) || 0);
        }
        return Math.max(0, Number(row[goal.field] ?? row[goal.shiverField]) || 0);
    }

    function formatMetric(value, goal = getActiveGoal()) {
        const amount = Math.max(0, Number(value) || 0);
        if (goal.id === "memberCount") return `${amount.toLocaleString()} member${amount === 1 ? "" : "s"}`;
        if (goal.id === "points") return `${amount.toLocaleString()} teeth`;
        return `${amount.toLocaleString()} ${goal.unit}`;
    }

    function canEditBattleGoal() {
        return Boolean(state.user && typeof isDeveloperUid === "function" && isDeveloperUid(state.user.uid));
    }

    function ensureLoggedIn() {
        if (state.user) return true;
        if (typeof openLoginModal === "function") {
            openLoginModal();
        } else {
            showToast("Login required.", "error");
        }
        return false;
    }

    async function persistUserShiverFields(fields) {
        if (!state.user || !state.db) return;
        const payload = {
            shiverId: fields.shiverId,
            shiverName: fields.shiverName,
            shiverTag: fields.shiverTag,
            shiverColor: fields.shiverColor,
            shiverRole: fields.shiverRole,
            shiverSeasonId: SHIVER_SEASON_ID,
            lastUpdated: Date.now()
        };
        syncLocalProfileFields(payload);
        await state.db.collection("userStats").doc(state.user.uid).set(payload, { merge: true });
    }

    async function clearUserShiverFields() {
        if (!state.user || !state.db) return;
        const deleteValue = firebase.firestore.FieldValue.delete();
        clearLocalProfileFields();
        await state.db.collection("userStats").doc(state.user.uid).set({
            shiverId: deleteValue,
            shiverName: deleteValue,
            shiverTag: deleteValue,
            shiverColor: deleteValue,
            shiverRole: deleteValue,
            shiverSeasonId: deleteValue,
            lastUpdated: Date.now()
        }, { merge: true });
    }

    function syncLocalShiverProfile(membership, shiver) {
        if (!membership || !shiver) return;
        syncLocalProfileFields({
            shiverId: shiver.id,
            shiverName: shiver.name || membership.shiverName,
            shiverTag: shiver.tag || membership.shiverTag,
            shiverColor: sanitizeColor(shiver.color || membership.shiverColor),
            shiverRole: membership.role || "member",
            shiverSeasonId: SHIVER_SEASON_ID
        });
    }

    function syncLocalProfileFields(fields) {
        const profile = getLocalProfile();
        Object.assign(profile, fields);
        if (typeof saveUserProfileLocally === "function") {
            saveUserProfileLocally(profile, { skipRemoteSync: true });
        } else {
            localStorage.setItem("userProfile", JSON.stringify(profile));
        }
    }

    function clearLocalProfileFields() {
        const profile = getLocalProfile();
        ["shiverId", "shiverName", "shiverTag", "shiverColor", "shiverRole", "shiverSeasonId"].forEach(key => delete profile[key]);
        if (typeof saveUserProfileLocally === "function") {
            saveUserProfileLocally(profile, { skipRemoteSync: true });
        } else {
            localStorage.setItem("userProfile", JSON.stringify(profile));
        }
    }

    function getLocalProfile() {
        if (typeof getCurrentProfileData === "function") {
            return getCurrentProfileData() || {};
        }
        try {
            return JSON.parse(localStorage.getItem("userProfile") || "{}") || {};
        } catch (error) {
            return {};
        }
    }

    function getProfileName(profile = getLocalProfile()) {
        return normalizeDisplayText(profile.username || state.user?.email?.split("@")[0] || "Sharkdle Player", 32);
    }

    function setAuthState(message, warning = false) {
        if (!els["shiver-auth-state"]) return;
        els["shiver-auth-state"].textContent = message;
        els["shiver-auth-state"].classList.toggle("warning", warning);
    }

    function setText(id, value) {
        const el = els[id];
        if (el) el.textContent = value;
    }

    function setListHtml(el, html) {
        if (el) el.innerHTML = html;
    }

    function showToast(message, type = "info") {
        if (typeof showNotification === "function") {
            showNotification(message, type);
        } else {
            console.log(`[${type}] ${message}`);
        }
    }

    function setBusy(button, busy, busyText = "Working...") {
        if (!button) return;
        if (busy) {
            button.dataset.defaultHtml = button.innerHTML;
            button.disabled = true;
            button.textContent = busyText;
        } else {
            button.disabled = false;
            if (button.dataset.defaultHtml) button.innerHTML = button.dataset.defaultHtml;
        }
    }

    function normalizeDisplayText(value, maxLength) {
        return String(value || "")
            .replace(/\s+/g, " ")
            .trim()
            .slice(0, maxLength);
    }

    function normalizeTag(value) {
        return String(value || "")
            .toUpperCase()
            .replace(/[^A-Z0-9]/g, "")
            .slice(0, 5);
    }

    function sanitizeColor(value) {
        const color = String(value || "reef").toLowerCase();
        return ["reef", "current", "ember", "glacier"].includes(color) ? color : "reef";
    }

    function formatRole(role) {
        return role === "leader" ? "Leader" : "Member";
    }

    function formatNumber(value) {
        return Math.max(0, Number(value) || 0).toLocaleString();
    }

    function resolveProfilePicture(path) {
        const value = String(path || "").trim();
        if (!value) return DEFAULT_PROFILE_PIC;
        if (/^https?:\/\//i.test(value) || value.startsWith("images/")) return value;
        if (value.includes("/")) return `images/${value.replace(/^\/+/, "")}`;
        return `images/pfp/${value}`;
    }

    function escapeHtml(value) {
        return String(value ?? "")
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;")
            .replace(/"/g, "&quot;")
            .replace(/'/g, "&#039;");
    }

    function escapeAttr(value) {
        return escapeHtml(value).replace(/`/g, "&#096;");
    }
})();
