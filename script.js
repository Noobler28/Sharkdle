const FRIENDS_COLLECTION = 'friendNetwork';
const FRIEND_CODES_COLLECTION = 'friendCodes';
let friendDocumentUnsubscribe = null;
let adminCompensationNoticeUnsubscribe = null;
let activeDuelsCache = [];
let currentOpenDuelId = null;
let duelSharkOptionsReady = false;
let duelSharkOptionNames = [];
let duelSuggestionIndex = -1;
let duelVisibleSuggestions = [];
const PROCESSED_DUELS_KEY = 'processedFriendDuels';
const SHARE_REWARD_ID = "friend-code-share-v1";
const SHARE_REWARD_CRATES = 1;
const REFERRAL_REWARD_CRATES = 1;

const duelSizeThresholds = {
    Tiny: '0-3ft',
    Small: '3-6ft',
    Medium: '6-10ft',
    Large: '10-20ft',
    Giant: '20ft+'
};

function getFriendDocumentRef(uid) {
    if (!db || !uid) return null;
    return db.collection(FRIENDS_COLLECTION).doc(uid);
}

function normalizeDuelsList(value) {
    return Array.isArray(value) ? value : [];
}

function upsertDuelRecord(duels, duel) {
    const list = normalizeDuelsList(duels).filter(entry => entry?.id !== duel.id);
    list.push(duel);
    return list;
}

function removeDuelRecord(duels, duelId) {
    return normalizeDuelsList(duels).filter(entry => entry?.id !== duelId);
}

async function getFriendNetworkData(uid) {
    const ref = getFriendDocumentRef(uid);
    if (!ref) return { friends: [], friendRequests: [], duels: [] };
    const doc = await ref.get();
    if (!doc.exists) return { friends: [], friendRequests: [], duels: [] };
    const data = doc.data() || {};
    return {
        friends: Array.isArray(data.friends) ? data.friends : [],
        friendRequests: Array.isArray(data.friendRequests) ? data.friendRequests : [],
        duels: normalizeDuelsList(data.duels)
    };
}

async function saveDuelForParticipants(duel) {
    const participants = duel.participants || [];
    await Promise.all(participants.map(async uid => {
        const ref = getFriendDocumentRef(uid);
        if (!ref) return;
        const data = await getFriendNetworkData(uid);
        const nextDuels = upsertDuelRecord(data.duels, duel);
        await ref.set({ duels: nextDuels }, { merge: true });
    }));
}

function getFriendCodeDocumentRef(code) {
    if (!db || !code) return null;
    return db.collection(FRIEND_CODES_COLLECTION).doc(code);
}

async function ensureFriendDocument(uid) {
    if (!db || !uid) return { friends: [], friendRequests: [] };
    const ref = getFriendDocumentRef(uid);
    const doc = await ref.get();
    if (!doc.exists) {
        await ref.set({ friends: [], friendRequests: [] }, { merge: true });
        return { friends: [], friendRequests: [] };
    }
    return doc.data() || { friends: [], friendRequests: [] };
}

async function ensureFriendCodeDocument(uid) {
    if (!db || !uid) return null;
    const code = generateFriendCode(uid);
    const ref = getFriendCodeDocumentRef(code);
    const doc = await ref.get();
    if (!doc.exists) {
        await ref.set({ uid }, { merge: true });
    } else if (doc.data().uid !== uid) {
        console.warn(`Friend code collision: ${code} already assigned to ${doc.data().uid}`);
    }
    return ref;
}

async function resolveUidFromFriendCode(code) {
    if (!db || !code) return null;
    const ref = getFriendCodeDocumentRef(code);
    const doc = await ref.get();
    return doc.exists ? doc.data().uid : null;
}

function getReferralPairId(uidA, uidB) {
    return [uidA, uidB].filter(Boolean).sort().join("_");
}

function getReferralRewards(profileData = {}) {
    return profileData.referralRewards && typeof profileData.referralRewards === "object"
        ? profileData.referralRewards
        : {};
}

async function grantReferralCratesToUid(uid, pairId, source = "referral") {
    if (!db || !uid || !pairId) return false;
    const userRef = db.collection("userStats").doc(uid);
    try {
        let granted = false;
        await db.runTransaction(async transaction => {
            const snap = await transaction.get(userRef);
            const data = snap.exists ? (snap.data() || {}) : {};
            const rewards = getReferralRewards(data);
            const rewardedPairs = Array.isArray(rewards.rewardedPairs) ? rewards.rewardedPairs : [];
            if (rewardedPairs.includes(pairId)) return;
            const inventory = normalizeCrateInventory(data.crateInventory || {});
            inventory.reef = (Number(inventory.reef) || 0) + REFERRAL_REWARD_CRATES;
            const nowMs = Date.now();
            transaction.set(userRef, {
                crateInventory: inventory,
                crateInventoryUpdatedAt: nowMs,
                referralRewards: {
                    ...rewards,
                    rewardedPairs: [...rewardedPairs, pairId],
                    totalReferralCrates: (Number(rewards.totalReferralCrates) || 0) + REFERRAL_REWARD_CRATES,
                    lastReferralRewardAt: nowMs,
                    lastReferralRewardSource: source
                },
                lastUpdated: new Date()
            }, { merge: true });
            granted = true;
        });
        return granted;
    } catch (error) {
        console.warn("Unable to grant referral crates:", error);
        return false;
    }
}

async function claimPendingReferralRewards() {
    if (!currentUser || !db) return 0;
    const networkRef = getFriendDocumentRef(currentUser.uid);
    try {
        const snap = await networkRef.get();
        const data = snap.exists ? (snap.data() || {}) : {};
        const pendingPairs = Array.isArray(data.pendingReferralRewardPairs) ? data.pendingReferralRewardPairs : [];
        if (!pendingPairs.length) return 0;

        const remainingPairs = [];
        let claimed = 0;
        for (const pairId of pendingPairs) {
            const granted = await grantReferralCratesToUid(currentUser.uid, pairId, "friend-accepted-pending");
            if (granted) {
                claimed += REFERRAL_REWARD_CRATES;
            } else {
                remainingPairs.push(pairId);
            }
        }
        await networkRef.set({ pendingReferralRewardPairs: remainingPairs }, { merge: true });
        if (claimed > 0) {
            await loadUserProfile();
            renderCratesButton();
            showNotification(`Referral reward: ${claimed} Cosmetic Crate${claimed === 1 ? "" : "s"}.`, "success", 3600);
        }
        return claimed;
    } catch (error) {
        console.warn("Unable to claim pending referral rewards:", error);
        return 0;
    }
}

async function grantLocalShareReward() {
    if (!currentUser || !db) return false;
    const profileData = getCurrentProfileData();
    const rewards = getReferralRewards(profileData);
    const claimed = Array.isArray(rewards.claimedShareRewards) ? rewards.claimedShareRewards : [];
    if (claimed.includes(SHARE_REWARD_ID)) return false;

    const inventory = getCrateInventory(profileData);
    inventory.reef = (Number(inventory.reef) || 0) + SHARE_REWARD_CRATES;
    profileData.crateInventory = normalizeCrateInventory(inventory);
    markCrateInventoryChanged(profileData);
    profileData.referralRewards = {
        ...rewards,
        claimedShareRewards: [...claimed, SHARE_REWARD_ID],
        shareRewardCrates: (Number(rewards.shareRewardCrates) || 0) + SHARE_REWARD_CRATES,
        lastShareRewardAt: Date.now()
    };
    saveUserProfileLocally(profileData);
    await db.collection("userStats").doc(currentUser.uid).set({
        crateInventory: profileData.crateInventory,
        crateInventoryUpdatedAt: getCrateInventoryUpdatedAt(profileData),
        referralRewards: profileData.referralRewards,
        lastUpdated: new Date()
    }, { merge: true });
    renderCratesButton();
    showNotification("Share reward claimed: 1 Cosmetic Crate.", "success", 3600);
    return true;
}

function getFriendShareText() {
    const code = currentUser ? generateFriendCode(currentUser.uid) : "";
    return `Play Sharkdle with me. Add my friend code: ${code}`;
}

window.shareFriendCode = async function() {
    if (!currentUser) {
        openLoginModal();
        return;
    }
    const shareText = getFriendShareText();
    try {
        if (navigator.share) {
            await navigator.share({ title: "Sharkdle", text: shareText, url: window.location.origin || window.location.href });
        } else if (navigator.clipboard) {
            await navigator.clipboard.writeText(shareText);
            showNotification("Friend code share text copied.", "success", 2600);
        }
        await grantLocalShareReward();
    } catch (error) {
        if (error?.name !== "AbortError") {
            console.warn("Unable to share friend code:", error);
            showNotification("Could not share right now.", "error", 3000);
        }
    }
};

window.copyFriendCode = async function() {
    if (!currentUser) {
        openLoginModal();
        return;
    }
    const code = generateFriendCode(currentUser.uid);
    try {
        if (navigator.clipboard) {
            await navigator.clipboard.writeText(code);
        }
        showNotification("Friend code copied.", "success", 2400);
        await grantLocalShareReward();
    } catch (error) {
        console.warn("Unable to copy friend code:", error);
        showNotification(`Friend code: ${code}`, "info", 4200);
        await grantLocalShareReward();
    }
};

window.openFriendsTab = async function() {
    if (!currentUser) {
        openLoginModal();
        return;
        if (duelsList) duelsList.innerHTML = '<li class="empty-state"><div class="empty-icon">\u{1F512}</div><div class="empty-text">Login to see duels</div></li>';
        if (duelsList) duelsList.innerHTML = '<li class="empty-state"><div class="empty-icon">\u{1F512}</div><div class="empty-text">Login to see duels</div></li>';
        return;
    }
    await openProfileModal();
    showProfileTab('friends');
};

async function populateFriendsTab() {
    const uidSpan = document.getElementById('user-uid');
    const codeSpan = document.getElementById('user-friend-code');
    const friendsCountEl = document.getElementById('friends-count');
    const requestsCountEl = document.getElementById('requests-count');
    const duelsCountEl = document.getElementById('duels-count');
    const friendsCardCountEl = document.getElementById('friends-card-count');
    const requestsCardCountEl = document.getElementById('requests-card-count');
    const duelsCardCountEl = document.getElementById('duels-card-count');

    if (!currentUser) {
        if (uidSpan) uidSpan.textContent = '(login required)';
        if (codeSpan) codeSpan.textContent = '(login required)';
        if (friendsCountEl) friendsCountEl.textContent = '0';
        if (requestsCountEl) requestsCountEl.textContent = '0';
        if (duelsCountEl) duelsCountEl.textContent = '0';
        if (friendsCardCountEl) friendsCardCountEl.textContent = '0';
        if (requestsCardCountEl) requestsCardCountEl.textContent = '0';
        if (duelsCardCountEl) duelsCardCountEl.textContent = '0';
        const friendsList = document.getElementById('friends-list');
        const requestsList = document.getElementById('requests-list');
        const duelsList = document.getElementById('duels-list');
        if (duelsList) duelsList.innerHTML = '<li class="empty-state"><div class="empty-icon">\u{1F512}</div><div class="empty-text">Login to see duels</div></li>';
        if (friendsList) friendsList.innerHTML = '<li class="empty-state"><div class="empty-icon">\u{1F512}</div><div class="empty-text">Login to see friends</div></li>';
        if (requestsList) requestsList.innerHTML = '<li class="empty-state"><div class="empty-icon">\u{1F512}</div><div class="empty-text">Login to see requests</div></li>';
        return;
    }

    if (uidSpan) uidSpan.textContent = currentUser.uid;
    if (codeSpan) codeSpan.textContent = generateFriendCode(currentUser.uid);

    await Promise.all([
        ensureFriendDocument(currentUser.uid),
        ensureFriendCodeDocument(currentUser.uid)
    ]);
    await claimPendingReferralRewards();

    const data = await getFriendNetworkData(currentUser.uid);
    const friends = Array.isArray(data.friends) ? data.friends : [];
    const requests = Array.isArray(data.friendRequests) ? data.friendRequests : [];
    activeDuelsCache = normalizeDuelsList(data.duels);
    await reconcileCompletedDuelStats(activeDuelsCache);

    // Update counts
    if (friendsCountEl) friendsCountEl.textContent = friends.length;
    if (requestsCountEl) requestsCountEl.textContent = requests.length;
    if (duelsCountEl) duelsCountEl.textContent = activeDuelsCache.length;
    if (friendsCardCountEl) friendsCardCountEl.textContent = friends.length;
    if (requestsCardCountEl) requestsCardCountEl.textContent = requests.length;
    if (duelsCardCountEl) duelsCardCountEl.textContent = activeDuelsCache.length;

    ensureDuelSharkOptions();
    await renderFriendsList(friends);
    await renderDuelsList(activeDuelsCache);
    await renderRequestsList(requests);
}

async function getUsernameForUid(uid) {
    if (!db || !uid) return uid;
    try {
        const doc = await db.collection('userStats').doc(uid).get();
        if (!doc.exists) return uid;
        const data = doc.data() || {};
        return data.username || uid;
    } catch (error) {
        console.warn('Unable to resolve username for', uid, error);
        return uid;
    }
}

async function getUserProfileForUid(uid) {
    if (!db || !uid) return null;
    try {
        const doc = await db.collection('userStats').doc(uid).get();
        if (!doc.exists) return null;
        return doc.data() || {};
    } catch (error) {
        console.warn('Unable to fetch profile for', uid, error);
        return null;
    }
}

function normalizeSharkInput(input) {
    return String(input || '').replace(/\s+/g, '').toLowerCase();
}

function getDuelPlayerState(duelData, uid) {
    return duelData?.players?.[uid] || {
        accepted: false,
        guesses: [],
        attemptsLeft: 12,
        completed: false,
        won: false
    };
}

function getFriendPresence(profile) {
    const lastActive = profile?.lastActive;
    const millis = typeof lastActive?.toMillis === 'function'
        ? lastActive.toMillis()
        : typeof lastActive === 'number'
            ? lastActive
            : null;
    const isOnline = millis ? (Date.now() - millis) < 5 * 60 * 1000 : false;
    return {
        isOnline,
        label: isOnline ? 'Online' : 'Offline'
    };
}

const SHARKDLE_ACTIVITY_ROUTES = Object.freeze([
    { match: "/minigames/sharkrng/", label: "Shark RNG" },
    { match: "/rng.html", label: "Shark RNG" },
    { match: "/library/", label: "Sharchive" },
    { match: "/library.html", label: "Sharchive" },
    { match: "/daily/", label: "Daily" },
    { match: "/daily.html", label: "Daily" },
    { match: "/infinite/", label: "Infinite" },
    { match: "/infinite.html", label: "Infinite" },
    { match: "/practice/", label: "Practice" },
    { match: "/practice.html", label: "Practice" },
    { match: "/story/", label: "Story" },
    { match: "/story.html", label: "Story" },
    { match: "/sharkpass/", label: "Sharkpass" },
    { match: "/sharkpass.html", label: "Sharkpass" },
    { match: "/achievements/", label: "Achievements" },
    { match: "/achievements.html", label: "Achievements" },
    { match: "/leaderboard/", label: "Leaderboards" },
    { match: "/leaderboards.html", label: "Leaderboards" },
    { match: "/updates/", label: "Updates" },
    { match: "/updates.html", label: "Updates" },
    { match: "/shark-rescue/", label: "Shark Rescue" },
    { match: "/secret.html", label: "Shark Rescue" },
    { match: "/minigames/sharkslots/", label: "Shark Slots" },
    { match: "/slots.html", label: "Shark Slots" },
    { match: "/minigames/sharklagoon/", label: "Shark Lagoon" },
    { match: "/lagoon.html", label: "Shark Lagoon" }
]);

function getCurrentSharkdleActivityLabel() {
    const path = decodeURIComponent(window.location.pathname || "/").toLowerCase();
    const profileModal = document.getElementById("profileModal");
    if (profileModal && !profileModal.classList.contains("hidden")) return "Profile";
    const matchedRoute = SHARKDLE_ACTIVITY_ROUTES.find(route => path.includes(route.match));
    if (matchedRoute) return matchedRoute.label;
    if (document.body?.classList.contains("home-page")) return "Home";
    return "Sharkdle";
}

function getCurrentSharkdleActivityPayload(nowMs = Date.now()) {
    return {
        label: getCurrentSharkdleActivityLabel(),
        path: String(window.location.pathname || "/").slice(0, 120),
        updatedAt: nowMs
    };
}

async function updatePresenceHeartbeat() {
    if (!db || !currentUser) return;
    const nowMs = Date.now();
    try {
        await db.collection('userStats').doc(currentUser.uid).set({
            lastActive: nowMs,
            lastActivity: getCurrentSharkdleActivityPayload(nowMs)
        }, { merge: true });
    } catch (error) {
        console.warn('Presence heartbeat failed:', error);
    }
}

window.getCurrentSharkdleActivityPayload = getCurrentSharkdleActivityPayload;

function getProcessedDuels() {
    try {
        return JSON.parse(localStorage.getItem(PROCESSED_DUELS_KEY) || '[]');
    } catch (error) {
        return [];
    }
}

function setProcessedDuels(duelIds) {
    localStorage.setItem(PROCESSED_DUELS_KEY, JSON.stringify(duelIds));
}

async function reconcileCompletedDuelStats(duels) {
    if (!currentUser) return;
    const processed = getProcessedDuels();
    const completed = normalizeDuelsList(duels).filter(duel => duel?.status === 'completed' && duel?.id && !processed.includes(duel.id));
    if (!completed.length) return;

    let profileData = JSON.parse(localStorage.getItem('userProfile') || '{}');
    let changed = false;

    completed.forEach(duel => {
        profileData.duelGames = (profileData.duelGames || 0) + 1;
        const result = getLocalizedDuelResult(duel);
        if (result.startsWith('You won')) {
            profileData.duelWins = (profileData.duelWins || 0) + 1;
            unlockDuelAchievement('duel_won');
        }
        unlockDuelAchievement('duel_played');
        processed.push(duel.id);
        changed = true;
    });

    if (changed) {
        localStorage.setItem('userProfile', JSON.stringify(profileData));
        setProcessedDuels(processed);
        if (typeof syncStatsToFirebase === 'function') {
            syncStatsToFirebase().catch(error => console.warn('Duel stat sync failed:', error));
        }
    }
}

function unlockDuelAchievement(achievementId) {
    if (window.unlockAchievement) {
        window.unlockAchievement(achievementId);
        return;
    }
    const unlocked = JSON.parse(localStorage.getItem('unlockedAchievements') || '[]');
    if (!unlocked.includes(achievementId)) {
        unlocked.push(achievementId);
        localStorage.setItem('unlockedAchievements', JSON.stringify(unlocked));
        syncUnlockedAchievementToFirebase(achievementId, unlocked);
    }
}

function getDuelOpponentUid(duelData, uid) {
    return (duelData?.participants || []).find(participant => participant !== uid) || null;
}

function formatDuelStatus(status) {
    switch (status) {
        case 'pending':
            return 'Pending';
        case 'active':
            return 'Active';
        case 'completed':
            return 'Completed';
        case 'declined':
            return 'Declined';
        default:
            return 'Unknown';
    }
}

const SEASONAL_CRATE_IDS = ["christmas", "halloween"];
const SEASONAL_CRATE_CRAFT_COST = 2;
const SUMMER_CRATE_RETIREMENT_VERSION = 2;
let activeSeasonalCrateThemeId = "default";
let seasonalCrateCraftingInProgress = false;

function isSeasonalCrateId(crateId) {
    return SEASONAL_CRATE_IDS.includes(String(crateId || "").toLowerCase());
}

function getSeasonalCrateMeta(crateId = "event") {
    const meta = {
        event: {
            id: "event",
            shortName: "Event",
            blurb: "Seasonal event rewards.",
            visualClass: "event",
            countClass: "event",
            icon: "fa-star",
            spinColor: "#7ee8ff",
            spinIcon: "\u{2605}"
        },
        summer: {
            id: "summer",
            shortName: "Summer",
            blurb: "Summer Splash rewards.",
            visualClass: "summer",
            countClass: "summer",
            icon: "fa-umbrella-beach",
            spinColor: "#ff8f57",
            spinIcon: "\u{2600}\uFE0F"
        },
        christmas: {
            id: "christmas",
            shortName: "Christmas",
            blurb: "Christmas Reef rewards.",
            visualClass: "christmas",
            countClass: "christmas",
            icon: "fa-gift",
            spinColor: "#4fd1a5",
            spinIcon: "\u{1F381}"
        },
        halloween: {
            id: "halloween",
            shortName: "Halloween",
            blurb: "Halloween Depths rewards.",
            visualClass: "halloween",
            countClass: "halloween",
            icon: "fa-ghost",
            spinColor: "#b86cff",
            spinIcon: "\u{1F383}"
        }
    };
    return meta[crateId] || meta.event;
}

function setActiveSeasonalCrateTheme(themeId = "default") {
    const normalized = typeof normalizeIndexThemeId === "function"
        ? normalizeIndexThemeId(themeId)
        : String(themeId || "").trim().toLowerCase();
    activeSeasonalCrateThemeId = isSeasonalCrateId(normalized) ? normalized : "default";
}

function getActiveEventThemeId() {
    // Crate eligibility follows the live global event config, not stale cached/local visual themes.
    return isSeasonalCrateId(activeSeasonalCrateThemeId) ? activeSeasonalCrateThemeId : "default";
}

function getActiveSeasonalCrateId() {
    const themeId = getActiveEventThemeId();
    return isSeasonalCrateId(themeId) ? themeId : null;
}

function isSeasonalCrateThemeActive(crateId) {
    return getActiveSeasonalCrateId() === crateId;
}

function shouldShowSeasonalCratePanel(crateId, profileData = getCurrentProfileData()) {
    return isSeasonalCrateThemeActive(crateId) || (getCrateInventory(profileData)[crateId] || 0) > 0;
}

function updateSeasonalCratePanels(profileData = getCurrentProfileData()) {
    const christmasPanel = document.getElementById("christmas-crate-panel");
    if (christmasPanel) {
        christmasPanel.style.display = shouldShowSeasonalCratePanel("christmas", profileData) ? "" : "none";
    }

    const halloweenPanel = document.getElementById("halloween-crate-panel");
    if (halloweenPanel) {
        halloweenPanel.style.display = shouldShowSeasonalCratePanel("halloween", profileData) ? "" : "none";
    }

    const cratesLayout = document.querySelector("#cratesModal .crates-layout");
    if (cratesLayout) {
        const visiblePanels = [...cratesLayout.querySelectorAll(".crate-inventory-panel")]
            .filter(panel => getComputedStyle(panel).display !== "none");
        cratesLayout.classList.toggle("single-crate-layout", visiblePanels.length === 1);
    }
}

function setCratesModalTab(tabId = "inventory") {
    const inventoryTab = document.getElementById("inventory-tab");
    const craftingTab = document.getElementById("crafting-tab");
    const inventoryPanel = document.getElementById("inventory-panel");
    const craftingPanel = document.getElementById("crafting-panel");
    const showCrafting = tabId === "crafting";

    inventoryTab?.classList.toggle("active", !showCrafting);
    craftingTab?.classList.toggle("active", showCrafting);
    inventoryPanel?.classList.toggle("active", !showCrafting);
    craftingPanel?.classList.toggle("active", showCrafting);
}

function initCratesModalTabs() {
    const inventoryTab = document.getElementById("inventory-tab");
    const craftingTab = document.getElementById("crafting-tab");
    if (!inventoryTab || !craftingTab || inventoryTab.dataset.crateTabsReady === "true") return;

    inventoryTab.addEventListener("click", () => setCratesModalTab("inventory"));
    craftingTab.addEventListener("click", () => setCratesModalTab("crafting"));
    inventoryTab.dataset.crateTabsReady = "true";
}

function updateSeasonalCrateCraftingUI(profileData = getCurrentProfileData()) {
    const inventory = getCrateInventory(profileData);
    const reefOwned = inventory.reef || 0;
    const activeCrateId = getActiveSeasonalCrateId();
    const outputMeta = getSeasonalCrateMeta(activeCrateId || "event");
    const outputDef = activeCrateId ? getCrateDefinition(activeCrateId) : { name: "Event Crate" };
    const outputOwned = activeCrateId ? (inventory[activeCrateId] || 0) : 0;
    const canCraft = Boolean(activeCrateId) && reefOwned >= SEASONAL_CRATE_CRAFT_COST && !seasonalCrateCraftingInProgress;
    const canOpenReef = reefOwned > 0 && !crateOpeningInProgress;

    const reefOwnedEl = document.getElementById("craft-reef-owned");
    if (reefOwnedEl) reefOwnedEl.textContent = reefOwned;

    const seasonalOwnedEl = document.getElementById("craft-seasonal-owned") || document.getElementById("craft-summer-owned");
    if (seasonalOwnedEl) seasonalOwnedEl.textContent = outputOwned;

    const outputTitle = document.getElementById("craft-seasonal-output-title");
    if (outputTitle) outputTitle.textContent = activeCrateId ? `1 ${outputDef.name}` : "Event Crate";

    const outputIcon = document.getElementById("craft-seasonal-output-icon");
    if (outputIcon) outputIcon.className = `crate-crafting-icon ${outputMeta.visualClass}`;

    const outputSymbol = document.getElementById("craft-seasonal-output-symbol");
    if (outputSymbol) outputSymbol.className = `fa-solid ${outputMeta.icon}`;

    const craftBtn = document.getElementById("craft-summer-crate-btn");
    if (craftBtn) {
        craftBtn.disabled = !canCraft;
        craftBtn.style.opacity = canCraft ? "1" : "0.5";
        craftBtn.textContent = canCraft
            ? `Craft ${outputDef.name}`
            : activeCrateId
            ? `Need ${SEASONAL_CRATE_CRAFT_COST} Cosmetic Crates`
            : "Event Theme Inactive";
    }

    const dropsBtn = document.getElementById("craft-seasonal-drops-btn");
    if (dropsBtn) {
        dropsBtn.disabled = !activeCrateId;
        dropsBtn.style.opacity = activeCrateId ? "1" : "0.5";
        dropsBtn.textContent = activeCrateId ? `View ${outputMeta.shortName} Drops` : "No Event Drops";
    }

    const openReefBtn = document.getElementById("open-crate-btn");
    if (openReefBtn) {
        openReefBtn.disabled = !canOpenReef;
        openReefBtn.style.opacity = canOpenReef ? "1" : "0.5";
    }

    SEASONAL_CRATE_IDS.forEach(crateId => {
        const openBtn = document.getElementById(`open-${crateId}-crate-btn`);
        const canOpenSeasonal = (inventory[crateId] || 0) > 0 && !crateOpeningInProgress;
        if (openBtn) {
            openBtn.disabled = !canOpenSeasonal;
            openBtn.style.opacity = canOpenSeasonal ? "1" : "0.5";
        }
    });
}

window.openActiveSeasonalCrateDropsModal = function openActiveSeasonalCrateDropsModal() {
    const activeCrateId = getActiveSeasonalCrateId();
    if (!activeCrateId) {
        showNotification("Seasonal crate drops are only available while an event theme is active.", "info", 3200);
        return;
    }
    openCrateDropsModal(activeCrateId);
};

window.craftSeasonalCrate = async function() {
    if (!currentUser) {
        openLoginModal();
        return;
    }
    if (seasonalCrateCraftingInProgress) return;

    const activeCrateId = getActiveSeasonalCrateId();
    if (!activeCrateId) {
        showNotification("Seasonal crates can only be crafted while their event theme is active.", "info", 3400);
        return;
    }

    const profileData = getCurrentProfileData();
    const inventory = getCrateInventory(profileData);
    const activeCrateName = getCrateDefinition(activeCrateId).name;

    if ((inventory.reef || 0) < SEASONAL_CRATE_CRAFT_COST) {
        showNotification(`You need ${SEASONAL_CRATE_CRAFT_COST} Cosmetic Crates to craft 1 ${activeCrateName}.`, "error", 3000);
        return;
    }

    seasonalCrateCraftingInProgress = true;
    updateSeasonalCrateCraftingUI(profileData);

    const rollbackProfileData = JSON.parse(JSON.stringify(profileData));
    const craftTimestamp = Date.now();
    inventory.reef -= SEASONAL_CRATE_CRAFT_COST;
    inventory[activeCrateId] = (inventory[activeCrateId] || 0) + 1;
    profileData.crateInventory = normalizeCrateInventory(inventory);
    markCrateInventoryChanged(profileData, craftTimestamp);

    try {
        await persistCrateProfileUpdate(profileData);
        renderCratesModal();
        showNotification(`Crafted 1 ${activeCrateName} from 2 Cosmetic Crates!`, "success", 2500);
    } catch (error) {
        console.warn("Crafting sync failed:", error);
        Object.assign(profileData, rollbackProfileData);
        saveUserProfileLocally(profileData, { skipRemoteSync: true });
        showNotification("Crafting could not be saved. No crates were spent.", "error", 3500);
        renderCratesModal();
    } finally {
        seasonalCrateCraftingInProgress = false;
        updateSeasonalCrateCraftingUI(getCurrentProfileData());
    }
};

function getDuelStatusClass(status) {
    if (status === 'active' || status === 'completed' || status === 'declined') return status;
    return 'pending';
}

function ensureDuelSharkOptions() {
    if (duelSharkOptionsReady) return;
    if (!Array.isArray(window.sharks)) return;
    duelSharkOptionNames = window.sharks.map(shark => shark.name).sort((a, b) => a.localeCompare(b));
    duelSharkOptionsReady = true;
}

function hideDuelSuggestions() {
    const panel = document.getElementById('duel-suggestions');
    if (!panel) return;
    panel.classList.add('hidden');
    panel.innerHTML = '';
    duelSuggestionIndex = -1;
    duelVisibleSuggestions = [];
}

function applyDuelSuggestion(value) {
    const input = document.getElementById('duel-guess-input');
    if (!input) return;
    input.value = value;
    hideDuelSuggestions();
    input.focus();
}

function renderDuelSuggestions(query = '') {
    const panel = document.getElementById('duel-suggestions');
    const input = document.getElementById('duel-guess-input');
    if (!panel || !input) return;

    const normalizedQuery = normalizeSharkInput(query);
    const suggestions = duelSharkOptionNames
        .filter(name => !normalizedQuery || normalizeSharkInput(name).includes(normalizedQuery))
        .slice(0, 8);

    duelVisibleSuggestions = suggestions;
    duelSuggestionIndex = suggestions.length ? 0 : -1;

    if (!suggestions.length) {
        panel.innerHTML = '<div class="duel-suggestion-empty">No matching sharks found.</div>';
        panel.classList.remove('hidden');
        return;
    }

    panel.innerHTML = suggestions.map((name, index) => `
        <button type="button" class="duel-suggestion-item ${index === duelSuggestionIndex ? 'active' : ''}" data-duel-suggestion="${name}">
            ${name}
        </button>
    `).join('');

    panel.querySelectorAll('[data-duel-suggestion]').forEach(button => {
        button.addEventListener('mousedown', event => {
            event.preventDefault();
            applyDuelSuggestion(button.getAttribute('data-duel-suggestion') || '');
        });
    });

    panel.classList.remove('hidden');
}

function moveDuelSuggestionSelection(direction) {
    const panel = document.getElementById('duel-suggestions');
    if (!panel || panel.classList.contains('hidden') || !duelVisibleSuggestions.length) return;

    duelSuggestionIndex = (duelSuggestionIndex + direction + duelVisibleSuggestions.length) % duelVisibleSuggestions.length;
    panel.querySelectorAll('.duel-suggestion-item').forEach((item, index) => {
        item.classList.toggle('active', index === duelSuggestionIndex);
    });
}

function buildDuelFeedback(guessedShark, targetShark) {
    return [
        { category: 'Family', value: guessedShark.family, correct: guessedShark.family === targetShark.family },
        { category: 'Order', value: guessedShark.order, correct: guessedShark.order === targetShark.order },
        { category: 'Genus', value: guessedShark.genus, correct: guessedShark.genus === targetShark.genus },
        { category: 'Size', value: guessedShark.size, correct: guessedShark.size === targetShark.size },
        { category: 'Depth', value: guessedShark.depth, correct: guessedShark.depth === targetShark.depth },
        { category: 'Year of Discovery', value: guessedShark.yod, correct: guessedShark.yod === targetShark.yod }
    ];
}

async function renderFriendsList(friends) {
    const list = document.getElementById('friends-list');
    if (!list) return;
    if (!friends.length) {
        list.innerHTML = '<li class="empty-state"><div class="empty-icon">\u{1F420}</div><div class="empty-text">No friends yet</div><div class="empty-subtext">Add some friends to start dueling!</div></li>';
        return;
    }
    list.innerHTML = '';
    const profiles = await Promise.all(friends.map(uid => getUserProfileForUid(uid)));
    friends.forEach((uid, index) => {
        const profile = profiles[index] || {};
        const displayName = profile.username || uid;
        const profilePic = profile.profilePicture || "images/pfp/shark1.png";
        const gamesPlayed = profile.gamesPlayed || 0;
        const bestGame = profile.bestGame || 0;
        const presence = getFriendPresence(profile);

        const item = document.createElement('li');
        item.className = 'friend-item';
        item.onclick = () => openUserProfileModal(uid);
        item.innerHTML = `
            <div class="friend-avatar">
                <img src="${profilePic}" alt="${displayName}">
                <div class="friend-status ${presence.isOnline ? 'online' : 'offline'}"></div>
            </div>
            <div class="friend-info">
                <div class="friend-meta">
                    <div class="friend-name">${displayName}</div>
                    <span class="friend-badge">${presence.label}</span>
                </div>
                <div class="friend-stats">
                    <span class="stat">${gamesPlayed} games</span>
                    <span class="stat">Best: ${bestGame}</span>
                </div>
            </div>
            <div class="friend-actions">
                <button onclick="event.stopPropagation(); challengeFriendToDuel('${uid}')" class="action-btn duel-btn">
                    <span class="btn-icon">\u{2694}</span>
                    Duel
                </button>
                <button onclick="event.stopPropagation(); openUserProfileModal('${uid}')" class="action-btn view-btn">
                    <span class="btn-icon">\u{1F441}</span>
                    View
                </button>
                <button onclick="event.stopPropagation(); removeFriend('${uid}')" class="action-btn remove-btn" title="Remove friend">
                    <span class="btn-icon">\u{274C}</span>
                    Remove
                </button>
            </div>
        `;
        list.appendChild(item);
    });
}

async function renderDuelsList(duels) {
    const list = document.getElementById('duels-list');
    if (!list) return;

    if (!currentUser || !duels.length) {
        list.innerHTML = '<li class="empty-state"><div class="empty-icon">\u{1F988}</div><div class="empty-text">No duels yet</div><div class="empty-subtext">Use the Duel button on a friend card to start a shark guessing battle.</div></li>';
        return;
    }

    list.innerHTML = '';
    const sortedDuels = [...duels].sort((a, b) => {
        const aTime = a.createdAtMs || a.createdAt?.seconds || 0;
        const bTime = b.createdAtMs || b.createdAt?.seconds || 0;
        return bTime - aTime;
    });

    const opponentIds = [...new Set(sortedDuels.map(duel => getDuelOpponentUid(duel, currentUser.uid)).filter(Boolean))];
    const opponentProfiles = await Promise.all(opponentIds.map(uid => getUserProfileForUid(uid)));
    const profileMap = new Map(opponentIds.map((uid, index) => [uid, opponentProfiles[index] || {}]));

    sortedDuels.forEach(duel => {
        const opponentUid = getDuelOpponentUid(duel, currentUser.uid);
        const opponentProfile = profileMap.get(opponentUid) || {};
        const opponentName = opponentProfile.username || opponentUid || 'Unknown Rival';
        const opponentPic = opponentProfile.profilePicture || 'images/pfp/shark1.png';
        const selfState = getDuelPlayerState(duel, currentUser.uid);
        const isIncoming = duel.status === 'pending' && duel.opponentUid === currentUser.uid;
        const subtitle = getDuelListSubtitle(duel, selfState, opponentName);

        const item = document.createElement('li');
        item.className = 'friend-item duel-item';
        item.onclick = () => openFriendDuelModal(duel.id);
        item.innerHTML = `
            <div class="friend-avatar">
                <img src="${opponentPic}" alt="${opponentName}">
                <div class="friend-status ${duel.status === 'pending' ? 'pending' : 'online'}"></div>
            </div>
            <div class="friend-info">
                <div class="friend-meta">
                    <div class="friend-name">${opponentName}</div>
                    <span class="duel-status-pill ${getDuelStatusClass(duel.status)}">${formatDuelStatus(duel.status)}</span>
                </div>
                <div class="duel-subtext">${subtitle}</div>
            </div>
            <div class="friend-actions">
                <button onclick="event.stopPropagation(); openFriendDuelModal('${duel.id}')" class="action-btn view-btn">Open</button>
                ${isIncoming ? `<button onclick="event.stopPropagation(); acceptFriendDuel('${duel.id}')" class="action-btn accept-btn">Accept</button>` : ''}
                ${isIncoming ? `<button onclick="event.stopPropagation(); declineFriendDuel('${duel.id}')" class="action-btn decline-btn">Decline</button>` : ''}
                ${duel.status === 'completed' ? `<button onclick="event.stopPropagation(); removeCompletedDuelFromMyList('${duel.id}')" class="action-btn remove-btn">Remove</button>` : ''}
            </div>
        `;
        list.appendChild(item);
    });
}

function getDuelListSubtitle(duel, selfState, opponentName) {
    if (duel.status === 'pending') {
        return duel.opponentUid === currentUser.uid
            ? `${opponentName} challenged you. Accept to start the head-to-head battle.`
            : `Challenge sent. Waiting for ${opponentName} to accept.`;
    }
    if (duel.status === 'active') {
        if (selfState.completed) {
            return `You finished your run. Waiting for ${opponentName} to finish.`;
        }
        return `The duel is live. You have ${selfState.attemptsLeft ?? 12} attempts left.`;
    }
    if (duel.status === 'declined') {
        return 'This duel request was declined.';
    }
    return duel.resultLabel || 'This duel has been resolved.';
}


async function renderRequestsList(requests) {
    const list = document.getElementById('requests-list');
    if (!list) return;
    if (!requests.length) {
        list.innerHTML = '<li class="empty-state"><div class="empty-icon">\u{1F4ED}</div><div class="empty-text">No requests</div><div class="empty-subtext">Share your friend code to get requests!</div></li>';
        return;
    }
    list.innerHTML = '';
    const profiles = await Promise.all(requests.map(uid => getUserProfileForUid(uid)));
    requests.forEach((uid, index) => {
        const profile = profiles[index] || {};
        const displayName = profile.username || uid;
        const profilePic = profile.profilePicture || "images/pfp/shark1.png";
        const gamesPlayed = profile.gamesPlayed || 0;

        const item = document.createElement('li');
        item.className = 'friend-item request-item';
        item.onclick = () => openUserProfileModal(uid);
        item.innerHTML = `
            <div class="friend-avatar">
                <img src="${profilePic}" alt="${displayName}">
                <div class="friend-status pending"></div>
            </div>
            <div class="friend-info">
                <div class="friend-name">${displayName}</div>
                <div class="friend-stats">
                    <span class="stat">${gamesPlayed} games</span>
                    <span class="request-label">Wants to be friends</span>
                </div>
            </div>
            <div class="friend-actions">
                <button onclick="event.stopPropagation(); acceptFriendRequest('${uid}')" class="action-btn accept-btn">
                    <span class="btn-icon">\u{2705}</span>
                    Accept
                </button>
                <button onclick="event.stopPropagation(); declineFriendRequest('${uid}')" class="action-btn decline-btn">
                    <span class="btn-icon">\u{274C}</span>
                </button>
            </div>
        `;
        list.appendChild(item);
    });
}

function generateFriendCode(uid) {
    return uid ? uid.slice(-8).toUpperCase() : '';
}

function getChatThreadId(uid1, uid2) {
    if (!uid1 || !uid2) return null;
    return [uid1, uid2].sort().join('_');
}





window.addFriend = async function() {
    const input = document.getElementById('add-friend-uid');
    const status = document.getElementById('add-friend-status');
    if (!status) return;
    if (!currentUser) {
        status.textContent = 'Login required.';
        return;
    }
    const val = (input && input.value.trim()) || '';
    if (!val) {
        status.textContent = 'Enter a UID or friend code.';
        return;
    }
    status.textContent = 'Searching...';

    try {
        let targetUid = val;
        if (val.length <= 8) {
            if (!/^[A-Z0-9]{4,8}$/i.test(val)) {
                status.textContent = 'Invalid friend code.';
                return;
            }
            const upperCode = val.toUpperCase();
            targetUid = await resolveUidFromFriendCode(upperCode);
            if (!targetUid) {
                status.textContent = 'No user found with that code.';
                return;
            }
        }
        const resultMessage = await sendFriendRequest(targetUid);
        status.textContent = resultMessage;
        if (resultMessage === 'Request sent!' && input) {
            input.value = '';
        }
    } catch (error) {
        console.error('Friend request failed:', error);
        status.textContent = `Error sending request. ${error.message || 'Try again.'}`;
    }
};

async function sendFriendRequest(targetUid) {
    if (targetUid === currentUser.uid) {
        return 'You cannot add yourself.';
    }
    const targetRef = getFriendDocumentRef(targetUid);
    if (!targetRef) {
        throw new Error('Unable to access friend storage.');
    }
    const targetDoc = await targetRef.get();
    const targetData = targetDoc.exists ? targetDoc.data() : { friends: [], friendRequests: [] };
    const requests = Array.isArray(targetData.friendRequests) ? targetData.friendRequests : [];
    const friends = Array.isArray(targetData.friends) ? targetData.friends : [];
    if (requests.includes(currentUser.uid)) {
        return 'Request already sent.';
    }
    if (friends.includes(currentUser.uid)) {
        return 'Already friends.';
    }
    requests.push(currentUser.uid);
    await targetRef.set({ friendRequests: requests, friends }, { merge: true });
    return 'Request sent!';
}

async function grantFriendPairReferralRewards(uidA, uidB) {
    const pairId = getReferralPairId(uidA, uidB);
    if (!pairId) return;
    const grantedA = currentUser?.uid === uidA
        ? await grantReferralCratesToUid(uidA, pairId, "friend-accepted")
        : false;
    const grantedB = currentUser?.uid === uidB
        ? await grantReferralCratesToUid(uidB, pairId, "friend-accepted")
        : false;

    if ((currentUser?.uid === uidA && grantedA) || (currentUser?.uid === uidB && grantedB)) {
        const profileData = getCurrentProfileData();
        const inventory = getCrateInventory(profileData);
        inventory.reef = (Number(inventory.reef) || 0) + REFERRAL_REWARD_CRATES;
        profileData.crateInventory = normalizeCrateInventory(inventory);
        markCrateInventoryChanged(profileData);
        const rewards = getReferralRewards(profileData);
        const rewardedPairs = Array.isArray(rewards.rewardedPairs) ? rewards.rewardedPairs : [];
        profileData.referralRewards = {
            ...rewards,
            rewardedPairs: rewardedPairs.includes(pairId) ? rewardedPairs : [...rewardedPairs, pairId],
            totalReferralCrates: (Number(rewards.totalReferralCrates) || 0) + REFERRAL_REWARD_CRATES,
            lastReferralRewardAt: Date.now(),
            lastReferralRewardSource: "friend-accepted"
        };
        saveUserProfileLocally(profileData, { skipRemoteSync: true });
        renderCratesButton();
        showNotification("Referral reward: 1 Cosmetic Crate.", "success", 3600);
    }
}

window.acceptFriendRequest = async function(uid) {
    if (!currentUser) return;
    const userRef = db.collection(FRIENDS_COLLECTION).doc(currentUser.uid);
    const otherRef = db.collection(FRIENDS_COLLECTION).doc(uid);
    const [userDoc, otherDoc] = await Promise.all([userRef.get(), otherRef.get()]);
    const userData = userDoc.exists ? userDoc.data() : { friends: [], friendRequests: [] };
    const otherData = otherDoc.exists ? otherDoc.data() : { friends: [], friendRequests: [] };
    let requests = Array.isArray(userData.friendRequests) ? userData.friendRequests : [];
    const friends = Array.isArray(userData.friends) ? userData.friends : [];
    requests = requests.filter(u => u !== uid);
    if (!friends.includes(uid)) friends.push(uid);
    const otherFriends = Array.isArray(otherData.friends) ? otherData.friends : [];
    if (!otherFriends.includes(currentUser.uid)) otherFriends.push(currentUser.uid);
    const pairId = getReferralPairId(currentUser.uid, uid);
    const otherPendingReferralRewardPairs = Array.isArray(otherData.pendingReferralRewardPairs) ? otherData.pendingReferralRewardPairs : [];
    if (pairId && !otherPendingReferralRewardPairs.includes(pairId)) {
        otherPendingReferralRewardPairs.push(pairId);
    }
    await Promise.all([
        userRef.set({ friendRequests: requests, friends }, { merge: true }),
        otherRef.set({ friends: otherFriends, pendingReferralRewardPairs: otherPendingReferralRewardPairs }, { merge: true })
    ]);
    await grantFriendPairReferralRewards(currentUser.uid, uid);
    populateFriendsTab();
};

window.declineFriendRequest = async function(uid) {
    if (!currentUser) return;
    const userRef = db.collection(FRIENDS_COLLECTION).doc(currentUser.uid);
    const userDoc = await userRef.get();
    const userData = userDoc.exists ? userDoc.data() : { friendRequests: [] };
    let requests = Array.isArray(userData.friendRequests) ? userData.friendRequests : [];
    requests = requests.filter(u => u !== uid);
    await userRef.set({ friendRequests: requests }, { merge: true });
    populateFriendsTab();
};

window.removeFriend = async function(uid) {
    if (!currentUser) return;
    const userRef = db.collection(FRIENDS_COLLECTION).doc(currentUser.uid);
    const otherRef = db.collection(FRIENDS_COLLECTION).doc(uid);
    const [userDoc, otherDoc] = await Promise.all([userRef.get(), otherRef.get()]);
    const userData = userDoc.exists ? userDoc.data() : { friends: [] };
    const otherData = otherDoc.exists ? otherDoc.data() : { friends: [] };
    let friends = Array.isArray(userData.friends) ? userData.friends : [];
    friends = friends.filter(u => u !== uid);
    let otherFriends = Array.isArray(otherData.friends) ? otherData.friends : [];
    otherFriends = otherFriends.filter(u => u !== currentUser.uid);
    await Promise.all([
        userRef.set({ friends }, { merge: true }),
        otherRef.set({ friends: otherFriends }, { merge: true })
    ]);
    populateFriendsTab();
};

async function getExistingDuelWithUser(opponentUid) {
    const duelDocs = activeDuelsCache || [];
    return duelDocs.find(duel => {
        const participants = duel.participants || [];
        return participants.includes(currentUser.uid)
            && participants.includes(opponentUid)
            && (duel.status === 'pending' || duel.status === 'active');
    }) || null;
}

window.challengeFriendToDuel = async function(opponentUid) {
    if (!currentUser || !db) return;
    if (!Array.isArray(window.sharks) || !window.sharks.length) {
        showNotification('Shark roster failed to load for duel mode.', 'error', 3500);
        return;
    }
    try {
        const existingDuel = await getExistingDuelWithUser(opponentUid);
        if (existingDuel) {
            openFriendDuelModal(existingDuel.id);
            showNotification('You already have a live duel with this friend.', 'info', 3200);
            return;
        }

        const targetShark = window.sharks[Math.floor(Math.random() * window.sharks.length)];
        const duelId = `duel_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
        const duel = {
            id: duelId,
            participants: [currentUser.uid, opponentUid],
            challengerUid: currentUser.uid,
            opponentUid,
            sharkName: targetShark.name,
            status: 'pending',
            resultLabel: 'Challenge sent. Waiting for acceptance.',
            createdAtMs: Date.now(),
            updatedAtMs: Date.now(),
            players: {
                [currentUser.uid]: {
                    accepted: true,
                    guesses: [],
                    attemptsLeft: 12,
                    completed: false,
                    won: false
                },
                [opponentUid]: {
                    accepted: false,
                    guesses: [],
                    attemptsLeft: 12,
                    completed: false,
                    won: false
                }
            }
        };

        await saveDuelForParticipants(duel);
        showNotification('Duel challenge sent!', 'success', 3200);
    } catch (error) {
        console.error('Failed to send duel challenge:', error);
        showNotification(`Could not send duel challenge. ${error.message || 'Try again.'}`, 'error', 3800);
    }
};

window.acceptFriendDuel = async function(duelId) {
    if (!currentUser || !db) return;
    try {
        const duelData = activeDuelsCache.find(duel => duel.id === duelId);
        if (!duelData) return;
        const updatedDuel = {
            ...duelData,
            status: 'active',
            resultLabel: 'Both players accepted. Duel in progress.',
            updatedAtMs: Date.now(),
            players: {
                ...duelData.players,
                [currentUser.uid]: {
                    ...getDuelPlayerState(duelData, currentUser.uid),
                    accepted: true
                }
            }
        };
        await saveDuelForParticipants(updatedDuel);
        openFriendDuelModal(duelId);
        showNotification('Duel accepted. Good luck!', 'success', 3200);
    } catch (error) {
        console.error('Failed to accept duel:', error);
        showNotification('Could not accept duel right now.', 'error', 3500);
    }
};

window.declineFriendDuel = async function(duelId) {
    if (!currentUser || !db) return;
    try {
        const duelData = activeDuelsCache.find(duel => duel.id === duelId);
        if (!duelData) return;
        const updatedDuel = {
            ...duelData,
            status: 'declined',
            resultLabel: 'Duel declined.',
            declinedBy: currentUser.uid,
            updatedAtMs: Date.now()
        };
        await saveDuelForParticipants(updatedDuel);
        showNotification('Duel declined.', 'info', 2800);
    } catch (error) {
        console.error('Failed to decline duel:', error);
        showNotification('Could not decline duel right now.', 'error', 3500);
    }
};

window.removeCompletedDuelFromMyList = async function(duelId) {
    if (!currentUser || !db || !duelId) return;
    try {
        const data = await getFriendNetworkData(currentUser.uid);
        const duels = normalizeDuelsList(data.duels);
        const duel = duels.find(entry => entry?.id === duelId);

        if (!duel) {
            if (currentOpenDuelId === duelId) {
                closeFriendDuelModal();
            }
            showNotification('This duel is already removed from your list.', 'info', 2600);
            return;
        }

        if (duel.status !== 'completed') {
            showNotification('You can only remove completed duels.', 'info', 3000);
            return;
        }

        const ref = getFriendDocumentRef(currentUser.uid);
        if (!ref) return;

        const nextDuels = removeDuelRecord(duels, duelId);
        await ref.set({ duels: nextDuels }, { merge: true });
        activeDuelsCache = nextDuels;

        if (currentOpenDuelId === duelId) {
            closeFriendDuelModal();
        }

        const duelsCountEl = document.getElementById('duels-count');
        const duelsCardCountEl = document.getElementById('duels-card-count');
        if (duelsCountEl) duelsCountEl.textContent = String(activeDuelsCache.length);
        if (duelsCardCountEl) duelsCardCountEl.textContent = String(activeDuelsCache.length);

        await renderDuelsList(activeDuelsCache);
        showNotification('Duel removed from your list.', 'success', 2600);
    } catch (error) {
        console.error('Failed to remove duel from personal list:', error);
        showNotification('Could not remove duel right now.', 'error', 3400);
    }
};

function buildDuelOutcomeLabel(duelData) {
    const challengerState = getDuelPlayerState(duelData, duelData.challengerUid);
    const opponentState = getDuelPlayerState(duelData, duelData.opponentUid);
    const challengerAttempts = 12 - (challengerState.attemptsLeft ?? 12);
    const opponentAttempts = 12 - (opponentState.attemptsLeft ?? 12);

    if (challengerState.won && !opponentState.won) {
        return 'Challenger won the duel.';
    }
    if (!challengerState.won && opponentState.won) {
        return 'Opponent won the duel.';
    }
    if (challengerState.won && opponentState.won) {
        if (challengerAttempts < opponentAttempts) return 'Challenger won by using fewer guesses.';
        if (opponentAttempts < challengerAttempts) return 'Opponent won by using fewer guesses.';
        return 'Draw. Both players solved it in the same number of guesses.';
    }
    return 'Draw. Neither player found the shark.';
}

function getLocalizedDuelResult(duelData) {
    const challengerState = getDuelPlayerState(duelData, duelData.challengerUid);
    const opponentState = getDuelPlayerState(duelData, duelData.opponentUid);
    const selfState = getDuelPlayerState(duelData, currentUser.uid);
    const opponentUid = getDuelOpponentUid(duelData, currentUser.uid);
    const rivalState = getDuelPlayerState(duelData, opponentUid);
    const selfAttempts = 12 - (selfState.attemptsLeft ?? 12);
    const rivalAttempts = 12 - (rivalState.attemptsLeft ?? 12);

    if (challengerState.won && !opponentState.won) {
        return duelData.challengerUid === currentUser.uid ? 'You won the duel.' : 'You lost the duel.';
    }
    if (!challengerState.won && opponentState.won) {
        return duelData.opponentUid === currentUser.uid ? 'You won the duel.' : 'You lost the duel.';
    }
    if (challengerState.won && opponentState.won) {
        if (selfAttempts < rivalAttempts) return 'You won by using fewer guesses.';
        if (rivalAttempts < selfAttempts) return 'You lost. Your rival solved it faster.';
        return 'Draw. Both of you solved it in the same number of guesses.';
    }
    return 'Draw. Neither player found the shark.';
}

function shouldFinalizeDuel(duelData) {
    const challengerState = getDuelPlayerState(duelData, duelData.challengerUid);
    const opponentState = getDuelPlayerState(duelData, duelData.opponentUid);
    return challengerState.completed && opponentState.completed;
}

window.openFriendDuelModal = async function(duelId) {
    if (!currentUser || !db) return;
    currentOpenDuelId = duelId;
    ensureDuelSharkOptions();
    const duel = activeDuelsCache.find(entry => entry.id === duelId);
    if (duel) {
        await renderFriendDuelModal(duel);
    }
    document.getElementById('friendDuelModal')?.classList.remove('hidden');
};

window.closeFriendDuelModal = function() {
    currentOpenDuelId = null;
    hideDuelSuggestions();
    document.getElementById('friendDuelModal')?.classList.add('hidden');
};

async function renderFriendDuelModal(duelData) {
    if (!duelData || !currentUser) return;
    const opponentUid = getDuelOpponentUid(duelData, currentUser.uid);
    const [selfProfile, opponentProfile] = await Promise.all([
        getUserProfileForUid(currentUser.uid),
        getUserProfileForUid(opponentUid)
    ]);
    const selfState = getDuelPlayerState(duelData, currentUser.uid);
    const opponentState = getDuelPlayerState(duelData, opponentUid);
    const title = document.getElementById('duel-title');
    const subtitle = document.getElementById('duel-subtitle');
    const selfPic = document.getElementById('duel-self-pic');
    const opponentPic = document.getElementById('duel-opponent-pic');
    const selfCard = document.getElementById('duel-self-card');
    const opponentCard = document.getElementById('duel-opponent-card');
    const selfName = document.getElementById('duel-self-name');
    const opponentName = document.getElementById('duel-opponent-name');
    const selfStatus = document.getElementById('duel-self-status');
    const opponentStatus = document.getElementById('duel-opponent-status');
    const attemptsLeft = document.getElementById('duel-attempts-left');
    const selfGuessCount = document.getElementById('duel-self-guess-count');
    const opponentGuessCount = document.getElementById('duel-opponent-guess-count');
    const result = document.getElementById('duel-result');
    const message = document.getElementById('duel-message');
    const liveNote = document.getElementById('duel-live-note');
    const inputArea = document.getElementById('duel-input-area');
    const guessesBoard = document.getElementById('duel-guesses');
    const input = document.getElementById('duel-guess-input');

    if (title) title.textContent = `${(opponentProfile?.username || 'Rival')} Showdown`;
    if (subtitle) subtitle.textContent = duelData.status === 'pending'
        ? 'Waiting on one accept before the board opens.'
        : 'You are both hunting the exact same shark.';
    if (selfPic) selfPic.src = selfProfile?.profilePicture || 'images/pfp/shark1.png';
    if (opponentPic) opponentPic.src = opponentProfile?.profilePicture || 'images/pfp/shark1.png';
    if (selfCard) applyDuelPlayerTheme('duel-self-card', selfProfile?.equippedCardTheme || 'default');
    if (opponentCard) applyDuelPlayerTheme('duel-opponent-card', opponentProfile?.equippedCardTheme || 'default');
    if (selfName) selfName.textContent = selfProfile?.username || 'You';
    if (opponentName) opponentName.textContent = opponentProfile?.username || opponentUid || 'Rival';
    if (selfStatus) selfStatus.textContent = duelPlayerStatusText(selfState, duelData.status, true);
    if (opponentStatus) opponentStatus.textContent = duelPlayerStatusText(opponentState, duelData.status, false);
    if (attemptsLeft) attemptsLeft.textContent = String(selfState.attemptsLeft ?? 12);
    if (selfGuessCount) selfGuessCount.textContent = String((selfState.guesses || []).length);
    if (opponentGuessCount) opponentGuessCount.textContent = String((opponentState.guesses || []).length);
    if (result) result.textContent = duelData.status === 'completed' ? getLocalizedDuelResult(duelData) : (duelData.resultLabel || 'Live');
    if (message) message.textContent = duelModalMessage(duelData, selfState, opponentState);
    if (liveNote) liveNote.textContent = duelLiveNoteText(duelData, selfState, opponentState);
    if (inputArea) inputArea.style.display = duelData.status === 'active' && !selfState.completed ? 'flex' : 'none';
    if (input) {
        input.oninput = () => {
            const value = input.value.trim();
            if (!value) {
                hideDuelSuggestions();
                return;
            }
            renderDuelSuggestions(value);
        };
        input.onfocus = () => {
            const value = input.value.trim();
            if (value) renderDuelSuggestions(value);
        };
        input.onblur = () => {
            setTimeout(() => hideDuelSuggestions(), 120);
        };
        input.onkeydown = event => {
            if (event.key === 'ArrowDown') {
                event.preventDefault();
                if (document.getElementById('duel-suggestions')?.classList.contains('hidden')) {
                    renderDuelSuggestions(input.value.trim());
                } else {
                    moveDuelSuggestionSelection(1);
                }
                return;
            }
            if (event.key === 'ArrowUp') {
                event.preventDefault();
                moveDuelSuggestionSelection(-1);
                return;
            }
            if (event.key === 'Enter') {
                event.preventDefault();
                if (duelVisibleSuggestions.length && duelSuggestionIndex >= 0 && !document.getElementById('duel-suggestions')?.classList.contains('hidden')) {
                    applyDuelSuggestion(duelVisibleSuggestions[duelSuggestionIndex]);
                    return;
                }
                submitDuelGuess();
            }
            if (event.key === 'Escape') {
                hideDuelSuggestions();
            }
        };
    }

    guessesBoard.innerHTML = '';
    const targetShark = Array.isArray(window.sharks) ? window.sharks.find(shark => shark.name === duelData.sharkName) : null;
    (selfState.guesses || []).forEach((guessName, index) => {
        const guessedShark = window.sharks.find(shark => shark.name === guessName);
        if (!guessedShark || !targetShark) return;
        const feedback = buildDuelFeedback(guessedShark, targetShark);
        guessesBoard.appendChild(createDuelGuessCard(guessedShark, feedback, targetShark, index + 1));
    });
}

function duelPlayerStatusText(playerState, duelStatus, isSelf) {
    if (duelStatus === 'pending') {
        return isSelf ? 'Ready' : (playerState.accepted ? 'Ready' : 'Waiting');
    }
    if (playerState.completed && playerState.won) return 'Solved';
    if (playerState.completed && !playerState.won) return 'Locked';
    return `${12 - (playerState.attemptsLeft ?? 12)} guesses used`;
}

function duelLiveNoteText(duelData, selfState, opponentState) {
    if (duelData.status === 'pending') {
        return 'This screen updates automatically the moment the other player responds.';
    }
    if (duelData.status === 'completed') {
        return `Final board: you finished in ${(selfState.guesses || []).length}, your rival finished in ${(opponentState.guesses || []).length}.`;
    }
    return `Live board: you are on ${(selfState.guesses || []).length} guesses, your rival is on ${(opponentState.guesses || []).length}.`;
}

// Override with clean copy so the showdown UI stays concise and readable.
function duelModalMessage(duelData, selfState, opponentState) {
    if (duelData.status === 'pending') {
        return duelData.opponentUid === currentUser.uid
            ? 'Accept the duel to open the shared shark board.'
            : 'Challenge sent. The board opens as soon as your rival accepts.';
    }
    if (duelData.status === 'declined') {
        return 'This challenge was declined.';
    }
    if (duelData.status === 'completed') {
        return duelData.resultLabel || 'Final result locked.';
    }
    if (selfState.completed && !opponentState.completed) {
        return 'Your run is locked. Now it is your rival\'s turn to finish.';
    }
    return 'Read the feedback, narrow the shark, and solve in fewer guesses than your rival.';
}

function createDuelGuessCard(guessedShark, feedback, targetShark, guessNumber) {
    const card = document.createElement('div');
    card.className = 'duel-guess-card';
    const isCorrect = normalizeSharkInput(guessedShark.name) === normalizeSharkInput(targetShark.name);
    const feedbackHtml = feedback.map(item => {
        let extra = '';
        if (item.category === 'Year of Discovery' && !item.correct) {
            extra = item.value < targetShark.yod ? ' \u{2191}' : ' \u{2193}';
        }
        if (item.category === 'Size' && duelSizeThresholds[item.value]) {
            extra = ` (${duelSizeThresholds[item.value]})`;
        }
        return `<div class="duel-feedback-chip ${item.correct ? 'correct' : ''}"><strong>${item.category}:</strong> ${item.value}${extra}</div>`;
    }).join('');

    card.innerHTML = `
        <div class="duel-guess-header">
            <div class="duel-guess-name ${isCorrect ? 'correct' : 'incorrect'}">${guessedShark.name}</div>
            <div class="duel-guess-index">Guess ${guessNumber}</div>
        </div>
        <div class="duel-feedback-grid">${feedbackHtml}</div>
    `;
    return card;
}

window.submitDuelGuess = async function() {
    if (!currentUser || !db || !currentOpenDuelId) return;
    const duel = activeDuelsCache.find(entry => entry.id === currentOpenDuelId);
    if (!duel) return;

    const input = document.getElementById('duel-guess-input');
    const message = document.getElementById('duel-message');
    const rawGuess = input?.value.trim() || '';
    const guessInput = normalizeSharkInput(rawGuess);
    const selfState = getDuelPlayerState(duel, currentUser.uid);

    if (duel.status !== 'active' || selfState.completed) return;

    if (!guessInput) {
        if (message) message.textContent = 'Enter a shark name.';
        return;
    }

    const guessedShark = window.sharks.find(shark => normalizeSharkInput(shark.name) === guessInput);
    if (!guessedShark) {
        if (message) message.textContent = 'That shark is not in the roster.';
        return;
    }
    if ((selfState.guesses || []).includes(guessedShark.name)) {
        if (message) message.textContent = 'You already guessed that shark in this duel.';
        return;
    }

    hideDuelSuggestions();

    const targetShark = window.sharks.find(shark => shark.name === duel.sharkName);
    if (!targetShark) return;

    const updatedGuesses = [...(selfState.guesses || []), guessedShark.name];
    const nextAttemptsLeft = Math.max((selfState.attemptsLeft ?? 12) - 1, 0);
    const won = normalizeSharkInput(guessedShark.name) === normalizeSharkInput(targetShark.name);
    const completed = won || nextAttemptsLeft === 0;

    const mergedDuel = {
        ...duel,
        updatedAtMs: Date.now(),
        players: {
            ...duel.players,
            [currentUser.uid]: {
                ...selfState,
                guesses: updatedGuesses,
                attemptsLeft: nextAttemptsLeft,
                completed,
                won,
                accepted: true
            }
        }
    };

    if (shouldFinalizeDuel(mergedDuel)) {
        mergedDuel.status = 'completed';
        mergedDuel.resultLabel = buildDuelOutcomeLabel(mergedDuel);
    }

    await saveDuelForParticipants(mergedDuel);

    if (message) {
        message.textContent = won
            ? 'Direct hit. Your shark is locked in for scoring.'
            : nextAttemptsLeft === 0
                ? 'No attempts left. Your duel run is locked in.'
                : 'Guess logged. Keep hunting.';
    }
    if (input) input.value = '';
};

function getRevealableDuel(duelId = null) {
    if (duelId) {
        return activeDuelsCache.find(entry => entry.id === duelId) || null;
    }
    if (currentOpenDuelId) {
        return activeDuelsCache.find(entry => entry.id === currentOpenDuelId) || null;
    }
    return activeDuelsCache.find(entry =>
        entry?.status === 'active'
        && (entry?.participants || []).includes(currentUser?.uid)
    ) || null;
}

// Console command for testing: revealShark() - Dev only
window.revealShark = function(duelId = null) {
    if (!firebase.auth().currentUser || !isDeveloperUid(firebase.auth().currentUser.uid)) {
        console.log("\u{274C} Access denied. This command is for developers only.");
        return;
    }

    const duel = getRevealableDuel(duelId);
    if (!duel?.sharkName) {
        console.log("No active duel shark found. Open a duel first or pass a duel id to revealShark('duel_id').");
        return;
    }

    console.log(`TESTING ONLY: The duel target shark is: ${duel.sharkName}`);
};

window.reset = async function(uid) {
    try {
        if (!currentUser || !isDeveloperUid(currentUser.uid)) {
            showNotification('Dev command: Access denied.', 'error', 4000);
            return;
        }
        if (!uid) {
            showNotification('No UID provided.', 'error', 4000);
            return;
        }
        if (!confirm('Are you sure you want to reset ALL data for UID: ' + uid + '? This cannot be undone.')) return;
        // Wipe userStats in Firestore
        await db.collection('userStats').doc(uid).set({}, { merge: false });
        // Attempt to wipe localStorage if the user is currently logged in on this device
        let localProfile = {};
        try { localProfile = JSON.parse(localStorage.getItem('userProfile') || '{}'); } catch {}
        if (localProfile && localProfile.uid === uid) {
            localStorage.removeItem('userProfile');
            localStorage.removeItem('totalXP');
            localStorage.removeItem('redeemedCodes');
            localStorage.removeItem('loginStreak');
            localStorage.removeItem('lastLoginDate');
            localStorage.removeItem('currentLoginDay');
            localStorage.removeItem('claimedAchievements');
            localStorage.removeItem('unlockedAchievements');
            localStorage.removeItem('showcasedAchievements');
        }
        // Also clear if the current logged in user matches
        if (uid === currentUser.uid) {
            localStorage.removeItem('userProfile');
            localStorage.removeItem('totalXP');
            localStorage.removeItem('redeemedCodes');
            localStorage.removeItem('loginStreak');
            localStorage.removeItem('lastLoginDate');
            localStorage.removeItem('currentLoginDay');
            localStorage.removeItem('claimedAchievements');
            localStorage.removeItem('unlockedAchievements');
            localStorage.removeItem('showcasedAchievements');
        }
        showNotification('Account data reset for UID: ' + uid, 'success', 4000);
    } catch (err) {
        showNotification('Error resetting account: ' + (err.message || err), 'error', 5000);
        console.error('Dev reset error:', err);
    }
}

// Dev-only: Apply summer theme locally (does not affect global theme)
window.applySummerTheme = function() {
    if (!currentUser || !isDeveloperUid(currentUser.uid)) {
        showNotification('Dev command: Access denied.', 'error', 4000);
        return;
    }
    applyIndexTheme('summer', true);
    updateSeasonalCratePanels();
    showNotification('Summer theme applied (local only)', 'success', 2500);
};

// Dev-only: Toggle summer theme on/off
window.toggleSummerTheme = function() {
    if (!currentUser || !isDeveloperUid(currentUser.uid)) {
        showNotification('Dev command: Access denied.', 'error', 4000);
        return;
    }
    const body = document.body;
    const isSummer = body.classList.contains('global-ui-theme-summer');
    applyIndexTheme(isSummer ? 'default' : 'summer', true);
    updateSeasonalCratePanels();
    showNotification(isSummer ? 'Summer theme disabled' : 'Summer theme enabled (local only)', 'success', 2500);
};

// Dev-only: Unlock all profile card themes for the current account
window.giveProfileThemes = async function() {
    if (!currentUser || !isDeveloperUid(currentUser.uid)) {
        showNotification('Dev command: Access denied.', 'error', 4000);
        return;
    }
    const profileData = getCurrentProfileData();
    if (!profileData || typeof profileData !== 'object') {
        showNotification('Unable to access profile data.', 'error', 4000);
        return;
    }

    profileData.unlockedCardThemes = [...new Set(["default", ...sharkPassCardThemes.map(theme => theme.id)])];
    saveUserProfileLocally(profileData, { skipRemoteSync: true });

    if (db && currentUser) {
        try {
            await db.collection('userStats').doc(currentUser.uid).set({
                unlockedCardThemes: profileData.unlockedCardThemes
            }, { merge: true });
        } catch (err) {
            console.warn('Unable to sync theme grants:', err);
        }
    }

    if (typeof renderThemeSelection === 'function') {
        renderThemeSelection();
    }
    showNotification(`Unlocked ${profileData.unlockedCardThemes.length} profile themes`, 'success', 3500);
};

// Dev-only keyboard shortcut: Ctrl+Shift+S toggles summer theme locally
document.addEventListener('keydown', function(e) {
    if (e.ctrlKey && e.shiftKey && e.key === 'S') {
        e.preventDefault();
        if (currentUser && isDeveloperUid(currentUser.uid)) {
            window.toggleSummerTheme();
        } else {
            console.log('Summer theme toggle: Developer access required.');
        }
    }
});

// ----- BADGE SYSTEM -----
const DEV_UID = 'ETPtQC0VA2NiSnX67rS2P2ma2tC2'; // Primary dev UID kept for backwards compatibility
const DEV_UIDS = ['ETPtQC0VA2NiSnX67rS2P2ma2tC2', 'gOcPqOuyPJRWisE4dxvFkGTOl5g2'];

function isDeveloperUid(uid) {
    return DEV_UIDS.includes(uid || "");
}
const sharkPassCardThemes = [
    { id: "default", name: "Starter Blue", level: 0, preview: "linear-gradient(135deg, rgba(0,180,216,0.16), rgba(11,34,51,0.94))" },
    { id: "reef-signal", name: "Reef Signal", level: 7, preview: "radial-gradient(circle at 18% 20%, rgba(255, 147, 105, 0.22), transparent 26%), linear-gradient(135deg, rgba(42, 121, 117, 0.34), rgba(9, 30, 55, 0.96) 52%, rgba(5, 13, 28, 1))" },
    { id: "copper-surge", name: "Copper Surge", level: 15, preview: "radial-gradient(circle at 84% 16%, rgba(255, 197, 105, 0.28), transparent 22%), linear-gradient(135deg, rgba(139, 83, 55, 0.34), rgba(25, 45, 76, 0.96) 50%, rgba(6, 17, 31, 1))" },
    { id: "raylight-drift", name: "Raylight Drift", level: 24, preview: "radial-gradient(circle at 26% 74%, rgba(137, 255, 221, 0.22), transparent 28%), linear-gradient(140deg, rgba(48, 72, 122, 0.38), rgba(31, 96, 112, 0.9) 48%, rgba(6, 15, 36, 1))" },
    { id: "sixgill-night", name: "Sixgill Night", level: 30, preview: "radial-gradient(circle at 76% 14%, rgba(248, 239, 164, 0.2), transparent 18%), radial-gradient(circle at 16% 82%, rgba(120, 190, 255, 0.18), transparent 30%), linear-gradient(145deg, rgba(54, 47, 92, 0.38), rgba(14, 25, 57, 0.98) 56%, rgba(3, 8, 22, 1))" },
    { id: "coral-bloom", name: "Coral Bloom", unlockAchievement: "pacific_master", preview: "linear-gradient(135deg, rgba(255, 122, 156, 0.28), rgba(255, 176, 109, 0.2) 38%, rgba(15, 92, 112, 0.96))" },
    { id: "deep-abyss", name: "Deep Abyss", unlockAchievement: "guess_master", preview: "linear-gradient(135deg, rgba(17, 255, 203, 0.14), rgba(5, 18, 34, 0.94) 42%, rgba(1, 6, 15, 0.99))" },
    { id: "storm-current", name: "Storm Current", unlockAchievement: "duel_won", preview: "linear-gradient(135deg, rgba(117, 202, 255, 0.26), rgba(67, 126, 255, 0.2) 34%, rgba(9, 20, 47, 0.98))" },
    { id: "pearl-reef", name: "Pearl Reef", unlockAchievement: "secret_command_found", preview: "linear-gradient(135deg, rgba(250, 240, 214, 0.3), rgba(164, 244, 231, 0.18) 42%, rgba(24, 72, 92, 0.96))" },
    { id: "volcanic-ember", name: "Volcanic Ember", unlockAchievement: "streak_100", preview: "linear-gradient(180deg, rgba(15, 3, 2, 0.12), rgba(6, 2, 3, 0.58)), url(images/profileThemes/VolcanicEmber.png) center center / cover no-repeat" },
    { id: "lucky-current", name: "Lucky Current", preview: "linear-gradient(135deg, rgba(103, 255, 174, 0.3), rgba(255, 220, 92, 0.2) 34%, rgba(13, 83, 75, 0.96) 70%, rgba(6, 27, 38, 1))" },
    { id: "kelp-canopy", name: "Kelp Canopy", preview: "linear-gradient(180deg, rgba(6, 31, 23, 0.08), rgba(3, 22, 21, 0.5)), url(images/profileThemes/KelpCanopy.png) center center / cover no-repeat" },
    { id: "glacier-shine", name: "Glacier Shine", preview: "linear-gradient(180deg, rgba(255, 255, 255, 0.2), rgba(18, 69, 95, 0.34)), url(images/profileThemes/GlacierShine.png) center center / cover no-repeat" },
    { id: "ocean-breeze", name: "Ocean Breeze", preview: "linear-gradient(135deg, rgba(100, 200, 255, 0.3), rgba(50, 150, 200, 0.2) 42%, rgba(10, 50, 80, 0.96))" },
    { id: "horizonflare", name: "Horizon", preview: "radial-gradient(circle at 50% 10%, rgba(255,255,255,0.06), transparent 30%), linear-gradient(to top, rgba(255,145,70,0.9) 0%, rgba(255,95,160,0.8) 55%, rgba(140,90,180,0.85) 100%)" },
    { id: "solsticeglow", name: "Summer Glow", preview: "linear-gradient(135deg, rgba(255, 220, 100, 0.4), rgba(255, 180, 50, 0.25) 42%, rgba(40, 30, 10, 0.98))" },
    { id: "abyss-bloom", name: "Abyss Bloom", preview: "radial-gradient(circle at 18% 22%, rgba(255, 108, 170, 0.22), transparent 24%), radial-gradient(circle at 78% 18%, rgba(72, 221, 196, 0.18), transparent 28%), linear-gradient(142deg, rgba(31, 92, 109, 0.34), rgba(18, 31, 68, 0.96) 52%, rgba(7, 12, 31, 1))" },
    { id: "neon-reef", name: "Neon Reef", unlockAchievement: "crate_collector_50", preview: "radial-gradient(circle at 24% 20%, rgba(95, 255, 184, 0.24), transparent 24%), radial-gradient(circle at 82% 70%, rgba(255, 217, 91, 0.16), transparent 30%), linear-gradient(135deg, rgba(22, 143, 126, 0.32), rgba(27, 69, 124, 0.96) 48%, rgba(8, 19, 45, 1))" },
    { id: "lunar-current", name: "Lunar Current", unlockAchievement: "wins_1000", preview: "radial-gradient(circle at 76% 16%, rgba(248, 250, 255, 0.24), transparent 18%), radial-gradient(circle at 18% 78%, rgba(139, 189, 255, 0.18), transparent 30%), linear-gradient(145deg, rgba(64, 74, 145, 0.38), rgba(17, 35, 82, 0.98) 55%, rgba(5, 11, 27, 1))" },
    { id: "candycane", name: "Candy Cane", preview: "repeating-linear-gradient(135deg, #fff5f5 0 11px, #ff6b6b 11px 22px)" },
    { id: "elf", name: "Elf", preview: "linear-gradient(180deg, rgba(245, 255, 224, 0.18), rgba(31, 94, 48, 0.26)), url(images/profileThemes/Elf.png) center center / cover no-repeat" },
    { id: "north-pole", name: "North Pole", preview: "linear-gradient(180deg, rgba(255, 255, 255, 0.42), rgba(120, 188, 220, 0.18)), url(images/profileThemes/Northpole.png) center center / cover no-repeat" },
    { id: "pumpkin-patch", name: "Goo", preview: "radial-gradient(circle at 12% 16%, rgba(196, 255, 111, 0.24), transparent 23%), radial-gradient(circle at 84% 8%, rgba(255, 130, 35, 0.24), transparent 20%), linear-gradient(155deg, rgba(12, 26, 12, 0.2), rgba(23, 6, 34, 0.72)), url(images/profileThemes/Goo.png) center top / cover no-repeat" },
    { id: "haunted-abyss", name: "Witchlight", preview: "radial-gradient(circle at 76% 12%, rgba(213, 160, 255, 0.26), transparent 22%), radial-gradient(circle at 16% 82%, rgba(159, 255, 103, 0.16), transparent 28%), linear-gradient(160deg, rgba(13, 0, 24, 0.08), rgba(6, 0, 18, 0.64)), url(images/profileThemes/Witchlight.png) center center / cover no-repeat" },
    { id: "nightmare-reef", name: "Phantom Fog", preview: "radial-gradient(circle at 82% 18%, rgba(245, 238, 218, 0.2), transparent 19%), radial-gradient(circle at 12% 72%, rgba(130, 255, 174, 0.12), transparent 30%), linear-gradient(180deg, rgba(6, 12, 18, 0.08), rgba(2, 4, 10, 0.66)), url(images/profileThemes/PhantomFog.png) center center / cover no-repeat" }
];

const CRATE_DROP_CHANCE = 0.5;
const GLOBAL_XP_EVENT_CONFIG_PATH = {
    collection: "globalConfig",
    doc: "xpEvent"
};
const GLOBAL_INDEX_THEME_CONFIG_PATH = {
    collection: "globalConfig",
    doc: "indexTheme"
};
const GLOBAL_MESSAGE_CONFIG_PATH = {
    collection: "globalConfig",
    doc: "globalMessage"
};
const COMMUNITY_BOSS_EVENTS = [
    {
        id: "summer-megaladon-2026",
        season: "summer",
        seasonLabel: "Limited Summer Boss Event",
        bossName: "Megalodon",
        title: "Defeat the Megalodon",
        targetWins: 150,
        // Event counter only: leaderboard/profile wins remain +1 in the mode scripts.
        contributionMultiplier: 2,
        startMs: new Date("2026-05-25T00:00:00Z").getTime(),
        endMs: new Date("2026-06-15T00:00:00Z").getTime(),
        crateId: "summer",
        rewardBadgeId: "extinction",
        rewardBadgeName: "Extinction",
        rewards: createCommunityBossRewards("summer")
    },
    {
        id: "summer-cladoselache-2026",
        season: "summer",
        seasonLabel: "Limited Summer Boss Event",
        bossName: "Cladoselache",
        title: "Defeat the Cladoselache",
        targetWins: 150,
        // Event counter only: leaderboard/profile wins remain +1 in the mode scripts.
        contributionMultiplier: 1,
        startMs: new Date("2026-06-20T00:00:00Z").getTime(),
        endMs: new Date("2026-07-05T00:00:00Z").getTime(),
        crateId: "summer",
        rewardBadgeId: "extinction",
        rewardBadgeName: "Extinction",
        rewardMode: "milestone",
        rewards: createCommunityBossMilestoneRewards("summer")
    },
    {
        id: "halloween-helicoprion-2026",
        season: "halloween",
        seasonLabel: "Limited Halloween Boss Event",
        bossName: "Helicoprion",
        title: "Defeat the Helicoprion",
        targetWins: 150,
        startMs: new Date("2026-10-18T00:00:00Z").getTime(),
        endMs: new Date("2026-11-01T00:00:00Z").getTime(),
        crateId: "halloween",
        rewardBadgeId: "spiral-hunter",
        rewardBadgeName: "Spiral Hunter",
        rewards: createCommunityBossRewards("halloween")
    },
    {
        id: "christmas-stethacanthus-2026",
        season: "christmas",
        seasonLabel: "Limited Christmas Boss Event",
        bossName: "Stethacanthus",
        title: "Defeat the Stethacanthus",
        targetWins: 150,
        startMs: new Date("2026-12-12T00:00:00Z").getTime(),
        endMs: new Date("2026-12-26T00:00:00Z").getTime(),
        crateId: "christmas",
        rewardBadgeId: "frost-anvil",
        rewardBadgeName: "Frost Anvil",
        rewards: createCommunityBossRewards("christmas")
    }
];
const COMMUNITY_BOSS_EVENT = getCurrentCommunityBossEvent();
const COMMUNITY_BOSS_DISPLAY_DISABLED_FOR_NOW = true;
const CLADOSELACHE_PARTICIPATION_EVENT_ID = "summer-cladoselache-2026";
const CLADOSELACHE_PARTICIPATION_REWARD_ID = "cladoselache-participation-cosmetic-crate";
const CLADOSELACHE_PARTICIPATION_ACCOUNT_CUTOFF_MS = new Date("2026-07-05T23:59:59Z").getTime();
const SEASONAL_THEME_DISABLED_KEY = "disableSeasonalTheme";
const INDEX_THEME_OPTIONS = [
    { id: "default", name: "Default Ocean" },
    { id: "summer", name: "Summer Splash" },
    { id: "birthday", name: "Birthday Bash" },
    { id: "christmas", name: "Christmas Reef" },
    { id: "halloween", name: "Halloween Depths" },
    { id: "northpole", name: "North Pole" }
];
const limitedTimeXpEvent = {
    id: "june-2026-double-xp",
    label: "2x XP Event",
    multiplier: 2,
    startMs: new Date("2026-06-26T17:00:00+01:00").getTime(),
    endMs: new Date("2026-06-29T17:00:00+01:00").getTime()
};
const crateDefinitions = {
    reef: {
        id: "reef",
        name: "Cosmetic Crate",
        icon: "fa-box-open"
    },
    summer: {
        id: "summer",
        name: "Summer Crate",
        icon: "fa-umbrella-beach"
    },
    christmas: {
        id: "christmas",
        name: "Christmas Crate",
        icon: "fa-gift"
    },
    halloween: {
        id: "halloween",
        name: "Halloween Crate",
        icon: "fa-ghost"
    }
};

const crateAchievementIds = {
    reef: "crate_opened",
    summer: "summer_crate_opened",
    christmas: "christmas_crate_opened",
    halloween: "halloween_crate_opened"
};

const crateRarityWeights = {
    common: 58,
    rare: 28,
    epic: 10,
    legendary: 4
};
const CRATE_LEGENDARY_PITY_THRESHOLD = 25;
const SHARK_TAXONOMY_COMMON_NAMES = [
    { scientific: "Carcharhiniformes", Common: "Ground Sharks" },
    { scientific: "Orectolobiformes", Common: "Carpet Sharks" },
    { scientific: "Lamniformes", Common: "Mackerel Sharks" },
    { scientific: "Heterodontiformes", Common: "Bullhead Sharks" },
    { scientific: "Squantiniformes", Common: "Angel Sharks" },
    { scientific: "Pristiophoriformes", Common: "Saw Sharks" },
    { scientific: "Squaliformes", Common: "Dog Fish" },
    { scientific: "Hexanchiformes", Common: "Cow and Frilled Sharks" },
    { scientific: "Sphyrnidae", Common: "Hammerhead Sharks" },
    { scientific: "Carcharhinidae", Common: "Requiem Sharks" },
    { scientific: "Stegostinatidae", Common: "Zebra Sharks" },
    { scientific: "Rhincodontidae", Common: "Whale Sharks" },
    { scientific: "Orectolobidae", Common: "Wobbegong Sharks" },
    { scientific: "Hemiscylliidae", Common: "Bamboo Sharks" },
    { scientific: "Ginglymostomatidae", Common: "Nurse Sharks" },
    { scientific: "Dalatiidae", Common: "Kitefin Sharks" },
    { scientific: "Etmopteridae", Common: "Lantern Sharks" },
    { scientific: "Echinorhinidae", Common: "Bramble Sharks" },
    { scientific: "Odontaspididae", Common: "Sand Tiger Sharks" },
    { scientific: "Megachasmidae", Common: "Megamouth Sharks" },
    { scientific: "Lamnidae", Common: "Mackerel Sharks" },
    { scientific: "Hexanchidae", Common: "Cow Sharks" },
    { scientific: "Centrophoridae", Common: "Gulper Sharks" },
    { scientific: "Pristiophoridae", Common: "Saw Sharks" },
    { scientific: "Squatinidae", Common: "Angel Sharks" },
    { scientific: "Heterodontidae", Common: "Bullhead Sharks" },
    { scientific: "Alopiidae", Common: "Thresher Sharks" },
    { scientific: "Cetorhinidae", Common: "Basking Sharks" },
    { scientific: "Mitsukurinidae", Common: "Goblin Sharks" },
    { scientific: "Brachaeluridae", Common: "Blind Sharks" },
    { scientific: "Chlamydoselachidae", Common: "Frilled Sharks" },
    { scientific: "Pseudocarchariidae", Common: "Crocodile Sharks" },
    { scientific: "Somniosidae", Common: "Sleeper Sharks" },
    { scientific: "Pentachidae", Common: "Deep-Sea CatSharks" },
    { scientific: "Glyphis", Common: "River Sharks" },
    { scientific: "Haploblepharus", Common: "ShySharks" }
];

function getSharkTaxonomyCommonName(scientificName = "") {
    const value = String(scientificName || "").trim();
    if (!value) return "";
    return SHARK_TAXONOMY_COMMON_NAMES.find(entry => entry.scientific === value)?.Common || "";
}

window.SHARK_TAXONOMY_COMMON_NAMES = SHARK_TAXONOMY_COMMON_NAMES;
window.getSharkTaxonomyCommonName = getSharkTaxonomyCommonName;

const crateDuplicateXpRewards = {
    common: 40,
    rare: 85,
    epic: 160,
    legendary: 320
};
const STREAK_SHIELD_ITEM_ID = "streak-shield";

const crateRewardPool = [
    { id: "crate-pfp-cobbler-wobbegong", type: "pfp", name: "Cobbler Wobbegong", imagePath: "images/cratePfp/cosmeticCrate2/CobblerWobbegong.png", rarity: "common", blurb: "Unlock the Cobbler Wobbegong profile picture." },
    { id: "crate-badge-tide-glass", type: "badge", badgeId: "tide-glass", name: "Tide Glass", rarity: "common", blurb: "Unlock the Tide Glass badge." },
    { id: "crate-pfp-japanese-sawshark", type: "pfp", name: "Japanese Sawshark", imagePath: "images/cratePfp/cosmeticCrate2/JapaneseSawShark.png", rarity: "rare", blurb: "Unlock the Japanese Sawshark profile picture." },
    { id: "crate-badge-fossil-tooth", type: "badge", badgeId: "fossil-tooth", name: "Fossil Tooth", rarity: "rare", blurb: "Unlock the Fossil Tooth badge." },
    { id: "crate-theme-abyss-bloom", type: "theme", themeId: "abyss-bloom", name: "Abyss Bloom", rarity: "rare", blurb: "Unlock the Abyss Bloom profile theme." },
    { id: "crate-pfp-pelagic-stingray", type: "pfp", name: "Pelagic Stingray", imagePath: "images/cratePfp/cosmeticCrate2/PelagicStingray.png", rarity: "epic", blurb: "Unlock the Pelagic Stingray profile picture." },
    { id: "crate-badge-deep-anchor", type: "badge", badgeId: "deep-anchor", name: "Deep Anchor", rarity: "epic", blurb: "Unlock the Deep Anchor badge." },
    { id: "crate-item-streak-shield", type: "item", itemId: STREAK_SHIELD_ITEM_ID, quantity: 1, emoji: "\u{1F6E1}\uFE0F", name: "Streak Shield", rarity: "epic", blurb: "Protects your win streak from one loss. Auto-activates when needed." },
    { id: "crate-theme-neon-reef", type: "theme", themeId: "neon-reef", name: "Neon Reef", rarity: "epic", blurb: "Unlock the Neon Reef profile theme." },
    { id: "crate-pfp-whiptail-stingray", type: "pfp", name: "Whiptail Stingray", imagePath: "images/cratePfp/cosmeticCrate2/WhiptailStingray.png", rarity: "legendary", blurb: "Unlock the Whiptail Stingray profile picture." },
    { id: "crate-badge-royal-pearl", type: "badge", badgeId: "royal-pearl", name: "Royal Pearl", rarity: "legendary", blurb: "Unlock the Royal Pearl badge." },
    { id: "crate-theme-lunar-current", type: "theme", themeId: "lunar-current", name: "Lunar Current", rarity: "legendary", blurb: "Unlock the Lunar Current profile theme." }
];

const legacyCrate1RewardPool = [
    { id: "crate-pfp-pyjama", type: "pfp", name: "Pyjama Shark", imagePath: "images/cratePfp/Shark24.png", rarity: "common", blurb: "Retired Cosmetic Crate 1 profile picture." },
    { id: "crate-badge-reef-glint", type: "badge", badgeId: "reef-glint", name: "Driftwood", rarity: "common", blurb: "Retired Cosmetic Crate 1 badge." },
    { id: "crate-pfp-japanese-bullhead", type: "pfp", name: "Japanese Bullhead Shark", imagePath: "images/cratePfp/Shark25.png", rarity: "rare", blurb: "Retired Cosmetic Crate 1 profile picture." },
    { id: "crate-badge-kelp-warden", type: "badge", badgeId: "kelp-warden", name: "Smelly Boot", rarity: "rare", blurb: "Retired Cosmetic Crate 1 badge." },
    { id: "crate-theme-volcanic-ember", type: "theme", themeId: "volcanic-ember", name: "Volcanic Ember", rarity: "rare", blurb: "Retired Cosmetic Crate 1 theme." },
    { id: "crate-pfp-frilled", type: "pfp", name: "Frilled Shark", imagePath: "images/cratePfp/Shark23.png", rarity: "epic", blurb: "Retired Cosmetic Crate 1 profile picture." },
    { id: "crate-badge-trench-myth", type: "badge", badgeId: "trench-myth", name: "Message Bottle", rarity: "epic", blurb: "Retired Cosmetic Crate 1 badge." },
    { id: "crate-theme-kelp-canopy", type: "theme", themeId: "kelp-canopy", name: "Kelp Canopy", rarity: "epic", blurb: "Retired Cosmetic Crate 1 theme." },
    { id: "crate-pfp-megamouth", type: "pfp", name: "Megamouth Shark", imagePath: "images/cratePfp/Shark22.png", rarity: "legendary", blurb: "Retired Cosmetic Crate 1 profile picture." },
    { id: "crate-badge-aurora-fin", type: "badge", badgeId: "aurora-fin", name: "Doubloon", rarity: "legendary", blurb: "Retired Cosmetic Crate 1 badge." },
    { id: "crate-theme-glacier-shine", type: "theme", themeId: "glacier-shine", name: "Glacier Shine", rarity: "legendary", blurb: "Retired Cosmetic Crate 1 theme." }
];

function getLegacyCrate1RewardByThemeId(themeId) {
    return legacyCrate1RewardPool.find(reward => reward.type === "theme" && reward.themeId === themeId);
}

const summerCrateRewardPool = [
    { id: "crate-pfp-leopard", type: "pfp", name: "Leopard Shark", imagePath: "images/cratePfp/SummerPfp/Shark1.png", rarity: "common", blurb: "Unlock the Leopard Shark profile picture." },
    { id: "crate-badge-tidepool", type: "badge", badgeId: "Tidepool", name: "Tidepool", rarity: "common", blurb: "Unlock the Tidepool badge from the summer crate." },
    { id: "crate-pfp-whale", type: "pfp", name: "Whale Shark", imagePath: "images/cratePfp/SummerPfp/Shark2.png", rarity: "rare", blurb: "Unlock the Whale Shark profile picture." },
    { id: "crate-badge-ice-cream", type: "badge", badgeId: "Ice Cream", name: "Ice Cream", rarity: "rare", blurb: "Unlock the Ice Cream badge from the summer crate." },
    { id: "crate-theme-ocean-breeze", type: "theme", themeId: "ocean-breeze", name: "Ocean Breeze", rarity: "rare", blurb: "Unlock the Ocean Breeze theme." },
    { id: "crate-pfp-sandTiger", type: "pfp", name: "Sand Tiger Shark", imagePath: "images/cratePfp/SummerPfp/Shark3.png", rarity: "epic", blurb: "Unlock the Sand Tiger Shark profile picture." },
    { id: "crate-badge-horizon", type: "badge", badgeId: "Horizon", name: "Horizon", rarity: "epic", blurb: "Unlock the Horizon badge from the summer crate." },
    { id: "crate-theme-horizonflare", type: "theme", themeId: "horizonflare", name: "Horizon Flare", rarity: "epic", blurb: "Unlock the Horizon Flare theme." },
    { id: "crate-pfp-sandbar", type: "pfp", name: "Sandbar Shark", imagePath: "images/cratePfp/SummerPfp/Shark4.png", rarity: "legendary", blurb: "Unlock the Sandbar Shark profile picture." },
    { id: "crate-badge-paradise", type: "badge", badgeId: "Paradise", name: "Paradise", rarity: "legendary", blurb: "Unlock the Paradise badge from the summer crate." },
    { id: "crate-theme-solsticeglow", type: "theme", themeId: "solsticeglow", name: "Solstice Glow", rarity: "legendary", blurb: "Unlock the Solstice Glow theme." }
];

const christmasCrateRewardPool = [
    { id: "crate-pfp-wobbegong", type: "pfp", name: "Wobbegong Shark", imagePath: "images/cratePfp/ChristmasPfp/Shark1.png", rarity: "common", blurb: "Unlock the Wobbegong Shark profile picture." },
    { id: "crate-badge-christmas", type: "badge", badgeId: "Christmas", name: "Christmas", rarity: "common", blurb: "Unlock the Christmas badge from the christmas crate." },
    { id: "crate-pfp-blind", type: "pfp", name: "Blind Shark", imagePath: "images/cratePfp/ChristmasPfp/Shark2.png", rarity: "rare", blurb: "Unlock the Blind Shark profile picture." },
    { id: "crate-badge-present", type: "badge", badgeId: "Present", name: "Present", rarity: "rare", blurb: "Unlock the Present badge from the christmas crate." },
    { id: "crate-theme-elf", type: "theme", themeId: "elf", name: "Elf", rarity: "rare", blurb: "Unlock the Elf Profile theme." },
    { id: "crate-pfp-carribbean", type: "pfp", name: "Carribbean Reef Shark", imagePath: "images/cratePfp/ChristmasPfp/Shark3.png", rarity: "epic", blurb: "Unlock the Carribbean Reef Shark profile picture." },
    { id: "crate-badge-snowflake", type: "badge", badgeId: "Snowflake", name: "Snowflake", rarity: "epic", blurb: "Unlock the Snowflake badge from the christmas crate." },
    { id: "crate-theme-candycane", type: "theme", themeId: "candycane", name: "Candy Cane", rarity: "epic", blurb: "Unlock the Candy Cane Profile theme." },
    { id: "crate-pfp-rough", type: "pfp", name: "Carribbean Rough Shark", imagePath: "images/cratePfp/ChristmasPfp/Shark4.png", rarity: "legendary", blurb: "Unlock the Carribbean Rough Shark profile picture." },
    { id: "crate-badge-santa", type: "badge", badgeId: "Santa", name: "Santa", rarity: "legendary", blurb: "Unlock the Santa badge from the christmas crate." },
    { id: "crate-theme-north-pole", type: "theme", themeId: "north-pole", name: "North Pole", rarity: "legendary", blurb: "Unlock the North Pole theme." }
];

const halloweenCrateRewardPool = [
    { id: "crate-pfp-chain-cat", type: "pfp", name: "Chain Catshark", imagePath: "images/cratePfp/HalloweenPfp/Shark1.png", rarity: "common", blurb: "Unlock the Chain Catshark profile picture." },
    { id: "crate-badge-pumpkin", type: "badge", badgeId: "Pumpkin", name: "Pumpkin", rarity: "common", blurb: "Unlock the Pumpkin badge from the halloween crate." },
    { id: "crate-pfp-bamboo", type: "pfp", name: "Bamboo Shark", imagePath: "images/cratePfp/HalloweenPfp/Shark2.png", rarity: "rare", blurb: "Unlock the Bamboo Shark profile picture." },
    { id: "crate-badge-bat", type: "badge", badgeId: "Bat", name: "Bat", rarity: "rare", blurb: "Unlock the Bat badge from the halloween crate." },
    { id: "crate-theme-pumpkin-patch", type: "theme", themeId: "pumpkin-patch", name: "Goo", rarity: "rare", blurb: "Unlock the Goo profile theme." },
    { id: "crate-pfp-white", type: "pfp", name: "White Shark", imagePath: "images/cratePfp/HalloweenPfp/Shark3.png", rarity: "epic", blurb: "Unlock the White Shark profile picture." },
    { id: "crate-badge-ghost", type: "badge", badgeId: "Ghost", name: "Ghost", rarity: "epic", blurb: "Unlock the Ghost badge from the halloween crate." },
    { id: "crate-theme-haunted-abyss", type: "theme", themeId: "haunted-abyss", name: "Witchlight", rarity: "epic", blurb: "Unlock the Witchlight profile theme." },
    { id: "crate-pfp-cookie", type: "pfp", name: "Cookie Cutter Shark", imagePath: "images/cratePfp/HalloweenPfp/Shark4.png", rarity: "legendary", blurb: "Unlock the Cookie Cutter Shark profile picture." },
    { id: "crate-badge-vampire", type: "badge", badgeId: "Vampire", name: "Vampire", rarity: "legendary", blurb: "Unlock the Vampire badge from the halloween crate." },
    { id: "crate-theme-nightmare-reef", type: "theme", themeId: "nightmare-reef", name: "Phantom Fog", rarity: "legendary", blurb: "Unlock the Phantom Fog profile theme." }
];

let crateOpeningInProgress = false;
let pendingProfileSyncTimeout = null;
let pendingAuthStateClearTimeout = null;
let globalXpEventOverride = null;
let globalXpEventUnsubscribe = null;
let globalIndexThemeUnsubscribe = null;
let communityBossUnsubscribe = null;
let communityBossState = null;
let communityBossUiTimer = null;
let cloudProfileReloadTimeouts = [];
let lastServerHydratedProfileUid = null;
const CLOUD_PROFILE_RELOAD_DELAYS_MS = [1200, 4000, 9000];
const FULL_PROFILE_COLLECTION = "sharkdleProfiles";
const FULL_PROFILE_CHUNK_COLLECTION = "chunks";
const FULL_PROFILE_SCHEMA_VERSION = 1;
const FULL_PROFILE_CHUNK_CHAR_LIMIT = 180000;

const sharkPassRewards = [
    { level: 2, type: "pfp", name: "Zebra Bullhead Shark", imagePath: "images/SharkPass2/ZebraBullheadShark.png", rarity: "common", blurb: "A fresh Shark Pass 2 portrait for early progress." },
    { level: 3, type: "badge", name: "Bullhead Bloom", badgeId: "bullhead-bloom", rarity: "common", blurb: "Your first new Shark Pass 2 badge unlock." },
    { level: 4, type: "pfp", name: "Brown Stingray", imagePath: "images/SharkPass2/BrownStingray.png", rarity: "common", blurb: "A distinct Pass 2 reef-side profile picture." },
    { level: 5, type: "badge", name: "Ray Drift", badgeId: "ray-drift", rarity: "common", blurb: "A calm Pass 2 badge for steady progress." },
    { level: 6, type: "pfp", name: "Common Guitarfish", imagePath: "images/SharkPass2/CommonGuitarfish.png", rarity: "rare", blurb: "A sleeker Pass 2 PFP for your collection." },
    { level: 7, type: "theme", name: "Reef Signal", themeId: "reef-signal", rarity: "rare", blurb: "Unlock a new Pass 2 profile card theme." },
    { level: 8, type: "pfp", name: "Bottlenose Wedgefish", imagePath: "images/SharkPass2/BottlenoseWedgeFish.png", rarity: "rare", blurb: "One of the standout Shark Pass 2 portraits." },
    { level: 8, type: "badge", name: "Guitarfish Glide", badgeId: "guitarfish-glide", rarity: "rare", blurb: "A Pass 2 badge for smooth deeper runs." },
    { level: 10, type: "pfp", name: "Rusty Carpet Shark", imagePath: "images/SharkPass2/RustyCarpetShark.png", rarity: "epic", blurb: "A Pass 2 milestone portrait with more weight to it." },
    { level: 10, type: "badge", name: "Carpet Shadow", badgeId: "carpet-shadow", rarity: "epic", blurb: "A standout Pass 2 badge for committed players." },
    { level: 12, type: "pfp", name: "Coffin Ray", imagePath: "images/SharkPass2/CoffinRay.png", rarity: "epic", blurb: "A deep-cut Pass 2 profile reward." },
    { level: 12, type: "badge", name: "Coffin Depths", badgeId: "coffin-depths", rarity: "epic", blurb: "A strong mid-pass badge unlock from the new season." },
    { level: 15, type: "pfp", name: "Copper Shark", imagePath: "images/SharkPass2/CopperShark.png", rarity: "epic", blurb: "A premium-feeling Pass 2 portrait without premium nonsense." },
    { level: 15, type: "theme", name: "Copper Surge", themeId: "copper-surge", rarity: "legendary", blurb: "A warmer Pass 2 profile treatment." },
    { level: 18, type: "pfp", name: "Australian Bull Ray", imagePath: "images/SharkPass2/AustralianBullRay.png", rarity: "legendary", blurb: "A late-pass ray portrait for serious XP runs." },
    { level: 18, type: "badge", name: "Copper Current", badgeId: "copper-current", rarity: "legendary", blurb: "For players who stuck with the new Pass 2 grind." },
    { level: 20, type: "pfp", name: "Galapagos Shark", imagePath: "images/SharkPass2/GalapagosShark.png", rarity: "legendary", blurb: "A Shark Pass 2 capstone portrait." },
    { level: 20, type: "badge", name: "Bull Ray Banner", badgeId: "bull-ray-banner", rarity: "legendary", blurb: "A high-tier Pass 2 badge." },
    { level: 22, type: "pfp", name: "Bluntnose Sixgill Shark", imagePath: "images/SharkPass2/BluntNoseSixGillShark.png", rarity: "legendary", blurb: "A bonus Pass 2 portrait for pushing past the old track." },
    { level: 22, type: "badge", name: "Galapagos Guard", badgeId: "galapagos-guard", rarity: "epic", blurb: "A seasonal Shark Pass 2 badge for pushing past the old track." },
    { level: 24, type: "theme", name: "Raylight Drift", themeId: "raylight-drift", rarity: "epic", blurb: "A bright profile card theme from the active season." },
    { level: 26, type: "badge", name: "Sixgill Sovereign", badgeId: "sixgill-sovereign", rarity: "legendary", blurb: "A late-season Pass 2 badge for serious XP runs." },
    { level: 28, type: "crate", name: "Shark Pass 2 Crate", crateId: "seasonal", crateCount: 1, rarity: "legendary", blurb: "A bonus Shark Pass 2 event crate milestone." },
    { level: 30, type: "theme", name: "Sixgill Night", themeId: "sixgill-night", rarity: "legendary", blurb: "The season capstone profile theme." }
];

const SHARK_PASS_ACTIVE_SEASON_ID = "shark-pass-2-2026";

const sharkPassSeasons = [
    {
        id: SHARK_PASS_ACTIVE_SEASON_ID,
        name: "Shark Pass 2",
        subtitle: "Reef Rush",
        startsAt: "2026-09-01T00:00:00Z",
        endsAt: "2026-12-31T23:59:59Z",
        theme: "Shark Pass 2",
        dailyQuests: [
            { id: "daily-first-fin", title: "First Fin", description: "Play 1 Sharkdle game today.", metric: "gamesPlayed", goal: 1, xp: 180, icon: "fa-gamepad" },
            { id: "daily-clean-catch", title: "Clean Catch", description: "Win 1 daily game today.", metric: "dailyWins", goal: 1, xp: 260, icon: "fa-calendar-check", progressMode: "absolute" },
            { id: "daily-xp-splash", title: "XP Splash", description: "Earn 500 XP today.", metric: "totalXP", goal: 500, xp: 320, icon: "fa-bolt" }
        ],
        weeklyQuests: [
            { id: "weekly-patrol", title: "Weekly Patrol", description: "Play 10 games this week.", metric: "gamesPlayed", goal: 10, xp: 1000, icon: "fa-compass" },
            { id: "weekly-win-current", title: "Win Current", description: "Win 5 games this week.", metric: "wins", goal: 5, xp: 1400, icon: "fa-trophy" },
            { id: "weekly-research-surge", title: "Research Surge", description: "Earn 3,500 XP this week.", metric: "totalXP", goal: 3500, xp: 1800, icon: "fa-book-open" }
        ],
        seasonQuests: [
            { id: "season-first-current", title: "First Current", description: "Play 3 games this season.", metric: "gamesPlayed", goal: 3, xp: 450, icon: "fa-gamepad" },
            { id: "season-reef-wins", title: "Reef Wins", description: "Win 5 games this season.", metric: "wins", goal: 5, xp: 900, icon: "fa-trophy" },
            { id: "season-daily-scout", title: "Daily Scout", description: "Win 2 daily games during the season.", metric: "dailyWins", goal: 2, xp: 700, icon: "fa-calendar-check", progressMode: "absolute" },
            { id: "season-streak-signal", title: "Streak Signal", description: "Reach a 3 win streak.", metric: "highestStreak", goal: 3, xp: 850, icon: "fa-fire", progressMode: "absolute" },
            { id: "season-deep-research", title: "Deep Research", description: "Earn 7,500 XP this season.", metric: "totalXP", goal: 7500, xp: 1200, icon: "fa-book-open" },
            { id: "season-crate-current", title: "Crate Current", description: "Open 2 cosmetic crates this season.", metric: "cratesOpened", goal: 2, xp: 1000, icon: "fa-box-open" },
            { id: "season-shiver-run", title: "Shiver Run", description: "Play 20 games this season.", metric: "gamesPlayed", goal: 20, xp: 1800, icon: "fa-water" },
            { id: "season-apex-hunt", title: "Apex Hunt", description: "Win 15 games this season.", metric: "wins", goal: 15, xp: 2400, icon: "fa-crown" },
            { id: "season-treasure-tide", title: "Treasure Tide", description: "Open 5 cosmetic crates this season.", metric: "cratesOpened", goal: 5, xp: 2100, icon: "fa-box-open" },
            { id: "season-master-current", title: "Master Current", description: "Earn 25,000 XP this season.", metric: "totalXP", goal: 25000, xp: 4200, icon: "fa-star" }
        ]
    }
];

const sharkPassBadgeMeta = {
    "bullhead-bloom": { emoji: "\u{1F33F}" },
    "ray-drift": { emoji: "\u{1F300}" },
    "guitarfish-glide": { emoji: "\u{1F3B8}" },
    "carpet-shadow": { emoji: "\u{1F311}" },
    "coffin-depths": { emoji: "\u{1F578}\uFE0F" },
    "copper-current": { emoji: "\u{26A1}" },
    "bull-ray-banner": { emoji: "\u{1F6A9}" },
    "galapagos-guard": { emoji: "\u{1F5FF}" },
    "sixgill-sovereign": { emoji: "\u{1F451}" },
    "tide-glass": { emoji: "\u{1FAE7}" },
    "fossil-tooth": { emoji: "\u{1F9B7}" },
    "deep-anchor": { emoji: "\u{2693}" },
    "royal-pearl": { emoji: "\u{1F9AA}" },
    "Tidepool": { emoji: "\u{1F300}" },
    "Ice Cream": { emoji: "\u{1F366}" },
    "Horizon": { emoji: "\u{1F305}" },
    "Summer": { emoji: "\u{1F334}" },
    "Christmas": { emoji: "\u{1F384}" },
    "Present": { emoji: "\u{1F381}" },
    "Snowflake": { emoji: "\u{2744}\uFE0F" },
    "Santa": { emoji: "\u{1F385}" },
};

const badgeRarityMeta = {
    core: { label: "Core", className: "core" },
    code: { label: "Code", className: "code" },
    special: { label: "Special", className: "special" },
    event: { label: "Event", className: "event" },
    common: { label: "Common", className: "common" },
    rare: { label: "Rare", className: "rare" },
    epic: { label: "Epic", className: "epic" },
    legendary: { label: "Legendary", className: "legendary" }
};

const sharkPassBadgeTiers = {
    "bullhead-bloom": 1,
    "ray-drift": 1,
    "guitarfish-glide": 2,
    "carpet-shadow": 3,
    "coffin-depths": 3,
    "copper-current": 4,
    "bull-ray-banner": 5,
    "galapagos-guard": 4,
    "sixgill-sovereign": 5,
    "tide-glass": 1,
    "fossil-tooth": 2,
    "deep-anchor": 4,
    "royal-pearl": 5
};

Object.assign(sharkPassBadgeMeta, {
    "bullhead-bloom": { emoji: "\u{1F33F}" },
    "ray-drift": { emoji: "\u{1F300}" },
    "guitarfish-glide": { emoji: "\u{1F3B8}" },
    "carpet-shadow": { emoji: "\u{1F311}" },
    "coffin-depths": { emoji: "\u{1F578}\uFE0F" },
    "copper-current": { emoji: "\u{26A1}" },
    "bull-ray-banner": { emoji: "\u{1F6A9}" },
    "galapagos-guard": { emoji: "\u{1F5FF}" },
    "sixgill-sovereign": { emoji: "\u{1F451}" },
    "tide-glass": { emoji: "\u{1FAE7}" },
    "fossil-tooth": { emoji: "\u{1F9B7}" },
    "deep-anchor": { emoji: "\u{2693}" },
    "royal-pearl": { emoji: "\u{1F9AA}" },
    "Beachball": { emoji: "\u{1F3D6}\uFE0F" },
    "SunHat": { emoji: "\u{1F452}" },
    "Pineapple": { emoji: "\u{1F34D}" },
    "Coconut": { emoji: "\u{1F965}" }
});

function getCurrentProfileData() {
    if (typeof getBestLocalProfile === "function") {
        return getBestLocalProfile();
    }
    return JSON.parse(localStorage.getItem("userProfile") || "{}");
}

window.getCurrentProfileData = getCurrentProfileData;

function getCurrentPlayerLevel(profileData = getCurrentProfileData()) {
    const passXP = getSharkPassXP(profileData);
    return passXP <= 0 ? 0 : getLevelFromXP(passXP);
}

function getActiveSharkPassSeasonId() {
    return getActiveSharkPassSeason()?.id || SHARK_PASS_ACTIVE_SEASON_ID;
}

function isProfileOnActiveSharkPassSeason(profileData = {}, seasonId = getActiveSharkPassSeasonId()) {
    const progressSeasonId = profileData.sharkPassProgressSeasonId || profileData.sharkPassSeasonId;
    return Boolean(seasonId && progressSeasonId === seasonId);
}

function normalizeSharkPassProgressForActiveSeason(profileData = getCurrentProfileData(), season = getActiveSharkPassSeason()) {
    if (!profileData || typeof profileData !== "object" || !season?.id) return false;
    if (isProfileOnActiveSharkPassSeason(profileData, season.id)) {
        profileData.sharkPassProgressSeasonId = season.id;
        profileData.sharkPassSeasonId = season.id;
        profileData.sharkPassXP = Math.max(0, Number(profileData.sharkPassXP) || 0);
        return false;
    }
    profileData.sharkPassProgressSeasonId = season.id;
    profileData.sharkPassSeasonId = season.id;
    profileData.sharkPassXP = 0;
    profileData.sharkPassLevelRewardClaims = [];
    return true;
}

function getSharkPassXP(profileData = getCurrentProfileData(), season = getActiveSharkPassSeason()) {
    if (!season?.id || profileData.sharkPassProgressSeasonId !== season.id) return 0;
    return Math.max(0, Number(profileData.sharkPassXP) || 0);
}

function applySharkPassXpGain(profileData = getCurrentProfileData(), xpAmount = 0, season = getActiveSharkPassSeason()) {
    if (!profileData || typeof profileData !== "object" || !season?.id) {
        return { profileData, xpGain: 0, seasonId: season?.id || SHARK_PASS_ACTIVE_SEASON_ID };
    }
    const xpGain = Math.max(0, Math.floor(Number(xpAmount) || 0));
    if (xpGain <= 0) {
        profileData.sharkPassProgressSeasonId = profileData.sharkPassProgressSeasonId || season.id;
        profileData.sharkPassSeasonId = profileData.sharkPassSeasonId || season.id;
        profileData.sharkPassXP = Math.max(0, Number(profileData.sharkPassXP) || 0);
        return { profileData, xpGain: 0, seasonId: season.id, sharkPassXP: profileData.sharkPassXP };
    }

    ensureSharkPassSeasonBaseline(profileData, season);
    profileData.sharkPassProgressSeasonId = season.id;
    profileData.sharkPassSeasonId = season.id;
    profileData.sharkPassXP = getSharkPassXP(profileData, season) + xpGain;
    return { profileData, xpGain, seasonId: season.id, sharkPassXP: profileData.sharkPassXP };
}

function getSharkPassSyncPayload(profileData = getCurrentProfileData()) {
    const activeSeason = getActiveSharkPassSeason();
    if (activeSeason?.id) {
        normalizeSharkPassProgressForActiveSeason(profileData, activeSeason);
    }
    const seasonId = activeSeason?.id || SHARK_PASS_ACTIVE_SEASON_ID;
    return {
        sharkPassXP: Math.max(0, Number(profileData.sharkPassXP) || 0),
        sharkPassProgressSeasonId: seasonId,
        sharkPassSeasonId: profileData.sharkPassSeasonId || seasonId,
        sharkPassSeasonBaselines: profileData.sharkPassSeasonBaselines && typeof profileData.sharkPassSeasonBaselines === "object"
            ? profileData.sharkPassSeasonBaselines
            : {},
        sharkPassLevelRewardClaims: Array.isArray(profileData.sharkPassLevelRewardClaims)
            ? profileData.sharkPassLevelRewardClaims
            : []
    };
}

function buildSharkPassXpGrantPayload(sourceProfile = {}, xpAmount = 0, season = getActiveSharkPassSeason()) {
    const seasonId = season?.id || SHARK_PASS_ACTIVE_SEASON_ID;
    const xpGain = Math.max(0, Math.floor(Number(xpAmount) || 0));
    const sourceSeasonId = sourceProfile.sharkPassProgressSeasonId || sourceProfile.sharkPassSeasonId;
    const currentPassXP = sourceSeasonId === seasonId ? Math.max(0, Number(sourceProfile.sharkPassXP) || 0) : 0;
    return {
        sharkPassXP: currentPassXP + xpGain,
        sharkPassProgressSeasonId: seasonId,
        sharkPassSeasonId: seasonId
    };
}

window.applySharkPassXpGain = applySharkPassXpGain;
window.getSharkPassSyncPayload = getSharkPassSyncPayload;

function getSharkPassXPInCurrentLevel(profileData = getCurrentProfileData()) {
    const passXP = getSharkPassXP(profileData);
    const level = getCurrentPlayerLevel(profileData);
    return level <= 0 ? passXP : getXPInCurrentLevel(passXP);
}

function getUnlockedPassRewards(profileData = getCurrentProfileData()) {
    const level = getCurrentPlayerLevel(profileData);
    return sharkPassRewards.filter(reward => level >= reward.level);
}

function getCurrentPassRewardUnlocks(profileData = getCurrentProfileData()) {
    const level = getCurrentPlayerLevel(profileData);
    return {
        pfpPaths: new Set(sharkPassRewards
            .filter(reward => reward.type === "pfp" && reward.level <= level)
            .map(reward => String(reward.imagePath || "").replace(/\\/g, "/").toLowerCase())),
        badgeIds: new Set(sharkPassRewards
            .filter(reward => reward.type === "badge" && reward.level <= level)
            .map(reward => reward.badgeId)),
        themeIds: new Set(sharkPassRewards
            .filter(reward => reward.type === "theme" && reward.level <= level)
            .map(reward => reward.themeId))
    };
}

function isCurrentPassPfpPath(path) {
    const normalized = String(path || "").replace(/\\/g, "/").toLowerCase();
    return sharkPassRewards.some(reward => reward.type === "pfp" && String(reward.imagePath || "").replace(/\\/g, "/").toLowerCase() === normalized);
}

function isCurrentPassBadgeId(badgeId) {
    return sharkPassRewards.some(reward => reward.type === "badge" && reward.badgeId === badgeId);
}

function isCurrentPassThemeId(themeId) {
    return sharkPassRewards.some(reward => reward.type === "theme" && reward.themeId === themeId);
}

function sanitizeCurrentSharkPassUnlocks(profileData = getCurrentProfileData()) {
    if (!profileData || typeof profileData !== "object") return { profileData, changed: false };
    const unlocks = getCurrentPassRewardUnlocks(profileData);
    let changed = false;

    if (Array.isArray(profileData.earnedCosmetics)) {
        const filtered = profileData.earnedCosmetics.filter(cosmetic => {
            const path = String(cosmetic?.imagePath || "").replace(/\\/g, "/").toLowerCase();
            return !isCurrentPassPfpPath(path) || unlocks.pfpPaths.has(path);
        });
        changed = changed || filtered.length !== profileData.earnedCosmetics.length;
        profileData.earnedCosmetics = filtered;
    }

    if (Array.isArray(profileData.unlockedBadges)) {
        const filtered = profileData.unlockedBadges.filter(badgeId => !isCurrentPassBadgeId(badgeId) || unlocks.badgeIds.has(badgeId));
        changed = changed || filtered.length !== profileData.unlockedBadges.length;
        profileData.unlockedBadges = filtered.length ? filtered : ["starter"];
    }

    if (Array.isArray(profileData.unlockedCardThemes)) {
        const filtered = profileData.unlockedCardThemes.filter(themeId => !isCurrentPassThemeId(themeId) || unlocks.themeIds.has(themeId));
        changed = changed || filtered.length !== profileData.unlockedCardThemes.length;
        profileData.unlockedCardThemes = filtered.includes("default") ? filtered : ["default", ...filtered];
    }

    if (profileData.equippedBadge && isCurrentPassBadgeId(profileData.equippedBadge) && !unlocks.badgeIds.has(profileData.equippedBadge)) {
        profileData.equippedBadge = "starter";
        changed = true;
    }
    if (profileData.equippedCardTheme && isCurrentPassThemeId(profileData.equippedCardTheme) && !unlocks.themeIds.has(profileData.equippedCardTheme)) {
        profileData.equippedCardTheme = "default";
        changed = true;
    }
    if (isCurrentPassPfpPath(profileData.profilePicture || profileData.profilePic) && !unlocks.pfpPaths.has(String(profileData.profilePicture || profileData.profilePic || "").replace(/\\/g, "/").toLowerCase())) {
        profileData.profilePicture = "images/pfp/shark1.png";
        profileData.profilePic = "images/pfp/shark1.png";
        changed = true;
    }

    return { profileData, changed };
}

function getActiveSharkPassSeason(now = Date.now()) {
    return sharkPassSeasons.find(season => {
        const startMs = Date.parse(season.startsAt);
        const endMs = Date.parse(season.endsAt);
        return Number.isFinite(startMs) && Number.isFinite(endMs) && now >= startMs && now <= endMs;
    }) || sharkPassSeasons[0];
}

function getSharkPassMissionClaims(profileData = getCurrentProfileData(), seasonId = getActiveSharkPassSeason()?.id) {
    const seasonClaims = profileData.sharkPassMissionClaims;
    if (!seasonClaims || typeof seasonClaims !== "object" || !seasonId) return [];
    return Array.isArray(seasonClaims[seasonId]) ? seasonClaims[seasonId] : [];
}

function getSharkPassWeeklyKey(now = Date.now()) {
    const date = new Date(now);
    const utcDay = date.getUTCDay() || 7;
    date.setUTCDate(date.getUTCDate() + 4 - utcDay);
    const yearStart = new Date(Date.UTC(date.getUTCFullYear(), 0, 1));
    const week = Math.ceil((((date - yearStart) / 86400000) + 1) / 7);
    return `${date.getUTCFullYear()}-W${String(week).padStart(2, "0")}`;
}

function getSharkPassQuestPeriodKey(group, season = getActiveSharkPassSeason(), now = Date.now()) {
    if (group === "daily") {
        return typeof getUtcDateKey === "function" ? getUtcDateKey() : new Date(now).toISOString().slice(0, 10);
    }
    if (group === "weekly") {
        return getSharkPassWeeklyKey(now);
    }
    return season?.id || SHARK_PASS_ACTIVE_SEASON_ID;
}

function getSharkPassQuestGroups(season = getActiveSharkPassSeason()) {
    return [
        {
            id: "daily",
            label: "Daily",
            cadence: "Resets daily",
            quests: Array.isArray(season.dailyQuests) ? season.dailyQuests : []
        },
        {
            id: "weekly",
            label: "Weekly",
            cadence: "Resets weekly",
            quests: Array.isArray(season.weeklyQuests) ? season.weeklyQuests : []
        },
        {
            id: "season",
            label: "Season",
            cadence: "Runs all season",
            quests: Array.isArray(season.seasonQuests) ? season.seasonQuests : (Array.isArray(season.missions) ? season.missions : [])
        }
    ];
}

function getSharkPassQuestClaimKey(quest) {
    return `${quest.group}:${quest.periodKey}:${quest.id}`;
}

function getSharkPassSeasonQuestList(season = getActiveSharkPassSeason()) {
    return getSharkPassQuestGroups(season).flatMap(group => {
        const periodKey = getSharkPassQuestPeriodKey(group.id, season);
        return group.quests.map(quest => ({
            ...quest,
            group: group.id,
            groupLabel: group.label,
            cadence: group.cadence,
            periodKey
        }));
    });
}

function ensureSharkPassSeasonBaseline(profileData = getCurrentProfileData(), season = getActiveSharkPassSeason()) {
    if (!season?.id) return {};
    const baselines = profileData.sharkPassSeasonBaselines && typeof profileData.sharkPassSeasonBaselines === "object"
        ? { ...profileData.sharkPassSeasonBaselines }
        : {};
    const quests = getSharkPassSeasonQuestList(season);
    let changed = false;

    // Each season has independent pass XP. This reset preserves account XP while starting the new track at level 0.
    if (profileData.sharkPassProgressSeasonId !== season.id) {
        profileData.sharkPassProgressSeasonId = season.id;
        profileData.sharkPassXP = 0;
        profileData.sharkPassLevelRewardClaims = [];
        changed = true;
    }

    quests.forEach(quest => {
        if (quest.progressMode === "absolute") return;
        const baselineKey = `${quest.group}:${quest.periodKey}`;
        if (!baselines[baselineKey] || typeof baselines[baselineKey] !== "object") {
            baselines[baselineKey] = {};
        }
        if (baselines[baselineKey][quest.metric] === undefined) {
            baselines[baselineKey][quest.metric] = Number(profileData?.[quest.metric]) || 0;
            changed = true;
        }
    });

    if (changed) {
        profileData.sharkPassSeasonBaselines = baselines;
        profileData.sharkPassSeasonId = season.id;
        saveUserProfileLocally(profileData);
    }

    return baselines;
}

function getSharkPassMissionProgress(profileData, mission) {
    if (!mission) return 0;
    const season = getActiveSharkPassSeason();
    const baseline = mission.progressMode === "absolute"
        ? 0
        : Number(ensureSharkPassSeasonBaseline(profileData, season)?.[`${mission.group}:${mission.periodKey}`]?.[mission.metric]) || 0;
    const value = Math.max(0, (Number(profileData?.[mission.metric]) || 0) - baseline);
    return Math.max(0, Math.min(value, mission.goal));
}

function getSharkPassSeasonState(profileData = getCurrentProfileData()) {
    const season = getActiveSharkPassSeason();
    const claimedMissionIds = getSharkPassMissionClaims(profileData, season.id);
    const missions = getSharkPassSeasonQuestList(season).map(mission => {
        const progress = getSharkPassMissionProgress(profileData, mission);
        const claimKey = getSharkPassQuestClaimKey(mission);
        return {
            ...mission,
            claimKey,
            progress,
            complete: progress >= mission.goal,
            claimed: claimedMissionIds.includes(claimKey) || claimedMissionIds.includes(mission.id)
        };
    });
    const groups = getSharkPassQuestGroups(season).map(group => {
        const groupMissions = missions.filter(mission => mission.group === group.id);
        return {
            ...group,
            periodKey: getSharkPassQuestPeriodKey(group.id, season),
            missions: groupMissions,
            completedCount: groupMissions.filter(mission => mission.complete).length,
            claimedCount: groupMissions.filter(mission => mission.claimed).length,
            claimableXp: groupMissions
                .filter(mission => mission.complete && !mission.claimed)
                .reduce((sum, mission) => sum + (Number(mission.xp) || 0), 0)
        };
    });
    return {
        season,
        missions,
        groups,
        claimedMissionIds,
        completedCount: missions.filter(mission => mission.complete).length,
        claimedCount: missions.filter(mission => mission.claimed).length,
        totalMissionXp: missions.reduce((sum, mission) => sum + (Number(mission.xp) || 0), 0),
        claimableXp: missions
            .filter(mission => mission.complete && !mission.claimed)
            .reduce((sum, mission) => sum + (Number(mission.xp) || 0), 0)
    };
}

async function claimSharkPassMission(missionId) {
    const profileData = getCurrentProfileData();
    const passState = getSharkPassSeasonState(profileData);
    const mission = passState.missions.find(item => item.id === missionId || item.claimKey === missionId);

    if (!mission) {
        showNotification("Quest not found for this season.", "error", 3000);
        return false;
    }
    if (!mission.complete) {
        showNotification("Finish the quest first, then claim the XP.", "info", 3000);
        return false;
    }
    if (mission.claimed) {
        showNotification("You already claimed this quest.", "info", 3000);
        return false;
    }

    const seasonId = passState.season.id;
    const claims = profileData.sharkPassMissionClaims && typeof profileData.sharkPassMissionClaims === "object"
        ? { ...profileData.sharkPassMissionClaims }
        : {};
    const seasonClaims = Array.isArray(claims[seasonId]) ? [...claims[seasonId]] : [];
    seasonClaims.push(mission.claimKey || getSharkPassQuestClaimKey(mission));
    claims[seasonId] = [...new Set(seasonClaims)];

    const xpAward = typeof window.applyLimitedTimeXpBonus === "function"
        ? window.applyLimitedTimeXpBonus(mission.xp)
        : { totalXp: mission.xp, multiplier: 1, baseXp: mission.xp };

    profileData.totalXP = (Number(profileData.totalXP) || 0) + xpAward.totalXp;
    applySharkPassXpGain(profileData, xpAward.totalXp, passState.season);
    profileData.sharkPassMissionClaims = claims;
    saveUserProfileLocally(profileData, { skipRemoteSync: true });

    if (currentUser && db) {
        await db.collection("userStats").doc(currentUser.uid).set({
            totalXP: profileData.totalXP,
            ...getSharkPassSyncPayload(profileData),
            sharkPassMissionClaims: claims,
            lastUpdated: Date.now()
        }, { merge: true });
    }

    await syncSharkPassLevelRewards(profileData);

    if (typeof syncEarnedCosmetics === "function" && currentUser) {
        syncEarnedCosmetics().catch(error => console.warn("Unable to sync Shark Pass rewards after mission claim:", error));
    }
    updateProfileDisplay(profileData);
    showNotification(`Quest claimed: +${xpAward.totalXp} XP${xpAward.multiplier > 1 ? ` (${xpAward.multiplier}x)` : ""}`, "success", 3600);
    return true;
}

window.getActiveSharkPassSeason = getActiveSharkPassSeason;
window.getSharkPassSeasonState = getSharkPassSeasonState;
window.claimSharkPassMission = claimSharkPassMission;

async function syncSharkPassLevelRewards(profileData = getCurrentProfileData()) {
    const playerLevel = getCurrentPlayerLevel(profileData);
    const claimableLevelRewards = sharkPassRewards.filter(reward =>
        reward.type === "crate" &&
        reward.level <= playerLevel &&
        (reward.crateId !== "seasonal" || Boolean(getActiveSeasonalCrateId()))
    );
    if (!claimableLevelRewards.length) return { changed: false, profileData };

    const claimedRewards = Array.isArray(profileData.sharkPassLevelRewardClaims)
        ? [...profileData.sharkPassLevelRewardClaims]
        : [];
    let changed = false;
    const inventory = getCrateInventory(profileData);

    claimableLevelRewards.forEach(reward => {
        const rewardClaimId = `${reward.level}:${reward.type}:${reward.crateId || reward.name}`;
        const legacySeasonalClaimIds = reward.crateId === "seasonal"
            ? SEASONAL_CRATE_IDS.map(crateId => `${reward.level}:${reward.type}:${crateId}`)
            : [];
        if (claimedRewards.includes(rewardClaimId) || legacySeasonalClaimIds.some(id => claimedRewards.includes(id))) return;
        const crateId = reward.crateId === "seasonal" ? getActiveSeasonalCrateId() : (reward.crateId || "reef");
        if (!crateId) return;
        const crateCount = Math.max(1, Number(reward.crateCount) || 1);
        inventory[crateId] = (inventory[crateId] || 0) + crateCount;
        claimedRewards.push(rewardClaimId);
        changed = true;
    });

    if (!changed) return { changed: false, profileData };

    profileData.crateInventory = normalizeCrateInventory(inventory);
    markCrateInventoryChanged(profileData);
    profileData.sharkPassLevelRewardClaims = claimedRewards;
    saveUserProfileLocally(profileData, { skipRemoteSync: true });

    if (currentUser && db) {
        await db.collection("userStats").doc(currentUser.uid).set({
            crateInventory: profileData.crateInventory,
            crateInventoryUpdatedAt: getCrateInventoryUpdatedAt(profileData),
            sharkPassLevelRewardClaims: claimedRewards,
            lastUpdated: Date.now()
        }, { merge: true });
    }

    if (typeof renderCratesButton === "function") {
        renderCratesButton();
    }
    return { changed: true, profileData };
}

window.syncSharkPassLevelRewards = syncSharkPassLevelRewards;

function getClaimedAchievementIds() {
    return JSON.parse(localStorage.getItem("claimedAchievements") || "[]");
}

async function syncUnlockedAchievementToFirebase(achievementId, fallbackUnlockedAchievements = []) {
    if (!currentUser || !db || !achievementId) return;
    try {
        const fieldValue = typeof firebase !== "undefined"
            && firebase.firestore
            && firebase.firestore.FieldValue
            ? firebase.firestore.FieldValue
            : null;
        const payload = fieldValue?.arrayUnion
            ? { unlockedAchievements: fieldValue.arrayUnion(achievementId) }
            : { unlockedAchievements: fallbackUnlockedAchievements };
        await db.collection("userStats").doc(currentUser.uid).set(payload, { merge: true });
    } catch (error) {
        console.warn("Unable to sync achievement unlock:", error);
    }
}

window.syncUnlockedAchievementToFirebase = syncUnlockedAchievementToFirebase;

function getAchievementUnlockedThemeIds(claimedAchievements = getClaimedAchievementIds()) {
    return sharkPassCardThemes
        .filter(theme => theme.unlockAchievement && claimedAchievements.includes(theme.unlockAchievement))
        .map(theme => theme.id);
}

function syncAchievementThemeUnlocks(profileData = getCurrentProfileData()) {
    const claimedAchievements = getClaimedAchievementIds();
    const achievementThemeIds = getAchievementUnlockedThemeIds(claimedAchievements);
    const storedThemeIds = Array.isArray(profileData.unlockedCardThemes) ? profileData.unlockedCardThemes : [];
    const mergedThemeIds = [...new Set(["default", ...storedThemeIds, ...achievementThemeIds])];
    const hadAllThemes = mergedThemeIds.length === storedThemeIds.length
        && mergedThemeIds.every(themeId => storedThemeIds.includes(themeId));

    if (!hadAllThemes) {
        profileData.unlockedCardThemes = mergedThemeIds;
        saveUserProfileLocally(profileData, { skipRemoteSync: true });
    }

    return {
        profileData,
        changed: !hadAllThemes,
        unlockedThemeIds: mergedThemeIds
    };
}

window.syncAchievementThemeUnlocks = syncAchievementThemeUnlocks;

const PROFILE_ACHIEVEMENT_SHOWCASE_LIMIT = 3;
const PROFILE_ACHIEVEMENT_RARITY_RANKS = {
    common: 1,
    rare: 2,
    epic: 3,
    legendary: 4,
    mythic: 5
};
const PROFILE_ACHIEVEMENT_FALLBACK_CATALOG = [
    { id: "perfect_win", name: "One-Shot Oracle", icon: "\u{1F3AF}", rarity: "rare", points: 125, description: "Win in a single guess." },
    { id: "guess_master", name: "Guess Master", icon: "\u{1F9E0}", rarity: "epic", points: 200, description: "Average 3 guesses or fewer." },
    { id: "wins_250", name: "Transcendant Observer", icon: "\u{1F3C6}\u{1F3C6}", rarity: "legendary", points: 400, description: "Win 250 games." },
    { id: "wins_500", name: "Abyssal Legend", icon: "\u{1F30C}", rarity: "mythic", points: 550, description: "Win 500 games." },
    { id: "wins_1000", name: "Eternal Fin", icon: "\u{1F451}", rarity: "mythic", points: 900, description: "Win 1,000 games." },
    { id: "games_500", name: "True Addict", icon: "\u{1F30A}", rarity: "legendary", points: 400, description: "Play 500 games." },
    { id: "games_750", name: "Deep Habit", icon: "\u{1F30A}", rarity: "mythic", points: 520, description: "Play 750 games." },
    { id: "games_1000", name: "Marathon Fin", icon: "\u{1F3C1}", rarity: "mythic", points: 750, description: "Play 1,000 games." },
    { id: "streak_100", name: "Untouchable Tide", icon: "\u{1F525}", rarity: "mythic", points: 800, description: "Reach a 100 win streak." },
    { id: "crate_collector_50", name: "Vault Breaker", icon: "\u{1F4E6}", rarity: "legendary", points: 320, description: "Open 50 cosmetic crates." },
    { id: "japan_master", name: "Japan Mastered", icon: "\u{1F5FE}", rarity: "legendary", points: 260, description: "Complete every Japan story challenge." },
    { id: "friends_25", name: "Social Current", icon: "\u{1F465}", rarity: "legendary", points: 260, description: "Add 25 friends." }
];

function parseProfileIdList(value) {
    if (Array.isArray(value)) return value.filter(Boolean);
    try {
        const parsed = JSON.parse(value || "[]");
        return Array.isArray(parsed) ? parsed.filter(Boolean) : [];
    } catch (error) {
        return [];
    }
}

function mergeProfileIdLists(...lists) {
    return [...new Set(lists.flatMap(list => parseProfileIdList(list)))];
}

function getProfileAchievementCatalog() {
    if (Array.isArray(window.SharkdleAchievementCatalog) && window.SharkdleAchievementCatalog.length) {
        return window.SharkdleAchievementCatalog;
    }
    const cached = parseProfileIdList(localStorage.getItem("achievementCatalogCache"));
    if (cached.length && cached.every(item => item && typeof item === "object")) {
        return cached;
    }
    return PROFILE_ACHIEVEMENT_FALLBACK_CATALOG;
}

function getProfileAchievementMeta(achievementId) {
    return getProfileAchievementCatalog().find(achievement => achievement.id === achievementId) || {
        id: achievementId,
        name: "Achievement",
        icon: "\u{1F3C6}",
        rarity: "common",
        points: 0,
        description: "Claimed achievement"
    };
}

function getProfileClaimedAchievementIds(profileData = {}) {
    return mergeProfileIdLists(
        profileData.claimedAchievements,
        localStorage.getItem("claimedAchievements")
    );
}

function getProfileShowcasedAchievementIds(profileData = {}) {
    const claimed = new Set(getProfileClaimedAchievementIds(profileData));
    return mergeProfileIdLists(
        profileData.showcasedAchievements,
        localStorage.getItem("showcasedAchievements")
    ).filter(achievementId => claimed.has(achievementId)).slice(0, PROFILE_ACHIEVEMENT_SHOWCASE_LIMIT);
}

function getVisibleProfileShowcaseAchievementIds(profileData = {}) {
    const showcased = getProfileShowcasedAchievementIds(profileData);
    if (showcased.length) return showcased;
    return getProfileClaimedAchievementIds(profileData)
        .map(achievementId => getProfileAchievementMeta(achievementId))
        .sort((a, b) => {
            const rarityDiff = (PROFILE_ACHIEVEMENT_RARITY_RANKS[b.rarity] || 0) - (PROFILE_ACHIEVEMENT_RARITY_RANKS[a.rarity] || 0);
            if (rarityDiff !== 0) return rarityDiff;
            return (Number(b.points) || 0) - (Number(a.points) || 0);
        })
        .slice(0, PROFILE_ACHIEVEMENT_SHOWCASE_LIMIT)
        .map(achievement => achievement.id);
}

function setProfileShowcaseAchievement(achievementId, shouldShow = true) {
    const profileData = getCurrentProfileData();
    const claimed = new Set(getProfileClaimedAchievementIds(profileData));
    if (!claimed.has(achievementId)) return getProfileShowcasedAchievementIds(profileData);
    const current = getProfileShowcasedAchievementIds(profileData).filter(id => id !== achievementId);
    const next = shouldShow
        ? [achievementId, ...current].slice(0, PROFILE_ACHIEVEMENT_SHOWCASE_LIMIT)
        : current;
    profileData.showcasedAchievements = next;
    localStorage.setItem("showcasedAchievements", JSON.stringify(next));
    saveUserProfileLocally(profileData);
    if (currentUser && db) {
        db.collection("userStats").doc(currentUser.uid).set({
            showcasedAchievements: next,
            lastUpdated: Date.now()
        }, { merge: true });
    }
    renderProfileAchievementShowcase(profileData);
    return next;
}

function renderProfileAchievementShowcase(profileData = getCurrentProfileData()) {
    const container = document.getElementById("profile-achievement-showcase");
    if (!container) return;
    const achievementIds = getVisibleProfileShowcaseAchievementIds(profileData);
    container.innerHTML = "";
    if (!achievementIds.length) {
        const empty = document.createElement("div");
        empty.className = "profile-achievement-showcase-empty";
        empty.textContent = "Claim achievements to fill this showcase.";
        container.appendChild(empty);
        return;
    }
    achievementIds.forEach(achievementId => {
        const achievement = getProfileAchievementMeta(achievementId);
        const card = document.createElement("article");
        card.className = `profile-achievement-showcase-card rarity-${achievement.rarity || "common"}`;
        const icon = document.createElement("span");
        icon.textContent = achievement.icon || "\u{1F3C6}";
        const copy = document.createElement("div");
        const name = document.createElement("strong");
        name.textContent = achievement.name || "Achievement";
        const meta = document.createElement("small");
        meta.textContent = `${String(achievement.rarity || "common").toUpperCase()} - ${Number(achievement.points) || 0} XP`;
        copy.appendChild(name);
        copy.appendChild(meta);
        card.appendChild(icon);
        card.appendChild(copy);
        container.appendChild(card);
    });
}

window.getProfileShowcasedAchievementIds = getProfileShowcasedAchievementIds;
window.setProfileShowcaseAchievement = setProfileShowcaseAchievement;
window.renderProfileAchievementShowcase = renderProfileAchievementShowcase;

function getUnlockedCardThemes(profileData = getCurrentProfileData()) {
    const normalizedProfile = sanitizeCurrentSharkPassUnlocks(syncAchievementThemeUnlocks(profileData).profileData).profileData;
    const level = getCurrentPlayerLevel(normalizedProfile);
    const currentPassUnlocks = getCurrentPassRewardUnlocks(normalizedProfile);
    const storedThemeIds = (Array.isArray(normalizedProfile.unlockedCardThemes) ? normalizedProfile.unlockedCardThemes : [])
        .filter(themeId => !isCurrentPassThemeId(themeId) || currentPassUnlocks.themeIds.has(themeId));
    const claimedAchievementThemeIds = getAchievementUnlockedThemeIds();

    const unlockedThemeIds = new Set(["default", ...storedThemeIds, ...claimedAchievementThemeIds]);
    sharkPassCardThemes.forEach(theme => {
        if (typeof theme.level === "number" && level >= theme.level) {
            unlockedThemeIds.add(theme.id);
        }
    });

    return sharkPassCardThemes.filter(theme => unlockedThemeIds.has(theme.id));
}

function getStoredUnlockedBadgeIds(profileData = getCurrentProfileData()) {
    const currentPassUnlocks = getCurrentPassRewardUnlocks(profileData);
    return (Array.isArray(profileData.unlockedBadges) ? profileData.unlockedBadges : [])
        .map(normalizeBadgeId)
        .filter(badgeId => !isCurrentPassBadgeId(badgeId) || currentPassUnlocks.badgeIds.has(badgeId));
}

function normalizeBadgeId(badgeId) {
    return badgeId === "rollin'" ? "rollin" : badgeId;
}

function unlockProfileBadge(source = "game", badgeId = "") {
    const normalizedBadgeId = normalizeBadgeId(badgeId);
    const badge = getBadgeMeta(normalizedBadgeId);
    if (!badge || badge.id === "starter") return false;
    const profileData = getCurrentProfileData();
    const unlockedBadges = new Set(["starter", ...getStoredUnlockedBadgeIds(profileData).map(normalizeBadgeId)]);
    if (unlockedBadges.has(normalizedBadgeId)) return false;
    unlockedBadges.add(normalizedBadgeId);
    profileData.unlockedBadges = [...unlockedBadges];
    profileData.lastBadgeUnlockSource = source;
    saveUserProfileLocally(profileData);
    updateProfileBadgeUI?.();
    renderBadgeSelection?.();
    renderProfileInventoryUI?.(profileData);
    showNotification?.(`${badge.name} badge unlocked!`, "success", 4200);
    return true;
}

window.unlockProfileBadge = unlockProfileBadge;

function normalizeCrateInventory(rawInventory) {
    return {
        reef: Math.max(0, Number(rawInventory?.reef) || 0),
        summer: Math.max(0, Number(rawInventory?.summer) || 0),
        christmas: Math.max(0, Number(rawInventory?.christmas) || 0),
        halloween: Math.max(0, Number(rawInventory?.halloween) || 0)
    };
}

function getCrateInventoryUpdatedAt(profileData = {}) {
    return getProfileTimestampMs(profileData?.crateInventoryUpdatedAt);
}

function markCrateInventoryChanged(profileData, timestamp = Date.now()) {
    if (!profileData || typeof profileData !== "object") return normalizeCrateInventory({});
    const previousTimestamp = getCrateInventoryUpdatedAt(profileData);
    const requestedTimestamp = getProfileTimestampMs(timestamp) || Date.now();
    profileData.crateInventory = normalizeCrateInventory(profileData.crateInventory);
    profileData.crateInventoryUpdatedAt = Math.max(requestedTimestamp, previousTimestamp + 1);
    return profileData.crateInventory;
}

function getCrateInventoryFromProfileOrInventory(source) {
    return normalizeCrateInventory(
        source && typeof source === "object" && Object.prototype.hasOwnProperty.call(source, "crateInventory")
            ? source.crateInventory
            : source
    );
}

function applyRetiredCrateRules(inventory, summerCratesRetired = false) {
    const normalized = normalizeCrateInventory(inventory);
    if (summerCratesRetired) normalized.summer = 0;
    return normalized;
}

function mergeCrateInventory(localProfileOrInventory, remoteProfileOrInventory, summerCratesRetired = false, options = {}) {
    const local = getCrateInventoryFromProfileOrInventory(localProfileOrInventory);
    const remote = getCrateInventoryFromProfileOrInventory(remoteProfileOrInventory);
    const localUpdatedAt = getCrateInventoryUpdatedAt(localProfileOrInventory);
    const remoteUpdatedAt = getCrateInventoryUpdatedAt(remoteProfileOrInventory);

    if (localUpdatedAt || remoteUpdatedAt) {
        if (localUpdatedAt > remoteUpdatedAt) return applyRetiredCrateRules(local, summerCratesRetired);
        if (remoteUpdatedAt > localUpdatedAt) return applyRetiredCrateRules(remote, summerCratesRetired);
        return applyRetiredCrateRules(options.preferRemoteOnTie ? remote : local, summerCratesRetired);
    }

    return {
        reef: Math.max(local.reef, remote.reef),
        summer: summerCratesRetired ? 0 : Math.max(local.summer, remote.summer),
        christmas: Math.max(local.christmas, remote.christmas),
        halloween: Math.max(local.halloween, remote.halloween)
    };
}

function retireSummerCrates(profileData) {
    if (!profileData || typeof profileData !== "object") return false;
    if (Number(profileData.summerCrateRetirementVersion) >= SUMMER_CRATE_RETIREMENT_VERSION) return false;

    const inventory = normalizeCrateInventory(profileData.crateInventory);
    const convertedCrates = Math.floor(inventory.summer / 2);
    profileData.crateInventory = {
        ...inventory,
        reef: inventory.reef + convertedCrates,
        summer: 0
    };
    markCrateInventoryChanged(profileData);
    profileData.summerCrateRetirementVersion = SUMMER_CRATE_RETIREMENT_VERSION;
    return true;
}

window.repairRetiredSummerCrateConversion = async function repairRetiredSummerCrateConversion(originalSummerCrates, originalCosmeticCrates = 0) {
    const originalCount = Math.max(0, Math.floor(Number(originalSummerCrates) || 0));
    const originalCosmeticCount = Math.max(0, Math.floor(Number(originalCosmeticCrates) || 0));
    if (!originalCount) {
        showNotification("Enter the original Summer Crate balance to repair this conversion.", "error", 3600);
        return false;
    }

    const profileData = getCurrentProfileData();
    const inventory = normalizeCrateInventory(profileData.crateInventory);
    inventory.reef = originalCosmeticCount + Math.floor(originalCount / 2);
    inventory.summer = 0;
    profileData.crateInventory = inventory;
    markCrateInventoryChanged(profileData);
    profileData.summerCrateRetirementVersion = SUMMER_CRATE_RETIREMENT_VERSION;
    await persistCrateProfileUpdate(profileData);
    renderCratesButton();
    renderHomeCratesModal();
    renderCratesModal();
    showNotification("Summer Crate conversion repaired at the 2:1 rate.", "success", 3600);
    return true;
};

function getCrateInventory(profileData = getCurrentProfileData()) {
    return normalizeCrateInventory(profileData.crateInventory || {});
}

function getStreakShieldCount(profileData = getCurrentProfileData()) {
    return Math.min(3, Math.max(0, Math.floor(Number(profileData?.streakShields) || 0)));
}

const PEARLS_PER_WIN = 50;
const PEARL_BOOST_DURATION_MS = 60 * 60 * 1000;
const PEARL_SHOP_ITEMS = {
    "streak-shield": { price: 250, label: "Streak Shield" },
    "pearl-boost": { price: 500, label: "2x Pearls Boost" },
    "cosmetic-crate": { price: 500, label: "Cosmetic Crate" },
    "event-crate": { price: 750, label: "Event Crate" },
    "message-bottle-pack": { price: 300, label: "Message in a Bottle Pack" },
    "season-xp": { price: 3000, label: "Season 2x XP" }
};
const SOCIAL_REWARD_TASKS = [
    { id: "like-youtube-short-u0lcqvaahog-2026", platform: "YouTube", action: "Like Sharkdle Short 1", description: "Like this YouTube Short.", url: "https://youtube.com/shorts/U0lcQVAAhOg?feature=share", icon: "fa-brands fa-youtube", pearls: 50 },
    { id: "like-youtube-short-ahzzvuritzc-2026", platform: "YouTube", action: "Like Sharkdle Short 2", description: "Like this YouTube Short.", url: "https://youtube.com/shorts/AHZZVuritZc?feature=share", icon: "fa-brands fa-youtube", pearls: 50 },
    { id: "like-youtube-short-q3otnuxy3ri-2026", platform: "YouTube", action: "Like Sharkdle Short 3", description: "Like this YouTube Short.", url: "https://youtube.com/shorts/Q3otnuXy3RI?feature=share", icon: "fa-brands fa-youtube", pearls: 50 },
    { id: "like-youtube-short-srjsmp1bzzu-2026", platform: "YouTube", action: "Like Sharkdle Short 4", description: "Like this YouTube Short.", url: "https://youtube.com/shorts/SrjSmP1bzZU?si=qfL_wUs7Yu4Md3fk", icon: "fa-brands fa-youtube", pearls: 50 },
    { id: "like-youtube-short-bxrl7ezwxak-2026", platform: "YouTube", action: "Like Sharkdle Short 5", description: "Like this YouTube Short.", url: "https://youtube.com/shorts/bxRL7EZWxAk?si=LbA5brefhXfXgSjw", icon: "fa-brands fa-youtube", pearls: 50 },
    { id: "like-youtube-short-fb-zww391fg-2026", platform: "YouTube", action: "Like Sharkdle Short 6", description: "Like this YouTube Short.", url: "https://youtube.com/shorts/fB-Zww391Fg?si=_bX7nVACYMsC0xv5", icon: "fa-brands fa-youtube", pearls: 50 },
    { id: "like-youtube-short-arvtyir0vou-2026", platform: "YouTube", action: "Like Sharkdle Short 7", description: "Like this YouTube Short.", url: "https://youtube.com/shorts/ARvtyir0voU?si=KiUE_Mztlip-cn8o", icon: "fa-brands fa-youtube", pearls: 50 },
    { id: "like-youtube-short-p6ucddpukxe-2026", platform: "YouTube", action: "Like Sharkdle Short 8", description: "Like this YouTube Short.", url: "https://youtube.com/shorts/P6ucDdpUkXE?si=ltYGHtRubzRSMhbR", icon: "fa-brands fa-youtube", pearls: 50 },
    { id: "like-youtube-short-rzk-8eygvui-2026", platform: "YouTube", action: "Like Sharkdle Short 9", description: "Like this YouTube Short.", url: "https://youtube.com/shorts/RZK-8EYGVuI?si=_JQCChSYHgnyzvOj", icon: "fa-brands fa-youtube", pearls: 50 },
    { id: "like-youtube-short-e9pqmdfpykg-2026", platform: "YouTube", action: "Like Sharkdle Short 10", description: "Like this YouTube Short.", url: "https://youtube.com/shorts/e9PqMdFPYkg", icon: "fa-brands fa-youtube", pearls: 50 },
    { id: "like-youtube-short-0lwvkrr4yh4-2026", platform: "YouTube", action: "Like Sharkdle Short 11", description: "Like this YouTube Short.", url: "https://youtube.com/shorts/0LWvkrr4yh4?si=qbKHYCmyw8al2rts", icon: "fa-brands fa-youtube", pearls: 50 },
    { id: "like-youtube-short-tnpq2jwucew-2026", platform: "YouTube", action: "Like Sharkdle Short 12", description: "Like this YouTube Short.", url: "https://youtube.com/shorts/Tnpq2Jwucew?si=RAvm3-Tn5DptzrwB", icon: "fa-brands fa-youtube", pearls: 50 },
    { id: "like-youtube-short-iseecm90zyk-2026", platform: "YouTube", action: "Like Sharkdle Short 13", description: "Like this YouTube Short.", url: "https://youtube.com/shorts/isEecM90ZYk?si=PXmJSfLcV9O_dS0d", icon: "fa-brands fa-youtube", pearls: 50 },
    { id: "like-youtube-short-7ztwn14z3ju-2026", platform: "YouTube", action: "Like Sharkdle Short 14", description: "Like this YouTube Short.", url: "https://youtube.com/shorts/7ZtwN14z3JU?si=qjo-u8aeOFiWMR_t", icon: "fa-brands fa-youtube", pearls: 50 },
    { id: "like-youtube-short-rdmsgzwvxmm-2026", platform: "YouTube", action: "Like Sharkdle Short 15", description: "Like this YouTube Short.", url: "https://youtube.com/shorts/rdMsGzWvxmM?si=H6UOladkD261ARhm", icon: "fa-brands fa-youtube", pearls: 50 },
    { id: "like-youtube-short-uaxgdprxou8-2026", platform: "YouTube", action: "Like Sharkdle Short 16", description: "Like this YouTube Short.", url: "https://youtube.com/shorts/UaxgDPrXOU8?si=Gkfn71KRWygvUJ34", icon: "fa-brands fa-youtube", pearls: 50 },
    { id: "like-instagram-reel-dcofq1zslco-2026", platform: "Instagram", action: "Like Instagram Reel 1", description: "Like this Sharkdle reel.", url: "https://www.instagram.com/reel/DcOFQ1zsLCo/?utm_source=ig_web_copy_link&igsh=MzRlODBiNWFlZA==", icon: "fa-brands fa-instagram", pearls: 50 },
    { id: "like-instagram-reel-dcl5-eamkek-2026", platform: "Instagram", action: "Like Instagram Reel 2", description: "Like this Sharkdle reel.", url: "https://www.instagram.com/reel/DcL5-EAMkeK/?utm_source=ig_web_copy_link&igsh=MzRlODBiNWFlZA==", icon: "fa-brands fa-instagram", pearls: 50 },
    { id: "like-instagram-reel-dcj2adsmgcg-2026", platform: "Instagram", action: "Like Instagram Reel 3", description: "Like this Sharkdle reel.", url: "https://www.instagram.com/reel/DcJ2adSMGcg/?utm_source=ig_web_copy_link&igsh=MzRlODBiNWFlZA==", icon: "fa-brands fa-instagram", pearls: 50 },
    { id: "like-tiktok-video-7675091407878589719-2026", platform: "TikTok", action: "Like TikTok Video 1", description: "Like this Sharkdle TikTok.", url: "https://www.tiktok.com/@c0nn0rrrr/video/7675091407878589719?is_from_webapp=1&sender_device=pc&web_id=7631295855539226135", icon: "fa-brands fa-tiktok", pearls: 50 },
    { id: "like-tiktok-video-7675389328360574230-2026", platform: "TikTok", action: "Like TikTok Video 2", description: "Like this Sharkdle TikTok.", url: "https://www.tiktok.com/@c0nn0rrrr/video/7675389328360574230?is_from_webapp=1&sender_device=pc&web_id=7631295855539226135", icon: "fa-brands fa-tiktok", pearls: 50 },
    { id: "like-tiktok-video-7675704065292111106-2026", platform: "TikTok", action: "Like TikTok Video 3", description: "Like this Sharkdle TikTok.", url: "https://www.tiktok.com/@c0nn0rrrr/video/7675704065292111106?is_from_webapp=1&sender_device=pc&web_id=7631295855539226135", icon: "fa-brands fa-tiktok", pearls: 50 },
    { id: "like-tiktok-video-7654212931978136854-2026", platform: "TikTok", action: "Like TikTok Video 4", description: "Like this Sharkdle TikTok.", url: "https://www.tiktok.com/@c0nn0rrrr/video/7654212931978136854?is_from_webapp=1&sender_device=pc", icon: "fa-brands fa-tiktok", pearls: 50 },
    { id: "like-tiktok-video-7679878803937709334-2026", platform: "TikTok", action: "Like TikTok Video 5", description: "Like this Sharkdle TikTok.", url: "https://www.tiktok.com/@c0nn0rrrr/video/7679878803937709334?is_from_webapp=1&sender_device=pc&web_id=7674943822669989398", icon: "fa-brands fa-tiktok", pearls: 50 },
    { id: "like-tiktok-video-7679244798347267350-2026", platform: "TikTok", action: "Like TikTok Video 6", description: "Like this Sharkdle TikTok.", url: "https://www.tiktok.com/@c0nn0rrrr/video/7679244798347267350?is_from_webapp=1&sender_device=pc&web_id=7674943822669989398", icon: "fa-brands fa-tiktok", pearls: 50 },
    { id: "like-tiktok-video-7678649686810496278-2026", platform: "TikTok", action: "Like TikTok Video 7", description: "Like this Sharkdle TikTok.", url: "https://www.tiktok.com/@c0nn0rrrr/video/7678649686810496278?is_from_webapp=1&sender_device=pc&web_id=7674943822669989398", icon: "fa-brands fa-tiktok", pearls: 50 },
    { id: "like-tiktok-video-7678223759773519107-2026", platform: "TikTok", action: "Like TikTok Video 8", description: "Like this Sharkdle TikTok.", url: "https://www.tiktok.com/@c0nn0rrrr/video/7678223759773519107?is_from_webapp=1&sender_device=pc&web_id=7674943822669989398", icon: "fa-brands fa-tiktok", pearls: 50 },
    { id: "like-tiktok-video-7677723361312640278-2026", platform: "TikTok", action: "Like TikTok Video 9", description: "Like this Sharkdle TikTok.", url: "https://www.tiktok.com/@c0nn0rrrr/video/7677723361312640278?is_from_webapp=1&sender_device=pc&web_id=7674943822669989398", icon: "fa-brands fa-tiktok", pearls: 50 },
    { id: "like-tiktok-video-7677365792861621526-2026", platform: "TikTok", action: "Like TikTok Video 10", description: "Like this Sharkdle TikTok.", url: "https://www.tiktok.com/@c0nn0rrrr/video/7677365792861621526?is_from_webapp=1&sender_device=pc&web_id=7674943822669989398", icon: "fa-brands fa-tiktok", pearls: 50 },
    { id: "like-tiktok-video-7676963669607222530-2026", platform: "TikTok", action: "Like TikTok Video 11", description: "Like this Sharkdle TikTok.", url: "https://www.tiktok.com/@c0nn0rrrr/video/7676963669607222530?is_from_webapp=1&sender_device=pc&web_id=7674943822669989398", icon: "fa-brands fa-tiktok", pearls: 50 },
    { id: "like-tiktok-video-7676513360992832791-2026", platform: "TikTok", action: "Like TikTok Video 12", description: "Like this Sharkdle TikTok.", url: "https://www.tiktok.com/@c0nn0rrrr/video/7676513360992832791?is_from_webapp=1&sender_device=pc&web_id=7674943822669989398", icon: "fa-brands fa-tiktok", pearls: 50 },
    { id: "subscribe-youtube-wheresshark-2026", platform: "YouTube", action: "Subscribe to Connor on YouTube", description: "Subscribe for Sharkdle updates.", url: "https://youtube.com/@wheresshark?si=SQwsJVve_6P0Qj0F", icon: "fa-brands fa-youtube", pearls: 200 },
    { id: "follow-instagram-2026", platform: "Instagram", action: "Follow @sharkdle.dev", description: "Follow the Sharkdle development feed.", url: "https://www.instagram.com/sharkdle.dev/", icon: "fa-brands fa-instagram", pearls: 150 },
    { id: "follow-tiktok-2026", platform: "TikTok", action: "Follow Connor on TikTok", description: "Follow for Sharkdle updates.", url: "https://www.tiktok.com/@c0nn0rrrr?is_from_webapp=1&sender_device=pc", icon: "fa-brands fa-tiktok", pearls: 150 },
    { id: "star-github-repository-2026", platform: "Support", action: "Star the GitHub repo", description: "Star Sharkdle on GitHub to support development.", url: "https://github.com/Noobler28/sharkdle", icon: "fa-brands fa-github", pearls: 125 },
    { id: "join-discord-server-2026", platform: "Support", action: "Join the Discord", description: "Join the Sharkdle Discord community.", url: "https://discord.gg/V97Y8545Ve", icon: "fa-brands fa-discord", pearls: 150 },
    { id: "share-sharkdle-home-2026", platform: "Support", action: "Share Sharkdle", description: "Send Sharkdle to a friend or group chat.", url: "https://sharkdle.online", icon: "fa-solid fa-share-nodes", pearls: 75 },
    { id: "check-updates-page-2026", platform: "Support", action: "Read the updates", description: "Visit the updates page to see what changed.", url: "Updates/index.html", icon: "fa-solid fa-newspaper", pearls: 50 }
];
const SOCIAL_REWARD_GROUPS = [
    { id: "tiktok", label: "TikTok", platform: "TikTok", icon: "fa-brands fa-tiktok", description: "Follow and like Sharkdle TikToks." },
    { id: "instagram", label: "Instagram", platform: "Instagram", icon: "fa-brands fa-instagram", description: "Follow and like Sharkdle reels." },
    { id: "youtube", label: "YouTube", platform: "YouTube", icon: "fa-brands fa-youtube", description: "Subscribe and like Sharkdle Shorts." },
    { id: "support", label: "Support", platform: "Support", icon: "fa-solid fa-hands-holding-heart", description: "Small ways to help Sharkdle grow." }
];

function getPearlCount(profileData = getCurrentProfileData()) {
    return Math.max(0, Math.floor(Number(profileData?.pearls ?? profileData?.tidePearls) || 0));
}

function setPearlCount(profileData, nextAmount) {
    if (!profileData || typeof profileData !== "object") return 0;
    const normalizedAmount = Math.max(0, Math.floor(Number(nextAmount) || 0));
    profileData.pearls = normalizedAmount;
    if (Object.prototype.hasOwnProperty.call(profileData, "tidePearls")) {
        delete profileData.tidePearls;
    }
    return normalizedAmount;
}

function addPearls(amount, profileData = getCurrentProfileData(), options = {}) {
    const nextAmount = setPearlCount(profileData, getPearlCount(profileData) + amount);
    if (!options.deferSave && typeof saveUserProfileLocally === "function") {
        saveUserProfileLocally(profileData);
    }
    if (!options.deferUiUpdate && typeof updateHomeV3Sidebar === "function") {
        updateHomeV3Sidebar(profileData);
    }
    return nextAmount;
}

function getClaimedSocialRewards(profileData = getCurrentProfileData()) {
    return Array.isArray(profileData?.socialRewardsClaimed)
        ? [...new Set(profileData.socialRewardsClaimed.map(id => String(id || "").trim()).filter(Boolean))]
        : [];
}

function setClaimedSocialRewards(profileData, rewardIds = []) {
    if (!profileData || typeof profileData !== "object") return [];
    const claimed = [...new Set((Array.isArray(rewardIds) ? rewardIds : []).map(id => String(id || "").trim()).filter(Boolean))];
    profileData.socialRewardsClaimed = claimed;
    return claimed;
}

function getPearlBoostExpiresAt(profileData = getCurrentProfileData()) {
    return Math.max(0, Number(profileData?.pearlBoostExpiresAt) || 0);
}

function isPearlBoostActive(profileData = getCurrentProfileData(), nowMs = Date.now()) {
    return getPearlBoostExpiresAt(profileData) > nowMs;
}

function getPearlWinMultiplier(profileData = getCurrentProfileData()) {
    return isPearlBoostActive(profileData) ? 2 : 1;
}

function getSeasonXpBoosts(profileData = getCurrentProfileData()) {
    return profileData?.seasonXpBoosts && typeof profileData.seasonXpBoosts === "object"
        ? profileData.seasonXpBoosts
        : {};
}

function hasSeasonXpBoost(profileData = getCurrentProfileData(), seasonId = SHARK_PASS_ACTIVE_SEASON_ID) {
    return Boolean(getSeasonXpBoosts(profileData)[seasonId]);
}

function setSeasonXpBoost(profileData, seasonId = SHARK_PASS_ACTIVE_SEASON_ID) {
    if (!profileData || typeof profileData !== "object") return;
    profileData.seasonXpBoosts = {
        ...getSeasonXpBoosts(profileData),
        [seasonId]: true
    };
    profileData.sharkPassSeasonId = seasonId;
}

function awardPearlsForWin(profileData = getCurrentProfileData(), options = {}) {
    const baseAmount = Math.max(0, Math.floor(Number(options.amount ?? PEARLS_PER_WIN) || 0));
    const amount = baseAmount * getPearlWinMultiplier(profileData);
    if (!amount) return 0;
    addPearls(amount, profileData, options);
    return amount;
}

window.PEARLS_PER_WIN = PEARLS_PER_WIN;
window.getPearlCount = getPearlCount;
window.setPearlCount = setPearlCount;
window.addPearls = addPearls;
window.awardPearlsForWin = awardPearlsForWin;
window.isPearlBoostActive = isPearlBoostActive;
window.hasSeasonXpBoost = hasSeasonXpBoost;

function setStreakShieldCount(profileData, nextCount) {
    if (!profileData || typeof profileData !== "object") return 0;
    const normalizedCount = Math.min(3, Math.max(0, Math.floor(Number(nextCount) || 0)));
    profileData.streakShields = normalizedCount;
    return normalizedCount;
}

function applyStreakShieldOnLoss(profileData, options = {}) {
    if (!profileData || typeof profileData !== "object") return false;
    const currentStreak = Math.max(0, Number(profileData.currentStreak) || 0);
    if (currentStreak <= 0) return false;

    const availableShields = getStreakShieldCount(profileData);
    if (availableShields <= 0) return false;

    const remainingShields = setStreakShieldCount(profileData, availableShields - 1);
    if (!options.silent && typeof showNotification === "function") {
        const modeLabel = options.mode ? ` in ${options.mode}` : "";
        showNotification(`\u{1F6E1}\uFE0F Streak Shield activated${modeLabel}. Streak protected! (${remainingShields} left)`, "success", 4200);
    }
    if (typeof window.unlockAchievement === "function") {
        window.unlockAchievement("streak_shield_used");
    }
    return true;
}

function getCrateInstantOpenEnabled(profileData = getCurrentProfileData()) {
    return Boolean(profileData?.instantCrateOpen);
}

function syncCrateInstantOpenControls(profileData = getCurrentProfileData()) {
    const enabled = getCrateInstantOpenEnabled(profileData);
    ["crate-instant-toggle", "crate-instant-settings-toggle"].forEach(id => {
        const input = document.getElementById(id);
        if (input) input.checked = enabled;
    });
}

function getCratesSinceLegendary(profileData = getCurrentProfileData()) {
    return Math.max(0, Number(profileData?.cratesSinceLegendary) || 0);
}

function isLegendaryPityReady(profileData = getCurrentProfileData()) {
    return getCratesSinceLegendary(profileData) >= CRATE_LEGENDARY_PITY_THRESHOLD - 1;
}

function getCratesUntilLegendaryPity(profileData = getCurrentProfileData()) {
    return Math.max(0, CRATE_LEGENDARY_PITY_THRESHOLD - getCratesSinceLegendary(profileData));
}

function getOwnedCratePfpPaths(profileData = getCurrentProfileData()) {
    const ownedPaths = new Set();
    const level = getCurrentPlayerLevel(profileData);

    if (profileData.profilePicture) ownedPaths.add(profileData.profilePicture);
    (Array.isArray(profileData.earnedCosmetics) ? profileData.earnedCosmetics : []).forEach(cosmetic => {
        if (cosmetic?.imagePath) ownedPaths.add(cosmetic.imagePath);
    });
    if (Array.isArray(levelRewards)) {
        levelRewards
            .filter(reward => reward.level <= level && reward.imagePath)
            .forEach(reward => ownedPaths.add(reward.imagePath));
    }
    if (Array.isArray(sharkPassRewards)) {
        sharkPassRewards
            .filter(reward => reward.type === "pfp" && reward.level <= level && reward.imagePath)
            .forEach(reward => ownedPaths.add(reward.imagePath));
    }

    return ownedPaths;
}

function isCrateRewardOwned(profileData, reward) {
    if (reward.type === "pfp") {
        return getOwnedCratePfpPaths(profileData).has(reward.imagePath);
    }
    if (reward.type === "theme") {
        return getUnlockedCardThemes(profileData).some(theme => theme.id === reward.themeId);
    }
    if (reward.type === "badge") {
        return getUnlockedBadges(profileData.uid || currentUser?.uid || "").some(badge => badge.id === reward.badgeId);
    }
    return false;
}

function getAvailableCrateRewards(profileData = getCurrentProfileData()) {
    return crateRewardPool.filter(reward => !isCrateRewardOwned(profileData, reward));
}

function getCrateRewardsByRarity(rarity, crateId = "reef") {
    const pool = getCratePoolById(crateId);
    return pool.filter(reward => reward.rarity === rarity);
}

function getCratePoolById(crateId) {
    switch (crateId) {
        case "summer":
            return summerCrateRewardPool;
        case "christmas":
            return christmasCrateRewardPool;
        case "halloween":
            return halloweenCrateRewardPool;
        default:
            return crateRewardPool;
    }
}

const SPIN_WHEEL_LEGENDARY_PFP = {
    name: "Blue-spotted Ribbontail Ray",
    imagePath: "images/WheelPfp/img1.png",
    spinReward: true,
    rarity: "legendary"
};

const spinWheelRewards = [
    { id: "spin_xp_250", type: "xp", amount: 250, weight: 14, label: "250 XP", wheelLabel: "250", rarity: "common", color: "#35d07f", icon: "\u{2728}" },
    { id: "spin_xp_500", type: "xp", amount: 500, weight: 13, label: "500 XP", wheelLabel: "500", rarity: "common", color: "#2f9cff", icon: "\u{26A1}" },
    { id: "spin_xp_1000", type: "xp", amount: 1000, weight: 12, label: "1000 XP", wheelLabel: "1K", rarity: "uncommon", color: "#9b7cff", icon: "\u{1F4AB}" },
    { id: "spin_reef_crate", type: "crate", crateId: "reef", amount: 1, weight: 14, label: "Cosmetic Crate", wheelLabel: "Crate", rarity: "uncommon", color: "#f6a04d", icon: "\u{1F4E6}" },
    { id: "spin_event_crate", type: "seasonal_crate", amount: 1, weight: 10, label: "Event Crate", wheelLabel: "Event", rarity: "rare", color: "#ff5f57", icon: "\u{2605}" },
    { id: "spin_shield", type: "item", itemId: STREAK_SHIELD_ITEM_ID, quantity: 1, weight: 10, label: "Streak Shield", wheelLabel: "Shield", rarity: "rare", color: "#4e7cff", icon: "\u{1F6E1}\uFE0F" },
    { id: "spin_pass_level", type: "pass_level", amount: 1, weight: 8, label: "Free Shark Pass Level", wheelLabel: "Pass", rarity: "epic", color: "#f4d35e", icon: "\u{2B06}\uFE0F" },
    { id: "spin_badge", type: "badge", badgeId: "lucky-fin", name: "Lucky Fin", weight: 7, label: "Lucky Fin Badge", wheelLabel: "Badge", rarity: "epic", color: "#2ec4b6", icon: "\u{1F340}" },
    { id: "spin_theme", type: "theme", themeId: "lucky-current", weight: 7, label: "Lucky Current Theme", wheelLabel: "Luck", rarity: "epic", color: "#5be7a9", icon: "\u{1F340}" },
    { id: "spin_pfp", type: "pfp", name: SPIN_WHEEL_LEGENDARY_PFP.name, imagePath: SPIN_WHEEL_LEGENDARY_PFP.imagePath, weight: 5, label: "Blue-spotted Ribbontail Ray PFP", wheelLabel: "Jackpot", rarity: "legendary", color: "#f7e967", icon: "\u{1F5BC}\uFE0F" }
];

let spinWheelRotation = 0;
let spinWheelSpinning = false;
const SPIN_WHEEL_GRADIENT_START_DEGREES = -90;
const SPIN_WHEEL_POINTER_DEGREES = 0;

function getLastSpinWheelDateStorageKey(uid = currentUser?.uid) {
    return uid ? `lastSpinWheelDate_${uid}` : "lastSpinWheelDate";
}

function getDailySpinWinDateStorageKey(uid = currentUser?.uid) {
    return uid ? `dailySpinWinDate_${uid}` : "dailySpinWinDate";
}

function getDailySpinBonusStorageKey(uid = currentUser?.uid) {
    return uid ? `dailySpinBonusSpins_${uid}` : "dailySpinBonusSpins";
}

function normalizeDailySpinBonusCount(value) {
    return Math.max(0, Math.floor(Number(value) || 0));
}

function getSpinWheelAuthUid() {
    const authUser = typeof firebase !== "undefined" && firebase.auth ? firebase.auth().currentUser : null;
    return currentUser?.uid || authUser?.uid || null;
}

function getStoredLastSpinWheelDate(uid = currentUser?.uid) {
    const profileData = getCurrentProfileData();
    return normalizeStoredDateValue(
        localStorage.getItem(getLastSpinWheelDateStorageKey(uid)) ||
        profileData.lastSpinWheelDate
    );
}

function getStoredDailySpinWinDate(profileData = getCurrentProfileData(), uid = getSpinWheelAuthUid()) {
    return normalizeStoredDateValue(
        localStorage.getItem(getDailySpinWinDateStorageKey(uid)) ||
        profileData.dailySpinWinDate
    );
}

function getDailySpinBonusCount(profileData = getCurrentProfileData(), uid = getSpinWheelAuthUid()) {
    const storedValue = uid ? localStorage.getItem(getDailySpinBonusStorageKey(uid)) : null;
    return normalizeDailySpinBonusCount(storedValue !== null ? storedValue : profileData.dailySpinBonusSpins);
}

function setDailySpinBonusCount(profileData = getCurrentProfileData(), count = 0, uid = getSpinWheelAuthUid()) {
    const normalizedCount = normalizeDailySpinBonusCount(count);
    profileData.dailySpinBonusSpins = normalizedCount;
    if (uid) {
        const storageKey = getDailySpinBonusStorageKey(uid);
        if (normalizedCount > 0) {
            localStorage.setItem(storageKey, String(normalizedCount));
        } else {
            localStorage.removeItem(storageKey);
        }
    }
    return normalizedCount;
}

function hasUnlockedDailySpinToday(profileData = getCurrentProfileData()) {
    const uid = getSpinWheelAuthUid();
    return Boolean(uid) && getStoredDailySpinWinDate(profileData, uid) === getLocalDateKey();
}

function canUseDailySpin(profileData = getCurrentProfileData()) {
    const uid = getSpinWheelAuthUid();
    if (!uid) return false;
    if (getDailySpinBonusCount(profileData, uid) > 0) return true;
    if (!hasUnlockedDailySpinToday(profileData)) return false;
    return getStoredLastSpinWheelDate(uid) !== getLocalDateKey();
}

function markDailySpinWinUnlocked(profileData = getCurrentProfileData()) {
    const uid = getSpinWheelAuthUid();
    if (!uid) return profileData;
    const today = getLocalDateKey();
    profileData.dailySpinWinDate = today;
    localStorage.setItem(getDailySpinWinDateStorageKey(uid), today);
    updateSpinWheelUI();
    return profileData;
}

function markDailySpinUsed(profileData = getCurrentProfileData()) {
    const uid = getSpinWheelAuthUid();
    const today = getLocalDateKey();
    const bonusSpins = getDailySpinBonusCount(profileData, uid);
    if (bonusSpins > 0) {
        setDailySpinBonusCount(profileData, bonusSpins - 1, uid);
    }
    profileData.lastSpinWheelDate = today;
    localStorage.setItem(getLastSpinWheelDateStorageKey(uid), today);
    return profileData;
}

function resolveSpinWheelReward(reward) {
    if (reward.type !== "seasonal_crate") return reward;
    const crateId = getActiveSeasonalCrateId();
    if (!crateId) return null;
    const crateDef = getCrateDefinition(crateId);
    const crateMeta = getSeasonalCrateMeta(crateId);
    return {
        ...reward,
        id: `spin_${crateId}_crate`,
        type: "crate",
        crateId,
        label: crateDef.name,
        wheelLabel: crateMeta.shortName,
        color: crateMeta.spinColor,
        icon: crateMeta.spinIcon
    };
}

function getSpinWheelRewards() {
    return spinWheelRewards.map(resolveSpinWheelReward).filter(Boolean);
}

function pickSpinWheelReward() {
    const rewards = getSpinWheelRewards();
    const totalWeight = rewards.reduce((sum, reward) => sum + Math.max(0, Number(reward.weight) || 0), 0);
    let roll = Math.random() * totalWeight;
    for (const reward of rewards) {
        roll -= Math.max(0, Number(reward.weight) || 0);
        if (roll <= 0) return reward;
    }
    return rewards[0];
}

function grantSpinWheelReward(profileData, reward) {
    let message = reward.label || "Reward";
    let duplicate = false;

    if (reward.type === "xp") {
        const baseXp = Math.max(0, Number(reward.amount) || 0);
        const xpAward = typeof window.applyLimitedTimeXpBonus === "function"
            ? window.applyLimitedTimeXpBonus(baseXp)
            : { totalXp: baseXp };
        profileData.totalXP = (Number(profileData.totalXP) || 0) + xpAward.totalXp;
        applySharkPassXpGain(profileData, xpAward.totalXp);
        message = `${xpAward.totalXp} XP`;
    } else if (reward.type === "crate") {
        const inventory = getCrateInventory(profileData);
        const crateId = reward.crateId || "reef";
        const amount = Math.max(1, Math.floor(Number(reward.amount) || 1));
        inventory[crateId] = (inventory[crateId] || 0) + amount;
        profileData.crateInventory = normalizeCrateInventory(inventory);
        markCrateInventoryChanged(profileData);
        message = `${amount} ${getCrateDefinition(crateId).name}${amount === 1 ? "" : "s"}`;
    } else if (reward.type === "pass_level") {
        const currentLevel = getCurrentPlayerLevel(profileData);
        const nextLevel = Math.max(2, currentLevel + 1);
        const targetPassXp = getXPForLevel(nextLevel);
        const passXp = getSharkPassXP(profileData);
        const xpGain = targetPassXp > passXp ? targetPassXp - passXp : 1500;
        profileData.totalXP = (Number(profileData.totalXP) || 0) + xpGain;
        applySharkPassXpGain(profileData, xpGain);
        if (targetPassXp > passXp) {
            message = `Free Shark Pass level up! (Level ${nextLevel})`;
        } else {
            message = "Max level reached \u2014 1500 XP instead";
        }
    } else if (reward.type === "item" || reward.type === "badge" || reward.type === "theme" || reward.type === "pfp") {
        const result = grantCrateReward(profileData, {
            type: reward.type,
            itemId: reward.itemId,
            quantity: reward.quantity,
            badgeId: reward.badgeId,
            themeId: reward.themeId,
            name: reward.name,
            imagePath: reward.imagePath,
            rarity: reward.rarity
        });
        duplicate = result.duplicateReward;
        if (duplicate && reward.type === "item") {
            message = "Streak Shield (already at max)";
        } else if (duplicate) {
            profileData.totalXP = (profileData.totalXP || 0) + 750;
            applySharkPassXpGain(profileData, 750);
            message = `${reward.label} (owned) \u2014 750 XP instead`;
        }
    }

    return { profileData, message, duplicate };
}

function getSpinWheelSliceGeometry(rewards = getSpinWheelRewards()) {
    const sliceCount = Math.max(1, rewards.length);
    const slice = 360 / sliceCount;
    return rewards.map((reward, index) => {
        const start = index * slice;
        const end = start + slice;
        const mid = start + (slice / 2);
        return { reward, start, end, mid, slice };
    });
}

function normalizeSpinWheelDegrees(degrees) {
    return ((degrees % 360) + 360) % 360;
}

function getSpinWheelRotationForSlice(slice) {
    const visualMidpoint = SPIN_WHEEL_GRADIENT_START_DEGREES + slice.mid;
    return normalizeSpinWheelDegrees(SPIN_WHEEL_POINTER_DEGREES - visualMidpoint);
}

function buildSpinWheelGradient() {
    const slices = getSpinWheelSliceGeometry();
    const stops = slices.map(entry => {
        const separatorSize = Math.min(0.42, entry.slice * 0.025);
        const colorStart = entry.start + separatorSize;
        const colorEnd = entry.end - separatorSize;
        return `rgba(7, 28, 44, 0.5) ${entry.start}deg ${colorStart}deg, ${entry.reward.color} ${colorStart}deg ${colorEnd}deg, rgba(7, 28, 44, 0.5) ${colorEnd}deg ${entry.end}deg`;
    });
    return `conic-gradient(from ${SPIN_WHEEL_GRADIENT_START_DEGREES}deg, ${stops.join(", ")})`;
}

function getSpinWheelChancePercent(reward) {
    const totalWeight = getSpinWheelRewards().reduce((sum, entry) => sum + Math.max(0, Number(entry.weight) || 0), 0);
    if (!totalWeight) return "0%";
    const percent = (Math.max(0, Number(reward.weight) || 0) / totalWeight) * 100;
    return `${Number.isInteger(percent) ? percent : percent.toFixed(1)}%`;
}

function renderSpinWheelSliceLabels() {
    const disk = document.getElementById("spin-wheel-disk");
    if (!disk) return;
    disk.innerHTML = "";
}

function getSpinWheelLegendIconMarkup(reward) {
    if (reward.type === "pfp" && reward.imagePath) {
        return `<span class="legend-icon legend-icon-pfp"><img src="${escapeHtml(reward.imagePath)}" alt=""></span>`;
    }
    return `<span class="legend-icon">${escapeHtml(reward.icon || "")}</span>`;
}

function renderSpinWheelLegend() {
    const legend = document.getElementById("spin-wheel-legend");
    if (!legend) return;
    legend.innerHTML = getSpinWheelRewards().map(reward => `
        <li class="spin-wheel-legend-item rarity-${reward.rarity}">
            <span class="legend-swatch" style="background:${reward.color};"></span>
            ${getSpinWheelLegendIconMarkup(reward)}
            <span class="legend-copy">
                <strong>${reward.label}</strong>
                <small>${reward.rarity}</small>
            </span>
            <span class="legend-chance">${getSpinWheelChancePercent(reward)}</span>
        </li>
    `).join("");
}

function updateSpinWheelUI() {
    const btn = document.getElementById("spin-wheel-btn");
    const statusEl = document.getElementById("spin-wheel-status");
    const actionBtn = document.getElementById("spin-wheel-action-btn");
    const subtitle = document.getElementById("spin-wheel-subtitle");
    const profileData = getCurrentProfileData();
    const canSpin = canUseDailySpin(profileData);
    const bonusSpins = getDailySpinBonusCount(profileData);
    const usedToday = Boolean(getSpinWheelAuthUid()) && getStoredLastSpinWheelDate(getSpinWheelAuthUid()) === getLocalDateKey();

    if (btn) {
        if (currentUser) {
            btn.classList.remove("hidden");
            btn.disabled = false;
            btn.classList.toggle("spin-used", !canSpin);
        } else {
            btn.classList.add("hidden");
        }
    }
    if (statusEl) {
        statusEl.textContent = canSpin ? (bonusSpins > 1 ? `${bonusSpins}x` : "Ready") : usedToday ? "Used" : "Win";
    }
    if (actionBtn) {
        actionBtn.disabled = !canSpin || spinWheelSpinning;
        actionBtn.textContent = canSpin ? (bonusSpins > 1 ? `Spin the Wheel (${bonusSpins})` : "Spin the Wheel") : usedToday ? "Come Back Tomorrow" : "Win Today to Unlock";
    }
    if (subtitle) {
        subtitle.textContent = canSpin
            ? bonusSpins > 0
                ? `You have ${bonusSpins} granted spin${bonusSpins === 1 ? "" : "s"} available. Land the jackpot slice for the Blue-spotted Ribbontail Ray profile picture.`
                : "Your first win today unlocked 1 spin. Land the jackpot slice for the Blue-spotted Ribbontail Ray profile picture."
            : usedToday
            ? "You already used today's spin. Come back after midnight and win again for another shot."
            : "Win a Daily or Infinite game today to unlock 1 spin.";
    }
}

function openSpinWheelModal() {
    if (!currentUser) {
        openLoginModal();
        return;
    }
    const modal = document.getElementById("spinWheelModal");
    const disk = document.getElementById("spin-wheel-disk");
    const result = document.getElementById("spin-wheel-result");
    if (!modal || !disk) return;

    disk.style.background = buildSpinWheelGradient();
    renderSpinWheelSliceLabels();
    disk.style.transform = `rotate(${spinWheelRotation}deg)`;
    if (result) {
        result.classList.add("hidden");
        result.textContent = "";
    }
    renderSpinWheelLegend();
    updateSpinWheelUI();
    modal.classList.remove("hidden");
}

function closeSpinWheelModal() {
    const modal = document.getElementById("spinWheelModal");
    if (modal) modal.classList.add("hidden");
}

async function spinDailyWheel() {
    if (!currentUser || spinWheelSpinning || !canUseDailySpin()) {
        if (currentUser && !hasUnlockedDailySpinToday()) {
            showNotification("Win a Daily or Infinite game today to unlock the wheel.", "info", 3200);
        }
        updateSpinWheelUI();
        return;
    }

    const disk = document.getElementById("spin-wheel-disk");
    const result = document.getElementById("spin-wheel-result");
    const actionBtn = document.getElementById("spin-wheel-action-btn");
    if (!disk) return;

    spinWheelSpinning = true;
    if (actionBtn) actionBtn.disabled = true;

    const rewards = getSpinWheelRewards();
    const reward = pickSpinWheelReward();
    const rewardIndex = Math.max(0, rewards.findIndex(entry => entry.id === reward.id));
    const slices = getSpinWheelSliceGeometry(rewards);
    const winningSlice = slices[rewardIndex] || slices[0];
    const extraTurns = 5 + Math.floor(Math.random() * 3);
    const currentRotation = normalizeSpinWheelDegrees(spinWheelRotation);
    const desiredRotation = getSpinWheelRotationForSlice(winningSlice);
    const rotationDelta = normalizeSpinWheelDegrees(desiredRotation - currentRotation);
    const targetRotation = (extraTurns * 360) + rotationDelta;
    spinWheelRotation += targetRotation;
    disk.style.transform = `rotate(${spinWheelRotation}deg)`;

    await new Promise(resolve => setTimeout(resolve, 4200));

    let profileData = getCurrentProfileData();
    const grantResult = grantSpinWheelReward(profileData, reward);
    profileData = markDailySpinUsed(grantResult.profileData);
    saveUserProfileLocally(profileData);

    if (currentUser && db) {
        try {
            await db.collection("userStats").doc(currentUser.uid).set({
                totalXP: profileData.totalXP,
                ...getSharkPassSyncPayload(profileData),
                earnedCosmetics: profileData.earnedCosmetics,
                unlockedBadges: profileData.unlockedBadges,
                unlockedCardThemes: profileData.unlockedCardThemes,
                crateInventory: normalizeCrateInventory(profileData.crateInventory),
                crateInventoryUpdatedAt: getCrateInventoryUpdatedAt(profileData),
                streakShields: getStreakShieldCount(profileData),
                lastSpinWheelDate: profileData.lastSpinWheelDate,
                dailySpinWinDate: profileData.dailySpinWinDate,
                dailySpinBonusSpins: getDailySpinBonusCount(profileData)
            }, { merge: true });
        } catch (error) {
            console.warn("Spin wheel sync failed:", error);
        }
    }

    if (result) {
        result.classList.remove("hidden");
        result.innerHTML = `\u{1F389} You won <strong>${grantResult.message}</strong>!`;
    }

    if (reward.type === "pfp" && !grantResult.duplicate && typeof showCosmeticUnlockToast === "function") {
        showCosmeticUnlockToast({
            name: reward.name,
            imagePath: reward.imagePath
        }, {
            title: "Jackpot Spin Reward!",
            subtitle: reward.name,
            accent: "#ffd47f",
            background: "linear-gradient(135deg, rgba(255, 212, 127, 0.96), rgba(91, 58, 9, 0.96))",
            icon: "\u{1F3A1}"
        });
    } else {
        showNotification(`Spin reward: ${grantResult.message}`, "success", 4200);
    }

    renderCratesButton();
    renderCratesModal();
    updateSeasonalCratePanels();
    if (typeof loadAvailablePFPs === "function") loadAvailablePFPs();
    if (typeof loadEarnedCosmetics === "function") loadEarnedCosmetics();
    if (typeof renderThemeSelection === "function") renderThemeSelection();
    if (typeof renderBadgeSelection === "function") renderBadgeSelection();
    if (typeof updateProfileBadgeUI === "function") updateProfileBadgeUI();
    spinWheelSpinning = false;
    updateIndexStats();
    updateSpinWheelUI();
}

function collectAllUnlockablePfps() {
    const entries = [];
    const seen = new Set();
    const addEntry = (name, imagePath, extra = {}) => {
        if (!imagePath || seen.has(imagePath)) return;
        seen.add(imagePath);
        entries.push({ name: name || "Shark", imagePath, ...extra });
    };

    levelRewards.forEach(reward => addEntry(reward.name, reward.imagePath, { level: reward.level }));
    sharkPassRewards
        .filter(reward => reward.type === "pfp")
        .forEach(reward => addEntry(reward.name, reward.imagePath, {
            level: reward.level,
            passReward: true,
            rarity: reward.rarity,
            source: getSharkPassRewardSourceLabel(reward)
        }));
    getAllCrateRewardPools().flat()
        .filter(reward => reward.type === "pfp")
        .forEach(reward => addEntry(reward.name, reward.imagePath, { crateReward: true, rarity: reward.rarity }));
    Object.values(redeemCodes).forEach(code => {
        (code.cosmetics || []).forEach(cosmetic => addEntry(cosmetic.name, cosmetic.imagePath, { codeReward: true }));
    });
    addEntry(DAY_7_LOGIN_PFP.name, DAY_7_LOGIN_PFP.imagePath, { loginReward: true });
    addEntry(SPIN_WHEEL_LEGENDARY_PFP.name, SPIN_WHEEL_LEGENDARY_PFP.imagePath, { spinReward: true, rarity: "legendary" });
    addEntry("Port Jackson Shark", "images/leaderPfp/Shark19.png", { leaderReward: true });
    addEntry("Catshark", "images/leaderPfp/Daily/Shark1.png", { leaderReward: true });
    addEntry("Whitetip Reef Shark", "images/leaderPfp/Monthly/Shark1.png", { leaderReward: true });
    addEntry("Hammerhead Shark", "images/codePfp/Shark26.png", { codeReward: true });

    return entries;
}

function collectAllUnlockableBadgeIds(uid = currentUser?.uid) {
    return allBadges
        .filter(badge => !badge.devOnly || isDeveloperUid(uid))
        .map(badge => badge.id);
}

window.unlockAllCosmetics = async function() {
    if (!currentUser || !isDeveloperUid(currentUser.uid)) {
        console.log("? Access denied. unlockAllCosmetics() is for developers only.");
        showNotification("Dev command: Access denied.", "error", 4000);
        return;
    }

    const profileData = getCurrentProfileData();
    const allPfps = collectAllUnlockablePfps();
    const allBadgeIds = collectAllUnlockableBadgeIds(currentUser.uid);
    const allThemeIds = [...new Set(["default", ...sharkPassCardThemes.map(theme => theme.id)])];
    const activePassSeason = getActiveSharkPassSeason();
    const passCapLevel = sharkPassRewards.reduce((max, reward) => Math.max(max, Number(reward.level) || 0), 0);
    const passCapXp = passCapLevel > 0 ? getXPForLevel(passCapLevel) : 0;
    const currentSeasonPassXp = activePassSeason?.id && profileData.sharkPassProgressSeasonId === activePassSeason.id
        ? Math.max(0, Number(profileData.sharkPassXP) || 0)
        : 0;

    profileData.earnedCosmetics = getUnifiedCosmeticList(profileData.earnedCosmetics, allPfps, "imagePath");
    profileData.unlockedBadges = [...new Set(["starter", ...allBadgeIds])];
    profileData.unlockedCardThemes = allThemeIds;
    if (activePassSeason?.id) {
        profileData.sharkPassProgressSeasonId = activePassSeason.id;
        profileData.sharkPassSeasonId = activePassSeason.id;
    }
    profileData.sharkPassXP = Math.max(currentSeasonPassXp, passCapXp);
    if (allBadgeIds.includes("tester")) {
        profileData.testerBadgeUnlocked = true;
    }

    saveUserProfileLocally(profileData);

    if (db) {
        await db.collection("userStats").doc(currentUser.uid).set({
            earnedCosmetics: profileData.earnedCosmetics,
            unlockedBadges: profileData.unlockedBadges,
            unlockedCardThemes: profileData.unlockedCardThemes,
            sharkPassProgressSeasonId: profileData.sharkPassProgressSeasonId,
            sharkPassSeasonId: profileData.sharkPassSeasonId,
            sharkPassXP: profileData.sharkPassXP,
            testerBadgeUnlocked: profileData.testerBadgeUnlocked === true
        }, { merge: true });
    }

    if (typeof renderThemeSelection === "function") renderThemeSelection();
    if (typeof renderBadgeSelection === "function") renderBadgeSelection();
    if (typeof loadAvailablePFPs === "function") loadAvailablePFPs();
    if (typeof loadEarnedCosmetics === "function") loadEarnedCosmetics();
    if (typeof updateProfileBadgeUI === "function") updateProfileBadgeUI();

    console.log(`? Unlocked ${profileData.earnedCosmetics.length} profile icons, ${profileData.unlockedBadges.length} badges, and ${profileData.unlockedCardThemes.length} themes.`);
    showNotification("Unlocked all profile icons, badges, and themes.", "success", 4200);
};

window.resetDailySpin = function() {
    if (!currentUser || !isDeveloperUid(currentUser.uid)) {
        console.log("? Access denied. resetDailySpin() is for developers only.");
        return;
    }
    const profileData = getCurrentProfileData();
    delete profileData.lastSpinWheelDate;
    localStorage.removeItem(getLastSpinWheelDateStorageKey(currentUser.uid));
    saveUserProfileLocally(profileData);
    if (db) {
        db.collection("userStats").doc(currentUser.uid).set({ lastSpinWheelDate: "" }, { merge: true }).catch(() => {});
    }
    updateSpinWheelUI();
    console.log("? Daily spin reset. You can spin again.");
};

window.giveDailySpin = function(count = 1) {
    if (!currentUser || !isDeveloperUid(currentUser.uid)) {
        console.log("? Access denied. giveDailySpin() is for developers only.");
        return;
    }
    const grantCount = Math.max(1, Math.floor(Number(count) || 1));
    const today = getLocalDateKey();
    const profileData = getCurrentProfileData();
    const nextBonusSpins = setDailySpinBonusCount(
        profileData,
        getDailySpinBonusCount(profileData, currentUser.uid) + grantCount,
        currentUser.uid
    );
    profileData.dailySpinWinDate = today;
    profileData.lastSpinWheelDate = today;
    localStorage.setItem(getDailySpinWinDateStorageKey(currentUser.uid), today);
    localStorage.setItem(getLastSpinWheelDateStorageKey(currentUser.uid), today);
    saveUserProfileLocally(profileData);
    if (db) {
        db.collection("userStats").doc(currentUser.uid).set({
            dailySpinWinDate: today,
            lastSpinWheelDate: today,
            dailySpinBonusSpins: nextBonusSpins
        }, { merge: true }).catch(() => {});
    }
    updateSpinWheelUI();
    console.log(`? Granted ${grantCount} daily wheel spin${grantCount === 1 ? "" : "s"}. You now have ${nextBonusSpins} spin${nextBonusSpins === 1 ? "" : "s"} available.`);
};

window.giveSpin = window.giveDailySpin;

window.markDailySpinWinUnlocked = markDailySpinWinUnlocked;
window.openSpinWheelModal = openSpinWheelModal;
window.closeSpinWheelModal = closeSpinWheelModal;
window.spinDailyWheel = spinDailyWheel;

function getAllCrateRewardPools() {
    return [crateRewardPool, summerCrateRewardPool, christmasCrateRewardPool, halloweenCrateRewardPool];
}

function getAllDisplayCrateRewardPools() {
    return [legacyCrate1RewardPool, ...getAllCrateRewardPools()];
}

function getAllCrateBadgeRewards() {
    return getAllDisplayCrateRewardPools()
        .flat()
        .filter(reward => reward.type === "badge");
}

function getOpenedCrateCount(profileData = getCurrentProfileData(), crateId = null) {
    const storedCount = Math.max(0, Number(profileData?.cratesOpened) || 0);
    if (storedCount > 0) {
        if (crateId === null) return storedCount;
        const inventory = normalizeCrateInventory(profileData.crateInventory || {});
        return inventory[crateId] || 0;
    }

    if (crateId === null) {
        return crateRewardPool.filter(reward => isCrateRewardOwned(profileData, reward)).length;
    }

    const pool = getCratePoolById(crateId);
    return pool.filter(reward => isCrateRewardOwned(profileData, reward)).length;
}

function normalizeGlobalXpEventConfig(rawConfig) {
    if (!rawConfig || rawConfig.enabled !== true) return null;
    const startMs = Number(rawConfig.startMs);
    const endMs = Number(rawConfig.endMs);
    const multiplier = Math.max(1, Number(rawConfig.multiplier) || 2);
    if (!Number.isFinite(startMs) || !Number.isFinite(endMs) || endMs <= startMs) {
        return null;
    }
    return {
        id: rawConfig.id || "global-double-xp",
        label: rawConfig.label || `${multiplier}x XP Event`,
        multiplier,
        startMs,
        endMs
    };
}

function getActiveLimitedTimeXpEvent(nowMs = Date.now()) {
    const forcePreview = localStorage.getItem("forceXpEventPreview") === "true";
    if (forcePreview) {
        return {
            ...limitedTimeXpEvent,
            previewMode: true,
            endMs: nowMs + (47 * 60 * 60 * 1000) + (12 * 60 * 1000) + (9 * 1000)
        };
    }
    const activeGlobalEvent = normalizeGlobalXpEventConfig(globalXpEventOverride);
    if (activeGlobalEvent && nowMs >= activeGlobalEvent.startMs && nowMs < activeGlobalEvent.endMs) {
        return activeGlobalEvent;
    }
    if (nowMs >= limitedTimeXpEvent.startMs && nowMs < limitedTimeXpEvent.endMs) {
        return limitedTimeXpEvent;
    }
    return null;
}

function applyLimitedTimeXpBonus(baseXp) {
    const safeBaseXp = Math.max(0, Math.round(Number(baseXp) || 0));
    const activeEvent = getActiveLimitedTimeXpEvent();
    const eventMultiplier = activeEvent ? activeEvent.multiplier : 1;
    const profileData = typeof getCurrentProfileData === "function" ? getCurrentProfileData() : {};
    const seasonBoostActive = hasSeasonXpBoost(profileData);
    const seasonMultiplier = seasonBoostActive ? 2 : 1;
    const totalMultiplier = eventMultiplier * seasonMultiplier;

    if (totalMultiplier <= 1) {
        return {
            baseXp: safeBaseXp,
            totalXp: safeBaseXp,
            bonusXp: 0,
            multiplier: 1,
            event: null
        };
    }

    const seasonEvent = seasonBoostActive
        ? {
            id: `season-xp-${SHARK_PASS_ACTIVE_SEASON_ID}`,
            label: "Season 2x XP",
            multiplier: 2,
            seasonId: SHARK_PASS_ACTIVE_SEASON_ID
        }
        : null;
    const totalXp = Math.round(safeBaseXp * totalMultiplier);
    return {
        baseXp: safeBaseXp,
        totalXp,
        bonusXp: totalXp - safeBaseXp,
        multiplier: totalMultiplier,
        event: activeEvent && seasonEvent
            ? {
                ...activeEvent,
                label: `${activeEvent.label} + Season 2x XP`,
                multiplier: totalMultiplier,
                stacked: true,
                seasonBoost: seasonEvent
            }
            : activeEvent || seasonEvent
    };
}

let xpEventBannerInterval = null;

function formatEventTimeRemaining(msRemaining) {
    const totalSeconds = Math.max(0, Math.floor(msRemaining / 1000));
    const days = Math.floor(totalSeconds / 86400);
    const hours = Math.floor((totalSeconds % 86400) / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = totalSeconds % 60;

    if (days > 0) {
        return `${days}d ${String(hours).padStart(2, "0")}h ${String(minutes).padStart(2, "0")}m`;
    }
    return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
}

function updateXpEventBanner() {
    const banner = document.getElementById("xp-event-banner");
    const timer = document.getElementById("xp-event-timer");
    if (!banner || !timer) return;

    const activeEvent = getActiveLimitedTimeXpEvent();
    if (!activeEvent) {
        banner.classList.add("hidden");
        timer.textContent = "Event inactive";
        if (xpEventBannerInterval) {
            clearInterval(xpEventBannerInterval);
            xpEventBannerInterval = null;
        }
        return;
    }

    const titleEl = banner.querySelector(".xp-event-title");
    if (titleEl) titleEl.textContent = `${activeEvent.multiplier}x XP gain active`;
    timer.textContent = `${activeEvent.previewMode ? "Preview ends in" : "Ends in"} ${formatEventTimeRemaining(activeEvent.endMs - Date.now())}`;

    banner.classList.remove("hidden");
}

function ensureXpEventBannerTimer() {
    updateXpEventBanner();
    if (xpEventBannerInterval) {
        clearInterval(xpEventBannerInterval);
        xpEventBannerInterval = null;
    }
    if (getActiveLimitedTimeXpEvent()) {
        xpEventBannerInterval = setInterval(updateXpEventBanner, 1000);
    }
}

function createCommunityBossRewards(crateId) {
    return {
        first: { label: "#1 contributor", xp: 25000, crateId, crateCount: 10, rank: 1 },
        second: { label: "#2 contributor", xp: 15000, crateId, crateCount: 5, rank: 2 },
        default: { label: "Everybody else", xp: 10000, crateId, crateCount: 2, rank: null }
    };
}

function createCommunityBossMilestoneRewards(crateId) {
    return [
        { id: "tier-50", label: "50-win reward", goal: 50, xp: 10000, crateId, crateCount: 2, rank: null },
        { id: "tier-100", label: "100-win reward", goal: 100, xp: 15000, crateId, crateCount: 5, rank: null },
        { id: "tier-150", label: "150-win final reward", goal: 150, xp: 25000, crateId, crateCount: 10, rank: null }
    ];
}

function getCurrentCommunityBossEvent(nowMs = Date.now()) {
    const startedEvents = COMMUNITY_BOSS_EVENTS
        .filter(event => nowMs >= event.startMs)
        .sort((a, b) => a.startMs - b.startMs);

    return startedEvents[startedEvents.length - 1]
        || COMMUNITY_BOSS_EVENTS.find(event => nowMs < event.startMs)
        || COMMUNITY_BOSS_EVENTS[COMMUNITY_BOSS_EVENTS.length - 1];
}

function getCommunityBossPageKind() {
    const path = window.location.pathname.toLowerCase();
    if (document.body?.classList.contains("home-page")) return "home";
    return "";
}

function getCommunityBossWins() {
    return Math.max(0, Number(communityBossState?.wins) || 0);
}

function isCommunityBossStarted(nowMs = Date.now()) {
    return nowMs >= COMMUNITY_BOSS_EVENT.startMs;
}

function isCommunityBossExpired(nowMs = Date.now()) {
    return nowMs >= COMMUNITY_BOSS_EVENT.endMs;
}

function isCommunityBossComplete(wins = getCommunityBossWins()) {
    return wins >= COMMUNITY_BOSS_EVENT.targetWins;
}

function isCommunityBossMilestoneEvent(event = COMMUNITY_BOSS_EVENT) {
    return event?.rewardMode === "milestone" || Array.isArray(event?.rewards);
}

function getCommunityBossContributionMultiplier() {
    return Math.max(1, Math.floor(Number(COMMUNITY_BOSS_EVENT.contributionMultiplier) || 1));
}

function isCommunityBossContributionOpen(nowMs = Date.now()) {
    return isCommunityBossStarted(nowMs) && !isCommunityBossExpired(nowMs) && !isCommunityBossComplete();
}

function getCommunityBossRewardClaim(profileData = getCurrentProfileData()) {
    return profileData?.communityBossRewards?.[COMMUNITY_BOSS_EVENT.id] || null;
}

function getClaimedCommunityBossRewardIds(profileData = getCurrentProfileData()) {
    const claim = getCommunityBossRewardClaim(profileData);
    if (!claim || typeof claim !== "object") return new Set();
    if (Array.isArray(claim.claimedRewardIds)) return new Set(claim.claimedRewardIds.map(String));
    if (claim.rewardId) return new Set([String(claim.rewardId)]);
    return new Set();
}

function getCommunityBossRewardTiers() {
    if (isCommunityBossMilestoneEvent()) {
        return [...(Array.isArray(COMMUNITY_BOSS_EVENT.rewards) ? COMMUNITY_BOSS_EVENT.rewards : [])]
            .sort((a, b) => (Number(a.goal) || 0) - (Number(b.goal) || 0));
    }

    return [
        COMMUNITY_BOSS_EVENT.rewards.first,
        COMMUNITY_BOSS_EVENT.rewards.second,
        COMMUNITY_BOSS_EVENT.rewards.default
    ].filter(Boolean);
}

function getUnlockedCommunityBossRewards(wins = getCommunityBossWins()) {
    if (!isCommunityBossMilestoneEvent()) return [];
    return getCommunityBossRewardTiers().filter(reward => wins >= (Number(reward.goal) || 0));
}

function getPendingCommunityBossRewards(wins = getCommunityBossWins(), profileData = getCurrentProfileData()) {
    if (!isCommunityBossMilestoneEvent()) return [];
    const claimedRewardIds = getClaimedCommunityBossRewardIds(profileData);
    return getUnlockedCommunityBossRewards(wins).filter(reward => !claimedRewardIds.has(String(reward.id)));
}

function hasClaimedCommunityBossReward(profileData = getCurrentProfileData(), wins = getCommunityBossWins()) {
    if (isCommunityBossMilestoneEvent()) {
        const unlockedRewards = getUnlockedCommunityBossRewards(wins);
        return unlockedRewards.length > 0 && getPendingCommunityBossRewards(wins, profileData).length === 0;
    }

    return Boolean(getCommunityBossRewardClaim(profileData));
}

function getCommunityBossDocRef() {
    return db?.collection("communityEvents").doc(COMMUNITY_BOSS_EVENT.id) || null;
}

function getCommunityBossContributorRef(uid = currentUser?.uid) {
    const eventRef = getCommunityBossDocRef();
    return eventRef && uid ? eventRef.collection("contributors").doc(uid) : null;
}

function getCommunityBossRewardForRank(rank) {
    if (rank === 1) return COMMUNITY_BOSS_EVENT.rewards.first;
    if (rank === 2) return COMMUNITY_BOSS_EVENT.rewards.second;
    return COMMUNITY_BOSS_EVENT.rewards.default;
}

function getCommunityBossCrateName(crateId = COMMUNITY_BOSS_EVENT.crateId) {
    return crateDefinitions[crateId]?.name || "Event Crate";
}

function formatCommunityBossCrateReward(reward) {
    const crateCount = Math.max(0, Number(reward.crateCount) || 0);
    const crateName = getCommunityBossCrateName(reward.crateId);
    return `${crateCount.toLocaleString()} ${crateName}${crateCount === 1 ? "" : "s"}`;
}

function formatCommunityBossCrateAwards(crateAwards) {
    return Object.entries(crateAwards || {})
        .filter(([, count]) => Number(count) > 0)
        .map(([crateId, count]) => {
            const crateCount = Math.max(0, Number(count) || 0);
            const crateName = getCommunityBossCrateName(crateId);
            return `${crateCount.toLocaleString()} ${crateName}${crateCount === 1 ? "" : "s"}`;
        })
        .join(", ");
}

function getCommunityBossRewardDescription(reward) {
    return `${formatCommunityBossCrateReward(reward)}, ${reward.xp.toLocaleString()} XP, ${COMMUNITY_BOSS_EVENT.rewardBadgeName} profile badge`;
}

function getCommunityBossDescription() {
    const multiplier = getCommunityBossContributionMultiplier();
    const multiplierCopy = multiplier > 1 ? ` Each win counts as ${multiplier}.` : "";
    if (isCommunityBossMilestoneEvent()) {
        const goals = getCommunityBossRewardTiers()
            .map(reward => (Number(reward.goal) || 0).toLocaleString())
            .join(", ");
        return `Daily and Infinite wins from every logged-in player count together.${multiplierCopy} Unlock shared rewards at ${goals} community wins before the deadline to bring down the ${COMMUNITY_BOSS_EVENT.bossName}.`;
    }
    return `Daily and Infinite wins from every logged-in player count together.${multiplierCopy} Reach ${COMMUNITY_BOSS_EVENT.targetWins.toLocaleString()} community wins by the event deadline to bring down the ${COMMUNITY_BOSS_EVENT.bossName}.`;
}

function resolveCommunityBossProfilePicturePath(path) {
    const storedPath = String(path || "").trim();
    if (!storedPath) return "images/pfp/shark1.png";
    if (/^https?:\/\//i.test(storedPath) || storedPath.startsWith("images/")) return storedPath;
    if (storedPath.includes("/")) return `images/${storedPath.replace(/^\/+/, "")}`;
    return `images/pfp/${storedPath}`;
}

function getCommunityBossRewardsMarkup(wins = getCommunityBossWins(), profileData = getCurrentProfileData()) {
    const rewardRows = getCommunityBossRewardTiers();
    const claimedRewardIds = getClaimedCommunityBossRewardIds(profileData);
    const heading = isCommunityBossMilestoneEvent() ? "Community Milestones" : "Rewards";

    return `
        <strong>${heading}</strong>
        <ul class="community-boss-rewards-list">
            ${rewardRows.map(reward => {
                const goal = Number(reward.goal) || 0;
                const claimed = claimedRewardIds.has(String(reward.id));
                const unlocked = !isCommunityBossMilestoneEvent() || wins >= goal;
                const status = isCommunityBossMilestoneEvent()
                    ? claimed
                        ? "Claimed"
                        : unlocked
                        ? "Unlocked"
                        : `${Math.max(0, goal - wins).toLocaleString()} wins to unlock`
                    : "";
                const statusMarkup = status ? `<em>${status}</em>` : "";
                return `<li class="${claimed ? "claimed" : unlocked ? "unlocked" : "locked"}"><b>${reward.label}</b><span>${getCommunityBossRewardDescription(reward)}${statusMarkup}</span></li>`;
            }).join("")}
        </ul>
    `;
}

async function getCommunityBossTopContributors(limit = 2) {
    const eventRef = getCommunityBossDocRef();
    if (!eventRef) return [];

    try {
        const snapshot = await eventRef
            .collection("contributors")
            .orderBy("wins", "desc")
            .limit(limit)
            .get();
        const rows = snapshot.docs.map((doc, index) => ({
            uid: doc.id,
            rank: index + 1,
            ...(doc.data() || {})
        }));

        return Promise.all(rows.map(async row => {
            if (row.profilePicture || row.profilePic || !db) return row;
            try {
                const profileDoc = await db.collection("userStats").doc(row.uid).get();
                const profileData = profileDoc.exists ? (profileDoc.data() || {}) : {};
                return {
                    ...row,
                    profilePicture: profileData.profilePicture || profileData.profilePic || ""
                };
            } catch (error) {
                return row;
            }
        }));
    } catch (error) {
        console.warn("Unable to load community boss contributor ranks:", error);
        return [];
    }
}

function ensureCommunityBossRanksModal() {
    let modal = document.getElementById("community-boss-ranks-modal");
    if (modal) return modal;

    modal = document.createElement("div");
    modal.id = "community-boss-ranks-modal";
    modal.className = "community-boss-ranks-modal hidden";
    modal.innerHTML = `
        <div class="community-boss-ranks-card">
            <button class="community-boss-ranks-close" type="button" onclick="closeCommunityBossRanksModal()" aria-label="Close ranks">×</button>
            <span class="community-boss-kicker">${COMMUNITY_BOSS_EVENT.bossName} Leaderboard</span>
            <h3>Top Contributors</h3>
            <div id="community-boss-ranks-list" class="community-boss-ranks-list">
                <p class="community-boss-ranks-empty">Loading ranks...</p>
            </div>
        </div>
    `;
    modal.addEventListener("click", (event) => {
        if (event.target === modal) closeCommunityBossRanksModal();
    });
    document.body.appendChild(modal);
    return modal;
}

function escapeCommunityBossHtml(value) {
    return String(value ?? "")
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
}

function renderCommunityBossRanks(rows) {
    const list = document.getElementById("community-boss-ranks-list");
    if (!list) return;

    if (!rows.length) {
        list.innerHTML = `<p class="community-boss-ranks-empty">No contributions yet.</p>`;
        return;
    }

    list.innerHTML = rows.map((row, index) => {
        const rank = index + 1;
        const rankClass = !isCommunityBossMilestoneEvent() && rank <= 2 ? ` top-${rank}` : "";
        const username = escapeCommunityBossHtml(row.username || "Anonymous");
        const profilePic = escapeCommunityBossHtml(resolveCommunityBossProfilePicturePath(row.profilePicture || row.profilePic));
        const wins = Math.max(0, Number(row.wins) || 0);
        const reward = isCommunityBossMilestoneEvent() ? null : getCommunityBossRewardForRank(rank);
        const rewardCopy = reward ? ` - ${reward.label}` : "";
        return `
            <article class="community-boss-rank-row${rankClass}">
                <span class="community-boss-rank-number">#${rank}</span>
                <img class="community-boss-rank-avatar" src="${profilePic}" alt="${username}" onerror="this.onerror=null;this.src='images/pfp/shark1.png';">
                <div>
                    <strong>${username}</strong>
                    <span>${wins.toLocaleString()} contribution${wins === 1 ? "" : "s"}${rewardCopy}</span>
                </div>
            </article>
        `;
    }).join("");
}

async function openCommunityBossRanksModal() {
    const modal = ensureCommunityBossRanksModal();
    modal.classList.remove("hidden");
    renderCommunityBossRanks([]);
    const list = document.getElementById("community-boss-ranks-list");
    if (list) list.innerHTML = `<p class="community-boss-ranks-empty">Loading ranks...</p>`;
    const rows = await getCommunityBossTopContributors(10);
    renderCommunityBossRanks(rows);
}

function closeCommunityBossRanksModal() {
    document.getElementById("community-boss-ranks-modal")?.classList.add("hidden");
}

function getCommunityBossDisplayState() {
    const wins = Math.min(getCommunityBossWins(), COMMUNITY_BOSS_EVENT.targetWins);
    const target = COMMUNITY_BOSS_EVENT.targetWins;
    const progressPercent = Math.max(0, Math.min(100, (wins / target) * 100));
    const nowMs = Date.now();
    const complete = isCommunityBossComplete(wins);
    const profileData = getCurrentProfileData();
    const pendingRewards = getPendingCommunityBossRewards(wins, profileData);
    const canClaim = isCommunityBossMilestoneEvent()
        ? pendingRewards.length > 0
        : complete && !hasClaimedCommunityBossReward(profileData, wins);
    const claimed = isCommunityBossMilestoneEvent()
        ? getUnlockedCommunityBossRewards(wins).length > 0 && pendingRewards.length === 0
        : hasClaimedCommunityBossReward(profileData, wins);
    const started = isCommunityBossStarted(nowMs);
    const expired = isCommunityBossExpired(nowMs);
    const contributionOpen = isCommunityBossContributionOpen(nowMs);

    let timerText = "";
    if (!started) {
        timerText = `Starts in ${formatEventTimeRemaining(COMMUNITY_BOSS_EVENT.startMs - nowMs)}`;
    } else if (complete) {
        timerText = "Boss defeated. Rewards are unlocked.";
    } else if (canClaim) {
        timerText = `${pendingRewards.length} reward${pendingRewards.length === 1 ? "" : "s"} unlocked.`;
    } else if (expired) {
        timerText = "Event ended.";
    } else {
        timerText = `Ends in ${formatEventTimeRemaining(COMMUNITY_BOSS_EVENT.endMs - nowMs)}`;
    }

    const claimLabel = !currentUser
        ? "Login to Claim"
        : claimed
        ? "Rewards Claimed"
        : canClaim
        ? pendingRewards.length > 1 ? "Claim Rewards" : "Claim Reward"
        : "Locked";

    const contributionCopy = contributionOpen
        ? canClaim
            ? "A shared reward is unlocked. Claim it now, and keep winning for the next milestone."
            : `Your next Daily or Infinite win will add ${getCommunityBossContributionMultiplier()} to the global total.`
        : complete
        ? "The community did it. Claim every unlocked reward while logged in."
        : "Wins are no longer being counted for this event.";

    return {
        wins,
        target,
        progressPercent,
        complete,
        claimed,
        canClaim,
        claimLabel,
        pendingRewardCount: pendingRewards.length,
        timerText,
        contributionCopy
    };
}

function ensureCommunityBossEventModal() {
    let modal = document.getElementById("community-boss-event-modal");
    if (modal) return modal;

    modal = document.createElement("div");
    modal.id = "community-boss-event-modal";
    modal.className = "community-boss-event-modal hidden";
    modal.innerHTML = `
        <div class="community-boss-event-card" role="dialog" aria-modal="true" aria-labelledby="community-boss-modal-title">
            <button class="community-boss-event-close" type="button" onclick="closeCommunityBossEventModal()" aria-label="Close event">×</button>
            <div id="community-boss-event-modal-body"></div>
        </div>
    `;
    modal.addEventListener("click", (event) => {
        if (event.target === modal) closeCommunityBossEventModal();
    });
    document.body.appendChild(modal);
    return modal;
}

function renderCommunityBossEventModal() {
    const body = document.getElementById("community-boss-event-modal-body");
    if (!body) return;

    const state = getCommunityBossDisplayState();
    body.innerHTML = `
        <section class="community-boss-event community-boss-modal-event community-boss-season-${COMMUNITY_BOSS_EVENT.season}" aria-live="polite">
            <div class="community-boss-modal-heading">
                <span class="community-boss-kicker">${COMMUNITY_BOSS_EVENT.seasonLabel}</span>
                <h2 id="community-boss-modal-title">${COMMUNITY_BOSS_EVENT.title}</h2>
                <p>${getCommunityBossDescription()}</p>
            </div>
            <div class="community-boss-progress-shell community-boss-modal-progress">
                <div class="community-boss-progress-meta">
                    <span>${state.wins.toLocaleString()} / ${state.target.toLocaleString()} global wins</span>
                    <span>${Math.floor(state.progressPercent)}%</span>
                </div>
                <div class="community-boss-progress" aria-label="Global ${COMMUNITY_BOSS_EVENT.bossName} progress">
                    <div class="community-boss-progress-fill" style="width:${state.progressPercent}%"></div>
                </div>
                <div class="community-boss-status">${state.timerText}</div>
            </div>
            <div class="community-boss-modal-lower">
                <div class="community-boss-reward">
                    ${getCommunityBossRewardsMarkup(state.wins)}
                </div>
                <div class="community-boss-modal-actions">
                    <p>${state.contributionCopy}</p>
                    <div class="community-boss-actions">
                        <button class="primary" type="button" onclick="navigate('infinite.html')">Play Infinite</button>
                        <button type="button" onclick="navigate('Daily/index.html')">Daily Challenge</button>
                        ${isCommunityBossMilestoneEvent() ? "" : `<button type="button" onclick="openCommunityBossRanksModal()">Ranks</button>`}
                        <button id="community-boss-modal-claim-btn" type="button">${state.claimLabel}</button>
                    </div>
                </div>
            </div>
        </section>
    `;

    const claimBtn = document.getElementById("community-boss-modal-claim-btn");
    if (claimBtn) {
        claimBtn.onclick = claimCommunityBossReward;
        claimBtn.classList.toggle("primary", state.canClaim);
        claimBtn.disabled = Boolean(currentUser && !state.canClaim);
    }
}

function openCommunityBossEventModal() {
    ensureCommunityBossStyles();
    const modal = ensureCommunityBossEventModal();
    renderCommunityBossEventModal();
    modal.classList.remove("hidden");
}

function closeCommunityBossEventModal() {
    document.getElementById("community-boss-event-modal")?.classList.add("hidden");
}

async function getCurrentCommunityBossReward() {
    const topContributors = await getCommunityBossTopContributors(2);
    const currentRank = topContributors.find(row => row.uid === currentUser?.uid)?.rank || null;
    return getCommunityBossRewardForRank(currentRank);
}

function ensureCommunityBossStyles() {
    if (document.getElementById("community-boss-event-styles")) return;
    const style = document.createElement("style");
    style.id = "community-boss-event-styles";
    style.textContent = `
        .community-boss-event {
            --community-boss-accent: #ffd78c;
            --community-boss-accent-soft: rgba(255, 202, 123, 0.14);
            --community-boss-border: rgba(255, 202, 123, 0.34);
            --community-boss-bg:
                radial-gradient(circle at top left, rgba(255, 220, 134, 0.18), transparent 36%),
                radial-gradient(circle at 88% 18%, rgba(255, 118, 92, 0.14), transparent 28%),
                linear-gradient(135deg, rgba(5, 38, 54, 0.94), rgba(12, 70, 84, 0.9));
            --community-boss-progress: linear-gradient(90deg, #57e5d4, #ffd36f, #ff8f70);
            --community-boss-primary: linear-gradient(135deg, #ffd36f, #ff8f70);
            --community-boss-primary-text: #122634;
            width: min(1120px, calc(100% - 32px));
            margin: 18px auto;
            padding: 18px;
            border: 1px solid var(--community-boss-border);
            border-radius: 20px;
            background: var(--community-boss-bg);
            color: #f4fdff;
            box-shadow: 0 18px 42px rgba(0, 0, 0, 0.28);
            box-sizing: border-box;
        }
        .community-boss-season-summer {
            --community-boss-accent: #ffe08f;
            --community-boss-accent-soft: rgba(255, 196, 87, 0.16);
            --community-boss-border: rgba(255, 196, 87, 0.34);
            --community-boss-bg:
                radial-gradient(circle at top left, rgba(255, 225, 130, 0.22), transparent 36%),
                radial-gradient(circle at 88% 18%, rgba(64, 196, 255, 0.15), transparent 30%),
                linear-gradient(135deg, rgba(8, 62, 82, 0.95), rgba(10, 106, 116, 0.9));
            --community-boss-progress: linear-gradient(90deg, #63e6d2, #ffe08f, #ff8f57);
            --community-boss-primary: linear-gradient(135deg, #ffe08f, #ff8f57);
        }
        .community-boss-season-christmas {
            --community-boss-accent: #d8fff2;
            --community-boss-accent-soft: rgba(127, 232, 201, 0.15);
            --community-boss-border: rgba(127, 232, 201, 0.32);
            --community-boss-bg:
                radial-gradient(circle at top left, rgba(127, 232, 201, 0.18), transparent 36%),
                radial-gradient(circle at 88% 18%, rgba(255, 92, 92, 0.15), transparent 30%),
                linear-gradient(135deg, rgba(10, 55, 46, 0.96), rgba(72, 19, 36, 0.9));
            --community-boss-progress: linear-gradient(90deg, #70e8bd, #f5fff9, #ff6f7a);
            --community-boss-primary: linear-gradient(135deg, #d8fff2, #ff6f7a);
            --community-boss-primary-text: #103126;
        }
        .community-boss-season-halloween {
            --community-boss-accent: #ffd3a1;
            --community-boss-accent-soft: rgba(190, 108, 255, 0.16);
            --community-boss-border: rgba(190, 108, 255, 0.32);
            --community-boss-bg:
                radial-gradient(circle at top left, rgba(190, 108, 255, 0.2), transparent 36%),
                radial-gradient(circle at 88% 18%, rgba(255, 132, 50, 0.16), transparent 30%),
                linear-gradient(135deg, rgba(43, 22, 69, 0.96), rgba(26, 14, 39, 0.92));
            --community-boss-progress: linear-gradient(90deg, #b86cff, #ffcc7a, #8cffb8);
            --community-boss-primary: linear-gradient(135deg, #b86cff, #ff8f42);
            --community-boss-primary-text: #21112f;
        }
        body.home-page .community-boss-event {
            margin-top: 0;
            margin-bottom: 10px;
            padding: 10px 12px;
            width: min(980px, calc(100% - 36px));
            border-radius: 16px;
            box-shadow: 0 10px 24px rgba(0, 0, 0, 0.22);
        }
        body.home-page .community-boss-grid {
            grid-template-columns: minmax(0, 1fr) minmax(240px, 0.88fr);
            gap: 12px;
        }
        body.home-page .community-boss-kicker {
            padding: 4px 8px;
            font-size: 10px;
        }
        body.home-page .community-boss-event h2 {
            margin: 6px 0 4px;
            font-size: clamp(19px, 2.1vw, 25px);
        }
        body.home-page .community-boss-event p {
            font-size: 12px;
            line-height: 1.35;
        }
        body.home-page .community-boss-progress-shell {
            gap: 6px;
        }
        body.home-page .community-boss-progress {
            height: 11px;
        }
        body.home-page .community-boss-progress-meta,
        body.home-page .community-boss-status {
            font-size: 11px;
        }
        body.home-page .community-boss-reward {
            padding: 8px 10px;
        }
        body.home-page .community-boss-reward strong {
            margin-bottom: 2px;
        }
        body.home-page .community-boss-rewards-list {
            gap: 2px;
        }
        body.home-page .community-boss-rewards-list li {
            grid-template-columns: 96px minmax(0, 1fr);
            gap: 8px;
            align-items: baseline;
            padding: 3px 0;
        }
        body.home-page .community-boss-rewards-list b,
        body.home-page .community-boss-rewards-list span {
            font-size: 11px;
            line-height: 1.2;
        }
        body.home-page .community-boss-actions {
            gap: 7px;
            margin-top: 8px;
        }
        body.home-page .community-boss-actions button {
            min-height: 32px;
            padding: 7px 10px;
            border-radius: 10px;
            font-size: 12px;
        }
        body.home-page .community-boss-status {
            margin-top: 5px;
            min-height: 14px;
        }
        .community-boss-grid {
            display: grid;
            grid-template-columns: minmax(0, 1.15fr) minmax(260px, 0.85fr);
            gap: 18px;
            align-items: center;
        }
        .community-boss-kicker {
            display: inline-flex;
            align-items: center;
            width: fit-content;
            padding: 5px 9px;
            border-radius: 999px;
            background: var(--community-boss-accent-soft);
            color: var(--community-boss-accent);
            font-size: 11px;
            font-weight: 900;
            letter-spacing: 0.08em;
            text-transform: uppercase;
        }
        .community-boss-event h2 {
            margin: 9px 0 7px;
            font-size: clamp(24px, 3vw, 36px);
            line-height: 1.05;
            letter-spacing: 0;
        }
        .community-boss-event p {
            margin: 0;
            color: rgba(244, 253, 255, 0.82);
            line-height: 1.5;
            font-size: 14px;
        }
        .community-boss-progress-shell {
            display: grid;
            gap: 10px;
        }
        .community-boss-progress-meta {
            display: flex;
            justify-content: space-between;
            gap: 12px;
            color: #dff9ff;
            font-size: 13px;
            font-weight: 800;
        }
        .community-boss-progress {
            position: relative;
            height: 16px;
            overflow: hidden;
            border-radius: 999px;
            background: rgba(1, 18, 29, 0.72);
            border: 1px solid rgba(255, 255, 255, 0.14);
        }
        .community-boss-progress-fill {
            width: 0%;
            height: 100%;
            border-radius: inherit;
            background: var(--community-boss-progress);
            transition: width 0.4s ease;
        }
        .community-boss-reward {
            padding: 13px;
            border-radius: 14px;
            border: 1px solid rgba(255, 255, 255, 0.12);
            background: rgba(255, 255, 255, 0.07);
        }
        .community-boss-reward strong {
            display: block;
            color: var(--community-boss-accent);
            font-size: 12px;
            text-transform: uppercase;
            letter-spacing: 0.07em;
            margin-bottom: 5px;
        }
        .community-boss-rewards-list {
            display: grid;
            gap: 8px;
            margin: 0;
            padding: 0;
            list-style: none;
        }
        .community-boss-rewards-list li {
            display: grid;
            gap: 2px;
            padding: 8px 0;
            border-top: 1px solid rgba(255, 255, 255, 0.1);
        }
        .community-boss-rewards-list li:first-child {
            border-top: 0;
            padding-top: 0;
        }
        .community-boss-rewards-list b {
            color: var(--community-boss-accent);
            font-size: 13px;
        }
        .community-boss-rewards-list span {
            color: rgba(244, 253, 255, 0.82);
            font-size: 12px;
            line-height: 1.35;
        }
        .community-boss-rewards-list em {
            display: block;
            margin-top: 3px;
            color: #a7edf7;
            font-style: normal;
            font-weight: 900;
        }
        .community-boss-rewards-list li.claimed em {
            color: #9df7bc;
        }
        .community-boss-actions {
            display: flex;
            flex-wrap: wrap;
            gap: 10px;
            margin-top: 14px;
        }
        .community-boss-actions button {
            min-height: 42px;
            border: 0;
            border-radius: 12px;
            padding: 10px 14px;
            font-weight: 900;
            cursor: pointer;
            background: rgba(255, 255, 255, 0.13);
            color: #f8fdff;
        }
        .community-boss-actions button.primary {
            background: var(--community-boss-primary);
            color: var(--community-boss-primary-text);
        }
        .community-boss-actions button:disabled {
            cursor: default;
            opacity: 0.62;
        }
        .community-boss-status {
            margin-top: 9px;
            min-height: 18px;
            color: #a7edf7;
            font-size: 12px;
            font-weight: 800;
        }
        .community-boss-ranks-modal {
            position: fixed;
            inset: 0;
            z-index: 10001;
            display: flex;
            align-items: center;
            justify-content: center;
            padding: 18px;
            background: rgba(1, 14, 24, 0.72);
            backdrop-filter: blur(8px);
        }
        .community-boss-ranks-modal.hidden {
            display: none;
        }
        .community-boss-ranks-card {
            position: relative;
            width: min(420px, 100%);
            max-height: min(72vh, 560px);
            overflow-y: auto;
            padding: 18px;
            border-radius: 18px;
            border: 1px solid rgba(255, 211, 111, 0.28);
            background:
                radial-gradient(circle at top left, rgba(255, 211, 111, 0.16), transparent 42%),
                linear-gradient(145deg, rgba(5, 38, 54, 0.98), rgba(9, 28, 45, 0.98));
            color: #f4fdff;
            box-shadow: 0 22px 55px rgba(0, 0, 0, 0.38);
        }
        .community-boss-ranks-close {
            position: absolute;
            top: 10px;
            right: 10px;
            width: 32px;
            height: 32px;
            border: 0;
            border-radius: 10px;
            background: rgba(255, 255, 255, 0.1);
            color: #f4fdff;
            cursor: pointer;
            font-size: 22px;
            line-height: 1;
        }
        .community-boss-ranks-card h3 {
            margin: 10px 0 14px;
            font-size: 24px;
            letter-spacing: 0;
        }
        .community-boss-ranks-list {
            display: grid;
            gap: 9px;
        }
        .community-boss-rank-row {
            display: grid;
            grid-template-columns: 46px 42px 1fr;
            gap: 10px;
            align-items: center;
            padding: 11px;
            border-radius: 12px;
            background: rgba(255, 255, 255, 0.075);
            border: 1px solid rgba(255, 255, 255, 0.1);
        }
        .community-boss-rank-row.top-1 {
            border-color: rgba(255, 211, 111, 0.5);
            background: rgba(255, 211, 111, 0.12);
        }
        .community-boss-rank-row.top-2 {
            border-color: rgba(172, 221, 255, 0.42);
            background: rgba(172, 221, 255, 0.1);
        }
        .community-boss-rank-number {
            display: inline-flex;
            align-items: center;
            justify-content: center;
            min-height: 34px;
            border-radius: 10px;
            background: rgba(0, 0, 0, 0.22);
            color: #ffd78c;
            font-weight: 900;
        }
        .community-boss-rank-avatar {
            width: 42px;
            height: 42px;
            border-radius: 50%;
            object-fit: cover;
            border: 2px solid rgba(255, 211, 111, 0.32);
            background: rgba(0, 0, 0, 0.24);
        }
        .community-boss-rank-row.top-1 .community-boss-rank-avatar {
            border-color: rgba(255, 211, 111, 0.75);
        }
        .community-boss-rank-row.top-2 .community-boss-rank-avatar {
            border-color: rgba(172, 221, 255, 0.64);
        }
        .community-boss-rank-row strong,
        .community-boss-rank-row span {
            display: block;
        }
        .community-boss-rank-row strong {
            font-size: 14px;
        }
        .community-boss-rank-row span,
        .community-boss-ranks-empty {
            color: rgba(244, 253, 255, 0.78);
            font-size: 12px;
            line-height: 1.35;
        }
        @media (max-width: 760px) {
            .community-boss-grid {
                grid-template-columns: 1fr;
            }
            .community-boss-event {
                width: min(100% - 20px, 560px);
                padding: 15px;
            }
            body.home-page .community-boss-grid {
                grid-template-columns: 1fr;
            }
            body.home-page .community-boss-rewards-list li {
                grid-template-columns: 1fr;
                gap: 0;
            }
        }
    `;
    document.head.appendChild(style);
}

function ensureCommunityBossPanel() {
    if (COMMUNITY_BOSS_DISPLAY_DISABLED_FOR_NOW) return;
    const pageKind = getCommunityBossPageKind();
    if (!pageKind || document.getElementById("community-boss-event")) return;

    ensureCommunityBossStyles();
    const panel = document.createElement("section");
    panel.id = "community-boss-event";
    panel.className = `community-boss-event community-boss-${pageKind} community-boss-season-${COMMUNITY_BOSS_EVENT.season}`;
    panel.setAttribute("aria-live", "polite");

    if (pageKind === "home") {
        const homeSection = document.querySelector(".home-section");
        if (homeSection?.parentNode) {
            homeSection.parentNode.insertBefore(panel, homeSection);
        }
    } else {
        const gameContainer = document.querySelector(".game-container");
        if (gameContainer?.parentNode) {
            gameContainer.parentNode.insertBefore(panel, gameContainer);
        }
    }

    renderCommunityBossPanel();
}

function renderCommunityBossPanel() {
    const panel = document.getElementById("community-boss-event");
    if (!panel) {
        if (!document.getElementById("community-boss-event-modal")?.classList.contains("hidden")) {
            renderCommunityBossEventModal();
        }
        return;
    }

    const state = getCommunityBossDisplayState();

    panel.innerHTML = `
        <div class="community-boss-grid">
            <div>
                <span class="community-boss-kicker">${COMMUNITY_BOSS_EVENT.seasonLabel}</span>
                <h2>${COMMUNITY_BOSS_EVENT.title}</h2>
                <p>${getCommunityBossDescription()}</p>
                <div class="community-boss-actions">
                    <button class="primary" type="button" onclick="navigate('infinite.html')">Play Infinite</button>
                    <button type="button" onclick="navigate('Daily/index.html')">Daily Challenge</button>
                    ${isCommunityBossMilestoneEvent() ? "" : `<button type="button" onclick="openCommunityBossRanksModal()">Ranks</button>`}
                    <button id="community-boss-claim-btn" type="button">${state.claimLabel}</button>
                </div>
                <div class="community-boss-status" id="community-boss-status">${state.timerText}</div>
            </div>
            <div class="community-boss-progress-shell">
                <div class="community-boss-progress-meta">
                    <span>${state.wins.toLocaleString()} / ${state.target.toLocaleString()} wins</span>
                    <span>${Math.floor(state.progressPercent)}%</span>
                </div>
                <div class="community-boss-progress" aria-label="Community boss progress">
                    <div class="community-boss-progress-fill" style="width:${state.progressPercent}%"></div>
                </div>
                <div class="community-boss-reward">
                    ${getCommunityBossRewardsMarkup(state.wins)}
                </div>
                <p>${state.contributionCopy}</p>
            </div>
        </div>
    `;

    const claimBtn = document.getElementById("community-boss-claim-btn");
    if (claimBtn) {
        claimBtn.onclick = claimCommunityBossReward;
        claimBtn.classList.toggle("primary", state.canClaim);
        claimBtn.disabled = Boolean(currentUser && !state.canClaim);
    }

    if (!document.getElementById("community-boss-event-modal")?.classList.contains("hidden")) {
        renderCommunityBossEventModal();
    }
}

function ensureCommunityBossUiTimer() {
    if (COMMUNITY_BOSS_DISPLAY_DISABLED_FOR_NOW) return;
    ensureCommunityBossPanel();
    if (communityBossUiTimer) return;
    if (!getCommunityBossPageKind()) return;
    communityBossUiTimer = setInterval(() => {
        if (!getCommunityBossPageKind()) {
            clearInterval(communityBossUiTimer);
            communityBossUiTimer = null;
            return;
        }
        renderCommunityBossPanel();
    }, 1000);
}

function setupCommunityBossEventListener() {
    const start = () => {
        ensureCommunityBossUiTimer();
        const eventRef = getCommunityBossDocRef();
        if (!eventRef || communityBossUnsubscribe) return;

        communityBossUnsubscribe = eventRef.onSnapshot(snapshot => {
            communityBossState = snapshot.exists ? (snapshot.data() || {}) : { wins: 0 };
            renderCommunityBossPanel();
        }, error => {
            console.warn("Community boss event listener failed:", error);
            communityBossState = communityBossState || { wins: 0 };
            renderCommunityBossPanel();
        });
    };

    if (document.readyState === "loading") {
        document.addEventListener("DOMContentLoaded", start, { once: true });
    } else {
        start();
    }
}

function getCommunityBossContributionStorageKey(mode, options = {}) {
    if (!currentUser?.uid) return "";
    if (mode !== "daily") return "";
    const contributionKey = options.contributionKey || getUtcDateKey();
    return `communityBossContribution_${COMMUNITY_BOSS_EVENT.id}_${currentUser.uid}_${mode}_${contributionKey}`;
}

async function contributeCommunityBossWin(mode = "infinite", options = {}) {
    const normalizedMode = mode === "daily" ? "daily" : "infinite";
    if (!isCommunityBossContributionOpen()) return { contributed: false, reason: "inactive" };
    if (!currentUser || !db || typeof firebase === "undefined") {
        return { contributed: false, reason: "login-required" };
    }

    const storageKey = getCommunityBossContributionStorageKey(normalizedMode, options);
    if (storageKey && localStorage.getItem(storageKey) === "true") {
        return { contributed: false, reason: "already-counted" };
    }

    const eventRef = getCommunityBossDocRef();
    const contributorRef = getCommunityBossContributorRef();
    if (!eventRef) return { contributed: false, reason: "unavailable" };
    if (!contributorRef) return { contributed: false, reason: "contributor-unavailable" };

    try {
        let didIncrement = false;
        const contributionValue = getCommunityBossContributionMultiplier();
        await db.runTransaction(async transaction => {
            const snapshot = await transaction.get(eventRef);
            const contributorSnapshot = await transaction.get(contributorRef);
            const currentWins = Math.max(0, Number(snapshot.data()?.wins) || 0);
            if (currentWins >= COMMUNITY_BOSS_EVENT.targetWins || isCommunityBossExpired()) return;
            const profileData = getCurrentProfileData();
            const contributorUsername = String(profileData.username || currentUser.email?.split("@")[0] || "Anonymous").slice(0, 32);
            const contributorProfilePicture = resolveCommunityBossProfilePicturePath(
                profileData.profilePicture || profileData.profilePic
            );

            const payload = {
                wins: firebase.firestore.FieldValue.increment(contributionValue),
                updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
                lastContributionMode: normalizedMode,
                lastContributionUid: currentUser.uid
            };

            if (snapshot.exists) {
                transaction.update(eventRef, payload);
            } else {
                transaction.set(eventRef, {
                    wins: contributionValue,
                    updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
                    lastContributionMode: normalizedMode,
                    lastContributionUid: currentUser.uid
                });
            }

            if (contributorSnapshot.exists) {
                transaction.update(contributorRef, {
                    wins: firebase.firestore.FieldValue.increment(contributionValue),
                    username: contributorUsername,
                    profilePicture: contributorProfilePicture,
                    updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
                    lastContributionMode: normalizedMode
                });
            } else {
                transaction.set(contributorRef, {
                    uid: currentUser.uid,
                    username: contributorUsername,
                    profilePicture: contributorProfilePicture,
                    wins: contributionValue,
                    firstContributionAt: firebase.firestore.FieldValue.serverTimestamp(),
                    updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
                    lastContributionMode: normalizedMode
                });
            }
            didIncrement = true;
        });

        if (didIncrement) {
            if (storageKey) localStorage.setItem(storageKey, "true");
            showNotification(`Community boss progress +${contributionValue}`, "success", 2600);
            renderCommunityBossPanel();
            return { contributed: true };
        }
        return { contributed: false, reason: "complete" };
    } catch (error) {
        console.warn("Unable to contribute community boss win:", error);
        return { contributed: false, reason: "error" };
    }
}

async function claimCommunityBossReward() {
    if (!currentUser) {
        openLoginModal();
        return;
    }
    if (!db) {
        showNotification("Community event is unavailable right now.", "error", 3200);
        return;
    }

    const eventRef = getCommunityBossDocRef();
    const snapshot = eventRef ? await eventRef.get().catch(() => null) : null;
    const serverWins = snapshot?.exists ? Math.max(0, Number(snapshot.data()?.wins) || 0) : 0;
    const wins = Math.max(serverWins, getCommunityBossWins());
    const profileData = getCurrentProfileData();

    if (isCommunityBossMilestoneEvent()) {
        const pendingRewards = getPendingCommunityBossRewards(wins, profileData);
        if (!pendingRewards.length) {
            const nextReward = getCommunityBossRewardTiers().find(reward => wins < (Number(reward.goal) || 0));
            const message = getUnlockedCommunityBossRewards(wins).length
                ? "You already claimed every unlocked community reward."
                : nextReward
                ? `Reach ${Number(nextReward.goal).toLocaleString()} community wins to unlock the first reward.`
                : "No community rewards are unlocked right now.";
            showNotification(message, "info", 3200);
            renderCommunityBossPanel();
            return;
        }

        const claimTime = Date.now();
        const rewardBadgeId = COMMUNITY_BOSS_EVENT.rewardBadgeId;
        const unlockedBadgesBefore = getUnlockedBadgeIds(profileData);
        const shouldGrantBadge = pendingRewards.some(reward => reward.badge !== false);
        const grantsNewBadge = shouldGrantBadge && !unlockedBadgesBefore.includes(rewardBadgeId);
        const claimedRewardIds = getClaimedCommunityBossRewardIds(profileData);
        const existingClaim = getCommunityBossRewardClaim(profileData) || {};
        const existingClaims = existingClaim.claims && typeof existingClaim.claims === "object" ? existingClaim.claims : {};
        const existingCrates = existingClaim.crates && typeof existingClaim.crates === "object" ? existingClaim.crates : {};
        const existingMilestones = Array.isArray(existingClaim.claimedMilestones) ? existingClaim.claimedMilestones : [];
        const claimedMilestones = new Set(existingMilestones.map(goal => Number(goal)).filter(Boolean));
        const nextClaims = { ...existingClaims };
        const totalCrates = { ...existingCrates };
        const cratesAwarded = {};
        let totalXpAwarded = 0;

        pendingRewards.forEach(reward => {
            const rewardId = String(reward.id);
            const rewardCrateId = reward.crateId || COMMUNITY_BOSS_EVENT.crateId;
            const rawRewardCrateCount = Math.max(0, Number(reward.crateCount) || 0);
            const rewardCrateCount = isSeasonalCrateId(rewardCrateId) && !isSeasonalCrateThemeActive(rewardCrateId)
                ? 0
                : rawRewardCrateCount;
            const rewardXp = Math.max(0, Number(reward.xp) || 0);
            const rewardGoal = Number(reward.goal) || 0;

            claimedRewardIds.add(rewardId);
            if (rewardGoal) claimedMilestones.add(rewardGoal);
            totalXpAwarded += rewardXp;
            if (rewardCrateCount > 0) {
                cratesAwarded[rewardCrateId] = (cratesAwarded[rewardCrateId] || 0) + rewardCrateCount;
                totalCrates[rewardCrateId] = (Number(totalCrates[rewardCrateId]) || 0) + rewardCrateCount;
            }
            nextClaims[rewardId] = {
                claimedAt: claimTime,
                goal: rewardGoal,
                xp: rewardXp,
                crates: rewardCrateCount > 0 ? { [rewardCrateId]: rewardCrateCount } : {},
                crateId: rewardCrateId,
                crateCount: rewardCrateCount,
                badgeId: shouldGrantBadge ? rewardBadgeId : null
            };
        });

        profileData.totalXP = (Number(profileData.totalXP) || 0) + totalXpAwarded;
        applySharkPassXpGain(profileData, totalXpAwarded);
        const inventory = getCrateInventory(profileData);
        Object.entries(cratesAwarded).forEach(([crateId, count]) => {
            inventory[crateId] = (inventory[crateId] || 0) + count;
        });
        profileData.crateInventory = normalizeCrateInventory(inventory);
        if (Object.values(cratesAwarded).some(count => Number(count) > 0)) {
            markCrateInventoryChanged(profileData, claimTime);
        }

        if (shouldGrantBadge) {
            profileData.unlockedBadges = [
                ...new Set([
                    ...unlockedBadgesBefore,
                    rewardBadgeId
                ])
            ];
            profileData.equippedBadge = rewardBadgeId;
        }

        profileData.communityBossRewards = {
            ...(profileData.communityBossRewards && typeof profileData.communityBossRewards === "object" ? profileData.communityBossRewards : {}),
            [COMMUNITY_BOSS_EVENT.id]: {
                claimedAt: Number(existingClaim.claimedAt) || claimTime,
                updatedAt: claimTime,
                rewardMode: "milestone",
                claimedRewardIds: [...claimedRewardIds],
                claimedMilestones: [...claimedMilestones].sort((a, b) => a - b),
                xp: (Number(existingClaim.xp) || 0) + totalXpAwarded,
                crates: totalCrates,
                claims: nextClaims,
                badgeId: shouldGrantBadge ? rewardBadgeId : existingClaim.badgeId || null
            }
        };
        profileData.lastUpdated = Date.now();

        saveUserProfileLocally(profileData);
        await db.collection("userStats").doc(currentUser.uid).set({
            totalXP: profileData.totalXP,
            ...getSharkPassSyncPayload(profileData),
            crateInventory: profileData.crateInventory,
            crateInventoryUpdatedAt: getCrateInventoryUpdatedAt(profileData),
            unlockedBadges: getUnlockedBadgeIds(profileData),
            equippedBadge: getEquippedBadge(),
            communityBossRewards: profileData.communityBossRewards,
            lastUpdated: new Date()
        }, { merge: true });

        updateProfileDisplay(profileData);
        updateProfileBadgeUI();
        renderCratesButton();
        renderCommunityBossPanel();

        const rewardParts = [`${totalXpAwarded.toLocaleString()} XP`];
        const crateText = formatCommunityBossCrateAwards(cratesAwarded);
        if (crateText) rewardParts.push(crateText);
        if (grantsNewBadge) rewardParts.push(`${COMMUNITY_BOSS_EVENT.rewardBadgeName} badge`);
        showNotification(`Community rewards claimed: ${rewardParts.join(", ")}.`, "success", 5600);
        return;
    }

    if (!isCommunityBossComplete(wins)) {
        showNotification(`The ${COMMUNITY_BOSS_EVENT.bossName} is not defeated yet.`, "info", 3000);
        return;
    }

    if (hasClaimedCommunityBossReward(profileData)) {
        showNotification("You already claimed this community reward.", "info", 3000);
        renderCommunityBossPanel();
        return;
    }

    const reward = await getCurrentCommunityBossReward();
    const rewardBadgeId = COMMUNITY_BOSS_EVENT.rewardBadgeId;
    const rewardCrateId = reward.crateId || COMMUNITY_BOSS_EVENT.crateId;
    const rawRewardCrateCount = Math.max(0, Number(reward.crateCount) || 0);
    const rewardCrateCount = isSeasonalCrateId(rewardCrateId) && !isSeasonalCrateThemeActive(rewardCrateId)
        ? 0
        : rawRewardCrateCount;

    profileData.totalXP = (Number(profileData.totalXP) || 0) + reward.xp;
    applySharkPassXpGain(profileData, reward.xp);
    const inventory = getCrateInventory(profileData);
    if (rewardCrateCount > 0) {
        inventory[rewardCrateId] = (inventory[rewardCrateId] || 0) + rewardCrateCount;
    }
    profileData.crateInventory = normalizeCrateInventory(inventory);
    if (rewardCrateCount > 0) {
        markCrateInventoryChanged(profileData);
    }
    profileData.unlockedBadges = [
        ...new Set([
            ...(Array.isArray(profileData.unlockedBadges) ? profileData.unlockedBadges : ["starter"]),
            rewardBadgeId
        ])
    ];
    profileData.equippedBadge = rewardBadgeId;
    profileData.communityBossRewards = {
        ...(profileData.communityBossRewards && typeof profileData.communityBossRewards === "object" ? profileData.communityBossRewards : {}),
        [COMMUNITY_BOSS_EVENT.id]: {
            claimedAt: Date.now(),
            rank: reward.rank,
            xp: reward.xp,
            crates: rewardCrateCount > 0 ? { [rewardCrateId]: rewardCrateCount } : {},
            crateId: rewardCrateId,
            crateCount: rewardCrateCount,
            badgeId: rewardBadgeId
        }
    };
    profileData.lastUpdated = Date.now();

    saveUserProfileLocally(profileData);
    await db.collection("userStats").doc(currentUser.uid).set({
        totalXP: profileData.totalXP,
        ...getSharkPassSyncPayload(profileData),
        crateInventory: profileData.crateInventory,
        crateInventoryUpdatedAt: getCrateInventoryUpdatedAt(profileData),
        unlockedBadges: getUnlockedBadgeIds(profileData),
        equippedBadge: getEquippedBadge(),
        communityBossRewards: profileData.communityBossRewards,
        lastUpdated: new Date()
    }, { merge: true });

    updateProfileDisplay(profileData);
    updateProfileBadgeUI();
    renderCratesButton();
    renderCommunityBossPanel();
    const rewardParts = [`${reward.xp.toLocaleString()} XP`];
    if (rewardCrateCount > 0) rewardParts.push(`${rewardCrateCount.toLocaleString()} ${getCommunityBossCrateName(rewardCrateId)}${rewardCrateCount === 1 ? "" : "s"}`);
    rewardParts.push(`${COMMUNITY_BOSS_EVENT.rewardBadgeName} badge`);
    showNotification(`${reward.label} reward claimed: ${rewardParts.join(", ")}.`, "success", 5600);
}

function getProfileAccountCreatedMs(profileData = {}) {
    const createdAt = profileData.createdAt || profileData.accountCreatedAt || profileData.joinedAt || null;
    if (!createdAt) return 0;
    if (typeof createdAt.toMillis === "function") return createdAt.toMillis();
    if (typeof createdAt.seconds === "number") return createdAt.seconds * 1000;
    if (createdAt instanceof Date) return createdAt.getTime();
    if (typeof createdAt === "number") return createdAt;
    const parsed = Date.parse(String(createdAt));
    return Number.isFinite(parsed) ? parsed : 0;
}

function isEligibleForCladoselacheParticipation(profileData = getCurrentProfileData()) {
    const createdMs = getProfileAccountCreatedMs(profileData);
    return !createdMs || createdMs <= CLADOSELACHE_PARTICIPATION_ACCOUNT_CUTOFF_MS;
}

async function claimGlobalCladoselacheParticipationCrate(options = {}) {
    const silentIfUnavailable = Boolean(options.silentIfUnavailable);
    if (!currentUser) {
        if (!silentIfUnavailable) openLoginModal();
        return false;
    }
    if (!db) {
        if (!silentIfUnavailable) showNotification("Participation reward is unavailable right now.", "error", 3200);
        return false;
    }

    const profileData = getCurrentProfileData();
    if (!isEligibleForCladoselacheParticipation(profileData)) {
        if (!silentIfUnavailable) showNotification("This participation reward is for accounts from the Global Cladoselache event.", "info", 3600);
        return false;
    }
    const allRewards = profileData.communityBossRewards && typeof profileData.communityBossRewards === "object"
        ? { ...profileData.communityBossRewards }
        : {};
    const cladoselacheRewards = allRewards[CLADOSELACHE_PARTICIPATION_EVENT_ID]
        && typeof allRewards[CLADOSELACHE_PARTICIPATION_EVENT_ID] === "object"
        ? { ...allRewards[CLADOSELACHE_PARTICIPATION_EVENT_ID] }
        : {};
    const claims = cladoselacheRewards.claims && typeof cladoselacheRewards.claims === "object"
        ? { ...cladoselacheRewards.claims }
        : {};

    if (cladoselacheRewards.participationClaimedAt || claims[CLADOSELACHE_PARTICIPATION_REWARD_ID]) {
        if (!silentIfUnavailable) showNotification("You already claimed the Global Cladoselache participation crate.", "info", 3200);
        return false;
    }

    const claimTime = Date.now();
    const inventory = getCrateInventory(profileData);
    inventory.reef = (Number(inventory.reef) || 0) + 1;
    profileData.crateInventory = normalizeCrateInventory(inventory);
    markCrateInventoryChanged(profileData, claimTime);

    claims[CLADOSELACHE_PARTICIPATION_REWARD_ID] = {
        claimedAt: claimTime,
        crateId: "reef",
        crateCount: 1,
        crates: { reef: 1 },
        participation: true
    };
    profileData.communityBossRewards = {
        ...allRewards,
        [CLADOSELACHE_PARTICIPATION_EVENT_ID]: {
            ...cladoselacheRewards,
            updatedAt: claimTime,
            participationClaimedAt: claimTime,
            participationRewardId: CLADOSELACHE_PARTICIPATION_REWARD_ID,
            crates: {
                ...(cladoselacheRewards.crates && typeof cladoselacheRewards.crates === "object" ? cladoselacheRewards.crates : {}),
                reef: (Number(cladoselacheRewards.crates?.reef) || 0) + 1
            },
            claims
        }
    };

    saveUserProfileLocally(profileData);
    try {
        await db.collection("userStats").doc(currentUser.uid).set({
            crateInventory: profileData.crateInventory,
            crateInventoryUpdatedAt: getCrateInventoryUpdatedAt(profileData),
            communityBossRewards: profileData.communityBossRewards,
            lastUpdated: new Date()
        }, { merge: true });
    } catch (error) {
        console.warn("Unable to sync Global Cladoselache participation reward:", error);
        if (!silentIfUnavailable) showNotification("Participation crate saved locally but sync failed. Try again later.", "error", 3800);
        return true;
    }

    renderCratesButton();
    showNotification("Global Cladoselache participation reward claimed: 1 Cosmetic Crate.", "success", 4200);
    return true;
}

window.contributeCommunityBossWin = contributeCommunityBossWin;
window.claimCommunityBossReward = claimCommunityBossReward;
window.claimGlobalCladoselacheParticipationCrate = claimGlobalCladoselacheParticipationCrate;
window.openCommunityBossRanksModal = openCommunityBossRanksModal;
window.closeCommunityBossRanksModal = closeCommunityBossRanksModal;
window.openCommunityBossEventModal = openCommunityBossEventModal;
window.closeCommunityBossEventModal = closeCommunityBossEventModal;

const LOST_TREASURES_EVENT_ID = "lost-treasures-2026";
const LOST_TREASURES_BOTTLES = [
    { id: "barnacle", name: "Barnacle Bottle", image: "images/lostTreasure/Bottles/Bottle1.png", scrollCount: 3, rareChance: 0.001, maxRareCards: 1 },
    { id: "red-sea", name: "Red Sea Bottle", image: "images/lostTreasure/Bottles/Bottle2.png", scrollCount: 5, rareChance: 0.01, maxRareCards: 1 },
    { id: "seafoam", name: "Seafoam Bottle", image: "images/lostTreasure/Bottles/Bottle3.png", scrollCount: 7, rareChance: 0.05, maxRareCards: 2 },
    { id: "celestial", name: "Celestial Bottle", image: "images/lostTreasure/Bottles/BottleRare.png", scrollCount: 1, rareChance: 1, maxRareCards: 1, rareOnly: true }
];
const LOST_TREASURES_BOTTLE_IMAGES = LOST_TREASURES_BOTTLES.map(bottle => bottle.image);
const LOST_TREASURES_CARD_IMAGES = Object.freeze({
    common: "images/lostTreasure/Cards/Card.png",
    commonWorn: "images/lostTreasure/Cards/Card2.png",
    rare: "images/lostTreasure/Cards/RareCard.png",
    rareWorn: "images/lostTreasure/Cards/RareCard2.png"
});
const LOST_TREASURES_SPECIES_ART_FILENAMES = Object.freeze({
    "Benthic Broadwings|Torpedo Ray": "RingedTorpedoRay.png",
    "Abyssal Relics|Pointy-nosed Blue Chimaera": "PointyNoseBlueChimaera.png",
    "Gentle Giants|Spinetail Devil Ray": "SpinetailDevilray.png",
    "Ambush Hunters|Brown-banded Bamboo Shark": "BrownBrandedBambooShark.png",
    "Odd Adaptations|Cookiecutter Shark": "CookieCutterShark.png",
    "Odd Adaptations|Japanese Bullhead Shark": "JapeneseBullheadShark.png",
    "Reef Regulars|Blacktip Reef Shark": "BlackTipReefShark.png",
    "Reef Regulars|Blue-spotted Ribbontail Ray": "BlueSpottedRibbontailRay.png",
    "Reef Regulars|Whitetip Reef Shark": "WhiteTipReefShark.png",
    "Miniature Marvels|Smallspotted Catshark": "SmallSpottedCatshark.png",
    "Seafloor Walkers|Brown-banded Bamboo Shark": "BrownBandedBambooShark.png",
    "Seafloor Walkers|Whitespotted Bamboo Shark": "WhiteSpottedBambooShark.png"
});
const LOST_TREASURES_BOTTLE_DROP_CHANCE = 0.36;
const LOST_TREASURES_BOTTLE_DROP_WEIGHTS = Object.freeze({
    barnacle: 64,
    "red-sea": 24,
    seafoam: 10,
    celestial: 2
});
const LOST_TREASURES_LEGACY_BOTTLE_IDS = Object.freeze({
    barnacle: "weathered",
    "red-sea": ["placeholder", "seafoam"],
    seafoam: "barnacle",
    celestial: "rare"
});
const LOST_TREASURES_BOTTLE_ID_ALIASES = Object.freeze(
    {
        weathered: "barnacle",
        placeholder: "red-sea",
        rare: "celestial"
    }
);
const LOST_TREASURES_DAILY_WIN_BOTTLE_ID = "barnacle";
const LOST_TREASURES_STREAK_BOTTLE_REWARDS = Object.freeze([
    { streak: 3, bottleId: "barnacle", amount: 1 },
    { streak: 7, bottleId: "red-sea", amount: 1 },
    { streak: 14, bottleId: "seafoam", amount: 1 },
    { streak: 30, bottleId: "celestial", amount: 1 }
]);
const LOST_TREASURES_DUPLICATE_EXCHANGES = [
    { id: "dupes-red-sea", cost: 10, bottleId: "red-sea", amount: 1, label: "10 Dupes", reward: "Red Sea Bottle" },
    { id: "dupes-seafoam", cost: 25, bottleId: "seafoam", amount: 1, label: "25 Dupes", reward: "Seafoam Bottle" },
    { id: "dupes-celestial", cost: 60, bottleId: "celestial", amount: 1, label: "60 Dupes", reward: "Celestial Bottle" }
];
const LOST_TREASURES_DUPLICATE_BASE_CHANCE = 0.28;
const LOST_TREASURES_DUPLICATE_PROGRESS_BONUS = 0.34;
const LOST_TREASURES_DUPLICATE_MAX_CHANCE = 0.72;
const LOST_TREASURES_RARE_DUPLICATE_VALUE = 3;
const LOST_TREASURES_CATEGORY_PEARL_REWARD = 300;
const LOST_TREASURES_GRAND_PEARL_REWARD = 2500;
const LOST_TREASURES_GRAND_BADGE = Object.freeze({
    id: "treasure-keeper",
    name: "Treasure Keeper",
    emoji: "\u{1F5FA}\uFE0F"
});
const LOST_TREASURES_GRAND_PFPS = Object.freeze([
    {
        name: "Grey Nurse Shark",
        imagePath: "images/lostTreasure/Pfp/GreyNurseShark.png",
        rarity: "legendary",
        source: "Lost Treasures"
    },
    {
        name: "Reef Manta Ray",
        imagePath: "images/lostTreasure/Pfp/ReefMantaRay.png",
        rarity: "legendary",
        source: "Lost Treasures"
    }
]);
const LOST_TREASURES_CATEGORY_SUBTITLES = Object.freeze({
    "everyone-knows": "Broad, bottom-dwelling species including rays, skates, and flat-bodied sharks.",
    "reef-regulars": "Extreme-depth species with photos from submersibles or deep trawls.",
    "open-ocean-icons": "Large plankton-feeders with abundant real photos.",
    "deep-sea-strangers": "Common reef species with thousands of real photographs.",
    "flat-and-fancy": "Pelagic species photographed by divers and fisheries.",
    "saw-snouts": "Species known for stealth or sudden strikes.",
    "ancient-oddballs": "Species with bizarre shapes or adaptations.",
    "tiny-terrors": "Species documented in rivers or brackish systems.",
    "carpet-crew": "Species from frigid seas with verified photos.",
    "sting-and-wing": "Miniature sharks and rays with confirmed photos.",
    "hammer-time": "Species that walk or rest on the seafloor.",
    "rare-finds": "Fast, powerful apex hunters with abundant real photos."
});
const LOST_TREASURES_CATEGORIES = [
    { id: "everyone-knows", name: "Benthic Broadwings", color: "#66e0d1", species: ["Ornate Wobbegong", "Japanese Sawshark", "Common Sawfish", "Bowmouth Guitarfish", "Shovelnose Guitarfish", "Cownose Ray", "Southern Stingray", "Big Skate", "Torpedo Ray", "Spotted Eagle Ray"] },
    { id: "reef-regulars", name: "Abyssal Relics", color: "#d8a55f", species: ["Goblin Shark", "Frilled Shark", "Greenland Shark", "Bluntnose Sixgill Shark", "Sevengill Shark", "Pacific Sleeper Shark", "Portuguese Dogfish", "Kitefin Shark", "Chimaera monstrosa", "Pointy-nosed Blue Chimaera"] },
    { id: "open-ocean-icons", name: "Gentle Giants", color: "#f4d7ff", species: ["Whale Shark", "Basking Shark", "Megamouth Shark", "Reef Manta Ray", "Giant Manta Ray", "Devil Ray", "Bentfin Devil Ray", "Spinetail Devil Ray", "Pygmy Devil Ray", "Chilean Devil Ray"] },
    { id: "deep-sea-strangers", name: "Reef Regulars", color: "#7bd875", species: ["Blacktip Reef Shark", "Whitetip Reef Shark", "Grey Reef Shark", "Nurse Shark", "Zebra Shark", "Epaulette Shark", "Blue-spotted Ribbontail Ray", "Honeycomb Stingray", "Reticulate Whipray", "Coral Catshark"] },
    { id: "flat-and-fancy", name: "Open Ocean Drifters", color: "#8fb6ff", species: ["Blue Shark", "Oceanic Whitetip", "Shortfin Mako", "Salmon Shark", "Pelagic Thresher", "Bigeye Thresher", "Pelagic Stingray", "Mobula kuhlii", "Mobula hypostoma", "Mobula munkiana"] },
    { id: "saw-snouts", name: "Ambush Hunters", color: "#ffcc70", species: ["Great White Shark", "Tiger Shark", "Bull Shark", "Sand Tiger Shark", "Angel Shark", "Ornate Angel Shark", "Tasselled Wobbegong", "Spotted Wobbegong", "Copper Shark", "Brown-banded Bamboo Shark"] },
    { id: "ancient-oddballs", name: "Odd Adaptations", color: "#7fe8ff", species: ["Scalloped Hammerhead", "Great Hammerhead", "Winghead Shark", "Sawshark", "Cookiecutter Shark", "Longnose Sawshark", "Chimaera phantasma", "Elephant Fish", "Spotted Ratfish", "Japanese Bullhead Shark"] },
    { id: "tiny-terrors", name: "River Shadows", color: "#d6c3a4", species: ["Bull Shark", "Ganges River Shark", "Speartooth Shark", "Irrawaddy River Shark", "Largetooth Sawfish", "Green Sawfish", "Giant Freshwater Stingray", "Pearl Ray", "Black Stingray", "Tiger River Stingray"] },
    { id: "carpet-crew", name: "Coldwater Charts", color: "#b7a7ff", species: ["Porbeagle Shark", "Spiny Dogfish", "Greenland Shark", "Arctic Skate", "Winter Skate", "Rough Skate", "Pacific Spiny Dogfish", "Barndoor Skate", "Longnose Skate", "White Skate"] },
    { id: "sting-and-wing", name: "Miniature Marvels", color: "#ff8fab", species: ["Dwarf Lanternshark", "Pygmy Shark", "Velvet Belly Lanternshark", "Chain Catshark", "Smallspotted Catshark", "Bali Catshark", "Lesser Electric Ray", "Shorttail Stingray", "Fanray", "Spotted Torpedo Ray"] },
    { id: "hammer-time", name: "Seafloor Walkers", color: "#58c7ff", species: ["Epaulette Shark", "Speckled Carpetshark", "Brownbanded Bamboo Shark", "Whitespotted Bamboo Shark", "Arabian Carpetshark", "Ornate Wobbegong", "Guitarfish", "Shovelnose Ray", "Eastern Shovelnose Ray", "Common Skate"] },
    { id: "rare-finds", name: "Apex Legends", color: "#ffe18a", species: ["Great White Shark", "Tiger Shark", "Bull Shark", "Shortfin Mako", "Longfin Mako", "Dusky Shark", "Silky Shark", "Lemon Shark", "Blacktip Shark", "Sandbar Shark"] }
];
const LOST_TREASURES_CARDS_PER_CATEGORY = 10;

function getLostTreasuresCardId(categoryId, cardNumber) {
    return `${categoryId}-${String(cardNumber).padStart(2, "0")}`;
}

function getLostTreasuresGeneratedCardImage(categoryId, cardNumber) {
    return `images/lostTreasure/Cards/generated/${getLostTreasuresCardId(categoryId, cardNumber)}.png`;
}

function getLostTreasuresArtPathPart(value) {
    return String(value || "").replace(/[^a-z0-9]/gi, "");
}

function getLostTreasuresSpeciesArtImage(categoryName, speciesName) {
    const filename = LOST_TREASURES_SPECIES_ART_FILENAMES[`${categoryName}|${speciesName}`] || `${getLostTreasuresArtPathPart(speciesName)}.png`;
    return `images/lostTreasure/Cards/Sharks/${getLostTreasuresArtPathPart(categoryName)}/${filename}`;
}

function getLostTreasuresCommonFrameImage(cardNumber) {
    return [2, 5, 7].includes(cardNumber)
        ? LOST_TREASURES_CARD_IMAGES.commonWorn
        : LOST_TREASURES_CARD_IMAGES.common;
}

function getLostTreasuresRareFrameImage(categoryIndex, cardNumber) {
    return (categoryIndex + cardNumber) % 2 === 0
        ? LOST_TREASURES_CARD_IMAGES.rareWorn
        : LOST_TREASURES_CARD_IMAGES.rare;
}

function getLostTreasuresCardArtMarkup(card, altText) {
    if (card.speciesImage) {
        return `
            <img class="lost-treasures-frame-card" src="${card.frameImage}" alt="" aria-hidden="true">
            <img class="lost-treasures-species-card" src="${card.speciesImage}" alt="${altText}" onerror="this.onerror=null; this.remove(); this.closest('.lost-treasures-scroll-art, .lost-treasures-detail-art')?.classList.remove('has-species-art');">
        `;
    }
    return `<img class="lost-treasures-frame-card" src="${card.frameImage}" alt="${altText}">`;
}

function getLostTreasuresAlbum() {
    return LOST_TREASURES_CATEGORIES.map((category, categoryIndex) => ({
        ...category,
        cards: Array.from({ length: LOST_TREASURES_CARDS_PER_CATEGORY }, (_, index) => {
            const speciesName = category.species[index] || `${category.name} Scroll ${index + 1}`;
            return {
            id: getLostTreasuresCardId(category.id, index + 1),
            number: index + 1,
            name: speciesName,
            mark: speciesName
                .split(/\s+/)
                .map(part => part[0])
                .join("")
                .replace(/[^A-Z]/gi, "")
                .slice(0, 4)
                .toUpperCase(),
            rarity: index >= LOST_TREASURES_CARDS_PER_CATEGORY - 2 ? "rare" : "common",
            frameImage: index >= LOST_TREASURES_CARDS_PER_CATEGORY - 2
                ? getLostTreasuresRareFrameImage(categoryIndex, index + 1)
                : getLostTreasuresCommonFrameImage(index + 1),
            speciesImage: getLostTreasuresSpeciesArtImage(category.name, speciesName),
            image: getLostTreasuresGeneratedCardImage(category.id, index + 1)
            };
        })
    }));
}

function getLostTreasuresState(profileData = getCurrentProfileData()) {
    const raw = profileData.lostTreasures && typeof profileData.lostTreasures === "object" ? profileData.lostTreasures : {};
    const legacyBottleCount = typeof raw.bottles === "number" ? Math.max(0, Number(raw.bottles) || 0) : 0;
    const rawBottleInventory = raw.bottles && typeof raw.bottles === "object" ? raw.bottles : raw.bottleInventory;
    const bottleInventory = LOST_TREASURES_BOTTLES.reduce((inventory, bottle, index) => {
        const legacyBottleIds = [LOST_TREASURES_LEGACY_BOTTLE_IDS[bottle.id]].flat().filter(Boolean);
        const savedCount = Number(rawBottleInventory?.[bottle.id]);
        const hasSavedCount = Number.isFinite(savedCount);
        const legacyCount = legacyBottleIds.reduce((sum, legacyBottleId) => sum + Math.max(0, Number(rawBottleInventory?.[legacyBottleId]) || 0), 0);
        inventory[bottle.id] = Math.max(0, hasSavedCount ? savedCount : legacyCount)
            + (index === 0 ? legacyBottleCount : 0);
        return inventory;
    }, {});
    const selectedBottleId = LOST_TREASURES_BOTTLE_ID_ALIASES[raw.selectedBottleId] || raw.selectedBottleId || LOST_TREASURES_BOTTLES[0].id;
    return {
        eventId: raw.eventId || LOST_TREASURES_EVENT_ID,
        bottles: bottleInventory,
        collectedCards: Array.isArray(raw.collectedCards) ? [...new Set(raw.collectedCards)] : [],
        duplicateCards: Math.max(0, Number(raw.duplicateCards) || 0),
        duplicateCardCounts: raw.duplicateCardCounts && typeof raw.duplicateCardCounts === "object" ? { ...raw.duplicateCardCounts } : {},
        claimedCategories: Array.isArray(raw.claimedCategories) ? [...new Set(raw.claimedCategories)] : [],
        recentCards: Array.isArray(raw.recentCards) ? raw.recentCards.slice(0, 8) : [],
        claimedGrandReward: Boolean(raw.claimedGrandReward),
        lastOpenedCardId: raw.lastOpenedCardId || "",
        selectedBottleId: selectedBottleId,
        dailyBottleDates: Array.isArray(raw.dailyBottleDates) ? [...new Set(raw.dailyBottleDates)] : [],
        claimedBottleMilestones: Array.isArray(raw.claimedBottleMilestones) ? [...new Set(raw.claimedBottleMilestones)] : []
    };
}

function mergeLostTreasuresStates(localProfile = {}, remoteProfile = {}) {
    const localState = getLostTreasuresState(localProfile);
    const remoteState = getLostTreasuresState(remoteProfile);
    const hasRemoteLostTreasures = Boolean(remoteProfile?.lostTreasures && typeof remoteProfile.lostTreasures === "object");
    const hasLocalLostTreasures = Boolean(localProfile?.lostTreasures && typeof localProfile.lostTreasures === "object");
    const localUpdatedAt = Number(localProfile?.lostTreasures?.updatedAt) || 0;
    const remoteUpdatedAt = Number(remoteProfile?.lostTreasures?.updatedAt) || 0;
    const bottleSourceState = remoteUpdatedAt > localUpdatedAt ? remoteState : localState;
    return {
        eventId: LOST_TREASURES_EVENT_ID,
        bottles: LOST_TREASURES_BOTTLES.reduce((inventory, bottle) => {
            inventory[bottle.id] = getLostTreasuresBottleCount(bottleSourceState, bottle.id);
            return inventory;
        }, {}),
        collectedCards: [...new Set([...localState.collectedCards, ...remoteState.collectedCards])],
        duplicateCards: Math.max(localState.duplicateCards, remoteState.duplicateCards),
        duplicateCardCounts: Object.keys({ ...localState.duplicateCardCounts, ...remoteState.duplicateCardCounts }).reduce((counts, cardId) => {
            counts[cardId] = Math.max(Number(localState.duplicateCardCounts?.[cardId]) || 0, Number(remoteState.duplicateCardCounts?.[cardId]) || 0);
            return counts;
        }, {}),
        claimedCategories: [...new Set([...localState.claimedCategories, ...remoteState.claimedCategories])],
        recentCards: [...remoteState.recentCards, ...localState.recentCards].filter(Boolean).slice(0, 8),
        claimedGrandReward: Boolean(localState.claimedGrandReward || remoteState.claimedGrandReward),
        dailyBottleDates: [...new Set([...localState.dailyBottleDates, ...remoteState.dailyBottleDates])],
        claimedBottleMilestones: [...new Set([...localState.claimedBottleMilestones, ...remoteState.claimedBottleMilestones])],
        lastOpenedCardId: hasRemoteLostTreasures && remoteState.lastOpenedCardId ? remoteState.lastOpenedCardId : localState.lastOpenedCardId || "",
        selectedBottleId: hasRemoteLostTreasures
            ? (remoteState.selectedBottleId || localState.selectedBottleId || LOST_TREASURES_BOTTLES[0].id)
            : hasLocalLostTreasures
                ? (localState.selectedBottleId || LOST_TREASURES_BOTTLES[0].id)
                : LOST_TREASURES_BOTTLES[0].id,
        updatedAt: Math.max(localUpdatedAt, remoteUpdatedAt)
    };
}

function setLostTreasuresState(profileData, state, options = {}) {
    profileData.lostTreasures = {
        eventId: LOST_TREASURES_EVENT_ID,
        bottles: LOST_TREASURES_BOTTLES.reduce((inventory, bottle) => {
            inventory[bottle.id] = Math.max(0, Number(state.bottles?.[bottle.id]) || 0);
            return inventory;
        }, {}),
        collectedCards: [...new Set(state.collectedCards || [])],
        duplicateCards: Math.max(0, Number(state.duplicateCards) || 0),
        duplicateCardCounts: state.duplicateCardCounts && typeof state.duplicateCardCounts === "object" ? { ...state.duplicateCardCounts } : {},
        claimedCategories: [...new Set(state.claimedCategories || [])],
        recentCards: Array.isArray(state.recentCards) ? state.recentCards.filter(Boolean).slice(0, 8) : [],
        claimedGrandReward: Boolean(state.claimedGrandReward),
        lastOpenedCardId: state.lastOpenedCardId || "",
        selectedBottleId: state.selectedBottleId || LOST_TREASURES_BOTTLES[0].id,
        dailyBottleDates: Array.isArray(state.dailyBottleDates) ? [...new Set(state.dailyBottleDates)].slice(-30) : [],
        claimedBottleMilestones: Array.isArray(state.claimedBottleMilestones) ? [...new Set(state.claimedBottleMilestones)] : [],
        updatedAt: Date.now()
    };
    saveUserProfileLocally(profileData, options);
}

function getLostTreasuresBottleCount(state = getLostTreasuresState(), bottleId = null) {
    if (bottleId) return Math.max(0, Number(state.bottles?.[bottleId]) || 0);
    return LOST_TREASURES_BOTTLES.reduce((sum, bottle) => sum + Math.max(0, Number(state.bottles?.[bottle.id]) || 0), 0);
}

function pickLostTreasuresBottleDrop() {
    const weightedBottles = LOST_TREASURES_BOTTLES.map(bottle => ({
        ...bottle,
        weight: Math.max(0, Number(LOST_TREASURES_BOTTLE_DROP_WEIGHTS[bottle.id]) || 0)
    })).filter(bottle => bottle.weight > 0);
    const totalWeight = weightedBottles.reduce((sum, bottle) => sum + bottle.weight, 0);
    let roll = Math.random() * totalWeight;
    for (const bottle of weightedBottles) {
        roll -= bottle.weight;
        if (roll <= 0) return bottle;
    }
    return weightedBottles[0] || LOST_TREASURES_BOTTLES[0];
}

async function persistLostTreasuresState(profileData) {
    saveUserProfileLocally(profileData, { skipRemoteSync: true });
    if (!currentUser || !db) return;
    await db.collection("userStats").doc(currentUser.uid).set({
        lostTreasures: profileData.lostTreasures,
        pearls: getPearlCount(profileData),
        unlockedBadges: Array.isArray(profileData.unlockedBadges) ? profileData.unlockedBadges : ["starter"],
        earnedCosmetics: Array.isArray(profileData.earnedCosmetics) ? profileData.earnedCosmetics : [],
        lastUpdated: new Date()
    }, { merge: true });
}

function grantLostTreasuresBottle(profileData, bottleId = "barnacle", amount = 1) {
    const state = getLostTreasuresState(profileData);
    const bottle = LOST_TREASURES_BOTTLES.find(item => item.id === bottleId) || LOST_TREASURES_BOTTLES[0];
    state.bottles[bottle.id] = getLostTreasuresBottleCount(state, bottle.id) + Math.max(1, Math.floor(Number(amount) || 1));
    state.selectedBottleId = bottle.id;
    setLostTreasuresState(profileData, state, { skipRemoteSync: true });
    return { state, bottle };
}

function getLostTreasuresTodayKey() {
    return new Date().toISOString().slice(0, 10);
}

function maybeAwardLostTreasuresBottleDrop(source = "win") {
    if (!currentUser) return false;
    const profileData = getCurrentProfileData();
    const state = getLostTreasuresState(profileData);
    const todayKey = getLostTreasuresTodayKey();
    const grants = [];

    if (!state.dailyBottleDates.includes(todayKey)) {
        state.dailyBottleDates.push(todayKey);
        grants.push({ bottleId: LOST_TREASURES_DAILY_WIN_BOTTLE_ID, amount: 1, reason: "daily win" });
    }

    const streak = Math.max(0, Number(profileData.currentStreak) || 0);
    LOST_TREASURES_STREAK_BOTTLE_REWARDS.forEach(reward => {
        const milestoneKey = String(reward.streak);
        if (streak >= reward.streak && !state.claimedBottleMilestones.includes(milestoneKey)) {
            state.claimedBottleMilestones.push(milestoneKey);
            grants.push({ ...reward, reason: `${reward.streak}-win streak` });
        }
    });

    if (Math.random() <= LOST_TREASURES_BOTTLE_DROP_CHANCE) {
        const bottle = pickLostTreasuresBottleDrop();
        grants.push({ bottleId: bottle.id, amount: 1, reason: "washed up" });
    }

    if (!grants.length) return false;

    grants.forEach(grant => {
        const bottle = LOST_TREASURES_BOTTLES.find(item => item.id === grant.bottleId) || LOST_TREASURES_BOTTLES[0];
        state.bottles[bottle.id] = getLostTreasuresBottleCount(state, bottle.id) + Math.max(1, Math.floor(Number(grant.amount) || 1));
        state.selectedBottleId = bottle.id;
    });
    setLostTreasuresState(profileData, state, { skipRemoteSync: true });
    persistLostTreasuresState(profileData).catch(error => console.warn("Lost Treasures bottle sync failed:", error));
    const bestGrant = grants[grants.length - 1];
    const bestBottle = LOST_TREASURES_BOTTLES.find(item => item.id === bestGrant.bottleId) || LOST_TREASURES_BOTTLES[0];
    const extraCount = grants.reduce((sum, grant) => sum + Math.max(1, Math.floor(Number(grant.amount) || 1)), 0) - 1;
    showNotification?.(`${bestBottle.name} earned from your ${source}${extraCount > 0 ? ` +${extraCount} more bottle${extraCount === 1 ? "" : "s"}` : ""}!`, "success", 4200);
    if (document.getElementById("lost-treasures-modal")) {
        renderLostTreasuresModal?.();
    }
    return true;
}

function getLostTreasuresProgress(state = getLostTreasuresState()) {
    const album = getLostTreasuresAlbum();
    const collected = new Set(state.collectedCards);
    const totalCards = album.length * LOST_TREASURES_CARDS_PER_CATEGORY;
    const collectedCount = album.reduce((sum, category) => sum + category.cards.filter(card => collected.has(card.id)).length, 0);
    return {
        album,
        collected,
        totalCards,
        collectedCount,
        percent: totalCards ? Math.round((collectedCount / totalCards) * 100) : 0
    };
}

function findLostTreasuresCard(cardId) {
    return getLostTreasuresAlbum()
        .flatMap(category => category.cards.map(card => ({ ...card, category })))
        .find(card => card.id === cardId) || null;
}

function getLostTreasuresCardDuplicateCount(state, cardId) {
    return Math.max(0, Number(state.duplicateCardCounts?.[cardId]) || 0);
}

function addLostTreasuresRecentCard(state, card, alreadyOwned = false) {
    state.recentCards = [
        { id: card.id, at: Date.now(), duplicate: Boolean(alreadyOwned) },
        ...(Array.isArray(state.recentCards) ? state.recentCards : []).filter(item => item?.id !== card.id)
    ].slice(0, 8);
}

function ensureLostTreasuresModal() {
    let modal = document.getElementById("lost-treasures-modal");
    if (modal) return modal;
    modal = document.createElement("div");
    modal.id = "lost-treasures-modal";
    modal.className = "modal hidden lost-treasures-modal";
    modal.onclick = event => {
        if (event.target === modal) closeLostTreasuresModal();
    };
    modal.innerHTML = `
        <div class="lost-treasures-card">
            <button type="button" class="modal-x-btn lost-treasures-close" onclick="closeLostTreasuresModal()" aria-label="Close Lost Treasures">&times;</button>
            <section class="lost-treasures-hero">
                <div class="lost-treasures-copy">
                    <span>Limited Event</span>
                    <h2>Lost Treasures</h2>
                    <p>Open messages in bottles to collect every scroll and earn rewards.</p>
                    <div class="lost-treasures-progress">
                        <div><strong id="lost-treasures-collected">0</strong><span>Scrolls</span></div>
                        <div><strong id="lost-treasures-bottles">0</strong><span>Bottles</span></div>
                        <div><strong id="lost-treasures-duplicates">0</strong><span>Dupes</span></div>
                    </div>
                </div>
                <div class="lost-treasures-bottle-stage lost-treasures-dock">
                    <img id="lost-treasures-bottle-img" src="${LOST_TREASURES_BOTTLE_IMAGES[0]}" alt="Message in a bottle">
                    <div class="lost-treasures-dock-head">
                        <h3>Bottle Dock</h3>
                    </div>
                    <div id="lost-treasures-bottle-list" class="lost-treasures-bottle-list"></div>
                    <div id="lost-treasures-selected-bottle" class="lost-treasures-selected-bottle">Select a bottle</div>
                    <div id="lost-treasures-open-amount" class="lost-treasures-open-amount" aria-label="Bottles to open"></div>
                    <button id="lost-treasures-open-bottle-btn" type="button" onclick="openLostTreasuresBottle()">Open Bottle</button>
                </div>
            </section>
            <div class="lost-treasures-meter"><span id="lost-treasures-meter-fill"></span></div>
            <section class="lost-treasures-main">
                <aside class="lost-treasures-side" aria-label="Lost Treasures tools">
                    <div class="lost-treasures-side-panel lost-treasures-exchange-panel">
                        <span>Duplicate Exchange</span>
                        <div id="lost-treasures-exchange" class="lost-treasures-exchange"></div>
                    </div>
                </aside>
                <section class="lost-treasures-album-shell">
                    <nav id="lost-treasures-categories" class="lost-treasures-categories" aria-label="Lost Treasures categories"></nav>
                    <section class="lost-treasures-album-head">
                        <div>
                            <span id="lost-treasures-active-kicker">Category</span>
                            <h3 id="lost-treasures-active-title">Reef Relics</h3>
                            <p id="lost-treasures-active-subtitle"></p>
                        </div>
                        <div class="lost-treasures-category-reward">
                            <div class="lost-treasures-reward-chip pearl">
                                <b>${LOST_TREASURES_CATEGORY_PEARL_REWARD}</b>
                                <span>Pearls</span>
                            </div>
                            <button id="lost-treasures-claim-category" type="button" onclick="claimLostTreasuresCategory()">Complete Category</button>
                        </div>
                    </section>
                    <div id="lost-treasures-grid" class="lost-treasures-grid"></div>
                    <section class="lost-treasures-grand">
                        <div>
                            <span>Grand Reward</span>
                    <strong>Complete all 120 scrolls</strong>
                            <p>Finish the full album to earn ${LOST_TREASURES_GRAND_PEARL_REWARD.toLocaleString()} pearls, the ${LOST_TREASURES_GRAND_BADGE.name} badge, and two Lost Treasures profile icons.</p>
                            <div class="lost-treasures-grand-rewards" aria-label="Lost Treasures grand reward preview">
                                <div class="lost-treasures-reward-chip pearl"><b>${LOST_TREASURES_GRAND_PEARL_REWARD.toLocaleString()}</b><span>Pearls</span></div>
                                <div class="lost-treasures-reward-chip badge"><strong>${LOST_TREASURES_GRAND_BADGE.emoji}</strong><b>${LOST_TREASURES_GRAND_BADGE.name}</b><span>Badge</span></div>
                                ${LOST_TREASURES_GRAND_PFPS.map(pfp => `
                                    <div class="lost-treasures-reward-chip pfp">
                                        <img src="${pfp.imagePath}" alt="${pfp.name}">
                                        <span>${pfp.name}</span>
                                    </div>
                                `).join("")}
                            </div>
                        </div>
                        <button id="lost-treasures-claim-grand" type="button" onclick="claimLostTreasuresGrandReward()">Claim Grand Reward</button>
                    </section>
                </section>
            </section>
            <div id="lost-treasures-detail" class="lost-treasures-detail hidden" onclick="if(event.target===this) closeLostTreasuresCardDetail()"></div>
        </div>
    `;
    document.body.appendChild(modal);
    return modal;
}

let activeLostTreasuresCategoryId = LOST_TREASURES_CATEGORIES[0].id;
let lostTreasuresOpeningInProgress = false;
let lostTreasuresOpenBottleCount = 1;

function renderLostTreasuresModal() {
    const modal = ensureLostTreasuresModal();
    const state = getLostTreasuresState();
    const progress = getLostTreasuresProgress(state);
    const activeCategory = progress.album.find(category => category.id === activeLostTreasuresCategoryId) || progress.album[0];
    activeLostTreasuresCategoryId = activeCategory.id;

    modal.querySelector("#lost-treasures-collected").textContent = `${progress.collectedCount}/${progress.totalCards}`;
    const selectedBottle = LOST_TREASURES_BOTTLES.find(bottle => bottle.id === state.selectedBottleId) || LOST_TREASURES_BOTTLES[0];
    modal.querySelector("#lost-treasures-bottles").textContent = getLostTreasuresBottleCount(state);
    modal.querySelector("#lost-treasures-duplicates").textContent = state.duplicateCards;
    modal.querySelector("#lost-treasures-meter-fill").style.width = `${progress.percent}%`;
    modal.querySelector("#lost-treasures-bottle-img").src = selectedBottle.image;
    const selectedBottleCount = getLostTreasuresBottleCount(state, selectedBottle.id);
    lostTreasuresOpenBottleCount = Math.min(Math.max(1, lostTreasuresOpenBottleCount), Math.max(1, selectedBottleCount));
    const selectedBottleLabel = modal.querySelector("#lost-treasures-selected-bottle");
    if (selectedBottleLabel) {
        selectedBottleLabel.textContent = `${selectedBottle.name} selected - opens ${selectedBottle.scrollCount * lostTreasuresOpenBottleCount} scrolls`;
    }
    const openAmount = modal.querySelector("#lost-treasures-open-amount");
    if (openAmount) {
        const amounts = [1, 3, 5].filter(amount => amount <= selectedBottleCount);
        if (selectedBottleCount > 1 && !amounts.includes(selectedBottleCount)) amounts.push(selectedBottleCount);
        const uniqueAmounts = [...new Set(amounts)].sort((a, b) => a - b);
        openAmount.innerHTML = selectedBottleCount > 1
            ? uniqueAmounts.map(amount => `<button type="button" class="${amount === lostTreasuresOpenBottleCount ? "active" : ""}" onclick="selectLostTreasuresOpenAmount(${amount})" ${lostTreasuresOpeningInProgress ? "disabled" : ""}>${amount === selectedBottleCount ? "All" : `x${amount}`}</button>`).join("")
            : "";
        openAmount.classList.toggle("hidden", selectedBottleCount <= 1);
    }
    const openBottleBtn = modal.querySelector("#lost-treasures-open-bottle-btn");
    if (openBottleBtn) {
        openBottleBtn.disabled = lostTreasuresOpeningInProgress || selectedBottleCount <= 0;
        openBottleBtn.textContent = lostTreasuresOpeningInProgress
            ? "Opening..."
            : selectedBottleCount > 0
                ? `Open ${lostTreasuresOpenBottleCount} ${selectedBottle.name}${lostTreasuresOpenBottleCount === 1 ? "" : "s"}`
                : `No ${selectedBottle.name}s`;
    }
    const bottleList = modal.querySelector("#lost-treasures-bottle-list");
    if (bottleList) {
        bottleList.innerHTML = LOST_TREASURES_BOTTLES.map(bottle => {
            const count = getLostTreasuresBottleCount(state, bottle.id);
            return `<button type="button" class="${bottle.id === selectedBottle.id ? "active" : ""}" aria-pressed="${bottle.id === selectedBottle.id ? "true" : "false"}" onclick="selectLostTreasuresBottle('${bottle.id}')" ${lostTreasuresOpeningInProgress ? "disabled" : ""}>
                <img src="${bottle.image}" alt="${bottle.name}">
                <span>${bottle.name}</span>
                <small>${bottle.rareOnly ? "1 guaranteed rare scroll" : `${bottle.scrollCount} scrolls - ${bottle.rareChance * 100}% rare`}</small>
                <strong>${count}</strong>
            </button>`;
        }).join("");
    }

    const exchangePanel = modal.querySelector("#lost-treasures-exchange");
    if (exchangePanel) {
        exchangePanel.innerHTML = LOST_TREASURES_DUPLICATE_EXCHANGES.map(exchange => {
            const bottle = LOST_TREASURES_BOTTLES.find(item => item.id === exchange.bottleId);
            return `
            <button type="button" onclick="exchangeLostTreasuresDuplicates('${exchange.id}')" ${state.duplicateCards < exchange.cost || lostTreasuresOpeningInProgress ? "disabled" : ""}>
                ${bottle ? `<img src="${bottle.image}" alt="${bottle.name}">` : ""}
                <span>
                    <strong>${exchange.reward}</strong>
                    <small>${exchange.label}</small>
                </span>
            </button>
        `;
        }).join("");
    }

    const categoryNav = modal.querySelector("#lost-treasures-categories");
    categoryNav.innerHTML = progress.album.map(category => {
        const owned = category.cards.filter(card => progress.collected.has(card.id)).length;
        const complete = owned === LOST_TREASURES_CARDS_PER_CATEGORY;
        const claimed = state.claimedCategories.includes(category.id);
        return `<button type="button" class="${category.id === activeCategory.id ? "active" : ""} ${complete ? "complete" : ""}" style="--category-color:${category.color}" onclick="showLostTreasuresCategory('${category.id}')">
            <strong>${category.name}</strong><span>${owned}/${LOST_TREASURES_CARDS_PER_CATEGORY}${claimed ? " Claimed" : ""}</span>
        </button>`;
    }).join("");

    modal.querySelector("#lost-treasures-active-kicker").textContent = `${activeCategory.cards.filter(card => progress.collected.has(card.id)).length}/${LOST_TREASURES_CARDS_PER_CATEGORY} scrolls collected`;
    modal.querySelector("#lost-treasures-active-title").textContent = activeCategory.name;
    const subtitle = modal.querySelector("#lost-treasures-active-subtitle");
    if (subtitle) subtitle.textContent = LOST_TREASURES_CATEGORY_SUBTITLES[activeCategory.id] || "Recover every scroll in this set.";
    const claimCategoryBtn = modal.querySelector("#lost-treasures-claim-category");
    const categoryComplete = activeCategory.cards.every(card => progress.collected.has(card.id));
    const categoryClaimed = state.claimedCategories.includes(activeCategory.id);
    claimCategoryBtn.disabled = !categoryComplete || categoryClaimed;
    claimCategoryBtn.textContent = categoryClaimed ? "Reward Claimed" : categoryComplete ? `Claim ${LOST_TREASURES_CATEGORY_PEARL_REWARD} Pearls` : "Complete Category";

    modal.querySelector("#lost-treasures-grid").innerHTML = activeCategory.cards.map(card => {
        const owned = progress.collected.has(card.id);
        return `<button type="button" class="lost-treasures-slot ${owned ? "owned" : "locked"} rarity-${card.rarity}" style="--category-color:${activeCategory.color}" onclick="openLostTreasuresCardDetail('${card.id}')">
            <div class="lost-treasures-scroll-art ${card.speciesImage ? "has-species-art" : ""}">
                ${getLostTreasuresCardArtMarkup(card, card.name)}
                <span class="lost-treasures-scroll-number">${card.number}</span>
                <b>${owned ? card.mark : "?"}</b>
            </div>
            <strong>${card.name}</strong>
            <small>${owned ? (card.rarity === "rare" ? "Rare Scroll" : "Recovered") : "Missing"}</small>
        </button>`;
    }).join("");

    const grandBtn = modal.querySelector("#lost-treasures-claim-grand");
    const completeAlbum = progress.collectedCount === progress.totalCards;
    grandBtn.disabled = !completeAlbum || state.claimedGrandReward;
    grandBtn.textContent = state.claimedGrandReward ? "Grand Reward Claimed" : completeAlbum ? "Claim Grand Reward" : `${progress.collectedCount}/${progress.totalCards}`;
}

function openLostTreasuresModal() {
    renderLostTreasuresModal();
    ensureLostTreasuresModal().classList.remove("hidden");
}

function closeLostTreasuresModal() {
    document.getElementById("lost-treasures-modal")?.classList.add("hidden");
}

function showLostTreasuresCategory(categoryId) {
    activeLostTreasuresCategoryId = LOST_TREASURES_CATEGORIES.some(category => category.id === categoryId)
        ? categoryId
        : LOST_TREASURES_CATEGORIES[0].id;
    renderLostTreasuresModal();
}

function selectLostTreasuresBottle(bottleId) {
    if (lostTreasuresOpeningInProgress) return;
    const profileData = getCurrentProfileData();
    const state = getLostTreasuresState(profileData);
    state.selectedBottleId = LOST_TREASURES_BOTTLES.some(bottle => bottle.id === bottleId) ? bottleId : LOST_TREASURES_BOTTLES[0].id;
    lostTreasuresOpenBottleCount = 1;
    setLostTreasuresState(profileData, state, { skipRemoteSync: true });
    renderLostTreasuresModal();
}

function selectLostTreasuresOpenAmount(amount) {
    if (lostTreasuresOpeningInProgress) return;
    const state = getLostTreasuresState();
    const selectedBottle = LOST_TREASURES_BOTTLES.find(bottle => bottle.id === state.selectedBottleId) || LOST_TREASURES_BOTTLES[0];
    const selectedBottleCount = getLostTreasuresBottleCount(state, selectedBottle.id);
    lostTreasuresOpenBottleCount = Math.min(Math.max(1, Math.floor(Number(amount) || 1)), Math.max(1, selectedBottleCount));
    renderLostTreasuresModal();
}

function getRandomLostTreasuresCard(state, targetRarity = "common") {
    const allCards = getLostTreasuresAlbum().flatMap(category => category.cards);
    const rarityPool = allCards.filter(card => card.rarity === targetRarity);
    const poolByRarity = rarityPool.length ? rarityPool : allCards;
    const collectedCards = Array.isArray(state.collectedCards) ? state.collectedCards : [];
    const ownedPool = poolByRarity.filter(card => collectedCards.includes(card.id));
    const missingPool = poolByRarity.filter(card => !collectedCards.includes(card.id));
    const completionRatio = poolByRarity.length ? ownedPool.length / poolByRarity.length : 0;
    const duplicateChance = Math.min(
        LOST_TREASURES_DUPLICATE_MAX_CHANCE,
        LOST_TREASURES_DUPLICATE_BASE_CHANCE + completionRatio * LOST_TREASURES_DUPLICATE_PROGRESS_BONUS
    );
    const shouldPullDuplicate = ownedPool.length > 0 && (!missingPool.length || Math.random() < duplicateChance);
    const pool = shouldPullDuplicate ? ownedPool : missingPool.length ? missingPool : poolByRarity;
    return pool[Math.floor(Math.random() * pool.length)];
}

function openLostTreasuresScrollsFromBottle(state, bottle) {
    const opened = [];
    const scrollCount = Math.max(1, Math.floor(Number(bottle.scrollCount) || 1));
    const maxRareCards = Math.max(0, Math.floor(Number(bottle.maxRareCards) || 0));
    let rareCardsOpened = 0;
    for (let index = 0; index < scrollCount; index += 1) {
        const shouldRollRare = bottle.rareOnly || (rareCardsOpened < maxRareCards && Math.random() < (Number(bottle.rareChance) || 0));
        const targetRarity = shouldRollRare ? "rare" : "common";
        const card = getRandomLostTreasuresCard(state, targetRarity);
        if (card.rarity === "rare") rareCardsOpened += 1;
        const alreadyOwned = state.collectedCards.includes(card.id);
        if (alreadyOwned) {
            state.duplicateCards += card.rarity === "rare" ? LOST_TREASURES_RARE_DUPLICATE_VALUE : 1;
            state.duplicateCardCounts = state.duplicateCardCounts && typeof state.duplicateCardCounts === "object" ? state.duplicateCardCounts : {};
            state.duplicateCardCounts[card.id] = getLostTreasuresCardDuplicateCount(state, card.id) + 1;
        } else {
            state.collectedCards.push(card.id);
        }
        state.lastOpenedCardId = card.id;
        addLostTreasuresRecentCard(state, card, alreadyOwned);
        opened.push({ card, alreadyOwned });
    }
    return opened;
}

function getLostTreasuresScrollRevealMarkup(openedItem, index) {
    const category = LOST_TREASURES_CATEGORIES.find(item => openedItem.card.id.startsWith(item.id)) || LOST_TREASURES_CATEGORIES[0];
    return `<article class="lost-treasures-opening-scroll ${openedItem.alreadyOwned ? "duplicate" : "new"} rarity-${openedItem.card.rarity}" style="--category-color:${category.color}; --reveal-index:${index}">
        <div class="lost-treasures-scroll-art ${openedItem.card.speciesImage ? "has-species-art" : ""}">
            ${getLostTreasuresCardArtMarkup(openedItem.card, openedItem.card.name)}
            <span class="lost-treasures-scroll-number">${openedItem.card.number}</span>
            <b>${openedItem.card.mark}</b>
        </div>
        <strong>${openedItem.card.name}</strong>
        <small>${openedItem.alreadyOwned ? "Duplicate" : openedItem.card.rarity === "rare" ? "New Rare" : "New Scroll"}</small>
    </article>`;
}

function ensureLostTreasuresOpeningModal() {
    let opening = document.getElementById("lost-treasures-opening-modal");
    if (opening) return opening;
    opening = document.createElement("div");
    opening.id = "lost-treasures-opening-modal";
    opening.className = "lost-treasures-opening hidden";
    opening.setAttribute("aria-live", "polite");
    document.body.appendChild(opening);
    return opening;
}

async function playLostTreasuresOpeningAnimation(bottle, opened) {
    const opening = ensureLostTreasuresOpeningModal();
    if (!opening) return;
    const hasRarePull = opened.some(item => item?.card?.rarity === "rare");
    opening.classList.remove("hidden", "revealed", "closing", "flash-common", "flash-rare");
    opening.classList.add(hasRarePull ? "flash-rare" : "flash-common");
    opening.innerHTML = `
        <div class="lost-treasures-opening-flash" aria-hidden="true"></div>
        <div class="lost-treasures-opening-actions">
            <button type="button" class="lost-treasures-opening-skip">Skip Animation</button>
            <button type="button" class="lost-treasures-opening-close hidden">Close</button>
        </div>
        <div class="lost-treasures-opening-bottle">
            <img src="${bottle.image}" alt="${bottle.name}">
            <span>Opening ${bottle.name}</span>
        </div>
        <div class="lost-treasures-opening-scrolls"></div>
    `;
    await new Promise(resolve => {
        const skipButton = opening.querySelector(".lost-treasures-opening-skip");
        const closeButton = opening.querySelector(".lost-treasures-opening-close");
        const scrollWrap = opening.querySelector(".lost-treasures-opening-scrolls");
        let revealed = false;
        let closed = false;

        const revealNow = () => {
            if (revealed || closed) return;
            revealed = true;
            if (scrollWrap) {
                scrollWrap.innerHTML = opened.map(getLostTreasuresScrollRevealMarkup).join("");
            }
            opening.classList.add("revealed");
            skipButton?.classList.add("hidden");
            closeButton?.classList.remove("hidden");
            closeButton?.focus();
        };

        const closeNow = () => {
            if (closed) return;
            closed = true;
            clearTimeout(revealTimer);
            opening.classList.add("closing");
            setTimeout(() => {
                opening.classList.add("hidden");
                opening.classList.remove("revealed", "closing", "flash-common", "flash-rare");
                opening.innerHTML = "";
                resolve();
            }, 260);
        };

        const revealTimer = setTimeout(revealNow, 900);
        skipButton?.addEventListener("click", revealNow, { once: true });
        closeButton?.addEventListener("click", closeNow);
    });
}

async function openLostTreasuresBottle() {
    if (lostTreasuresOpeningInProgress) return;
    if (!currentUser) {
        openLoginModal?.();
        return;
    }
    const profileData = getCurrentProfileData();
    const state = getLostTreasuresState(profileData);
    const bottle = LOST_TREASURES_BOTTLES.find(item => item.id === state.selectedBottleId) || LOST_TREASURES_BOTTLES[0];
    if (getLostTreasuresBottleCount(state, bottle.id) <= 0) {
        showNotification?.("No messages in bottles ready yet.", "info", 3200);
        return;
    }
    lostTreasuresOpeningInProgress = true;
    renderLostTreasuresModal();
    const openCount = Math.min(Math.max(1, lostTreasuresOpenBottleCount), getLostTreasuresBottleCount(state, bottle.id));
    state.bottles[bottle.id] = Math.max(0, Number(state.bottles[bottle.id]) || 0) - openCount;
    const opened = [];
    for (let index = 0; index < openCount; index += 1) {
        opened.push(...openLostTreasuresScrollsFromBottle(state, bottle));
    }
    setLostTreasuresState(profileData, state);
    await persistLostTreasuresState(profileData);
    const firstNew = opened.find(item => !item.alreadyOwned) || opened[0];
    const category = LOST_TREASURES_CATEGORIES.find(item => firstNew.card.id.startsWith(item.id)) || LOST_TREASURES_CATEGORIES[0];
    activeLostTreasuresCategoryId = category.id;
    renderLostTreasuresModal();
    await playLostTreasuresOpeningAnimation(bottle, opened);
    lostTreasuresOpeningInProgress = false;
    renderLostTreasuresModal();
}

async function fakePurchaseLostTreasuresBundle() {
    if (lostTreasuresOpeningInProgress) return;
    if (!currentUser || !isDeveloperUid(currentUser.uid)) {
        openLoginModal?.();
        return;
    }
    const profileData = getCurrentProfileData();
    const grants = [
        ["barnacle", 5],
        ["red-sea", 3],
        ["seafoam", 1],
        ["celestial", 1]
    ];
    grants.forEach(([bottleId, amount]) => grantLostTreasuresBottle(profileData, bottleId, amount));
    await persistLostTreasuresState(profileData);
    renderLostTreasuresModal();
    showNotification?.("Fake purchase added: 5 barnacle, 3 red sea, 1 seafoam, and 1 celestial bottle.", "success", 4200);
}

async function exchangeLostTreasuresDuplicates(exchangeId) {
    if (lostTreasuresOpeningInProgress) return;
    if (!currentUser) {
        openLoginModal?.();
        return;
    }
    const exchange = LOST_TREASURES_DUPLICATE_EXCHANGES.find(item => item.id === exchangeId);
    if (!exchange) return;
    const profileData = getCurrentProfileData();
    const state = getLostTreasuresState(profileData);
    if (state.duplicateCards < exchange.cost) {
        showNotification?.("Not enough duplicate scrolls yet.", "info", 2800);
        return;
    }
    state.duplicateCards -= exchange.cost;
    state.bottles[exchange.bottleId] = getLostTreasuresBottleCount(state, exchange.bottleId) + exchange.amount;
    state.selectedBottleId = exchange.bottleId;
    setLostTreasuresState(profileData, state);
    await persistLostTreasuresState(profileData);
    renderLostTreasuresModal();
    showNotification?.(`Traded duplicates for ${exchange.reward}.`, "success", 3200);
}

async function resetLostTreasuresBottles() {
    if (lostTreasuresOpeningInProgress) return;
    if (!currentUser || !isDeveloperUid(currentUser.uid)) {
        openLoginModal?.();
        return;
    }
    const profileData = getCurrentProfileData();
    const state = getLostTreasuresState(profileData);
    state.bottles = LOST_TREASURES_BOTTLES.reduce((inventory, bottle) => {
        inventory[bottle.id] = 0;
        return inventory;
    }, {});
    state.selectedBottleId = LOST_TREASURES_BOTTLES[0].id;
    setLostTreasuresState(profileData, state);
    await persistLostTreasuresState(profileData);
    lostTreasuresOpenBottleCount = 1;
    renderLostTreasuresModal();
    showNotification?.("Lost Treasures bottles reset.", "success", 3200);
}

async function resetLostTreasuresProgress() {
    if (lostTreasuresOpeningInProgress) return;
    if (!currentUser || !isDeveloperUid(currentUser.uid)) {
        openLoginModal?.();
        return;
    }
    const profileData = getCurrentProfileData();
    profileData.lostTreasures = {
        eventId: LOST_TREASURES_EVENT_ID,
        bottles: LOST_TREASURES_BOTTLES.reduce((inventory, bottle) => {
            inventory[bottle.id] = 0;
            return inventory;
        }, {}),
        collectedCards: [],
        duplicateCards: 0,
        duplicateCardCounts: {},
        claimedCategories: [],
        recentCards: [],
        claimedGrandReward: false,
        lastOpenedCardId: "",
        selectedBottleId: LOST_TREASURES_BOTTLES[0].id,
        updatedAt: Date.now()
    };
    await persistLostTreasuresState(profileData);
    const opening = document.getElementById("lost-treasures-opening-modal");
    if (opening) {
        opening.classList.add("hidden");
        opening.innerHTML = "";
    }
    activeLostTreasuresCategoryId = LOST_TREASURES_CATEGORIES[0].id;
    renderLostTreasuresModal();
    showNotification?.("Lost Treasures progress reset.", "success", 3200);
}

async function claimLostTreasuresCategory() {
    const profileData = getCurrentProfileData();
    const state = getLostTreasuresState(profileData);
    const progress = getLostTreasuresProgress(state);
    const category = progress.album.find(item => item.id === activeLostTreasuresCategoryId);
    if (!category || !category.cards.every(card => progress.collected.has(card.id)) || state.claimedCategories.includes(category.id)) return;
    state.claimedCategories.push(category.id);
    setLostTreasuresState(profileData, state, { skipRemoteSync: true });
    addPearls(LOST_TREASURES_CATEGORY_PEARL_REWARD, profileData, { deferSave: true, deferUiUpdate: true });
    await persistLostTreasuresState(profileData);
    updateHomeV3Sidebar?.(profileData);
    showNotification?.(`${category.name} complete: +${LOST_TREASURES_CATEGORY_PEARL_REWARD} pearls.`, "success", 3200);
    renderLostTreasuresModal();
}

async function claimLostTreasuresGrandReward() {
    const profileData = getCurrentProfileData();
    const state = getLostTreasuresState(profileData);
    const progress = getLostTreasuresProgress(state);
    if (progress.collectedCount !== progress.totalCards || state.claimedGrandReward) return;
    state.claimedGrandReward = true;
    setLostTreasuresState(profileData, state, { skipRemoteSync: true });
    addPearls(LOST_TREASURES_GRAND_PEARL_REWARD, profileData, { deferSave: true, deferUiUpdate: true });
    profileData.unlockedBadges = [...new Set([...(Array.isArray(profileData.unlockedBadges) ? profileData.unlockedBadges : ["starter"]), LOST_TREASURES_GRAND_BADGE.id])];
    const earnedCosmetics = Array.isArray(profileData.earnedCosmetics) ? [...profileData.earnedCosmetics] : [];
    LOST_TREASURES_GRAND_PFPS.forEach(pfp => {
        if (!earnedCosmetics.some(cosmetic => cosmetic?.imagePath === pfp.imagePath || cosmetic?.name === pfp.name)) {
            earnedCosmetics.push({ ...pfp });
        }
    });
    profileData.earnedCosmetics = earnedCosmetics;
    await persistLostTreasuresState(profileData);
    updateHomeV3Sidebar?.(profileData);
    showNotification?.(`Lost Treasures complete: +${LOST_TREASURES_GRAND_PEARL_REWARD.toLocaleString()} pearls, Treasure Keeper badge, and 2 profile icons.`, "success", 4800);
    renderLostTreasuresModal();
}

function openLostTreasuresCardDetail(cardId) {
    const modal = ensureLostTreasuresModal();
    const detail = modal.querySelector("#lost-treasures-detail");
    const state = getLostTreasuresState();
    const progress = getLostTreasuresProgress(state);
    const found = progress.album
        .flatMap(category => category.cards.map(card => ({ ...card, category })))
        .find(card => card.id === cardId);
    if (!detail || !found) return;
    const owned = progress.collected.has(found.id);
    const categoryOwned = found.category.cards.filter(card => progress.collected.has(card.id)).length;
    const categoryCards = found.category.cards;
    const cardIndex = categoryCards.findIndex(card => card.id === found.id);
    const previousCard = categoryCards[(cardIndex - 1 + categoryCards.length) % categoryCards.length];
    const nextCard = categoryCards[(cardIndex + 1) % categoryCards.length];
    detail.innerHTML = `
        <article class="lost-treasures-detail-card rarity-${found.rarity}">
            <button type="button" class="modal-x-btn" onclick="closeLostTreasuresCardDetail()" aria-label="Close scroll detail">&times;</button>
            <button type="button" class="lost-treasures-detail-nav previous" onclick="event.stopPropagation(); openLostTreasuresCardDetail('${previousCard.id}')" aria-label="Previous scroll">&lsaquo;</button>
            <button type="button" class="lost-treasures-detail-nav next" onclick="event.stopPropagation(); openLostTreasuresCardDetail('${nextCard.id}')" aria-label="Next scroll">&rsaquo;</button>
            <div class="lost-treasures-detail-art ${found.speciesImage ? "has-species-art" : ""}">
                ${getLostTreasuresCardArtMarkup(found, found.name)}
            </div>
            <div>
                <span>${found.category.name} · ${found.number}/${LOST_TREASURES_CARDS_PER_CATEGORY}</span>
                <h3>${found.name}</h3>
                <p>${LOST_TREASURES_CATEGORY_SUBTITLES[found.category.id] || "Lost Treasures scroll"}</p>
                <dl>
                    <div><dt>Status</dt><dd>${owned ? "Recovered" : "Missing"}</dd></div>
                    <div><dt>Rarity</dt><dd>${found.rarity === "rare" ? "Rare" : "Common"}</dd></div>
                    <div><dt>Duplicates</dt><dd>${getLostTreasuresCardDuplicateCount(state, found.id)}</dd></div>
                    <div><dt>Set</dt><dd>${categoryOwned}/${LOST_TREASURES_CARDS_PER_CATEGORY}</dd></div>
                </dl>
            </div>
        </article>
    `;
    detail.classList.remove("hidden");
}

function closeLostTreasuresCardDetail() {
    const detail = document.getElementById("lost-treasures-detail");
    if (detail) detail.classList.add("hidden");
}

window.openLostTreasuresModal = openLostTreasuresModal;
window.closeLostTreasuresModal = closeLostTreasuresModal;
window.showLostTreasuresCategory = showLostTreasuresCategory;
window.selectLostTreasuresBottle = selectLostTreasuresBottle;
window.selectLostTreasuresOpenAmount = selectLostTreasuresOpenAmount;
window.openLostTreasuresBottle = openLostTreasuresBottle;
window.claimLostTreasuresCategory = claimLostTreasuresCategory;
window.claimLostTreasuresGrandReward = claimLostTreasuresGrandReward;
window.openLostTreasuresCardDetail = openLostTreasuresCardDetail;
window.closeLostTreasuresCardDetail = closeLostTreasuresCardDetail;
window.exchangeLostTreasuresDuplicates = exchangeLostTreasuresDuplicates;
window.grantLostTreasuresBottle = grantLostTreasuresBottle;
window.maybeAwardLostTreasuresBottleDrop = maybeAwardLostTreasuresBottleDrop;
window.fakePurchaseLostTreasuresBundle = fakePurchaseLostTreasuresBundle;
window.resetLostTreasuresBottles = resetLostTreasuresBottles;
window.resetLostTreasuresProgress = resetLostTreasuresProgress;

const SHIVER_SEASON_ID = "tide-clash-2026-07";
const SHIVER_WIN_POINTS = Object.freeze({
    daily: 5,
    infinite: 2
});

function getShiverWinPoints(mode = "infinite") {
    return mode === "daily" ? SHIVER_WIN_POINTS.daily : SHIVER_WIN_POINTS.infinite;
}

function getShiverContributionStorageKey(mode, options = {}) {
    if (!currentUser?.uid || mode !== "daily") return "";
    const contributionKey = options.contributionKey || getUtcDateKey();
    return `shiverContribution_${SHIVER_SEASON_ID}_${currentUser.uid}_${mode}_${contributionKey}`;
}

function resolveShiverProfilePicturePath(path) {
    const storedPath = String(path || "").trim();
    if (!storedPath) return "images/pfp/shark1.png";
    if (/^https?:\/\//i.test(storedPath) || storedPath.startsWith("images/")) return storedPath;
    if (storedPath.includes("/")) return `images/${storedPath.replace(/^\/+/, "")}`;
    return `images/pfp/${storedPath}`;
}

async function contributeShiverWin(mode = "infinite", options = {}) {
    const normalizedMode = mode === "daily" ? "daily" : "infinite";
    if (typeof firebase === "undefined" || !db) return { contributed: false, reason: "unavailable" };
    const authUser = currentUser || firebase.auth?.().currentUser || null;
    if (!authUser) return { contributed: false, reason: "login-required" };

    const storageKey = getShiverContributionStorageKey(normalizedMode, options);
    if (storageKey && localStorage.getItem(storageKey) === "true") {
        return { contributed: false, reason: "already-counted" };
    }

    const membershipRef = db.collection("userShivers").doc(authUser.uid);
    const points = getShiverWinPoints(normalizedMode);
    const modeWinField = normalizedMode === "daily" ? "dailyWins" : "infiniteWins";
    const modePointField = normalizedMode === "daily" ? "dailyPoints" : "infinitePoints";
    const now = firebase.firestore.FieldValue.serverTimestamp();
    let didIncrement = false;
    let shiverSummary = null;

    try {
        await db.runTransaction(async transaction => {
            const membershipSnap = await transaction.get(membershipRef);
            if (!membershipSnap.exists) return;

            const membership = membershipSnap.data() || {};
            const shiverId = membership.shiverId;
            if (!shiverId) return;

            const shiverRef = db.collection("shivers").doc(shiverId);
            const memberRef = shiverRef.collection("members").doc(authUser.uid);
            const seasonRef = db.collection("shiverSeasons").doc(SHIVER_SEASON_ID).collection("entries").doc(shiverId);
            const seasonMemberRef = seasonRef.collection("members").doc(authUser.uid);

            const shiverSnap = await transaction.get(shiverRef);
            const memberSnap = await transaction.get(memberRef);
            if (!shiverSnap.exists || !memberSnap.exists) return;

            const shiver = shiverSnap.data() || {};
            if (shiver.status === "disbanded") return;

            const profileData = getCurrentProfileData();
            const username = String(profileData.username || authUser.email?.split("@")[0] || "Sharkdle Player").slice(0, 32);
            const profilePicture = resolveShiverProfilePicturePath(profileData.profilePicture || profileData.profilePic);
            const shiverName = shiver.name || membership.shiverName || "Unnamed Shiver";
            const shiverTag = shiver.tag || membership.shiverTag || "----";
            const shiverColor = shiver.color || membership.shiverColor || "reef";
            const shiverMemberCount = Math.max(1, Number(shiver.memberCount) || 1);

            transaction.update(shiverRef, {
                totalPoints: firebase.firestore.FieldValue.increment(points),
                seasonPoints: firebase.firestore.FieldValue.increment(points),
                battlePoints: firebase.firestore.FieldValue.increment(points),
                wins: firebase.firestore.FieldValue.increment(1),
                [modeWinField]: firebase.firestore.FieldValue.increment(1),
                [modePointField]: firebase.firestore.FieldValue.increment(points),
                seasonId: SHIVER_SEASON_ID,
                updatedAt: now,
                lastContributionAt: now,
                lastContributionMode: normalizedMode,
                lastContributionUid: authUser.uid
            });

            transaction.set(memberRef, {
                username,
                profilePicture,
                points: firebase.firestore.FieldValue.increment(points),
                wins: firebase.firestore.FieldValue.increment(1),
                [modeWinField]: firebase.firestore.FieldValue.increment(1),
                updatedAt: now,
                lastContributionMode: normalizedMode
            }, { merge: true });

            transaction.set(membershipRef, {
                username,
                profilePicture,
                shiverName,
                shiverTag,
                shiverColor,
                points: firebase.firestore.FieldValue.increment(points),
                wins: firebase.firestore.FieldValue.increment(1),
                [modeWinField]: firebase.firestore.FieldValue.increment(1),
                updatedAt: now,
                lastContributionMode: normalizedMode
            }, { merge: true });

            transaction.set(seasonRef, {
                shiverId,
                name: shiverName,
                tag: shiverTag,
                color: shiverColor,
                memberCount: shiverMemberCount,
                points: firebase.firestore.FieldValue.increment(points),
                wins: firebase.firestore.FieldValue.increment(1),
                [modeWinField]: firebase.firestore.FieldValue.increment(1),
                seasonId: SHIVER_SEASON_ID,
                updatedAt: now,
                lastContributionMode: normalizedMode,
                lastContributionUid: authUser.uid
            }, { merge: true });

            transaction.set(seasonMemberRef, {
                uid: authUser.uid,
                username,
                profilePicture,
                points: firebase.firestore.FieldValue.increment(points),
                wins: firebase.firestore.FieldValue.increment(1),
                [modeWinField]: firebase.firestore.FieldValue.increment(1),
                updatedAt: now,
                lastContributionMode: normalizedMode
            }, { merge: true });

            shiverSummary = { shiverId, shiverName, shiverTag, shiverColor };
            didIncrement = true;
        });

        if (didIncrement) {
            if (storageKey) localStorage.setItem(storageKey, "true");
            if (shiverSummary) {
                const profileData = getCurrentProfileData();
                profileData.shiverId = shiverSummary.shiverId;
                profileData.shiverName = shiverSummary.shiverName;
                profileData.shiverTag = shiverSummary.shiverTag;
                profileData.shiverColor = shiverSummary.shiverColor;
                profileData.shiverSeasonId = SHIVER_SEASON_ID;
                saveUserProfileLocally(profileData, { skipRemoteSync: true });
            }
            showNotification(`Shiver +${points} teeth`, "success", 2200);
            return { contributed: true, points };
        }

        return { contributed: false, reason: "no-shiver" };
    } catch (error) {
        console.warn("Unable to contribute Shiver win:", error);
        return { contributed: false, reason: "error" };
    }
}

window.contributeShiverWin = contributeShiverWin;

const SHARKDLE_SETTINGS_KEY = "sharkdle_qol_settings_v2";
const SHARKDLE_SETTINGS_DEFAULTS = {
    funMode: false,
    sfx: true,
    ambientAudio: false,
    ambientVolume: 35
};

let sharkdleSettingsAudioContext = null;
let sharkdleAmbientAudioNodes = null;
let sharkdleCursorAnimationStarted = false;
let sharkdleCursorX = window.innerWidth / 2;
let sharkdleCursorY = window.innerHeight / 2;
let sharkdleCursorSmoothX = sharkdleCursorX;
let sharkdleCursorSmoothY = sharkdleCursorY;
let sharkdleLastBubbleAt = 0;

function readSharkdleSettings() {
    try {
        const saved = JSON.parse(localStorage.getItem(SHARKDLE_SETTINGS_KEY) || "{}");
        const normalized = { ...SHARKDLE_SETTINGS_DEFAULTS };
        if (saved && typeof saved === "object") {
            Object.keys(normalized).forEach(key => {
                if (Object.prototype.hasOwnProperty.call(saved, key)) normalized[key] = saved[key];
            });
        }
        return normalized;
    } catch (error) {
        return { ...SHARKDLE_SETTINGS_DEFAULTS };
    }
}

function writeSharkdleSettings(settings) {
    const normalized = { ...SHARKDLE_SETTINGS_DEFAULTS };
    if (settings && typeof settings === "object") {
        Object.keys(normalized).forEach(key => {
            if (Object.prototype.hasOwnProperty.call(settings, key)) normalized[key] = settings[key];
        });
    }
    localStorage.setItem(SHARKDLE_SETTINGS_KEY, JSON.stringify(normalized));
}

function getSharkdleAudioContext() {
    const AudioContextClass = window.AudioContext || window.webkitAudioContext;
    if (!AudioContextClass) return null;
    if (!sharkdleSettingsAudioContext) sharkdleSettingsAudioContext = new AudioContextClass();
    if (sharkdleSettingsAudioContext.state === "suspended") {
        sharkdleSettingsAudioContext.resume().catch(() => {});
    }
    return sharkdleSettingsAudioContext;
}

function isSharkdleSfxEnabled() {
    return Boolean(readSharkdleSettings().sfx);
}

function getAmbientVolumePercent(settings = readSharkdleSettings()) {
    const value = Math.round(Number(settings.ambientVolume));
    if (!Number.isFinite(value)) return SHARKDLE_SETTINGS_DEFAULTS.ambientVolume;
    return Math.min(100, Math.max(0, value));
}

function getAmbientVolumeGain(settings = readSharkdleSettings()) {
    return (getAmbientVolumePercent(settings) / 100) * 0.05;
}

function updateAmbientAudioVolume(settings = readSharkdleSettings()) {
    if (!sharkdleAmbientAudioNodes?.gain) return;
    const ctx = getSharkdleAudioContext();
    const nextGain = getAmbientVolumeGain(settings);
    if (ctx && typeof sharkdleAmbientAudioNodes.gain.gain.setTargetAtTime === "function") {
        sharkdleAmbientAudioNodes.gain.gain.setTargetAtTime(nextGain, ctx.currentTime, 0.04);
    } else {
        sharkdleAmbientAudioNodes.gain.gain.value = nextGain;
    }
}

function playSfx(name = "click") {
    if (!isSharkdleSfxEnabled()) return;
    const ctx = getSharkdleAudioContext();
    if (!ctx) return;

    const playTone = (frequency, duration, type = "triangle", gainValue = 0.025, slideTo = null, delay = 0) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        const startAt = ctx.currentTime + delay;
        osc.type = type;
        osc.frequency.setValueAtTime(frequency, startAt);
        if (slideTo) osc.frequency.exponentialRampToValueAtTime(slideTo, startAt + duration);
        gain.gain.setValueAtTime(0.0001, startAt);
        gain.gain.exponentialRampToValueAtTime(gainValue, startAt + 0.01);
        gain.gain.exponentialRampToValueAtTime(0.0001, startAt + duration);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(startAt);
        osc.stop(startAt + duration + 0.03);
    };

    if (name === "success") {
        playTone(523, 0.08, "sine", 0.04);
        playTone(659, 0.09, "sine", 0.04, null, 0.075);
        playTone(784, 0.1, "sine", 0.04, null, 0.15);
        return;
    }

    if (name === "toggle") {
        playTone(330, 0.06, "triangle", 0.03, 440);
        return;
    }

    if (name === "crate") {
        playTone(150, 0.12, "triangle", 0.055, 90);
        playTone(760, 0.13, "sine", 0.04, 980, 0.12);
        return;
    }

    playTone(420, 0.045, "triangle", 0.025);
}

function startAmbientAudio() {
    const ctx = getSharkdleAudioContext();
    if (!ctx || sharkdleAmbientAudioNodes) return;

    const lowOsc = ctx.createOscillator();
    const highOsc = ctx.createOscillator();
    const gain = ctx.createGain();
    const filter = ctx.createBiquadFilter();

    lowOsc.type = "sine";
    highOsc.type = "triangle";
    lowOsc.frequency.value = 84;
    highOsc.frequency.value = 166;
    filter.type = "lowpass";
    filter.frequency.value = 420;
    gain.gain.value = getAmbientVolumeGain();

    lowOsc.connect(filter);
    highOsc.connect(filter);
    filter.connect(gain);
    gain.connect(ctx.destination);
    lowOsc.start();
    highOsc.start();

    sharkdleAmbientAudioNodes = { lowOsc, highOsc, gain, filter };
    updateAmbientAudioVolume();
}

function stopAmbientAudio() {
    if (!sharkdleAmbientAudioNodes) return;
    Object.values(sharkdleAmbientAudioNodes).forEach(node => {
        if (typeof node.stop === "function") {
            try { node.stop(); } catch (error) {}
        }
        if (typeof node.disconnect === "function") {
            try { node.disconnect(); } catch (error) {}
        }
    });
    sharkdleAmbientAudioNodes = null;
}

function createCursorBubble(x, y) {
    if (!document.body.classList.contains("fun-mode") || document.body.classList.contains("reduced-motion")) return;
    const now = Date.now();
    if (now - sharkdleLastBubbleAt < 95) return;
    sharkdleLastBubbleAt = now;

    const bubble = document.createElement("span");
    const size = 8 + Math.random() * 12;
    bubble.className = "cursor-bubble";
    bubble.style.width = `${size}px`;
    bubble.style.height = `${size}px`;
    bubble.style.left = `${x + 8}px`;
    bubble.style.top = `${y + 16}px`;
    bubble.style.setProperty("--drift", Math.random().toFixed(2));
    document.body.appendChild(bubble);
    setTimeout(() => bubble.remove(), 1900);
}

function createBitePop(x, y) {
    if (!document.body.classList.contains("fun-mode") || document.body.classList.contains("reduced-motion")) return;
    const bite = document.createElement("span");
    bite.className = "bite-pop";
    bite.style.left = `${x}px`;
    bite.style.top = `${y}px`;
    document.body.appendChild(bite);
    setTimeout(() => bite.remove(), 500);
}

function ensureSharkCursorAnimation() {
    if (sharkdleCursorAnimationStarted) return;
    sharkdleCursorAnimationStarted = true;

    const animate = () => {
        const cursor = document.getElementById("cursor-shark");
        if (cursor && document.body.classList.contains("fun-mode")) {
            sharkdleCursorSmoothX += (sharkdleCursorX - sharkdleCursorSmoothX) * 0.28;
            sharkdleCursorSmoothY += (sharkdleCursorY - sharkdleCursorSmoothY) * 0.28;
            cursor.style.transform = `translate3d(${sharkdleCursorSmoothX - 12}px, ${sharkdleCursorSmoothY - 12}px, 0) rotate(8deg)`;
        }
        requestAnimationFrame(animate);
    };

    document.addEventListener("mousemove", (event) => {
        sharkdleCursorX = event.clientX;
        sharkdleCursorY = event.clientY;
        const cursor = document.getElementById("cursor-shark");
        if (document.body.classList.contains("fun-mode")) {
            cursor?.classList.add("cursor-visible");
            createCursorBubble(event.clientX, event.clientY);
        }
    });

    document.addEventListener("mousedown", (event) => {
        if (!document.body.classList.contains("fun-mode")) return;
        document.getElementById("cursor-shark")?.classList.add("cursor-bite");
        createBitePop(event.clientX, event.clientY);
        playSfx("click");
    });

    document.addEventListener("mouseup", () => {
        document.getElementById("cursor-shark")?.classList.remove("cursor-bite");
    });

    document.addEventListener("mouseleave", () => {
        document.getElementById("cursor-shark")?.classList.remove("cursor-visible");
    });

    document.addEventListener("mouseover", (event) => {
        const interactive = event.target?.closest?.("button, a, input, select, textarea, [role='button'], .profile-inventory-card, .theme-option, .home-v3-event");
        document.getElementById("cursor-shark")?.classList.toggle("cursor-hover", Boolean(interactive));
    });

    animate();
}

function applySharkdleSettings() {
    const settings = readSharkdleSettings();
    document.body.classList.toggle("fun-mode", Boolean(settings.funMode));
    document.body.classList.toggle("ambient-audio-on", Boolean(settings.ambientAudio));

    const pairs = {
        "fun-mode-toggle": settings.funMode,
        "sfx-toggle": settings.sfx,
        "ambient-audio-toggle": settings.ambientAudio
    };

    Object.entries(pairs).forEach(([id, value]) => {
        const input = document.getElementById(id);
        if (input) input.checked = Boolean(value);
    });

    syncCrateInstantOpenControls();

    const volumePercent = getAmbientVolumePercent(settings);
    const volumeInput = document.getElementById("bg-volume-slider");
    const volumeValue = document.getElementById("bg-volume-value");
    if (volumeInput) {
        volumeInput.value = String(volumePercent);
        volumeInput.disabled = !settings.ambientAudio;
    }
    if (volumeValue) volumeValue.textContent = `${volumePercent}%`;

    if (settings.ambientAudio) {
        startAmbientAudio();
        updateAmbientAudioVolume(settings);
    } else {
        stopAmbientAudio();
    }

    if (!settings.funMode) {
        document.getElementById("cursor-shark")?.classList.remove("cursor-visible", "cursor-hover", "cursor-bite");
    }

    localStorage.setItem("sharkdle_fun_mode_enabled", String(Boolean(settings.funMode)));
}

function setSharkdleSetting(key, value) {
    const settings = readSharkdleSettings();
    settings[key] = Boolean(value);
    writeSharkdleSettings(settings);
    applySharkdleSettings();
    playSfx("toggle");
}

function setSharkdleAmbientVolume(value) {
    const settings = readSharkdleSettings();
    settings.ambientVolume = getAmbientVolumePercent({ ambientVolume: value });
    writeSharkdleSettings(settings);
    applySharkdleSettings();
}

function resetSharkdleSettings() {
    writeSharkdleSettings({ ...SHARKDLE_SETTINGS_DEFAULTS });
    applySharkdleSettings();
    playSfx("success");
    showNotification("Settings reset.", "success", 2500);
}

function testSharkdleSound() {
    const settings = readSharkdleSettings();
    settings.sfx = true;
    writeSharkdleSettings(settings);
    applySharkdleSettings();
    playSfx("success");
    showNotification("Sound test played.", "success", 2200);
}

function bindSharkdleSettings() {
    ensureSharkCursorAnimation();

    const bindings = [
        ["fun-mode-toggle", "funMode"],
        ["sfx-toggle", "sfx"],
        ["ambient-audio-toggle", "ambientAudio"]
    ];

    bindings.forEach(([id, key]) => {
        const input = document.getElementById(id);
        if (!input || input.dataset.settingsBound === "true") return;
        input.dataset.settingsBound = "true";
        input.addEventListener("change", () => setSharkdleSetting(key, input.checked));
    });

    const crateInstantToggle = document.getElementById("crate-instant-settings-toggle");
    if (crateInstantToggle && crateInstantToggle.dataset.settingsBound !== "true") {
        crateInstantToggle.dataset.settingsBound = "true";
        crateInstantToggle.addEventListener("change", () => toggleCrateInstantOpen(crateInstantToggle.checked));
    }

    const volumeInput = document.getElementById("bg-volume-slider");
    if (volumeInput && volumeInput.dataset.settingsBound !== "true") {
        volumeInput.dataset.settingsBound = "true";
        volumeInput.addEventListener("input", () => setSharkdleAmbientVolume(volumeInput.value));
        volumeInput.addEventListener("change", () => setSharkdleAmbientVolume(volumeInput.value));
    }

    const test = document.getElementById("settings-test-sound");
    if (test && test.dataset.settingsBound !== "true") {
        test.dataset.settingsBound = "true";
        test.addEventListener("click", testSharkdleSound);
    }

    const reset = document.getElementById("settings-reset");
    if (reset && reset.dataset.settingsBound !== "true") {
        reset.dataset.settingsBound = "true";
        reset.addEventListener("click", resetSharkdleSettings);
    }

    applySharkdleSettings();
}

document.addEventListener("DOMContentLoaded", bindSharkdleSettings);
bindSharkdleSettings();

window.applySharkdleSettings = applySharkdleSettings;
window.resetSharkdleSettings = resetSharkdleSettings;
window.testSharkdleSound = testSharkdleSound;
window.playSfx = playSfx;
window.setSharkdleAmbientVolume = setSharkdleAmbientVolume;

let consumablesPageInterval = null;

function renderConsumablesPage() {
    const pageRoot = document.getElementById("consumables-page");
    if (!pageRoot) return;

    const loginStateCopy = document.getElementById("consumables-login-state");
    const loginBtn = document.getElementById("consumables-login-btn");
    const shieldCountEl = document.getElementById("consumables-shield-count");

    if (loginBtn) {
        loginBtn.onclick = () => openLoginModal();
    }

    const loggedIn = Boolean(currentUser);
    pageRoot.classList.toggle("consumables-logged-out", !loggedIn);

    if (!loggedIn) {
        if (loginStateCopy) loginStateCopy.textContent = "Login to view and use your consumables.";
        if (shieldCountEl) shieldCountEl.textContent = "0";
        return;
    }

    const profileData = getCurrentProfileData();
    if (loginStateCopy) loginStateCopy.textContent = "Consumables are synced to your account.";
    if (shieldCountEl) shieldCountEl.textContent = String(getStreakShieldCount(profileData));
}

function ensureConsumablesPageTimer() {
    const pageRoot = document.getElementById("consumables-page");
    if (!pageRoot) {
        if (consumablesPageInterval) {
            clearInterval(consumablesPageInterval);
            consumablesPageInterval = null;
        }
        return;
    }

    renderConsumablesPage();
    if (consumablesPageInterval) return;
    consumablesPageInterval = setInterval(() => {
        if (!document.getElementById("consumables-page")) {
            clearInterval(consumablesPageInterval);
            consumablesPageInterval = null;
            return;
        }
        renderConsumablesPage();
    }, 1000);
}

function setupGlobalXpEventListener() {
    if (!db) return;
    if (globalXpEventUnsubscribe) {
        globalXpEventUnsubscribe();
        globalXpEventUnsubscribe = null;
    }
    globalXpEventUnsubscribe = db
        .collection(GLOBAL_XP_EVENT_CONFIG_PATH.collection)
        .doc(GLOBAL_XP_EVENT_CONFIG_PATH.doc)
        .onSnapshot(snapshot => {
            globalXpEventOverride = snapshot.exists ? (snapshot.data() || null) : null;
            ensureXpEventBannerTimer();
        }, error => {
            console.warn("Global XP event listener failed:", error);
        });
}

function getValidIndexThemeIds() {
    return INDEX_THEME_OPTIONS.map(option => option.id);
}

function normalizeIndexThemeId(themeId = "default") {
    const normalized = String(themeId || "").trim().toLowerCase();
    return getValidIndexThemeIds().includes(normalized) ? normalized : "default";
}

function isSeasonalThemeDisabled() {
    return localStorage.getItem(SEASONAL_THEME_DISABLED_KEY) === "true";
}

function updateSeasonalThemeToggleUI() {
    const button = document.getElementById("seasonal-theme-toggle-btn");
    const status = document.getElementById("seasonal-theme-status");
    if (!button) return;

    const disabled = isSeasonalThemeDisabled();
    button.textContent = disabled ? "Enable Seasonal Theme" : "Use Default Theme";
    if (status) {
        status.textContent = disabled
            ? "Seasonal themes are disabled on this device."
            : "Seasonal themes are enabled.";
    }
}

window.toggleSeasonalThemeOverride = function toggleSeasonalThemeOverride() {
    const nextDisabled = !isSeasonalThemeDisabled();
    if (nextDisabled) {
        localStorage.setItem(SEASONAL_THEME_DISABLED_KEY, "true");
        showNotification("Seasonal theme disabled (this device only).", "success", 2500);
    } else {
        localStorage.removeItem(SEASONAL_THEME_DISABLED_KEY);
        showNotification("Seasonal theme enabled.", "success", 2000);
    }

    // Re-apply the current (remote/cached) theme immediately on the home page.
    applyIndexTheme(localStorage.getItem("globalIndexThemeId") || "default");
    updateSeasonalThemeToggleUI();
};

function applyIndexTheme(themeId = "default", force = false) {
    const body = document.body;
    if (!body) return "default";

    const resolvedThemeId = normalizeIndexThemeId(themeId);
    const modePagesUseDefaultTheme = body.classList.contains("mode-v3-page") && resolvedThemeId !== "default";
    const appliedThemeId = (modePagesUseDefaultTheme || (!force && isSeasonalThemeDisabled() && resolvedThemeId !== "default"))
        ? "default"
        : resolvedThemeId;
    getValidIndexThemeIds().forEach(id => {
        body.classList.remove(`index-theme-${id}`);
        body.classList.remove(`global-ui-theme-${id}`);
    });
    body.classList.add(`index-theme-${appliedThemeId}`);
    body.classList.add(`global-ui-theme-${appliedThemeId}`);
    localStorage.setItem("globalIndexThemeId", resolvedThemeId);
    localStorage.setItem("globalUiThemeCache", resolvedThemeId);
    updateSeasonalCratePanels();
    if (typeof updateSeasonalCrateCraftingUI === "function") updateSeasonalCrateCraftingUI();
    if (typeof renderHomeCratesModal === "function" && !document.getElementById("homeCratesModal")?.classList.contains("hidden")) renderHomeCratesModal();
    if (typeof renderPearlShop === "function") renderPearlShop();
    if (!document.getElementById("spinWheelModal")?.classList.contains("hidden")) {
        const disk = document.getElementById("spin-wheel-disk");
        if (disk && typeof buildSpinWheelGradient === "function") disk.style.background = buildSpinWheelGradient();
        if (typeof renderSpinWheelLegend === "function") renderSpinWheelLegend();
    }
    applySeasonalDecorationLayout(null, appliedThemeId);

    return appliedThemeId;
}

const HALLOWEEN_WEB_LAYOUT_STORAGE_KEY = "sharkdle_halloween_web_layout_v1";
const CHRISTMAS_DECORATION_LAYOUT_STORAGE_KEY = "sharkdle_christmas_decoration_layout_v1";
const SEASONAL_DECORATION_EDITOR_POSITION_STORAGE_KEY = "sharkdle_seasonal_decoration_editor_position_v1";
const HALLOWEEN_WEB_TEXTURE_IDS = [
    "1",
    "2",
    "3",
    "4",
    "web-cobweb",
    "ghost",
    "pumpkin",
    "bats",
    "bats-wide",
    "cauldron",
    "cat",
    "candle",
    "potion",
    "tombstone",
    "coffin",
    "skull",
    "owl",
    "broom",
    "haunted-house"
];
const CHRISTMAS_DECORATION_TEXTURE_IDS = [
    "santa-hat",
    "santa-cap",
    "snowman",
    "snowman-scarf",
    "tree",
    "tree-alt",
    "gift",
    "present",
    "snowflake",
    "wreath",
    "stocking",
    "candy-cane",
    "ornament",
    "bell",
    "star",
    "ball",
    "santa",
    "hills"
];
const HALLOWEEN_DECORATION_TEXTURE_OPTIONS = [
    ["1", "Cobweb 1"],
    ["2", "Cobweb 2"],
    ["3", "Cobweb 3"],
    ["4", "Cobweb 4"],
    ["web-cobweb", "Cobweb 5"],
    ["ghost", "Ghost"],
    ["pumpkin", "Pumpkin"],
    ["bats", "Bats"],
    ["bats-wide", "Bats Wide"],
    ["cauldron", "Cauldron"],
    ["cat", "Cat"],
    ["candle", "Candle"],
    ["potion", "Potion"],
    ["tombstone", "Tombstone"],
    ["coffin", "Coffin"],
    ["skull", "Skull"],
    ["owl", "Owl"],
    ["broom", "Broom"],
    ["haunted-house", "Haunted House"]
];
const CHRISTMAS_DECORATION_TEXTURE_OPTIONS = [
    ["santa-hat", "Santa Hat"],
    ["santa-cap", "Santa Cap"],
    ["snowman", "Snowman"],
    ["snowman-scarf", "Snowman Scarf"],
    ["tree", "Christmas Tree"],
    ["tree-alt", "Tree Alt"],
    ["gift", "Gift"],
    ["present", "Present"],
    ["snowflake", "Snowflake"],
    ["wreath", "Wreath"],
    ["stocking", "Stocking"],
    ["candy-cane", "Candy Cane"],
    ["ornament", "Ornament"],
    ["bell", "Bell"],
    ["star", "Star"],
    ["ball", "Christmas Ball"],
    ["santa", "Santa"],
    ["hills", "Hills"]
];
const DEFAULT_HALLOWEEN_WEB_LAYOUT = [
    { id: "web-1", texture: "1", x: -2.8, y: -4.4, size: 11.8, rotate: 0, opacity: 0.12 },
    { id: "web-2", texture: "2", x: 64.5, y: -3.8, size: 9.2, rotate: 0, opacity: 0.12 },
    { id: "web-3", texture: "3", x: 91.5, y: 27.5, size: 13.6, rotate: 90, opacity: 0.11 },
    { id: "web-4", texture: "4", x: 12.5, y: 81.5, size: 10.4, rotate: 180, opacity: 0.1 }
];
const DEFAULT_CHRISTMAS_DECORATION_LAYOUT = [
    { id: "christmas-1", texture: "santa-cap", x: 2.8, y: 8.8, size: 7.6, rotate: -18, opacity: 0.86 },
    { id: "christmas-2", texture: "snowflake", x: 70.5, y: -1.4, size: 10.2, rotate: 14, opacity: 0.28 },
    { id: "christmas-3", texture: "snowman", x: 84.5, y: 61.5, size: 10.8, rotate: -4, opacity: 0.54 },
    { id: "christmas-4", texture: "gift", x: 12.5, y: 78.5, size: 8.8, rotate: -9, opacity: 0.58 },
    { id: "christmas-5", texture: "wreath", x: 91.5, y: 28.5, size: 8.4, rotate: 10, opacity: 0.46 },
    { id: "christmas-6", texture: "candy-cane", x: 54.5, y: 76.5, size: 7.2, rotate: 18, opacity: 0.34 },
    { id: "christmas-hills", texture: "hills", x: -5, y: 48, size: 112, rotate: 0, opacity: 0.86 }
];
const SEASONAL_DECORATION_THEMES = {
    halloween: {
        id: "halloween",
        label: "Halloween",
        itemLabel: "Decoration",
        storageKey: HALLOWEEN_WEB_LAYOUT_STORAGE_KEY,
        remoteKey: "halloweenWebLayout",
        textureIds: HALLOWEEN_WEB_TEXTURE_IDS,
        textureOptions: HALLOWEEN_DECORATION_TEXTURE_OPTIONS,
        defaults: DEFAULT_HALLOWEEN_WEB_LAYOUT
    },
    christmas: {
        id: "christmas",
        label: "Christmas",
        itemLabel: "Decoration",
        storageKey: CHRISTMAS_DECORATION_LAYOUT_STORAGE_KEY,
        remoteKey: "christmasDecorationLayout",
        textureIds: CHRISTMAS_DECORATION_TEXTURE_IDS,
        textureOptions: CHRISTMAS_DECORATION_TEXTURE_OPTIONS,
        defaults: DEFAULT_CHRISTMAS_DECORATION_LAYOUT
    }
};
let activeHalloweenWebEditId = "web-1";
let halloweenWebEditorDrag = null;
let seasonalDecorationEditorDrag = null;
let activeHalloweenWebLayout = null;
let globalHalloweenWebLayout = null;
let globalChristmasDecorationLayout = null;
let activeSeasonalDecorationThemeId = "halloween";

function clampHalloweenLayoutNumber(value, min, max, fallback) {
    const number = Number(value);
    if (!Number.isFinite(number)) return fallback;
    return Math.min(max, Math.max(min, number));
}

function roundHalloweenLayoutNumber(value) {
    return Math.round(Number(value) * 10) / 10;
}

function getSeasonalDecorationTheme(themeId = null) {
    const resolvedThemeId = normalizeIndexThemeId(themeId || activeSeasonalDecorationThemeId || "halloween");
    return SEASONAL_DECORATION_THEMES[resolvedThemeId] || null;
}

function getGlobalSeasonalDecorationLayout(themeId = null) {
    return normalizeIndexThemeId(themeId) === "christmas" ? globalChristmasDecorationLayout : globalHalloweenWebLayout;
}

function setGlobalSeasonalDecorationLayout(themeId = null, layout = null) {
    if (normalizeIndexThemeId(themeId) === "christmas") {
        globalChristmasDecorationLayout = layout;
    } else {
        globalHalloweenWebLayout = layout;
    }
}

function getVisibleSeasonalDecorationThemeId(themeId = null) {
    const resolvedThemeId = normalizeIndexThemeId(themeId || localStorage.getItem("globalIndexThemeId") || "default");
    return SEASONAL_DECORATION_THEMES[resolvedThemeId] ? resolvedThemeId : null;
}

function getEditableSeasonalDecorationThemeId() {
    const themeSelect = document.getElementById("admin-index-theme-select");
    const selectedThemeId = normalizeIndexThemeId(themeSelect?.value || "");
    if (SEASONAL_DECORATION_THEMES[selectedThemeId]) return selectedThemeId;
    return getVisibleSeasonalDecorationThemeId() || activeSeasonalDecorationThemeId || "halloween";
}

function normalizeHalloweenWebItem(item = {}, fallback = DEFAULT_HALLOWEEN_WEB_LAYOUT[0], index = 0, themeId = null) {
    const theme = getSeasonalDecorationTheme(themeId) || SEASONAL_DECORATION_THEMES.halloween;
    const id = String(item.id || fallback.id || `decoration-${Date.now()}-${index}`).slice(0, 40);
    const texture = theme.textureIds.includes(String(item.texture)) ? String(item.texture) : fallback.texture || theme.textureIds[0];
    const maxSize = theme.id === "christmas" && texture === "hills" ? 160 : 42;
    return {
        id,
        texture,
        x: roundHalloweenLayoutNumber(clampHalloweenLayoutNumber(item.x, -45, 115, fallback.x)),
        y: roundHalloweenLayoutNumber(clampHalloweenLayoutNumber(item.y, -45, 115, fallback.y)),
        size: roundHalloweenLayoutNumber(clampHalloweenLayoutNumber(item.size, 6, maxSize, fallback.size)),
        rotate: roundHalloweenLayoutNumber(clampHalloweenLayoutNumber(item.rotate, -180, 180, fallback.rotate)),
        opacity: Math.round(clampHalloweenLayoutNumber(item.opacity, 0, 0.92, fallback.opacity) * 100) / 100
    };
}

function normalizeHalloweenWebLayout(layout = null, themeId = null) {
    const theme = getSeasonalDecorationTheme(themeId) || SEASONAL_DECORATION_THEMES.halloween;
    let list = [];
    if (Array.isArray(layout)) {
        list = layout;
    } else if (layout && typeof layout === "object") {
        list = Object.entries(layout).map(([id, item], index) => ({
            ...(item || {}),
            id: String(id).startsWith("web-") ? String(id) : `web-${id}`,
            texture: item?.texture || String(index + 1)
        }));
    }
    if (!list.length && layout === null) list = theme.defaults;
    if (theme.id === "christmas" && layout !== null && !list.some(item => String(item.texture) === "hills")) {
        list = list.slice(0, 23).concat(theme.defaults.filter(item => item.texture === "hills"));
    }
    return list.slice(0, 24).map((item, index) => {
        const fallback = theme.defaults[index % theme.defaults.length];
        const normalizedItem = normalizeHalloweenWebItem(item, fallback, index, theme.id);
        if (
            theme.id === "christmas"
            && normalizedItem.texture === "hills"
            && (
                (normalizedItem.x === 13 && normalizedItem.y === 70.5 && normalizedItem.size === 72)
                || (normalizedItem.x === -5 && normalizedItem.y === 28 && normalizedItem.size === 112)
                || (normalizedItem.x === -5 && normalizedItem.y === 43.5 && normalizedItem.size === 112)
                || (normalizedItem.x === -5 && normalizedItem.y === 48 && normalizedItem.size === 42)
            )
        ) {
            return { ...normalizedItem, x: -5, y: 48, size: 112, opacity: Math.max(normalizedItem.opacity, 0.86) };
        }
        return normalizedItem;
    });
}

function parseHalloweenWebLayout(value, themeId = null) {
    if (!value) return null;
    try {
        return normalizeHalloweenWebLayout(typeof value === "string" ? JSON.parse(value) : value, themeId);
    } catch (error) {
        return null;
    }
}

function getPreferredHalloweenWebLayout(themeId = null) {
    const theme = getSeasonalDecorationTheme(themeId) || SEASONAL_DECORATION_THEMES.halloween;
    const localLayout = isDeveloperSessionActive() ? parseHalloweenWebLayout(localStorage.getItem(theme.storageKey), theme.id) : null;
    return normalizeHalloweenWebLayout(localLayout || getGlobalSeasonalDecorationLayout(theme.id) || theme.defaults, theme.id);
}

function getHalloweenWebLayer() {
    return document.querySelector(".halloween-web-layer");
}

function clearChristmasHeroDecorations() {
    document.querySelectorAll(".christmas-hero-decoration").forEach(element => element.remove());
}

function getChristmasHeroDecorationHost() {
    return document.querySelector(".home-v3-hero");
}

function getHalloweenWebElement(id) {
    return Array.from(document.querySelectorAll(".halloween-web")).find(web => web.dataset.halloweenWebId === id) || null;
}

function renderHalloweenWebElements(layout, themeId = null) {
    const layer = getHalloweenWebLayer();
    if (!layer) return;
    const theme = getSeasonalDecorationTheme(themeId) || SEASONAL_DECORATION_THEMES.halloween;
    layer.replaceChildren();
    clearChristmasHeroDecorations();
    layout.forEach((item) => {
        const web = document.createElement("span");
        const isChristmasHills = theme.id === "christmas" && item.texture === "hills";
        web.className = `halloween-web seasonal-decoration-${theme.id} halloween-web-texture-${item.texture}${isChristmasHills ? " christmas-hero-decoration" : ""}`;
        web.dataset.halloweenWebId = item.id;
        web.dataset.webTexture = item.texture;
        web.dataset.decorationTheme = theme.id;
        web.setAttribute("aria-hidden", "true");
        web.addEventListener("pointerdown", event => {
            if (!document.body.classList.contains("halloween-web-editing")) return;
            event.preventDefault();
            selectHalloweenWebForEditing(item.id);
            halloweenWebEditorDrag = {
                id: item.id,
                startClientX: event.clientX,
                startClientY: event.clientY,
                startX: item.x,
                startY: item.y
            };
            try {
                web.setPointerCapture(event.pointerId);
            } catch (error) {
                // Pointer capture is best effort for older mobile WebViews.
            }
        });
        const host = isChristmasHills ? getChristmasHeroDecorationHost() : layer;
        (host || layer).appendChild(web);
    });
}

function syncHalloweenWebSelectOptions() {
    const select = document.getElementById("halloween-web-editor-select");
    if (!select) return;
    const theme = getSeasonalDecorationTheme(activeSeasonalDecorationThemeId) || SEASONAL_DECORATION_THEMES.halloween;
    const layout = activeHalloweenWebLayout || getPreferredHalloweenWebLayout(theme.id);
    select.replaceChildren();
    layout.forEach((item, index) => {
        const option = document.createElement("option");
        option.value = item.id;
        option.textContent = `${theme.itemLabel} ${index + 1}`;
        select.appendChild(option);
    });
}

function syncSeasonalDecorationAssetOptions(themeId = null) {
    const texture = document.getElementById("halloween-web-texture-select");
    if (!texture) return;
    const theme = getSeasonalDecorationTheme(themeId) || SEASONAL_DECORATION_THEMES.halloween;
    const currentValue = texture.value;
    texture.replaceChildren();
    theme.textureOptions.forEach(([value, label]) => {
        const option = document.createElement("option");
        option.value = value;
        option.textContent = label;
        texture.appendChild(option);
    });
    if (theme.textureIds.includes(currentValue)) texture.value = currentValue;
}

function syncSeasonalDecorationEditorLabels(themeId = null) {
    const theme = getSeasonalDecorationTheme(themeId);
    if (!theme) return;
    const title = document.querySelector("#halloweenWebEditor .halloween-web-editor-head strong");
    const itemLabel = document.querySelector('label[for="halloween-web-editor-select"]');
    if (title) title.textContent = `${theme.label} Layout`;
    if (itemLabel) itemLabel.textContent = theme.itemLabel;
}

function applySeasonalDecorationLayout(layout = null, themeId = null) {
    const theme = getSeasonalDecorationTheme(themeId || activeSeasonalDecorationThemeId);
    const layer = getHalloweenWebLayer();
    if (!theme) {
        if (!document.body.classList.contains("halloween-web-editing")) activeHalloweenWebLayout = null;
        if (layer) layer.replaceChildren();
        return null;
    }
    const previousThemeId = activeSeasonalDecorationThemeId;
    activeSeasonalDecorationThemeId = theme.id;
    const existingLayout = previousThemeId === theme.id ? activeHalloweenWebLayout : null;
    activeHalloweenWebLayout = normalizeHalloweenWebLayout(layout || existingLayout || getPreferredHalloweenWebLayout(theme.id), theme.id);
    if (!activeHalloweenWebLayout.some(item => item.id === activeHalloweenWebEditId)) {
        activeHalloweenWebEditId = activeHalloweenWebLayout[0]?.id || "";
    }
    renderHalloweenWebElements(activeHalloweenWebLayout, theme.id);
    activeHalloweenWebLayout.forEach(item => {
        const web = getHalloweenWebElement(item.id);
        if (!web) return;
        const isChristmasHills = theme.id === "christmas" && item.texture === "hills";
        web.style.left = isChristmasHills ? `${item.x}%` : `${item.x}vw`;
        web.style.top = isChristmasHills ? `${item.y}%` : `${item.y}vh`;
        web.style.right = "auto";
        web.style.bottom = "auto";
        web.style.width = isChristmasHills
            ? `clamp(720px, ${item.size}%, 2600px)`
            : `clamp(70px, ${item.size}vw, 640px)`;
        web.style.opacity = String(item.opacity);
        web.style.transform = `rotate(${item.rotate}deg)`;
        web.classList.toggle("is-editing", document.body.classList.contains("halloween-web-editing") && item.id === activeHalloweenWebEditId);
    });
    syncSeasonalDecorationAssetOptions(theme.id);
    syncSeasonalDecorationEditorLabels(theme.id);
    syncHalloweenWebSelectOptions();
    syncHalloweenWebEditorControls();
    return activeHalloweenWebLayout;
}

function applyHalloweenWebLayout(layout = null, themeId = null) {
    return applySeasonalDecorationLayout(layout, themeId);
}

function setAdminCobwebStatus(message, isError = false) {
    const status = document.getElementById("admin-cobweb-status");
    if (!status) return;
    status.textContent = message;
    status.classList.toggle("error", Boolean(isError));
}

function syncHalloweenWebEditorControls() {
    const theme = getSeasonalDecorationTheme(activeSeasonalDecorationThemeId) || SEASONAL_DECORATION_THEMES.halloween;
    const layout = activeHalloweenWebLayout || getPreferredHalloweenWebLayout(theme.id);
    const item = layout.find(web => web.id === activeHalloweenWebEditId);
    const select = document.getElementById("halloween-web-editor-select");
    const texture = document.getElementById("halloween-web-texture-select");
    const size = document.getElementById("halloween-web-size-input");
    const rotate = document.getElementById("halloween-web-rotate-input");
    const opacity = document.getElementById("halloween-web-opacity-input");
    if (select) select.value = activeHalloweenWebEditId;
    [texture, size, rotate, opacity].forEach(input => {
        if (input) input.disabled = !item;
    });
    if (!item) return;
    if (texture) texture.value = item.texture;
    if (size) size.value = item.size;
    if (rotate) rotate.value = item.rotate;
    if (opacity) opacity.value = item.opacity;
}

function bindHalloweenWebEditor() {
    if (document.body.dataset.halloweenWebEditorBound === "true") return;
    document.body.dataset.halloweenWebEditorBound = "true";
    document.querySelector("#halloweenWebEditor .halloween-web-editor-head")?.addEventListener("pointerdown", event => {
        if (event.target.closest("button, input, select, textarea")) return;
        const editor = document.getElementById("halloweenWebEditor");
        if (!editor || editor.classList.contains("hidden")) return;
        event.preventDefault();
        const rect = editor.getBoundingClientRect();
        seasonalDecorationEditorDrag = {
            startClientX: event.clientX,
            startClientY: event.clientY,
            startLeft: rect.left,
            startTop: rect.top
        };
        document.body.classList.add("seasonal-decoration-editor-dragging");
        try {
            event.currentTarget.setPointerCapture(event.pointerId);
        } catch (error) {
            // Pointer capture is best effort for older mobile WebViews.
        }
    });
    document.addEventListener("pointermove", event => {
        if (seasonalDecorationEditorDrag) {
            const nextPosition = clampSeasonalDecorationEditorPosition({
                left: seasonalDecorationEditorDrag.startLeft + (event.clientX - seasonalDecorationEditorDrag.startClientX),
                top: seasonalDecorationEditorDrag.startTop + (event.clientY - seasonalDecorationEditorDrag.startClientY)
            });
            setSeasonalDecorationEditorPosition(nextPosition);
            return;
        }
        if (!halloweenWebEditorDrag || !document.body.classList.contains("halloween-web-editing")) return;
        const layout = activeHalloweenWebLayout || getPreferredHalloweenWebLayout(activeSeasonalDecorationThemeId);
        const item = layout.find(web => web.id === halloweenWebEditorDrag.id);
        if (!item) return;
        const isChristmasHills = activeSeasonalDecorationThemeId === "christmas" && item.texture === "hills";
        const heroRect = isChristmasHills ? getChristmasHeroDecorationHost()?.getBoundingClientRect() : null;
        const dragWidth = heroRect?.width || window.innerWidth;
        const dragHeight = heroRect?.height || window.innerHeight;
        const deltaX = ((event.clientX - halloweenWebEditorDrag.startClientX) / dragWidth) * 100;
        const deltaY = ((event.clientY - halloweenWebEditorDrag.startClientY) / dragHeight) * 100;
        item.x = roundHalloweenLayoutNumber(halloweenWebEditorDrag.startX + deltaX);
        item.y = roundHalloweenLayoutNumber(halloweenWebEditorDrag.startY + deltaY);
        applyHalloweenWebLayout(layout);
    });
    document.addEventListener("pointerup", () => {
        halloweenWebEditorDrag = null;
        if (seasonalDecorationEditorDrag) {
            localStorage.setItem(SEASONAL_DECORATION_EDITOR_POSITION_STORAGE_KEY, JSON.stringify(getSeasonalDecorationEditorPosition()));
        }
        seasonalDecorationEditorDrag = null;
        document.body.classList.remove("seasonal-decoration-editor-dragging");
    });
}

function clampSeasonalDecorationEditorPosition(position = {}) {
    const editor = document.getElementById("halloweenWebEditor");
    const width = editor?.offsetWidth || 320;
    const height = editor?.offsetHeight || 320;
    const margin = 10;
    const maxLeft = Math.max(margin, window.innerWidth - width - margin);
    const maxTop = Math.max(margin, window.innerHeight - height - margin);
    return {
        left: Math.round(clampHalloweenLayoutNumber(position.left, margin, maxLeft, maxLeft)),
        top: Math.round(clampHalloweenLayoutNumber(position.top, margin, maxTop, maxTop))
    };
}

function getSeasonalDecorationEditorPosition() {
    const editor = document.getElementById("halloweenWebEditor");
    if (!editor) return null;
    const rect = editor.getBoundingClientRect();
    return clampSeasonalDecorationEditorPosition({ left: rect.left, top: rect.top });
}

function setSeasonalDecorationEditorPosition(position = null) {
    const editor = document.getElementById("halloweenWebEditor");
    if (!editor) return;
    const safePosition = clampSeasonalDecorationEditorPosition(position || getSeasonalDecorationEditorPosition() || {});
    editor.style.left = `${safePosition.left}px`;
    editor.style.top = `${safePosition.top}px`;
    editor.style.right = "auto";
    editor.style.bottom = "auto";
}

function restoreSeasonalDecorationEditorPosition() {
    const editor = document.getElementById("halloweenWebEditor");
    if (!editor) return;
    try {
        const savedPosition = JSON.parse(localStorage.getItem(SEASONAL_DECORATION_EDITOR_POSITION_STORAGE_KEY) || "null");
        if (savedPosition && Number.isFinite(Number(savedPosition.left)) && Number.isFinite(Number(savedPosition.top))) {
            setSeasonalDecorationEditorPosition(savedPosition);
        }
    } catch (error) {
        localStorage.removeItem(SEASONAL_DECORATION_EDITOR_POSITION_STORAGE_KEY);
    }
}

function selectHalloweenWebForEditing(id = "web-1") {
    const layout = activeHalloweenWebLayout || getPreferredHalloweenWebLayout(activeSeasonalDecorationThemeId);
    activeHalloweenWebEditId = layout.some(item => item.id === String(id)) ? String(id) : layout[0]?.id || "web-1";
    applySeasonalDecorationLayout(layout, activeSeasonalDecorationThemeId);
}

function updateSelectedHalloweenWebSetting(key, value) {
    const theme = getSeasonalDecorationTheme(activeSeasonalDecorationThemeId) || SEASONAL_DECORATION_THEMES.halloween;
    const layout = activeHalloweenWebLayout || getPreferredHalloweenWebLayout(theme.id);
    const item = layout.find(web => web.id === activeHalloweenWebEditId);
    if (!item) return;
    if (key === "texture") item.texture = theme.textureIds.includes(String(value)) ? String(value) : item.texture;
    if (key === "size") item.size = roundHalloweenLayoutNumber(clampHalloweenLayoutNumber(value, 6, 42, item.size));
    if (key === "rotate") item.rotate = roundHalloweenLayoutNumber(clampHalloweenLayoutNumber(value, -180, 180, item.rotate));
    if (key === "opacity") item.opacity = Math.round(clampHalloweenLayoutNumber(value, 0, 0.92, item.opacity) * 100) / 100;
    applySeasonalDecorationLayout(layout, theme.id);
}

function createHalloweenWebId() {
    return `web-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;
}

function addHalloweenWeb() {
    if (!currentUser || !isDeveloperUid(currentUser.uid)) return;
    if (!document.body.classList.contains("halloween-web-editing")) {
        toggleHalloweenWebEditor(true);
    }
    const theme = getSeasonalDecorationTheme(activeSeasonalDecorationThemeId) || SEASONAL_DECORATION_THEMES.halloween;
    const layout = activeHalloweenWebLayout || getPreferredHalloweenWebLayout(theme.id);
    if (layout.length >= 24) {
        showNotification("Maximum decoration count reached.", "error", 2400);
        return;
    }
    const texture = theme.textureIds[String(layout.length % theme.textureIds.length)] || theme.textureIds[0];
    const newWeb = normalizeHalloweenWebItem({
        id: createHalloweenWebId(),
        texture,
        x: 46,
        y: 36,
        size: 10,
        rotate: 0,
        opacity: theme.id === "christmas" ? 0.48 : 0.12
    }, theme.defaults[0], layout.length, theme.id);
    layout.push(newWeb);
    activeHalloweenWebEditId = newWeb.id;
    applySeasonalDecorationLayout(layout, theme.id);
    setAdminCobwebStatus("Added a decoration. Drag it into place.");
}

function removeSelectedHalloweenWeb() {
    if (!currentUser || !isDeveloperUid(currentUser.uid)) return;
    const layout = activeHalloweenWebLayout || getPreferredHalloweenWebLayout(activeSeasonalDecorationThemeId);
    const nextLayout = layout.filter(item => item.id !== activeHalloweenWebEditId);
    activeHalloweenWebEditId = nextLayout[0]?.id || "";
    applySeasonalDecorationLayout(nextLayout, activeSeasonalDecorationThemeId);
    setAdminCobwebStatus("Removed selected decoration.");
}

function toggleHalloweenWebEditor(forceOpen = null) {
    if (!currentUser || !isDeveloperUid(currentUser.uid)) {
        showNotification("Developer access is required for decoration editing.", "error", 3200);
        return;
    }
    const editor = document.getElementById("halloweenWebEditor");
    if (!editor) return;
    const shouldOpen = forceOpen === null ? editor.classList.contains("hidden") : Boolean(forceOpen);
    editor.classList.toggle("hidden", !shouldOpen);
    editor.setAttribute("aria-hidden", String(!shouldOpen));
    document.body.classList.toggle("halloween-web-editing", shouldOpen);
    if (shouldOpen) {
        const themeId = getEditableSeasonalDecorationThemeId();
        document.getElementById("adminAbuseModal")?.classList.add("hidden");
        applyIndexTheme(themeId, true);
        bindHalloweenWebEditor();
        restoreSeasonalDecorationEditorPosition();
        applySeasonalDecorationLayout(getPreferredHalloweenWebLayout(themeId), themeId);
        const theme = getSeasonalDecorationTheme(themeId) || SEASONAL_DECORATION_THEMES.halloween;
        setAdminCobwebStatus(`${theme.label} editor opened.`);
        showNotification(`${theme.label} editor opened.`, "success", 2200);
    } else {
        applySeasonalDecorationLayout(null, getVisibleSeasonalDecorationThemeId());
        setAdminCobwebStatus("Seasonal editor closed.");
    }
}

function saveHalloweenWebLayout() {
    if (!currentUser || !isDeveloperUid(currentUser.uid)) return;
    const theme = getSeasonalDecorationTheme(activeSeasonalDecorationThemeId) || SEASONAL_DECORATION_THEMES.halloween;
    const layout = normalizeHalloweenWebLayout(activeHalloweenWebLayout || getPreferredHalloweenWebLayout(theme.id), theme.id);
    localStorage.setItem(theme.storageKey, JSON.stringify(layout));
    activeHalloweenWebLayout = layout;
    setAdminCobwebStatus("Saved on this device only.");
    showNotification(`${theme.label} layout saved on this device.`, "success", 2200);
}

async function saveHalloweenWebLayoutForEveryone() {
    if (!currentUser || !isDeveloperUid(currentUser.uid)) return;
    if (!db) {
        showNotification("Firestore is not ready yet.", "error", 2600);
        return;
    }
    const selectedThemeId = document.body.classList.contains("halloween-web-editing")
        ? (getSeasonalDecorationTheme(activeSeasonalDecorationThemeId)?.id || getEditableSeasonalDecorationThemeId())
        : getEditableSeasonalDecorationThemeId();
    const theme = getSeasonalDecorationTheme(selectedThemeId) || SEASONAL_DECORATION_THEMES.halloween;
    const candidateLayout = activeSeasonalDecorationThemeId === theme.id ? activeHalloweenWebLayout : null;
    const layout = normalizeHalloweenWebLayout(candidateLayout || getPreferredHalloweenWebLayout(theme.id), theme.id);
    const themeMeta = INDEX_THEME_OPTIONS.find(option => option.id === selectedThemeId) || INDEX_THEME_OPTIONS[0];
    const payload = {
        themeId: selectedThemeId,
        themeName: themeMeta?.name || selectedThemeId,
        enabled: true,
        [theme.remoteKey]: JSON.stringify(layout),
        updatedAt: Date.now(),
        updatedBy: currentUser.uid
    };
    try {
        await db.collection(GLOBAL_INDEX_THEME_CONFIG_PATH.collection)
            .doc(GLOBAL_INDEX_THEME_CONFIG_PATH.doc)
            .set(payload, { merge: true });
        setGlobalSeasonalDecorationLayout(theme.id, layout);
        localStorage.setItem(theme.storageKey, JSON.stringify(layout));
        applySeasonalDecorationLayout(layout, theme.id);
        setAdminCobwebStatus("Saved for everyone.");
        showNotification(`${theme.label} layout saved for everyone.`, "success", 2600);
    } catch (error) {
        console.warn("Unable to save global seasonal decoration layout:", error);
        setAdminCobwebStatus(`Global save failed: ${error.message || error}`, true);
        showNotification(`Could not save ${theme.label} layout globally.`, "error", 3200);
    }
}

function resetHalloweenWebLayout() {
    if (!currentUser || !isDeveloperUid(currentUser.uid)) return;
    const theme = getSeasonalDecorationTheme(activeSeasonalDecorationThemeId) || SEASONAL_DECORATION_THEMES.halloween;
    localStorage.removeItem(theme.storageKey);
    activeHalloweenWebLayout = normalizeHalloweenWebLayout(getGlobalSeasonalDecorationLayout(theme.id) || theme.defaults, theme.id);
    activeHalloweenWebEditId = activeHalloweenWebLayout[0]?.id || "";
    applySeasonalDecorationLayout(activeHalloweenWebLayout, theme.id);
    setAdminCobwebStatus(`${theme.label} layout reset.`);
    showNotification(`${theme.label} layout reset.`, "success", 2200);
}

async function exportHalloweenWebLayout() {
    if (!currentUser || !isDeveloperUid(currentUser.uid)) return;
    const theme = getSeasonalDecorationTheme(activeSeasonalDecorationThemeId) || SEASONAL_DECORATION_THEMES.halloween;
    const layout = normalizeHalloweenWebLayout(activeHalloweenWebLayout || getPreferredHalloweenWebLayout(theme.id), theme.id);
    try {
        await navigator.clipboard.writeText(JSON.stringify(layout));
        setAdminCobwebStatus(`${theme.label} layout JSON copied.`);
        showNotification(`${theme.label} layout copied.`, "success", 2400);
    } catch (error) {
        window.prompt(`Copy ${theme.label} layout JSON`, JSON.stringify(layout));
    }
}

document.addEventListener("DOMContentLoaded", () => {
    bindHalloweenWebEditor();
    applySeasonalDecorationLayout();
});

window.toggleHalloweenWebEditor = toggleHalloweenWebEditor;
window.selectHalloweenWebForEditing = selectHalloweenWebForEditing;
window.updateSelectedHalloweenWebSetting = updateSelectedHalloweenWebSetting;
window.addHalloweenWeb = addHalloweenWeb;
window.removeSelectedHalloweenWeb = removeSelectedHalloweenWeb;
window.saveHalloweenWebLayout = saveHalloweenWebLayout;
window.saveHalloweenWebLayoutForEveryone = saveHalloweenWebLayoutForEveryone;
window.resetHalloweenWebLayout = resetHalloweenWebLayout;
window.exportHalloweenWebLayout = exportHalloweenWebLayout;

function setupGlobalIndexThemeListener() {
    if (!db) return;
    if (globalIndexThemeUnsubscribe) {
        globalIndexThemeUnsubscribe();
        globalIndexThemeUnsubscribe = null;
    }

    // Apply cached theme immediately on index while Firestore snapshot connects.
    applyIndexTheme(localStorage.getItem("globalIndexThemeId") || "default");

    globalIndexThemeUnsubscribe = db
        .collection(GLOBAL_INDEX_THEME_CONFIG_PATH.collection)
        .doc(GLOBAL_INDEX_THEME_CONFIG_PATH.doc)
        .onSnapshot(snapshot => {
            const themeData = snapshot.exists ? (snapshot.data() || {}) : {};
            const remoteThemeId = themeData.themeId || "default";
            globalHalloweenWebLayout = parseHalloweenWebLayout(themeData.halloweenWebLayout, "halloween");
            globalChristmasDecorationLayout = parseHalloweenWebLayout(themeData.christmasDecorationLayout, "christmas");
            if (!document.body.classList.contains("halloween-web-editing")) {
                activeHalloweenWebLayout = getPreferredHalloweenWebLayout(remoteThemeId);
            }
            setActiveSeasonalCrateTheme(remoteThemeId || "default");
            applyIndexTheme(remoteThemeId || "default");
        }, error => {
            console.warn("Global index theme listener failed:", error);
            globalHalloweenWebLayout = null;
            globalChristmasDecorationLayout = null;
            if (!document.body.classList.contains("halloween-web-editing")) {
                activeHalloweenWebLayout = getPreferredHalloweenWebLayout("halloween");
            }
            setActiveSeasonalCrateTheme("default");
            applyIndexTheme("default");
        });
}

function getCrateRewardPreviewMarkup(reward) {
    if (reward.type === "theme") {
        const theme = getCardThemeMeta(reward.themeId);
        return `
            <div class="crate-reward-preview">
                <div style="background:${theme.preview}; border-radius: 16px;"></div>
            </div>
        `;
    }
    if (reward.type === "badge") {
        const badge = getBadgeMeta(reward.badgeId);
        return `
            <div class="crate-reward-preview">
                <div style="display:flex;align-items:center;justify-content:center;background:rgba(255,255,255,0.04);padding:10px;font-size:34px;line-height:1;">${badge.emoji || "\u{1F988}"}</div>
            </div>
        `;
    }
    if (reward.type === "item") {
        const quantity = Math.max(1, Math.floor(Number(reward.quantity) || 1));
        const quantityLabel = quantity > 1 ? `x${quantity}` : "";
        return `
            <div class="crate-reward-preview">
                <div style="display:flex;flex-direction:column;align-items:center;justify-content:center;background:rgba(255,255,255,0.04);padding:10px;line-height:1;">
                    <div style="font-size:34px;">${reward.emoji || "\u{1F6E1}\uFE0F"}</div>
                    <div style="margin-top:6px;font-size:13px;font-weight:700;color:#dffaff;">${quantityLabel}</div>
                </div>
            </div>
        `;
    }
    return `
        <div class="crate-reward-preview">
            <img src="${reward.imagePath}" alt="${reward.name}">
        </div>
    `;
}

function renderCratesButton() {
    const cratesBtn = document.getElementById("crates-btn");
    const countEl = document.getElementById("crates-btn-count");
    if (!cratesBtn || !countEl) return;

    const inventory = getCrateInventory();
    const crateCount = inventory.reef + inventory.summer + inventory.christmas + inventory.halloween;
    countEl.textContent = crateCount;
    cratesBtn.classList.remove("hidden");
}

function renderHomeCratesModal() {
    const profileData = getCurrentProfileData();
    const inventory = getCrateInventory(profileData);
    const reefCount = inventory.reef || 0;
    const totalCount = Object.values(inventory).reduce((sum, value) => sum + (Number(value) || 0), 0);

    const reefCountEl = document.getElementById("home-crate-reef-count");
    const reefBtn = document.getElementById("home-open-reef-crate-btn");
    const status = document.getElementById("home-crates-status");
    const craftingBtn = document.getElementById("home-crates-crafting-btn");

    if (reefCountEl) reefCountEl.textContent = reefCount;

    if (reefBtn) {
        reefBtn.disabled = !currentUser || reefCount <= 0 || crateOpeningInProgress;
        reefBtn.textContent = currentUser ? "Open Crate" : "Login Required";
    }

    SEASONAL_CRATE_IDS.forEach(crateId => {
        const count = inventory[crateId] || 0;
        const card = document.getElementById(`home-crate-${crateId}-card`);
        const countEl = document.getElementById(`home-crate-${crateId}-count`);
        const openBtn = document.getElementById(`home-open-${crateId}-crate-btn`);
        const visible = shouldShowSeasonalCratePanel(crateId, profileData);
        if (card) card.style.display = visible ? "" : "none";
        if (countEl) countEl.textContent = count;
        if (openBtn) {
            openBtn.disabled = !currentUser || count <= 0 || crateOpeningInProgress;
            openBtn.textContent = currentUser ? "Open Crate" : "Login Required";
        }
    });

    if (craftingBtn) {
        const activeCrateId = getActiveSeasonalCrateId();
        const activeCrateName = activeCrateId ? getCrateDefinition(activeCrateId).name : "Event Crate";
        craftingBtn.textContent = activeCrateId ? `Craft ${activeCrateName}` : "Crafting";
        craftingBtn.title = activeCrateId ? "" : "Seasonal crate crafting unlocks while an event theme is active.";
    }

    if (status) {
        status.textContent = !currentUser
            ? "Login to open crates and save cosmetic rewards."
            : totalCount > 0
                ? `${totalCount} crate${totalCount === 1 ? "" : "s"} ready. Duplicate cosmetics convert into XP.`
                : "No crates ready yet. Win games or claim pass rewards to earn more.";
    }
}

function openHomeCratesModal() {
    renderHomeCratesModal();
    const modal = document.getElementById("homeCratesModal");
    if (modal) modal.classList.remove("hidden");
}

function closeHomeCratesModal() {
    const modal = document.getElementById("homeCratesModal");
    if (modal) modal.classList.add("hidden");
}

async function openHomeCrate(crateId = "reef") {
    await openCrate(crateId);
    renderHomeCratesModal();
    renderCratesButton();
}

function openFullCratesModalFromHome() {
    closeHomeCratesModal();
    openCraftingModalFromHome();
}

function openCraftingModalFromHome() {
    closeHomeCratesModal();
    closeCratesModal?.();
    const modal = document.getElementById("craftingModal");
    if (modal) {
        updateSeasonalCrateCraftingUI?.();
        modal.classList.remove("hidden");
    }
}

function closeCraftingModal() {
    document.getElementById("craftingModal")?.classList.add("hidden");
}

function renderCratesModal() {
    const profileData = getCurrentProfileData();
    const inventory = getCrateInventory(profileData);
    const crateCount = inventory.reef;
    const christmasCrateCount = inventory.christmas || 0;
    const halloweenCrateCount = inventory.halloween || 0;

    const countValue = document.getElementById("crate-count-value");
    if (countValue) countValue.textContent = crateCount;

    const christmasCountEl = document.getElementById("christmas-crate-count-value");
    if (christmasCountEl) christmasCountEl.textContent = christmasCrateCount;
    const halloweenCountEl = document.getElementById("halloween-crate-count-value");
    if (halloweenCountEl) halloweenCountEl.textContent = halloweenCrateCount;

    renderCratesButton();
    updateSeasonalCratePanels(profileData);
    updateSeasonalCrateCraftingUI(profileData);

    const statusCopy = document.getElementById("crate-status-copy");
    const pityCopy = document.getElementById("crate-pity-copy");
    const streakShieldCopy = document.getElementById("streak-shield-copy");
    if (!statusCopy || !pityCopy) return;
    syncCrateInstantOpenControls(profileData);

    const pityReady = isLegendaryPityReady(profileData);
    const cratesUntilPity = getCratesUntilLegendaryPity(profileData);
    const streakShieldCount = getStreakShieldCount(profileData);

    pityCopy.textContent = pityReady
        ? "Next crate is guaranteed legendary."
        : `${cratesUntilPity} crate${cratesUntilPity === 1 ? "" : "s"} until guaranteed legendary.`;
    if (streakShieldCopy) {
        streakShieldCopy.textContent = `\u{1F6E1}\uFE0F Streak Shields: ${streakShieldCount} / 3 (max)`;
    }

    const totalCrateCount = crateCount + christmasCrateCount + halloweenCrateCount;
    if (!currentUser) {
        statusCopy.textContent = "Login to open crates, save rewards, and keep cosmetic unlocks synced.";
        ["open-crate-btn", "open-christmas-crate-btn", "open-halloween-crate-btn", "craft-summer-crate-btn"].forEach(id => {
            const btn = document.getElementById(id);
            if (btn) {
                btn.disabled = true;
                btn.textContent = "Login Required";
            }
        });
    } else {
        const labelMap = {
            "open-crate-btn": "Open Cosmetic Crate",
            "open-christmas-crate-btn": "Open Christmas Crate",
            "open-halloween-crate-btn": "Open Halloween Crate"
        };
        Object.entries(labelMap).forEach(([id, label]) => {
            const btn = document.getElementById(id);
            if (btn) btn.textContent = label;
        });
    }

    if (currentUser && totalCrateCount <= 0) {
        statusCopy.textContent = "You don't have any crates to open.";
    } else if (currentUser) {
        statusCopy.textContent = getCrateInstantOpenEnabled(profileData)
            ? "Hide animation is enabled."
            : "Animation reveal is enabled.";
    }
}

function renderCrateDropsModal(crateId = "reef") {
    const rewardGrid = document.getElementById("crate-drops-grid");
    if (!rewardGrid) return;
    const profileData = getCurrentProfileData();
    const pool = getCratePoolById(crateId);

    rewardGrid.innerHTML = pool.map(reward => {
        const owned = isCrateRewardOwned(profileData, reward);
        return `
            <article class="crate-reward-card ${owned ? "owned" : ""}">
                <span class="crate-rarity ${reward.rarity}">${reward.rarity}</span>
                ${getCrateRewardPreviewMarkup(reward)}
                <h4>${reward.name}</h4>
                <p>${owned ? "Collected" : reward.blurb}</p>
            </article>
        `;
    }).join("");
}

function getProfileTimestampMs(value) {
    if (!value) return 0;
    if (typeof value === "number") return value;
    if (value instanceof Date) return value.getTime();
    if (typeof value?.toMillis === "function") return value.toMillis();
    if (typeof value?.seconds === "number") return value.seconds * 1000;
    const parsed = Date.parse(value);
    return Number.isFinite(parsed) ? parsed : 0;
}

function isLegacyWheelSharkCosmetic(cosmetic = {}) {
    const name = String(cosmetic.name || "").trim().toLowerCase();
    const imagePath = String(cosmetic.imagePath || "").replace(/\\/g, "/").toLowerCase();
    return name === "wheel shark" || (cosmetic.spinReward === true && imagePath === "images/pfp/shark5.png");
}

function removeLegacyWheelSharkCosmetics(cosmetics) {
    return Array.isArray(cosmetics)
        ? cosmetics.filter(cosmetic => !isLegacyWheelSharkCosmetic(cosmetic))
        : [];
}

function getUnifiedCosmeticList(localItems, remoteItems, key) {
    const merged = [];
    [...removeLegacyWheelSharkCosmetics(localItems), ...removeLegacyWheelSharkCosmetics(remoteItems)].forEach(item => {
        if (!item) return;
        const identifier = item?.[key];
        if (!identifier || merged.some(existing => existing?.[key] === identifier)) return;
        merged.push(item);
    });
    return merged;
}

function getMergedUniqueIds(localIds, remoteIds, fallback = []) {
    return [...new Set([...(Array.isArray(fallback) ? fallback : []), ...(Array.isArray(localIds) ? localIds : []), ...(Array.isArray(remoteIds) ? remoteIds : [])])];
}

function openCratesModal() {
    crateOpeningInProgress = false;
    setCratesModalTab("inventory");
    renderCratesModal();
    const modal = document.getElementById("cratesModal");
    if (modal) modal.classList.remove("hidden");
}

function openCrateDropsModal(crateId = "reef") {
    renderCrateDropsModal(crateId);
    document.getElementById("crateDropsModal")?.classList.remove("hidden");
}

function closeCratesModal() {
    const modal = document.getElementById("cratesModal");
    if (modal) modal.classList.add("hidden");
    closeCrateUnboxOverlay();
    crateOpeningInProgress = false;
    updateSeasonalCrateCraftingUI();
}

function closeCrateDropsModal() {
    document.getElementById("crateDropsModal")?.classList.add("hidden");
}

function pickCrateReward(availableRewards) {
    const totalWeight = availableRewards.reduce((sum, reward) => sum + (crateRarityWeights[reward] || 0), 0);
    let roll = Math.random() * totalWeight;
    for (const reward of availableRewards) {
        roll -= crateRarityWeights[reward] || 0;
        if (roll <= 0) return reward;
    }
    return availableRewards[availableRewards.length - 1];
}

function pickCrateRewardRarity(profileData = getCurrentProfileData()) {
    if (isLegendaryPityReady(profileData)) {
        return "legendary";
    }
    return pickCrateReward(Object.keys(crateRarityWeights));
}

function grantCrateReward(profileData, reward) {
    const duplicateReward = reward.type === "item" ? false : isCrateRewardOwned(profileData, reward);
    if (reward.type === "pfp") {
        const earnedCosmetics = Array.isArray(profileData.earnedCosmetics) ? [...profileData.earnedCosmetics] : [];
        if (!duplicateReward) {
            earnedCosmetics.push({
                name: reward.name,
                imagePath: reward.imagePath,
                crateReward: true,
                rarity: reward.rarity
            });
        }
        profileData.earnedCosmetics = earnedCosmetics;
    } else if (reward.type === "theme") {
        if (!duplicateReward) {
            profileData.unlockedCardThemes = [...new Set([...(Array.isArray(profileData.unlockedCardThemes) ? profileData.unlockedCardThemes : ["default"]), reward.themeId])];
        }
    } else if (reward.type === "badge") {
        if (!duplicateReward) {
            profileData.unlockedBadges = [...new Set([...(Array.isArray(profileData.unlockedBadges) ? profileData.unlockedBadges : ["starter"]), reward.badgeId])];
        }
    } else if (reward.type === "item") {
        const quantity = Math.max(1, Math.floor(Number(reward.quantity) || 1));
        if (reward.itemId === STREAK_SHIELD_ITEM_ID) {
            const currentShields = getStreakShieldCount(profileData);
            const canAccept = Math.min(quantity, 3 - currentShields);
            if (canAccept > 0) {
                setStreakShieldCount(profileData, currentShields + canAccept);
            }
        }
    }
    return {
        profileData,
        duplicateReward
    };
}

async function persistCrateProfileUpdate(profileData) {
    if (!getCrateInventoryUpdatedAt(profileData)) {
        markCrateInventoryChanged(profileData);
    }
    profileData.lastUpdated = Date.now();
    saveUserProfileLocally(profileData, { skipRemoteSync: true });

    if (!currentUser || !db) return;
    await db.collection("userStats").doc(currentUser.uid).set({
        crateInventory: normalizeCrateInventory(profileData.crateInventory),
        crateInventoryUpdatedAt: getCrateInventoryUpdatedAt(profileData),
        cratesOpened: Math.max(0, Number(profileData.cratesOpened) || 0),
        cratesSinceLegendary: getCratesSinceLegendary(profileData),
        streakShields: getStreakShieldCount(profileData),
        instantCrateOpen: getCrateInstantOpenEnabled(profileData),
        pearls: getPearlCount(profileData),
        pearlBoostExpiresAt: getPearlBoostExpiresAt(profileData),
        seasonXpBoosts: getSeasonXpBoosts(profileData),
        totalXP: Math.max(0, Number(profileData.totalXP) || 0),
        ...getSharkPassSyncPayload(profileData),
        earnedCosmetics: Array.isArray(profileData.earnedCosmetics) ? profileData.earnedCosmetics : [],
        unlockedBadges: Array.isArray(profileData.unlockedBadges) ? profileData.unlockedBadges : ["starter"],
        unlockedCardThemes: Array.isArray(profileData.unlockedCardThemes) ? profileData.unlockedCardThemes : ["default"],
        lastUpdated: profileData.lastUpdated,
        ...buildCosmeticSyncPayload(profileData)
    }, { merge: true });
}

const CRATE_UNBOX_THEME_IDS = ["reef", "summer", "christmas", "halloween"];
let activeCrateUnboxId = "reef";

function getCrateDefinition(crateId = "reef") {
    return crateDefinitions[crateId] || crateDefinitions.reef;
}

function getCrateUnboxCopy(crateId, phase = "opening", rewardName = "") {
    const crateName = getCrateDefinition(crateId).name;
    const itemLabel = rewardName ? String(rewardName) : "something";

    if (isSeasonalCrateId(crateId)) {
        const crateLabel = crateName.toLowerCase();
        if (phase === "reward") return `You found ${itemLabel} in the ${crateLabel}!`;
        if (phase === "duplicate") return `You found ${itemLabel} in the ${crateLabel}! (Already owned \u2014 converted to XP.)`;
        return `The ${crateLabel} is opening...`;
    }

    if (crateId === "summer") {
        if (phase === "reward") return `You found ${itemLabel} in the summer crate!`;
        if (phase === "duplicate") return `You found ${itemLabel} in the summer crate! (Already owned \u2014 converted to XP.)`;
        return "The summer crate is opening...";
    }
    if (phase === "reward") return `${crateName} reward revealed!`;
    if (phase === "duplicate") return "Duplicate converted into XP.";
    return `The ${crateName.toLowerCase()} is opening...`;
}

function resetCrateUnboxOverlay(crateId = "reef") {
    const themeId = CRATE_UNBOX_THEME_IDS.includes(crateId) ? crateId : "reef";
    const crateDef = getCrateDefinition(themeId);
    activeCrateUnboxId = themeId;

    const overlay = document.getElementById("crateUnboxOverlay");
    const stage = document.getElementById("crate-unbox-stage");
    const crate = document.getElementById("crate-unbox-crate");
    const burst = document.getElementById("crate-unbox-burst");
    const splash = document.getElementById("crate-unbox-splash");
    const icon = document.getElementById("crate-unbox-icon");
    const reveal = document.getElementById("crate-overlay-reveal");

    CRATE_UNBOX_THEME_IDS.forEach(id => {
        overlay?.classList.remove(`crate-theme-${id}`);
        stage?.classList.remove(`crate-theme-${id}`);
    });
    overlay?.classList.add(`crate-theme-${themeId}`);
    stage?.classList.add(`crate-theme-${themeId}`);

    if (crate) {
        crate.className = `crate-unbox-crate crate-theme-${themeId}`;
    }
    if (burst) burst.className = "crate-unbox-burst";
    if (splash) splash.classList.remove("active");
    if (icon) icon.className = `fa-solid ${crateDef.icon}`;
    if (reveal) {
        reveal.classList.remove("hidden", "crate-reveal-seasonal", ...SEASONAL_CRATE_IDS.map(id => `crate-reveal-${id}`));
        reveal.innerHTML = "";
    }
}

function openCrateUnboxOverlay(crateId = "reef") {
    resetCrateUnboxOverlay(crateId);
    const overlay = document.getElementById("crateUnboxOverlay");
    const copy = document.getElementById("crate-unbox-copy");
    if (overlay) overlay.classList.remove("hidden");
    if (copy) copy.textContent = getCrateUnboxCopy(crateId, "opening");
}

function getCrateUnboxRevealDelay(crateId = activeCrateUnboxId) {
    return isSeasonalCrateId(crateId) ? 1150 : 950;
}

function getCrateUnboxRevealHoldDelay(crateId = activeCrateUnboxId) {
    return isSeasonalCrateId(crateId) ? 2050 : 1850;
}

function applyCrateUnboxOpeningState(reward) {
    const crate = document.getElementById("crate-unbox-crate");
    const burst = document.getElementById("crate-unbox-burst");
    const splash = document.getElementById("crate-unbox-splash");
    const isSeasonal = isSeasonalCrateId(activeCrateUnboxId);

    if (crate) {
        crate.classList.add(isSeasonal ? "opening-seasonal" : "opening", `rarity-${reward.rarity}`);
    }
    if (burst) burst.classList.add(isSeasonal ? `active-${activeCrateUnboxId}` : "active", `rarity-${reward.rarity}`);
    if (splash && isSeasonal) splash.classList.add("active");
}

function closeCrateUnboxOverlay() {
    const overlay = document.getElementById("crateUnboxOverlay");
    if (overlay) overlay.classList.add("hidden");
    resetCrateUnboxOverlay(activeCrateUnboxId);
}

function showCrateOverlayReward(reward, crateId = activeCrateUnboxId) {
    const copy = document.getElementById("crate-unbox-copy");
    const reveal = document.getElementById("crate-overlay-reveal");
    const isSeasonal = isSeasonalCrateId(crateId);
    applyCrateUnboxOpeningState(reward);
    if (copy) {
        copy.textContent = isSeasonal
            ? getCrateUnboxCopy(crateId, "reward", reward.name)
            : `${reward.name} dropped from the ${getCrateDefinition(crateId).name.toLowerCase()}.`;
    }
    if (reveal) {
        reveal.classList.remove("hidden");
        if (isSeasonal) reveal.classList.add("crate-reveal-seasonal", `crate-reveal-${crateId}`);
        reveal.innerHTML = `
            <div class="crate-reveal-card crate-reveal-card-${reward.rarity}${isSeasonal ? ` crate-reveal-card-seasonal crate-reveal-card-${crateId}` : ""}">
                ${getCrateRewardPreviewMarkup(reward)}
                <div class="crate-reveal-copy">
                    <span class="crate-rarity ${reward.rarity}">${reward.rarity}</span>
                    <h4>${reward.name}</h4>
                    <p>${reward.blurb}</p>
                </div>
            </div>
        `;
    }
}

let crateSkipTimeout = null;

function unlockCrateAchievement(crateId = "reef") {
    const achievementId = crateAchievementIds[crateId];
    if (!achievementId) return;

    if (typeof window.unlockAchievement === "function") {
        window.unlockAchievement(achievementId);
        return;
    }

    const unlockedAchievements = JSON.parse(localStorage.getItem("unlockedAchievements") || "[]");
    if (!unlockedAchievements.includes(achievementId)) {
        unlockedAchievements.push(achievementId);
        localStorage.setItem("unlockedAchievements", JSON.stringify(unlockedAchievements));
        syncUnlockedAchievementToFirebase(achievementId, unlockedAchievements);
    }
}

function finalizeCrateRewardPresentation(reward, duplicateReward, duplicateXpAward, crateId = "reef") {
    if (duplicateReward) {
        showNotification(`${reward.name} was already owned. Converted to ${duplicateXpAward.totalXp} XP.`, "success", 4600);
        if (typeof updateIndexStats === "function") updateIndexStats();
    } else if (reward.type === "pfp") {
        showCosmeticUnlockToast({
            name: reward.name,
            imagePath: reward.imagePath
        }, {
            title: "Crate Cosmetic Unlocked!",
            subtitle: `${reward.name} profile picture`,
            accent: "#ffd47f",
            background: "linear-gradient(135deg, rgba(255, 196, 87, 0.96), rgba(91, 58, 9, 0.96))",
            icon: "\u{1F4E6}"
        });
    } else if (reward.type === "theme") {
        showNotification(`${reward.name} profile theme unlocked from a crate!`, "success", 4200);
    } else if (reward.type === "badge") {
        showNotification(`${reward.name} badge unlocked from a crate!`, "success", 4200);
    } else if (reward.type === "item") {
        const quantity = Math.max(1, Math.floor(Number(reward.quantity) || 1));
        if (reward.itemId === STREAK_SHIELD_ITEM_ID) {
            const totalShields = getStreakShieldCount();
            if (totalShields >= 3) {
                showNotification(`You have max streak shields (${totalShields}/3)`, "info", 4200);
            } else {
                showNotification(`${reward.name} +${quantity}! You now have ${totalShields}.`, "success", 4200);
            }
        } else {
            showNotification(`${reward.name} +${quantity}!`, "success", 4200);
        }
    }

    if (typeof loadAvailablePFPs === "function") loadAvailablePFPs();
    if (typeof loadEarnedCosmetics === "function") loadEarnedCosmetics();
    if (typeof renderThemeSelection === "function") renderThemeSelection();
    if (typeof renderBadgeSelection === "function") renderBadgeSelection();
    if (typeof updateProfileBadgeUI === "function") updateProfileBadgeUI();
    unlockCrateAchievement(crateId);
    renderCratesModal();
    if (typeof renderConsumablesPage === "function") {
        renderConsumablesPage();
    }
}

function toggleCrateInstantOpen(enabled) {
    const profileData = getCurrentProfileData();
    profileData.instantCrateOpen = Boolean(enabled);
    saveUserProfileLocally(profileData);
    syncCrateInstantOpenControls(profileData);
    renderCratesModal();
}

async function openCrate(crateId = "reef") {
    if (crateOpeningInProgress) return;
    if (!currentUser) {
        openLoginModal();
        return;
    }
    const profileData = getCurrentProfileData();
    const inventory = getCrateInventory(profileData);
    if ((inventory[crateId] || 0) <= 0) {
        renderCratesModal();
        const crateName = getCrateDefinition(crateId).name;
        showNotification(`You don't have any ${crateName}s to open.`, "error", 2800);
        return;
    }

    crateOpeningInProgress = true;
    updateSeasonalCrateCraftingUI(profileData);
    const rollbackProfileData = JSON.parse(JSON.stringify(profileData));
    const openTimestamp = Date.now();
    inventory[crateId] -= 1;
    profileData.crateInventory = normalizeCrateInventory(inventory);
    markCrateInventoryChanged(profileData, openTimestamp);
    profileData.cratesOpened = getOpenedCrateCount(profileData) + 1;
    const rewardRarity = pickCrateRewardRarity(profileData);
    const rarityRewards = getCrateRewardsByRarity(rewardRarity, crateId);
    const pool = getCratePoolById(crateId);
    const reward = rarityRewards[Math.floor(Math.random() * rarityRewards.length)] || pool[0];
    const previousCratesSinceLegendary = getCratesSinceLegendary(profileData);
    const { duplicateReward } = grantCrateReward(profileData, reward);
    profileData.cratesSinceLegendary = reward.rarity === "legendary" ? 0 : previousCratesSinceLegendary + 1;
    let duplicateXpAward = null;
    if (duplicateReward) {
        const baseDuplicateXp = crateDuplicateXpRewards[reward.rarity] || crateDuplicateXpRewards.common;
        duplicateXpAward = typeof window.applyLimitedTimeXpBonus === "function"
            ? window.applyLimitedTimeXpBonus(baseDuplicateXp)
            : { totalXp: baseDuplicateXp, baseXp: baseDuplicateXp, bonusXp: 0, multiplier: 1, event: null };
        profileData.totalXP = (profileData.totalXP || 0) + duplicateXpAward.totalXp;
        applySharkPassXpGain(profileData, duplicateXpAward.totalXp);
    }
    try {
        await persistCrateProfileUpdate(profileData);
    } catch (error) {
        console.warn("Crate sync failed:", error);
        Object.assign(profileData, rollbackProfileData);
        saveUserProfileLocally(profileData, { skipRemoteSync: true });
        crateOpeningInProgress = false;
        renderCratesButton();
        renderCratesModal();
        showNotification("Crate could not be saved. No crate was opened.", "error", 3600);
        return;
    }
    renderCratesButton();
    renderCratesModal();

    if (getCrateInstantOpenEnabled(profileData)) {
        crateOpeningInProgress = false;
        finalizeCrateRewardPresentation(reward, duplicateReward, duplicateXpAward, crateId);
        return;
    }

    openCrateUnboxOverlay(crateId);

    await new Promise(resolve => {
        crateSkipTimeout = setTimeout(resolve, getCrateUnboxRevealDelay(crateId));
    });

    if (duplicateReward) {
        showCrateOverlayDuplicateReward(reward, duplicateXpAward, crateId);
    } else {
        showCrateOverlayReward(reward, crateId);
    }

    await new Promise(resolve => {
        crateSkipTimeout = setTimeout(resolve, getCrateUnboxRevealHoldDelay(crateId));
    });
    crateOpeningInProgress = false;
    finalizeCrateRewardPresentation(reward, duplicateReward, duplicateXpAward, crateId);
    await new Promise(resolve => setTimeout(resolve, 1200));
    closeCrateUnboxOverlay();
}

function maybeAwardCrateDrop(source = "win") {
    if (!currentUser) return false;
    let awarded = false;

    if (Math.random() <= CRATE_DROP_CHANCE) {
        const profileData = getCurrentProfileData();
        const inventory = getCrateInventory(profileData);
        // Only award reef crates (normal crates) regardless of theme
        inventory.reef += 1;
        showNotification(`Cosmetic Crate dropped from your ${source}!`, "success", 3800);
        profileData.crateInventory = normalizeCrateInventory(inventory);
        markCrateInventoryChanged(profileData);
        persistCrateProfileUpdate(profileData).catch(error => console.warn("Crate sync failed:", error));
        renderCratesButton();
        renderCratesModal();
        awarded = true;
    }

    return maybeAwardLostTreasuresBottleDrop(source) || awarded;
}

window.openCratesModal = openCratesModal;
window.setCratesModalTab = setCratesModalTab;
window.openHomeCratesModal = openHomeCratesModal;
window.closeHomeCratesModal = closeHomeCratesModal;
window.openHomeCrate = openHomeCrate;
window.openFullCratesModalFromHome = openFullCratesModalFromHome;
window.openCrateDropsModal = openCrateDropsModal;
window.closeCratesModal = closeCratesModal;
window.closeCrateDropsModal = closeCrateDropsModal;
window.openCrate = openCrate;
window.toggleCrateInstantOpen = toggleCrateInstantOpen;
window.maybeAwardCrateDrop = maybeAwardCrateDrop;
window.getOpenedCrateCount = getOpenedCrateCount;
window.getStreakShieldCount = getStreakShieldCount;
window.applyStreakShieldOnLoss = applyStreakShieldOnLoss;
window.getActiveLimitedTimeXpEvent = getActiveLimitedTimeXpEvent;
window.applyLimitedTimeXpBonus = applyLimitedTimeXpBonus;
window.openPearlShopModal = openPearlShopModal;
window.closePearlShopModal = closePearlShopModal;
window.buyPearlShopItem = buyPearlShopItem;
window.renderPearlShop = renderPearlShop;
window.renderConsumablesPage = renderConsumablesPage;
window.ensureConsumablesPageTimer = ensureConsumablesPageTimer;
window.forceXpEventPreview = function(enabled = true) {
    localStorage.setItem("forceXpEventPreview", enabled ? "true" : "false");
    ensureXpEventBannerTimer();
    return enabled ? "XP event preview enabled." : "XP event preview disabled.";
};
window.openAdminAbuseModal = openAdminAbuseModal;
window.closeAdminAbuseModal = closeAdminAbuseModal;
window.openAdminAbuseMenu = openAdminAbuseMenu;
window.adminAbuse = openAdminAbuseMenu;

function getCardThemeMeta(themeId) {
    return sharkPassCardThemes.find(theme => theme.id === themeId) || sharkPassCardThemes[0];
}

function getBadgeMeta(badgeId) {
    badgeId = normalizeBadgeId(badgeId);
    const builtInBadge = allBadges.find(badge => badge.id === badgeId);
    const passReward = sharkPassRewards.find(reward => reward.type === "badge" && reward.badgeId === badgeId);
    if (passReward) {
        return {
            id: badgeId,
            name: builtInBadge?.name || passReward.name,
            emoji: builtInBadge?.emoji || sharkPassBadgeMeta[badgeId]?.emoji || "\u{1F988}",
            tier: sharkPassBadgeTiers[badgeId] || 1,
            description: builtInBadge?.description || passReward.blurb || `${passReward.name} Shark Pass badge.`,
            rarity: passReward.rarity || "common"
        };
    }
    const crateReward = getAllCrateBadgeRewards().find(reward => reward.badgeId === badgeId);
    if (crateReward) {
        return {
            id: badgeId,
            name: builtInBadge?.name || crateReward.name,
            emoji: builtInBadge?.emoji || sharkPassBadgeMeta[badgeId]?.emoji || "\u{1F988}",
            tier: sharkPassBadgeTiers[badgeId] || 1,
            description: builtInBadge?.description || crateReward.blurb || `${crateReward.name} crate badge.`,
            rarity: crateReward.rarity || "common"
        };
    }
    if (!builtInBadge) return allBadges[0];
    return {
        ...builtInBadge,
        rarity: builtInBadge.rarity || (builtInBadge.id === "starter" ? "core" : "special")
    };
}

function getBadgeRarityMeta(badge) {
    if (badge.id === "starter") return badgeRarityMeta.core;
    if (badge.id === "tester") return badgeRarityMeta.code;
    if (badge.id === "dev") return badgeRarityMeta.special;
    const passReward = sharkPassRewards.find(reward => reward.type === "badge" && reward.badgeId === badge.id);
    const crateReward = getAllCrateBadgeRewards().find(reward => reward.badgeId === badge.id);
    return badgeRarityMeta[passReward?.rarity || crateReward?.rarity || badge.rarity || "common"] || badgeRarityMeta.common;
}

function getBadgeRarityRank(badge) {
    const rarityOrder = ["core", "code", "special", "common", "rare", "epic", "legendary"];
    const rarityClass = getBadgeRarityMeta(badge).className;
    const rank = rarityOrder.indexOf(rarityClass);
    return rank === -1 ? rarityOrder.length : rank;
}

function getBadgeUnlockOrder(badge) {
    if (badge.id === "starter") return -3;
    if (badge.id === "tester") return -2;
    if (badge.id === "dev") return -1;
    const passReward = sharkPassRewards.find(reward => reward.type === "badge" && reward.badgeId === badge.id);
    if (passReward) return passReward.level;
    if (getAllCrateBadgeRewards().some(reward => reward.badgeId === badge.id)) return 500;
    return 999;
}

function getBadgePalette(rarityClass) {
    const palettes = {
        core: { shell: "#0f3c56", border: "#61e7ff", fin: "#9ff6ff", mark: "#d7ffff" },
        special: { shell: "#40215e", border: "#d3a2ff", fin: "#f0d2ff", mark: "#ffffff" },
        common: { shell: "#123f39", border: "#78f0c5", fin: "#b8ffe8", mark: "#effff7" },
        rare: { shell: "#11384f", border: "#7fe8ff", fin: "#b8f5ff", mark: "#ebfdff" },
        epic: { shell: "#2a2663", border: "#b1a2ff", fin: "#d7d1ff", mark: "#f4f1ff" },
        legendary: { shell: "#4d3511", border: "#ffd37b", fin: "#ffe7ad", mark: "#fff8df" }
    };
    return palettes[rarityClass] || palettes.common;
}

function buildBadgeIconSVG(badge, rarityClass) {
    const palette = getBadgePalette(rarityClass);
    const tier = Math.max(1, Math.min(5, badge.tier || 1));
    const marks = Array.from({ length: tier }, (_, index) => {
        const x = 24 + index * 12;
        return `<circle cx="${x}" cy="56" r="3" fill="${palette.mark}" opacity="${0.78 + index * 0.04}"/>`;
    }).join("");
    return `
<svg viewBox="0 0 72 72" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
  <rect x="4" y="4" width="64" height="64" rx="20" fill="${palette.shell}" stroke="${palette.border}" stroke-width="3"/>
  <path d="M19 49c4-11 8-24 17-33 9 8 14 22 17 33-7-4-13-5-17-5s-10 1-17 5Z" fill="${palette.fin}"/>
  <path d="M31 24c4 6 6 12 7 18-4-2-8-3-11-3 1-5 2-10 4-15Z" fill="${palette.mark}" opacity=".28"/>
  <path d="M18 51c6-4 12-6 18-6s12 2 18 6" fill="none" stroke="${palette.border}" stroke-width="2.4" stroke-linecap="round"/>
  ${marks}
</svg>`.trim();
}

function getBadgeIconMarkup(badge) {
    const rarity = getBadgeRarityMeta(badge);
    return buildBadgeIconSVG(badge, rarity.className);
}

function getUnlockedBadgeIds(profileData = getCurrentProfileData()) {
    return getUnlockedBadges(profileData.uid || currentUser?.uid || "", profileData).map(badge => badge.id);
}

function getUnlockedCardThemeIds(profileData = getCurrentProfileData()) {
    return getUnlockedCardThemes(profileData).map(theme => theme.id);
}

function sanitizeProfilePicturePath(path, fallback = "") {
    const normalized = String(path || "").replace(/\\/g, "/").replace(/^\.?\//, "").trim();
    if (!normalized || /^(?:images\/)?profileThemes\//i.test(normalized)) return fallback;
    return normalized;
}

function buildCosmeticSyncPayload(profileData = getCurrentProfileData()) {
    const profilePic = sanitizeProfilePicturePath(profileData.profilePicture || profileData.profilePic, "images/pfp/shark1.png");
    return {
        profilePicture: profilePic,
        profilePic: profilePic,
        equippedBadge: normalizeBadgeId(profileData.equippedBadge || "starter"),
        equippedCardTheme: profileData.equippedCardTheme || "default",
        equippedTitle: getEquippedProfileTitle(profileData),
        unlockedBadges: getUnlockedBadgeIds(profileData),
        unlockedCardThemes: getUnlockedCardThemeIds(profileData),
        unlockedTitles: getUnlockedProfileTitleIds(profileData),
        showcasedAchievements: getProfileShowcasedAchievementIds(profileData),
        lastUpdated: profileData.lastUpdated || Date.now()
    };
}

function getEquippedCardTheme() {
    const profileData = getCurrentProfileData();
    const equipped = profileData.equippedCardTheme || "default";
    const unlocked = getUnlockedCardThemes(profileData);
    return unlocked.some(theme => theme.id === equipped) ? equipped : "default";
}

function setEquippedCardTheme(themeId) {
    const profileData = getCurrentProfileData();
    syncAchievementThemeUnlocks(profileData);
    profileData.equippedCardTheme = themeId;
    saveUserProfileLocally(profileData);
    if (currentUser && db) {
        db.collection("userStats").doc(currentUser.uid).set(buildCosmeticSyncPayload(profileData), { merge: true });
    }
    applyProfileCardTheme(themeId);
    renderThemeSelection();
}

function applyProfileCardTheme(themeId = getEquippedCardTheme()) {
    const profileHero = document.getElementById("profile-hero-card");
    if (!profileHero) return;
    const baseClasses = ["profile-hero-card"];
    if (profileHero.closest(".profile-overhaul-modal")) {
        baseClasses.unshift("profile-overhaul-card");
    }
    profileHero.className = `${baseClasses.join(" ")} theme-${themeId || "default"}`;
    if (typeof getCardThemeMeta === "function") {
        const theme = getCardThemeMeta(themeId || "default");
        profileHero.style.setProperty("background", `
            radial-gradient(circle at 8% 18%, rgba(255,255,255,.16), transparent 28%),
            radial-gradient(circle at 92% 12%, rgba(104,226,240,.18), transparent 32%),
            ${theme.preview}
        `, "important");
        const avatarOrb = profileHero.querySelector(".profile-avatar-orb");
        if (avatarOrb) {
            avatarOrb.style.removeProperty("background");
        }
    }
}

function applyThemeToProfileCard(elementId, themeId = "default") {
    const card = document.getElementById(elementId);
    if (!card) return;
    card.className = `profile-hero-card friend-profile-hero theme-${themeId || "default"}`;
}

function getLeaderboardRankLabel(rank) {
    if (rank === 1) return "\u{1F3C6} #1";
    if (rank === 2) return "\u{1F948} #2";
    if (rank === 3) return "\u{1F949} #3";
    return "Outside Top 3";
}

let latestProfileLeaderboardRequest = 0;
let latestFriendLeaderboardRequest = 0;

function applyLeaderboardBadge(elementId, rank) {
    const badge = document.getElementById(elementId);
    if (!badge) return;

    badge.className = 'profile-leaderboard-badge hidden';
    badge.textContent = '';

    if (rank === 1 || rank === 2 || rank === 3) {
        badge.textContent = getLeaderboardRankLabel(rank);
        badge.className = `profile-leaderboard-badge rank-${rank}`;
    }
}

async function fetchLeaderboardPlacement(uid) {
    if (!uid || !db) return null;
    try {
        const snapshot = await db.collection("userStats")
            .orderBy("wins", "desc")
            .limit(25)
            .get();

        let rank = 1;
        let placement = null;
        snapshot.forEach(doc => {
            if (placement !== null) return;
            if (doc.id === uid || doc.data()?.uid === uid) {
                placement = rank;
                return;
            }
            rank += 1;
        });
        return placement;
    } catch (error) {
        console.warn("Unable to fetch leaderboard placement:", error);
        return null;
    }
}

function applyDuelPlayerTheme(elementId, themeId = "default") {
    const card = document.getElementById(elementId);
    if (!card) return;
    const theme = getCardThemeMeta(themeId || "default");
    card.style.background = `
        radial-gradient(circle at top left, rgba(255, 255, 255, 0.08), transparent 34%),
        ${theme.preview}
    `;
    card.style.borderColor = "rgba(97, 231, 255, 0.18)";
}

function renderThemeSelection() {
    const container = document.getElementById("theme-select-container");
    if (!container || !currentUser) return;
    syncAchievementThemeUnlocks();
    const unlockedThemes = getUnlockedCardThemes();
    const equippedTheme = getEquippedCardTheme();
    container.innerHTML = "";
    sortCosmeticsForLocker(unlockedThemes
        .map(theme => ({ ...theme, ...getThemeCosmeticMeta(theme) }))
        .filter(theme => shouldShowCosmetic(theme, profileInventoryFilters.themes))
        .filter(theme => matchesCosmeticSearch(theme)))
        .forEach(theme => {
        const button = document.createElement("button");
        button.className = `theme-option rarity-${theme.rarity} ${theme.id === equippedTheme ? "active" : ""}`;
        button.onclick = () => setEquippedCardTheme(theme.id);
        button.innerHTML = `
            <span class="theme-swatch" style="background:${theme.preview};"></span>
            <span>${theme.name}</span>
            <small class="cosmetic-chip-row"><b class="rarity-chip rarity-${theme.rarity}">${getCosmeticRarityLabel(theme.rarity)}</b><b class="source-chip" title="${theme.source}">${getShortCosmeticSourceLabel(theme.source)}</b></small>
        `;
        container.appendChild(button);
    });
    if (!container.innerHTML.trim()) {
        container.innerHTML = `<div class="profile-empty-card">No themes match this filter.</div>`;
    }
    applyProfileCardTheme(equippedTheme);
}
const allBadges = [
    { id: "starter", name: "Starter", emoji: "\u{1F988}", description: "Default badge for all players." },
    { id: "dev", name: "Developer", emoji: "\u{1F5A5}\uFE0F", description: "Awarded only to the developer.", devOnly: true },
    { id: "tester", name: "Tester", emoji: "\u{1F3AE}", description: "Awarded for testing via code redeem.", codeUnlock: true },
    { id: "anniversary", name: "Anniversary", emoji: "\u{1F389}", description: "Awarded for redeeming the Anniversary code.", codeUnlock: true },
    { id: "lucky-fin", name: "Lucky Fin", emoji: "\u{1F340}", description: "Awarded from the daily win wheel.", codeUnlock: true },
    { id: "extinction", name: "Extinction", emoji: "\u{2604}\uFE0F", description: "Awarded for defeating a summer community boss.", rarity: "legendary", codeUnlock: true },
    { id: "spiral-hunter", name: "Spiral Hunter", emoji: "\u{1F300}", description: "Awarded for defeating the Halloween Helicoprion community boss.", rarity: "legendary", codeUnlock: true },
    { id: "frost-anvil", name: "Frost Anvil", emoji: "\u{2744}\uFE0F", description: "Awarded for defeating the Christmas Stethacanthus community boss.", rarity: "legendary", codeUnlock: true },
    { id: "treasure-keeper", name: "Treasure Keeper", emoji: "\u{1F5FA}\uFE0F", description: "Awarded for completing every Lost Treasures scroll.", rarity: "legendary", codeUnlock: true }
];

const currentPassBadgeDefs = [
    { id: "bullhead-bloom", name: "Bullhead Bloom", emoji: "\u{1F33F}", description: "A Shark Pass 2 badge for reaching level 3.", passLevel: 3 },
    { id: "ray-drift", name: "Ray Drift", emoji: "\u{1F300}", description: "A Shark Pass 2 badge for reaching level 5.", passLevel: 5 },
    { id: "guitarfish-glide", name: "Guitarfish Glide", emoji: "\u{1F3B8}", description: "A Shark Pass 2 badge for reaching level 8.", passLevel: 8 },
    { id: "carpet-shadow", name: "Carpet Shadow", emoji: "\u{1F311}", description: "A Shark Pass 2 badge for reaching level 10.", passLevel: 10 },
    { id: "coffin-depths", name: "Coffin Depths", emoji: "\u{1F578}\uFE0F", description: "A Shark Pass 2 badge for reaching level 12.", passLevel: 12 },
    { id: "copper-current", name: "Copper Current", emoji: "\u{26A1}", description: "A Shark Pass 2 badge for reaching level 18.", passLevel: 18 },
    { id: "bull-ray-banner", name: "Bull Ray Banner", emoji: "\u{1F6A9}", description: "A Shark Pass 2 badge for reaching level 20.", passLevel: 20 },
    { id: "galapagos-guard", name: "Galapagos Guard", emoji: "\u{1F5FF}", description: "A Shark Pass 2 badge for reaching level 22.", passLevel: 22 },
    { id: "sixgill-sovereign", name: "Sixgill Sovereign", emoji: "\u{1F451}", description: "A Shark Pass 2 badge for reaching level 26.", passLevel: 26 }
];

for (let i = allBadges.length - 1; i >= 0; i--) {
    if (currentPassBadgeDefs.some(badge => badge.id === allBadges[i].id)) {
        allBadges.splice(i, 1);
    }
}
allBadges.push(...currentPassBadgeDefs);
allBadges.push(
    { id: "rollin", name: "Rollin'", emoji: "\u{1F3B2}", description: "Keep rollin', rollin', rollin', rollin'.", rarity: "special" },
    { id: "arrow-to-the-knee", name: "Arrow to the Knee", emoji: "\u{1F3F9}", description: "Awarded for losing a win streak.", rarity: "special" },
    { id: "im-not-okay", name: "I'm Not Okay (I Promise)", emoji: "\u{1F494}", description: "Awarded for losing 6 games in a row.", rarity: "special" },
    { id: "one-shot-oracle", name: "One-Shot Oracle", emoji: "\u{1F3AF}", description: "Awarded for claiming the One-Shot Oracle achievement.", rarity: "rare", achievementReward: true },
    { id: "crate-connoisseur", name: "Crate Connoisseur", emoji: "\u{1F9F0}", description: "Awarded for claiming the Crate Collector achievement.", rarity: "rare", achievementReward: true },
    { id: "rival-breaker", name: "Rival Breaker", emoji: "\u{1F947}", description: "Awarded for claiming the Rival Breaker achievement.", rarity: "epic", achievementReward: true },
    { id: "deep-cartographer", name: "Deep Cartographer", emoji: "\u{1F5FA}\uFE0F", description: "Awarded for claiming the Japan Mastered achievement.", rarity: "legendary", achievementReward: true },
    { id: "social-current", name: "Social Current", emoji: "\u{1F310}", description: "Awarded for claiming the Social Current achievement.", rarity: "legendary", achievementReward: true },
    { id: "abyssal-legend", name: "Abyssal Legend", emoji: "\u{1F30C}", description: "Awarded for claiming the Abyssal Legend achievement.", rarity: "legendary", achievementReward: true },
    { id: "marathon-fin", name: "Marathon Fin", emoji: "\u{1F3C1}", description: "Awarded for claiming the Marathon Fin achievement.", rarity: "legendary", achievementReward: true },
    { id: "reef-glint", name: "Driftwood", emoji: "\u{1FAB5}", description: "A retired Cosmetic Crate 1 badge." },
    { id: "kelp-warden", name: "Smelly Boot", emoji: "\u{1F97E}", description: "A retired Cosmetic Crate 1 badge." },
    { id: "trench-myth", name: "Message Bottle", emoji: "\u{1F37E}", description: "A retired Cosmetic Crate 1 badge." },
    { id: "aurora-fin", name: "Doubloon", emoji: "\u{1FA99}", description: "A retired Cosmetic Crate 1 badge." },
    { id: "tide-glass", name: "Tide Glass", emoji: "\u{1FAE7}", description: "A badge found in Cosmetic Crates." },
    { id: "fossil-tooth", name: "Fossil Tooth", emoji: "\u{1F9B7}", description: "A badge found in Cosmetic Crates." },
    { id: "deep-anchor", name: "Deep Anchor", emoji: "\u{2693}", description: "A badge found in Cosmetic Crates." },
    { id: "royal-pearl", name: "Royal Pearl", emoji: "\u{1F9AA}", description: "A badge found in Cosmetic Crates." },
    { id: "Tidepool", name: "Tidepool", emoji: "\u{1F300}", description: "A summer crate badge." },
    { id: "Ice Cream", name: "Ice Cream", emoji: "\u{1F366}", description: "A summer crate badge." },
    { id: "Horizon", name: "Horizon", emoji: "\u{1F305}", description: "A summer crate badge." },
    { id: "Paradise", name: "Paradise", emoji: "\u{1F334}", description: "A summer crate badge." },
    { id: "Christmas", name: "Christmas", emoji: "\u{1F384}", description: "A christmas crate badge." },
    { id: "Present", name: "Present", emoji: "\u{1F381}", description: "A christmas crate badge." },
    { id: "Snowflake", name: "Snowflake", emoji: "\u{2744}\uFE0F", description: "A christmas crate badge." },
    { id: "Santa", name: "Santa", emoji: "\u{1F385}", description: "A christmas crate badge." },
    { id: "Pumpkin", name: "Pumpkin", emoji: "\u{1F383}", description: "A halloween crate badge." },
    { id: "Bat", name: "Bat", emoji: "\u{1F987}", description: "A halloween crate badge." },
    { id: "Ghost", name: "Ghost", emoji: "\u{1F47B}", description: "A halloween crate badge." },
    { id: "Vampire", name: "Vampire", emoji: "\u{1F9DB}", description: "A halloween crate badge." }
);

function getUnlockedBadges(uid, profileData = getCurrentProfileData()) {
    // Always unlock starter badge
    const badges = [allBadges[0]];
    if (isDeveloperUid(uid || profileData?.uid)) badges.push(allBadges[1]);
    const activeProfile = profileData || getCurrentProfileData();
    const playerLevel = getCurrentPlayerLevel(activeProfile);
    // Unlock tester badge if code redeemed
    try {
        if (activeProfile.testerBadgeUnlocked || hasRedeemedCode('TESTER')) {
            if (!badges.some(b => b.id === 'tester')) badges.push(allBadges.find(b => b.id === 'tester'));
        }
    } catch {}
    // Unlock anniversary badge if code redeemed
    try {
        if (hasRedeemedCode('ANNIVERSARY2026') || (Array.isArray(activeProfile.unlockedBadges) && activeProfile.unlockedBadges.includes('anniversary'))) {
            if (!badges.some(b => b.id === 'anniversary')) badges.push(allBadges.find(b => b.id === 'anniversary'));
        }
    } catch {}
    allBadges
        .filter(badge => badge.passLevel && playerLevel >= badge.passLevel)
        .forEach(badge => {
            if (!badges.some(existing => existing.id === badge.id)) {
                badges.push(badge);
            }
        });
    sharkPassRewards
        .filter(reward => reward.type === "badge" && reward.level <= playerLevel)
        .forEach(reward => {
            const badgeMeta = getBadgeMeta(reward.badgeId);
            if (!badges.some(existing => existing.id === badgeMeta.id)) {
                badges.push(badgeMeta);
            }
        });
    getStoredUnlockedBadgeIds(activeProfile).forEach(badgeId => {
        const badgeMeta = getBadgeMeta(badgeId);
        if (badgeMeta && !badges.some(existing => existing.id === badgeMeta.id)) {
            badges.push(badgeMeta);
        }
    });
    return badges.map(badge => getBadgeMeta(badge.id));
}

function getEquippedBadge(profileData = getCurrentProfileData()) {
    const equipped = normalizeBadgeId(profileData.equippedBadge || "starter");
    // Only allow equipped badge if it's unlocked
    const unlocked = getUnlockedBadges(profileData.uid || (currentUser && currentUser.uid), profileData);
    if (unlocked.some(b => b.id === equipped)) {
        return equipped;
    }
    return "starter";
}

function setEquippedBadge(badgeId) {
    const profileData = getCurrentProfileData();
    profileData.equippedBadge = normalizeBadgeId(badgeId);
    saveUserProfileLocally(profileData);
    // Save to Firestore if logged in
    if (currentUser && db) {
        db.collection("userStats").doc(currentUser.uid).set(buildCosmeticSyncPayload(profileData), { merge: true });
    }
    updateProfileBadgeUI();
    renderBadgeSelection();
    renderProfileInventoryUI(profileData);
}

function updateProfileBadgeUI() {
    const badgeImg = document.getElementById("profile-badge-img");
    const badgeLabel = document.getElementById("profile-badge-label");
    const badgeId = getEquippedBadge();
    const badge = getBadgeMeta(badgeId);
    // Remove any previous emoji span
    let prev = document.getElementById('profile-badge-emoji');
    if (prev && prev.parentNode) prev.parentNode.removeChild(prev);
    if (badgeImg) badgeImg.style.display = 'none';
    // Color rarity logic
    let borderColor = '#00b4d8', bgColor = 'rgba(0,180,216,0.12)', textColor = '#00b4d8';
    if (badge.id === 'dev') {
        borderColor = '#FFD700';
        bgColor = 'rgba(255,215,0,0.13)';
        textColor = '#FFD700';
    } else if (badge.id === 'tester') {
        borderColor = '#ff8a3d';
        bgColor = 'rgba(255,138,61,0.15)';
        textColor = '#ffc18d';
    } else if (badge.id === 'starter') {
        borderColor = '#00b4d8';
        bgColor = 'rgba(0,180,216,0.12)';
        textColor = '#00b4d8';
    }
    // Insert emoji with styled container
    if (badgeImg && badgeImg.parentNode) {
        const emblem = document.createElement('div');
        emblem.id = 'profile-badge-emoji';
        emblem.className = 'profile-badge-emblem';
        emblem.style.borderColor = borderColor;
        emblem.style.background = bgColor;
        emblem.textContent = badge.emoji || "\u{1F988}";
        badgeImg.parentNode.insertBefore(emblem, badgeImg.nextSibling);
    }
    if (badgeLabel) {
        badgeLabel.textContent = badge && badge.name ? badge.name : "Badge";
        badgeLabel.style.color = textColor;
    }
}

function renderBadgeSelection() {
    const badgeContainer = document.getElementById("badge-select-container");
    if (!badgeContainer || !currentUser) return;
    badgeContainer.innerHTML = "";
    const unlocked = getUnlockedBadges(currentUser.uid).sort((a, b) => {
        const rarityDiff = getBadgeRarityRank(a) - getBadgeRarityRank(b);
        if (rarityDiff !== 0) return rarityDiff;
        const unlockDiff = getBadgeUnlockOrder(a) - getBadgeUnlockOrder(b);
        if (unlockDiff !== 0) return unlockDiff;
        return a.name.localeCompare(b.name);
    });
    const equippedBadge = getEquippedBadge();
    unlocked.forEach(badge => {
        const rarityMeta = getBadgeRarityMeta(badge);
        // Color rarity logic
        let borderColor = '#00b4d8', bgColor = 'rgba(0,180,216,0.12)', textColor = '#00b4d8';
        if (badge.id === 'dev') {
            borderColor = '#FFD700';
            bgColor = 'rgba(255,215,0,0.13)';
            textColor = '#FFD700';
        } else if (badge.id === 'tester') {
            borderColor = '#ff8a3d';
            bgColor = 'rgba(255,138,61,0.15)';
            textColor = '#ffc18d';
        } else if (badge.id === 'starter') {
            borderColor = '#00b4d8';
            bgColor = 'rgba(0,180,216,0.12)';
            textColor = '#00b4d8';
        } else if (rarityMeta.className === 'rare') {
            borderColor = '#6ee7ff';
            bgColor = 'rgba(77,208,225,0.14)';
            textColor = '#9cf4ff';
        } else if (rarityMeta.className === 'epic') {
            borderColor = '#a99bff';
            bgColor = 'rgba(120,119,255,0.16)';
            textColor = '#d2cbff';
        } else if (rarityMeta.className === 'legendary') {
            borderColor = '#ffd47f';
            bgColor = 'rgba(255,196,87,0.18)';
            textColor = '#ffe3ad';
        }
        const div = document.createElement("div");
        div.className = `badge-option rarity-${rarityMeta.className}`;
        if (badge.id === equippedBadge) {
            div.classList.add("active");
        }
        div.onclick = () => setEquippedBadge(badge.id);
        div.innerHTML = `
          <span class="badge-option-kicker">Shark Badge</span>
          <span class="badge-option-emoji" style="background:${bgColor};border-color:${borderColor};color:${textColor};">${badge.emoji || "\u{1F988}"}</span>
          <span class="badge-option-name" style="color:${textColor};">${badge.name}</span>
          <span class="badge-option-rarity rarity-${rarityMeta.className}">${rarityMeta.label}</span>
        `;
        badgeContainer.appendChild(div);
    });
}

function getProfileTitleMeta(titleId) {
    return profileTitleDefs.find(title => title.id === titleId) || profileTitleDefs[0];
}

function getUnlockedProfileTitleIds(profileData = getCurrentProfileData()) {
    const storedTitles = Array.isArray(profileData.unlockedTitles) ? profileData.unlockedTitles : [];
    const normalized = storedTitles
        .map(titleId => getProfileTitleMeta(titleId).id)
        .filter(titleId => titleId && profileTitleDefs.some(title => title.id === titleId));
    return [...new Set(normalized)];
}

function getUnlockedProfileTitles(profileData = getCurrentProfileData()) {
    return [
        profileTitleDefs[0],
        ...getUnlockedProfileTitleIds(profileData).map(getProfileTitleMeta)
    ];
}

function getEquippedProfileTitle(profileData = getCurrentProfileData()) {
    const equippedTitle = profileData.equippedTitle || "";
    return getUnlockedProfileTitleIds(profileData).includes(equippedTitle) ? equippedTitle : "";
}

function updateProfileTitleUI(profileData = getCurrentProfileData()) {
    const titleEl = document.getElementById("profile-title-label");
    if (!titleEl) return;
    const equippedTitle = getEquippedProfileTitle(profileData);
    const titleMeta = getProfileTitleMeta(equippedTitle);
    titleEl.textContent = equippedTitle ? titleMeta.name : "";
    titleEl.classList.toggle("hidden", !equippedTitle);
}

function renderTitleSelection() {
    const container = document.getElementById("title-select-container");
    if (!container || !currentUser) return;
    const profileData = getCurrentProfileData();
    const unlockedTitles = getUnlockedProfileTitles(profileData);
    const equippedTitle = getEquippedProfileTitle(profileData);
    container.innerHTML = "";

    unlockedTitles.forEach(title => {
        const button = document.createElement("button");
        button.className = `title-option ${title.id === equippedTitle ? "active" : ""}`;
        button.type = "button";
        button.onclick = () => setEquippedProfileTitle(title.id);
        button.innerHTML = `
            <span>${title.name}</span>
            <small>${title.description}</small>
        `;
        container.appendChild(button);
    });
}

function setEquippedProfileTitle(titleId) {
    const profileData = getCurrentProfileData();
    const normalizedTitleId = getProfileTitleMeta(titleId).id;
    if (normalizedTitleId && !getUnlockedProfileTitleIds(profileData).includes(normalizedTitleId)) return;

    profileData.equippedTitle = normalizedTitleId;
    saveUserProfileLocally(profileData);
    if (currentUser && db) {
        db.collection("userStats").doc(currentUser.uid).set(buildCosmeticSyncPayload(profileData), { merge: true });
    }
    updateProfileTitleUI(profileData);
    renderTitleSelection();
}

const firebaseConfig = {
    apiKey: "AIzaSyAS9l8O1jRMafPt3r0lF6mqjr2-gl-EbZ0",
    authDomain: "sharkdle-leaderboard.firebaseapp.com",
    databaseURL: "https://sharkdle-leaderboard-default-rtdb.firebaseio.com",
    projectId: "sharkdle-leaderboard",
    storageBucket: "sharkdle-leaderboard.firebasestorage.app",
    messagingSenderId: "429123174628",
    appId: "1:429123174628:web:42ae9baed69c4b087c2cf1",
    measurementId: "G-HV5FFNKM5C"
};

let auth, db;

// Global sync state to prevent race conditions
let isSyncing = false;
let syncQueue = [];

// Global notification system
function showNotification(message, type = 'info', duration = 3000) {
    const notification = document.createElement('div');
    notification.className = `global-notification notification-${type}`;
    notification.textContent = message;
    notification.style.cssText = `
        position: fixed;
        bottom: 20px;
        left: 20px;
        background: ${type === 'error' ? '#d32f2f' : type === 'success' ? '#4caf50' : '#2196F3'};
        color: white;
        padding: 16px 24px;
        border-radius: 8px;
        font-weight: 600;
        box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
        z-index: 9999;
        animation: slideUp 0.3s ease-out;
        max-width: 400px;
        word-wrap: break-word;
    `;
    document.body.appendChild(notification);
    setTimeout(() => notification.remove(), duration);
}

function showCosmeticUnlockToast(cosmetic, options = {}) {
    if (!cosmetic?.imagePath || !cosmetic?.name) return;

    const {
        title = 'Cosmetic Unlocked!',
        subtitle = cosmetic.name,
        accent = '#00b4d8',
        background = 'linear-gradient(135deg, rgba(0, 180, 216, 0.96), rgba(0, 62, 82, 0.96))',
        duration = 4200,
        icon = '\u{1F3A8}'
    } = options;

    const notification = document.createElement('div');
    notification.className = 'cosmetic-unlock-toast';
    notification.style.cssText = `
        position: fixed;
        bottom: 20px;
        right: 20px;
        display: flex;
        align-items: center;
        gap: 14px;
        min-width: 280px;
        max-width: 340px;
        padding: 16px 18px;
        border-radius: 14px;
        background: ${background};
        color: #fff;
        border: 2px solid ${accent};
        box-shadow: 0 12px 28px rgba(0, 0, 0, 0.32);
        z-index: 10000;
        animation: slideUp 0.3s ease-out;
        backdrop-filter: blur(8px);
    `;

    notification.innerHTML = `
        <div style="width: 64px; height: 64px; flex: 0 0 64px; border-radius: 14px; overflow: hidden; border: 2px solid ${accent}; background: rgba(255,255,255,0.12); box-shadow: 0 6px 16px rgba(0,0,0,0.22);">
            <img src="${cosmetic.imagePath}" alt="${cosmetic.name}" style="width: 100%; height: 100%; object-fit: cover;">
        </div>
        <div style="min-width: 0; flex: 1 1 auto;">
            <div style="display:flex; align-items:center; gap:8px; margin-bottom:4px;">
                <span style="font-size: 18px; line-height: 1;">${icon}</span>
                <div style="font-size: 15px; font-weight: 800; color: ${accent};">${title}</div>
            </div>
            <div style="font-size: 14px; font-weight: 700; line-height: 1.25; word-break: break-word;">${subtitle}</div>
        </div>
    `;

    document.body.appendChild(notification);
    setTimeout(() => {
        notification.style.animation = 'slideUp 0.3s ease-out reverse';
        setTimeout(() => notification.remove(), 300);
    }, duration);
}

function normalizeAdminCompensationNotice(rawNotice) {
    if (!rawNotice || typeof rawNotice !== "object") return null;
    const id = String(rawNotice.id || rawNotice.createdAt || "").trim();
    if (!id) return null;
    const grants = Array.isArray(rawNotice.grants)
        ? rawNotice.grants
            .filter(grant => grant && typeof grant === "object")
            .map(grant => ({
                name: String(grant.name || grant.label || "Reward").trim().slice(0, 60),
                value: String(grant.value || "").trim().slice(0, 40),
                detail: String(grant.detail || "").trim().slice(0, 80)
            }))
            .filter(grant => grant.name || grant.value)
        : [];
    if (!grants.length) return null;
    return {
        id,
        createdAt: Number(rawNotice.createdAt) || Date.now(),
        grants
    };
}

function getAdminCompensationSeenStorageKey(uid = currentUser?.uid) {
    return uid ? `adminCompensationSeen_${uid}` : "adminCompensationSeen";
}

function hasSeenAdminCompensationNotice(notice, uid = currentUser?.uid) {
    if (!notice?.id) return true;
    return localStorage.getItem(getAdminCompensationSeenStorageKey(uid)) === notice.id;
}

function markAdminCompensationNoticeSeen(notice, uid = currentUser?.uid) {
    if (!notice?.id) return;
    localStorage.setItem(getAdminCompensationSeenStorageKey(uid), notice.id);
}

function showAdminCompensationPopup(notice) {
    const normalizedNotice = normalizeAdminCompensationNotice(notice);
    if (!normalizedNotice) return;

    document.querySelectorAll(".admin-compensation-popup").forEach(element => element.remove());

    const popup = document.createElement("div");
    popup.className = "admin-compensation-popup";
    popup.setAttribute("role", "status");
    popup.innerHTML = `
        <div class="admin-compensation-popup-header">
            <span>Admin Compensation</span>
            <button class="admin-compensation-popup-close" type="button" aria-label="Close compensation popup">x</button>
        </div>
        <h3>U have been compensated by an admin</h3>
        <ul>
            ${normalizedNotice.grants.map(grant => `
                <li>
                    <span>${escapeHtml(grant.name)}</span>
                    <strong>${escapeHtml(grant.value)}</strong>
                </li>
            `).join("")}
        </ul>
        ${normalizedNotice.grants.some(grant => grant.detail)
            ? `<small>${escapeHtml(normalizedNotice.grants.map(grant => grant.detail).filter(Boolean).join(" | "))}</small>`
            : ""}
    `;

    popup.querySelector(".admin-compensation-popup-close")?.addEventListener("click", () => popup.remove());
    document.body.appendChild(popup);
    setTimeout(() => popup.remove(), 9000);
}

function maybeShowAdminCompensationNotice(profileData = {}) {
    const notice = normalizeAdminCompensationNotice(profileData.adminCompensationNotice);
    if (!notice || hasSeenAdminCompensationNotice(notice, profileData.uid || currentUser?.uid)) return false;
    markAdminCompensationNoticeSeen(notice, profileData.uid || currentUser?.uid);
    showAdminCompensationPopup(notice);
    return true;
}

// Loading state manager
function showLoadingState(element, show = true) {
    if (show) {
        element.disabled = true;
        element.style.opacity = '0.6';
        element.style.pointerEvents = 'none';
    } else {
        element.disabled = false;
        element.style.opacity = '1';
        element.style.pointerEvents = 'auto';
    }
}

// Firebase init with retry limit
let initRetries = 0;
const MAX_INIT_RETRIES = 10;

function initializeFirebase() {
    if (typeof firebase === 'undefined') {
        if (initRetries < MAX_INIT_RETRIES) {
            console.warn(`Firebase not loaded, retrying... (${initRetries + 1}/${MAX_INIT_RETRIES})`);
            initRetries++;
            setTimeout(initializeFirebase, 100);
        } else {
            console.error('Firebase failed to initialize after max retries');
            showNotification('Connection error: Firebase failed to load', 'error', 5000);
        }
        return;
    }

    if (!firebase.apps.length) {
        firebase.initializeApp(firebaseConfig);
    }

    auth = firebase.auth();
    db = firebase.firestore();
    setupGlobalXpEventListener();
    setupGlobalIndexThemeListener();
    setupCommunityBossEventListener();

    // Set up offline support detection
    window.addEventListener('online', () => {
        console.log('Connection restored');
        showNotification('Connection restored', 'success');
        updatePresenceHeartbeat();
    });
    window.addEventListener('offline', () => {
        console.warn('Offline - changes will sync when connection returns');
        showNotification('Offline - changes will sync when connection returns', 'info', 5000);
    });

    // Set up auth state listener after Firebase is initialized
    setupAuthStateListener();
}

initializeFirebase();

const APP_ROUTE_MAP = Object.freeze({
    "daily.html": "Daily/index.html",
    "Daily/": "Daily/index.html",
    "infinite.html": "Infinite/index.html",
    "Infinite/": "Infinite/index.html",
    "practice.html": "Practice/index.html",
    "Practice/": "Practice/index.html",
    "achievements.html": "Achievements/index.html",
    "Achievements/": "Achievements/index.html",
    "leaderboards.html": "Leaderboard/index.html",
    "Leaderboard/": "Leaderboard/index.html",
    "library.html": "Library/index.html",
    "Library/": "Library/index.html",
    "sharkpass.html": "Sharkpass/index.html",
    "Sharkpass/": "Sharkpass/index.html",
    "story.html": "Story/index.html",
    "Story/": "Story/index.html",
    "rng.html": "Minigames/SharkRNG/index.html",
    "Minigames/SharkRNG/": "Minigames/SharkRNG/index.html",
    "lagoon.html": "Minigames/SharkLagoon/index.html",
    "Minigames/SharkLagoon/": "Minigames/SharkLagoon/index.html",
    "secret.html": "shark-rescue/index.html",
    "shark-rescue/": "shark-rescue/index.html",
    "updates.html": "Updates/index.html",
    "Updates/": "Updates/index.html",
    "early-release.html": "EarlyRelease/index.html",
    "EarlyRelease/": "EarlyRelease/index.html"
});

const APP_ROUTE_FOLDERS = Object.freeze([
    "achievements",
    "daily",
    "infinite",
    "practice",
    "leaderboard",
    "library",
    "sharkpass",
    "story",
    "updates",
    "earlyrelease",
    "minigames",
    "shark-rescue"
]);

function getAppRootUrl() {
    const rootUrl = new URL(window.location.href);
    const pathParts = rootUrl.pathname.split("/");
    const routeIndex = pathParts.findIndex(part => APP_ROUTE_FOLDERS.includes(decodeURIComponent(part).toLowerCase()));

    rootUrl.pathname = routeIndex >= 0
        ? `${pathParts.slice(0, routeIndex).join("/")}/`
        : rootUrl.pathname.replace(/[^/]*$/, "");
    rootUrl.search = "";
    rootUrl.hash = "";
    return rootUrl;
}

function resolveAppPath(page) {
    const rawPage = String(page || "");
    if (!rawPage || rawPage.startsWith("#") || /^[a-z][a-z\d+\-.]*:/i.test(rawPage)) {
        return rawPage;
    }
    if (rawPage.startsWith("../") || rawPage.startsWith("./")) {
        return new URL(rawPage, window.location.href).href;
    }
    const mappedPage = APP_ROUTE_MAP[rawPage] || rawPage;
    return new URL(mappedPage.replace(/^\/+/, ""), getAppRootUrl()).href;
}

window.resolveAppPath = resolveAppPath;

// Navigation helper function
function navigate(page) {
    window.location.href = resolveAppPath(page);
}

// ----- shark pass reward definitions -----
// this list is shared by multiple helpers (signup, stats sync, cosmetics)
const levelRewards = [
    { level: 2, imagePath: 'images/levelPfp/Shark6.png', name: 'Angel Shark' },
    { level: 3, imagePath: 'images/levelPfp/Shark7.png', name: 'Blue Shark' },
    { level: 4, imagePath: 'images/levelPfp/Shark8.png', name: 'Blacktip Reef Shark' },
    { level: 5, imagePath: 'images/levelPfp/Shark9.png', name: 'Tiger Shark' },
    { level: 6, imagePath: 'images/levelPfp/Shark10.png', name: 'Thresher Shark' },
    { level: 7, imagePath: 'images/levelPfp/Shark11.png', name: 'Lemon Shark' },
    { level: 8, imagePath: 'images/levelPfp/Shark12.png', name: 'Epaulette Shark' },
    { level: 9, imagePath: 'images/levelPfp/Shark13.png', name: 'Saw Shark' },
    { level: 10, imagePath: 'images/levelPfp/Shark14.png', name: 'Nurse Shark' },
    { level: 15, imagePath: 'images/levelPfp/Shark15.png', name: 'Oceanic Whitetip' },
    { level: 20, imagePath: 'images/levelPfp/Shark16.png', name: 'Mako Shark' },
];

// ----- REDEEM CODE SYSTEM -----
const redeemCodes = {
    'SHARKDLE': { xp: 2500, cosmetics: [{ imagePath: 'images/codePfp/Shark17.png', name: 'Wobbegong Shark' }], description: '2.5k XP + Wobbegong Shark Profile Icon' },
    'UPDATE1': { xp: 1000, cosmetics: [{ imagePath: 'images/codePfp/Shark18.png', name: 'Greenland Shark' }], description: '1k XP + Greenland Shark Profile Icon' },
    'UPDATE2': { xp: 1500, cosmetics: [{ imagePath: 'images/codePfp/Shark19.png', name: 'Goblin Shark' }], description: '1.5k XP + Goblin Shark Profile Icon' },
    'TIKTOK2026': { xp: 2000, cosmetics: [{ imagePath: 'images/codePfp/MantaRay.png', name: 'Manta Ray' }], description: '2k XP + Manta Ray Profile Icon' },
    'INSTAGRAM2026': { xp: 2000, cosmetics: [{ imagePath: 'images/codePfp/WhitespottedEagleRay.png', name: 'Whitespotted Eagle Ray' }], description: '2k XP + Whitespotted Eagle Ray Profile Icon' },
    'SHARKG33K': { xp: 2000, cosmetics: [{ imagePath: 'images/codePfp/creators/SharkG33k.png', name: 'SharkG33k Creator' }], description: '2k XP + SharkG33k Creator Profile Icon' },
    'SUMMER2026': { xp: 3000, crates: { summer: 1 }, description: '3k XP + 1 Summer Crate' },
    'SORRY': { xp: 5000, description: '5k XP apology reward' },
    'TESTER': { badge: 'tester', description: 'Unlocks the Tester badge (\u{1F3AE})' }
};

delete redeemCodes.TESTER;

function applyCodeCrateRewards(profileData, crateRewards = {}) {
    if (!crateRewards || typeof crateRewards !== "object") return [];
    const inventory = getCrateInventory(profileData);
    const granted = [];
    Object.entries(crateRewards).forEach(([crateId, amount]) => {
        const count = Math.max(0, Math.floor(Number(amount) || 0));
        if (!count || !crateDefinitions[crateId]) return;
        if (isSeasonalCrateId(crateId) && !isSeasonalCrateThemeActive(crateId)) return;
        inventory[crateId] = (inventory[crateId] || 0) + count;
        granted.push({ crateId, count, name: getCrateDefinition(crateId).name });
    });
    if (granted.length) {
        profileData.crateInventory = normalizeCrateInventory(inventory);
        markCrateInventoryChanged(profileData);
    }
    return granted;
}

// Keep track of redeemed codes in localStorage
function getRedeemedCodes() {
    const redeemed = localStorage.getItem("redeemedCodes");
    return redeemed ? JSON.parse(redeemed) : [];
}

function addRedeemedCode(code) {
    const redeemed = getRedeemedCodes();
    const codeUpper = code.toUpperCase();
    if (!redeemed.includes(codeUpper)) {
        redeemed.push(codeUpper);
        localStorage.setItem("redeemedCodes", JSON.stringify(redeemed));
        // Special logic for TESTER
        if (codeUpper === 'TESTER') {
            // Mark badge as unlocked in profile
            const profileData = getCurrentProfileData();
            profileData.testerBadgeUnlocked = true;
            saveUserProfileLocally(profileData);
            // Save to Firestore if logged in
            if (currentUser && db) {
                db.collection("userStats").doc(currentUser.uid).set({ testerBadgeUnlocked: true }, { merge: true });
            }
            showNotification('Tester badge unlocked! Go equip it in your profile.', 'success', 4000);
        }
    }
}

function hasRedeemedCode(code) {
    const codeUpper = code.toUpperCase();
    // Check localStorage first
    const localRedeemed = getRedeemedCodes();
    if (localRedeemed.includes(codeUpper)) return true;

    // Also check if the cosmetic from this code is already in earnedCosmetics (from Firebase)
    const profileData = getCurrentProfileData();
    const earnedCosmetics = Array.isArray(profileData.earnedCosmetics) ? profileData.earnedCosmetics : [];

    // Check if any cosmetic from this code is already owned
    if (redeemCodes[codeUpper] && redeemCodes[codeUpper].cosmetics) {
        const codeCosmetics = redeemCodes[codeUpper].cosmetics;
        for (const cosmetic of codeCosmetics) {
            if (earnedCosmetics.some(c => c.imagePath === cosmetic.imagePath || c.name === cosmetic.name)) {
                return true;
            }
        }
    }

    return false;
}

const xpIncrements = [
    0,
    1000,
    1500,
    2000,
    2500,
    3000,
    4000,
    4500,
    5000,
    5500,
    6000,
    6500,
    7000,
    7500,
    8000,
    8500,
    9000,
    9500,
    10000,
    10500
];

function getXPForLevel(level) {
    // cumulative XP required to reach *start* of given level
    if (level <= 1) return 0;
    let sum = 0;
    for (let l = 1; l < level; l++) {
        sum += xpIncrements[l] !== undefined ? xpIncrements[l] : (1000 + (l - 1) * 500);
    }
    return sum;
}

function getLevelFromXP(totalXP) {
    let lvl = 1;
    while (true) {
        const nextXP = getXPForLevel(lvl + 1);
        if (totalXP < nextXP) break;
        lvl++;
    }
    return lvl;
}

function getXPToNextLevel(totalXP) {
    const currentLevel = getLevelFromXP(totalXP);
    const xpForNextLevel = getXPForLevel(currentLevel + 1);
    return xpForNextLevel - totalXP;
}

function getXPInCurrentLevel(totalXP) {
    const currentLevel = getLevelFromXP(totalXP);
    return totalXP - getXPForLevel(currentLevel);
}

// Authentication State
var currentUser = null;

function clearPendingProfileSyncTimeout() {
    if (!pendingProfileSyncTimeout) return;
    clearTimeout(pendingProfileSyncTimeout);
    pendingProfileSyncTimeout = null;
}

function clearPendingAuthStateClearTimeout() {
    if (!pendingAuthStateClearTimeout) return;
    clearTimeout(pendingAuthStateClearTimeout);
    pendingAuthStateClearTimeout = null;
}

function clearCloudProfileReloadTimeouts() {
    cloudProfileReloadTimeouts.forEach(timeoutId => clearTimeout(timeoutId));
    cloudProfileReloadTimeouts = [];
}

function setLoadCloudStatsButtonState(isLoading) {
    const loadBtn = document.getElementById("load-cloud-stats-btn");
    if (!loadBtn) return;
    if (!loadBtn.dataset.defaultText) {
        loadBtn.dataset.defaultText = loadBtn.textContent;
    }
    loadBtn.disabled = isLoading;
    loadBtn.textContent = isLoading ? "Loading..." : loadBtn.dataset.defaultText;
}

async function loadCloudStats(options = {}) {
    const { manual = false, showSuccessToast = false } = options;
    if (!currentUser) {
        if (manual) {
            showNotification("Please login first.", "error");
        }
        return false;
    }

    if (manual) {
        setLoadCloudStatsButtonState(true);
    }

    try {
        const loadedProfile = await loadUserProfile({ rethrowErrors: manual });
        await runPostProfileHydrationTasks(loadedProfile, { logPending: !manual });
        if (manual && showSuccessToast && loadedProfile) {
            showNotification("Cloud stats loaded.", "success");
        }
        return Boolean(loadedProfile);
    } catch (error) {
        console.warn("Manual cloud stats reload failed:", error);
        if (manual) {
            showNotification("Couldn't load cloud stats right now. Try again.", "error");
        }
        return false;
    } finally {
        if (manual) {
            setLoadCloudStatsButtonState(false);
        }
    }
}

function scheduleCloudProfileReloads() {
    clearCloudProfileReloadTimeouts();
    if (!currentUser) return;

    CLOUD_PROFILE_RELOAD_DELAYS_MS.forEach(delayMs => {
        const timeoutId = setTimeout(() => {
            if (!currentUser) return;
            loadCloudStats().catch(error => console.warn("Auto cloud stats reload failed:", error));
        }, delayMs);
        cloudProfileReloadTimeouts.push(timeoutId);
    });
}

// Set up auth state listener
function setupAuthStateListener() {
    if (!auth) {
        console.warn('Auth not yet initialized, retrying...');
        setTimeout(setupAuthStateListener, 100);
        return;
    }

    // Listen for auth state changes
    auth.onAuthStateChanged(user => {
        const previousUid = currentUser?.uid || null;
        clearPendingAuthStateClearTimeout();
        currentUser = user;
        window.currentUser = user;
        clearPendingProfileSyncTimeout();
        clearCloudProfileReloadTimeouts();
        if (!user || previousUid !== user.uid) {
            lastServerHydratedProfileUid = null;
        }
        if (previousUid && user && user.uid !== previousUid) {
            clearCachedProfileState();
        } else if (!user) {
            // During reload, auth can briefly emit null before the persisted session user.
            // Delay clearing local stats so we don't wipe login streak keys during that race.
            pendingAuthStateClearTimeout = setTimeout(() => {
                pendingAuthStateClearTimeout = null;
                if (!currentUser) {
                    clearCachedProfileState();
                }
            }, 1500);
        }
        unsubscribeFriendNetworkListener();
        unsubscribeAdminCompensationNoticeListener();
        if (user && db) {
            ensureAuthUserProfile(user).catch(error => console.warn("Auth profile setup failed:", error));
            setupFriendNetworkListener();
            setupAdminCompensationNoticeListener();
        }
        // Ensure DOM is ready before updating UI
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', () => updateAuthUI());
        } else {
            updateAuthUI();
        }
    });

    // Set up profile sync after auth is set up
    setupProfileSync();
}

function setupFriendNetworkListener() {
    if (!db || !currentUser) return;
    const ref = db.collection(FRIENDS_COLLECTION).doc(currentUser.uid);
    friendDocumentUnsubscribe = ref.onSnapshot(doc => {
        const data = doc.exists ? (doc.data() || {}) : {};
        activeDuelsCache = normalizeDuelsList(data.duels);
        reconcileCompletedDuelStats(activeDuelsCache);
        if (document.getElementById('profileModal')?.classList.contains('hidden') === false && document.getElementById('friends-tab')?.style.display !== 'none') {
            populateFriendsTab();
        }
        if (currentOpenDuelId) {
            const duel = activeDuelsCache.find(entry => entry.id === currentOpenDuelId);
            if (duel) {
                renderFriendDuelModal(duel);
            }
        }
        if (window.loadAndDisplayAchievements) {
            window.loadAndDisplayAchievements();
        }
    }, error => {
        console.warn('Friend network listener failed:', error);
    });
}

function unsubscribeFriendNetworkListener() {
    if (friendDocumentUnsubscribe) {
        friendDocumentUnsubscribe();
        friendDocumentUnsubscribe = null;
    }
}

function setupAdminCompensationNoticeListener() {
    if (!db || !currentUser) return;
    if (adminCompensationNoticeUnsubscribe) {
        adminCompensationNoticeUnsubscribe();
    }
    adminCompensationNoticeUnsubscribe = db.collection("userStats").doc(currentUser.uid).onSnapshot(snapshot => {
        if (!snapshot.exists) return;
        const data = snapshot.data() || {};
        maybeShowAdminCompensationNotice({
            uid: currentUser.uid,
            adminCompensationNotice: data.adminCompensationNotice
        });
    }, error => {
        console.warn("Admin compensation notice listener failed:", error);
    });
}

function unsubscribeAdminCompensationNoticeListener() {
    if (adminCompensationNoticeUnsubscribe) {
        adminCompensationNoticeUnsubscribe();
        adminCompensationNoticeUnsubscribe = null;
    }
}

function unsubscribeFriendDuelListener() {
    activeDuelsCache = [];
}

// Cross-subdomain profile sync
var profileSyncInterval = null;

function setupProfileSync() {
    // Stop previous sync if it exists
    if (profileSyncInterval) {
        clearInterval(profileSyncInterval);
    }

    // Sync profile from Firebase every 45 seconds to keep data fresh across subdomains
    profileSyncInterval = setInterval(() => {
        if (currentUser && document.visibilityState === 'visible') {
            loadUserProfile().catch(err => console.log("Background sync skipped:", err));
            updatePresenceHeartbeat();
        }
    }, 45000);

    // Refresh profile immediately when page becomes visible (user switches back to tab/window)
    document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'visible' && currentUser) {
            loadUserProfile().catch(err => console.log("Visibility sync skipped:", err));
            updatePresenceHeartbeat();
        }
    });

    window.addEventListener('focus', () => {
        if (currentUser) {
            updatePresenceHeartbeat();
        }
    });
}

async function runPostProfileHydrationTasks(loadedProfile, options = {}) {
    if (!currentUser || !loadedProfile) return false;
    if (lastServerHydratedProfileUid !== currentUser.uid) {
        if (options.logPending) {
            console.warn("Profile hydration pending; delaying login rewards and broad stat sync.");
        }
        return false;
    }

    await initializeDailyLogin();
    await ensureLoginStreakRewards();
    await claimGlobalCladoselacheParticipationCrate({ silentIfUnavailable: true });
    syncStatsToFirebase();
    return true;
}

async function updateAuthUI() {
    const authContainer = document.getElementById("auth-container");
    const loginWarning = document.getElementById("login-warning");
    const loginBtn = document.getElementById("login-btn");

    if (currentUser) {
        // User is logged in
        if (loginWarning) loginWarning.classList.add("hidden");
        if (loginBtn) loginBtn.style.display = "none";
        updatePresenceHeartbeat();

        // Load user profile - need to await so redeemed codes and login streak load first
        const loadedProfile = await loadUserProfile();
        scheduleCloudProfileReloads();
        // Initialize daily login only after a server-confirmed profile load.
        await runPostProfileHydrationTasks(loadedProfile, { logPending: true });
        updateSpinWheelUI();
        const legacyProfileBtn = document.getElementById("profile-btn-nav");
        if (legacyProfileBtn) legacyProfileBtn.remove();
    } else {
        // User is logged out
        if (loginWarning) loginWarning.classList.remove("hidden");
        if (loginBtn) loginBtn.style.display = "block";
        clearPendingProfileSyncTimeout();
        clearCloudProfileReloadTimeouts();

        const profileBtn = document.getElementById("profile-btn-nav");
        if (profileBtn) {
            profileBtn.remove();
        }
        closeAdminAbuseModal();
        // DO NOT clear userProfile
    }


    // Always update index stats from localStorage
    if (authContainer) {
        updateIndexStats();
    }
    ensureAdminAbuseVisibility();
    renderCratesButton();
    ensureXpEventBannerTimer();
    ensureCommunityBossUiTimer();
    renderCommunityBossPanel();
    if (typeof renderConsumablesPage === "function") {
        renderConsumablesPage();
    }
    if (typeof ensureConsumablesPageTimer === "function") {
        ensureConsumablesPageTimer();
    }

    // Always refresh friends tab when profile is open and friends view is active
    const profileModal = document.getElementById('profileModal');
    const friendsTab = document.getElementById('friends-tab');
    if (profileModal && !profileModal.classList.contains('hidden') && friendsTab && friendsTab.style.display !== 'none') {
        populateFriendsTab();
    }

    if (window.loadAndDisplayAchievements) {
        window.loadAndDisplayAchievements();
    }

    // Update daily bonus message
    const bonusMsg = document.getElementById("daily-bonus-msg");
    if (bonusMsg) {
        if (currentUser) {
            const currentLoginDay = parseInt(localStorage.getItem("currentLoginDay")) || 1;
            const streak = parseInt(localStorage.getItem("loginStreak")) || 1;
            bonusMsg.style.display = "block";
            bonusMsg.style.cursor = "pointer";
            bonusMsg.onclick = () => openDailyLoginModal();
            const cycleNumber = Math.floor((currentLoginDay - 1) / 7) + 1;
            const cycleEndDay = cycleNumber * 7;
            bonusMsg.innerHTML = `\u{1F525} Login Streak: <strong>${streak} days</strong> - Day ${currentLoginDay}/${cycleEndDay} (Click to view rewards)`;
        } else {
            bonusMsg.style.display = "none";
        }
    } else {
    }

    updateSpinWheelUI();

    // Update streak display
    const existingStreak = document.getElementById("streak-display");
    if (existingStreak) {
        existingStreak.remove();
    }
    if (currentUser) {
        const streak = parseInt(localStorage.getItem("loginStreak")) || 1;
        if (streak > 0) {
            const streakDisplay = document.createElement("div");
            streakDisplay.id = "streak-display";
            streakDisplay.style.cssText = `
                text-align: center;
                padding: 15px 20px;
                color: #4dd0e1;
                font-weight: 600;
                font-size: 16px;
                margin-top: 10px;
                border-radius: 8px;
                border: 2px solid #ff6b6b;
                background: rgba(255, 107, 107, 0.05);
            `;
            streakDisplay.innerHTML = `\u{1F525} <span style="color: #ff6b6b;">${streak} days</span> on fire!`;
            const statsSection = document.querySelector(".stats");
            if (statsSection) {
                statsSection.parentElement.insertBefore(streakDisplay, statsSection);
            }
        }
    }
}

function isDefaultEmailUsername(username) {
    if (!currentUser?.email || !username) return false;
    return username === currentUser.email.split("@")[0];
}

function hasMeaningfulProfileData(profile) {
    if (!profile || typeof profile !== 'object') return false;
    const crateInventory = normalizeCrateInventory(profile.crateInventory);
    const hasAnyCrates = Object.values(crateInventory).some(count => count > 0);
    const hasUnlockedBadges = Array.isArray(profile.unlockedBadges) && profile.unlockedBadges.some(id => id && id !== "starter");
    const hasUnlockedThemes = Array.isArray(profile.unlockedCardThemes) && profile.unlockedCardThemes.some(id => id && id !== "default");
    const hasSharkPassMissionClaims = Boolean(profile.sharkPassMissionClaims && Object.keys(profile.sharkPassMissionClaims).length);
    const hasSharkPassSeasonBaselines = Boolean(profile.sharkPassSeasonBaselines && Object.keys(profile.sharkPassSeasonBaselines).length);
    const hasCommunityBossRewards = Boolean(profile.communityBossRewards && Object.keys(profile.communityBossRewards).length);
    return Boolean(
        profile.totalXP ||
        profile.gamesPlayed ||
        profile.games ||
        profile.wins ||
        profile.losses ||
        profile.totalGuesses ||
        profile.duelGames ||
        profile.duelWins ||
        profile.loginStreak ||
        profile.currentLoginDay ||
        normalizeStoredDateValue(profile.lastLoginDate) ||
        hasAnyCrates ||
        profile.cratesOpened ||
        getCratesSinceLegendary(profile) ||
        getStreakShieldCount(profile) ||
        getPearlCount(profile) ||
        getPearlBoostExpiresAt(profile) ||
        getCrateInstantOpenEnabled(profile) ||
        Object.keys(getSeasonXpBoosts(profile)).length ||
        (Array.isArray(profile.earnedCosmetics) && profile.earnedCosmetics.length) ||
        hasUnlockedBadges ||
        hasUnlockedThemes ||
        (Array.isArray(profile.unlockedTitles) && profile.unlockedTitles.length) ||
        (Array.isArray(profile.unlockedAchievements) && profile.unlockedAchievements.length) ||
        (Array.isArray(profile.claimedAchievements) && profile.claimedAchievements.length) ||
        (Array.isArray(profile.redeemedCodes) && profile.redeemedCodes.length) ||
        hasSharkPassMissionClaims ||
        hasSharkPassSeasonBaselines ||
        (Array.isArray(profile.sharkPassLevelRewardClaims) && profile.sharkPassLevelRewardClaims.length) ||
        hasCommunityBossRewards ||
        (profile.equippedTitle && profile.equippedTitle !== "") ||
        (profile.username && !isDefaultEmailUsername(profile.username)) ||
        (profile.profilePicture && profile.profilePicture !== "images/pfp/shark1.png")
    );
}

function hasPersistedProfileIdentity(profile) {
    if (!profile || typeof profile !== 'object') return false;
    const crateInventory = normalizeCrateInventory(profile.crateInventory);
    const hasAnyCrates = Object.values(crateInventory).some(count => count > 0);
    return Boolean(
        (profile.username && !isDefaultEmailUsername(profile.username)) ||
        (profile.profilePicture && profile.profilePicture !== "images/pfp/shark1.png") ||
        (profile.profilePic && profile.profilePic !== "images/pfp/shark1.png") ||
        (profile.equippedBadge && profile.equippedBadge !== "starter") ||
        (profile.equippedCardTheme && profile.equippedCardTheme !== "default") ||
        hasAnyCrates ||
        profile.cratesOpened ||
        getCratesSinceLegendary(profile) ||
        getStreakShieldCount(profile) ||
        getPearlCount(profile) ||
        getPearlBoostExpiresAt(profile) ||
        getCrateInstantOpenEnabled(profile) ||
        Object.keys(getSeasonXpBoosts(profile)).length ||
        (profile.equippedTitle && profile.equippedTitle !== "") ||
        (Array.isArray(profile.earnedCosmetics) && profile.earnedCosmetics.length) ||
        (Array.isArray(profile.unlockedTitles) && profile.unlockedTitles.length) ||
        (Array.isArray(profile.unlockedBadges) && profile.unlockedBadges.some(id => id && id !== "starter")) ||
        (Array.isArray(profile.unlockedCardThemes) && profile.unlockedCardThemes.some(id => id && id !== "default")) ||
        (Array.isArray(profile.unlockedAchievements) && profile.unlockedAchievements.length) ||
        (Array.isArray(profile.claimedAchievements) && profile.claimedAchievements.length) ||
        (Array.isArray(profile.redeemedCodes) && profile.redeemedCodes.length) ||
        Boolean(profile.sharkPassMissionClaims && Object.keys(profile.sharkPassMissionClaims).length) ||
        Boolean(profile.sharkPassSeasonBaselines && Object.keys(profile.sharkPassSeasonBaselines).length) ||
        (Array.isArray(profile.sharkPassLevelRewardClaims) && profile.sharkPassLevelRewardClaims.length) ||
        Boolean(profile.communityBossRewards && Object.keys(profile.communityBossRewards).length)
    );
}

function hasRecoverableRemoteProfile(profile) {
    return hasMeaningfulProfileData(profile) || hasPersistedProfileIdentity(profile);
}

function maxNumeric(a, b) {
    return Math.max(Number(a) || 0, Number(b) || 0);
}

function getProfileRecoveryScore(profile = {}) {
    if (!profile || typeof profile !== "object") return 0;
    const numericKeys = [
        "totalXP", "gamesPlayed", "wins", "losses", "totalGuesses", "duelGames", "duelWins",
        "games", "xp", "experience",
        "cratesOpened", "cratesSinceLegendary", "pearls", "tidePearls", "streakShields",
        "loginStreak", "currentLoginDay", "sharkPassXP"
    ];
    const numericScore = numericKeys.reduce((sum, key) => sum + Math.min(10000, Math.max(0, Number(profile[key]) || 0)), 0);
    const arrayKeys = [
        "earnedCosmetics", "unlockedBadges", "unlockedCardThemes", "unlockedTitles",
        "claimedAchievements", "unlockedAchievements", "showcasedAchievements",
        "redeemedCodes", "sharkPassLevelRewardClaims"
    ];
    const arrayScore = arrayKeys.reduce((sum, key) => sum + (Array.isArray(profile[key]) ? profile[key].length * 150 : 0), 0);
    const objectKeys = ["lostTreasures", "sharkPassMissionClaims", "sharkPassSeasonBaselines", "communityBossRewards", "referralRewards"];
    const objectScore = objectKeys.reduce((sum, key) => {
        const value = profile[key];
        return sum + (value && typeof value === "object" ? Object.keys(value).length * 120 : 0);
    }, 0);
    const identityScore = hasPersistedProfileIdentity(profile) ? 500 : 0;
    return numericScore + arrayScore + objectScore + identityScore;
}

function shouldReplaceProfileBackup(incomingProfile = {}, existingBackup = {}, incomingScore = getProfileRecoveryScore(incomingProfile), backupScore = getProfileRecoveryScore(existingBackup)) {
    const incomingCrateUpdatedAt = getCrateInventoryUpdatedAt(incomingProfile);
    const backupCrateUpdatedAt = getCrateInventoryUpdatedAt(existingBackup);
    return incomingScore >= backupScore || !backupScore || incomingCrateUpdatedAt > backupCrateUpdatedAt;
}

function getProfileTotalXPValue(profile = {}) {
    const explicitTotal = Number(profile.totalXP);
    if (Number.isFinite(explicitTotal) && explicitTotal > 0) return explicitTotal;

    const legacyTotal = Number(profile.xp ?? profile.experience ?? profile.totalGuesses);
    if (Number.isFinite(legacyTotal) && legacyTotal > 0) return legacyTotal;

    const level = Math.max(1, Math.floor(Number(profile.currentLevel) || Number(profile.level) || 1));
    const currentXP = Math.max(0, Math.floor(Number(profile.currentXP) || Number(profile.xpInLevel) || 0));
    if (level > 1 && typeof getXPForLevel === "function") {
        return getXPForLevel(level) + currentXP;
    }

    return 0;
}

function getProfileSharkPassXPValue(profile = {}) {
    const explicitPassXP = Number(profile.sharkPassXP);
    if (Number.isFinite(explicitPassXP) && explicitPassXP > 0) return explicitPassXP;

    const level = Math.max(0, Math.floor(Number(profile.sharkPassLevel ?? profile.passLevel ?? profile.currentLevel ?? profile.level) || 0));
    const currentXP = Math.max(0, Math.floor(Number(profile.sharkPassCurrentXP ?? profile.currentXP ?? profile.xpInLevel) || 0));
    if (level > 0 && typeof getXPForLevel === "function") {
        return getXPForLevel(level) + currentXP;
    }

    return 0;
}

function getPreferredUsernameStorageKey() {
    if (!currentUser?.uid) return null;
    return `preferredUsername_${currentUser.uid}`;
}

function getScopedUserProfileStorageKey(uid = null) {
    const effectiveUid = uid || currentUser?.uid;
    return effectiveUid ? `userProfile_${effectiveUid}` : null;
}

function getScopedUserProfileBackupKey(uid = null) {
    const effectiveUid = uid || currentUser?.uid;
    return effectiveUid ? `userProfileBackup_${effectiveUid}` : null;
}

function getDailyLoginModalShownStorageKey(uid = null) {
    const effectiveUid = uid || currentUser?.uid;
    return effectiveUid ? `dailyLoginModalShownToday_${effectiveUid}` : "dailyLoginModalShownToday";
}

function getStoredDailyLoginModalShownDate(uid = null) {
    return localStorage.getItem(getDailyLoginModalShownStorageKey(uid)) || "";
}

function normalizeLoginProgress(source = {}) {
    const normalized = {
        loginStreak: Math.max(0, Math.floor(Number(source.loginStreak) || 0)),
        currentLoginDay: Math.max(0, Math.floor(Number(source.currentLoginDay) || 0)),
        lastLoginDate: normalizeStoredDateValue(source.lastLoginDate),
        dailyLoginModalShownToday: normalizeStoredDateValue(source.dailyLoginModalShownToday)
    };
    return normalized;
}

function getLoginProgressFromLocalStorage(uid = null) {
    return normalizeLoginProgress({
        loginStreak: localStorage.getItem("loginStreak"),
        currentLoginDay: localStorage.getItem("currentLoginDay"),
        lastLoginDate: localStorage.getItem("lastLoginDate"),
        dailyLoginModalShownToday: getStoredDailyLoginModalShownDate(uid)
    });
}

function mergeLoginProgress(localProgress = {}, remoteProgress = {}) {
    const local = normalizeLoginProgress(localProgress);
    const remote = normalizeLoginProgress(remoteProgress);
    const localDate = local.lastLoginDate;
    const remoteDate = remote.lastLoginDate;
    let preferred = null;

    if (localDate && remoteDate) {
        const dateDiff = getCalendarDayDifference(localDate, remoteDate);
        if (Number.isFinite(dateDiff) && dateDiff > 0) preferred = remote;
        if (Number.isFinite(dateDiff) && dateDiff < 0) preferred = local;
    } else if (localDate) {
        preferred = local;
    } else if (remoteDate) {
        preferred = remote;
    }

    const latestLoginDate = preferred?.lastLoginDate || [localDate, remoteDate].filter(Boolean).sort().pop() || "";
    const latestModalShownDate = [local.dailyLoginModalShownToday, remote.dailyLoginModalShownToday]
        .filter(Boolean)
        .sort()
        .pop() || "";
    const fallbackProgress = preferred === local ? remote : local;

    return {
        loginStreak: preferred ? (preferred.loginStreak || fallbackProgress.loginStreak || 0) : Math.max(local.loginStreak, remote.loginStreak),
        currentLoginDay: preferred ? (preferred.currentLoginDay || fallbackProgress.currentLoginDay || 0) : Math.max(local.currentLoginDay, remote.currentLoginDay),
        lastLoginDate: latestLoginDate,
        dailyLoginModalShownToday: latestModalShownDate
    };
}

function storeLoginProgressLocally(progress = {}, uid = null) {
    const normalized = normalizeLoginProgress(progress);
    if (normalized.loginStreak > 0) {
        localStorage.setItem("loginStreak", String(normalized.loginStreak));
    }
    if (normalized.currentLoginDay > 0) {
        localStorage.setItem("currentLoginDay", String(normalized.currentLoginDay));
    }
    if (normalized.lastLoginDate) {
        localStorage.setItem("lastLoginDate", normalized.lastLoginDate);
    }
    const modalStorageKey = getDailyLoginModalShownStorageKey(uid);
    if (normalized.dailyLoginModalShownToday) {
        localStorage.setItem(modalStorageKey, normalized.dailyLoginModalShownToday);
    }
    return normalized;
}

function buildLoginProgressSyncPayload(progress = {}) {
    const normalized = normalizeLoginProgress(progress);
    return {
        loginStreak: normalized.loginStreak,
        currentLoginDay: normalized.currentLoginDay,
        lastLoginDate: normalized.lastLoginDate,
        dailyLoginModalShownToday: normalized.dailyLoginModalShownToday
    };
}

function loginProgressDiffers(remoteData = {}, mergedProgress = {}) {
    const remote = normalizeLoginProgress(remoteData);
    const merged = normalizeLoginProgress(mergedProgress);
    return remote.loginStreak !== merged.loginStreak
        || remote.currentLoginDay !== merged.currentLoginDay
        || remote.lastLoginDate !== merged.lastLoginDate
        || remote.dailyLoginModalShownToday !== merged.dailyLoginModalShownToday;
}

function getLocalDateKey(dateValue = new Date()) {
    const date = dateValue instanceof Date ? dateValue : new Date(dateValue);
    if (Number.isNaN(date.getTime())) return "";
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const day = String(date.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
}

function parseDateLikeValue(rawValue) {
    if (rawValue === null || rawValue === undefined || rawValue === "") return null;

    if (rawValue instanceof Date) {
        return Number.isNaN(rawValue.getTime()) ? null : rawValue;
    }

    if (typeof rawValue === "number" && Number.isFinite(rawValue)) {
        const numericDate = new Date(rawValue);
        return Number.isNaN(numericDate.getTime()) ? null : numericDate;
    }

    if (typeof rawValue === "object") {
        if (typeof rawValue.toDate === "function") {
            const timestampDate = rawValue.toDate();
            return timestampDate instanceof Date && !Number.isNaN(timestampDate.getTime()) ? timestampDate : null;
        }
        if (typeof rawValue.seconds === "number") {
            const millis = rawValue.seconds * 1000 + Math.floor((rawValue.nanoseconds || 0) / 1000000);
            const timestampDate = new Date(millis);
            return Number.isNaN(timestampDate.getTime()) ? null : timestampDate;
        }
        if (typeof rawValue._seconds === "number") {
            const millis = rawValue._seconds * 1000 + Math.floor((rawValue._nanoseconds || 0) / 1000000);
            const timestampDate = new Date(millis);
            return Number.isNaN(timestampDate.getTime()) ? null : timestampDate;
        }
        const objectString = typeof rawValue.toString === "function" ? rawValue.toString() : "";
        if (!objectString || objectString === "[object Object]") return null;
        return parseDateLikeValue(objectString);
    }

    if (typeof rawValue !== "string") return null;
    const value = rawValue.trim();
    if (!value || value === "[object Object]" || value.toLowerCase() === "invalid date") return null;

    if (/^\d{4}-\d{2}-\d{2}$/.test(value)) {
        const [year, month, day] = value.split("-").map(Number);
        return new Date(year, month - 1, day);
    }

    if (/^\d+$/.test(value)) {
        let asNumber = Number(value);
        // Treat 10-digit unix timestamps as seconds.
        if (value.length <= 10) {
            asNumber *= 1000;
        }
        if (Number.isFinite(asNumber)) {
            const numericDate = new Date(asNumber);
            if (!Number.isNaN(numericDate.getTime())) {
                return numericDate;
            }
        }
    }

    const parsedDate = new Date(value);
    return Number.isNaN(parsedDate.getTime()) ? null : parsedDate;
}

function normalizeStoredDateValue(rawValue) {
    const parsedDate = parseDateLikeValue(rawValue);
    return parsedDate ? getLocalDateKey(parsedDate) : "";
}

function normalizeStoredUtcDateValue(rawValue) {
    if (typeof rawValue === "string") {
        const value = rawValue.trim();
        if (/^\d{4}-\d{2}-\d{2}$/.test(value)) {
            return value;
        }
    }
    const parsedDate = parseDateLikeValue(rawValue);
    if (!parsedDate) return "";
    const year = parsedDate.getUTCFullYear();
    const month = String(parsedDate.getUTCMonth() + 1).padStart(2, "0");
    const day = String(parsedDate.getUTCDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
}

function getCalendarDayDifference(fromDateKey, toDateKey) {
    if (!fromDateKey || !toDateKey) return NaN;
    const fromDate = parseDateLikeValue(fromDateKey);
    const toDate = parseDateLikeValue(toDateKey);
    if (!fromDate || !toDate) return NaN;
    const fromUtc = Date.UTC(fromDate.getFullYear(), fromDate.getMonth(), fromDate.getDate());
    const toUtc = Date.UTC(toDate.getFullYear(), toDate.getMonth(), toDate.getDate());
    return Math.round((toUtc - fromUtc) / 86400000);
}

function getLocalMonthKey(dateValue = new Date()) {
    const normalizedDate = normalizeStoredDateValue(dateValue);
    return normalizedDate ? normalizedDate.slice(0, 7) : "";
}

function getUtcDateKey(dateValue = new Date()) {
    const date = dateValue instanceof Date ? dateValue : new Date(dateValue);
    if (Number.isNaN(date.getTime())) return "";
    const year = date.getUTCFullYear();
    const month = String(date.getUTCMonth() + 1).padStart(2, "0");
    const day = String(date.getUTCDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
}

function getUtcMonthKey(dateValue = new Date()) {
    const utcDateKey = getUtcDateKey(dateValue);
    return utcDateKey ? utcDateKey.slice(0, 7) : "";
}

function normalizeStoredMonthValue(rawValue) {
    if (typeof rawValue === "string" && /^\d{4}-\d{2}$/.test(rawValue.trim())) {
        return rawValue.trim();
    }
    const normalizedDate = normalizeStoredDateValue(rawValue);
    return normalizedDate ? normalizedDate.slice(0, 7) : "";
}

function normalizeStoredUtcMonthValue(rawValue) {
    if (typeof rawValue === "string") {
        const value = rawValue.trim();
        if (/^\d{4}-\d{2}$/.test(value)) return value;
        if (/^\d{4}-\d{2}-\d{2}$/.test(value)) return value.slice(0, 7);
    }
    const normalizedDate = normalizeStoredUtcDateValue(rawValue);
    return normalizedDate ? normalizedDate.slice(0, 7) : "";
}

function incrementProfilePeriodWins(profileData, nowValue = new Date()) {
    if (!profileData || typeof profileData !== "object") return profileData;
    const todayKey = getUtcDateKey(nowValue);
    const monthKey = getUtcMonthKey(nowValue);
    const existingDailyKey = normalizeStoredUtcDateValue(profileData.dailyWinsUtcDate || profileData.dailyWinsDate);
    const existingMonthlyKey = normalizeStoredUtcMonthValue(profileData.monthlyWinsUtcKey || profileData.monthlyWinsKey);
    const dailyBase = existingDailyKey === todayKey ? (Number(profileData.dailyWins) || 0) : 0;
    const monthlyBase = existingMonthlyKey === monthKey ? (Number(profileData.monthlyWins) || 0) : 0;

    profileData.dailyWins = dailyBase + 1;
    profileData.dailyWinsDate = todayKey;
    profileData.dailyWinsUtcDate = todayKey;
    profileData.monthlyWins = monthlyBase + 1;
    profileData.monthlyWinsKey = monthKey;
    profileData.monthlyWinsUtcKey = monthKey;
    profileData.winPeriodVersion = 2;
    return profileData;
}

async function getUserStatsSnapshot(statsRef) {
    try {
        const snapshot = await statsRef.get({ source: "server" });
        return { snapshot, fromServer: true };
    } catch (error) {
        console.warn("Falling back to cached userStats snapshot:", error);
        const snapshot = await statsRef.get();
        return { snapshot, fromServer: false };
    }
}

async function findRecoverableUserStatsByEmail(authUser) {
    const rawEmail = String(authUser?.email || "").trim();
    const normalizedEmail = rawEmail.toLowerCase();
    if (!authUser || !rawEmail || !db) return null;

    try {
        let bestMatch = null;
        const checkedEmails = [...new Set([rawEmail, normalizedEmail])];
        for (const email of checkedEmails) {
            const snapshot = await db.collection("userStats")
                .where("email", "==", email)
                .limit(10)
                .get();
            snapshot.forEach(doc => {
                if (doc.id === authUser.uid) return;
                const data = doc.data() || {};
                if (!hasRecoverableRemoteProfile(data)) return;
                const score = getProfileRecoveryScore(data);
                if (!bestMatch || score > bestMatch.score) {
                    bestMatch = { id: doc.id, data, score };
                }
            });
        }
        return bestMatch;
    } catch (error) {
        console.warn("Unable to look up existing profile by email:", error);
        return null;
    }
}

async function migrateUserStatsDocumentToAuthUser(authUser, sourceProfile) {
    if (!authUser || !sourceProfile?.data || !db) return null;
    const migratedProfile = {
        ...sourceProfile.data,
        uid: authUser.uid,
        email: authUser.email || sourceProfile.data.email || "",
        migratedFromUid: sourceProfile.id,
        migratedAt: new Date(),
        lastUpdated: sourceProfile.data.lastUpdated || new Date()
    };
    await db.collection("userStats").doc(authUser.uid).set(migratedProfile, { merge: true });
    return migratedProfile;
}

function cloneProfileForFullCloud(profile = {}) {
    try {
        const cloned = JSON.parse(JSON.stringify(profile || {}));
        return cloned && typeof cloned === "object" ? cloned : {};
    } catch (error) {
        return { ...(profile || {}) };
    }
}

function buildFullUserProfileCloudPayload(profileData = {}, authUser = currentUser) {
    const updatedAtMs = Date.now();
    const profile = cloneProfileForFullCloud(profileData);
    profile.uid = authUser?.uid || profile.uid || "";
    profile.email = authUser?.email || profile.email || "";
    profile.profilePicture = profile.profilePicture || profile.profilePic || "images/pfp/shark1.png";
    profile.profilePic = profile.profilePicture;
    profile.lastUpdated = getProfileTimestampMs(profile.lastUpdated) || updatedAtMs;
    profile.fullProfileCloudUpdatedAtMs = updatedAtMs;

    const profileJson = JSON.stringify(profile);
    const chunks = [];
    for (let index = 0; index < profileJson.length; index += FULL_PROFILE_CHUNK_CHAR_LIMIT) {
        chunks.push(profileJson.slice(index, index + FULL_PROFILE_CHUNK_CHAR_LIMIT));
    }

    return {
        metadata: {
            uid: profile.uid,
            email: profile.email,
            schemaVersion: FULL_PROFILE_SCHEMA_VERSION,
            chunkCount: chunks.length,
            profileLength: profileJson.length,
            profileRecoveryScore: getProfileRecoveryScore(profile),
            totalXP: Number(profile.totalXP) || 0,
            gamesPlayed: Number(profile.gamesPlayed ?? profile.games) || 0,
            wins: Number(profile.wins) || 0,
            fullProfileCloudUpdatedAtMs: updatedAtMs,
            updatedAtMs
        },
        chunks
    };
}

async function getFullUserProfileSnapshot(profileRef) {
    try {
        const snapshot = await profileRef.get({ source: "server" });
        return { snapshot, fromServer: true };
    } catch (error) {
        console.warn("Falling back to cached full profile snapshot:", error);
        const snapshot = await profileRef.get();
        return { snapshot, fromServer: false };
    }
}

async function readFullUserProfileFromFirebase(authUser) {
    if (!db || !authUser?.uid) return { profile: null, fromServer: false };
    try {
        const profileRef = db.collection(FULL_PROFILE_COLLECTION).doc(authUser.uid);
        const { snapshot, fromServer } = await getFullUserProfileSnapshot(profileRef);
        if (!snapshot.exists) return { profile: null, fromServer };

        const metadata = snapshot.data() || {};
        const chunkCount = Math.min(200, Math.max(0, Math.floor(Number(metadata.chunkCount) || 0)));
        if (!chunkCount) return { profile: null, fromServer };

        const chunkRefs = Array.from({ length: chunkCount }, (_, index) =>
            profileRef.collection(FULL_PROFILE_CHUNK_COLLECTION).doc(`chunk_${String(index).padStart(4, "0")}`)
        );
        const chunkSnapshots = await Promise.all(chunkRefs.map(ref => ref.get()));
        const profileJson = chunkSnapshots
            .map((doc, index) => ({
                index,
                data: doc.exists && typeof doc.data()?.data === "string" ? doc.data().data : ""
            }))
            .sort((a, b) => a.index - b.index)
            .map(chunk => chunk.data)
            .join("");

        if (!profileJson) return { profile: null, fromServer };
        const profile = JSON.parse(profileJson);
        if (!profile || typeof profile !== "object") return { profile: null, fromServer };

        profile.uid = authUser.uid;
        profile.email = authUser.email || profile.email || "";
        profile.fullProfileCloudUpdatedAtMs = Number(metadata.fullProfileCloudUpdatedAtMs) || 0;
        return { profile, fromServer };
    } catch (error) {
        console.warn("Unable to read full cloud profile:", error);
        return { profile: null, fromServer: false };
    }
}

async function syncFullUserProfileToFirebase(profileData = getBestLocalProfile()) {
    if (!db || typeof firebase === "undefined" || typeof firebase.auth !== "function") return false;
    const authUser = firebase.auth().currentUser;
    if (!authUser || !profileData || typeof profileData !== "object") return false;
    if (currentUser && currentUser.uid !== authUser.uid) return false;

    try {
        const profileRef = db.collection(FULL_PROFILE_COLLECTION).doc(authUser.uid);
        const { metadata, chunks } = buildFullUserProfileCloudPayload(profileData, authUser);
        const batch = db.batch();
        batch.set(profileRef, {
            ...metadata,
            updatedAt: firebase.firestore.FieldValue.serverTimestamp()
        }, { merge: false });
        chunks.forEach((data, index) => {
            batch.set(
                profileRef.collection(FULL_PROFILE_CHUNK_COLLECTION).doc(`chunk_${String(index).padStart(4, "0")}`),
                {
                    index,
                    data,
                    updatedAtMs: metadata.updatedAtMs,
                    updatedAt: firebase.firestore.FieldValue.serverTimestamp()
                },
                { merge: false }
            );
        });
        await batch.commit();
        return true;
    } catch (error) {
        console.warn("Unable to sync full cloud profile:", error);
        return false;
    }
}

function getStoredPreferredUsername() {
    const key = getPreferredUsernameStorageKey();
    if (!key) return "";
    return localStorage.getItem(key) || "";
}

function cachePreferredUsername(username, uidOverride = null) {
    const effectiveUid = uidOverride || currentUser?.uid;
    if (!effectiveUid || !username) return;
    if (currentUser?.email && username === currentUser.email.split("@")[0]) return;
    localStorage.setItem(`preferredUsername_${effectiveUid}`, username);
}

function scheduleRemoteProfileSync(delayMs = 150) {
    if (typeof firebase === "undefined" || typeof firebase.auth !== "function") return;
    const authUser = firebase.auth().currentUser;
    if (!authUser || !db || typeof syncStatsToFirebase !== "function") return;
    if (currentUser && currentUser.uid !== authUser.uid) return;
    if (pendingProfileSyncTimeout) {
        clearTimeout(pendingProfileSyncTimeout);
    }
    pendingProfileSyncTimeout = setTimeout(() => {
        pendingProfileSyncTimeout = null;
        syncStatsToFirebase().catch(error => console.warn("Deferred profile sync failed:", error));
    }, delayMs);
}

function saveUserProfileLocally(profileData, options = {}) {
    if (!profileData || typeof profileData !== "object") return;
    const parseStoredProfile = raw => {
        try {
            const parsed = JSON.parse(raw || "{}");
            return parsed && typeof parsed === "object" ? parsed : {};
        } catch (error) {
            return {};
        }
    };
    if (currentUser?.uid) {
        profileData.uid = currentUser.uid;
        if (currentUser.email && !profileData.email) {
            profileData.email = currentUser.email;
        }
    }
    retireSummerCrates(profileData);
    if (options.preserveLastUpdated) {
        if (!profileData.lastUpdated) profileData.lastUpdated = Date.now();
    } else {
        profileData.lastUpdated = Date.now();
    }
    if (profileData.profilePicture && !profileData.profilePic) {
        profileData.profilePic = profileData.profilePicture;
    }
    if (profileData.profilePic && !profileData.profilePicture) {
        profileData.profilePicture = profileData.profilePic;
    }
    const safeProfilePic = sanitizeProfilePicturePath(
        profileData.profilePicture || profileData.profilePic,
        (profileData.profilePicture || profileData.profilePic) ? "images/pfp/shark1.png" : ""
    );
    if (safeProfilePic) {
        profileData.profilePicture = safeProfilePic;
        profileData.profilePic = safeProfilePic;
    }
    if (profileData.username) {
        cachePreferredUsername(profileData.username, profileData.uid);
    }
    profileData.crateInventory = normalizeCrateInventory(profileData.crateInventory);
    profileData.crateInventoryUpdatedAt = getCrateInventoryUpdatedAt(profileData);
    profileData.cratesOpened = Math.max(0, Number(profileData.cratesOpened) || 0);
    profileData.cratesSinceLegendary = getCratesSinceLegendary(profileData);
    profileData.streakShields = getStreakShieldCount(profileData);
    profileData.dailySpinBonusSpins = normalizeDailySpinBonusCount(profileData.dailySpinBonusSpins);
    profileData.instantCrateOpen = getCrateInstantOpenEnabled(profileData);
    profileData.pearlBoostExpiresAt = getPearlBoostExpiresAt(profileData);
    profileData.seasonXpBoosts = getSeasonXpBoosts(profileData);
    setPearlCount(profileData, getPearlCount(profileData));
    profileData.earnedCosmetics = removeLegacyWheelSharkCosmetics(profileData.earnedCosmetics);
    if (!Array.isArray(profileData.unlockedBadges)) profileData.unlockedBadges = ["starter"];
    profileData.unlockedBadges = [...new Set(["starter", ...profileData.unlockedBadges.map(normalizeBadgeId)])];
    profileData.currentLossStreak = Math.max(0, Number(profileData.currentLossStreak) || 0);
    if (!Array.isArray(profileData.unlockedCardThemes)) profileData.unlockedCardThemes = ["default"];
    if (!Array.isArray(profileData.unlockedTitles)) profileData.unlockedTitles = [];
    if (!Array.isArray(profileData.claimedAchievements)) profileData.claimedAchievements = [];
    if (!Array.isArray(profileData.unlockedAchievements)) profileData.unlockedAchievements = [];
    if (!Array.isArray(profileData.showcasedAchievements)) profileData.showcasedAchievements = [];
    profileData.showcasedAchievements = getProfileShowcasedAchievementIds(profileData);
    if (!Array.isArray(profileData.sharkPassLevelRewardClaims)) profileData.sharkPassLevelRewardClaims = [];
    normalizeSharkPassProgressForActiveSeason(profileData);
    sanitizeCurrentSharkPassUnlocks(profileData);
    profileData.lostTreasures = mergeLostTreasuresStates(profileData, {});
    if (!Array.isArray(profileData.redeemedCodes)) profileData.redeemedCodes = getRedeemedCodes();
    if (!profileData.communityBossRewards || typeof profileData.communityBossRewards !== "object") {
        profileData.communityBossRewards = {};
    }
    if (!profileData.referralRewards || typeof profileData.referralRewards !== "object") {
        profileData.referralRewards = {};
    }
    setClaimedSocialRewards(profileData, profileData.socialRewardsClaimed);
    if (!profileData.sharkPassMissionClaims || typeof profileData.sharkPassMissionClaims !== "object") {
        profileData.sharkPassMissionClaims = {};
    }
    if (!profileData.sharkPassSeasonBaselines || typeof profileData.sharkPassSeasonBaselines !== "object") {
        profileData.sharkPassSeasonBaselines = {};
    }
    const scopedKey = getScopedUserProfileStorageKey(profileData.uid);
    const scopedBackupKey = getScopedUserProfileBackupKey(profileData.uid);
    const existingGenericBackup = parseStoredProfile(localStorage.getItem("userProfileBackup"));
    const existingScopedBackup = scopedBackupKey ? parseStoredProfile(localStorage.getItem(scopedBackupKey)) : {};
    const incomingScore = getProfileRecoveryScore(profileData);
    const genericBackupScore = getProfileRecoveryScore(existingGenericBackup);
    const scopedBackupScore = getProfileRecoveryScore(existingScopedBackup);
    localStorage.setItem("userProfile", JSON.stringify(profileData));
    if (shouldReplaceProfileBackup(profileData, existingGenericBackup, incomingScore, genericBackupScore)) {
        localStorage.setItem("userProfileBackup", JSON.stringify(profileData));
    }
    if (scopedKey) {
        localStorage.setItem(scopedKey, JSON.stringify(profileData));
    }
    if (scopedBackupKey) {
        if (shouldReplaceProfileBackup(profileData, existingScopedBackup, incomingScore, scopedBackupScore)) {
            localStorage.setItem(scopedBackupKey, JSON.stringify(profileData));
        }
    }
    localStorage.setItem("games", String(profileData.gamesPlayed || 0));
    localStorage.setItem("wins", String(profileData.wins || 0));
    localStorage.setItem("losses", String(profileData.losses || 0));
    if (profileData.totalXP !== undefined) {
        localStorage.setItem("totalXP", String(profileData.totalXP || 0));
    }
    if (profileData.loginStreak !== undefined) {
        localStorage.setItem("loginStreak", String(profileData.loginStreak || 0));
    }
    if (profileData.currentLoginDay !== undefined) {
        localStorage.setItem("currentLoginDay", String(profileData.currentLoginDay || 0));
    }
    if (profileData.lastLoginDate) {
        localStorage.setItem("lastLoginDate", normalizeStoredDateValue(profileData.lastLoginDate) || profileData.lastLoginDate);
    }
    if (profileData.dailyLoginModalShownToday) {
        localStorage.setItem(
            getDailyLoginModalShownStorageKey(profileData.uid),
            normalizeStoredDateValue(profileData.dailyLoginModalShownToday) || profileData.dailyLoginModalShownToday
        );
    }
    localStorage.setItem("claimedAchievements", JSON.stringify(profileData.claimedAchievements));
    localStorage.setItem("unlockedAchievements", JSON.stringify(profileData.unlockedAchievements));
    localStorage.setItem("showcasedAchievements", JSON.stringify(profileData.showcasedAchievements));
    localStorage.setItem("redeemedCodes", JSON.stringify(profileData.redeemedCodes));
    if (!options.skipRemoteSync) {
        scheduleRemoteProfileSync();
    }
}

function showCrateOverlayDuplicateReward(reward, xpAward, crateId = activeCrateUnboxId) {
    const copy = document.getElementById("crate-unbox-copy");
    const reveal = document.getElementById("crate-overlay-reveal");
    const isSeasonal = isSeasonalCrateId(crateId);
    applyCrateUnboxOpeningState(reward);
    if (copy) {
        copy.textContent = isSeasonal
            ? getCrateUnboxCopy(crateId, "duplicate", reward.name)
            : `${reward.name} was a duplicate and converted into XP.`;
    }
    if (reveal) {
        reveal.classList.remove("hidden");
        if (isSeasonal) reveal.classList.add("crate-reveal-seasonal", `crate-reveal-${crateId}`);
        reveal.innerHTML = `
            <div class="crate-reveal-card crate-reveal-card-${reward.rarity}${isSeasonal ? ` crate-reveal-card-seasonal crate-reveal-card-${crateId}` : ""}">
                ${getCrateRewardPreviewMarkup(reward)}
                <div class="crate-reveal-copy">
                    <span class="crate-rarity ${reward.rarity}">${reward.rarity}</span>
                    <h4>${reward.name}</h4>
                    <p>Duplicate reward salvaged for ${xpAward.totalXp} XP.</p>
                </div>
            </div>
        `;
    }
}

window.saveUserProfileLocally = saveUserProfileLocally;

function clearCachedProfileState() {
    clearPendingProfileSyncTimeout();
    lastServerHydratedProfileUid = null;
    localStorage.removeItem("userProfile");
    localStorage.removeItem("userProfileBackup");
    localStorage.removeItem("lastViewedStats");
    localStorage.removeItem("games");
    localStorage.removeItem("wins");
    localStorage.removeItem("losses");
    localStorage.removeItem("totalXP");
    localStorage.removeItem("showcasedAchievements");
    localStorage.removeItem("lastLoginDate");
    localStorage.removeItem("loginStreak");
    localStorage.removeItem("currentLoginDay");
}

function getBestLocalProfile() {
    const scopedPrimaryKey = getScopedUserProfileStorageKey();
    const scopedBackupKey = getScopedUserProfileBackupKey();
    const parseStoredProfile = raw => {
        try {
            const parsed = JSON.parse(raw || "{}");
            return parsed && typeof parsed === "object" ? parsed : {};
        } catch (error) {
            return {};
        }
    };
    const chooseBestCandidate = (...candidates) => {
        return candidates
            .filter(candidate => candidate && typeof candidate === "object" && Object.keys(candidate).length)
            .sort((a, b) => {
                const crateTimestampDelta = getCrateInventoryUpdatedAt(b) - getCrateInventoryUpdatedAt(a);
                if (crateTimestampDelta) return crateTimestampDelta;
                return getProfileRecoveryScore(b) - getProfileRecoveryScore(a);
            })[0] || {};
    };
    const isUsableForCurrentUser = profile => {
        if (!currentUser || !profile || !Object.keys(profile).length) return true;
        if (!profile.uid || profile.uid === currentUser.uid) return true;
        return Boolean(profile.email && currentUser.email && String(profile.email).toLowerCase() === String(currentUser.email).toLowerCase());
    };
    const chooseBestForCurrentUser = candidates => {
        const usable = candidates.filter(isUsableForCurrentUser);
        const meaningful = usable.filter(profile => hasMeaningfulProfileData(profile) || hasPersistedProfileIdentity(profile));
        if (meaningful.length) return chooseBestCandidate(...meaningful);
        if (usable.length) return chooseBestCandidate(...usable);
        return {};
    };
    const hasUnclaimedLocalProgress = profile =>
        !profile?.uid && (hasMeaningfulProfileData(profile) || hasPersistedProfileIdentity(profile));
    const attachProfileToCurrentUser = profile => {
        if (!currentUser || !profile || !Object.keys(profile).length) return profile;
        return {
            ...profile,
            uid: currentUser.uid,
            email: profile.email || currentUser.email || ""
        };
    };

    const scopedPrimary = parseStoredProfile(scopedPrimaryKey ? localStorage.getItem(scopedPrimaryKey) : "{}");
    const scopedBackup = parseStoredProfile(scopedBackupKey ? localStorage.getItem(scopedBackupKey) : "{}");
    const genericPrimary = parseStoredProfile(localStorage.getItem("userProfile"));
    const genericBackup = parseStoredProfile(localStorage.getItem("userProfileBackup"));

    if (currentUser) {
        let selectedProfile = chooseBestForCurrentUser([scopedPrimary, scopedBackup]);
        if (!Object.keys(selectedProfile).length) {
            const genericMatchesCurrentUser =
                genericPrimary?.uid === currentUser.uid || genericBackup?.uid === currentUser.uid;
            const genericHasUnclaimedProgress =
                hasUnclaimedLocalProgress(genericPrimary) || hasUnclaimedLocalProgress(genericBackup);
            if (genericMatchesCurrentUser || genericHasUnclaimedProgress) {
                selectedProfile = chooseBestCandidate(genericPrimary, genericBackup);
            }
        }
        if (selectedProfile?.uid && selectedProfile.uid !== currentUser.uid && !isUsableForCurrentUser(selectedProfile)) {
            return {};
        }
        return attachProfileToCurrentUser(selectedProfile);
    }

    return chooseBestCandidate(genericPrimary, genericBackup);
}

function mergeProfilesSafely(localProfile, firebaseData, options = {}) {
    const preferRemote = Boolean(options.preferRemote);
    const cachedPreferredUsername = getStoredPreferredUsername();
    const fallbackUsername = cachedPreferredUsername || localProfile.username || firebaseData.username || currentUser.email.split("@")[0];
    const preferredUsername = cachedPreferredUsername
        ? cachedPreferredUsername
        : firebaseData.username && !isDefaultEmailUsername(firebaseData.username)
        ? firebaseData.username
        : localProfile.username && !isDefaultEmailUsername(localProfile.username)
            ? localProfile.username
            : fallbackUsername;
    const localUpdatedMs = getProfileTimestampMs(localProfile.lastUpdated);
    const firebaseUpdatedMs = getProfileTimestampMs(firebaseData.lastUpdated);
    const remoteHasRecoverableProfile = hasRecoverableRemoteProfile(firebaseData);
    const localIsCurrentAccountProfile = Boolean(localProfile?.uid && currentUser?.uid && localProfile.uid === currentUser.uid);
    const canPreferLocalOverCloud = !remoteHasRecoverableProfile || localIsCurrentAccountProfile;
    const summerCratesRetired = Math.max(
        Number(localProfile.summerCrateRetirementVersion) || 0,
        Number(firebaseData.summerCrateRetirementVersion) || 0
    ) >= SUMMER_CRATE_RETIREMENT_VERSION;
    const preferRemoteNumber = (localValue, remoteValue) => {
        const remoteNumber = Number(remoteValue);
        if (preferRemote && Number.isFinite(remoteNumber)) return Math.max(0, remoteNumber);
        return maxNumeric(localValue, remoteValue);
    };
    const preferredCrateInventory = mergeCrateInventory(localProfile, firebaseData, summerCratesRetired, { preferRemoteOnTie: preferRemote });
    const preferredCrateInventoryUpdatedAt = Math.max(
        getCrateInventoryUpdatedAt(localProfile),
        getCrateInventoryUpdatedAt(firebaseData)
    );
    const preferredCratesOpened = preferRemoteNumber(localProfile.cratesOpened, firebaseData.cratesOpened);
    const preferredPearls = preferRemoteNumber(localProfile.pearls ?? localProfile.tidePearls, firebaseData.pearls ?? firebaseData.tidePearls);
    const preferredTotalXP = preferRemote && getProfileTotalXPValue(firebaseData) > 0
        ? getProfileTotalXPValue(firebaseData)
        : maxNumeric(getProfileTotalXPValue(localProfile), getProfileTotalXPValue(firebaseData));
    const preferredCurrentLevel = getLevelFromXP(preferredTotalXP);
    const preferredCurrentXP = getXPInCurrentLevel(preferredTotalXP);
    const preferredXPToNextLevel = getXPToNextLevel(preferredTotalXP);
    const preferredCratesSinceLegendary = Math.max(getCratesSinceLegendary(localProfile), getCratesSinceLegendary(firebaseData));
    const preferredInstantCrateOpen = getCrateInstantOpenEnabled(localProfile) || getCrateInstantOpenEnabled(firebaseData);
    const preferredPearlBoostExpiresAt = maxNumeric(localProfile.pearlBoostExpiresAt, firebaseData.pearlBoostExpiresAt);
    const preferredSeasonXpBoosts = {
        ...(localProfile.seasonXpBoosts && typeof localProfile.seasonXpBoosts === "object" ? localProfile.seasonXpBoosts : {}),
        ...(firebaseData.seasonXpBoosts && typeof firebaseData.seasonXpBoosts === "object" ? firebaseData.seasonXpBoosts : {})
    };
    const preferredStreakShields = Math.max(getStreakShieldCount(localProfile), getStreakShieldCount(firebaseData));
    const preferredDailySpinBonusSpins = Math.max(
        normalizeDailySpinBonusCount(localProfile.dailySpinBonusSpins),
        normalizeDailySpinBonusCount(firebaseData.dailySpinBonusSpins)
    );
    const preferLocalProfileFields = canPreferLocalOverCloud && localUpdatedMs > firebaseUpdatedMs;
    const localProfilePic = localProfile.profilePicture || localProfile.profilePic;
    const remoteProfilePic = firebaseData.profilePicture || firebaseData.profilePic;
    const getCustomProfilePic = (path) => {
        const normalized = String(path || "").replace(/\\/g, "/").replace(/^\.?\//, "").toLowerCase();
        return normalized && normalized !== "images/pfp/shark1.png" ? path : "";
    };
    const preferredProfilePic = preferLocalProfileFields
        ? (getCustomProfilePic(localProfilePic) || remoteProfilePic || localProfilePic || "images/pfp/shark1.png")
        : (getCustomProfilePic(remoteProfilePic) || localProfilePic || remoteProfilePic || "images/pfp/shark1.png");
    const preferredAvatar = preferLocalProfileFields
        ? (localProfile.avatar || firebaseData.avatar || "\u{1F988}")
        : (firebaseData.avatar || localProfile.avatar || "\u{1F988}");
    const getCustomValue = (value, defaultValue) => value && value !== defaultValue ? value : "";
    const preferredEquippedBadge = preferLocalProfileFields
        ? (getCustomValue(localProfile.equippedBadge, "starter") || firebaseData.equippedBadge || localProfile.equippedBadge || "starter")
        : (getCustomValue(firebaseData.equippedBadge, "starter") || localProfile.equippedBadge || firebaseData.equippedBadge || "starter");
    const preferredEquippedCardTheme = preferLocalProfileFields
        ? (getCustomValue(localProfile.equippedCardTheme, "default") || firebaseData.equippedCardTheme || localProfile.equippedCardTheme || "default")
        : (getCustomValue(firebaseData.equippedCardTheme, "default") || localProfile.equippedCardTheme || firebaseData.equippedCardTheme || "default");
    const preferredEquippedTitle = preferLocalProfileFields
        ? (localProfile.equippedTitle || firebaseData.equippedTitle || "")
        : (firebaseData.equippedTitle || localProfile.equippedTitle || "");
    const mergedLoginProgress = mergeLoginProgress(getLoginProgressFromLocalStorage(currentUser?.uid), firebaseData);
    const mergedClaimedAchievements = getMergedUniqueIds(localProfile.claimedAchievements, firebaseData.claimedAchievements);
    const mergedUnlockedAchievements = getMergedUniqueIds(localProfile.unlockedAchievements, firebaseData.unlockedAchievements);
    const mergedShowcasedAchievements = getMergedUniqueIds(localProfile.showcasedAchievements, firebaseData.showcasedAchievements)
        .filter(achievementId => mergedClaimedAchievements.includes(achievementId))
        .slice(0, PROFILE_ACHIEVEMENT_SHOWCASE_LIMIT);
    const mergedRedeemedCodes = getMergedUniqueIds(localProfile.redeemedCodes, firebaseData.redeemedCodes, getRedeemedCodes());
    const mergedSocialRewardsClaimed = getMergedUniqueIds(localProfile.socialRewardsClaimed, firebaseData.socialRewardsClaimed);

    const localDailyWinsDate = normalizeStoredUtcDateValue(localProfile.dailyWinsUtcDate || localProfile.dailyWinsDate);
    const remoteDailyWinsDate = normalizeStoredUtcDateValue(firebaseData.dailyWinsUtcDate || firebaseData.dailyWinsDate);
    const localDailyWins = Number(localProfile.dailyWins) || 0;
    const remoteDailyWins = Number(firebaseData.dailyWins) || 0;
    const mergedDailyWinsDate = remoteDailyWinsDate || localDailyWinsDate || "";
    const mergedDailyWins = mergedDailyWinsDate
        ? Math.max(
            remoteDailyWinsDate === mergedDailyWinsDate ? remoteDailyWins : 0,
            localDailyWinsDate === mergedDailyWinsDate ? localDailyWins : 0
        )
        : 0;

    const localMonthlyWinsKey = normalizeStoredUtcMonthValue(localProfile.monthlyWinsUtcKey || localProfile.monthlyWinsKey);
    const remoteMonthlyWinsKey = normalizeStoredUtcMonthValue(firebaseData.monthlyWinsUtcKey || firebaseData.monthlyWinsKey);
    const localMonthlyWins = Number(localProfile.monthlyWins) || 0;
    const remoteMonthlyWins = Number(firebaseData.monthlyWins) || 0;
    const mergedMonthlyWinsKey = remoteMonthlyWinsKey || localMonthlyWinsKey || "";
    const mergedMonthlyWins = mergedMonthlyWinsKey
        ? Math.max(
            remoteMonthlyWinsKey === mergedMonthlyWinsKey ? remoteMonthlyWins : 0,
            localMonthlyWinsKey === mergedMonthlyWinsKey ? localMonthlyWins : 0
        )
        : 0;
    return {
        uid: currentUser.uid,
        username: preferredUsername,
        email: currentUser.email,
        profilePicture: preferredProfilePic,
        profilePic: preferredProfilePic,
        avatar: preferredAvatar,
        totalGuesses: preferRemoteNumber(localProfile.totalGuesses, firebaseData.totalGuesses),
        gamesPlayed: preferRemoteNumber(localProfile.gamesPlayed ?? localProfile.games, firebaseData.gamesPlayed ?? firebaseData.games),
        wins: preferRemoteNumber(localProfile.wins, firebaseData.wins),
        losses: preferRemoteNumber(localProfile.losses, firebaseData.losses),
        currentLossStreak: preferRemoteNumber(localProfile.currentLossStreak, firebaseData.currentLossStreak),
        averageGuesses: preferRemoteNumber(localProfile.averageGuesses, firebaseData.averageGuesses),
        bestGame: (() => {
            const localBest = Number(localProfile.bestGame) || 0;
            const firebaseBest = Number(firebaseData.bestGame) || 0;
            if (!localBest) return firebaseBest;
            if (!firebaseBest) return localBest;
            return Math.min(localBest, firebaseBest);
        })(),
        currentStreak: preferRemoteNumber(localProfile.currentStreak, firebaseData.currentStreak),
        highestStreak: preferRemoteNumber(localProfile.highestStreak, firebaseData.highestStreak),
        dailyWins: mergedDailyWins,
        dailyWinsDate: mergedDailyWinsDate,
        dailyWinsUtcDate: mergedDailyWinsDate,
        monthlyWins: mergedMonthlyWins,
        monthlyWinsKey: mergedMonthlyWinsKey,
        monthlyWinsUtcKey: mergedMonthlyWinsKey,
        winPeriodVersion: Math.max(Number(localProfile.winPeriodVersion) || 0, Number(firebaseData.winPeriodVersion) || 0),
        totalXP: preferredTotalXP,
        currentLevel: preferredCurrentLevel,
        currentXP: preferredCurrentXP,
        xpToNextLevel: preferredXPToNextLevel,
        duelGames: preferRemoteNumber(localProfile.duelGames, firebaseData.duelGames),
        duelWins: preferRemoteNumber(localProfile.duelWins, firebaseData.duelWins),
        cratesOpened: preferredCratesOpened,
        cratesSinceLegendary: preferredCratesSinceLegendary,
        streakShields: preferredStreakShields,
        instantCrateOpen: preferredInstantCrateOpen,
        pearls: preferredPearls,
        pearlBoostExpiresAt: preferredPearlBoostExpiresAt,
        seasonXpBoosts: preferredSeasonXpBoosts,
        earnedCosmetics: getUnifiedCosmeticList(localProfile.earnedCosmetics, firebaseData.earnedCosmetics, "imagePath"),
        testerBadgeUnlocked: Boolean(firebaseData.testerBadgeUnlocked || localProfile.testerBadgeUnlocked),
        equippedBadge: preferredEquippedBadge,
        equippedCardTheme: preferredEquippedCardTheme,
        unlockedBadges: getMergedUniqueIds(localProfile.unlockedBadges, firebaseData.unlockedBadges, ["starter"]),
        unlockedCardThemes: getMergedUniqueIds(localProfile.unlockedCardThemes, firebaseData.unlockedCardThemes, ["default"]),
        unlockedTitles: getMergedUniqueIds(localProfile.unlockedTitles, firebaseData.unlockedTitles, []),
        equippedTitle: preferredEquippedTitle,
        communityBossRewards: {
            ...(localProfile.communityBossRewards && typeof localProfile.communityBossRewards === "object" ? localProfile.communityBossRewards : {}),
            ...(firebaseData.communityBossRewards && typeof firebaseData.communityBossRewards === "object" ? firebaseData.communityBossRewards : {})
        },
        referralRewards: {
            ...(localProfile.referralRewards && typeof localProfile.referralRewards === "object" ? localProfile.referralRewards : {}),
            ...(firebaseData.referralRewards && typeof firebaseData.referralRewards === "object" ? firebaseData.referralRewards : {})
        },
        socialRewardsClaimed: mergedSocialRewardsClaimed,
        lostTreasures: mergeLostTreasuresStates(localProfile, firebaseData),
        sharkPassMissionClaims: {
            ...(localProfile.sharkPassMissionClaims && typeof localProfile.sharkPassMissionClaims === "object" ? localProfile.sharkPassMissionClaims : {}),
            ...(firebaseData.sharkPassMissionClaims && typeof firebaseData.sharkPassMissionClaims === "object" ? firebaseData.sharkPassMissionClaims : {})
        },
        sharkPassSeasonBaselines: {
            ...(localProfile.sharkPassSeasonBaselines && typeof localProfile.sharkPassSeasonBaselines === "object" ? localProfile.sharkPassSeasonBaselines : {}),
            ...(firebaseData.sharkPassSeasonBaselines && typeof firebaseData.sharkPassSeasonBaselines === "object" ? firebaseData.sharkPassSeasonBaselines : {})
        },
        sharkPassLevelRewardClaims: (() => {
            const activeSeasonId = getActiveSharkPassSeasonId();
            const localSeasonId = localProfile.sharkPassProgressSeasonId || localProfile.sharkPassSeasonId;
            const remoteSeasonId = firebaseData.sharkPassProgressSeasonId || firebaseData.sharkPassSeasonId;
            return getMergedUniqueIds(
                localSeasonId === activeSeasonId ? localProfile.sharkPassLevelRewardClaims : [],
                remoteSeasonId === activeSeasonId ? firebaseData.sharkPassLevelRewardClaims : [],
                []
            );
        })(),
        sharkPassProgressSeasonId: getActiveSharkPassSeasonId(),
        sharkPassXP: (() => {
            const activeSeasonId = getActiveSharkPassSeason()?.id || SHARK_PASS_ACTIVE_SEASON_ID;
            const localSeasonId = localProfile.sharkPassProgressSeasonId || localProfile.sharkPassSeasonId;
            const remoteSeasonId = firebaseData.sharkPassProgressSeasonId || firebaseData.sharkPassSeasonId;
            if (localSeasonId === activeSeasonId && remoteSeasonId === activeSeasonId) {
                return maxNumeric(getProfileSharkPassXPValue(localProfile), getProfileSharkPassXPValue(firebaseData));
            }
            if (remoteSeasonId === activeSeasonId) return getProfileSharkPassXPValue(firebaseData);
            if (localSeasonId === activeSeasonId) return getProfileSharkPassXPValue(localProfile);
            if (preferRemote && getProfileSharkPassXPValue(firebaseData) > 0) return getProfileSharkPassXPValue(firebaseData);
            return 0;
        })(),
        sharkPassSeasonId: getActiveSharkPassSeasonId(),
        crateInventory: preferredCrateInventory,
        crateInventoryUpdatedAt: preferredCrateInventoryUpdatedAt,
        summerCrateRetirementVersion: summerCratesRetired ? SUMMER_CRATE_RETIREMENT_VERSION : 0,
        claimedAchievements: mergedClaimedAchievements,
        unlockedAchievements: mergedUnlockedAchievements,
        showcasedAchievements: mergedShowcasedAchievements,
        redeemedCodes: mergedRedeemedCodes,
        loginStreak: mergedLoginProgress.loginStreak,
        currentLoginDay: mergedLoginProgress.currentLoginDay,
        lastLoginDate: mergedLoginProgress.lastLoginDate,
        dailyLoginModalShownToday: mergedLoginProgress.dailyLoginModalShownToday,
        lastSpinWheelDate: [normalizeStoredDateValue(localProfile.lastSpinWheelDate), normalizeStoredDateValue(firebaseData.lastSpinWheelDate)].filter(Boolean).sort().pop() || "",
        dailySpinWinDate: [normalizeStoredDateValue(localProfile.dailySpinWinDate), normalizeStoredDateValue(firebaseData.dailySpinWinDate)].filter(Boolean).sort().pop() || "",
        dailySpinBonusSpins: preferredDailySpinBonusSpins,
        adminCompensationNotice: normalizeAdminCompensationNotice(firebaseData.adminCompensationNotice),
        lastUpdated: Math.max(localUpdatedMs, firebaseUpdatedMs)
    };
}

async function loadUserProfile(options = {}) {
    const { rethrowErrors = false } = options;
    try {
        const authUser = firebase.auth().currentUser;
        if (!currentUser || !authUser || currentUser.uid !== authUser.uid) {
            console.warn("Skipped loadUserProfile: auth state not settled.");
            return null;
        }
        const localProfile = getBestLocalProfile();
        // Load from userStats collection
        const statsRef = db.collection("userStats").doc(authUser.uid);
        const { snapshot: statsSnap, fromServer } = await getUserStatsSnapshot(statsRef);
        const statsData = statsSnap.exists ? (statsSnap.data() || {}) : {};
        const { profile: fullCloudProfile, fromServer: fullCloudFromServer } = await readFullUserProfileFromFirebase(authUser);
        let remoteHasData = statsSnap.exists && Object.keys(statsData).length > 0;
        if (fromServer || fullCloudFromServer) {
            lastServerHydratedProfileUid = authUser.uid;
        }
        let userData = {};
        let firebaseData = null;
        if (fromServer) {
            const existingEmailProfile = await findRecoverableUserStatsByEmail(authUser);
            const currentRemoteScore = remoteHasData ? getProfileRecoveryScore(statsData) : 0;
            if (existingEmailProfile && (!remoteHasData || existingEmailProfile.score > currentRemoteScore)) {
                firebaseData = await migrateUserStatsDocumentToAuthUser(authUser, existingEmailProfile);
                remoteHasData = Boolean(firebaseData);
                console.info("Recovered existing Firestore profile for account login:", existingEmailProfile.id);
            }
        }
        if (fullCloudProfile && hasRecoverableRemoteProfile(fullCloudProfile)) {
            const baseRemoteProfile = remoteHasData ? (firebaseData || statsData) : {};
            firebaseData = hasRecoverableRemoteProfile(baseRemoteProfile)
                ? mergeProfilesSafely(baseRemoteProfile, fullCloudProfile, { preferRemote: false })
                : fullCloudProfile;
            remoteHasData = true;
        }
        // If Firestore has a profile, hydrate from it unless this device has stronger unsynced progress.
        if (remoteHasData) {
            firebaseData = firebaseData || statsData;
            const localHasRecoverableProfile = hasRecoverableRemoteProfile(localProfile);
            const localRecoveryScore = getProfileRecoveryScore(localProfile);
            const remoteRecoveryScore = getProfileRecoveryScore(firebaseData);
            const localLooksNewer = localHasRecoverableProfile && localRecoveryScore > remoteRecoveryScore;
            const localHasNewerCrateInventory =
                localHasRecoverableProfile &&
                getCrateInventoryUpdatedAt(localProfile) > getCrateInventoryUpdatedAt(firebaseData);
            const localMergeSource = (localLooksNewer || localHasNewerCrateInventory) ? localProfile : {};
            userData = mergeProfilesSafely(localMergeSource, firebaseData, { preferRemote: !(localLooksNewer || localHasNewerCrateInventory) });
            storeLoginProgressLocally(userData, authUser.uid);
            saveUserProfileLocally(userData, { skipRemoteSync: true, preserveLastUpdated: true });
            const activePassSeasonId = getActiveSharkPassSeasonId();
            if (
                firebaseData.sharkPassProgressSeasonId !== activePassSeasonId ||
                firebaseData.sharkPassSeasonId !== activePassSeasonId ||
                (firebaseData.sharkPassXP && Number(firebaseData.sharkPassXP) !== Number(userData.sharkPassXP))
            ) {
                await statsRef.set(getSharkPassSyncPayload(userData), { merge: true });
            }
            if ((localLooksNewer || localHasNewerCrateInventory) && fromServer) {
                scheduleRemoteProfileSync(250);
            }
            if ((fromServer || fullCloudFromServer) && (!fullCloudProfile || localLooksNewer || localHasNewerCrateInventory) && hasRecoverableRemoteProfile(userData)) {
                syncFullUserProfileToFirebase(userData).catch(error => console.warn("Full profile backup refresh failed:", error));
            }
            // Ensure legacy localStorage keys are updated for compatibility with other parts of the app
            localStorage.setItem("games", String(userData.gamesPlayed || 0));
            localStorage.setItem("wins", String(userData.wins || 0));
            localStorage.setItem("losses", String(userData.losses || 0));
            if (userData.totalXP !== undefined) {
                localStorage.setItem("totalXP", String(userData.totalXP || 0));
            }
            const loadedRedeemedCodes = Array.isArray(userData.redeemedCodes) ? userData.redeemedCodes : [];
            localStorage.setItem("redeemedCodes", JSON.stringify(loadedRedeemedCodes));
            userData.redeemedCodes = loadedRedeemedCodes;
            const mergedLoginProgressPayload = buildLoginProgressSyncPayload(userData);
            if (loginProgressDiffers(firebaseData, mergedLoginProgressPayload)) {
                await statsRef.set(mergedLoginProgressPayload, { merge: true });
            }
            const normalizedSpinDate = normalizeStoredDateValue(firebaseData.lastSpinWheelDate);
            if (normalizedSpinDate) {
                localStorage.setItem(getLastSpinWheelDateStorageKey(currentUser.uid), normalizedSpinDate);
            } else {
                localStorage.removeItem(getLastSpinWheelDateStorageKey(currentUser.uid));
            }
            const normalizedSpinWinDate = normalizeStoredDateValue(firebaseData.dailySpinWinDate);
            if (normalizedSpinWinDate) {
                localStorage.setItem(getDailySpinWinDateStorageKey(currentUser.uid), normalizedSpinWinDate);
            } else {
                localStorage.removeItem(getDailySpinWinDateStorageKey(currentUser.uid));
            }
            const loadedDailySpinBonusSpins = normalizeDailySpinBonusCount(userData.dailySpinBonusSpins);
            if (loadedDailySpinBonusSpins > 0) {
                localStorage.setItem(getDailySpinBonusStorageKey(currentUser.uid), String(loadedDailySpinBonusSpins));
            } else {
                localStorage.removeItem(getDailySpinBonusStorageKey(currentUser.uid));
            }
            const loadedClaimedAchievements = Array.isArray(userData.claimedAchievements) ? userData.claimedAchievements : [];
            const loadedUnlockedAchievements = Array.isArray(userData.unlockedAchievements) ? userData.unlockedAchievements : [];
            const loadedShowcasedAchievements = Array.isArray(userData.showcasedAchievements) ? userData.showcasedAchievements : [];
            localStorage.setItem("claimedAchievements", JSON.stringify(loadedClaimedAchievements));
            localStorage.setItem("unlockedAchievements", JSON.stringify(loadedUnlockedAchievements));
            localStorage.setItem("showcasedAchievements", JSON.stringify(loadedShowcasedAchievements));
        } else if (hasMeaningfulProfileData(localProfile)) {
            userData = mergeProfilesSafely(localProfile, {});
            storeLoginProgressLocally(userData, authUser.uid);
            // Only seed remote stats if we positively confirmed from the server that the doc was empty.
            // This prevents cache-fallback reads from clobbering real cloud stats on login.
            if (fromServer) {
                await statsRef.set(userData, { merge: true });
            } else {
                console.warn("Skipped seeding userStats from local profile because snapshot was cache-fallback.");
            }
            saveUserProfileLocally(userData, { skipRemoteSync: true, preserveLastUpdated: true });
            if (fromServer) {
                await syncFullUserProfileToFirebase(userData);
            }
        } else {
            if (!fromServer) {
                console.warn("Skipped creating a default profile because userStats was not confirmed empty from the server.");
                return null;
            }
            userData = buildInitialUserProfileForAuthUser(authUser, getStoredPreferredUsername() || localProfile.username || "");
            await statsRef.set(userData, { merge: true });
            storeLoginProgressLocally(userData, authUser.uid);
            saveUserProfileLocally(userData, { skipRemoteSync: true, preserveLastUpdated: true });
            await syncFullUserProfileToFirebase(userData);
        }
        const themeSyncResult = syncAchievementThemeUnlocks(userData);
        userData = themeSyncResult.profileData;
        if (themeSyncResult.changed && currentUser && db) {
            await statsRef.set({ unlockedCardThemes: themeSyncResult.unlockedThemeIds }, { merge: true });
        }
        updateProfileDisplay(userData);
        // Update navbar profile pic
        const navProfilePic = document.getElementById("nav-profile-pic");
        if (navProfilePic) navProfilePic.src = userData.profilePicture || "images/pfp/shark1.png";
        if (typeof updateProfileBadgeUI === "function") {
            updateProfileBadgeUI();
        }
        if (typeof renderThemeSelection === "function") {
            renderThemeSelection();
        }
        if (typeof renderTitleSelection === "function") {
            renderTitleSelection();
        }
        loadEarnedCosmetics();
        if (typeof loadAvailablePFPs === "function") {
            loadAvailablePFPs();
        }
        maybeShowAdminCompensationNotice(userData);
        return userData;
    } catch (error) {
        console.error("\u{274C} Error loading profile:", error);
        if (rethrowErrors) throw error;
        return null;
    }
}

function updateProfileDisplay(userData) {
    if (!userData) return;
    const profileUsername = document.getElementById("profile-username");
    const profileTotalGuesses = document.getElementById("profile-xp");
    const profileGames = document.getElementById("profile-games");
    const profileWins = document.getElementById("profile-wins");
    const profileLosses = document.getElementById("profile-losses");
    const profileAvgGuesses = document.getElementById("profile-avg-guesses");
    const profileBestGame = document.getElementById("profile-best-game");
    const profileCurrentStreak = document.getElementById("profile-current-streak");
    const profileHighestStreak = document.getElementById("profile-highest-streak");
    const profilePic = document.getElementById("profile-pic");

    if (profileUsername) profileUsername.textContent = userData.username || "Unknown";
    if (profileTotalGuesses) profileTotalGuesses.textContent = userData.totalGuesses ?? 0;
    if (profileGames) profileGames.textContent = userData.gamesPlayed ?? userData.games ?? 0;
    if (profileWins) profileWins.textContent = userData.wins ?? 0;
    if (profileLosses) profileLosses.textContent = userData.losses ?? 0;
    if (profileAvgGuesses) {
        let avg = userData.averageGuesses;
        if (typeof avg !== "number") avg = Number(avg);
        if (isNaN(avg)) avg = 0;
        profileAvgGuesses.textContent = avg.toFixed(2);
    }
    if (profileBestGame) profileBestGame.textContent = userData.bestGame ?? 0;
    if (profileCurrentStreak) profileCurrentStreak.textContent = userData.currentStreak ?? 0;
    if (profileHighestStreak) profileHighestStreak.textContent = userData.highestStreak ?? 0;
    if (profilePic) profilePic.src = userData.profilePicture || "images/pfp/shark1.png";
    const navProfilePic = document.getElementById("nav-profile-pic");
    if (navProfilePic) navProfilePic.src = userData.profilePicture || "images/pfp/shark1.png";
    updateHomeV3Sidebar(userData);
    applyProfileCardTheme(userData.equippedCardTheme || "default");
    updateProfileTitleUI(userData);
    renderTitleSelection();
    renderProfileAchievementShowcase(userData);

    const profileUid = userData.uid || currentUser?.uid;
    if (profileUid) {
        const requestId = ++latestProfileLeaderboardRequest;
        fetchLeaderboardPlacement(profileUid).then(rank => {
            if (requestId !== latestProfileLeaderboardRequest) return;
            applyLeaderboardBadge("profile-leaderboard-badge", rank);
        });
    } else {
        applyLeaderboardBadge("profile-leaderboard-badge", null);
    }

    // Also update index stats just in case
    updateIndexStats();
}

function updateHomeV3Sidebar(profileData = getCurrentProfileData()) {
    const isLoggedIn = Boolean(currentUser);
    const data = profileData || {};
    const totalXP = Number(data.totalXP) || 0;
    const currentLevel = typeof getLevelFromXP === "function" ? getLevelFromXP(totalXP) : 1;
    const gamesPlayed = Number(data.gamesPlayed ?? data.games) || 0;
    const wins = Number(data.wins) || 0;
    const winRate = gamesPlayed > 0 ? Math.round((wins / gamesPlayed) * 100) : 0;
    const avatarPath = data.profilePicture || data.profilePic || "images/pfp/shark1.png";
    const xpIntoLevel = typeof getXPInCurrentLevel === "function" ? getXPInCurrentLevel(totalXP) : totalXP;
    const xpToNext = typeof getXPToNextLevel === "function" ? getXPToNextLevel(totalXP) : 0;
    const xpLevelTotal = Math.max(1, xpIntoLevel + xpToNext);
    const xpPercent = Math.max(0, Math.min(100, (xpIntoLevel / xpLevelTotal) * 100));

    const setText = (id, value) => {
        const el = document.getElementById(id);
        if (el) el.textContent = value;
    };

    const avatar = document.getElementById("home-v3-avatar");
    if (avatar) avatar.src = avatarPath;

    const widget = document.getElementById("home-v3-profile-widget");
    if (widget) widget.classList.toggle("hidden", !isLoggedIn);
    setText("home-v3-username", isLoggedIn ? (data.username || currentUser?.email?.split("@")[0] || "Sharkdle Player") : "Guest Shark");
    setText("home-v3-level-label", isLoggedIn ? `Level ${currentLevel}` : "Level 1");
    setText("home-v3-xp-label", isLoggedIn ? `XP ${xpIntoLevel}/${xpLevelTotal}` : "XP 0/0");
    const fill = document.getElementById("home-v3-xp-fill");
    if (fill) fill.style.width = isLoggedIn ? `${xpPercent}%` : "0%";

    setText("home-v3-games", isLoggedIn ? gamesPlayed : 0);
    setText("home-v3-winrate", isLoggedIn ? `${winRate}%` : "0%");
    setText("home-v3-best-streak", isLoggedIn ? (data.highestStreak || 0) : 0);
    setText("home-v3-total-xp", isLoggedIn ? totalXP : 0);

    const shieldCount = typeof getStreakShieldCount === "function" ? getStreakShieldCount(data) : (Number(data.streakShields) || 0);
    setText("home-v3-shields", isLoggedIn ? `${shieldCount}/3` : "0/3");
    const pearls = typeof getPearlCount === "function" ? getPearlCount(data) : (Number(data.pearls ?? data.tidePearls) || 0);
    setText("home-v3-pearls", isLoggedIn ? pearls.toLocaleString() : "0");
    renderPearlShop(data);
}

function formatShopTimeRemaining(msRemaining) {
    const totalSeconds = Math.max(0, Math.ceil(msRemaining / 1000));
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    if (minutes >= 60) {
        const hours = Math.floor(minutes / 60);
        const remainingMinutes = minutes % 60;
        return `${hours}h ${remainingMinutes}m`;
    }
    return `${minutes}m ${String(seconds).padStart(2, "0")}s`;
}

function getPearlShopEventCrateId() {
    return getActiveSeasonalCrateId();
}

function getPearlShopPurchaseState(itemId, profileData = getCurrentProfileData()) {
    const item = PEARL_SHOP_ITEMS[itemId];
    if (!item) return { disabled: true, label: "Unavailable", owned: false, reason: "Unavailable" };

    const pearls = getPearlCount(profileData);
    const isLoggedIn = Boolean(currentUser);
    let disabled = !isLoggedIn || pearls < item.price;
    let label = `${item.price}p`;
    let owned = false;
    let reason = !isLoggedIn ? "Login required" : pearls < item.price ? "Need more pearls" : "";

    if (itemId === "streak-shield" && getStreakShieldCount(profileData) >= 3) {
        disabled = true;
        label = "Maxed";
        owned = true;
        reason = "Max shields";
    }

    if (itemId === "pearl-boost" && isPearlBoostActive(profileData)) {
        label = `Extend ${item.price}p`;
        reason = "";
    }

    if (itemId === "season-xp" && hasSeasonXpBoost(profileData)) {
        disabled = true;
        label = "Owned";
        owned = true;
        reason = "Owned";
    }

    if (itemId === "event-crate" && !getPearlShopEventCrateId()) {
        disabled = true;
        label = "Inactive";
        reason = "Event theme inactive";
    }

    return { disabled, label, owned, reason };
}

function renderPearlShop(profileData = getCurrentProfileData()) {
    const status = document.getElementById("home-v3-shop-status");
    const eventCrateName = document.getElementById("home-v3-event-crate-name");
    const balance = document.getElementById("pearl-shop-balance");
    if (!status && !eventCrateName && !balance && !document.querySelector("[data-pearl-shop-item]")) return;

    const eventCrateId = getPearlShopEventCrateId();
    const eventCrateDef = eventCrateId ? getCrateDefinition(eventCrateId) : null;
    if (eventCrateName) eventCrateName.textContent = eventCrateDef?.name || "Event Crate";

    const isLoggedIn = Boolean(currentUser);
    const pearls = getPearlCount(profileData);
    if (balance) balance.textContent = isLoggedIn ? pearls.toLocaleString() : "0";
    const pearlBoostMs = getPearlBoostExpiresAt(profileData) - Date.now();
    if (status) {
        if (!isLoggedIn) {
            status.textContent = "Login to spend and save pearls.";
        } else if (pearlBoostMs > 0 && hasSeasonXpBoost(profileData)) {
            status.textContent = `2x pearls active for ${formatShopTimeRemaining(pearlBoostMs)}. Season 2x XP owned.`;
        } else if (pearlBoostMs > 0) {
            status.textContent = `2x pearls active for ${formatShopTimeRemaining(pearlBoostMs)}.`;
        } else if (hasSeasonXpBoost(profileData)) {
            status.textContent = "Season 2x XP owned for the current season.";
        } else {
            status.textContent = "Spend pearls on boosts, crates, and streak protection.";
        }
    }

    Object.keys(PEARL_SHOP_ITEMS).forEach(itemId => {
        const state = getPearlShopPurchaseState(itemId, profileData);
        document.querySelectorAll(`[data-pearl-shop-item="${itemId}"]`).forEach(card => {
            const button = card.querySelector("button");
            if (!button) return;
            button.textContent = state.label;
            button.disabled = state.disabled;
            button.title = state.reason || "";
            card.classList.toggle("owned", state.owned);
            card.classList.toggle("disabled", state.disabled && !state.owned);
        });
    });
}

function openPearlShopModal() {
    const modal = document.getElementById("pearlShopModal");
    if (!modal) return;
    renderPearlShop(getCurrentProfileData());
    modal.classList.remove("hidden");
}

function closePearlShopModal() {
    document.getElementById("pearlShopModal")?.classList.add("hidden");
}

function openSocialRewardsModal() {
    const modal = document.getElementById("socialRewardsModal");
    if (!modal) return;
    modal.classList.remove("hidden");
    try {
        renderSocialRewards(getCurrentProfileData());
    } catch (error) {
        console.warn("Unable to render social rewards:", error);
        const list = document.getElementById("social-rewards-list");
        if (list) list.innerHTML = '<div class="profile-empty-card">Rewards could not load. Please try again.</div>';
    }
}

function closeSocialRewardsModal() {
    document.getElementById("socialRewardsModal")?.classList.add("hidden");
}

window.openSocialRewardsModal = openSocialRewardsModal;
window.closeSocialRewardsModal = closeSocialRewardsModal;

function grantPearlShopItem(profileData, itemId) {
    if (!profileData || typeof profileData !== "object") return { success: false, message: "Profile not ready." };

    if (itemId === "streak-shield") {
        const currentShields = getStreakShieldCount(profileData);
        if (currentShields >= 3) return { success: false, message: "You already have the maximum Streak Shields." };
        setStreakShieldCount(profileData, currentShields + 1);
        return { success: true, message: "Streak Shield added." };
    }

    if (itemId === "pearl-boost") {
        const startsAt = Math.max(Date.now(), getPearlBoostExpiresAt(profileData));
        profileData.pearlBoostExpiresAt = startsAt + PEARL_BOOST_DURATION_MS;
        return { success: true, message: "2x Pearls Boost activated for 1 hour." };
    }

    if (itemId === "cosmetic-crate" || itemId === "event-crate") {
        const crateId = itemId === "event-crate" ? getPearlShopEventCrateId() : "reef";
        if (!crateId) return { success: false, message: "Event crates are only available while an event theme is active." };
        const inventory = getCrateInventory(profileData);
        inventory[crateId] = (inventory[crateId] || 0) + 1;
        profileData.crateInventory = normalizeCrateInventory(inventory);
        markCrateInventoryChanged(profileData);
        return { success: true, message: `${getCrateDefinition(crateId).name} added.` };
    }

    if (itemId === "message-bottle-pack") {
        const state = getLostTreasuresState(profileData);
        state.bottles.barnacle = (state.bottles.barnacle || 0) + 5;
        state.bottles["red-sea"] = (state.bottles["red-sea"] || 0) + 3;
        state.bottles.seafoam = (state.bottles.seafoam || 0) + 1;
        state.bottles.celestial = (state.bottles.celestial || 0) + 1;
        setLostTreasuresState(profileData, state, { skipRemoteSync: true });
        return { success: true, message: "Message in a Bottle Pack added." };
    }

    if (itemId === "season-xp") {
        if (hasSeasonXpBoost(profileData)) return { success: false, message: "Season 2x XP is already owned." };
        setSeasonXpBoost(profileData);
        return { success: true, message: "Season 2x XP unlocked for the current season." };
    }

    return { success: false, message: "Unknown shop item." };
}

function getPearlShopAuthUser() {
    const authUser = typeof firebase !== "undefined" && typeof firebase.auth === "function"
        ? firebase.auth().currentUser
        : null;
    return authUser || window.currentUser || currentUser || null;
}

async function persistPearlShopPurchase(profileData, itemId, item) {
    const authUser = getPearlShopAuthUser();
    const nextProfile = {
        ...profileData,
        uid: window.currentUser?.uid || authUser?.uid || profileData.uid
    };

    saveUserProfileLocally(nextProfile, { skipRemoteSync: true });

    if (authUser && typeof db !== "undefined") {
        try {
            await db.collection("userStats").doc(authUser.uid).set({
                uid: authUser.uid,
                pearls: getPearlCount(nextProfile),
                pearlBoostExpiresAt: getPearlBoostExpiresAt(nextProfile),
                streakShields: getStreakShieldCount(nextProfile),
                crateInventory: normalizeCrateInventory(nextProfile.crateInventory),
                crateInventoryUpdatedAt: getCrateInventoryUpdatedAt(nextProfile),
                lostTreasures: getLostTreasuresState(nextProfile),
                seasonXpBoosts: getSeasonXpBoosts(nextProfile),
                sharkPassSeasonId: nextProfile.sharkPassSeasonId || SHARK_PASS_ACTIVE_SEASON_ID,
                lastPearlShopPurchase: {
                    itemId,
                    label: item.label,
                    price: item.price,
                    purchasedAt: new Date()
                },
                lastUpdated: new Date()
            }, { merge: true });
        } catch (error) {
            console.warn("Error saving pearl shop purchase:", error);
        }
    }

    return nextProfile;
}

async function buyPearlShopItem(itemId) {
    const item = PEARL_SHOP_ITEMS[itemId];
    if (!item) return;
    if (!currentUser) {
        showNotification("Login to spend pearls in the shop.", "error", 3200);
        return;
    }

    const profileData = getCurrentProfileData();
    const state = getPearlShopPurchaseState(itemId, profileData);
    if (state.disabled && state.reason) {
        showNotification(state.reason, "error", 2800);
        return;
    }

    const pearls = getPearlCount(profileData);
    if (pearls < item.price) {
        showNotification(`You need ${item.price - pearls} more pearls.`, "error", 3200);
        return;
    }

    const grant = grantPearlShopItem(profileData, itemId);
    if (!grant.success) {
        showNotification(grant.message, "error", 3200);
        renderPearlShop(profileData);
        return;
    }

    setPearlCount(profileData, pearls - item.price);
    const nextProfile = await persistPearlShopPurchase(profileData, itemId, item);
    updateHomeV3Sidebar(nextProfile);
    renderPearlShop(nextProfile);
    renderCratesButton();
    renderCratesModal();
    updateSeasonalCratePanels(nextProfile);
    renderLostTreasuresModal();
    showNotification(`${grant.message} -${item.price} pearls`, "success", 3400);
}

function switchHomeV3Tab(tabId = "play") {
    const tabs = document.querySelectorAll("[data-home-v3-tab]");
    const panels = document.querySelectorAll("[data-home-v3-panel]");
    tabs.forEach(tab => {
        const isActive = tab.dataset.homeV3Tab === tabId;
        tab.classList.toggle("active", isActive);
        tab.setAttribute("aria-selected", isActive ? "true" : "false");
    });
    panels.forEach(panel => {
        const isActive = panel.dataset.homeV3Panel === tabId;
        panel.classList.toggle("active", isActive);
        panel.hidden = !isActive;
    });
}

function initHomeV3Tabs() {
    document.querySelectorAll("[data-home-v3-tab]").forEach(tab => {
        if (tab.dataset.homeV3Ready === "true") return;
        tab.dataset.homeV3Ready = "true";
        tab.addEventListener("click", () => switchHomeV3Tab(tab.dataset.homeV3Tab || "play"));
    });
}

function initHomeV3CratesButton() {
    const cratesBtn = document.getElementById("crates-btn");
    if (!cratesBtn || cratesBtn.dataset.homeCratesReady === "true") return;
    cratesBtn.dataset.homeCratesReady = "true";
    cratesBtn.addEventListener("click", event => {
        event.preventDefault();
        openHomeCratesModal();
    });
}

function updateIndexStats() {
        const profileData = getCurrentProfileData();
        updateHomeV3Sidebar(profileData);

        if (currentUser && profileData) {
                // Logged-in -> use profileData
                const gamesEl = document.getElementById("games");
                const winsEl = document.getElementById("wins");
                const lossesEl = document.getElementById("losses");
                const guessesEl = document.getElementById("profile-guesses");
                const totalXpEl = document.getElementById("total-xp");
                const avgGuessesEl = document.getElementById("avg-guesses");
                const bestGameEl = document.getElementById("best-game");
                const currentStreakEl = document.getElementById("current-streak");
                const highestStreakEl = document.getElementById("highest-streak");

                if (gamesEl) gamesEl.textContent = profileData.gamesPlayed || 0;
                if (winsEl) winsEl.textContent = profileData.wins || 0;
                if (lossesEl) lossesEl.textContent = profileData.losses || 0;
                if (guessesEl) guessesEl.textContent = profileData.totalGuesses || 0;
                if (totalXpEl) totalXpEl.textContent = profileData.totalXP || 0;
                if (avgGuessesEl) avgGuessesEl.textContent = (profileData.averageGuesses || 0).toFixed(2);
                if (bestGameEl) bestGameEl.textContent = profileData.bestGame || 0;
                if (currentStreakEl) currentStreakEl.textContent = profileData.currentStreak || 0;
                if (highestStreakEl) highestStreakEl.textContent = profileData.highestStreak || 0;
        } else {
                // Logged-out -> show 0
                const gamesEl = document.getElementById("games");
                const winsEl = document.getElementById("wins");
                const lossesEl = document.getElementById("losses");
                const guessesEl = document.getElementById("profile-guesses");
                const totalXpEl = document.getElementById("total-xp");
                const avgGuessesEl = document.getElementById("avg-guesses");
                const bestGameEl = document.getElementById("best-game");
                const currentStreakEl = document.getElementById("current-streak");
                const highestStreakEl = document.getElementById("highest-streak");

                if (gamesEl) gamesEl.textContent = 0;
                if (winsEl) winsEl.textContent = 0;
                if (lossesEl) lossesEl.textContent = 0;
                if (guessesEl) guessesEl.textContent = 0;
                if (totalXpEl) totalXpEl.textContent = 0;
                if (avgGuessesEl) avgGuessesEl.textContent = 0;
                if (bestGameEl) bestGameEl.textContent = 0;
                if (currentStreakEl) currentStreakEl.textContent = 0;
                if (highestStreakEl) highestStreakEl.textContent = 0;
        }
        // Also update recent games tab if visible
        var recentTab = document.getElementById('recent-tab');
        if (recentTab && recentTab.style.display !== 'none') {
            renderRecentGames();
        }
        renderCratesButton();
        updateSpinWheelUI();
}
// expose for game files
window.updateIndexStats = updateIndexStats;

// Profile Tabs Logic
window.showProfileTab = function(tab) {
    const statsTab = document.getElementById('stats-tab');
    const recentTab = document.getElementById('recent-tab');
    const friendsTab = document.getElementById('friends-tab');
    const consumablesTab = document.getElementById('consumables-tab');
    const statsBtn = document.getElementById('stats-tab-btn');
    const recentBtn = document.getElementById('recent-tab-btn');
    const friendsBtn = document.getElementById('friends-tab-btn');
    const consumablesBtn = document.getElementById('consumables-tab-btn');

    if (statsTab) statsTab.style.display = tab === 'stats' ? 'block' : 'none';
    if (recentTab) recentTab.style.display = tab === 'recent' ? 'block' : 'none';
    if (friendsTab) friendsTab.style.display = tab === 'friends' ? 'block' : 'none';
    if (consumablesTab) consumablesTab.style.display = tab === 'consumables' ? 'block' : 'none';

    if (statsBtn) statsBtn.classList.toggle('active', tab === 'stats');
    if (recentBtn) recentBtn.classList.toggle('active', tab === 'recent');
    if (friendsBtn) friendsBtn.classList.toggle('active', tab === 'friends');
    if (consumablesBtn) consumablesBtn.classList.toggle('active', tab === 'consumables');

    if (tab === 'stats') {
        animateStatsFromLastView();
    } else if (tab === 'recent') {
        saveLastViewedStats();
        renderRecentGames();
    } else if (tab === 'friends') {
        populateFriendsTab();
    } else if (tab === 'consumables') {
        renderConsumablesPage();
    }

    // Save current tab for persistent tab selection (optional QoL)
    localStorage.setItem('profileLastTab', tab);
}

function saveLastViewedStats() {
    const stats = {
        totalGuesses: parseInt(document.getElementById('profile-xp')?.textContent) || 0,
        gamesPlayed: parseInt(document.getElementById('profile-games')?.textContent) || 0,
        wins: parseInt(document.getElementById('profile-wins')?.textContent) || 0,
        losses: parseInt(document.getElementById('profile-losses')?.textContent) || 0,
        averageGuesses: parseFloat(document.getElementById('profile-avg-guesses')?.textContent) || 0,
        bestGame: parseInt(document.getElementById('profile-best-game')?.textContent) || 0,
        currentStreak: parseInt(document.getElementById('profile-current-streak')?.textContent) || 0,
        highestStreak: parseInt(document.getElementById('profile-highest-streak')?.textContent) || 0
    };
    localStorage.setItem('lastViewedStats', JSON.stringify(stats));
}

function animateStatsFromLastView() {
    const userData = JSON.parse(localStorage.getItem('userProfile') || '{}');
    const lastStats = JSON.parse(localStorage.getItem('lastViewedStats') || '{}');
    const statMap = [
        { id: 'profile-xp', key: 'totalGuesses', decimals: 0 },
        { id: 'profile-games', key: 'gamesPlayed', decimals: 0 },
        { id: 'profile-wins', key: 'wins', decimals: 0 },
        { id: 'profile-losses', key: 'losses', decimals: 0 },
        { id: 'profile-avg-guesses', key: 'averageGuesses', decimals: 2 },
        { id: 'profile-best-game', key: 'bestGame', decimals: 0 },
        { id: 'profile-current-streak', key: 'currentStreak', decimals: 0 },
        { id: 'profile-highest-streak', key: 'highestStreak', decimals: 0 }
    ];
    statMap.forEach(({ id, key, decimals }) => {
        const el = document.getElementById(id);
        if (!el) return;
        const start = (lastStats && typeof lastStats[key] !== 'undefined') ? Number(lastStats[key]) : 0;
        let end = userData[key] ?? 0;
        if (typeof end === 'string') end = parseFloat(end);
        animateNumber(el, start, end, 900, decimals);
    });
}

function animateNumber(el, start, end, duration, decimals) {
    if (start === end) {
        el.textContent = (typeof end === 'number' ? end.toFixed(decimals) : end);
        return;
    }
    const startTime = performance.now();
    function update(now) {
        const elapsed = now - startTime;
        const progress = Math.min(elapsed / duration, 1);
        const value = start + (end - start) * progress;
        el.textContent = value.toFixed(decimals);
        if (progress < 1) {
            requestAnimationFrame(update);
        } else {
            el.textContent = (typeof end === 'number' ? end.toFixed(decimals) : end);
        }
    }
    requestAnimationFrame(update);
}

function renderRecentGames() {
    const recentGamesDiv = document.getElementById('recent-games-list');
    if (!recentGamesDiv) return;
    const recentGames = JSON.parse(localStorage.getItem('recentGames') || '[]');
    if (recentGames.length === 0) {
        recentGamesDiv.innerHTML = '<div style="color:#b3e5fc;text-align:center;padding:20px 0;">No recent games found.</div>';
        return;
    }
    recentGamesDiv.innerHTML = recentGames.slice(0, 10).map(game => `
        <div class="recent-game-item">
            <div class="game-result">${game.result === 'Win' ? '\u{1F3C6} Win' : '\u{274C} Loss'}</div>
            <div class="game-date">${game.date} ${game.time}</div>
            <div class="game-shark">Shark: <b>${game.sharkName || 'Unknown'}</b></div>
            <div>Guesses: <b>${game.guesses}</b></div>
            <div>Mode: <b>${game.mode || ''}</b></div>
        </div>
    `).join('');
}

// ---------- Username editing helpers ----------
function enableUsernameEdit() {
    const profileUsernameEl = document.getElementById("profile-username");
    const input = document.getElementById("username-input");
    const editBtn = document.getElementById("edit-profile-btn");
    const editContainer = document.getElementById("username-edit-container");
    const shell = document.querySelector(".username-editor-shell");

    if (profileUsernameEl && input) {
        input.value = profileUsernameEl.textContent.trim();
    }
    if (editContainer) editContainer.classList.remove("hidden");
    if (editBtn) editBtn.disabled = true;
    if (shell) shell.classList.add("editing");
    if (input) setTimeout(() => input.focus(), 0);
}

function cancelUsernameEdit() {
    document.getElementById("username-edit-container")?.classList.add("hidden");
    const editBtn = document.getElementById("edit-profile-btn");
    const shell = document.querySelector(".username-editor-shell");
    if (editBtn) editBtn.disabled = false;
    if (shell) shell.classList.remove("editing");
}

async function saveUsername() {
    const input = document.getElementById("username-input");
    const newName = input ? input.value.trim() : "";
    if (!newName) {
        alert("Username cannot be empty.");
        return;
    }
    await updateUsername(newName);
    cancelUsernameEdit();
}

async function updateUsername(newUsername) {
    if (!currentUser) return;
    try {
        const profileData = getCurrentProfileData();
        profileData.username = newUsername;
        cachePreferredUsername(newUsername);
        saveUserProfileLocally(profileData);

        const profileUsernameEl = document.getElementById("profile-username");
        if (profileUsernameEl) profileUsernameEl.textContent = newUsername;

        // Save to Firebase
        const statsRef = db.collection("userStats").doc(currentUser.uid);
        await statsRef.set({ username: newUsername, lastUpdated: profileData.lastUpdated || Date.now() }, { merge: true });
    } catch (error) {
        console.warn("Username update failed:", error);
    }
}

const SIGN_UP_BONUS_PEARLS = 300;

function buildInitialUserProfileForAuthUser(user, usernameOverride = "") {
    const rawLocalProfile = JSON.parse(localStorage.getItem("userProfile") || "{}");
    const localProfile = rawLocalProfile && !rawLocalProfile.uid ? rawLocalProfile : {};
    const totalXP = localProfile.totalXP || parseInt(localStorage.getItem("totalXP")) || 0;
    const gamesPlayed = localProfile.gamesPlayed || parseInt(localStorage.getItem("games")) || 0;
    const wins = localProfile.wins || parseInt(localStorage.getItem("wins")) || 0;
    const losses = localProfile.losses || parseInt(localStorage.getItem("losses")) || 0;
    const loginProgress = getLoginProgressFromLocalStorage(user.uid);
    let claimedAchievements = [];
    let unlockedAchievements = [];
    let showcasedAchievements = [];

    try {
        claimedAchievements = JSON.parse(localStorage.getItem("claimedAchievements") || "[]");
        unlockedAchievements = JSON.parse(localStorage.getItem("unlockedAchievements") || "[]");
        showcasedAchievements = JSON.parse(localStorage.getItem("showcasedAchievements") || "[]");
    } catch (error) {
        console.warn("Unable to migrate local achievement cache during account setup:", error);
    }

    const currentLevel = getLevelFromXP(totalXP);
    const xpInLevel = getXPInCurrentLevel(totalXP);
    const xpToNext = getXPToNextLevel(totalXP);
    const unlockedPfps = levelRewards
        .filter(r => r.level <= currentLevel)
        .map(r => ({ level: r.level, name: r.name || r.imagePath }));
    const fallbackUsername = usernameOverride
        || user.displayName
        || user.email?.split("@")[0]
        || "Sharkdle Player";

    return {
        uid: user.uid,
        profilePicture: localProfile.profilePicture || user.photoURL || "images/pfp/shark1.png",
        profilePic: localProfile.profilePicture || user.photoURL || "images/pfp/shark1.png",
        equippedBadge: localProfile.equippedBadge || "starter",
        equippedCardTheme: localProfile.equippedCardTheme || "default",
        equippedTitle: localProfile.equippedTitle || "",
        unlockedTitles: Array.isArray(localProfile.unlockedTitles) ? localProfile.unlockedTitles : [],
        unlockedBadges: Array.isArray(localProfile.unlockedBadges) ? localProfile.unlockedBadges : ["starter"],
        unlockedCardThemes: Array.isArray(localProfile.unlockedCardThemes) ? localProfile.unlockedCardThemes : ["default"],
        earnedCosmetics: Array.isArray(localProfile.earnedCosmetics) ? localProfile.earnedCosmetics : [],
        testerBadgeUnlocked: Boolean(localProfile.testerBadgeUnlocked),
        communityBossRewards: localProfile.communityBossRewards && typeof localProfile.communityBossRewards === "object" ? localProfile.communityBossRewards : {},
        referralRewards: localProfile.referralRewards && typeof localProfile.referralRewards === "object" ? localProfile.referralRewards : {},
        sharkPassMissionClaims: localProfile.sharkPassMissionClaims && typeof localProfile.sharkPassMissionClaims === "object" ? localProfile.sharkPassMissionClaims : {},
        sharkPassSeasonBaselines: localProfile.sharkPassSeasonBaselines && typeof localProfile.sharkPassSeasonBaselines === "object" ? localProfile.sharkPassSeasonBaselines : {},
        sharkPassLevelRewardClaims: [],
        sharkPassProgressSeasonId: getActiveSharkPassSeasonId(),
        sharkPassXP: 0,
        sharkPassSeasonId: getActiveSharkPassSeasonId(),
        crateInventory: normalizeCrateInventory(localProfile.crateInventory),
        crateInventoryUpdatedAt: getCrateInventoryUpdatedAt(localProfile),
        cratesOpened: Math.max(0, Number(localProfile.cratesOpened) || 0),
        streakShields: getStreakShieldCount(localProfile),
        instantCrateOpen: getCrateInstantOpenEnabled(localProfile),
        pearls: getPearlCount(localProfile) + SIGN_UP_BONUS_PEARLS,
        signUpBonusPearls: SIGN_UP_BONUS_PEARLS,
        signUpBonusClaimed: true,
        pearlBoostExpiresAt: getPearlBoostExpiresAt(localProfile),
        seasonXpBoosts: getSeasonXpBoosts(localProfile),
        username: String(fallbackUsername).slice(0, 24),
        email: user.email || "",
        avatar: "\u{1F988}",
        totalXP,
        gamesPlayed,
        wins,
        losses,
        totalGuesses: localProfile.totalGuesses || 0,
        averageGuesses: localProfile.averageGuesses || 0,
        bestGame: localProfile.bestGame || 0,
        currentStreak: localProfile.currentStreak || 0,
        highestStreak: localProfile.highestStreak || 0,
        currentLevel,
        currentXP: xpInLevel,
        xpToNextLevel: xpToNext,
        unlockedPfps,
        claimedAchievements: Array.isArray(claimedAchievements) ? claimedAchievements : [],
        unlockedAchievements: Array.isArray(unlockedAchievements) ? unlockedAchievements : [],
        showcasedAchievements: Array.isArray(showcasedAchievements) ? showcasedAchievements : [],
        redeemedCodes: getRedeemedCodes(),
        loginStreak: loginProgress.loginStreak,
        currentLoginDay: loginProgress.currentLoginDay,
        lastLoginDate: loginProgress.lastLoginDate,
        dailyLoginModalShownToday: loginProgress.dailyLoginModalShownToday,
        createdAt: new Date(),
        lastUpdated: new Date()
    };
}

async function ensureAuthUserProfile(user, usernameOverride = "") {
    if (!user || !db) return false;
    const userRef = db.collection("userStats").doc(user.uid);
    const { snapshot, fromServer } = await getUserStatsSnapshot(userRef);
    if (snapshot.exists) return false;
    if (!fromServer) {
        console.warn("Skipped initial profile creation because userStats was not confirmed empty from the server.");
        return false;
    }
    const existingEmailProfile = await findRecoverableUserStatsByEmail(user);
    if (existingEmailProfile) {
        await migrateUserStatsDocumentToAuthUser(user, existingEmailProfile);
        return false;
    }
    const { profile: fullCloudProfile } = await readFullUserProfileFromFirebase(user);
    if (fullCloudProfile && hasRecoverableRemoteProfile(fullCloudProfile)) {
        const recoveredProfile = mergeProfilesSafely({}, fullCloudProfile, { preferRemote: true });
        await userRef.set(recoveredProfile, { merge: true });
        await syncFullUserProfileToFirebase(recoveredProfile);
        return false;
    }
    const initialProfile = buildInitialUserProfileForAuthUser(user, usernameOverride);
    await userRef.set(initialProfile);
    await syncFullUserProfileToFirebase(initialProfile);
    return true;
}

function shouldRepairMissingSignUpBonus(profile = {}) {
    if (profile.signUpBonusClaimed === true) return false;
    if ((Number(profile.pearls) || 0) >= SIGN_UP_BONUS_PEARLS) return false;

    const hasProgress = ["gamesPlayed", "wins", "losses", "totalXP", "totalGuesses", "cratesOpened"]
        .some(key => Number(profile[key]) > 0);
    const hasCollections = [profile.redeemedCodes, profile.earnedCosmetics, profile.claimedAchievements, profile.unlockedAchievements]
        .some(value => Array.isArray(value) && value.length > 0);

    return !hasProgress && !hasCollections;
}

function getFriendlyAuthErrorMessage(error, fallback = "Something went wrong. Please try again.") {
    const supportEmail = "sharkdle.online@gmail.com";
    const code = String(error?.code || "").toLowerCase();
    if (code.includes("invalid-credential") || code.includes("wrong-password") || code.includes("user-not-found")) {
        return "Incorrect email or password. If this account used Google before, use Forgot password to set an email password.";
    }
    if (code.includes("invalid-email")) return "Enter a valid email address.";
    if (code.includes("too-many-requests")) return "Too many login attempts. Wait a bit, then try again.";
    if (code.includes("network-request-failed")) return "Network error. Check your connection and try again.";
    if (code.includes("email-already-in-use")) return "This email is already registered. Please log in instead.";
    if (code.includes("weak-password")) return "Password must be at least 6 characters.";
    if (code.includes("operation-not-allowed")) return `Email login is not enabled in Firebase. Email ${supportEmail} for help.`;
    return error?.message || fallback;
}

function loginUser() {
    const emailInput = document.getElementById("login-email");
    const passwordInput = document.getElementById("login-password");
    const errorEl = document.getElementById("auth-error");
    const loginSubmitBtn = document.querySelector(".login-form .modal-primary-btn");
    const email = emailInput ? emailInput.value.trim() : "";
    const password = passwordInput ? passwordInput.value : "";

    if (!emailInput || !passwordInput || !errorEl) {
        showNotification("Login form is unavailable right now.", "error");
        return;
    }

    if (!email || !password) {
        errorEl.textContent = "Please fill in all fields.";
        errorEl.style.display = "block";
        return;
    }

    // Disable button during login
    if (loginSubmitBtn) {
        loginSubmitBtn.disabled = true;
        loginSubmitBtn.textContent = "Logging in...";
    }

    auth.signInWithEmailAndPassword(email, password)
        .then(result => {
            errorEl.style.display = "none";
            showNotification('Login successful!', 'success');
            closeLoginModal();
        })
        .catch(error => {
            const message = getFriendlyAuthErrorMessage(error, "Login failed. Please check your credentials.");
            errorEl.textContent = message;
            errorEl.style.display = "block";
            showNotification(message, 'error');
        })
        .finally(() => {
            // Re-enable button
            if (loginSubmitBtn) {
                loginSubmitBtn.disabled = false;
                loginSubmitBtn.textContent = "Login";
            }
        });
}

async function forgotPassword() {
    const emailInput = document.getElementById("login-email");
    const errorEl = document.getElementById("auth-error");
    const email = emailInput ? emailInput.value.trim() : "";
    const supportEmail = "sharkdle.online@gmail.com";

    if (!errorEl) {
        showNotification(`Password reset is unavailable right now. Email ${supportEmail} for help.`, "error");
        return;
    }

    if (!email) {
        errorEl.textContent = "Enter your email first, then we'll send the reset link.";
        errorEl.style.display = "block";
        return;
    }

    try {
        await auth.sendPasswordResetEmail(email);
        errorEl.style.display = "none";
        showNotification(`Password reset email sent. Check your inbox. If it does not arrive, email ${supportEmail}.`, "success");
    } catch (error) {
        const message = error.message || "Unable to send reset email.";
        errorEl.textContent = `${message} If you need help, email ${supportEmail}.`;
        errorEl.style.display = "block";
        showNotification(`Password reset failed. Email ${supportEmail} for help.`, "error");
    }
}

async function signupUser() {
    const emailInput = document.getElementById("signup-email");
    const passwordInput = document.getElementById("signup-password");
    const usernameInput = document.getElementById("signup-username");
    const errorEl = document.getElementById("auth-error");
    const signupSubmitBtn = document.querySelector(".signup-form .modal-primary-btn");
    const email = emailInput ? emailInput.value.trim() : "";
    const password = passwordInput ? passwordInput.value : "";
    const username = usernameInput ? usernameInput.value.trim() : "";

    if (!emailInput || !passwordInput || !usernameInput || !errorEl) {
        showNotification("Signup form is unavailable right now.", "error");
        return;
    }

    if (!email || !password || !username) {
        errorEl.textContent = "Please fill in all fields.";
        errorEl.style.display = "block";
        return;
    }

    if (password.length < 6) {
        errorEl.textContent = "Password must be at least 6 characters.";
        errorEl.style.display = "block";
        return;
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
        errorEl.textContent = "Please enter a valid email address.";
        errorEl.style.display = "block";
        return;
    }

    // Disable button during signup
    if (signupSubmitBtn) {
        signupSubmitBtn.disabled = true;
        signupSubmitBtn.textContent = "Creating account...";
    }

    try {
        // Check if email is already in use
        const methods = await auth.fetchSignInMethodsForEmail(email);
        if (methods.length > 0) {
            errorEl.textContent = "This email is already registered. Please try logging in instead.";
            errorEl.style.display = "block";
            return;
        }

        // Proceed with account creation
        const result = await auth.createUserWithEmailAndPassword(email, password);
        const userRef = db.collection("userStats").doc(result.user.uid);

        // Migrate local offline stats - check both new and old storage locations
        const rawLocalProfile = JSON.parse(localStorage.getItem("userProfile") || "{}");
        const localProfile = rawLocalProfile && !rawLocalProfile.uid ? rawLocalProfile : {};
        const _totalXP = localProfile.totalXP || parseInt(localStorage.getItem("totalXP")) || 0;
        const _gamesPlayed = localProfile.gamesPlayed || parseInt(localStorage.getItem("games")) || 0;
        const _wins = localProfile.wins || parseInt(localStorage.getItem("wins")) || 0;
        const _losses = localProfile.losses || parseInt(localStorage.getItem("losses")) || 0;
        const _totalGuesses = localProfile.totalGuesses || 0;
        const _averageGuesses = localProfile.averageGuesses || 0;
        const _bestGame = localProfile.bestGame || 0;
        const _currentStreak = localProfile.currentStreak || 0;
        const _highestStreak = localProfile.highestStreak || 0;
        const _loginProgress = getLoginProgressFromLocalStorage(result.user.uid);
        let _claimedAchievements = [];
        let _unlockedAchievements = [];
        let _showcasedAchievements = [];
        try {
            _claimedAchievements = JSON.parse(localStorage.getItem("claimedAchievements") || "[]");
            _unlockedAchievements = JSON.parse(localStorage.getItem("unlockedAchievements") || "[]");
            _showcasedAchievements = JSON.parse(localStorage.getItem("showcasedAchievements") || "[]");
        } catch (error) {
            console.warn("Unable to migrate local achievement cache during signup:", error);
        }

        const _currentLevel = getLevelFromXP(_totalXP);
        const _xpInLevel = getXPInCurrentLevel(_totalXP);
        const _xpToNext = getXPToNextLevel(_totalXP);
        const _unlockedPfps = levelRewards
            .filter(r => r.level <= _currentLevel)
            .map(r => ({ level: r.level, name: r.name || r.imagePath }));

        const newProfile = {
            uid: result.user.uid,
            profilePicture: localProfile.profilePicture || "images/pfp/shark1.png",
            profilePic: localProfile.profilePicture || "images/pfp/shark1.png",
            equippedBadge: localProfile.equippedBadge || "starter",
            equippedCardTheme: localProfile.equippedCardTheme || "default",
            equippedTitle: localProfile.equippedTitle || "",
            unlockedTitles: Array.isArray(localProfile.unlockedTitles) ? localProfile.unlockedTitles : [],
            unlockedBadges: Array.isArray(localProfile.unlockedBadges) ? localProfile.unlockedBadges : ["starter"],
            unlockedCardThemes: Array.isArray(localProfile.unlockedCardThemes) ? localProfile.unlockedCardThemes : ["default"],
            earnedCosmetics: Array.isArray(localProfile.earnedCosmetics) ? localProfile.earnedCosmetics : [],
            testerBadgeUnlocked: Boolean(localProfile.testerBadgeUnlocked),
            communityBossRewards: localProfile.communityBossRewards && typeof localProfile.communityBossRewards === "object"
                ? localProfile.communityBossRewards
                : {},
            referralRewards: localProfile.referralRewards && typeof localProfile.referralRewards === "object"
                ? localProfile.referralRewards
                : {},
            sharkPassMissionClaims: localProfile.sharkPassMissionClaims && typeof localProfile.sharkPassMissionClaims === "object"
                ? localProfile.sharkPassMissionClaims
                : {},
            sharkPassSeasonBaselines: localProfile.sharkPassSeasonBaselines && typeof localProfile.sharkPassSeasonBaselines === "object"
                ? localProfile.sharkPassSeasonBaselines
                : {},
            sharkPassLevelRewardClaims: [],
            sharkPassProgressSeasonId: getActiveSharkPassSeasonId(),
            sharkPassXP: 0,
            sharkPassSeasonId: getActiveSharkPassSeasonId(),
            crateInventory: normalizeCrateInventory(localProfile.crateInventory),
            crateInventoryUpdatedAt: getCrateInventoryUpdatedAt(localProfile),
            cratesOpened: Math.max(0, Number(localProfile.cratesOpened) || 0),
            streakShields: getStreakShieldCount(localProfile),
            instantCrateOpen: getCrateInstantOpenEnabled(localProfile),
            pearls: getPearlCount(localProfile) + SIGN_UP_BONUS_PEARLS,
            signUpBonusPearls: SIGN_UP_BONUS_PEARLS,
            signUpBonusClaimed: true,
            pearlBoostExpiresAt: getPearlBoostExpiresAt(localProfile),
            seasonXpBoosts: getSeasonXpBoosts(localProfile),
            username: username,
            email: email,
            avatar: "\u{1F988}",
            totalXP: _totalXP,
            gamesPlayed: _gamesPlayed,
            wins: _wins,
            losses: _losses,
            totalGuesses: _totalGuesses,
            averageGuesses: _averageGuesses,
            bestGame: _bestGame,
            currentStreak: _currentStreak,
            highestStreak: _highestStreak,
            currentLevel: _currentLevel,
            currentXP: _xpInLevel,
            xpToNextLevel: _xpToNext,
            unlockedPfps: _unlockedPfps,
            claimedAchievements: Array.isArray(_claimedAchievements) ? _claimedAchievements : [],
            unlockedAchievements: Array.isArray(_unlockedAchievements) ? _unlockedAchievements : [],
            showcasedAchievements: Array.isArray(_showcasedAchievements) ? _showcasedAchievements : [],
            redeemedCodes: getRedeemedCodes(),
            loginStreak: _loginProgress.loginStreak,
            currentLoginDay: _loginProgress.currentLoginDay,
            lastLoginDate: _loginProgress.lastLoginDate,
            dailyLoginModalShownToday: _loginProgress.dailyLoginModalShownToday,
            createdAt: new Date(),
            lastUpdated: new Date()
        };
        await userRef.set(newProfile);

        errorEl.style.display = "none";
        showNotification(`Account created! +${SIGN_UP_BONUS_PEARLS} pearls signup bonus.`, "success");
        closeLoginModal();
        loadUserProfile();
    } catch (error) {
        const message = getFriendlyAuthErrorMessage(error, "Account creation failed. Please try again.");
        errorEl.textContent = message;
        errorEl.style.display = "block";
        showNotification(message, 'error');
    } finally {
        if (signupSubmitBtn) {
            signupSubmitBtn.disabled = false;
            signupSubmitBtn.textContent = "Sign Up";
        }
    }
}

function logoutUser() {
    auth.signOut().then(() => {
        currentUser = null;
        clearPendingProfileSyncTimeout();
        clearCloudProfileReloadTimeouts();
        clearCachedProfileState();
        closeProfileModal();
        updateAuthUI();
    });
}

function openLoginModal() {
    const loginModal = document.getElementById("loginModal");
    if (loginModal) {
        switchToLogin();
        loginModal.classList.remove("hidden");
    }
}

function closeLoginModal() {
    const loginModal = document.getElementById("loginModal");
    if (loginModal) {
        loginModal.classList.add("hidden");
    }
    const loginEmail = document.getElementById("login-email");
    const loginPassword = document.getElementById("login-password");
    const signupEmail = document.getElementById("signup-email");
    const signupPassword = document.getElementById("signup-password");
    const signupUsername = document.getElementById("signup-username");
    const authError = document.getElementById("auth-error");
    if (loginEmail) loginEmail.value = "";
    if (loginPassword) loginPassword.value = "";
    if (signupEmail) signupEmail.value = "";
    if (signupPassword) signupPassword.value = "";
    if (signupUsername) signupUsername.value = "";
    if (authError) authError.style.display = "none";
    switchToLogin();
}

async function openProfileModal() {
    if (!currentUser) {
        openLoginModal();
        return;
    }

    const profileModal = document.getElementById("profileModal");
    if (!profileModal) {
        showNotification("Profile editing is available on the home page.", "info", 3000);
        return;
    }
    // Reload profile data when opening modal
    await loadUserProfile().catch(err => console.error("\u{274C} Error loading profile:", err));
    if (document.getElementById("username-edit-container")) {
        cancelUsernameEdit();
    }
    updateProfileBadgeUI();
    renderThemeSelection();
    renderTitleSelection();
    updateSeasonalThemeToggleUI();
    ensureAdminAbuseVisibility();
    await ensureFriendDocument(currentUser.uid).catch(err => console.error("Friend network init failed:", err));
    profileModal.classList.remove("hidden");
}

window.openLoginModal = openLoginModal;
window.closeLoginModal = closeLoginModal;
window.openProfileModal = openProfileModal;

async function openUserProfileModal(uid) {
    if (!uid || !currentUser) return;
    const modal = document.getElementById("friendProfileModal");
    if (!modal) {
        showNotification("Friend profiles are unavailable on this page.", "error", 3000);
        return;
    }
    const profileData = await getUserProfileForUid(uid);
    if (!profileData) {
        showNotification('Unable to load user profile', 'error', 3000);
        return;
    }
    updateFriendProfileDisplay(profileData, uid);
    modal.classList.remove("hidden");
}

function updateFriendProfileDisplay(profileData, uid) {
    const usernameEl = document.getElementById('friend-profile-username');
    const titleEl = document.getElementById('friend-profile-title');
    const uidEl = document.getElementById('friend-profile-uid');
    const picEl = document.getElementById('friend-profile-pic');
    const totalGuessesEl = document.getElementById('friend-profile-total-guesses');
    const gamesEl = document.getElementById('friend-profile-games');
    const winsEl = document.getElementById('friend-profile-wins');
    const lossesEl = document.getElementById('friend-profile-losses');
    const avgEl = document.getElementById('friend-profile-avg');
    const bestEl = document.getElementById('friend-profile-best');
    const currentEl = document.getElementById('friend-profile-current');
    const highestEl = document.getElementById('friend-profile-highest');

    if (usernameEl) usernameEl.textContent = profileData.username || uid;
    if (titleEl) {
        const equippedTitle = getEquippedProfileTitle(profileData);
        titleEl.textContent = equippedTitle ? getProfileTitleMeta(equippedTitle).name : "";
        titleEl.classList.toggle("hidden", !equippedTitle);
    }
    if (uidEl) uidEl.textContent = uid;
    if (picEl) picEl.src = profileData.profilePicture || "images/pfp/shark1.png";
    applyThemeToProfileCard('friend-profile-hero-card', profileData.equippedCardTheme || "default");

    const totalGuesses = profileData.totalGuesses ?? 0;
    const games = profileData.gamesPlayed ?? profileData.games ?? 0;
    const wins = profileData.wins ?? 0;
    const losses = profileData.losses ?? 0;

    if (totalGuessesEl) totalGuessesEl.textContent = totalGuesses;
    if (gamesEl) gamesEl.textContent = games;
    if (winsEl) winsEl.textContent = wins;
    if (lossesEl) lossesEl.textContent = losses;

    let avg = profileData.averageGuesses;
    if (typeof avg !== "number") avg = Number(avg);
    if (isNaN(avg)) avg = 0;
    if (avgEl) avgEl.textContent = avg.toFixed(2);

    if (bestEl) bestEl.textContent = profileData.bestGame ?? 0;
    if (currentEl) currentEl.textContent = profileData.currentStreak ?? 0;
    if (highestEl) highestEl.textContent = profileData.highestStreak ?? 0;
    const requestId = ++latestFriendLeaderboardRequest;
    fetchLeaderboardPlacement(uid).then(rank => {
        if (requestId !== latestFriendLeaderboardRequest) return;
        applyLeaderboardBadge('friend-profile-leaderboard-badge', rank);
    });
}

function closeProfileModal() {
    const profileModal = document.getElementById("profileModal");
    if (profileModal) {
        profileModal.classList.add("hidden");
    }
}

function ensureAdminAbuseVisibility() {
    const adminBtn = document.getElementById("open-admin-abuse-btn");
    if (!adminBtn) return;

    const isDeveloper = Boolean(currentUser && isDeveloperUid(currentUser.uid));
    adminBtn.classList.toggle("hidden", !isDeveloper);
}

function openAdminAbuseModal() {
    if (!currentUser || !isDeveloperUid(currentUser.uid)) {
        showNotification("Developer access is required for Admin Abuse.", "error", 3400);
        return;
    }
    const modal = document.getElementById("adminAbuseModal");
    if (!modal) return;
    modal.classList.remove("hidden");
    if (typeof refreshAdminAbusePanel === "function") {
        refreshAdminAbusePanel().catch(error => {
            console.warn("Unable to load admin abuse panel state:", error);
        });
    }
}

function closeAdminAbuseModal() {
    const modal = document.getElementById("adminAbuseModal");
    if (modal) {
        modal.classList.add("hidden");
    }
}

function openBadgeModal() {
    if (!currentUser) return;
    const modal = document.getElementById("badgeModal");
    if (!modal) {
        showNotification("Badges are unavailable on this page.", "error", 3000);
        return;
    }
    renderBadgeSelection();
    modal.classList.remove("hidden");
}

function closeBadgeModal() {
    document.getElementById("badgeModal")?.classList.add("hidden");
}

function closeFriendProfileModal() {
    document.getElementById("friendProfileModal")?.classList.add("hidden");
}

async function refreshProfilePicPicker() {
    await loadEarnedCosmetics();
    renderProfilePicPicker();
}

function openProfilePicModal() {
    const modal = document.getElementById("profilePicModal");
    if (!modal) return;

    pfpPickerFilter = "all";
    pfpPickerSearchQuery = "";
    const searchInput = document.getElementById("pfp-picker-search");
    if (searchInput) searchInput.value = "";
    document.querySelectorAll("#pfp-picker-tabs .picker-modal-tab").forEach(tab => {
        const isAll = tab.dataset.pfpFilter === "all";
        tab.classList.toggle("active", isAll);
        tab.setAttribute("aria-selected", isAll ? "true" : "false");
    });

    const showModal = () => {
        renderProfilePicPicker();
        modal.classList.remove("hidden");
    };

    if (typeof loadUserProfile === "function") {
        loadUserProfile()
            .then(() => refreshProfilePicPicker().then(showModal))
            .catch(() => refreshProfilePicPicker().then(showModal));
        return;
    }

    refreshProfilePicPicker().then(showModal);
}

function closeProfilePicModal() {
    document.getElementById("profilePicModal")?.classList.add("hidden");
}

function switchToLogin() {
    const loginForm = document.querySelector(".login-form");
    const signupForm = document.querySelector(".signup-form");
    if (loginForm) loginForm.classList.remove("hidden");
    if (signupForm) signupForm.classList.add("hidden");
}

function switchToSignup() {
    const loginForm = document.querySelector(".login-form");
    const signupForm = document.querySelector(".signup-form");
    if (loginForm) loginForm.classList.add("hidden");
    if (signupForm) signupForm.classList.remove("hidden");
}

async function setProfilePicture(picturePath) {
    if (!currentUser) return;
    const safePicturePath = sanitizeProfilePicturePath(picturePath, "images/pfp/shark1.png");

    try {
        // Update localStorage immediately
        const profileData = getCurrentProfileData();
        profileData.profilePicture = safePicturePath;
        profileData.profilePic = safePicturePath;
        saveUserProfileLocally(profileData);

        // Update UI immediately
        const profilePic = document.getElementById("profile-pic");
        if (profilePic) profilePic.src = safePicturePath;
        const navProfilePic = document.getElementById("nav-profile-pic");
        if (navProfilePic) navProfilePic.src = safePicturePath;

        // Save to Firebase
        const statsRef = db.collection("userStats").doc(currentUser.uid);
        await statsRef.set({
            profilePicture: safePicturePath,
            profilePic: safePicturePath,
            lastUpdated: Date.now()
        }, { merge: true });

        updateProfilePicPickerPreview(safePicturePath);
        renderProfilePicPicker();
        renderProfileInventoryUI(profileData);
        const equippedEntry = findProfilePicCatalogEntry(buildProfilePicPickerCatalog(), safePicturePath);
        showNotification(`${equippedEntry?.name || "Portrait"} equipped.`, "success", 2400);
    } catch (error) {
        console.error("\u{274C} Error setting profile picture:", error);
        showNotification("Could not update profile picture. Try again.", "error", 3200);
    }
}

const STARTER_PROFILE_PFPS = [
    { filename: "shark1.png", name: "Whale Shark" },
    { filename: "shark2.png", name: "Great White Shark" },
    { filename: "shark3.png", name: "Hammerhead Shark" },
    { filename: "shark4.png", name: "Basking Shark" },
    { filename: "shark5.png", name: "Zebra Shark" }
];

const PFP_RARITY_ORDER = ["core", "common", "rare", "epic", "legendary", "special"];
let pfpPickerFilter = "all";
let pfpPickerSearchQuery = "";
let pfpPickerControlsBound = false;

function inferPfpRarityFromPath(imagePath = "") {
    if (/leaderPfp\/Shark19\.png$/i.test(imagePath)) return "legendary";
    if (/leaderPfp\/(Daily|Monthly)\//i.test(imagePath)) return "rare";
    if (/loginPfp\/Login2\/BarndoorSkate\.png$/i.test(imagePath)) return "rare";
    if (/loginPfp/i.test(imagePath) || imagePath === SPIN_WHEEL_LEGENDARY_PFP.imagePath) return "legendary";
    if (/codePfp/i.test(imagePath)) return "special";
    if (/levelPfp\/Shark16\.png$/i.test(imagePath)) return "legendary";
    if (/levelPfp\/Shark1[2-5]\.png$/i.test(imagePath)) return "epic";
    if (/levelPfp/i.test(imagePath)) return "common";
    const seasonalMatch = imagePath.match(/cratePfp\/(?:SummerPfp|ChristmasPfp|HalloweenPfp)\/Shark([1-4])\.png$/i);
    if (seasonalMatch) {
        return ({ 1: "common", 2: "rare", 3: "epic", 4: "legendary" })[Number(seasonalMatch[1])] || "common";
    }
    if (/cratePfp\/cosmeticCrate2\/CobblerWobbegong\.png$/i.test(imagePath)) return "common";
    if (/cratePfp\/cosmeticCrate2\/JapaneseSawShark\.png$/i.test(imagePath)) return "rare";
    if (/cratePfp\/cosmeticCrate2\/PelagicStingray\.png$/i.test(imagePath)) return "epic";
    if (/cratePfp\/cosmeticCrate2\/WhiptailStingray\.png$/i.test(imagePath)) return "legendary";
    if (/cratePfp\/Shark24\.png$/i.test(imagePath)) return "common";
    if (/cratePfp\/Shark25\.png$/i.test(imagePath)) return "rare";
    if (/cratePfp\/Shark23\.png$/i.test(imagePath)) return "epic";
    if (/cratePfp\/Shark22\.png$/i.test(imagePath)) return "legendary";
    if (/cratePfp/i.test(imagePath)) return "rare";
    if (/images\/pfp\//i.test(imagePath)) return "core";
    return "common";
}

function getPfpRarityLabel(rarity) {
    return ({
        core: "Starter",
        common: "Common",
        rare: "Rare",
        epic: "Epic",
        legendary: "Legendary",
        special: "Special"
    })[rarity] || "Common";
}

function getPfpCategoryLabel(category) {
    return ({
        starter: "Starter",
        pass: "Shark Pass",
        reward: "Reward",
        crate: "Crate"
    })[category] || "Portrait";
}

function getSharkPassRewardSourceLabel(reward = null, fallbackLevel = null) {
    const level = reward?.level ?? fallbackLevel;
    const levelCopy = Number.isFinite(Number(level)) ? ` Lv. ${level}` : "";
    if (reward && sharkPassRewards.includes(reward)) return `Shark Pass 2${levelCopy}`;
    return `Shark Pass 1${levelCopy}`;
}

function getPassNumberFromSource(source = "") {
    const lower = String(source || "").toLowerCase();
    if (lower.includes("shark pass 2") || lower.includes("pass 2")) return 2;
    if (lower.includes("shark pass 1") || lower.includes("pass 1")) return 1;
    return 99;
}

function getCosmeticPassSortMeta(item = {}) {
    const source = item.source || "";
    const parsedLevel = String(source).match(/(?:lv\.?|level)\s*(\d+)/i);
    const passLevel = Number(item.passLevel ?? item.levelRequired ?? item.level ?? parsedLevel?.[1]);
    const passNumber = Number(item.passNumber ?? getPassNumberFromSource(source));
    return {
        passLevel: Number.isFinite(passLevel) ? passLevel : Number.MAX_SAFE_INTEGER,
        passNumber: Number.isFinite(passNumber) ? passNumber : 99
    };
}

function isPassCosmetic(item = {}) {
    return normalizeCosmeticFilterValue(item.category) === "pass" || String(item.source || "").toLowerCase().includes("pass");
}

function getCrateSourceLabelFromPath(imagePath = "") {
    const path = String(imagePath || "");
    if (/cratePfp\/SummerPfp/i.test(path)) return "Summer Crate";
    if (/cratePfp\/ChristmasPfp/i.test(path)) return "Christmas Crate";
    if (/cratePfp\/HalloweenPfp/i.test(path)) return "Halloween Crate";
    if (/cratePfp\/cosmeticCrate2/i.test(path)) return "Cosmetic Crate 2";
    if (/cratePfp/i.test(path)) return "Cosmetic Crate 1";
    return "Cosmetic Crate";
}

function getCrateRewardSourceLabel(reward = {}) {
    const id = String(reward?.id || "");
    if (/summer/i.test(id)) return "Summer Crate";
    if (/christmas/i.test(id)) return "Christmas Crate";
    if (/halloween/i.test(id)) return "Halloween Crate";
    if (reward?.imagePath) return getCrateSourceLabelFromPath(reward.imagePath);
    if (legacyCrate1RewardPool.some(crateReward => crateReward.id === id)) return "Cosmetic Crate 1";
    if (summerCrateRewardPool.some(crateReward => crateReward.id === id)) return "Summer Crate";
    if (christmasCrateRewardPool.some(crateReward => crateReward.id === id)) return "Christmas Crate";
    if (halloweenCrateRewardPool.some(crateReward => crateReward.id === id)) return "Halloween Crate";
    if (crateRewardPool.some(crateReward => crateReward.id === id)) return "Cosmetic Crate 2";
    return "Cosmetic Crate";
}

function getCosmeticSourceLabel(cosmetic = {}) {
    if (cosmetic.source) return cosmetic.source;
    if (isLeaderRewardPfp(cosmetic) || cosmetic.name === "Port Jackson Shark") return "All-time leaderboard top 3";
    if (/leaderPfp\/Daily/i.test(cosmetic.imagePath || "")) return "Daily leaderboard #1";
    if (/leaderPfp\/Monthly/i.test(cosmetic.imagePath || "")) return "Monthly leaderboard #1";
    if (/codePfp/i.test(cosmetic.imagePath || "")) return "Redeem code reward";
    if (/loginPfp\/Login2/i.test(cosmetic.imagePath || "")) return "Login Reward 2";
    if (/loginPfp/i.test(cosmetic.imagePath || "")) return "Login Reward 1";
    if ((cosmetic.imagePath || "") === SPIN_WHEEL_LEGENDARY_PFP.imagePath || cosmetic.spinReward) return "Daily win wheel";
    if (/cratePfp/i.test(cosmetic.imagePath || "")) return getCrateSourceLabelFromPath(cosmetic.imagePath);
    if (cosmetic.level) return getSharkPassRewardSourceLabel(null, cosmetic.level);
    return "Special reward";
}

function isCosmeticUnlocked(earnedCosmetics, imagePath, name) {
    return earnedCosmetics.some(cosmetic =>
        (imagePath && cosmetic?.imagePath === imagePath) ||
        (name && cosmetic?.name === name)
    );
}

function buildProfilePicPickerCatalog() {
    const profileData = getCurrentProfileData();
    const earnedCosmetics = Array.isArray(profileData.earnedCosmetics) ? profileData.earnedCosmetics : [];
    const accountXP = profileData.totalXP !== undefined
        ? profileData.totalXP
        : parseInt(localStorage.getItem("totalXP"), 10) || parseInt(localStorage.getItem("totalGuesses"), 10) || 0;
    const accountLevel = getLevelFromXP(accountXP);
    const passLevel = getCurrentPlayerLevel(profileData);
    const catalog = [];
    const seen = new Set();

    function addEntry(entry) {
        if (!entry?.imagePath || seen.has(entry.imagePath)) return;
        seen.add(entry.imagePath);
        catalog.push({
            imagePath: entry.imagePath,
            name: entry.name || "Shark",
            category: entry.category || "reward",
            source: entry.source || getCosmeticSourceLabel(entry),
            unlocked: entry.unlocked !== false,
            levelRequired: entry.levelRequired || null,
            passLevel: entry.passLevel ?? entry.levelRequired ?? entry.level ?? null,
            passNumber: entry.passNumber ?? getPassNumberFromSource(entry.source),
            rarity: entry.rarity || inferPfpRarityFromPath(entry.imagePath),
            isLeader: Boolean(entry.isLeader)
        });
    }

    STARTER_PROFILE_PFPS.forEach(pfp => {
        addEntry({
            imagePath: `images/pfp/${pfp.filename}`,
            name: pfp.name,
            category: "starter",
            source: "Starter shark",
            unlocked: true,
            rarity: "core"
        });
    });

    sharkPassRewards
        .filter(reward => reward.type === "pfp")
        .forEach(reward => {
            addEntry({
                imagePath: reward.imagePath,
                name: reward.name,
                category: "pass",
                source: getSharkPassRewardSourceLabel(reward),
                unlocked: passLevel >= reward.level || isCosmeticUnlocked(earnedCosmetics, reward.imagePath, reward.name),
                levelRequired: reward.level,
                passLevel: reward.level,
                passNumber: 2,
                rarity: reward.rarity || inferPfpRarityFromPath(reward.imagePath)
            });
        });

    levelRewards.forEach(reward => {
        addEntry({
            imagePath: reward.imagePath,
            name: reward.name,
            category: "pass",
            source: getSharkPassRewardSourceLabel(null, reward.level),
            unlocked: accountLevel >= reward.level || isCosmeticUnlocked(earnedCosmetics, reward.imagePath, reward.name),
            levelRequired: reward.level,
            passLevel: reward.level,
            passNumber: 1,
            rarity: inferPfpRarityFromPath(reward.imagePath)
        });
    });

    const specialRewardDefs = [
        { imagePath: "images/codePfp/Shark17.png", name: "Wobbegong Shark", source: "Redeem code reward" },
        { imagePath: "images/codePfp/Shark18.png", name: "Greenland Shark", source: "Redeem code reward" },
        { imagePath: "images/codePfp/Shark19.png", name: "Goblin Shark", source: "Redeem code reward" },
        { imagePath: "images/codePfp/Shark26.png", name: "Hammerhead Shark", source: "Anniversary code reward" },
        { imagePath: "images/codePfp/MantaRay.png", name: "Manta Ray", source: "TikTok 2026 code reward" },
        { imagePath: "images/codePfp/WhitespottedEagleRay.png", name: "Whitespotted Eagle Ray", source: "Instagram 2026 code reward" },
        { imagePath: "images/leaderPfp/Daily/Shark1.png", name: "Catshark", source: "Daily leaderboard #1" },
        { imagePath: "images/leaderPfp/Monthly/Shark1.png", name: "Whitetip Reef Shark", source: "Monthly leaderboard #1" },
        { imagePath: "images/leaderPfp/Shark19.png", name: "Port Jackson Shark", source: "All-time leaderboard top 3", isLeader: true },
        { imagePath: SPIN_WHEEL_LEGENDARY_PFP.imagePath, name: SPIN_WHEEL_LEGENDARY_PFP.name, source: "Daily win wheel" },
        { imagePath: "images/loginPfp/Login2/BarndoorSkate.png", name: "Barndoor Skate", source: "Login Reward 2" },
        { imagePath: "images/loginPfp/Shark20.png", name: "Bull Shark", source: "Login Reward 1" }
    ];

    specialRewardDefs.forEach(def => {
        if (!isCosmeticUnlocked(earnedCosmetics, def.imagePath, def.name)) return;
        addEntry({
            ...def,
            category: "reward",
            unlocked: true,
            rarity: inferPfpRarityFromPath(def.imagePath)
        });
    });

    getAllCrateRewardPools()
        .flat()
        .filter(reward => reward.type === "pfp")
        .forEach(reward => {
            if (!isCosmeticUnlocked(earnedCosmetics, reward.imagePath, reward.name)) return;
            addEntry({
                imagePath: reward.imagePath,
                name: reward.name,
                category: "crate",
                source: getCrateRewardSourceLabel(reward),
                unlocked: true,
                rarity: reward.rarity || inferPfpRarityFromPath(reward.imagePath)
            });
        });

    earnedCosmetics.forEach(cosmetic => {
        if (!cosmetic?.imagePath || seen.has(cosmetic.imagePath) || /^images\/pfp\//i.test(cosmetic.imagePath)) {
            return;
        }
        const category = /cratePfp/i.test(cosmetic.imagePath) ? "crate" : "reward";
        addEntry({
            imagePath: cosmetic.imagePath,
            name: getCosmeticDisplayName(cosmetic) || cosmetic.name || "Shark",
            category,
            source: getCosmeticSourceLabel(cosmetic),
            unlocked: true,
            levelRequired: cosmetic.level || null,
            rarity: inferPfpRarityFromPath(cosmetic.imagePath),
            isLeader: isLeaderRewardPfp(cosmetic) || cosmetic.name === "Port Jackson Shark"
        });
    });

    return catalog.sort((a, b) => {
        if (a.unlocked !== b.unlocked) return a.unlocked ? -1 : 1;
        const rarityDiff = PFP_RARITY_ORDER.indexOf(a.rarity) - PFP_RARITY_ORDER.indexOf(b.rarity);
        if (rarityDiff !== 0) return rarityDiff;
        if (a.category !== b.category) return a.category.localeCompare(b.category);
        return a.name.localeCompare(b.name);
    });
}

function getEquippedProfilePicturePath() {
    const profileData = getCurrentProfileData();
    return profileData.profilePicture || profileData.profilePic || "images/pfp/shark1.png";
}

function findProfilePicCatalogEntry(catalog, imagePath) {
    return catalog.find(entry => entry.imagePath === imagePath) || null;
}

function updateProfilePicPickerPreview(imagePath = getEquippedProfilePicturePath()) {
    const previewImg = document.getElementById("pfp-picker-preview-img");
    const previewName = document.getElementById("pfp-picker-preview-name");
    const previewSource = document.getElementById("pfp-picker-preview-source");
    const previewCrown = document.getElementById("pfp-picker-preview-crown");
    if (!previewImg || !previewName || !previewSource) return;

    const catalog = buildProfilePicPickerCatalog();
    const entry = findProfilePicCatalogEntry(catalog, imagePath);
    previewImg.src = imagePath;
    previewName.textContent = entry?.name || "Shark";
    previewSource.textContent = entry?.source || "Profile portrait";
    if (previewCrown) {
        previewCrown.classList.toggle("hidden", !entry?.isLeader);
    }
}

function bindProfilePicPickerControls() {
    if (pfpPickerControlsBound) return;
    pfpPickerControlsBound = true;

    const searchInput = document.getElementById("pfp-picker-search");
    if (searchInput) {
        searchInput.addEventListener("input", () => {
            pfpPickerSearchQuery = searchInput.value.trim().toLowerCase();
            renderProfilePicPicker();
        });
    }

    const tabs = document.getElementById("pfp-picker-tabs");
    if (tabs) {
        tabs.addEventListener("click", event => {
            const button = event.target.closest("[data-pfp-filter]");
            if (!button) return;
            pfpPickerFilter = button.dataset.pfpFilter || "all";
            tabs.querySelectorAll(".picker-modal-tab").forEach(tab => {
                const isActive = tab === button;
                tab.classList.toggle("active", isActive);
                tab.setAttribute("aria-selected", isActive ? "true" : "false");
            });
            renderProfilePicPicker();
        });
    }
}

function renderProfilePicPicker() {
    const grid = document.getElementById("pfp-picker-grid");
    if (!grid) return;

    bindProfilePicPickerControls();

    const catalog = buildProfilePicPickerCatalog();
    const equippedPath = getEquippedProfilePicturePath();
    const filtered = catalog.filter(entry => {
        const matchesFilter = pfpPickerFilter === "all" || entry.category === pfpPickerFilter;
        const matchesSearch = !pfpPickerSearchQuery ||
            entry.name.toLowerCase().includes(pfpPickerSearchQuery) ||
            entry.source.toLowerCase().includes(pfpPickerSearchQuery);
        return matchesFilter && matchesSearch;
    });

    const unlockedCount = catalog.filter(entry => entry.unlocked).length;
    const countEl = document.getElementById("pfp-picker-count");
    const unlockedEl = document.getElementById("pfp-picker-unlocked-count");
    const emptyEl = document.getElementById("pfp-picker-empty");
    if (countEl) countEl.textContent = `${filtered.length} shown`;
    if (unlockedEl) unlockedEl.textContent = `${unlockedCount} unlocked`;
    if (emptyEl) emptyEl.classList.toggle("hidden", filtered.length > 0);

    updateProfilePicPickerPreview(equippedPath);
    grid.innerHTML = "";

    filtered.forEach(entry => {
        const card = document.createElement("button");
        card.type = "button";
        card.className = `pfp-option rarity-${entry.rarity}${entry.unlocked ? "" : " pfp-option-locked"}`;
        if (entry.imagePath === equippedPath) card.classList.add("active");
        card.title = entry.unlocked
            ? `${entry.name} \u2014 ${entry.source}`
            : `Unlock at Shark Pass level ${entry.levelRequired}`;

        card.innerHTML = `
            <span class="pfp-option-kicker">${getPfpCategoryLabel(entry.category)}</span>
            <span class="pfp-option-frame rarity-${entry.rarity}${entry.isLeader ? " is-leader" : ""}">
                ${entry.isLeader ? '<span class="pfp-option-crown">\u{1F451}</span>' : ""}
                <img src="${entry.imagePath}" alt="${entry.name}" loading="lazy" onerror="this.onerror=null;this.src='images/pfp/shark1.png';">
                ${entry.unlocked ? "" : '<span class="pfp-option-lock" aria-hidden="true">\u{1F512}</span>'}
            </span>
            <span class="pfp-option-name">${entry.name}</span>
            <span class="pfp-option-rarity rarity-${entry.rarity}">${entry.unlocked ? getPfpRarityLabel(entry.rarity) : `Lv. ${entry.levelRequired}`}</span>
        `;

        card.addEventListener("click", () => {
            if (!entry.unlocked) {
                showNotification(`Reach Shark Pass level ${entry.levelRequired} to unlock ${entry.name}.`, "info", 3200);
                return;
            }
            setProfilePicture(entry.imagePath);
        });

        grid.appendChild(card);
    });
}

const LEADER_REWARD_PFP_NAMES = {
    "images/leaderPfp/Daily/Shark1.png": "Catshark",
    "images/leaderPfp/Monthly/Shark1.png": "Whitetip Reef Shark",
    "images/leaderPfp/Shark19.png": "Port Jackson Shark",
    [SPIN_WHEEL_LEGENDARY_PFP.imagePath]: SPIN_WHEEL_LEGENDARY_PFP.name
};

function getCosmeticDisplayName(cosmetic) {
    if (!cosmetic) return "";
    return LEADER_REWARD_PFP_NAMES[cosmetic.imagePath] || cosmetic.name || "";
}

function isLeaderRewardPfp(cosmetic) {
    return /leaderPfp/i.test(cosmetic?.imagePath || "");
}

function loadAvailablePFPs() {
    renderProfilePicPicker();
}

async function loadEarnedCosmetics() {
    if (!currentUser) return;

    try {
        // first, try to fetch the unlockedPfps array directly from userStats
        let unlocked = [];
        let specialCosmetics = [];
        const statsDoc = await db.collection('userStats').doc(currentUser.uid).get();
        if (statsDoc.exists && Array.isArray(statsDoc.data().unlockedPfps)) {
            unlocked = statsDoc.data().unlockedPfps.slice(); // copy
        }
        if (statsDoc.exists && Array.isArray(statsDoc.data().earnedCosmetics)) {
            specialCosmetics = statsDoc.data().earnedCosmetics.filter(cos =>
                !levelRewards.some(reward => reward.name === cos.name)
            );
        }

        // make sure every item has an imagePath; fall back to global levelRewards
        unlocked = unlocked.map(entry => {
            if (!entry.imagePath) {
                const match = levelRewards.find(r => r.level === entry.level || r.name === entry.name);
                if (match) {
                    entry.imagePath = match.imagePath;
                }
            }
            return entry;
        });

        // fallback: if nothing stored yet, compute by level so that offline users still see something
        if (unlocked.length === 0) {
            const profileData = getCurrentProfileData();
            const totalXP = profileData.totalXP !== undefined ? profileData.totalXP : parseInt(localStorage.getItem("totalXP")) || (profileData.totalGuesses || 0);
            const userLevel = getLevelFromXP(totalXP);

            unlocked = levelRewards
                .filter(r => r.level <= userLevel)
                .map(r => ({ level: r.level, name: r.name, imagePath: r.imagePath }));
        }

        const localProfile = getCurrentProfileData();
        if (Array.isArray(localProfile.earnedCosmetics)) {
            localProfile.earnedCosmetics.forEach(cosmetic => {
                const isSpecial = !levelRewards.some(reward => reward.name === cosmetic.name);
                if (isSpecial && !specialCosmetics.some(existing => existing.name === cosmetic.name || existing.imagePath === cosmetic.imagePath)) {
                    specialCosmetics.push(cosmetic);
                }
            });
        }

        const mergedUnlocked = [...unlocked];
        specialCosmetics.forEach(cosmetic => {
            if (!mergedUnlocked.some(existing => existing.name === cosmetic.name || existing.imagePath === cosmetic.imagePath)) {
                mergedUnlocked.push(cosmetic);
            }
        });

        // save locally so other parts of the app can use it
        const profileData = getCurrentProfileData();
        profileData.earnedCosmetics = mergedUnlocked;
        saveUserProfileLocally(profileData, { skipRemoteSync: true });

        if (document.getElementById("pfp-picker-grid")) {
            renderProfilePicPicker();
        }
    } catch (error) {
        console.error("\u{274C} Error loading earned cosmetics:", error);
    }
}


// Save stats to Firebase when they update
async function syncEarnedCosmetics() {
    if (!currentUser) return;

    try {
        const totalXP = parseInt(localStorage.getItem("totalXP")) || parseInt(localStorage.getItem("totalGuesses")) || 0;
        const userLevel = getLevelFromXP(totalXP);

        // Get level-based cosmetics
        const levelCosmetics = levelRewards.filter(reward => reward.level <= userLevel);

        // Get existing special cosmetics from Firebase/localStorage
        let specialCosmetics = [];
        const profileData = getCurrentProfileData();
        const existingEarnedCosmetics = Array.isArray(profileData.earnedCosmetics) ? profileData.earnedCosmetics : [];
        if (Array.isArray(profileData.earnedCosmetics)) {
            specialCosmetics = profileData.earnedCosmetics.filter(cos => !levelRewards.some(lr => lr.name === cos.name));
        }

        const newlyUnlockedLevelCosmetics = levelCosmetics.filter(reward =>
            !existingEarnedCosmetics.some(existing => existing.name === reward.name || existing.imagePath === reward.imagePath)
        );

        // Merge level and special cosmetics, avoiding duplicates
        const earnedCosmetics = [...levelCosmetics];
        specialCosmetics.forEach(special => {
            if (!earnedCosmetics.some(ec => ec.name === special.name)) {
                earnedCosmetics.push(special);
            }
        });

        // Update Firebase with merged cosmetics
        const statsRef = db.collection("userStats").doc(currentUser.uid);
        await statsRef.set({ earnedCosmetics: earnedCosmetics }, { merge: true });

        profileData.earnedCosmetics = earnedCosmetics;
        saveUserProfileLocally(profileData);

        // Reload earned cosmetics display if modal is open
        loadEarnedCosmetics();

        newlyUnlockedLevelCosmetics.forEach(cosmetic => {
            showCosmeticUnlockToast(cosmetic, {
                title: "Shark Pass Reward Unlocked!",
                subtitle: `${cosmetic.name} profile picture`,
                accent: "#61e7ff",
                background: "linear-gradient(135deg, rgba(0, 180, 216, 0.96), rgba(9, 49, 74, 0.96))",
                icon: "\u{1F988}"
            });
        });
    } catch (error) {
        console.error("\u{274C} Error syncing earned cosmetics:", error);
    }
}

// Save stats to Firebase when they update
async function syncStatsToFirebase() {
    const authUser = firebase.auth().currentUser;
    if (!authUser) return;
    if (!currentUser || currentUser.uid !== authUser.uid) {
        console.warn("Skipping sync: auth state mismatch during account transition.");
        scheduleRemoteProfileSync(800);
        return;
    }
    if (lastServerHydratedProfileUid !== authUser.uid) {
        console.warn("Skipping sync: waiting for server profile hydration.");
        loadCloudStats().catch(error => console.warn("Hydration retry failed:", error));
        scheduleRemoteProfileSync(1200);
        return;
    }

    // Prevent race condition: queue sync if one is already in progress
    if (isSyncing) {
        console.log('Sync already in progress, queueing...');
        syncQueue.push(() => syncStatsToFirebase());
        return;
    }

    isSyncing = true;
    try {
        const profileData = getBestLocalProfile();

        const statsRef = db.collection("userStats").doc(authUser.uid);
        const { snapshot: remoteSnap, fromServer } = await getUserStatsSnapshot(statsRef);
        const remoteData = remoteSnap.exists ? (remoteSnap.data() || {}) : {};
        const remoteHasData = remoteSnap.exists && Object.keys(remoteData).length > 0;

        // Server reads can occasionally fall back to cache. Continue syncing with
        // merge-safe logic so leaderboard period counters still update after wins.
        if (!fromServer) {
            console.warn("Proceeding with cache-backed userStats snapshot during sync.");
        }

        // If remote appears empty, only allow sync when local has meaningful numeric progress.
        // This prevents identity-only local profiles from pushing zeroed stats.
        if (!remoteHasData && !hasMeaningfulProfileData(profileData) && !hasPersistedProfileIdentity(profileData)) {
            console.warn("Skipping sync: remote profile empty and local profile has no meaningful stats.");
            scheduleRemoteProfileSync(3000);
            return;
        }

        const localRecoveryScore = getProfileRecoveryScore(profileData);
        const remoteRecoveryScore = getProfileRecoveryScore(remoteData);
        if (fromServer && remoteHasData && remoteRecoveryScore > Math.max(localRecoveryScore + 1000, localRecoveryScore * 2)) {
            console.warn("Skipping sync: Firestore profile is stronger than local cache. Restoring local cache from Firestore.");
            const recoveredProfile = mergeProfilesSafely({}, remoteData, { preferRemote: true });
            storeLoginProgressLocally(recoveredProfile, authUser.uid);
            saveUserProfileLocally(recoveredProfile, { skipRemoteSync: true, preserveLastUpdated: true });
            await syncFullUserProfileToFirebase(recoveredProfile);
            updateProfileDisplay(recoveredProfile);
            updateIndexStats();
            return;
        }

        // Never let a fresh/blank local cache clobber a real Firestore profile.
        if (!hasMeaningfulProfileData(profileData) && hasRecoverableRemoteProfile(remoteData)) {
            const recoveredProfile = mergeProfilesSafely({}, remoteData, { preferRemote: true });
            storeLoginProgressLocally(recoveredProfile, authUser.uid);
            saveUserProfileLocally(recoveredProfile, { skipRemoteSync: true, preserveLastUpdated: true });
            await syncFullUserProfileToFirebase(recoveredProfile);
            updateProfileDisplay(recoveredProfile);
            updateIndexStats();
            return;
        }

        // Don't sync if localStorage has no real stats and Firestore is also empty.
        if (!hasMeaningfulProfileData(profileData) && !hasPersistedProfileIdentity(profileData)) {
            console.log("Skipping sync: no meaningful local profile data");
            return;
        }

        // Local profile is the candidate being synced; remote-only preference here would discard fresh wins/progress before upload.
        const mergedProfile = mergeProfilesSafely(profileData, remoteData, { preferRemote: false });
        const mergedClaimedAchievements = getMergedUniqueIds(
            JSON.parse(localStorage.getItem("claimedAchievements") || "[]"),
            remoteData.claimedAchievements
        );
        const mergedUnlockedAchievements = getMergedUniqueIds(
            JSON.parse(localStorage.getItem("unlockedAchievements") || "[]"),
            remoteData.unlockedAchievements
        );
        const mergedShowcasedAchievements = getMergedUniqueIds(
            JSON.parse(localStorage.getItem("showcasedAchievements") || "[]"),
            remoteData.showcasedAchievements,
            mergedProfile.showcasedAchievements
        ).filter(achievementId => mergedClaimedAchievements.includes(achievementId)).slice(0, PROFILE_ACHIEVEMENT_SHOWCASE_LIMIT);
        const mergedLoginProgress = mergeLoginProgress(getLoginProgressFromLocalStorage(authUser.uid), remoteData);
        storeLoginProgressLocally(mergedLoginProgress, authUser.uid);
        mergedProfile.showcasedAchievements = mergedShowcasedAchievements;

        // base stats
        const stats = {
            uid: authUser.uid,
            email: authUser.email,
            avatar: mergedProfile.avatar || "\u{1F988}",
            totalXP: mergedProfile.totalXP || 0,
            games: mergedProfile.gamesPlayed || 0,
            // keep totalGuesses for backwards compatibility/analytics
            totalGuesses: mergedProfile.totalGuesses || 0,
            gamesPlayed: mergedProfile.gamesPlayed || 0,
            wins: mergedProfile.wins || 0,
            losses: mergedProfile.losses || 0,
            averageGuesses: mergedProfile.averageGuesses || 0,
            bestGame: mergedProfile.bestGame || 0,
            currentStreak: mergedProfile.currentStreak || 0,
            currentLossStreak: mergedProfile.currentLossStreak || 0,
            highestStreak: mergedProfile.highestStreak || 0,
            duelGames: mergedProfile.duelGames || 0,
            duelWins: mergedProfile.duelWins || 0,
            cratesOpened: mergedProfile.cratesOpened || 0,
            cratesSinceLegendary: getCratesSinceLegendary(mergedProfile),
            streakShields: getStreakShieldCount(mergedProfile),
            instantCrateOpen: getCrateInstantOpenEnabled(mergedProfile),
            pearls: getPearlCount(mergedProfile),
            pearlBoostExpiresAt: getPearlBoostExpiresAt(mergedProfile),
            seasonXpBoosts: getSeasonXpBoosts(mergedProfile),
            username: mergedProfile.username || getStoredPreferredUsername() || authUser.email.split("@")[0],
            profilePic: mergedProfile.profilePicture || "images/pfp/shark1.png",
            profilePicture: mergedProfile.profilePicture || "images/pfp/shark1.png",
            earnedCosmetics: removeLegacyWheelSharkCosmetics(mergedProfile.earnedCosmetics),
            testerBadgeUnlocked: Boolean(mergedProfile.testerBadgeUnlocked),
            unlockedTitles: getUnlockedProfileTitleIds(mergedProfile),
            equippedTitle: getEquippedProfileTitle(mergedProfile),
            communityBossRewards: mergedProfile.communityBossRewards && typeof mergedProfile.communityBossRewards === "object"
                ? mergedProfile.communityBossRewards
                : {},
            referralRewards: mergedProfile.referralRewards && typeof mergedProfile.referralRewards === "object"
                ? mergedProfile.referralRewards
                : {},
            socialRewardsClaimed: getClaimedSocialRewards(mergedProfile),
            lostTreasures: mergeLostTreasuresStates(mergedProfile, remoteData),
            sharkPassMissionClaims: mergedProfile.sharkPassMissionClaims && typeof mergedProfile.sharkPassMissionClaims === "object"
                ? mergedProfile.sharkPassMissionClaims
                : {},
            sharkPassSeasonBaselines: mergedProfile.sharkPassSeasonBaselines && typeof mergedProfile.sharkPassSeasonBaselines === "object"
                ? mergedProfile.sharkPassSeasonBaselines
                : {},
            sharkPassLevelRewardClaims: Array.isArray(mergedProfile.sharkPassLevelRewardClaims)
                ? mergedProfile.sharkPassLevelRewardClaims
                : [],
            sharkPassProgressSeasonId: mergedProfile.sharkPassProgressSeasonId || SHARK_PASS_ACTIVE_SEASON_ID,
            sharkPassXP: Math.max(0, Number(mergedProfile.sharkPassXP) || 0),
            sharkPassSeasonId: mergedProfile.sharkPassSeasonId || SHARK_PASS_ACTIVE_SEASON_ID,
            crateInventory: normalizeCrateInventory(mergedProfile.crateInventory),
            crateInventoryUpdatedAt: getCrateInventoryUpdatedAt(mergedProfile),
            lastUpdated: new Date()
        };

        const currentWins = Number(mergedProfile.wins) || 0;
        const remoteWinsParsed = Number(remoteData.wins);
        const hasReliableRemoteWins = Number.isFinite(remoteWinsParsed);
        const remoteWins = hasReliableRemoteWins ? remoteWinsParsed : currentWins;
        const winsDelta = Math.max(0, currentWins - remoteWins);
        const todayKey = getUtcDateKey();
        const monthKey = getUtcMonthKey();
        const remoteDailyWinsDate = normalizeStoredUtcDateValue(remoteData.dailyWinsUtcDate || remoteData.dailyWinsDate);
        const remoteMonthlyWinsKey = normalizeStoredUtcMonthValue(remoteData.monthlyWinsUtcKey || remoteData.monthlyWinsKey);
        const remoteDailyWins = Number(remoteData.dailyWins) || 0;
        const remoteMonthlyWins = Number(remoteData.monthlyWins) || 0;
        const localDailyWinsDate = normalizeStoredUtcDateValue(profileData.dailyWinsUtcDate || profileData.dailyWinsDate);
        const localMonthlyWinsKey = normalizeStoredUtcMonthValue(profileData.monthlyWinsUtcKey || profileData.monthlyWinsKey);
        const localDailyWins = Number(profileData.dailyWins) || 0;
        const localMonthlyWins = Number(profileData.monthlyWins) || 0;

        const remoteDailyBaseWins = remoteDailyWinsDate === todayKey ? remoteDailyWins : 0;
        const remoteMonthlyBaseWins = remoteMonthlyWinsKey === monthKey ? remoteMonthlyWins : 0;
        const localDailyBaseWins = localDailyWinsDate === todayKey ? localDailyWins : 0;
        const localMonthlyBaseWins = localMonthlyWinsKey === monthKey ? localMonthlyWins : 0;

        const computedDailyFromDelta = remoteDailyBaseWins + winsDelta;
        const computedMonthlyFromDelta = remoteMonthlyBaseWins + winsDelta;

        let nextDailyWins = Math.max(remoteDailyBaseWins, localDailyBaseWins, computedDailyFromDelta);
        let nextMonthlyWins = Math.max(remoteMonthlyBaseWins, localMonthlyBaseWins, computedMonthlyFromDelta);
        if (!Number.isFinite(nextDailyWins) || nextDailyWins < 0) nextDailyWins = 0;
        if (!Number.isFinite(nextMonthlyWins) || nextMonthlyWins < 0) nextMonthlyWins = 0;
        if (nextDailyWins > currentWins) nextDailyWins = currentWins;
        if (nextMonthlyWins > currentWins) nextMonthlyWins = currentWins;

        stats.dailyWins = nextDailyWins;
        stats.dailyWinsDate = todayKey;
        stats.dailyWinsUtcDate = todayKey;
        stats.monthlyWins = nextMonthlyWins;
        stats.monthlyWinsKey = monthKey;
        stats.monthlyWinsUtcKey = monthKey;
        stats.winPeriodVersion = 2;

        Object.assign(stats, buildCosmeticSyncPayload(mergedProfile));

        // shark pass related values
        const totalXP = mergedProfile.totalXP || 0;
        const currentLevel = getLevelFromXP(totalXP);
        const currentXP = getXPInCurrentLevel(totalXP);
        const xpToNextLevel = getXPToNextLevel(totalXP);
        const unlockedPfps = levelRewards
            .filter(r => r.level <= currentLevel)
            .map(r => ({ level: r.level, name: r.name || r.imagePath }));

        // attach them to stats object so firestore has dedicated fields
        stats.currentLevel = currentLevel;
        stats.currentXP = currentXP;
        stats.xpToNextLevel = xpToNextLevel;
        stats.unlockedPfps = unlockedPfps;

        // Sync achievements to Firebase
        stats.claimedAchievements = mergedClaimedAchievements;
        stats.unlockedAchievements = mergedUnlockedAchievements;
        stats.showcasedAchievements = mergedShowcasedAchievements;
        stats.redeemedCodes = getRedeemedCodes();
        stats.loginStreak = mergedLoginProgress.loginStreak;
        stats.currentLoginDay = mergedLoginProgress.currentLoginDay;
        const normalizedLastLoginDate = mergedLoginProgress.lastLoginDate;
        if (normalizedLastLoginDate) {
            localStorage.setItem("lastLoginDate", normalizedLastLoginDate);
        } else {
            localStorage.removeItem("lastLoginDate");
        }
        stats.lastLoginDate = normalizedLastLoginDate;
        const normalizedModalShownDate = mergedLoginProgress.dailyLoginModalShownToday;
        if (normalizedModalShownDate) {
            localStorage.setItem(getDailyLoginModalShownStorageKey(), normalizedModalShownDate);
        } else {
            localStorage.removeItem(getDailyLoginModalShownStorageKey());
        }
        stats.dailyLoginModalShownToday = normalizedModalShownDate;
        stats.lastSpinWheelDate = normalizeStoredDateValue(mergedProfile.lastSpinWheelDate);
        stats.dailySpinWinDate = normalizeStoredDateValue(mergedProfile.dailySpinWinDate);
        stats.dailySpinBonusSpins = normalizeDailySpinBonusCount(mergedProfile.dailySpinBonusSpins);

        // Save stats to userStats collection
        await statsRef.set(stats, { merge: true });

        Object.assign(mergedProfile, stats);
        await syncFullUserProfileToFirebase(mergedProfile);
        saveUserProfileLocally(mergedProfile, { skipRemoteSync: true });
        localStorage.setItem("claimedAchievements", JSON.stringify(mergedClaimedAchievements));
        localStorage.setItem("unlockedAchievements", JSON.stringify(mergedUnlockedAchievements));
        localStorage.setItem("showcasedAchievements", JSON.stringify(mergedShowcasedAchievements));
                // Update navbar profile pic if it exists
        const navProfilePic = document.getElementById("nav-profile-pic");
        if (navProfilePic) navProfilePic.src = mergedProfile.profilePicture;
                // Update display if profile modal is open
        if (document.getElementById("profile-xp")) {
            updateProfileDisplay(mergedProfile);
        }

        // Update the main page stats display after syncing
        updateIndexStats();
    } catch (error) {
        console.error("\u{274C} Error syncing stats:", error);
        if (!navigator.onLine) {
            console.log('Sync failed: offline');
        } else {
            showNotification('Failed to sync stats - will retry', 'error');
        }
    } finally {
        isSyncing = false;
        // Process queued syncs
        if (syncQueue.length > 0) {
            const nextSync = syncQueue.shift();
            nextSync();
        }
    }
}

async function syncAllFirestoreData() {
    const syncButton = document.getElementById("sync-data-button");
    if (syncButton) syncButton.disabled = true;

    try {
        const authUser = firebase.auth().currentUser;
        if (!authUser) {
            showNotification('Please login first to sync your profile.', 'error', 4000);
            return;
        }

        showNotification('Syncing profile data with Firebase...', 'info', 3000);
        await loadUserProfile();
        await syncStatsToFirebase();
        showNotification('Your profile data is now synced with Firebase.', 'success', 4500);
    } catch (error) {
        console.error('Error syncing data:', error);
        showNotification('Could not sync profile data. Please try again later.', 'error', 5000);
    } finally {
        if (syncButton) syncButton.disabled = false;
    }
}

// ===== DAILY LOGIN & XP SYSTEM =====

// Daily login rewards - 7 day cycle
const DAY_7_LOGIN_PFP = {
    id: "login-pfp-barndoor-skate",
    name: "Barndoor Skate",
    imagePath: "images/loginPfp/Login2/BarndoorSkate.png",
    loginReward: true,
    day: 7,
    rarity: "rare"
};

const dailyRewards = [
    { day: 1, xp: 50, emoji: "1\uFE0F\u20E3" },
    { day: 2, xp: 60, emoji: "2\uFE0F\u20E3" },
    { day: 3, xp: 70, emoji: "3\uFE0F\u20E3" },
    { day: 4, xp: 80, emoji: "4\uFE0F\u20E3" },
    { day: 5, xp: 90, emoji: "5\uFE0F\u20E3" },
    { day: 6, xp: 100, emoji: "6\uFE0F\u20E3" },
    { day: 7, xp: 500, emoji: "\u{1F3C6}", isBig: true, cosmetics: [DAY_7_LOGIN_PFP] }
];

async function ensureLoginStreakRewards() {
    if (!currentUser) return false;

    const currentLoginDay = parseInt(localStorage.getItem("currentLoginDay")) || 0;
    const loginStreak = parseInt(localStorage.getItem("loginStreak")) || 0;
    if (currentLoginDay < 7 && loginStreak < 7) return false;

    const profileData = typeof getCurrentProfileData === "function"
        ? getCurrentProfileData()
        : JSON.parse(localStorage.getItem("userProfile") || "{}");
    const earnedCosmetics = Array.isArray(profileData.earnedCosmetics) ? [...profileData.earnedCosmetics] : [];
    const alreadyUnlocked = earnedCosmetics.some(cosmetic =>
        cosmetic?.id === DAY_7_LOGIN_PFP.id ||
        cosmetic?.name === DAY_7_LOGIN_PFP.name || cosmetic?.imagePath === DAY_7_LOGIN_PFP.imagePath
    );

    if (alreadyUnlocked) return false;

    earnedCosmetics.push({ ...DAY_7_LOGIN_PFP });
    profileData.earnedCosmetics = earnedCosmetics;

    if (typeof saveUserProfileLocally === "function") {
        saveUserProfileLocally(profileData, { skipRemoteSync: true });
    } else {
        saveUserProfileLocally(profileData, { skipRemoteSync: true });
    }

    try {
        await db.collection("userStats").doc(currentUser.uid).set({
            earnedCosmetics: earnedCosmetics
        }, { merge: true });
    } catch (error) {
        console.warn("Unable to sync day 7 login reward:", error);
    }

    if (document.getElementById("pfp-picker-grid")) {
        loadEarnedCosmetics();
    }

    showCosmeticUnlockToast(DAY_7_LOGIN_PFP, {
        title: "Login Reward Unlocked!",
        subtitle: `${DAY_7_LOGIN_PFP.name} profile picture`,
        accent: "#ffd700",
        background: "linear-gradient(135deg, rgba(255, 215, 0, 0.96), rgba(112, 83, 0, 0.96))",
        icon: "\u{1F3C6}"
    });

    return true;
}

async function initializeDailyLogin() {
    if (!currentUser) return;

    const today = getLocalDateKey();
    const storedLastLoginDate = localStorage.getItem("lastLoginDate");
    const lastLoginDate = normalizeStoredDateValue(storedLastLoginDate);
    const dailyLoginModalShownStorageKey = getDailyLoginModalShownStorageKey();
    const storedModalShownDate = getStoredDailyLoginModalShownDate();
    const normalizedModalShownDate = normalizeStoredDateValue(storedModalShownDate);
    const dailyLoginModalShownToday = normalizedModalShownDate === today;
    const currentLoginDay = parseInt(localStorage.getItem("currentLoginDay")) || 1;
    const totalXP = parseInt(localStorage.getItem("totalXP")) || 0;

    if (storedLastLoginDate && lastLoginDate && storedLastLoginDate !== lastLoginDate) {
        localStorage.setItem("lastLoginDate", lastLoginDate);
    }
    if (storedModalShownDate && normalizedModalShownDate && storedModalShownDate !== normalizedModalShownDate) {
        localStorage.setItem(dailyLoginModalShownStorageKey, normalizedModalShownDate);
    }

    // Check if user has already logged in today
    if (lastLoginDate !== today) {
        // Calculate next day (keeps incrementing)
        let nextDay = currentLoginDay;
        let streak = 1;

        if (lastLoginDate) {
            const daysDiff = getCalendarDayDifference(lastLoginDate, today);

            if (daysDiff === 1) {
                // User logged in yesterday, advance the day
                nextDay = currentLoginDay + 1;
                streak = (parseInt(localStorage.getItem("loginStreak")) || 1) + 1;
            } else if (daysDiff > 1) {
                // User missed days, reset to day 1
                nextDay = 1;
                streak = 1;
            } else if (!Number.isFinite(daysDiff)) {
                // Recover from legacy/invalid date formats without wiping streak progress.
                nextDay = currentLoginDay + 1;
                streak = (parseInt(localStorage.getItem("loginStreak")) || 1) + 1;
            } else {
                // Same day/future date edge cases should keep existing streak.
                streak = parseInt(localStorage.getItem("loginStreak")) || 1;
            }
        } else if (storedLastLoginDate) {
            // We had legacy unparseable data - preserve momentum once and rewrite in normalized format.
            nextDay = currentLoginDay + 1;
            streak = (parseInt(localStorage.getItem("loginStreak")) || 1) + 1;
        }

        // Get reward for this day using modulo to cycle through 7-day rewards
        const rewardIndex = (nextDay - 1) % 7;
        const reward = dailyRewards[rewardIndex];
        const xpAward = typeof window.applyLimitedTimeXpBonus === "function"
            ? window.applyLimitedTimeXpBonus(reward.xp)
            : { totalXp: reward.xp };
        const xpGain = xpAward.totalXp;
        const profileData = getCurrentProfileData();
        const currentProfileXp = Number(profileData.totalXP) || 0;
        const currentStoredXp = Number(totalXP) || 0;
        const nextTotalXp = Math.max(currentProfileXp, currentStoredXp) + xpGain;

        profileData.totalXP = nextTotalXp;
        applySharkPassXpGain(profileData, xpGain);
        profileData.loginStreak = streak;
        profileData.currentLoginDay = nextDay;
        profileData.lastLoginDate = today;
        profileData.dailyLoginModalShownToday = today;
        if (currentUser?.uid) {
            profileData.uid = currentUser.uid;
        }
        saveUserProfileLocally(profileData, { skipRemoteSync: true });

        // Update localStorage
        localStorage.setItem("lastLoginDate", today);
        localStorage.setItem("currentLoginDay", nextDay);
        localStorage.setItem("loginStreak", streak);
        localStorage.setItem("totalXP", nextTotalXp);
        localStorage.setItem(dailyLoginModalShownStorageKey, today);

        // Sync login streak data to Firebase
        if (currentUser) {
            const statsRef = db.collection("userStats").doc(currentUser.uid);
            await statsRef.set({
                lastLoginDate: today,
                currentLoginDay: nextDay,
                loginStreak: streak,
                dailyLoginModalShownToday: today,
                totalXP: nextTotalXp,
                ...getSharkPassSyncPayload(profileData)
            }, { merge: true });
        }

        // Show daily login modal only if not already shown today
        if (!dailyLoginModalShownToday) {
            showDailyLoginModal(nextDay, xpGain);
            localStorage.setItem(dailyLoginModalShownStorageKey, today);
        }

        // if logged in, sync the updated profile immediately
        if (currentUser) {
            syncStatsToFirebase();
        }
    }

    // (No need to set dailyLoginModalShownStorageKey here, handled above)

    await ensureLoginStreakRewards();
    // If both conditions are false (already logged in today and modal already shown), do nothing
}

function showDailyLoginModal(currentDay, xpGained) {
    if (!currentUser) return;
    const modal = document.getElementById("dailyLoginModal");
    const grid = document.getElementById("daily-rewards-grid");
    const day7Container = document.getElementById("day-7-reward");

    if (!modal || !grid || !day7Container) return; // Element doesn't exist on this page

    grid.innerHTML = '';
    day7Container.innerHTML = '';

    // Store whether this is a new claim (xpGained > 0) for UI logic
    const isNewClaim = xpGained > 0;

    // Calculate position in current 7-day cycle
    const positionInCycle = (currentDay - 1) % 7 + 1;
    const cycleEndDay = currentDay + (7 - positionInCycle);
    const day7LoginRewardUnlocked = (() => {
        const profileData = getCurrentProfileData();
        return Array.isArray(profileData.earnedCosmetics) && profileData.earnedCosmetics.some(cosmetic =>
            cosmetic?.id === DAY_7_LOGIN_PFP.id ||
            cosmetic?.name === DAY_7_LOGIN_PFP.name || cosmetic?.imagePath === DAY_7_LOGIN_PFP.imagePath
        );
    })();

    // Add days 1-6 to grid
    for (let i = 1; i <= 6; i++) {
        const reward = dailyRewards[i - 1];
        const isClaimed = i < positionInCycle || (i === positionInCycle && !isNewClaim);
        const isAvailable = i === positionInCycle && isNewClaim;

        const dayCard = document.createElement("div");
        dayCard.style.cssText = `
            padding: 15px;
            border-radius: 8px;
            text-align: center;
            background: ${isAvailable ? 'rgba(0, 180, 216, 0.2)' : isClaimed ? 'rgba(76, 175, 80, 0.1)' : 'rgba(255, 255, 255, 0.1)'};
            border: 2px solid ${isAvailable ? '#00b4d8' : isClaimed ? '#4caf50' : '#666'};
            cursor: ${isAvailable ? 'pointer' : 'default'};
            transition: all 0.3s ease;
        `;

        if (isAvailable) {
            dayCard.style.boxShadow = '0 0 15px rgba(0, 180, 216, 0.5)';
        }

        dayCard.innerHTML = `
            <div style="font-size: 24px; margin-bottom: 8px;">${reward.emoji}</div>
            <div style="font-size: 14px; color: #4dd0e1; font-weight: 600;">${reward.xp} XP</div>
            <div style="font-size: 12px; color: #888; margin-top: 5px;">${isClaimed ? '\u2713 Claimed' : isAvailable ? 'Available Today!' : 'Locked'}</div>
        `;

        if (isAvailable) {
            dayCard.onclick = () => claimDailyReward(i);
        }

        grid.appendChild(dayCard);
    }

    const day7Reward = dailyRewards[6];
    const isDay7Claimed = 7 < positionInCycle || (7 === positionInCycle && !isNewClaim);
    const isDay7Available = 7 === positionInCycle && isNewClaim;
    const shouldShowDay7LoginReward = !day7LoginRewardUnlocked && currentDay <= 7;

    const day7Card = document.createElement("div");
    day7Card.style.cssText = `
        padding: 25px;
        border-radius: 12px;
        text-align: center;
        background: ${isDay7Available ? 'linear-gradient(135deg, #ffd700, #ffed4e)' : isDay7Claimed ? 'rgba(76, 175, 80, 0.2)' : 'rgba(255, 255, 255, 0.1)'};
        border: 3px solid ${isDay7Available ? '#ffd700' : isDay7Claimed ? '#4caf50' : '#666'};
        cursor: ${isDay7Available ? 'pointer' : 'default'};
        transition: all 0.3s ease;
        min-width: 150px;
    `;

    if (isDay7Available) {
        day7Card.style.boxShadow = '0 0 25px rgba(255, 215, 0, 0.8)';
        day7Card.style.transform = 'scale(1.05)';
    }

    const day7BonusMarkup = shouldShowDay7LoginReward
        ? [
            `<div style="margin: 10px 0 8px;">`,
            `<img src="${DAY_7_LOGIN_PFP.imagePath}" alt="PFP ${DAY_7_LOGIN_PFP.name}" style="width: 58px; height: 58px; border-radius: 12px; object-fit: cover; border: 2px solid ${isDay7Available ? '#001f3f' : '#ffd700'}; box-shadow: 0 6px 16px rgba(0,0,0,0.18);">`,
            `</div>`,
            `<div style="font-size: 13px; color: ${isDay7Available ? '#001f3f' : '#f5d76e'}; font-weight: 700;">+ ${DAY_7_LOGIN_PFP.name} PFP</div>`
        ].join("")
        : `<div style="font-size: 12px; color: ${isDay7Available ? '#001f3f' : '#f5d76e'}; font-weight: 700; margin-top: 8px;">Cycle reward milestone</div>`;

    day7Card.innerHTML = `
        <div style="font-size: 48px; margin-bottom: 12px;">${day7Reward.emoji}</div>
        <div style="font-size: 15px; color: ${isDay7Available ? '#001f3f' : '#ffd700'}; font-weight: 700; margin-bottom: 8px;">Day ${cycleEndDay}</div>
        <div style="font-size: 28px; color: #001f3f; font-weight: 700;">${day7Reward.xp} XP</div>
        ${day7BonusMarkup}
        <div style="font-size: 14px; color: ${isDay7Available ? '#001f3f' : '#888'}; margin-top: 8px; font-weight: 600;">${isDay7Claimed ? '\u2713 Claimed' : isDay7Available ? 'MEGA REWARD!' : 'Locked'}</div>
    `;

    if (isDay7Available) {
        day7Card.onclick = () => claimDailyReward(7);
    }

    day7Container.appendChild(day7Card);

    modal.classList.remove("hidden");
}

function claimDailyReward(day) {
    // Just close the modal after a brief celebration
    setTimeout(() => {
        closeDailyLoginModal();
    }, 1000);
}

function openDailyLoginModal() {
    if (!currentUser) {
        openLoginModal();
        return;
    }
    const currentDay = parseInt(localStorage.getItem("currentLoginDay")) || 1;
    showDailyLoginModal(currentDay, 0);
}

function closeDailyLoginModal() {
    const modal = document.getElementById("dailyLoginModal");
    if (modal) {
        modal.classList.add("hidden");
    }
}

window.openDailyLoginModal = openDailyLoginModal;
window.closeDailyLoginModal = closeDailyLoginModal;

// Load stats and streaks
document.addEventListener("DOMContentLoaded", function() {
    initHomeV3Tabs();
    initHomeV3CratesButton();
    // Update displayed stats from localStorage
    if (document.getElementById("games")) {
        document.getElementById("games").textContent = localStorage.getItem("games") || 0;
    }
    if (document.getElementById("wins")) {
        document.getElementById("wins").textContent = localStorage.getItem("wins") || 0;
    }
    if (document.getElementById("losses")) {
        document.getElementById("losses").textContent = localStorage.getItem("losses") || 0;
    }

    // Load profile picture picker data on page load
    if (document.getElementById("pfp-picker-grid")) {
        loadEarnedCosmetics();
    }

    // If user is already logged in, refresh profile from Firebase immediately
    // This ensures cross-subdomain sync works correctly
    if (currentUser) {
        loadUserProfile().catch(err => console.log("Initial profile load skipped:", err));
    }

    if (typeof renderConsumablesPage === "function") {
        renderConsumablesPage();
    }
    if (typeof ensureConsumablesPageTimer === "function") {
        ensureConsumablesPageTimer();
    }
    ensureCommunityBossUiTimer();
    initCratesModalTabs();
    updateSeasonalCratePanels();
});

// ----- REDEEM CODE FUNCTIONS -----
async function redeemCode(inputId = "redeem-code-input", messageId = "redeem-message") {
    if (!currentUser) {
        alert("Please login first to redeem codes.");
        return;
    }

    const codeInput = document.getElementById(inputId) || document.getElementById("redeem-code-input");
    if (!codeInput) {
        showNotification("Code input is unavailable right now.", "error", 3000);
        return;
    }
    const code = codeInput.value.trim().toUpperCase();

    if (!code) {
        showRedeemMessage("Please enter a code.", false, messageId);
        return;
    }

    // Check if code exists
    if (!redeemCodes[code]) {
        showRedeemMessage("Invalid code. Please check and try again.", false, messageId);
        codeInput.value = '';
        return;
    }

    // Check if already redeemed
    if (hasRedeemedCode(code)) {
        showRedeemMessage("This code has already been redeemed.", false, messageId);
        codeInput.value = '';
        return;
    }

    try {
        // Get current user data
        const userProfile = getCurrentProfileData();
        const currentXP = userProfile.totalXP || 0;
        const codeReward = redeemCodes[code];

        // Add XP
        const rewardXp = Number(codeReward.xp) || 0;
        const xpAward = typeof window.applyLimitedTimeXpBonus === "function"
            ? window.applyLimitedTimeXpBonus(rewardXp)
            : { totalXp: rewardXp };
        const newXP = currentXP + xpAward.totalXp;
        userProfile.totalXP = newXP;
        applySharkPassXpGain(userProfile, xpAward.totalXp);

        // Add cosmetics if any
        const newlyUnlockedCosmetics = [];
        if (codeReward.cosmetics) {
            if (!userProfile.earnedCosmetics) {
                userProfile.earnedCosmetics = [];
            }
            codeReward.cosmetics.forEach(cosmetic => {
                // Check if cosmetic is not already in the list
                if (!userProfile.earnedCosmetics.some(c => c.name === cosmetic.name)) {
                    userProfile.earnedCosmetics.push(cosmetic);
                    newlyUnlockedCosmetics.push(cosmetic);
                }
            });
        }

        // Add badge if any
        if (codeReward.badge) {
            if (!Array.isArray(userProfile.unlockedBadges)) {
                userProfile.unlockedBadges = ["starter"];
            }
            if (!userProfile.unlockedBadges.includes(codeReward.badge)) {
                userProfile.unlockedBadges.push(codeReward.badge);
            }
            // Backwards compatible: keep the legacy tester flag for the tester badge.
            if (codeReward.badge === "tester") {
                userProfile.testerBadgeUnlocked = true;
            }
        }

        const grantedCrates = applyCodeCrateRewards(userProfile, codeReward.crates);

        // Save to localStorage
        saveUserProfileLocally(userProfile);

        // Sync to Firebase
        if (currentUser) {
            const statsRef = db.collection("userStats").doc(currentUser.uid);
            await statsRef.set({
                totalXP: newXP,
                ...getSharkPassSyncPayload(userProfile),
                earnedCosmetics: userProfile.earnedCosmetics,
                unlockedBadges: Array.isArray(userProfile.unlockedBadges) ? userProfile.unlockedBadges : ["starter"],
                testerBadgeUnlocked: userProfile.testerBadgeUnlocked === true,
                crateInventory: normalizeCrateInventory(userProfile.crateInventory),
                crateInventoryUpdatedAt: getCrateInventoryUpdatedAt(userProfile)
            }, { merge: true });
        }

        // Mark code as redeemed
        addRedeemedCode(code);

        // Sync redeemed codes BEFORE refreshing UI
        if (currentUser) {
            const redeemedCodesList = getRedeemedCodes();
            const statsRef = db.collection("userStats").doc(currentUser.uid);
            const syncData = { redeemedCodes: redeemedCodesList };
            if (codeReward.badge === 'tester' && userProfile.testerBadgeUnlocked) {
                syncData.testerBadgeUnlocked = true;
            }
            // Wait for Firebase sync to complete before refreshing UI
            await statsRef.set(syncData, { merge: true });
        }

        // Show success message
        const rewardLines = [];
        if (xpAward.totalXp > 0) rewardLines.push(`${xpAward.totalXp} XP`);
        if (newlyUnlockedCosmetics.length) rewardLines.push(`${newlyUnlockedCosmetics.length} cosmetic${newlyUnlockedCosmetics.length === 1 ? "" : "s"}`);
        if (codeReward.badge) rewardLines.push(`badge unlocked`);
        grantedCrates.forEach(crate => {
            rewardLines.push(`${crate.count} ${crate.name}${crate.count === 1 ? "" : "s"}`);
        });
        const rewardSummary = rewardLines.length ? rewardLines.join(" + ") : "Rewards unlocked";
        showRedeemMessage(`\u{2728} Success! ${rewardSummary}.`, true, messageId);
        codeInput.value = '';

        // Refresh profile and cosmetics
        loadUserProfile();
        loadEarnedCosmetics();
        loadAvailablePFPs();
        renderCratesButton();
        renderCratesModal();
        updateSeasonalCratePanels();

    } catch (error) {
        console.error("\u{274C} Error redeeming code:", error);
        showRedeemMessage("An error occurred. Please try again.", false, messageId);
    }
}

function showRedeemMessage(message, isSuccess, messageId = "redeem-message") {
    const messageEl = document.getElementById(messageId) || document.getElementById("redeem-message");
    if (messageEl) {
        messageEl.textContent = message;
        messageEl.style.display = 'block';
        messageEl.style.color = isSuccess ? '#4caf50' : '#ff6b6b';
        messageEl.style.background = isSuccess ? 'rgba(76, 175, 80, 0.1)' : 'rgba(255, 107, 107, 0.1)';
    }
}

function bindLockerRedeemInput() {
    [
        { inputId: "redeem-code-input", messageId: "redeem-message" },
        { inputId: "rewards-redeem-code-input", messageId: "rewards-redeem-message" }
    ].forEach(({ inputId, messageId }) => {
        const redeemInput = document.getElementById(inputId);
        if (!redeemInput || redeemInput.dataset.redeemBound === "true") return;
        redeemInput.dataset.redeemBound = "true";
        redeemInput.addEventListener("keydown", event => {
            if (event.key === "Enter") redeemCode(inputId, messageId);
        });
    });
}

document.addEventListener("DOMContentLoaded", bindLockerRedeemInput);
bindLockerRedeemInput();

// ----- CONSOLE COMMANDS FOR STAT MANAGEMENT -----
// Usage in browser console:
// addStats({wins: 5, losses: 2, xp: 1000, gamesPlayed: 7, totalGuesses: 25})
// Or use individual commands: addWin(), addLoss(), addXP(100), etc.

async function addStats(statsObj) {
    if (!firebase.auth().currentUser || !isDeveloperUid(firebase.auth().currentUser.uid)) {
        console.log("? Access denied. This command is for developers only.");
        return;
    }
    if (!currentUser) {
        console.log("? Error: User must be logged in");
        return;
    }

    try {
        const userProfile = getCurrentProfileData();

        // Add to requested stats
        if (statsObj.xp) {
            userProfile.totalXP = (userProfile.totalXP || 0) + statsObj.xp;
            applySharkPassXpGain(userProfile, statsObj.xp);
            console.log(`? Added ${statsObj.xp} XP. Total: ${userProfile.totalXP}`);
        }
        if (statsObj.wins) {
            userProfile.wins = (userProfile.wins || 0) + statsObj.wins;
            console.log(`? Added ${statsObj.wins} wins. Total: ${userProfile.wins}`);
        }
        if (statsObj.losses) {
            userProfile.losses = (userProfile.losses || 0) + statsObj.losses;
            console.log(`? Added ${statsObj.losses} losses. Total: ${userProfile.losses}`);
        }
        if (statsObj.gamesPlayed) {
            userProfile.gamesPlayed = (userProfile.gamesPlayed || 0) + statsObj.gamesPlayed;
            console.log(`? Added ${statsObj.gamesPlayed} games. Total: ${userProfile.gamesPlayed}`);
        }
        if (statsObj.totalGuesses) {
            userProfile.totalGuesses = (userProfile.totalGuesses || 0) + statsObj.totalGuesses;
            console.log(`? Added ${statsObj.totalGuesses} guesses. Total: ${userProfile.totalGuesses}`);
        }
        if (statsObj.currentStreak !== undefined) {
            userProfile.currentStreak = statsObj.currentStreak;
            console.log(`? Set streak to ${statsObj.currentStreak}`);
        }
        if (statsObj.highestStreak) {
            userProfile.highestStreak = Math.max(userProfile.highestStreak || 0, statsObj.highestStreak);
            console.log(`? Highest streak: ${userProfile.highestStreak}`);
        }

        // Save to localStorage
        saveUserProfileLocally(userProfile);

        // Sync to Firebase
        const statsRef = db.collection("userStats").doc(currentUser.uid);
        await statsRef.set(userProfile, { merge: true });

        console.log("? Stats synced to Firebase");

        // Refresh UI
        loadUserProfile();
        updateAuthUI();

    } catch (error) {
        console.error("? Error adding stats:", error);
    }
}

// Individual convenience functions
async function addXP(amount) {
    return addStats({ xp: amount });
}

async function addWin() {
    return addStats({ wins: 1, gamesPlayed: 1 });
}

async function addLoss() {
    return addStats({ losses: 1, gamesPlayed: 1 });
}

async function addGuesses(amount) {
    return addStats({ totalGuesses: amount });
}

async function setLevel(level) {
    if (!firebase.auth().currentUser || !isDeveloperUid(firebase.auth().currentUser.uid)) {
        console.log("? Access denied. This command is for developers only.");
        return;
    }
    if (!currentUser) {
        console.log("? Error: User must be logged in");
        return;
    }

    const targetLevel = Math.floor(Number(level));
    if (!Number.isFinite(targetLevel) || targetLevel < 1) {
        console.log("? Usage: setLevel(10)");
        return;
    }

    try {
        const userProfile = getCurrentProfileData();
        const currentXP = Number(userProfile.totalXP) || 0;
        const targetXP = getXPForLevel(targetLevel);
        userProfile.totalXP = targetXP;
        applySharkPassXpGain(userProfile, Math.max(0, targetXP - currentXP));

        saveUserProfileLocally(userProfile);

        const statsRef = db.collection("userStats").doc(currentUser.uid);
        await statsRef.set({
            totalXP: targetXP,
            ...getSharkPassSyncPayload(userProfile)
        }, { merge: true });

        await loadUserProfile();
        updateAuthUI();

        console.log(`? Set level to ${targetLevel}. Total XP is now ${targetXP}.`);
    } catch (error) {
        console.error("? Error setting level:", error);
    }
}

function isDeveloperSessionActive() {
    return Boolean(currentUser && isDeveloperUid(currentUser.uid));
}

function setAdminAbuseStatus(elementId, message, options = {}) {
    const statusEl = document.getElementById(elementId);
    if (!statusEl) return;
    statusEl.textContent = message;
    statusEl.classList.toggle("error", Boolean(options.error));
}

function getAdminPositiveCountValue(elementId, fallback = 1) {
    const inputEl = document.getElementById(elementId);
    const parsed = Math.floor(Number(inputEl?.value));
    return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

function formatAdminDateTime(timestamp) {
    const parsed = Number(timestamp);
    if (!Number.isFinite(parsed) || parsed <= 0) return "unknown time";
    return new Date(parsed).toLocaleString();
}

function getAdminTimestampMillis(timestamp) {
    if (typeof timestamp?.toMillis === "function") return timestamp.toMillis();
    const parsed = Number(timestamp);
    return Number.isFinite(parsed) && parsed > 0 ? parsed : 0;
}

function formatAdminRelativeTime(timestamp, nowMs = Date.now()) {
    const elapsedMs = Math.max(0, nowMs - getAdminTimestampMillis(timestamp));
    const minutes = Math.floor(elapsedMs / (60 * 1000));
    if (minutes < 1) return "Just now";
    if (minutes < 60) return `${minutes}m ago`;

    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours}h ago`;

    const days = Math.floor(hours / 24);
    if (days < 7) return `${days}d ago`;
    return formatAdminDateTime(getAdminTimestampMillis(timestamp));
}

function getAdminUtcDayKeys(dayCount = 30) {
    const count = Math.max(1, Math.floor(Number(dayCount) || 30));
    const now = new Date();
    const todayUtcMs = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());
    return Array.from({ length: count }, (_, index) => {
        const daysAgo = count - index - 1;
        return new Date(todayUtcMs - daysAgo * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
    });
}

function calculateAdminVisitorAverage(dailyCounts) {
    const firstRecordedIndex = dailyCounts.findIndex(count => count > 0);
    if (firstRecordedIndex < 0) {
        return { average: null, recordedDays: 0 };
    }

    const recordedCounts = dailyCounts.slice(firstRecordedIndex);
    const total = recordedCounts.reduce((sum, count) => sum + count, 0);
    return {
        average: total / recordedCounts.length,
        recordedDays: recordedCounts.length
    };
}

function setAdminVisitorMetric(elementId, value) {
    const element = document.getElementById(elementId);
    if (element) element.textContent = String(value);
}

function normalizeAdminVisitorActivity(value) {
    if (typeof value === "string") {
        return value.trim().slice(0, 80);
    }
    if (!value || typeof value !== "object") return "";
    return String(value.label || value.name || value.page || "").trim().slice(0, 80);
}

function formatAdminVisitorActivity(visitor) {
    const activity = normalizeAdminVisitorActivity(visitor?.lastActivity);
    if (!activity) return "";
    const activityUpdatedMs = getAdminTimestampMillis(visitor?.lastActivity?.updatedAt);
    if (
        activityUpdatedMs
        && visitor?.lastActiveMs
        && Math.abs(visitor.lastActiveMs - activityUpdatedMs) > ACTIVE_PLAYER_WINDOW_MS
    ) {
        return "";
    }
    return activity;
}

function formatAdminOnlineVisitorLabel(visitor) {
    const activity = formatAdminVisitorActivity(visitor);
    return activity ? `${visitor.username} - ${activity}` : visitor.username;
}

function renderAdminRecentVisitors(visitors, nowMs = Date.now()) {
    const list = document.getElementById("admin-recent-visitors-list");
    if (!list) return;
    list.replaceChildren();

    if (!visitors.length) {
        const empty = document.createElement("div");
        empty.className = "admin-visitor-empty";
        empty.textContent = "No signed-in visitors recorded in the last 7 days.";
        list.appendChild(empty);
        return;
    }

    visitors.slice(0, 20).forEach(visitor => {
        const row = document.createElement("div");
        row.className = "admin-recent-visitor";

        const name = document.createElement("strong");
        name.textContent = visitor.username;

        const seen = document.createElement("span");
        const online = nowMs - visitor.lastActiveMs < ACTIVE_PLAYER_WINDOW_MS;
        const activity = formatAdminVisitorActivity(visitor);
        seen.textContent = online && activity
            ? `Online now - ${activity}`
            : online
                ? "Online now"
                : formatAdminRelativeTime(visitor.lastActiveMs, nowMs);
        seen.title = activity
            ? `${formatAdminDateTime(visitor.lastActiveMs)} - ${activity}`
            : formatAdminDateTime(visitor.lastActiveMs);

        row.append(name, seen);
        list.appendChild(row);
    });
}

async function refreshAdminVisitorInsights() {
    if (!isDeveloperSessionActive() || !db) return false;

    setAdminAbuseStatus("admin-visitor-status", "Refreshing visitor insights...");
    const nowMs = Date.now();
    const sevenDayCutoffMs = nowMs - 7 * 24 * 60 * 60 * 1000;
    const oneDayCutoffMs = nowMs - 24 * 60 * 60 * 1000;
    const dayKeys = getAdminUtcDayKeys(30);

    const [recentSnapshot, dailySnapshots] = await Promise.all([
        db.collection("userStats").where("lastActive", ">=", sevenDayCutoffMs).get(),
        Promise.all(dayKeys.map(dayKey => (
            db.collection("visitorDaily").doc(dayKey).collection("users").get()
        )))
    ]);

    const recentVisitors = recentSnapshot.docs
        .map(doc => {
            const data = doc.data() || {};
            return {
                username: String(data.username || `Player ${doc.id.slice(0, 6)}`),
                lastActiveMs: getAdminTimestampMillis(data.lastActive),
                lastActivity: data.lastActivity
            };
        })
        .filter(visitor => visitor.lastActiveMs >= sevenDayCutoffMs)
        .sort((a, b) => b.lastActiveMs - a.lastActiveMs);

    const dailyCounts = dailySnapshots.map(snapshot => snapshot.size);
    const lastSevenDailyCounts = dailyCounts.slice(-7);
    const sevenDayAverage = calculateAdminVisitorAverage(lastSevenDailyCounts);
    const thirtyDayAverage = calculateAdminVisitorAverage(dailyCounts);
    const onlineVisitors = recentVisitors.filter(visitor => nowMs - visitor.lastActiveMs < ACTIVE_PLAYER_WINDOW_MS);
    const lastDayVisitors = recentVisitors.filter(visitor => visitor.lastActiveMs >= oneDayCutoffMs);

    setAdminVisitorMetric("admin-visitors-online", onlineVisitors.length);
    setAdminVisitorMetric("admin-visitors-24h", lastDayVisitors.length);
    setAdminVisitorMetric("admin-visitors-7d", recentVisitors.length);
    setAdminVisitorMetric("admin-visitors-today", dailyCounts.at(-1) || 0);
    setAdminVisitorMetric(
        "admin-visitors-average-7d",
        sevenDayAverage.average === null ? "\u2014" : sevenDayAverage.average.toFixed(1)
    );
    setAdminVisitorMetric(
        "admin-visitors-average-30d",
        thirtyDayAverage.average === null ? "\u2014" : thirtyDayAverage.average.toFixed(1)
    );

    const onlineMetric = document.getElementById("admin-visitors-online");
    if (onlineMetric) {
        onlineMetric.title = onlineVisitors.length
            ? onlineVisitors.map(formatAdminOnlineVisitorLabel).join("\n")
            : "No signed-in players are currently online.";
    }

    renderAdminRecentVisitors(recentVisitors, nowMs);

    if (thirtyDayAverage.recordedDays > 0) {
        const firstRecordedDay = dayKeys[dayKeys.length - thirtyDayAverage.recordedDays];
        setAdminAbuseStatus(
            "admin-visitor-status",
            `Daily averages currently cover ${thirtyDayAverage.recordedDays} day${thirtyDayAverage.recordedDays === 1 ? "" : "s"}, beginning ${firstRecordedDay}.`
        );
    } else {
        setAdminAbuseStatus(
            "admin-visitor-status",
            "Daily averages will begin filling as signed-in players visit after this update."
        );
    }

    return true;
}

async function adminRefreshVisitorInsights() {
    try {
        return await refreshAdminVisitorInsights();
    } catch (error) {
        console.warn("Unable to refresh visitor insights:", error);
        setAdminAbuseStatus(
            "admin-visitor-status",
            `Visitor insights failed to load: ${error.message || error}`,
            { error: true }
        );
        return false;
    }
}

function normalizeGlobalMessageType(type = "info") {
    const normalized = String(type || "").trim().toLowerCase();
    if (normalized === "event" || normalized === "warning") return normalized;
    return "info";
}

async function setGlobalIndexTheme(themeId = "default") {
    if (!isDeveloperSessionActive()) {
        throw new Error("Developer access required.");
    }
    if (!db) {
        throw new Error("Firestore is not ready yet.");
    }

    const resolvedThemeId = normalizeIndexThemeId(themeId);
    const themeMeta = INDEX_THEME_OPTIONS.find(option => option.id === resolvedThemeId) || INDEX_THEME_OPTIONS[0];
    const payload = {
        themeId: resolvedThemeId,
        themeName: themeMeta?.name || resolvedThemeId,
        enabled: true,
        updatedAt: Date.now(),
        updatedBy: currentUser.uid
    };

    await db.collection(GLOBAL_INDEX_THEME_CONFIG_PATH.collection)
        .doc(GLOBAL_INDEX_THEME_CONFIG_PATH.doc)
        .set(payload, { merge: true });

    setActiveSeasonalCrateTheme(resolvedThemeId);
    applyIndexTheme(resolvedThemeId);
    return payload;
}

async function setGlobalMessageConfig(message = "", type = "info") {
    if (!isDeveloperSessionActive()) {
        throw new Error("Developer access required.");
    }
    if (!db) {
        throw new Error("Firestore is not ready yet.");
    }

    const trimmedMessage = String(message || "").trim();
    const normalizedType = normalizeGlobalMessageType(type);
    const payload = {
        enabled: trimmedMessage.length > 0,
        message: trimmedMessage,
        type: normalizedType,
        updatedAt: Date.now(),
        updatedBy: currentUser.uid
    };

    await db.collection(GLOBAL_MESSAGE_CONFIG_PATH.collection)
        .doc(GLOBAL_MESSAGE_CONFIG_PATH.doc)
        .set(payload, { merge: true });

    return payload;
}

const ACTIVE_PLAYER_WINDOW_MS = 5 * 60 * 1000;

async function runActiveUserStatsBatch(updateBuilder, options = {}) {
    if (!isDeveloperSessionActive()) {
        throw new Error("Developer access required.");
    }
    if (!db) {
        throw new Error("Firestore is not ready yet.");
    }

    const nowMs = Date.now();
    const activeWindowMs = Math.max(60 * 1000, Number(options.activeWindowMs) || ACTIVE_PLAYER_WINDOW_MS);
    const activeCutoffMs = nowMs - activeWindowMs;

    const snapshot = await db
        .collection("userStats")
        .where("lastActive", ">=", activeCutoffMs)
        .get();

    if (snapshot.empty) {
        return {
            updatedUsers: 0,
            activeCutoffMs,
            activeWindowMs
        };
    }

    const docs = snapshot.docs;
    const chunkSize = 450;
    for (let start = 0; start < docs.length; start += chunkSize) {
        const batch = db.batch();
        docs.slice(start, start + chunkSize).forEach(doc => {
            const updatePayload = updateBuilder(doc) || {};
            batch.update(doc.ref, updatePayload);
        });
        await batch.commit();
    }

    return {
        updatedUsers: docs.length,
        activeCutoffMs,
        activeWindowMs
    };
}

async function grantGlobalCrates(amount = 1) {
    const count = Math.floor(Number(amount));
    if (!Number.isFinite(count) || count <= 0) {
        throw new Error("Invalid crate amount.");
    }
    const nowMs = Date.now();
    return runActiveUserStatsBatch(() => ({
        "crateInventory.reef": firebase.firestore.FieldValue.increment(count),
        crateInventoryUpdatedAt: nowMs,
        lastUpdated: nowMs
    }));
}

async function grantGlobalStreakShields(amount = 1) {
    const count = Math.floor(Number(amount));
    if (!Number.isFinite(count) || count <= 0) {
        throw new Error("Invalid streak shield amount.");
    }
    const nowMs = Date.now();
    return runActiveUserStatsBatch(() => ({
        streakShields: firebase.firestore.FieldValue.increment(count),
        lastUpdated: nowMs
    }));
}

function buildAdminLevelSyncPayload(totalXP) {
    const safeTotalXP = Math.max(0, Math.floor(Number(totalXP) || 0));
    const currentLevel = getLevelFromXP(safeTotalXP);
    const currentXP = getXPInCurrentLevel(safeTotalXP);
    const xpToNextLevel = getXPToNextLevel(safeTotalXP);
    const unlockedPfps = levelRewards
        .filter(reward => reward.level <= currentLevel)
        .map(reward => ({ level: reward.level, name: reward.name || reward.imagePath }));

    return {
        totalXP: safeTotalXP,
        currentLevel,
        currentXP,
        xpToNextLevel,
        unlockedPfps
    };
}

async function resolveAdminTargetUserStats(target) {
    if (!isDeveloperSessionActive()) {
        throw new Error("Developer access required.");
    }
    if (!db) {
        throw new Error("Firestore is not ready yet.");
    }

    const lookup = String(target || "").trim();
    if (!lookup) {
        throw new Error("Enter a UID or exact username.");
    }

    const statsCollection = db.collection("userStats");
    if (!lookup.includes("/")) {
        const directDoc = await statsCollection.doc(lookup).get();
        if (directDoc.exists) {
            return {
                uid: directDoc.id,
                ref: directDoc.ref,
                data: directDoc.data() || {}
            };
        }
    }

    const usernameSnapshot = await statsCollection
        .where("username", "==", lookup)
        .limit(2)
        .get();

    if (usernameSnapshot.size > 1) {
        throw new Error("Multiple players matched that username. Use UID instead.");
    }

    if (usernameSnapshot.size === 1) {
        const doc = usernameSnapshot.docs[0];
        return {
            uid: doc.id,
            ref: doc.ref,
            data: doc.data() || {}
        };
    }

    throw new Error("No player found for that UID or exact username.");
}

function getAdminPlayerLabel(uid, data = {}) {
    const username = String(data.username || "").trim();
    if (username) return username;
    return `Player ${String(uid || "").slice(0, 6)}`;
}

const ADMIN_COMPENSATION_TYPES = {
    levels: { max: 100, name: "Shark Pass Levels" },
    xp: { max: 1000000, name: "XP" },
    pearls: { max: 1000000, name: "Pearls" },
    crates: { max: 999, name: "Cosmetic Crates" },
    streak_shields: { max: 3, name: "Streak Shields" },
    spins: { max: 999, name: "Daily Spins" }
};

function normalizeAdminCompensationType(type = "levels") {
    const normalized = String(type || "").trim().toLowerCase().replace(/-/g, "_");
    return ADMIN_COMPENSATION_TYPES[normalized] ? normalized : "levels";
}

function getAdminCompensationAmount(type, rawAmount) {
    const meta = ADMIN_COMPENSATION_TYPES[normalizeAdminCompensationType(type)];
    const count = Math.floor(Number(rawAmount));
    if (!Number.isFinite(count) || count <= 0 || count > meta.max) {
        throw new Error(`Enter an amount from 1 to ${meta.max.toLocaleString()}.`);
    }
    return count;
}

function formatAdminCompensationValue(amount) {
    return `+${Math.max(0, Math.floor(Number(amount) || 0)).toLocaleString()}`;
}

function buildAdminCompensationNotice(grant, nowMs) {
    return {
        id: `admin-comp-${nowMs}-${Math.random().toString(36).slice(2, 8)}`,
        createdAt: nowMs,
        grantedBy: currentUser.uid,
        grants: [grant]
    };
}

function buildAdminCompensationPayload(targetUser, type, amount, nowMs) {
    const data = targetUser.data || {};
    const normalizedType = normalizeAdminCompensationType(type);
    const payload = {
        lastUpdated: nowMs
    };
    let grant = null;
    const result = {};

    if (normalizedType === "levels") {
        const currentTotalXP = Math.max(0, Math.floor(Number(data.totalXP) || 0));
        const currentLevel = getLevelFromXP(currentTotalXP);
        const currentLevelStartXP = getXPForLevel(currentLevel);
        const targetLevel = currentLevel + amount;
        const xpAdded = getXPForLevel(targetLevel) - currentLevelStartXP;
        const nextTotalXP = currentTotalXP + xpAdded;
        Object.assign(payload, buildAdminLevelSyncPayload(nextTotalXP), buildSharkPassXpGrantPayload(data, xpAdded), {
            lastAdminLevelGrant: {
                levelsAdded: amount,
                xpAdded,
                fromLevel: currentLevel,
                toLevel: targetLevel,
                grantedAt: nowMs,
                grantedBy: currentUser.uid
            }
        });
        grant = {
            name: "Shark Pass Levels",
            value: formatAdminCompensationValue(amount),
            detail: `Level ${currentLevel} -> ${targetLevel}`
        };
        Object.assign(result, { fromLevel: currentLevel, toLevel: targetLevel, xpAdded, totalXP: nextTotalXP });
    } else if (normalizedType === "xp") {
        const currentTotalXP = Math.max(0, Math.floor(Number(data.totalXP) || 0));
        const nextTotalXP = currentTotalXP + amount;
        Object.assign(payload, buildAdminLevelSyncPayload(nextTotalXP), buildSharkPassXpGrantPayload(data, amount));
        grant = {
            name: "XP",
            value: formatAdminCompensationValue(amount),
            detail: `Total XP ${currentTotalXP.toLocaleString()} -> ${nextTotalXP.toLocaleString()}`
        };
        Object.assign(result, { xpAdded: amount, totalXP: nextTotalXP });
    } else if (normalizedType === "pearls") {
        const currentPearls = Math.max(0, Math.floor(Number(data.pearls ?? data.tidePearls) || 0));
        const nextPearls = currentPearls + amount;
        payload.pearls = nextPearls;
        grant = {
            name: "Pearls",
            value: formatAdminCompensationValue(amount),
            detail: `Pearls ${currentPearls.toLocaleString()} -> ${nextPearls.toLocaleString()}`
        };
        Object.assign(result, { pearlsAdded: amount, pearls: nextPearls });
    } else if (normalizedType === "crates") {
        const inventory = normalizeCrateInventory(data.crateInventory || {});
        inventory.reef = (Number(inventory.reef) || 0) + amount;
        payload.crateInventory = inventory;
        payload.crateInventoryUpdatedAt = nowMs;
        grant = {
            name: "Cosmetic Crates",
            value: formatAdminCompensationValue(amount),
            detail: `Cosmetic Crates ${inventory.reef.toLocaleString()} total`
        };
        Object.assign(result, { cratesAdded: amount, crateInventory: inventory });
    } else if (normalizedType === "streak_shields") {
        const currentShields = getStreakShieldCount(data);
        const nextShields = Math.min(3, currentShields + amount);
        const actualAmount = nextShields - currentShields;
        if (actualAmount <= 0) {
            throw new Error("That player already has max streak shields.");
        }
        payload.streakShields = nextShields;
        grant = {
            name: "Streak Shields",
            value: formatAdminCompensationValue(actualAmount),
            detail: `Streak Shields ${currentShields} -> ${nextShields}`
        };
        Object.assign(result, { shieldsAdded: actualAmount, streakShields: nextShields });
    } else if (normalizedType === "spins") {
        const currentSpins = normalizeDailySpinBonusCount(data.dailySpinBonusSpins);
        const nextSpins = currentSpins + amount;
        payload.dailySpinBonusSpins = nextSpins;
        grant = {
            name: "Daily Spins",
            value: formatAdminCompensationValue(amount),
            detail: `Daily Spins ${currentSpins.toLocaleString()} -> ${nextSpins.toLocaleString()}`
        };
        Object.assign(result, { spinsAdded: amount, dailySpinBonusSpins: nextSpins });
    }

    payload.adminCompensationNotice = buildAdminCompensationNotice(grant, nowMs);
    payload.lastAdminCompensation = {
        type: normalizedType,
        amount: Number(String(grant.value).replace(/[^0-9]/g, "")) || amount,
        label: `${grant.name} ${grant.value}`,
        grantedAt: nowMs,
        grantedBy: currentUser.uid
    };

    return { payload, grant, result, type: normalizedType };
}

async function compensatePlayer(target, type = "levels", amount = 1) {
    const normalizedType = normalizeAdminCompensationType(type);
    const count = getAdminCompensationAmount(normalizedType, amount);
    const targetUser = await resolveAdminTargetUserStats(target);
    const nowMs = Date.now();
    const { payload, grant, result } = buildAdminCompensationPayload(targetUser, normalizedType, count, nowMs);

    await targetUser.ref.set(payload, { merge: true });

    if (targetUser.uid === currentUser.uid) {
        await loadUserProfile();
        updateAuthUI();
    }

    return {
        uid: targetUser.uid,
        username: getAdminPlayerLabel(targetUser.uid, targetUser.data),
        type: normalizedType,
        amount: count,
        grant,
        ...result
    };
}

function addLevelsToPlayer(target, levelsToAdd = 1) {
    return compensatePlayer(target, "levels", levelsToAdd);
}

function addXPToPlayer(target, xpAmount = 1) {
    return compensatePlayer(target, "xp", xpAmount);
}

function addPearlsToPlayer(target, pearlAmount = 1) {
    return compensatePlayer(target, "pearls", pearlAmount);
}

function addCratesToPlayer(target, crateAmount = 1) {
    return compensatePlayer(target, "crates", crateAmount);
}

function addStreakShieldsToPlayer(target, shieldAmount = 1) {
    return compensatePlayer(target, "streak_shields", shieldAmount);
}

function giveSpinsToPlayer(target, spinAmount = 1) {
    return compensatePlayer(target, "spins", spinAmount);
}

async function refreshAdminAbusePanel() {
    if (!isDeveloperSessionActive() || !db) return false;

    const visitorInsightsPromise = adminRefreshVisitorInsights();
    const [xpDoc, themeDoc, messageDoc] = await Promise.all([
        db.collection(GLOBAL_XP_EVENT_CONFIG_PATH.collection).doc(GLOBAL_XP_EVENT_CONFIG_PATH.doc).get(),
        db.collection(GLOBAL_INDEX_THEME_CONFIG_PATH.collection).doc(GLOBAL_INDEX_THEME_CONFIG_PATH.doc).get(),
        db.collection(GLOBAL_MESSAGE_CONFIG_PATH.collection).doc(GLOBAL_MESSAGE_CONFIG_PATH.doc).get()
    ]);

    const xpData = xpDoc.exists ? (xpDoc.data() || {}) : {};
    const themeData = themeDoc.exists ? (themeDoc.data() || {}) : {};
    const messageData = messageDoc.exists ? (messageDoc.data() || {}) : {};

    const themeSelect = document.getElementById("admin-index-theme-select");
    if (themeSelect) {
        themeSelect.value = normalizeIndexThemeId(themeData.themeId || "default");
    }

    const messageInput = document.getElementById("admin-global-message-input");
    if (messageInput) {
        messageInput.value = String(messageData.message || "");
    }

    const messageTypeSelect = document.getElementById("admin-global-message-type");
    if (messageTypeSelect) {
        messageTypeSelect.value = normalizeGlobalMessageType(messageData.type || "info");
    }

    if (xpData.enabled) {
        setAdminAbuseStatus(
            "admin-xp-status",
            `Global 2x XP is live until ${formatAdminDateTime(xpData.endMs)}.`
        );
    } else {
        setAdminAbuseStatus("admin-xp-status", "Global 2x XP is currently off.");
    }

    const themeName = INDEX_THEME_OPTIONS.find(option => option.id === normalizeIndexThemeId(themeData.themeId || "default"))?.name || "Default Ocean";
    setAdminAbuseStatus(
        "admin-theme-status",
        `Current index theme: ${themeName}.`
    );

    if (messageData.enabled && messageData.message) {
        setAdminAbuseStatus(
            "admin-message-status",
            `Live message (${normalizeGlobalMessageType(messageData.type)}): ${String(messageData.message).slice(0, 120)}`
        );
    } else {
        setAdminAbuseStatus("admin-message-status", "No global message is active.");
    }

    await visitorInsightsPromise;

    return true;
}

async function adminStartGlobalXpEvent() {
    if (!isDeveloperSessionActive()) {
        showNotification("Developer access required.", "error", 3000);
        return;
    }
    const hours = getAdminPositiveCountValue("admin-global-xp-hours", 24);
    setAdminAbuseStatus("admin-xp-status", "Starting global 2x XP...");
    try {
        const eventConfig = await startGlobalDoubleXpEvent(hours);
        if (!eventConfig) {
            setAdminAbuseStatus("admin-xp-status", "Could not start global 2x XP. Check console logs.", { error: true });
            return;
        }
        const endLabel = formatAdminDateTime(eventConfig.endMs);
        setAdminAbuseStatus("admin-xp-status", `Global 2x XP started for ${hours}h. Ends ${endLabel}.`);
        showNotification(`Global 2x XP started for ${hours} hour${hours === 1 ? "" : "s"}.`, "success", 3200);
    } catch (error) {
        setAdminAbuseStatus("admin-xp-status", `Failed to start XP event: ${error.message || error}`, { error: true });
    }
}

async function adminStopGlobalXpEvent() {
    if (!isDeveloperSessionActive()) {
        showNotification("Developer access required.", "error", 3000);
        return;
    }
    setAdminAbuseStatus("admin-xp-status", "Stopping global 2x XP...");
    try {
        const update = await stopGlobalDoubleXpEvent();
        if (!update) {
            setAdminAbuseStatus("admin-xp-status", "Could not stop global 2x XP. Check console logs.", { error: true });
            return;
        }
        setAdminAbuseStatus("admin-xp-status", `Global 2x XP stopped at ${formatAdminDateTime(update.endMs)}.`);
        showNotification("Global 2x XP stopped.", "success", 3000);
    } catch (error) {
        setAdminAbuseStatus("admin-xp-status", `Failed to stop XP event: ${error.message || error}`, { error: true });
    }
}

async function adminGrantGlobalCrates() {
    if (!isDeveloperSessionActive()) {
        showNotification("Developer access required.", "error", 3000);
        return;
    }
    const amount = getAdminPositiveCountValue("admin-grant-crates-count", 1);
    setAdminAbuseStatus("admin-grant-status", `Granting ${amount} crate${amount === 1 ? "" : "s"} to active players...`);
    try {
        const result = await grantGlobalCrates(amount);
        const activeMinutes = Math.round(result.activeWindowMs / 60000);
        setAdminAbuseStatus(
            "admin-grant-status",
            `Granted ${amount} crate${amount === 1 ? "" : "s"} to ${result.updatedUsers} active player${result.updatedUsers === 1 ? "" : "s"} (last ${activeMinutes}m).`
        );
        showNotification(`Granted crates to ${result.updatedUsers} active player${result.updatedUsers === 1 ? "" : "s"}.`, "success", 3400);
    } catch (error) {
        setAdminAbuseStatus("admin-grant-status", `Crate grant failed: ${error.message || error}`, { error: true });
    }
}

async function adminGrantGlobalStreakShields() {
    if (!isDeveloperSessionActive()) {
        showNotification("Developer access required.", "error", 3000);
        return;
    }
    const amount = getAdminPositiveCountValue("admin-grant-shields-count", 1);
    setAdminAbuseStatus("admin-grant-status", `Granting ${amount} streak shield${amount === 1 ? "" : "s"} to active players...`);
    try {
        const result = await grantGlobalStreakShields(amount);
        const activeMinutes = Math.round(result.activeWindowMs / 60000);
        setAdminAbuseStatus(
            "admin-grant-status",
            `Granted ${amount} streak shield${amount === 1 ? "" : "s"} to ${result.updatedUsers} active player${result.updatedUsers === 1 ? "" : "s"} (last ${activeMinutes}m).`
        );
        showNotification(`Granted streak shields to ${result.updatedUsers} active player${result.updatedUsers === 1 ? "" : "s"}.`, "success", 3400);
    } catch (error) {
        setAdminAbuseStatus("admin-grant-status", `Shield grant failed: ${error.message || error}`, { error: true });
    }
}

async function adminCompensatePlayer() {
    if (!isDeveloperSessionActive()) {
        showNotification("Developer access required.", "error", 3000);
        return;
    }

    const targetInput = document.getElementById("admin-player-comp-target");
    const typeSelect = document.getElementById("admin-player-comp-type");
    const countInput = document.getElementById("admin-player-comp-count");
    const target = String(targetInput?.value || "").trim();
    const type = normalizeAdminCompensationType(typeSelect?.value || "levels");
    const count = Math.floor(Number(countInput?.value));

    if (!target) {
        setAdminAbuseStatus("admin-comp-status", "Enter a UID or exact username.", { error: true });
        return;
    }

    try {
        const safeCount = getAdminCompensationAmount(type, count);
        const meta = ADMIN_COMPENSATION_TYPES[type];
        setAdminAbuseStatus("admin-comp-status", `Giving ${safeCount.toLocaleString()} ${meta.name}...`);
        const result = await compensatePlayer(target, type, safeCount);
        const detail = result.grant.detail ? ` (${result.grant.detail})` : "";
        setAdminAbuseStatus(
            "admin-comp-status",
            `Gave ${result.grant.value} ${result.grant.name} to ${result.username}${detail}.`
        );
        showNotification(`Gave ${result.grant.value} ${result.grant.name} to ${result.username}.`, "success", 3400);
    } catch (error) {
        setAdminAbuseStatus("admin-comp-status", `Compensation failed: ${error.message || error}`, { error: true });
    }
}

function adminAddPlayerLevels() {
    return adminCompensatePlayer();
}

async function adminApplyIndexTheme() {
    if (!isDeveloperSessionActive()) {
        showNotification("Developer access required.", "error", 3000);
        return;
    }
    const themeSelect = document.getElementById("admin-index-theme-select");
    const themeId = themeSelect?.value || "default";
    setAdminAbuseStatus("admin-theme-status", "Applying index theme...");
    try {
        const payload = await setGlobalIndexTheme(themeId);
        setAdminAbuseStatus("admin-theme-status", `Index theme set to ${payload.themeName}.`);
        showNotification(`Index theme changed to ${payload.themeName}.`, "success", 3200);
    } catch (error) {
        setAdminAbuseStatus("admin-theme-status", `Theme update failed: ${error.message || error}`, { error: true });
    }
}

async function adminSetGlobalMessage() {
    if (!isDeveloperSessionActive()) {
        showNotification("Developer access required.", "error", 3000);
        return;
    }
    const messageInput = document.getElementById("admin-global-message-input");
    const messageTypeSelect = document.getElementById("admin-global-message-type");
    const message = String(messageInput?.value || "").trim();
    const type = normalizeGlobalMessageType(messageTypeSelect?.value || "info");
    if (!message) {
        setAdminAbuseStatus("admin-message-status", "Write a message before publishing.", { error: true });
        return;
    }
    setAdminAbuseStatus("admin-message-status", "Publishing global message...");
    try {
        await setGlobalMessageConfig(message, type);
        setAdminAbuseStatus("admin-message-status", `Published ${type} message: ${message.slice(0, 120)}`);
        showNotification("Global message published.", "success", 3200);
    } catch (error) {
        setAdminAbuseStatus("admin-message-status", `Message publish failed: ${error.message || error}`, { error: true });
    }
}

async function adminClearGlobalMessage() {
    if (!isDeveloperSessionActive()) {
        showNotification("Developer access required.", "error", 3000);
        return;
    }
    setAdminAbuseStatus("admin-message-status", "Clearing global message...");
    try {
        await setGlobalMessageConfig("", "info");
        const messageInput = document.getElementById("admin-global-message-input");
        if (messageInput) messageInput.value = "";
        setAdminAbuseStatus("admin-message-status", "Global message cleared.");
        showNotification("Global message cleared.", "success", 3000);
    } catch (error) {
        setAdminAbuseStatus("admin-message-status", `Message clear failed: ${error.message || error}`, { error: true });
    }
}

function openAdminAbuseMenu() {
    openAdminAbuseModal();
    return "Opened the Admin Abuse panel.";
}

async function startGlobalDoubleXpEvent(hours = 72) {
    if (!firebase.auth().currentUser || !isDeveloperUid(firebase.auth().currentUser.uid)) {
        console.log("? Access denied. This command is for developers only.");
        return null;
    }
    if (!currentUser) {
        console.log("? Error: User must be logged in");
        return null;
    }

    const durationHours = Number(hours);
    if (!Number.isFinite(durationHours) || durationHours <= 0) {
        console.log("? Usage: startGlobalDoubleXpEvent(72)");
        return null;
    }

    try {
        const nowMs = Date.now();
        const endMs = nowMs + Math.round(durationHours * 60 * 60 * 1000);
        const eventConfig = {
            id: `global-double-xp-${nowMs}`,
            label: "2x XP Event",
            multiplier: 2,
            enabled: true,
            startMs: nowMs,
            endMs,
            startedBy: currentUser.uid,
            updatedAt: nowMs
        };

        await db.collection(GLOBAL_XP_EVENT_CONFIG_PATH.collection)
            .doc(GLOBAL_XP_EVENT_CONFIG_PATH.doc)
            .set(eventConfig, { merge: true });

        globalXpEventOverride = eventConfig;
        ensureXpEventBannerTimer();

        console.log(`? Started global 2x XP event for ${durationHours} hour${durationHours === 1 ? "" : "s"}.`);
        return eventConfig;
    } catch (error) {
        console.error("? Error starting global 2x XP event:", error);
        return null;
    }
}

async function stopGlobalDoubleXpEvent() {
    if (!firebase.auth().currentUser || !isDeveloperUid(firebase.auth().currentUser.uid)) {
        console.log("? Access denied. This command is for developers only.");
        return null;
    }
    if (!currentUser) {
        console.log("? Error: User must be logged in");
        return null;
    }

    try {
        const update = {
            enabled: false,
            endMs: Date.now(),
            updatedAt: Date.now(),
            stoppedBy: currentUser.uid
        };
        await db.collection(GLOBAL_XP_EVENT_CONFIG_PATH.collection)
            .doc(GLOBAL_XP_EVENT_CONFIG_PATH.doc)
            .set(update, { merge: true });

        globalXpEventOverride = {
            ...(globalXpEventOverride || {}),
            ...update
        };
        ensureXpEventBannerTimer();

        console.log("? Stopped the global 2x XP event.");
        return update;
    } catch (error) {
        console.error("? Error stopping global 2x XP event:", error);
        return null;
    }
}

async function addLoginDays(days) {
    if (!firebase.auth().currentUser || !isDeveloperUid(firebase.auth().currentUser.uid)) {
        console.log("? Access denied. This command is for developers only.");
        return;
    }
    if (!currentUser) {
        console.log("? Error: User must be logged in");
        return;
    }

    const amount = Number(days);
    if (!Number.isFinite(amount) || amount <= 0) {
        console.log("? Usage: addLoginDays(7)");
        return;
    }

    try {
        const currentLoginDay = parseInt(localStorage.getItem("currentLoginDay")) || 1;
        const loginStreak = parseInt(localStorage.getItem("loginStreak")) || 1;
        const nextLoginDay = currentLoginDay + Math.floor(amount);
        const nextLoginStreak = loginStreak + Math.floor(amount);
        const today = getLocalDateKey();

        localStorage.setItem("currentLoginDay", String(nextLoginDay));
        localStorage.setItem("loginStreak", String(nextLoginStreak));
        localStorage.setItem("lastLoginDate", today);
        localStorage.removeItem(getDailyLoginModalShownStorageKey());

        await db.collection("userStats").doc(currentUser.uid).set({
            currentLoginDay: nextLoginDay,
            loginStreak: nextLoginStreak,
            lastLoginDate: today
        }, { merge: true });

        await ensureLoginStreakRewards();
        await loadUserProfile();
        if (typeof loadAvailablePFPs === "function") loadAvailablePFPs();
        if (typeof loadEarnedCosmetics === "function") loadEarnedCosmetics();

        console.log(`? Added ${Math.floor(amount)} login day(s). Current login day: ${nextLoginDay}. Login streak: ${nextLoginStreak}.`);
        if (nextLoginDay >= 7 || nextLoginStreak >= 7) {
            console.log("Day 7 Barndoor Skate reward check completed.");
        }
    } catch (error) {
        console.error("? Error adding login days:", error);
    }
}

async function skipLoginDay(days = 1) {
    if (!firebase.auth().currentUser || !isDeveloperUid(firebase.auth().currentUser.uid)) {
        console.log("? Access denied. This command is for developers only.");
        return;
    }
    if (!currentUser) {
        console.log("? Error: User must be logged in");
        return;
    }

    const amount = Number(days);
    if (!Number.isFinite(amount) || amount <= 0) {
        console.log("? Usage: skipLoginDay(1)");
        return;
    }

    const skippedDays = Math.floor(amount);

    try {
        const simulatedLastLogin = new Date();
        simulatedLastLogin.setHours(12, 0, 0, 0);
        // Skip N calendar days means the previous login was N+1 days ago.
        simulatedLastLogin.setDate(simulatedLastLogin.getDate() - (skippedDays + 1));
        const simulatedLastLoginDate = getLocalDateKey(simulatedLastLogin);
        if (!simulatedLastLoginDate) {
            console.log("? Could not generate a valid simulated login date.");
            return;
        }

        localStorage.setItem("lastLoginDate", simulatedLastLoginDate);
        localStorage.removeItem(getDailyLoginModalShownStorageKey());

        await db.collection("userStats").doc(currentUser.uid).set({
            lastLoginDate: simulatedLastLoginDate,
            dailyLoginModalShownToday: ""
        }, { merge: true });

        await initializeDailyLogin();
        await loadUserProfile();

        const currentLoginDay = parseInt(localStorage.getItem("currentLoginDay")) || 1;
        const loginStreak = parseInt(localStorage.getItem("loginStreak")) || 1;
        console.log(`? Simulated skipping ${skippedDays} day(s).`);
        console.log(`   lastLoginDate set to ${simulatedLastLoginDate}`);
        console.log(`   Post-check login day: ${currentLoginDay}, login streak: ${loginStreak}`);
    } catch (error) {
        console.error("? Error skipping login day:", error);
    }
}

async function simulateNextLoginDay() {
    if (!firebase.auth().currentUser || !isDeveloperUid(firebase.auth().currentUser.uid)) {
        console.log("? Access denied. This command is for developers only.");
        return;
    }
    if (!currentUser) {
        console.log("? Error: User must be logged in");
        return;
    }

    try {
        const simulatedLastLogin = new Date();
        simulatedLastLogin.setHours(12, 0, 0, 0);
        simulatedLastLogin.setDate(simulatedLastLogin.getDate() - 1);
        const simulatedLastLoginDate = getLocalDateKey(simulatedLastLogin);
        if (!simulatedLastLoginDate) {
            console.log("? Could not generate a valid simulated login date.");
            return;
        }

        localStorage.setItem("lastLoginDate", simulatedLastLoginDate);
        localStorage.removeItem(getDailyLoginModalShownStorageKey());

        await db.collection("userStats").doc(currentUser.uid).set({
            lastLoginDate: simulatedLastLoginDate,
            dailyLoginModalShownToday: ""
        }, { merge: true });

        await initializeDailyLogin();
        await loadUserProfile();

        const currentLoginDay = parseInt(localStorage.getItem("currentLoginDay")) || 1;
        const loginStreak = parseInt(localStorage.getItem("loginStreak")) || 1;
        console.log("? Simulated a consecutive login day.");
        console.log(`   lastLoginDate set to ${simulatedLastLoginDate}`);
        console.log(`   Post-check login day: ${currentLoginDay}, login streak: ${loginStreak}`);
    } catch (error) {
        console.error("? Error simulating next login day:", error);
    }
}

// Bulk add function for quick testing
async function addTestStats() {
    if (!firebase.auth().currentUser || !isDeveloperUid(firebase.auth().currentUser.uid)) {
        console.log("? Access denied. This command is for developers only.");
        return;
    }
    return addStats({
        xp: 500,
        wins: 10,
        losses: 5,
        gamesPlayed: 15,
        totalGuesses: 75
    });
}

async function forceRedeemCode(code) {
    if (!firebase.auth().currentUser || !isDeveloperUid(firebase.auth().currentUser.uid)) {
        console.log("? Access denied. This command is for developers only.");
        return;
    }
    if (!currentUser) {
        console.log("? Error: User must be logged in");
        return;
    }

    const codeUpper = (code || "").toUpperCase().trim();
    if (!redeemCodes[codeUpper]) {
        console.log(`? Code "${codeUpper}" does not exist.`);
        return;
    }

    try {
        const userProfile = getCurrentProfileData();
        const currentXP = userProfile.totalXP || 0;
        const codeReward = redeemCodes[codeUpper];

        // Add XP
        const xpAward = typeof window.applyLimitedTimeXpBonus === "function"
            ? window.applyLimitedTimeXpBonus(codeReward.xp)
            : { totalXp: codeReward.xp };
        const newXP = currentXP + xpAward.totalXp;
        userProfile.totalXP = newXP;
        applySharkPassXpGain(userProfile, xpAward.totalXp);

        // Add cosmetics if any
        const newlyUnlockedCosmetics = [];
        if (codeReward.cosmetics) {
            if (!userProfile.earnedCosmetics) {
                userProfile.earnedCosmetics = [];
            }
            codeReward.cosmetics.forEach(cosmetic => {
                if (!userProfile.earnedCosmetics.some(c => c.name === cosmetic.name)) {
                    userProfile.earnedCosmetics.push(cosmetic);
                    newlyUnlockedCosmetics.push(cosmetic);
                }
            });
        }

        // Add badge if any
        if (codeReward.badge) {
            if (codeReward.badge === "tester") {
                userProfile.testerBadgeUnlocked = true;
            }
            if (!Array.isArray(userProfile.unlockedBadges)) {
                userProfile.unlockedBadges = ["starter"];
            }
            if (!userProfile.unlockedBadges.includes(codeReward.badge)) {
                userProfile.unlockedBadges.push(codeReward.badge);
            }
        }

        const grantedCrates = applyCodeCrateRewards(userProfile, codeReward.crates);

        saveUserProfileLocally(userProfile);

        // Sync to Firebase
        if (currentUser) {
            const statsRef = db.collection("userStats").doc(currentUser.uid);
            await statsRef.set({
                totalXP: newXP,
                ...getSharkPassSyncPayload(userProfile),
                earnedCosmetics: userProfile.earnedCosmetics,
                testerBadgeUnlocked: userProfile.testerBadgeUnlocked,
                unlockedBadges: userProfile.unlockedBadges,
                crateInventory: normalizeCrateInventory(userProfile.crateInventory),
                crateInventoryUpdatedAt: getCrateInventoryUpdatedAt(userProfile)
            }, { merge: true });
        }

        // Mark code as redeemed (so it doesn't get re-added accidentally)
        addRedeemedCode(codeUpper);

        // Sync redeemed codes to Firebase
        if (currentUser) {
            const redeemedCodesList = getRedeemedCodes();
            const statsRef = db.collection("userStats").doc(currentUser.uid);
            await statsRef.set({ redeemedCodes: redeemedCodesList }, { merge: true });
        }

        console.log(`? Force-redeemed code "${codeUpper}". Rewards:`);
        if (codeReward.xp) console.log(`   XP: +${xpAward.totalXp} (new total: ${newXP})`);
        if (codeReward.cosmetics) {
            codeReward.cosmetics.forEach(c => console.log(`   Cosmetic: ${c.name}`));
        }
        if (codeReward.badge) console.log(`   Badge: ${codeReward.badge}`);
        grantedCrates.forEach(crate => console.log(`   Crate: +${crate.count} ${crate.name}`));

        loadUserProfile();
        loadEarnedCosmetics();
        loadAvailablePFPs();
        renderCratesButton();
        renderCratesModal();
        updateSeasonalCratePanels();

    } catch (error) {
        console.error("? Error force-redeeming code:", error);
    }
}

async function addCrates(amount = 1) {
    if (!firebase.auth().currentUser || !isDeveloperUid(firebase.auth().currentUser.uid)) {
        console.log("? Access denied. This command is for developers only.");
        return;
    }
    if (!currentUser) {
        console.log("? Error: User must be logged in");
        return;
    }

    const count = Math.floor(Number(amount));
    if (!Number.isFinite(count) || count <= 0) {
        console.log("? Usage: addCrates(3)");
        return;
    }

    try {
        const profileData = getCurrentProfileData();
        const inventory = getCrateInventory(profileData);
        inventory.reef += count;
        profileData.crateInventory = normalizeCrateInventory(inventory);
        markCrateInventoryChanged(profileData);
        saveUserProfileLocally(profileData);
        await db.collection("userStats").doc(currentUser.uid).set({
            crateInventory: profileData.crateInventory,
            crateInventoryUpdatedAt: getCrateInventoryUpdatedAt(profileData)
        }, { merge: true });
        renderCratesButton();
        renderCratesModal();
        console.log(`? Added ${count} Cosmetic Crate${count === 1 ? "" : "s"}. Total: ${profileData.crateInventory.reef}`);
    } catch (error) {
        console.error("? Error adding crates:", error);
    }
}

async function addStreakShields(amount = 1) {
    if (!firebase.auth().currentUser || !isDeveloperUid(firebase.auth().currentUser.uid)) {
        console.log("? Access denied. This command is for developers only.");
        return;
    }
    if (!currentUser) {
        console.log("? Error: User must be logged in");
        return;
    }

    const count = Math.floor(Number(amount));
    if (!Number.isFinite(count) || count <= 0) {
        console.log("? Usage: addStreakShields(3)");
        return;
    }

    try {
        const profileData = getCurrentProfileData();
        setStreakShieldCount(profileData, getStreakShieldCount(profileData) + count);
        saveUserProfileLocally(profileData);
        await db.collection("userStats").doc(currentUser.uid).set({
            streakShields: getStreakShieldCount(profileData)
        }, { merge: true });
        renderCratesModal();
        if (typeof renderConsumablesPage === "function") {
            renderConsumablesPage();
        }
        console.log(`? Added ${count} Streak Shield${count === 1 ? "" : "s"}. Total: ${getStreakShieldCount(profileData)}`);
    } catch (error) {
        console.error("? Error adding streak shields:", error);
    }
}

async function addLostBottles(amount = 1, bottleId = "barnacle") {
    if (!firebase.auth().currentUser || !isDeveloperUid(firebase.auth().currentUser.uid)) {
        console.log("\u{274C} Access denied. This command is for developers only.");
        return;
    }
    if (!currentUser) {
        console.log("\u{274C} Error: User must be logged in");
        return;
    }

    const count = Math.floor(Number(amount));
    if (!Number.isFinite(count) || count <= 0) {
        console.log("\u{274C} Usage: addLostBottles(5, 'barnacle')");
        return;
    }

    try {
        const profileData = getCurrentProfileData();
        const result = grantLostTreasuresBottle(profileData, bottleId, count);
        await persistLostTreasuresState(profileData);
        renderLostTreasuresModal?.();
        console.log(`\u{2705} Added ${count} ${result.bottle.name}${count === 1 ? "" : "s"}. Total bottles: ${getLostTreasuresBottleCount(result.state)}`);
    } catch (error) {
        console.error("\u{274C} Error adding Lost Treasures bottles:", error);
    }
}

window.addLostBottles = addLostBottles;

// Display current stats
function showStats() {
    const userProfile = JSON.parse(localStorage.getItem("userProfile") || "{}");
    console.log("=== CURRENT STATS ===");
    console.log(`XP: ${userProfile.totalXP || 0}`);
    console.log(`Wins: ${userProfile.wins || 0}`);
    console.log(`Losses: ${userProfile.losses || 0}`);
    console.log(`Games Played: ${userProfile.gamesPlayed || 0}`);
    console.log(`Total Guesses: ${userProfile.totalGuesses || 0}`);
    console.log(`Current Streak: ${userProfile.currentStreak || 0}`);
    console.log(`Highest Streak: ${userProfile.highestStreak || 0}`);
    console.log(`Streak Shields: ${Math.max(0, Number(userProfile.streakShields) || 0)}`);
    console.log(`Lost Treasures Bottles: ${getLostTreasuresBottleCount(getLostTreasuresState(userProfile))}`);
    console.log(`Login Day: ${parseInt(localStorage.getItem("currentLoginDay")) || 1}`);
    console.log(`Login Streak: ${parseInt(localStorage.getItem("loginStreak")) || 1}`);
    console.log(`Level: ${getLevelFromXP(userProfile.totalXP || 0)}`);
    console.log("====================");
}

// Print available commands
function showCommands() {
    console.log("=== AVAILABLE STAT COMMANDS ===");
    console.log("addStats({xp: 100, wins: 1, losses: 1, gamesPlayed: 1, totalGuesses: 5})");
    console.log("addXP(100) - Add XP");
    console.log("setLevel(10) - Set your level directly");
    console.log("openAdminAbuseMenu() - Open the Admin Abuse panel");
    console.log("compensatePlayer('uid-or-username', 'xp', 500) - Give a targeted admin compensation");
    console.log("addLevelsToPlayer('uid-or-username', 3) - Add Shark Pass levels to a player");
    console.log("addXPToPlayer('uid-or-username', 500) - Add XP to a player");
    console.log("addPearlsToPlayer('uid-or-username', 100) - Add pearls to a player");
    console.log("addCratesToPlayer('uid-or-username', 2) - Add Cosmetic Crates to a player");
    console.log("addStreakShieldsToPlayer('uid-or-username', 1) - Add Streak Shields to a player");
    console.log("giveSpinsToPlayer('uid-or-username', 1) - Add daily wheel spins to a player");
    console.log("startGlobalDoubleXpEvent(72) - Start a global 2x XP event");
    console.log("stopGlobalDoubleXpEvent() - Stop the global 2x XP event");
    console.log("addWin() - Add 1 win");
    console.log("addLoss() - Add 1 loss");
    console.log("addGuesses(10) - Add guesses");
    console.log("addLoginDays(7) - Add login days/streak and test login rewards");
    console.log("simulateNextLoginDay() - Simulate logging in the day after your last login");
    console.log("skipLoginDay(1) - Simulate missing 1 day and re-run daily login logic");
    console.log("addCrates(3) - Add Cosmetic Crates for testing");
    console.log("addStreakShields(3) - Add Streak Shields for testing");
    console.log("addLostBottles(5, 'barnacle') - Add Lost Treasures bottles for testing");
    console.log("giveDailySpin(5) / giveSpin(5) - Grant daily wheel spins for testing");
    console.log("resetDailySpin() - Reset today's daily spin wheel");
    console.log("unlockAllCosmetics() - Unlock all profile icons, badges, and themes");
    console.log("addTestStats() - Quick test add (500 XP, 10 wins, 5 losses, 15 games, 75 guesses)");
    console.log("revealShark() - Reveal the currently open duel shark");
    console.log("revealShark('duel_id') - Reveal a specific duel shark by id");
    console.log("showStats() - Display current stats");
    console.log("showCommands() - Show this help");
    console.log("================================");
}

// Profile modal overhaul helpers
function syncProfileOverviewStats(profileData = getCurrentProfileData()) {
    const map = {
        "profile-xp-overview": profileData.totalGuesses ?? 0,
        "profile-wins-overview": profileData.wins ?? 0,
        "profile-current-streak-overview": profileData.currentStreak ?? 0,
        "profile-best-game-overview": profileData.bestGame ?? 0
    };
    Object.entries(map).forEach(([id, value]) => {
        const el = document.getElementById(id);
        if (el) el.textContent = value;
    });
    const previewName = document.getElementById("profile-username-overview-preview");
    const previewPic = document.getElementById("profile-pic-overview-preview");
    if (previewName) previewName.textContent = profileData.username || currentUser?.email?.split("@")[0] || "Sharkdle Player";
    if (previewPic) previewPic.src = profileData.profilePicture || "images/pfp/shark1.png";
}

function renderSocialRewards(profileData = getCurrentProfileData()) {
    const list = document.getElementById("social-rewards-list");
    const balance = document.getElementById("social-rewards-pearls");
    if (!list && !balance) return;

    const isLoggedIn = Boolean(
        currentUser
        || window.currentUser
        || (typeof firebase !== "undefined" && typeof firebase.auth === "function" && firebase.auth().currentUser)
    );
    const claimed = getClaimedSocialRewards(profileData);
    if (balance) balance.textContent = isLoggedIn ? getPearlCount(profileData).toLocaleString() : "0";
    if (!list) return;

    const groupSummaries = SOCIAL_REWARD_GROUPS.map(group => {
        const tasks = SOCIAL_REWARD_TASKS.filter(task => task.platform === group.platform);
        const claimedCount = tasks.filter(task => claimed.includes(task.id)).length;
        const totalPearls = tasks.reduce((sum, task) => sum + task.pearls, 0);
        const remainingPearls = tasks
            .filter(task => !claimed.includes(task.id))
            .reduce((sum, task) => sum + task.pearls, 0);
        return { ...group, tasks, claimedCount, totalPearls, remainingPearls };
    });
    const totalTasks = groupSummaries.reduce((sum, group) => sum + group.tasks.length, 0);
    const totalClaimed = groupSummaries.reduce((sum, group) => sum + group.claimedCount, 0);
    const totalAvailablePearls = groupSummaries.reduce((sum, group) => sum + group.remainingPearls, 0);
    const firstOpenGroup = groupSummaries.find(group => group.claimedCount < group.tasks.length)?.id || groupSummaries[0]?.id || "";

    list.innerHTML = `
        <div class="social-rewards-overview">
            <div class="social-rewards-total-card">
                <span>Progress</span>
                <strong>${totalClaimed}/${totalTasks}</strong>
                <small>${totalAvailablePearls.toLocaleString()} pearls left to claim</small>
            </div>
            <div class="social-rewards-platform-grid">
                ${groupSummaries.map(group => {
                    const percent = group.tasks.length ? Math.round((group.claimedCount / group.tasks.length) * 100) : 0;
                    return `
                        <div class="social-rewards-platform-card social-rewards-platform-${group.id}">
                            <i class="${group.icon}" aria-hidden="true"></i>
                            <span>${group.label}</span>
                            <strong>${group.claimedCount}/${group.tasks.length}</strong>
                            <div class="social-rewards-progress" aria-hidden="true"><span style="width:${percent}%"></span></div>
                        </div>
                    `;
                }).join("")}
            </div>
        </div>
        ${groupSummaries.map(group => {
        const openAttr = group.id === firstOpenGroup ? " open" : "";
        return `
            <details class="social-reward-group social-reward-group-${group.id}"${openAttr}>
                <summary>
                    <span class="social-reward-group-icon"><i class="${group.icon}" aria-hidden="true"></i></span>
                    <span><strong>${group.label}</strong><small>${group.description}</small></span>
                    <b>${group.claimedCount}/${group.tasks.length}</b>
                    <i class="fa-solid fa-chevron-down" aria-hidden="true"></i>
                </summary>
                <div class="social-reward-group-meta">
                    <span>${group.tasks.length} task${group.tasks.length === 1 ? "" : "s"}</span>
                    <span><i class="fa-solid fa-gem"></i>${group.remainingPearls.toLocaleString()} unclaimed</span>
                    <span>${group.totalPearls.toLocaleString()} total pearls</span>
                </div>
                <div class="social-reward-group-list">
                    ${group.tasks.map(task => {
                        const isClaimed = claimed.includes(task.id);
                        return `
                            <article class="social-reward-card ${isClaimed ? "claimed" : ""}">
                                <i class="${task.icon}" aria-hidden="true"></i>
                                <div class="social-reward-copy">
                                    <span>${task.platform}</span>
                                    <strong>${task.action}</strong>
                                    <small>${task.description}</small>
                                </div>
                                <div class="social-reward-card-actions">
                                    <div class="social-reward-prize"><i class="fa-solid fa-gem"></i>${task.pearls}</div>
                                    <button type="button" onclick="claimSocialReward('${task.id}')" ${isClaimed || !isLoggedIn ? "disabled" : ""}>
                                        <i class="fa-solid ${isClaimed ? "fa-check" : "fa-arrow-up-right-from-square"}" aria-hidden="true"></i>
                                        <span>${isClaimed ? "Claimed" : "Open"}</span>
                                    </button>
                                </div>
                            </article>
                        `;
                    }).join("")}
                </div>
            </details>
        `;
    }).join("")}
    `;
}

let pendingSocialRewardTaskId = "";

function openSocialRewardClaimPopup(task) {
    if (!task) return;
    pendingSocialRewardTaskId = task.id;
    const popup = document.getElementById("socialRewardClaimPopup");
    const icon = document.getElementById("social-reward-claim-icon");
    const platform = document.getElementById("social-reward-claim-platform");
    const title = document.getElementById("social-reward-claim-title");
    const copy = document.getElementById("social-reward-claim-copy");
    const pearls = document.getElementById("social-reward-claim-pearls");
    if (icon) icon.className = task.icon;
    if (platform) platform.textContent = task.platform;
    if (title) title.textContent = "Claim your pearls?";
    if (copy) copy.textContent = `Once you have completed "${task.action}", claim your reward here.`;
    if (pearls) pearls.textContent = String(task.pearls);
    popup?.classList.remove("hidden");
}

function closeSocialRewardClaimPopup() {
    pendingSocialRewardTaskId = "";
    document.getElementById("socialRewardClaimPopup")?.classList.add("hidden");
}

async function claimSocialReward(taskId) {
    const task = SOCIAL_REWARD_TASKS.find(entry => entry.id === taskId);
    if (!task) return false;
    const authUser = typeof firebase !== "undefined" && typeof firebase.auth === "function"
        ? firebase.auth().currentUser
        : null;
    if (!authUser && !currentUser && !window.currentUser) {
        showNotification("Login to claim social rewards.", "error", 3200);
        openLoginModal?.();
        return false;
    }

    const profileData = getCurrentProfileData();
    const claimed = getClaimedSocialRewards(profileData);
    if (claimed.includes(task.id)) {
        showNotification("That social reward is already claimed.", "info", 3000);
        renderSocialRewards(profileData);
        return false;
    }

    try {
        window.open(task.url, "_blank", "noopener,noreferrer");
    } catch (error) {
        window.location.href = task.url;
    }

    openSocialRewardClaimPopup(task);
    return true;
}

async function confirmSocialRewardClaim() {
    const task = SOCIAL_REWARD_TASKS.find(entry => entry.id === pendingSocialRewardTaskId);
    if (!task) return false;
    const authUser = typeof firebase !== "undefined" && typeof firebase.auth === "function"
        ? firebase.auth().currentUser
        : null;
    if (!authUser && !currentUser && !window.currentUser) {
        showNotification("Login to claim social rewards.", "error", 3200);
        closeSocialRewardClaimPopup();
        openLoginModal?.();
        return false;
    }

    const profileData = getCurrentProfileData();
    const claimed = getClaimedSocialRewards(profileData);
    if (claimed.includes(task.id)) {
        showNotification("That social reward is already claimed.", "info", 3000);
        closeSocialRewardClaimPopup();
        renderSocialRewards(profileData);
        return false;
    }

    addPearls(task.pearls, profileData, { deferSave: true, deferUiUpdate: true });
    setClaimedSocialRewards(profileData, [...claimed, task.id]);
    saveUserProfileLocally(profileData, { skipRemoteSync: true });
    updateHomeV3Sidebar?.(profileData);
    updatePearlShopUI?.();
    renderSocialRewards(profileData);

    const uid = authUser?.uid || currentUser?.uid || window.currentUser?.uid;
    if (uid && typeof db !== "undefined") {
        try {
            await db.collection("userStats").doc(uid).set({
                uid,
                pearls: getPearlCount(profileData),
                socialRewardsClaimed: getClaimedSocialRewards(profileData),
                lastUpdated: new Date()
            }, { merge: true });
            lastServerHydratedProfileUid = uid;
        } catch (error) {
            console.warn("Unable to sync social reward claim:", error);
            scheduleRemoteProfileSync?.(1200);
        }
    }

    showNotification(`Social reward claimed: +${task.pearls} pearls.`, "success", 3600);
    closeSocialRewardClaimPopup();
    return true;
}

window.renderSocialRewards = renderSocialRewards;
window.claimSocialReward = claimSocialReward;
window.confirmSocialRewardClaim = confirmSocialRewardClaim;
window.closeSocialRewardClaimPopup = closeSocialRewardClaimPopup;

const profileInventoryFilters = {
    portraits: "all",
    badges: "all",
    themes: "all",
    items: "all",
    search: ""
};

const cosmeticFilterLabels = {
    all: "All",
    starter: "Starter",
    pass: "Pass",
    crate: "Crates",
    reward: "Rewards",
    code: "Codes",
    common: "Common",
    rare: "Rare",
    epic: "Epic",
    legendary: "Legendary",
    item: "Items"
};

function normalizeCosmeticFilterValue(value = "all") {
    return String(value || "all").trim().toLowerCase();
}

function getCosmeticRarityLabel(rarity = "common") {
    const key = normalizeCosmeticFilterValue(rarity);
    return ({
        core: "Starter",
        starter: "Starter",
        special: "Special",
        code: "Code",
        common: "Common",
        uncommon: "Uncommon",
        rare: "Rare",
        epic: "Epic",
        legendary: "Legendary",
        item: "Item"
    })[key] || "Common";
}

function getShortCosmeticSourceLabel(source = "Reward") {
    const label = String(source || "Reward");
    const lower = label.toLowerCase();
    if (lower.includes("starter")) return "Starter";
    if (lower.includes("shark pass 2")) return label.replace("Shark Pass 2", "Pass 2");
    if (lower.includes("shark pass 1")) return label.replace("Shark Pass 1", "Pass 1");
    if (lower.includes("login reward 2")) return "Login 2";
    if (lower.includes("login reward 1")) return "Login 1";
    if (lower.includes("cosmetic crate 2")) return "Crate 2";
    if (lower.includes("cosmetic crate 1")) return "Crate 1";
    if (lower.includes("summer")) return "Summer";
    if (lower.includes("christmas")) return "Christmas";
    if (lower.includes("halloween")) return "Halloween";
    if (lower.includes("cosmetic crate")) return "Crate";
    if (lower.includes("crate")) return "Crate";
    if (lower.includes("shark pass")) return label.replace("Shark Pass level", "Pass Lv.").replace("Shark Pass", "Pass");
    if (lower.includes("pass lv")) return label;
    if (lower.includes("redeem") || lower.includes("code")) return "Code";
    if (lower.includes("leaderboard")) return "Leaderboard";
    if (lower.includes("login")) return "Login";
    if (lower.includes("wheel")) return "Wheel";
    if (lower.includes("achievement")) return "Achievement";
    return label.length > 12 ? `${label.slice(0, 11)}...` : label;
}

function getThemeCosmeticMeta(theme) {
    const passReward = sharkPassRewards.find(reward => reward.type === "theme" && reward.themeId === theme.id);
    const crateReward = getAllCrateRewardPools()
        .flat()
        .find(reward => reward.type === "theme" && reward.themeId === theme.id);
    const legacyCrate1Reward = getLegacyCrate1RewardByThemeId(theme.id);
    if (theme.id === "default") {
        return { rarity: "core", category: "starter", source: "Starter" };
    }
    if (passReward || typeof theme.level === "number") {
        return {
            rarity: passReward?.rarity || (theme.level >= 20 ? "legendary" : theme.level >= 15 ? "epic" : "rare"),
            category: "pass",
            source: passReward ? getSharkPassRewardSourceLabel(passReward) : getSharkPassRewardSourceLabel(null, theme.level),
            passLevel: passReward?.level ?? theme.level,
            passNumber: passReward ? 2 : 1
        };
    }
    if (crateReward || legacyCrate1Reward) {
        const sourceReward = crateReward || legacyCrate1Reward;
        const source = getCrateRewardSourceLabel(sourceReward);
        return { rarity: sourceReward.rarity || "rare", category: "crate", source };
    }
    return { rarity: "special", category: "reward", source: "Achievement" };
}

function getBadgeCosmeticMeta(badge) {
    const rarityMeta = typeof getBadgeRarityMeta === "function"
        ? getBadgeRarityMeta(badge)
        : { className: badge?.rarity || "common", label: getCosmeticRarityLabel(badge?.rarity) };
    const passReward = sharkPassRewards.find(reward => reward.type === "badge" && reward.badgeId === badge.id);
    const crateReward = getAllCrateBadgeRewards().find(reward => reward.badgeId === badge.id);
    if (badge.id === "starter") return { rarity: "core", category: "starter", source: "Starter" };
    if (passReward || badge.passLevel) {
        return {
            rarity: rarityMeta.className,
            category: "pass",
            source: passReward ? getSharkPassRewardSourceLabel(passReward) : getSharkPassRewardSourceLabel(null, badge.passLevel),
            passLevel: passReward?.level ?? badge.passLevel,
            passNumber: passReward ? 2 : 1
        };
    }
    if (crateReward) return { rarity: rarityMeta.className, category: "crate", source: getCrateRewardSourceLabel(crateReward) };
    if (badge.codeUnlock) return { rarity: rarityMeta.className, category: "code", source: "Code" };
    if (badge.achievementReward) return { rarity: rarityMeta.className, category: "reward", source: "Achievement" };
    return { rarity: rarityMeta.className, category: "reward", source: "Reward" };
}

function shouldShowCosmetic(item, activeFilter) {
    const filter = normalizeCosmeticFilterValue(activeFilter);
    if (filter === "all") return true;
    return normalizeCosmeticFilterValue(item.category) === filter
        || normalizeCosmeticFilterValue(item.rarity) === filter
        || normalizeCosmeticFilterValue(item.source).includes(filter);
}

function matchesCosmeticSearch(item = {}) {
    const query = String(profileInventoryFilters.search || "").trim().toLowerCase();
    if (!query) return true;
    return [
        item.name,
        item.label,
        item.id,
        item.source,
        item.category,
        item.rarity
    ].some(value => String(value || "").toLowerCase().includes(query));
}

function setProfileInventorySearch(query = "") {
    profileInventoryFilters.search = String(query || "").trim().toLowerCase();
    renderProfileInventoryUI();
}

window.setProfileInventorySearch = setProfileInventorySearch;

function getCosmeticRaritySortRank(rarity = "common") {
    const order = ["core", "starter", "common", "rare", "epic", "legendary"];
    const rank = order.indexOf(normalizeCosmeticFilterValue(rarity));
    return rank === -1 ? order.indexOf("common") : rank;
}

function sortCosmeticsForLocker(items) {
    return [...items].sort((a, b) => {
        if (isPassCosmetic(a) && isPassCosmetic(b)) {
            const aPass = getCosmeticPassSortMeta(a);
            const bPass = getCosmeticPassSortMeta(b);
            const levelDiff = aPass.passLevel - bPass.passLevel;
            if (levelDiff !== 0) return levelDiff;
            const passDiff = aPass.passNumber - bPass.passNumber;
            if (passDiff !== 0) return passDiff;
        }
        const rarityDiff = getCosmeticRaritySortRank(a.rarity) - getCosmeticRaritySortRank(b.rarity);
        if (rarityDiff !== 0) return rarityDiff;
        const categoryDiff = normalizeCosmeticFilterValue(a.category).localeCompare(normalizeCosmeticFilterValue(b.category));
        if (categoryDiff !== 0) return categoryDiff;
        return String(a.name || a.label || "").localeCompare(String(b.name || b.label || ""));
    });
}

function ensureProfileInventoryFilterBar(category, filters) {
    const section = document.querySelector(`[data-profile-inventory-section="${category}"]`);
    if (!section) return;
    let bar = section.querySelector(".profile-cosmetic-filters");
    if (!bar) {
        bar = document.createElement("div");
        bar.className = "profile-cosmetic-filters";
        const title = section.querySelector("h4");
        title?.insertAdjacentElement("afterend", bar);
    }
    const active = profileInventoryFilters[category] || "all";
    bar.innerHTML = filters.map(filter => `
        <button type="button" class="${active === filter ? "active" : ""}" onclick="setProfileInventoryFilter('${category}', '${filter}')">${cosmeticFilterLabels[filter] || filter}</button>
    `).join("");
}

function setProfileInventoryFilter(category, filter = "all") {
    profileInventoryFilters[category] = normalizeCosmeticFilterValue(filter);
    renderProfileInventoryUI();
    showProfileInventoryCategory(category);
}

function renderProfileInventoryUI(profileData = getCurrentProfileData()) {
    const summary = document.getElementById("profile-inventory-summary");
    const pfpGrid = document.getElementById("profile-inventory-pfps");
    const badgeGrid = document.getElementById("profile-inventory-badges");
    const crateGrid = document.getElementById("profile-inventory-crates");
    if (!pfpGrid && !badgeGrid && !crateGrid && !summary) return;

    const pfps = typeof buildProfilePicPickerCatalog === "function"
        ? buildProfilePicPickerCatalog().filter(item => item.unlocked)
        : [];
    const badges = typeof getUnlockedBadges === "function" ? getUnlockedBadges(currentUser?.uid, profileData) : [];
    const themes = typeof getUnlockedCardThemes === "function" ? getUnlockedCardThemes(profileData) : [];
    const inventory = typeof getCrateInventory === "function" ? getCrateInventory(profileData) : {};
    const shieldCount = Number(profileData.streakShields || profileData.shields || 0);

    if (summary) {
        summary.innerHTML = `
            <article><strong>${pfps.length}</strong><span>Portraits</span></article>
            <article><strong>${badges.length}</strong><span>Badges</span></article>
            <article><strong>${themes.length}</strong><span>Themes</span></article>
            <article><strong>${Object.values(inventory).reduce((a, b) => a + Number(b || 0), 0)}</strong><span>Crates</span></article>
        `;
    }

    if (pfpGrid) {
        ensureProfileInventoryFilterBar("portraits", ["all", "starter", "pass", "crate", "reward", "common", "rare", "epic", "legendary"]);
        const normalizePath = path => String(path || "").replace(/\\/g, "/").replace(/^\.?\//, "").trim().toLowerCase();
        const equipped = normalizePath(profileData.profilePicture || profileData.profilePic || "images/pfp/shark1.png");
        const visiblePfps = sortCosmeticsForLocker(pfps
            .filter(pfp => shouldShowCosmetic(pfp, profileInventoryFilters.portraits))
            .filter(pfp => matchesCosmeticSearch(pfp))
        ).slice(0, 48);
        pfpGrid.innerHTML = visiblePfps.map(pfp => `
            <button class="profile-inventory-card pfp rarity-${pfp.rarity || "common"} ${normalizePath(pfp.imagePath) === equipped ? "equipped" : ""}" onclick="setProfilePicture('${pfp.imagePath.replace(/'/g, "\\'")}')">
                <img src="${pfp.imagePath}" alt="${pfp.name}">
                <span>${pfp.name}</span>
                <small class="cosmetic-chip-row"><b class="rarity-chip rarity-${pfp.rarity || "common"}">${getPfpRarityLabel?.(pfp.rarity) || getCosmeticRarityLabel(pfp.rarity)}</b><b class="source-chip" title="${pfp.source || "Reward"}">${getShortCosmeticSourceLabel(pfp.source)}</b></small>
            </button>
        `).join("") || `<div class="profile-empty-card">No portraits match this filter.</div>`;
    }

    if (badgeGrid) {
        ensureProfileInventoryFilterBar("badges", ["all", "starter", "pass", "crate", "code", "reward", "common", "rare", "epic", "legendary"]);
        const normalizeId = id => String(id || "starter").trim().toLowerCase();
        const equippedBadge = normalizeId(profileData.equippedBadge || getEquippedBadge?.(profileData) || "starter");
        const visibleBadges = badges
            .map(badge => ({ ...badge, ...getBadgeCosmeticMeta(badge) }))
            .filter(badge => shouldShowCosmetic(badge, profileInventoryFilters.badges))
            .filter(badge => matchesCosmeticSearch(badge));
        badgeGrid.innerHTML = sortCosmeticsForLocker(visibleBadges).map(badge => `
            <button class="profile-inventory-card badge rarity-${badge.rarity} ${normalizeId(badge.id) === equippedBadge ? "equipped" : ""}" onclick="setEquippedBadge('${badge.id}')">
                <span class="badge-mark">${badge.emoji || "\u{1F988}"}</span>
                <span>${badge.name}</span>
                <small class="cosmetic-chip-row"><b class="rarity-chip rarity-${badge.rarity}">${getCosmeticRarityLabel(badge.rarity)}</b><b class="source-chip" title="${badge.source}">${getShortCosmeticSourceLabel(badge.source)}</b></small>
            </button>
        `).join("") || `<div class="profile-empty-card">No badges match this filter.</div>`;
    }

    const themeGrid = document.getElementById("theme-select-container");
    if (themeGrid) {
        ensureProfileInventoryFilterBar("themes", ["all", "starter", "pass", "crate", "reward", "rare", "epic", "legendary"]);
    }

    if (typeof renderThemeSelection === "function") renderThemeSelection();

    if (crateGrid) {
        ensureProfileInventoryFilterBar("items", ["all", "crate", "item"]);
        const crates = [
            { id: "reef", label: "Cosmetic Crate", icon: "fa-box-open", category: "crate", rarity: "item", source: "Cosmetic Crate" },
            { id: "summer", label: "Summer Crate", icon: "fa-umbrella-beach", category: "crate", rarity: "item", source: "Summer Crate" },
            { id: "christmas", label: "Christmas Crate", icon: "fa-snowflake", category: "crate", rarity: "item", source: "Christmas Crate" },
            { id: "halloween", label: "Halloween Crate", icon: "fa-ghost", category: "crate", rarity: "item", source: "Halloween Crate" }
        ];
        const items = [...crates, { id: "shield", label: "Streak Shields", icon: "fa-shield-halved", category: "item", rarity: "epic", source: "Utility", count: shieldCount }];
        crateGrid.innerHTML = sortCosmeticsForLocker(items
            .filter(item => shouldShowCosmetic(item, profileInventoryFilters.items))
            .filter(item => matchesCosmeticSearch(item))
        ).map(item => `
            <article class="profile-inventory-card utility rarity-${item.rarity}">
                <i class="fa-solid ${item.icon}"></i>
                <span>${item.label}</span>
                <strong>${Number(item.count ?? inventory[item.id] ?? 0)}</strong>
                <small class="cosmetic-chip-row"><b class="rarity-chip rarity-${item.rarity}">${getCosmeticRarityLabel(item.rarity)}</b><b class="source-chip" title="${item.source}">${getShortCosmeticSourceLabel(item.source)}</b></small>
            </article>
        `).join("") || `<div class="profile-empty-card">No items match this filter.</div>`;
    }
}

function showProfileInventoryCategory(category = "portraits") {
    const validCategories = ["portraits", "badges", "themes", "items", "codes"];
    const activeCategory = validCategories.includes(category) ? category : "portraits";
    document.querySelectorAll("[data-profile-inventory-tab]").forEach(button => {
        button.classList.toggle("active", button.dataset.profileInventoryTab === activeCategory);
    });
    document.querySelectorAll("[data-profile-inventory-section]").forEach(section => {
        const isActive = section.dataset.profileInventorySection === activeCategory;
        section.hidden = !isActive;
        section.classList.toggle("active", isActive);
    });
    document.querySelectorAll("[data-profile-inventory-search]").forEach(search => {
        search.hidden = activeCategory === "codes";
    });
    localStorage.setItem("profileInventoryCategory", activeCategory);
}

const originalShowProfileTab = window.showProfileTab;
window.showProfileTab = function(tab = "overview") {
    const validTabs = ["overview", "inventory", "stats", "recent", "friends", "settings"];
    const activeTab = validTabs.includes(tab) ? tab : "overview";
    validTabs.forEach(name => {
        const panel = document.getElementById(name === "inventory" ? "profile-inventory-tab" : `${name}-tab`);
        const btn = document.getElementById(`${name}-tab-btn`);
        if (panel) {
            panel.style.display = name === activeTab ? "block" : "none";
            panel.classList.toggle("active", name === activeTab);
        }
        if (btn) btn.classList.toggle("active", name === activeTab);
    });
    if (activeTab === "stats") {
        saveLastViewedStats?.();
        animateStatsFromLastView?.();
    } else if (activeTab === "recent") {
        saveLastViewedStats?.();
        renderRecentGames?.();
    } else if (activeTab === "friends") {
        populateFriendsTab?.();
    } else if (activeTab === "inventory") {
        renderProfileInventoryUI?.();
        renderThemeSelection?.();
        showProfileInventoryCategory(localStorage.getItem("profileInventoryCategory") || "portraits");
    } else if (activeTab === "overview") {
        syncProfileOverviewStats?.();
        renderProfileAchievementShowcase?.();
        const overviewList = document.getElementById("recent-games-list-overview");
        if (overviewList && typeof renderRecentGames === "function") {
            const mainList = document.getElementById("recent-games-list");
            renderRecentGames();
            if (mainList) overviewList.innerHTML = mainList.innerHTML || '<div class="profile-empty-card">No recent games yet.</div>';
        }
    }
    localStorage.setItem("profileLastTab", activeTab);
};

const originalOpenProfileModal = window.openProfileModal;
window.openProfileModal = async function() {
    await originalOpenProfileModal?.();
    syncProfileOverviewStats?.();
    renderProfileInventoryUI?.();
    renderProfileAchievementShowcase?.();
    window.showProfileTab("overview");
};

window.openCraftingModalFromHome = openCraftingModalFromHome;
window.closeCraftingModal = closeCraftingModal;
window.showProfileInventoryCategory = showProfileInventoryCategory;
window.setProfileInventoryFilter = setProfileInventoryFilter;
window.renderProfileInventoryUI = renderProfileInventoryUI;

const SHARKDLE_ANDROID_VERSION = "1.0.1";
const SHARKDLE_ANDROID_VERSION_CODE = 10001;
const SHARKDLE_ANDROID_UPDATE_MANIFEST_URL = "https://raw.githubusercontent.com/Noobler28/Sharkdle/main/Mobile%20Release/latest.json";
const SHARKDLE_ANDROID_DOWNLOAD_URL = "https://github.com/Noobler28/Sharkdle/tree/main/Mobile%20Release";

function compareVersionStrings(a = "0.0.0", b = "0.0.0") {
    const left = String(a).split(".").map(part => Number.parseInt(part, 10) || 0);
    const right = String(b).split(".").map(part => Number.parseInt(part, 10) || 0);
    const length = Math.max(left.length, right.length);
    for (let index = 0; index < length; index += 1) {
        const diff = (left[index] || 0) - (right[index] || 0);
        if (diff !== 0) return diff;
    }
    return 0;
}

function isNewerAndroidRelease(release = {}) {
    const remoteCode = Number(release.versionCode || 0);
    if (remoteCode && remoteCode > SHARKDLE_ANDROID_VERSION_CODE) return true;
    if (remoteCode && remoteCode <= SHARKDLE_ANDROID_VERSION_CODE) return false;
    return compareVersionStrings(release.version, SHARKDLE_ANDROID_VERSION) > 0;
}

function openAndroidUpdateDownload(url = SHARKDLE_ANDROID_DOWNLOAD_URL) {
    const target = url || SHARKDLE_ANDROID_DOWNLOAD_URL;
    try {
        const opened = window.open(target, "_system");
        if (opened) return;
    } catch (error) {
        // Fall through to same-window navigation.
    }
    window.location.href = target;
}

function escapeHtml(value = "") {
    return String(value)
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#39;");
}

function showAndroidUpdatePrompt(release = {}) {
    const version = release.version || "new";
    const sessionKey = `sharkdle-update-dismissed-${version}`;
    if (sessionStorage.getItem(sessionKey) === "true") return;
    if (document.getElementById("android-update-prompt")) return;

    const downloadUrl = release.downloadUrl || SHARKDLE_ANDROID_DOWNLOAD_URL;
    const backdrop = document.createElement("div");
    backdrop.id = "android-update-prompt";
    backdrop.className = "app-update-backdrop";
    backdrop.innerHTML = `
        <section class="app-update-card" role="dialog" aria-modal="true" aria-labelledby="android-update-title">
            <span>Android update</span>
            <h2 id="android-update-title">Update available</h2>
            <p>${escapeHtml(release.message || "A new Sharkdle Android update is available.")}</p>
            <div class="app-update-actions">
                <a href="${escapeHtml(downloadUrl)}" target="_blank" rel="noopener">Download update</a>
                <button type="button" data-update-dismiss>Later</button>
            </div>
        </section>
    `;

    const closePrompt = () => {
        sessionStorage.setItem(sessionKey, "true");
        backdrop.remove();
    };

    backdrop.querySelector("[data-update-dismiss]")?.addEventListener("click", closePrompt);
    backdrop.querySelector("a")?.addEventListener("click", event => {
        event.preventDefault();
        closePrompt();
        openAndroidUpdateDownload(downloadUrl);
    });

    document.body.appendChild(backdrop);
}

async function checkSharkdleAndroidUpdate(options = {}) {
    const manifestUrl = options.manifestUrl || SHARKDLE_ANDROID_UPDATE_MANIFEST_URL;
    try {
        const response = await fetch(manifestUrl, { cache: "no-store" });
        if (!response.ok) return null;
        const release = await response.json();
        if (!isNewerAndroidRelease(release)) return release;
        showAndroidUpdatePrompt(release);
        return release;
    } catch (error) {
        return null;
    }
}

function isCordovaAndroidShell() {
    return Boolean(window.cordova) && /Android/i.test(navigator.userAgent || "");
}

function initAndroidUpdateCheck() {
    if (!isCordovaAndroidShell()) return;
    checkSharkdleAndroidUpdate();
}

if (window.cordova) {
    document.addEventListener("deviceready", initAndroidUpdateCheck, false);
}

window.checkSharkdleAndroidUpdate = checkSharkdleAndroidUpdate;
window.isNewerAndroidRelease = isNewerAndroidRelease;
window.showAndroidUpdatePrompt = showAndroidUpdatePrompt;
